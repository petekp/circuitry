import { createHash } from 'node:crypto';
import {
  type ClaimId,
  Evidence,
  type Evidence as EvidenceValue,
} from '../schemas/proof-assessment.js';
import type { Ref } from '../schemas/ref.js';
import type { CheckEvaluatedTraceEntry } from '../schemas/trace-entry.js';

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
    );
  });
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function traceRef(entry: CheckEvaluatedTraceEntry): Ref {
  return {
    kind: 'trace',
    ref: `trace.ndjson#sequence=${entry.sequence}`,
    run_id: entry.run_id,
    step_id: entry.step_id,
    attempt: entry.attempt,
    sequence: entry.sequence,
  };
}

function commandRef(entry: CheckEvaluatedTraceEntry): Ref {
  if (entry.criterion_id === undefined) {
    throw new Error('acceptance command evidence requires criterion_id');
  }
  return {
    kind: 'command',
    ref: `acceptance-criteria/${entry.step_id}/${entry.attempt}/${entry.criterion_id}/command`,
    sha256: sha256({
      check_kind: entry.check_kind,
      criterion_id: entry.criterion_id,
      criterion_kind: entry.criterion_kind,
      exit_code: entry.exit_code,
      status: entry.status,
      stdout_summary: entry.stdout_summary,
      stderr_summary: entry.stderr_summary,
      outcome: entry.outcome,
    }),
    run_id: entry.run_id,
    step_id: entry.step_id,
    attempt: entry.attempt,
  };
}

function requireAcceptanceCriterionKind(
  criterionKind: CheckEvaluatedTraceEntry['criterion_kind'],
): 'command' | 'report_field' {
  if (criterionKind === 'command' || criterionKind === 'report_field') return criterionKind;
  throw new Error('acceptance criteria evidence requires criterion_kind');
}

export function evidenceFromAcceptanceCriteriaTrace(input: {
  readonly entry: CheckEvaluatedTraceEntry;
  readonly coversClaims: readonly ClaimId[];
}): EvidenceValue {
  const { entry } = input;
  if (entry.kind !== 'check.evaluated' || entry.check_kind !== 'acceptance_criteria') {
    throw new Error('acceptance criteria evidence requires a check.evaluated acceptance entry');
  }
  if (entry.criterion_id === undefined) {
    throw new Error('acceptance criteria evidence requires criterion_id');
  }
  const kind = requireAcceptanceCriterionKind(entry.criterion_kind);
  const inputRef = traceRef(entry);
  const ref = kind === 'command' ? commandRef(entry) : inputRef;
  return Evidence.parse({
    schema_version: 1,
    id: `evidence.acceptance:${entry.step_id}:${entry.attempt}:${entry.criterion_id}`,
    kind,
    producer: 'runtime',
    independence: 'runtime',
    ref,
    input_refs: [inputRef],
    covers_claims: input.coversClaims,
    result: entry.outcome === 'pass' ? 'pass' : 'fail',
    ...(entry.reason === undefined ? {} : { summary: entry.reason }),
  });
}
