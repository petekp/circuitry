import type { RunGoalContract, RunRequiredEvidenceKind } from '../schemas/run-envelope.js';
import { contractQualityReview } from './contract-quality.js';
import { type AttemptProgress, detectNoProgress } from './no-progress.js';
import { recoveryRouteForUnmetKinds, requiredEvidenceKindForProcess } from './source-record.js';

// S7: the bounded in-process continuation loop. It ties the loop machinery
// together (S4 contract-quality gate, S5 recovery router, S6 no-progress
// detector) and enforces the central safety property: Run never closes complete
// by exhaustion. The loop policy is pure and side-effect free; the actual work of
// running a child process is injected as `runAttempt`, so the policy is provable
// without spawning real runs. The CLI adapter supplies a runner that executes a
// process and projects its evidence into an AttemptResult.

export type AttemptOutcome =
  | 'complete'
  | 'needs_followup'
  | 'blocked'
  | 'failed'
  | 'handoff'
  | 'checkpoint';

export type AttemptResult = {
  readonly process_id: string;
  readonly outcome: AttemptOutcome;
  // Stable keys (e.g. evidence refs) of required evidence still unmet after this
  // attempt. Empty when the attempt is complete.
  readonly unmetEvidence: readonly string[];
  // Optional explicit unmet kinds; when absent the loop derives the kind from the
  // process that produced the attempt (the single-claim model).
  readonly unmetKinds?: readonly RunRequiredEvidenceKind[];
};

export type AttemptRunner = (input: {
  readonly processId: string;
  readonly attemptNumber: number;
}) => AttemptResult | Promise<AttemptResult>;

export type LoopOutcome = 'complete' | 'needs_attention' | 'blocked' | 'failed' | 'handoff';

export type LoopResult = {
  readonly outcome: LoopOutcome;
  readonly attempts: readonly AttemptResult[];
  readonly stopReason: string;
};

export async function runContinuationLoop(input: {
  readonly contract: RunGoalContract;
  readonly primaryProcessId: string;
  readonly runAttempt: AttemptRunner;
}): Promise<LoopResult> {
  // S4: refuse to even start on a contract too weak to prove its objective.
  const quality = contractQualityReview(input.contract);
  if (quality.verdict === 'blocked') {
    const detail = quality.findings[0]?.text ?? 'The contract is too weak to prove the objective.';
    return {
      outcome: 'needs_attention',
      attempts: [],
      stopReason: `contract-quality blocked before any attempt: ${detail}`,
    };
  }

  const maxAttempts = input.contract.recovery_policy.max_process_attempts;
  const attempts: AttemptResult[] = [];
  const progress: AttemptProgress[] = [];
  let currentProcess = input.primaryProcessId;

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    const result = await input.runAttempt({ processId: currentProcess, attemptNumber });
    attempts.push(result);

    if (result.outcome === 'complete') {
      return { outcome: 'complete', attempts, stopReason: 'required evidence satisfied' };
    }
    if (result.outcome === 'checkpoint') {
      return { outcome: 'needs_attention', attempts, stopReason: 'stopped at operator checkpoint' };
    }
    if (result.outcome === 'handoff') {
      return { outcome: 'handoff', attempts, stopReason: 'process handed off before closure' };
    }
    if (result.outcome === 'failed') {
      return { outcome: 'failed', attempts, stopReason: 'process failed' };
    }
    if (result.outcome === 'blocked') {
      return { outcome: 'blocked', attempts, stopReason: 'process blocked' };
    }

    // needs_followup: decide whether continuing is worthwhile.
    progress.push({ unmetEvidence: result.unmetEvidence, route: currentProcess });
    const noProgress = detectNoProgress(progress);
    if (noProgress.escalate) {
      return {
        outcome: 'needs_attention',
        attempts,
        stopReason: `escalated on no-progress (${noProgress.reason})`,
      };
    }

    if (attemptNumber >= maxAttempts) break;

    const unmetKinds = result.unmetKinds ?? [requiredEvidenceKindForProcess(currentProcess)];
    const nextRoute = recoveryRouteForUnmetKinds(unmetKinds);
    if (nextRoute === 'checkpoint') {
      return {
        outcome: 'needs_attention',
        attempts,
        stopReason: 'recovery requires an operator checkpoint',
      };
    }
    currentProcess = nextRoute;
  }

  // Exhaustion is an honest non-complete stop, never a silent completion.
  return {
    outcome: 'needs_attention',
    attempts,
    stopReason: `stopped at attempt limit: ran ${attempts.length} attempt(s); required evidence remains unmet`,
  };
}
