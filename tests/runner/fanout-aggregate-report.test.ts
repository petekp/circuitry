import { describe, expect, it } from 'vitest';

import type { FanoutRubric } from '../../src/schemas/step.js';
import type { FanoutAggregateBody } from '../../src/shared/fanout-aggregate-report.js';
import { buildFanoutAggregate } from '../../src/shared/fanout-aggregate-report.js';

const TEST_RUBRIC = {
  model_judgments_path: 'rubric_model_judgments',
  ordered_dims: ['evidence_rigor', 'actionability', 'coverage_adequacy', 'honest_calibration'],
  runtime_signals: {
    evidence_rigor: { kind: 'non_empty_array', path: 'evidence_refs' },
    actionability: { kind: 'non_empty_string', path: 'next_action' },
    coverage_adequacy: { kind: 'non_empty_string', path: 'case_summary' },
    honest_calibration: { kind: 'constant', signal: 'n/a' },
  },
} as const satisfies FanoutRubric;

describe('fanout aggregate report', () => {
  it('builds the durable aggregate report shape from branch outcomes', () => {
    const aggregate = buildFanoutAggregate(
      'pick-winner',
      [
        {
          branch_id: 'a',
          child_run_id: '11111111-1111-1111-1111-111111111111',
          child_outcome: 'complete',
          verdict: 'accept',
          admitted: true,
          worktree_path: '/tmp/worktree-a',
          result_path: 'reports/branches/a/result.json',
          duration_ms: 12,
          result_body: { verdict: 'accept', summary: 'accepted' },
        },
        {
          branch_id: 'b',
          child_run_id: '22222222-2222-2222-2222-222222222222',
          child_outcome: 'aborted',
          verdict: '<no-verdict>',
          admitted: false,
          worktree_path: '/tmp/worktree-b',
          result_path: 'reports/branches/b/result.json',
          duration_ms: 30,
        },
      ],
      'a',
    );

    expect(aggregate).toEqual({
      schema_version: 1,
      join_policy: 'pick-winner',
      branch_count: 2,
      winner_branch_id: 'a',
      branches: [
        {
          branch_id: 'a',
          child_run_id: '11111111-1111-1111-1111-111111111111',
          child_outcome: 'complete',
          verdict: 'accept',
          admitted: true,
          result_path: 'reports/branches/a/result.json',
          duration_ms: 12,
          result_body: { verdict: 'accept', summary: 'accepted' },
        },
        {
          branch_id: 'b',
          child_run_id: '22222222-2222-2222-2222-222222222222',
          child_outcome: 'aborted',
          verdict: '<no-verdict>',
          admitted: false,
          result_path: 'reports/branches/b/result.json',
          duration_ms: 30,
        },
      ],
    } satisfies FanoutAggregateBody<'pick-winner'>);
  });

  it('omits the winner branch when none is selected', () => {
    const outcomes = [
      {
        branch_id: 'a',
        child_run_id: '11111111-1111-1111-1111-111111111111',
        worktree_path: '/tmp/worktree-a',
        child_outcome: 'complete' as const,
        verdict: 'accept',
        result_path: 'reports/branches/a/result.json',
        result_body: { verdict: 'accept' },
        duration_ms: 4,
        admitted: true,
      },
    ];

    expect(buildFanoutAggregate('aggregate-only', outcomes, undefined)).not.toHaveProperty(
      'winner_branch_id',
    );
  });

  it('computes rubric_result from child model judgments and runtime signal sources', () => {
    const aggregate = buildFanoutAggregate(
      'aggregate-only',
      [
        {
          branch_id: 'option-1',
          child_run_id: '11111111-1111-1111-1111-111111111111',
          child_outcome: 'complete',
          verdict: 'accept',
          admitted: true,
          result_path: 'reports/branches/option-1/report.json',
          duration_ms: 12,
          result_body: {
            verdict: 'accept',
            case_summary: 'This option covers the branch question.',
            evidence_refs: ['reports/decision-options.json'],
            next_action: 'Run Build.',
            rubric_model_judgments: {
              evidence_rigor: 'pass',
              actionability: 'concern',
              coverage_adequacy: 'pass',
              honest_calibration: 'pass',
            },
          },
        },
      ],
      undefined,
      TEST_RUBRIC,
    );

    expect(aggregate.branches[0]?.rubric_result).toMatchObject({
      aggregate_score: 0.875,
      runtime_veto_count: 0,
      dims: {
        evidence_rigor: {
          runtime_signal: 'met',
          model_judgment: 'pass',
          final_score: 'pass',
          dim_score: 1,
          runtime_vetoed: false,
        },
        actionability: {
          runtime_signal: 'met',
          model_judgment: 'concern',
          final_score: 'concern',
          dim_score: 0.5,
          runtime_vetoed: false,
        },
        coverage_adequacy: {
          runtime_signal: 'met',
          model_judgment: 'pass',
          final_score: 'pass',
          dim_score: 1,
          runtime_vetoed: false,
        },
        honest_calibration: {
          runtime_signal: 'n/a',
          model_judgment: 'pass',
          final_score: 'pass',
          dim_score: 1,
          runtime_vetoed: false,
        },
      },
    });
  });

  it('runtime-vetoes missing evidence even when the model judgment passes', () => {
    const aggregate = buildFanoutAggregate(
      'aggregate-only',
      [
        {
          branch_id: 'option-1',
          child_run_id: '11111111-1111-1111-1111-111111111111',
          child_outcome: 'complete',
          verdict: 'accept',
          admitted: true,
          result_path: 'reports/branches/option-1/report.json',
          duration_ms: 12,
          result_body: {
            verdict: 'accept',
            case_summary: 'This option covers the branch question.',
            evidence_refs: [],
            next_action: 'Run Build.',
            rubric_model_judgments: {
              evidence_rigor: 'pass',
              actionability: 'pass',
              coverage_adequacy: 'pass',
              honest_calibration: 'pass',
            },
          },
        },
      ],
      undefined,
      TEST_RUBRIC,
    );

    expect(aggregate.branches[0]?.rubric_result?.dims.evidence_rigor).toEqual({
      runtime_signal: 'missing',
      model_judgment: 'pass',
      final_score: 'fail',
      dim_score: 0,
      runtime_vetoed: true,
    });
    expect(aggregate.branches[0]?.rubric_result?.runtime_veto_count).toBe(1);
  });
});
