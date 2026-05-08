#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(scriptDir, '..');
const packagedFlowRoot = resolve(pluginRoot, 'skills');
const GENERATED_FLOW_MIRROR_ROOT_ENV = 'CIRCUIT_GENERATED_FLOW_MIRROR_ROOT';

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

function findLocalLauncher() {
  const candidate = resolve(projectRoot(), 'bin/circuit-next');
  if (existsSync(candidate)) return candidate;
  return undefined;
}

function hasPathCommand(command) {
  const pathValue = process.env.PATH ?? '';
  for (const segment of pathValue.split(delimiter)) {
    if (segment.length === 0) continue;
    if (existsSync(resolve(segment, command))) return true;
  }
  return false;
}

const localLauncher = findLocalLauncher();
const command = localLauncher ?? 'circuit-next';
const rawArgs = process.argv.slice(2);

function commandExists() {
  return localLauncher !== undefined || hasPathCommand(command);
}

function check(name, ok, detail) {
  return detail === undefined ? { name, ok } : { name, ok, detail };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listMarkdownFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringField(record, key) {
  const value = isRecord(record) ? record[key] : undefined;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringArrayField(record, key) {
  const value = isRecord(record) ? record[key] : undefined;
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function shellSingleQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function choiceLabel(choice) {
  return choice
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function readCheckpointPrompt(requestPath) {
  try {
    const raw = JSON.parse(readFileSync(requestPath, 'utf8'));
    return stringField(raw, 'prompt') ?? 'Choose how to continue this checkpoint.';
  } catch {
    return 'Choose how to continue this checkpoint.';
  }
}

function hasProgressFlag(args) {
  return args.some((arg) => arg === '--progress' || arg.startsWith('--progress='));
}

function withProgressJsonl(args) {
  return hasProgressFlag(args) ? args : [...args, '--progress', 'jsonl'];
}

function shouldRenderDisplay(event) {
  const display = isRecord(event) ? event.display : undefined;
  if (!isRecord(display)) return false;
  const importance = stringField(display, 'importance');
  const tone = stringField(display, 'tone');
  return importance === 'major' || tone === 'warning' || tone === 'error' || tone === 'checkpoint';
}

function renderLine(text = '') {
  process.stdout.write(`${text}\n`);
}

function renderUserInputEvent(event) {
  const questions = Array.isArray(event.questions) ? event.questions : [];
  const question = questions.find((item) => isRecord(item));
  const questionText = stringField(question, 'question') ?? stringField(event.display, 'text');
  if (questionText !== undefined) renderLine(questionText);
  const options = Array.isArray(question?.options) ? question.options : [];
  for (const option of options) {
    if (!isRecord(option)) continue;
    const label = stringField(option, 'label');
    if (label === undefined) continue;
    const description = stringField(option, 'description');
    renderLine(description === undefined ? `- ${label}` : `- ${label}: ${description}`);
  }
}

function renderCheckpointFromResult(result) {
  const checkpoint = isRecord(result.checkpoint) ? result.checkpoint : undefined;
  if (checkpoint === undefined) {
    renderLine('Circuit is waiting for a checkpoint choice.');
  } else {
    const requestPath = stringField(checkpoint, 'request_path');
    renderLine(
      requestPath === undefined
        ? 'Choose how to continue this checkpoint.'
        : readCheckpointPrompt(requestPath),
    );
    for (const choice of stringArrayField(checkpoint, 'allowed_choices')) {
      renderLine(`- ${choiceLabel(choice)}: ${choice}`);
    }
  }
  const runFolder = stringField(result, 'run_folder');
  if (runFolder !== undefined) {
    renderLine('');
    renderLine('Resume with:');
    renderLine(
      `node "\${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present resume --run-folder ${shellSingleQuote(
        runFolder,
      )} --checkpoint-choice '<choice>'`,
    );
  }
}

function debugPathFromResult(result) {
  return (
    stringField(result, 'operator_summary_markdown_path') ??
    stringField(result, 'operator_summary_path') ??
    stringField(result, 'result_path') ??
    stringField(result, 'run_folder')
  );
}

function renderFinalResult(stdoutText, checkpointWasRendered) {
  let result;
  try {
    result = JSON.parse(stdoutText.trim());
  } catch {
    process.stderr.write(
      'Circuit finished, but the presentation wrapper could not parse final JSON.\n',
    );
    return 1;
  }
  if (!isRecord(result)) {
    process.stderr.write('Circuit finished, but the final JSON was not an object.\n');
    return 1;
  }

  const outcome = stringField(result, 'outcome');
  if (outcome === 'complete') {
    const summaryPath = stringField(result, 'operator_summary_markdown_path');
    if (summaryPath !== undefined && existsSync(summaryPath)) {
      const markdown = readFileSync(summaryPath, 'utf8');
      process.stdout.write(markdown.endsWith('\n') ? markdown : `${markdown}\n`);
      return 0;
    }
    renderLine('Circuit completed, but the summary Markdown was not available.');
    const debugPath = debugPathFromResult(result);
    if (debugPath !== undefined) renderLine(`Debug path: ${debugPath}`);
    return 0;
  }

  if (outcome === 'checkpoint_waiting') {
    if (!checkpointWasRendered) renderCheckpointFromResult(result);
    const runFolder = stringField(result, 'run_folder');
    if (checkpointWasRendered && runFolder !== undefined) {
      renderLine('');
      renderLine('Resume with:');
      renderLine(
        `node "\${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs" present resume --run-folder ${shellSingleQuote(
          runFolder,
        )} --checkpoint-choice '<choice>'`,
      );
    }
    return 0;
  }

  if (outcome === 'aborted') {
    const reason = stringField(result, 'reason') ?? 'Circuit aborted before completing.';
    renderLine(`Circuit aborted: ${reason}`);
    const runFolder = stringField(result, 'run_folder');
    if (runFolder !== undefined) renderLine(`Run folder: ${runFolder}`);
    return 0;
  }

  renderLine('Circuit finished, but the presentation wrapper did not recognize the outcome.');
  const debugPath = debugPathFromResult(result);
  if (debugPath !== undefined) renderLine(`Debug path: ${debugPath}`);
  return 0;
}

function shortDiagnostic(lines) {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('{') && !line.startsWith('['))
    .slice(-4);
}

function runDoctor() {
  const checks = [];
  const manifestPath = resolve(pluginRoot, '.claude-plugin/plugin.json');
  checks.push(check('plugin_manifest_exists', existsSync(manifestPath), manifestPath));

  let manifest;
  try {
    manifest = existsSync(manifestPath) ? readJson(manifestPath) : undefined;
    checks.push(check('plugin_manifest_parseable', manifest !== undefined, manifestPath));
  } catch (err) {
    checks.push(
      check('plugin_manifest_parseable', false, err instanceof Error ? err.message : String(err)),
    );
  }

  checks.push(
    check(
      'plugin_manifest_shape',
      manifest?.name === 'circuit' && !('hooks' in (manifest ?? {})),
      manifestPath,
    ),
  );

  const hooksConfigPath = resolve(pluginRoot, 'hooks/hooks.json');
  const sessionStartPath = resolve(pluginRoot, 'hooks/session-start.mjs');
  checks.push(check('hooks_config_exists', existsSync(hooksConfigPath), hooksConfigPath));
  checks.push(check('session_start_hook_exists', existsSync(sessionStartPath), sessionStartPath));

  if (existsSync(hooksConfigPath)) {
    const hooks = readFileSync(hooksConfigPath, 'utf8');
    checks.push(
      check(
        'session_start_hook_uses_plugin_root',
        hooks.includes('${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs'),
        hooksConfigPath,
      ),
    );
  }

  const commandsRoot = resolve(pluginRoot, 'commands');
  checks.push(check('commands_directory_exists', existsSync(commandsRoot), commandsRoot));
  for (const name of listMarkdownFiles(commandsRoot)) {
    const commandPath = resolve(commandsRoot, name);
    const text = readFileSync(commandPath, 'utf8');
    checks.push(
      check(
        `command_${name}_uses_wrapper`,
        text.includes('node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs"') &&
          !text.includes('./bin/circuit-next') &&
          text.includes(' present '),
        commandPath,
      ),
    );
  }

  checks.push(check('packaged_flow_root_exists', existsSync(packagedFlowRoot), packagedFlowRoot));
  for (const flow of ['build', 'explore', 'fix', 'migrate', 'review', 'sweep']) {
    const flowPath = resolve(packagedFlowRoot, flow, 'circuit.json');
    checks.push(check(`packaged_flow_${flow}`, existsSync(flowPath), flowPath));
  }
  checks.push(check('circuit_next_binary_available', commandExists(), command));

  const ok = checks.every((item) => item.ok);
  process.stdout.write(
    `${JSON.stringify(
      {
        schema_version: 1,
        host: 'claude-code',
        status: ok ? 'ok' : 'fail',
        plugin_root: pluginRoot,
        flow_root: packagedFlowRoot,
        command,
        checks,
      },
      null,
      2,
    )}\n`,
  );
  return ok ? 0 : 1;
}

function shouldInjectPackagedFlowRoot(args) {
  if (args.includes('--fixture') || args.includes('--flow-root')) return false;
  if (args.includes('--help') || args.includes('-h')) return false;
  if (args[0] === 'resume' || args.includes('--checkpoint-choice')) return false;
  return args[0] === 'run';
}

function shouldInjectCreateTemplateRoot(args) {
  if (args.includes('--template-flow-root')) return false;
  if (args.includes('--help') || args.includes('-h')) return false;
  return args[0] === 'create';
}

if (rawArgs[0] === 'doctor') {
  process.exit(runDoctor());
}

function forwardedInvocation(args) {
  const injectPackagedFlowRoot = shouldInjectPackagedFlowRoot(args);
  const forwardedArgs = injectPackagedFlowRoot
    ? [...args, '--flow-root', packagedFlowRoot]
    : shouldInjectCreateTemplateRoot(args)
      ? [...args, '--template-flow-root', packagedFlowRoot]
      : args;

  const childEnv = { ...process.env };
  if (injectPackagedFlowRoot) {
    childEnv[GENERATED_FLOW_MIRROR_ROOT_ENV] = packagedFlowRoot;
  } else {
    delete childEnv[GENERATED_FLOW_MIRROR_ROOT_ENV];
  }
  return { forwardedArgs, childEnv };
}

if (!commandExists()) {
  process.stderr.write(
    [
      'error: could not find circuit-next.',
      'Run this from a circuit-next checkout, or install a package that provides the circuit-next binary.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

if (rawArgs[0] === 'present') {
  const presentArgs = withProgressJsonl(rawArgs.slice(1));
  const { forwardedArgs, childEnv } = forwardedInvocation(presentArgs);
  const child = spawn(command, forwardedArgs, {
    cwd: projectRoot(),
    env: childEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  let stdoutText = '';
  let stderrRemainder = '';
  const diagnosticLines = [];
  let checkpointWasRendered = false;

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdoutText += chunk;
  });

  function handleStderrLine(line) {
    if (line.trim().length === 0) return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      diagnosticLines.push(line);
      return;
    }
    if (!isRecord(parsed)) return;
    if (parsed.type === 'route.selected') return;
    if (parsed.type === 'user_input.requested') {
      renderUserInputEvent(parsed);
      checkpointWasRendered = true;
      return;
    }
    if (!shouldRenderDisplay(parsed)) return;
    const text = stringField(parsed.display, 'text');
    if (text !== undefined) renderLine(text);
  }

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderrRemainder += chunk;
    const lines = stderrRemainder.split(/\r?\n/);
    stderrRemainder = lines.pop() ?? '';
    for (const line of lines) handleStderrLine(line);
  });

  child.on('error', (err) => {
    process.stderr.write(`error: failed to start circuit-next: ${err.message}\n`);
    process.exit(1);
  });

  child.on('close', (status) => {
    if (stderrRemainder.trim().length > 0) handleStderrLine(stderrRemainder);
    const exitStatus = status ?? 1;
    if (exitStatus !== 0) {
      process.stderr.write(`Circuit run failed (exit ${exitStatus}).\n`);
      const diagnostic = shortDiagnostic(diagnosticLines);
      if (diagnostic.length > 0) {
        process.stderr.write('Diagnostic:\n');
        for (const line of diagnostic) process.stderr.write(`${line}\n`);
      }
      process.exit(exitStatus);
    }
    process.exit(renderFinalResult(stdoutText, checkpointWasRendered));
  });
} else {
  const { forwardedArgs, childEnv } = forwardedInvocation(rawArgs);

  const result = spawnSync(command, forwardedArgs, {
    cwd: projectRoot(),
    env: childEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (typeof result.stdout === 'string' && result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (typeof result.stderr === 'string' && result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    process.stderr.write(`error: failed to start circuit-next: ${result.error.message}\n`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}
