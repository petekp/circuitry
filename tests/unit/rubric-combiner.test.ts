import { describe, expect, it } from 'vitest';

import {
  RubricDimResult,
  type RubricJudgment,
  RubricResult,
  type RubricRuntimeSignal,
} from '../../src/index.js';
import {
  RUBRIC_DIM_SCORE_BY_JUDGMENT,
  THREE_AXIS_RUBRIC_TIE_BREAK_ORDER,
  combineRubricDim,
  combineRubricResult,
  rankRubricCandidates,
} from '../../src/policy/rubric.js';

const SHORT_TIE_BREAK_ORDER = ['evidence_rigor', 'actionability', 'coverage_adequacy'] as const;

describe('RubricDimResult schema and combiner', () => {
  it.each([
    {
      runtime_signal: 'met',
      model_judgment: 'pass',
      final_score: 'pass',
      dim_score: 1,
      runtime_vetoed: false,
    },
    {
      runtime_signal: 'met',
      model_judgment: 'concern',
      final_score: 'concern',
      dim_score: 0.5,
      runtime_vetoed: false,
    },
    {
      runtime_signal: 'met',
      model_judgment: 'fail',
      final_score: 'fail',
      dim_score: 0,
      runtime_vetoed: false,
    },
    {
      runtime_signal: 'missing',
      model_judgment: 'pass',
      final_score: 'fail',
      dim_score: 0,
      runtime_vetoed: true,
    },
    {
      runtime_signal: 'n/a',
      model_judgment: 'pass',
      final_score: 'pass',
      dim_score: 1,
      runtime_vetoed: false,
    },
  ] as const)(
    'combines $runtime_signal + $model_judgment into $final_score/$dim_score',
    (expected) => {
      expect(
        combineRubricDim({
          runtime_signal: expected.runtime_signal,
          model_judgment: expected.model_judgment,
        }),
      ).toEqual(expected);
    },
  );

  it('keeps concern at the v1 midpoint score', () => {
    expect(RUBRIC_DIM_SCORE_BY_JUDGMENT.concern).toBe(0.5);
  });

  it('rejects a missing runtime signal that does not veto the model judgment', () => {
    const result = RubricDimResult.safeParse({
      runtime_signal: 'missing',
      model_judgment: 'pass',
      final_score: 'pass',
      dim_score: 1,
      runtime_vetoed: false,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['final_score', 'dim_score', 'runtime_vetoed']),
    );
  });

  it.each([
    ['met', 'concern', 0.5],
    ['n/a', 'concern', 0.5],
  ] as const)(
    'scores %s + concern as concern without a runtime veto',
    (runtime_signal: RubricRuntimeSignal, model_judgment: RubricJudgment, dim_score: 0.5) => {
      expect(combineRubricDim({ runtime_signal, model_judgment })).toEqual({
        runtime_signal,
        model_judgment,
        final_score: 'concern',
        dim_score,
        runtime_vetoed: false,
      });
    },
  );
});

describe('RubricResult combiner', () => {
  it('uses equal weighting and rounds aggregate_score to three decimals', () => {
    const result = combineRubricResult({
      orderedDims: SHORT_TIE_BREAK_ORDER,
      dims: {
        evidence_rigor: { runtime_signal: 'met', model_judgment: 'pass' },
        actionability: { runtime_signal: 'n/a', model_judgment: 'pass' },
        coverage_adequacy: { runtime_signal: 'met', model_judgment: 'fail' },
      },
    });

    expect(result.aggregate_score).toBe(0.667);
    expect(result.runtime_veto_count).toBe(0);
    expect(result.tie_break).toEqual({
      ordered_dims: [...SHORT_TIE_BREAK_ORDER],
      final_reason: 'not-ranked',
    });
  });

  it('counts runtime vetoes separately from model fail scores', () => {
    const result = combineRubricResult({
      orderedDims: SHORT_TIE_BREAK_ORDER,
      dims: {
        evidence_rigor: { runtime_signal: 'missing', model_judgment: 'pass' },
        actionability: { runtime_signal: 'met', model_judgment: 'pass' },
        coverage_adequacy: { runtime_signal: 'n/a', model_judgment: 'fail' },
      },
    });

    expect(result.aggregate_score).toBe(0.333);
    expect(result.runtime_veto_count).toBe(1);
    expect(result.dims.evidence_rigor).toMatchObject({
      final_score: 'fail',
      dim_score: 0,
      runtime_vetoed: true,
    });
    expect(result.dims.coverage_adequacy).toMatchObject({
      final_score: 'fail',
      dim_score: 0,
      runtime_vetoed: false,
    });
  });

  it('rejects aggregate scores that do not match the equal-weight dim mean', () => {
    const result = RubricResult.safeParse({
      dims: {
        evidence_rigor: combineRubricDim({ runtime_signal: 'met', model_judgment: 'pass' }),
        actionability: combineRubricDim({ runtime_signal: 'met', model_judgment: 'fail' }),
      },
      aggregate_score: 1,
      runtime_veto_count: 0,
      tie_break: {
        ordered_dims: ['evidence_rigor', 'actionability'],
        final_reason: 'not-ranked',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('aggregate_score');
  });

  it('rejects tie-break dimensions that are not present in dims', () => {
    const result = RubricResult.safeParse({
      dims: {
        evidence_rigor: combineRubricDim({ runtime_signal: 'met', model_judgment: 'pass' }),
      },
      aggregate_score: 1,
      runtime_veto_count: 0,
      tie_break: {
        ordered_dims: ['evidence_rigor', 'missing_dim'],
        final_reason: 'not-ranked',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
      'tie_break.ordered_dims.1',
    );
  });
});

describe('rankRubricCandidates', () => {
  it('preserves the current Section 9 tie-break order', () => {
    expect(THREE_AXIS_RUBRIC_TIE_BREAK_ORDER).toEqual([
      'evidence_rigor',
      'actionability',
      'coverage_adequacy',
      'scope_discipline',
      'honest_calibration',
      'project_specificity',
      'insight_density',
      'branch_distinctness',
    ]);
  });

  it('sorts by aggregate score first', () => {
    const lower = candidate('option-1', 1, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'fail' },
      actionability: { runtime_signal: 'met', model_judgment: 'pass' },
    });
    const higher = candidate('option-2', 2, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'pass' },
      actionability: { runtime_signal: 'met', model_judgment: 'pass' },
    });

    const ranking = rankRubricCandidates([lower, higher], ['evidence_rigor', 'actionability']);

    expect(ranking.winner.id).toBe('option-2');
    expect(ranking.margin).toBe(0.5);
    expect(ranking.tie_break.final_reason).toBe('aggregate_score');
  });

  it('uses fewer runtime vetoes before per-dim tie-breaks', () => {
    const vetoed = candidate('option-1', 1, {
      evidence_rigor: { runtime_signal: 'missing', model_judgment: 'pass' },
      actionability: { runtime_signal: 'met', model_judgment: 'pass' },
      coverage_adequacy: { runtime_signal: 'met', model_judgment: 'pass' },
    });
    const modelFail = candidate('option-2', 2, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'fail' },
      actionability: { runtime_signal: 'met', model_judgment: 'pass' },
      coverage_adequacy: { runtime_signal: 'met', model_judgment: 'pass' },
    });

    const ranking = rankRubricCandidates([vetoed, modelFail], SHORT_TIE_BREAK_ORDER);

    expect(ranking.winner.id).toBe('option-2');
    expect(ranking.tie_break.final_reason).toBe('runtime_veto_count');
  });

  it('uses the fixed dim order when aggregate and veto counts tie', () => {
    const actionable = candidate('option-1', 1, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'concern' },
      actionability: { runtime_signal: 'met', model_judgment: 'pass' },
    });
    const evidenced = candidate('option-2', 2, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'pass' },
      actionability: { runtime_signal: 'met', model_judgment: 'concern' },
    });

    const ranking = rankRubricCandidates(
      [actionable, evidenced],
      ['evidence_rigor', 'actionability'],
    );

    expect(ranking.winner.id).toBe('option-2');
    expect(ranking.tie_break.final_reason).toBe('dim_score:evidence_rigor');
  });

  it('falls back to the lowest original strand ordinal', () => {
    const first = candidate('option-1', 1, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'pass' },
      actionability: { runtime_signal: 'n/a', model_judgment: 'concern' },
    });
    const second = candidate('option-2', 2, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'pass' },
      actionability: { runtime_signal: 'n/a', model_judgment: 'concern' },
    });

    const ranking = rankRubricCandidates([second, first], ['evidence_rigor', 'actionability']);

    expect(ranking.winner.id).toBe('option-1');
    expect(ranking.tie_break.final_reason).toBe('original_ordinal');
  });

  it('rejects duplicate candidate ids before ranking', () => {
    const first = candidate('option-1', 1, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'pass' },
      actionability: { runtime_signal: 'n/a', model_judgment: 'concern' },
    });
    const duplicateId = candidate('option-1', 2, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'pass' },
      actionability: { runtime_signal: 'n/a', model_judgment: 'concern' },
    });

    expect(() =>
      rankRubricCandidates([first, duplicateId], ['evidence_rigor', 'actionability']),
    ).toThrow("duplicate rubric candidate id 'option-1'");
  });

  it('rejects duplicate original ordinals before ranking', () => {
    const first = candidate('option-1', 1, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'pass' },
      actionability: { runtime_signal: 'n/a', model_judgment: 'concern' },
    });
    const duplicateOrdinal = candidate('option-2', 1, {
      evidence_rigor: { runtime_signal: 'met', model_judgment: 'pass' },
      actionability: { runtime_signal: 'n/a', model_judgment: 'concern' },
    });

    expect(() =>
      rankRubricCandidates([first, duplicateOrdinal], ['evidence_rigor', 'actionability']),
    ).toThrow('duplicate original_ordinal 1');
  });
});

function candidate(
  id: string,
  original_ordinal: number,
  dims: Readonly<
    Record<string, { runtime_signal: RubricRuntimeSignal; model_judgment: RubricJudgment }>
  >,
) {
  return {
    id,
    original_ordinal,
    result: combineRubricResult({ dims, orderedDims: Object.keys(dims) }),
  };
}
