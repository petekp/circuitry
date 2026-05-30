import { combineRubricResult } from '../policy/rubric.js';
import type { RubricJudgment, RubricResult, RubricRuntimeSignal } from '../schemas/rubric.js';
import type { FanoutRubric } from '../schemas/step.js';

export interface FanoutAggregateBranch<ChildOutcome extends string = string> {
  readonly branch_id: string;
  readonly child_run_id: string;
  readonly child_outcome: ChildOutcome;
  readonly verdict: string;
  readonly admitted: boolean;
  readonly result_path: string;
  readonly duration_ms: number;
  readonly result_body?: unknown;
  readonly rubric_result?: RubricResult;
}

export interface FanoutAggregateBody<
  JoinPolicy extends string = string,
  ChildOutcome extends string = string,
> {
  readonly schema_version: 1;
  readonly join_policy: JoinPolicy;
  readonly branch_count: number;
  readonly winner_branch_id?: string;
  readonly branches: ReadonlyArray<FanoutAggregateBranch<ChildOutcome>>;
}

export interface FanoutAggregateOutcome<ChildOutcome extends string = string> {
  readonly branch_id: string;
  readonly child_run_id: string;
  readonly child_outcome: ChildOutcome;
  readonly verdict: string;
  readonly result_path: string;
  readonly result_body?: unknown;
  readonly duration_ms: number;
  readonly admitted: boolean;
}

export function buildFanoutAggregate<
  JoinPolicy extends string,
  Outcome extends FanoutAggregateOutcome,
>(
  policy: JoinPolicy,
  outcomes: readonly Outcome[],
  winnerBranchId: string | undefined,
  rubric?: FanoutRubric,
): FanoutAggregateBody<JoinPolicy, Outcome['child_outcome']> {
  return {
    schema_version: 1,
    join_policy: policy,
    branch_count: outcomes.length,
    ...(winnerBranchId === undefined ? {} : { winner_branch_id: winnerBranchId }),
    branches: outcomes.map((outcome) => ({
      branch_id: outcome.branch_id,
      child_run_id: outcome.child_run_id,
      child_outcome: outcome.child_outcome,
      verdict: outcome.verdict,
      admitted: outcome.admitted,
      result_path: outcome.result_path,
      duration_ms: outcome.duration_ms,
      ...(outcome.result_body === undefined ? {} : { result_body: outcome.result_body }),
      ...rubricResultFields(rubric, outcome.result_body),
    })),
  };
}

function rubricResultFields(
  rubric: FanoutRubric | undefined,
  resultBody: unknown,
): { readonly rubric_result?: RubricResult } {
  if (rubric === undefined || resultBody === undefined) return {};
  return { rubric_result: buildRubricResult(rubric, resultBody) };
}

function buildRubricResult(rubric: FanoutRubric, resultBody: unknown): RubricResult {
  const rawJudgments = readPath(resultBody, rubric.model_judgments_path);
  if (!isRecord(rawJudgments)) {
    throw new Error(
      `fanout rubric model_judgments_path '${rubric.model_judgments_path}' did not resolve to an object`,
    );
  }

  const dims: Record<
    string,
    { readonly runtime_signal: RubricRuntimeSignal; readonly model_judgment: RubricJudgment }
  > = {};
  for (const dimId of rubric.ordered_dims) {
    const judgment = rawJudgments[dimId];
    if (!isRubricJudgment(judgment)) {
      throw new Error(`fanout rubric dim '${dimId}' is missing a valid model judgment`);
    }
    const source = rubric.runtime_signals[dimId];
    if (source === undefined) {
      throw new Error(`fanout rubric dim '${dimId}' is missing a runtime signal source`);
    }
    dims[dimId] = {
      runtime_signal: runtimeSignalForSource(resultBody, source),
      model_judgment: judgment,
    };
  }

  return combineRubricResult({
    dims,
    orderedDims: rubric.ordered_dims,
  });
}

function runtimeSignalForSource(
  resultBody: unknown,
  source: FanoutRubric['runtime_signals'][string],
): RubricRuntimeSignal {
  if (source.kind === 'constant') return source.signal;
  const value = readPath(resultBody, source.path);
  if (source.kind === 'non_empty_array') {
    return Array.isArray(value) && value.length > 0 ? 'met' : 'missing';
  }
  return typeof value === 'string' && value.trim().length > 0 ? 'met' : 'missing';
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, source);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRubricJudgment(value: unknown): value is RubricJudgment {
  return value === 'pass' || value === 'concern' || value === 'fail';
}
