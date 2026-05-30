import { describe, expect, it } from 'vitest';
import { aggregateMemoryEffect, classifyEffect } from '../../src/app/history/memory-effect.js';
import {
  HISTORY_AUTHORITY_NOTICE,
  HistoryMemoryMergeV1,
  type MemoryMergeItemV1,
  type MemoryMergeRunLinkageV1,
  type RunEnvelopeOutcome,
} from '../../src/index.js';

const C1 = 'mem-c-1111111111111111';
const C2 = 'mem-c-2222222222222222';

let seq = 0;
function runId(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, '0')}`;
}

function input(content_id: string | null, memory_input_id: string) {
  if (content_id === null) {
    return { memory_input_id, content_id: null, resolved_from_recall: false as const };
  }
  return {
    memory_input_id,
    content_id,
    kind: 'prior_run' as const,
    resolved_from_recall: true as const,
  };
}

function linkage(args: {
  flowId: string;
  outcome: RunEnvelopeOutcome;
  used: boolean;
  inputs?: ReturnType<typeof input>[];
}): MemoryMergeRunLinkageV1 {
  return {
    run_id: runId(),
    flow_id: args.flowId,
    operator_intent: 'do the thing',
    outcome: args.outcome,
    memory_used: args.used,
    memory_inputs: args.used ? (args.inputs ?? []) : [],
  };
}

function buildMerge(
  linkages: MemoryMergeRunLinkageV1[],
  options: { memoryItems?: MemoryMergeItemV1[]; warnings?: HistoryMemoryMergeV1['warnings'] } = {},
): HistoryMemoryMergeV1 {
  return HistoryMemoryMergeV1.parse({
    api_version: 'history-memory-merge-v1',
    schema_version: 1,
    generated_at: '2026-05-29T00:00:00.000Z',
    runs_base: '/repo/.circuit/runs',
    authority_notice: HISTORY_AUTHORITY_NOTICE,
    run_count: linkages.length,
    envelope_count: linkages.length,
    memory_run_count: linkages.filter((l) => l.memory_used).length,
    linkages,
    memory_items: options.memoryItems ?? [],
    warnings: options.warnings ?? [],
  });
}

const GATES = { minArmSize: 2, margin: 0.5 };

describe('classifyEffect (D5 rule, in isolation)', () => {
  const fullArm = { size: 2, complete_rate: 1, adverse_rate: 0 };
  const splitArm = { size: 2, complete_rate: 0, adverse_rate: 1 };

  it('gates not_enough_data when either arm is below the floor (precedence first)', () => {
    expect(
      classifyEffect(
        {
          used_arm: { size: 1, complete_rate: 1, adverse_rate: 0 },
          comparable_arm: splitArm,
          complete_rate_delta: 1,
          adverse_rate_delta: -1,
        },
        0.5,
        2,
      ).effect_status,
    ).toBe('not_enough_data');
  });

  it('returns correlated_positive on a clean separation with no worse aborts', () => {
    expect(
      classifyEffect(
        {
          used_arm: fullArm,
          comparable_arm: splitArm,
          complete_rate_delta: 1,
          adverse_rate_delta: -1,
        },
        0.5,
        2,
      ).effect_status,
    ).toBe('correlated_positive');
  });

  it('returns correlated_negative when complete drops by the margin', () => {
    expect(
      classifyEffect(
        {
          used_arm: splitArm,
          comparable_arm: fullArm,
          complete_rate_delta: -1,
          adverse_rate_delta: 1,
        },
        0.5,
        2,
      ).effect_status,
    ).toBe('correlated_negative');
  });

  it('returns unresolved when both arms meet the floor but the gap is within margin', () => {
    expect(
      classifyEffect(
        {
          used_arm: { size: 2, complete_rate: 0.5, adverse_rate: 0.5 },
          comparable_arm: { size: 2, complete_rate: 0.5, adverse_rate: 0.5 },
          complete_rate_delta: 0,
          adverse_rate_delta: 0,
        },
        0.5,
        2,
      ).effect_status,
    ).toBe('unresolved');
  });

  it('does not fire positive when complete improves but aborts also rise', () => {
    // complete_delta meets the margin, but adverse_rate_delta > 0 blocks positive,
    // and adverse_rate_delta >= margin trips negative.
    expect(
      classifyEffect(
        {
          used_arm: { size: 2, complete_rate: 1, adverse_rate: 0.5 },
          comparable_arm: { size: 2, complete_rate: 0.5, adverse_rate: 0 },
          complete_rate_delta: 0.5,
          adverse_rate_delta: 0.5,
        },
        0.5,
        2,
      ).effect_status,
    ).toBe('correlated_negative');
  });

  it('fires positive at the adverse_rate_delta === 0 boundary (the <= 0 gate, not < 0)', () => {
    // complete improves by exactly the margin and aborts are unchanged (delta 0):
    // the spec's adverse_rate_delta <= 0 gate must admit the boundary, not reject it.
    expect(
      classifyEffect(
        {
          used_arm: { size: 2, complete_rate: 1, adverse_rate: 0.5 },
          comparable_arm: { size: 2, complete_rate: 0.5, adverse_rate: 0.5 },
          complete_rate_delta: 0.5,
          adverse_rate_delta: 0,
        },
        0.5,
        2,
      ).effect_status,
    ).toBe('correlated_positive');
  });
});

describe('aggregateMemoryEffect', () => {
  it('validates the gates', () => {
    const merge = buildMerge([]);
    expect(() => aggregateMemoryEffect(merge, { minArmSize: 2, margin: 0 })).toThrow();
    expect(() => aggregateMemoryEffect(merge, { minArmSize: 2, margin: 1.5 })).toThrow();
    expect(() => aggregateMemoryEffect(merge, { minArmSize: 0, margin: 0.5 })).toThrow();
    expect(() => aggregateMemoryEffect(merge, GATES)).not.toThrow();
  });

  it('carries the merge provenance and warnings forward', () => {
    const merge = buildMerge([linkage({ flowId: 'build', outcome: 'complete', used: false })], {
      warnings: [{ code: 'recall_report_missing', message: 'x' }],
    });
    const effect = aggregateMemoryEffect(merge, GATES);
    expect(effect.source_run_count).toBe(merge.run_count);
    expect(effect.source_envelope_count).toBe(merge.envelope_count);
    expect(effect.source_memory_run_count).toBe(merge.memory_run_count);
    expect(effect.min_arm_size).toBe(2);
    expect(effect.margin).toBe(0.5);
    expect(effect.generated_at).toBe(merge.generated_at);
    expect(effect.warnings).toEqual(merge.warnings);
  });

  it('scores a 2-vs-2 unanimous split as correlated_positive, and its mirror as negative', () => {
    const positive = buildMerge([
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm1')] }),
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm2')] }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
    ]);
    const pe = aggregateMemoryEffect(positive, GATES);
    expect(pe.item_effects).toHaveLength(1);
    const c = pe.item_effects[0]?.comparison;
    expect(c?.effect_status).toBe('correlated_positive');
    expect(c?.used_arm.size).toBe(2);
    expect(c?.comparable_arm.size).toBe(2);
    expect(c?.complete_rate_delta).toBe(1);
    expect(c?.adverse_rate_delta).toBe(-1);

    const negative = buildMerge([
      linkage({ flowId: 'build', outcome: 'blocked', used: true, inputs: [input(C1, 'm1')] }),
      linkage({ flowId: 'build', outcome: 'failed', used: true, inputs: [input(C1, 'm2')] }),
      linkage({ flowId: 'build', outcome: 'complete', used: false }),
      linkage({ flowId: 'build', outcome: 'complete', used: false }),
    ]);
    expect(aggregateMemoryEffect(negative, GATES).item_effects[0]?.comparison.effect_status).toBe(
      'correlated_negative',
    );
  });

  it('scores a within-margin split at the floor as unresolved', () => {
    const merge = buildMerge([
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm1')] }),
      linkage({ flowId: 'build', outcome: 'blocked', used: true, inputs: [input(C1, 'm2')] }),
      linkage({ flowId: 'build', outcome: 'complete', used: false }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
    ]);
    expect(aggregateMemoryEffect(merge, GATES).item_effects[0]?.comparison.effect_status).toBe(
      'unresolved',
    );
  });

  it('returns not_enough_data for a used arm of one (the universal early case)', () => {
    const merge = buildMerge([
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm1')] }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
    ]);
    const item = aggregateMemoryEffect(merge, GATES).item_effects[0];
    expect(item?.comparison.used_arm.size).toBe(1);
    expect(item?.comparison.effect_status).toBe('not_enough_data');
  });

  it('emits two item rows for one content item used across two flows', () => {
    const merge = buildMerge([
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm1')] }),
      linkage({ flowId: 'review', outcome: 'complete', used: true, inputs: [input(C1, 'm2')] }),
    ]);
    const effect = aggregateMemoryEffect(merge, GATES);
    const rows = effect.item_effects.filter((i) => i.content_id === C1);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.flow_id).sort()).toEqual(['build', 'review']);
    // each cohort has its own used-arm membership (one run apiece here)
    for (const row of rows) expect(row.comparison.used_arm.size).toBe(1);
  });

  it('keeps two distinct null-content items in separate unresolved cohorts (group_key, not content_id)', () => {
    const merge = buildMerge([
      linkage({
        flowId: 'build',
        outcome: 'complete',
        used: true,
        inputs: [input(null, 'unhashed-1')],
      }),
      linkage({
        flowId: 'build',
        outcome: 'complete',
        used: true,
        inputs: [input(null, 'unhashed-2')],
      }),
    ]);
    const effect = aggregateMemoryEffect(merge, GATES);
    const unresolved = effect.item_effects.filter((i) => i.content_id === null);
    expect(unresolved).toHaveLength(2);
    expect(unresolved.map((i) => i.group_key).sort()).toEqual([
      'unresolved:unhashed-1',
      'unresolved:unhashed-2',
    ]);
    for (const row of unresolved) expect(row.comparison.effect_status).toBe('not_enough_data');
  });

  it('builds per-flow contrasts only for flows with >=1 memory-on run, with the four-status roll-up', () => {
    const merge = buildMerge([
      // flow build: 2 on (complete), 2 off (blocked) -> correlated_positive
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm1')] }),
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm2')] }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
      // flow explore: only memory-off runs -> NO contrast row
      linkage({ flowId: 'explore', outcome: 'complete', used: false }),
      linkage({ flowId: 'explore', outcome: 'complete', used: false }),
    ]);
    const effect = aggregateMemoryEffect(merge, GATES);
    expect(effect.flow_contrasts.map((c) => c.flow_id)).toEqual(['build']);
    const buildContrast = effect.flow_contrasts[0]?.comparison;
    expect(buildContrast?.effect_status).toBe('correlated_positive');
    expect(effect.summary.flow_contrasts_total).toBe(1);
    expect(effect.summary.flow_contrasts_correlated_positive).toBe(1);
  });

  it('exercises all four flow-contrast verdicts and mirrors them in the summary', () => {
    const merge = buildMerge([
      // build: on 2/2 complete vs off 2/2 blocked -> correlated_positive
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'b1')] }),
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'b2')] }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
      // review: on 2/2 blocked vs off 2/2 complete -> correlated_negative
      linkage({ flowId: 'review', outcome: 'blocked', used: true, inputs: [input(C1, 'r1')] }),
      linkage({ flowId: 'review', outcome: 'failed', used: true, inputs: [input(C1, 'r2')] }),
      linkage({ flowId: 'review', outcome: 'complete', used: false }),
      linkage({ flowId: 'review', outcome: 'complete', used: false }),
      // proto: on (1 complete, 1 blocked) vs off (1 complete, 1 blocked) -> unresolved
      linkage({ flowId: 'proto', outcome: 'complete', used: true, inputs: [input(C1, 'p1')] }),
      linkage({ flowId: 'proto', outcome: 'blocked', used: true, inputs: [input(C1, 'p2')] }),
      linkage({ flowId: 'proto', outcome: 'complete', used: false }),
      linkage({ flowId: 'proto', outcome: 'blocked', used: false }),
      // goal: on 1 vs off 1 -> not_enough_data (arms below the floor)
      linkage({ flowId: 'goal', outcome: 'complete', used: true, inputs: [input(C1, 'g1')] }),
      linkage({ flowId: 'goal', outcome: 'blocked', used: false }),
    ]);
    const effect = aggregateMemoryEffect(merge, GATES);
    const byFlow = new Map(
      effect.flow_contrasts.map((c) => [c.flow_id, c.comparison.effect_status]),
    );
    expect(byFlow.get('build')).toBe('correlated_positive');
    expect(byFlow.get('review')).toBe('correlated_negative');
    expect(byFlow.get('proto')).toBe('unresolved');
    expect(byFlow.get('goal')).toBe('not_enough_data');
    // the flow_contrasts_* summary mirrors the filtered flow_contrasts, like the item side
    const contrastStatuses = effect.flow_contrasts.map((c) => c.comparison.effect_status);
    expect(effect.summary.flow_contrasts_total).toBe(effect.flow_contrasts.length);
    expect(effect.summary.flow_contrasts_correlated_positive).toBe(
      contrastStatuses.filter((s) => s === 'correlated_positive').length,
    );
    expect(effect.summary.flow_contrasts_correlated_negative).toBe(
      contrastStatuses.filter((s) => s === 'correlated_negative').length,
    );
    expect(effect.summary.flow_contrasts_unresolved).toBe(
      contrastStatuses.filter((s) => s === 'unresolved').length,
    );
    expect(effect.summary.flow_contrasts_not_enough_data).toBe(
      contrastStatuses.filter((s) => s === 'not_enough_data').length,
    );
  });

  it('rolls the summary up to the filtered item/contrast counts for every status', () => {
    const merge = buildMerge([
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm1')] }),
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm2')] }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
      linkage({ flowId: 'review', outcome: 'complete', used: true, inputs: [input(C2, 'm3')] }),
    ]);
    const effect = aggregateMemoryEffect(merge, GATES);
    const itemStatuses = effect.item_effects.map((i) => i.comparison.effect_status);
    expect(effect.summary.items_total).toBe(effect.item_effects.length);
    expect(effect.summary.items_correlated_positive).toBe(
      itemStatuses.filter((s) => s === 'correlated_positive').length,
    );
    expect(effect.summary.items_not_enough_data).toBe(
      itemStatuses.filter((s) => s === 'not_enough_data').length,
    );
    expect(effect.summary.items_unresolved).toBe(
      itemStatuses.filter((s) => s === 'unresolved').length,
    );
    expect(effect.summary.items_correlated_negative).toBe(
      itemStatuses.filter((s) => s === 'correlated_negative').length,
    );
  });

  it('raising min_arm_size above the arm size flips a verdict to not_enough_data', () => {
    const merge = buildMerge([
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm1')] }),
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm2')] }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
    ]);
    expect(
      aggregateMemoryEffect(merge, { minArmSize: 2, margin: 0.5 }).item_effects[0]?.comparison
        .effect_status,
    ).toBe('correlated_positive');
    expect(
      aggregateMemoryEffect(merge, { minArmSize: 3, margin: 0.5 }).item_effects[0]?.comparison
        .effect_status,
    ).toBe('not_enough_data');
  });

  it('raising the margin above the separation flips a verdict from positive to unresolved', () => {
    // used arm 2/2 complete (rate 1.0); comparable arm 1 complete + 1 blocked
    // (rate 0.5, adverse 0.5): complete_delta = 0.5, adverse_delta = -0.5.
    const merge = buildMerge([
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm1')] }),
      linkage({ flowId: 'build', outcome: 'complete', used: true, inputs: [input(C1, 'm2')] }),
      linkage({ flowId: 'build', outcome: 'complete', used: false }),
      linkage({ flowId: 'build', outcome: 'blocked', used: false }),
    ]);
    // at margin 0.5 the 0.5 separation exactly clears the gate -> correlated_positive
    expect(
      aggregateMemoryEffect(merge, { minArmSize: 2, margin: 0.5 }).item_effects[0]?.comparison
        .effect_status,
    ).toBe('correlated_positive');
    // raising the margin to 0.6 puts the same 0.5 separation within noise -> unresolved
    expect(
      aggregateMemoryEffect(merge, { minArmSize: 2, margin: 0.6 }).item_effects[0]?.comparison
        .effect_status,
    ).toBe('unresolved');
  });
});
