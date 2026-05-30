// The recovery-corridor state machine.
//
// A run enters a "recovery corridor" when a step takes a recovery route: later
// steps may legitimately re-enter already-completed steps until the corridor
// returns to its origin. This object owns that lifecycle (the activeRecovery
// state) so the graph-runner loop no longer mutates it inline. Methods are
// intention-revealing: the loop asks the corridor questions (is this the active
// route? is this a return to origin? what evidence backs the corridor?) and
// tells it about transitions (enter on a recovery route, clear when the origin
// step completes without recovery mechanics).
//
// This is a pure relocation of already-pure helpers; it performs no IO. The two
// graph-mechanics dependencies it needs — the "does this route carry recovery
// mechanics" predicate and the "latest step report / relay ref" resolver — are
// injected so the corridor stays decoupled from the loop's other concerns.

import type {
  RecoveryFailureCause,
  RecoveryRouteBindingV0,
} from '../../schemas/recovery-route-kind.js';
import type { Ref } from '../../schemas/ref.js';
import type { AcceptanceRetryFeedback } from '../acceptance-criteria.js';
import type { ExecutableStep } from '../manifest/executable-flow.js';
import type { RecoveryFailureEvidence } from './recovery-binding-verdict.js';

interface ActiveRecovery {
  readonly originStepId: string;
  readonly route: string;
  readonly reason?: string;
  readonly failure?: RecoveryFailureEvidence;
  readonly acceptanceFeedback?: AcceptanceRetryFeedback;
}

/** Decides whether a route on a step carries WorkContract recovery mechanics. */
export type RouteHasRecoveryMechanics = (input: {
  readonly step: ExecutableStep;
  readonly route: string | undefined;
}) => boolean;

/** Resolves the latest step.report_written / relay.result ref for an attempt. */
export type LatestStepReportOrRelayRef = (input: {
  readonly stepId: string;
  readonly attempt: number;
}) => Ref | undefined;

export interface RecoveryCorridorDeps {
  readonly steps: ReadonlyMap<string, ExecutableStep>;
  readonly bindings: readonly RecoveryRouteBindingV0[] | undefined;
  readonly routeHasRecoveryMechanics: RouteHasRecoveryMechanics;
  readonly latestStepReportOrRelayRef: LatestStepReportOrRelayRef;
}

export interface CorridorEnterInput {
  readonly originStepId: string;
  readonly route: string;
  readonly recoveryReason: unknown;
  readonly recoveryFailure: RecoveryFailureEvidence | undefined;
  readonly acceptanceFeedback: AcceptanceRetryFeedback | undefined;
}

export class RecoveryCorridor {
  private active: ActiveRecovery | undefined;

  constructor(private readonly deps: RecoveryCorridorDeps) {}

  /** True when `route` is the recovery route this corridor is currently traversing. */
  isActiveRoute(route: string | undefined): boolean {
    return route !== undefined && this.active?.route === route;
  }

  /**
   * True when stepping into `stepId` via `route` is a return toward the corridor
   * origin through non-recovery routes (so re-entering a completed step is legal).
   */
  isReturnToOrigin(input: {
    readonly stepId: string;
    readonly route: string | undefined;
  }): boolean {
    const active = this.active;
    if (active === undefined || this.isActiveRoute(input.route)) return false;
    return this.canReachStepViaNonRecoveryRoutes({
      fromStepId: input.stepId,
      targetStepId: active.originStepId,
    });
  }

  /** The "; last recovery reason: ..." suffix for cycle/budget abort messages. */
  lastReasonSuffix(): string {
    return this.active?.reason === undefined ? '' : `; last recovery reason: ${this.active.reason}`;
  }

  /**
   * Acceptance-retry feedback to surface when `stepId` re-enters as the corridor
   * origin via the active recovery route.
   */
  acceptanceFeedbackForReentry(input: {
    readonly stepId: string;
    readonly incomingRoute: string | undefined;
  }): AcceptanceRetryFeedback | undefined {
    if (this.active?.originStepId !== input.stepId) return undefined;
    if (!this.isActiveRoute(input.incomingRoute)) return undefined;
    return this.active.acceptanceFeedback;
  }

  /**
   * Failure evidence derived from the active corridor (when the completed route
   * has recovery mechanics but no direct failure evidence of its own).
   */
  evidenceFor(input: {
    readonly stepId: string;
    readonly attempt: number;
    readonly binding: RecoveryRouteBindingV0 | undefined;
  }): RecoveryFailureEvidence | undefined {
    const active = this.active;
    if (active?.failure === undefined) return undefined;
    const ref = this.deps.latestStepReportOrRelayRef({
      stepId: input.stepId,
      attempt: input.attempt,
    });
    if (ref === undefined) return undefined;
    return { ref, cause: corridorCause(active, input.binding) };
  }

  /** Enter / advance the corridor when a step takes a recovery route. */
  enter(input: CorridorEnterInput): void {
    const base: ActiveRecovery = {
      originStepId: input.originStepId,
      route: input.route,
      ...(input.recoveryFailure === undefined ? {} : { failure: input.recoveryFailure }),
      ...(input.acceptanceFeedback === undefined
        ? {}
        : { acceptanceFeedback: input.acceptanceFeedback }),
    };
    this.active =
      typeof input.recoveryReason === 'string' ? { ...base, reason: input.recoveryReason } : base;
  }

  /**
   * Clear the corridor when its origin step completes without taking a recovery
   * route (the corridor has returned and exited).
   */
  clearIfExitingOrigin(input: {
    readonly stepId: string;
    readonly routeHasRecoveryMechanics: boolean;
  }): void {
    if (
      this.active !== undefined &&
      this.active.originStepId === input.stepId &&
      !input.routeHasRecoveryMechanics
    ) {
      this.active = undefined;
    }
  }

  private canReachStepViaNonRecoveryRoutes(input: {
    readonly fromStepId: string;
    readonly targetStepId: string;
  }): boolean {
    if (input.fromStepId === input.targetStepId) return true;
    const seen = new Set<string>();
    const queue = [input.fromStepId];

    for (let index = 0; index < queue.length; index += 1) {
      const stepId = queue[index];
      if (stepId === undefined || seen.has(stepId)) continue;
      seen.add(stepId);
      const step = this.deps.steps.get(stepId);
      if (step === undefined) continue;
      for (const [route, target] of Object.entries(step.routes)) {
        if (this.deps.routeHasRecoveryMechanics({ step, route }) || target.kind !== 'step') {
          continue;
        }
        if (target.stepId === input.targetStepId) return true;
        queue.push(target.stepId);
      }
    }

    return false;
  }
}

function corridorCause(
  active: ActiveRecovery,
  binding: RecoveryRouteBindingV0 | undefined,
): RecoveryFailureCause {
  if (
    binding?.kind === 'checkpoint_authority' &&
    binding.allowed_failure_causes.includes('checkpoint_boundary')
  ) {
    return 'checkpoint_boundary';
  }
  return active.failure?.cause ?? 'unknown_failure';
}
