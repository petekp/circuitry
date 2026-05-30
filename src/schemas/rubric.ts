import { z } from 'zod';

export const RubricRuntimeSignal = z.enum(['met', 'missing', 'n/a']);
export type RubricRuntimeSignal = z.infer<typeof RubricRuntimeSignal>;

export const RubricJudgment = z.enum(['pass', 'concern', 'fail']);
export type RubricJudgment = z.infer<typeof RubricJudgment>;

export const RubricDimScore = z.union([z.literal(1), z.literal(0.5), z.literal(0)]);
export type RubricDimScore = z.infer<typeof RubricDimScore>;

// CSR-4 — canonical rubric scoring formula. This module is the leaf that
// both the validator (the RubricResult/RubricDimResult superRefines below)
// and the producer (src/shared/rubric.ts combineRubricResult) reuse, so the
// score a producer writes is computed by the exact same code the validator
// re-checks. shared/rubric.ts already imports this module; the reverse import
// would be a cycle, so the formula lives here rather than in shared.
export const RUBRIC_DIM_SCORE_BY_JUDGMENT: Record<RubricJudgment, RubricDimScore> = {
  pass: 1,
  concern: 0.5,
  fail: 0,
};

/** Round a rubric score to the v1 three-decimal precision. */
export function roundRubricScore(value: number): number {
  return Number(value.toFixed(3));
}

/** Equal-weight rounded mean of the per-dim scores. */
export function aggregateRubricScore(scores: readonly RubricDimScore[]): number {
  const total = scores.reduce<number>((sum, score) => sum + score, 0);
  return roundRubricScore(total / scores.length);
}

export const RubricDimResult = z
  .object({
    runtime_signal: RubricRuntimeSignal,
    model_judgment: RubricJudgment,
    final_score: RubricJudgment,
    dim_score: RubricDimScore,
    runtime_vetoed: z.boolean(),
  })
  .strict()
  .superRefine((dim, ctx) => {
    const expectedFinalScore: RubricJudgment =
      dim.runtime_signal === 'missing' ? 'fail' : dim.model_judgment;
    const expectedDimScore = RUBRIC_DIM_SCORE_BY_JUDGMENT[expectedFinalScore];
    const expectedRuntimeVetoed = dim.runtime_signal === 'missing';

    if (dim.final_score !== expectedFinalScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['final_score'],
        message:
          dim.runtime_signal === 'missing'
            ? 'missing runtime evidence must force final_score to fail'
            : 'final_score must match model_judgment when runtime_signal is met or n/a',
      });
    }
    if (dim.dim_score !== expectedDimScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dim_score'],
        message: `dim_score must be ${expectedDimScore} for final_score '${expectedFinalScore}'`,
      });
    }
    if (dim.runtime_vetoed !== expectedRuntimeVetoed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['runtime_vetoed'],
        message: `runtime_vetoed must be ${String(expectedRuntimeVetoed)} when runtime_signal is '${dim.runtime_signal}'`,
      });
    }
  });
export type RubricDimResult = z.infer<typeof RubricDimResult>;

export const RubricTieBreak = z
  .object({
    ordered_dims: z.array(z.string().min(1)).min(1),
    final_reason: z.string().min(1),
  })
  .strict()
  .superRefine((tieBreak, ctx) => {
    const seen = new Set<string>();
    for (const [index, dimId] of tieBreak.ordered_dims.entries()) {
      if (seen.has(dimId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ordered_dims', index],
          message: `duplicate tie-break dim '${dimId}'`,
        });
      }
      seen.add(dimId);
    }
  });
export type RubricTieBreak = z.infer<typeof RubricTieBreak>;

export const RubricResult = z
  .object({
    dims: z.record(z.string().min(1), RubricDimResult),
    aggregate_score: z.number().min(0).max(1),
    runtime_veto_count: z.number().int().nonnegative(),
    tie_break: RubricTieBreak,
  })
  .strict()
  .superRefine((result, ctx) => {
    const dims = Object.entries(result.dims);
    if (dims.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dims'],
        message: 'rubric result must include at least one dim',
      });
      return;
    }

    const expectedAggregate = aggregateRubricScore(dims.map(([, dim]) => dim.dim_score));
    if (result.aggregate_score !== expectedAggregate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aggregate_score'],
        message: `aggregate_score must be the equal-weight rounded mean (${expectedAggregate})`,
      });
    }

    const expectedRuntimeVetoCount = dims.filter(([, dim]) => dim.runtime_vetoed).length;
    if (result.runtime_veto_count !== expectedRuntimeVetoCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['runtime_veto_count'],
        message: `runtime_veto_count must be ${expectedRuntimeVetoCount}`,
      });
    }

    for (const [index, dimId] of result.tie_break.ordered_dims.entries()) {
      if (result.dims[dimId] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tie_break', 'ordered_dims', index],
          message: `tie-break dim '${dimId}' must exist in dims`,
        });
      }
    }
  });
export type RubricResult = z.infer<typeof RubricResult>;
