import { describe, expect, it } from 'vitest';

import { deriveTerminalVerdict } from '../../src/policy/terminal-verdict.js';
import { TraceEntry, type TraceEntry as TraceEntryValue } from '../../src/schemas/trace-entry.js';

const RUN_ID = '81000000-0000-0000-0000-000000000001';
const CHILD_RUN_ID = '81000000-0000-0000-0000-000000000002';

function traceEntry(raw: unknown): TraceEntryValue {
  return TraceEntry.parse(raw);
}

function base(sequence: number) {
  return {
    schema_version: 1,
    sequence,
    recorded_at: new Date(Date.UTC(2026, 4, 5, 6, 0, sequence)).toISOString(),
    run_id: RUN_ID,
  };
}

function relayCompleted(sequence: number, step_id: string, verdict: string): TraceEntryValue {
  return traceEntry({
    ...base(sequence),
    kind: 'relay.completed',
    step_id,
    attempt: 1,
    verdict,
    duration_ms: 1,
    result_path: `reports/${step_id}.result.json`,
    receipt_path: `reports/${step_id}.receipt.json`,
  });
}

function subRunCompleted(sequence: number, step_id: string, verdict: string): TraceEntryValue {
  return traceEntry({
    ...base(sequence),
    kind: 'sub_run.completed',
    step_id,
    attempt: 1,
    child_run_id: CHILD_RUN_ID,
    child_outcome: 'complete',
    verdict,
    duration_ms: 1,
    result_path: `reports/${step_id}.child.result.json`,
  });
}

function checkEvaluated(
  sequence: number,
  step_id: string,
  check_kind: 'result_verdict' | 'schema_sections',
  outcome: 'pass' | 'fail',
): TraceEntryValue {
  return traceEntry({
    ...base(sequence),
    kind: 'check.evaluated',
    step_id,
    attempt: 1,
    check_kind,
    outcome,
  });
}

describe('deriveTerminalVerdict', () => {
  it('returns the latest admitted result verdict', () => {
    const trace = [
      relayCompleted(1, 'first-step', 'early'),
      checkEvaluated(2, 'first-step', 'result_verdict', 'pass'),
      relayCompleted(3, 'second-step', 'late'),
      checkEvaluated(4, 'second-step', 'result_verdict', 'pass'),
    ];

    expect(deriveTerminalVerdict(trace, 'complete')).toBe('late');
  });

  it('admits sub-run verdicts through result_verdict checks', () => {
    const trace = [
      subRunCompleted(1, 'child-review', 'child-pass'),
      checkEvaluated(2, 'child-review', 'result_verdict', 'pass'),
    ];

    expect(deriveTerminalVerdict(trace, 'complete')).toBe('child-pass');
  });

  it('ignores failed or non-verdict checks', () => {
    const trace = [
      relayCompleted(1, 'schema-step', 'schema-pass'),
      checkEvaluated(2, 'schema-step', 'schema_sections', 'pass'),
      relayCompleted(3, 'failed-step', 'rejected'),
      checkEvaluated(4, 'failed-step', 'result_verdict', 'fail'),
    ];

    expect(deriveTerminalVerdict(trace, 'complete')).toBeUndefined();
  });

  it('omits verdicts for non-complete run outcomes', () => {
    const trace = [
      relayCompleted(1, 'aborted-step', 'would-have-passed'),
      checkEvaluated(2, 'aborted-step', 'result_verdict', 'pass'),
    ];

    expect(deriveTerminalVerdict(trace, 'aborted')).toBeUndefined();
  });
});
