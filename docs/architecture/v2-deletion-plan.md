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
the old relay-selection bridge, the old run-status wrapper, the old progress
projection wrapper, the old result writer wrapper, the old checkpoint resume
stub, and the old checkpoint handler stub have been removed. Old runner
entrypoints remain only as fail-closed public stubs.
The old flow-authoring wrappers at `src/runtime/compile-schematic-to-flow.ts`
and `src/runtime/router.ts` have also been removed.

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

The remaining old runtime paths are fail-closed public stubs or old public type
and path surfaces.

| Path | Current owner | Why retain |
|---|---|---|
| `src/runtime/runner.ts` | fail-closed public stub | Direct `runCompiledFlow(...)` calls fail with the retired fresh-run message. Direct checkpoint resume calls fail with the retired run-folder message. |
| `src/runtime/runner-types.ts` | compatibility type surface | Kept for old public type imports while implementation entrypoints are retired. |
| Old shared-helper wrappers under `src/runtime/**` | removed | Neutral owners live under `src/shared/**`; the old runtime wrapper files are retired. |

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
| `src/runtime/compile-schematic-to-flow.ts` | removed | Neutral compiler implementation lives in `src/flows/compile-schematic-to-flow.ts`; the old runtime wrapper is retired. |
| `src/runtime/checkpoint-resume.ts` | removed | Retained and v1 checkpoint resume folders fail closed through policy instead of a direct adapter. |
| `src/runtime/catalog-derivations.ts` | removed | Neutral implementation lives in `src/flows/catalog-derivations.ts`; the old runtime wrapper is retired. |
| `src/runtime/registries/**` | removed | Neutral implementations live in `src/flows/registries/**`; the old runtime wrappers are retired. |
| `src/runtime/connectors/**` | removed | Neutral connector subprocess and relay materializer implementations live in `src/connectors/**`; the old runtime wrappers are retired. |
| `src/runtime/relay-support.ts` | removed | Relay prompt and check helpers live in `src/shared/relay-support.ts`; the old runtime wrapper is retired. |
| `src/runtime/config-loader.ts` | removed | Config discovery lives in `src/shared/config-loader.ts`; the old runtime wrapper is retired. |
| `src/runtime/router.ts` | removed | Neutral router implementation lives in `src/flows/router.ts`; the old runtime wrapper is retired. |
| `src/runtime/relay-selection.ts` | removed | The old relay decision bridge was removed in the final cutover. Core-v2 and tests use `src/shared/relay-selection.ts` and core-v2 connector resolver helpers directly. |
| `src/runtime/selection-resolver.ts` | removed | Selection precedence logic lives in `src/shared/selection-resolver.ts`; the old runtime wrapper is retired. |
| `src/runtime/result-writer.ts` | removed | Shared result path ownership lives in `src/shared/result-path.ts`; old result writing is retired instead of adapted. |
| `src/runtime/manifest-snapshot-writer.ts` | removed | Manifest snapshot byte-match helper lives in `src/shared/manifest-snapshot.ts`; the old runtime wrapper is retired. |
| `src/runtime/snapshot-writer.ts` | removed | Retained state snapshot implementation was removed in the final cutover. Handoff and status paths no longer adapt retained/v1 folders. |
| `src/runtime/step-handlers/checkpoint.ts` | removed | Checkpoint request writing and choice helpers live under core-v2 and flow registries; the old handler stub is retired. |
| `src/runtime/operator-summary-writer.ts` | removed | Operator summary writing lives in `src/shared/operator-summary-writer.ts`; the old runtime wrapper is retired. |
| `src/runtime/run-status-projection.ts` | removed | The status dispatcher implementation lives in `src/run-status/project-run-folder.ts`; the old runtime wrapper is retired. |
| `src/runtime/progress-projector.ts` | removed | Shared progress output helpers live in `src/shared/progress-output.ts`; old v1 trace projection is retired instead of adapted. |
| `src/runtime/reducer.ts`, `src/runtime/append-and-derive.ts`, `src/runtime/trace-reader.ts`, `src/runtime/trace-writer.ts` | removed | Old trace infrastructure was removed in the final cutover. Retained/v1 folders fail closed instead of projecting old trace state. |
| `src/runtime/policy/flow-kind-policy.ts` | removed | Flow-kind policy lives in `src/shared/flow-kind-policy.ts`; the old runtime wrapper is retired. |
| `src/runtime/write-capable-worker-disclosure.ts` | removed | Disclosure helper lives in `src/shared/write-capable-worker-disclosure.ts`; the old runtime wrapper is retired. |
| `src/runtime/run-relative-path.ts` | removed | Run-relative path helper lives in `src/shared/run-relative-path.ts`; the old runtime wrapper is retired. |

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
| `runtime/checkpoint-resume` | none | removed stub | Retained run folders fail closed through policy, not a direct adapter. |
| `runtime/runner-types` | old public type imports and tests | compatibility type surface | Keep until old type imports retire. |
| `runtime/run-status-projection` | none | removed wrapper | Run-status ownership lives in `src/run-status/project-run-folder.ts`. |
| `runtime/progress-projector` | none | removed wrapper | Shared progress output ownership lives in `src/shared/progress-output.ts`. |
| `runtime/result-writer` | none | removed wrapper | Shared result path ownership lives in `src/shared/result-path.ts`. |
| `runtime/step-handlers/checkpoint` | none | removed stub | Checkpoint behavior is owned by core-v2 executors and flow registry helpers. |
| `runtime/step-handlers` | wrapper compatibility tests and checkpoint fail-closed tests | mostly removed; remaining wrappers/stub only | Do not restore the old handler cluster. |
| `runtime/registries` | none | removed wrappers | Neutral source ownership now lives in `src/flows/registries/**`. |
| `runtime/connectors` | none | removed wrappers | Live connector infrastructure now lives in `src/connectors/**`. |
| `runtime/relay-support` | old-path compatibility imports | compatibility re-export | Shared helper ownership lives in `src/shared/relay-support.ts`. |
| `runtime/relay-selection` | none | removed bridge | Core-v2 and tests use shared relay-selection helpers and core-v2 connector resolver helpers directly. |
| `runtime/selection-resolver` | old-path compatibility imports | compatibility re-export | Neutral ownership lives in `src/shared/selection-resolver.ts`; keep wrapper until old-path imports migrate. |
| old trace/status/progress helpers | run-status dispatcher and CLI progress | v2 status plus retired old projection | `src/run-status/project-run-folder.ts` owns the public run-folder dispatcher. `src/run-status/v2-run-folder.ts` owns marked core-v2 run-folder projection. `src/shared/progress-output.ts` owns shared progress output helpers. Unmarked retired folders fail closed. |
| compiler/catalog modules | generator, router, catalog tests | authoring infrastructure under `src/flows/**` | Keep the neutral owners. The old runtime wrappers are retired. |

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
- Old flow-authoring wrappers for router/compiler were removed after production
  and tooling imports moved to `src/flows/**`.
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
