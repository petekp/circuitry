import { z } from 'zod';
import { GuidanceDecisionId } from './guidance-decision.js';
import { CompiledFlowId, RunId, StepId } from './ids.js';
import { RecoveryRouteKind } from './recovery-route-kind.js';
import { Ref, type RefKind } from './ref.js';

const ProofId = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._:-]*$/, {
    message: 'id must be a lowercase proof id',
  });

export const ClaimId = ProofId;
export type ClaimId = z.infer<typeof ClaimId>;

export const EvidenceId = ProofId;
export type EvidenceId = z.infer<typeof EvidenceId>;

export const ProofAssessmentId = ProofId;
export type ProofAssessmentId = z.infer<typeof ProofAssessmentId>;

export const ClaimKind = z.enum([
  'bug_fixed',
  'behavior_changed',
  'test_added',
  'docs_changed',
  'refactor_only',
  'generated_surface_synced',
  'absence_of_change',
  'scope_respected',
  'verification_passed',
  'review_clean',
]);
export type ClaimKind = z.infer<typeof ClaimKind>;

export const ClaimRisk = z.enum(['low', 'medium', 'high']);
export type ClaimRisk = z.infer<typeof ClaimRisk>;

export const ClaimSource = z.enum(['work_contract', 'runtime', 'operator']);
export type ClaimSource = z.infer<typeof ClaimSource>;

export const Claim = z
  .object({
    schema_version: z.literal(1),
    id: ClaimId,
    kind: ClaimKind,
    statement: z.string().min(1),
    scope_refs: z.array(Ref).min(1),
    risk: ClaimRisk,
    required: z.boolean(),
    source: ClaimSource,
  })
  .strict();
export type Claim = z.infer<typeof Claim>;

export const EvidenceKind = z.enum([
  'command',
  'report_field',
  'diff',
  'generated_surface',
  'review',
  'report',
  'trace',
  'source_citation',
  'absence_of_change',
]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

export const EvidenceProducer = z.enum(['runtime', 'worker', 'independent_worker', 'operator']);
export type EvidenceProducer = z.infer<typeof EvidenceProducer>;

export const EvidenceIndependence = z.enum(['self', 'runtime', 'independent', 'external']);
export type EvidenceIndependence = z.infer<typeof EvidenceIndependence>;

export const EvidenceResult = z.enum(['pass', 'fail', 'unknown']);
export type EvidenceResult = z.infer<typeof EvidenceResult>;

const RuntimeOwnedEvidenceKinds = new Set<EvidenceKind>([
  'command',
  'diff',
  'generated_surface',
  'trace',
  'absence_of_change',
]);

const EvidenceRefKinds: Readonly<Record<EvidenceKind, readonly RefKind[]>> = {
  command: ['command'],
  report_field: ['report', 'trace'],
  diff: ['diff', 'trace'],
  generated_surface: ['command', 'report', 'trace'],
  review: ['report', 'trace'],
  report: ['report'],
  trace: ['trace'],
  source_citation: ['report', 'trace', 'evidence'],
  absence_of_change: ['diff', 'trace'],
};

export const Evidence = z
  .object({
    schema_version: z.literal(1),
    id: EvidenceId,
    kind: EvidenceKind,
    producer: EvidenceProducer,
    independence: EvidenceIndependence,
    ref: Ref,
    input_refs: z.array(Ref).min(1),
    covers_claims: z.array(ClaimId).min(1),
    result: EvidenceResult,
    summary: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((evidence, ctx) => {
    if (!EvidenceRefKinds[evidence.kind].includes(evidence.ref.kind)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ref', 'kind'],
        message: `${evidence.kind} evidence cannot use ${evidence.ref.kind} refs`,
      });
    }

    if (RuntimeOwnedEvidenceKinds.has(evidence.kind) && evidence.producer !== 'runtime') {
      ctx.addIssue({
        code: 'custom',
        path: ['producer'],
        message: `${evidence.kind} evidence must be produced by the runtime`,
      });
    }

    if (evidence.producer === 'worker' && evidence.result === 'pass') {
      ctx.addIssue({
        code: 'custom',
        path: ['result'],
        message: 'worker-produced evidence cannot be marked pass by itself',
      });
    }

    if (evidence.independence === 'self' && evidence.result === 'pass') {
      ctx.addIssue({
        code: 'custom',
        path: ['independence'],
        message: 'self evidence cannot prove a claim',
      });
    }

    if (evidence.kind === 'review' && evidence.independence === 'self') {
      ctx.addIssue({
        code: 'custom',
        path: ['independence'],
        message: 'review evidence must be independent or runtime-owned',
      });
    }
  });
export type Evidence = z.infer<typeof Evidence>;

export const ClaimCoverageRule = z
  .object({
    claim_id: ClaimId,
    required_evidence: z
      .array(
        z
          .object({
            kind: EvidenceKind,
            min_result: z.literal('pass'),
            min_independence: z.enum(['runtime', 'independent', 'external']),
            refs: z.array(Ref).optional(),
            accepted_sources: z.array(z.string().min(1)).optional(),
          })
          .strict(),
      )
      .min(1),
    optional_evidence: z
      .array(
        z
          .object({
            kind: EvidenceKind,
            refs: z.array(Ref).optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();
export type ClaimCoverageRule = z.infer<typeof ClaimCoverageRule>;

export const ProofStatus = z.enum(['proven', 'weak', 'contradicted', 'unproved']);
export type ProofStatus = z.infer<typeof ProofStatus>;

const ProofRecovery = z
  .object({
    route_id: z.string().min(1),
    kind: RecoveryRouteKind,
    reason_code: z.string().regex(/^[a-z][a-z0-9_]*$/),
  })
  .strict();
export type ProofRecovery = z.infer<typeof ProofRecovery>;

export const ProofAssessmentResult = z
  .object({
    claim_id: ClaimId,
    status: ProofStatus,
    evidence_refs: z.array(EvidenceId),
    missing: z.array(z.string().min(1)),
    contradictions: z.array(z.string().min(1)),
    recovery: ProofRecovery.optional(),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (result.status === 'proven' && result.recovery !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['recovery'],
        message: 'proven claims must not declare a recovery route',
      });
    }
    if (
      result.status !== 'proven' &&
      result.recovery === undefined &&
      result.missing.length === 0 &&
      result.contradictions.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['recovery'],
        message:
          'non-proven claims without recovery must explain the missing or contradicted proof',
      });
    }
  });
export type ProofAssessmentResult = z.infer<typeof ProofAssessmentResult>;

const ProofScope = z
  .object({
    run_id: RunId,
    flow_id: CompiledFlowId,
    step_id: StepId.optional(),
    attempt: z.number().int().positive().optional(),
  })
  .strict();

const STATUS_RANK: Readonly<Record<ProofStatus, number>> = {
  proven: 0,
  weak: 1,
  unproved: 2,
  contradicted: 3,
};

function worstStatus(statuses: readonly ProofStatus[]): ProofStatus {
  return statuses.reduce<ProofStatus>(
    (worst, status) => (STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst),
    'proven',
  );
}

function canProveClaim(evidence: Evidence, claimId: string): boolean {
  return (
    evidence.result === 'pass' &&
    evidence.covers_claims.includes(claimId as ClaimId) &&
    evidence.producer !== 'worker' &&
    evidence.independence !== 'self' &&
    evidence.ref.kind !== 'trace' &&
    evidence.kind !== 'trace' &&
    evidence.kind !== 'report' &&
    evidence.kind !== 'report_field'
  );
}

export const ProofAssessment = z
  .object({
    schema_version: z.literal(1),
    assessment_id: ProofAssessmentId,
    scope: ProofScope,
    proof_policy_decision_id: GuidanceDecisionId,
    claims: z.array(Claim).min(1),
    evidence: z.array(Evidence).default([]),
    results: z.array(ProofAssessmentResult).min(1),
    overall_status: ProofStatus,
    close_allowed: z.boolean(),
  })
  .strict()
  .superRefine((assessment, ctx) => {
    const claimIds = new Set<string>();
    const requiredClaimIds = new Set<string>();
    for (const [index, claim] of assessment.claims.entries()) {
      if (claimIds.has(claim.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['claims', index, 'id'],
          message: `duplicate claim '${claim.id}'`,
        });
      }
      claimIds.add(claim.id);
      if (claim.required) requiredClaimIds.add(claim.id);
    }

    const evidenceById = new Map<string, Evidence>();
    for (const [index, evidence] of assessment.evidence.entries()) {
      if (evidenceById.has(evidence.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['evidence', index, 'id'],
          message: `duplicate evidence '${evidence.id}'`,
        });
      }
      evidenceById.set(evidence.id, evidence);
      for (const [claimIndex, claimId] of evidence.covers_claims.entries()) {
        if (!claimIds.has(claimId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['evidence', index, 'covers_claims', claimIndex],
            message: `evidence covers undeclared claim '${claimId}'`,
          });
        }
      }
    }

    const resultsByClaim = new Map<string, ProofAssessmentResult>();
    for (const [index, result] of assessment.results.entries()) {
      if (!claimIds.has(result.claim_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['results', index, 'claim_id'],
          message: `result references undeclared claim '${result.claim_id}'`,
        });
      }
      if (resultsByClaim.has(result.claim_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['results', index, 'claim_id'],
          message: `duplicate proof result for claim '${result.claim_id}'`,
        });
      }
      resultsByClaim.set(result.claim_id, result);

      const referencedEvidence = result.evidence_refs.map((id, evidenceIndex) => {
        const evidence = evidenceById.get(id);
        if (evidence === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['results', index, 'evidence_refs', evidenceIndex],
            message: `result references undeclared evidence '${id}'`,
          });
        }
        return evidence;
      });

      if (result.status === 'proven') {
        if (result.missing.length > 0 || result.contradictions.length > 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['results', index, 'status'],
            message: 'proven claims cannot list missing evidence or contradictions',
          });
        }
        if (
          !referencedEvidence.some(
            (evidence) => evidence !== undefined && canProveClaim(evidence, result.claim_id),
          )
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['results', index, 'evidence_refs'],
            message:
              'proven claims require passing runtime or independent evidence beyond report shape',
          });
        }
      }
    }

    for (const requiredClaimId of requiredClaimIds) {
      if (!resultsByClaim.has(requiredClaimId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['results'],
          message: `missing proof result for required claim '${requiredClaimId}'`,
        });
      }
    }

    const requiredResults = [...requiredClaimIds].flatMap((id) => {
      const result = resultsByClaim.get(id);
      return result === undefined ? [] : [result];
    });
    const relevantResults =
      requiredResults.length > 0 ? requiredResults : [...resultsByClaim.values()];
    const expectedOverall = worstStatus(relevantResults.map((result) => result.status));
    if (assessment.overall_status !== expectedOverall) {
      ctx.addIssue({
        code: 'custom',
        path: ['overall_status'],
        message: `overall_status must be '${expectedOverall}' for the required claim results`,
      });
    }

    if (assessment.close_allowed && relevantResults.some((result) => result.status !== 'proven')) {
      ctx.addIssue({
        code: 'custom',
        path: ['close_allowed'],
        message: 'close_allowed requires every required claim to be proven',
      });
    }
  });
export type ProofAssessment = z.infer<typeof ProofAssessment>;
