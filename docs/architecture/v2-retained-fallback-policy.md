# Core-v2 Retained Fallback Policy

Date: 2026-05-05

## Decision

The retained runtime is now an intentional compatibility and fallback layer.

It is not the normal owner for proven fresh-run rows. It is also not dead code.
Each retained behavior needs an explicit product disposition before deletion.

## Current Classification

| Behavior | Current owner | Policy | Why |
|---|---|---|---|
| Matrix-supported fresh runs | core-v2 | Default path | This is the normal v2 selector milestone. |
| Build deep fresh runs | core-v2 | Default path | Phase 5.3 proved checkpoint wait/resume/status/progress/result. |
| Fix deep fresh runs | core-v2 | Default path | The Fix deep slice proves normal deep completion plus forced no-repro checkpoint wait/resume, progress, status, result writing, and rollback. |
| Build autonomous fresh runs | core-v2 | Default path | The post-review Build autonomous slice proves safe-autonomous checkpoint auto-resolution, progress, status, result writing, and rollback. |
| Fix autonomous fresh runs | core-v2 | Default path | The Fix autonomous slice proves safe-autonomous no-repro checkpoint auto-resolution, progress, status, result writing, and rollback. |
| Sweep lite fresh runs | core-v2 | Default path | The Sweep lite slice proves safe-default triage checkpoint auto-resolution, progress, status, result writing, and rollback. |
| Sweep deep fresh runs | core-v2 | Default path | The Sweep deep slice proves checkpoint wait/resume, progress, status, result writing, and rollback. |
| Sweep autonomous fresh runs | core-v2 | Default path | The Sweep autonomous slice proves safe-autonomous triage checkpoint auto-resolution, progress, status, result writing, and rollback. |
| Migrate deep fresh runs | core-v2 | Default path | The Migrate deep slice proves checkpoint wait/resume, Build child-run behavior after resume, progress, status, result writing, and rollback. |
| Migrate autonomous fresh runs | core-v2 | Default path | The Migrate autonomous slice proves safe-autonomous coexistence checkpoint auto-resolution, Build child-run behavior, progress, status, result writing, and rollback. |
| Explore lite/deep/autonomous fresh runs | core-v2 | Default path | The Explore non-tournament slice proves these modes share the default compose/relay graph, with selector, diagnostics, rollback, and soak coverage. |
| Explore tournament fresh runs | core-v2 | Default path | The Explore tournament slice proves production relay fanout branches, branch parse/schema/provenance/cross-report validation, tournament checkpoint wait/resume, enriched progress/status context, final decision/result writing, soak coverage, and rollback. |
| Official installed plugin generated mirror | core-v2 when wrapper-provenanced and matrix-supported | Trusted generated mirror | Phase 5.10 lets the wrapper-injected `plugins/circuit/flows/**` mirror follow the selector matrix only when the wrapper marker matches the actual root. |
| Retained/v1 checkpoint folders | retained runtime | Compatibility support | Saved run-folder identity wins. Old waiting folders should not be rewritten by fresh-run flags. |
| Future or unproven generated entry modes | retained runtime until proven or retired | Temporary compatibility | Explore tournament removed the last known public generated entry-mode gap in the current catalog, but future modes still need mode-specific proof before default routing. |
| Unsupported flow/mode/depth fallback | retained runtime | Intentional fallback for now | Preserves permissive public CLI behavior for flows or shapes outside the supported generated catalog. |
| Arbitrary explicit fixtures and flow roots | retained runtime by default | Intentional compatibility policy | Arbitrary fixtures may use shapes not proven by core-v2. Strict v2 remains the experimental override. Custom flow roots and unprovenanced external roots stay retained. |
| Programmatic `composeWriter` injection | retained runtime | Retained-runtime-only compatibility | Phase 5.7 keeps exported `main(..., { composeWriter })` support on retained runtime. Core-v2 does not get an equivalent hook. Internal v2 customization should use executor injection or generated reports. |
| Rollback | retained runtime | Operator safety feature | `CIRCUIT_DISABLE_V2_RUNTIME=1` must keep a known fallback while v2 expands. |
| Runtime decision diagnostics | CLI runtime output | Preferred flag with temporary alias | Phase 5.8.1 adds `CIRCUIT_SHOW_RUNTIME_DECISION=1` and keeps `CIRCUIT_V2_RUNTIME_CANDIDATE=1` as a temporary alias. Diagnostics report the actual selected runtime reason. |
| Old runner/handler oracle tests | retained tests | Keep until each behavior is v2-owned or intentionally retired | They still prove compatibility and fallback behavior. |

## Build Tournament Clarification

There is no current public Build tournament entry mode in the Build schematic or
generated Build flow.

Current Build entry modes are:

```text
default
lite
deep
autonomous
```

Phase 5.3 routes Build deep to core-v2 by default. The post-review Build
autonomous slice also routes Build autonomous to core-v2 by default after proving
safe-autonomous checkpoint auto-resolution. If a Build tournament mode is
introduced later, it must get its own selector proof before v2 routing.

## Fresh Runs Versus Resume

Fresh-run selector flags decide how to start a new run.

Resume dispatch is different. It follows the saved run folder's engine marker:

```text
core-v2 folder -> core-v2 resume
retained/v1 folder -> retained resume
```

This prevents rollback, strict opt-in, or candidate flags from rewriting a
saved run's execution identity.

## Deletion Readiness Implications

Old runtime deletion remains blocked while any retained behavior is classified
as compatibility support, intentional fallback, or oracle coverage.

Deletion can be reconsidered only when every retained behavior is one of:

```text
migrated to core-v2
kept as a smaller explicit compatibility module
retired by product decision
obsolete with import/test proof
```

There should be no `unknown` rows in a deletion packet.

## Near-Term Actions

Before any deletion slice:

- create a current-only file disposition for every `src/runtime` file;
- classify old runner/handler tests as compatibility, fallback, oracle, or
  obsolete;
- keep arbitrary fixtures and custom flow roots retained by default unless a
  future fixture policy review changes that boundary;
- treat programmatic `composeWriter` as retained-runtime-only compatibility;
- remove the old candidate diagnostics alias only in a dedicated
  operator-facing slice;
- decide whether rollback is a permanent operator safety feature;
- keep retained/v1 checkpoint folder support explicit.

Phase 5.5 completed the file and test inventory. Phase 5.6 packaged the
remaining fallback API questions for external review in
`docs/architecture/v2-fallback-api-disposition-review.md`. Phase 5.7 resolves
the `composeWriter` question in
`docs/architecture/v2-compose-writer-disposition.md`: keep it retained-only,
do not add a core-v2 equivalent, and prefer v2 executor injection for internal
customization. Phase 5.8 resolves candidate diagnostics in
`docs/architecture/v2-candidate-diagnostics-disposition.md`, and Phase 5.8.1
implements the alias: `CIRCUIT_SHOW_RUNTIME_DECISION=1` is preferred, while
`CIRCUIT_V2_RUNTIME_CANDIDATE=1` remains temporarily supported.

Phase 5.9 confirms arbitrary explicit fixtures as retained-runtime-owned
compatibility. It also records that packaged host flow roots are generated
mirrors but remain retained by current path policy because they are outside
`generated/flows/**`.

Phase 5.10 narrows that packaged host root exception: the official installed
plugin wrapper may prove `plugins/circuit/flows/**` as a trusted generated mirror
by passing `CIRCUIT_GENERATED_FLOW_MIRROR_ROOT=<plugin root>/flows`. Arbitrary
external roots and custom flow roots remain retained by default.

Phase 5.11 routes Explore tournament through core-v2 by default after hardening
v2 relay fanout branches to use the production relay prompt path and the same
parse/schema, provenance, and cross-report validation order as retained fanout.
It also enriches v2 tournament checkpoint progress/status with
`decision-options.json` labels and `tournament-review.json` tradeoff questions.

Phase 5.18 hardens the public compatibility policy without changing those
defaults. Runtime decision reasons now name retained compatibility directly:
programmatic `composeWriter` stays retained-only, rollback remains the retained
safety switch, and arbitrary fixtures/custom roots stay retained by default
unless strict v2 is explicitly requested for an experiment. CLI usage and
`circuit-next create` summaries now say the same thing.

Phase 5.22 centralizes those live policy strings in
`src/cli/runtime-compatibility-policy.ts` so runtime reasons, CLI usage, and
custom-flow summaries do not drift apart.

## What Not To Do Next

Do not widen routes mechanically. Move one public mode at a time only when its
v2 behavior has focused proof. Build deep and the autonomous slices were
routeable because each proved its checkpoint, progress, status, result, rollback,
and child-run behavior where relevant.

Do not delete or move retained runtime infrastructure from this policy alone.
