# Verdict-Correctness Eval — Results (2026-05-08)

Internal eval. Goal: measure whether the explore-flow review step catches
mechanically-planted defects in compose outputs, and use the result to find
real product gaps.

## Iteration 2 (2026-05-08, post-fix + 2 min timeout + planter fix) — headline

**Catch rate: 37/37 = 100%** (catches / catches + misses, errors excluded).
**Wallclock: 41.6 min**, **errors: 3** — both down sharply from iter1's
2h43m and 12 errors.

| Defect | Caught | Missed | Errors | Catch rate | Δ from baseline |
| --- | --- | --- | --- | --- | --- |
| fabricated-evidence-ref | 7 | 0 | 1 | 100% | – (was 100%) |
| stripped-success-condition-alignment | 8 | 0 | 0 | **100%** | **+100pp** (was 0%) |
| wrong-subject | 8 | 0 | 0 | 100% | +12pp (was 88%) |
| added-false-certainty | 7 | 0 | 1 | 100% | new defect |
| internal-contradiction | 7 | 0 | 1 | 100% | – (was 100%) |

The reviewer prompt + scorer + mutator changes hold up under repeat
running. Every successfully-evaluated case is caught. The 3 remaining
errors are codex CLI hangs ("Reading additional input from stdin..."
stderr) on a single problematic compose (d9770c56's added-false-certainty
and internal-contradiction cases, plus c10d6a9f's fabricated-evidence-ref
which the planter correctly skips because that compose has no
evidence_refs to fabricate).

### Iteration 1 (same code, 5 min timeout, no planter fix)

**Catch rate: 29/29 = 100%**, but with 12 errors and 2h43m wallclock.
Iteration 2's tighter timeout and hardened planter cut errors 4× and
wallclock 4×, holding catch rate constant at 100%.

## What changed between iterations

1. **Reviewer prompt** (`src/flows/explore/relay-hints.ts`): added a
   five-axis audit instruction to `exploreReviewVerdictShapeHint` covering
   subject fidelity, evidence groundedness, internal consistency, epistemic
   calibration, and success-condition alignment. The alignment axis names
   "This satisfies the brief." as the canonical vacuous one-liner.
2. **Codex connector** (`src/connectors/codex.ts`): added `item.updated`
   to `KNOWN_CODEX_EVENT_TYPES` (codex-cli 0.128 emits incremental progress
   beacons). Item.type allowlist is enforced on the update channel too,
   so the read-only sandbox boundary is preserved.
3. **Defect taxonomy**
   (`evals/verdict-correctness/defect-taxonomy.ts`):
   replaced `removed-uncertainty` with `added-false-certainty`. The new
   mutator appends a confident overclaim sentence to every compose (no
   skips). Also hardened the fabricated-evidence-ref planter to handle
   composes whose first aspect lacks `evidence_refs`.
4. **Scorer** (`evals/verdict-correctness/scorer.ts`): broadened patterns
   for stripped-success-condition-alignment (added "overclaims",
   "satisfies the brief"), wrong-subject (hyphenated "quantum-cryptography"),
   and added-false-certainty (catches "remove the final sentence claiming
   no remaining risks" and similar).
5. **Eval prompt-mutation** (`evals/verdict-correctness/prompt-mutation.ts`):
   the captured review.request.json files contain a frozen historical shape
   hint. The eval now upgrades that to whatever the current production
   `exploreReviewVerdictShapeHint.instruction` emits, so prompt
   improvements actually take effect in catch-rate measurements.

## Iteration 1 (baseline) — original headline

**Catch rate: 23/34 = 67.6%** (catches / catches + misses, errors excluded).

The reviewer is strong on grounding and consistency, blind on alignment
quality. Single highest-value product fix: **tell the reviewer to check
that `success_condition_alignment` actually justifies alignment.**

## Per-defect breakdown

| Defect | Caught | Missed | Errors | Catch rate | Reading |
| --- | --- | --- | --- | --- | --- |
| fabricated-evidence-ref | 7 | 0 | 1 | 100% | Reviewer verifies citations. |
| internal-contradiction | 8 | 0 | 0 | 100% | Reviewer reads carefully end-to-end. |
| wrong-subject | 7 | 1 | 0 | 88% | Reviewer compares brief subject vs compose subject. |
| removed-uncertainty | 1 | 2 | 5 | 33% | Small sample — see "side finding" below. |
| stripped-success-condition-alignment | 0 | 8 | 0 | **0%** | **Reviewer never noticed.** |

The control runs (unmodified composes) returned valid, substantive verdicts
in 7/8 cases. They did not flag any of the planted defects, which means
the catches are real signal, not background noise.

## What the 0% miss means

I replaced rich `success_condition_alignment` text (~300–850 chars per case)
with the literal one-liner `"This satisfies the brief."` in 8 different
real composes. In every single case, the reviewer accepted the compose
with substantive fold-ins — but **never** flagged the vacuous alignment.

The reviewer found other genuine objections each time. It just didn't
look at whether the alignment field meant anything.

The likely cause is the relay shape hint in
`src/flows/explore/relay-hints.ts`. The reviewer is told to return a
verdict with objections + missed_angles, but is not told to check the
alignment field's quality. The reviewer treats it as a structural slot
that's filled in, not a claim to verify.

**Suggested fix:** add one instruction to the explore review prompt
along the lines of:

> Verify that `success_condition_alignment` substantively justifies
> how the recommendation satisfies the brief. Flag it as an objection if
> it is generic, formulaic, or restates the brief without explaining
> alignment.

This is one line and should close the gap. We should re-run the eval
after the change to confirm.

## What the 100% / 88% means

Don't waste prompt budget reinforcing what already works:
- evidence-ref grounding (catches fabricated paths)
- internal consistency (catches contradictions)
- subject fidelity (catches added-topic drift)

These are well-protected.

## Side findings (not part of the eval, surfaced by running it)

**1. Many composes are already over-confident.**
4 of the 8 composes had no hedging language for the
`removed-uncertainty` mutator to remove. The mutator skipped them with
"no hedging language matched". That's why the sample size is small (3,
not 8) for that defect. It also tells us composes default to confident
prose — there's not much hedging to strip in the first place. A
follow-up defect should *add* false certainty rather than remove
hedging.

**2. Codex connector compat bug.**
Run `c10d6a9f` errored during its control with this message:

```
codex --json line 15: unknown top-level trace_entry type 'item.updated'
(allowlist: thread.started, turn.started, item.started, item.completed,
turn.completed). A new Codex trace_entry type must be reviewed before
the connector admits it.
```

`codex-cli 0.128.0` is emitting an `item.updated` trace_entry that
`src/connectors/codex.ts` doesn't allowlist. This is a real bug that
should be filed and fixed; it's a fail-closed boundary doing exactly
what it was designed to do, but the underlying trace surface has
expanded upstream.

**3. Median per-case duration was 17.8s, not 50s.**
The first case took 64s, but subsequent cases averaged 15–25s. Codex
caching reduces ongoing eval cost meaningfully — useful to know for
budgeting future eval runs.

## Cost and wallclock

- 48 cases, 41 successful LLM calls, 17 minutes wallclock.
- Median per-call: 17.8s.
- Estimated codex spend: ~$1.

At the current smoke-sized scope, the eval is cheap enough to run on every
reviewer-prompt change as a regression check. Before widening it across more
flows, judges, or pre-flight use, treat case count, source count, median
duration, and connector failure rate as the budget gate.

## Limitations

- **String-match scoring** is generous on purpose, but can miss
  reviewer language that uses unusual phrasing. Audit misses by hand.
  The 8 stripped-alignment misses were audited; none of them flagged
  the alignment defect under any phrasing.
- **Self-grading risk**: the reviewer being judged is the same model
  family that produces composes. A different model as judge would be a
  fairer test.
- **Codex connector only**: the production explore review also runs
  through the agent (Claude Code) connector. An agent-mode pass would
  show whether the alignment-blindness is a model-level issue or
  prompt-level.
- **Small source pool**: iteration 2 used 8 captured composes. That is enough
  to confirm the specific alignment fix, but not enough to claim broad
  reviewer robustness. Add more real explore composes before using subtler
  mutators as a discrimination test.
- **Mutators are obvious by design**. Real failures are usually subtler
  combinations. A v0.2 should plant subtler defects (partial
  fabrication of one piece of evidence, mild internal tension rather
  than self-negation).

## Recommended next steps

1. **Add the alignment-quality instruction** to
   `src/flows/explore/relay-hints.ts` for the review-verdict shape
   hint, then re-run the eval to confirm the 0% climbs.
2. **File the codex `item.updated` trace_entry** as a connector
   allowlist update.
3. **Replace `removed-uncertainty` with `added-false-certainty`** so
   the mutator actually fires on every compose. Re-run.
4. **Add agent-connector mode** to the eval runner so we can compare
   agent vs codex catch rates on the same defect set.
5. **Expand and freeze the source pool before v0.2 mutators**. Capture more
   real explore composes across distinct subjects, then run subtler defects
   against that fixed pool. If the pool stays at N=8, another 100% catch rate
   may still be ceiling effect rather than proof.
6. **Budget before pre-flight use**. Use the dry-run case count and the latest
   report's median duration before wiring the eval into a regular gate.

Outputs:
- `evals/verdict-correctness/results/2026-05-08T05-33-21-013Z/results.json`
- `evals/verdict-correctness/results/2026-05-08T05-33-21-013Z/summary.json`
- `evals/verdict-correctness/results/2026-05-08T05-33-21-013Z/report.md`
