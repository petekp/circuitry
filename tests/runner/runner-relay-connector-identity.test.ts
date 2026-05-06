import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { CompiledFlowId, RunId } from '../../src/schemas/ids.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

// Connector-identity plumbing through `runCompiledFlow`. `RelayFn` is a
// structured descriptor
// `{ connectorName: EnabledConnector; relay: (input) => Promise<RelayResult> }`
// and the materializer call site is parameterized on
// `relayer.connectorName`. This test injects a codex-shaped descriptor
// (no real codex subprocess; stub `relay` function returning a
// deterministic `RelayResult`) and asserts the trace_entry-log records
// `connector.name='codex'` — proving the descriptor-to-trace_entry plumbing
// carries connector identity end-to-end through `runCompiledFlow`.
//
// The companion second-connector round-trip at
// `tests/runner/codex-relay-roundtrip.test.ts` exercises the real
// `relayCodex → materializeRelay` path directly (CODEX_SMOKE=1).
// This test exercises the `runCompiledFlow` seam on top of that — the
// regression the round-trip alone cannot catch, since the round-trip
// calls `materializeRelay` directly and bypasses `runCompiledFlow`.

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

function codexShapedStub(): RelayFn {
  return {
    connectorName: 'codex',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-codex-thread-id',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-codex-stub',
    }),
  };
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'runner materializer call site hardcodes connectorName="claude-code"',
    acceptance_evidence:
      'relay.started trace_entry carries connector.name="codex" when a codex-shaped descriptor is injected',
    alternate_framing:
      'let P2.7 carry a break-glass change_kind instead — rejected because the refactor is pure type-signature work and unblocks multi-connector routing without an escrow',
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-connector-identity-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('RelayFn descriptor carries connector identity into relay.started', () => {
  it('injecting a codex-shaped descriptor through CompiledFlowInvocation.relayer lands connector.name="codex"', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'codex-identity');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('45a45a45-a45a-45a4-5a45-a45a45a45a45'),
      goal: 'connector-identity regression',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: codexShapedStub(),
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.result.flow_id).toBe(CompiledFlowId.parse('runtime-proof'));

    const relayStarted = outcome.trace_entries.find((e) => e.kind === 'relay.started');
    if (!relayStarted || relayStarted.kind !== 'relay.started') {
      throw new Error('expected relay.started trace_entry');
    }
    // The critical regression: identity comes from the descriptor, not
    // a call-site literal. A regression here would land `name: 'claude-code'`
    // and fail this test.
    expect(relayStarted.connector).toEqual({ kind: 'builtin', name: 'codex' });
  });
});
