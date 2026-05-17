import { describe, expect, it } from 'vitest';

import type { FanoutAggregateBody } from '../../src/shared/fanout-aggregate-report.js';
import { buildFanoutAggregate } from '../../src/shared/fanout-aggregate-report.js';

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
});
