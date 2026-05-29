import type { ProcessEvidenceProjection } from '../schemas/process-evidence.js';
import type { RunGoalContract } from '../schemas/run-envelope.js';
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

export function attemptResultFromProjection(
  processId: string,
  projection: ProcessEvidenceProjection,
): AttemptResult {
  const missing = missingRunEvidence(projection);
  const outcome = attemptOutcomeFromProjection(projection, missing);
  // Single-claim model: Run authors one done_when claim whose required evidence
  // kind is the proof the selected process is expected to produce, so the unmet
  // kind is derived from the process id. processId is the flow that actually ran
  // (it matches projection.flow_id). The kind-blind ProcessEvidenceProjection
  // cannot yet report which specific evidence kind is missing; enriching it is a
  // deferred refinement (see docs/specs/run-envelope-goal-loop-migration-v1.md).
  // unmetKinds is only meaningful when evidence is unmet, so it is omitted on a
  // clean complete rather than asserting an unmet kind that does not exist.
  if (missing === undefined) {
    return { process_id: processId, outcome, unmetEvidence: [] };
  }
  return {
    process_id: processId,
    outcome,
    unmetEvidence: missing.missing_refs,
    unmetKinds: [requiredEvidenceKindForProcess(processId)],
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
      return attemptResultFromProjection(processId, run.projection);
    },
  });
}
