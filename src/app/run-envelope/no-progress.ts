// S6: stop the continuation loop from burning attempts when it is not actually
// getting closer to done. Two triggers escalate (to checkpoint/handoff/blocked)
// instead of retrying:
//   1. no-progress: two consecutive attempts leave the identical unmet-evidence set.
//   2. oscillation: the recovery route cycles (X -> Y -> X) with no net progress.
// Progress is defined as the unmet-required-evidence set shrinking.

export type AttemptProgress = {
  // Stable keys (e.g. evidence refs) of the required evidence still unmet after
  // this attempt.
  readonly unmetEvidence: readonly string[];
  // The process the loop ran for this attempt: the primary process id on the
  // first attempt, or the routed recovery flow afterward.
  readonly route: string;
};

export type ProgressReason = 'no-progress' | 'oscillation';

export type ProgressDecision = {
  readonly escalate: boolean;
  readonly reason: ProgressReason | null;
};

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((value) => seen.has(value));
}

function shrank(from: readonly string[], to: readonly string[]): boolean {
  return to.length < from.length;
}

export function detectNoProgress(attempts: readonly AttemptProgress[]): ProgressDecision {
  if (attempts.length >= 2) {
    const last = attempts[attempts.length - 1];
    const prev = attempts[attempts.length - 2];
    if (
      last !== undefined &&
      prev !== undefined &&
      sameSet(last.unmetEvidence, prev.unmetEvidence)
    ) {
      return { escalate: true, reason: 'no-progress' };
    }
  }

  if (attempts.length >= 3) {
    const first = attempts[attempts.length - 3];
    const middle = attempts[attempts.length - 2];
    const last = attempts[attempts.length - 1];
    if (first !== undefined && middle !== undefined && last !== undefined) {
      const oscillating = last.route === first.route && last.route !== middle.route;
      const noNetProgress = !shrank(first.unmetEvidence, last.unmetEvidence);
      if (oscillating && noNetProgress) {
        return { escalate: true, reason: 'oscillation' };
      }
    }
  }

  return { escalate: false, reason: null };
}
