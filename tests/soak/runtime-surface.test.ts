import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../../src/cli/circuit.js';
import { ProgressEvent } from '../../src/schemas/progress-event.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn, RelayInput } from '../../src/shared/relay-runtime-types.js';

const REVIEW_RELAY_BODY = JSON.stringify({
  verdict: 'NO_ISSUES_FOUND',
  findings: [],
  assessment: 'Stub reviewer: nothing actionable in the relayed evidence.',
  verification: ['Inspected the relayed intake report.'],
  confidence_limitations: [],
});
const BUILD_RELAY_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Build relay completed for runtime soak',
  changed_files: ['src/example.ts'],
  evidence: ['soak relay'],
});

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function relayerWithBody(body: string): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-runtime-soak',
      result_body: body,
      duration_ms: 1,
      cli_version: 'stub',
    }),
  };
}

function buildRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-runtime-soak-build',
      result_body: input.prompt.includes('Step: review-step')
        ? JSON.stringify({
            verdict: 'accept',
            summary: 'No blocking issue found',
            findings: [],
          })
        : BUILD_RELAY_BODY,
      duration_ms: 1,
      cli_version: 'stub',
    }),
  };
}

async function captureMain(
  argv: readonly string[],
  options: { readonly relayer?: RelayFn; readonly configCwd?: string } = {},
): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> {
  let stdout = '';
  let stderr = '';
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    const code = await main(argv, {
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      now: deterministicNow(Date.UTC(2026, 4, 3, 21, 0, 0)),
      runId: randomUUID(),
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    return { code, stdout, stderr };
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
}

function writeProjectRoot(
  path: string,
  scripts: Record<string, string> = { check: 'node -e "process.exit(0)"' },
): void {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'package.json'), `${JSON.stringify({ scripts }, null, 2)}\n`);
}

function progressEvents(stderr: string): readonly ReturnType<typeof ProgressEvent.parse>[] {
  return stderr
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => ProgressEvent.parse(JSON.parse(line)));
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = join(tmpdir(), `circuit-next-runtime-soak-${randomUUID()}`);
  mkdirSync(runFolderBase, { recursive: true });
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('runtime surface soak', () => {
  it('runs a default Review flow and writes runtime trace/result files', async () => {
    const runFolder = join(runFolderBase, 'review');
    const result = await captureMain(
      ['run', 'review', '--goal', 'review this patch', '--run-folder', runFolder],
      { relayer: relayerWithBody(REVIEW_RELAY_BODY) },
    );

    expect(result.code, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(output).toMatchObject({ flow_id: 'review', outcome: 'complete' });
    expect(output).not.toHaveProperty('runtime');
    expect(JSON.parse(readFileSync(join(runFolder, 'reports/result.json'), 'utf8'))).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
    });
    expect(
      JSON.parse(
        readFileSync(join(runFolder, 'trace.ndjson'), 'utf8').split(/\r?\n/, 1)[0] ?? '{}',
      ),
    ).toMatchObject({ schema_version: 1, kind: 'run.bootstrapped', flow_id: 'review' });
  });

  it('streams progress for a Build checkpoint and resume lifecycle', async () => {
    const projectRoot = join(runFolderBase, 'project');
    writeProjectRoot(projectRoot);
    const runFolder = join(runFolderBase, 'build');
    const paused = await captureMain(
      [
        'run',
        'build',
        '--goal',
        'Add a small feature',
        '--mode',
        'deep',
        '--progress',
        'jsonl',
        '--run-folder',
        runFolder,
      ],
      { configCwd: projectRoot, relayer: buildRelayer() },
    );

    expect(paused.code, paused.stderr).toBe(0);
    expect(JSON.parse(paused.stdout)).toMatchObject({
      flow_id: 'build',
      outcome: 'checkpoint_waiting',
    });
    expect(progressEvents(paused.stderr).map((event) => event.type)).toContain(
      'checkpoint.waiting',
    );

    const resumed = await captureMain(
      [
        'resume',
        '--run-folder',
        runFolder,
        '--checkpoint-choice',
        'continue',
        '--progress',
        'jsonl',
      ],
      { configCwd: projectRoot, relayer: buildRelayer() },
    );

    expect(resumed.code, resumed.stderr).toBe(0);
    expect(JSON.parse(resumed.stdout)).toMatchObject({ flow_id: 'build', outcome: 'complete' });
    expect(progressEvents(resumed.stderr).map((event) => event.type)).toContain('run.completed');
  });

  it('runs Build end-to-end with resolver-selected build and lint scripts', async () => {
    const projectRoot = join(runFolderBase, 'build-lint-project');
    writeProjectRoot(projectRoot, {
      build: 'node -e "process.stdout.write(\\"build-ok\\")"',
      lint: 'node -e "process.stdout.write(\\"lint-ok\\")"',
    });
    const runFolder = join(runFolderBase, 'build-lint');

    const result = await captureMain(
      ['run', 'build', '--goal', 'Build + lint must stay clean', '--run-folder', runFolder],
      { configCwd: projectRoot, relayer: buildRelayer() },
    );

    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ flow_id: 'build', outcome: 'complete' });

    const brief = JSON.parse(readFileSync(join(runFolder, 'reports/build/brief.json'), 'utf8')) as {
      verification_command_candidates: Array<{ argv: string[] }>;
    };
    expect(brief.verification_command_candidates.map((command) => command.argv)).toEqual([
      ['npm', 'run', 'build'],
      ['npm', 'run', 'lint'],
    ]);

    const verification = JSON.parse(
      readFileSync(join(runFolder, 'reports/build/verification.json'), 'utf8'),
    ) as {
      overall_status: string;
      commands: Array<{ argv: string[]; status: string; stdout_summary: string }>;
    };
    expect(verification.overall_status).toBe('passed');
    expect(verification.commands.map((command) => command.argv)).toEqual([
      ['npm', 'run', 'build'],
      ['npm', 'run', 'lint'],
    ]);
    expect(verification.commands.map((command) => command.status)).toEqual(['passed', 'passed']);
    expect(verification.commands.map((command) => command.stdout_summary).join('\n')).toContain(
      'build-ok',
    );
    expect(verification.commands.map((command) => command.stdout_summary).join('\n')).toContain(
      'lint-ok',
    );
  });

  it('runs generated explicit fixtures and rejects untrusted fixture copies', async () => {
    const generatedRunFolder = join(runFolderBase, 'generated-review');
    const generated = await captureMain(
      [
        'run',
        'review',
        '--goal',
        'review this patch',
        '--fixture',
        join(process.cwd(), 'generated/flows/review/circuit.json'),
        '--run-folder',
        generatedRunFolder,
      ],
      { relayer: relayerWithBody(REVIEW_RELAY_BODY) },
    );
    expect(generated.code, generated.stderr).toBe(0);
    expect(JSON.parse(generated.stdout)).toMatchObject({ flow_id: 'review', outcome: 'complete' });

    const fixturePath = join(runFolderBase, 'fixtures/review.json');
    mkdirSync(join(runFolderBase, 'fixtures'), { recursive: true });
    writeFileSync(fixturePath, readFileSync('generated/flows/review/circuit.json'));
    const rejected = await captureMain(
      [
        'run',
        'review',
        '--goal',
        'review this patch',
        '--fixture',
        fixturePath,
        '--run-folder',
        join(runFolderBase, 'rejected-review'),
      ],
      { relayer: relayerWithBody(REVIEW_RELAY_BODY) },
    );
    expect(rejected.code).toBe(2);
    expect(rejected.stderr).toContain('unsupported runtime invocation');
  });
});
