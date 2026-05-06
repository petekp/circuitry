import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
import { RunResult } from '../../src/schemas/result.js';

import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import { readRunTrace } from '../../src/runtime/trace-reader.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

// Adversarial-review fix #4: a handler that throws unexpectedly must not
// leave the run-folder half-bootstrapped (step.entered on disk, no
// step.aborted, no run.closed, no result.json). Pre-fix, an uncaught
// throw out of executeCompiledFlow produced exactly that state — and the
// next run on the same run-folder failed claimFreshRunFolder because the
// directory was non-empty, forcing manual cleanup. The wrapper around
// runStepHandler now emits step.aborted + run.closed + result.json on
// any non-path-escape throw.

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
      receipt_id: 'stub-receipt-handler-throw',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'pre-fix, an uncaught handler throw left the run-folder half-bootstrapped and blocked retries',
    acceptance_evidence:
      'runCompiledFlow resolves with outcome=aborted, step.aborted + run.closed trace_entries, and a parseable result.json',
    alternate_framing:
      'allow handler exceptions to propagate raw — rejected; corrupts the run-folder',
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-handler-throw-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('handler-throw recovery — fix #4', () => {
  it('graceful-aborts when a step has an unsupported kind, writes step.aborted + run.closed + result.json', async () => {
    const { flow, bytes } = loadFixture();

    // Mutate one step's `kind` to a value the relayer's default case
    // rejects ("no handler registered"). The CompiledFlow schema validates
    // kind at parse time, so the cast bypasses author-time validation —
    // which is exactly the failure mode the wrapper guards against
    // (corrupted-runtime / mid-flight unexpected throws).
    const badCompiledFlow = structuredClone(flow);
    const firstStep = badCompiledFlow.steps[0];
    if (firstStep === undefined) throw new Error('fixture drift: runtime-proof has no first step');
    (firstStep as { kind: string }).kind = 'bogus-kind';

    const runFolder = join(runFolderBase, 'run-bogus');
    const outcome = await runCompiledFlow({
      runFolder,
      flow: badCompiledFlow,
      flowBytes: bytes,
      runId: RunId.parse('11111111-2222-3333-4444-555555555555'),
      goal: 'prove handler throws fall through to a graceful aborted run',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 0, 0)),
      relayer: stubRelayer(),
    });

    // Did not throw. Outcome surfaces the abort with a reason naming the
    // unsupported kind so the operator can diagnose without reading the
    // trace.
    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toBeDefined();
    expect(outcome.result.reason).toMatch(/handler threw/);
    expect(outcome.result.reason).toMatch(/bogus-kind/);

    // The run-folder is now in a closed state — trace.ndjson, state.json,
    // manifest.snapshot.json, reports/result.json all exist. A retry
    // uses a fresh run-folder; this one is preserved as audit evidence.
    expect(existsSync(join(runFolder, 'trace.ndjson'))).toBe(true);
    expect(existsSync(join(runFolder, 'state.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'manifest.snapshot.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(true);

    // result.json parses through RunResult and pins the abort.
    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toMatch(/handler threw/);

    // TraceEntry log invariants: step.entered → step.aborted → run.closed.
    // run.closed is single and last (no step.completed for the bad
    // step).
    const log = readRunTrace(runFolder);
    const lastTraceEntry = log[log.length - 1];
    expect(lastTraceEntry?.kind).toBe('run.closed');
    if (lastTraceEntry?.kind !== 'run.closed') throw new Error('expected run.closed last');
    expect(lastTraceEntry.outcome).toBe('aborted');

    const stepAborted = log.find((trace_entry) => trace_entry.kind === 'step.aborted');
    expect(stepAborted).toBeDefined();
    if (stepAborted?.kind !== 'step.aborted') throw new Error('expected step.aborted in log');
    expect(stepAborted.reason).toMatch(/handler threw/);
    expect(stepAborted.reason).toMatch(/bogus-kind/);

    const stepCompletedForBad = log.some(
      (trace_entry) =>
        trace_entry.kind === 'step.completed' &&
        (trace_entry.step_id as unknown as string) === (firstStep.id as unknown as string),
    );
    expect(stepCompletedForBad).toBe(false);
  });

  it("graceful-aborts when a compose writer throws (the compose handler's local try/catch covers this)", async () => {
    // Note: this test proves the compose-HANDLER-LOCAL try/catch
    // around the writer invocation, not the runStepHandler wrapper.
    // The compose handler catches the writer throw itself and
    // returns `{ kind: 'aborted', reason }` — control never reaches
    // the wrap. Pinning the "report writer failed" message here is
    // intentional: it's the local handler's contract.
    //
    // The runStepHandler wrap (commit 20ca1dd) is exercised by the
    // first test in this file (the unsupported-kind case), which
    // throws BEFORE any handler runs. Genuine mid-handler throws
    // that bypass a handler's local catch are hard to construct
    // without further injection seams; the wrap stays as the safety
    // net for those.
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'run-mid-throw');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('11111111-2222-3333-4444-555555555556'),
      goal: 'prove handler throws mid-execution recover gracefully',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 13, 0, 0)),
      relayer: stubRelayer(),
      composeWriter: () => {
        throw new Error('composeWriter exploded after step.entered');
      },
    });

    // Run still produced a parseable result and never propagated the
    // raw throw out of runCompiledFlow. The compose handler has its OWN
    // try/catch around the writer invocation that maps the failure to
    // an "report writer failed" abort, so the wrapper around
    // runStepHandler does not need to catch this one — both layers
    // deliver a clean abort and the test pins the writer-failure shape.
    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toBeDefined();
    expect(outcome.result.reason).toMatch(/report writer failed/);
    expect(outcome.result.reason).toMatch(/composeWriter exploded/);

    // Run-root is in the closed state. This is the load-bearing
    // guarantee from commit 20ca1dd: a mid-handler throw cannot leave
    // the run-folder half-bootstrapped, even when the handler had
    // already started doing work.
    expect(existsSync(join(runFolder, 'trace.ndjson'))).toBe(true);
    expect(existsSync(join(runFolder, 'state.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'manifest.snapshot.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(true);

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toMatch(/report writer failed/);

    // TraceEntry log is well-formed: no half-state, ends in run.closed.
    const log = readRunTrace(runFolder);
    const lastTraceEntry = log[log.length - 1];
    expect(lastTraceEntry?.kind).toBe('run.closed');
    if (lastTraceEntry?.kind !== 'run.closed') throw new Error('expected run.closed last');
    expect(lastTraceEntry.outcome).toBe('aborted');
  });
});
