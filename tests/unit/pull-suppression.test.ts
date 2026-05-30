import { describe, expect, it } from 'vitest';
import { groupKeyForMemory } from '../../src/app/history/memory-identity.js';
import { suppressMeasuredNegative } from '../../src/app/history/pull-suppression.js';
import {
  HISTORY_AUTHORITY_NOTICE,
  HistoryMemoryEffectV1 as HistoryMemoryEffectSchema,
  type HistoryMemoryEffectV1,
  type HistoryMemoryInputPreviewV1 as HistoryMemoryInputPreview,
  HistoryMemoryInputPreviewV1,
  MemoryInputV0 as MemoryInputSchema,
  type MemoryInputV0,
  type MemoryMergeEffectStatusV1,
} from '../../src/index.js';

const RUN = '00000000-0000-4000-8000-00000000a001';
const FLOW = 'build';

// A content-addressed candidate: a distinct sha yields a distinct content_id.
function candidate(args: { id: string; sha: string }): MemoryInputV0 {
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
    staleness: { status: 'fresh', checked_at: '2026-05-20T00:00:00.000Z', reason_codes: ['ok'] },
    authority: 'hint_only',
  });
}

// A candidate with no content hash -> content_id null -> group_key unresolved:<id>.
function nullCandidate(args: { id: string }): MemoryInputV0 {
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
    staleness: { status: 'fresh', checked_at: '2026-05-20T00:00:00.000Z', reason_codes: ['ok'] },
    authority: 'hint_only',
  });
}

// Build a preview whose memory_inputs and matches run parallel (one match per input,
// same memory_id) — the invariant suppression must preserve.
function preview(memoryInputs: MemoryInputV0[]): HistoryMemoryInputPreview {
  return HistoryMemoryInputPreviewV1.parse({
    api_version: 'history-memory-input-preview-v1',
    schema_version: 1,
    query: 'auth guard',
    format: 'memory-input',
    index_state: 'fresh',
    rebuilt: false,
    authority_notice: HISTORY_AUTHORITY_NOTICE,
    warnings: [],
    memory_inputs: memoryInputs,
    matches: memoryInputs.map((memory, index) => ({
      memory_id: memory.memory_id,
      rank: index + 1,
      score: 1 - index * 0.1,
      source_doc_id: `doc-${memory.memory_id}`,
      source_ref: memory.source.ref,
      snippet: 'snippet',
    })),
  });
}

// A minimal effect report carrying one item_effects row per (group_key, flow, status).
function effectReport(
  rows: { group_key: string; flow_id: string; status: MemoryMergeEffectStatusV1 }[],
): HistoryMemoryEffectV1 {
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

// The invariant the preview schema does not pin (no length-binding refine): every
// surviving match must still have a memory_inputs entry of the same id.
function assertConsistent(result: HistoryMemoryInputPreview): void {
  const ids = new Set(result.memory_inputs.map((m) => m.memory_id));
  for (const match of result.matches) {
    expect(ids.has(match.memory_id)).toBe(true);
  }
}

describe('suppressMeasuredNegative (the pure pull-suppression seam)', () => {
  it('passing no effect report suppresses nothing', () => {
    const a = candidate({ id: 'cand-a', sha: 'a'.repeat(64) });
    const b = candidate({ id: 'cand-b', sha: 'b'.repeat(64) });
    const { preview: out, suppressedCount } = suppressMeasuredNegative({
      preview: preview([a, b]),
      flowId: FLOW,
    });
    expect(suppressedCount).toBe(0);
    expect(out.memory_inputs.map((m) => m.memory_id)).toEqual(['cand-a', 'cand-b']);
    expect(out.matches.map((m) => m.memory_id)).toEqual(['cand-a', 'cand-b']);
    assertConsistent(out);
  });

  it('drops a correlated_negative (group_key, flow) result AND its parallel matches[] entry', () => {
    const good = candidate({ id: 'cand-good', sha: 'a'.repeat(64) });
    const bad = candidate({ id: 'cand-bad', sha: 'b'.repeat(64) });
    const effect = effectReport([
      { group_key: groupKeyForMemory(bad), flow_id: FLOW, status: 'correlated_negative' },
    ]);
    const { preview: out, suppressedCount } = suppressMeasuredNegative({
      preview: preview([good, bad]),
      flowId: FLOW,
      effect,
    });
    expect(suppressedCount).toBe(1);
    expect(out.memory_inputs.map((m) => m.memory_id)).toEqual(['cand-good']);
    // The parallel match for the dropped input is gone too.
    expect(out.matches.map((m) => m.memory_id)).toEqual(['cand-good']);
    assertConsistent(out);
  });

  it('does not suppress a correlated_negative verdict keyed on a DIFFERENT flow', () => {
    const bad = candidate({ id: 'cand-bad', sha: 'b'.repeat(64) });
    const effect = effectReport([
      { group_key: groupKeyForMemory(bad), flow_id: 'explore', status: 'correlated_negative' },
    ]);
    const { preview: out, suppressedCount } = suppressMeasuredNegative({
      preview: preview([bad]),
      flowId: FLOW,
      effect,
    });
    expect(suppressedCount).toBe(0);
    expect(out.memory_inputs.map((m) => m.memory_id)).toEqual(['cand-bad']);
    assertConsistent(out);
  });

  it('does not suppress a positive or not-enough-data verdict (only measured harm)', () => {
    const pos = candidate({ id: 'cand-pos', sha: 'a'.repeat(64) });
    const neu = candidate({ id: 'cand-neu', sha: 'b'.repeat(64) });
    const effect = effectReport([
      { group_key: groupKeyForMemory(pos), flow_id: FLOW, status: 'correlated_positive' },
      { group_key: groupKeyForMemory(neu), flow_id: FLOW, status: 'not_enough_data' },
    ]);
    const { preview: out, suppressedCount } = suppressMeasuredNegative({
      preview: preview([pos, neu]),
      flowId: FLOW,
      effect,
    });
    expect(suppressedCount).toBe(0);
    expect(out.memory_inputs.map((m) => m.memory_id)).toEqual(['cand-pos', 'cand-neu']);
  });

  it('suppresses a null-content_id result IFF its unresolved:<memory_id> group is correlated_negative', () => {
    const nul = nullCandidate({ id: 'prior-run-trace-aaaa' });
    // Not suppressed when no verdict exists for the unresolved group.
    const noVerdict = suppressMeasuredNegative({ preview: preview([nul]), flowId: FLOW });
    expect(noVerdict.suppressedCount).toBe(0);
    expect(noVerdict.preview.memory_inputs.map((m) => m.memory_id)).toEqual([
      'prior-run-trace-aaaa',
    ]);

    // Suppressed when the unresolved group carries a correlated_negative verdict
    // (the uniform rule, D3 — null is NOT categorically immune).
    const effect = effectReport([
      { group_key: groupKeyForMemory(nul), flow_id: FLOW, status: 'correlated_negative' },
    ]);
    const suppressed = suppressMeasuredNegative({ preview: preview([nul]), flowId: FLOW, effect });
    expect(suppressed.suppressedCount).toBe(1);
    expect(suppressed.preview.memory_inputs).toEqual([]);
    expect(suppressed.preview.matches).toEqual([]);
    assertConsistent(suppressed.preview);
  });

  it('preserves the preview header (authority notice, query, index state) and is non-mutating', () => {
    const a = candidate({ id: 'cand-a', sha: 'a'.repeat(64) });
    const input = preview([a]);
    const before = JSON.stringify(input);
    const { preview: out } = suppressMeasuredNegative({ preview: input, flowId: FLOW });
    expect(out.authority_notice).toBe(HISTORY_AUTHORITY_NOTICE);
    expect(out.query).toBe('auth guard');
    expect(out.index_state).toBe('fresh');
    // The input preview was not mutated.
    expect(JSON.stringify(input)).toBe(before);
  });
});
