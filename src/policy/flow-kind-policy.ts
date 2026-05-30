import { CompiledFlow } from '../schemas/compiled-flow.js';
import {
  type CompiledFlowKindPolicyCheckResult,
  EXEMPT_FLOW_IDS,
  FLOW_KIND_CANONICAL_SETS,
  checkCompiledFlowKindCanonicalPolicy,
} from './flow-kind-policy-core.js';

// Wraps the canonical-set check from src/shared/flow-kind-policy-core.ts
// with a Zod CompiledFlow.safeParse pre-check, so CLI fixture loading
// rejects structurally-invalid or policy-invalid fixtures with a single call.

export { FLOW_KIND_CANONICAL_SETS, EXEMPT_FLOW_IDS };
export type { CompiledFlowKindPolicyCheckResult };

export type ValidateCompiledFlowKindPolicyResult =
  | { ok: true; kind: Exclude<CompiledFlowKindPolicyCheckResult['kind'], 'red'>; detail: string }
  | { ok: false; reason: string };

function humanizeZodIssueMessage(message: string): string {
  return message
    .replace(/, received undefined/g, ' (missing)')
    .replace(/\breceived undefined\b/g, 'missing');
}

/**
 * Validates that an unknown input is a valid CompiledFlow (Zod safeParse)
 * AND that its declared flow kind satisfies the canonical stage-set policy.
 *
 * Returns ok:false with a human-readable reason string. Callers decide whether
 * to throw or surface the reason directly.
 */
export function validateCompiledFlowKindPolicy(
  flow: unknown,
): ValidateCompiledFlowKindPolicyResult {
  const parsed = CompiledFlow.safeParse(flow);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .slice(0, 5)
      .map((i) => `  ${i.path.join('.') || '<root>'}: ${humanizeZodIssueMessage(i.message)}`)
      .join('\n');
    const more =
      parsed.error.issues.length > 5 ? `\n  ... +${parsed.error.issues.length - 5} more` : '';
    return {
      ok: false,
      reason: `CompiledFlow.safeParse failed:\n${issueSummary}${more}`,
    };
  }

  const policyResult = checkCompiledFlowKindCanonicalPolicy(parsed.data);
  if (policyResult.kind === 'red') {
    return {
      ok: false,
      reason: `flow-kind canonical policy violation: ${policyResult.detail}`,
    };
  }
  return {
    ok: true,
    kind: policyResult.kind,
    detail: policyResult.detail,
  };
}
