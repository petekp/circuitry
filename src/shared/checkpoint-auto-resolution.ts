import type { OperatorAutoResolution } from '../schemas/operator-summary.js';
import { RubricResult } from '../schemas/rubric.js';
import { resolveDottedPath } from './fanout-branch-template.js';
import { rankRubricCandidates } from './rubric.js';

export interface HighestScoreAutoResolutionInput {
  readonly checkpointId: string;
  readonly checkpointLabel?: string;
  readonly choices: readonly string[];
  readonly resolvedAt: string;
  readonly branches: readonly unknown[];
  readonly idPath: string;
  readonly rubricResultPath: string;
}

export interface HighestScoreAutoResolutionResult {
  readonly selection: string;
  readonly record: OperatorAutoResolution;
}

export function resolveHighestScoreAutoResolution(
  input: HighestScoreAutoResolutionInput,
): HighestScoreAutoResolutionResult {
  const choiceIds = new Set(input.choices);
  if (choiceIds.size !== input.choices.length) {
    throw new Error(`checkpoint '${input.checkpointId}' highest-score choices must be unique`);
  }

  const candidates = input.branches.flatMap((branch, index) => {
    const id = resolveDottedPath(branch, input.idPath);
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(
        `checkpoint '${input.checkpointId}' highest-score branch ${index + 1} is missing id '${input.idPath}'`,
      );
    }
    const rawRubric = resolveDottedPath(branch, input.rubricResultPath);
    if (rawRubric === undefined) return [];
    if (!choiceIds.has(id)) return [];
    return [
      {
        id,
        original_ordinal: index + 1,
        result: RubricResult.parse(rawRubric),
      },
    ];
  });

  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const missingRubricRows = input.choices.filter((choice) => !candidateIds.has(choice));
  if (missingRubricRows.length > 0) {
    throw new Error(
      `checkpoint '${input.checkpointId}' highest-score missing rubric rows for choices: ${missingRubricRows.join(', ')}`,
    );
  }

  const ranking = rankRubricCandidates(candidates);
  const scores = Object.fromEntries(
    ranking.ranked.map((candidate) => [
      candidate.id,
      {
        aggregate_score: candidate.result.aggregate_score,
        runtime_veto_count: candidate.result.runtime_veto_count,
      },
    ]),
  );
  const rubricResults = Object.fromEntries(
    ranking.ranked.map((candidate) => [candidate.id, candidate.result]),
  );

  const record: OperatorAutoResolution = {
    checkpoint_id: input.checkpointId,
    ...(input.checkpointLabel === undefined ? {} : { checkpoint_label: input.checkpointLabel }),
    policy: 'highest-score',
    resolved_value: ranking.winner.id,
    alternatives_available: ranking.ranked
      .filter((candidate) => candidate.id !== ranking.winner.id)
      .map((candidate) => candidate.id),
    scores,
    rubric_results: rubricResults,
    winning_score: ranking.winner.result.aggregate_score,
    ...(ranking.runner_up === undefined
      ? {}
      : { runner_up_score: ranking.runner_up.result.aggregate_score }),
    margin: ranking.margin,
    tie_break: ranking.tie_break.final_reason,
    runtime_veto_effect: runtimeVetoEffect(ranking.ranked),
    runtime_or_model: 'runtime',
    resolved_at: input.resolvedAt,
  };

  return { selection: ranking.winner.id, record };
}

function runtimeVetoEffect(
  candidates: readonly { readonly id: string; readonly result: RubricResult }[],
): string {
  for (const candidate of candidates) {
    for (const [dimId, dim] of Object.entries(candidate.result.dims)) {
      if (!dim.runtime_vetoed) continue;
      return `${candidate.id} ${dimId} runtime_signal=missing forced final_score=fail and dim_score=0`;
    }
  }
  return 'none';
}
