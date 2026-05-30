// Pure helpers shared across the step executors. Each helper here was
// duplicated verbatim across two or more executors (relay, verification,
// compose); hoisting keeps a single copy so the executors stay thin.
import { CompiledFlowId, RunId, StepId } from '../../schemas/ids.js';
import type { Ref } from '../../schemas/ref.js';
import { sha256Hex } from '../../shared/connector-relay.js';
import type { Routes } from '../domain/route.js';
import type { RunContext } from '../run/run-context.js';

// Normalizes an arbitrary string into a proof-id-safe fragment (lowercase,
// only [a-z0-9._-]). Used to build claim/evidence/assessment ids.
export function proofIdPart(value: string): string {
  return value.replace(/[^a-z0-9._-]/g, '-').toLowerCase();
}

// De-duplicates and sorts a list of strings (e.g. evidence kinds) for stable,
// canonical proof-policy inputs.
export function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

// Builds the durable Ref to a proof-assessment report written under
// `reports/proof/...`, hashing the exact on-disk JSON body.
export function proofAssessmentReportRef(input: {
  readonly context: RunContext;
  readonly stepId: string;
  readonly attempt: number;
  readonly path: string;
  readonly body: unknown;
}): Ref {
  return {
    kind: 'report',
    ref: input.path,
    sha256: sha256Hex(`${JSON.stringify(input.body, null, 2)}\n`),
    run_id: RunId.parse(input.context.runId),
    flow_id: CompiledFlowId.parse(input.context.flow.id),
    step_id: StepId.parse(input.stepId),
    attempt: input.attempt,
  };
}

// True when a step declares a terminal route to `@complete`, i.e. the step can
// close the run. Structural over `routes` so any executable step shape fits.
export function stepCanCloseRun(step: { readonly routes: Routes }): boolean {
  return Object.values(step.routes).some(
    (target) => target.kind === 'terminal' && target.target === '@complete',
  );
}

// Resolves a `route_from_report` dotted path against a report body, requiring
// each segment to descend into an object and the leaf to be a non-empty string.
export function readRouteFromReport(body: unknown, path: readonly string[]): string {
  let cursor = body;
  for (const segment of path) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
      throw new Error(
        `route_from_report path '${path.join('.')}' descended into a non-object at '${segment}'`,
      );
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  if (typeof cursor !== 'string' || cursor.length === 0) {
    throw new Error(
      `route_from_report path '${path.join('.')}' must resolve to a non-empty string`,
    );
  }
  return cursor;
}
