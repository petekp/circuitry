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
    failure_mode: 'connector invocation failures escaped after step.entered and stranded runs',
    acceptance_evidence:
      'throwing relayers emit relay.failed, check.evaluated outcome=fail, step.aborted, run.closed outcome=aborted, state.json status=aborted, and result.json outcome=aborted',
    alternate_framing:
      'represent connector exceptions only as check.evaluated failure — rejected because infrastructure failure should remain distinct from model verdict failure',
  };
}

function throwingRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (_input: ClaudeCodeRelayInput) => {
      throw new Error('auth token missing');
    },
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-relay-failure-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('runtime-safety-floor connector invocation failure closure', () => {
  it('closes a throwing relayer as an aborted run with durable invocation provenance', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'throwing-relayer');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('71000000-0000-0000-0000-000000000001'),
      goal: 'connector failure must close durably',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 18, 0, 0)),
      relayer: throwingRelayer(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/connector invocation failed/i);
    expect(outcome.result.reason).toMatch(/auth token missing/);

    const started = outcome.trace_entries.find((e) => e.kind === 'relay.started');
    if (started?.kind !== 'relay.started') throw new Error('expected relay.started');
    expect(started.step_id).toBe('relay-step');
    expect(started.connector).toEqual({ kind: 'builtin', name: 'claude-code' });
    expect(started.role).toBe('implementer');
    expect(started.resolved_from).toEqual({ source: 'explicit' });
    expect(started.resolved_selection).toEqual({ skills: [], invocation_options: {} });

    const relayStepKinds = outcome.trace_entries
      .filter((trace_entry) => 'step_id' in trace_entry && trace_entry.step_id === 'relay-step')
      .map((trace_entry) => trace_entry.kind);
    expect(relayStepKinds).toEqual([
      'step.entered',
      'relay.started',
      'relay.request',
      'relay.failed',
      'check.evaluated',
      'step.aborted',
    ]);

    const request = outcome.trace_entries.find((e) => e.kind === 'relay.request');
    if (request?.kind !== 'relay.request') throw new Error('expected relay.request');
    expect(request.step_id).toBe('relay-step');
    expect(request.request_payload_hash).toMatch(/^[0-9a-f]{64}$/);

    const failed = outcome.trace_entries.find((e) => e.kind === 'relay.failed');
    if (failed?.kind !== 'relay.failed') throw new Error('expected relay.failed');
    expect(failed.step_id).toBe('relay-step');
    expect(failed.connector).toEqual(started.connector);
    expect(failed.role).toBe(started.role);
    expect(failed.resolved_from).toEqual(started.resolved_from);
    expect(failed.resolved_selection).toEqual(started.resolved_selection);
    expect(failed.request_payload_hash).toBe(request.request_payload_hash);

    const check = outcome.trace_entries.find(
      (e) => e.kind === 'check.evaluated' && e.step_id === 'relay-step',
    );
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('fail');

    const aborted = outcome.trace_entries.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted');
    expect(aborted.step_id).toBe('relay-step');

    const closed = outcome.trace_entries.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed');
    expect(closed.outcome).toBe('aborted');

    expect(check.reason).toBe(failed.reason);
    expect(aborted.reason).toBe(failed.reason);
    expect(closed.reason).toBe(failed.reason);
    expect(outcome.result.reason).toBe(failed.reason);

    expect(
      outcome.trace_entries.find((e) => e.kind === 'step.completed' && e.step_id === 'relay-step'),
    ).toBeUndefined();
    expect(outcome.trace_entries.find((e) => e.kind === 'relay.completed')).toBeUndefined();
    expect(outcome.trace_entries.find((e) => e.kind === 'relay.receipt')).toBeUndefined();
    expect(outcome.trace_entries.find((e) => e.kind === 'relay.result')).toBeUndefined();

    expect(existsSync(join(runFolder, 'reports', 'relay.request.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'relay.receipt.json'))).toBe(false);
    expect(existsSync(join(runFolder, 'reports', 'relay.result.json'))).toBe(false);

    const snapshot = Snapshot.parse(
      JSON.parse(readFileSync(join(runFolder, 'state.json'), 'utf8')),
    );
    expect(snapshot.status).toBe('aborted');
    const log = readRunTrace(runFolder);
    expect(RunProjection.safeParse({ log, snapshot }).success).toBe(true);

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toBe(failed.reason);
  });
});
