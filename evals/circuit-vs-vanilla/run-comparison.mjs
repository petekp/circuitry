#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

const SUPPORTED_PROVIDERS = ['codex', 'claude-code'];
const DEFAULT_PROVIDER = 'codex';
const DEFAULT_MODEL_BY_PROVIDER = {
  codex: 'gpt-5.4-mini',
  'claude-code': 'claude-haiku-4-5-20251001',
};
const DEFAULT_EFFORT = 'low';
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_RESULTS_ROOT = resolve(__dirname, 'results');

function usage() {
  return `Usage:
  node evals/circuit-vs-vanilla/run-comparison.mjs \\
    --task-id <id> \\
    --prompt-file <path> \\
    [--provider codex|claude-code] \\
    [--flow auto|explore|review|build|fix|migrate|sweep] \\
    [--model <model-id>] \\
    [--effort low] \\
    [--timeout-ms 1200000] \\
    [--out-dir evals/circuit-vs-vanilla/results] \\
    [--skip-build] \\
    [--dry-run]

Runs two arms with the same prompt and same provider model:
  1. circuit-<provider>: node bin/circuit-next run ...
  2. vanilla-<provider>: <provider CLI> ...

Default provider is 'codex' for back-compatibility. With --provider claude-code,
both arms invoke Claude Code; the Circuit arm runs the configured flow and the
vanilla arm runs the prompt directly through 'claude -p' with the same model,
effort, and tool surface.

--dry-run prints the resolved metadata (including the exact arm commands) and
exits without invoking either model. Combine with --skip-build to skip the
TypeScript build as well.

Outputs are written to:
  evals/circuit-vs-vanilla/results/<timestamp>-<task-id>/
`;
}

function parseArgs(argv) {
  const args = {
    taskId: undefined,
    promptFile: undefined,
    flow: 'auto',
    provider: DEFAULT_PROVIDER,
    model: undefined,
    effort: DEFAULT_EFFORT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    outDir: DEFAULT_RESULTS_ROOT,
    skipBuild: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage());
      process.exit(0);
    }
    if (arg === '--task-id') {
      args.taskId = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--prompt-file') {
      args.promptFile = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--flow') {
      args.flow = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--provider') {
      args.provider = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--model') {
      args.model = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--effort') {
      args.effort = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--timeout-ms') {
      args.timeoutMs = Number.parseInt(requireValue(argv, i, arg), 10);
      i += 1;
    } else if (arg === '--out-dir') {
      args.outDir = resolve(requireValue(argv, i, arg));
      i += 1;
    } else if (arg === '--skip-build') {
      args.skipBuild = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else {
      throw new Error(`unknown arg: ${arg}`);
    }
  }

  if (args.promptFile === undefined) throw new Error('--prompt-file is required');
  if (args.taskId === undefined) {
    args.taskId = basename(args.promptFile).replace(/\.[^.]+$/, '');
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }
  if (!['auto', 'explore', 'review', 'build', 'fix', 'migrate', 'sweep'].includes(args.flow)) {
    throw new Error(`unsupported --flow '${args.flow}'`);
  }
  if (!SUPPORTED_PROVIDERS.includes(args.provider)) {
    throw new Error(
      `unsupported --provider '${args.provider}'; supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
    );
  }
  if (args.model === undefined) {
    args.model = DEFAULT_MODEL_BY_PROVIDER[args.provider];
  }
  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    env: options.env ?? process.env,
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function commandOutput(command, args, fallback = 'unavailable') {
  try {
    const result = runSync(command, args);
    if (result.status !== 0) return fallback;
    return result.stdout.trim() || fallback;
  } catch {
    return fallback;
  }
}

function findExecutable(name, { required = true } = {}) {
  let result;
  try {
    result = runSync('zsh', ['-lc', `command -v ${shellQuote(name)}`]);
  } catch {
    // zsh may not be installed in CI; fall through to required-handling.
    result = { status: 1, stdout: '' };
  }
  if (result.status !== 0) {
    if (required) throw new Error(`could not find ${name} on PATH`);
    return name;
  }
  return result.stdout.trim();
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function safeSegment(value) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'task';
}

function isoForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function redactedCommand(command, args) {
  return [command, ...args.map((arg) => (arg.length > 400 ? '<prompt from prompt.md>' : arg))];
}

function createCodexWrapper(realCodex, model, effort) {
  const binDir = mkdtempSync(resolve(tmpdir(), 'circuit-vs-vanilla-codex-'));
  const wrapperPath = resolve(binDir, 'codex');
  writeFileSync(
    wrapperPath,
    `#!/usr/bin/env bash
set -euo pipefail

if [[ "\${1:-}" == "exec" ]]; then
  shift
  exec "$REAL_CODEX" exec -m "$CIRCUIT_VS_VANILLA_MODEL" -c "model_reasoning_effort=\\"$CIRCUIT_VS_VANILLA_EFFORT\\"" "$@"
fi

exec "$REAL_CODEX" "$@"
`,
    { mode: 0o755 },
  );
  return {
    binDir,
    env: {
      ...process.env,
      REAL_CODEX: realCodex,
      CIRCUIT_VS_VANILLA_MODEL: model,
      CIRCUIT_VS_VANILLA_EFFORT: effort,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
    },
  };
}

// Claude Code wrapper: shadows `claude` on PATH and injects --model / --effort
// when the caller did not already pass them. Both arms (Circuit's claude-code
// connector subprocess + the vanilla `claude -p` invocation) go through this
// wrapper so model and effort are pinned identically.
function createClaudeCodeWrapper(realClaude, model, effort) {
  const binDir = mkdtempSync(resolve(tmpdir(), 'circuit-vs-vanilla-claude-'));
  const wrapperPath = resolve(binDir, 'claude');
  writeFileSync(
    wrapperPath,
    `#!/usr/bin/env bash
set -euo pipefail

INJECT_MODEL=1
INJECT_EFFORT=1
for arg in "$@"; do
  case "$arg" in
    --model) INJECT_MODEL=0 ;;
    --effort) INJECT_EFFORT=0 ;;
  esac
done

INJECTED=()
if [[ "$INJECT_MODEL" -eq 1 ]]; then
  INJECTED+=(--model "$CIRCUIT_VS_VANILLA_MODEL")
fi
if [[ "$INJECT_EFFORT" -eq 1 ]]; then
  INJECTED+=(--effort "$CIRCUIT_VS_VANILLA_EFFORT")
fi
exec "$REAL_CLAUDE" "\${INJECTED[@]}" "$@"
`,
    { mode: 0o755 },
  );
  return {
    binDir,
    env: {
      ...process.env,
      REAL_CLAUDE: realClaude,
      CIRCUIT_VS_VANILLA_MODEL: model,
      CIRCUIT_VS_VANILLA_EFFORT: effort,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
    },
  };
}

function createWrapper(provider, realExecutable, model, effort) {
  if (provider === 'codex') return createCodexWrapper(realExecutable, model, effort);
  if (provider === 'claude-code') return createClaudeCodeWrapper(realExecutable, model, effort);
  throw new Error(`unsupported provider '${provider}'`);
}

// Vanilla Claude Code arm: same dispatch flags Circuit's claude-code connector
// uses, so the comparison holds tool surface constant. Plain text on stdout
// (no --output-format) so the runner can take stdout as the final answer.
function vanillaClaudeArgs(prompt) {
  return [
    '-p',
    '--permission-mode',
    'bypassPermissions',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--setting-sources',
    '',
    '--settings',
    '{}',
    '--no-session-persistence',
    prompt,
  ];
}

async function runCommand({ armId, command, args, cwd, env, timeoutMs, outputDir }) {
  mkdirSync(outputDir, { recursive: true });
  const startedAt = new Date();
  const start = performance.now();
  let stdout = '';
  let stderr = '';
  let timedOut = false;

  const result = await new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
      setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }, 2000).unref();
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(`[${armId}] ${chunk}`);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(`[${armId}] ${chunk}`);
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolvePromise({ exitCode: null, signal: null, error: error.message });
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout);
      resolvePromise({ exitCode, signal, error: undefined });
    });
  });

  const finishedAt = new Date();
  const durationMs = performance.now() - start;
  writeFileSync(resolve(outputDir, 'stdout.txt'), stdout);
  writeFileSync(resolve(outputDir, 'stderr.txt'), stderr);
  const metadata = {
    arm_id: armId,
    command: redactedCommand(command, args),
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    wallclock_ms: durationMs,
    exit_code: result.exitCode,
    signal: result.signal,
    timed_out: timedOut,
    error: result.error,
    stdout_path: resolve(outputDir, 'stdout.txt'),
    stderr_path: resolve(outputDir, 'stderr.txt'),
  };
  writeJson(resolve(outputDir, 'metadata.json'), metadata);
  return { ...metadata, stdout, stderr };
}

function extractCircuitFinalMarkdown(_circuitDir, stdout) {
  try {
    const parsed = JSON.parse(stdout);
    const summaryPath = parsed.operator_summary_markdown_path;
    if (typeof summaryPath === 'string' && existsSync(summaryPath)) {
      return readFileSync(summaryPath, 'utf8');
    }
  } catch {
    // Fall back to stdout below.
  }
  return stdout.trim();
}

function writeBlindReviewPackets(root, prompt, armIds, circuitFinal, vanillaFinal) {
  const rubric = [
    '- Task completion',
    '- Groundedness',
    '- Usefulness',
    '- Unnecessary effort',
    '- Risk and safety handling',
  ].join('\n');

  const packet = (firstLabel, firstText, secondLabel, secondText) => `# Blind Review Packet

Do not use runtime, cost, or arm identity when judging output quality.

## Prompt

${prompt}

## Rubric

${rubric}

## Output ${firstLabel}

${firstText.trim() || '_No output captured._'}

## Output ${secondLabel}

${secondText.trim() || '_No output captured._'}
`;

  writeFileSync(resolve(root, 'blind-review-A-then-B.md'), packet('A', circuitFinal, 'B', vanillaFinal));
  writeFileSync(resolve(root, 'blind-review-B-then-A.md'), packet('A', vanillaFinal, 'B', circuitFinal));
  writeJson(resolve(root, 'blind-mapping.json'), {
    'blind-review-A-then-B.md': { A: armIds.circuit, B: armIds.vanilla },
    'blind-review-B-then-A.md': { A: armIds.vanilla, B: armIds.circuit },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const promptPath = resolve(args.promptFile);
  if (!existsSync(promptPath)) throw new Error(`prompt file not found: ${promptPath}`);
  const prompt = readFileSync(promptPath, 'utf8').trim();
  if (prompt.length === 0) throw new Error(`prompt file is empty: ${promptPath}`);

  const providerExecutable = args.provider === 'codex' ? 'codex' : 'claude';
  // Dry-run only inspects printed command metadata and never spawns the
  // provider; the PATH check would otherwise block CI environments where
  // codex/claude aren't installed.
  const realProviderPath = findExecutable(providerExecutable, { required: !args.dryRun });
  const wrapper = createWrapper(args.provider, realProviderPath, args.model, args.effort);
  const timestamp = isoForPath();
  const resultRoot = resolve(args.outDir, `${timestamp}-${safeSegment(args.taskId)}`);
  const armIds = {
    circuit: `circuit-${args.provider}`,
    vanilla: `vanilla-${args.provider}`,
  };
  const circuitDir = resolve(resultRoot, armIds.circuit);
  const vanillaDir = resolve(resultRoot, armIds.vanilla);
  const circuitRunFolder = resolve(circuitDir, 'run');
  mkdirSync(circuitDir, { recursive: true });
  mkdirSync(vanillaDir, { recursive: true });

  const gitCommit = commandOutput('git', ['rev-parse', 'HEAD']);
  const gitStatus = commandOutput('git', ['status', '--short'], '');
  const providerVersion = commandOutput(realProviderPath, ['--version']);
  const circuitVersion = commandOutput('node', ['bin/circuit-next', 'version', '--json']);

  const circuitArgs = [
    'bin/circuit-next',
    'run',
    ...(args.flow === 'auto' ? [] : [args.flow]),
    '--goal',
    prompt,
    '--run-folder',
    circuitRunFolder,
    '--progress',
    'jsonl',
  ];
  const vanillaCommand = providerExecutable;
  const vanillaArgs =
    args.provider === 'codex'
      ? ['exec', '-s', 'read-only', '--ephemeral', '--skip-git-repo-check', '--color', 'never', prompt]
      : vanillaClaudeArgs(prompt);

  const metadata = {
    schema_version: 1,
    task_id: args.taskId,
    prompt_file: promptPath,
    prompt_path: resolve(resultRoot, 'prompt.md'),
    repo_root: REPO_ROOT,
    repo_commit: gitCommit,
    dirty_worktree: gitStatus.trim().length > 0,
    git_status_short: gitStatus,
    provider: args.provider,
    model: args.model,
    effort: args.effort,
    timeout_ms: args.timeoutMs,
    flow: args.flow,
    provider_version: providerVersion,
    circuit_version: safeJsonOrString(circuitVersion),
    result_root: resultRoot,
    arms: {
      [armIds.circuit]: {
        command: redactedCommand('node', circuitArgs),
        run_folder: circuitRunFolder,
      },
      [armIds.vanilla]: {
        command: redactedCommand(vanillaCommand, vanillaArgs),
      },
    },
  };

  mkdirSync(resultRoot, { recursive: true });
  writeFileSync(resolve(resultRoot, 'prompt.md'), `${prompt}\n`);
  writeJson(resolve(resultRoot, 'metadata.json'), metadata);

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
    process.stdout.write(`Dry run only. Results directory prepared at ${resultRoot}\n`);
    return;
  }

  if (!args.skipBuild) {
    process.stderr.write('Building compiled CLI before comparison...\n');
    const build = runSync('npm', ['run', 'build']);
    writeFileSync(resolve(resultRoot, 'build.stdout.txt'), build.stdout);
    writeFileSync(resolve(resultRoot, 'build.stderr.txt'), build.stderr);
    if (build.status !== 0) {
      throw new Error(`npm run build failed; see ${resolve(resultRoot, 'build.stderr.txt')}`);
    }
  }

  process.stderr.write(`Results: ${resultRoot}\n`);
  process.stderr.write(`Provider: ${args.provider}; model: ${args.model}; effort: ${args.effort}\n`);

  const circuit = await runCommand({
    armId: armIds.circuit,
    command: 'node',
    args: circuitArgs,
    cwd: REPO_ROOT,
    env: wrapper.env,
    timeoutMs: args.timeoutMs,
    outputDir: circuitDir,
  });

  const vanilla = await runCommand({
    armId: armIds.vanilla,
    command: vanillaCommand,
    args: vanillaArgs,
    cwd: REPO_ROOT,
    env: wrapper.env,
    timeoutMs: args.timeoutMs,
    outputDir: vanillaDir,
  });

  const circuitFinal = extractCircuitFinalMarkdown(circuitDir, circuit.stdout);
  const vanillaFinal = vanilla.stdout.trim();
  writeFileSync(resolve(circuitDir, 'final.md'), `${circuitFinal.trim()}\n`);
  writeFileSync(resolve(vanillaDir, 'final.md'), `${vanillaFinal}\n`);
  writeBlindReviewPackets(resultRoot, prompt, armIds, circuitFinal, vanillaFinal);

  writeJson(resolve(resultRoot, 'summary.json'), {
    schema_version: 1,
    task_id: args.taskId,
    result_root: resultRoot,
    provider: args.provider,
    model: args.model,
    effort: args.effort,
    repo_commit: gitCommit,
    dirty_worktree: gitStatus.trim().length > 0,
    arms: {
      [armIds.circuit]: {
        exit_code: circuit.exit_code,
        timed_out: circuit.timed_out,
        wallclock_ms: circuit.wallclock_ms,
        final_path: resolve(circuitDir, 'final.md'),
        run_folder: circuitRunFolder,
      },
      [armIds.vanilla]: {
        exit_code: vanilla.exit_code,
        timed_out: vanilla.timed_out,
        wallclock_ms: vanilla.wallclock_ms,
        final_path: resolve(vanillaDir, 'final.md'),
      },
    },
    blind_review_packets: [
      resolve(resultRoot, 'blind-review-A-then-B.md'),
      resolve(resultRoot, 'blind-review-B-then-A.md'),
    ],
  });

  process.stdout.write(`\nComparison complete.\nResults: ${resultRoot}\n`);
  process.stdout.write(`Circuit final: ${resolve(circuitDir, 'final.md')}\n`);
  process.stdout.write(`Vanilla final: ${resolve(vanillaDir, 'final.md')}\n`);
  process.stdout.write(`Blind review: ${resolve(resultRoot, 'blind-review-A-then-B.md')}\n`);
}

function safeJsonOrString(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

main().catch((err) => {
  process.stderr.write(`comparison failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
