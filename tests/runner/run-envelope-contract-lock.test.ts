import { describe, expect, it } from 'vitest';

import {
  contractLockDecision,
  detectContractWeakening,
} from '../../src/run-envelope/contract-lock.js';
import type { RunGoalContract } from '../../src/schemas/run-envelope.js';

function contract(overrides: Partial<RunGoalContract> = {}): RunGoalContract {
  return {
    schema: 'run.goal-contract@v0',
    objective: 'Fix the flaky auth refresh test',
    scope: { in: ['auth refresh'], out: [], assumptions: [] },
    constraints: [],
    done_when: [
      {
        id: 'process-evidence',
        claim: 'The fix work is complete with the required proof.',
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

describe('Run proof-contract lock (S3)', () => {
  it('treats an identical contract as not weakened and routes continue', () => {
    const intake = contract();
    const current = contract();
    expect(detectContractWeakening(intake, current)).toEqual([]);
    expect(contractLockDecision(intake, current)).toMatchObject({
      weakened: false,
      route: 'continue',
    });
  });

  it('flags a removed required-evidence entry as weakening and routes checkpoint', () => {
    const intake = contract({
      done_when: [
        {
          id: 'process-evidence',
          claim: 'c',
          required_evidence: [
            { kind: 'command', description: 'A passing verification command', required: true },
            { kind: 'review', description: 'A review with no blocking findings', required: true },
          ],
        },
      ],
    });
    const current = contract(); // dropped the review evidence
    const weakenings = detectContractWeakening(intake, current);
    expect(weakenings.some((w) => w.kind === 'evidence-removed')).toBe(true);
    expect(contractLockDecision(intake, current)).toMatchObject({
      weakened: true,
      route: 'checkpoint',
    });
  });

  it('flags relaxing a required entry from required:true to required:false', () => {
    const intake = contract();
    const current = contract({
      done_when: [
        {
          id: 'process-evidence',
          claim: 'c',
          required_evidence: [
            { kind: 'command', description: 'A passing verification command', required: false },
            { kind: 'report', description: 'something else', required: true },
          ],
        },
      ],
    });
    const weakenings = detectContractWeakening(intake, current);
    expect(weakenings.some((w) => w.kind === 'requirement-relaxed')).toBe(true);
    expect(contractLockDecision(intake, current).weakened).toBe(true);
  });

  it('flags a removed claim as weakening', () => {
    const intake = contract({
      done_when: [
        {
          id: 'process-evidence',
          claim: 'c',
          required_evidence: [{ kind: 'command', description: 'x', required: true }],
        },
        {
          id: 'second-claim',
          claim: 'c2',
          required_evidence: [{ kind: 'review', description: 'y', required: true }],
        },
      ],
    });
    const current = contract();
    const weakenings = detectContractWeakening(intake, current);
    expect(
      weakenings.some((w) => w.kind === 'claim-removed' && w.claim_id === 'second-claim'),
    ).toBe(true);
  });

  it('does not flag strengthening (adding a new required entry) as weakening', () => {
    const intake = contract();
    const current = contract({
      done_when: [
        {
          id: 'process-evidence',
          claim: 'c',
          required_evidence: [
            { kind: 'command', description: 'A passing verification command', required: true },
            { kind: 'review', description: 'An added review', required: true },
          ],
        },
      ],
    });
    expect(detectContractWeakening(intake, current)).toEqual([]);
    expect(contractLockDecision(intake, current).route).toBe('continue');
  });
});
