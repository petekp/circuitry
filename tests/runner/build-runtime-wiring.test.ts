import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import {
  BuildImplementation,
  BuildResult,
  BuildReview,
  BuildVerification,
} from '../../src/flows/build/reports.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

const FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'build', 'circuit.json');
const REPO_ROOT = resolve('.');

function loadFixture(): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { flow: CompiledFlow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'Build had typed reports but no live fixture proving implementation and review relay through the runtime',
    acceptance_evidence:
      'build-runtime-wiring runs the live Build fixture with stubbed worker relay and parses implementation, verification, review, and close reports',
    alternate_framing:
      'add entry-mode routing first — rejected because the relay path is the smaller blocker for a real Build stage path',
  };
}

function relayerWith(
  options: {
    implementationBody?: string;
    reviewBody?: string;
  } = {},
): RelayFn {
  const implementationBody =
    options.implementationBody ??
    JSON.stringify({
      verdict: 'accept',
      summary: 'Implemented the requested change',
      changed_files: ['src/example.ts'],
      evidence: ['Stub implementation relay completed'],
    });
  const reviewBody =
    options.reviewBody ??
    JSON.stringify({
      verdict: 'accept',
      summary: 'No blocking issue found',
      findings: [],
    });

  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => {
      const isAct = input.prompt.includes('Step: act-step');
      const isReview = input.prompt.includes('Step: review-step');
      expect(isAct || isReview).toBe(true);
      expect(input.prompt).toContain('Context (from reads):');
      expect(input.prompt).toContain('Respond with a single raw JSON object');
      return {
        request_payload: input.prompt,
        receipt_id: isAct ? 'stub-build-act' : 'stub-build-review',
        result_body: isAct ? implementationBody : reviewBody,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function traceEntryLabel(trace_entry: { kind: string; step_id?: unknown }): string {
  return typeof trace_entry.step_id === 'string'
    ? `${trace_entry.kind}:${trace_entry.step_id}`
    : trace_entry.kind;
}

function traceEntryByKind<T extends { kind: string }>(
  trace_entries: readonly T[],
  kind: string,
): T | undefined {
  return trace_entries.find((trace_entry) => trace_entry.kind === kind);
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-build-runtime-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('Build runtime wiring', () => {
  it('exposes only checkpoint choices the current runner can honor', () => {
    const { flow } = loadFixture();
    const frame = flow.steps.find((step) => step.id === 'frame-step');
    expect(frame?.kind).toBe('checkpoint');
    if (frame?.kind !== 'checkpoint') throw new Error('frame-step is not a checkpoint');

    expect(frame.policy.choices.map((choice) => choice.id)).toEqual(['continue']);
    expect(frame.check.allow).toEqual(['continue']);
  });

  it('runs the live Build fixture through checkpoint, implementation relay, verification, review relay, and close', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'complete');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000000'),
      goal: 'Add a tiny Build feature',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 0, 0)),
      relayer: relayerWith(),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.trace_entries.map(traceEntryLabel)).toContain('checkpoint.resolved:frame-step');
    expect(outcome.trace_entries.map(traceEntryLabel)).toContain('relay.completed:act-step');
    expect(outcome.trace_entries.map(traceEntryLabel)).toContain('relay.completed:review-step');

    const implementation = BuildImplementation.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/build/implementation.json'), 'utf8')),
    );
    expect(implementation.verdict).toBe('accept');

    const verification = BuildVerification.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/build/verification.json'), 'utf8')),
    );
    expect(verification.overall_status).toBe('passed');
    expect(verification.commands[0]?.argv).toEqual(['npm', 'run', 'check']);

    const review = BuildReview.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/build/review.json'), 'utf8')),
    );
    expect(review.verdict).toBe('accept');

    const result = BuildResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/build-result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('complete');
    expect(result.review_verdict).toBe('accept');
  });

  it('aborts when implementation relay passes the verdict check but fails build.implementation@v1 parsing', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'bad-implementation');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000001'),
      goal: 'Reject malformed implementation report',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 10, 0)),
      relayer: relayerWith({
        implementationBody: JSON.stringify({
          verdict: 'accept',
          summary: 'Missing evidence',
          changed_files: ['src/example.ts'],
        }),
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/build\.implementation@v1/);
    expect(outcome.result.reason).toMatch(/evidence/);
    expect(existsSync(join(runFolder, 'reports/build/implementation.json'))).toBe(false);
    expect(existsSync(join(runFolder, 'reports/relay/build-act.result.json'))).toBe(true);
  });

  it('aborts review rejection before writing the canonical Build review report', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'review-reject');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000002'),
      goal: 'Reject a blocking Build review',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 20, 0)),
      relayer: relayerWith({
        reviewBody: JSON.stringify({
          verdict: 'reject',
          summary: 'Blocking issue found',
          findings: [
            {
              severity: 'high',
              text: 'The implementation does not satisfy the requested goal',
              file_refs: ['src/example.ts:1'],
            },
          ],
        }),
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/connector declared verdict 'reject'/);
    expect(existsSync(join(runFolder, 'reports/build/review.json'))).toBe(false);
    expect(existsSync(join(runFolder, 'reports/relay/build-review.result.json'))).toBe(true);
  });

  it('aborts accept-with-fixes without findings before writing the canonical Build review report', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'review-empty-fixes');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000003'),
      goal: 'Reject a non-actionable Build review',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 30, 0)),
      relayer: relayerWith({
        reviewBody: JSON.stringify({
          verdict: 'accept-with-fixes',
          summary: 'Fixes needed but omitted',
          findings: [],
        }),
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/build\.review@v1/);
    expect(outcome.result.reason).toMatch(/findings/);
    expect(existsSync(join(runFolder, 'reports/build/review.json'))).toBe(false);
    expect(existsSync(join(runFolder, 'reports/relay/build-review.result.json'))).toBe(true);
  });

  it('marks Build as needs_attention when review accepts with required fixes', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'review-followups');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000004'),
      goal: 'Accept Build with follow-up fixes',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 35, 0)),
      relayer: relayerWith({
        reviewBody: JSON.stringify({
          verdict: 'accept-with-fixes',
          summary: 'Usable, but a follow-up is required',
          findings: [
            {
              severity: 'medium',
              text: 'Add coverage for the boundary case before treating this as done',
              file_refs: ['tests/example.test.ts:1'],
            },
          ],
        }),
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('complete');
    const result = BuildResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/build-result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('needs_attention');
    expect(result.review_verdict).toBe('accept-with-fixes');
  });

  it('declares default, lite, deep, and autonomous entry modes, and lite reaches Review by the pass route', () => {
    const { flow } = loadFixture();
    expect(flow.entry_modes.map((mode) => mode.name)).toEqual([
      'default',
      'lite',
      'deep',
      'autonomous',
    ]);
    expect(flow.entry_modes.map((mode) => mode.depth)).toEqual([
      'standard',
      'lite',
      'deep',
      'autonomous',
    ]);

    const lite = flow.entry_modes.find((mode) => mode.name === 'lite');
    if (lite === undefined) throw new Error('expected lite entry mode');
    const stepsById = new Map(flow.steps.map((step) => [step.id as unknown as string, step]));
    const visited: string[] = [];
    let current: string | undefined = lite.start_at as unknown as string;
    while (current !== undefined && !current.startsWith('@')) {
      visited.push(current);
      current = stepsById.get(current)?.routes.pass;
    }
    expect(visited).toEqual([
      'frame-step',
      'plan-step',
      'act-step',
      'verify-step',
      'review-step',
      'close-step',
    ]);
  });

  it('uses the selected lite entry mode as the run depth when no explicit depth is supplied', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'lite-entry-mode');
    const relayInputs: ClaudeCodeRelayInput[] = [];
    const relayer = relayerWith();

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000004'),
      goal: 'Add a tiny Build feature in lite mode',
      entryModeName: 'lite',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 40, 0)),
      relayer: {
        connectorName: relayer.connectorName,
        relay: async (input) => {
          relayInputs.push(input);
          return relayer.relay(input);
        },
      },
      projectRoot: REPO_ROOT,
    });

    const bootstrap = traceEntryByKind(outcome.trace_entries, 'run.bootstrapped');
    const checkpoint = outcome.trace_entries.find(
      (trace_entry) =>
        trace_entry.kind === 'checkpoint.resolved' &&
        traceEntryLabel(trace_entry) === 'checkpoint.resolved:frame-step',
    );
    expect(outcome.result.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ depth: 'lite' });
    expect(checkpoint).toMatchObject({
      selection: 'continue',
      resolution_source: 'safe-default',
    });
    expect(relayInputs[0]?.resolvedSelection).toMatchObject({ depth: 'lite' });
    expect(outcome.trace_entries.map(traceEntryLabel)).toContain('relay.completed:review-step');
  });

  it('uses deep entry mode to pause at the operator checkpoint when no explicit depth is supplied', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'deep-entry-mode');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000005'),
      goal: 'Add a tiny Build feature in deep mode',
      entryModeName: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 50, 0)),
      relayer: relayerWith(),
      projectRoot: REPO_ROOT,
    });

    const bootstrap = traceEntryByKind(outcome.trace_entries, 'run.bootstrapped');
    expect(outcome.result.outcome).toBe('checkpoint_waiting');
    expect(bootstrap).toMatchObject({ depth: 'deep' });
    expect(outcome.trace_entries.map(traceEntryLabel)).not.toContain('run.closed');
    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
  });

  it('lets an explicit depth override the selected entry mode default', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'entry-mode-depth-override');
    const relayInputs: ClaudeCodeRelayInput[] = [];
    const relayer = relayerWith();

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000006'),
      goal: 'Add a tiny Build feature with an explicit standard override',
      entryModeName: 'deep',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 9, 0, 0)),
      relayer: {
        connectorName: relayer.connectorName,
        relay: async (input) => {
          relayInputs.push(input);
          return relayer.relay(input);
        },
      },
      projectRoot: REPO_ROOT,
    });

    const bootstrap = traceEntryByKind(outcome.trace_entries, 'run.bootstrapped');
    expect(outcome.result.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ depth: 'standard' });
    expect(relayInputs[0]?.resolvedSelection).toMatchObject({ depth: 'standard' });
  });

  it('uses explicit autonomous depth over the default entry mode for checkpoint policy', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'default-entry-autonomous-override');
    const relayInputs: ClaudeCodeRelayInput[] = [];
    const relayer = relayerWith();

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000009'),
      goal: 'Add a tiny Build feature with explicit autonomous depth',
      entryModeName: 'default',
      depth: 'autonomous',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 9, 5, 0)),
      relayer: {
        connectorName: relayer.connectorName,
        relay: async (input) => {
          relayInputs.push(input);
          return relayer.relay(input);
        },
      },
      projectRoot: REPO_ROOT,
    });

    const bootstrap = traceEntryByKind(outcome.trace_entries, 'run.bootstrapped');
    const checkpoint = outcome.trace_entries.find(
      (trace_entry) =>
        trace_entry.kind === 'checkpoint.resolved' &&
        traceEntryLabel(trace_entry) === 'checkpoint.resolved:frame-step',
    );
    expect(outcome.result.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ depth: 'autonomous' });
    expect(checkpoint).toMatchObject({
      selection: 'continue',
      resolution_source: 'safe-autonomous',
    });
    expect(relayInputs[0]?.resolvedSelection).toMatchObject({ depth: 'autonomous' });
  });

  it('uses autonomous entry mode to take the declared safe autonomous checkpoint choice', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'autonomous-entry-mode');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000007'),
      goal: 'Add a tiny Build feature in autonomous mode',
      entryModeName: 'autonomous',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 9, 10, 0)),
      relayer: relayerWith(),
      projectRoot: REPO_ROOT,
    });

    const bootstrap = traceEntryByKind(outcome.trace_entries, 'run.bootstrapped');
    const checkpoint = outcome.trace_entries.find(
      (trace_entry) =>
        trace_entry.kind === 'checkpoint.resolved' &&
        traceEntryLabel(trace_entry) === 'checkpoint.resolved:frame-step',
    );
    expect(outcome.result.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ depth: 'autonomous' });
    expect(checkpoint).toMatchObject({
      selection: 'continue',
      resolution_source: 'safe-autonomous',
    });
  });

  it('rejects an unknown entry mode before bootstrapping a run folder', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'unknown-entry-mode');

    await expect(
      runCompiledFlow({
        runFolder,
        flow,
        flowBytes: bytes,
        runId: RunId.parse('b2000000-0000-0000-0000-000000000008'),
        goal: 'Try a missing entry mode',
        entryModeName: 'missing',
        change_kind: change_kind(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 9, 20, 0)),
        relayer: relayerWith(),
        projectRoot: REPO_ROOT,
      }),
    ).rejects.toThrow(/entry_mode named 'missing'/);
    expect(existsSync(runFolder)).toBe(false);
  });
});
