import type { ProcessEvidenceProjection } from '../../schemas/process-evidence.js';
import type { RunGoalContract } from '../../schemas/run-envelope.js';
import {
  type AttemptOutcome,
  type AttemptResult,
  type LoopResult,
  runContinuationLoop,
} from './continuation-loop.js';
import {
  type MissingRunEvidence,
  missingRunEvidence,
  requiredEvidenceKindForProcess,
} from './source-record.js';

// S10: the live adapter that makes the continuation loop real. It turns a
// flow run (projected as ProcessEvidenceProjection) into an AttemptResult the
// loop policy understands, then drives runContinuationLoop with an injected
// flow runner. The runner is injected so the CLI can supply real flow execution
// while tests supply deterministic projections.

// `missing` is the result of missingRunEvidence(projection), computed once by the
// caller so we do not rebuild the evidence Set twice per projection.
function attemptOutcomeFromProjection(
  projection: ProcessEvidenceProjection,
  missing: MissingRunEvidence | undefined,
): AttemptOutcome {
  switch (projection.outcome) {
    case 'complete':
      return missing === undefined ? 'complete' : 'needs_followup';
    case 'checkpoint_waiting':
      return 'checkpoint';
    case 'handoff':
      return 'handoff';
    case 'failed':
    case 'aborted':
      return 'failed';
    default:
      return 'blocked';
  }
}

export function attemptResultFromProjection(projection: ProcessEvidenceProjection): AttemptResult {
  const missing = missingRunEvidence(projection);
  const outcome = attemptOutcomeFromProjection(projection, missing);
  // Single-claim model: the unmet evidence kind is the proof the flow that
  // actually ran was expected to produce, so both the attempt's process_id and
  // its unmet kind are derived from projection.flow_id (the flow the runtime
  // actually executed), not the requested route. In the live path the CLI
  // asserts the routed recovery fixture's id matches the route, so these are the
  // same; deriving from the projection keeps the loop honest if they ever
  // diverge. The kind-blind ProcessEvidenceProjection cannot yet report which
  // specific evidence kind is missing; enriching it is a deferred refinement
  // (see docs/specs/run-envelope-goal-loop-migration-v1.md). unmetKinds is only
  // meaningful when evidence is unmet, so it is omitted on a clean complete.
  const ranProcess = projection.flow_id;
  if (missing === undefined) {
    return { process_id: ranProcess, outcome, unmetEvidence: [] };
  }
  return {
    process_id: ranProcess,
    outcome,
    unmetEvidence: missing.missing_refs,
    unmetKinds: [requiredEvidenceKindForProcess(ranProcess)],
  };
}

export type LiveFlowRun = {
  readonly projection: ProcessEvidenceProjection;
};

export type LiveFlowRunner = (input: {
  readonly processId: string;
  readonly attemptNumber: number;
}) => Promise<LiveFlowRun>;

export async function runAutonomousContinuation(input: {
  readonly contract: RunGoalContract;
  readonly primaryProcessId: string;
  readonly runFlow: LiveFlowRunner;
}): Promise<LoopResult> {
  return runContinuationLoop({
    contract: input.contract,
    primaryProcessId: input.primaryProcessId,
    runAttempt: async ({ processId, attemptNumber }) => {
      const run = await input.runFlow({ processId, attemptNumber });
      return attemptResultFromProjection(run.projection);
    },
  });
}
