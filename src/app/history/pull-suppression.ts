import {
  type HistoryMemoryEffectV1,
  type HistoryMemoryInputPreviewV1 as HistoryMemoryInputPreview,
  HistoryMemoryInputPreviewV1,
} from '../../schemas/index.js';
import { groupKeyForMemory } from './memory-identity.js';

export interface SuppressMeasuredNegativeInput {
  // The already-projected preview (the result of historyMemoryInputPreview),
  // exactly as the pull would otherwise print it.
  readonly preview: HistoryMemoryInputPreview;
  // The flow the pull was scoped to; the key under which per-(group_key, flow)
  // verdicts are looked up (D3). The pull requires --flow, so this is always set.
  readonly flowId: string;
  // Slice 2's verdicts. Undefined is the fail-open case (a missing/stale effect
  // report suppresses nothing — same posture as Slice 3, D2).
  readonly effect?: HistoryMemoryEffectV1;
}

export interface SuppressMeasuredNegativeResult {
  readonly preview: HistoryMemoryInputPreview;
  readonly suppressedCount: number;
}

// The pure pull-suppression seam (Slice 4 D3), mirroring Slice 3's pure gate. It
// drops every memory input whose (group_key, flow) verdict is correlated_negative
// — the only measured-harm state — AND its parallel matches[] entry (same
// memory_id), so the printed preview stays internally consistent (the preview
// schema has no length-binding refine; this is the seam that keeps it consistent).
// Unlike the push gate it applies NO budget or tier ordering: the agent asked an
// explicit question at a decision point, so the pull surfaces everything that
// matches except measured harm (D3). The key is formed exactly as Slice 3's, via
// groupKeyForMemory, so a hint suppressed by the push path is suppressed by the
// pull path too. No I/O; it never mutates the input preview.
export function suppressMeasuredNegative(
  input: SuppressMeasuredNegativeInput,
): SuppressMeasuredNegativeResult {
  // (group_key, flow_id) -> verdict, from Slice 2's per-item effects. Cold corpus
  // (no effect report, or no rows) leaves this empty, so nothing is suppressed.
  const verdicts = new Map<
    string,
    HistoryMemoryEffectV1['item_effects'][number]['comparison']['effect_status']
  >();
  if (input.effect !== undefined) {
    for (const item of input.effect.item_effects) {
      verdicts.set(`${item.group_key} ${item.flow_id}`, item.comparison.effect_status);
    }
  }

  const isMeasuredNegative = (
    memory: HistoryMemoryInputPreview['memory_inputs'][number],
  ): boolean =>
    verdicts.get(`${groupKeyForMemory(memory)} ${input.flowId}`) === 'correlated_negative';

  // The ids dropped from memory_inputs; the parallel matches[] entries with the
  // same id are dropped in lockstep so the preview stays consistent.
  const suppressedIds = new Set(
    input.preview.memory_inputs.filter(isMeasuredNegative).map((memory) => memory.memory_id),
  );
  if (suppressedIds.size === 0) {
    return { preview: input.preview, suppressedCount: 0 };
  }

  const memoryInputs = input.preview.memory_inputs.filter(
    (memory) => !suppressedIds.has(memory.memory_id),
  );
  const matches = input.preview.matches.filter((match) => !suppressedIds.has(match.memory_id));

  // Re-validate the trimmed preview so a malformed projection cannot slip through
  // the suppression seam (the Slice 1/2/3 parse-the-result discipline).
  const preview = HistoryMemoryInputPreviewV1.parse({
    ...input.preview,
    memory_inputs: memoryInputs,
    matches,
  });
  return { preview, suppressedCount: suppressedIds.size };
}
