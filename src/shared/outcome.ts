// Failure-outcome reconciliation across Circuit's two outcome vocabularies.
//
// Circuit carries two outcome enums that mean overlapping things:
//   - RunClosedOutcome  (schemas/trace-entry.ts): complete | aborted | handoff
//                        | stopped | escalated
//   - RunEnvelopeOutcome (schemas/run-envelope.ts): complete | needs_attention
//                        | blocked | failed | handoff
//
// History/recall code receives the raw `outcome` string from whichever source
// produced it (result.json outcome/status/verdict, the trace run.closed
// outcome, or a report body), so it sees a MIX of both vocabularies. The
// canonical RunClosedOutcome -> RunEnvelopeOutcome mapping the codebase already
// uses (mapChildOutcome, attemptOutcomeFromProjection) is:
//
//   complete  -> complete          (success)
//   handoff   -> handoff           (neutral)
//   stopped   -> needs_attention   (neutral: a deliberate pause)
//   aborted   -> failed            (FAILURE)
//   escalated -> blocked           (FAILURE)
//
// So the faithful failure set, expressed across both vocabularies, is the
// union below. `escalated` is included deliberately: it maps to `blocked` and
// is emitted for @escalate terminals (graph-runner.ts); omitting it would leave
// a latent variant of the recall miss this reconciliation exists to fix. See
// docs/ideas/memory-phase0-failure-legibility-spec.md.
const FAILURE_OUTCOMES: ReadonlySet<string> = new Set([
  'aborted',
  'escalated',
  'failed',
  'blocked',
]);

/**
 * True when an outcome string denotes a failure in EITHER outcome vocabulary.
 * Neutral outcomes (`stopped`, `handoff`, `needs_attention`) and `complete`
 * are not failures. `undefined` (no recorded outcome) is not a failure.
 */
export function isFailureOutcome(outcome: string | undefined): boolean {
  return outcome !== undefined && FAILURE_OUTCOMES.has(outcome);
}
