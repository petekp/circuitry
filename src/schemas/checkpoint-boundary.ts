import { z } from 'zod';
import { CheckpointSelectionCheck } from './check.js';
import { StepId } from './ids.js';
import { Ref, Sha256 } from './ref.js';
import { CheckpointChoiceSource } from './runtime-source.js';
import { RunRelativePath } from './scalars.js';
import { ReportRef } from './step.js';

export const CheckpointReasonCode = z.enum([
  'scope_expansion',
  'protected_files',
  'weak_proof',
  'unsafe_apply',
  'budget_exceeded',
  'ambiguous_intent',
]);
export type CheckpointReasonCode = z.infer<typeof CheckpointReasonCode>;

export const CheckpointAuthorityRequired = z.enum(['operator', 'policy']);
export type CheckpointAuthorityRequired = z.infer<typeof CheckpointAuthorityRequired>;

export const CheckpointRouteTarget = z.union([
  StepId,
  z.enum(['@complete', '@stop', '@handoff', '@escalate']),
]);
export type CheckpointRouteTarget = z.infer<typeof CheckpointRouteTarget>;

export const PolicyRef = Ref.superRefine((ref, ctx) => {
  if (ref.kind !== 'policy') {
    ctx.addIssue({
      code: 'custom',
      path: ['kind'],
      message: 'checkpoint declared defaults require policy refs',
    });
  }
});
export type PolicyRef = z.infer<typeof PolicyRef>;

export const CheckpointBoundaryRoute = z
  .object({
    id: z.string().min(1),
    target: CheckpointRouteTarget,
  })
  .strict();
export type CheckpointBoundaryRoute = z.infer<typeof CheckpointBoundaryRoute>;

export const CheckpointBoundaryChoice = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    route: CheckpointBoundaryRoute,
    consequence: z.string().min(1),
  })
  .strict();
export type CheckpointBoundaryChoice = z.infer<typeof CheckpointBoundaryChoice>;

export const CheckpointBoundaryChoices = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('static'),
      items: z.array(CheckpointBoundaryChoice).min(1),
    })
    .strict()
    .superRefine((choices, ctx) => {
      const ids = new Set<string>();
      for (const [index, choice] of choices.items.entries()) {
        if (ids.has(choice.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', index, 'id'],
            message: `duplicate checkpoint choice '${choice.id}'`,
          });
        }
        ids.add(choice.id);
      }
    }),
  z
    .object({
      kind: z.literal('dynamic'),
      source: CheckpointChoiceSource,
      route_family: CheckpointBoundaryRoute,
      consequence_template: z.string().min(1),
    })
    .strict(),
]);
export type CheckpointBoundaryChoices = z.infer<typeof CheckpointBoundaryChoices>;

export const DeclaredCheckpointDefault = z
  .object({
    choice_id: z.string().min(1),
    allowed_when: z.array(PolicyRef).min(1),
    reason_code: z.string().min(1),
  })
  .strict();
export type DeclaredCheckpointDefault = z.infer<typeof DeclaredCheckpointDefault>;

export const CheckpointBoundaryV0 = z
  .object({
    schema_version: z.literal(0),
    step_id: StepId,
    reason_code: CheckpointReasonCode,
    authority_required: CheckpointAuthorityRequired,
    prompt: z.string().min(1),
    choices: CheckpointBoundaryChoices,
    declared_default: DeclaredCheckpointDefault.optional(),
    writes: z
      .object({
        request: RunRelativePath,
        response: RunRelativePath,
        report: ReportRef.optional(),
      })
      .strict(),
    check: CheckpointSelectionCheck,
    proof_refs: z.array(Ref).default([]),
  })
  .strict()
  .superRefine((boundary, ctx) => {
    if (boundary.declared_default === undefined) return;
    if (boundary.choices.kind === 'dynamic') {
      ctx.addIssue({
        code: 'custom',
        path: ['declared_default'],
        message: 'declared defaults require static checkpoint choices in V0',
      });
      return;
    }
    const choiceIds = new Set(boundary.choices.items.map((choice) => choice.id));
    if (!choiceIds.has(boundary.declared_default.choice_id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['declared_default', 'choice_id'],
        message: 'declared_default.choice_id must name a declared checkpoint choice',
      });
    }
  });
export type CheckpointBoundaryV0 = z.infer<typeof CheckpointBoundaryV0>;

export const CheckpointBoundaryRequestTraceLinkV0 = z
  .object({
    boundary_ref: Ref,
    boundary_hash: Sha256,
    auto_resolved: z.literal(false).optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.boundary_ref.kind !== 'work_contract') {
      ctx.addIssue({
        code: 'custom',
        path: ['boundary_ref', 'kind'],
        message: 'checkpoint boundary refs must be work_contract refs',
      });
    }
    if (request.boundary_ref.step_id === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['boundary_ref', 'step_id'],
        message: 'checkpoint boundary refs must include step_id',
      });
    }
    if (request.boundary_ref.sha256 !== request.boundary_hash) {
      ctx.addIssue({
        code: 'custom',
        path: ['boundary_hash'],
        message: 'checkpoint boundary_hash must match boundary_ref.sha256',
      });
    }
  });
export type CheckpointBoundaryRequestTraceLinkV0 = z.infer<
  typeof CheckpointBoundaryRequestTraceLinkV0
>;

export const CheckpointBoundaryRequestedTraceV0 = z
  .object({
    step_id: StepId,
    attempt: z.number().int().positive(),
    options: z.array(z.string().min(1)).min(1),
    request_path: RunRelativePath,
    request_report_hash: Sha256,
    boundary_ref: Ref,
    boundary_hash: Sha256,
    auto_resolved: z.literal(false).optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.boundary_ref.kind !== 'work_contract') {
      ctx.addIssue({
        code: 'custom',
        path: ['boundary_ref', 'kind'],
        message: 'checkpoint boundary refs must be work_contract refs',
      });
    }
    if (request.boundary_ref.step_id === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['boundary_ref', 'step_id'],
        message: 'checkpoint boundary refs must include step_id',
      });
    } else if (request.boundary_ref.step_id !== request.step_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['boundary_ref', 'step_id'],
        message: 'checkpoint boundary ref step_id must match the requested checkpoint step_id',
      });
    }
    if (request.boundary_ref.sha256 !== request.boundary_hash) {
      ctx.addIssue({
        code: 'custom',
        path: ['boundary_hash'],
        message: 'checkpoint boundary_hash must match boundary_ref.sha256',
      });
    }
  });
export type CheckpointBoundaryRequestedTraceV0 = z.infer<typeof CheckpointBoundaryRequestedTraceV0>;

export const CheckpointBoundaryResolutionSource = z.enum([
  'operator',
  'declared-default',
  'policy',
]);
export type CheckpointBoundaryResolutionSource = z.infer<typeof CheckpointBoundaryResolutionSource>;

export const CheckpointBoundaryResolutionV0 = z
  .object({
    selection: z.string().min(1),
    route_id: z.string().min(1),
    auto_resolved: z.boolean(),
    resolution_source: CheckpointBoundaryResolutionSource,
  })
  .strict()
  .superRefine((resolution, ctx) => {
    if (resolution.resolution_source === 'operator' && resolution.auto_resolved) {
      ctx.addIssue({
        code: 'custom',
        path: ['auto_resolved'],
        message: 'operator checkpoint resolutions cannot be auto-resolved',
      });
    }
  });
export type CheckpointBoundaryResolutionV0 = z.infer<typeof CheckpointBoundaryResolutionV0>;

export const CheckpointResumeValidationV0 = z
  .object({
    request_path_matches_step: z.literal(true),
    request_hash_required: z.literal(true),
    choices_match_request: z.literal(true),
    selected_choice_allowed: z.literal(true),
    report_hash_matches_when_present: z.literal(true),
    boundary_hash_required: z.literal(true),
    guidance_decision_required_before_resolution: z.literal(true),
  })
  .strict();
export type CheckpointResumeValidationV0 = z.infer<typeof CheckpointResumeValidationV0>;

export const CheckpointBoundaryRejectedAuthority = z
  .object({
    path: z.string().min(1),
    field: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();
export type CheckpointBoundaryRejectedAuthority = z.infer<
  typeof CheckpointBoundaryRejectedAuthority
>;

export const CheckpointBoundaryProjectionV0 = z
  .object({
    schema_version: z.literal(0),
    boundary: CheckpointBoundaryV0,
    request_trace: CheckpointBoundaryRequestTraceLinkV0,
    allowed_resolution_sources: z.array(CheckpointBoundaryResolutionSource).min(1),
    resume_validation: CheckpointResumeValidationV0,
    rejected_old_authority: z.array(CheckpointBoundaryRejectedAuthority),
  })
  .strict();
export type CheckpointBoundaryProjectionV0 = z.infer<typeof CheckpointBoundaryProjectionV0>;
