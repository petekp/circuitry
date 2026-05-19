import {
  RubricDimResult,
  type RubricDimScore,
  type RubricJudgment,
  RubricResult,
  type RubricRuntimeSignal,
  RubricTieBreak,
} from '../schemas/rubric.js';

export const RUBRIC_DIM_SCORE_BY_JUDGMENT = {
  pass: 1,
  concern: 0.5,
  fail: 0,
} as const satisfies Record<RubricJudgment, RubricDimScore>;

export const THREE_AXIS_RUBRIC_TIE_BREAK_ORDER = [
  'evidence_rigor',
  'actionability',
  'coverage_adequacy',
  'scope_discipline',
  'honest_calibration',
  'project_specificity',
  'insight_density',
  'branch_distinctness',
] as const;

export interface RubricDimInput {
  readonly runtime_signal: RubricRuntimeSignal;
  readonly model_judgment: RubricJudgment;
}

export interface RubricResultInput {
  readonly dims: Readonly<Record<string, RubricDimInput>>;
  readonly orderedDims?: readonly string[];
  readonly finalReason?: string;
}

export interface RubricCandidate {
  readonly id: string;
  readonly original_ordinal: number;
  readonly result: RubricResult;
}

export interface RubricRanking<T extends RubricCandidate> {
  readonly winner: T;
  readonly runner_up?: T;
  readonly ranked: readonly T[];
  readonly margin: number | null;
  readonly tie_break: RubricTieBreak;
}

export function combineRubricDim(input: RubricDimInput): RubricDimResult {
  const finalScore = input.runtime_signal === 'missing' ? 'fail' : input.model_judgment;
  return RubricDimResult.parse({
    runtime_signal: input.runtime_signal,
    model_judgment: input.model_judgment,
    final_score: finalScore,
    dim_score: RUBRIC_DIM_SCORE_BY_JUDGMENT[finalScore],
    runtime_vetoed: input.runtime_signal === 'missing',
  });
}

export function combineRubricResult(input: RubricResultInput): RubricResult {
  const dims: Record<string, RubricDimResult> = {};
  for (const [dimId, dim] of Object.entries(input.dims)) {
    dims[dimId] = combineRubricDim(dim);
  }

  const dimIds = Object.keys(dims);
  if (dimIds.length === 0) {
    throw new Error('combineRubricResult requires at least one dim');
  }

  const aggregateScore = roundedRubricScore(
    Object.values(dims).reduce((sum, dim) => sum + dim.dim_score, 0) / dimIds.length,
  );
  const runtimeVetoCount = Object.values(dims).filter((dim) => dim.runtime_vetoed).length;

  return RubricResult.parse({
    dims,
    aggregate_score: aggregateScore,
    runtime_veto_count: runtimeVetoCount,
    tie_break: {
      ordered_dims: [...(input.orderedDims ?? dimIds)],
      final_reason: input.finalReason ?? 'not-ranked',
    },
  });
}

export function rankRubricCandidates<T extends RubricCandidate>(
  candidates: readonly T[],
  orderedDims: readonly string[] = THREE_AXIS_RUBRIC_TIE_BREAK_ORDER,
): RubricRanking<T> {
  if (candidates.length === 0) {
    throw new Error('rankRubricCandidates requires at least one candidate');
  }
  if (orderedDims.length === 0) {
    throw new Error('rankRubricCandidates requires at least one tie-break dim');
  }
  const seenDims = new Set<string>();
  for (const dimId of orderedDims) {
    if (seenDims.has(dimId)) {
      throw new Error(`rankRubricCandidates received duplicate tie-break dim '${dimId}'`);
    }
    seenDims.add(dimId);
  }
  const seenCandidateIds = new Set<string>();
  const seenOriginalOrdinals = new Set<number>();
  for (const candidate of candidates) {
    if (seenCandidateIds.has(candidate.id)) {
      throw new Error(`duplicate rubric candidate id '${candidate.id}'`);
    }
    seenCandidateIds.add(candidate.id);
    if (!Number.isInteger(candidate.original_ordinal) || candidate.original_ordinal < 1) {
      throw new Error(`candidate '${candidate.id}' must have a positive original_ordinal`);
    }
    if (seenOriginalOrdinals.has(candidate.original_ordinal)) {
      throw new Error(`duplicate original_ordinal ${candidate.original_ordinal}`);
    }
    seenOriginalOrdinals.add(candidate.original_ordinal);
    for (const dimId of orderedDims) {
      if (candidate.result.dims[dimId] === undefined) {
        throw new Error(`candidate '${candidate.id}' is missing tie-break dim '${dimId}'`);
      }
    }
  }

  const ranked = [...candidates].sort((a, b) => compareRubricCandidates(a, b, orderedDims));
  const winner = ranked[0];
  if (winner === undefined) {
    throw new Error('rankRubricCandidates received no candidates');
  }
  const runnerUp = ranked[1];
  const finalReason =
    runnerUp === undefined ? 'single_candidate' : tieBreakReason(winner, runnerUp, orderedDims);

  return {
    winner,
    ...(runnerUp === undefined ? {} : { runner_up: runnerUp }),
    ranked,
    margin:
      runnerUp === undefined
        ? null
        : roundedRubricScore(winner.result.aggregate_score - runnerUp.result.aggregate_score),
    tie_break: RubricTieBreak.parse({
      ordered_dims: [...orderedDims],
      final_reason: finalReason,
    }),
  };
}

function compareRubricCandidates(
  a: RubricCandidate,
  b: RubricCandidate,
  orderedDims: readonly string[],
): number {
  if (a.result.aggregate_score !== b.result.aggregate_score) {
    return b.result.aggregate_score - a.result.aggregate_score;
  }
  if (a.result.runtime_veto_count !== b.result.runtime_veto_count) {
    return a.result.runtime_veto_count - b.result.runtime_veto_count;
  }
  for (const dimId of orderedDims) {
    const aDim = a.result.dims[dimId];
    const bDim = b.result.dims[dimId];
    if (aDim === undefined || bDim === undefined) {
      throw new Error(`missing tie-break dim '${dimId}'`);
    }
    if (aDim.dim_score !== bDim.dim_score) {
      return bDim.dim_score - aDim.dim_score;
    }
  }
  return a.original_ordinal - b.original_ordinal;
}

function tieBreakReason(
  winner: RubricCandidate,
  runnerUp: RubricCandidate,
  orderedDims: readonly string[],
): string {
  if (winner.result.aggregate_score !== runnerUp.result.aggregate_score) {
    return 'aggregate_score';
  }
  if (winner.result.runtime_veto_count !== runnerUp.result.runtime_veto_count) {
    return 'runtime_veto_count';
  }
  for (const dimId of orderedDims) {
    const winnerDim = winner.result.dims[dimId];
    const runnerUpDim = runnerUp.result.dims[dimId];
    if (winnerDim === undefined || runnerUpDim === undefined) {
      throw new Error(`missing tie-break dim '${dimId}'`);
    }
    if (winnerDim.dim_score !== runnerUpDim.dim_score) {
      return `dim_score:${dimId}`;
    }
  }
  return 'original_ordinal';
}

function roundedRubricScore(value: number): number {
  return Number(value.toFixed(3));
}
