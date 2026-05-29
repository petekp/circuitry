import type { RunGoalContract } from '../../src/schemas/run-envelope.js';

// Shared Run goal-contract builder for the run-envelope loop tests. Each test
// overrides only the fields it cares about; the defaults are a single-claim
// implementation contract that requires one passing command.
export function goalContract(overrides: Partial<RunGoalContract> = {}): RunGoalContract {
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
