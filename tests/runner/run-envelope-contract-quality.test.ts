import { describe, expect, it } from 'vitest';

import { contractQualityReview, objectiveKind } from '../../src/run-envelope/contract-quality.js';
import type { RunGoalContract } from '../../src/schemas/run-envelope.js';

function contract(overrides: Partial<RunGoalContract> = {}): RunGoalContract {
  return {
    schema: 'run.goal-contract@v0',
    objective: 'Implement the dashboard filter',
    scope: { in: ['dashboard filter'], out: [], assumptions: [] },
    constraints: [],
    done_when: [
      {
        id: 'process-evidence',
        claim: 'done',
        required_evidence: [
          { kind: 'command', description: 'A passing verification command', required: true },
        ],
      },
    ],
    recovery_policy: {
      max_process_attempts: 2,
      allowed_routes: ['retry-process', 'run-review', 'checkpoint', 'handoff', 'blocked'],
    },
    stop_conditions: [],
    completion_gate: {
      required_passes: 2,
      blocking_severities: ['critical', 'high', 'medium'],
      reset_on_blocking_finding: true,
    },
    ...overrides,
  } as RunGoalContract;
}

describe('Run contract-quality lens (S4)', () => {
  it('classifies objective kind from the objective text', () => {
    expect(objectiveKind('Implement the dashboard filter')).toBe('implementation');
    expect(objectiveKind('Fix the flaky test')).toBe('implementation');
    expect(objectiveKind('Review the auth patch')).toBe('review');
    expect(objectiveKind('Compare two caching options and decide')).toBe('explore');
    expect(objectiveKind('Think about the weather')).toBe('other');
  });

  it('blocks a weak contract: implementation objective with only a report requirement', () => {
    const weak = contract({
      objective: 'Implement the dashboard filter',
      done_when: [
        {
          id: 'process-evidence',
          claim: 'done',
          required_evidence: [{ kind: 'report', description: 'A report exists', required: true }],
        },
      ],
    });
    const review = contractQualityReview(weak);
    expect(review.verdict).toBe('blocked');
    expect(review.findings.some((f) => f.severity === 'high' || f.severity === 'critical')).toBe(
      true,
    );
  });

  it('passes a strong implementation contract that requires a passing command', () => {
    const review = contractQualityReview(contract());
    expect(review.verdict).toBe('gate-pass');
    expect(review.findings).toEqual([]);
  });

  it('passes a review objective backed by a required review entry', () => {
    const review = contractQualityReview(
      contract({
        objective: 'Review the auth patch',
        done_when: [
          {
            id: 'process-evidence',
            claim: 'done',
            required_evidence: [
              { kind: 'review', description: 'A review with no blocking findings', required: true },
            ],
          },
        ],
      }),
    );
    expect(review.verdict).toBe('gate-pass');
  });

  it('does not constrain objectives with no minimum-evidence rule', () => {
    const review = contractQualityReview(contract({ objective: 'Think about the weather' }));
    expect(review.verdict).toBe('gate-pass');
  });
});
