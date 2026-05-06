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

// Materializer schema-parse.
//
// The contract requires schema-parsing the result payload against
// `writes.report.schema` BEFORE the canonical report is
// materialized.
//
// Closure shape:
//   - Verdict-admissibility half: check-fail leaves
//     `writes.report.path` absent on disk.
//   - Report-shape half: schema-parse-fail ALSO leaves
//     `writes.report.path` absent.
//   - Failure-path trace_entry surface is uniform across both: parse
//     failure emits `check.evaluated outcome=fail` + reason, then
//     `step.aborted` with the same reason, then `run.closed` with
//     `outcome=aborted`. This content/schema-failure path does not
//     emit `relay.failed`; that trace_entry is reserved for connector
//     invocation exceptions, where no connector result exists.
//   - Fail-closed default: unknown schema names produce a parse
//     failure reason naming the unknown schema; the step is aborted.
//
// The runtime-proof fixture's relay step does NOT declare
// `writes.report` (explore-shaped fixtures do; runtime-proof is a
// partial-stage path scaffold). Tests below mutate the fixture in-memory to
// add `writes.report`. Cases exercise through the full `runCompiledFlow`
// loop so the integration with the check-evaluation path is part of the
// assertion surface.

const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');

function loadMutatedFixture(
  mutator: (raw: {
    steps: Array<{
      id: string;
      writes: { report?: { path: string; schema: string } };
    }>;
  }) => void,
): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: {
    steps: Array<{
      id: string;
      writes: { report?: { path: string; schema: string } };
    }>;
  } = JSON.parse(bytes.toString('utf8'));
  mutator(raw);
  const mutated = Buffer.from(JSON.stringify(raw));
  return { flow: CompiledFlow.parse(raw), bytes: mutated };
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
      receipt_id: 'stub-receipt-materializer-schema-parse',
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
      'materializer wrote the canonical report as raw result_body bytes without schema parse; the contract requires schema-parsing result_body against writes.report.schema before materialization',
    acceptance_evidence:
      'report write requires both the verdict check pass AND a schema-parse pass against writes.report.schema; unknown schemas fail-closed by default; failure emits check.evaluated outcome=fail + step.aborted + run.closed outcome=aborted with the reason byte-identical across the three trace_entries and on the user-visible result.json',
    alternate_framing:
      'land schema parsing inside materializeRelay instead of at the runner layer — rejected because the runner already owns check-evaluation; keeping both checks at the same layer keeps the failure-path trace_entry surface uniform without duplicating schema logic across layers',
  };
}

function addCanonicalReport(
  raw: {
    steps: Array<{
      id: string;
      writes: { report?: { path: string; schema: string } };
    }>;
  },
  schema: string,
  path = 'reports/relay-canonical.json',
): void {
  const step = raw.steps.find((s) => s.id === 'relay-step');
  if (step === undefined) throw new Error('relay-step not found in fixture');
  step.writes.report = { path, schema };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-materializer-schema-parse-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('materializer schema-parse', () => {
  it('(a) valid payload round-trip: check passes + schema passes → canonical report written byte-equal to result_body; outcome=complete; relay.completed.verdict carries parsed verdict', async () => {
    const { flow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalReport(raw, 'runtime-proof-strict@v1');
    });
    const runFolder = join(runFolderBase, 'a-valid');
    const resultBody = '{"verdict":"ok","rationale":"schema accepts this"}';
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000001'),
      goal: 'case (a): valid schema-passing payload',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      relayer: relayerWith(resultBody),
    });

    expect(outcome.result.outcome).toBe('complete');

    const reportAbs = join(runFolder, 'reports', 'relay-canonical.json');
    expect(existsSync(reportAbs)).toBe(true);
    const reportBody = readFileSync(reportAbs, 'utf8');
    expect(reportBody).toBe(resultBody);

    const checkEvaluated = outcome.trace_entries.filter(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    expect(checkEvaluated).toHaveLength(1);
    const ge = checkEvaluated[0];
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(ge.outcome).toBe('pass');
    expect(ge.reason).toBeUndefined();

    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed') {
      throw new Error('expected relay.completed');
    }
    expect(relayCompleted.verdict).toBe('ok');

    expect(outcome.trace_entries.find((e) => e.kind === 'step.aborted')).toBeUndefined();
  });

  it('(b) invalid payload: check passes but schema rejects → canonical report NOT written; outcome=aborted; check.evaluated outcome=fail names the schema parse error; reason byte-identical across check.evaluated / step.aborted / run.closed / result.json', async () => {
    const { flow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalReport(raw, 'runtime-proof-strict@v1');
    });
    const runFolder = join(runFolderBase, 'b-invalid');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000002'),
      goal: 'case (b): check pass, schema fail (missing required field)',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      // Passes check.pass=["ok"] verdict check but fails runtime-proof-strict@v1
      // which requires a `rationale` field.
      relayer: relayerWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const reportAbs = join(runFolder, 'reports', 'relay-canonical.json');
    expect(existsSync(reportAbs)).toBe(false);

    // Transcript slots DO exist — durable evidence the relay happened.
    expect(existsSync(join(runFolder, 'reports', 'relay.request.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'relay.receipt.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'relay.result.json'))).toBe(true);

    const ge = outcome.trace_entries.find(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toBeDefined();
    // Reason names the schema parse failure, not a verdict rejection.
    expect(ge.reason).toMatch(/schema/i);
    expect(ge.reason).toMatch(/rationale/);
    expect(ge.reason).toMatch(/runtime-proof-strict@v1/);

    const aborted = outcome.trace_entries.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted');
    expect(aborted.step_id).toBe('relay-step');

    const relayStepCompleted = outcome.trace_entries.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'relay-step',
    );
    expect(relayStepCompleted).toBeUndefined();

    const closed = outcome.trace_entries.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed');
    expect(closed.outcome).toBe('aborted');

    // Reason byte-identity across the four trace_entry-surface slots. Same
    // invariant the verdict-rejection path locks down; this extends it
    // to the schema-parse failure path.
    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);

    // relay.completed.verdict carries the OBSERVED verdict ("ok"),
    // not the runtime sentinel — connector declared a verdict in
    // check.pass but the body failed schema parse. The durable
    // transcript reflects what the connector said.
    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed') {
      throw new Error('expected relay.completed');
    }
    expect(relayCompleted.verdict).toBe('ok');

    // result.json on disk mirrors the aborted outcome + reason (RESULT-I4).
    const resultBody = readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8');
    const resultParsed: { outcome: string; reason?: string } = JSON.parse(resultBody);
    expect(resultParsed.outcome).toBe('aborted');
    expect(resultParsed.reason).toBe(aborted.reason);
  });

  it('(c) schema-missing fallback: writes.report.schema names an unregistered schema → fail-closed; full uniform failure surface (no step.completed, byte-identical reason across 4 slots, relay.completed.verdict carries observed verdict)', async () => {
    const { flow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalReport(raw, 'not-registered-anywhere@v1');
    });
    const runFolder = join(runFolderBase, 'c-missing');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000003'),
      goal: 'case (c): unknown schema name → fail-closed',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      // Body would satisfy check.pass and minimal verdict shape, but the
      // declared schema name is not in the registry → fail-closed.
      relayer: relayerWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const reportAbs = join(runFolder, 'reports', 'relay-canonical.json');
    expect(existsSync(reportAbs)).toBe(false);

    // Transcript slots DO exist — durable evidence the relay happened.
    expect(existsSync(join(runFolder, 'reports', 'relay.request.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'relay.receipt.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'relay.result.json'))).toBe(true);

    const ge = outcome.trace_entries.find(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toMatch(/not registered/);
    expect(ge.reason).toMatch(/not-registered-anywhere@v1/);
    expect(ge.reason).toMatch(/fail-closed/);

    const aborted = outcome.trace_entries.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted');
    expect(aborted.step_id).toBe('relay-step');

    // No step.completed for the aborted step — the uniform failure
    // surface. The fail-closed branch is the one most likely to regress
    // independently, so it must lock the full surface the
    // check-pass/schema-fail case locks.
    const relayStepCompleted = outcome.trace_entries.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'relay-step',
    );
    expect(relayStepCompleted).toBeUndefined();

    const closed = outcome.trace_entries.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed');
    expect(closed.outcome).toBe('aborted');

    // Reason byte-identity across all four trace_entry-surface slots —
    // mirrors case (b) exactly. Without this, a future regression that
    // diverged reasons on the fail-closed path would silently degrade
    // audit traceability.
    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);

    // relay.completed.verdict carries the OBSERVED verdict ("ok"),
    // not the runtime sentinel — connector declared a verdict in
    // check.pass; only the schema lookup failed, not the connector output
    // itself. Symmetric to case (b).
    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed') {
      throw new Error('expected relay.completed');
    }
    expect(relayCompleted.verdict).toBe('ok');

    // result.json on disk mirrors the aborted outcome + reason (RESULT-I4).
    const resultBody = readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8');
    const resultParsed: { outcome: string; reason?: string } = JSON.parse(resultBody);
    expect(resultParsed.outcome).toBe('aborted');
    expect(resultParsed.reason).toBe(aborted.reason);
  });

  it('(d) check-fail interaction: check-fail on bad verdict still skips report write even when body would be schema-valid — check-fail reason (not schema-parse reason) is what lands', async () => {
    // Body { verdict: "reject", rationale: "..." } would PASS
    // runtime-proof-strict@v1 schema parse if we got that far — but the
    // check evaluator rejects "reject" (not in check.pass ["ok"]).
    // Expectation: the report is NOT written and the reason text
    // names the verdict rejection path, not the schema parse path.
    const { flow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalReport(raw, 'runtime-proof-strict@v1');
    });
    const runFolder = join(runFolderBase, 'd-check-fail-schema-valid');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000004'),
      goal: 'case (d): check-fail dominates even on schema-valid body',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      relayer: relayerWith(
        '{"verdict":"reject","rationale":"schema-valid but verdict not in check.pass"}',
      ),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const reportAbs = join(runFolder, 'reports', 'relay-canonical.json');
    expect(existsSync(reportAbs)).toBe(false);

    const ge = outcome.trace_entries.find(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(ge.outcome).toBe('fail');

    // Check-fail reason names the verdict rejection, NOT a schema parse
    // error. The assertion guards against a regression that flips the
    // ordering and lets schema-parse "win" the failure attribution
    // when both would fail.
    expect(ge.reason).toMatch(/reject/);
    expect(ge.reason).toMatch(/not in check.pass/);
    // The verdict-rejection reason string never mentions "schema"
    // or "registered" — that would only appear on the schema-parse
    // path.
    expect(ge.reason).not.toMatch(/not registered/);
    expect(ge.reason).not.toMatch(/did not validate against schema/);

    // relay.completed.verdict carries the observed verdict "reject"
    // — durable transcript reflects what connector said even on
    // rejection.
    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed') {
      throw new Error('expected relay.completed');
    }
    expect(relayCompleted.verdict).toBe('reject');
  });

  it('(e) orchestrator-only explore.analysis is not admitted through the relay report registry', async () => {
    const { flow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalReport(raw, 'explore.analysis@v1', 'reports/relay-analysis.json');
    });
    const runFolder = join(runFolderBase, 'e-orchestrator-only-schema');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000005'),
      goal: 'relay cannot materialize orchestrator-only analysis',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 16, 10, 0)),
      relayer: relayerWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(existsSync(join(runFolder, 'reports', 'relay-analysis.json'))).toBe(false);

    const ge = outcome.trace_entries.find(
      (e) => e.kind === 'check.evaluated' && e.check_kind === 'result_verdict',
    );
    if (ge?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toMatch(/explore\.analysis@v1/);
    expect(ge.reason).toMatch(/not registered/);

    const relayCompleted = outcome.trace_entries.find((e) => e.kind === 'relay.completed');
    if (relayCompleted?.kind !== 'relay.completed') {
      throw new Error('expected relay.completed');
    }
    expect(relayCompleted.verdict).toBe('ok');
  });
});
