// CompiledFlow router — derives routing from src/flows/catalog.ts via
// buildRoutablePackages + findDefaultRoutablePackage.
//
// Each CompiledFlowPackage may declare routing metadata (signals, order,
// optional skipOnPlanningReport guard, default-fallback flag). The
// router walks packages in `order` ascending; positive signal matches
// route directly to that package. When `skipOnPlanningReport` is set
// AND the request mentions a planning report, the match is treated
// as a non-match and routing falls through to subsequent packages.
// The package marked `isDefault` is selected when nothing matches.

import {
  type RoutablePackage,
  buildRoutablePackages,
  findDefaultRoutablePackage,
} from './catalog-derivations.js';
import { flowPackages } from './catalog.js';
import type { CompiledFlowPackage } from './types.js';

const ROUTABLE_PACKAGES = buildRoutablePackages(flowPackages);
const DEFAULT_PACKAGE = findDefaultRoutablePackage(ROUTABLE_PACKAGES);

export const ROUTABLE_WORKFLOWS: readonly string[] = Object.freeze(
  ROUTABLE_PACKAGES.map((entry) => entry.pkg.id),
);

interface CompiledFlowRouteDecision {
  flowName: string;
  source: 'classifier';
  reason: string;
  matched_signal?: string;
  inferredEntryModeName?: string;
  inferredEntryModeReason?: string;
}

const PLANNING_ARTIFACT_SIGNAL =
  /\b(?:proposal|plan|brief|matrix|evaluation\s+matrix|design\s+doc|design\s+document|spec|specification|rfc|memo|document|doc|guide|analysis|evaluation|selection|strategy|outline|report|comparison|recommendation|write-?up|options|approaches)\b/i;

const PLAN_EXECUTION_SIGNAL =
  /^\s*(?:execute|run|start|begin|work\s+through|carry\s+out|tackle)\s+(?:this\s+|the\s+)?(?:[\w-]+\s+){0,3}(?:plan|backlog|checklist|roadmap|doc|document)(?::|\b)/i;

// Plan-execution routing target: a flow id resolved against the live
// routable set plus its bespoke plan-execution reason and entry mode.
// The entry-mode rationale here is intentionally distinct from each
// flow's own routing.inferEntryMode rules (which key on develop:/decide:/
// flaky etc.) — plan execution is a separate router-level concern.
interface PlanExecutionTarget {
  readonly flowId: string;
  readonly reason: string;
  readonly inferredEntryModeName: string;
  readonly inferredEntryModeReason: string;
}

// Resolve a plan-execution target's flow id against the routable set so
// the classifier dispatches through the catalog rather than emitting a
// literal flow-name string. The default package is searched too, since
// explore (the plan-execution decision target) is the default and is
// excluded from the iterated routables loop elsewhere.
function resolvePlanExecutionFlowName(
  flowId: string,
  routables: readonly RoutablePackage[],
  defaultPackage: RoutablePackage,
): string {
  if (defaultPackage.pkg.id === flowId) return defaultPackage.pkg.id;
  const match = routables.find((entry) => entry.pkg.id === flowId);
  if (match === undefined) {
    throw new Error(`plan-execution target '${flowId}' is not a routable flow`);
  }
  return match.pkg.id;
}

function classifyPlanExecutionRequest(
  taskText: string,
  routables: readonly RoutablePackage[],
  defaultPackage: RoutablePackage,
): CompiledFlowRouteDecision | undefined {
  if (!PLAN_EXECUTION_SIGNAL.test(taskText)) return undefined;
  const lower = taskText.toLowerCase();
  let target: PlanExecutionTarget;
  if (/\b(?:decide|decision|choose|choice|option|options|tradeoff|trade-off)\b/.test(lower)) {
    target = {
      flowId: 'explore',
      reason: 'matched plan-execution request; selected Explore tournament for a blocking decision',
      inferredEntryModeName: 'tournament',
      inferredEntryModeReason:
        'matched decision-oriented plan execution; selected Explore tournament mode',
    };
  } else if (
    /\b(?:fix|bug|regression|flaky|incident|outage|debug|diagnose|crash|failure)\b/.test(lower)
  ) {
    target = {
      flowId: 'fix',
      reason: 'matched plan-execution request; selected Fix for the first bug-fix slice',
      inferredEntryModeName: 'deep',
      inferredEntryModeReason:
        'matched bug-fix-oriented plan execution; selected deep thoroughness',
    };
  } else {
    target = {
      flowId: 'build',
      reason: 'matched plan-execution request; selected Build to start the first executable slice',
      inferredEntryModeName: 'default',
      inferredEntryModeReason:
        'matched general plan execution; selected default Build thoroughness',
    };
  }
  return {
    flowName: resolvePlanExecutionFlowName(target.flowId, routables, defaultPackage),
    source: 'classifier',
    matched_signal: 'plan-execution',
    reason: target.reason,
    inferredEntryModeName: target.inferredEntryModeName,
    inferredEntryModeReason: target.inferredEntryModeReason,
  };
}

// Dispatch entry-mode inference through the selected flow's routing
// metadata. Searches the routable set and the default package (explore,
// which carries the decide: rule but is excluded from the iterated
// loop) for the flow, then runs its declarative inferEntryMode rule.
function inferEntryMode(
  flowName: string,
  taskText: string,
  routables: readonly RoutablePackage[],
  defaultPackage: RoutablePackage,
): Pick<CompiledFlowRouteDecision, 'inferredEntryModeName' | 'inferredEntryModeReason'> {
  const entry =
    defaultPackage.pkg.id === flowName
      ? defaultPackage
      : routables.find((candidate) => candidate.pkg.id === flowName);
  const inferred = entry?.routing.inferEntryMode?.(taskText);
  if (inferred === undefined) return {};
  return {
    inferredEntryModeName: inferred.name,
    inferredEntryModeReason: inferred.reason,
  };
}

// Pure classifier: takes pre-derived routables and a default package.
// The exported classifyCompiledFlowTask is a thin wrapper that binds the
// live catalog. Pulling the logic out lets tests exercise routing
// invariants (order precedence, isDefault selection, planning-report
// suppression) against synthetic mini-catalogs without vi.mock churn.
export function classifyTaskAgainstRoutables(
  taskText: string,
  routables: readonly RoutablePackage[],
  defaultPackage: RoutablePackage,
): CompiledFlowRouteDecision {
  const planExecution = classifyPlanExecutionRequest(taskText, routables, defaultPackage);
  if (planExecution !== undefined) return planExecution;

  const hasPlanningReport = PLANNING_ARTIFACT_SIGNAL.test(taskText);
  for (const { pkg, routing } of routables) {
    if (routing.isDefault) continue;
    for (const signal of routing.signals) {
      if (!signal.pattern.test(taskText)) continue;
      if (routing.skipOnPlanningReport === true && hasPlanningReport) {
        // Match is suppressed by the planning-report guard. Fall
        // through to the next package's signals — preserves the
        // pre-catalog router's break-then-fall-through behavior.
        break;
      }
      return {
        flowName: pkg.id,
        source: 'classifier',
        matched_signal: signal.label,
        reason: routing.reasonForMatch(signal),
        ...inferEntryMode(pkg.id, taskText, routables, defaultPackage),
      };
    }
  }
  const inferred = inferEntryMode(defaultPackage.pkg.id, taskText, routables, defaultPackage);
  return {
    flowName: defaultPackage.pkg.id,
    source: 'classifier',
    reason:
      inferred.inferredEntryModeReason ??
      defaultPackage.routing.defaultReason ??
      `no signal matched; routed to ${defaultPackage.pkg.id} as the conservative default`,
    ...inferred,
  };
}

export function classifyCompiledFlowTask(taskText: string): CompiledFlowRouteDecision {
  return classifyTaskAgainstRoutables(taskText, ROUTABLE_PACKAGES, DEFAULT_PACKAGE);
}

// Test seam: build the routable + default pair from a synthetic
// package set so behavioral tests can exercise the classifier
// independent of the live catalog.
export function deriveRoutingForTesting(packages: readonly CompiledFlowPackage[]): {
  readonly routables: readonly RoutablePackage[];
  readonly defaultPackage: RoutablePackage;
} {
  const routables = buildRoutablePackages(packages);
  const defaultPackage = findDefaultRoutablePackage(routables);
  return { routables, defaultPackage };
}
