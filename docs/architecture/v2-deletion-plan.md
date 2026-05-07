# Circuit v2 Retained Runtime Plan

## Current Cutover Direction

The retained-runtime compatibility posture is superseded by
`docs/architecture/v2-final-cutover-policy.md`.

There are zero external users. The desired direction is final cutover, not more
external review packets or a longer compatibility window. Historical details
below are preserved until the final doc compression group, but they should not
be read as current product policy.

The next implementation group should make retained and v1 run folders fail
closed with exactly:

```text
This run folder was created by the retired runtime. Start a fresh run.
```

Do not add a v1 run-folder adapter.

This is the historical post-default-selector deletion-readiness plan. The final
cutover policy has now moved past the retained-runtime compatibility posture.

The current selector routes proven fresh runs through core-v2. Anything that
still requires the retired runtime now fails closed instead of running through a
retained fallback. Retained and v1 run folders also fail closed instead of being
adapted.

Phase 4.42 through Phase 5.59 record the compatibility-preserving path. The
final cutover supersedes that path: `src/compat/retained-runtime.ts`,
`src/compat/retained-checkpoint-folders.ts`, `src/run-status/v1-run-folder.ts`,
old handler implementations, old trace/reducer/snapshot implementation files,
and the old relay-selection bridge have been removed. Old runner, checkpoint,
progress, and result-writer entrypoints remain only as fail-closed public stubs.

## 1. Current Runtime Selector

Normal CLI routing is a selector:

```text
matrix-supported fresh run -> core-v2
core-v2-marked checkpoint resume -> core-v2
retained/v1 checkpoint resume -> fail closed
future or unproven generated entry modes -> fail closed until proven in v2
unsupported flow/mode/depth outside the generated catalog -> fail closed
arbitrary explicit fixture -> fail closed unless strict v2 opt-in is supported
custom flow root -> fail closed unless strict v2 opt-in is supported
official wrapper-provenanced packaged host flow root -> selector matrix
unprovenanced packaged host flow root -> fail closed by default
programmatic composeWriter injection -> fail closed; no v2 hook is planned
```

The old rollback switch now requests the retired runtime and fails closed unless
strict v2 opt-in routes a supported fresh run through v2:

```text
CIRCUIT_DISABLE_V2_RUNTIME=1
```

Strict opt-in remains:

```text
CIRCUIT_V2_RUNTIME=1
```

Strict opt-in force-tests v2 and fails closed when an invocation is not safe for
v2. Runtime decision diagnostics are display-only:

```text
CIRCUIT_SHOW_RUNTIME_DECISION=1
```

The old migration name remains a temporary alias:

```text
CIRCUIT_V2_RUNTIME_CANDIDATE=1
```

The candidate support matrix currently aliases the default support matrix. The
alias should be removed later only through an explicit operator-facing slice.

## 2. Current Old Runtime Disposition

The remaining old runtime paths are either compatibility wrappers or fail-closed
public stubs.

| Path | Current owner | Why retain |
|---|---|---|
| `src/runtime/runner.ts` | fail-closed public stub | Direct `runCompiledFlow(...)` calls fail with the retired fresh-run message. Direct checkpoint resume calls fail with the retired run-folder message. |
| `src/runtime/checkpoint-resume.ts` | fail-closed public stub | `prepareCheckpointResume(...)` fails with the retired run-folder message. |
| `src/runtime/progress-projector.ts` | shared progress re-export plus fail-closed old projection stubs | `progressDisplay(...)` and `reportProgress(...)` are re-exported from `src/shared/progress-output.ts`; old trace projection APIs fail closed. |
| `src/runtime/result-writer.ts` | result path helper plus fail-closed old writer stub | `resultPath(...)` still points to the shared result path helper; `writeResult(...)` fails closed. |
| `src/runtime/step-handlers/checkpoint.ts` | fail-closed checkpoint handler stub | The public checkpoint helper types remain; `runCheckpointStep(...)` fails closed. |
| `src/runtime/runner-types.ts` | compatibility type surface | Kept for old public type imports while implementation entrypoints are retired. |
| `src/runtime/terminal-verdict.ts`, `src/runtime/step-handlers/recovery-route.ts`, `src/runtime/step-handlers/shared.ts`, `src/runtime/step-handlers/fanout/aggregate.ts`, `src/runtime/step-handlers/fanout/join-policy.ts` | compatibility wrappers | Kept as old import paths for neutral shared helpers. |

The next deletion slice should focus on wrappers and package surface only. It
should not recreate a retained runtime adapter.

## 2.1 Phase 5.5 Deletion Readiness Result

The current file-by-file inventory lives in:

- `docs/architecture/v2-deletion-readiness-inventory.md`

The Phase 5.5 result is historical. It was intentionally conservative before
the product decision changed. Current cutover work has removed the retained
runtime fallback and old saved-folder adapter path instead of preserving them.

No new review packet is required for the completed cutover work. Prepare one
only if a new ambiguity appears that cannot be resolved locally.

## 3. Runtime Files To Keep, Stub, Or Remove

These files live under `src/runtime/`, but they are not all old graph-runner
code. After final cutover, the remaining current files should be treated as
wrappers, public type/path surfaces, or fail-closed stubs.

| Path | Classification | Why retain or move |
|---|---|---|
| `src/runtime/compile-schematic-to-flow.ts` | compatibility re-export | Neutral compiler implementation moved to `src/flows/compile-schematic-to-flow.ts` in Phase 5.33. Keep old path until compatibility imports retire. |
| `src/runtime/catalog-derivations.ts` | compatibility re-export | Neutral implementation moved to `src/flows/catalog-derivations.ts` in Phase 5.13. Keep old path until compatibility imports retire. |
| `src/runtime/registries/**` | compatibility re-exports | Neutral implementations moved to `src/flows/registries/**` in Phase 5.13. Keep old paths until compatibility imports retire. |
| `src/runtime/connectors/**` | compatibility re-exports | Neutral connector subprocess and relay materializer implementations moved to `src/connectors/**` in Phase 5.32. Keep old runtime paths until compatibility imports and fingerprint wrappers are intentionally retired. |
| `src/runtime/relay-support.ts` | compatibility re-export | Relay prompt and check helpers moved to `src/shared/relay-support.ts` in Phase 4.13. Keep this wrapper until old imports retire. |
| `src/runtime/config-loader.ts` | compatibility re-export | Config discovery moved to `src/shared/config-loader.ts` in Phase 4.22. Keep this wrapper until old-path tests and external imports stop using it. |
| `src/runtime/router.ts` | compatibility re-export | Neutral router implementation moved to `src/flows/router.ts` in Phase 5.33. Keep old path until compatibility imports retire. |
| `src/runtime/relay-selection.ts` | removed | The old relay decision bridge was removed in the final cutover. Core-v2 and tests use `src/shared/relay-selection.ts` and core-v2 connector resolver helpers directly. |
| `src/runtime/selection-resolver.ts` | compatibility re-export | Selection precedence logic moved to `src/shared/selection-resolver.ts` in Phase 4.11. Keep this wrapper until old imports retire. |
| `src/runtime/result-writer.ts` | result path helper plus fail-closed writer stub | core-v2 owns result writing. Phase 4.25 moved the shared `reports/result.json` path helper to `src/shared/result-path.ts`; the old `resultPath(...)` export remains, while `writeResult(...)` fails closed. |
| `src/runtime/manifest-snapshot-writer.ts` | compatibility re-export | Manifest snapshot byte-match helper moved to `src/shared/manifest-snapshot.ts` in Phase 4.20. Keep this wrapper until old imports retire. |
| `src/runtime/snapshot-writer.ts` | removed | Retained state snapshot implementation was removed in the final cutover. Handoff and status paths no longer adapt retained/v1 folders. |
| `src/runtime/operator-summary-writer.ts` | compatibility re-export | Operator summary writing moved to `src/shared/operator-summary-writer.ts` in Phase 4.21. Keep this wrapper until old-path tests and release evidence stop using it. |
| `src/runtime/run-status-projection.ts` | compatibility re-export | The status dispatcher implementation moved to `src/run-status/project-run-folder.ts` in Phase 4.28. Keep this wrapper while old-path imports, docs, and compatibility tests still cite it. |
| `src/runtime/progress-projector.ts` | shared progress re-export plus fail-closed projection stubs | core-v2 imports shared helpers from `src/shared/progress-output.ts`. Old trace projection APIs now fail closed. |
| `src/runtime/reducer.ts`, `src/runtime/append-and-derive.ts`, `src/runtime/trace-reader.ts`, `src/runtime/trace-writer.ts` | removed | Old trace infrastructure was removed in the final cutover. Retained/v1 folders fail closed instead of projecting old trace state. |
| `src/runtime/policy/flow-kind-policy.ts` | compatibility re-export | Flow-kind policy moved to `src/shared/flow-kind-policy.ts` in Phase 4.19. Keep this wrapper until old-path imports and documentation references stop using it. |
| `src/runtime/write-capable-worker-disclosure.ts` | compatibility re-export | Disclosure helper moved to `src/shared/write-capable-worker-disclosure.ts` in Phase 4.14. Keep this wrapper while release evidence, old-path compatibility tests/docs, or external old-path consumers still cite the wrapper. |
| `src/runtime/run-relative-path.ts` | compatibility re-export | Run-relative path helper moved to `src/shared/run-relative-path.ts` in Phase 4.15. Keep this wrapper until old imports retire. |

Old retained handler implementation files deleted in the final cutover:

- `src/runtime/step-handlers/compose.ts`
- `src/runtime/step-handlers/relay.ts`
- `src/runtime/step-handlers/sub-run.ts`
- `src/runtime/step-handlers/fanout.ts`
- `src/runtime/step-handlers/fanout/branch-resolution.ts`
- `src/runtime/step-handlers/fanout/types.ts`
- `src/runtime/step-handlers/index.ts`
- `src/runtime/step-handlers/types.ts`
- `src/runtime/step-handlers/verification.ts`

## 4. Live Import Evidence

The latest reference search covered:

```text
../runtime
../../runtime
runtime/
from "...runtime"
```

Current import groups:

| Reference group | Current consumers | Classification | Next action |
|---|---|---|---|
| `compat/retained-runtime` | none | removed facade | Do not recreate it. CLI, handoff, and run-status use the retired runtime policy directly. |
| `runtime/runner` | direct compatibility tests and old public imports | fail-closed public stub | Keep only while the public old runner surface remains listed. Fresh retired invocations fail closed. |
| `runtime/checkpoint-resume` | direct compatibility tests | fail-closed public stub | Keep only while the old checkpoint-resume import surface remains listed. Retired run folders fail closed. |
| `runtime/runner-types` | old public type imports and tests | compatibility type surface | Keep until old type imports retire. |
| `runtime/step-handlers` | wrapper compatibility tests and checkpoint fail-closed tests | mostly removed; remaining wrappers/stub only | Do not restore the old handler cluster. |
| `runtime/registries` | old-path compatibility tests | compatibility re-exports | Neutral source ownership now lives in `src/flows/registries/**`. Keep wrappers until old imports retire. |
| `runtime/connectors` | old imports, connector compatibility tests, smoke fingerprint wrappers | compatibility re-exports | Keep wrappers. Live connector infrastructure now lives in `src/connectors/**`; old runtime paths remain intentional compatibility surfaces. |
| `runtime/relay-support` | old-path compatibility imports | compatibility re-export | Shared helper ownership lives in `src/shared/relay-support.ts`. |
| `runtime/relay-selection` | none | removed bridge | Core-v2 and tests use shared relay-selection helpers and core-v2 connector resolver helpers directly. |
| `runtime/selection-resolver` | old-path compatibility imports | compatibility re-export | Neutral ownership lives in `src/shared/selection-resolver.ts`; keep wrapper until old-path imports migrate. |
| old trace/status/progress helpers | run-status dispatcher, CLI progress, direct compatibility tests | v2 status plus fail-closed old projection | `src/run-status/project-run-folder.ts` owns the public run-folder dispatcher. `src/run-status/v2-run-folder.ts` owns marked core-v2 run-folder projection. Unmarked retired folders fail closed. |
| compiler/catalog modules | generator, router, catalog tests | authoring infrastructure | Keep. These are not old execution files. |

## 5. Replacement v2 Surfaces

Core-v2 now has real replacements for the supported fresh-run path:

- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/trace/trace-store.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/core-v2/run-files/paths.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/checkpoint-resume.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/executors/*`
- `src/core-v2/connectors/resolver.ts`
- `src/core-v2/fanout/*`
- `src/core-v2/projections/status.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/connector-relay.ts`
- `src/shared/connector-helpers.ts`
- `src/shared/relay-runtime-types.ts`
- `src/shared/progress-output.ts`
- `src/shared/selection-resolver.ts`
- `src/shared/relay-selection.ts`
- `src/shared/relay-support.ts`
- `src/shared/write-capable-worker-disclosure.ts`
- `src/shared/run-relative-path.ts`
- `src/shared/flow-kind-policy.ts`
- `src/shared/manifest-snapshot.ts`
- `src/shared/operator-summary-writer.ts`
- `src/shared/config-loader.ts`
- `src/shared/result-path.ts`
- `src/run-status/project-run-folder.ts`
- `src/run-status/projection-common.ts`
- `src/run-status/v2-run-folder.ts`

These are now enough for the supported fresh-run and core-v2 resume surface.
Unsupported invocations fail closed instead of routing to the retired runtime.

## 6. Evidence Already In Place

Current v2 evidence includes:

- core-v2 unit tests under `tests/core-v2/`;
- fixture-level v2 checkpoint pause/resume tests in
  `tests/core-v2/checkpoint-resume-v2.test.ts`;
- v2 checkpoint hardening tests for request-path validation, choice
  consistency in resume and status projection, stale/missing request files,
  already-resolved checkpoints, closed runs, checkpoint report validation, and
  saved-engine resume dispatch;
- Build deep default-route smoke for core-v2 checkpoint pause/resume, plus
  rollback evidence that `CIRCUIT_DISABLE_V2_RUNTIME=1` now fails closed because
  the retired runtime is unavailable;
- generated-flow parity tests under `tests/parity/`;
- CLI default-selector tests under `tests/runner/cli-v2-runtime.test.ts`;
- v2 run folder status tests under `tests/runner/run-status-projection.test.ts`;
- progress schema tests under `tests/contracts/progress-event-schema.test.ts`;
- generated-surface drift checks through `npm run check-flow-drift`;
- full validation through `npm run verify`.

Old runtime tests now mainly prove fail-closed behavior, public wrapper imports,
or historical parity for behavior already moved to v2.

## 7. Full Import Inventory

The latest retained-runtime inventory packet includes full command output in:

- `docs/architecture/v2-runtime-import-inventory.md`

It includes:

```text
find src/runtime -type f | sort
rg -n "from ['\"].*runtime/|../runtime|../../runtime|runtime/" src tests scripts docs specs package.json
rg -n "runCompiledFlow|resumeCompiledFlowCheckpoint|RelayFn|ProgressReporter|deriveResolvedSelection|resolveSelection" src tests scripts docs
```

The `rg` commands exclude the generated inventory file itself so the artifact
does not cite its own contents.

## 8. Compressed Migration Record

The detailed phase-by-phase table is compressed into git history and
`docs/architecture/v2-worklog.md`. The active milestones are:

- Shared helpers and flow-owned registries moved to neutral owners under
  `src/shared/**`, `src/flows/**`, `src/connectors/**`, and `src/run-status/**`.
- Core-v2 became the default runtime for the generated public flow matrix,
  including checkpoint pause/resume for marked v2 folders.
- The compatibility-preserving retained runtime posture was superseded by
  `docs/architecture/v2-final-cutover-policy.md`.
- Retained/v1 run folders now fail closed with the retired runtime message.
- Unsupported fresh invocations, arbitrary fixtures/custom roots, rollback, and
  programmatic `composeWriter` now fail closed instead of using retained
  fallback execution.
- Old handler, trace, reducer, snapshot, and relay-selection implementation code
  has been removed.
- The remaining old runtime wrappers are governed by
  `src/compat/public-runtime-paths.ts` and
  `docs/release/deprecations/public-runtime-import-paths.md`.

## 9. Next Deletion Criteria

The next useful deletion work is wrapper/package-surface work, not retained
runtime rescue work. Before deleting a remaining old `src/runtime/**` wrapper:

1. update `src/compat/public-runtime-paths.ts`;
2. update the release deprecation note and policy docs;
3. update or remove the old-path compatibility tests that prove that wrapper;
4. run focused tests plus full `npm run verify`;
5. use local adversarial review to check for generated-surface, package export,
   and plugin-cache drift.

External review is not warranted by default. Prepare a review packet only if a
new compatibility or package-surface ambiguity appears that local tests cannot
settle.
