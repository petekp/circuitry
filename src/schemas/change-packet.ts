import { z } from 'zod';
export const WorkRootKind = z.enum([
  'isolated_worktree',
  'parent_checkout_diff_capture',
  'pre_safe_apply_trusted_write',
]);
export type WorkRootKind = z.infer<typeof WorkRootKind>;

export const ProtectedFileDecision = z.enum(['allowed', 'rejected', 'checkpointed']);
export type ProtectedFileDecision = z.infer<typeof ProtectedFileDecision>;

export const SafeApplyAction = z.enum(['rejected', 'accepted_for_review', 'applied']);
export type SafeApplyAction = z.infer<typeof SafeApplyAction>;

export const SafeApplyOutcome = z.enum(['pass', 'fail']);
export type SafeApplyOutcome = z.infer<typeof SafeApplyOutcome>;

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
