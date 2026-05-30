import {
  HISTORY_AUTHORITY_NOTICE,
  type HistoryMemoryEffectV1,
  type HistoryRecallPrecisionV1 as HistoryRecallPrecision,
  HistoryRecallPrecisionV1,
  type HistoryWarningV1,
  type MemoryInputV0,
  type RecallPrecisionConsultedStatusV1,
  type RecallPrecisionDecisionV1,
  type RecallPrecisionTierV1,
} from '../../schemas/index.js';
import { contentIdentityOf, groupKeyForMemory } from './memory-identity.js';

export interface ApplyEarnedPrecisionInput {
  // Candidate hints in query rank order (from historyMemoryInputPreview).
  readonly candidates: readonly MemoryInputV0[];
  // The flow about to run; the key under which per-(group_key, flow) verdicts are
  // looked up. Undefined disables verdict lookup (every candidate -> no_verdict).
  readonly flowId?: string;
  // Slice 2's verdicts. Undefined is the fail-open case (no measured suppression).
  readonly effect?: HistoryMemoryEffectV1;
  // DEFAULT_RECALL_LIMIT in effect.
  readonly budget: number;
  // Warnings carried from the effect-report loader (e.g. effect_report_unavailable
  // on the fail-open path) so the sidecar records why the gate ran open.
  readonly warnings?: readonly HistoryWarningV1[];
  readonly now?: () => Date;
}

export interface ApplyEarnedPrecisionResult {
  readonly memoryInputs: MemoryInputV0[];
  readonly precision: HistoryRecallPrecision;
}

// Tier rank for ordering the push set: positive first, then neutral, then stale.
// suppressed is excluded from the push set entirely.
const TIER_RANK: Record<Exclude<RecallPrecisionTierV1, 'suppressed'>, number> = {
  positive_fresh: 0,
  neutral_fresh: 1,
  stale: 2,
};

function tierFor(
  consultedStatus: RecallPrecisionConsultedStatusV1,
  staleness: MemoryInputV0['staleness']['status'],
): RecallPrecisionTierV1 {
  // correlated_negative is the only HARD suppress — measured harm, dropped from
  // the push set regardless of freshness. (Still reachable by the Slice 4 pull.)
  if (consultedStatus === 'correlated_negative') return 'suppressed';
  // staleness SINKS a hint rather than hard-suppressing it: a stale-but-positive
  // hint still sits below every fresh hint, but is not dropped (fresh source is a
  // preference, not a gate — only measured harm hard-suppresses).
  if (staleness === 'stale' || staleness === 'unknown') return 'stale';
  if (consultedStatus === 'correlated_positive') return 'positive_fresh';
  return 'neutral_fresh'; // fresh + (not_enough_data | unresolved | no_verdict)
}

function composeIndicator(input: {
  readonly injectedCount: number;
  readonly suppressedCount: number;
  readonly flowId?: string;
  readonly hasMeasuredEffect: boolean;
  readonly effectReportAvailable: boolean;
}): string {
  const flow = input.flowId ?? 'this flow';
  const hintWord = (n: number) => (n === 1 ? 'hint' : 'hints');
  if (input.suppressedCount > 0) {
    return `Memory (hint-only): suppressed ${input.suppressedCount} ${hintWord(input.suppressedCount)} with measured negative effect; ${input.injectedCount} ${hintWord(input.injectedCount)} loaded for flow ${flow}. Sources cited; rerun current checks before relying on them.`;
  }
  if (input.injectedCount === 0) {
    return `Memory (hint-only): no prior-run hints matched flow ${flow}.`;
  }
  if (!input.effectReportAvailable || !input.hasMeasuredEffect) {
    return `Memory (hint-only): ${input.injectedCount} prior-run ${hintWord(input.injectedCount)} loaded for flow ${flow}; earned-precision active but no measured effects yet.`;
  }
  return `Memory (hint-only): ${input.injectedCount} prior-run ${hintWord(input.injectedCount)} loaded for flow ${flow}; earned-precision active.`;
}

// The pure earned-precision gate (Slice 3 D1/D3). Suppresses measured-negative
// hints, sinks stale ones, ranks the rest by measured effect and freshness, and
// fills the budget from the best tier down. Equals a positive-only allow-list
// once the corpus is rich, but degrades to today's behavior during cold-start
// (neutral-but-fresh hints still fill the slots). No I/O. It never mutates the
// candidate array, so the Slice 4 pull path can still reach a suppressed hint.
export function applyEarnedPrecision(input: ApplyEarnedPrecisionInput): ApplyEarnedPrecisionResult {
  const now = input.now ?? (() => new Date());
  const effectReportAvailable = input.effect !== undefined;

  // (group_key, flow_id) -> verdict, from Slice 2's per-item effects.
  const verdicts = new Map<
    string,
    HistoryMemoryEffectV1['item_effects'][number]['comparison']['effect_status']
  >();
  if (input.effect !== undefined) {
    for (const item of input.effect.item_effects) {
      verdicts.set(`${item.group_key} ${item.flow_id}`, item.comparison.effect_status);
    }
  }

  interface Scored {
    readonly candidate: MemoryInputV0;
    readonly decision: Omit<RecallPrecisionDecisionV1, 'injected'>;
    readonly origIndex: number;
  }
  const scored: Scored[] = input.candidates.map((candidate, origIndex) => {
    const { contentId } = contentIdentityOf(candidate);
    const groupKey = groupKeyForMemory(candidate);
    const consultedStatus: RecallPrecisionConsultedStatusV1 =
      input.effect !== undefined && input.flowId !== undefined
        ? (verdicts.get(`${groupKey} ${input.flowId}`) ?? 'no_verdict')
        : 'no_verdict';
    const staleness = candidate.staleness.status;
    return {
      candidate,
      origIndex,
      decision: {
        memory_input_id: candidate.memory_id,
        content_id: contentId,
        staleness,
        consulted_effect_status: consultedStatus,
        tier: tierFor(consultedStatus, staleness),
      },
    };
  });

  // The push set: non-suppressed candidates, ordered by tier then original query
  // rank, take the top `budget`. A stable sort preserves rank order within a tier.
  const pushable = scored
    .filter((entry) => entry.decision.tier !== 'suppressed')
    .sort((left, right) => {
      const byTier =
        TIER_RANK[left.decision.tier as Exclude<RecallPrecisionTierV1, 'suppressed'>] -
        TIER_RANK[right.decision.tier as Exclude<RecallPrecisionTierV1, 'suppressed'>];
      return byTier !== 0 ? byTier : left.origIndex - right.origIndex;
    });
  const injected = pushable.slice(0, Math.max(0, input.budget));
  const injectedIds = new Set(injected.map((entry) => entry.decision.memory_input_id));

  // Decisions in original query order for a readable audit trail.
  const decisions: RecallPrecisionDecisionV1[] = scored.map((entry) => ({
    ...entry.decision,
    injected: injectedIds.has(entry.decision.memory_input_id),
  }));

  const memoryInputs = injected.map((entry) => entry.candidate);
  const suppressedCount = scored.filter((entry) => entry.decision.tier === 'suppressed').length;
  const hasMeasuredEffect = decisions.some(
    (decision) =>
      decision.consulted_effect_status === 'correlated_positive' ||
      decision.consulted_effect_status === 'correlated_negative',
  );

  const precision = HistoryRecallPrecisionV1.parse({
    api_version: 'history-recall-precision-v1',
    schema_version: 1,
    generated_at: now().toISOString(),
    ...(input.flowId === undefined ? {} : { flow_id: input.flowId }),
    effect_report_available: effectReportAvailable,
    ...(input.effect === undefined
      ? {}
      : { effect_report_generated_at: input.effect.generated_at }),
    authority_notice: HISTORY_AUTHORITY_NOTICE,
    budget: input.budget,
    indicator: composeIndicator({
      injectedCount: memoryInputs.length,
      suppressedCount,
      ...(input.flowId === undefined ? {} : { flowId: input.flowId }),
      hasMeasuredEffect,
      effectReportAvailable,
    }),
    decisions,
    warnings: [...(input.warnings ?? [])],
  });

  return { memoryInputs, precision };
}
