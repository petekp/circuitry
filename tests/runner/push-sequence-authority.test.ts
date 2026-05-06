import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';

import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import { readRunTrace } from '../../src/runtime/trace-reader.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

// Adversarial-review fix #3 + #12: push() is the single sequence-
// assignment authority. Regardless of any sequence value a caller bakes
// into an trace_entry literal, push() overwrites it with the current
// state.sequence and increments — so on-disk sequences are always
// 0..N-1 contiguous monotonic (RUN-I2). This pins the invariant
// specifically across the relay path, which previously bypassed
// push() by mutating state.trace_entries directly + setting state.sequence
// from the materializer's sequenceAfter. If a future contributor
// reverts to direct state.trace_entries.push (or otherwise emits without
// going through the central push), this test fails.

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

function stubRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-push-authority',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'pre-fix, the relay path bypassed push() and could desync sequence numbers',
    acceptance_evidence: 'on-disk trace_entry sequences are 0..N-1 contiguous monotonic',
    alternate_framing:
      'lean only on RUN-I2 schema parsing — rejected; want a focused regression pin',
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-push-authority-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('push() is the single sequence-assignment authority — fix #3 + #12', () => {
  it('on-disk trace_entries have sequence === array index across compose + relay + close', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'run');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('99999999-aaaa-bbbb-cccc-000000000001'),
      goal: 'pin push() as the single sequence-assignment authority',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 0, 0)),
      relayer: stubRelayer(),
    });

    expect(outcome.result.outcome).toBe('complete');

    // The on-disk log: parse via the schema-aware reader and assert
    // every trace_entry's sequence equals its zero-based index. RUN-I2
    // already enforces 0..N-1 contiguous monotonic at parse time, but
    // pinning the value-equals-index property explicitly catches any
    // regression where push() stops overwriting and a caller's stale
    // sequence sneaks through.
    const log = readRunTrace(runFolder);
    expect(log.length).toBeGreaterThan(0);
    log.forEach((trace_entry, index) => {
      expect(trace_entry.sequence).toBe(index);
    });

    // The runtime-returned trace_entries array must agree with the on-disk
    // log — same sequences, same order. If push() ever returned trace_entries
    // with a different sequence than what landed on disk (impossible
    // under the current fix; possible if direct state.trace_entries.push is
    // ever revived), this assertion catches it.
    expect(outcome.trace_entries).toHaveLength(log.length);
    outcome.trace_entries.forEach((trace_entry, index) => {
      expect(trace_entry.sequence).toBe(index);
      expect(trace_entry.sequence).toBe(log[index]?.sequence);
    });

    // The relay transcript must thread through push() in the
    // correct order: started → request → receipt → result → completed,
    // each strictly increasing in sequence. Pre-fix the materializer's
    // trace_entries bypassed push() via direct state.trace_entries.push and the
    // sequence advance was a manual state.sequence = sequenceAfter
    // assignment — both fragile. This assertion proves the materialized
    // batch flows through push() now.
    const relayTraceEntries = log.filter((e) => e.kind.startsWith('relay.'));
    expect(relayTraceEntries.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < relayTraceEntries.length; i += 1) {
      const prev = relayTraceEntries[i - 1];
      const curr = relayTraceEntries[i];
      if (prev === undefined || curr === undefined) throw new Error('unreachable');
      expect(curr.sequence).toBeGreaterThan(prev.sequence);
    }
  });
});
