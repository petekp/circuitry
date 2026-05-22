import { z } from 'zod';
import { GuidanceDecisionId } from './guidance-decision.js';
import { CompiledFlowId, RunId, StepId } from './ids.js';
import { Ref, Sha256 } from './ref.js';

export const ChangePacketId = z.string().regex(/^cp-[a-z0-9][a-z0-9._:-]*$/);
export type ChangePacketId = z.infer<typeof ChangePacketId>;

export const WorkRootKind = z.enum([
  'isolated_worktree',
  'parent_checkout_diff_capture',
  'pre_safe_apply_trusted_write',
]);
export type WorkRootKind = z.infer<typeof WorkRootKind>;

export const DirtyParentState = z.enum(['clean', 'dirty_allowed', 'dirty_rejected']);
export type DirtyParentState = z.infer<typeof DirtyParentState>;

export const TouchedFileStatus = z.enum(['added', 'modified', 'deleted', 'renamed']);
export type TouchedFileStatus = z.infer<typeof TouchedFileStatus>;

export const ChangeRiskKind = z.enum([
  'protected_file',
  'generated_surface',
  'schema_change',
  'dependency_change',
  'migration',
  'semantic_overlap',
  'verification_gap',
  'dirty_parent',
  'base_mismatch',
  'apply_conflict',
]);
export type ChangeRiskKind = z.infer<typeof ChangeRiskKind>;

export const ChangeRiskSeverity = z.enum(['low', 'medium', 'high']);
export type ChangeRiskSeverity = z.infer<typeof ChangeRiskSeverity>;

export const GeneratedSurfaceStatus = z.enum([
  'not_touched',
  'synced',
  'drift_detected',
  'unknown',
]);
export type GeneratedSurfaceStatus = z.infer<typeof GeneratedSurfaceStatus>;

export const ProtectedFileDecision = z.enum(['allowed', 'rejected', 'checkpointed']);
export type ProtectedFileDecision = z.infer<typeof ProtectedFileDecision>;

export const ApplyRecommendation = z.enum(['apply', 'review', 'reject']);
export type ApplyRecommendation = z.infer<typeof ApplyRecommendation>;

export const SafeApplyAction = z.enum(['rejected', 'accepted_for_review', 'applied']);
export type SafeApplyAction = z.infer<typeof SafeApplyAction>;

export const SafeApplyOutcome = z.enum(['pass', 'fail']);
export type SafeApplyOutcome = z.infer<typeof SafeApplyOutcome>;

export const SafeApplyCheckStatus = z.enum(['pass', 'fail']);
export type SafeApplyCheckStatus = z.infer<typeof SafeApplyCheckStatus>;

export const SafeApplyProtectedCheckStatus = z.enum(['pass', 'fail', 'checkpoint_required']);
export type SafeApplyProtectedCheckStatus = z.infer<typeof SafeApplyProtectedCheckStatus>;

export const SafeApplyGeneratedSurfaceCheckStatus = z.enum(['pass', 'fail', 'not_required']);
export type SafeApplyGeneratedSurfaceCheckStatus = z.infer<
  typeof SafeApplyGeneratedSurfaceCheckStatus
>;

export const SafeApplyFinalVerificationStatus = z.enum(['pass', 'fail', 'not_run']);
export type SafeApplyFinalVerificationStatus = z.infer<typeof SafeApplyFinalVerificationStatus>;

export const PartialMutationStatus = z.enum(['none', 'possible', 'confirmed']);
export type PartialMutationStatus = z.infer<typeof PartialMutationStatus>;

export const SafeApplyReasonCode = z.enum([
  'guidance_missing',
  'packet_invalid',
  'base_mismatch',
  'dirty_parent',
  'patch_hash_mismatch',
  'apply_conflict',
  'touched_files_mismatch',
  'protected_file_touched',
  'generated_surface_drift',
  'weak_proof',
  'final_verification_failed',
  'applied',
  'review_required',
  'rejected',
]);
export type SafeApplyReasonCode = z.infer<typeof SafeApplyReasonCode>;

const CheckpointRef = Ref.refine((ref) => ref.kind === 'trace' || ref.kind === 'operator_input', {
  message: 'checkpoint refs must be trace or operator_input refs',
});

const PatchRef = Ref.refine((ref) => ref.kind === 'patch', {
  message: 'patch refs must use kind patch',
});

const RuntimeTouchedFilesRef = Ref.refine((ref) => ref.kind === 'diff', {
  message: 'runtime touched files must use diff refs',
});

const BaseStatusRef = Ref.refine((ref) => ref.kind === 'command', {
  message: 'base status refs must use command refs',
});

const BaselineSnapshotRef = Ref.refine((ref) => ref.kind === 'evidence' || ref.kind === 'report', {
  message: 'baseline snapshot refs must use evidence or report refs',
});

const PatchPrecheckRef = Ref.refine((ref) => ref.kind === 'command', {
  message: 'patch precheck refs must use command refs',
});

const HunkRef = Ref.refine((ref) => ref.kind === 'diff' || ref.kind === 'patch', {
  message: 'hunk refs must use diff or patch refs',
});

const DriftCheckRef = Ref.refine((ref) => ref.kind === 'command', {
  message: 'drift check refs must use command refs',
});

const GeneratedSurfaceRef = Ref.refine((ref) => ref.kind === 'generated_surface', {
  message: 'generated surface refs must use kind generated_surface',
});

const ProofAssessmentRef = Ref.refine((ref) => ref.kind === 'evidence' || ref.kind === 'report', {
  message: 'proof assessment refs must use evidence or report refs',
});

const FinalVerificationRef = Ref.refine((ref) => ref.kind === 'command', {
  message: 'final verification refs must use command refs',
});

const WorkerClaimRef = Ref.refine((ref) => ref.kind === 'report' || ref.kind === 'evidence', {
  message: 'worker touched-file claims must use report or evidence refs',
});

const ChangePacketRef = Ref.refine((ref) => ref.kind === 'change_packet', {
  message: 'change packet refs must use kind change_packet',
});

const SafeApplyRef = Ref.refine((ref) => ref.kind === 'safe_apply', {
  message: 'safe apply refs must use kind safe_apply',
});

const WorkRootRef = Ref.refine(
  (ref) => ref.kind === 'worktree' || ref.kind === 'diff' || ref.kind === 'trace',
  {
    message: 'work root refs must use worktree, diff, or trace refs',
  },
);

const BaseState = z
  .object({
    ref: z.string().min(1),
    tree_hash: Sha256,
    status_ref: BaseStatusRef,
    dirty_parent: z
      .object({
        state: DirtyParentState,
        policy_ref: Ref.refine((ref) => ref.kind === 'policy', {
          message: 'dirty parent policy refs must use kind policy',
        }),
        baseline_snapshot_ref: BaselineSnapshotRef.optional(),
        dirty_paths: z.array(z.string().min(1)),
        hidden_index_flags: z.array(
          z
            .object({
              tag: z.string().min(1),
              path: z.string().min(1),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

const Patch = z
  .object({
    ref: PatchRef,
    sha256: Sha256,
    format: z.literal('unified_diff'),
    applies_to_base: z.boolean(),
    apply_precheck_ref: PatchPrecheckRef.optional(),
  })
  .strict();

const RuntimeTouchedFile = z
  .object({
    path: z.string().min(1),
    status: TouchedFileStatus,
    source: z.literal('runtime_diff'),
    hunks_ref: HunkRef.optional(),
    generated_surface: z.boolean(),
    protected: z.boolean(),
  })
  .strict();

const TouchedFiles = z
  .object({
    runtime_ref: RuntimeTouchedFilesRef,
    files: z.array(RuntimeTouchedFile),
    worker_claim_ref: WorkerClaimRef.optional(),
    worker_claim_matches_runtime: z.boolean(),
  })
  .strict();

const ChangeRisk = z
  .object({
    kind: ChangeRiskKind,
    severity: ChangeRiskSeverity,
    refs: z.array(Ref).min(1),
  })
  .strict();

const GeneratedSurfaces = z
  .object({
    status: GeneratedSurfaceStatus,
    source_refs: z.array(GeneratedSurfaceRef),
    output_refs: z.array(GeneratedSurfaceRef),
    drift_check_ref: DriftCheckRef.optional(),
  })
  .strict();

const ProtectedFiles = z
  .object({
    decision: ProtectedFileDecision,
    policy_ref: Ref.refine((ref) => ref.kind === 'policy', {
      message: 'protected file policy refs must use kind policy',
    }),
    checkpoint_ref: CheckpointRef.optional(),
    files: z.array(z.string().min(1)),
  })
  .strict();

const Producer = z
  .object({
    run_id: RunId,
    flow_id: CompiledFlowId,
    step_id: StepId,
    attempt: z.number().int().positive(),
    branch_id: z.string().min(1).optional(),
    connector: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    work_root_kind: WorkRootKind,
    work_root_ref: WorkRootRef,
  })
  .strict();

export const ChangePacketV0 = z
  .object({
    schema_version: z.literal(1),
    packet_id: ChangePacketId,
    producer: Producer,
    base: BaseState,
    patch: Patch,
    touched_files: TouchedFiles,
    claims: z.array(Ref).min(1),
    evidence: z.array(Ref).min(1),
    proof_assessment_refs: z.array(ProofAssessmentRef).min(1),
    commands_run: z.array(Ref),
    risks: z.array(ChangeRisk),
    generated_surfaces: GeneratedSurfaces,
    protected_files: ProtectedFiles,
    apply_recommendation: ApplyRecommendation,
  })
  .strict()
  .superRefine((packet, ctx) => {
    if (
      packet.producer.work_root_kind === 'isolated_worktree' &&
      packet.producer.work_root_ref.kind !== 'worktree'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['producer', 'work_root_ref', 'kind'],
        message: 'isolated_worktree packets require worktree refs',
      });
    }

    if (
      packet.producer.work_root_kind !== 'isolated_worktree' &&
      packet.producer.work_root_ref.kind === 'worktree'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['producer', 'work_root_ref', 'kind'],
        message: 'only isolated_worktree packets may use worktree refs',
      });
    }

    if (packet.patch.ref.sha256 !== packet.patch.sha256) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['patch', 'sha256'],
        message: 'patch.sha256 must match patch.ref.sha256',
      });
    }

    if (packet.apply_recommendation === 'apply') {
      if (!packet.touched_files.worker_claim_matches_runtime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['touched_files', 'worker_claim_matches_runtime'],
          message: 'apply recommendations require worker claims to match runtime touched files',
        });
      }
      if (!packet.patch.applies_to_base) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['patch', 'applies_to_base'],
          message: 'apply recommendations require patches that apply to base',
        });
      }
    }

    if (packet.base.dirty_parent.state === 'dirty_allowed') {
      if (packet.base.dirty_parent.baseline_snapshot_ref === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['base', 'dirty_parent', 'baseline_snapshot_ref'],
          message: 'dirty_allowed requires baseline snapshot evidence',
        });
      }
      if (packet.base.dirty_parent.dirty_paths.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['base', 'dirty_parent', 'dirty_paths'],
          message: 'dirty_allowed requires dirty_paths',
        });
      }
    }

    if (
      packet.base.dirty_parent.hidden_index_flags.length > 0 &&
      packet.base.dirty_parent.state !== 'dirty_rejected'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['base', 'dirty_parent', 'hidden_index_flags'],
        message: 'hidden index flags require dirty_rejected state',
      });
    }

    if (
      packet.base.dirty_parent.state !== 'clean' &&
      !packet.risks.some((risk) => risk.kind === 'dirty_parent')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['risks'],
        message: 'dirty parent states require dirty_parent risk evidence',
      });
    }

    for (const [index, ref] of packet.claims.entries()) {
      if (ref.kind !== 'evidence' && ref.kind !== 'report') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['claims', index, 'kind'],
          message: 'claim refs must use evidence or report refs',
        });
      }
    }

    for (const [index, ref] of packet.evidence.entries()) {
      if (ref.kind !== 'evidence') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evidence', index, 'kind'],
          message: 'evidence refs must use kind evidence',
        });
      }
    }

    for (const [index, ref] of packet.commands_run.entries()) {
      if (ref.kind !== 'command') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['commands_run', index, 'kind'],
          message: 'commands_run refs must use kind command',
        });
      }
    }

    const generatedTouched = packet.touched_files.files.some((file) => file.generated_surface);
    if (generatedTouched) {
      if (packet.generated_surfaces.status === 'not_touched') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['generated_surfaces', 'status'],
          message: 'generated surfaces cannot be not_touched when generated files changed',
        });
      }
      if (packet.generated_surfaces.status === 'unknown') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['generated_surfaces', 'status'],
          message: 'generated surface unknown status blocks packets',
        });
      }
      if (
        packet.generated_surfaces.status === 'drift_detected' &&
        packet.apply_recommendation === 'apply'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['apply_recommendation'],
          message: 'generated surface drift cannot be recommended for apply',
        });
      }
      if (packet.generated_surfaces.drift_check_ref === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['generated_surfaces', 'drift_check_ref'],
          message: 'generated surface changes require drift check evidence',
        });
      }
      if (
        packet.generated_surfaces.source_refs.length === 0 ||
        packet.generated_surfaces.output_refs.length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['generated_surfaces'],
          message: 'generated surface changes require source and output refs',
        });
      }
      if (!packet.risks.some((risk) => risk.kind === 'generated_surface')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['risks'],
          message: 'generated surface changes require generated_surface risk evidence',
        });
      }
    } else if (packet.generated_surfaces.status !== 'not_touched') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['generated_surfaces', 'status'],
        message: 'generated surface status must be not_touched when no generated files changed',
      });
    }

    const protectedTouched = packet.touched_files.files
      .filter((file) => file.protected)
      .map((file) => file.path);
    for (const path of protectedTouched) {
      if (!packet.protected_files.files.includes(path)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['protected_files', 'files'],
          message: `protected touched file '${path}' must be listed`,
        });
      }
    }
    if (packet.protected_files.files.length > 0) {
      if (!packet.risks.some((risk) => risk.kind === 'protected_file')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['risks'],
          message: 'protected files require protected_file risk evidence',
        });
      }
      if (
        packet.protected_files.decision === 'checkpointed' &&
        packet.protected_files.checkpoint_ref === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['protected_files', 'checkpoint_ref'],
          message: 'checkpointed protected files require checkpoint refs',
        });
      }
    } else if (packet.protected_files.decision !== 'allowed') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['protected_files', 'decision'],
        message: 'empty protected file set must use allowed decision',
      });
    }
  });
export type ChangePacketV0 = z.infer<typeof ChangePacketV0>;

const BaseCheck = z
  .object({
    status: SafeApplyCheckStatus,
    expected_ref: z.string().min(1),
    actual_ref: z.string().min(1).optional(),
    tree_hash_match: z.boolean(),
  })
  .strict();

const DirtyParentCheck = z
  .object({
    status: SafeApplyCheckStatus,
    policy_ref: Ref.refine((ref) => ref.kind === 'policy', {
      message: 'dirty parent check policy refs must use kind policy',
    }),
    refs: z.array(Ref).min(1),
  })
  .strict();

const PatchCheck = z
  .object({
    status: SafeApplyCheckStatus,
    conflict_files: z.array(z.string().min(1)),
    partial_mutation: PartialMutationStatus,
  })
  .strict();

const TouchedFileCheck = z
  .object({
    status: SafeApplyCheckStatus,
    runtime_ref: RuntimeTouchedFilesRef,
    worker_claim_ref: WorkerClaimRef.optional(),
  })
  .strict();

const ProofCheck = z
  .object({
    status: SafeApplyCheckStatus,
    proof_assessment_refs: z.array(ProofAssessmentRef).min(1),
  })
  .strict();

const ProtectedFileCheck = z
  .object({
    status: SafeApplyProtectedCheckStatus,
    files: z.array(z.string().min(1)),
    checkpoint_ref: CheckpointRef.optional(),
  })
  .strict();

const GeneratedSurfaceCheck = z
  .object({
    status: SafeApplyGeneratedSurfaceCheckStatus,
    drift_check_ref: DriftCheckRef.optional(),
  })
  .strict();

const FinalVerification = z
  .object({
    status: SafeApplyFinalVerificationStatus,
    ref: FinalVerificationRef.optional(),
  })
  .strict();

export const SafeApplyResultV0 = z
  .object({
    schema_version: z.literal(1),
    kind: z.literal('safe_apply.result'),
    decision_id: GuidanceDecisionId,
    change_packet_ref: ChangePacketRef,
    action: SafeApplyAction,
    outcome: SafeApplyOutcome,
    reason_codes: z.array(SafeApplyReasonCode).min(1),
    base_check: BaseCheck,
    dirty_parent_check: DirtyParentCheck,
    patch_check: PatchCheck,
    touched_file_check: TouchedFileCheck,
    proof_check: ProofCheck,
    protected_file_check: ProtectedFileCheck,
    generated_surface_check: GeneratedSurfaceCheck,
    final_verification: FinalVerification,
    applied_patch_ref: PatchRef.optional(),
    result_ref: SafeApplyRef.optional(),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (result.base_check.status === 'pass' && !result.base_check.tree_hash_match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['base_check', 'tree_hash_match'],
        message: 'base check pass requires tree_hash_match',
      });
    }

    const requiredChecksPass =
      result.base_check.status === 'pass' &&
      result.dirty_parent_check.status === 'pass' &&
      result.patch_check.status === 'pass' &&
      result.touched_file_check.status === 'pass' &&
      result.proof_check.status === 'pass' &&
      result.protected_file_check.status === 'pass' &&
      (result.generated_surface_check.status === 'pass' ||
        result.generated_surface_check.status === 'not_required') &&
      result.final_verification.status === 'pass';

    if (result.outcome === 'pass' && !requiredChecksPass) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['outcome'],
        message: 'safe apply pass requires every required check to pass',
      });
    }

    if (
      result.patch_check.partial_mutation !== 'none' &&
      (result.outcome === 'pass' || result.action === 'applied')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['patch_check', 'partial_mutation'],
        message: 'possible or confirmed partial mutation cannot pass or apply',
      });
    }

    if (
      result.patch_check.partial_mutation !== 'none' &&
      !result.reason_codes.includes('apply_conflict')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason_codes'],
        message: 'possible or confirmed partial mutation requires apply_conflict reason code',
      });
    }

    if (result.action === 'applied') {
      if (result.outcome !== 'pass') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['outcome'],
          message: 'applied safe apply results require pass outcome',
        });
      }
      if (
        result.final_verification.status !== 'pass' ||
        result.final_verification.ref === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['final_verification'],
          message: 'applied safe apply results require final verification refs',
        });
      }
      if (result.applied_patch_ref === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applied_patch_ref'],
          message: 'applied safe apply results require applied patch refs',
        });
      }
    }

    if (
      result.generated_surface_check.status === 'pass' &&
      result.generated_surface_check.drift_check_ref === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['generated_surface_check', 'drift_check_ref'],
        message: 'passing generated surface checks require drift check refs',
      });
    }

    if (
      result.protected_file_check.status === 'checkpoint_required' &&
      result.protected_file_check.checkpoint_ref === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['protected_file_check', 'checkpoint_ref'],
        message: 'checkpoint-required protected files require checkpoint refs',
      });
    }
  });
export type SafeApplyResultV0 = z.infer<typeof SafeApplyResultV0>;
