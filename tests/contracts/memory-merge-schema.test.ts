import { describe, expect, it } from 'vitest';
import {
  HISTORY_AUTHORITY_NOTICE,
  HistoryMemoryMergeV1,
  MemoryMergeEffectStatusV1,
  MemoryMergeInputV1,
  MemoryMergeItemV1,
  MemoryMergeOutcomeCountV1,
  MemoryMergeRunLinkageV1,
} from '../../src/index.js';

const sha = 'a'.repeat(64);
const runId = '11111111-1111-4111-8111-111111111111';

function sourceRef() {
  return {
    kind: 'report' as const,
    ref: 'reports/result.json',
    sha256: sha,
    run_id: runId,
    flow_id: 'build',
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    memory_input_id: `prior-run-${runId}-abc123def456`,
    content_id: 'mem-c-0123456789abcdef',
    kind: 'prior_run',
    source_ref: sourceRef(),
    staleness: 'fresh',
    resolved_from_recall: true,
    ...overrides,
  };
}

function linkage(overrides: Record<string, unknown> = {}) {
  return {
    run_id: runId,
    flow_id: 'build',
    operator_intent: 'add the thing',
    outcome: 'complete',
    abort_reason: undefined,
    memory_used: true,
    memory_inputs: [input()],
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    group_key: 'mem-c-0123456789abcdef',
    content_id: 'mem-c-0123456789abcdef',
    memory_input_ids: [`prior-run-${runId}-abc123def456`],
    kind: 'prior_run',
    source_ref: sourceRef(),
    used_by_run_ids: [runId],
    outcome_counts: [{ outcome: 'complete', count: 1 }],
    effect_status: 'not_enough_data',
    effect_note: 'effect requires cross-run aggregation',
    ...overrides,
  };
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    api_version: 'history-memory-merge-v1',
    schema_version: 1,
    generated_at: '2026-05-29T00:00:00.000Z',
    runs_base: '/repo/.circuit/runs',
    authority_notice: HISTORY_AUTHORITY_NOTICE,
    run_count: 1,
    envelope_count: 1,
    memory_run_count: 1,
    linkages: [linkage()],
    memory_items: [item()],
    warnings: [],
    ...overrides,
  };
}

describe('history.memory-merge@v1 schema', () => {
  it('accepts a well-formed report', () => {
    expect(() => HistoryMemoryMergeV1.parse(report())).not.toThrow();
  });

  it('accepts all four effect-status values (forward-compat for Slice 2)', () => {
    for (const status of [
      'not_enough_data',
      'correlated_positive',
      'correlated_negative',
      'unresolved',
    ]) {
      expect(MemoryMergeEffectStatusV1.parse(status)).toBe(status);
    }
  });

  it('rejects an unknown api_version', () => {
    expect(HistoryMemoryMergeV1.safeParse(report({ api_version: 'nope' })).success).toBe(false);
  });

  it('rejects an unsupported schema_version', () => {
    expect(HistoryMemoryMergeV1.safeParse(report({ schema_version: 2 })).success).toBe(false);
  });

  it('rejects a wrong authority notice', () => {
    expect(HistoryMemoryMergeV1.safeParse(report({ authority_notice: 'wrong' })).success).toBe(
      false,
    );
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(HistoryMemoryMergeV1.safeParse({ ...report(), extra: 1 }).success).toBe(false);
  });

  it('rejects unknown keys on every nested record (strict)', () => {
    expect(MemoryMergeInputV1.safeParse({ ...input(), extra: 1 }).success).toBe(false);
    expect(MemoryMergeRunLinkageV1.safeParse({ ...linkage(), extra: 1 }).success).toBe(false);
    expect(MemoryMergeItemV1.safeParse({ ...item(), extra: 1 }).success).toBe(false);
    expect(
      MemoryMergeOutcomeCountV1.safeParse({ outcome: 'complete', count: 1, extra: 1 }).success,
    ).toBe(false);
  });

  it('requires envelope_count to equal linkages.length', () => {
    expect(HistoryMemoryMergeV1.safeParse(report({ envelope_count: 2 })).success).toBe(false);
  });

  it('requires memory_run_count to equal the number of memory-using linkages', () => {
    expect(HistoryMemoryMergeV1.safeParse(report({ memory_run_count: 0 })).success).toBe(false);
  });

  it('requires run_count to be at least envelope_count', () => {
    expect(
      HistoryMemoryMergeV1.safeParse(report({ run_count: 0, envelope_count: 1 })).success,
    ).toBe(false);
  });

  it('forbids memory inputs on a run that did not use memory', () => {
    const offRun = linkage({ memory_used: false, memory_inputs: [input()] });
    expect(MemoryMergeRunLinkageV1.safeParse(offRun).success).toBe(false);
  });

  it('allows a memory-off run with no inputs', () => {
    const offRun = linkage({ memory_used: false, memory_inputs: [] });
    expect(MemoryMergeRunLinkageV1.safeParse(offRun).success).toBe(true);
  });

  it('forbids a content_id when the input was not resolved from recall', () => {
    const unresolved = input({ resolved_from_recall: false });
    expect(MemoryMergeInputV1.safeParse(unresolved).success).toBe(false);
  });

  it('allows a null content_id when recall was unavailable', () => {
    const unresolved = input({
      resolved_from_recall: false,
      content_id: null,
      kind: undefined,
      source_ref: undefined,
      staleness: undefined,
    });
    expect(MemoryMergeInputV1.safeParse(unresolved).success).toBe(true);
  });

  it('requires at least one outcome count and one run id per item', () => {
    expect(MemoryMergeItemV1.safeParse(item({ outcome_counts: [] })).success).toBe(false);
    expect(MemoryMergeItemV1.safeParse(item({ used_by_run_ids: [] })).success).toBe(false);
    expect(MemoryMergeItemV1.safeParse(item({ memory_input_ids: [] })).success).toBe(false);
  });

  it('requires outcome_counts to sum to the number of runs that used the item', () => {
    const mismatched = item({
      used_by_run_ids: [runId, '22222222-2222-4222-8222-222222222222'],
      outcome_counts: [{ outcome: 'complete', count: 1 }],
    });
    expect(MemoryMergeItemV1.safeParse(mismatched).success).toBe(false);
    const consistent = item({
      used_by_run_ids: [runId, '22222222-2222-4222-8222-222222222222'],
      outcome_counts: [{ outcome: 'complete', count: 2 }],
    });
    expect(MemoryMergeItemV1.safeParse(consistent).success).toBe(true);
  });
});
