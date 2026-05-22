import { z } from 'zod';
import { StepId } from './ids.js';
import { Ref } from './ref.js';

export const RecoveryRouteKind = z.enum([
  'retry_same_step_with_feedback',
  'narrow_scope',
  'run_verification',
  'run_independent_review',
  'checkpoint_authority',
  'safe_apply_reject',
  'stop_unsafe',
  'escalate',
  'handoff',
]);
export type RecoveryRouteKind = z.infer<typeof RecoveryRouteKind>;

export const RecoveryFailureCause = z.enum([
  'failed_check',
  'failed_acceptance_criteria',
  'weak_proof',
  'unproved_claim',
  'contradicted_evidence',
  'scope_drift',
  'checkpoint_boundary',
  'relay_connector_failed',
  'relay_result_invalid',
  'base_mismatch',
  'apply_conflict',
  'budget_exceeded',
  'protected_file_touched',
  'generated_surface_drift',
  'unknown_failure',
]);
export type RecoveryFailureCause = z.infer<typeof RecoveryFailureCause>;

export const RecoveryRequiredRefKind = z.enum([
  'failed_check',
  'acceptance_feedback',
  'proof_assessment',
  'runtime_diff',
  'relay_result',
  'checkpoint_request',
  'safe_apply_result',
  'budget_state',
  'change_packet',
  'generated_surface_evidence',
  'trace',
  'report',
]);
export type RecoveryRequiredRefKind = z.infer<typeof RecoveryRequiredRefKind>;

export const RecoveryOperatorAuthority = z.enum([
  'not_required',
  'required_before_route',
  'required_to_continue_after_route',
]);
export type RecoveryOperatorAuthority = z.infer<typeof RecoveryOperatorAuthority>;

const RecoveryAttemptBudget = z
  .object({
    consumes_step_attempt: z.boolean(),
    must_respect_max_attempts: z.boolean(),
    retry_target: z.enum(['same_step', 'declared_step']).optional(),
  })
  .strict();
export type RecoveryAttemptBudget = z.infer<typeof RecoveryAttemptBudget>;

const RecoveryGuidanceRule = z
  .object({
    subject: z.literal('recovery_route'),
    must_match_step_completed: z.literal(true),
  })
  .strict();
export type RecoveryGuidanceRule = z.infer<typeof RecoveryGuidanceRule>;

export const RecoveryRouteBindingV0 = z
  .object({
    schema_version: z.literal(0),
    step_id: StepId,
    route_id: z.string().min(1),
    route_target: z.string().min(1),
    kind: RecoveryRouteKind,
    allowed_failure_causes: z.array(RecoveryFailureCause).min(1),
    required_refs: z.array(RecoveryRequiredRefKind).min(1),
    operator_authority: RecoveryOperatorAuthority,
    attempt_budget: RecoveryAttemptBudget,
    guidance: RecoveryGuidanceRule,
    source_ref: Ref,
  })
  .strict()
  .superRefine((binding, ctx) => {
    const requiredRefs = new Set(binding.required_refs);
    const causes = new Set(binding.allowed_failure_causes);

    if (binding.kind === 'retry_same_step_with_feedback') {
      if (binding.route_target !== binding.step_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['route_target'],
          message: 'retry_same_step_with_feedback must target the same step',
        });
      }
      if (!requiredRefs.has('acceptance_feedback')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['required_refs'],
          message: 'retry_same_step_with_feedback requires acceptance_feedback refs',
        });
      }
      if (!binding.attempt_budget.consumes_step_attempt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attempt_budget', 'consumes_step_attempt'],
          message: 'retry_same_step_with_feedback consumes the step attempt budget',
        });
      }
      if (!binding.attempt_budget.must_respect_max_attempts) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attempt_budget', 'must_respect_max_attempts'],
          message: 'retry_same_step_with_feedback must respect max_attempts',
        });
      }
      if (binding.attempt_budget.retry_target !== 'same_step') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attempt_budget', 'retry_target'],
          message: 'retry_same_step_with_feedback requires retry_target same_step',
        });
      }
    }

    if (
      causes.has('unknown_failure') &&
      ['retry_same_step_with_feedback', 'run_verification', 'run_independent_review'].includes(
        binding.kind,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowed_failure_causes'],
        message: 'unknown_failure cannot route to retry, verification, or independent review',
      });
    }

    if (
      binding.kind === 'safe_apply_reject' &&
      !requiredRefs.has('safe_apply_result') &&
      !requiredRefs.has('runtime_diff') &&
      !requiredRefs.has('change_packet')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['required_refs'],
        message:
          'safe_apply_reject requires safe_apply_result, runtime_diff, or change_packet refs',
      });
    }

    if (causes.has('generated_surface_drift') && !requiredRefs.has('generated_surface_evidence')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['required_refs'],
        message: 'generated_surface_drift requires generated_surface_evidence refs',
      });
    }

    if (
      causes.has('protected_file_touched') &&
      !requiredRefs.has('runtime_diff') &&
      !requiredRefs.has('change_packet')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['required_refs'],
        message: 'protected_file_touched requires runtime_diff or change_packet refs',
      });
    }

    if (binding.source_ref.kind !== 'work_contract') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source_ref', 'kind'],
        message: 'recovery route bindings must point back to WorkContract refs',
      });
    }
  });
export type RecoveryRouteBindingV0 = z.infer<typeof RecoveryRouteBindingV0>;
