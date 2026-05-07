/**
 * Type declarations for scripts/policy/flow-kind-policy.mjs.
 *
 * The JS module is the shared source of truth for flow-kind canonical
 * stage-set policy. src/shared/flow-kind-policy.ts imports it and adds the
 * CompiledFlow.safeParse wrapper used by runtime fixture loading.
 */

export type CompiledFlowKindPolicyEntry = {
  readonly canonicals: readonly string[];
  readonly omits: readonly string[];
  /**
   * Canonicals that may be either declared or omitted by per-mode variants.
   * When declared, they must NOT appear in stage_path_policy.omits. When absent
   * from declared stages, they MUST appear in stage_path_policy.omits.
   * Empty array for flow ids whose every canonical is mandatory.
   */
  readonly optional_canonicals: readonly string[];
  readonly title: string;
  readonly authority: string;
};

export const FLOW_KIND_CANONICAL_SETS: Record<string, CompiledFlowKindPolicyEntry>;

export const EXEMPT_FLOW_IDS: ReadonlySet<string>;

export type CompiledFlowKindPolicyCheckResult =
  | { kind: 'green'; detail: string }
  | { kind: 'exempt'; detail: string }
  | { kind: 'pass_through'; detail: string }
  | { kind: 'red'; detail: string };

export type ReviewIdentitySeparationPolicyResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string };

export function checkReviewIdentitySeparationPolicy(
  fixture: unknown,
): ReviewIdentitySeparationPolicyResult;

export function checkCompiledFlowKindCanonicalPolicy(
  fixture: unknown,
): CompiledFlowKindPolicyCheckResult;
