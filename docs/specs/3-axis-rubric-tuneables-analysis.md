# 3-axis rubric tuneables analysis

Status: analysis-only sibling note for `docs/specs/3-axis-rigor-tournament-autonomous-v1.md`. This does not edit Section 9, change the locked grill decisions, or change source code.

## Recommendation summary

Keep all four Section 9 defaults for v1:

| Tuneable | Current default | Recommendation |
|---|---|---|
| Dim weighting | All 8 rubric dims count equally. | Keep. Make the equal weights explicit in combiner tests and report fixtures, but do not introduce custom weights before sign-off. |
| Tie-break priority | Aggregate score, fewer runtime vetoes, fixed dim order, then lowest strand ordinal. | Keep. It is deterministic and gives runtime-backed proof dimensions priority before softer quality dimensions. |
| `n/a` runtime dims | `runtime_signal: "n/a"` lets the model judgment set the full dim score. | Keep. Penalizing `n/a` would silently downgrade the locked model-only dims. The required recordkeeping already exposes which dims were model-only. |
| `concern` score | `concern = 0.5`. | Keep. It is the clean midpoint between pass and fail and best supports honest calibration without over-rewarding caution. |

The stronger long-term move is not changing these defaults now. It is implementing the full typed rubric result, recording the exact dim evidence, and letting real autonomous tournament runs show whether a default is actually distorting decisions.

## Source evidence used

- The 3-axis spec is a target design plus current-code reconciliation, not implementation-current behavior. It preserves the locked grill decisions unless an appendix records a deliberate amendment (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:3`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:6`).
- Section 9 defines the typed rubric result, equal aggregate score, runtime-veto combine rule, tie-break order, the 8 Explore rubric dims, and the `n/a` model-only rule (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:216`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:240`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:242`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:244`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:246`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:259`).
- Slice 5 intentionally chooses the full long-term rubric path, not a minimal interim scorer (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:376`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:617`).
- Current Explore tournament code does not yet have Section 9 rubric results. It has `option-1` through `option-4`, proposal evidence fields, `aggregate-only` tournament aggregates, and a stress-review report with a single recommended option (`src/flows/explore/reports.ts:106`, `src/flows/explore/reports.ts:145`, `src/flows/explore/reports.ts:173`, `src/flows/explore/reports.ts:219`).
- Current Explore tournament fanout still has fixed max 4 branches, aborts all children on one failure, and joins with `aggregate-only` (`src/flows/explore/data.ts:315`, `src/flows/explore/data.ts:347`, `src/flows/explore/data.ts:353`, `src/flows/explore/data.ts:354`).
- Current winner selection is a hard-coded checkpoint with four choices and `safe_default_choice: option-1`, not `highest-score` (`src/flows/explore/data.ts:390`, `src/flows/explore/data.ts:403`, `src/flows/explore/data.ts:404`, `src/flows/explore/data.ts:429`).
- Current checkpoint policy and runtime checkpoint resolution are safe-choice based, not policy based (`src/schemas/step.ts:68`, `src/schemas/step.ts:82`, `src/runtime/executors/checkpoint.ts:43`, `src/runtime/executors/checkpoint.ts:47`, `src/runtime/executors/checkpoint.ts:57`).
- Current operator summaries have no `auto_resolutions` field. The schema is strict and only carries details, evidence warnings, reports, and an optional waiting checkpoint (`src/schemas/operator-summary.ts:41`, `src/schemas/operator-summary.ts:53`, `src/schemas/operator-summary.ts:58`, `src/schemas/operator-summary.ts:59`; writer shape at `src/shared/operator-summary-writer.ts:341`).
- Proof-carrying precedent favors refusing false completion and showing missing proof as risk, not pretending uncertain evidence is firm (`docs/specs/checkpoint-experience-v1.md:101`, `docs/specs/checkpoint-experience-v1.md:248`). The Fix and Explore relay hints also require evidence-backed claims and calibrated confidence (`src/flows/fix/relay-hints.ts:43`, `src/flows/explore/relay-hints.ts:11`, `src/flows/explore/relay-hints.ts:24`).

## Scoring notation for examples

The examples use the Section 9 dim scores: pass `1`, concern `0.5`, fail `0`. The dims are abbreviated as:

| Abbrev | Dim | Runtime signal? |
|---|---|---|
| E | Evidence rigor | yes |
| P | Project-specificity | no, `n/a` |
| I | Insight density | no, `n/a` |
| A | Actionability | yes |
| H | Honest calibration | no, `n/a` |
| C | Coverage adequacy | yes |
| S | Scope discipline | yes |
| B | Branch distinctness | no, `n/a` |

All examples compare two tournament strands after their per-dim `final_score` is already known. When a runtime-backed dim is scored `0` because `runtime_signal: "missing"`, the example names it as a runtime veto.

## Tuneable 1: Equal weighting across all 8 dims

### Current default

Section 9 says the aggregate score is the arithmetic mean of all dim scores and that all dims count equally in v1 (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:240`).

### Realistic alternatives

1. Keep equal weighting: every dim has weight 1.
2. Weight proof-bearing dims higher: E, A, C, and S get weight 2; model-only dims stay at 1.
3. Weight Evidence rigor higher: E gets weight 2; everything else stays at 1.
4. Weight Honest calibration higher: H gets weight 2, or H plus E get weight 2.
5. Use a gate instead of weights: for example, any fail in E or H prevents autonomous winner selection.

### Alternative tradeoffs

| Alternative | Argument for | Argument against |
|---|---|---|
| Keep equal weighting | Most legible; preserves all 8 locked dims as peers; cheapest to implement and audit. | Lets soft model-only strengths offset weaker proof dims until the tie-break fires. |
| E/A/C/S x2 | Aligns the aggregate with proof-carrying behavior and runtime-backed signals. | Makes model-only quality dims second-class even though Section 9 locked them as real dims. |
| E x2 | Gives the clearest evidence dimension extra force with little complexity. | Over-narrows the rubric; actionability, coverage, scope, and honesty can become secondary. |
| H x2 or E+H x2 | Rewards calibrated claims and can reduce false confidence. | Depends heavily on model self-judgment for H, which has `runtime_signal: "n/a"` in v1. |
| Gates | Prevents known-bad strands from winning through arithmetic. | Changes the product from ranking to possible refusal, which is a larger autonomous behavior decision. |

### Concrete outcome examples

| Example | Strand A | Strand B | Current equal result | Alternative result |
|---|---|---|---|---|
| W1: evidence-heavy weighting reverses a narrow equal win | A: E=.5, P=1, I=1, A=1, H=1, C=1, S=1, B=1. Score 7.5/8 = .938. | B: E=1, P=1, I=.5, A=1, H=1, C=1, S=.5, B=1. Score 7/8 = .875. | A wins. | If E is weighted x2, both score 8/9 = .889, so the tie-break picks B on E. |
| W2: runtime-dim weighting favors the better-proven strand | A: E=1, A=1, C=1, S=1, P=.5, I=.5, H=1, B=.5. Score 6.5/8 = .813. | B: E=.5, A=.5, C=1, S=1, P=1, I=1, H=1, B=1. Score 7/8 = .875. | B wins. | If E/A/C/S are weighted x2, A scores 10.5/12 = .875 and B scores 10/12 = .833. A wins. |
| W3: honest-calibration weighting can override early proof order | A: E=1, P=1, I=1, A=1, H=0, C=1, S=1, B=1. Score 7/8 = .875. | B: E=.5, P=1, I=1, A=1, H=1, C=1, S=1, B=.5. Score 7/8 = .875. | Current tie-break picks A on E before H. | If H is weighted x2, A scores 7/9 = .778 and B scores 8/9 = .889. B wins. |

### Arguments for the current default

- It respects the locked 8-dim rubric as a balanced product judgment. The spec deliberately chose full rubric infrastructure, not a minimal scorer (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:617`).
- It is easier to explain to the operator: one dim, one vote, with the tie-break carrying the priority order.
- It avoids baking unproven product values into the first implementation. Weighting E or H more heavily may be right later, but it needs run evidence.
- It keeps tests and recordkeeping simple for Slice 5A and Slice 5E: one combiner, one aggregate formula, one tie-break path.

### Arguments against the current default

- It can let softer model-only dims offset weaker runtime proof. Example W2 shows that a strand can win on project-specificity, insight, honesty, and branch distinctness even if it is weaker on evidence and actionability.
- It makes the tie-break carry more burden. If the score formula does not express proof priority, proof priority only appears after exact aggregate ties.
- It may understate honest calibration. Example W3 shows that a strand can tie despite failing H, then win because E comes earlier in the tie-break order.

### Implementation cost delta

- Keep equal weighting: baseline Slice 5A cost. Add the pure combiner, aggregate rounding tests, and report fields already required by the spec.
- Add static weights: low to medium. The combiner needs a weight table, tests need weighted examples, and auto-resolution reports should record the active weights so a future operator can reproduce the score.
- Add per-flow weights: medium. Flow definitions or schematics would need a score-policy field, generated surfaces would drift, and the operator report would need to name the flow-specific policy.
- Add gates: medium to high. Gates change `highest-score` from ranking to possible refusal, so checkpoint policy, trace, auto-resolution records, and end-to-end tests all need new failure paths.

### Second-order effects

- Aggregate formula: any non-equal weighting changes the denominator and makes `aggregate_score` less obvious from the 8 dim scores.
- Tie-break: heavier weights reduce how often tie-breaks fire, but they also hide priority inside arithmetic rather than in the explicit `ordered_dims`.
- Recordkeeping: reports must store the weight policy, not just final scores. Otherwise two runs with the same dims can produce different winners with no visible reason.
- Runtime-veto effect: runtime vetoes still set a dim to 0, but a weighted runtime dim makes a missing signal more punitive.

### Recommendation

Keep equal weighting for v1. It best matches the robust long-term posture: ship the full typed result cleanly, preserve every locked dim, and avoid a hidden scorer before real run evidence exists. If the operator wants one change anyway, the least risky alternative is E/A/C/S x2 because it follows the runtime-proof posture. I still would not change it before sign-off.

## Tuneable 2: Tie-break priority order

### Current default

Section 9 sorts by aggregate score descending, then by fewer runtime vetoes, then by dim scores in this order: Evidence rigor, Actionability, Coverage adequacy, Scope discipline, Honest calibration, Project-specificity, Insight density, Branch distinctness. If still tied, it chooses the lowest original strand ordinal (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:244`).

### Realistic alternatives

1. Keep current order.
2. Compare dim scores before `runtime_veto_count`.
3. Move Honest calibration earlier, for example directly after Evidence rigor.
4. Put Actionability first for operator-useful outcomes.
5. Stop for operator input on a perfect tie instead of choosing the lowest ordinal.

### Alternative tradeoffs

| Alternative | Argument for | Argument against |
|---|---|---|
| Keep current order | Deterministic; puts veto count and proof-bearing dims before softer quality dims. | Exact ties can still pick a less actionable or less calibrated strand. |
| Compare dim scores before veto count | Lets a clearly stronger dim profile win even when one runtime-backed check is missing. | Weakens the runtime-veto principle in the exact cases where proof is contested. |
| Move H earlier | Makes honest calibration more salient in false-done prevention. | H is model-only in v1, so this can privilege an unverified self-calibration judgment over runtime-backed Actionability, Coverage, or Scope. |
| Actionability first | Optimizes for the operator's next useful move. | Can prefer a runnable next step over better evidence or broader coverage. |
| Stop on perfect tie | Avoids arbitrary ordinal decisions. | Adds interruption to autonomous runs for a rare low-information case. |

### Concrete outcome examples

| Example | Strand A | Strand B | Current result | Alternative result |
|---|---|---|---|---|
| T1: Evidence first beats Actionability first | A: E=1, A=.5, C=1, S=1, H=1, P=1, I=1, B=1. Score .938. | B: E=.5, A=1, C=1, S=1, H=1, P=1, I=1, B=1. Score .938. | A wins because E is compared before A. | Actionability-first would pick B. |
| T2: Runtime-veto count prevents a high-evidence but proof-missing winner | A: E=.5, A=1, C=1, S=1, H=1, P=1, I=.5, B=1. Score .875, veto count 0. | B: E=1, A=1, C=0 because coverage is missing, S=1, H=1, P=1, I=1, B=1. Score .875, veto count 1. | A wins because fewer vetoes are compared before dim order. | Dim-order-before-veto would pick B on E despite missing required coverage evidence. |
| T3: Ordinal fallback resolves a fully equal score | A: all dims same as B, original ordinal 1. | B: all dims same as A, original ordinal 2. | A wins by lowest original strand ordinal. | A "stop on perfect tie" policy would refuse auto-selection and ask the operator. |

### Arguments for the current default

- It keeps failure-proofing ahead of style. Runtime-veto count comes before dim order, so a strand with missing required evidence cannot beat an equally scored non-vetoed strand just because it has a stronger model judgment elsewhere.
- The dim order is easy to defend: runtime-backed proof dims first, then honest calibration, then the softer model-only quality dims.
- The final ordinal fallback is deterministic and keeps autonomous tournament from stopping on an uninteresting perfect tie.
- It matches current implementation direction: Slice 5E needs `highest-score` to rank and record the tie-break path, and current checkpoint code has no policy-specific ranking yet (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:404`, `src/runtime/executors/checkpoint.ts:43`).

### Arguments against the current default

- Evidence first can pick a less actionable strand in exact ties, as T1 shows.
- Honest calibration comes after four proof/action dims. A strand that is better calibrated can lose if it is weaker on Evidence rigor.
- Lowest ordinal is arbitrary. It is deterministic, but not semantically meaningful.

### Implementation cost delta

- Keep current order: baseline Slice 5A/5E cost.
- Reorder dims: low. Change the ordered list and the table tests. Reports already carry `tie_break.ordered_dims`.
- Move veto count after dim order: low mechanically, but high product risk because it weakens the runtime-veto principle.
- Stop on perfect ties: medium. `highest-score` needs a refusal or needs-operator result, and autonomous checkpoint handling must support a non-selection path instead of always writing a selected option.

### Second-order effects

- Aggregate formula: unchanged unless tie-break also becomes a gate.
- Tie-break: any order change must update tests, docs, and report examples because `tie_break.final_reason` must explain the selected path.
- Recordkeeping: unchanged for simple reorder. A stop-on-tie policy requires trace and operator-summary fields for "no selected winner".
- Runtime-veto effect: moving veto count later makes runtime-backed missing evidence less decisive in tied outcomes.

### Recommendation

Keep the current order. It is not perfect, but it is product-legible and proof-aligned. The only alternative I would consider before sign-off is moving Honest calibration directly after Evidence rigor. I do not recommend that change yet because Section 9 already makes honest calibration a scored dim, and the strongest false-done guard is still runtime-veto plus evidence-first tie-breaking.

## Tuneable 3: `n/a` dims earning full model-credit

### Current default

Section 9 says dims without runtime signals use `runtime_signal: "n/a"` and the model judgment is authoritative (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:259`). Under the dim scale, a model `pass` on a `n/a` dim earns `1`, `concern` earns `.5`, and `fail` earns `0`.

The four `n/a` dims in v1 are Project-specificity, Insight density, Honest calibration, and Branch distinctness (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:250`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:252`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:254`, `docs/specs/3-axis-rigor-tournament-autonomous-v1.md:257`).

### Realistic alternatives

1. Keep full model-credit for `n/a` dims.
2. Cap `n/a` pass at concern, so model-only pass earns `.5`.
3. Exclude `n/a` dims from the denominator and score only runtime-backed dims.
4. Apply a small uncertainty penalty when a winner's margin is mostly from `n/a` dims.
5. Add an operator-stop guard when model-only dims are decisive.

### Alternative tradeoffs

| Alternative | Argument for | Argument against |
|---|---|---|
| Keep full model-credit | Treats locked model-only dims as first-class and keeps score math simple. | Can let model-only judgments decide the winner over stronger runtime-backed proof. |
| Cap `n/a` pass at `.5` | Makes unverified model-only pass less able to dominate proof-backed dims. | Misstates `n/a` as lower quality rather than "not runtime-checkable in v1". |
| Exclude `n/a` dims | Produces a proof-only aggregate that is easier to trust mechanically. | Erases half the locked rubric from scoring and makes aggregates less comparable across flows. |
| Uncertainty penalty | Keeps model-only dims in the score while flagging over-dependence. | Adds a second scoring layer that operators must understand and reports must preserve. |
| Decisive-margin stop | Prevents autonomous selection when the winning margin is purely model-only. | Converts a scoring choice into an interruption policy and needs a new no-winner path. |

### Concrete outcome examples

| Example | Strand A | Strand B | Current result | Alternative result |
|---|---|---|---|---|
| N1: model-only pass can beat stronger runtime proof | A: runtime dims E=1, A=1, C=1, S=.5; `n/a` dims P=1, I=1, H=1, B=1. Score 7.5/8 = .938. | B: runtime dims E=1, A=1, C=1, S=1; `n/a` dims P=.5, I=.5, H=.5, B=.5. Score 6/8 = .750. | A wins. | If `n/a` pass is capped at `.5`, A scores 5.5/8 = .688 and B scores 6/8 = .750. B wins. |
| N2: excluding `n/a` dims makes runtime proof dominate | A: runtime dims E=1, A=.5, C=1, S=.5; `n/a` dims all pass. Current score 7/8 = .875. | B: runtime dims E=1, A=1, C=1, S=.5; `n/a` dims all concern. Current score 5.5/8 = .688. | A wins. | If `n/a` dims are excluded, A scores 3/4 = .750 and B scores 3.5/4 = .875. B wins. |
| N3: `n/a` decisive-margin guard would refuse a model-only win | A: runtime dims all pass; `n/a` dims all pass. Score 1.000. | B: runtime dims all pass; `n/a` dims all concern. Score .750. | A wins. | A guard that refuses auto-selection when the entire margin comes from model-only dims would stop for operator review instead of selecting A. |

### Arguments for the current default

- It honors the locked rubric. Project-specificity, insight density, honest calibration, and branch distinctness are real quality dimensions even though v1 lacks good runtime signals for them.
- It avoids the false precision of pretending a missing runtime signal means weaker quality. `n/a` means "not mechanically checkable yet", not "less true".
- It keeps the combine rule simple and honest: runtime can force fail only when a necessary runtime check is missing; runtime cannot force pass (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:242`).
- It keeps the model-only dims visible in the same result object instead of hiding them outside the score.

### Arguments against the current default

- It can over-trust model judgment. N1 and N2 show that full model-credit can outweigh stronger runtime-backed proof.
- It can hide where the decision came from unless reports make `runtime_signal: "n/a"` highly visible.
- It may surprise operators who expect proof-carrying behavior to privilege mechanically checked evidence over model-only claims.

### Implementation cost delta

- Keep full model-credit: baseline Slice 5A/5B cost.
- Cap `n/a`: low to medium. The combiner changes are simple, but the report must explain why a model `pass` did not earn 1.
- Exclude `n/a` from denominator: medium. Aggregates become less comparable across flows or future rubrics with different runtime-signal coverage.
- Add margin guard: medium to high. `highest-score` needs a non-selection path, and operator summaries need to explain that no strand won because the margin was model-only.
- Add runtime signals for these dims now: high and not recommended. Branch distinctness already remains an open downstream question (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:472`).

### Second-order effects

- Aggregate formula: capping or excluding `n/a` changes score meaning. A score of `.875` would no longer mean "seven dim-points out of eight".
- Tie-break: `n/a` dims appear later in the current tie-break order. Penalizing them in the aggregate means they may almost never affect ties, even when they are operator-important.
- Recordkeeping: if full credit stays, reports must show `runtime_signal: "n/a"` per dim. If capped or excluded, reports also need the cap/exclusion policy to make the aggregate reproducible.
- Runtime-veto effect: capping `n/a` blurs the clean distinction between "missing necessary runtime proof" and "not runtime-checkable".

### Recommendation

Keep full model-credit for `n/a` dims in v1. This is the most honest reading of the locked rubric: model-only dims are still first-class dims, and their model-only nature is recorded rather than hidden. The operator-facing risk is real, so the implementation should make `runtime_signal: "n/a"` visible in JSON provenance and in compact summary text when it decides the winner. That is recordkeeping, not a scoring change.

## Tuneable 4: `concern = 0.5`

### Current default

Section 9 maps `pass = 1`, `concern = 0.5`, and `fail = 0` (`docs/specs/3-axis-rigor-tournament-autonomous-v1.md:240`).

### Realistic alternatives

1. Keep concern at `.5`.
2. Make concern more punitive, for example `.25`.
3. Make concern softer, for example `.75`.
4. Treat concern as ordinal only: use it for tie-breaks and reporting, but not as numeric partial credit.
5. Gate on concern count, for example "three or more concerns requires operator review".

### Alternative tradeoffs

| Alternative | Argument for | Argument against |
|---|---|---|
| Keep `.5` | Clear midpoint; rewards honest uncertainty without making concern look like pass. | May be too forgiving when concern means material doubt. |
| Use `.25` | Makes concerns more costly and favors clearer pass/fail evidence. | Can train overclaiming because admitting concern becomes too expensive. |
| Use `.75` | Treats concern as a minor caveat rather than a serious weakness. | Can let broad-but-weak strands beat sharper strands with a few fails. |
| Ordinal concern only | Avoids false numeric precision. | Removes simple arithmetic and makes outcomes harder to compare or reproduce. |
| Concern-count gate | Stops low-confidence winners even when aggregate is high. | Adds a refusal path that is separate from aggregate score and may interrupt autonomous runs often. |

### Concrete outcome examples

| Example | Strand A | Strand B | Current result with concern=.5 | Alternative result |
|---|---|---|---|---|
| C1: midpoint concern makes a broad-concern strand tie a sharp-fail strand | A: E=.5, A=.5, C=1, S=1, H=1, P=1, I=1, B=1. Score 7/8 = .875. | B: E=1, A=1, C=1, S=1, H=1, P=1, I=1, B=0. Score 7/8 = .875. | Tie-break picks B because E and A beat A. | If concern=.75, A scores 7.5/8 = .938 and wins. If concern=.25, B wins outright. |
| C2: punitive concern rewards fewer uncertain dims | A: five pass, three concerns. Score 6.5/8 = .813. | B: six pass, two fails. Score 6/8 = .750. | A wins. | If concern=.25, A scores 5.75/8 = .719 and B wins. |
| C3: soft concern rewards broad but weaker coverage | A: four pass, four concerns. Score 6/8 = .750. | B: six pass, two fails. Score 6/8 = .750. | Tie-break decides based on which dims carry the passes. | If concern=.75, A scores 7/8 = .875 and wins over B's .750. |

### Arguments for the current default

- It is transparent. Concern is exactly halfway between pass and fail.
- It rewards honest partial confidence without letting concern look like pass.
- It reduces brittle winner changes from one model judgment. A strand with several concerns does not collapse the same way it would under `.25`.
- It matches the honest-calibration posture: evidence gaps and uncertainty should be named, but naming concern should not be punished so hard that models learn to overclaim pass.

### Arguments against the current default

- It can be too forgiving when concern means "material doubt". C2 shows a strand with three concerns beating a strand with two clear failures.
- It can be too punitive when concern means "minor caveat". C1 shows `.5` tying a two-concern strand with a one-fail strand.
- It depends on models using `concern` consistently. If model judgments drift, the score inherits that drift.

### Implementation cost delta

- Keep `.5`: baseline Slice 5A cost.
- Change the constant to `.25` or `.75`: low mechanically, but every combiner test, score fixture, example report, and operator-summary snapshot must match.
- Make concern per-dim: medium to high. The rubric needs a scale table per dim, and reports must record that table.
- Add concern-count gate: medium. `highest-score` needs a non-selection or refusal path and reports must explain the gate separately from aggregate score.

### Second-order effects

- Aggregate formula: changing concern changes every aggregate and margin. Historical comparisons would need to record the active scale.
- Tie-break: a lower concern value creates fewer aggregate ties with fail-heavy strands; a higher concern value creates more wins for broad-but-imperfect strands.
- Recordkeeping: the dim scale must be recorded in report metadata if it can change. Otherwise a score from one run cannot be compared to a later run.
- Runtime-veto effect: runtime-vetoed dims remain `0`, so lowering concern widens the gap between concern and vetoed fail; raising concern narrows it.

### Recommendation

Keep `concern = 0.5` for v1. It is the most legible default and the least likely to train overclaiming. If future evidence shows concern is too forgiving, change it with real run examples and a score-version record. Do not change it before sign-off.

## Cross-tuneable implementation impact map

The same future implementation surfaces carry all four defaults:

| Surface | Baseline work already required by Section 9 | Extra work if a default changes |
|---|---|---|
| Rubric result schema | Add `RubricDimResult`, `RubricResult`, dim scale, aggregate score, veto count, and tie-break metadata. | Add score-policy metadata: weights, active concern scale, `n/a` policy, or gate reason. |
| Explore reports | Extend current tournament proposal/aggregate/review reports so each strand has a full rubric row. | If `n/a` or weights vary, report enough policy data to reproduce the score. |
| Checkpoint executor | Add `highest-score` policy instead of safe-choice-only selection. | If gates or stop-on-tie are added, support "no autonomous winner" as a first-class outcome. |
| Operator summary | Add `auto_resolutions` with rubric provenance. | Add compact display for policy deltas, model-only decisive margins, or refusal reasons. |
| Tests | Combiner table tests, tie-break tests, runtime-veto tests, operator-summary tests. | Add examples for the changed policy and prove old defaults do not silently survive in fixtures. |

The cost pattern is clear: numeric constants and dim ordering are cheap to change in code, but expensive to explain after the fact. Gates and denominator changes are product behavior changes, not just math changes, because they can make autonomous tournament refuse to pick a winner.

### Current code surfaces by option type

| Option type | Current surfaces that would have to change | Why |
|---|---|---|
| Keep all four defaults | `src/flows/explore/reports.ts`, future rubric combiner module, `src/runtime/executors/checkpoint.ts`, `src/shared/operator-summary-writer.ts`, `src/schemas/operator-summary.ts` | Baseline Slice 5 still needs rubric rows, `highest-score`, and `auto_resolutions`; current code only has proposal/review reports, safe-choice checkpoint resolution, and no auto-resolution summary field. |
| Add static weights or change `concern` | Future rubric combiner module, tests for combiner and checkpoint ranking, `src/shared/operator-summary-writer.ts`, `src/schemas/operator-summary.ts` | Score arithmetic changes and must be reproducible from reports. |
| Add per-flow weights | `src/flows/flow-definition.ts`, `src/flows/explore/data.ts`, `src/shared/operator-summary-writer.ts`, `src/schemas/operator-summary.ts`, generated schematic surfaces, future rubric combiner module | The score policy becomes authored flow metadata, not a global constant. |
| Cap or exclude `n/a` dims | `src/flows/explore/reports.ts`, `src/shared/operator-summary-writer.ts`, `src/schemas/operator-summary.ts`, future rubric combiner module | The report must explain why a model-only dim did or did not affect the aggregate. |
| Add gates, model-only decisive-margin stop, or perfect-tie stop | `src/runtime/executors/checkpoint.ts`, checkpoint trace handling, `src/shared/operator-summary-writer.ts`, `src/schemas/operator-summary.ts`, `src/flows/explore/reports.ts`, `src/flows/explore/writers/decision.ts`, `src/flows/explore/writers/close.ts` | These options create a no-autonomous-winner path instead of always writing a selected option. |

## Sign-off position

No blocking operator decision is required before sign-off unless the operator rejects the basic idea that model-only dims can help select an autonomous winner. Section 9 already answered that for v1 by making `n/a` dims authoritative through model judgment and by requiring full typed provenance. The honest long-term posture is to keep the defaults simple, record the full basis of each decision, and revisit only after real tournament evidence shows a default is steering choices badly.
