import type {
  RecoveryFailureCause,
  RecoveryRouteBindingV0,
} from '../../schemas/recovery-route-kind.js';
import type { Ref } from '../../schemas/ref.js';
import type { RouteTarget } from '../domain/route.js';

const FALLBACK_RECOVERY_ROUTE_ORDER = [
  'retry',
  'revise',
  'ask',
  'stop',
  'handoff',
  'escalate',
] as const;

interface StepWithRuntimeRoutes {
  readonly id: string;
  readonly routes: Readonly<Record<string, RouteTarget>>;
}

export interface RecoveryRouteForFailureInput {
  readonly step: StepWithRuntimeRoutes;
  readonly workContractRef?: Ref | undefined;
  readonly recoveryRouteBindings?: readonly RecoveryRouteBindingV0[] | undefined;
  readonly cause: RecoveryFailureCause;
  readonly preferredRoute?: string | undefined;
}

function routeTargetKey(target: RouteTarget): string {
  return target.kind === 'terminal' ? target.target : target.stepId;
}

function bindingMatches(input: {
  readonly step: StepWithRuntimeRoutes;
  readonly binding: RecoveryRouteBindingV0;
  readonly cause: RecoveryFailureCause;
}): boolean {
  if (input.binding.step_id !== input.step.id) return false;
  if (!input.binding.allowed_failure_causes.includes(input.cause)) return false;
  const target = input.step.routes[input.binding.route_id];
  return target !== undefined && input.binding.route_target === routeTargetKey(target);
}

function fallbackRouteByRecoveryOrder(step: StepWithRuntimeRoutes): string | undefined {
  return FALLBACK_RECOVERY_ROUTE_ORDER.find((route) => Object.hasOwn(step.routes, route));
}

export function recoveryBindingForFailure(
  input: RecoveryRouteForFailureInput,
): RecoveryRouteBindingV0 | undefined {
  const preferredRouteDeclared =
    input.preferredRoute !== undefined && Object.hasOwn(input.step.routes, input.preferredRoute);

  if (input.workContractRef === undefined) return undefined;

  const matchingBindings =
    input.recoveryRouteBindings?.filter((binding) =>
      bindingMatches({ step: input.step, binding, cause: input.cause }),
    ) ?? [];

  if (
    preferredRouteDeclared &&
    matchingBindings.some((binding) => binding.route_id === input.preferredRoute)
  ) {
    return matchingBindings.find((binding) => binding.route_id === input.preferredRoute);
  }

  return matchingBindings[0];
}

export function recoveryRouteForFailure(input: RecoveryRouteForFailureInput): string | undefined {
  if (input.workContractRef === undefined) {
    const preferredRouteDeclared =
      input.preferredRoute !== undefined && Object.hasOwn(input.step.routes, input.preferredRoute);
    if (preferredRouteDeclared) return input.preferredRoute;
    return fallbackRouteByRecoveryOrder(input.step);
  }

  return recoveryBindingForFailure(input)?.route_id;
}
