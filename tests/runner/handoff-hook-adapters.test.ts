import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const tempRoots: string[] = [];

function tempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeStubLauncher(root: string): string {
  const stub = join(root, 'stub-launcher.ts');
  writeFileSync(
    stub,
    [
      "import { writeFileSync } from 'node:fs';",
      'writeFileSync(process.env.CAPTURE_PATH, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));',
      "const status = process.env.STUB_STATUS ?? 'available';",
      "if (status === 'available') {",
      "  process.stdout.write(JSON.stringify({ status: 'available', additional_context: 'UNIQUE-HANDOFF-TOKEN' }));",
      '  process.exit(0);',
      '}',
      "if (status === 'invalid') {",
      "  process.stdout.write(JSON.stringify({ status: 'invalid', error: { code: 'record_invalid' } }));",
      '  process.exit(0);',
      '}',
      "if (status === 'empty') {",
      "  process.stdout.write(JSON.stringify({ status: 'empty' }));",
      '  process.exit(0);',
      '}',
      "process.stderr.write('stub failure');",
      'process.exit(1);',
    ].join('\n'),
  );
  return stub;
}

function writeSleepingStubLauncher(root: string): string {
  const stub = join(root, 'sleeping-stub-launcher.ts');
  writeFileSync(stub, 'setTimeout(() => {}, 10_000);\n');
  return stub;
}

function runHook(
  input: unknown,
  options: {
    readonly hookPath: string;
    readonly launcher: string;
    readonly capturePath: string;
    readonly cwd: string;
    readonly status?: string;
    readonly debug?: boolean;
    readonly timeoutMs?: number;
  },
) {
  return spawnSync(process.execPath, [options.hookPath], {
    cwd: options.cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: {
      ...process.env,
      CIRCUIT_HANDOFF_HOOK_LAUNCHER: options.launcher,
      CAPTURE_PATH: options.capturePath,
      ...(options.status === undefined ? {} : { STUB_STATUS: options.status }),
      ...(options.debug === true ? { CIRCUIT_HANDOFF_HOOK_DEBUG: '1' } : {}),
      ...(options.timeoutMs === undefined
        ? {}
        : { CIRCUIT_HANDOFF_HOOK_TIMEOUT_MS: String(options.timeoutMs) }),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

describe('handoff SessionStart hook adapters', () => {
  it.each([
    ['claude', resolve('plugins/claude/hooks/session-start.ts')],
    ['codex', resolve('plugins/codex/hooks/session-start.ts')],
  ] as const)(
    '%s adapter injects the shared handoff context from hook cwd input',
    (_name, hookPath) => {
      const root = tempRoot('circuit-handoff-hook-');
      const projectRoot = join(root, 'project');
      const wrongCwd = join(root, 'wrong-cwd');
      const capturePath = join(root, 'capture.json');
      const launcher = writeStubLauncher(root);
      mkdirSync(projectRoot, { recursive: true });
      mkdirSync(wrongCwd, { recursive: true });

      const result = runHook(
        {
          hook_event_name: 'SessionStart',
          source: 'startup',
          cwd: projectRoot,
        },
        { hookPath, launcher, capturePath, cwd: wrongCwd },
      );

      expect(result.status, result.stderr).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toEqual({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: 'UNIQUE-HANDOFF-TOKEN',
        },
      });
      const capture = JSON.parse(readFileSync(capturePath, 'utf8')) as {
        argv: string[];
        cwd: string;
      };
      expect(capture.argv).toEqual(['handoff', 'brief', '--json', '--project-root', projectRoot]);
      expect(realpathSync(capture.cwd)).toBe(realpathSync(projectRoot));
    },
  );

  it.each([
    ['claude', resolve('plugins/claude/hooks/session-start.ts')],
    ['codex', resolve('plugins/codex/hooks/session-start.ts')],
  ] as const)('%s adapter fails soft when the brief is empty or invalid', (_name, hookPath) => {
    const root = tempRoot('circuit-handoff-hook-soft-');
    const projectRoot = join(root, 'project');
    const capturePath = join(root, 'capture.json');
    const launcher = writeStubLauncher(root);
    mkdirSync(projectRoot, { recursive: true });

    const empty = runHook(
      { hook_event_name: 'SessionStart', source: 'startup', cwd: projectRoot },
      { hookPath, launcher, capturePath, cwd: root, status: 'empty' },
    );
    expect(empty.status, empty.stderr).toBe(0);
    expect(empty.stdout).toBe('');

    const invalid = runHook(
      { hook_event_name: 'SessionStart', source: 'startup', cwd: projectRoot },
      { hookPath, launcher, capturePath, cwd: root, status: 'invalid', debug: true },
    );
    expect(invalid.status).toBe(0);
    expect(invalid.stdout).toBe('');
    expect(invalid.stderr).toContain('Circuit handoff hook: brief state is invalid');
  });

  it.each([
    ['claude', resolve('plugins/claude/hooks/session-start.ts')],
    ['codex', resolve('plugins/codex/hooks/session-start.ts')],
  ] as const)(
    '%s adapter does not fall back to process cwd when hook cwd is missing',
    (_name, hookPath) => {
      const root = tempRoot('circuit-handoff-hook-no-cwd-');
      const capturePath = join(root, 'capture.json');
      const launcher = writeStubLauncher(root);

      const result = runHook(
        { hook_event_name: 'SessionStart', source: 'startup' },
        { hookPath, launcher, capturePath, cwd: root, debug: true },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('hook input did not include cwd');
    },
  );

  it.each([
    ['claude', resolve('plugins/claude/hooks/session-start.ts')],
    ['codex', resolve('plugins/codex/hooks/session-start.ts')],
  ] as const)('%s adapter fails soft when the brief command hangs', (_name, hookPath) => {
    const root = tempRoot('circuit-handoff-hook-timeout-');
    const projectRoot = join(root, 'project');
    const capturePath = join(root, 'capture.json');
    const launcher = writeSleepingStubLauncher(root);
    mkdirSync(projectRoot, { recursive: true });

    const result = runHook(
      { hook_event_name: 'SessionStart', source: 'startup', cwd: projectRoot },
      { hookPath, launcher, capturePath, cwd: root, debug: true, timeoutMs: 25 },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Circuit handoff hook: brief command failed');
  });
});
