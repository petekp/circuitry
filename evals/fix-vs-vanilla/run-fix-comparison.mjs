#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const MANIFEST_PATH = resolve(__dirname, 'manifest.json');
const DEFAULT_RESULTS_ROOT = resolve(__dirname, 'results');

function usage() {
  return `Usage:
  node evals/fix-vs-vanilla/run-fix-comparison.mjs \\
    [--set discovery|regression|held-out|all] \\
    [--task-id <id>] \\
    [--provider claude-code] \\
    [--model <model-id>] \\
    [--effort low|medium|high|xhigh] \\
    [--timeout-ms 900000] \\
    [--circuit-mode default|lite|deep|autonomous] \\
    [--out-dir evals/fix-vs-vanilla/results] \\
    [--skip-build] \\
    [--dry-run]

Runs isolated bug-fix tasks through Circuit Fix and a strong vanilla Claude Code
prompt. Primary scoring is false-fixed rate: claimed fixed while objective
checks still fail.
`;
}

function parseArgs(argv) {
  const manifest = readJson(MANIFEST_PATH);
  const args = {
    set: 'held-out',
    taskId: undefined,
    provider: manifest.default_provider,
    model: manifest.default_model,
    effort: manifest.default_effort,
    timeoutMs: manifest.default_timeout_ms,
    circuitMode: 'default',
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
    if (arg === '--set') {
      args.set = requireValue(argv, i, arg);
      i += 1;
    } else if (arg === '--task-id') {
      args.taskId = requireValue(argv, i, arg);
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
    } else if (arg === '--circuit-mode') {
      args.circuitMode = requireValue(argv, i, arg);
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

  if (!['discovery', 'regression', 'held-out', 'all'].includes(args.set)) {
    throw new Error("--set must be one of discovery, regression, held-out, or all");
  }
  if (args.provider !== 'claude-code') {
    throw new Error('this bug-fix pilot currently supports --provider claude-code only');
  }
  if (!['low', 'medium', 'high', 'xhigh'].includes(args.effort)) {
    throw new Error('--effort must be one of low, medium, high, or xhigh');
  }
  if (!['default', 'lite', 'deep', 'autonomous'].includes(args.circuitMode)) {
    throw new Error('--circuit-mode must be one of default, lite, deep, or autonomous');
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }

  return { args, manifest };
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function safeSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'run';
}

function isoForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function runSync(command, argv, options = {}) {
  const result = spawnSync(command, argv, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    env: options.env ?? process.env,
    timeout: options.timeoutMs,
  });
  return {
    command,
    argv,
    cwd: options.cwd ?? REPO_ROOT,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message,
  };
}

function commandOutput(command, argv, fallback = 'unavailable') {
  const result = runSync(command, argv);
  if (result.status !== 0) return fallback;
  return result.stdout.trim() || fallback;
}

function findExecutable(name, { required = true } = {}) {
  const result = runSync('zsh', ['-lc', `command -v ${shellQuote(name)}`]);
  if (result.status !== 0) {
    if (required) throw new Error(`could not find ${name} on PATH`);
    return name;
  }
  return result.stdout.trim();
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function promptCommand(argv) {
  return argv.map((arg) => (/^[A-Za-z0-9_./:@=+-]+$/.test(arg) ? arg : shellQuote(arg))).join(' ');
}

function createClaudeCodeWrapper(realClaude, model, effort) {
  const binDir = mkdtempSync(resolve(tmpdir(), 'fix-vs-vanilla-claude-'));
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
  INJECTED+=(--model "$FIX_VS_VANILLA_MODEL")
fi
if [[ "$INJECT_EFFORT" -eq 1 ]]; then
  INJECTED+=(--effort "$FIX_VS_VANILLA_EFFORT")
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
      FIX_VS_VANILLA_MODEL: model,
      FIX_VS_VANILLA_EFFORT: effort,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
    },
  };
}

function selectedTaskIds(manifest, args) {
  const allIds = [
    ...manifest.sets.discovery,
    ...manifest.sets.regression,
    ...manifest.sets['held-out'],
  ];
  if (args.taskId !== undefined) {
    if (!allIds.includes(args.taskId)) throw new Error(`unknown task id: ${args.taskId}`);
    return [args.taskId];
  }
  if (args.set === 'all') return allIds;
  return manifest.sets[args.set];
}

function loadTask(taskId) {
  const taskRoot = resolve(__dirname, 'tasks', taskId);
  const taskPath = resolve(taskRoot, 'task.json');
  if (!existsSync(taskPath)) throw new Error(`task file not found: ${taskPath}`);
  const task = readJson(taskPath);
  return {
    ...task,
    task_root: taskRoot,
    repo_template: resolve(taskRoot, 'repo'),
  };
}

function initFixtureRepo(repoDir) {
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Fix Benchmark',
    GIT_AUTHOR_EMAIL: 'fix-benchmark@example.invalid',
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
    GIT_COMMITTER_NAME: 'Fix Benchmark',
    GIT_COMMITTER_EMAIL: 'fix-benchmark@example.invalid',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
  };
  const steps = [
    ['git', ['init', '--quiet']],
    ['git', ['config', 'commit.gpgsign', 'false']],
    ['git', ['config', 'user.name', 'Fix Benchmark']],
    ['git', ['config', 'user.email', 'fix-benchmark@example.invalid']],
    ['git', ['add', '-A']],
    ['git', ['commit', '-m', 'initial fixture', '--quiet']],
  ];
  for (const [command, argv] of steps) {
    const result = runSync(command, argv, { cwd: repoDir, env: gitEnv });
    if (result.status !== 0) {
      throw new Error(`fixture git setup failed: ${command} ${argv.join(' ')}\n${result.stderr}`);
    }
  }
  const head = runSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir });
  if (head.status !== 0) return 'unavailable';
  return head.stdout.trim() || 'unavailable';
}

function copyFixtureRepo(task, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(task.repo_template, dest, { recursive: true });
  return initFixtureRepo(dest);
}

function taskGoal(task) {
  const checks = task.checks.map((check) => `- ${promptCommand(check.argv)}`).join('\n');
  return `${task.prompt}

Acceptance:
- First confirm the regression by running the listed command before the fix.
- Make only the focused fix needed for this task.
- Rerun the same command after the fix.
- Leave the repo with the objective checks passing.

Objective check commands:
${checks}

Allowed changed files:
${task.allowed_changed_files.map((file) => `- ${file}`).join('\n')}`;
}

function vanillaPrompt(task) {
  return `You are the vanilla coding-agent arm in a fair Circuit Fix benchmark.

Use the same repo and tools as the Circuit arm, but do not invoke Circuit, /circuit commands, bin/circuit-next, or any Circuit runtime.

Strong process:
1. Inspect the relevant files before editing.
2. Run the regression command before the fix and confirm it fails for the reported bug.
3. Make the smallest focused code change you can.
4. Rerun the same regression command after the fix.
5. Do not claim the bug is fixed unless the regression failed before the fix, passes after the fix, and the objective checks pass.
6. Keep changed files inside the allowed list unless the task truly requires otherwise. If you go outside the list, say so.

${taskGoal(task)}

End your final answer with a fenced JSON object using this exact shape:

\`\`\`json
{
  "claimed_fixed": true,
  "changed_files": ["src/example.mjs"],
  "commands_run": [
    {"command": "npm test", "status": "failed-before"},
    {"command": "npm test", "status": "passed-after"}
  ],
  "regression_proof": {
    "command": "npm test",
    "failed_before": true,
    "passed_after": true
  },
  "residual_risks": []
}
\`\`\``;
}

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

async function runCommand({ label, command, argv, cwd, env, timeoutMs, outputDir }) {
  mkdirSync(outputDir, { recursive: true });
  const startedAt = new Date();
  const start = performance.now();
  let stdout = '';
  let stderr = '';
  let timedOut = false;

  const result = await new Promise((resolvePromise) => {
    const child = spawn(command, argv, {
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
      process.stdout.write(`[${label}] ${chunk}`);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(`[${label}] ${chunk}`);
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
  const wallclockMs = performance.now() - start;
  writeFileSync(resolve(outputDir, 'stdout.txt'), stdout);
  writeFileSync(resolve(outputDir, 'stderr.txt'), stderr);
  const metadata = {
    label,
    command,
    argv: redactedArgv(argv),
    cwd,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    wallclock_ms: wallclockMs,
    exit_code: result.exitCode,
    signal: result.signal,
    timed_out: timedOut,
    error: result.error,
  };
  writeJson(resolve(outputDir, 'run-metadata.json'), metadata);
  return { ...metadata, stdout, stderr };
}

function redactedArgv(argv) {
  return argv.map((arg) => (String(arg).length > 500 ? '<prompt omitted; see prompt.md>' : arg));
}

function runChecks(repoDir, checks, outputDir, phase) {
  mkdirSync(outputDir, { recursive: true });
  return checks.map((check) => {
    const result = runSync(check.argv[0], check.argv.slice(1), {
      cwd: repoDir,
      timeoutMs: 120_000,
    });
    const base = resolve(outputDir, `${phase}-${safeSegment(check.id)}`);
    writeFileSync(`${base}.stdout.txt`, result.stdout);
    writeFileSync(`${base}.stderr.txt`, result.stderr);
    return {
      id: check.id,
      argv: check.argv,
      exit_code: result.status,
      signal: result.signal,
      passed: result.status === 0,
      stdout_path: `${base}.stdout.txt`,
      stderr_path: `${base}.stderr.txt`,
      error: result.error,
    };
  });
}

function diffState(repoDir, outputDir) {
  const nameOnly = runSync('git', ['diff', '--name-only'], { cwd: repoDir });
  const diff = runSync('git', ['diff', '--'], { cwd: repoDir });
  const status = runSync('git', ['status', '--short'], { cwd: repoDir });
  writeFileSync(resolve(outputDir, 'diff.txt'), diff.stdout);
  writeFileSync(resolve(outputDir, 'git-status.txt'), status.stdout);
  const changedFiles = nameOnly.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return {
    changed_files: changedFiles,
    git_status_short: status.stdout,
    diff_path: resolve(outputDir, 'diff.txt'),
    status_path: resolve(outputDir, 'git-status.txt'),
  };
}

function parseCircuitClaim(runFolder) {
  const resultPath = resolve(runFolder, 'reports', 'fix-result.json');
  if (!existsSync(resultPath)) {
    return {
      claimed_fixed: false,
      parse_status: 'missing-fix-result',
      result_path: resultPath,
      proof_quality: 0,
    };
  }
  const result = readJson(resultPath);
  return {
    claimed_fixed: result.outcome === 'fixed',
    parse_status: 'parsed',
    result_path: resultPath,
    fix_outcome: result.outcome,
    verification_status: result.verification_status,
    regression_status: result.regression_status,
    regression_rerun_status: result.regression_rerun_status,
    change_set_status: result.change_set_status,
    review_status: result.review_status,
    review_verdict: result.review_verdict,
    review_skip_reason: result.review_skip_reason,
    proof_quality: circuitProofQuality(result),
  };
}

function circuitProofQuality(result) {
  if (
    result.regression_status === 'proved' &&
    result.regression_rerun_status === 'cleared' &&
    result.verification_status === 'passed' &&
    result.change_set_status === 'pass'
  ) {
    return 3;
  }
  if (result.regression_status === 'proved' && result.regression_rerun_status === 'cleared') {
    return 2;
  }
  if (result.verification_status === 'passed') return 1;
  return 0;
}

function parseVanillaClaim(stdout) {
  const parsed = parseLastJsonObject(stdout);
  if (parsed === undefined) {
    return {
      claimed_fixed: /fixed|done|resolved/i.test(stdout),
      parse_status: 'heuristic',
      proof_quality: 0,
    };
  }
  const proof = parsed.regression_proof ?? {};
  const commands = Array.isArray(parsed.commands_run) ? parsed.commands_run : [];
  return {
    claimed_fixed: parsed.claimed_fixed === true,
    parse_status: 'parsed',
    parsed,
    proof_quality: vanillaProofQuality(proof, commands),
  };
}

function parseLastJsonObject(text) {
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  for (const match of fenced.reverse()) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // Try another candidate.
    }
  }

  const starts = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '{') starts.push(index);
  }
  for (const start of starts.reverse()) {
    try {
      return JSON.parse(text.slice(start));
    } catch {
      // Try an earlier object start.
    }
  }
  return undefined;
}

function vanillaProofQuality(proof, commands) {
  const failedBefore = proof.failed_before === true;
  const passedAfter = proof.passed_after === true;
  const hasCommands = commands.length >= 2;
  const hasUnableStatus = commands.some((command) =>
    /unable|could not|permission|error/i.test(String(command.status ?? command.command ?? '')),
  );
  const hasSpeculativeStatus = commands.some((command) =>
    /would|should|expected|manual|not[- ]?run/i.test(String(command.status ?? '')),
  );
  const hasExplicitFailedBefore = commands.some((command) =>
    /failed-before|fail(ed)? before/i.test(String(command.status ?? '')),
  );
  const hasExplicitPassedAfter = commands.some((command) =>
    /passed-after|pass(ed)? after/i.test(String(command.status ?? '')),
  );
  if (hasUnableStatus) return passedAfter || failedBefore ? 1 : 0;
  if (
    failedBefore &&
    passedAfter &&
    hasCommands &&
    hasExplicitFailedBefore &&
    hasExplicitPassedAfter &&
    !hasSpeculativeStatus
  ) {
    return 3;
  }
  if (failedBefore && passedAfter) return 2;
  if (passedAfter || hasCommands) return 1;
  return 0;
}

function scoreArm({ task, armId, run, checks, diff, claim }) {
  const objectiveFixed = checks.length > 0 && checks.every((check) => check.passed);
  const allowed = new Set(task.allowed_changed_files);
  const outsideAllowed = diff.changed_files.filter((file) => !allowed.has(file));
  return {
    task_id: task.id,
    split: task.split,
    arm_id: armId,
    exit_code: run.exit_code,
    timed_out: run.timed_out,
    wallclock_ms: run.wallclock_ms,
    objective_fixed: objectiveFixed,
    verification_passed: objectiveFixed,
    claimed_fixed: claim.claimed_fixed,
    false_fixed: claim.claimed_fixed && !objectiveFixed,
    proof_quality: claim.proof_quality,
    changed_files: diff.changed_files,
    changed_file_count: diff.changed_files.length,
    outside_allowed_changed_files: outsideAllowed,
    claim,
    checks,
    diff_path: diff.diff_path,
    stdout_path: resolve(dirname(diff.diff_path), 'stdout.txt'),
    stderr_path: resolve(dirname(diff.diff_path), 'stderr.txt'),
  };
}

async function runTask({ task, args, wrapper, resultRoot }) {
  const taskDir = resolve(resultRoot, 'tasks', task.id);
  const circuitDir = resolve(taskDir, 'circuit-claude-code');
  const vanillaDir = resolve(taskDir, 'vanilla-claude-code');
  const circuitRepo = resolve(circuitDir, 'repo');
  const vanillaRepo = resolve(vanillaDir, 'repo');
  const circuitRunFolder = resolve(circuitDir, 'circuit-run');
  const circuitFlowRoot = resolve(circuitDir, 'generated-flows');
  mkdirSync(taskDir, { recursive: true });
  writeJson(resolve(taskDir, 'task.json'), task);
  writeFileSync(resolve(taskDir, 'goal.md'), `${taskGoal(task)}\n`);
  writeFileSync(resolve(taskDir, 'vanilla-prompt.md'), `${vanillaPrompt(task)}\n`);

  const circuitCommit = copyFixtureRepo(task, circuitRepo);
  const vanillaCommit = copyFixtureRepo(task, vanillaRepo);
  cpSync(resolve(REPO_ROOT, 'generated', 'flows'), circuitFlowRoot, { recursive: true });
  const baselineCircuit = runChecks(circuitRepo, task.checks, circuitDir, 'baseline');
  const baselineVanilla = runChecks(vanillaRepo, task.checks, vanillaDir, 'baseline');

  const circuitArgs = [
    resolve(REPO_ROOT, 'bin/circuit-next'),
    'run',
    'fix',
    '--goal',
    taskGoal(task),
    '--mode',
    args.circuitMode,
    '--run-folder',
    circuitRunFolder,
    '--flow-root',
    circuitFlowRoot,
    '--progress',
    'jsonl',
  ];
  const vanillaArgs = vanillaClaudeArgs(vanillaPrompt(task));

  const circuitRun = await runCommand({
    label: `${task.id}:circuit`,
    command: 'node',
    argv: circuitArgs,
    cwd: circuitRepo,
    env: {
      ...wrapper.env,
      CIRCUIT_GENERATED_FLOW_MIRROR_ROOT: circuitFlowRoot,
    },
    timeoutMs: args.timeoutMs,
    outputDir: circuitDir,
  });
  const circuitPostChecks = runChecks(circuitRepo, task.checks, circuitDir, 'post');
  const circuitDiff = diffState(circuitRepo, circuitDir);
  const circuitScore = scoreArm({
    task,
    armId: 'circuit-claude-code',
    run: circuitRun,
    checks: circuitPostChecks,
    diff: circuitDiff,
    claim: parseCircuitClaim(circuitRunFolder),
  });

  const vanillaRun = await runCommand({
    label: `${task.id}:vanilla`,
    command: 'claude',
    argv: vanillaArgs,
    cwd: vanillaRepo,
    env: wrapper.env,
    timeoutMs: args.timeoutMs,
    outputDir: vanillaDir,
  });
  const vanillaPostChecks = runChecks(vanillaRepo, task.checks, vanillaDir, 'post');
  const vanillaDiff = diffState(vanillaRepo, vanillaDir);
  const vanillaScore = scoreArm({
    task,
    armId: 'vanilla-claude-code',
    run: vanillaRun,
    checks: vanillaPostChecks,
    diff: vanillaDiff,
    claim: parseVanillaClaim(vanillaRun.stdout),
  });

  const taskSummary = {
    task_id: task.id,
    split: task.split,
    fixture_commits_match: circuitCommit === vanillaCommit,
    fixture_commit: circuitCommit,
    baseline_failed_as_expected:
      baselineCircuit.some((check) => !check.passed) && baselineVanilla.some((check) => !check.passed),
    baseline: {
      'circuit-claude-code': baselineCircuit,
      'vanilla-claude-code': baselineVanilla,
    },
    arms: {
      'circuit-claude-code': circuitScore,
      'vanilla-claude-code': vanillaScore,
    },
  };
  writeJson(resolve(taskDir, 'summary.json'), taskSummary);
  return taskSummary;
}

function aggregate(taskSummaries, splitFilter) {
  const arms = ['circuit-claude-code', 'vanilla-claude-code'];
  const filtered = splitFilter === undefined
    ? taskSummaries
    : taskSummaries.filter((task) => task.split === splitFilter);
  const out = {};
  for (const arm of arms) {
    const scores = filtered.map((task) => task.arms[arm]);
    const count = scores.length;
    out[arm] = {
      task_count: count,
      false_fixed_count: scores.filter((score) => score.false_fixed).length,
      false_fixed_rate: rate(scores.filter((score) => score.false_fixed).length, count),
      objective_fixed_count: scores.filter((score) => score.objective_fixed).length,
      objective_fixed_rate: rate(scores.filter((score) => score.objective_fixed).length, count),
      verification_pass_count: scores.filter((score) => score.verification_passed).length,
      verification_pass_rate: rate(scores.filter((score) => score.verification_passed).length, count),
      mean_proof_quality: mean(scores.map((score) => score.proof_quality)),
      completed_review_count: scores.filter((score) => score.claim.review_status === 'completed').length,
      skipped_review_count: scores.filter((score) => score.claim.review_status === 'skipped').length,
      mean_changed_file_count: mean(scores.map((score) => score.changed_file_count)),
      outside_allowed_change_count: scores.reduce(
        (sum, score) => sum + score.outside_allowed_changed_files.length,
        0,
      ),
      mean_wallclock_ms: mean(scores.map((score) => score.wallclock_ms)),
    };
  }
  return out;
}

function rate(numerator, denominator) {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function mean(values) {
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function decideClaim(heldOutAggregate) {
  const circuit = heldOutAggregate['circuit-claude-code'];
  const vanilla = heldOutAggregate['vanilla-claude-code'];
  if (circuit.task_count === 0 || vanilla.task_count === 0) {
    return { supported: false, reason: 'no held-out tasks were scored' };
  }
  if (circuit.false_fixed_rate < vanilla.false_fixed_rate) {
    if (circuit.objective_fixed_rate >= vanilla.objective_fixed_rate) {
      return {
        supported: true,
        reason: 'Circuit had a lower held-out false-fixed rate and matched or beat vanilla objective fixed rate.',
      };
    }
    return {
      supported: false,
      reason: 'Circuit had fewer false-fixed outcomes but a lower objective fixed rate.',
    };
  }
  return {
    supported: false,
    reason: 'Circuit did not have a lower held-out false-fixed rate.',
  };
}

function renderReport(summary) {
  const heldOut = summary.aggregates['held-out'];
  const circuit = heldOut['circuit-claude-code'];
  const vanilla = heldOut['vanilla-claude-code'];
  return `# Fix-vs-Vanilla Report

Run: ${summary.result_root}

Provider: ${summary.provider}
Model: ${summary.model}
Effort: ${summary.effort}
Repo commit: ${summary.repo_commit}

## Claim

${summary.claim.supported ? 'Supported' : 'Not supported'}: ${summary.claim.reason}

Circuit only gets a product claim from held-out tasks. Discovery and regression
tasks are not counted as measurement wins.

## Held-Out Metrics

| Arm | False-fixed | Fixed | Proof quality | Verification | Changed files | Wallclock |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Circuit Fix | ${formatRate(circuit.false_fixed_rate)} | ${formatRate(circuit.objective_fixed_rate)} | ${formatNumber(circuit.mean_proof_quality)} | ${formatRate(circuit.verification_pass_rate)} | ${formatNumber(circuit.mean_changed_file_count)} | ${formatMs(circuit.mean_wallclock_ms)} |
| Vanilla strong prompt | ${formatRate(vanilla.false_fixed_rate)} | ${formatRate(vanilla.objective_fixed_rate)} | ${formatNumber(vanilla.mean_proof_quality)} | ${formatRate(vanilla.verification_pass_rate)} | ${formatNumber(vanilla.mean_changed_file_count)} | ${formatMs(vanilla.mean_wallclock_ms)} |

## Tasks

${summary.tasks
  .map(
    (task) =>
      `- ${task.task_id} (${task.split}): Circuit ${formatTaskScore(task.arms['circuit-claude-code'])}; vanilla ${formatTaskScore(task.arms['vanilla-claude-code'])}`,
  )
  .join('\n')}
`;
}

function formatTaskScore(score) {
  const review = score.claim.review_status === undefined
    ? ''
    : `, review=${score.claim.review_status}${
        score.claim.review_verdict === undefined ? '' : `:${score.claim.review_verdict}`
      }`;
  return `false-fixed=${score.false_fixed}, fixed=${score.objective_fixed}, proof=${score.proof_quality}${review}`;
}

function formatRate(value) {
  if (value === null) return 'n/a';
  return `${(value * 100).toFixed(0)}%`;
}

function formatNumber(value) {
  if (value === null) return 'n/a';
  return value.toFixed(2);
}

function formatMs(value) {
  if (value === null) return 'n/a';
  return `${Math.round(value)} ms`;
}

async function main() {
  const { args, manifest } = parseArgs(process.argv.slice(2));
  const taskIds = selectedTaskIds(manifest, args);
  const tasks = taskIds.map(loadTask);
  const runLabel = args.taskId === undefined ? args.set : args.taskId;
  const resultRoot = resolve(args.outDir, `${isoForPath()}-${safeSegment(runLabel)}`);
  mkdirSync(resultRoot, { recursive: true });

  const realClaude = findExecutable('claude', { required: !args.dryRun });
  const wrapper = createClaudeCodeWrapper(realClaude, args.model, args.effort);
  const metadata = {
    schema_version: 1,
    benchmark_id: manifest.benchmark_id,
    result_root: resultRoot,
    repo_root: REPO_ROOT,
    repo_commit: commandOutput('git', ['rev-parse', 'HEAD']),
    git_status_short: commandOutput('git', ['status', '--short'], ''),
    provider: args.provider,
    model: args.model,
    effort: args.effort,
    timeout_ms: args.timeoutMs,
    circuit_mode: args.circuitMode,
    set: args.set,
    task_ids: taskIds,
    dry_run: args.dryRun,
    commands: {
      circuit: ['node', '<repo>/bin/circuit-next', 'run', 'fix', '--mode', args.circuitMode],
      vanilla: ['claude', ...vanillaClaudeArgs('<strong vanilla prompt>')],
    },
  };
  writeJson(resolve(resultRoot, 'metadata.json'), metadata);

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
    process.stdout.write(`Dry run only. Results directory prepared at ${resultRoot}\n`);
    return;
  }

  if (!args.skipBuild) {
    process.stderr.write('Building compiled Circuit CLI before comparison...\n');
    const build = runSync('npm', ['run', 'build'], { cwd: REPO_ROOT });
    writeFileSync(resolve(resultRoot, 'build.stdout.txt'), build.stdout);
    writeFileSync(resolve(resultRoot, 'build.stderr.txt'), build.stderr);
    if (build.status !== 0) {
      throw new Error(`npm run build failed; see ${resolve(resultRoot, 'build.stderr.txt')}`);
    }
    const bundle = runSync('npm', ['run', 'build-plugin-runtime'], { cwd: REPO_ROOT });
    writeFileSync(resolve(resultRoot, 'build-plugin-runtime.stdout.txt'), bundle.stdout);
    writeFileSync(resolve(resultRoot, 'build-plugin-runtime.stderr.txt'), bundle.stderr);
    if (bundle.status !== 0) {
      throw new Error(
        `npm run build-plugin-runtime failed; see ${resolve(
          resultRoot,
          'build-plugin-runtime.stderr.txt',
        )}`,
      );
    }
  }

  const taskSummaries = [];
  for (const task of tasks) {
    process.stderr.write(`\nRunning task ${task.id} (${task.split})...\n`);
    taskSummaries.push(await runTask({ task, args, wrapper, resultRoot }));
  }

  const aggregates = {
    all: aggregate(taskSummaries),
    discovery: aggregate(taskSummaries, 'discovery'),
    regression: aggregate(taskSummaries, 'regression'),
    'held-out': aggregate(taskSummaries, 'held-out'),
  };
  const summary = {
    ...metadata,
    dry_run: false,
    tasks: taskSummaries,
    aggregates,
    claim: decideClaim(aggregates['held-out']),
  };
  writeJson(resolve(resultRoot, 'summary.json'), summary);
  writeFileSync(resolve(resultRoot, 'report.md'), renderReport(summary));
  process.stdout.write(`\nComparison complete.\nResults: ${resultRoot}\n`);
  process.stdout.write(`Report: ${resolve(resultRoot, 'report.md')}\n`);
}

main().catch((error) => {
  process.stderr.write(`fix-vs-vanilla comparison failed: ${error.message}\n`);
  process.exit(1);
});
