import { describe, expect, it } from 'vitest';

import { GuidanceDecisionTraceEntry } from '../../src/index.js';

const sha = 'b'.repeat(64);
const runId = '0191d2f0-aaaa-7fff-8aaa-000000000000';

const workContractRef = {
  kind: 'work_contract' as const,
  ref: 'generated/flows/build/work-contract.json',
  sha256: sha,
  flow_id: 'build',
};

const policyRef = {
  kind: 'policy' as const,
  ref: 'policy.constraints.max_effort',
};

const requestRef = {
  kind: 'request' as const,
  ref: 'relay/act-step/request.json',
  sha256: sha,
  run_id: runId,
  flow_id: 'build',
  step_id: 'act-step',
  attempt: 1,
};

function relayDecision() {
  return {
    schema_version: 1,
    sequence: 1,
    recorded_at: '2026-04-18T05:00:00.000Z',
    run_id: runId,
    kind: 'guidance.decision',
    decision_id: 'gd-001',
    subject: 'relay_execution',
    scope: {
      run_id: runId,
      flow_id: 'build',
      step_id: 'act-step',
      attempt: 1,
    },
    source: 'deterministic',
    selected: {
      role: 'implementer',
      connector: { kind: 'builtin', name: 'codex' },
      skills: [],
      context_packet_ref: requestRef,
      request_payload_hash: sha,
    },
    input_refs: [requestRef],
    constraint_refs: [workContractRef, policyRef],
    contract_refs: [workContractRef],
    policy_refs: [policyRef],
    reason_codes: ['write_step_requires_worker'],
  };
}

describe('GuidanceDecisionTraceEntry schema', () => {
  it('accepts a relay execution decision with shared refs', () => {
    expect(GuidanceDecisionTraceEntry.safeParse(relayDecision()).success).toBe(true);
  });

  it('requires flow selection to point at a work contract ref', () => {
    const flowSelection = {
      ...relayDecision(),
      subject: 'flow_selection',
      selected: {
        flow_id: 'build',
        work_contract_ref: workContractRef,
      },
    };
    expect(GuidanceDecisionTraceEntry.safeParse(flowSelection).success).toBe(true);

    expect(
      GuidanceDecisionTraceEntry.safeParse({
        ...flowSelection,
        selected: {
          flow_id: 'build',
          work_contract_ref: policyRef,
        },
      }).success,
    ).toBe(false);
  });

  it('requires non-empty input, constraint, contract, policy, and reason refs', () => {
    for (const field of [
      'input_refs',
      'constraint_refs',
      'contract_refs',
      'policy_refs',
      'reason_codes',
    ] as const) {
      const candidate = { ...relayDecision(), [field]: [] };
      expect(GuidanceDecisionTraceEntry.safeParse(candidate).success, `${field} should fail`).toBe(
        false,
      );
    }
  });

  it('rejects confidence and required prose rationale', () => {
    expect(
      GuidanceDecisionTraceEntry.safeParse({
        ...relayDecision(),
        confidence: 0.91,
      }).success,
    ).toBe(false);

    expect(
      GuidanceDecisionTraceEntry.safeParse({
        ...relayDecision(),
        freeform_reason: 'looks good to me',
      }).success,
    ).toBe(false);
  });

  it('requires relay decisions to name flow, step, and attempt in scope', () => {
    const { attempt: _attempt, ...scopeWithoutAttempt } = relayDecision().scope;
    const candidate = { ...relayDecision(), scope: scopeWithoutAttempt };
    expect(GuidanceDecisionTraceEntry.safeParse(candidate).success).toBe(false);
  });

  it('keeps constraint refs to work contract and policy refs in V0', () => {
    expect(
      GuidanceDecisionTraceEntry.safeParse({
        ...relayDecision(),
        constraint_refs: [requestRef],
      }).success,
    ).toBe(false);
  });
});
