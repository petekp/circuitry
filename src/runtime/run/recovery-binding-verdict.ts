// Pure WorkContract recovery-binding enforcement.
//
// Given the recovery evidence and binding resolved for a completed route, this
// returns whether the run must abort because the route violates its WorkContract
// recovery binding. It performs no IO: the graph-runner loop acts on the verdict
// (appending step.aborted and closing the run) so the binding rules stay
// unit-testable in isolation. The abort-reason strings are part of the runtime
// contract and are pinned by tests; do not change them.

import type {
  RecoveryFailureCause,
  RecoveryRouteBindingV0,
} from '../../schemas/recovery-route-kind.js';
import type { Ref } from '../../schemas/ref.js';

export interface RecoveryFailureEvidence {
  readonly ref: Ref;
  readonly cause: RecoveryFailureCause;
}

export interface RecoveryBindingVerdictInput {
  /** Present only when the run is bound by a WorkContract; binding rules are inert otherwise. */
  readonly workContractRef: Ref | undefined;
  readonly stepId: string;
  readonly stepKind: string;
  readonly route: string;
  /** Whether the selected route carries recovery mechanics (a matching binding shape). */
  readonly routeHasRecoveryMechanics: boolean;
  /** Failure evidence derived for the completed route, if any. */
  readonly recoveryFailure: RecoveryFailureEvidence | undefined;
  /** The WorkContract binding for the completed route, if one is declared. */
  readonly recoveryBinding: RecoveryRouteBindingV0 | undefined;
}

export type RecoveryBindingVerdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'abort'; readonly reason: string };

const OK: RecoveryBindingVerdict = { kind: 'ok' };

export function recoveryCauseAllowed(
  binding: RecoveryRouteBindingV0,
  cause: RecoveryFailureCause,
): boolean {
  return binding.allowed_failure_causes.includes(cause);
}

function missingRecoveryBindingReason(input: {
  readonly stepId: string;
  readonly route: string;
  readonly cause: RecoveryFailureCause;
}): string {
  return `step '${input.stepId}' selected recovery route '${input.route}' after ${input.cause} but the WorkContract does not declare a matching recovery binding`;
}

function recoveryCauseNotAllowedReason(input: {
  readonly stepId: string;
  readonly route: string;
  readonly cause: RecoveryFailureCause;
  readonly binding: RecoveryRouteBindingV0;
}): string {
  return `step '${input.stepId}' selected recovery route '${input.route}' for ${input.cause}, but its WorkContract binding only allows: ${input.binding.allowed_failure_causes.join(', ')}`;
}

function missingFailureEvidenceReason(input: {
  readonly stepId: string;
  readonly route: string;
}): string {
  return `step '${input.stepId}' selected recovery route '${input.route}' without failure evidence`;
}

/**
 * Decide whether a completed recovery route violates its WorkContract binding.
 *
 * Mirrors the three recovery-binding aborts the graph-runner loop previously
 * inlined, in order:
 *  1. recovery mechanics with no failure evidence  -> "without failure evidence"
 *  2. failure evidence with no matching binding     -> missingRecoveryBindingReason
 *  3. failure evidence whose cause the binding bans  -> recoveryCauseNotAllowedReason
 *
 * Returns `{ kind: 'ok' }` when the route is permitted (including every case
 * where no WorkContract binds the run).
 */
export function recoveryBindingVerdict(input: RecoveryBindingVerdictInput): RecoveryBindingVerdict {
  if (input.workContractRef === undefined) return OK;

  if (
    input.stepKind !== 'checkpoint' &&
    input.routeHasRecoveryMechanics &&
    input.recoveryFailure === undefined
  ) {
    return {
      kind: 'abort',
      reason: missingFailureEvidenceReason({ stepId: input.stepId, route: input.route }),
    };
  }

  if (input.recoveryFailure !== undefined) {
    if (input.recoveryBinding === undefined) {
      return {
        kind: 'abort',
        reason: missingRecoveryBindingReason({
          stepId: input.stepId,
          route: input.route,
          cause: input.recoveryFailure.cause,
        }),
      };
    }
    if (!recoveryCauseAllowed(input.recoveryBinding, input.recoveryFailure.cause)) {
      return {
        kind: 'abort',
        reason: recoveryCauseNotAllowedReason({
          stepId: input.stepId,
          route: input.route,
          cause: input.recoveryFailure.cause,
          binding: input.recoveryBinding,
        }),
      };
    }
  }

  return OK;
}
