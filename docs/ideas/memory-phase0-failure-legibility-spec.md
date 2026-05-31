# Implementation spec: failure-outcome reconciliation + Phase 0 legibility

Status: implemented. This slice is now represented in
`src/shared/outcome.ts`, `src/app/history/extract.ts`,
`src/app/history/query.ts`, `src/app/history/memory-preview.ts`,
`src/app/run-envelope/source-record.ts`, and the focused
`memory-failure-legibility` / history tests. Scope: the first uncontested slice
of the effective-memory program
(see [`effective-memory-program.md`](effective-memory-program.md)).
Does **not** include Phase 2 (canonical-report capture), which stays gated on
its prerequisite.

## Why

The circuit-land recall miss was a retrieval + wiring gap, not a capture gap.
The fix text was captured several ways, but the failure was never surfaced
because two things were wrong:

1. **Two outcome vocabularies, one partial failure check.** Circuit has two
   outcome enums:
   - `RunClosedOutcome` (`src/schemas/trace-entry.ts:387`):
     `complete | aborted | handoff | stopped | escalated`
   - `RunEnvelopeOutcome` (`src/schemas/run-envelope.ts:8`):
     `complete | needs_attention | blocked | failed | handoff`

   The history extractor's `buildFacets` (`src/app/history/extract.ts:331`)
   only treats `outcome === 'aborted'` as a failure. The `outcome` string it
   receives is a mix of both vocabularies (it comes from `result.json`
   `outcome`/`status`/`verdict`, the trace `run.closed` outcome, or a report
   body — see `resolveRunIdentity` at `extract.ts:470` and `makeReportDocument`
   at `extract.ts:581`). So a run or report that closed `failed`, `blocked`, or
   `escalated` never gets the `failure` facet.

2. **The ranker keys off that facet.** `facetBoost` in
   `src/app/history/query.ts:122` only boosts a doc when the query carries a
   failure term **and** the doc has the `failure` facet. No facet → no boost →
   the failure (and the fix captured alongside it) sinks below goal-lexical
   matches. And even when a failure doc is retrieved, the operator-facing text
   leads with the goal or a low-signal lexical snippet rather than what went
   wrong.

## The canonical mapping (the reconciliation)

The codebase already maps `RunClosedOutcome → RunEnvelopeOutcome` consistently
in `mapChildOutcome` (`src/flows/goal/writers/attempt.ts:22`) and
`attemptOutcomeFromProjection` (`src/app/run-envelope/autonomous-run.ts:27`):

| RunClosedOutcome | maps to | failure? |
|---|---|---|
| `complete` | `complete` | no |
| `handoff` | `handoff` | no |
| `stopped` | `needs_attention` | no (deliberate pause) |
| `aborted` | `failed` | **yes** |
| `escalated` | `blocked` (default branch) | **yes** |

`RunEnvelopeOutcome` failures are `failed` and `blocked` (per
`memory-effect.ts:64` and `memory-merge.ts:55`, which count `blocked | failed`
as adverse and treat `needs_attention | handoff` as neutral).

**Faithful failure set = the union across both vocabularies:**
`{ aborted, escalated, failed, blocked }`.

### Deviation from the aligned `{aborted, failed, blocked}` — flagged

The handoff aligned on `{aborted, failed, blocked}`. The pre-build probe
(AGENTS rule 8) found that omits **`escalated`**, which `mapChildOutcome` routes
to `blocked` (a failure) and which `graph-runner.ts:123` emits for `@escalate`
terminals. Excluding it would leave a latent variant of the exact bug we are
fixing: an escalated run would not get the `failure` facet.

Decision: include `escalated`. The predicate covers
`{ aborted, escalated, failed, blocked }`. `stopped`, `handoff`,
`needs_attention`, and `complete` stay excluded (neutral or success per the
table above). This is a strict superset of the aligned set, strictly safer for
recall, and internally consistent with the existing child-outcome mapping. If
this is wrong, the fix is one entry in one array.

### Distiller clarification — flagged

The handoff named "the distiller" as a consumer of the predicate. Grounding
shows `distillProjectFacts` (`src/memory/project-distill.ts`) clusters
`step.aborted` **trace** entries, not run outcomes — it never reads an outcome
string. So it is **not** a consumer of `isFailureOutcome` today, and this slice
does not add a contrived call there. Broadening the distiller's trace-kind
scope (e.g. to `relay.failed`) is a capture change and belongs with the gated
Phase 2 work, not here.

## Outcome (what must be true when finished)

- A shared `isFailureOutcome(outcome: string | undefined): boolean` exists and
  returns true for exactly `{ aborted, escalated, failed, blocked }`.
- `buildFacets` adds the `failure` facet for every failure outcome in either
  vocabulary, not just `aborted`.
- The equivalent ad-hoc checks in `memory-effect.ts` and `memory-merge.ts` use
  the shared predicate where doing so is behavior-preserving.
- Failure docs surface legibly: the recall hint leads with the failure summary,
  and the run document's summary leads with the failure reason.
- The `failed` run-close surface is labelled as a failure, not "Stopped".
- `npm run verify` is green.

## Sites and changes

### 1. Shared predicate — `src/shared/outcome.ts` (new)

`src/shared` is the common-denominator layer already imported by both
`src/app/history/*` and `src/memory/*` (both import `sha256Hex` from
`shared/connector-relay.js`), so it has no layering problem.

```ts
const FAILURE_OUTCOMES = new Set(['aborted', 'escalated', 'failed', 'blocked']);

/**
 * True when a run/report outcome string denotes a failure in EITHER outcome
 * vocabulary (RunClosedOutcome or RunEnvelopeOutcome). See
 * docs/ideas/memory-phase0-failure-legibility-spec.md for the mapping.
 * Excludes neutral outcomes (stopped, handoff, needs_attention) and complete.
 */
export function isFailureOutcome(outcome: string | undefined): boolean {
  return outcome !== undefined && FAILURE_OUTCOMES.has(outcome);
}
```

### 2. `buildFacets` reconciliation — `src/app/history/extract.ts:331`

Replace the `input.outcome === 'aborted'` arm of the failure condition with
`isFailureOutcome(input.outcome)`. The other failure signals
(`traceKind === 'relay.failed'`, `step.aborted`, `checkOutcome === 'fail'`)
stay as-is.

### 3. Recall legibility — `src/app/history/memory-preview.ts:25` `hintText`

On a `prior_failure` hit (the same condition `appliesTo` uses:
`facets.has('failure')`), lead the hint text with `hit.doc.summary` instead of
the lexical `snippet`. Keep the `Source:` line and the caution suffix. For
non-failure hits, behavior is unchanged (snippet-first).

### 4. Capture legibility — `src/app/history/extract.ts:485` `makeRunDocument`

The summary currently prefers `firstHighValue(['summary','reason','goal',
'outcome','verdict'])`. For a failure run (`isFailureOutcome(identity.outcome)`),
prefer the failure reason first: try `['reason','summary',...]` so the run doc
summary reads as what went wrong rather than a goal restatement or a bare
"Run closed with outcome aborted." Non-failure runs keep today's ordering.

### 5. Run-close surface label — `src/app/run-envelope/source-record.ts:576`

`surfaceFor` handles `complete | needs_attention | blocked | handoff`
explicitly and lets `failed` fall through to a branch whose `status_text`
begins "Stopped:". A `failed` run is not stopped. Give `failed` an explicit
branch with failure-legible `status_text` and `next_action`. (Inputs available
to `surfaceFor` do not include a free-text reason, so this is a labelling fix,
not a summary-injection.)

### 6. The "run.md surface" — resolved to `operator-summary.md`

No file literally named `run.md` is produced. The operator-facing run summary
markdown is `operator-summary.md`, written by
`src/shared/operator-summary-writer.ts`. It had the **same two-vocabulary bug**:
it gated the failure reason detail and the failure headline on
`outcome === 'aborted'` only. `RunResult.outcome` is `RunClosedOutcome`, so the
failure-reachable outcomes here are `aborted` **and** `escalated` — and an
`escalated` run got neither treatment. The reproduction proved it renders as a
false success: an escalated review run produced the headline
`"Circuit: Review complete. Verdict: review complete. Findings: 0."`.

Fix: add explicit `escalated` branches mirroring `aborted` — an
`"Escalation reason: …"` detail and a `"Circuit: Run escalated."` headline.
This surface uses explicit per-outcome branches rather than the shared
predicate because the operator wording differs per outcome (`Abort reason` /
`Run aborted.` vs `Escalation reason` / `Run escalated.`); the predicate governs
the machine-facing facet and adverse-count surfaces where the wording is
uniform. `aborted` behavior is unchanged.

## Verification surface

Failing-first reproductions (new `tests/unit/memory-failure-legibility.test.ts`),
each grounded in the circuit-land corpus shapes (`result.json` with
`outcome` + `summary` + `reason`; `failure` facet on the doc):

- **A — facet:** the realistic newly-covered failures get the `failure` facet.
  An `escalated` run (the run-level failure the old `aborted`-only check
  missed; `RunResult.outcome` is `RunClosedOutcome`, so `failed`/`blocked`
  never appear on a run result) and report bodies whose `outcome` is `blocked`
  or `failed` (envelope vocabulary, reachable only through reports) all produce
  docs whose `facets` include `failure`. Each fails on the pre-fix
  `buildFacets`.
- **B — recall:** a `HistoryQueryHit` with `facets` including `failure`, a
  low-signal `snippet`, and a high-signal `summary` yields a hint that leads
  with the summary. Fails today.
- **C — capture:** a failure run whose `result.json` has
  `summary: "Run closed with outcome aborted."` and a distinct `reason`
  produces a run doc summary that leads with the reason. Fails today.
- **D — predicate:** unit table over `isFailureOutcome` for all members of both
  enums, asserting `escalated` is a failure and `stopped`/`handoff`/
  `needs_attention`/`complete` are not.

Then the focused suites named in AGENTS.md for runtime/history changes
(`tests/unit/history-indexer.test.ts`, runtime-context/runtime tests), then
`npm run verify`.

## Constraints

- No engine edits to add flows; this is engine/runtime-internal plumbing, not a
  flow addition.
- Hint-only authority and citation invariants are untouched.
- No Phase 2 capture work. No distiller trace-kind broadening.
- Plain-English operator prose at the surfaces (UBIQUITOUS_LANGUAGE.md).
- Behavior-preserving consolidations only in `memory-effect.ts` /
  `memory-merge.ts`; if using the shared predicate would change a count, leave
  that site alone and note it.
