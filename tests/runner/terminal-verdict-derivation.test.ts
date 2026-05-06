import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';

import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

// Adversarial-review fix #2: deriveTerminalVerdict had no direct
// end-to-end coverage. Every existing sub-run / migrate
// test stubs the childRunner and hand-writes the child's result.json,
// so the runner's own walk-backward over trace_entries never executes in
// those tests. These tests exercise real derivation through
// runCompiledFlow:
//
//   1) single-relay happy path — the only verdict-bearing step's
//      verdict surfaces as result.verdict.
//   2) multi-relay sequence — when a flow admits two distinct
//      verdicts before close, walk-backward picks the LATER one
//      (the verdict on the route-segment closest to @complete).
//   3) aborted run — result.verdict is undefined regardless of any
//      mid-route admitted verdict.
//   4) compose-only run — no relay / sub-run admission means no
//      terminal verdict; result.verdict is undefined.

const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');

function loadDogfood(): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { flow: CompiledFlow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function fixedRelayer(verdict: string): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-verdict-derivation',
      result_body: JSON.stringify({ verdict }),
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function sequenceRelayer(verdicts: string[]): RelayFn {
  let call = 0;
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => {
      const verdict = verdicts[call++];
      if (verdict === undefined) {
        throw new Error(
          `sequenceRelayer exhausted at call ${call}; provided ${verdicts.length} verdicts`,
        );
      }
      return {
        request_payload: input.prompt,
        receipt_id: `stub-receipt-verdict-${call}`,
        result_body: JSON.stringify({ verdict }),
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'pre-fix, deriveTerminalVerdict had no end-to-end coverage and could regress silently',
    acceptance_evidence:
      'walk-backward picks the latest admitted verdict on the route to @complete',
    alternate_framing: 'lean only on stubbed sub-run tests — rejected; they bypass derivation',
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-verdict-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('deriveTerminalVerdict — fix #2 coverage', () => {
  it('single-relay run surfaces the verdict on result.json', async () => {
    const { flow, bytes } = loadDogfood();
    const runFolder = join(runFolderBase, 'run-single');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('aaaaaaaa-1111-1111-1111-111111111111'),
      goal: 'single-relay verdict derivation',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 0, 0)),
      relayer: fixedRelayer('ok'),
    });

    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('expected closed run, got checkpoint_waiting');
    }
    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.result.verdict).toBe('ok');
  });

  it('multi-relay run surfaces the LATER admitted verdict (walk-backward)', async () => {
    // Two relay steps in sequence, each admitting a distinct
    // verdict. Walk-backward must return the second relay's
    // verdict — the one on the segment that reached @complete.
    const flow = CompiledFlow.parse({
      schema_version: '2',
      id: 'multi-relay-fixture',
      version: '0.1.0',
      purpose: 'Test fixture for multi-relay terminal verdict derivation.',
      entry: { signals: { include: ['multi'], exclude: [] }, intent_prefixes: ['multi'] },
      entry_modes: [
        {
          name: 'multi',
          start_at: 'first-relay',
          depth: 'standard',
          description: 'two-relay route',
        },
      ],
      stages: [
        {
          id: 'act-stage',
          title: 'Act',
          canonical: 'act',
          steps: ['first-relay', 'second-relay'],
        },
      ],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'plan', 'analyze', 'verify', 'review', 'close'],
        rationale: 'narrow test fixture for verdict derivation',
      },
      steps: [
        {
          id: 'first-relay',
          title: 'First relay — admits "intermediate"',
          protocol: 'multi-relay@v1',
          reads: [],
          routes: { pass: 'second-relay' },
          executor: 'worker',
          kind: 'relay',
          role: 'implementer',
          writes: {
            request: 'reports/first.request.json',
            receipt: 'reports/first.receipt.json',
            result: 'reports/first.result.json',
          },
          check: {
            kind: 'result_verdict',
            source: { kind: 'relay_result', ref: 'result' },
            pass: ['intermediate'],
          },
        },
        {
          id: 'second-relay',
          title: 'Second relay — admits "final"',
          protocol: 'multi-relay@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'worker',
          kind: 'relay',
          role: 'implementer',
          writes: {
            request: 'reports/second.request.json',
            receipt: 'reports/second.receipt.json',
            result: 'reports/second.result.json',
          },
          check: {
            kind: 'result_verdict',
            source: { kind: 'relay_result', ref: 'result' },
            pass: ['final'],
          },
        },
      ],
    });
    const bytes = Buffer.from(JSON.stringify(flow));
    const runFolder = join(runFolderBase, 'run-multi');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('bbbbbbbb-2222-2222-2222-222222222222'),
      goal: 'multi-relay terminal verdict derivation',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 13, 0, 0)),
      relayer: sequenceRelayer(['intermediate', 'final']),
    });

    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('expected closed run, got checkpoint_waiting');
    }
    expect(outcome.result.outcome).toBe('complete');
    // The chronologically-LATER admitted verdict wins. Pre-fix,
    // walk-backward already implemented this — these tests pin it
    // against regression to a "first verdict found" or
    // "closing-step's verdict" semantic.
    expect(outcome.result.verdict).toBe('final');
  });

  it('aborted run has no terminal verdict regardless of mid-route admissions', async () => {
    // runtime-proof check.pass = ['ok']; force a verdict the check rejects.
    // The earlier compose step admitted via check_kind=schema_sections
    // (not result_verdict) so it doesn't contribute either way.
    const { flow, bytes } = loadDogfood();
    const runFolder = join(runFolderBase, 'run-aborted');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('cccccccc-3333-3333-3333-333333333333'),
      goal: 'aborted run has no terminal verdict',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 14, 0, 0)),
      relayer: fixedRelayer('not-in-check'),
    });

    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('expected closed run, got checkpoint_waiting');
    }
    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.verdict).toBeUndefined();
  });

  it('compose-only run has no terminal verdict (no result_verdict admission)', async () => {
    // No relay / sub-run step exists, so no check.evaluated trace_entry
    // ever fires with kind='result_verdict'. The walk finds nothing
    // and returns undefined.
    const flow = CompiledFlow.parse({
      schema_version: '2',
      id: 'compose-only-fixture',
      version: '0.1.0',
      purpose: 'Test fixture: a flow with no verdict-bearing steps.',
      entry: { signals: { include: ['syn'], exclude: [] }, intent_prefixes: ['syn'] },
      entry_modes: [
        {
          name: 'syn',
          start_at: 'only-compose',
          depth: 'standard',
          description: 'one compose step',
        },
      ],
      stages: [{ id: 'plan-stage', title: 'Plan', canonical: 'plan', steps: ['only-compose'] }],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
        rationale: 'narrow test fixture for verdict-undefined case',
      },
      steps: [
        {
          id: 'only-compose',
          title: 'Compose — no verdict surface',
          protocol: 'compose-only@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'orchestrator',
          kind: 'compose',
          writes: {
            report: { path: 'reports/only.json', schema: 'plan.strategy@v1' },
          },
          check: {
            kind: 'schema_sections',
            source: { kind: 'report', ref: 'report' },
            required: ['summary'],
          },
        },
      ],
    });
    const bytes = Buffer.from(JSON.stringify(flow));
    const runFolder = join(runFolderBase, 'run-synth-only');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('dddddddd-4444-4444-4444-444444444444'),
      goal: 'compose-only run has no verdict',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 15, 0, 0)),
      relayer: fixedRelayer('unused'),
    });

    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('expected closed run, got checkpoint_waiting');
    }
    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.result.verdict).toBeUndefined();
  });
});
