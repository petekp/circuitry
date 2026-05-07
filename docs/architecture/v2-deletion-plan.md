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

This is the post-default-selector deletion-readiness plan.

The default selector now routes matrix-supported fresh runs through core-v2.
That does not make the old runtime deletable. The retained runtime still owns
fallback behavior, retained/v1 checkpoint resume, arbitrary fixtures, custom
flow roots, programmatic compose writer injection, rollback, and many oracle
tests. Phase 5.11 moves Explore tournament into the core-v2 matrix, so the
current generated public entry-mode catalog is now covered by default routing.
That is parity progress, not deletion approval.

No old runtime files are approved for deletion in this phase.

Phase 4.42 formalizes checkpoint resume as an intentional retained-runtime
boundary for the default-selector milestone. Phase 5.0 adds and passes an
automated selector soak gate. Phase 5.1 plans v2 checkpoint resume as the next
product feature needed before old runtime deletion can become realistic. Phase
5.2 implements fixture-level v2 checkpoint pause/resume for new core-v2-marked
run folders. The default-selector milestone is complete for matrix-supported
fresh-run modes. Phase 5.5 adds a deletion-readiness inventory and confirms
that no old runtime file or retained runner/handler test is deletion-ready.
Phase 5.7 resolves programmatic `composeWriter` as retained-runtime-only
compatibility, not a core-v2 API. Phase 5.8 keeps candidate diagnostics as a
temporary runtime decision display flag, and Phase 5.8.1 adds
`CIRCUIT_SHOW_RUNTIME_DECISION=1` with `CIRCUIT_V2_RUNTIME_CANDIDATE=1` as a
temporary alias. Phase 5.11 routes Explore tournament through core-v2 after
fanout relay parity hardening and production wait/resume proof. Phase 5.12
adds explicit retained/v1 checkpoint folder compatibility proof. The release
golden Fix proof no longer uses public `composeWriter`; it uses internal v2
executor injection. Phase 5.14 adds a retained compatibility facade so
CLI/status/handoff code reaches retained fresh-run fallback, retained/v1 resume,
snapshot derivation, trace reading, and trace reduction through
`src/compat/retained-runtime.ts`. Phase 5.58 adds soft-deprecation metadata for
the lowest-risk shared-helper and flow-authoring old import paths, with no
wrapper deletion, no package export change, and no import-time warnings.

## 1. Current Runtime Selector

Normal CLI routing is a selector:

```text
matrix-supported fresh run -> core-v2
core-v2-marked checkpoint resume -> core-v2
retained/v1 checkpoint resume -> retained runtime
future or unproven generated entry modes -> retained runtime until proven or retired
unsupported flow/mode/depth outside the generated catalog -> retained runtime
arbitrary explicit fixture -> retained runtime unless strict opt-in is set
custom flow root -> retained runtime unless strict opt-in is set and support checks pass
official wrapper-provenanced packaged host flow root -> selector matrix
unprovenanced packaged host flow root -> retained runtime by default
programmatic composeWriter injection -> retained runtime-only compatibility
```

The emergency rollback switch remains:

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

## 2. Not Deletable Yet

These old execution files still have live product or test ownership.

| Path | Current owner | Why retain |
|---|---|---|
| `src/runtime/runner.ts` | retained execution implementation | The CLI now reaches retained fresh-run fallback and retained/v1 resume through `src/compat/retained-runtime.ts`, but that facade still delegates to `runCompiledFlow(...)` and `resumeCompiledFlowCheckpoint(...)`. Phase 4.37 moved resume discovery/validation out, and Phase 4.41 moved pure terminal verdict derivation out, but the retained execution loop, close/result tail, and public resume wrapper still live here. Many runner tests still use it. |
| `src/runtime/checkpoint-resume.ts` | retained checkpoint resume preparation | Phase 4.37 moved manifest/trace/request/report validation and waiting-checkpoint discovery here. Keep for retained/v1 checkpoint folders and public checkpoint modes that have not moved to core-v2. |
| `src/runtime/terminal-verdict.ts` | retained close/result helper | Phase 4.41 moved pure terminal admitted verdict derivation here. Keep while retained close/result finalization uses this helper. |
| `src/runtime/runner-types.ts` | compatibility re-export plus retained runtime types | core-v2 imports shared relay/progress/run callback types from `src/shared/relay-runtime-types.ts`. Keep this file until retained runtime and tests stop importing the old surface. |
| `src/runtime/step-handlers/checkpoint.ts` | checkpoint pause/resume and retained checkpoint modes | Phase 5.2 adds fixture-level core-v2 pause/resume for new v2 folders, but retained/v1 checkpoint folders and public checkpoint modes that are not yet routed through core-v2 still use the retained handler. |
| `src/runtime/step-handlers/compose.ts` | retained fallback and programmatic compose writer hook | core-v2 uses catalog writers. Phase 5.7 keeps `main(..., { composeWriter })` retained-runtime-only and does not add a v2 hook. |
| `src/runtime/step-handlers/relay.ts` | retained relay handler and oracle tests | core-v2 no longer imports this file directly, but retained runtime and handler tests still do. |
| `src/runtime/step-handlers/sub-run.ts` | retained fallback and oracle tests | core-v2 has sub-run coverage, but unsupported fallback paths and old tests still rely on the old handler. |
| `src/runtime/step-handlers/fanout.ts` and `src/runtime/step-handlers/fanout/*` | retained fallback and fanout oracle tests | core-v2 has fanout slices, but old fanout behavior remains the comparison oracle. |
| `src/runtime/step-handlers/verification.ts` | retained fallback and verification oracle tests | core-v2 can run flow-owned verification writers, but old verification tests remain useful until migration. |
| `src/runtime/step-handlers/recovery-route.ts` | retained runner recovery behavior | core-v2 has bounded recovery tests, but old runner tests still cover the retained path. |
| `src/runtime/step-handlers/shared.ts`, `src/runtime/step-handlers/types.ts`, `src/runtime/step-handlers/index.ts` | retained handler support | Delete only with the old handler cluster. |

The earliest possible deletion slice is a narrow one after a heavy review that
confirms each retained execution responsibility has either moved to core-v2 or
has been intentionally kept behind a smaller retained module.

## 2.1 Phase 5.5 Deletion Readiness Result

The current file-by-file inventory lives in:

- `docs/architecture/v2-deletion-readiness-inventory.md`

The result is intentionally conservative:

- no `src/runtime` file is a current deletion candidate;
- no retained runner or handler test is obsolete;
- compatibility wrappers remain because old-path imports still exist;
- neutral infrastructure under `src/runtime` should move only behind focused
  reviewed plans;
- retained fallback and checkpoint compatibility still block broad deletion.

No review packet was prepared for Phase 5.5 because it is inventory-only. A
review packet is required before deletion, risky movement, route widening, or
product-policy change.

## 3. Runtime Files To Keep Or Move

These files live under `src/runtime/`, but they are not simply old graph-runner
code. Most should move to neutral homes over time rather than be deleted.

| Path | Classification | Why retain or move |
|---|---|---|
| `src/runtime/compile-schematic-to-flow.ts` | compatibility re-export | Neutral compiler implementation moved to `src/flows/compile-schematic-to-flow.ts` in Phase 5.33. Keep old path until compatibility imports retire. |
| `src/runtime/catalog-derivations.ts` | compatibility re-export | Neutral implementation moved to `src/flows/catalog-derivations.ts` in Phase 5.13. Keep old path until compatibility imports retire. |
| `src/runtime/registries/**` | compatibility re-exports | Neutral implementations moved to `src/flows/registries/**` in Phase 5.13. Keep old paths until compatibility imports retire. |
| `src/runtime/connectors/**` | compatibility re-exports | Neutral connector subprocess and relay materializer implementations moved to `src/connectors/**` in Phase 5.32. Keep old runtime paths until compatibility imports and fingerprint wrappers are intentionally retired. |
| `src/runtime/relay-support.ts` | compatibility re-export | Relay prompt and check helpers moved to `src/shared/relay-support.ts` in Phase 4.13. Keep this wrapper until retained relay handler imports and old tests stop using the old path. |
| `src/runtime/config-loader.ts` | compatibility re-export | Config discovery moved to `src/shared/config-loader.ts` in Phase 4.22. Keep this wrapper until old-path tests and external imports stop using it. |
| `src/runtime/router.ts` | compatibility re-export | Neutral router implementation moved to `src/flows/router.ts` in Phase 5.33. Keep old path until compatibility imports retire. |
| `src/runtime/relay-selection.ts` | retained relay decision bridge | Selection-depth helpers moved to `src/shared/relay-selection.ts` in Phase 4.12. Keep this file for retained relayer resolution, connector bridge behavior, old relay handler imports, and relay provenance tests. |
| `src/runtime/selection-resolver.ts` | compatibility re-export | Selection precedence logic moved to `src/shared/selection-resolver.ts` in Phase 4.11. Keep this wrapper until retained runtime tests and external imports stop using the old path. |
| `src/runtime/result-writer.ts` | retain retained writer / compatibility path export | core-v2 has its own result writer, and retained close/finalization still uses this one. Phase 4.25 moved the shared `reports/result.json` path helper to `src/shared/result-path.ts`; Phase 5.57 moves retained handler/test path-helper imports to that shared owner. Do not merge the writers yet. |
| `src/runtime/manifest-snapshot-writer.ts` | compatibility re-export | Manifest snapshot byte-match helper moved to `src/shared/manifest-snapshot.ts` in Phase 4.20. Keep this wrapper while retained runner and old snapshot tests use the old path. |
| `src/runtime/snapshot-writer.ts` | retain for state snapshots and continuity | Used by retained runner, checkpoint handler, `append-and-derive`, `cli/handoff`, event-log round-trip tests, fresh-run-root tests, release evidence, and state snapshot behavior. |
| `src/runtime/operator-summary-writer.ts` | compatibility re-export | Operator summary writing moved to `src/shared/operator-summary-writer.ts` in Phase 4.21. Keep this wrapper until old-path tests and release evidence stop using it. |
| `src/runtime/run-status-projection.ts` | compatibility re-export | The status dispatcher implementation moved to `src/run-status/project-run-folder.ts` in Phase 4.28. Keep this wrapper while old-path imports, docs, and compatibility tests still cite it. |
| `src/runtime/progress-projector.ts` | retained trace-to-progress projection | core-v2 imports shared helpers from `src/shared/progress-output.ts`. Keep this file for old trace projection, retained runtime imports, and old progress tests. |
| `src/runtime/reducer.ts`, `src/runtime/append-and-derive.ts`, `src/runtime/trace-reader.ts`, `src/runtime/trace-writer.ts` | retain until trace/projection tests migrate | Old trace infrastructure remains the v1 oracle and status/progress source for retained runs. |
| `src/runtime/policy/flow-kind-policy.ts` | compatibility re-export | Flow-kind policy moved to `src/shared/flow-kind-policy.ts` in Phase 4.19. Keep this wrapper until old-path imports and documentation references stop using it. |
| `src/runtime/write-capable-worker-disclosure.ts` | compatibility re-export | Disclosure helper moved to `src/shared/write-capable-worker-disclosure.ts` in Phase 4.14. Keep this wrapper while release evidence, old-path compatibility tests/docs, or external old-path consumers still cite the wrapper. |
| `src/runtime/run-relative-path.ts` | compatibility re-export | Run-relative path helper moved to `src/shared/run-relative-path.ts` in Phase 4.15. Keep this wrapper while retained runtime, connector materialization, old handlers, old-path tests, docs, or external old-path consumers use the wrapper. |

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
| `compat/retained-runtime` | `src/cli/circuit.ts`, `src/cli/handoff.ts`, `src/run-status/*` | retained compatibility facade | Keep as the narrow boundary for retained fresh-run fallback, retained/v1 resume, snapshot derivation, trace reading, and trace reduction. |
| `runtime/runner` | `src/compat/retained-runtime.ts`, many `tests/runner/*`, selected contract tests | retained execution implementation | Keep until unsupported modes, rollback, `composeWriter`, fixtures, and the public resume wrapper have explicit replacement, compatibility-package ownership, or deprecation. |
| `runtime/checkpoint-resume` | `src/runtime/runner.ts` | retained checkpoint resume preparation | Keep while checkpoint resume remains retained-runtime-owned. This module is not a v2 resume implementation and does not make trace/reducer/snapshot/checkpoint internals deletable. |
| `runtime/runner-types` | retained runtime, `src/cli/circuit.ts`, tests | compatibility re-export | core-v2 no longer imports this file. Keep until retained runtime and tests stop importing the old type surface. |
| `runtime/step-handlers` | direct handler tests and retained runner | retained execution oracle | Migrate tests only after v2 owns the behavior or the behavior stays retained by policy. |
| `runtime/registries` | old-path compatibility tests | compatibility re-exports | Neutral source ownership now lives in `src/flows/registries/**`; retained runtime internal imports now use the neutral owners directly. Keep wrappers until old imports retire. |
| `runtime/connectors` | old imports, connector compatibility tests, smoke fingerprint wrappers | compatibility re-exports | Keep wrappers. Live connector infrastructure now lives in `src/connectors/**`; old runtime paths remain intentional compatibility surfaces. |
| `runtime/relay-support` | old relay handler and compatibility imports | compatibility re-export | core-v2 no longer imports this file. Shared helper ownership now lives in `src/shared/relay-support.ts`. |
| `runtime/relay-selection` | retained relay handler, old runner, and old relay tests | retained relay decision bridge | core-v2 no longer imports this file. Keep until retained relayer resolution and connector bridge behavior move or stay behind an explicit retained module. |
| `runtime/selection-resolver` | retained tests and compatibility imports | compatibility re-export | Neutral ownership now lives in `src/shared/selection-resolver.ts`; keep wrapper until old-path imports migrate. |
| old trace/status/progress helpers | neutral status dispatcher, CLI progress, retained runtime, old compatibility tests | projection infrastructure | Keep. `src/run-status/project-run-folder.ts` owns the public run-folder dispatcher, `src/run-status/v1-run-folder.ts` owns retained v1 run-folder projection, and `src/run-status/v2-run-folder.ts` owns marked core-v2 run-folder projection. Neutral status modules depend on `src/runtime` only for retained v1 trace reading, reduction, and checkpoint writer validation infrastructure. `progress-projector.ts` still owns old trace-to-progress projection while shared output helpers live in `src/shared/progress-output.ts`. |
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
- `src/run-status/v1-run-folder.ts`
- `src/run-status/v2-run-folder.ts`

These are not enough by themselves to delete the retained runtime because the
selector still intentionally routes some invocations outside core-v2.

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
  rollback evidence that retained Build deep remains available when
  `CIRCUIT_DISABLE_V2_RUNTIME=1`;
- generated-flow parity tests under `tests/parity/`;
- CLI default-selector tests under `tests/runner/cli-v2-runtime.test.ts`;
- v2 run folder status tests under `tests/runner/run-status-projection.test.ts`;
- progress schema tests under `tests/contracts/progress-event-schema.test.ts`;
- generated-surface drift checks through `npm run check-flow-drift`;
- full validation through `npm run verify`.

Old runtime tests remain useful until each behavior is either v2-owned or
explicitly retained.

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

## 8. First Narrowing Candidates

These are candidates for future move/narrowing slices. They are not deletion
approval.

| Candidate slice | Why it is small | Proof needed |
|---|---|---|
| Move shared relay/progress types out of `src/runtime/runner-types.ts` | Done in Phase 4.9 for `RelayFn`, `RelayInput`, `ProgressReporter`, and `RuntimeEvidencePolicy`. `runner-types.ts` remains as a compatibility re-export plus retained runtime invocation/result types. | Keep full validation green while retained runtime and tests continue importing the old surface. |
| Move progress helper functions out of `src/runtime/progress-projector.ts` | Done in Phase 4.10 for `progressDisplay` and `reportProgress`. `progress-projector.ts` re-exports them for compatibility and still owns old trace-to-progress projection. | Keep progress schema tests, old progress-projector tests, CLI v2 progress tests, and full validation green. |
| Move relay selection support to a neutral module | Mostly done in Phases 4.11 and 4.12 for selection ownership: `src/shared/selection-resolver.ts` owns `resolveSelectionForRelay`, and `src/shared/relay-selection.ts` owns depth-bound selection derivation. `src/runtime/relay-selection.ts` remains for retained relayer resolution and connector bridge behavior. | Config loader tests, selection contract tests, relay provenance tests, core-v2 connector tests, CLI custom connector precedence tests, full `npm run verify`. |
| Move run-relative path helper out of `src/runtime/run-relative-path.ts` | Done in Phase 4.15 for `resolveRunRelative`. Flow writers and shared relay support now import `src/shared/run-relative-path.ts`; the runtime file remains a compatibility re-export for retained runtime surfaces. | Keep run-relative path containment tests, materializer tests, report writer tests, CLI v2 tests, and full validation green. |
| Move connector relay data/hash helper out of `src/runtime/connectors/shared.ts` | Done in Phase 4.16 for `ConnectorRelayInput`, `RelayResult`, and `sha256Hex`; Phase 5.32 makes `src/runtime/connectors/shared.ts` a compatibility re-export of `src/connectors/shared.ts`. | Keep connector wrapper compatibility tests, relay/materializer tests, connector selection tests, connector smoke source fingerprint lists, and full validation green. |
| Move connector-only helpers out of `src/runtime/connectors/shared.ts` | Done in Phase 4.17 for `selectedModelForProvider` and `extractJsonObject`; Phase 5.32 keeps the old shared path as a compatibility re-export. | Keep connector helper compatibility tests, extraction tests, connector smoke source fingerprint lists, subprocess connector smoke tests, and full validation green. |
| Plan connector/materializer/registry ownership before risky moves | Done in Phase 4.18, then implemented for connectors/materializer in Phase 5.32. `docs/architecture/v2-connector-materializer-plan.md` now records `src/connectors/**` as the neutral owner. `docs/architecture/v2-registry-ownership-plan.md` classifies registries as flow-package/report infrastructure, not old runner debris. | Keep old runtime connector wrappers and connector/materializer proof green; review before changing connector behavior or deleting compatibility paths. |
| Move flow-kind policy wrapper out of `src/runtime/policy/flow-kind-policy.ts` | Done in Phase 4.19. The neutral wrapper lives in `src/shared/flow-kind-policy.ts`; the runtime path remains a compatibility re-export. | Keep flow-kind policy tests, CLI fixture policy tests, generated-surface drift checks, and full validation green. |
| Move manifest snapshot helper out of `src/runtime/manifest-snapshot-writer.ts` | Done in Phase 4.20. The byte-match implementation lives in `src/shared/manifest-snapshot.ts`; the runtime path remains a compatibility re-export. | Keep event-log round-trip tests, run-status projection tests, fresh-run-root tests, handoff tests, and full validation green. |
| Move operator summary writer out of `src/runtime/operator-summary-writer.ts` | Done in Phase 4.21. The implementation lives in `src/shared/operator-summary-writer.ts`; the runtime path remains a compatibility re-export. | Keep operator summary tests, CLI v2 runtime tests, release evidence checks, and full validation green. |
| Move config loader out of `src/runtime/config-loader.ts` | Done in Phase 4.22. The schema-backed config discovery implementation lives in `src/shared/config-loader.ts`; the runtime path remains a compatibility re-export. | Keep config-loader tests, CLI v2 runtime tests, connector selection tests, and full validation green. |
| Plan the remaining heavy boundaries before risky moves | Done in Phase 4.23. `docs/architecture/v2-heavy-boundary-plan.md` classifies connector subprocesses, relay materialization, registries, router/catalog, compiler, trace/status/progress, result writing, old runner/handlers, and checkpoint resume. | Review the plan before moving or deleting any remaining high-risk runtime cluster. |
| Plan result writer ownership before moving code | Done in Phase 4.24. `docs/architecture/v2-result-writer-plan.md` compares retained and v2 result semantics and recommends a path-only helper extraction before any writer merge. | Keep retained and v2 result writers separate unless a future trace/status/progress ownership review approves merging lifecycle semantics. |
| Move the shared run result path helper | Done in Phase 4.25. `src/shared/result-path.ts` owns `RUN_RESULT_RELATIVE_PATH` and `runResultPath(...)`; `src/runtime/result-writer.ts` keeps the compatibility `resultPath(...)` export. | Keep `src/runtime/result-writer.ts` as the retained writer; this move does not make it deletable. |
| Plan trace/status/progress ownership before moving projection code | Done in Phase 4.26. `docs/architecture/v2-trace-status-progress-plan.md` classifies `runs show`, progress JSONL, v1 trace/reducer/snapshot, and v2 projection ownership. | Review the plan before moving `run-status-projection.ts`, `progress-projector.ts`, trace reader/writer, reducer, snapshot writer, or checkpoint-resume-adjacent code. |
| Move the public run-status import surface | Done in Phase 4.27. `src/run-status/project-run-folder.ts` became the neutral public surface; `src/cli/runs.ts` imports it. | Keep projection behavior unchanged and validate both v1 and v2 run folders. |
| Move the run-status dispatcher implementation | Done in Phase 4.28. `src/run-status/project-run-folder.ts` now owns the dispatcher implementation, and `src/runtime/run-status-projection.ts` is a compatibility re-export. | Keep retained v1 trace/reducer/snapshot/checkpoint helpers in place. This move does not approve progress projection, trace/reducer/snapshot, or checkpoint-resume movement. |
| Split v2 run-folder status projection | Done in Phase 4.29. `src/run-status/v2-run-folder.ts` owns marked core-v2 run-folder projection, and `src/run-status/projection-common.ts` owns shared status projection helpers. | Keep retained v1 trace/reducer/snapshot/checkpoint helpers in place. This move does not approve v1 trace/progress/reducer/snapshot or checkpoint-resume movement. |
| Split v1 run-folder status projection | Done in Phase 4.30. `src/run-status/v1-run-folder.ts` owns retained v1 run-folder projection and checkpoint-waiting status projection. | Keep retained v1 trace/reducer/snapshot/checkpoint helper modules in place. This move does not approve progress projection, trace/reducer/snapshot, checkpoint resume, old runner, or step-handler movement. |
| Clean up neutral status dependency direction | Done in Phase 4.30.1. `projection-common.ts` now imports result path from `src/shared/result-path.ts`, and `v1-run-folder.ts` imports run-relative path from `src/shared/run-relative-path.ts`. | Neutral status modules should depend on retained runtime only for retained v1 trace/reducer/checkpoint infrastructure. |
| Plan trace/progress/checkpoint ownership before lower-level moves | Done in Phase 4.31. `docs/architecture/v2-trace-progress-checkpoint-boundary-plan.md` classifies checkpoint resume, v1 trace/state, retained progress projection, and old runner/handler blockers. | Do not move trace reader/writer, reducer, snapshot writer, progress projector, checkpoint resume, old runner, or step handlers before the ownership decision is reviewed. |
| Decide checkpoint resume ownership direction | Done in Phase 4.32. `docs/architecture/v2-checkpoint-resume-ownership-plan.md` maps the retained resume path and recommends classifying old runner/handler tests before either implementing v2 resume parity or shrinking retained resume. | Do not implement v2 checkpoint resume or move retained resume code before the old runner/handler test map is explicit. |
| Classify old runner and handler tests | Done in Phase 4.33. `docs/architecture/v2-runner-handler-test-classification.md` classifies old tests as retained product fallback, checkpoint-resume coverage, old-runtime oracle, or compatibility imports. | No old runner/handler test is currently safe to delete. Use the map before any retained checkpoint resume shrink proposal. |
| Produce current-only old runner/handler import inventory | Done in Phase 4.34. `docs/architecture/v2-runner-handler-current-import-inventory.md` records live product, release, test, and docs references without historical scan blocks. | No old runner or handler file is deletion-ready. Use this inventory before any retained checkpoint resume shrink proposal. |
| Classify retained progress projection ownership | Done in Phase 4.35. `docs/architecture/v2-retained-progress-contract-plan.md` keeps retained v1 progress projection in `src/runtime/progress-projector.ts` for now. | Do not add a v1 progress facade or move projector internals until checkpoint resume or retained runner ownership changes. |
| Propose retained checkpoint resume shrink | Done in Phase 4.36. `docs/architecture/v2-retained-checkpoint-resume-shrink-proposal.md` proposes extracting resume discovery/validation to `src/runtime/checkpoint-resume.ts` while keeping `resumeCompiledFlowCheckpoint(...)` and `executeCompiledFlow(...)` in `runner.ts`. | Review before implementing. This does not approve v2 checkpoint resume, old runtime deletion, handler movement, or trace/progress/reducer/snapshot movement. |
| Extract retained checkpoint resume preparation | Done in Phase 4.37. `src/runtime/checkpoint-resume.ts` now owns retained resume discovery and validation, while `src/runtime/runner.ts` keeps the public resume wrapper and execution loop. | Keep checkpoint resume retained-runtime-owned. This does not approve old runtime deletion, v2 resume routing, handler movement, or trace/progress/reducer/snapshot movement. |
| Plan retained runner execution-loop boundary | Done in Phase 4.38. `docs/architecture/v2-retained-runner-boundary-plan.md` maps the remaining runner responsibilities and recommends stopping runner shrinkage for now. | Do not move `executeCompiledFlow(...)` or trace/progress/reducer/snapshot/checkpoint handler behavior. If another shrink is desired, prepare a close/result finalization proposal first. |
| Refresh old runner/handler test and import inventory | Done in Phase 4.39. `docs/architecture/v2-runner-handler-test-classification.md` and `docs/architecture/v2-runner-handler-current-import-inventory.md` now reflect the Phase 4.37 checkpoint resume extraction and Phase 4.38 runner-boundary decision. | No old runner/handler test or file is deletion-ready. Keep using these docs as guardrails before any close/result finalization proposal. |
| Propose close/result finalization boundary | Done in Phase 4.40. `docs/architecture/v2-close-result-finalization-proposal.md` maps the retained close tail and recommends keeping it in `runner.ts` for now. | Review before moving close/result finalization, terminal verdict derivation, retained close progress, or final snapshot behavior. |
| Move pure terminal verdict derivation | Done in Phase 4.41. `src/runtime/terminal-verdict.ts` owns latest admitted result verdict derivation for retained close/result finalization. | Keep close/result finalization, close progress, final snapshot derivation, and `executeCompiledFlow(...)` in `runner.ts`. |
| Formalize retained runtime boundary and start selector soak | Done in Phase 4.42. `docs/architecture/v2-retained-runtime-boundary.md` records checkpoint resume as intentionally retained-runtime-owned, and `docs/architecture/v2-selector-soak-checklist.md` tracks selector soak evidence. | Default selector for matrix-supported fresh-run modes is complete. This does not approve old runtime deletion, checkpoint resume v2 routing, or risky infrastructure movement. |
| Add automated selector soak gate | Done in Phase 5.0. `tests/soak/v2-runtime-surface.test.ts` and `npm run soak:v2` prove the current selector boundary across supported fresh runs, retained fallbacks, strict opt-in, rollback, status, progress, connector safety, child runs, fanout, and manifest/result consistency. | The default-selector milestone is complete for matrix-supported fresh-run modes. This does not approve checkpoint resume v2 routing or old runtime deletion. |
| Plan v2 checkpoint resume parity | Done in Phase 5.1. `docs/architecture/v2-checkpoint-resume-parity-plan.md` defines v2 checkpoint pause/resume for new core-v2 checkpoint folders only, with retained checkpoint folders continuing through retained resume. | Review before implementing Phase 5.2. Do not route public checkpoint modes through v2 or delete retained checkpoint files until fixture-level pause/resume is proven. |
| Implement fixture-level v2 checkpoint pause/resume | Done in Phase 5.2 for dedicated fixture-level core-v2 checkpoint folders. `src/core-v2/run/checkpoint-resume.ts` owns v2 resume for marked v2 folders, and `src/run-status/v2-run-folder.ts` projects v2 waiting checkpoints. | Retained/v1 checkpoint folders still use retained resume, and no retained runtime deletion is approved. |
| Harden v2 checkpoint resume validation | Done in Phase 5.2 preflight. Resume and status now validate traced checkpoint request paths against the saved flow's declared request path, and both resume/status validate trace/request choice consistency against the saved flow. | Request focused review before Build-deep candidate smoke. This hardening does not approve default routing for checkpoint modes or deletion of retained checkpoint infrastructure. |
| Smoke Build deep as a v2 checkpoint candidate | Done in Phase 5.2.1. Build deep can pause/resume through core-v2 under `CIRCUIT_V2_RUNTIME_CANDIDATE=1` or `CIRCUIT_V2_RUNTIME=1`. | Candidate smoke approved the focused default-routing decision. No retained checkpoint infrastructure is deletion-ready. |
| Route Build deep through core-v2 by default | Done in Phase 5.3. Build deep is now in the default v2 support matrix and proves checkpoint wait, `runs show`, progress, resume by saved engine marker, result writing, Build result parsing, and final status without v2 env vars. | Build tournament and other unproven checkpoint/tournament modes remain retained. Rollback keeps Build deep on retained runtime. Old retained/v1 checkpoint folders still resume retained. |
| Route Build autonomous through core-v2 by default | Done after the full-parity gameplan review. Build autonomous is now in the default v2 support matrix and proves safe-autonomous checkpoint auto-resolution, no operator prompt progress, `runs show`, result writing, Build result parsing, and rollback. | This was not selector widening for other autonomous modes. Fix/Migrate/Sweep/Explore autonomous and Explore tournament now have their own proof. Arbitrary roots, rollback, and retained/v1 checkpoint folders still need their own retained-compatibility plan. |
| Route Fix default through core-v2 by default | Done after Build autonomous. Fix default is now in the default v2 support matrix and is covered by parity, CLI selector, soak, and rollback tests. | Fix deep remained retained until its own checkpoint/deep proof exists. |
| Move release Fix proof off public `composeWriter` | Done after Fix default. `scripts/release/capture-golden-run-proofs.mjs` now uses internal v2 compose executor injection for its deterministic Fix brief and no longer imports `dist/runtime/runner.js`. | Public `composeWriter` remains retained-runtime-only compatibility; this is not an API retirement or old runtime deletion. |
| Route Fix autonomous through core-v2 by default | Done after release-proof cleanup. Fix autonomous is now in the default v2 support matrix and is covered by parity, CLI selector, safe-autonomous no-repro checkpoint, soak, and rollback tests. | Fix deep remains retained until mode-specific checkpoint/deep proof exists. |
| Route Fix deep through core-v2 by default | Done after Sweep deep. Fix deep is now in the default v2 support matrix and is covered by parity, CLI selector, forced no-repro checkpoint wait/resume, soak, and rollback tests. | Migrate deep, Explore non-tournament modes, and Explore tournament now have their own proof. |
| Route Sweep autonomous through core-v2 by default | Done after Fix autonomous. Sweep autonomous is now in the default v2 support matrix and is covered by parity, CLI selector, safe-autonomous triage checkpoint, soak, and rollback tests. | Sweep lite/deep remain retained until mode-specific proof exists. |
| Route Migrate autonomous through core-v2 by default | Done after Sweep autonomous. Migrate autonomous is now in the default v2 support matrix and is covered by parity, CLI selector, safe-autonomous coexistence checkpoint, Build child-run, soak, and rollback tests. | Migrate deep remains retained until mode-specific checkpoint/deep proof exists. |
| Route Migrate deep through core-v2 by default | Done after Fix deep. Migrate deep is now in the default v2 support matrix and is covered by CLI selector checkpoint wait/resume, Build child-run, soak, and rollback tests. | Explore non-tournament modes and Explore tournament now have their own proof. |
| Route Explore lite/deep/autonomous through core-v2 by default | Done after Migrate deep. These modes share the non-tournament Explore compose/relay graph and are covered by parity, CLI selector, diagnostics, soak, and rollback tests. | Explore tournament was handled later because it combines fanout and tournament checkpoint UX. |
| Route Sweep lite through core-v2 by default | Done after Migrate autonomous. Sweep lite is now in the default v2 support matrix and is covered by parity, CLI selector, safe-default triage checkpoint, soak, and rollback tests. | Sweep deep remains retained until checkpoint wait/resume proof exists. |
| Route Sweep deep through core-v2 by default | Done after Sweep lite. Sweep deep is now in the default v2 support matrix and is covered by CLI selector checkpoint wait/resume, soak, and rollback tests. | Fix deep, Migrate deep, and Explore tournament now have their own mode-specific proof. |
| Formalize retained checkpoint-folder and fallback policy | Done in Phase 5.4. `docs/architecture/v2-retained-checkpoint-folder-policy.md` keeps retained/v1 checkpoint folders on retained resume, and `docs/architecture/v2-retained-fallback-policy.md` classifies unsupported modes, arbitrary fixtures, `composeWriter`, rollback, and old tests. | This is policy documentation, not deletion approval. Build has no current tournament entry mode; if introduced later, it needs its own proof. |
| Produce deletion-readiness inventory | Done in Phase 5.5. `docs/architecture/v2-deletion-readiness-inventory.md` classifies every `src/runtime` file and retained runner/handler test. | No old runtime file or retained runner/handler test is deletion-ready. Use this inventory before proposing any deletion or policy change. |
| Prepare fallback API disposition review | Done in Phase 5.6. `docs/architecture/v2-fallback-api-disposition-review.md` frames arbitrary fixtures, `composeWriter`, rollback, unsupported public modes, and candidate diagnostics as the next compatibility decisions. | Stop for external review before changing any of those behaviors or starting deletion work. |
| Decide composeWriter API disposition | Done in Phase 5.7. `docs/architecture/v2-compose-writer-disposition.md` classifies current consumers and keeps `composeWriter` as retained-runtime-only compatibility. | Do not clone the old compose writer hook into core-v2. Internal v2 customization should use executor injection or generated reports. |
| Decide candidate diagnostics disposition | Done in Phase 5.8. `docs/architecture/v2-candidate-diagnostics-disposition.md` keeps `CIRCUIT_V2_RUNTIME_CANDIDATE=1` temporarily as runtime decision output and recommends a later rename. | Do not rename or remove the env var in this slice. A follow-up should decide alias/removal behavior. |
| Add runtime decision diagnostics alias | Done in Phase 5.8.1. `CIRCUIT_SHOW_RUNTIME_DECISION=1` is now the preferred flag, and `CIRCUIT_V2_RUNTIME_CANDIDATE=1` remains a temporary alias. | Diagnostics report the actual selected runtime reason. Rollback wins the reason when rollback selects retained runtime; strict v2 still wins over rollback. |
| Decide arbitrary fixture policy | Done in Phase 5.9. `docs/architecture/v2-arbitrary-fixture-policy.md` keeps arbitrary explicit fixtures, custom flow roots, and packaged host flow roots retained by default. Generated fixtures under `generated/flows/**` keep following the selector matrix. | A future trusted-generated-mirror change would need focused selector policy and tests. |
| Trust installed plugin generated mirror | Done in Phase 5.10. The Codex plugin wrapper sets `CIRCUIT_GENERATED_FLOW_MIRROR_ROOT` only when it injects its packaged flow root, and the CLI lets that root follow the selector matrix only when the marker matches. | Arbitrary external roots and custom flow roots remain retained by default. No old runtime deletion. |
| Route Explore tournament through core-v2 by default | Done in Phase 5.11. Explore tournament now has production relay fanout branch validation, tournament checkpoint wait/resume, enriched progress/status, CLI/soak proof, and rollback coverage. | This removes the last known generated public entry-mode gap in the current catalog. It does not approve old runtime deletion. |
| Introduce retained compatibility facade | Done in Phase 5.14. `src/compat/retained-runtime.ts` now owns the CLI/status/handoff boundary to retained fresh-run fallback, retained/v1 checkpoint resume, retained snapshot derivation, retained trace reading, and retained trace reduction. | This narrows dependencies but does not make the retained implementations deletion-ready. |
| Soft-deprecate low-risk old helper paths | Done in Phase 5.58. `src/compat/public-runtime-paths.ts` now marks shared-helper and flow-authoring wrappers as `soft-deprecated`, and `docs/architecture/v2-public-runtime-import-path-policy.md` records replacement owners and draft release-note wording. | This is metadata only. Keep wrappers, compatibility tests, package exports, and no-warning behavior unchanged until another review approves retirement. |

Avoid mixing these moves with old runner or handler deletion. A move slice should
prove that imports and behavior remain identical before any deletion proposal.

## 9. Deletion Readiness Criteria

Request a heavy deletion review only after the team decides which of these
paths should change:

1. checkpoint resume is implemented in v2, or explicitly retained behind the
   retained runtime boundary;
2. unsupported flow/mode/depth combinations are either proven in v2 or
   intentionally retained;
3. arbitrary fixture behavior is either v2-owned, retained by policy, or
   deprecated with a migration path;
4. `composeWriter` remains retained by policy, is moved behind a smaller
   compatibility module, or is retired by explicit product decision;
5. remaining retained-runtime-only types in `runner-types.ts` are moved or the
   file is explicitly retained as a compatibility module;
6. connector, registry, router, compiler, and projection helpers are moved to
   neutral modules or explicitly kept;
7. old runner/handler oracle tests are migrated, narrowed, or retained for the
   remaining old path.

Until then, the correct state is coexistence:

```text
core-v2 for matrix-supported fresh runs
retained runtime for everything not yet v2-owned
```

## 10. Next Heavy Review Scope

The next heavy review should not ask whether the default selector works in
general. That gate has been passed.

The Phase 5.6 external review decided retained fallback API posture. Phase 5.7
applies the first narrow decision for `composeWriter`.

Remaining fallback review questions:

```text
Should rollback become a permanent operator safety feature?
When should the old `CIRCUIT_V2_RUNTIME_CANDIDATE` diagnostics alias be removed?
```

Deletion review should later still ask:

```text
Which retained runtime responsibilities are still product-owned, and which old
execution files can be deleted, moved, or narrowed without losing fallback,
resume, fixture, programmatic hook, connector, registry, status, or test
coverage?
```

Old runtime deletion remains explicitly out of scope until that review approves
a narrow deletion slice.
