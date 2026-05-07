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
  `src/connectors/**`; the old runtime connector paths remain compatibility
  wrappers. Phase 5.34 reviewed retained trace/status/progress/checkpoint-state
  ownership and approved no implementation move; those files remain retained
  product behavior with stronger import guards.

## Current Cutover Update

The final cutover changed this inventory's conclusions:

- retained/v1 run folders fail closed with
  `This run folder was created by the retired runtime. Start a fresh run.`;
- `src/compat/retained-runtime.ts`, `src/compat/retained-checkpoint-folders.ts`,
  and `src/run-status/v1-run-folder.ts` are gone;
- old retained handler implementations, old trace reader/writer, reducer,
  snapshot writer, append-and-derive, and relay-selection implementation code
  are gone;
- `src/runtime/runner.ts`, `src/runtime/checkpoint-resume.ts`,
  `src/runtime/progress-projector.ts`, `src/runtime/result-writer.ts`, and
  `src/runtime/step-handlers/checkpoint.ts` remain only as fail-closed public
  stubs or helper re-exports;
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
| `src/runtime/catalog-derivations.ts` | compatibility wrapper | Neutral implementation moved to `src/flows/catalog-derivations.ts` in Phase 5.13. Keep old path for tests and external compatibility. |
| `src/runtime/checkpoint-resume.ts` | retained product behavior | Owns retained/v1 checkpoint resume preparation. Keep while old checkpoint folders remain supported. |
| `src/runtime/compile-schematic-to-flow.ts` | compatibility wrapper | Neutral compiler implementation moved to `src/flows/compile-schematic-to-flow.ts` in Phase 5.33. Keep old path for import compatibility. |
| `src/runtime/config-loader.ts` | compatibility wrapper | Neutral config loading lives in `src/shared/config-loader.ts`; keep old path until imports retire. |
| `src/runtime/connectors/claude-code.ts` | compatibility wrapper | Neutral implementation moved to `src/connectors/claude-code.ts` in Phase 5.32. Keep old path for old imports and fingerprint compatibility. |
| `src/runtime/connectors/codex.ts` | compatibility wrapper | Neutral implementation moved to `src/connectors/codex.ts` in Phase 5.32. Keep old path for old imports and fingerprint compatibility. |
| `src/runtime/connectors/custom.ts` | compatibility wrapper | Neutral implementation moved to `src/connectors/custom.ts` in Phase 5.32. Keep old path for old imports and compatibility tests. |
| `src/runtime/connectors/relay-materializer.ts` | compatibility wrapper | Neutral implementation moved to `src/connectors/relay-materializer.ts` in Phase 5.32. Keep old path for old imports and fingerprint compatibility. |
| `src/runtime/connectors/shared.ts` | compatibility wrapper | Re-exports neutral connector helpers and relay types for old imports. |
| `src/runtime/manifest-snapshot-writer.ts` | compatibility wrapper | Neutral byte-match helper lives in `src/shared/manifest-snapshot.ts`; keep old path for retained imports/tests. |
| `src/runtime/operator-summary-writer.ts` | compatibility wrapper | Neutral operator summary writer lives in `src/shared/operator-summary-writer.ts`; keep old path for compatibility. |
| `src/runtime/policy/flow-kind-policy.ts` | compatibility wrapper | Neutral policy helper lives in `src/shared/flow-kind-policy.ts`; keep old path for imports/docs. |
| `src/runtime/progress-projector.ts` | retained product behavior | Retained trace-to-progress projection is still needed for retained runs and old folders. |
| `src/runtime/reducer.ts` | retained product behavior | Retained trace reduction remains the state authority for retained/v1 runs. |
| `src/runtime/registries/checkpoint-writers/registry.ts` | compatibility wrapper | Neutral checkpoint writer lookup moved to `src/flows/registries/checkpoint-writers/registry.ts` in Phase 5.13. |
| `src/runtime/registries/checkpoint-writers/types.ts` | compatibility wrapper | Neutral checkpoint writer types moved to `src/flows/registries/checkpoint-writers/types.ts` in Phase 5.13. |
| `src/runtime/registries/close-writers/registry.ts` | compatibility wrapper | Neutral close writer lookup moved to `src/flows/registries/close-writers/registry.ts` in Phase 5.13. |
| `src/runtime/registries/close-writers/shared.ts` | compatibility wrapper | Neutral report-path helper moved to `src/flows/registries/close-writers/shared.ts` in Phase 5.13. |
| `src/runtime/registries/close-writers/types.ts` | compatibility wrapper | Neutral close writer types moved to `src/flows/registries/close-writers/types.ts` in Phase 5.13. |
| `src/runtime/registries/compose-writers/registry.ts` | compatibility wrapper | Neutral compose writer lookup moved to `src/flows/registries/compose-writers/registry.ts` in Phase 5.13. |
| `src/runtime/registries/compose-writers/types.ts` | compatibility wrapper | Neutral compose writer types moved to `src/flows/registries/compose-writers/types.ts` in Phase 5.13. |
| `src/runtime/registries/cross-report-validators.ts` | compatibility wrapper | Neutral cross-report validator registry moved to `src/flows/registries/cross-report-validators.ts` in Phase 5.13. |
| `src/runtime/registries/report-schemas.ts` | compatibility wrapper | Neutral report parsing registry moved to `src/flows/registries/report-schemas.ts` in Phase 5.13. |
| `src/runtime/registries/shape-hints/registry.ts` | compatibility wrapper | Neutral relay shape-hint lookup moved to `src/flows/registries/shape-hints/registry.ts` in Phase 5.13. |
| `src/runtime/registries/shape-hints/types.ts` | compatibility wrapper | Neutral shape-hint types moved to `src/flows/registries/shape-hints/types.ts` in Phase 5.13. |
| `src/runtime/registries/verification-writers/registry.ts` | compatibility wrapper | Neutral verification writer lookup moved to `src/flows/registries/verification-writers/registry.ts` in Phase 5.13. |
| `src/runtime/registries/verification-writers/types.ts` | compatibility wrapper | Neutral verification writer types moved to `src/flows/registries/verification-writers/types.ts` in Phase 5.13. |
| `src/runtime/relay-selection.ts` | retained fallback | Retained relay decision bridge and connector resolution remain live for fallback paths. |
| `src/runtime/relay-support.ts` | compatibility wrapper | Neutral relay support lives in `src/shared/relay-support.ts`; keep old path for retained handler imports. |
| `src/runtime/result-writer.ts` | retained product behavior | Retained result writer is still used by old runner for retained close/finalization. The shared result path helper lives in `src/shared/result-path.ts`; keep the old `resultPath(...)` export for compatibility. |
| `src/runtime/router.ts` | compatibility wrapper | Neutral router implementation moved to `src/flows/router.ts` in Phase 5.33. Keep old path for import compatibility. |
| `src/runtime/run-relative-path.ts` | compatibility wrapper | Neutral helper lives in `src/shared/run-relative-path.ts`; keep old path for retained imports/tests. |
| `src/runtime/run-status-projection.ts` | compatibility wrapper | Neutral dispatcher lives in `src/run-status/project-run-folder.ts`; keep old path for compatibility tests. |
| `src/runtime/runner-types.ts` | compatibility wrapper | Shared relay/progress types moved to `src/shared/relay-runtime-types.ts`, but retained invocation/result types still live here. |
| `src/runtime/runner.ts` | retained fallback | Owns fallback execution, rollback execution, arbitrary fixtures, `composeWriter`, and public retained resume wrapper. |
| `src/runtime/selection-resolver.ts` | compatibility wrapper | Neutral resolver lives in `src/shared/selection-resolver.ts`; keep old path for imports/tests. |
| `src/runtime/snapshot-writer.ts` | retained product behavior | Retained snapshot derivation is live for retained runs, handoff, and old checkpoint folders. |
| `src/runtime/step-handlers/checkpoint.ts` | retained product behavior | Retained checkpoint waiting/resume behavior remains supported for retained/v1 folders and unproven modes. |
| `src/runtime/step-handlers/compose.ts` | retained fallback | Keeps retained compose behavior and the public `composeWriter` hook. |
| `src/runtime/step-handlers/fanout.ts` | retained fallback | Retained fanout execution remains fallback/oracle coverage for unretired paths. |
| `src/runtime/step-handlers/fanout/aggregate.ts` | compatibility wrapper | Neutral fanout aggregate report helper moved to `src/shared/fanout-aggregate-report.ts` in Phase 5.41. Keep old path for retained imports and old-path proof. |
| `src/runtime/step-handlers/fanout/branch-resolution.ts` | retained fallback | Helper for retained fanout branch expansion and path safety. It now uses the shared branch-template helper from `src/shared/fanout-branch-template.ts`, but retained branch output shape remains here. |
| `src/runtime/step-handlers/fanout/join-policy.ts` | compatibility wrapper | Neutral implementation moved to `src/shared/fanout-join-policy.ts` in Phase 5.38. Keep old path for retained imports and old-path proof. |
| `src/runtime/step-handlers/fanout/types.ts` | retained fallback | Type support for retained fanout behavior. |
| `src/runtime/step-handlers/index.ts` | retained fallback | Dispatcher for retained step handlers. |
| `src/runtime/step-handlers/recovery-route.ts` | compatibility wrapper | Neutral recovery route priority helper moved to `src/shared/recovery-route.ts` in Phase 5.39. Keep old path for retained imports and compatibility proof. |
| `src/runtime/step-handlers/relay.ts` | retained fallback | Retained relay execution, materialization, validation, and connector bridge behavior. |
| `src/runtime/step-handlers/shared.ts` | compatibility wrapper | Neutral JSON report helper moved to `src/shared/json-report.ts` in Phase 5.40. Keep old retained handler path for compatibility proof. |
| `src/runtime/step-handlers/sub-run.ts` | retained fallback | Retained sub-run execution remains fallback/oracle coverage. |
| `src/runtime/step-handlers/types.ts` | retained fallback | Type support for the retained handler cluster. |
| `src/runtime/step-handlers/verification.ts` | retained fallback | Retained verification execution remains fallback/oracle coverage. |
| `src/runtime/terminal-verdict.ts` | compatibility wrapper | Neutral implementation moved to `src/shared/terminal-verdict.ts` in Phase 5.37. Keep old path for import compatibility. |
| `src/runtime/trace-reader.ts` | retained product behavior | Retained trace reading remains live for retained status, progress, resume, and tests. |
| `src/runtime/trace-writer.ts` | retained product behavior | Retained trace appending remains live for retained runs and tests. |
| `src/runtime/write-capable-worker-disclosure.ts` | compatibility wrapper | Neutral helper lives in `src/shared/write-capable-worker-disclosure.ts`; keep old path for compatibility. |

Phase 5.58 marks the lowest-risk shared-helper and flow-authoring wrappers as
soft-deprecated in `src/compat/public-runtime-paths.ts`. Phase 5.59 promotes
that exact list to a public release-note deprecation document at
`docs/release/deprecations/public-runtime-import-paths.md`. This is
communication only: the listed wrappers remain, package exports do not change,
and no import-time warnings are emitted.

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

- connector wrappers under `src/runtime/connectors/**`;
- catalog and registry wrappers under `src/runtime/catalog-derivations.ts` and
  `src/runtime/registries/**`;
- router/compiler/shared-helper wrappers that are still public old import paths;
- old public type/path surfaces such as `src/runtime/runner-types.ts` and
  `src/runtime/result-writer.ts`;
- generated plugin and package export drift when old paths are removed.

The next useful slice is to pick one wrapper category, update
`src/compat/public-runtime-paths.ts`, update the release note and tests, then run
full verification. Do not recreate retained/v1 run-folder adapters.
