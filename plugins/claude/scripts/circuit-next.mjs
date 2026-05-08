#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
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
          text.includes('--progress jsonl'),
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
  return args[0] === 'run' || args.includes('--goal');
}

function shouldInjectCreateTemplateRoot(args) {
  if (args.includes('--template-flow-root')) return false;
  if (args.includes('--help') || args.includes('-h')) return false;
  return args[0] === 'create';
}

if (rawArgs[0] === 'doctor') {
  process.exit(runDoctor());
}

const injectPackagedFlowRoot = shouldInjectPackagedFlowRoot(rawArgs);
const forwardedArgs = injectPackagedFlowRoot
  ? [...rawArgs, '--flow-root', packagedFlowRoot]
  : shouldInjectCreateTemplateRoot(rawArgs)
    ? [...rawArgs, '--template-flow-root', packagedFlowRoot]
    : rawArgs;

const childEnv = { ...process.env };
if (injectPackagedFlowRoot) {
  childEnv[GENERATED_FLOW_MIRROR_ROOT_ENV] = packagedFlowRoot;
} else {
  delete childEnv[GENERATED_FLOW_MIRROR_ROOT_ENV];
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
