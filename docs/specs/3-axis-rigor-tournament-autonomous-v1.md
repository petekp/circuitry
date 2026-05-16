# 3-axis spec: Rigor × Tournament × Autonomous (v1)

Status: draft, awaiting operator sign-off.
Scope: cross-cutting. Every flow (Review, Fix, Build, Explore) reconciles to this spec.

## 0. Why this spec exists

Today `src/schemas/depth.ts` is a flat enum: `lite | standard | deep | tournament | autonomous`. The CLI carries `--mode` and `--depth` as aliases for one thoroughness level. The runtime support matrix declares per-flow 1:1 `(mode, depth)` pairs. Recent F-M-1/2/3 hardening deepened this aliasing by ~150 lines of code.

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

A rigor knob per stage. **The stage path is canonical and immutable**: every rigor level traverses the same stages. Rigor changes density inside each stage, not the shape of the run.

- **Lite** = one pass per stage with a permissive quality bar.
- **Standard** = default rigor; the baseline every flow targets.
- **Deep** = iterate within each stage until a per-stage rubric is satisfied, or a budget cap fires.

Rigor never adds or removes stages. Rigor never adds or removes checkpoints. Rigor only affects how much work happens inside each stage. (Renamed from `Depth` to keep semantics tight; "depth" is overloaded in CS contexts.)

### Tournament

```
Tournament = false | true
TournamentN = integer ≥ 2 (default 3)
```

A stage-local fan-out + winner-select mechanism. When tournament is on:

1. One specific stage (the flow's declared `tournament_fan_out_stage`) generates N independent strands in parallel.
2. Each strand runs in isolation. Strands do **not** see each other during generation.
3. Each strand runs at the same rigor as the overall run. Deep + tournament = N deep strands.
4. A structured winner-select checkpoint chooses one strand. The remaining stages run once over the winner.
5. If a strand fails mid-generation: continue if survivors ≥ 2; otherwise abort with `tournament collapsed: <reason>`.

Tournament never adds stages outside its fan-out. The winner-select checkpoint is part of the fan-out stage.

### Autonomous

```
Autonomous = false | true
```

A checkpoint-resolution policy. When autonomous is on:

1. Stages and checkpoints exist exactly as in interactive runs.
2. At each checkpoint, instead of waiting for the operator, the checkpoint's declared auto-resolution rule fires.
3. Every auto-resolution is recorded in the canonical artifact's Auto-resolutions section.
4. Ambient interactive UI is suppressed (auto-open HTML, prompt waits). Trace output (progress prints, file writes, auto-resolve events) is kept.

Autonomous never removes checkpoints from the schematic. The rule fires *instead of* waiting.

---

## 2. Composition

The three axis types are independent. Any `(rigor, tournament, autonomous)` tuple is parseable at the CLI layer. Per-flow schematics declare which tuples are valid for that flow.

**Default-deny.** A flow that does not advertise support for an axis combination rejects it at parse time with the allow-list in the error message.

**Cross-axis constraints live in flows, not in the axis spec.** The axis spec does not declare e.g. "tournament requires standard rigor". If a flow can't run tournament at lite, that's a flow constraint, declared in the flow's schematic.

---

## 3. Per-flow allow-lists

Each flow's schematic carries:

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

**Starting allow-lists for the existing flows** (mirroring today's `RUNTIME_SUPPORT_MATRIX`; per-flow specs can revise):

| Flow | allowed_rigors | supports_tournament | supports_autonomous |
|---|---|---|---|
| Review | `[standard]` | no | no |
| Fix | `[lite, standard, deep]` | no | yes |
| Build | `[lite, standard, deep]` | no | yes |
| Explore | `[lite, standard, deep]` | **yes** | yes |

---

## 4. CLI surface

Three flags, one per axis.

```
--rigor {lite|standard|deep}
--tournament              # boolean; presence = on, absence = off
--tournament-n N          # optional N; default 3 when --tournament passed
--autonomous              # boolean
```

Examples:

```
circuit-next explore --goal "..."                                         # defaults
circuit-next explore --goal "..." --rigor deep                            # deep, no tournament, not autonomous
circuit-next explore --goal "..." --tournament                            # tournament, N=3
circuit-next explore --goal "..." --tournament --tournament-n 4 --rigor deep
circuit-next build --goal "..." --autonomous
```

`--mode` is **removed**. The alias validators (`entryModeForDepth`, `depthForEntryMode`, `validateModeDepthAliasConsistency`) and `RUNTIME_SUPPORT_MATRIX` go with it.

Error shape on unsupported tuples mirrors today's `--depth` rejection: name the unsupported axis value and list the flow's allow-list inline.

---

## 5. Auto-resolution policies

Each checkpoint in a schematic declares one of four policies:

| Policy | Behavior |
|---|---|
| `accept-as-is` | Take the model's proposed value as the resolution. |
| `highest-score` | Pick the option with the highest score on a typed rubric. Records the winning score and margin. |
| `first-acceptable` | Pick the first option meeting a minimum-bar predicate. |
| `refuse` | Cannot be auto-resolved. Hitting this checkpoint in autonomous mode is a hard failure. |

**Static validation at fixture-load.** A flow that declares `supports_autonomous: true` and contains any `refuse` checkpoint reachable in its stage path is rejected at fixture-load time. Authors must fix the schematic.

The tournament winner-select checkpoint uses `highest-score` by convention when autonomous; per-flow declaration can pick a different policy.

---

## 6. Tournament internals

| Property | Value |
|---|---|
| Fan-out point | Per-flow declared `tournament_fan_out_stage` (must exist in the flow's stage list). |
| Strand count | Runtime parameter `tournament_n`. Default 3. Lower bound 2. No upper bound (operator owns cost). |
| Strand isolation | Fully independent. No cross-strand awareness during generation. |
| Strand rigor | Inherits run rigor. Deep + tournament = N deep strands. |
| Winner-select shape | Pick one of N. Losing strands surfaced as Options in the canonical artifact alongside the winning Recommendation. |
| Strand failure | Continue if survivors ≥ 2; otherwise abort with `tournament collapsed: <reason>`. |

---

## 7. Autonomous internals

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

| Property | Value |
|---|---|
| Stage path | Canonical and immutable per flow. Rigor does not change the stage set. |
| Per-stage effect | Lite: one pass, permissive quality bar. Standard: default rigor. Deep: iterate to satisfy a per-stage rubric or hit a budget cap. |
| Rubric computation | Always, at every rigor. Lite runs report rubric scores too — they're just allowed to be lower. |
| Model awareness | The model never sees a `rigor=lite` label. Runtime drives behavior via prompt structure: iteration count, sub-prompt content, stage configuration. The model just responds to what's asked. |

---

## 9. Rubric provenance

Every rubric dimension is **hybrid**: a runtime-computed necessary-condition check plus a model judgment.

```
Per dim: {
  runtime_signal: "met" | "missing",
  model_judgment: "pass" | "concern" | "fail",
  final_score:    "pass" | "concern" | "fail"
}
```

**Combine rule: runtime-veto.** If `runtime_signal === "missing"`, `final_score = fail` regardless of model judgment. If `runtime_signal === "met"`, `final_score = model_judgment`. Runtime can force fail; runtime cannot force pass. Matches the Proof-Carrying Fix authority pattern.

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

## 10. Auto-resolutions section in the canonical artifact

Tiered recording.

**Markdown / HTML** (operator-facing prose):

> **Auto-resolutions**
> - Frame: accepted as-is by policy `accept-as-is`.
> - Tournament tradeoff: strand B selected by policy `highest-score` (score 7.2; margin +0.8 over runner-up).

**JSON** (full provenance, one row per checkpoint resolved):

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
      "scores": { "strand-a": 6.4, "strand-b": 7.2, "strand-c": 6.1 },
      "runtime_or_model": "runtime",
      "resolved_at": "2026-05-11T12:36:42Z"
    }
  ]
}
```

---

## 11. Migration plan

Sliced, Proof-Carrying-Fix style. Each slice ships independently with full tests and a regenerated plugin bundle.

### Slice 1 — schema layer

- Rename `src/schemas/depth.ts` → `src/schemas/rigor.ts`. Type becomes `Rigor = z.enum(['lite','standard','deep'])`.
- Add `src/schemas/tournament.ts` and `src/schemas/autonomous.ts` (or a combined `src/schemas/axes.ts`).
- Replace `CONSEQUENTIAL_RIGORS` constant with a helper `isConsequentialAxes({ rigor, tournament, autonomous })` returning `rigor === 'deep' || tournament || autonomous`.
- No CLI or schematic changes yet. Old code paths still compile against compatibility re-exports if needed; otherwise tests are touched in this slice.
- **No fixture regeneration.**

### Slice 2 — CLI layer

- Update CLI parsing to accept `--rigor`, `--tournament`, `--tournament-n`, `--autonomous`.
- Drop `--mode`. Drop `entryModeForDepth`, `depthForEntryMode`, `validateModeDepthAliasConsistency`, `validateFlowDepth`, `RUNTIME_SUPPORT_MATRIX`.
- New per-tuple validation reads the per-flow allow-list from the compiled fixture.
- Static fixture-load validation: refuse-policy checkpoint + `supports_autonomous: true` → reject.
- Update CLI router and `cli-router.test.ts`.
- **No fixture regeneration yet.** Compiled fixtures still carry the old `entry_modes` shape; this slice adds a transitional reader that maps old shape to allow-list at load. Reader is removed in Slice 4.

### Slice 3 — per-flow schematic + fixture updates

For each of Review, Fix, Build, and Explore, in that order:

- Rewrite `src/flows/<flow>/schematic.json`: remove `entry_modes`, add the `axes` block.
- Regenerate `generated/flows/<flow>/circuit.json`.
- Update flow's contract.md to reference axes.
- Regenerate plugin runtime bundles (`plugins/circuit/runtime/`, `plugins/claude/runtime/`).
- Refresh golden run proofs.
- Update flow-specific tests.

### Slice 4 — drop dead code

- Drop the Slice-2 transitional reader.
- Drop any remaining shims, compat re-exports, or alias code.
- Drop `entry_modes` from `CompiledFlow` schema.
- Drop tests pinning the old alias behavior.

### Historical data

Hard break. Old run folders are not parseable by new code. Old fixtures regenerated in Slice 3. No migration tooling for run folders.

---

## 12. Edge cases (locked)

| Case | Behavior |
|---|---|
| `--tournament-n 1` or lower | Parse-time error: "Tournament requires at least 2 strands". |
| `--tournament` on a flow with `supports_tournament: false` | Parse-time error with flow's allow-list. |
| `--autonomous` on a flow with `supports_autonomous: false` | Parse-time error with flow's allow-list. |
| Flow with `supports_autonomous: true` containing a `refuse` checkpoint | Fixture-load rejection. |
| Operator passes axis flags + the flow has different defaults | Operator flags override per-axis. Unspecified axes use flow defaults; flow defaults fall back to axis defaults. |
| Autonomous on a flow with zero checkpoints | Valid (no-op for checkpoint resolution). All other autonomous behaviors still apply. |
| Tournament strand failure (1 of N fails) | Continue with N-1 if ≥ 2 survivors. |
| Tournament strand failure (>1 of N fails, < 2 survivors) | Abort with `tournament collapsed: <reason>`. |
| Lite + tournament | Valid. N lite strands. Cheap-and-diverse use case. |
| Deep + tournament + autonomous | Valid. N deep strands, winner auto-selected. |

---

## 13. Cross-cutting interactions (deferred to their own grills)

- **`--from-run`** — interaction with axes (can `--from-run` change axes vs the original run?) is part of the `--from-run` spec, not this one.
- **Checkpoint protocol** — the exact wire shape of `user_input.requested` events and how host adapters render them is part of the checkpoint protocol spec.
- **Config layer** — whether user-global or project config can override per-flow allow-lists is deferred to the config spec. This 3-axis spec is config-agnostic.

---

## 14. Acceptance criteria

Implementation matches this spec when:

1. `src/schemas/rigor.ts` exports `Rigor = z.enum(['lite','standard','deep'])`. No `tournament` or `autonomous` values in the rigor enum.
2. `CompiledFlow` schema declares an `axes` block; no `entry_modes` array.
3. CLI parses `--rigor`, `--tournament`, `--tournament-n`, `--autonomous`. Rejects `--mode` as unknown.
4. The six existing flows' schematics carry the allow-lists in §3.
5. A flow with `supports_autonomous: true` and a `refuse` checkpoint fails fixture load.
6. Each rubric dim emits `{ runtime_signal, model_judgment, final_score }`. Runtime-veto rule observable.
7. Auto-resolutions section appears in operator-summary JSON with full provenance and in MD/HTML with summary lines.
8. Tournament strand failure handling: ≥ 2 survivors continue; < 2 survivors abort.
9. Plugin runtime bundles regenerated per slice. CI green throughout.

---

## 15. Open questions for downstream specs

- Frame checkpoint shape — defined in `explore-intent-v1.md`; this spec assumes it.
- Branch-distinctness scoring (tournament-only rubric dim) — needs a non-trivial similarity heuristic to gain a runtime signal; deferred.
- Operator-summary display tuning (which axis values are always shown vs conditionally) — implementation detail.
- Schematic schema_version bump — likely yes; resolved during Slice 1.
