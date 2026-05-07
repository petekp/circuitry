import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RelayResolutionSource, ResolvedConnector } from '../schemas/connector.js';
import type { RunId, StepId } from '../schemas/ids.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import type { RelayRole } from '../schemas/step.js';
import type { TraceEntry } from '../schemas/trace-entry.js';
import { resolveRunRelative } from '../shared/run-relative-path.js';
import { type RelayResult, sha256Hex } from './shared.js';

// Relay materialization glue between an connector's raw subprocess
// output and the five-trace_entry relay transcript + report
// materialization. The `connector.name` discriminant on the
// `relay.started` trace_entry is generic so a second connector (`codex`)
// reuses the same materialization seam without drifting the transcript
// shape.
//
// The durable relay transcript is the five-trace_entry sequence
//   relay.started → relay.request → relay.receipt →
//   relay.result → relay.completed
// on a single `(step_id, attempt)` pair. This module builds that
// sequence deterministically from a single `RelayResult` (shared
// shape produced by both the `agent` and `codex` connectors per
// `./shared.ts`), writes the four on-disk transcript slots (request
// payload, receipt, result bytes, materialized report), and returns
// the trace_entry array for the caller to append through `trace-writer.ts`.
//
// Why live in `src/connectors/`.
// The materializer is the connector's downstream binding — it knows how
// to translate a relay result into the trace_entry schema. Keeping this
// beside the subprocess connectors lets connector-source fingerprint and
// import-boundary tests cover both raw relay execution and durable relay
// transcript materialization.

export interface RelayMaterializeInput {
  readonly runId: RunId;
  readonly stepId: StepId;
  readonly attempt: number;
  readonly role: RelayRole;
  readonly startingSequence: number;
  readonly runFolder: string;
  readonly writes: {
    readonly request: string;
    readonly receipt: string;
    readonly result: string;
    readonly report?: { readonly path: string; readonly schema: string };
  };
  // The resolved connector is required so relay trace entries can carry
  // either a built-in connector or the custom descriptor selected from config.
  readonly connector: ResolvedConnector;
  // Selection + provenance are REQUIRED inputs to materialization rather
  // than hardcoded defaults. The materializer is fail-closed at the type
  // boundary: callers MUST compute and pass the real values. The runner
  // derives them in `runCompiledFlow`: connector provenance is
  // explicit-vs-default, while selection flows through the full
  // default/user-global/project/flow/stage/step/invocation resolver.
  readonly resolvedSelection: ResolvedSelection;
  readonly resolvedFrom: RelayResolutionSource;
  readonly relayResult: RelayResult;
  readonly verdict: string;
  readonly now: () => Date;
  readonly priorStart?: {
    readonly requestPayloadHash: string;
  };
}

export interface RelayMaterializeOutput {
  readonly trace_entries: readonly TraceEntry[];
  readonly sequenceAfter: number;
  readonly requestPath: string;
  readonly receiptPath: string;
  readonly resultPath: string;
  readonly reportPath: string | undefined;
  readonly requestPayloadHash: string;
  readonly resultReportHash: string;
}

// Write the returned transcript slots + the validated report file if
// `writes.report` is declared. Then produce the relay completion
// sequence. Callers may pre-write the request slot and append
// `relay.started` / `relay.request` before awaiting an connector; in
// that case `priorStart` carries the already-durable request hash and this
// materializer emits only receipt/result/completed trace_entries.
// Caller is responsible for appending the trace_entries via `appendTraceEntry`
// (or `appendAndDerive` if snapshot derivation is wanted).
//
// Materialization rule: when `writes.report` is declared, after BOTH
// the verdict check AND the schema parse pass, the runtime materializes
// the report at `writes.report.path` from the `result` payload.
// Verdict-check
// evaluation and schema-parse both live in the runner (see
// `src/runtime/runner.ts::evaluateRelayCheck` + the `parseReport`
// call around the materializer call site); by the time `writes.report`
// reaches this function the caller has already decided that the
// report is safe to write. Schema parsing uses the report schema
// registry at `src/flows/registries/report-schemas.ts`; unknown schema names
// are fail-closed and never reach this call site with a populated
// `writes.report` slot. The body bytes written here are the same
// bytes that satisfied the schema parse — the report file and the
// relay transcript `result` file are distinct on disk but share a
// byte-for-byte payload (a future canonicalization pass before write
// would change this).
export function materializeRelay(input: RelayMaterializeInput): RelayMaterializeOutput {
  const {
    runId,
    stepId,
    attempt,
    role,
    startingSequence,
    runFolder,
    writes,
    connector,
    resolvedSelection,
    resolvedFrom,
    relayResult,
    verdict,
    now,
    priorStart,
  } = input;

  // Cross-validation of the role binding the TraceEntry-union schema enforces
  // (`resolved_from.source === 'role'` requires
  // `resolved_from.role === role`). Catching here at the materializer
  // boundary surfaces the mismatch with a precise error before the
  // trace_entry is constructed and round-tripped through the schema.
  if (resolvedFrom.source === 'role' && resolvedFrom.role !== role) {
    throw new Error(
      `materializeRelay: resolvedFrom.role '${resolvedFrom.role}' does not match relay step role '${role}' — TraceEntry schema cross-validation will reject this combination.`,
    );
  }

  const requestAbs = resolveRunRelative(runFolder, writes.request);
  const receiptAbs = resolveRunRelative(runFolder, writes.receipt);
  const resultAbs = resolveRunRelative(runFolder, writes.result);
  const reportAbs =
    writes.report === undefined ? undefined : resolveRunRelative(runFolder, writes.report.path);

  for (const p of [requestAbs, receiptAbs, resultAbs]) {
    mkdirSync(dirname(p), { recursive: true });
  }
  if (priorStart === undefined) {
    writeFileSync(requestAbs, relayResult.request_payload);
  }
  writeFileSync(receiptAbs, relayResult.receipt_id);
  writeFileSync(resultAbs, relayResult.result_body);
  if (reportAbs !== undefined) {
    mkdirSync(dirname(reportAbs), { recursive: true });
    writeFileSync(reportAbs, relayResult.result_body);
  }

  const requestPayloadHash =
    priorStart?.requestPayloadHash ?? sha256Hex(relayResult.request_payload);
  const resultReportHash = sha256Hex(relayResult.result_body);

  let sequence = startingSequence;
  const ts = () => now().toISOString();
  const trace_entries: TraceEntry[] = [];

  if (priorStart === undefined) {
    trace_entries.push({
      schema_version: 1,
      sequence: sequence++,
      recorded_at: ts(),
      run_id: runId,
      kind: 'relay.started',
      step_id: stepId,
      attempt,
      connector,
      role,
      resolved_selection: resolvedSelection,
      resolved_from: resolvedFrom,
    });

    trace_entries.push({
      schema_version: 1,
      sequence: sequence++,
      recorded_at: ts(),
      run_id: runId,
      kind: 'relay.request',
      step_id: stepId,
      attempt,
      request_payload_hash: requestPayloadHash,
    });
  }

  trace_entries.push({
    schema_version: 1,
    sequence: sequence++,
    recorded_at: ts(),
    run_id: runId,
    kind: 'relay.receipt',
    step_id: stepId,
    attempt,
    receipt_id: relayResult.receipt_id,
  });

  trace_entries.push({
    schema_version: 1,
    sequence: sequence++,
    recorded_at: ts(),
    run_id: runId,
    kind: 'relay.result',
    step_id: stepId,
    attempt,
    result_report_hash: resultReportHash,
  });

  trace_entries.push({
    schema_version: 1,
    sequence: sequence++,
    recorded_at: ts(),
    run_id: runId,
    kind: 'relay.completed',
    step_id: stepId,
    attempt,
    verdict,
    duration_ms: Math.max(0, Math.round(relayResult.duration_ms)),
    result_path: writes.result,
    receipt_path: writes.receipt,
  });

  return {
    trace_entries,
    sequenceAfter: sequence,
    requestPath: requestAbs,
    receiptPath: receiptAbs,
    resultPath: resultAbs,
    reportPath: reportAbs,
    requestPayloadHash,
    resultReportHash,
  };
}
