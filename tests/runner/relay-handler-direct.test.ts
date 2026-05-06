// Direct unit tests for the relay step handler.
//
// The runner suites exercise relay transitively through full
// runCompiledFlow runs, but the handler's own surface — check
// evaluation, failure-reason composition, the trace_entry sequence on
// each error path — is not directly covered. This file invokes
// `runRelayStep` against a minimal in-memory `StepHandlerContext` so
// each handler-local branch is exercised in isolation. Sister tests
// cover `checkpoint.ts`, `verification.ts`, `sub-run.ts`, and `fanout.ts`.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import { runRelayStep } from '../../src/runtime/step-handlers/relay.js';
import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { type CompiledFlowId, RunId } from '../../src/schemas/ids.js';
import type { TraceEntry } from '../../src/schemas/trace-entry.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import { expectStepAborted, expectStepAdvance } from '../helpers/failure-message.js';

const WORKFLOW_ID = 'relay-direct-test' as unknown as CompiledFlowId;
const RUN_ID = RunId.parse('44444444-4444-4444-4444-444444444444');

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'relay handler emits the wrong trace_entry sequence on a known failure path',
    acceptance_evidence:
      'each error path emits the expected relay.* + check.evaluated + step.aborted triple with the right reason',
    alternate_framing: 'unit test of the relay step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function buildCompiledFlow(passVerdicts: readonly string[]): CompiledFlow {
  return CompiledFlow.parse({
    schema_version: '2',
    id: WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'relay handler direct-test fixture.',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'relay-step',
        depth: 'standard',
        description: 'relay fixture',
      },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['relay-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow direct relay handler test fixture',
    },
    steps: [
      {
        id: 'relay-step',
        title: 'Relay — direct handler test',
        protocol: 'relay-direct@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'worker',
        kind: 'relay',
        role: 'implementer',
        writes: {
          request: 'reports/relay.request.json',
          receipt: 'reports/relay.receipt.json',
          result: 'reports/relay.result.json',
        },
        check: {
          kind: 'result_verdict',
          source: { kind: 'relay_result', ref: 'result' },
          pass: passVerdicts,
        },
      },
    ],
  });
}

interface RelayerSpec {
  readonly resultBody?: string;
  readonly throwError?: Error;
}

function makeRelayer(spec: RelayerSpec) {
  return {
    connectorName: 'claude-code' as const,
    relay: async (_input: ClaudeCodeRelayInput): Promise<RelayResult> => {
      if (spec.throwError !== undefined) throw spec.throwError;
      return {
        request_payload: 'unused-by-test',
        receipt_id: 'stub-receipt-direct',
        result_body: spec.resultBody ?? '',
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

interface Harness {
  readonly trace_entries: TraceEntry[];
  readonly state: RunState;
  readonly ctx: StepHandlerContext;
}

function buildHarness(opts: { readonly passVerdicts: readonly string[] } & RelayerSpec): {
  flow: CompiledFlow;
  harness: Harness;
} {
  const flow = buildCompiledFlow(opts.passVerdicts);
  const step = flow.steps[0];
  if (step === undefined || step.kind !== 'relay') {
    throw new Error('test fixture invariant: step[0] must be a relay step');
  }
  const trace_entries: TraceEntry[] = [];
  const state: RunState = { trace_entries, sequence: 0, relayResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  const ctx: StepHandlerContext = {
    runFolder,
    flow,
    runId: RUN_ID,
    goal: 'direct relay handler test goal',
    change_kind: change_kind(),
    depth: 'standard',
    executionSelectionConfigLayers: [],
    relayer: makeRelayer(opts),
    composeWriter: () => {
      throw new Error('composeWriter should not be invoked by a relay step');
    },
    now,
    recordedAt,
    state,
    push: (ev: TraceEntry) => {
      const stamped = { ...ev, sequence: state.sequence };
      trace_entries.push(stamped);
      state.sequence += 1;
    },
    step,
    attempt: 1,
    isResumedCheckpoint: false,
    childRunner: async () => {
      throw new Error('childRunner should not be invoked by a relay step');
    },
  };
  return { flow, harness: { trace_entries, state, ctx } };
}

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'relay-handler-direct-'));
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

describe('runRelayStep direct — check evaluation', () => {
  it('returns advance and emits check.evaluated/pass when verdict is in check.pass', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: 'accept' }),
    });

    const result = await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    expectStepAdvance(
      result,
      'relay handler: a verdict in check.pass returns advance and emits check.evaluated/pass',
    );
    const check = harness.trace_entries.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('pass');
    // relay.completed carries the admitted verdict.
    const completed = harness.trace_entries.find((e) => e.kind === 'relay.completed');
    if (completed?.kind !== 'relay.completed') throw new Error('expected relay.completed');
    expect(completed.verdict).toBe('accept');
    // No abort trace_entry.
    expect(harness.trace_entries.find((e) => e.kind === 'step.aborted')).toBeUndefined();
  });

  it('aborts with parse-failure reason when result_body is not valid JSON', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: 'not-json{{{',
    });

    const result = await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    expectStepAborted(
      result,
      'relay handler: a result_body that is not valid JSON aborts with a parse-failure reason',
      { reason: /did not parse as JSON/ },
    );
    const check = harness.trace_entries.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('fail');
    expect(harness.trace_entries.some((e) => e.kind === 'step.aborted')).toBe(true);
    // relay.completed.verdict carries the no-verdict sentinel
    // because no verdict could be parsed.
    const completed = harness.trace_entries.find((e) => e.kind === 'relay.completed');
    if (completed?.kind !== 'relay.completed') throw new Error('expected relay.completed');
    expect(completed.verdict).toBe('<no-verdict>');
  });

  it('aborts with shape-failure reason when result_body parses to an array', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify(['accept']),
    });

    const result = await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/parsed but is not a JSON object/);
    expect(result.reason).toMatch(/got array/);
  });

  it('aborts with shape-failure reason when result_body parses to null', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: 'null',
    });

    const result = await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/parsed but is not a JSON object/);
    expect(result.reason).toMatch(/got null/);
  });

  it('aborts when result_body lacks a verdict field', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ note: 'no verdict here' }),
    });

    const result = await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/lacks a non-empty string 'verdict' field/);
  });

  it('aborts when verdict is the empty string', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: '' }),
    });

    const result = await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/lacks a non-empty string 'verdict' field/);
  });

  it('aborts when verdict is not in check.pass and relay.completed carries the observed verdict', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: 'reject' }),
    });

    const result = await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /declared verdict 'reject' which is not in check\.pass \[accept\]/,
    );
    // relay.completed.verdict carries the observed (rejected) verdict
    // — the durable transcript reflects what the connector said.
    const completed = harness.trace_entries.find((e) => e.kind === 'relay.completed');
    if (completed?.kind !== 'relay.completed') throw new Error('expected relay.completed');
    expect(completed.verdict).toBe('reject');
  });
});

describe('runRelayStep direct — connector failure', () => {
  it('emits relay.failed when the relayer throws and returns aborted', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      throwError: new Error('upstream connector exploded'),
    });

    const result = await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/connector invocation failed.*upstream connector exploded/);
    const failed = harness.trace_entries.find((e) => e.kind === 'relay.failed');
    if (failed?.kind !== 'relay.failed') throw new Error('expected relay.failed');
    expect(failed.reason).toMatch(/upstream connector exploded/);
    // relay.completed should NOT fire on connector throw — only relay.failed.
    expect(harness.trace_entries.find((e) => e.kind === 'relay.completed')).toBeUndefined();
    // check.evaluated/fail + step.aborted both fire.
    const check = harness.trace_entries.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('fail');
    expect(harness.trace_entries.some((e) => e.kind === 'step.aborted')).toBe(true);
  });
});

describe('runRelayStep direct — trace_entry sequence invariants', () => {
  it('on success: started → request → completed → result_admitted? → check.evaluated/pass (no aborted)', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: 'accept' }),
    });

    await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    const kinds = harness.trace_entries.map((e) => e.kind);
    // Anchor: the first three trace_entries MUST be relay.started, relay.request, ...
    expect(kinds[0]).toBe('relay.started');
    expect(kinds[1]).toBe('relay.request');
    // Final trace_entry MUST be check.evaluated (pass) — no step.aborted.
    expect(kinds[kinds.length - 1]).toBe('check.evaluated');
    expect(kinds).not.toContain('step.aborted');
    expect(kinds).toContain('relay.completed');
  });

  it('on connector throw: started → request → failed → check.evaluated/fail → step.aborted (no completed)', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      throwError: new Error('boom'),
    });

    await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    const kinds = harness.trace_entries.map((e) => e.kind);
    expect(kinds).toEqual([
      'relay.started',
      'relay.request',
      'relay.failed',
      'check.evaluated',
      'step.aborted',
    ]);
  });

  it('on check fail: started → request → completed → check.evaluated/fail → step.aborted', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: 'reject' }),
    });

    await runRelayStep(
      harness.ctx as StepHandlerContext & {
        step: CompiledFlow['steps'][number] & { kind: 'relay' };
      },
    );

    const kinds = harness.trace_entries.map((e) => e.kind);
    // First and last anchors.
    expect(kinds[0]).toBe('relay.started');
    expect(kinds[kinds.length - 1]).toBe('step.aborted');
    // relay.completed must fire (the relay happened) — even on check fail.
    expect(kinds).toContain('relay.completed');
  });
});
