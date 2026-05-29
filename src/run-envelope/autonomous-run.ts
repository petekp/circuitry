import type { ProcessEvidenceProjection } from '../schemas/process-evidence.js';
import type { RunGoalContract } from '../schemas/run-envelope.js';
import {
  type AttemptOutcome,
  type AttemptResult,
  type LoopResult,
  runContinuationLoop,
} from './continuation-loop.js';
import { missingRunEvidence, requiredEvidenceKindForProcess } from './source-record.js';

// S10: the live adapter that makes the continuation loop real. It turns a
// flow run (projected as ProcessEvidenceProjection) into an AttemptResult the
// loop policy understands, then drives runContinuationLoop with an injected
// flow runner. The runner is injected so the CLI can supply real flow execution
// while tests supply deterministic projections.

function attemptOutcomeFromProjection(projection: ProcessEvidenceProjection): AttemptOutcome {
  switch (projection.outcome) {
    case 'complete':
      return missingRunEvidence(projection) === undefined ? 'complete' : 'needs_followup';
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
  return {
    process_id: processId,
    outcome: attemptOutcomeFromProjection(projection),
    unmetEvidence: missing === undefined ? [] : [...missing.missing_refs],
    unmetKinds: [requiredEvidenceKindForProcess(processId)],
  };
}

export type LiveFlowRun = {
  readonly projection: ProcessEvidenceProjection;
};

export type LiveFlowRunner = (input: {
  readonly processId: string;
  readonly attemptNumber: number;
  readonly goal: string;
}) => Promise<LiveFlowRun>;

export async function runAutonomousContinuation(input: {
  readonly contract: RunGoalContract;
  readonly primaryProcessId: string;
  readonly goal: string;
  readonly runFlow: LiveFlowRunner;
}): Promise<LoopResult> {
  return runContinuationLoop({
    contract: input.contract,
    primaryProcessId: input.primaryProcessId,
    runAttempt: async ({ processId, attemptNumber }) => {
      const run = await input.runFlow({ processId, attemptNumber, goal: input.goal });
      return attemptResultFromProjection(processId, run.projection);
    },
  });
}
