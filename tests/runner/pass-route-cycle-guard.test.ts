import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ExecutableFlow } from '../../src/runtime/manifest/executable-flow.js';
import { executeExecutableFlow } from '../../src/runtime/run/graph-runner.js';
import { TraceStore } from '../../src/runtime/trace/trace-store.js';
import { RunResult } from '../../src/schemas/result.js';

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function flowWithPassCycle(): ExecutableFlow {
  return {
    id: 'runtime-proof-pass-cycle',
    version: '0.1.0',
    entry: 'compose-step',
    stages: [{ id: 'main', stepIds: ['compose-step'] }],
    steps: [
      {
        id: 'compose-step',
        kind: 'compose',
        writer: 'cycle-writer',
        writes: { report: { path: 'reports/compose.json' } },
        routes: { pass: { kind: 'step', stepId: 'compose-step' } },
      },
    ],
    purpose: 'Exercise the runtime guard for corrupted pass-route cycles.',
  };
}

function flowWithRecoveryCorridor(): ExecutableFlow {
  return {
    id: 'runtime-proof-recovery-corridor',
    version: '0.1.0',
    entry: 'act-step',
    stages: [{ id: 'main', stepIds: ['act-step', 'verify-step', 'change-set-step'] }],
    steps: [
      {
        id: 'act-step',
        kind: 'compose',
        writer: 'act-writer',
        routes: { pass: { kind: 'step', stepId: 'verify-step' } },
      },
      {
        id: 'verify-step',
        kind: 'compose',
        writer: 'verify-writer',
        routes: { pass: { kind: 'step', stepId: 'change-set-step' } },
      },
      {
        id: 'change-set-step',
        kind: 'compose',
        writer: 'change-set-writer',
        routes: {
          pass: { kind: 'terminal', target: '@complete' },
          retry: { kind: 'step', stepId: 'act-step' },
        },
      },
    ],
    purpose: 'Exercise recovery through completed forward-path steps.',
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-pass-cycle-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('WF-I11 runtime-safety-floor pass-route cycle guard', () => {
  it('aborts cleanly instead of re-entering an already executed step when graph validation is bypassed', async () => {
    const flow = flowWithPassCycle();
    const firstStep = flow.steps[0];
    if (firstStep === undefined) throw new Error('fixture must have a first step');

    const runFolder = join(runFolderBase, 'graph-bypass-cycle');
    const outcome = await executeExecutableFlow(flow, {
      runDir: runFolder,
      runId: '72000000-0000-0000-0000-000000000001',
      goal: 'runtime must abort a pass-route cycle',
      depth: 'standard',
      now: deterministicNow(Date.UTC(2026, 3, 24, 19, 0, 0)),
    });
    const trace_entries = await new TraceStore(runFolder).load();

    expect(outcome.outcome).toBe('aborted');
    expect(outcome.reason).toContain('route cycle detected');
    expect(outcome.reason).toContain(firstStep.id);

    const stepKinds = trace_entries
      .filter((trace_entry) => trace_entry.step_id === firstStep.id)
      .map((trace_entry) => trace_entry.kind);
    expect(stepKinds).toEqual(['step.entered', 'step.aborted']);
    expect(
      trace_entries.find(
        (trace_entry) =>
          trace_entry.kind === 'step.completed' && trace_entry.step_id === firstStep.id,
      ),
    ).toBeUndefined();
    expect(
      trace_entries.find((trace_entry) => trace_entry.kind === 'relay.started'),
    ).toBeUndefined();

    const aborted = trace_entries.find(
      (trace_entry) => trace_entry.kind === 'step.aborted' && trace_entry.step_id === firstStep.id,
    );
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted');

    const closed = trace_entries[trace_entries.length - 1];
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed last');
    expect(closed.outcome).toBe('aborted');
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.reason).toBe(aborted.reason);

    expect(existsSync(join(runFolder, 'trace.ndjson'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(true);

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toBe(outcome.reason);
    expect(result.trace_entries_observed).toBe(trace_entries.length);
  });

  it('allows recovery to pass through a completed forward-path step before rerunning the failed proof step', async () => {
    const runFolder = join(runFolderBase, 'recovery-corridor');
    const outcome = await executeExecutableFlow(flowWithRecoveryCorridor(), {
      runDir: runFolder,
      runId: '72000000-0000-0000-0000-000000000002',
      goal: 'runtime must rerun proof corridor after repair',
      depth: 'standard',
      now: deterministicNow(Date.UTC(2026, 3, 24, 19, 5, 0)),
      executors: {
        compose: async (step, context) => {
          if (step.id === 'change-set-step' && context.activeStepAttempt === 1) {
            return { route: 'retry', details: { reason: 'change-set mismatch' } };
          }
          return { route: 'pass' };
        },
      },
    });
    const trace_entries = await new TraceStore(runFolder).load();

    expect(outcome.outcome).toBe('complete');
    const completions = trace_entries.filter((entry) => entry.kind === 'step.completed');
    expect(completions.map((entry) => [entry.step_id, entry.attempt, entry.route_taken])).toEqual([
      ['act-step', 1, 'pass'],
      ['verify-step', 1, 'pass'],
      ['change-set-step', 1, 'retry'],
      ['act-step', 2, 'pass'],
      ['verify-step', 2, 'pass'],
      ['change-set-step', 2, 'pass'],
    ]);
  });
});
