import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

// Relay verdict truth.
//
// The runner parses the connector's `result_body` against the minimal
// `{ verdict: string }` shape and admits only verdicts that appear in
// `step.check.pass`. Unparseable output, output without a string
// `verdict` field, and verdicts not in the pass set all fail the check:
// a `check.evaluated` with `outcome: 'fail'` and a human-readable
// `reason` is emitted, followed by `step.aborted` with the same reason,
// then `run.closed` with `outcome: 'aborted'`.
//
// Tests below exercise the four cases through `runCompiledFlow` end-to-end
// against the runtime-proof fixture (`check.pass = ["ok"]`) so the
// integration against the runCompiledFlow loop's flow control is part of
// the assertion surface, not just the in-isolation verdict parser.

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

function relayerWith(resultBody: string): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-check-eval',
      result_body: resultBody,
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'relay verdict was returned as step.check.pass[0] unconditionally; check.evaluated outcome was hardcoded to pass; relay steps advanced by construction regardless of model output',
    acceptance_evidence:
      'check evaluation parses connector result_body for a string verdict field and admits only verdicts in step.check.pass; reject / unparseable / no-verdict cases fail the check, abort the step, and close the run with outcome=aborted',
    alternate_framing:
      'add a check.schema field to ResultVerdictCheck so connector output can be parsed against a typed schema instead of the minimal {verdict: string} shape — rejected because it expands contract surface beyond what is needed; deferred until a verdict-with-payload pattern emerges in the wild',
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-check-eval-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('relay verdict truth', () => {
  it('PASS: connector result_body parses with verdict in step.check.pass → check.evaluated outcome=pass; relay step advances; run closes complete', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'pass-case');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000001'),
      goal: 'pass-case: verdict matches check.pass',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      relayer: relayerWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('complete');

    const resultVerdictCheck = outcome.trace_entries.filter(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    expect(resultVerdictCheck).toHaveLength(1);
    const ge = resultVerdictCheck[0];
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated trace_entry');
    expect(ge.outcome).toBe('pass');
    expect(ge.reason).toBeUndefined();

    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed')
      throw new Error('expected relay.completed trace_entry');
    expect(relayCompleted.verdict).toBe('ok');

    expect(outcome.trace_entries.find((e) => e.kind === 'step.aborted')).toBeUndefined();
    const relayStepCompleted = outcome.trace_entries.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'relay-step',
    );
    expect(relayStepCompleted).toBeDefined();
  });

  it('REJECT (verdict not in step.check.pass): connector declares "reject" but check.pass=["ok"] → check.evaluated outcome=fail with reason naming the verdict; step.aborted; step does NOT advance; run.closed outcome=aborted', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'reject-case');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000002'),
      goal: 'reject-case: verdict not in check.pass',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      relayer: relayerWith('{"verdict":"reject"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toBeDefined();
    expect(outcome.result.reason).toMatch(/reject/);

    const resultVerdictCheck = outcome.trace_entries.filter(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    expect(resultVerdictCheck).toHaveLength(1);
    const ge = resultVerdictCheck[0];
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated trace_entry');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toBeDefined();
    expect(ge.reason).toMatch(/reject/);

    const aborted = outcome.trace_entries.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted trace_entry');
    expect(aborted.step_id).toBe('relay-step');
    expect(aborted.reason).toMatch(/reject/);

    const relayStepCompleted = outcome.trace_entries.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'relay-step',
    );
    expect(relayStepCompleted).toBeUndefined();

    const closed = outcome.trace_entries.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed trace_entry');
    expect(closed.outcome).toBe('aborted');
    expect(closed.reason).toBeDefined();

    // The reason is byte-identical across the three trace_entries that carry
    // it AND on the user-visible result.json. A future regression that
    // diverged the strings would silently degrade audit traceability.
    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);

    // The relay.completed trace_entry carries the OBSERVED verdict
    // ("reject"), not the runtime sentinel — the connector said
    // something parseable, so the durable transcript reflects it.
    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed')
      throw new Error('expected relay.completed trace_entry');
    expect(relayCompleted.verdict).toBe('reject');

    // result.json on disk binds to the aborted run-closed trace_entry per RESULT-I2.
    const resultBody = readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8');
    const resultParsed: { outcome: string; reason?: string } = JSON.parse(resultBody);
    expect(resultParsed.outcome).toBe('aborted');
    expect(resultParsed.reason).toBe(aborted.reason);
  });

  it('UNPARSEABLE: connector result_body is not valid JSON → check.evaluated outcome=fail with reason naming parse failure; relay.completed.verdict carries the runtime sentinel (no observed verdict); step.aborted; step does NOT advance; run.closed outcome=aborted; result.json carries the same reason', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'unparseable-case');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000003'),
      goal: 'unparseable-case: connector output is not JSON',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      relayer: relayerWith('not-json{'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const ge = outcome.trace_entries.find(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated trace_entry');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toMatch(/parse/i);

    const aborted = outcome.trace_entries.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted trace_entry');
    expect(aborted.step_id).toBe('relay-step');

    const relayStepCompleted = outcome.trace_entries.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'relay-step',
    );
    expect(relayStepCompleted).toBeUndefined();

    const closed = outcome.trace_entries.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed trace_entry');
    expect(closed.outcome).toBe('aborted');

    // No observed verdict, so relay.completed.verdict carries the
    // runtime '<no-verdict>' sentinel — disclosed in the explore
    // contract as runtime-injected, not connector-declared.
    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed')
      throw new Error('expected relay.completed trace_entry');
    expect(relayCompleted.verdict).toBe('<no-verdict>');

    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);
  });

  it('VERDICT PARSED FROM BODY (not check.pass[0]): when check.pass has multiple entries and connector declares a non-first member, relay.completed.verdict carries the parsed value; pre-refactor regression where relayVerdictForStep returned pass[0] would set relay.completed.verdict to the FIRST entry instead of the parsed one', async () => {
    // Mutate the runtime-proof fixture in-test to give the relay step a
    // multi-entry check.pass so we can distinguish "parsed from body" from
    // "returned as pass[0]".
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    const relayStep = raw.steps.find((s: { id: string }) => s.id === 'relay-step') as {
      check: { pass: string[] };
    };
    relayStep.check.pass = ['ok', 'ok-with-caveats'];
    const mutatedBytes = Buffer.from(JSON.stringify(raw));
    const flow = CompiledFlow.parse(raw);

    const runFolder = join(runFolderBase, 'parsed-not-first');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: mutatedBytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000005'),
      goal: 'parsed-from-body: verdict is the second entry in check.pass',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      relayer: relayerWith('{"verdict":"ok-with-caveats"}'),
    });

    expect(outcome.result.outcome).toBe('complete');

    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed')
      throw new Error('expected relay.completed trace_entry');
    // Earlier regression: relayVerdictForStep returned
    // step.check.pass[0] → relay.completed.verdict would be "ok"
    // here. Now the verdict comes from the parsed body and is
    // "ok-with-caveats".
    expect(relayCompleted.verdict).toBe('ok-with-caveats');

    const ge = outcome.trace_entries.find(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated trace_entry');
    expect(ge.outcome).toBe('pass');
  });

  it('NO VERDICT FIELD: connector result_body parses but lacks a string verdict field → check.evaluated outcome=fail with reason naming the missing field; step.aborted; step does NOT advance; run.closed outcome=aborted', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'no-verdict-case');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000004'),
      goal: 'no-verdict-case: connector output has no verdict field',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      relayer: relayerWith('{"foo":"bar"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const ge = outcome.trace_entries.find(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated trace_entry');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toMatch(/verdict/);

    const aborted = outcome.trace_entries.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted trace_entry');
    expect(aborted.step_id).toBe('relay-step');

    const relayStepCompleted = outcome.trace_entries.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'relay-step',
    );
    expect(relayStepCompleted).toBeUndefined();

    const closed = outcome.trace_entries.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed trace_entry');
    expect(closed.outcome).toBe('aborted');

    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed')
      throw new Error('expected relay.completed trace_entry');
    expect(relayCompleted.verdict).toBe('<no-verdict>');

    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);
  });
});

// Exhaustive edge-case coverage on the check evaluator. The
// implementation requires a top-level `verdict` field that is a
// non-empty string. These cases lock down the exact boundary so a
// future "be lenient" refactor can't silently widen admission. Each
// case asserts run.outcome=aborted (the check failure path); the
// per-case reason regex names the surface the case exercises.
describe('relay verdict truth: edge-case parser coverage', () => {
  const cases: ReadonlyArray<{
    label: string;
    body: string;
    reasonPattern: RegExp;
  }> = [
    { label: 'empty-verdict-string', body: '{"verdict":""}', reasonPattern: /empty string/ },
    {
      label: 'whitespace-only-verdict',
      body: '{"verdict":" "}',
      reasonPattern: /not in check.pass/,
    },
    { label: 'numeric-verdict', body: '{"verdict":123}', reasonPattern: /verdict/ },
    { label: 'boolean-verdict', body: '{"verdict":true}', reasonPattern: /verdict/ },
    { label: 'null-verdict', body: '{"verdict":null}', reasonPattern: /verdict/ },
    { label: 'object-verdict', body: '{"verdict":{"nested":"ok"}}', reasonPattern: /verdict/ },
    {
      label: 'nested-payload-no-toplevel-verdict',
      body: '{"payload":{"verdict":"ok"}}',
      reasonPattern: /verdict/,
    },
    { label: 'parsed-as-array', body: '[{"verdict":"ok"}]', reasonPattern: /not a JSON object/ },
    { label: 'parsed-as-null', body: 'null', reasonPattern: /not a JSON object/ },
    { label: 'parsed-as-string', body: '"ok"', reasonPattern: /not a JSON object/ },
    { label: 'parsed-as-number', body: '42', reasonPattern: /not a JSON object/ },
    {
      label: 'case-mismatch (check.pass=["ok"], connector says "OK")',
      body: '{"verdict":"OK"}',
      reasonPattern: /not in check.pass/,
    },
  ];

  for (const c of cases) {
    it(`rejects: ${c.label}`, async () => {
      const { flow, bytes } = loadFixture();
      const runFolder = join(runFolderBase, `edge-${c.label.replace(/\W+/g, '-')}`);
      const outcome = await runCompiledFlow({
        runFolder,
        flow,
        flowBytes: bytes,
        runId: RunId.parse('53000000-0000-0000-0000-00000000ed01'),
        goal: `edge case: ${c.label}`,
        depth: 'standard',
        change_kind: change_kind(),
        now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
        relayer: relayerWith(c.body),
      });
      expect(outcome.result.outcome).toBe('aborted');
      const ge = outcome.trace_entries.find(
        (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
      );
      if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated trace_entry');
      expect(ge.outcome).toBe('fail');
      expect(ge.reason).toMatch(c.reasonPattern);
    });
  }
});

// When a relay step declares `writes.report` and the check FAILS,
// the canonical report at `writes.report.path` must NOT be written.
// Transcript slots (request / receipt / result) are still durable
// evidence of what was attempted and ARE written. This locks down the
// verdict-admissibility half of materialization; the materializer
// schema-parse test covers the symmetric schema-parse condition.
describe('check fail does not materialize the canonical report', () => {
  it('explore-shaped fixture (writes.report declared) on check fail: transcript files exist, report file does NOT', async () => {
    // Mutate the runtime-proof fixture to declare writes.report on the
    // relay step (runtime-proof vanilla has no report slot).
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    const relayStep = raw.steps.find((s: { id: string }) => s.id === 'relay-step') as {
      writes: { request: string; receipt: string; result: string; report?: unknown };
    };
    relayStep.writes.report = {
      path: 'reports/relay-canonical.json',
      schema: 'runtime-proof-canonical@v1',
    };
    const mutatedBytes = Buffer.from(JSON.stringify(raw));
    const flow = CompiledFlow.parse(raw);

    const runFolder = join(runFolderBase, 'report-not-written-on-fail');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: mutatedBytes,
      runId: RunId.parse('53000000-0000-0000-0000-00000000a200'),
      goal: 'slice 53 HIGH 2: check fail must not materialize canonical report',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      relayer: relayerWith('{"verdict":"reject"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    // Transcript files DO exist (durable evidence of the relay).
    expect(existsSync(join(runFolder, 'reports', 'relay.request.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'relay.receipt.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'relay.result.json'))).toBe(true);

    // Canonical report file does NOT exist (check failed → not materialized).
    expect(existsSync(join(runFolder, 'reports', 'relay-canonical.json'))).toBe(false);
  });

  it('explore-shaped fixture on check PASS: report IS materialized (sanity counterpart)', async () => {
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    const relayStep = raw.steps.find((s: { id: string }) => s.id === 'relay-step') as {
      writes: { request: string; receipt: string; result: string; report?: unknown };
    };
    relayStep.writes.report = {
      path: 'reports/relay-canonical.json',
      schema: 'runtime-proof-canonical@v1',
    };
    const mutatedBytes = Buffer.from(JSON.stringify(raw));
    const flow = CompiledFlow.parse(raw);

    const runFolder = join(runFolderBase, 'report-written-on-pass');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: mutatedBytes,
      runId: RunId.parse('53000000-0000-0000-0000-00000000a201'),
      goal: 'slice 53 HIGH 2 sanity: check pass materializes canonical report',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      relayer: relayerWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(existsSync(join(runFolder, 'reports', 'relay-canonical.json'))).toBe(true);
  });
});
