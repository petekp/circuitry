import { describe, expect, it } from 'vitest';

import {
  Claim,
  type Claim as ClaimValue,
  CompiledFlowId,
  Evidence,
  type Evidence as EvidenceValue,
  ProofAssessment,
  RunId,
  StepId,
} from '../../src/index.js';
import type { CheckEvaluatedTraceEntry } from '../../src/schemas/trace-entry.js';
import { evidenceFromAcceptanceCriteriaTrace } from '../../src/shared/proof-assessment.js';

const runId = RunId.parse('90000000-0000-4000-8000-000000000001');
const flowId = CompiledFlowId.parse('build');
const stepId = StepId.parse('verify');
const workContractRef = {
  kind: 'work_contract' as const,
  ref: 'generated/flows/build/circuit.work-contract.v0.json',
  sha256: 'a'.repeat(64),
  flow_id: flowId,
};
const traceRef = {
  kind: 'trace' as const,
  ref: 'trace.ndjson#sequence=7',
  run_id: runId,
  step_id: stepId,
  attempt: 1,
  sequence: 7,
};
const commandRef = {
  kind: 'command' as const,
  ref: 'reports/build/verification-command.json',
  sha256: 'c'.repeat(64),
  run_id: runId,
  flow_id: flowId,
  step_id: stepId,
  attempt: 1,
};
const reportRef = {
  kind: 'report' as const,
  ref: 'reports/build/review.json',
  sha256: 'b'.repeat(64),
  run_id: runId,
  flow_id: flowId,
  step_id: stepId,
  attempt: 1,
};

function requiredClaim(overrides: Partial<ClaimValue> = {}): ClaimValue {
  return Claim.parse({
    schema_version: 1,
    id: 'claim.verification_passed',
    kind: 'verification_passed',
    statement: 'Verification command passed.',
    scope_refs: [workContractRef],
    risk: 'medium',
    required: true,
    source: 'work_contract',
    ...overrides,
  });
}

function commandEvidence(overrides: Partial<EvidenceValue> = {}): EvidenceValue {
  return Evidence.parse({
    schema_version: 1,
    id: 'evidence.command.verify',
    kind: 'command',
    producer: 'runtime',
    independence: 'runtime',
    ref: commandRef,
    input_refs: [traceRef],
    covers_claims: ['claim.verification_passed'],
    result: 'pass',
    ...overrides,
  });
}

function proofAssessment(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    assessment_id: 'proof.build.verify',
    scope: {
      run_id: runId,
      flow_id: flowId,
      step_id: stepId,
      attempt: 1,
    },
    proof_policy_decision_id: 'gd-proof-build-verify-1',
    claims: [requiredClaim()],
    evidence: [commandEvidence()],
    results: [
      {
        claim_id: 'claim.verification_passed',
        status: 'proven',
        evidence_refs: ['evidence.command.verify'],
        missing: [],
        contradictions: [],
        recovery: {
          route_id: 'retry',
          kind: 'retry_same_step_with_feedback',
          reason_code: 'verification_failed',
        },
      },
    ],
    overall_status: 'proven',
    close_allowed: true,
    ...overrides,
  };
}

describe('ProofAssessment schema foundation', () => {
  it('accepts a proven claim backed by runtime evidence', () => {
    expect(ProofAssessment.safeParse(proofAssessment()).success).toBe(true);
  });

  it('requires claims to have scope refs and rejects worker-authored claim sources', () => {
    expect(
      Claim.safeParse({
        ...requiredClaim(),
        scope_refs: [],
      }).success,
    ).toBe(false);

    expect(
      Claim.safeParse({
        ...requiredClaim(),
        source: 'worker',
      }).success,
    ).toBe(false);
  });

  it('does not let agent prose or worker reports count as passing proof evidence', () => {
    expect(
      Evidence.safeParse({
        schema_version: 1,
        id: 'evidence.worker.report',
        kind: 'report',
        producer: 'worker',
        independence: 'self',
        ref: reportRef,
        input_refs: [reportRef],
        covers_claims: ['claim.verification_passed'],
        result: 'pass',
      }).success,
    ).toBe(false);
  });

  it('does not let report shape prove a claim by itself', () => {
    const shapeEvidence = Evidence.parse({
      schema_version: 1,
      id: 'evidence.report.shape',
      kind: 'report_field',
      producer: 'runtime',
      independence: 'runtime',
      ref: traceRef,
      input_refs: [traceRef],
      covers_claims: ['claim.verification_passed'],
      result: 'pass',
    });

    expect(
      ProofAssessment.safeParse(
        proofAssessment({
          evidence: [shapeEvidence],
          results: [
            {
              claim_id: 'claim.verification_passed',
              status: 'proven',
              evidence_refs: ['evidence.report.shape'],
              missing: [],
              contradictions: [],
              recovery: {
                route_id: 'retry',
                kind: 'retry_same_step_with_feedback',
                reason_code: 'report_shape_only',
              },
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('does not let acceptance trace evidence prove a claim by itself', () => {
    const traceEvidence = Evidence.parse({
      schema_version: 1,
      id: 'evidence.acceptance.trace',
      kind: 'trace',
      producer: 'runtime',
      independence: 'runtime',
      ref: traceRef,
      input_refs: [traceRef],
      covers_claims: ['claim.verification_passed'],
      result: 'pass',
    });

    expect(
      ProofAssessment.safeParse(
        proofAssessment({
          evidence: [traceEvidence],
          results: [
            {
              claim_id: 'claim.verification_passed',
              status: 'proven',
              evidence_refs: ['evidence.acceptance.trace'],
              missing: [],
              contradictions: [],
              recovery: {
                route_id: 'retry',
                kind: 'retry_same_step_with_feedback',
                reason_code: 'trace_only',
              },
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('blocks close when a required claim is weak or unproved', () => {
    expect(
      ProofAssessment.safeParse(
        proofAssessment({
          results: [
            {
              claim_id: 'claim.verification_passed',
              status: 'weak',
              evidence_refs: [],
              missing: ['No runtime command output was captured.'],
              contradictions: [],
              recovery: {
                route_id: 'retry',
                kind: 'retry_same_step_with_feedback',
                reason_code: 'weak_proof',
              },
            },
          ],
          overall_status: 'weak',
          close_allowed: true,
        }),
      ).success,
    ).toBe(false);
  });

  it('requires proof results to match declared claims and evidence', () => {
    expect(
      ProofAssessment.safeParse(
        proofAssessment({
          results: [
            {
              claim_id: 'claim.missing',
              status: 'proven',
              evidence_refs: ['evidence.command.verify'],
              missing: [],
              contradictions: [],
              recovery: {
                route_id: 'retry',
                kind: 'retry_same_step_with_feedback',
                reason_code: 'unknown_claim',
              },
            },
          ],
        }),
      ).success,
    ).toBe(false);

    expect(
      ProofAssessment.safeParse(
        proofAssessment({
          results: [
            {
              claim_id: 'claim.verification_passed',
              status: 'proven',
              evidence_refs: ['evidence.missing'],
              missing: [],
              contradictions: [],
              recovery: {
                route_id: 'retry',
                kind: 'retry_same_step_with_feedback',
                reason_code: 'missing_evidence',
              },
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });
});

describe('Acceptance criteria to Evidence adapter', () => {
  it('turns acceptance check trace entries into runtime evidence inputs', () => {
    const entry: CheckEvaluatedTraceEntry = {
      schema_version: 1,
      sequence: 7,
      recorded_at: '2026-05-07T12:00:00.000Z',
      run_id: runId,
      kind: 'check.evaluated',
      step_id: stepId,
      attempt: 1,
      check_kind: 'acceptance_criteria',
      criterion_id: 'regression-command',
      criterion_kind: 'command',
      outcome: 'pass',
      status: 'passed',
    };

    const evidence = evidenceFromAcceptanceCriteriaTrace({
      entry,
      coversClaims: ['claim.verification_passed'],
    });

    expect(evidence).toMatchObject({
      schema_version: 1,
      id: 'evidence.acceptance:verify:1:regression-command',
      kind: 'command',
      producer: 'runtime',
      independence: 'runtime',
      covers_claims: ['claim.verification_passed'],
      result: 'pass',
      ref: {
        kind: 'command',
        ref: 'acceptance-criteria/verify/1/regression-command/command',
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        run_id: runId,
        step_id: stepId,
        attempt: 1,
      },
      input_refs: [traceRef],
    });
  });

  it('turns report-field acceptance entries into report-field evidence inputs', () => {
    const entry: CheckEvaluatedTraceEntry = {
      schema_version: 1,
      sequence: 8,
      recorded_at: '2026-05-07T12:00:00.000Z',
      run_id: runId,
      kind: 'check.evaluated',
      step_id: stepId,
      attempt: 1,
      check_kind: 'acceptance_criteria',
      criterion_id: 'evidence-non-empty',
      criterion_kind: 'report_field',
      outcome: 'pass',
    };

    const evidence = evidenceFromAcceptanceCriteriaTrace({
      entry,
      coversClaims: ['claim.verification_passed'],
    });

    expect(evidence).toMatchObject({
      schema_version: 1,
      id: 'evidence.acceptance:verify:1:evidence-non-empty',
      kind: 'report_field',
      producer: 'runtime',
      independence: 'runtime',
      covers_claims: ['claim.verification_passed'],
      result: 'pass',
      ref: {
        kind: 'trace',
        ref: 'trace.ndjson#sequence=8',
        run_id: runId,
        step_id: stepId,
        attempt: 1,
        sequence: 8,
      },
    });
  });

  it('refuses non-acceptance check trace entries', () => {
    const entry: CheckEvaluatedTraceEntry = {
      schema_version: 1,
      sequence: 9,
      recorded_at: '2026-05-07T12:00:00.000Z',
      run_id: runId,
      kind: 'check.evaluated',
      step_id: stepId,
      attempt: 1,
      check_kind: 'result_verdict',
      outcome: 'pass',
    };

    expect(() =>
      evidenceFromAcceptanceCriteriaTrace({
        entry,
        coversClaims: ['claim.verification_passed'],
      }),
    ).toThrow(/acceptance/);
  });
});
