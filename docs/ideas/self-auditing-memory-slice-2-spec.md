# Slice 2 Spec: Cross-Run Effect Aggregation (report-only)

Status: implemented. Current code lives under `src/app/history/memory-effect.ts`,
`src/app/history/memory-effect-read.ts`, `src/schemas/history.ts`, and the
`circuit history memory-effect` CLI path. Some path references below use the
pre-`src/app/history` location from writing time.
Date: 2026-05-29
Parent design: [`self-auditing-memory.md`](./self-auditing-memory.md) (section 8, build sequence item 2; section 13, open questions 1-3)
Depends on: [`self-auditing-memory-slice-1-spec.md`](./self-auditing-memory-slice-1-spec.md) (the `history.memory-merge@v1` artifact, the `content_id` grouping key, and the frozen `MemoryMergeEffectStatusV1` enum)

This is the concrete, schema-grounded build spec for Slice 2. It is written against the real on-disk contracts on `main` plus the just-built Slice 1 reader (`src/history/memory-merge.ts`), verified against source at writing time. Slice 2 is the first slice that renders a *verdict* about memory, and it is still report-only: it reads, it never writes a run artifact and never changes a run's behavior.

## 1. What Slice 2 is

A standalone, read-only history command that aggregates the Slice 1 memory-merge linkages into per-item and per-flow effect estimates, and moves the frozen `effect_status` off its Slice 1 floor (`not_enough_data`) **only when the comparable-run evidence honestly supports it**. No behavior change, no injection gating (that is Slice 3), no write to any run artifact, no post-run hook.

It answers two distinct questions the keystone promised (parent design, section 7) over the same substrate:

- **Per-item effect (the product mechanism).** For each content-addressed memory item, within a single flow cohort: did runs that used it close better than comparable runs of the same flow that did not? This is the signal Slice 3's earned-precision injection will gate on.
- **Per-flow memory-on-vs-off contrast (the validation experiment).** For each flow: did runs that used *any* memory close better than runs of the same flow that used none? This is the "memory on versus memory off on objective outcomes" half the team wanted before investing further.

Deliverables:

- a `history.memory-effect@v1` report schema (new schemas in `src/schemas/history.ts`),
- a pure aggregator + a builder + a writer + a path constant,
- a `circuit history memory-effect` CLI subcommand,
- contract + unit + CLI tests,
- and the three resolved open questions (Q1-Q3) encoded as named, operator-vetoable constants the report echoes back about itself.

## 2. Decisions (these resolve section-13 Q1-Q3 and the read-vs-build fork)

Decision posture, stated once: this spec follows the Slice 1 **default-and-flag** pattern. Each fork below is resolved with the conservative, honesty-preserving default and marked for cheap operator veto, rather than blocking the spec on an operator interview. The defaults are chosen so the report under-claims on a thin corpus rather than inventing precision.

### D1 — Data source: aggregate over the Slice 1 linkages, built in-process

Slice 2 consumes `HistoryMemoryMergeV1` (Slice 1's report). It does **not** re-open run envelopes or the recall reports; everything it needs is already in the merge report, which keeps Slice 2 entirely outside the architecture-hardening blast radius (same as Slice 1).

The unit it aggregates over is **`merge.linkages`** (the per-run rows: `run_id`, `flow_id`, `outcome`, `memory_used`, `memory_inputs[].content_id`), **not** `merge.memory_items`. Reason, and this is load-bearing: `memory_items.outcome_counts` pool a content item's runs across *all* flows, which would break flow comparability — the entire thesis rests on comparing runs of the *same* flow. Slice 2 therefore re-derives cohorts at the linkage granularity. The partition key is the Slice 1 **`group_key`** — which is `content_id` when the source is content-addressed, and the `unresolved:<memory_input_id>` fallback when it is not (`src/history/memory-merge.ts:227`) — paired with `flow_id`. Using `group_key` rather than `content_id` directly matters because every unresolved item has `content_id === null`; matching arms on `content_id` alone would wrongly merge all null-content items of a flow into one cohort, whereas `group_key` keeps *distinct source docs* distinct. The `memory_input_id` in that fallback is **source-doc-scoped, not run-scoped** — `historyMemoryInputPreview` derives it from the recalled source document (`src/history/memory-preview.ts:46-48`), stable across recalling runs — so an unresolved cohort is *usually* size 1 (hence `not_enough_data`) but **can reach size ≥ 2** when two same-flow runs recall the *same* unhashed source doc (consistent with Slice 3 D3 and Slice 4 D3). What `group_key` prevents is merging two *different* source docs that both happen to be unhashed; it does not force every unresolved cohort to size 1. It still uses `merge.memory_items` as a convenience lookup (`group_key` → representative `kind`/`source_ref`) for enrichment only. So Slice 2 is keyed on the Slice 1 `content_id` grouping key exactly as the handoff requires — the grouping key in Slice 1 *is* `group_key`, which leads with `content_id` — computed per `(group_key, flow_id)` to preserve comparability.

**How the merge report is obtained:** `buildMemoryEffectReport` calls `buildMemoryMergeReport(options)` in-process (the same composition the `memory-merge` CLI already does), then aggregates the returned object. The core aggregator `aggregateMemoryEffect(merge, gates)` is a **pure function** of an in-memory `HistoryMemoryMergeV1`, so it is unit-testable from a hand-built merge report with no filesystem. The merge report is rebuilt, not read from `memory-merge.v1.json`, so a stale or absent persisted file cannot desync the two reports.

**Veto path (cheap):** if the operator wants Slice 2 to read a pre-written `memory-merge.v1.json` instead of rebuilding, that is a one-function swap at the `buildMemoryMergeReport` call site; the pure aggregator is unaffected.

### D2 — Q1, comparable-run grouping: the cohort is `flow_id`, and only `flow_id`

The parent design's Q1 asks what defines "same intent class" beyond `flow_id` — a coarse intent label, the goal-contract objective, or a cluster over the goal text.

Resolution: **the comparable cohort is exactly `flow_id`.** Two runs of the same flow are directly comparable because a flow is a closed, typed alphabet of steps and contracts (parent design, section 3); that commensurability is the only grouping Circuit can make *deterministically, with no model and no fuzzy matching*. The three richer options are rejected for concrete reasons, not omitted:

- **Goal-contract objective (exact string).** Deterministic but useless: `operator_intent`/`goal_contract.objective` are effectively unique per run, so an exact-match sub-partition shatters every cohort to n=1 — the opposite of what aggregation needs.
- **A coarse intent label or a goal-text cluster.** Would create larger cohorts, but only by introducing fuzzy similarity — exactly the "guessed relevance" and fake precision the design refuses (sections 1, 4). On a ~22-run corpus a clustering step would also be unfalsifiable.

So `flow_id` is the honest floor. Finer intent-class grouping is **explicitly deferred** to a future slice that can justify a deterministic key; it is named here as a non-goal (section 7), not silently dropped. Every Slice 1 linkage carries a `flow_id`: the reader derives it from `process_attempts[0].process_id ?? process_plan.planned_attempts[0].process_id`, and `planned_attempts` is `.min(1)` with a required `process_id` (`src/schemas/run-envelope.ts:150,165`), so any envelope that parses yields one. Slice 2 therefore cohorts every run by `flow_id`. One type-level subtlety the builder must honor: `MemoryMergeRunLinkageV1.flow_id` is *schema-optional* (`z.string().min(1).optional()`, `src/schemas/history.ts:314`), so it is inferred as `string | undefined`, and under the project's `strictNullChecks` the aggregator cannot use `linkage.flow_id` as a non-null cohort key without narrowing. It narrows with an explicit guard and **skips** any linkage whose `flow_id` is absent — a guard that the real Slice 1 reader never trips (it always derives one, per the previous paragraph), so it is a compile-time necessity, not a runtime path, and it emits **no** user-facing warning (an unreachable `effect_uncohortable_run` warning was added in an earlier draft and dropped, since it would be dead branch dressed as robustness). `MemoryEffectItemV1.flow_id` is therefore a required non-null `string`.

**Veto path:** the cohort key is a single function `cohortKey(linkage) = linkage.flow_id`. An operator who wants `(flow_id, route)` or a tagged intent class changes one function and the arm-building code is unaffected.

### D3 — Q2, minimum sample: both arms must reach `MIN_ARM_SIZE` (default 2) or the verdict stays `not_enough_data`

The parent design's section 11 and both soundness reviews are blunt that the corpus is too thin to trust: ~22 runs, the only flow with both a memory-on and a memory-off run is `review` at n=1 per arm, recurrence is absent, and the research warns of a 10-20 session cold start. A first cut must therefore refuse to render any verdict on a single data point.

Resolution: a comparison may leave `not_enough_data` **only when both arms have at least `MIN_ARM_SIZE` runs**, default **2**. Below that floor — including the universal early case where the used arm has exactly one run — the verdict is `not_enough_data`, full stop. Two is deliberately the *floor that distinguishes "literally one observation" (never trustworthy) from "a minimal repeated signal,"* not a claim that two runs are statistically adequate; the report says so in every note and the parent doc's section 11 caveat stands. `MIN_ARM_SIZE` is echoed in the report header (`min_arm_size`) so the artifact states its own statistical floor rather than hiding it.

**Expected early state, stated plainly:** on today's corpus *every* `item_effects` entry and *every* `flow_contrasts` entry resolves to `not_enough_data`, because no arm reaches 2. `not_enough_data` is the designed-for, correct early output of this slice — not a failure, not an error. The report's `summary` roll-up surfaces this at a glance (`items_not_enough_data` will equal `items_total`).

**Veto path:** `MIN_ARM_SIZE` is one constant (`DEFAULT_MIN_ARM_SIZE = 2`), overridable via `--min-arm-size`. Raising it as the corpus grows is the expected tuning move.

### D4 — Q3, lead metric: run-outcome (`complete`-rate) leads; abort-rate corroborates; nothing is combined

The parent design's Q3 asks which objective signal leads and how to combine them "without inventing fake precision," and flags that tokens are uncaptured, elapsed time is degenerate, and `clean_streak` is coarse.

Resolution: **the lead metric is the `complete`-close rate** — the fraction of an arm's runs whose `RunEnvelopeOutcome` is `complete`. It is the only per-run signal that is honest today (it is the binary-ish objective result Slice 1 already records), present for every run in the linkages, and graduated enough to compare as a rate. The five `RunEnvelopeOutcome` values are partitioned without forcing the ambiguous ones:

- **success:** `complete`.
- **adverse:** `blocked` or `failed`.
- **neutral:** `needs_attention` or `handoff` (counted, but neither success nor failure — folding them either way would invent precision).

The **secondary** signal is the **adverse rate** (`blocked|failed` fraction), reported alongside as a corroborating/contradicting check. The two are **not** combined into a weighted composite score — the design forbids fake precision, so the report carries `complete_rate_delta` and `adverse_rate_delta` as separate raw fields and the verdict reads them with a simple rule (D5). Retry count, time-to-green, and tokens are **not** used: they are named as future capture in the parent design (`started_at`/`completed_at` are the same snapshot, there is no token field, `clean_streak` is hardcoded by outcome), and Slice 2 does not invent them. Per-run attempt count is *present* in the envelope (`process_attempts.length`) but is **not** lifted into the Slice 1 linkage, so using it would require either re-reading envelopes (breaking D1's clean layering) or amending the built Slice 1 schema (out of scope); it is deferred with the rest.

**Veto path:** the partition and the lead-vs-secondary choice live in one scoring function; an operator who wants adverse-rate to lead, or attempt-count lifted in, changes that function (and, for attempt-count, accepts a Slice 1 schema addition).

### D5 — The verdict rule (how the frozen enum is populated)

A single function `classifyEffect(comparison, margin, minArmSize)` (inside `aggregateMemoryEffect`) decides the verdict; it takes `minArmSize` as an explicit parameter (not a closed-over free variable) so the rule is self-contained and unit-testable in isolation. For each comparison (a used arm U and a comparable arm C):

- `complete_rate_delta = U.complete_rate - C.complete_rate`
- `adverse_rate_delta  = U.adverse_rate  - C.adverse_rate`

It is evaluated in **strict precedence order**, so the result is a single enum value with no ambiguity:

1. if `U.size < MIN_ARM_SIZE` or `C.size < MIN_ARM_SIZE` → **`not_enough_data`**.
2. else if `complete_rate_delta >= MARGIN` **and** `adverse_rate_delta <= 0` → **`correlated_positive`** (used arm closes complete more often and is no worse on aborts).
3. else if `complete_rate_delta <= -MARGIN` **or** `adverse_rate_delta >= MARGIN` → **`correlated_negative`** (used arm closes complete less often, or aborts materially more).
4. else → **`unresolved`** (arms meet the floor, but the separation is within noise).

`MARGIN` must satisfy **`0 < MARGIN <= 1`** and defaults to **0.5** (`DEFAULT_MARGIN`), echoed in the report header. The lower bound is open (zero is rejected): at `MARGIN = 0` a tied comparison would satisfy both the positive and the negative condition, and only the precedence order above would break the tie — relying on evaluation order for a verdict the spec wants to be principled is a determinism hazard, so the CLI rejects `--margin 0` (and `--margin > 1`) with exit 2. The upper bound is `1.0` because `complete_rate_delta` ranges over `[-1, 1]`, so a margin above 1 can never fire. At the minimum arm size of 2, a 0.5 separation requires a near-unanimous split (e.g. used arm 2/2 complete vs comparable arm at most 1/2) — the verdict fires only on a clean separation, never on a single flipped run inside an otherwise-tied pair. This is deliberate: on a thin corpus the honest steady state once arms reach the floor is **`unresolved`**, and `correlated_*` should be reachable only by an unambiguous gap. The parent design's section-11 point — that on a single small repo the loop may report no detectable effect indefinitely — is this rule behaving correctly, not a bug.

**Veto path:** the rule lives in one function, `classifyEffect(comparison, margin, minArmSize)`. `MARGIN` is overridable via `--margin`; an operator who wants a symmetric margin rule, a different adverse-rate gate, or attempt-count folded in changes that one function.

## 3. The objective signals Slice 2 records

Only the two honestly-retrievable per-run signals from Slice 1, aggregated to arm level:

- **`complete_rate`** = `complete_count / size` (the lead metric, D4).
- **`adverse_rate`** = `(blocked + failed) / size` (the secondary, D4).

Plus the raw `outcome_counts` per arm (every `RunEnvelopeOutcome` present, with a positive count) as the source of truth the rates derive from. Rates are exact `count/size` rationals rendered as numbers; a contract test asserts `complete_count + adverse_count + neutral_count === size` so a rate can never drift from its counts. Deliberately **not** recorded (would be fake precision today, same as Slice 1 section 3): tokens, elapsed time, graduated clean-streak, attempt/retry counts.

## 4. Report schema: `history.memory-effect@v1`

Lives in `src/schemas/history.ts`, beside the Slice 1 memory-merge schemas. Reuses `MemoryMergeEffectStatusV1` (the frozen four-value enum — unchanged, this is the whole point of freezing it in Slice 1), `Ref`, `RunEnvelopeOutcome`, `MemoryInputKind`, `HistoryWarningV1`, `HISTORY_AUTHORITY_NOTICE`, and `MemoryMergeOutcomeCountV1`.

```
MemoryEffectArmV1 {                         # one side of a comparison
  run_ids: string[] (min 0, sorted, unique)
  size: int>=0
  complete_count: int>=0
  adverse_count: int>=0                     # blocked + failed
  neutral_count: int>=0                     # needs_attention + handoff
  outcome_counts: MemoryMergeOutcomeCountV1[]   # reused from Slice 1
  complete_rate: number (0..1)              # complete_count / size; 0 when size 0
  adverse_rate: number (0..1)               # adverse_count / size; 0 when size 0
}
  refine: complete_count + adverse_count + neutral_count === size
  refine: sum(outcome_counts.count) === size
  refine: run_ids.length === size

MemoryEffectComparisonV1 {
  used_arm: MemoryEffectArmV1               # "used this item" / "memory on"
  comparable_arm: MemoryEffectArmV1         # "same flow, did not use it" / "memory off"
  complete_rate_delta: number               # used.complete_rate - comparable.complete_rate
  adverse_rate_delta: number                # used.adverse_rate  - comparable.adverse_rate
  effect_status: MemoryMergeEffectStatusV1  # populated by the D5 rule (frozen enum)
  effect_note: string                       # human-readable why, names the gate that fired
}

MemoryEffectItemV1 {                        # one row per (group_key, flow_id) cohort
  content_id: string | null                 # null mirrors a Slice 1 unresolved group
  group_key: string                         # content_id, or "unresolved:<memory_input_id>" (the partition key)
  flow_id: string                           # the cohort flow; always present (see D2)
  kind?: MemoryInputKind                    # enrichment, looked up by group_key from merge.memory_items
  source_ref?: Ref                          # enrichment, looked up by group_key from merge.memory_items
  comparison: MemoryEffectComparisonV1
}

MemoryFlowContrastV1 {                      # one row per flow with >=1 memory-on run
  flow_id: string
  comparison: MemoryEffectComparisonV1      # memory-on arm vs memory-off arm
}

MemoryEffectSummaryV1 {                     # roll-up so the honest early state is visible at a glance
  items_total: int>=0
  items_not_enough_data: int>=0
  items_unresolved: int>=0
  items_correlated_positive: int>=0
  items_correlated_negative: int>=0
  flow_contrasts_total: int>=0
  flow_contrasts_not_enough_data: int>=0
  flow_contrasts_unresolved: int>=0          # flow contrasts get the SAME four-status roll-up as items,
  flow_contrasts_correlated_positive: int>=0 # so the validation-experiment half is as glanceable as the
  flow_contrasts_correlated_negative: int>=0 # product half (the contrast reuses the same comparison + D5 rule)
}

HistoryMemoryEffectV1 {
  api_version: "history-memory-effect-v1"
  schema_version: 1
  generated_at: datetime
  runs_base: string
  authority_notice: HISTORY_AUTHORITY_NOTICE
  min_arm_size: int>=1                       # the Q2 gate in effect (default 2), echoed
  margin: number (0 < margin <= 1)           # the D5 separation margin (default 0.5), echoed
  source_run_count: int>=0                   # carried from the merge report (provenance)
  source_envelope_count: int>=0
  source_memory_run_count: int>=0
  item_effects: MemoryEffectItemV1[]
  flow_contrasts: MemoryFlowContrastV1[]
  summary: MemoryEffectSummaryV1
  warnings: HistoryWarningV1[]
}
  refine: summary.items_total === item_effects.length
  refine: summary.items_{status} === item_effects.filter(status).length          (one per status)
  refine: summary.flow_contrasts_total === flow_contrasts.length
  refine: summary.flow_contrasts_{status} === flow_contrasts.filter(status).length (one per status)
```

No new `HistoryWarningCodeV1` value is needed (the earlier `effect_uncohortable_run` was dropped with the unreachable no-flow case, D2). `warnings` carries the Slice 1 merge report's warnings forward unchanged, so the corpus-coverage caveats Slice 1 surfaces (`envelope_missing`, `recall_report_missing`, ...) remain visible in the effect report's provenance.

**The gate relationship is asserted by the aggregator unit test (which drives `aggregateMemoryEffect`), not by a schema refine** (mirroring Slice 1's D4, where the reader's behavior is unit-tested and the contract test only validates the schema): that test proves `effect_status === 'not_enough_data'` exactly when `used_arm.size < min_arm_size || comparable_arm.size < min_arm_size`, and that `correlated_*`/`unresolved` follow the D5 rule. The schema contract test (section 6) only checks the report is well-formed and accepts all four `effect_status` values. Keeping the gate out of the schema lets the schema stay "is this well-formed" while the reader owns "is this verdict earned," the same division Slice 1 used.

## 5. Modules and surface

- `src/history/memory-effect.ts` (new):
  - `aggregateMemoryEffect(merge: HistoryMemoryMergeV1, gates: { minArmSize: number; margin: number }): HistoryMemoryEffectV1` — the **pure** core. Builds `(group_key, flow_id)` cohorts and per-flow on/off cohorts from `merge.linkages`, calls `classifyEffect(comparison, margin, minArmSize)` (D5) for each, rolls up the summary, and carries `merge.warnings` forward. Validates `0 < margin <= 1` and `minArmSize >= 1`. It narrows each linkage's `flow_id` before cohorting (see D2); a linkage missing `flow_id` is skipped (a type-level guard that the real Slice 1 reader never triggers). No I/O.
  - `buildMemoryEffectReport(options): HistoryMemoryEffectV1` — calls `buildMemoryMergeReport(options)` then `aggregateMemoryEffect`. `options` extends the Slice 1 `BuildMemoryMergeReportOptions` with optional `minArmSize`, `margin`.
  - `writeMemoryEffectReport(report, paths): string` — atomic tmp+rename, re-parses to validate, returns the path (identical shape to `writeMemoryMergeReport`).
  - Local constants `DEFAULT_MIN_ARM_SIZE = 2`, `DEFAULT_MARGIN = 0.5`.
- `src/history/indexer.ts`: add `export const HISTORY_MEMORY_EFFECT_FILE = 'memory-effect.v1.json';`.
- `src/cli/history.ts`: add a `memory-effect` subcommand — `--json` (required, like the others), `--runs-base`, `--index-dir`, `--write` (persist to `<index-dir>/memory-effect.v1.json`), `--min-arm-size <n>` (positive int, reuses `parsePositiveInteger`), `--margin <0..1>` (parsed + range-checked, invalid → exit 2). Default prints to stdout.

No change to `src/history/memory-merge.ts`, the Slice 1 schemas, or any envelope/recall/trace code. Slice 2 is strictly additive.

## 6. Definition of done (verification surface)

- `tests/contracts/memory-effect-schema.test.ts` — a valid report parses; every refine + literal + strict rule rejects its violation; `effect_status` accepts all four values; the arm-count and per-status summary refines (items **and** `flow_contrasts`) reject mismatches; `margin` rejects `0` and values `> 1` and accepts `1`.
- `tests/unit/history-memory-effect.test.ts` — drives `aggregateMemoryEffect` from hand-built `HistoryMemoryMergeV1` fixtures (no filesystem):
  - a flow cohort with a 2-run used arm and a 2-run comparable arm that is unanimously split → `correlated_positive`; the mirror → `correlated_negative`; a tied/within-margin split at the floor → `unresolved`.
  - any arm below `min_arm_size` → `not_enough_data` (the universal early case: used arm of 1), asserting the D5 precedence gate.
  - a content item used across two flows → **two** `item_effects` rows, one per flow cohort, each with its own arm membership (proves the `(group_key, flow_id)` comparability of D2).
  - a `content_id: null` (Slice 1 unresolved, `group_key = "unresolved:<id>"`) group → its own size-1 cohort → `not_enough_data` (proves arms partition on `group_key`, not `content_id`, so distinct null-content items never merge).
  - per-flow `flow_contrasts` rows comparing memory-on vs memory-off arms, exercising all four verdicts and asserting the `flow_contrasts_*` summary counts mirror the item-side roll-up.
  - the `summary` roll-up equals the filtered `item_effects`/`flow_contrasts` counts for every status.
- `tests/runner/history-memory-effect-cli.test.ts` — `memory-effect --json` exits 0 with a valid `HistoryMemoryEffectV1` over a temp `.circuit/runs/`; `--write` persists a re-parseable file under `memory-effect.v1.json`; `--min-arm-size`/`--margin` flow through and change the verdict on a fixture; missing `--json` exits 2; `--margin 0` and `--margin 1.5` exit 2 while `--margin 1` is accepted as the inclusive boundary; missing runs base returns an error envelope.
- An end-to-end test that runs Slice 1's `buildMemoryMergeReport` and Slice 2's `buildMemoryEffectReport` over the **same** temp corpus and asserts the effect report's `source_*` counts equal the merge report's counts (proves D1's in-process composition stays in sync).
- `npm run check` (tsc), `npm run lint` (biome), the targeted tests, then `npm run verify:fast` clean.
- Two consecutive adversarial reviews against this spec with no medium-or-above findings.

## 7. Explicit non-goals

- **No behavior change.** Still report-only. Slice 2 renders verdicts; it does not act on them. Gating injection on `effect_status` is Slice 3.
- **No fuzzy intent-class grouping.** The cohort is `flow_id` only (D2). Coarse intent labels, goal-text clusters, and objective-string partitions are deferred.
- **No new per-run capture.** No tokens, no elapsed time, no graduated clean-streak, no attempt/retry-count lift. The lead metric is `complete`-rate; the rest are deferred to a future capture slice (parent design).
- **No composite score.** `complete_rate_delta` and `adverse_rate_delta` stay separate; no weighting invents precision.
- **No re-reading of envelopes/recall/trace.** Slice 2 consumes the Slice 1 merge report only (D1); it imports no trace consumers, `sourceStaleness`, or history hashing internals.
- **No change to the Slice 1 schema or any run artifact.** No writer hook, no post-run hook, no modification of `memory-merge.ts` or the envelope.
- **No claim of statistical adequacy.** Reaching `MIN_ARM_SIZE` makes a verdict *eligible*, not *trustworthy*; the report and the parent design's section 11 both say so.

**Tracked deferred follow-up (Slice 2.1, not built here):** Slice 4's gated pull records pull-sourced hints in a `history.pull-log@v1` sidecar keyed on the same `content_id`. Folding those pulled `content_id`s into the used-arm — so the effect of *pulled* (not just run-start-recalled) memory is measurable — is a named extension of this aggregator (it would union pull-log membership into the `(group_key, flow_id)` used arms). It is deferred, not in scope for the Slice 2 core, and is recorded here so the hook Slice 4 hands off is owned rather than orphaned. The parent design's section 8 tracks it as a numbered follow-up.

## 8. Sequencing against the in-flight architecture-hardening work

Slice 2 is a pure consumer of two stable surfaces: Slice 1's `HistoryMemoryMergeV1` (already built, `verify:fast` green) and the on-disk `run.envelope@v0` outcome enum `RunEnvelopeOutcome`, which the hardening plan does not touch (the soundness review confirmed REP-R2 only single-sourced the separate `RunClosedOutcome`; the join enum is stable). It directly calls only `buildMemoryMergeReport` (which transitively uses `listCandidateRunFolders` and `resolveHistoryPaths`, the same stable history code Slice 1 leans on) plus `resolveHistoryPaths` in the CLI writer path; the pure `aggregateMemoryEffect` core does no I/O at all. It adds no new imports of the runtime trace consumers, the private `sourceStaleness` helper, or history hashing internals while SD-FIX-1/2 are unlanded (REP-R1 and REP-R2 have since landed on the branch; only the SD-FIX hashing/enumerator work remains in flight). It writes no run artifact and adds no post-run hook, so it cannot collide with the post-run extraction refactor the hardening branch is moving. Net: Slice 2 can land any time after Slice 1, in any order relative to the remaining hardening phases. Like Slice 1, it targets stable contracts (schemas, the merge report, refs, run/flow ids, the outcome enum), not current file locations.
