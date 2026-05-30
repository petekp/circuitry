import { describe, expect, it } from 'vitest';
import {
  HISTORY_AUTHORITY_NOTICE,
  HistoryMemoryEffectV1,
  MemoryEffectArmV1,
  MemoryEffectComparisonV1,
  MemoryEffectItemV1,
  MemoryFlowContrastV1,
  MemoryMergeEffectStatusV1,
} from '../../src/index.js';

const sha = 'a'.repeat(64);
const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const R3 = '33333333-3333-4333-8333-333333333333';
const R4 = '44444444-4444-4444-8444-444444444444';

function sourceRef() {
  return { kind: 'report' as const, ref: 'reports/result.json', sha256: sha, flow_id: 'build' };
}

// used arm: 2 runs, both complete. comparable arm: 2 runs, both blocked.
function usedArm(overrides: Record<string, unknown> = {}) {
  return {
    run_ids: [R1, R2],
    size: 2,
    complete_count: 2,
    adverse_count: 0,
    neutral_count: 0,
    outcome_counts: [{ outcome: 'complete', count: 2 }],
    complete_rate: 1,
    adverse_rate: 0,
    ...overrides,
  };
}

function comparableArm(overrides: Record<string, unknown> = {}) {
  return {
    run_ids: [R3, R4],
    size: 2,
    complete_count: 0,
    adverse_count: 2,
    neutral_count: 0,
    outcome_counts: [{ outcome: 'blocked', count: 2 }],
    complete_rate: 0,
    adverse_rate: 1,
    ...overrides,
  };
}

function comparison(overrides: Record<string, unknown> = {}) {
  return {
    used_arm: usedArm(),
    comparable_arm: comparableArm(),
    complete_rate_delta: 1,
    adverse_rate_delta: -1,
    effect_status: 'correlated_positive',
    effect_note: 'the used arm closed complete more often and was no worse on aborts',
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    content_id: 'mem-c-0123456789abcdef',
    group_key: 'mem-c-0123456789abcdef',
    flow_id: 'build',
    kind: 'prior_run',
    source_ref: sourceRef(),
    comparison: comparison(),
    ...overrides,
  };
}

function flowContrast(overrides: Record<string, unknown> = {}) {
  return { flow_id: 'build', comparison: comparison(), ...overrides };
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    items_total: 1,
    items_not_enough_data: 0,
    items_unresolved: 0,
    items_correlated_positive: 1,
    items_correlated_negative: 0,
    flow_contrasts_total: 1,
    flow_contrasts_not_enough_data: 0,
    flow_contrasts_unresolved: 0,
    flow_contrasts_correlated_positive: 1,
    flow_contrasts_correlated_negative: 0,
    ...overrides,
  };
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    api_version: 'history-memory-effect-v1',
    schema_version: 1,
    generated_at: '2026-05-29T00:00:00.000Z',
    runs_base: '/repo/.circuit/runs',
    authority_notice: HISTORY_AUTHORITY_NOTICE,
    min_arm_size: 2,
    margin: 0.5,
    source_run_count: 4,
    source_envelope_count: 4,
    source_memory_run_count: 2,
    item_effects: [item()],
    flow_contrasts: [flowContrast()],
    summary: summary(),
    warnings: [],
    ...overrides,
  };
}

describe('history.memory-effect@v1 schema', () => {
  it('accepts a well-formed report', () => {
    expect(() => HistoryMemoryEffectV1.parse(report())).not.toThrow();
  });

  it('accepts all four effect-status values (reuses the frozen Slice 1 enum)', () => {
    for (const status of [
      'not_enough_data',
      'correlated_positive',
      'correlated_negative',
      'unresolved',
    ]) {
      expect(MemoryMergeEffectStatusV1.parse(status)).toBe(status);
      expect(
        MemoryEffectComparisonV1.safeParse(comparison({ effect_status: status })).success,
      ).toBe(true);
    }
  });

  it('rejects an unknown api_version', () => {
    expect(HistoryMemoryEffectV1.safeParse(report({ api_version: 'nope' })).success).toBe(false);
  });

  it('rejects an unsupported schema_version', () => {
    expect(HistoryMemoryEffectV1.safeParse(report({ schema_version: 2 })).success).toBe(false);
  });

  it('rejects a wrong authority notice', () => {
    expect(HistoryMemoryEffectV1.safeParse(report({ authority_notice: 'wrong' })).success).toBe(
      false,
    );
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(HistoryMemoryEffectV1.safeParse({ ...report(), extra: 1 }).success).toBe(false);
  });

  it('rejects unknown keys on every nested record (strict)', () => {
    expect(MemoryEffectArmV1.safeParse({ ...usedArm(), extra: 1 }).success).toBe(false);
    expect(MemoryEffectComparisonV1.safeParse({ ...comparison(), extra: 1 }).success).toBe(false);
    expect(MemoryEffectItemV1.safeParse({ ...item(), extra: 1 }).success).toBe(false);
    expect(MemoryFlowContrastV1.safeParse({ ...flowContrast(), extra: 1 }).success).toBe(false);
  });

  it('rejects an arm whose counts do not sum to size', () => {
    expect(MemoryEffectArmV1.safeParse(usedArm({ complete_count: 1 })).success).toBe(false);
  });

  it('rejects an arm whose outcome_counts do not sum to size', () => {
    expect(
      MemoryEffectArmV1.safeParse(usedArm({ outcome_counts: [{ outcome: 'complete', count: 1 }] }))
        .success,
    ).toBe(false);
  });

  it('rejects an arm whose run_ids length does not equal size', () => {
    expect(MemoryEffectArmV1.safeParse(usedArm({ run_ids: [R1] })).success).toBe(false);
  });

  it('accepts an empty arm (size 0, empty arrays, rate 0)', () => {
    expect(
      MemoryEffectArmV1.safeParse({
        run_ids: [],
        size: 0,
        complete_count: 0,
        adverse_count: 0,
        neutral_count: 0,
        outcome_counts: [],
        complete_rate: 0,
        adverse_rate: 0,
      }).success,
    ).toBe(true);
  });

  it('requires items_total to equal item_effects.length', () => {
    expect(
      HistoryMemoryEffectV1.safeParse(report({ summary: summary({ items_total: 2 }) })).success,
    ).toBe(false);
  });

  it('requires each per-status item count to mirror the filtered item_effects', () => {
    expect(
      HistoryMemoryEffectV1.safeParse(
        report({ summary: summary({ items_correlated_positive: 0, items_unresolved: 1 }) }),
      ).success,
    ).toBe(false);
  });

  it('requires flow_contrasts_total to equal flow_contrasts.length', () => {
    expect(
      HistoryMemoryEffectV1.safeParse(report({ summary: summary({ flow_contrasts_total: 0 }) }))
        .success,
    ).toBe(false);
  });

  it('requires each per-status flow-contrast count to mirror the filtered flow_contrasts', () => {
    expect(
      HistoryMemoryEffectV1.safeParse(
        report({
          summary: summary({
            flow_contrasts_correlated_positive: 0,
            flow_contrasts_correlated_negative: 1,
          }),
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects margin 0 and margin > 1, accepts the inclusive boundary 1', () => {
    expect(HistoryMemoryEffectV1.safeParse(report({ margin: 0 })).success).toBe(false);
    expect(HistoryMemoryEffectV1.safeParse(report({ margin: 1.5 })).success).toBe(false);
    expect(HistoryMemoryEffectV1.safeParse(report({ margin: 1 })).success).toBe(true);
  });

  it('requires min_arm_size to be at least 1', () => {
    expect(HistoryMemoryEffectV1.safeParse(report({ min_arm_size: 0 })).success).toBe(false);
  });

  it('allows a null content_id on an item (mirrors a Slice 1 unresolved group)', () => {
    expect(
      MemoryEffectItemV1.safeParse(
        item({
          content_id: null,
          group_key: 'unresolved:prior-run-x',
          kind: undefined,
          source_ref: undefined,
        }),
      ).success,
    ).toBe(true);
  });
});
