# 3-axis spec: Rigor × Tournament × Autonomous (v1)

Status: historical target spec, last fully code-reconciled on 2026-05-18. The operator-selected v1 posture is recorded as decided: full rubric infrastructure in v1, no minimal interim scorer; orthogonal rigor, tournament, and autonomous axes; optional canonical stages opt in per flow. Parts of the axis work have since shipped, so use current code and the generated surface map as implementation truth before treating Appendix A or C as current.
Scope: cross-cutting. Public flows (Review, Fix, Build, Explore, Pursue) and the internal Runtime Proof flow reconcile to this spec.

Archive note: this is a decision ledger. Use code, tests, generated surfaces,
and [docs/README.md](../README.md) before treating any implementation snapshot here as
current behavior.

Read this as the target design plus a historical current-code reconciliation.
The main body keeps the 31 locked grill decisions intact or marks the
deliberate amendments. Appendix A records what the code did on May 18, 2026,
and is stale where later commits shipped axes and CLI flag work. Appendix B
records the locked decisions. Appendix C is the old misalignment report.
Appendix D records the prior adversarial-review finding resolutions named in
the goal.

Current implementation now has `axes` in compiled flow fixtures and parses
`--rigor`, `--tournament`, `--tournament-n`, and `--autonomous` in the CLI.
This spec remains useful as the decision ledger for the broader axis design,
but its current-code appendix is stale where it says axes and target flags are
absent.

## 0. Why this spec exists

When this spec was written, `Depth` and `entry_modes` carried too much meaning
and the CLI used older aliases. Current code has since shipped the first axis
layer: `src/schemas/axes.ts`, `src/schemas/rigor.ts`, compiled-flow `axes`,
and CLI parsing for `--rigor`, `--tournament`, `--tournament-n`, and
`--autonomous`. The remaining reason to keep this spec is the broader target
shape: rubric provenance, auto-resolution policy vocabulary, and future
tournament behavior.

This shape conflates three things that are not the same:
- **How careful** the run is (rigor).
- **Whether the flow fans out** multiple option strands for comparison (tournament).
- **Whether the operator is present** to resolve checkpoints (autonomous).

Conflating these means tournament-of-fixes is impossible (because tournament is a depth, not a shape), lite-with-autonomy is impossible (because autonomous is a depth, not a posture), and deep-tournament-autonomous can't be expressed at all.

The 3-axis model separates them. Each axis is independently configured. Each flow declares which axis combinations it supports.

---

## 1. The three axes

### Rigor

```
Rigor = lite | standard | deep
```

A rigor knob per stage. **The required stage path is canonical per flow, with explicit opt-in for optional canonical stages.** Every rigor level traverses every stage the flow marks as required. A flow may mark a canonical stage optional via `defineEnforcedStagePolicy`'s `optional_canonicals` field (`src/flows/stage-policy.ts:15-24`, `src/flows/stage-policy.ts:41-68`), but optional means "eligible for a rigor-aware omission," not "always removable." In v1, only lite may omit optional canonical stages. Standard and deep still traverse optional canonical stages. Required stages and checkpoints are immutable across rigor levels. Rigor only changes density inside each stage and whether lite omits an explicitly optional stage.

- **Lite** = one pass per required stage with a permissive quality bar; may skip stages declared in `optional_canonicals`.
- **Standard** = default rigor; traverses all required stages and all optional canonical stages.
- **Deep** = iterate within each required and optional stage until a per-stage rubric is satisfied, or a budget cap fires.

Rigor never adds stages. Rigor never removes stages a flow has not marked optional. (Renamed from `Depth` to keep semantics tight; "depth" is overloaded in CS contexts.)

**Example.** Fix declares Review as an `optional_canonical` (`src/flows/fix/data.ts:590-595`). Fix lite skips Review by routing verification straight to `fix-close-lite` (`src/flows/fix/data.ts:443-447`, `src/flows/fix/data.ts:480-500`; generated projection: `generated/flows/fix/lite.json:59-63`). Fix standard and Fix deep both traverse Review. This honors the original intent of "rigor never silently removes stages" while admitting that some flows have a Review pass that's only useful at higher rigor.

### Tournament

```
Tournament = false | true
TournamentN = integer in [2, 4] (default 3, max 4 in v1)
```

The cap reflects the option-comparison surface: humans struggle to compare more than 4 candidates side-by-side, and the current rendering surfaces (option IDs, checkpoint cards, MD/HTML projectors) are sized to 4. The cap is a v1 product limit; lift in v2 if a real use case demands it.

A stage-local fan-out + winner-select mechanism. When tournament is on:

1. One specific stage (the flow's declared `tournament_fan_out_stage`) generates exactly `tournament_n` independent strands in parallel.
2. Each strand runs in isolation. Strands do **not** see each other during generation.
3. Each strand runs at the same rigor as the overall run. Deep + tournament = N deep strands.
4. A structured winner-select checkpoint exposes exactly those `tournament_n` strand ids as selectable options and chooses one strand. The remaining stages run once over the winner.
5. If a strand fails mid-generation: continue if survivors ≥ 2; otherwise abort with `tournament collapsed: <reason>`.

Tournament never adds stages outside its fan-out. The winner-select checkpoint is part of the fan-out stage.

### Autonomous

```
Autonomous = false | true
```

A checkpoint-resolution policy. When autonomous is on:

1. Stages and checkpoints exist exactly as in interactive runs.
2. At each checkpoint, instead of waiting for the operator, the checkpoint's declared auto-resolution rule fires.
3. Every auto-resolution is recorded in the canonical operator report's Auto-resolutions section.
4. Ambient interactive UI is suppressed (auto-open HTML, prompt waits). Trace output (progress prints, file writes, auto-resolve events) is kept.

Autonomous never removes checkpoints from the schematic. The rule fires *instead of* waiting.

---

## 2. Composition

The three axis types are independent. Any `(rigor, tournament, autonomous)` tuple is parseable at the CLI layer. Per-flow schematics declare which tuples are valid for that flow.

**Default-deny.** A flow that does not advertise support for an axis combination rejects it at parse time with the allow-list in the error message.

**Cross-axis constraints live in flows, not in the axis spec.** The axis spec does not declare e.g. "tournament requires standard rigor". If a flow can't run tournament at lite, that's a flow constraint, declared in the flow's schematic.

---

## 3. Per-flow allow-lists

In the target design, each flow's schematic carries:

```jsonc
{
  "axes": {
    "allowed_rigors": ["lite", "standard", "deep"],
    "supports_tournament": false,
    "supports_autonomous": false,
    "default": { "rigor": "standard", "tournament": false, "autonomous": false, "tournament_n": 3 },
    "tournament_fan_out_stage": "<stage-id>"  // only when supports_tournament: true
  }
}
```

Axis-level defaults (used when a flow omits `default`): `rigor=standard`, `tournament=false`, `autonomous=false`, `tournament_n=3`.

**Starting target allow-lists for the existing flows** (originally projected
from legacy entry modes; current code should be checked against each flow's
`axes` block):

| Flow | allowed_rigors | supports_tournament | supports_autonomous |
|---|---|---|---|
| Review | `[standard]` | no | no |
| Fix | `[lite, standard, deep]` | no | yes |
| Build | `[lite, standard, deep]` | no | yes |
| Explore | `[lite, standard, deep]` | **yes** | yes |
| Pursue | `[standard]` | no | yes |
| Runtime Proof (internal) | `[standard]` | no | no |

Current code now carries this table as `axes` blocks in generated compiled
flows. Treat this table as the intended public support projection and verify
the exact current values against `src/flows/<id>/data.ts` and
`generated/flows/<id>/*.json`.

---

## 4. CLI surface

The target CLI has three flags, one per axis.

```
--rigor {lite|standard|deep}
--tournament              # boolean; presence = on, absence = off
--tournament-n N          # optional N; default 3 when --tournament passed
--autonomous              # boolean
```

Examples:

```
circuit explore --goal "..."                                         # defaults
circuit explore --goal "..." --rigor deep                            # deep, no tournament, not autonomous
circuit explore --goal "..." --tournament                            # tournament, N=3
circuit explore --goal "..." --tournament --tournament-n 4 --rigor deep
circuit build --goal "..." --autonomous
```

`--mode` is **removed**. The alias validators (`entryModeForDepth`, `depthForEntryMode`, `validateModeDepthAliasConsistency`) and mode/depth runtime support rows go with it.

Error shape on unsupported tuples mirrors today's `--depth` rejection: name the unsupported axis value and list the flow's allow-list inline (`src/cli/circuit.ts:466-475`).

---

## 5. Auto-resolution policies

In the target design, each checkpoint in a schematic declares one of four policies:

| Policy | Behavior |
|---|---|
| `accept-as-is` | Take the model's proposed value as the resolution. |
| `highest-score` | Pick the option with the highest `aggregate_score` from a typed rubric result. Applies the tie-break rule in §9. Records the winning score, runner-up score, margin, tie-break path, and any runtime-veto effect. |
| `first-acceptable` | Pick the first option meeting a minimum-bar predicate. |
| `refuse` | Cannot be auto-resolved. Hitting this checkpoint in autonomous mode is a hard failure. |

**Static validation at fixture-load.** A flow that declares `supports_autonomous: true` and contains any `refuse` checkpoint reachable in its stage path is rejected at fixture-load time. Authors must fix the schematic.

The tournament winner-select checkpoint uses `highest-score` by convention when autonomous; per-flow declaration can pick a different policy. A `highest-score` checkpoint must declare a rubric source whose option ids match the checkpoint choices. Fixture-load validation rejects missing rubric sources, choices without rubric rows, and rubric rows without choices.

---

## 6. Tournament internals

Target behavior:

| Property | Value |
|---|---|
| Fan-out point | Per-flow declared `tournament_fan_out_stage` (must exist in the flow's stage list). |
| Strand count | Runtime parameter `tournament_n`. Default 3. Range [2, 4] in v1. See §1 Tournament for rationale. |
| Branch generation wiring | The fan-out source report, dynamic branch expansion, and branch cap all use the resolved `tournament_n`. Generating fewer or more than `tournament_n` strand records is a hard runtime error before child relays start. Current code has only a static `max_branches: 4` cap (`src/flows/explore/data.ts:347-353`, `src/runtime/fanout/branch-expansion.ts:61-65`), so this wiring is a required code change. |
| Checkpoint option wiring | The winner-select checkpoint's `allow` list and `policy.choices` are generated from the same resolved strand ids. No hard-coded `option-1` through `option-4` surface remains after migration. Current Explore hard-codes four options (`src/flows/explore/data.ts:403-430`). |
| Strand isolation | Fully independent. No cross-strand awareness during generation. |
| Strand rigor | Inherits run rigor. Deep + tournament = N deep strands. |
| Winner-select shape | Pick one of N. Losing strands surfaced as Options in the canonical operator report alongside the winning Recommendation. |
| Strand failure | Tournament fanout requires `on_child_failure: continue-others` and `join.policy: aggregate-survivors`. Continue if survivors ≥ 2; otherwise abort with `tournament collapsed: <reason>`. |

**Implementation note.** Survivor-aware behavior is a two-part contract. The fanout step must use `on_child_failure: continue-others` so later children are not cancelled when an early child fails; the schema already has that failure-policy value (`src/schemas/step.ts:347-350`). The join must use `aggregate-survivors` alongside the existing `aggregate-only` (`src/schemas/check.ts:136-147`, `src/shared/fanout-join-policy.ts:90-112`). The survivor policy succeeds when ≥ 2 strands close with parseable bodies, failing only if < 2 do. Tournament flows use `aggregate-survivors`; the existing `aggregate-only` stays for non-tournament fanout that genuinely needs all branches. Explore now uses this survivor policy.

---

## 7. Autonomous internals

Target behavior:

| Surface | Behavior when autonomous=true |
|---|---|
| Stages | Same as interactive. |
| Checkpoints | Same checkpoints exist. Each fires its declared auto-resolution policy. |
| Auto-open HTML at flow close | Suppressed. |
| Checkpoint wait events | Replaced by auto-resolve events. |
| Progress prints to stdout | Kept (so tail-logging operators see real-time activity). |
| Operator-summary surfaces (JSON / MD / HTML) | All three still written. |
| Validation | Static at fixture-load: no `refuse` checkpoint may be reachable. |

---

## 8. Rigor internals

Target behavior:

| Property | Value |
|---|---|
| Stage path | Required canonicals are immutable per flow. Lite may omit only flow-declared `optional_canonicals`; standard and deep must include them. |
| Per-stage effect | Lite: one pass, permissive quality bar. Standard: default rigor. Deep: iterate to satisfy a per-stage rubric or hit a budget cap. |
| Rubric computation | Always, at every rigor. Lite runs report rubric scores too — they're just allowed to be lower. |
| Model awareness | The model never sees a `rigor=lite` label. Runtime drives behavior via prompt structure: iteration count, sub-prompt content, stage configuration. The model just responds to what's asked. |

Negative-test guidance: fixture or compiler tests must reject any standard/deep projection that omits a flow's optional canonical stage. The current policy core treats optional canonicals as accepted-but-not-required during canonical-set validation (`src/shared/flow-kind-policy-core.ts:107-112`), so the axis migration must add rigor-aware tests rather than relying on that generic policy alone.

---

## 9. Rubric provenance

In the target design, every rubric dimension is **hybrid**: a runtime-computed necessary-condition check plus a model judgment.

```
RubricDimResult = {
  runtime_signal: "met" | "missing" | "n/a",
  model_judgment: "pass" | "concern" | "fail",
  final_score:    "pass" | "concern" | "fail",
  dim_score: 1 | 0.5 | 0,
  runtime_vetoed: boolean
}

RubricResult = {
  dims: Record<dim_id, RubricDimResult>,
  aggregate_score: number, // average dim_score in [0, 1]
  runtime_veto_count: number,
  tie_break: {
    ordered_dims: string[],
    final_reason: string
  }
}
```

**Dim scale.** `pass = 1`, `concern = 0.5`, `fail = 0`. `aggregate_score` is the arithmetic mean of all dim scores, rounded to three decimal places for reports and stored as a number. All dims count equally in v1.

**Combine rule: runtime-veto.** If `runtime_signal === "missing"`, `final_score = fail`, `dim_score = 0`, and `runtime_vetoed = true` regardless of model judgment. If `runtime_signal === "met"` or `"n/a"`, `final_score = model_judgment`, `dim_score` follows the scale above, and `runtime_vetoed = false`. Runtime can force fail; runtime cannot force pass. Matches the Proof-Carrying Fix authority pattern.

**Tie-break rule for `highest-score`.** Sort by `aggregate_score` descending. If tied, sort by fewer `runtime_veto_count`. If still tied, compare dim scores in this fixed order: Evidence rigor, Actionability, Coverage adequacy, Scope discipline, Honest calibration, Project-specificity, Insight density, Branch distinctness. If still tied, choose the lowest original strand ordinal. The selected tie-break path is recorded in the Auto-resolutions section.

The runtime signal for each Explore rubric dim:

| Dim | Runtime signal |
|---|---|
| Evidence rigor | `evidence_refs` non-empty and well-formed |
| Project-specificity | (no runtime signal; model judgment only) |
| Insight density | (no runtime signal; model judgment only) |
| Actionability | `next_action` present and structured |
| Honest calibration | (no runtime signal; model judgment only) |
| Coverage adequacy | Every `must_answer` item mapped to a Finding or Option |
| Scope discipline | No writes outside run folder; no out-of-scope file reads recorded |
| Branch distinctness (tournament only) | (no runtime signal; model judgment only) |

Dims with no runtime signal: `model_judgment` is authoritative. Their `runtime_signal` field is `"n/a"`.

---

## 10. Auto-resolutions Section In The Canonical Operator Report

Target tiered recording.

**Markdown / HTML** (operator-facing prose):

> **Auto-resolutions**
> - Frame: accepted as-is by policy `accept-as-is`.
> - Tournament tradeoff: strand B selected by policy `highest-score` (aggregate score 0.875; margin +0.161 over runner-up; no runtime vetoes).

**JSON** (full provenance, one row per checkpoint resolved; example abbreviates repeated dim rows):

```jsonc
{
  "auto_resolutions": [
    {
      "checkpoint_id": "frame-checkpoint",
      "policy": "accept-as-is",
      "resolved_value": "<model-proposed-frame>",
      "alternatives_available": [],
      "runtime_or_model": "runtime",
      "resolved_at": "2026-05-11T12:34:56Z"
    },
    {
      "checkpoint_id": "tournament-tradeoff",
      "policy": "highest-score",
      "resolved_value": "strand-b",
      "alternatives_available": ["strand-a", "strand-c"],
      "scores": {
        "strand-a": { "aggregate_score": 0.714, "runtime_veto_count": 1 },
        "strand-b": { "aggregate_score": 0.875, "runtime_veto_count": 0 },
        "strand-c": { "aggregate_score": 0.625, "runtime_veto_count": 0 }
      },
      "rubric_results": {
        "strand-b": {
          "dims": {
            "evidence_rigor": {
              "runtime_signal": "met",
              "model_judgment": "pass",
              "final_score": "pass",
              "dim_score": 1,
              "runtime_vetoed": false
            }
          },
          "aggregate_score": 0.875,
          "runtime_veto_count": 0,
          "tie_break": {
            "ordered_dims": [
              "evidence_rigor",
              "actionability",
              "coverage_adequacy",
              "scope_discipline",
              "honest_calibration",
              "project_specificity",
              "insight_density",
              "branch_distinctness"
            ],
            "final_reason": "highest aggregate score"
          }
        }
      },
      "tie_break": "highest aggregate score",
      "runtime_veto_effect": "strand-a evidence_rigor runtime_signal=missing forced final_score=fail and dim_score=0",
      "runtime_or_model": "runtime",
      "resolved_at": "2026-05-11T12:36:42Z"
    }
  ]
}
```

---

## 11. Migration plan

Sliced, Proof-Carrying-Fix style. Each slice ships independently with full tests. Slices that touch generated surfaces regenerate the relevant fixtures and plugin bundles before they are considered done.

### Slice 1 — schema layer

- Rename `src/schemas/depth.ts` → `src/schemas/rigor.ts`. Type becomes `Rigor = z.enum(['lite','standard','deep'])`.
- Add `src/schemas/tournament.ts` and `src/schemas/autonomous.ts` (or a combined `src/schemas/axes.ts`).
- Replace `CONSEQUENTIAL_RIGORS` constant with a helper `isConsequentialAxes({ rigor, tournament, autonomous })` returning `rigor === 'deep' || tournament || autonomous`.
- No CLI or schematic changes yet. Old code paths still compile against compatibility re-exports if needed; otherwise tests are touched in this slice.
- **No fixture regeneration.**

### Slice 2 — CLI layer

- Update CLI parsing to accept `--rigor`, `--tournament`, `--tournament-n`, `--autonomous`.
- Drop `--mode`. Drop `entryModeForDepth`, `depthForEntryMode`, `validateModeDepthAliasConsistency`, `validateFlowDepth`, and mode/depth runtime support rows.
- New per-tuple validation reads the per-flow allow-list from the compiled fixture.
- Static fixture-load validation: refuse-policy checkpoint + `supports_autonomous: true` → reject.
- Update CLI router and `cli-router.test.ts`.
- **No fixture regeneration yet.** Compiled fixtures still carry the old `entry_modes` shape; this slice adds a transitional reader that maps old shape to allow-list at load. Reader is removed in Slice 4.

### Slice 3 — per-flow schematic + fixture updates

For each public flow (Review, Fix, Build, Explore, Pursue) and then Runtime Proof if it remains an emitted internal fixture:

- Rewrite `src/flows/<flow>/schematic.json`: remove `entry_modes`, add the `axes` block.
- Regenerate `generated/flows/<flow>/circuit.json`.
- Update flow's contract.md to reference axes.
- Regenerate plugin runtime bundles (`plugins/codex/runtime/`, `plugins/claude/runtime/`).
- Refresh golden run proofs.
- Update flow-specific tests.

### Slice 4 — drop dead code

- Drop the Slice-2 transitional reader.
- Drop any remaining shims, compat re-exports, or alias code.
- Drop `entry_modes` from `CompiledFlow` schema.
- Drop tests pinning the old alias behavior.

### Slice 5 — rubric infrastructure and autonomous tournament

Required for autonomous + tournament to ship in v1. This is not a minimal interim scorer. Each sub-slice is independently shippable and must leave `npm run verify:fast` green before the next sub-slice starts.

#### Slice 5A — typed rubric result

- Add the typed `RubricDimResult` and `RubricResult` shapes from §9, including `runtime_signal: "n/a"`, `aggregate_score`, `runtime_veto_count`, and `tie_break`.
- Add a pure combiner that applies the runtime-veto rule and dim scale.
- Tests: combiner table tests for `met`, `missing`, and `n/a`; aggregate-score rounding; tie-break order; runtime-veto effect.

#### Slice 5B — Explore rubric sources

- Wire Explore's 8 rubric dims (§9) with their runtime signals.
- Preserve model-only dims by emitting `runtime_signal: "n/a"`.
- Tests: fixture/report tests prove every Explore dim emits exactly one result and that missing runtime evidence forces dim `fail`.

#### Slice 5C — `tournament_n` branch and checkpoint wiring

- Thread resolved `tournament_n` from CLI parse through run config into Explore option generation, dynamic fanout expansion, branch cap, checkpoint `allow`, and checkpoint `choices`.
- Generate exactly N strand ids and exactly N selectable checkpoint options from the same source.
- Tests: N=2, N=3 default, and N=4 runs produce matching branch counts and checkpoint options; N outside [2, 4] fails before flow execution; generated fewer/more options than N fails before child relays start.

#### Slice 5D — survivor fanout contract

- Add `aggregate-survivors` join policy in `src/schemas/check.ts` and `src/shared/fanout-join-policy.ts` (§6).
- Require tournament fanout steps to pair `on_child_failure: continue-others` with `join.policy: aggregate-survivors`.
- Tests: one failed strand with at least two parseable survivors continues; fewer than two parseable survivors aborts with `tournament collapsed: <reason>`; tournament fixtures using `abort-all` or `aggregate-only` are rejected.

#### Slice 5E — autonomous `highest-score` and reports

- Add the `highest-score` auto-resolution policy in the checkpoint executor; it ranks tournament strands using the per-strand rubric result and tie-break rule.
- Wire Explore's tournament tradeoff checkpoint to declare `auto_resolution: highest-score` so autonomous runs auto-select via rubric.
- Add the `auto_resolutions` section to operator-summary JSON (full provenance) and MD/HTML (summary line per row).
- Tests: checkpoint unit tests for score selection and tie-breaks; operator-summary tests for full JSON provenance and compact Markdown/HTML summaries.

#### Slice 5F — end-to-end autonomous tournament

- Run a full Explore autonomous tournament with at least one runtime-vetoed strand and a rubric-selected winner.
- Tests: end-to-end run proves the winning option, losing options, rubric result, runtime-veto effect, auto-resolution row, and final report all agree.

### Historical data

Hard break. Old run folders are not parseable by new code. Old fixtures regenerated in Slice 3. No migration tooling for run folders.

---

## 12. Edge cases (locked)

| Case | Behavior |
|---|---|
| `--tournament-n` outside [2, 4] | Parse-time error: "Tournament N must be between 2 and 4". |
| `--tournament` on a flow with `supports_tournament: false` | Parse-time error with flow's allow-list. |
| `--autonomous` on a flow with `supports_autonomous: false` | Parse-time error with flow's allow-list. |
| Tournament option generation returns fewer or more than `tournament_n` options | Runtime error before fanout starts; no child relays launch. |
| Flow with `supports_autonomous: true` containing a `refuse` checkpoint | Fixture-load rejection. |
| Operator passes axis flags + the flow has different defaults | Operator flags override per-axis. Unspecified axes use flow defaults; flow defaults fall back to axis defaults. |
| Autonomous on a flow with zero checkpoints | Valid (no-op for checkpoint resolution). All other autonomous behaviors still apply. |
| Tournament strand failure (1 of N fails) | Continue with N-1 if ≥ 2 survivors. |
| Tournament strand failure (>1 of N fails, < 2 survivors) | Abort with `tournament collapsed: <reason>`. |
| Lite omits an `optional_canonical` stage | Valid only when the flow declared that canonical in `optional_canonicals`. |
| Standard or deep omits an `optional_canonical` stage | Invalid in v1. Standard and deep must traverse optional canonical stages. |
| Lite + tournament | Valid. N lite strands. Cheap-and-diverse use case. |
| Deep + tournament + autonomous | Valid. N deep strands, winner auto-selected. |

---

## 13. Cross-cutting interactions (deferred to their own grills)

- **`--from-run`** — interaction with axes (can `--from-run` change axes vs the original run?) is part of the `--from-run` spec, not this one.
- **Checkpoint protocol** — the exact wire shape of `user_input.requested` events and how host adapters render them is part of the checkpoint protocol spec.
- **Config layer** — whether user-global or project config can override per-flow allow-lists is deferred to the config spec. This 3-axis spec is config-agnostic.

---

## 14. Acceptance criteria

Implementation matches this spec when every row below has a passing proof.

| # | Criterion | Falsifiable proof |
|---|---|---|
| 1 | `src/schemas/rigor.ts` exports `Rigor = z.enum(['lite','standard','deep'])`. No `tournament` or `autonomous` values in the rigor enum. | Schema test imports `Rigor`, accepts only the three values, and asserts parsing `tournament`/`autonomous` fails. |
| 2 | `CompiledFlow` schema declares an `axes` block; no `entry_modes` array. | Contract test parses a fixture with `axes`; rejects one with `entry_modes`; generated fixtures grep clean for `"entry_modes"`. |
| 3 | CLI parses `--rigor`, `--tournament`, `--tournament-n`, `--autonomous`; rejects `--mode` as unknown; validates `--tournament-n` against [2, 4]. | CLI router tests cover default axes, each flag, N=2/3/4, N=1/5 rejection, and `--mode` rejection. |
| 4 | The five public flows and the internal Runtime Proof fixture carry the allow-lists in §3. | Catalog completeness test compares each compiled fixture's `axes` block against the §3 table and fails on missing/extra flows. |
| 5 | A flow with `supports_autonomous: true` and a reachable `refuse` checkpoint fails fixture load. | Fixture-load test builds a minimal invalid flow and expects the load error to name the checkpoint and `refuse`. |
| 6 | Optional canonical stages are declared via `defineEnforcedStagePolicy`'s `optional_canonicals`. Fix declares Review as optional; Fix lite skips Review; Fix standard and Fix deep traverse it. | Flow-kind and fixture tests assert Fix `optional_canonicals: ['review']`; generated Fix lite omits Review; generated Fix standard/deep include Review; negative tests reject standard/deep projections that omit Review. |
| 7 | Each rubric dim emits `RubricDimResult` and every option emits `RubricResult` with `runtime_signal: "met" \| "missing" \| "n/a"`, dim scale, aggregate score, tie-break, and runtime-veto effect. | Rubric combiner tests cover all runtime-signal values, score mapping, aggregate rounding, tie-break order, and runtime-vetoed missing evidence. |
| 8 | Auto-resolutions section appears in operator-summary JSON with full provenance and in MD/HTML with summary lines. | Operator-summary tests assert JSON includes `auto_resolutions[*].rubric_results`, aggregate scores, tie-break path, and runtime-veto effect; Markdown/HTML snapshots show one compact line per auto-resolution. |
| 9 | Tournament fanout uses `on_child_failure: continue-others` plus `aggregate-survivors`: ≥ 2 parseable survivors continue; < 2 aborts with `tournament collapsed: <reason>`. | Fanout unit tests and Explore fixture tests cover one failed strand continuing, one survivor aborting, and rejection of tournament fanout configured with `abort-all` or `aggregate-only`. |
| 10 | `tournament_n` wires to branch generation and checkpoint selectable options. | End-to-end or runner tests for N=2/3/4 assert branch count, fanout aggregate rows, checkpoint `allow`, checkpoint `choices`, and option ids all match the resolved N. |
| 11 | Autonomous + tournament end-to-end run produces a `highest-score`-selected winner with rubric scores recorded in the Auto-resolutions section. | Explore autonomous tournament test runs with a runtime-vetoed strand and asserts selected winner, losing options, rubric result, auto-resolution row, and final report agree. |
| 12 | Generated fixtures and plugin runtime bundles are regenerated for every slice that touches generated surfaces; no generated surface drift remains. | Each generated-surface slice ends with `npm run verify:fast` and `npm run check-flow-drift`; final migration runs full `npm run verify`. |

---

## 15. Open questions for downstream specs

- Frame checkpoint shape — defined in `explore-intent-v1.md`; this spec assumes it.
- Branch-distinctness runtime signal (tournament-only rubric dim) — the v1 dim remains model-judged with `runtime_signal: "n/a"`; a non-trivial similarity heuristic can add a runtime signal later.
- Operator-summary display tuning (which axis values are always shown vs conditionally) — implementation detail.
- Schematic schema_version bump — implementation detail resolved during Slice 1, with fixture parsing and drift tests proving the chosen version.

---

## Appendix A. Historical Current-Code Reconciliation (2026-05-18)

This appendix is a dated reconciliation snapshot. It is not the current
implementation truth after the May 19 axis and CLI commits.
Rows marked as shipped after this snapshot record the May 19 code state so
readers do not mistake already-landed axis work for remaining follow-up.

### A1. Architecture and source of truth

| Surface | Current code fact | Evidence | Status |
|---|---|---|---|
| Flow ownership | Flows are authored as `FlowData`/`FlowDefinition` packages and compiled through `flowPackages`; engine registries derive from the catalog. | `src/flows/flow-definition.ts:67-86`, `src/flows/flow-definition.ts:316-339`, `src/flows/flow-definition.ts:374-388`, `src/flows/catalog.ts:18-27` | Spec corrected here. |
| Engine boundary | The engine is not supposed to import individual flow modules directly; adding a flow means adding a package and appending it to the catalog. | `src/flows/types.ts:1-11`, `src/flows/catalog.ts:1-6` | Spec corrected here. |
| Runtime surfaces | Public operator/runtime metadata is carried on each package as `runtimeSurface.supportedEntryModes`, primary result, and progress metadata. | `src/flows/types.ts:140-166`, `src/flows/flow-definition.ts:279-293` | Spec corrected here. |

### A2. Schemas and compiled fixture shape

| Claim area | Current code fact | Evidence | Status |
|---|---|---|---|
| Axis schema | `Rigor`, `Axes`, `TournamentN`, and `FlowAxes` now exist. `Depth` remains as a legacy compatibility enum. | `src/schemas/axes.ts`, `src/schemas/rigor.ts`, `src/schemas/depth.ts` | Axis base shipped after this snapshot. |
| Compiled fixtures | `CompiledFlow` now requires `axes` and `starts_at`; legacy `entry_modes` is rejected by the strict schema. | `src/schemas/compiled-flow.ts`, `tests/contracts/flow-graph-schema.test.ts` | Axis base shipped after this snapshot. |
| Flow schematics | Active schematics now declare `axes`, `stage_path_policy`, and `stages`; legacy `entry_modes` is rejected. | `src/schemas/flow-schematic.ts`, `src/flows/*/schematic.json`, `tests/contracts/flow-schematic.test.ts` | Axis base shipped after this snapshot. |
| Checkpoint policies | Checkpoints declare `choices`, optional safe choices, optional typed `auto_resolution` policies (`accept-as-is`, `highest-score`, `first-acceptable`, `refuse`), and optional `report_template`. | `src/schemas/step.ts`, `tests/runner/cli-router.test.ts` | Auto-resolution policy shipped after this snapshot. |
| Fanout limits | Static fanout caps branches at 64. Dynamic fanout has a positive `max_branches` capped at 256 and defaulted to 16. Bounded concurrency is capped at 64. | `src/schemas/step.ts:300-350` | Spec target differs; see C3.2 and C3.3. |

### A3. CLI surface and fixture-load validation

| Claim area | Current code fact | Evidence | Status |
|---|---|---|---|
| CLI flags | The CLI parses `--rigor`, `--tournament`, `--tournament-n`, and `--autonomous`; tests reject old `--entry-mode`, `--mode`, and `--depth` flags. | `src/cli/circuit.ts`, `tests/runner/cli-router.test.ts` | Axis CLI shipped after this snapshot. |
| Target flags | Target flags are implemented at the CLI parsing layer and validated against each flow's allow-list. | `src/cli/circuit.ts`, `tests/runner/cli-router.test.ts` | Axis CLI shipped after this snapshot. |
| Alias validators | Old mode/depth alias validators were removed from the current CLI path. | `src/cli/circuit.ts`, `tests/runner/cli-router.test.ts` | Axis CLI shipped after this snapshot. |
| Runtime support validation | The CLI validates axis choices against each flow's `axes` support. | `src/cli/circuit.ts`, `src/schemas/axes.ts` | Axis CLI shipped after this snapshot. |
| Fixture load | `loadFixture` parses `CompiledFlow`, validates flow-kind stage policy, and rejects autonomous-capable fixtures that declare checkpoint `auto_resolution.policy: "refuse"`. | `src/cli/circuit.ts`, `tests/runner/cli-router.test.ts` | Partially shipped after this snapshot. |

### A4. Checkpoints, autonomous behavior, and presentation

| Claim area | Current code fact | Evidence | Status |
|---|---|---|---|
| Checkpoint resolution | Autonomous checkpoints use typed `auto_resolution` when declared; otherwise they fall back to `safe_autonomous_choice`. Non-autonomous defaults still use `safe_default_choice`. | `src/runtime/executors/checkpoint.ts`, `src/schemas/step.ts` | Auto-resolution policy shipped after this snapshot; safe-choice fallback remains. |
| Missing safe choice | Missing safe choices fail during runtime execution and are recorded in trace; they do not fail fixture load. | `src/runtime/executors/checkpoint.ts:181-191`, `tests/runtime/control-loop.test.ts:849-912` | Code must change to match spec. |
| Checkpoint request body | Request JSON records prompt, allowed choices, safe defaults, and execution context. | `src/runtime/executors/checkpoint.ts:67-94` | Spec corrected here. |
| Auto-resolved trace | `checkpoint.requested` and `checkpoint.resolved` trace entries include `auto_resolved`. | `src/runtime/executors/checkpoint.ts:149-158`, `src/runtime/executors/checkpoint.ts:200-215` | Partially supports target. |
| Run boundary presentation hook | The run boundary wires a progress projector into the trace store, so presentation events are derived from trace append events. | `src/runtime/run/run-boundary.ts:86-113` | Spec corrected here. |
| Progress presentation | Progress projection suppresses waiting UI for auto-resolved checkpoint requests; non-auto-resolved checkpoints emit `checkpoint.waiting` and `user_input.requested`. | `src/runtime/projections/progress.ts:673-755` | Spec corrected here. |
| Operator summary | JSON, Markdown, and optionally HTML summaries are written. Auto-resolved checkpoint decisions are recorded in `auto_resolutions` when present. | `src/shared/operator-summary-writer.ts`, `tests/runner/cli-router.test.ts` | Auto-resolution reporting shipped after this snapshot. |

### A5. Tournament behavior

| Claim area | Current code fact | Evidence | Status |
|---|---|---|---|
| Tournament as entry mode | Explore now declares tournament support on `axes`. The runtime still emits compatibility `entry_mode` labels such as `tournament` or `autonomous`. | `src/flows/explore/data.ts`, `src/cli/circuit.ts`, `tests/runner/cli-router.test.ts` | Axis selection shipped after this snapshot; compatibility labels remain. |
| Fan-out stage | Explore declares `axes.tournament_fan_out_stage: "decision-stage"` and fans out option cases in the Plan/Decision stage. | `src/flows/explore/data.ts`, `generated/flows/explore/tournament.json` | Shipped after this snapshot. |
| Strand count | Explore tournament fanout reads `axis.tournament_n`; the CLI validates the v1 range [2, 4]. | `src/flows/explore/data.ts`, `src/cli/circuit.ts`, `tests/runner/cli-router.test.ts` | Shipped after this snapshot. |
| Failure policy | Explore tournament uses `on_child_failure: continue-others` and `join.policy: aggregate-survivors`. | `src/flows/explore/data.ts`, `src/shared/fanout-join-policy.ts`, `src/runtime/executors/fanout.ts` | Shipped after this snapshot. |
| Join output | Runtime writes a fanout aggregate and appends `fanout.joined` with completed and failed branch counts. | `src/runtime/executors/fanout.ts:198-241` | Spec corrected here. |

### A6. Current per-flow support projection

| Flow | Visibility | Current entry modes/depths | Target-axis projection | Evidence | Status |
|---|---|---|---|---|---|
| Review | public | `default/standard` | `[standard]`, no tournament, no autonomous | `src/flows/review/data.ts:38-91` | Spec corrected here. |
| Fix | public | `default/standard`, `lite/lite`, `deep/deep`, `autonomous/autonomous` | `[lite, standard, deep]`, no tournament, autonomous yes | `src/flows/fix/data.ts:141-165`, `src/flows/fix/data.ts:590-595` | Projection is valid under the optional-canonical amendment; see C3.1. |
| Build | public | `default/standard`, `lite/lite`, `deep/deep`, `autonomous/autonomous` | `[lite, standard, deep]`, no tournament, autonomous yes | `src/flows/build/data.ts:100-121`, `generated/flows/build/circuit.json:13-38` | Spec corrected here. |
| Explore | public | `default/standard`, `lite/lite`, `deep/deep`, `tournament/tournament`, `autonomous/autonomous` | `[lite, standard, deep]`, tournament yes, autonomous yes | `src/flows/explore/data.ts:111-140`, `generated/flows/explore/tournament.json:13-20` | Projection is valid; tournament details are target changes in C3.2-C3.6. |
| Pursue | public | `default/standard`, `autonomous/autonomous` | `[standard]`, no tournament, autonomous yes | `src/flows/pursue/data.ts:34-39`, `src/flows/pursue/data.ts:98-109`, `generated/flows/pursue/circuit.json:13-26` | Spec corrected here. |
| Runtime Proof | internal | `runtime-proof/standard` | `[standard]`, no tournament, no autonomous | `src/flows/runtime-proof/data.ts:5-35`, `generated/flows/runtime-proof/circuit.json:13-20` | Spec corrected here. |

## Appendix B. Locked grill decision ledger (31)

None of these decisions were silently changed. Rows marked "amended" point to the one-line resolution and the spec section that now carries the operator-selected v1 posture. Rows marked "code follow-up" are target decisions that current code has not implemented yet.

| # | Locked decision | Reconciliation status |
|---|---|---|
| D01 | Split flat depth into rigor, tournament, and autonomous axes. | Shipped after this snapshot through `Axes`/`FlowAxes`; legacy `Depth` remains for compatibility labels and selection depth plumbing. |
| D02 | Rigor vocabulary is `lite`, `standard`, `deep`. | Shipped after this snapshot through `Rigor`; legacy `Depth` still includes `tournament` and `autonomous` for compatibility labels. |
| D03 | Rigor must not alter the canonical stage path. | Amended by §1, §8, and C3.1: required canonicals remain immutable; flow-declared `optional_canonicals` may be omitted only by lite in v1. Fix lite omits Review today (`src/flows/fix/data.ts:443-447`, `generated/flows/fix/lite.json:59-63`). |
| D04 | Lite means one pass per stage with a permissive bar. | Preserved target; not represented as a typed runtime policy today. |
| D05 | Standard is the baseline. | Shipped after this snapshot: `Axes` defaults to `rigor: "standard"`, `tournament: false`, `tournament_n: 3`, and `autonomous: false`. |
| D06 | Deep iterates within each stage until rubric pass or budget cap. | Preserved target; current code has `deep` depth but no generic typed iteration policy in the audited surfaces. |
| D07 | Rigor never adds or removes checkpoints. | Amended by §1, §8, and C3.1: required checkpoints remain immutable; checkpoints inside a lite-omitted optional canonical are omitted only when that canonical is explicitly optional. Negative tests must reject standard/deep omission. |
| D08 | Tournament is boolean plus N integer lower bound 2, default 3. | Shipped after this snapshot with the v1 [2, 4] cap. |
| D09 | Tournament fan-out happens at a flow-declared stage. | Shipped after this snapshot through `axes.tournament_fan_out_stage`. |
| D10 | Tournament strands are isolated during generation. | Partially matched for relay branches; fanout runs branch-specific outputs and branch directories (`src/runtime/executors/fanout.ts:127-170`). |
| D11 | Tournament strands inherit run rigor. | Partially shipped after this snapshot: the CLI accepts the tuple, while runtime worker selection still carries a compatibility depth label. |
| D12 | Tournament winner-select checkpoint chooses one strand and later stages run once. | Partially matched: Explore has a tradeoff checkpoint and then decision/close steps (`src/flows/explore/data.ts:390-435`). |
| D13 | Tournament branch failure continues with survivors >= 2 and aborts below 2. | Shipped after this snapshot through `continue-others` plus `aggregate-survivors`. |
| D14 | Tournament does not add stages outside fanout. | Partially matched: Explore embeds tournament work in Plan/Decision and Close (`generated/flows/explore/tournament.json:35-56`). |
| D15 | Autonomous is a checkpoint-resolution policy. | Partially shipped after this snapshot: autonomous is an axis, and checkpoints can declare typed `auto_resolution`; safe-choice fallback remains. |
| D16 | Autonomous keeps the same stages/checkpoints as interactive. | Mostly matched for current autonomous axes; compatibility fixture selection may still choose an autonomous graph label. |
| D17 | Autonomous fires declared auto-resolution instead of waiting. | Shipped after this snapshot for typed `auto_resolution`; safe-choice fallback remains for checkpoints without a policy. |
| D18 | Auto-resolutions are recorded in the canonical operator report. | Shipped after this snapshot for typed auto-resolutions in operator summary JSON and Markdown. |
| D19 | Autonomous suppresses ambient interactive UI but keeps trace/progress/writes. | Partially matched: progress suppresses waiting UI for auto-resolved checkpoint requests (`src/runtime/projections/progress.ts:673-755`). |
| D20 | CLI parses any axis tuple before flow validation. | Shipped after this snapshot. |
| D21 | Unsupported tuple is default-denied with an allow-list in the error. | Shipped after this snapshot through flow-owned axis support validation. |
| D22 | Cross-axis constraints are flow-owned, not global. | Shipped after this snapshot through each flow's `axes` block. |
| D23 | Schematics carry an `axes` block with allow-list/default/fanout stage. | Shipped after this snapshot: current schematics carry `axes` and reject legacy `entry_modes`. |
| D24 | Axis defaults are standard/false/false/3. | Shipped after this snapshot through `DEFAULT_AXES` and `FlowAxes.default`. |
| D25 | `--mode` is removed in target; alias validators and support matrix go away. | Shipped after this snapshot: current tests reject `--mode` and `--entry-mode`. |
| D26 | Target CLI flags are `--rigor`, `--tournament`, `--tournament-n`, `--autonomous`. | Shipped after this snapshot: current CLI parses these flags. |
| D27 | Auto-resolution policies are `accept-as-is`, `highest-score`, `first-acceptable`, `refuse`. | Shipped after this snapshot through `AutoResolutionPolicy`. |
| D28 | `supports_autonomous` plus reachable `refuse` fails fixture-load validation. | Partially shipped after this snapshot: autonomous-capable fixtures reject checkpoint `auto_resolution.policy: "refuse"` regardless of reachability. |
| D29 | Autonomous tournament winner-select uses `highest-score` unless a flow declares otherwise. | Shipped after this snapshot for Explore tournament. |
| D30 | Rubric provenance uses runtime signal, model judgment, final score, and runtime-veto. | Partially shipped after this snapshot through `RubricResult` and Explore tournament aggregate reports. |
| D31 | Operator reports include auto-resolutions in JSON plus Markdown/HTML summaries. | Shipped after this snapshot for operator summary JSON and Markdown when auto-resolutions exist; HTML remains renderer-dependent. |

## Appendix C. Misalignment report

### C1. Spec corrected here

| Finding | Resolution |
|---|---|
| Flow count and scope were stale after Migrate/Sweep removal and Pursue/Runtime Proof addition. | Updated scope and §3/§14 tables to five public flows plus the internal Runtime Proof fixture. Evidence: `src/flows/catalog.ts:18-27`, `src/flows/pursue/data.ts:34-39`, `src/flows/runtime-proof/data.ts:5-35`. |
| The spec did not explain the functional/declarative refactor. | Added current architecture notes showing `FlowData`, `compileFlowDefinitions`, and catalog-derived registries. Evidence: `src/flows/flow-definition.ts:67-86`, `src/flows/flow-definition.ts:374-388`, `src/flows/catalog.ts:1-27`. |
| The per-flow allow-list table was target-only but looked like current implementation. | Reframed it as a target projection and added Appendix A6 with current entry mode evidence. |
| Runtime presentation claims were too broad. | Recorded current progress behavior: auto-resolved checkpoint requests do not emit waiting UI; waiting checkpoints emit `checkpoint.waiting` and `user_input.requested`. Evidence: `src/runtime/projections/progress.ts:673-755`. |
| Fixture-load validation claims were target behavior, not current behavior. | Updated after the May 19 commits: fixture loading now also rejects autonomous-capable fixtures that declare checkpoint `auto_resolution.policy: "refuse"`. Evidence: `src/cli/circuit.ts`, `tests/runner/cli-router.test.ts`. |
| Tournament behavior lacked current-code details. | Updated after the May 19 commits: Explore tournament now uses `axis.tournament_n`, `continue-others`, `aggregate-survivors`, and `highest-score` auto-resolution. Evidence: `src/flows/explore/data.ts`, `tests/runner/cli-router.test.ts`. |

### C2. Code must change to match spec (operator follow-up)

| Gap | Required code change |
|---|---|
| Axis schemas were absent. | Shipped after this snapshot: `src/schemas/axes.ts` and `src/schemas/rigor.ts` now define the axis model. |
| Compiled fixtures lacked `axes`. | Shipped after this snapshot: compiled fixtures now carry `axes`, and legacy `entry_modes` is rejected. |
| CLI used `--mode`/`--depth`. | Shipped after this snapshot: current CLI parses axis flags and rejects old aliases. |
| Flow support was mode/depth rows. | Shipped after this snapshot: flow support is expressed through `axes` allow-lists. |
| Checkpoint auto-resolution vocabulary was only safe-choice based. | Shipped after this snapshot: `accept-as-is`, `highest-score`, `first-acceptable`, and `refuse` policies exist; safe-choice fallback remains. |
| Autonomous fixture-load rejection did not exist. | Partially shipped after this snapshot: autonomous-capable fixtures reject `refuse` checkpoint auto-resolution policies. |
| Auto-resolution report section did not exist. | Shipped after this snapshot: operator summary JSON and Markdown include `auto_resolutions` when present. |
| Runtime rubric provenance was not represented in audited schemas. | Partially shipped after this snapshot for Explore tournament rubric results; broader flow adoption remains future work. |

### C3. Decision conflicts - signed v1 resolutions

The main spec body reflects the signed v1 resolutions below.

| Conflict | Signed resolution | Spec impact |
|---|---|---|
| C3.1 Lite stage/checkpoint invariance vs Fix lite skipping Review. | **Amend the invariant.** A flow may declare specific canonical stages as optional via `defineEnforcedStagePolicy`'s `optional_canonicals` field. In v1, lite may skip only those declared-optional stages; standard and deep may not. Required stages and checkpoints remain immutable. | §1 Rigor section amended. §8 negative-test guidance added. §14 criterion #6 added. |
| C3.2 Tournament N cap/no-cap vs current max 4. | **Cap N at 4 globally in v1.** Range becomes [2, 4]. Cap reflects the option-comparison surface and current rendering limits. Flagged as a v1 product limit; revisit in v2 if a real use case demands it. | §1 Tournament range updated. §6 strand count row updated. §12 edge case row updated. §14 criterion #3 updated. |
| C3.3 `tournament_n` declared but not wired to branch generation/checkpoint options. | **Wire N through the runtime surface.** Resolved `tournament_n` controls option generation, dynamic fanout expansion, branch cap, checkpoint `allow`, and checkpoint `choices`; mismatch fails before child relays start. | §1 Tournament steps amended. §6 wiring rows added. §11 Slice 5C added. §12 mismatch edge case added. §14 criterion #10 added. |
| C3.4 Tournament survivor policy vs prior abort-all/aggregate-only. | **Implement survivor policy as a two-part contract.** Tournament fanout must use `on_child_failure: continue-others` and the new `aggregate-survivors` join policy. Existing `aggregate-only` stays for fanout that needs all branches. Graceful degradation: ≥ 2 strands closing parseably continues; otherwise abort. | §6 implementation note added. §11 Slice 5D added. §12 survivor edge cases updated. §14 criterion #9 added. |
| C3.5 Minimal scorer temptation vs full v1 rubric infrastructure. | **Build the full long-term solution in v1.** No minimal interim scorer. Every dim emits the typed §9 result, including `runtime_signal: "n/a"`, dim scale, aggregate score, tie-break, and runtime-veto effect. | §9 expanded. §10 JSON example expanded. §11 Slice 5A/5B added. §14 criterion #7 added. |
| C3.6 Autonomous + tournament winner selection vs current tradeoff checkpoint. | **Autonomous + tournament is supported in v1.** The `highest-score` auto-resolution policy ranks tournament strands by typed rubric result. Per-axis allow-list shape stays sufficient because we do not refuse the combination globally. | §5 policy text expanded. §10 report provenance expanded. §11 Slice 5E/5F added. §14 criterion #11 added. |
| C3.7 Slice 5 was too broad to ship safely. | **Split Slice 5 into independently shippable sub-slices.** Typed rubric, Explore signals, N wiring, survivor fanout, highest-score reporting, and end-to-end proof each get their own tests and verification gate. | §11 Slice 5A-5F added. |

## Appendix D. Prior Codex adversarial-review finding statuses

The raw prior review transcript is not stored in this repo snapshot, so this ledger tracks the review findings named in the goal and the older finding classes already present in the spec. Each row points to the body section that resolves it.

| Prior finding class | Resolution status |
|---|---|
| 1. Flow inventory and allow-list drift. | Resolved in spec: §3, §14, and Appendix A6 now include Review, Fix, Build, Explore, Pursue, and internal Runtime Proof with current-code evidence. |
| 2. Target 3-axis design read as current shipped behavior. | Resolved in spec: status note and Appendix A separate target design from current implementation. |
| 3. CLI surface mismatch. | Resolved after this snapshot: current CLI parses axis flags and rejects old aliases. |
| 4. Schematic and compiled fixture shape mismatch. | Resolved after this snapshot: current schematics and compiled fixtures carry `axes`, not `entry_modes`. |
| 5. Checkpoint policy and fixture-load validation mismatch. | Partially resolved after this snapshot: typed auto-resolution policies and autonomous `refuse` fixture rejection shipped; safe-choice fallback and some target-reporting details remain compatibility behavior. |
| 6. Tournament runtime mismatch. | Resolved in C3.2-C3.4: N capped at 4 in v1; `tournament_n` wires to branch generation and checkpoint choices; survivor fanout requires `continue-others` plus `aggregate-survivors`. |
| 7. Full rubric result underspecified. | Resolved in §9 and C3.5: `RubricDimResult` includes explicit dim scale, `runtime_signal: "n/a"`, aggregate score, tie-break, and runtime-veto effect. |
| 8. Autonomous tournament could collapse into a minimal interim scorer. | Resolved in §5, §9, §10, and C3.6: v1 ships `highest-score` over typed rubric results and records full provenance in Auto-resolutions. |
| 9. Optional canonicals were too loose. | Resolved in §1, §8, §12, and C3.1: optional canonical stages are flow opt-in, lite-only omissions in v1; standard/deep omissions need negative tests and are invalid. |
| 10. Slice 5 was not independently shippable. | Resolved in §11 and C3.7: Slice 5 is split into 5A-5F, each with scoped tests and a verification gate. |
| 11. Acceptance criteria were not all falsifiable. | Resolved in §14: every criterion now names a concrete test or observable behavior. |
