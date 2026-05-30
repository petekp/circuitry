import { describe, expect, it } from 'vitest';
import { contentIdentityOf } from '../../src/app/history/memory-identity.js';
import { applyEarnedPrecision } from '../../src/app/history/recall-precision.js';
import {
  HISTORY_AUTHORITY_NOTICE,
  HistoryMemoryEffectV1 as HistoryMemoryEffectSchema,
  type HistoryMemoryEffectV1,
  MemoryInputV0 as MemoryInputSchema,
  type MemoryInputV0,
  type MemoryMergeEffectStatusV1,
} from '../../src/index.js';

const RUN = '00000000-0000-4000-8000-00000000a001';
const FLOW = 'build';

// A content-addressed candidate: a distinct sha yields a distinct content_id.
function candidate(args: {
  id: string;
  sha: string;
  staleness?: 'fresh' | 'stale' | 'unknown';
}): MemoryInputV0 {
  const status = args.staleness ?? 'fresh';
  const reason =
    status === 'stale' ? ['memory_stale'] : status === 'unknown' ? ['memory_unverified'] : ['ok'];
  return MemoryInputSchema.parse({
    schema_version: 1,
    memory_id: args.id,
    kind: 'prior_run',
    source: {
      ref: {
        kind: 'report',
        ref: 'reports/result.json',
        sha256: args.sha,
        run_id: RUN,
        flow_id: FLOW,
      },
      captured_at: '2026-05-20T00:00:00.000Z',
      sha256: args.sha,
    },
    summary: 'prior-run hint',
    hints: [{ id: 'hint-1', text: 'context', applies_to: 'context' }],
    staleness: { status, checked_at: '2026-05-20T00:00:00.000Z', reason_codes: reason },
    authority: 'hint_only',
  });
}

// A candidate with no content hash -> content_id null -> group_key unresolved:<id>.
function nullCandidate(args: {
  id: string;
  staleness?: 'fresh' | 'stale' | 'unknown';
}): MemoryInputV0 {
  const status = args.staleness ?? 'fresh';
  const reason =
    status === 'stale' ? ['memory_stale'] : status === 'unknown' ? ['memory_unverified'] : ['ok'];
  return MemoryInputSchema.parse({
    schema_version: 1,
    memory_id: args.id,
    kind: 'prior_run',
    source: {
      ref: { kind: 'trace', ref: 'trace.ndjson#sequence=5', run_id: RUN, sequence: 5 },
      captured_at: '2026-05-20T00:00:00.000Z',
    },
    summary: 'prior-trace hint',
    hints: [{ id: 'hint-1', text: 'context', applies_to: 'context' }],
    staleness: { status, checked_at: '2026-05-20T00:00:00.000Z', reason_codes: reason },
    authority: 'hint_only',
  });
}

const emptyArm = {
  run_ids: [],
  size: 0,
  complete_count: 0,
  adverse_count: 0,
  neutral_count: 0,
  outcome_counts: [],
  complete_rate: 0,
  adverse_rate: 0,
};

// A minimal effect report carrying one item_effects row per (group_key, flow, status).
function effectReport(
  rows: { group_key: string; flow_id: string; status: MemoryMergeEffectStatusV1 }[],
): HistoryMemoryEffectV1 {
  const item_effects = rows.map((row) => ({
    content_id: row.group_key.startsWith('unresolved:') ? null : row.group_key,
    group_key: row.group_key,
    flow_id: row.flow_id,
    comparison: {
      used_arm: emptyArm,
      comparable_arm: emptyArm,
      complete_rate_delta: 0,
      adverse_rate_delta: 0,
      effect_status: row.status,
      effect_note: 'fixture',
    },
  }));
  const count = (status: MemoryMergeEffectStatusV1) =>
    item_effects.filter((item) => item.comparison.effect_status === status).length;
  return HistoryMemoryEffectSchema.parse({
    api_version: 'history-memory-effect-v1',
    schema_version: 1,
    generated_at: '2026-05-29T00:00:00.000Z',
    runs_base: '/repo/.circuit/runs',
    authority_notice: HISTORY_AUTHORITY_NOTICE,
    min_arm_size: 2,
    margin: 0.5,
    source_run_count: 0,
    source_envelope_count: 0,
    source_memory_run_count: 0,
    item_effects,
    flow_contrasts: [],
    summary: {
      items_total: item_effects.length,
      items_not_enough_data: count('not_enough_data'),
      items_unresolved: count('unresolved'),
      items_correlated_positive: count('correlated_positive'),
      items_correlated_negative: count('correlated_negative'),
      flow_contrasts_total: 0,
      flow_contrasts_not_enough_data: 0,
      flow_contrasts_unresolved: 0,
      flow_contrasts_correlated_positive: 0,
      flow_contrasts_correlated_negative: 0,
    },
    warnings: [],
  });
}

const groupKey = (m: MemoryInputV0) =>
  contentIdentityOf(m).contentId ?? `unresolved:${m.memory_id}`;

describe('applyEarnedPrecision (the pure gate)', () => {
  it('cold corpus (no effect report): no suppression, original order, fail-open warning surfaced', () => {
    const a = candidate({ id: 'cand-a', sha: 'a'.repeat(64) });
    const b = candidate({ id: 'cand-b', sha: 'b'.repeat(64) });
    const { memoryInputs, precision } = applyEarnedPrecision({
      candidates: [a, b],
      flowId: FLOW,
      budget: 3,
      warnings: [{ code: 'effect_report_unavailable', message: 'none' }],
      now: () => new Date('2026-05-29T00:00:00.000Z'),
    });
    expect(memoryInputs.map((m) => m.memory_id)).toEqual(['cand-a', 'cand-b']);
    // boundary (spec §6): the gate never mutates authority — pushed hints stay hint_only
    expect(memoryInputs.every((m) => m.authority === 'hint_only')).toBe(true);
    expect(precision.effect_report_available).toBe(false);
    expect(precision.warnings.some((w) => w.code === 'effect_report_unavailable')).toBe(true);
    expect(precision.decisions.every((d) => d.consulted_effect_status === 'no_verdict')).toBe(true);
    expect(precision.indicator).toContain('no measured effects yet');
  });

  it('suppresses a correlated_negative hint: absent from push set, present with injected:false', () => {
    const good = candidate({ id: 'cand-good', sha: 'a'.repeat(64) });
    const bad = candidate({ id: 'cand-bad', sha: 'b'.repeat(64) });
    const effect = effectReport([
      { group_key: groupKey(bad), flow_id: FLOW, status: 'correlated_negative' },
    ]);
    const { memoryInputs, precision } = applyEarnedPrecision({
      candidates: [good, bad],
      flowId: FLOW,
      effect,
      budget: 3,
    });
    expect(memoryInputs.map((m) => m.memory_id)).toEqual(['cand-good']);
    const badDecision = precision.decisions.find((d) => d.memory_input_id === 'cand-bad');
    expect(badDecision?.tier).toBe('suppressed');
    expect(badDecision?.injected).toBe(false);
    expect(precision.indicator).toContain('suppressed 1 hint');
  });

  it('ranks a correlated_positive fresh hint above a neutral_fresh one within the budget', () => {
    // neutral first in query order, positive second — the gate must reorder.
    const neutral = candidate({ id: 'cand-neutral', sha: 'a'.repeat(64) });
    const positive = candidate({ id: 'cand-positive', sha: 'b'.repeat(64) });
    const effect = effectReport([
      { group_key: groupKey(positive), flow_id: FLOW, status: 'correlated_positive' },
    ]);
    const { memoryInputs } = applyEarnedPrecision({
      candidates: [neutral, positive],
      flowId: FLOW,
      effect,
      budget: 3,
    });
    expect(memoryInputs.map((m) => m.memory_id)).toEqual(['cand-positive', 'cand-neutral']);
  });

  it('sinks a stale hint below fresh and drops it first when the budget is tight', () => {
    const stale = candidate({ id: 'cand-stale', sha: 'a'.repeat(64), staleness: 'stale' });
    const fresh1 = candidate({ id: 'cand-fresh1', sha: 'b'.repeat(64) });
    const fresh2 = candidate({ id: 'cand-fresh2', sha: 'c'.repeat(64) });
    const { memoryInputs, precision } = applyEarnedPrecision({
      candidates: [stale, fresh1, fresh2],
      flowId: FLOW,
      budget: 2,
    });
    // budget 2: the two fresh hints win; the stale one sinks out.
    expect(memoryInputs.map((m) => m.memory_id)).toEqual(['cand-fresh1', 'cand-fresh2']);
    expect(precision.decisions.find((d) => d.memory_input_id === 'cand-stale')?.tier).toBe('stale');
    expect(precision.decisions.find((d) => d.memory_input_id === 'cand-stale')?.injected).toBe(
      false,
    );
  });

  it('injects a stale hint when it is the only candidate (staleness sinks, never hard-suppresses)', () => {
    const stale = candidate({ id: 'cand-stale', sha: 'a'.repeat(64), staleness: 'stale' });
    const { memoryInputs } = applyEarnedPrecision({
      candidates: [stale],
      flowId: FLOW,
      budget: 3,
    });
    expect(memoryInputs.map((m) => m.memory_id)).toEqual(['cand-stale']);
  });

  it('treats a null-content_id candidate as no_verdict (tiered by its staleness)', () => {
    const nul = nullCandidate({ id: 'cand-null' });
    const { memoryInputs, precision } = applyEarnedPrecision({
      candidates: [nul],
      flowId: FLOW,
      effect: effectReport([]),
      budget: 3,
    });
    expect(memoryInputs.map((m) => m.memory_id)).toEqual(['cand-null']);
    const decision = precision.decisions[0];
    expect(decision?.content_id).toBeNull();
    expect(decision?.consulted_effect_status).toBe('no_verdict');
    expect(decision?.tier).toBe('neutral_fresh');
  });

  it('suppresses a null-content candidate iff its unresolved group carries correlated_negative', () => {
    const nul = nullCandidate({ id: 'cand-null' });
    const effect = effectReport([
      { group_key: 'unresolved:cand-null', flow_id: FLOW, status: 'correlated_negative' },
    ]);
    const { memoryInputs, precision } = applyEarnedPrecision({
      candidates: [nul],
      flowId: FLOW,
      effect,
      budget: 3,
    });
    expect(memoryInputs).toHaveLength(0);
    expect(precision.decisions[0]?.tier).toBe('suppressed');
  });

  it('never injects more than the budget and records the budget + provenance', () => {
    const cands = ['a', 'b', 'c', 'd'].map((c) =>
      candidate({ id: `cand-${c}`, sha: c.repeat(64) }),
    );
    const effect = effectReport([]);
    const { memoryInputs, precision } = applyEarnedPrecision({
      candidates: cands,
      flowId: FLOW,
      effect,
      budget: 3,
    });
    expect(memoryInputs).toHaveLength(3);
    expect(precision.budget).toBe(3);
    expect(precision.effect_report_available).toBe(true);
    expect(precision.effect_report_generated_at).toBe(effect.generated_at);
    expect(precision.decisions.filter((d) => d.injected)).toHaveLength(3);
  });
});
