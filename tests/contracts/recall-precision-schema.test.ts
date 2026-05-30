import { describe, expect, it } from 'vitest';
import {
  HISTORY_AUTHORITY_NOTICE,
  HistoryRecallPrecisionV1,
  RecallPrecisionConsultedStatusV1,
  RecallPrecisionTierV1,
} from '../../src/index.js';

function decision(overrides: Record<string, unknown> = {}) {
  return {
    memory_input_id: 'prior-run-s1-aaaaaaaaaaaa',
    content_id: 'mem-c-0123456789abcdef',
    staleness: 'fresh',
    consulted_effect_status: 'not_enough_data',
    tier: 'neutral_fresh',
    injected: true,
    ...overrides,
  };
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    api_version: 'history-recall-precision-v1',
    schema_version: 1,
    generated_at: '2026-05-29T00:00:00.000Z',
    flow_id: 'build',
    effect_report_available: true,
    effect_report_generated_at: '2026-05-29T00:00:00.000Z',
    authority_notice: HISTORY_AUTHORITY_NOTICE,
    budget: 3,
    indicator:
      'Memory (hint-only): 1 prior-run hint loaded for flow build; earned-precision active.',
    decisions: [decision()],
    warnings: [],
    ...overrides,
  };
}

describe('history.recall-precision@v1 schema', () => {
  it('accepts a well-formed sidecar', () => {
    expect(() => HistoryRecallPrecisionV1.parse(report())).not.toThrow();
  });

  it('accepts every tier value', () => {
    for (const tier of ['suppressed', 'positive_fresh', 'neutral_fresh', 'stale']) {
      expect(RecallPrecisionTierV1.parse(tier)).toBe(tier);
    }
  });

  it('accepts every consulted_effect_status value including no_verdict', () => {
    for (const status of [
      'not_enough_data',
      'correlated_positive',
      'correlated_negative',
      'unresolved',
      'no_verdict',
    ]) {
      expect(RecallPrecisionConsultedStatusV1.parse(status)).toBe(status);
    }
  });

  it('allows an absent flow_id and effect_report_generated_at (fail-open shape)', () => {
    expect(
      HistoryRecallPrecisionV1.safeParse(
        report({
          flow_id: undefined,
          effect_report_generated_at: undefined,
          effect_report_available: false,
        }),
      ).success,
    ).toBe(true);
  });

  it('allows a null content_id on a decision', () => {
    expect(
      HistoryRecallPrecisionV1.safeParse(
        report({
          decisions: [decision({ content_id: null, consulted_effect_status: 'no_verdict' })],
        }),
      ).success,
    ).toBe(true);
  });

  it('rejects an unknown api_version, schema_version, and wrong authority notice', () => {
    expect(HistoryRecallPrecisionV1.safeParse(report({ api_version: 'nope' })).success).toBe(false);
    expect(HistoryRecallPrecisionV1.safeParse(report({ schema_version: 2 })).success).toBe(false);
    expect(HistoryRecallPrecisionV1.safeParse(report({ authority_notice: 'x' })).success).toBe(
      false,
    );
  });

  it('rejects unknown keys (strict) at the top level and on a decision', () => {
    expect(HistoryRecallPrecisionV1.safeParse({ ...report(), extra: 1 }).success).toBe(false);
    expect(
      HistoryRecallPrecisionV1.safeParse(report({ decisions: [decision({ extra: 1 })] })).success,
    ).toBe(false);
  });

  it('rejects more injected decisions than the budget', () => {
    const four = [0, 1, 2, 3].map((i) =>
      decision({ memory_input_id: `prior-run-s${i}-aaaaaaaaaaaa`, injected: true }),
    );
    expect(HistoryRecallPrecisionV1.safeParse(report({ budget: 3, decisions: four })).success).toBe(
      false,
    );
  });

  it('rejects a suppressed decision that is also injected', () => {
    expect(
      HistoryRecallPrecisionV1.safeParse(
        report({
          decisions: [
            decision({
              tier: 'suppressed',
              injected: true,
              consulted_effect_status: 'correlated_negative',
            }),
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('accepts a suppressed decision that is not injected', () => {
    expect(
      HistoryRecallPrecisionV1.safeParse(
        report({
          budget: 3,
          decisions: [
            decision({
              tier: 'suppressed',
              injected: false,
              consulted_effect_status: 'correlated_negative',
            }),
          ],
        }),
      ).success,
    ).toBe(true);
  });
});
