import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import { readRunTrace } from '../../src/runtime/trace-reader.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
import { RunResult } from '../../src/schemas/result.js';
import { RunProjection } from '../../src/schemas/run.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');

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
    failure_mode: 'pass-route cycles could parse or bypass schema and keep a run in progress',
    acceptance_evidence:
      'pass-route cycle guard aborts with run.closed outcome=aborted, state.json status=aborted, result.json outcome=aborted, and no repeated step entry',
    alternate_framing:
      'schema-only rejection — rejected because runtime callers can still receive already-parsed or mutated flow objects',
  };
}

function unusedRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (_input: ClaudeCodeRelayInput): Promise<RelayResult> => ({
      request_payload: 'unused',
      receipt_id: 'unused',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-unused',
    }),
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-pass-cycle-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('WF-I11 runtime-safety-floor pass-route cycle guard', () => {
  it('aborts cleanly instead of re-entering an already executed step when schema validation is bypassed', async () => {
    const { flow } = loadFixture();
    const unsafeCompiledFlow = structuredClone(flow);
    const firstStep = unsafeCompiledFlow.steps[0];
    if (firstStep === undefined) throw new Error('fixture must have a first step');
    firstStep.routes.pass = firstStep.id;
    const unsafeCompiledFlowBytes = Buffer.from(JSON.stringify(unsafeCompiledFlow));

    const runFolder = join(runFolderBase, 'schema-bypass-cycle');
    const outcome = await runCompiledFlow({
      runFolder,
      flow: unsafeCompiledFlow,
      flowBytes: unsafeCompiledFlowBytes,
      runId: RunId.parse('72000000-0000-0000-0000-000000000001'),
      goal: 'runtime must abort a pass-route cycle',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 19, 0, 0)),
      relayer: unusedRelayer(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain('pass-route cycle detected');
    expect(outcome.result.reason).toContain(firstStep.id);

    const stepKinds = outcome.trace_entries
      .filter((trace_entry) => 'step_id' in trace_entry && trace_entry.step_id === firstStep.id)
      .map((trace_entry) => trace_entry.kind);
    expect(stepKinds).toEqual([
      'step.entered',
      'step.report_written',
      'check.evaluated',
      'step.aborted',
    ]);
    expect(
      outcome.trace_entries.find(
        (trace_entry) =>
          trace_entry.kind === 'step.completed' && trace_entry.step_id === firstStep.id,
      ),
    ).toBeUndefined();
    expect(
      outcome.trace_entries.find((trace_entry) => trace_entry.kind === 'relay.started'),
    ).toBeUndefined();

    const aborted = outcome.trace_entries.find(
      (trace_entry) => trace_entry.kind === 'step.aborted' && trace_entry.step_id === firstStep.id,
    );
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted');

    const closed = outcome.trace_entries[outcome.trace_entries.length - 1];
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed last');
    expect(closed.outcome).toBe('aborted');
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);

    expect(existsSync(join(runFolder, 'trace.ndjson'))).toBe(true);
    expect(existsSync(join(runFolder, 'state.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(true);

    const snapshot = Snapshot.parse(
      JSON.parse(readFileSync(join(runFolder, 'state.json'), 'utf8')),
    );
    expect(snapshot.status).toBe('aborted');
    const projectedStep = snapshot.steps.find((step) => step.step_id === firstStep.id);
    expect(projectedStep?.status).toBe('aborted');
    expect(projectedStep?.last_route_taken).toBeUndefined();
    const log = readRunTrace(runFolder);
    expect(log).toHaveLength(outcome.trace_entries.length);
    expect(RunProjection.safeParse({ log, snapshot }).success).toBe(true);

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toBe(outcome.result.reason);
    expect(result.trace_entries_observed).toBe(log.length);
  });
});
