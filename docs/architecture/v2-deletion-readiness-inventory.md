# Core-v2 Deletion Readiness Inventory

Date: 2026-05-07

Current status: superseded for cutover planning by
`docs/architecture/v2-final-cutover-policy.md`. This inventory is a historical
Phase 5.5 snapshot. Do not treat its compatibility-preserving recommendations or
file dispositions as current policy.

## Summary

Phase 5.5 is an inventory pass only.

No old runtime deletion is approved here. No product policy changes are approved
here. No review packet was prepared because this phase does not move from
inventory into deletion or policy change.

The checked hypotheses were:

1. Some `src/runtime` files might now be tiny deletion candidates after Build
   deep moved to core-v2 by default.
2. Some `src/runtime` files are neutral infrastructure under an old namespace,
   not old runner code.
3. Some retained runner or handler tests might now be obsolete because v2 has
   matching coverage.

The Phase 5.5 result:

- no `src/runtime` file is a current deletion candidate;
- no retained runner or handler test is obsolete;
- several files are only compatibility wrappers, but old-path imports still
  make them intentional support surfaces;
- several files should move to neutral ownership later, but only behind focused
  review. Phase 5.32 moved connector subprocesses and relay materialization to
  `src/connectors/**`; the old runtime connector paths are now retired.
  Phase 5.34 reviewed retained trace/status/progress/checkpoint-state
  ownership and approved no implementation move; those files remain retained
  product behavior with stronger import guards.

## Current Cutover Update

The final cutover changed this inventory's conclusions:

- retained/v1 run folders fail closed with
  `This run folder was created by the retired runtime. Start a fresh run.`;
- old flow-authoring wrappers at `src/runtime/compile-schematic-to-flow.ts` and
  `src/runtime/router.ts` are gone; the live owners are `src/flows/**`;
- `src/compat/retained-runtime.ts`, `src/compat/retained-checkpoint-folders.ts`,
  and `src/run-status/v1-run-folder.ts` are gone;
- old retained handler implementations, old trace reader/writer, reducer,
  snapshot writer, append-and-derive, and relay-selection implementation code
  are gone;
- `src/runtime/runner.ts` remains only as a fail-closed public stub;
- remaining wrapper imports are governed by
  `src/compat/public-runtime-paths.ts`.

## File Labels

| Label | Meaning |
|---|---|
| compatibility wrapper | Old import path that re-exports a neutral module or preserves an old public surface. |
| retained fallback | Old execution behavior still reached by unsupported modes, rollback, arbitrary fixtures, `composeWriter`, or retained checkpoints. |
| retained product behavior | Durable retained behavior for run folders, traces, status, progress, snapshots, results, or checkpoint resume. |
| oracle/test support | Old behavior retained mainly as a comparison oracle or direct low-level proof. |
| neutral-move candidate | Live shared infrastructure that should probably leave `src/runtime`, but is not deletable. |
| tiny deletion candidate | Small file that can be deleted after import repair and proof. |
| blocker/unknown | Current owner is unclear enough to block deletion planning. |

## Runtime File Disposition At Phase 5.5

The table below is historical. It explains why deletion was blocked before the
final cutover product decision.

| Path | Classification | Why |
|---|---|---|
| `src/runtime/append-and-derive.ts` | retained product behavior | Appends retained trace entries and derives retained snapshots. Keep while retained trace/state is live. |
| `src/runtime/catalog-derivations.ts` | removed | Neutral implementation lives in `src/flows/catalog-derivations.ts`; the old runtime wrapper is retired. |
| `src/runtime/checkpoint-resume.ts` | removed | Retained and v1 checkpoint resume folders fail closed through policy instead of a direct adapter. |
| `src/runtime/compile-schematic-to-flow.ts` | removed | Neutral compiler implementation lives in `src/flows/compile-schematic-to-flow.ts`; the old runtime wrapper is retired. |
| `src/runtime/config-loader.ts` | removed | Neutral config loading lives in `src/shared/config-loader.ts`; the old runtime wrapper is retired. |
| `src/runtime/connectors/claude-code.ts` | removed | Neutral implementation lives in `src/connectors/claude-code.ts`; the old runtime wrapper is retired. |
| `src/runtime/connectors/codex.ts` | removed | Neutral implementation lives in `src/connectors/codex.ts`; the old runtime wrapper is retired. |
| `src/runtime/connectors/custom.ts` | removed | Neutral implementation lives in `src/connectors/custom.ts`; the old runtime wrapper is retired. |
| `src/runtime/connectors/relay-materializer.ts` | removed | Neutral implementation lives in `src/connectors/relay-materializer.ts`; the old runtime wrapper is retired. |
| `src/runtime/connectors/shared.ts` | removed | Neutral connector helper barrel lives in `src/connectors/shared.ts`; the old runtime wrapper is retired. |
| `src/runtime/manifest-snapshot-writer.ts` | removed | Neutral byte-match helper lives in `src/shared/manifest-snapshot.ts`; the old runtime wrapper is retired. |
| `src/runtime/operator-summary-writer.ts` | removed | Neutral operator summary writer lives in `src/shared/operator-summary-writer.ts`; the old runtime wrapper is retired. |
| `src/runtime/policy/flow-kind-policy.ts` | removed | Neutral policy helper lives in `src/shared/flow-kind-policy.ts`; the old runtime wrapper is retired. |
| `src/runtime/progress-projector.ts` | removed | Shared progress output lives in `src/shared/progress-output.ts`; old v1 trace projection is retired instead of adapted. |
| `src/runtime/reducer.ts` | retained product behavior | Retained trace reduction remains the state authority for retained/v1 runs. |
| `src/runtime/registries/checkpoint-writers/registry.ts` | removed | Neutral checkpoint writer lookup lives in `src/flows/registries/checkpoint-writers/registry.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/checkpoint-writers/types.ts` | removed | Neutral checkpoint writer types live in `src/flows/registries/checkpoint-writers/types.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/close-writers/registry.ts` | removed | Neutral close writer lookup lives in `src/flows/registries/close-writers/registry.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/close-writers/shared.ts` | removed | Neutral report-path helper lives in `src/flows/registries/close-writers/shared.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/close-writers/types.ts` | removed | Neutral close writer types live in `src/flows/registries/close-writers/types.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/compose-writers/registry.ts` | removed | Neutral compose writer lookup lives in `src/flows/registries/compose-writers/registry.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/compose-writers/types.ts` | removed | Neutral compose writer types live in `src/flows/registries/compose-writers/types.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/cross-report-validators.ts` | removed | Neutral cross-report validator registry lives in `src/flows/registries/cross-report-validators.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/report-schemas.ts` | removed | Neutral report parsing registry lives in `src/flows/registries/report-schemas.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/shape-hints/registry.ts` | removed | Neutral relay shape-hint lookup lives in `src/flows/registries/shape-hints/registry.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/shape-hints/types.ts` | removed | Neutral shape-hint types live in `src/flows/registries/shape-hints/types.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/verification-writers/registry.ts` | removed | Neutral verification writer lookup lives in `src/flows/registries/verification-writers/registry.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/verification-writers/types.ts` | removed | Neutral verification writer types live in `src/flows/registries/verification-writers/types.ts`; the old runtime wrapper is retired. |
| `src/runtime/relay-selection.ts` | retained fallback | Retained relay decision bridge and connector resolution remain live for fallback paths. |
| `src/runtime/relay-support.ts` | removed | Neutral relay support lives in `src/shared/relay-support.ts`; the old runtime wrapper is retired. |
| `src/runtime/result-writer.ts` | removed | Shared result path ownership lives in `src/shared/result-path.ts`; old result writing is retired instead of adapted. |
| `src/runtime/router.ts` | removed | Neutral router implementation lives in `src/flows/router.ts`; the old runtime wrapper is retired. |
| `src/runtime/run-relative-path.ts` | removed | Neutral helper lives in `src/shared/run-relative-path.ts`; the old runtime wrapper is retired. |
| `src/runtime/run-status-projection.ts` | removed | Neutral dispatcher lives in `src/run-status/project-run-folder.ts`; the old runtime wrapper is retired. |
| `src/runtime/runner-types.ts` | compatibility wrapper | Shared relay/progress types moved to `src/shared/relay-runtime-types.ts`, but retained invocation/result types still live here. |
| `src/runtime/runner.ts` | retained fallback | Owns fallback execution, rollback execution, arbitrary fixtures, `composeWriter`, and public retained resume wrapper. |
| `src/runtime/selection-resolver.ts` | removed | Neutral resolver lives in `src/shared/selection-resolver.ts`; the old runtime wrapper is retired. |
| `src/runtime/snapshot-writer.ts` | retained product behavior | Retained snapshot derivation is live for retained runs, handoff, and old checkpoint folders. |
| `src/runtime/step-handlers/checkpoint.ts` | removed | Checkpoint request writing and choice helpers live under core-v2 and flow registries; the old handler stub is retired. |
| `src/runtime/step-handlers/compose.ts` | retained fallback | Keeps retained compose behavior and the public `composeWriter` hook. |
| `src/runtime/step-handlers/fanout.ts` | retained fallback | Retained fanout execution remains fallback/oracle coverage for unretired paths. |
| `src/runtime/step-handlers/fanout/aggregate.ts` | removed | Neutral fanout aggregate report helper lives in `src/shared/fanout-aggregate-report.ts`; the old runtime wrapper is retired. |
| `src/runtime/step-handlers/fanout/branch-resolution.ts` | retained fallback | Helper for retained fanout branch expansion and path safety. It now uses the shared branch-template helper from `src/shared/fanout-branch-template.ts`, but retained branch output shape remains here. |
| `src/runtime/step-handlers/fanout/join-policy.ts` | removed | Neutral implementation lives in `src/shared/fanout-join-policy.ts`; the old runtime wrapper is retired. |
| `src/runtime/step-handlers/fanout/types.ts` | retained fallback | Type support for retained fanout behavior. |
| `src/runtime/step-handlers/index.ts` | retained fallback | Dispatcher for retained step handlers. |
| `src/runtime/step-handlers/recovery-route.ts` | removed | Neutral recovery route priority helper lives in `src/shared/recovery-route.ts`; the old runtime wrapper is retired. |
| `src/runtime/step-handlers/relay.ts` | retained fallback | Retained relay execution, materialization, validation, and connector bridge behavior. |
| `src/runtime/step-handlers/shared.ts` | removed | Neutral JSON report helper lives in `src/shared/json-report.ts`; the old runtime wrapper is retired. |
| `src/runtime/step-handlers/sub-run.ts` | retained fallback | Retained sub-run execution remains fallback/oracle coverage. |
| `src/runtime/step-handlers/types.ts` | retained fallback | Type support for the retained handler cluster. |
| `src/runtime/step-handlers/verification.ts` | retained fallback | Retained verification execution remains fallback/oracle coverage. |
| `src/runtime/terminal-verdict.ts` | removed | Neutral implementation lives in `src/shared/terminal-verdict.ts`; the old runtime wrapper is retired. |
| `src/runtime/trace-reader.ts` | retained product behavior | Retained trace reading remains live for retained status, progress, resume, and tests. |
| `src/runtime/trace-writer.ts` | retained product behavior | Retained trace appending remains live for retained runs and tests. |
| `src/runtime/write-capable-worker-disclosure.ts` | removed | Neutral helper lives in `src/shared/write-capable-worker-disclosure.ts`; the old runtime wrapper is retired. |

Phase 5.58 marked the lowest-risk shared-helper and flow-authoring wrappers as
soft-deprecated in `src/compat/public-runtime-paths.ts`. The flow-authoring
wrappers have since been removed, and the shared-helper wrappers have now been
retired after production imports, tests, and active docs moved to the neutral
owners. `docs/release/deprecations/public-runtime-import-paths.md` now records
that there are no remaining release-note-only soft-deprecated wrapper paths.

## Historical Category Totals

The Phase 5.5 counts were:

| Category | Count | Deletion-ready count at the time |
|---|---:|---:|
| compatibility wrapper | 20 | 0 |
| retained fallback | 11 | 0 |
| retained product behavior | 9 | 0 |
| oracle/test support | 0 | 0 |
| neutral-move candidate | 16 | 0 |
| tiny deletion candidate | 0 | 0 |
| blocker/unknown | 0 | 0 |

Those counts are no longer current after final cutover.

## Current Blockers

The retained runtime itself is no longer the blocker. The remaining blockers are
wrapper/package-surface questions:

- old public type/path surfaces such as `src/runtime/runner-types.ts`;
- generated plugin and package export drift when old paths are removed.

The next useful slice is to pick one wrapper category, update
`src/compat/public-runtime-paths.ts`, update the release note and tests, then run
full verification. Do not recreate retained/v1 run-folder adapters.
