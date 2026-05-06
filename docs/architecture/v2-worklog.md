# Circuit v2 Worklog

## 2026-05-02 - Phase 0

Goal: audit current runtime strictness, classify what v2 should keep or
simplify, and produce the Checkpoint 1 architecture packet without changing
runtime behavior.

Files inspected:

- `package.json`
- `package-lock.json`
- `AGENTS.md`
- `UBIQUITOUS_LANGUAGE.md`
- `docs/generated-surfaces.md`
- `docs/contracts/`
- `src/runtime/`
- `src/runtime/connectors/`
- `src/runtime/step-handlers/`
- `src/cli/`
- `src/schemas/`
- `src/flows/`
- `specs/behavioral/`
- `specs/invariants.json`
- `specs/reports.json`
- `tests/`
- `commands/`
- `.claude-plugin/`
- `plugins/circuit/`
- `generated/flows/`
- `scripts/emit-flows.mjs`

Files changed:

- `docs/architecture/v2-principles.md`
- `docs/architecture/v2-rigor-audit.md`
- `docs/architecture/v2-migration-plan.md`
- `docs/architecture/v2-checkpoint-1.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: failed only on
  `tests/contracts/terminology-active-surface.test.ts`, because the required
  Phase 0 architecture docs use currently banned terms and the required file
  name `v2-rigor-audit.md`.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.

Behavior changed? No.

Concerns:

- The Phase 0 deliverable names and required language include terms currently
  banned by the active terminology test. This needs a review decision rather
  than a silent test weakening.
- Several specs still refer to `docs/contracts/compiled-flow.md`; the current contract
  file is `docs/contracts/compiled-flow.md`.
- Fanout behavior is load-bearing but currently spread across a large handler
  plus helpers. v2 should preserve behavior while splitting ownership.
- Build checkpoint behavior is product-relevant, but some policy shape still
  lives in generic schema/runtime surfaces.

Next recommended action: review Checkpoint 1, decide how to handle
architecture-transition terminology, then approve or revise the Phase 1 runtime
substrate spike.

## 2026-05-02 - Phase 0.5

Goal: apply the conditional Checkpoint 1 correction before Phase 1.

Files inspected:

- `tests/contracts/terminology-active-surface.test.ts`
- `docs/architecture/v2-principles.md`
- `docs/architecture/v2-rigor-audit.md`
- `docs/architecture/v2-migration-plan.md`
- `docs/architecture/v2-checkpoint-1.md`

Files changed:

- `tests/contracts/terminology-active-surface.test.ts`
- `docs/architecture/v2-principles.md`
- `docs/architecture/v2-rigor-audit.md`
- `docs/architecture/v2-migration-plan.md`
- `docs/architecture/v2-checkpoint-1.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.
- `npm run verify`: passed.

Behavior changed? No runtime behavior changed.

Concerns: the active terminology exception is intentionally narrow:
`docs/architecture/v2-*` only. Source code, tests other than the existing
terminology test self-exemption, commands, generated outputs, and
product-facing prose remain checked.

Next recommended action: if validation is green, start Phase 1 with a plain
TypeScript baseline and no global Effect adoption.

## 2026-05-02 - Phase 1

Goal: build a minimal v2 runtime substrate beside the existing runtime using a
plain TypeScript baseline.

Files inspected:

- `tsconfig.json`
- `tsconfig.build.json`
- representative test files under `tests/`
- Phase 0 and Phase 0.5 architecture docs

Files changed:

- `src/core-v2/domain/flow.ts`
- `src/core-v2/domain/step.ts`
- `src/core-v2/domain/route.ts`
- `src/core-v2/domain/report.ts`
- `src/core-v2/domain/run-file.ts`
- `src/core-v2/domain/run.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/domain/connector.ts`
- `src/core-v2/domain/selection.ts`
- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/trace/trace-store.ts`
- `src/core-v2/run-files/paths.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/executors/index.ts`
- `src/core-v2/executors/compose.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/projections/status.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-checkpoint-2.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2/core-v2-baseline.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on formatting/import order.
- `npx biome check --write src/core-v2 tests/core-v2`: passed and fixed the
  new files.
- `npm run lint`: passed after formatting.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run test`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. v2 exists only as new
opt-in source and tests.

Concerns:

- Checkpoint-like pause is deferred until v1 checkpoint semantics can be
  adapted instead of guessed.
- Non-baseline step kinds fail closed in the executor registry.
- Phase 2 must keep v1 quirks explicit when adapting compiled flows.

Next recommended action: after Checkpoint 2 review, start Phase 2 with the
compiled-flow to executable-manifest adapter.

## 2026-05-02 - Phase 1.5

Goal: fix early v2 contract drift before Phase 2.

Files inspected:

- `src/schemas/compiled-flow.ts`
- `src/schemas/trace-entry.ts`
- `src/runtime/result-writer.ts`
- `src/core-v2/`
- `tests/core-v2/core-v2-baseline.test.ts`

Files changed:

- `src/core-v2/domain/route.ts`
- `src/core-v2/domain/run.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/trace/trace-store.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/projections/status.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-checkpoint-2.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: initially failed on one formatting issue in the updated
  core-v2 test file.
- `npx biome check --write tests/core-v2/core-v2-baseline.test.ts`: passed and
  fixed the formatting issue.
- `npm run check`: passed after formatting.
- `npm run lint`: passed after formatting.
- `npm run build`: passed.
- `npx vitest run tests/core-v2/core-v2-baseline.test.ts`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.

Behavior changed? No production behavior changed. The v2 baseline now aligns
its terminal targets, run close outcomes, trace names, trace field names, and
result path with current runtime contracts.

Concerns:

- v2 still has only baseline executors. Verification, checkpoint, sub-run, and
  fanout remain intentionally unsupported in execution.
- Manifest validation is still a Phase 1 baseline. Phase 2 should add or plan
  terminal reachability, dead-step detection, stage membership consistency, and
  checkpoint choice validation.

Next recommended action: after validation and review, start Phase 2 with the
compiled-flow to executable-manifest adapter.

## 2026-05-02 - Phase 2

Goal: build the `CompiledFlow` v1 to `ExecutableFlowV2` adapter without
changing flow authoring, generated manifests, production CLI behavior, or old
runtime code.

Files inspected:

- `src/schemas/compiled-flow.ts`
- `src/schemas/step.ts`
- `src/schemas/stage.ts`
- `src/schemas/selection-policy.ts`
- representative generated flows under `generated/flows/`
- current `src/core-v2/` manifest, domain, and validation files

Files changed:

- `src/core-v2/domain/flow.ts`
- `src/core-v2/domain/selection.ts`
- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`
- `docs/architecture/v2-phase-2-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2/from-compiled-flow-v1.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on formatting/import order in new files.
- `npx biome check --write src/core-v2 tests/core-v2`: passed and fixed the
  new files.
- `npm run check`: passed after formatting.
- `npm run lint`: passed after formatting.
- `npx vitest run tests/core-v2`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run test`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. Phase 2 adds adapter parity
tests only.

Concerns:

- v2 manifest validation now covers adapter-level structural safety, but not
  full graph liveness.
- v2 still represents unsupported step kinds without executing them.
- Checkpoint choices and route names are intentionally separate because v1 uses
  both concepts differently.

Next recommended action: after review, begin simple-flow v2 execution parity
only when the unsupported executor boundaries are explicitly planned.

## 2026-05-02 - Phase 2.5

Goal: correct v2 stage membership before simple-flow parity.

Files inspected:

- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/runtime/selection-resolver.ts`
- `src/schemas/compiled-flow.ts`
- `src/schemas/selection-policy.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`

Files changed:

- `src/core-v2/manifest/executable-flow.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`
- `docs/architecture/v2-phase-2-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.

Behavior changed? No production behavior changed. The v2 manifest shape now
preserves overlapping stage membership for future selection parity.

Concerns:

- Exact v1 trace and result schemas are still deferred to execution parity.
- v2 still represents unsupported step kinds without executing them.

Next recommended action: after review, begin Phase 3 simple-flow parity.

## 2026-05-02 - Phase 2 adversarial review fixes

Goal: address all adversarial review findings before Phase 3.

Files inspected:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/run-files/paths.ts`
- `src/core-v2/domain/selection.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`
- `src/runtime/runner.ts`
- `src/schemas/scalars.ts`

Files changed:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/manifest/from-compiled-flow-v1.ts`
- `src/core-v2/manifest/validate-executable-flow.ts`
- `src/core-v2/run-files/paths.ts`
- `src/core-v2/domain/selection.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/from-compiled-flow-v1.test.ts`
- `docs/architecture/v2-phase-2-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2`: initially failed because the new synthetic
  adapter test referenced a non-existent review step; corrected the fixture.
- `npx vitest run tests/core-v2`: passed after correction.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. The v2-only baseline now
matches v1 default-entry behavior more closely, keeps trace lifecycle cleaner
on undeclared routes, validates run-file paths before execution, and preserves
v1 selection field names at the adapter boundary.

Concerns:

- v2 result and trace schemas are still intentionally minimal.
- Verification, checkpoint, sub-run, and fanout execution remain unsupported.

Next recommended action: after validation and review, begin Phase 3 simple-flow
parity.

## 2026-05-02 - Phase 3

Goal: prove simple-flow v2 execution parity for review, fix, and build using
the v1 compiled-flow adapter.

Files inspected:

- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/result-writer.ts`
- `src/runtime/step-handlers/`
- `src/schemas/compiled-flow.ts`
- `src/schemas/result.ts`
- `src/schemas/trace-entry.ts`
- `src/schemas/verification.ts`
- `src/flows/review/reports.ts`
- `src/flows/fix/reports.ts`
- `src/flows/build/reports.ts`
- `generated/flows/review/circuit.json`
- `generated/flows/fix/circuit.json`
- `generated/flows/build/circuit.json`
- `tests/runner/review-runtime-wiring.test.ts`
- `tests/runner/fix-runtime-wiring.test.ts`
- `tests/runner/build-runtime-wiring.test.ts`
- existing `src/core-v2/` files

Files changed:

- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`
- `docs/architecture/v2-checkpoint-3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: initially failed on one TypeScript branded id mismatch in
  the new parity helper.
- `npm run check`: passed after correction.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run lint`: initially failed on formatting/import order in new Phase 3
  files.
- `npx biome check --write src/core-v2/run/compiled-flow-runner.ts tests/parity`:
  passed and fixed the new files.
- `npm run check`: passed after formatting.
- `npx vitest run tests/core-v2 tests/parity`: passed after formatting.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. Phase 3 adds an opt-in v2
compiled-flow execution path and tests it against generated review, fix, and
build flows. The production CLI remains on the old runtime.

Concerns:

- v2 trace entries still use a minimal schema.
- v2 result shape is closer to v1 but not the complete current result schema.
- Phase 3 test executors support verification and checkpoint only inside tests.
- Production v2 execution still does not support sub-run, fanout, connector
  subprocess behavior, checkpoint resume, or worktree behavior.

Next recommended action: stop at Checkpoint 3 for review. If approved, begin
Phase 4 complex-flow parity.

## 2026-05-02 - Phase 3 adversarial review fixes

Goal: address adversarial review findings before Phase 4.

Files inspected:

- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/schemas/result.ts`
- `src/schemas/manifest.ts`
- `src/runtime/runner.ts`
- `tests/parity/`

Files changed:

- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`
- `docs/architecture/v2-checkpoint-3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npx vitest run tests/core-v2 tests/parity`: initially failed because parity
  run ids were not UUIDs for `RunResult` parsing and one nested matcher was too
  strict.
- `npx vitest run tests/core-v2 tests/parity`: passed after correction.
- `npm run lint`: initially failed on formatting in the route guard and parity
  helper.
- `npx biome check --write src/core-v2/run/graph-runner.ts tests/parity/core-v2-parity-helpers.ts tests/parity/fix-v2.test.ts tests/parity/build-v2.test.ts tests/parity/review-v2.test.ts`:
  passed and fixed formatting.

Behavior changed? No production behavior changed. The v2-only path now writes
result files that parse with the current `RunResult` schema, computes manifest
hashes from raw compiled-flow bytes, and aborts route re-entry before recording
misleading completion.

Concerns:

- The v2 trace shape is still minimal.
- Full recovery-route attempt semantics are still old-runtime behavior; v2 now
  fails closed on re-entry until that behavior is intentionally migrated.

Next recommended action: run full validation again, then stop for Phase 4
review approval.

## 2026-05-02 - Phase 3.5

Goal: correct Phase 3 recovery-route, compiled-flow input, and selected
entry/depth behavior before Phase 4.

Files inspected:

- `src/runtime/runner.ts`
- `src/schemas/step.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/domain/trace.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`

Files changed:

- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/parity/build-v2.test.ts`
- `docs/architecture/v2-checkpoint-3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on import ordering, then passed after
  correction.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed after import ordering.
- `npm run test:fast`: passed, 57 test files and 811 tests.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed, including 110 test files, 1231 tests passed, and
  6 skipped.

Behavior changed? No production behavior changed. The opt-in v2 path now allows
bounded `retry` and `revise` recovery re-entry, binds compiled-flow execution
to raw manifest bytes, and records selected entry mode/depth in bootstrap
trace data.

Concerns:

- v2 trace entries still do not claim full v1 trace schema parity.
- Manifest snapshot writing remains a Phase 4 prerequisite before sub-run and
  resume parity.
- Production v2 execution still does not support connector subprocess,
  checkpoint resume, sub-run, fanout, or worktree behavior.

Next recommended action: stop for review. If approved, start Phase 4 with
manifest snapshot support before sub-run and fanout parity.

## 2026-05-02 - Phase 4 Preflight and Manifest Snapshot Slice

Goal: apply the approved Phase 4 preflight recovery cleanup, then start Phase
4 with raw-byte manifest snapshot support before sub-run or fanout work.

Files inspected:

- `src/runtime/runner.ts`
- `src/runtime/manifest-snapshot-writer.ts`
- `src/schemas/manifest.ts`
- `src/schemas/run.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/review-v2.test.ts`
- `tests/parity/fix-v2.test.ts`

Files changed:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/review-v2.test.ts`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run check`: passed.
- `npm run lint`: initially failed on import ordering in
  `tests/parity/review-v2.test.ts`, then passed after correction.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. The opt-in v2 compiled-flow
path now writes `manifest.snapshot.json` from raw compiled-flow bytes and binds
that snapshot hash to `run.bootstrapped` and `reports/result.json`.

Concerns:

- Manifest snapshot writing is implemented for the v2 compiled-flow path only.
- Sub-run, fanout, connector safety, checkpoint resume, and worktree parity are
  still pending.
- v2 trace schema convergence remains incremental.

Next recommended action: continue Phase 4 with sub-run parity before fanout.

## 2026-05-05 - Phase 5.11 Explore Tournament Default Routing

Goal: move Explore tournament from retained fallback to core-v2 default routing
after the external review identified the real blocker: v2 relay fanout branches
needed production relay prompt and validation parity before selector widening.

Files inspected:

- `src/core-v2/executors/relay.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/core-v2/projections/progress.ts`
- `src/run-status/v2-run-folder.ts`
- `generated/flows/explore/tournament.json`
- `tests/runner/explore-tournament-runtime.test.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/projections/tournament-checkpoint-context.ts`
- `src/run-status/v2-run-folder.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-checkpoint-5.11.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes. `circuit-next run explore --mode tournament` now follows
the core-v2 selector matrix by default for generated flows.

What changed:

- v2 relay fanout branches now use production relay prompts and public
  `relayer` injection when running from compiled generated flows.
- branch admission now checks parse/schema, branch provenance, and cross-report
  validators before writing admitted reports.
- Explore tournament progress and `runs show` now use dynamic option labels from
  `decision-options.json` and the tradeoff question from
  `tournament-review.json`.
- Explore tournament CLI and soak tests now prove wait/resume through core-v2.
- Rollback still routes Explore tournament to the retained runtime.

Tests run so far:

- `npx vitest run tests/parity/explore-v2.test.ts tests/core-v2/fanout-v2.test.ts`:
  passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts tests/parity/explore-v2.test.ts tests/core-v2/fanout-v2.test.ts`:
  passed.
- `npm run check`: passed.

Concerns:

- Old runtime deletion is still blocked. This slice removes a public generated
  entry-mode gap, but retained runtime still owns arbitrary fixtures, custom
  flow roots, rollback, retained/v1 checkpoint folders, public `composeWriter`,
  release proof `composeWriter`, old oracle tests, connectors/materializer, and
  registries/router/catalog/compiler infrastructure.

Next recommended action: run full validation, prepare a narrow
post-implementation review packet for Explore tournament, then choose the next
implementation blocker. The strongest next candidates are release proof
`composeWriter` removal or retained/v1 checkpoint folder strategy. Do not start
old runtime deletion.

## 2026-05-05 - Phase 5.12 Retained Checkpoint Folder Compatibility Proof

Goal: prove retained/v1 checkpoint folders still use retained
resume/status/handoff behavior after the generated-flow selector moved to
core-v2 by default.

Files inspected:

- `src/cli/circuit.ts`
- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `src/run-status/v2-run-folder.ts`
- `src/cli/handoff.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/core-v2/checkpoint-resume-v2.test.ts`
- `tests/runner/run-status-projection.test.ts`
- `tests/runner/utility-cli.test.ts`

Files changed:

- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/runner/utility-cli.test.ts`
- `docs/architecture/v2-checkpoint-5.12.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No production behavior changed. This is a compatibility proof
slice.

What changed:

- Added proof that an actual retained waiting checkpoint folder projects through
  `runs show` with resume actions.
- Added proof that the same retained folder resumes through retained
  compatibility when rollback and runtime diagnostics are enabled.
- Added proof that handoff save does not use the marker-gated v2 run-status
  fallback for a corrupted unmarked retained folder.

Tests run so far:

- `npm run check`: passed.
- `npm run lint`: passed after replacing `delete process.env...` with the
  existing undefined-assignment restore style.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/utility-cli.test.ts tests/core-v2/checkpoint-resume-v2.test.ts tests/runner/run-status-projection.test.ts`:
  passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Concerns:

- This proves retained checkpoint compatibility remains intact; it does not make
  retained checkpoint internals deletion-ready.

Next recommended action: stop for a consolidated compatibility review before
changing remaining retained surfaces. Release proof has already moved off public
`composeWriter`; the remaining blockers are public or architectural. Do not
start old runtime deletion.

## 2026-05-06 - Phase 5.13 Registry And Catalog Neutral Ownership

Goal: move shared flow registry and catalog derivation ownership out of
`src/runtime/**` without changing behavior.

Files inspected:

- `docs/architecture/v2-registry-ownership-plan.md`
- `src/runtime/catalog-derivations.ts`
- `src/runtime/registries/**`
- `src/flows/types.ts`
- `src/core-v2/**`
- `src/shared/relay-support.ts`
- `tests/contracts/catalog-completeness.test.ts`
- `tests/contracts/engine-flow-boundary.test.ts`
- `tests/runner/catalog-derivations.test.ts`

Files changed:

- `src/flows/catalog-derivations.ts`
- `src/flows/registries/**`
- `src/runtime/catalog-derivations.ts`
- `src/runtime/registries/**`
- `src/flows/**`
- `src/core-v2/**`
- `src/shared/relay-support.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/contracts/catalog-completeness.test.ts`
- `tests/runner/catalog-derivations.test.ts`
- `docs/architecture/v2-checkpoint-5.13.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-registry-ownership-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No production behavior changed. Registry and catalog
derivation implementations now live under `src/flows/**`; old `src/runtime/**`
paths are compatibility re-exports.

Tests run so far:

- `npm run check`: passed.
- `npx vitest run tests/runner/catalog-derivations.test.ts tests/contracts/catalog-completeness.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/close-builder-registry.test.ts tests/runner/relay-shape-hint-registry.test.ts tests/runner/cross-report-validators.test.ts tests/properties/visible/cross-report-validator.test.ts tests/contracts/explore-report-composition.test.ts`:
  passed.
- `npx vitest run tests/contracts/engine-flow-boundary.test.ts`: passed after
  teaching the boundary guard that `src/flows/catalog-derivations.ts` and
  `src/flows/registries/**` are shared flow infrastructure.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run check-flow-drift`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/soak/v2-runtime-surface.test.ts`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Concerns:

- This narrows the runtime namespace, but old runtime deletion is still blocked
  by retained execution, arbitrary/custom roots, rollback, `composeWriter`,
  retained/v1 folders, connector/materializer ownership, router/compiler
  ownership, and old oracle tests.

Next recommended action: introduce a narrow retained-compatibility facade for
retained fresh-run fallback, retained/v1 checkpoint resume, rollback fallback,
and public `composeWriter`, without changing behavior.

## 2026-05-06 - Phase 5.14 Retained Compatibility Facade

Goal: put the retained execution and v1 run-folder boundary behind one neutral
facade without changing behavior.

Files inspected:

- `src/cli/circuit.ts`
- `src/cli/handoff.ts`
- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `src/runtime/runner.ts`
- `src/runtime/snapshot-writer.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/reducer.ts`
- `tests/runner/run-status-facade.test.ts`

Files changed:

- `src/compat/retained-runtime.ts`
- `src/cli/circuit.ts`
- `src/cli/handoff.ts`
- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-checkpoint-5.14.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-retained-runtime-boundary.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No production behavior changed. The CLI, handoff, and
run-status code now use `src/compat/retained-runtime.ts` for retained fresh-run
fallback, retained/v1 checkpoint resume, retained snapshot derivation, retained
trace reading, and retained trace reduction.

Tests run so far:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts`:
  passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/utility-cli.test.ts tests/runner/run-status-projection.test.ts`:
  passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/soak/v2-runtime-surface.test.ts`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Concerns:

- This narrows the boundary, but old runtime deletion is still blocked by
  arbitrary/custom roots, rollback, public `composeWriter`, retained/v1 folders,
  old oracle tests, connector/materializer ownership, router/compiler ownership,
  and retained internals.

Next recommended action: decide whether to review public compatibility behavior
next (`composeWriter`, rollback, arbitrary fixtures, custom roots) or first map
old runner/handler oracle tests into v2/shared/compat/obsolete buckets without
changing behavior.

## 2026-05-06 - Phase 5.15 Oracle Test Import Boundary First Batch

Goal: begin the old runner/handler oracle-test mapping lane without changing
public behavior.

Files inspected:

- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/cli-router.test.ts`
- `tests/runner/config-loader.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- old runner and connector-adjacent test imports
- `src/shared/connector-relay.ts`
- `src/shared/relay-runtime-types.ts`

Files changed:

- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/cli-router.test.ts`
- `tests/runner/config-loader.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- runner/contract tests with type-only `RelayResult` imports
- retained runner and direct handler tests with type-only retained runner imports
- `docs/architecture/v2-checkpoint-5.15.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No production behavior changed. Tests that only needed shared
relay data types or the shared `sha256Hex` helper now import from shared/facade
modules instead of old runtime compatibility paths. Tests that intentionally
execute the retained runner still use retained runner imports.

Second batch update: more retained runner and direct handler tests now split
value-level retained execution imports from type-only imports. Remaining
`src/runtime/runner.ts` test imports are retained execution/helper calls, while
`RelayFn`, `RelayInput`, child runner, and worktree callback types come from
`src/shared/**` or `src/compat/retained-runtime.ts`.

Tests run so far:

- `npm run check`: passed.
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts tests/runner/config-loader.test.ts tests/contracts/codex-host-plugin.test.ts tests/runner/cli-router.test.ts`:
  passed.
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/build-checkpoint-exec.test.ts tests/runner/codex-connector-smoke.test.ts tests/runner/agent-relay-roundtrip.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/connector-shared-compat.test.ts`:
  passed.
- `npx vitest run tests/runner/terminal-outcome-mapping.test.ts tests/runner/fanout-runtime.test.ts tests/runner/fix-runtime-wiring.test.ts tests/runner/explore-tournament-runtime.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/runner/build-checkpoint-exec.test.ts tests/runner/fanout-real-recursion.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fresh-run-root.test.ts tests/runner/sub-run-real-recursion.test.ts tests/runner/build-report-writer.test.ts tests/runner/runtime-smoke.test.ts tests/runner/explore-report-writer.test.ts tests/runner/build-runtime-wiring.test.ts tests/runner/runner-relay-connector-identity.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/pass-route-cycle-guard.test.ts tests/runner/check-evaluation.test.ts tests/runner/terminal-verdict-derivation.test.ts tests/runner/handler-throw-recovery.test.ts tests/runner/run-relative-path.test.ts tests/runner/push-sequence-authority.test.ts tests/runner/build-verification-exec.test.ts tests/runner/sweep-runtime-wiring.test.ts tests/runner/review-runtime-wiring.test.ts tests/runner/materializer-schema-parse.test.ts tests/contracts/flow-model-effort.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/relay-invocation-failure.test.ts tests/runner/sub-run-handler-direct.test.ts tests/runner/fanout-handler-direct.test.ts`:
  passed.
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Concerns:

- This is only the first mapping batch. Old runner and handler tests remain
  valid retained fallback and oracle proof.

Next recommended action: run full validation, then continue this lane by moving
remaining accidental type/helper imports to shared/facade paths and adding v2 or
shared twins for old oracle tests that are already v2-owned.

## 2026-05-06 - Phase 5.15 Control-Loop V2 Twin Batch

Goal: add implementation-backed v2 twin tests for old retained runner oracle
behavior that core-v2 already owns.

Files inspected:

- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/runner/pass-route-cycle-guard.test.ts`
- `tests/runner/check-evaluation.test.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/executors/relay.ts`
- `src/shared/relay-support.ts`

Files changed:

- `src/core-v2/executors/relay.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.15.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly inside core-v2 relay trace/result correctness.
`relay.completed` now records `data.admitted` for production relay attempts.
The v2 result writer already looks for admitted relay/sub-run verdicts; this
trace detail prevents rejected or malformed relay outputs from being mirrored
as the final run verdict.

Public selector policy, rollback, arbitrary fixtures, custom roots,
`composeWriter`, retained/v1 checkpoint folders, connector ownership, and old
runtime deletion did not change.

Tests run so far:

- `npx vitest run tests/core-v2/control-loop-v2.test.ts`: passed.
- `npm run check`: passed.
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/core-v2-baseline.test.ts tests/core-v2/default-executors-v2.test.ts tests/runner/check-evaluation.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/pass-route-cycle-guard.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Concerns:

- The new v2 twins reduce oracle risk, but retained tests are still live
  compatibility proof until retained fallback policy narrows.

Next recommended action: run full validation. If green, continue with another
small v2 twin batch around relay provenance/connector identity or route-cycle
details before touching public compatibility behavior.

## 2026-05-06 - Phase 5.15 Connector Provenance V2 Twin Batch

Goal: add v2 proof for retained relay connector identity/provenance oracles
without moving connector subprocess modules.

Files inspected:

- `tests/runner/runner-relay-provenance.test.ts`
- `tests/runner/runner-relay-connector-identity.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `src/core-v2/connectors/resolver.ts`
- `src/core-v2/executors/relay.ts`

Files changed:

- `src/core-v2/executors/relay.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.15.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly inside core-v2 relay evidence. Production v2
`relay.started` trace entries now include `data.resolved_from`, preserving the
connector resolution provenance that core-v2 already computed. Connector
subprocess ownership and connector execution behavior did not change.

Tests run so far:

- `npm run check`: passed.
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/runner-relay-connector-identity.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Concerns:

- This is v2 evidence parity, not connector ownership transfer. Connector
  subprocess modules and relay materializer still need a separate review before
  movement.

Next recommended action: run full validation. If green, continue with route
cycle detail twins or pause at the next public compatibility decision review.

## 2026-05-06 - Phase 5.15 Checkpoint Route V2 Twin Batch

Goal: add v2 proof for retained rich-route and retry-loop control-loop oracles
without changing checkpoint resume or public routing policy.

Files inspected:

- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/run/graph-runner.ts`

Files changed:

- `tests/core-v2/control-loop-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.15.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No production behavior changed in this batch. The tests cover
existing core-v2 graph-runner behavior.

Tests run so far:

- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/core-v2-baseline.test.ts tests/runner/terminal-outcome-mapping.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Concerns:

- These v2 twins do not retire retained checkpoint or terminal outcome tests.
  Retained tests remain live compatibility proof while old fallback paths remain
  supported.

Next recommended action: run full validation. If green, the next autonomous
batch should target direct v2 executor invariants only if they are clearly
already core-v2-owned; otherwise pause for the public compatibility review.

## 2026-05-06 - Phase 5.16 Relay Recovery And Report Gating V2 Twin Batch

Goal: add v2 proof for retained relay recovery, canonical report gating, and
connector invocation failure oracles without changing public compatibility
policy.

Files inspected:

- `tests/core-v2/control-loop-v2.test.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/v1-compat.ts`
- `tests/runner/check-evaluation.test.ts`
- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/runner/pass-route-cycle-guard.test.ts`
- `src/flows/registries/report-schemas.ts`

Files changed:

- `src/core-v2/executors/relay.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.16.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly inside core-v2 relay trace evidence.
`relay.completed.report_path` is now emitted only when the relay result was
admitted. The canonical report file was already gated this way; the trace now
matches the durable report evidence.

Tests run:

- `npm run check`: passed.
- `npx vitest run tests/core-v2/control-loop-v2.test.ts`: passed.
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/runner/verification-handler-direct.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/core-v2/core-v2-baseline.test.ts`:
  passed.
- `npx vitest run tests/runner/check-evaluation.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/pass-route-cycle-guard.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Concerns:

- These v2 twins do not retire retained relay/check-evaluation tests. Retained
  tests remain live fallback/oracle proof while public compatibility paths stay
  retained.

Next recommended action: run full validation. If green, continue only with
low-risk oracle twins/import cleanup. Pause for review before public
compatibility decisions or ownership movement.

## 2026-05-06 - Phase 5.17 Closed-Abort Result V2 Twin Batch

Goal: strengthen existing core-v2 safety tests so retained handler-throw and
pass-route-cycle oracles have v2 final-result twins.

Files inspected:

- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/runner/handler-throw-recovery.test.ts`
- `tests/runner/pass-route-cycle-guard.test.ts`
- `docs/architecture/v2-runner-handler-test-classification.md`

Files changed:

- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-checkpoint-5.17.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No production behavior changed. This batch adds result-file
assertions to existing v2 safety tests.

Tests run so far:

- `npx vitest run tests/core-v2/core-v2-baseline.test.ts tests/runner/handler-throw-recovery.test.ts tests/runner/pass-route-cycle-guard.test.ts`:
  passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Concerns:

- These v2 twins do not retire the retained tests. They reduce oracle risk while
  retained compatibility remains product policy.

Next recommended action: run full validation. If green, stop at the next public
compatibility or ownership boundary and prepare a review package.

## 2026-05-06 - Phase 5.18 Public Compatibility Policy Hardening

Goal: implement the approved public compatibility policy as a behavior-preserving
slice. Keep current defaults, centralize and clarify runtime reasons, strengthen
tests, and update user-facing text without deprecating or removing anything.

Files inspected:

- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/utility-cli.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/release/release-infrastructure.test.ts`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-arbitrary-fixture-policy.md`

Files changed:

- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/utility-cli.test.ts`
- `docs/architecture/v2-checkpoint-5.18.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No routing behavior changed. Public compatibility surfaces
remain retained by default: programmatic `composeWriter`, rollback, arbitrary
fixtures, custom roots, and retained/v1 checkpoint folders. The runtime reason
text now says `composeWriter` is retained compatibility and points v2
customization to executor injection or generated reports instead of implying a
future v2 `composeWriter` hook.

Tests run so far:

- `npm run check`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/runner/utility-cli.test.ts`:
  passed.
- `npx vitest run tests/soak/v2-runtime-surface.test.ts`: passed.
- `npx vitest run tests/contracts/codex-host-plugin.test.ts`: passed.
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts`:
  passed.
- `npx vitest run tests/release/release-infrastructure.test.ts`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Concerns:

- A new review package is required before any actual public compatibility
  behavior change, saved-folder policy change, ownership movement, or deletion.

Next recommended action: continue only with behavior-preserving import or
oracle-test cleanup unless a review packet is prepared.

## 2026-05-06 - Phase 5.19 Retained Execution Test Import Boundary

Goal: continue the old runner/handler oracle-test mapping lane by moving test
calls to retained execution through `src/compat/retained-runtime.ts`, without
changing retained behavior or old helper compatibility.

Files inspected:

- `docs/architecture/v2-runner-handler-test-classification.md`
- `src/compat/retained-runtime.ts`
- `src/runtime/runner-types.ts`
- `tests/runner/retained-compat-facade.test.ts`
- test files importing `runCompiledFlow` or `resumeCompiledFlowCheckpoint` from
  `src/runtime/runner.js`

Files changed:

- `tests/contracts/flow-model-effort.test.ts`
- `tests/contracts/orphan-blocks.test.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/runner/build-report-writer.test.ts`
- `tests/runner/build-runtime-wiring.test.ts`
- `tests/runner/build-verification-exec.test.ts`
- `tests/runner/check-evaluation.test.ts`
- `tests/runner/close-builder-registry.test.ts`
- `tests/runner/compose-builder-registry.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `tests/runner/explore-report-writer.test.ts`
- `tests/runner/explore-tournament-runtime.test.ts`
- `tests/runner/fanout-real-recursion.test.ts`
- `tests/runner/fanout-runtime.test.ts`
- `tests/runner/fix-runtime-wiring.test.ts`
- `tests/runner/fresh-run-root.test.ts`
- `tests/runner/handler-throw-recovery.test.ts`
- `tests/runner/materializer-schema-parse.test.ts`
- `tests/runner/migrate-runtime-wiring.test.ts`
- `tests/runner/pass-route-cycle-guard.test.ts`
- `tests/runner/push-sequence-authority.test.ts`
- `tests/runner/relay-invocation-failure.test.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/review-runtime-wiring.test.ts`
- `tests/runner/run-relative-path.test.ts`
- `tests/runner/runner-relay-connector-identity.test.ts`
- `tests/runner/runner-relay-provenance.test.ts`
- `tests/runner/runtime-smoke.test.ts`
- `tests/runner/sub-run-real-recursion.test.ts`
- `tests/runner/sub-run-runtime.test.ts`
- `tests/runner/sweep-runtime-wiring.test.ts`
- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/runner/terminal-verdict-derivation.test.ts`
- `docs/architecture/v2-checkpoint-5.19.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No. Test calls still execute the retained runtime, but now
they do it through the retained compatibility facade. Direct old runner imports
remain only for helper-specific compatibility/oracle surfaces.

Tests run so far:

- `npm run check`: passed.
- `npx vitest run tests/runner/runtime-smoke.test.ts tests/runner/run-relative-path.test.ts tests/runner/explore-report-writer.test.ts tests/runner/terminal-verdict-derivation.test.ts`:
  passed.
- `npx vitest run tests/runner/push-sequence-authority.test.ts tests/runner/relay-invocation-failure.test.ts tests/runner/runner-relay-connector-identity.test.ts tests/contracts/flow-model-effort.test.ts tests/runner/retained-compat-facade.test.ts`:
  passed.
- `npx vitest run tests/runner/build-verification-exec.test.ts tests/runner/check-evaluation.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/fanout-real-recursion.test.ts tests/runner/fanout-runtime.test.ts tests/runner/handler-throw-recovery.test.ts tests/runner/materializer-schema-parse.test.ts tests/runner/pass-route-cycle-guard.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/sub-run-real-recursion.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/retained-compat-facade.test.ts`:
  passed.
- `npx vitest run tests/runner/build-runtime-wiring.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/runner/review-runtime-wiring.test.ts tests/runner/sweep-runtime-wiring.test.ts`:
  passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/explore-tournament-runtime.test.ts tests/contracts/orphan-blocks.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/build-report-writer.test.ts tests/runner/close-builder-registry.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/fix-runtime-wiring.test.ts tests/runner/fresh-run-root.test.ts tests/runner/retained-compat-facade.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Concerns:

- Remaining direct old runner imports are still real compatibility/oracle helper
  surfaces, not deletion candidates.

Next recommended action: continue only with behavior-preserving import cleanup
or v2/shared oracle twins.

## 2026-05-06 - Phase 5.20 Retained Helper Facade Boundary

Goal: route remaining retained helper calls in tests through
`src/compat/retained-runtime.ts`, while keeping old public helper paths intact
and explicitly tested.

Files inspected:

- `src/compat/retained-runtime.ts`
- `src/runtime/runner.ts`
- `tests/runner/fix-report-writer.test.ts`
- test files importing retained helper values from `src/runtime/runner.js`

Files changed:

- `src/compat/retained-runtime.ts`
- `tests/contracts/orphan-blocks.test.ts`
- `tests/runner/agent-relay-roundtrip.test.ts`
- `tests/runner/build-report-writer.test.ts`
- `tests/runner/close-builder-registry.test.ts`
- `tests/runner/codex-relay-roundtrip.test.ts`
- `tests/runner/compose-builder-registry.test.ts`
- `tests/runner/fix-runtime-wiring.test.ts`
- `tests/runner/fresh-run-root.test.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/unit/runtime/event-log-round-trip.test.ts`
- `docs/architecture/v2-checkpoint-5.20.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No. The facade now exposes retained helper names, but those
helpers still delegate to the retained runtime implementation. Direct old
runner test imports are limited to the explicit `writeComposeReport` public-path
proof.

Tests run so far:

- `npm run check`: passed.
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/contracts/orphan-blocks.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/build-report-writer.test.ts tests/runner/close-builder-registry.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/fix-runtime-wiring.test.ts tests/runner/fresh-run-root.test.ts tests/unit/runtime/event-log-round-trip.test.ts`:
  passed.
- `npx vitest run tests/runner/agent-relay-roundtrip.test.ts tests/runner/codex-relay-roundtrip.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run verify`: passed.

Concerns:

- This is not a deletion slice. Remaining retained helper implementations and
  public paths still need an explicit disposition before deletion.

Next recommended action: continue only with behavior-preserving cleanup or
v2/shared oracle twins.

## 2026-05-06 - Phase 5.24 Verification Failure Evidence V2 Twin

Goal: add the core-v2 twin for retained verification pre-write failure evidence
without changing public behavior.

Files inspected:

- `src/core-v2/executors/verification.ts`
- `src/core-v2/run/graph-runner.ts`
- `tests/runner/verification-handler-direct.test.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `tests/core-v2/core-v2-baseline.test.ts`

Files changed:

- `src/core-v2/executors/verification.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.24.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Only core-v2 verification failure evidence changed. When
verification fails before writing its canonical report, core-v2 now emits
`check.evaluated` with `outcome: "fail"` before aborting. Public routing,
retained fallback, saved-folder behavior, rollback, `composeWriter`, fixture
policy, and ownership boundaries are unchanged.

Tests run so far:

- `npm run check`: passed.
- `npx vitest run tests/core-v2/control-loop-v2.test.ts`: passed.

Concerns:

- This is not a deletion slice. The retained verification direct handler test
  remains live retained fallback/oracle evidence.

Next recommended action: continue only with behavior-preserving import/test
cleanup or v2/shared oracle twins.

## 2026-05-06 - Phase 5.23 Checkpoint Resume Test Import Narrowing

Goal: move remaining retained checkpoint resume test imports to the saved-folder
compatibility boundary without changing behavior.

Files inspected:

- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/runner/explore-tournament-runtime.test.ts`
- `src/compat/retained-checkpoint-folders.ts`
- `src/compat/retained-runtime.ts`
- `docs/architecture/v2-runner-handler-test-classification.md`

Files changed:

- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/runner/explore-tournament-runtime.test.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `docs/architecture/v2-checkpoint-5.23.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No. This only changes test import paths for retained
checkpoint resume.

Tests run:

- `npm run check`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/explore-tournament-runtime.test.ts tests/runner/retained-compat-facade.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Concerns:

- This does not change retained/v1 checkpoint folder behavior or old runtime
  deletion readiness.

Next recommended action: continue autonomously only with behavior-preserving
import/test cleanup or v2/shared oracle twins.

## 2026-05-06 - Phase 5.22 Public Compatibility Policy Source

Goal: centralize live public compatibility policy strings without changing
runtime behavior.

Files inspected:

- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/utility-cli.test.ts`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-arbitrary-fixture-policy.md`

Files changed:

- `src/cli/runtime-compatibility-policy.ts`
- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/utility-cli.test.ts`
- `docs/architecture/v2-checkpoint-5.22.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No. This slice only moves the live runtime-policy strings into
one CLI policy module and makes tests assert those canonical constants.

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/runner/utility-cli.test.ts tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts tests/release/release-infrastructure.test.ts`:
  passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Concerns:

- This does not change public compatibility behavior or old runtime deletion
  readiness.

Next recommended action: continue only with behavior-preserving cleanup or stop
for review before public behavior, saved-folder semantics, ownership, or
deletion changes.

## 2026-05-06 - Phase 5.21 Retained Checkpoint Folder Boundary

Goal: isolate retained/v1 checkpoint folder support into a smaller compatibility
boundary without changing saved-folder semantics.

Files inspected:

- `src/compat/retained-runtime.ts`
- `src/cli/circuit.ts`
- `src/cli/handoff.ts`
- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-retained-checkpoint-folder-policy.md`

Files changed:

- `src/compat/retained-checkpoint-folders.ts`
- `src/compat/retained-runtime.ts`
- `src/cli/circuit.ts`
- `src/cli/handoff.ts`
- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-checkpoint-5.21.md`
- `docs/architecture/v2-retained-checkpoint-folder-policy.md`
- `docs/architecture/v2-retained-runtime-boundary.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No. CLI resume still routes core-v2-marked folders through
core-v2 and unmarked retained folders through retained resume. Handoff and
run-status still use retained trace/snapshot behavior for retained folders and
marker-gated v2 fallback for core-v2 folders. This slice only narrows the import
boundary.

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts tests/runner/utility-cli.test.ts`:
  passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Concerns:

- This does not make retained/v1 checkpoint folders deletion-ready. It only
  isolates their compatibility boundary.

Next recommended action: continue only with behavior-preserving cleanup or
v2/shared oracle twins. Stop for review before changing saved-folder semantics,
public compatibility behavior, ownership boundaries, or deletion status.

## 2026-05-05 - Phase 5.2 Checkpoint Resume Fixture Slice

Goal: implement fixture-level core-v2 checkpoint pause/resume without routing
public checkpoint modes through v2 and without deleting retained runtime code.

Files inspected:

- `docs/architecture/v2-checkpoint-resume-parity-plan.md`
- `generated/flows/build/circuit.json`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/domain/step.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/run-context.ts`
- `src/run-status/v2-run-folder.ts`
- `src/cli/circuit.ts`
- `tests/core-v2/*`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/run-status-projection.test.ts`

Files changed:

- `src/core-v2/domain/trace.ts`
- `src/core-v2/domain/step.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/checkpoint-resume.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/run-context.ts`
- `src/run-status/v2-run-folder.ts`
- `src/cli/circuit.ts`
- `tests/core-v2/checkpoint-resume-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.2.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Tests run so far:

- `npm run check`: passed.
- `npm run lint`: passed after Biome formatting/import fixes.
- `npm run build`: passed.
- `npx vitest run tests/core-v2/checkpoint-resume-v2.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/progress-event-schema.test.ts`:
  passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: initially failed on terminology guard for the word
  `dispatch`, then passed after renaming the active-surface wording.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed as part of `npm run soak:v2`.
- `npm run verify`: passed as part of `npm run soak:v2`.
- `git diff --check`: passed.

Behavior changed? Yes, inside core-v2 feature scope only. New core-v2-marked
checkpoint folders can pause, project waiting status/progress, resume by saved
engine marker, restore request context, validate request/report hashes, continue
the graph, and close. Public Build deep/default checkpoint routing did not
change, and retained/v1 checkpoint folders still use retained runtime.

Review hardening added after the Phase 5.2 review:

- `resumeCompiledFlowV2(...)` now rejects a checkpoint whose traced
  `request_path` does not match the saved checkpoint step's declared request
  path.
- `resumeCompiledFlowV2(...)` now validates traced `allowed_choices` against the
  saved checkpoint step's choices before accepting the operator selection.
- v2 waiting status projection now returns an invalid checkpoint projection for
  traced request-path mismatch, traced choice mismatch, request-body choice
  mismatch, unreadable requests, hash mismatch, invalid JSON, or stale request
  identity.
- Public-boundary tests now cover request-path mismatch, missing request files,
  stale request step ids, stale request choices, stale trace choices before
  `checkpoint.resolved`, already-resolved checkpoints, closed runs, missing
  checkpoint reports, and the retained-folder resume path under strict v2.

Concerns:

- This is fixture-level v2 checkpoint parity, not public checkpoint routing.
- Old retained checkpoint folders are intentionally not migrated.
- The retained checkpoint handler, trace/reducer/snapshot stack, progress
  projector, old runner, and old step handlers remain non-deletable.

Next recommended action: request focused review of the Phase 5.2 validation
hardening packet in the repo root. If approved, the next slice should be Build
deep candidate smoke, not default routing.

## 2026-05-05 - Phase 5.3 Build Deep Default Routing

Goal: move Build deep from candidate/strict checkpoint routing into the normal
default selector matrix after the Phase 5.2.1 candidate smoke was approved.

Files inspected:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-resume-parity-plan.md`

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-checkpoint-5.3.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-worklog.md`
- `docs/architecture/v2-checkpoint-resume-parity-plan.md`
- `HANDOFF.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`:
  passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2/checkpoint-resume-v2.test.ts`:
  passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`:
  passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `git diff --check`: passed before this validation-result refresh.

Behavior changed? Yes, deliberately and narrowly. Build deep is now in the
default v2 support matrix. A no-env Build deep run pauses through core-v2,
projects `runs show` waiting status, emits checkpoint/user-input progress,
resumes through the saved core-v2 run-folder marker, restores request context,
writes `reports/result.json`, parses the Build result report, and reaches
completed status.

The full soak caught and Phase 5.3 fixed one adjacent compatibility assumption:
run-backed handoff continuity now falls back to the neutral run-status
projection for core-v2 run folders instead of assuming every waiting run has a
retained v1 snapshot.

Concerns:

- Build tournament and other checkpoint/tournament modes remain retained.
- Retained/v1 checkpoint folders remain retained-runtime-owned.
- `CIRCUIT_DISABLE_V2_RUNTIME=1` remains the rollback path and keeps Build
  deep on retained runtime.
- No retained checkpoint, trace, reducer, snapshot, progress, old runner, old
  handler, connector, materializer, or registry file is deletion-ready.

Next recommended action: run the full Phase 5.3 validation gate and prepare a
focused review packet before routing any additional checkpoint/tournament mode
or discussing retained runtime deletion.

## 2026-05-05 - Phase 5.4 Retained Checkpoint Folder And Fallback Policy

Goal: stop widening routes mechanically after Build deep and document which
retained runtime responsibilities are compatibility commitments, migration
targets, fallback policy, or oracle coverage.

Files inspected:

- `src/cli/handoff.ts`
- `src/core-v2/run/checkpoint-resume.ts`
- `src/flows/build/schematic.json`
- `generated/flows/build/circuit.json`
- `tests/runner/utility-cli.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-selector-soak-report.md`

Files changed:

- `src/cli/handoff.ts`
- `tests/runner/utility-cli.test.ts`
- `docs/architecture/v2-retained-checkpoint-folder-policy.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-checkpoint-5.4.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Narrowly. Handoff run-backed continuity still uses retained
snapshot derivation for retained/v1 folders. It now falls back to neutral
run-status projection only for core-v2-marked folders. Utility CLI tests prove
handoff can bind to both core-v2 waiting runs and retained waiting runs.

Policy changed? Yes. Retained/v1 checkpoint folders are explicitly
compatibility-supported through retained resume. Unsupported modes, arbitrary
fixtures, programmatic `composeWriter`, rollback, and old runner/handler tests
are classified as retained fallback or oracle surfaces until a later product
decision migrates or retires them.

Build tournament clarification: Build currently has no public tournament entry
mode in either the source schematic or generated flow. If introduced later, it
needs its own selector proof before v2 routing.

Tests run:

- `npm run check`: passed during handoff hardening.
- `npm run lint`: passed during handoff hardening.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts`: passed.
- `npx vitest run tests/runner/utility-cli.test.ts`: passed.
- `npx vitest run tests/core-v2/checkpoint-resume-v2.test.ts`: passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `git diff --check`: passed before this validation-result refresh.

Concerns:

- This policy does not make deletion safe.
- No retained checkpoint, trace, reducer, snapshot, progress, old runner, old
  handler, connector, materializer, registry, router, catalog, or compiler file
  is deletion-ready.

Next recommended action: run the full Phase 5.4 validation gate and prepare a
focused policy review packet.

## 2026-05-05 - Phase 5.5 Deletion Readiness Inventory

Goal: inventory deletion readiness without deleting old runtime code or changing
product policy.

Files inspected:

- `HANDOFF.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-retained-checkpoint-folder-policy.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-runner-handler-current-import-inventory.md`
- `docs/architecture/v2-checkpoint-5.3.md`
- `docs/architecture/v2-checkpoint-5.4.md`
- `src/runtime/**`
- retained runner and handler tests under `tests/runner/`
- retained trace/progress tests under `tests/unit/runtime/`
- v2 proof tests under `tests/core-v2/` and `tests/soak/`

Files changed:

- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-checkpoint-5.5.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? No. This is a documentation-only inventory.

Policy changed? No. The retained checkpoint-folder and fallback policies from
Phase 5.4 remain unchanged.

Inventory result:

- no `src/runtime` file is deletion-ready;
- no retained runner or handler test is obsolete;
- old-path compatibility wrappers remain intentional until imports retire;
- neutral infrastructure under `src/runtime` should move only behind focused
  review;
- retained fallback, rollback, `composeWriter`, arbitrary fixtures, and
  retained/v1 checkpoint folders still block broad deletion.

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

Next recommended action: choose one policy or ownership decision before any
deletion slice. Good candidates are arbitrary fixtures, programmatic
`composeWriter`, rollback, retained/v1 checkpoint folder support, or neutral
ownership for registries/connectors/materializer/router/catalog/compiler
modules.

## 2026-05-05 - Phase 5.6 Fallback API Disposition Review

Goal: proceed until the next external review checkpoint, then stop before
changing retained fallback behavior.

Files inspected:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `scripts/release/capture-golden-run-proofs.mjs`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-retained-runtime-boundary.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.6.1.md`
- `HANDOFF.md`

Files changed:

- `docs/architecture/v2-fallback-api-disposition-review.md`
- `docs/architecture/v2-checkpoint-5.6.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `circuit-v2-phase-5.6-fallback-api-disposition-review-prompt-20260505.md`
- `circuit-v2-phase-5.6-fallback-api-disposition-review-20260505.zip`

Behavior changed? No. This is a review checkpoint packet only.

Policy changed? No. The packet recommends current posture but does not approve
any policy change.

Review checkpoint:

- arbitrary explicit fixtures;
- programmatic `composeWriter`;
- rollback;
- unsupported public modes;
- candidate diagnostics.

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

Next recommended action: stop for external review. Phase 5.7 should not start
until the reviewer decides which fallback responsibility to keep, migrate,
shrink, or retire first.

## 2026-05-05 - Phase 5.7 Compose Writer API Disposition

Goal: apply the external review verdict for programmatic `composeWriter`
without deleting old runtime code or widening core-v2 routing.

Files inspected:

- `src/cli/circuit.ts`
- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/step-handlers/compose.ts`
- `src/runtime/step-handlers/sub-run.ts`
- `src/runtime/step-handlers/fanout.ts`
- `src/runtime/step-handlers/types.ts`
- `scripts/release/capture-golden-run-proofs.mjs`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-fallback-api-disposition-review.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-checkpoint-5.7.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `circuit-v2-phase-5.7-compose-writer-disposition-review-prompt-20260505.md`
- `circuit-v2-phase-5.7-compose-writer-disposition-review-20260505.zip`

Behavior changed? No runtime routing behavior changed. The test suite now
explicitly proves candidate diagnostics plus `composeWriter` and rollback plus
`composeWriter` remain retained-runtime-owned.

Policy changed? Yes, the Phase 5.6 review verdict is now encoded:
`composeWriter` remains retained-runtime-only compatibility, core-v2 does not
get a matching hook, and internal v2 customization should use executor
injection or generated reports.

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed after final packet refresh.

Next recommended action: stop for external review before migrating release
proof away from retained `composeWriter`, adding a v2 compose hook, or starting
any old runtime deletion slice.

## 2026-05-05 - Phase 5.8 Candidate Diagnostics Disposition

Goal: decide the status of `CIRCUIT_V2_RUNTIME_CANDIDATE=1` now that default
selector routing is active, without renaming the flag or changing routing.

Files inspected:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/runner/config-loader.test.ts`
- `tests/core-v2/checkpoint-resume-v2.test.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-fallback-api-disposition-review.md`
- `HANDOFF.md`

Files changed:

- `docs/architecture/v2-candidate-diagnostics-disposition.md`
- `docs/architecture/v2-checkpoint-5.8.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `circuit-v2-phase-5.8-candidate-diagnostics-disposition-review-prompt-20260505.md`
- `circuit-v2-phase-5.8-candidate-diagnostics-disposition-review-20260505.zip`

Behavior changed? No. This is a disposition and review checkpoint only.

Policy changed? Yes, the flag is now classified as a temporary migration
diagnostic. It stays for now, but it should be renamed later to a clearer
runtime-decision diagnostics flag in a dedicated follow-up slice.

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed after final packet refresh.

Next recommended action: stop for external review before renaming or removing
`CIRCUIT_V2_RUNTIME_CANDIDATE`, adding a new diagnostics env var, changing
rollback, or starting any old runtime deletion slice.

## 2026-05-05 - Build Autonomous Default Core-v2 Routing

Goal: move one real public retained mode after the full-parity gameplan review:
Build autonomous should follow the core-v2 selector matrix by default, while
other autonomous/tournament modes remain retained until proven.

Files inspected:

- `src/cli/circuit.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/projections/progress.ts`
- `generated/flows/build/circuit.json`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/parity/build-v2.test.ts`
- `tests/core-v2/checkpoint-resume-v2.test.ts`
- `tests/runner/build-checkpoint-exec.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/projections/progress.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/parity/build-v2.test.ts`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Build autonomous is now in the default v2
support matrix. Core-v2 marks auto-resolved checkpoint requests, and v2 progress
no longer emits checkpoint waiting/user-input progress for auto-resolved
checkpoints.

Tests run:

- `npx vitest run tests/parity/build-v2.test.ts`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak/v2-runtime-surface.test.ts`
- `npx vitest run tests/core-v2/checkpoint-resume-v2.test.ts`
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts`
- `npx vitest run tests/core-v2/core-v2-baseline.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run soak:v2:fast`
- `npm run test:fast`
- `npm run soak:v2`

Next recommended action: continue moving one public retained mode or one release
proof dependency at a time. Do not delete old runtime code, route other
autonomous/tournament modes, change arbitrary roots, remove rollback, or change
`composeWriter` in this lane.

## 2026-05-05 - Fix Default Default Core-v2 Routing

Goal: move the generated Fix default mode through the core-v2 selector matrix
without touching release proof `composeWriter` compatibility.

Files inspected:

- `src/cli/circuit.ts`
- `generated/flows/fix/circuit.json`
- `tests/parity/fix-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Fix default is now in the default v2 support
matrix. Fix deep and Fix autonomous remain retained until they have their own
mode-specific checkpoint/autonomous proof. Release proof `composeWriter` remains
retained-runtime-owned.

Tests run:

- `npx vitest run tests/parity/fix-v2.test.ts`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak/v2-runtime-surface.test.ts`

Next recommended action: run the full validation ladder, then pick either the
next public mode with proof already close at hand or the release proof
`composeWriter` dependency. Do not change public `composeWriter` semantics
without a dedicated compatibility review.

## 2026-05-05 - Release Fix Proof Off ComposeWriter

Goal: remove the release golden Fix proof's internal dependency on public
`composeWriter` without changing the public compatibility API.

Files inspected:

- `scripts/release/capture-golden-run-proofs.mjs`
- `src/cli/circuit.ts`
- `src/core-v2/executors/compose.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/release/release-infrastructure.test.ts`
- `docs/architecture/v2-compose-writer-disposition.md`

Files changed:

- `src/cli/circuit.ts`
- `scripts/release/capture-golden-run-proofs.mjs`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/release/release-infrastructure.test.ts`
- `docs/release/proofs/index.yaml`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `examples/runs/**`

Behavior changed? Yes, internally. Fresh core-v2 CLI runs now receive
`v2Executors` from `main(..., options)`, matching the existing checkpoint-resume
executor injection path. The golden Fix proof now writes its deterministic
brief through an internal v2 compose executor and no longer imports
`dist/runtime/runner.js` or passes public `composeWriter`. Public
`composeWriter` behavior is unchanged: normal, diagnostics, and rollback
invocations remain retained-runtime-owned, and strict v2 still fails closed.

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/release/release-infrastructure.test.ts`
- `npm run check`
- `npm run capture-proofs:golden-runs`

Next recommended action: finish validation for this batch, then move another
real parity row. The best next small public-mode target is likely Fix
autonomous, because v2 already supports safe-autonomous checkpoint resolution
and Fix default/lite are now default-routed. Save Explore tournament for a
larger proof slice because fanout and tournament checkpoint UX still need
harder parity evidence.

## 2026-05-05 - Fix Autonomous Default Core-v2 Routing

Goal: move generated Fix autonomous through the core-v2 selector matrix and
prove the no-repro checkpoint takes its safe autonomous choice.

Files inspected:

- `generated/flows/fix/circuit.json`
- `src/flows/fix/schematic.json`
- `src/cli/circuit.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Fix autonomous is now in the default v2 support
matrix. The selector, candidate diagnostics, rollback, parity, and soak tests
cover it. A dedicated CLI test forces the `fix-no-repro-decision` branch and
proves core-v2 writes the checkpoint response with
`resolution_source: safe-autonomous` without emitting checkpoint-waiting or
user-input progress.

Tests run:

- `npx vitest run tests/parity/fix-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`

Next recommended action: run broader validation. If green, the next small public
mode is likely Sweep autonomous or Migrate autonomous, but inspect their
checkpoint/child-run behavior first. Keep Explore tournament separate; it is a
larger fanout and tournament checkpoint parity slice.

## 2026-05-05 - Sweep Autonomous Default Core-v2 Routing

Goal: move generated Sweep autonomous through the core-v2 selector matrix and
prove the triage checkpoint takes its safe autonomous choice.

Files inspected:

- `generated/flows/sweep/circuit.json`
- `src/flows/sweep/schematic.json`
- `src/cli/circuit.ts`
- `tests/parity/sweep-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `tests/parity/sweep-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Sweep autonomous is now in the default v2
support matrix. The selector, candidate diagnostics, rollback, parity, and soak
tests cover it. A dedicated CLI test proves core-v2 writes the triage
checkpoint response with `resolution_source: safe-autonomous` without emitting
checkpoint-waiting or user-input progress.

Tests run:

- `npx vitest run tests/parity/sweep-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`

Next recommended action: run broader validation. If green, inspect Migrate
autonomous next, because it is the next public autonomous row but includes
sub-run/child-run behavior. Keep Explore tournament as the next review-worthy
large slice.

## 2026-05-05 - Migrate Autonomous Default Core-v2 Routing

Goal: move generated Migrate autonomous through the core-v2 selector matrix and
prove the coexistence checkpoint takes its safe autonomous choice before the
Build child run.

Files inspected:

- `generated/flows/migrate/circuit.json`
- `src/cli/circuit.ts`
- `tests/parity/migrate-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `tests/parity/migrate-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Migrate autonomous is now in the default v2
support matrix. The selector, candidate diagnostics, rollback, parity, and soak
tests cover it. A dedicated CLI test proves core-v2 writes the coexistence
checkpoint response with `resolution_source: safe-autonomous`, avoids
checkpoint-waiting/user-input progress, runs the Build child flow through
core-v2, and reaches completed `runs show` status.

Tests run:

- `npx vitest run tests/parity/migrate-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

Next recommended action: inspect one remaining public retained mode at a time,
likely Fix deep or Sweep lite/deep, and choose the smallest row whose v2 behavior
can be proven without changing shared checkpoint semantics. Keep Explore
tournament as a larger review-worthy slice because it still combines fanout and
tournament checkpoint UX.

## 2026-05-05 - Sweep Lite Default Core-v2 Routing

Goal: move generated Sweep lite through the core-v2 selector matrix as the
lowest-risk remaining Sweep mode.

Files inspected:

- `generated/flows/sweep/circuit.json`
- `src/cli/circuit.ts`
- `tests/parity/sweep-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `tests/parity/sweep-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Sweep lite is now in the default v2 support
matrix. The selector, candidate diagnostics, rollback, parity, and soak tests
cover it. A dedicated CLI test proves core-v2 writes the triage checkpoint
response with `resolution_source: safe-default`, avoids checkpoint-waiting and
user-input progress, writes a Sweep result, and reaches completed `runs show`
status.

Tests run:

- `npx vitest run tests/parity/sweep-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

Next recommended action: inspect a true checkpoint-waiting retained row next:
Sweep deep, Fix deep, or Migrate deep. Pick one and prove pause/resume rather
than widening all deep modes together.

## 2026-05-05 - Sweep Deep Default Core-v2 Routing

Goal: move generated Sweep deep through the core-v2 selector matrix and prove
checkpoint wait/resume on the Sweep triage checkpoint.

Files inspected:

- `generated/flows/sweep/circuit.json`
- `src/core-v2/executors/checkpoint.ts`
- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Sweep deep is now in the default v2 support
matrix. The CLI and soak tests prove it pauses at the triage checkpoint, emits
checkpoint waiting and user-input progress, projects a waiting `runs show`
status, resumes by saved core-v2 marker, writes the Sweep result, and keeps
rollback on retained runtime.

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

Next recommended action: inspect Fix deep or Migrate deep next. Both are
checkpoint-waiting rows, but Fix deep is probably the smaller next target
because it does not add a child-run path.

## 2026-05-05 - Fix Deep Default Core-v2 Routing

Goal: move generated Fix deep through the core-v2 selector matrix and prove the
no-repro checkpoint waits and resumes when the diagnosis asks for operator
input.

Files inspected:

- `generated/flows/fix/circuit.json`
- `src/core-v2/executors/checkpoint.ts`
- `src/cli/circuit.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `tests/parity/fix-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Fix deep is now in the default v2 support
matrix. The normal generated path completes through core-v2. A dedicated CLI
test forces the no-repro route, proves the checkpoint waits at deep depth,
projects waiting `runs show` status, resumes by saved core-v2 marker, writes
the Fix result, and keeps rollback on retained runtime.

Tests run:

- `npx vitest run tests/parity/fix-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

Next recommended action: Migrate deep is the last obvious generated deep-mode
row before Explore's non-default/tournament work. Migrate deep needs checkpoint
wait/resume plus Build child-run proof.

## 2026-05-05 - Migrate Deep Default Core-v2 Routing

Goal: move generated Migrate deep through the core-v2 selector matrix and prove
checkpoint wait/resume plus the Build child-run path after resume.

Files inspected:

- `generated/flows/migrate/circuit.json`
- `src/core-v2/run/checkpoint-resume.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/executors/sub-run.ts`
- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `src/core-v2/run/checkpoint-resume.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Migrate deep is now in the default v2 support
matrix. The CLI and soak tests prove it pauses at the coexistence checkpoint,
emits checkpoint waiting and user-input progress, projects a waiting `runs show`
status, resumes by saved core-v2 marker, runs the Build child flow after resume,
writes the Migrate result, and keeps rollback on retained runtime. The slice
also fixes v2 checkpoint resume so resumed runs get the same default child
runner as fresh core-v2 runs; without that, a resumed Migrate sub-run aborted
after the checkpoint.

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

Next recommended action: inspect the remaining public generated Explore modes:
lite, deep, autonomous, and tournament. Explore tournament is the next
review-worthy cluster because fanout and tournament checkpoint UX need a
stronger review before default routing. Explore lite/deep/autonomous may be
small enough for normal proof-first routing, but inspect before changing them.

## 2026-05-05 - Explore Non-Tournament Default Core-v2 Routing

Goal: move generated Explore lite, deep, and autonomous through the core-v2
selector matrix while keeping Explore tournament retained.

Files inspected:

- `generated/flows/explore/circuit.json`
- `generated/flows/explore/tournament.json`
- `src/cli/circuit.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Explore lite, deep, and autonomous are now in
the default v2 support matrix. They share the non-tournament Explore
compose/relay graph, so the slice proves default selector routing, runtime
diagnostics, rollback retention, parity completion, and soak coverage. Explore
tournament remains retained because it uses the separate fanout plus tournament
checkpoint graph.

Tests run:

- `npx vitest run tests/parity/explore-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

Next recommended action: stop for an Explore tournament review checkpoint
before default-routing tournament. That review should focus on production fanout
parity, tournament checkpoint progress/status/resume UX, and retained-vs-v2
cross-report validation evidence. Do not delete old runtime code or move
connector/materializer/registry internals in the same slice.

## 2026-05-05 - Phase 5.10 Trusted Generated Plugin Mirror

Goal: allow the official installed Codex plugin's generated flow mirror to
follow the core-v2 selector matrix without blessing arbitrary external roots or
custom flow roots.

Files inspected:

- `HANDOFF.md`
- `src/cli/circuit.ts`
- `plugins/circuit/scripts/circuit-next.mjs`
- `src/cli/create.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/runner/config-loader.test.ts`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `plugins/circuit/scripts/circuit-next.mjs`
- `src/cli/circuit.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/runner/config-loader.test.ts`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-checkpoint-5.10.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Behavior changed? Yes, narrowly. Official wrapper-injected installed plugin flow
mirrors may now follow the selector matrix. Arbitrary external `--fixture`,
arbitrary external `--flow-root`, and custom flow roots remain retained by
default.

Tests run:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/contracts/codex-host-plugin.test.ts`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak`
- `npm run soak:v2:fast`
- `npm run soak:v2`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

Next recommended action: do not delete runtime code or generalize trusted
mirrors.

## 2026-05-05 - Phase 5.9 Arbitrary Fixture Policy

Goal: decide the arbitrary fixture disposition and clean its active diagnostics
wording without deleting old runtime code.

Files inspected:

- `HANDOFF.md`
- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `plugins/circuit/scripts/circuit-next.mjs`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/contracts/host-adapter.md`

Files changed:

- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-checkpoint-5.9.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `circuit-v2-phase-5.10-trusted-generated-mirror-policy-review-prompt-20260505.md`
- `circuit-v2-phase-5.10-trusted-generated-mirror-policy-review-20260505.zip`

Behavior changed? Only CLI diagnostic wording. Routing did not change.

Decision:

- generated fixtures under `generated/flows/**` follow the selector matrix;
- arbitrary explicit `--fixture` paths outside `generated/flows/**` stay
  retained by default;
- custom flow roots stay retained by default;
- packaged host flow roots are generated mirrors, but they stay retained by
  current path policy because they are outside `generated/flows/**`;
- strict `CIRCUIT_V2_RUNTIME=1` remains the only v2 experiment lane for
  compatible explicit fixtures.

Tests run:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npm run test:fast`
- `npm run verify`
- `git diff --check`

Next recommended action: do not delete runtime code. Any attempt to make
packaged host flow roots default-route through core-v2 should get deeper review
first. A focused Phase 5.10 trusted-generated-mirror policy review packet was
prepared for that question.

## 2026-05-05 - Phase 5.8.1 Runtime Decision Diagnostics Alias

Goal: implement the approved diagnostics rename with a temporary alias, update
active CLI wording, and make rollback diagnostics report the actual selected
runtime reason.

Files inspected:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/runner/config-loader.test.ts`
- `docs/architecture/v2-candidate-diagnostics-disposition.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `HANDOFF.md`

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/runner/config-loader.test.ts`
- `docs/architecture/v2-candidate-diagnostics-disposition.md`
- `docs/architecture/v2-checkpoint-5.8.1.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `circuit-v2-phase-5.8.1-runtime-decision-diagnostics-alias-review-prompt-20260505.md`
- `circuit-v2-phase-5.8.1-runtime-decision-diagnostics-alias-review-20260505.zip`

Behavior changed? Yes, narrowly. `CIRCUIT_SHOW_RUNTIME_DECISION=1` is now the
preferred way to include `runtime` and `runtime_reason`. The old
`CIRCUIT_V2_RUNTIME_CANDIDATE=1` name remains a temporary alias. If diagnostics
and rollback are both set, retained output now reports the rollback reason
because rollback selected the actual runtime. Strict v2 still wins over
rollback.

Routing changed? No. No v2 support rows were added, arbitrary fixture routing
did not change, `composeWriter` behavior did not change, and no old runtime code
was deleted or moved.

Tests run:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak`
- `npm run soak:v2:fast`
- `npm run soak:v2`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

Next recommended action: stop for external review before removing the old
candidate diagnostics alias, changing rollback further, or starting any old
runtime deletion slice.

## 2026-05-05 - Phase 5.2.1 Build Deep Candidate Smoke

Goal: prove Build deep through the core-v2 checkpoint path under explicit
candidate/strict routing without making Build deep a default-routed mode.

Files inspected:

- `src/cli/circuit.ts`
- `generated/flows/build/circuit.json`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/run/checkpoint-resume.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-selector-soak-report.md`

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-checkpoint-5.2.1.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts tests/core-v2/checkpoint-resume-v2.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`:
  passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `git diff --check`: passed before docs/review-packet refresh.

Behavior changed? Yes, deliberately and narrowly. Build deep is now in the
candidate/strict v2 support matrix only. Default Build deep still routes to the
retained checkpoint runtime. Candidate/strict Build deep now proves core-v2
checkpoint wait, `runs show`, progress, resume by saved engine marker, project
root restoration, selection config restoration, post-checkpoint continuation,
result writing, and final status projection.

Concerns:

- Build deep is not default-routed yet.
- Build tournament and other checkpoint modes remain retained.
- Retained/v1 checkpoint folders remain retained-runtime-owned.
- No retained checkpoint, trace, reducer, snapshot, progress, old runner, old
  handler, connector, materializer, or registry file is deletion-ready.

Next recommended action: request focused review of the Phase 5.2.1 candidate
smoke packet. If approved, Phase 5.3 can decide whether Build deep should enter
the default selector matrix.

## 2026-05-04 - Phase 4.7 Retained Runtime Inventory

Goal: move from default-selector stabilization to the next heavy review
boundary by refreshing the old-runtime deletion plan from actual repo ownership.

Files inspected:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.6.md`
- `docs/architecture/v2-checkpoint-4.6.1.md`
- `src/cli/circuit.ts`
- `src/runtime/**`
- current imports referencing `src/runtime/`

Files changed:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.7.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This checkpoint updates the
review boundary and retained-runtime ownership map.

Concerns:

- Old runtime deletion is still not approved.
- `src/runtime/runner.ts` remains live for retained fallback, rollback,
  arbitrary fixtures, programmatic `composeWriter`, unsupported modes, and
  checkpoint resume.
- Several `src/runtime/` modules are shared infrastructure and should be moved
  or retained, not deleted with old execution files.

Next recommended action: run validation, package Phase 4.7, and request a
deletion-readiness review before any runtime file deletion.

## 2026-05-04 - Phase 4.8 Retained Runtime Narrowing Prep

Goal: answer Phase 4.7 review corrections, attach a full import inventory, and
propose the first behavior-preserving runtime namespace narrowing candidates.

Files inspected:

- `src/runtime/relay-selection.ts`
- `src/runtime/selection-resolver.ts`
- `src/core-v2/projections/progress.ts`
- `src/runtime/runner-types.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.8.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed.

Concerns:

- Old runtime deletion is still not approved.
- `selection-resolver.ts` is live selection infrastructure through
  `relay-selection.ts`, not just a test oracle.
- `progress-projector.ts` still provides helpers used directly by core-v2.

Next recommended action: run validation, then package Phase 4.8 for a
retained-runtime narrowing review.

## 2026-05-04 - Phase 4.9 Shared Type Extraction

Goal: reduce core-v2's dependency on the retained runtime namespace by moving
shared relay/progress callback types out of `src/runtime/runner-types.ts`.

Files inspected:

- `src/runtime/runner-types.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/run-context.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/relay-runtime-types.ts`
- `src/runtime/runner-types.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/run-context.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.9.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `src/runtime/runner-types.ts`
remains a compatibility re-export for the moved shared types, while core-v2 now
imports those types from `src/shared/relay-runtime-types.ts`.

Concerns:

- Old runtime deletion is still not approved.
- `runner-types.ts` still owns retained-runtime invocation/result types and
  remains live for old runtime callers and tests.

Next recommended action: run validation, then continue with progress helper
extraction if this slice remains green.

## 2026-05-04 - Phase 4.10 Progress Helper Extraction

Goal: reduce core-v2's dependency on old runtime progress projection by moving
the shared progress output helpers out of `src/runtime/progress-projector.ts`.

Files inspected:

- `src/runtime/progress-projector.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/relay-runtime-types.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/progress-output.ts`
- `src/runtime/progress-projector.ts`
- `src/core-v2/projections/progress.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.10.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed after rerunning serially; the first
  attempt overlapped with stale-file drift tests in `test:fast`.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `progressDisplay` and
`reportProgress` now live in `src/shared/progress-output.ts`; the old runtime
progress projector re-exports them and still owns trace-to-progress projection.

Concerns:

- Old runtime deletion is still not approved.
- `src/runtime/progress-projector.ts` remains live for retained runtime and old
  progress projection tests.

Next recommended action: run validation, then continue with a careful relay
selection support move if this slice remains green.

## 2026-05-04 - Phase 4.11 Selection Resolver Extraction

Goal: reduce old runtime namespace ownership by moving the pure relay selection
precedence resolver out of `src/runtime/selection-resolver.ts`.

Files inspected:

- `src/runtime/selection-resolver.ts`
- `src/runtime/relay-selection.ts`
- `src/core-v2/executors/relay.ts`
- `tests/contracts/flow-model-effort.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/selection-resolver.ts`
- `src/runtime/selection-resolver.ts`
- `src/runtime/relay-selection.ts`
- `tests/contracts/flow-model-effort.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.11.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/flow-model-effort.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/config-loader.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`: passed
  after folding in `docs/positioning-and-strategy.md`.
- `npm run test:fast`: passed after folding in
  `docs/positioning-and-strategy.md`.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed after folding in
  `docs/positioning-and-strategy.md`.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `resolveSelectionForRelay` now
lives in `src/shared/selection-resolver.ts`; the old runtime
`selection-resolver.ts` file re-exports it for compatibility.

Concerns:

- Old runtime deletion is still not approved.
- `src/runtime/relay-selection.ts` remains live for retained relay decision
  behavior and core-v2 compatibility.

Next recommended action: continue with the selection-depth helper extraction,
leaving retained relayer resolution in `runtime/relay-selection.ts`.

## 2026-05-04 - Phase 4.12 Relay Selection Helper Extraction

Goal: reduce core-v2's dependency on `src/runtime/relay-selection.ts` by moving
selection-depth helper behavior into a shared module while leaving retained
relayer resolution in the runtime bridge.

Files inspected:

- `src/runtime/relay-selection.ts`
- `src/runtime/runner.ts`
- `src/runtime/step-handlers/relay.ts`
- `src/core-v2/executors/relay.ts`
- `tests/runner/runner-relay-provenance.test.ts`
- `tests/runner/build-runtime-wiring.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/relay-selection.ts`
- `src/runtime/relay-selection.ts`
- `src/core-v2/executors/relay.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.12.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/flow-model-effort.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/build-runtime-wiring.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `deriveResolvedSelection`,
`selectionConfigLayersWithExecutionDepth`, and
`bindsExecutionDepthToRelaySelection` now live in
`src/shared/relay-selection.ts`; `src/runtime/relay-selection.ts` re-exports
them for retained runtime compatibility.

Concerns:

- Old runtime deletion is still not approved.
- `src/runtime/relay-selection.ts` remains live for retained relayer resolution,
  connector bridge behavior, old relay handler imports, and relay provenance
  tests.

Next recommended action: continue with relay-support helper extraction, still
without moving retained connector/registry/path infrastructure.

## 2026-05-04 - Phase 4.13 Relay Support Helper Extraction

Goal: reduce core-v2's dependency on `src/runtime/relay-support.ts` by moving
relay prompt composition and check evaluation helpers into a shared module.

Files inspected:

- `src/runtime/relay-support.ts`
- `src/runtime/step-handlers/relay.ts`
- `src/runtime/step-handlers/fanout.ts`
- `src/core-v2/executors/relay.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/relay-support.ts`
- `src/runtime/relay-support.ts`
- `src/core-v2/executors/relay.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.13.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/relay-handler-direct.test.ts tests/runner/materializer-schema-parse.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `composeRelayPrompt`,
`evaluateRelayCheck`, `RelayStep`, `CheckEvaluation`, and
`NO_VERDICT_SENTINEL` now live in `src/shared/relay-support.ts`;
`src/runtime/relay-support.ts` re-exports them for retained runtime
compatibility.

Concerns:

- Old runtime deletion is still not approved.
- The shared helper still imports retained shape-hint registry and run-relative
  path helpers; those moves are deferred.

Next recommended action: extract the write-capable worker disclosure helper,
which core-v2 progress still imports from the runtime namespace.

## 2026-05-04 - Phase 4.14 Write-Capable Worker Disclosure Extraction

Goal: reduce core-v2's dependency on `src/runtime/write-capable-worker-disclosure.ts`
by moving the disclosure helper into a shared module.

Files inspected:

- `src/runtime/write-capable-worker-disclosure.ts`
- `src/core-v2/projections/progress.ts`
- `src/runtime/runner.ts`
- `src/runtime/operator-summary-writer.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/write-capable-worker-disclosure.ts`
- `src/runtime/write-capable-worker-disclosure.ts`
- `src/core-v2/projections/progress.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.14.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/progress-event-schema.test.ts tests/runner/cli-v2-runtime.test.ts tests/runner/operator-summary-writer.test.ts tests/contracts/terminology-active-surface.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. The disclosure constant and
flow helpers now live in `src/shared/write-capable-worker-disclosure.ts`;
`src/runtime/write-capable-worker-disclosure.ts` re-exports them for retained
runtime compatibility.

Concerns:

- Old runtime deletion is still not approved.
- Retained runtime and operator summary code still import the old wrapper path.

Next recommended action: inspect `src/runtime/run-relative-path.ts` as the next
possible behavior-preserving shared helper move. Stop for review if the move
would affect path safety semantics instead of only import ownership.

## 2026-05-04 - Phase 4.15 Run-Relative Path Helper Extraction

Goal: reduce shared flow writer and core-v2 support dependencies on
`src/runtime/run-relative-path.ts` without changing path safety semantics.

Files inspected:

- `src/runtime/run-relative-path.ts`
- `src/shared/relay-support.ts`
- flow-owned report writers under `src/flows/*/writers/`
- `tests/runner/run-relative-path.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/run-relative-path.ts`
- `src/runtime/run-relative-path.ts`
- `src/shared/relay-support.ts`
- flow-owned report writers under `src/flows/*/writers/`
- `tests/runner/run-relative-path.test.ts`
- `docs/contracts/step.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.15.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-relative-path.test.ts tests/runner/materializer-schema-parse.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/build-report-writer.test.ts tests/runner/fix-report-writer.test.ts tests/runner/explore-report-writer.test.ts tests/runner/sweep-runtime-wiring.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `resolveRunRelative` now lives
in `src/shared/run-relative-path.ts`; `src/runtime/run-relative-path.ts`
re-exports it for retained runtime compatibility.

Concerns:

- Old runtime deletion is still not approved.
- The shared helper remains load-bearing path safety code; future semantic
  edits to containment or symlink behavior should be reviewed separately.

Next recommended action: stop for a heavier review before moving connector
subprocess/shared modules or registries. Those are production safety and
catalog-discovery boundaries, not just wrapper ownership cleanup.

## 2026-05-04 - Phase 4.16 Connector Relay Data and Hash Extraction

Goal: reduce core-v2 and shared type dependencies on
`src/runtime/connectors/shared.ts` without moving connector subprocess modules
or registries.

Files inspected:

- `src/runtime/connectors/shared.ts`
- `src/shared/relay-runtime-types.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/flows/build/writers/checkpoint-brief.ts`
- connector smoke fingerprint source lists
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/connector-relay.ts`
- `src/runtime/connectors/shared.ts`
- `src/shared/relay-runtime-types.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/flows/build/writers/checkpoint-brief.ts`
- `tests/runner/connector-shared-compat.test.ts`
- `tests/runner/codex-relay-roundtrip.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.16.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/connector-shared-compat.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/materializer-schema-parse.test.ts tests/runner/config-loader.test.ts tests/runner/extract-json-object.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/explore-e2e-parity.test.ts tests/core-v2/connectors-v2.test.ts tests/core-v2/default-executors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. `ConnectorRelayInput`,
`RelayResult`, and `sha256Hex` now live in `src/shared/connector-relay.ts`;
`src/runtime/connectors/shared.ts` re-exports them for retained runtime and
connector compatibility.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules, relay materialization, and registries remain
  production safety and catalog-discovery boundaries.

Next recommended action: stop for review before moving subprocess connector
modules, connector-only parsing/model helpers, relay materialization, or
registries.

## 2026-05-04 - Phase 4.17 Connector Helper Extraction

Goal: reduce runtime connector namespace ownership by moving connector parsing
and model-selection helper functions to a shared module without moving
subprocess connector modules or relay materialization.

Files inspected:

- `src/runtime/connectors/shared.ts`
- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `src/runtime/connectors/custom.ts`
- `tests/runner/extract-json-object.test.ts`
- connector smoke fingerprint source lists
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/connector-helpers.ts`
- `src/runtime/connectors/shared.ts`
- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `src/runtime/connectors/custom.ts`
- `tests/runner/connector-shared-compat.test.ts`
- `tests/runner/extract-json-object.test.ts`
- `tests/runner/codex-relay-roundtrip.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.17.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: initially failed on a readonly test fixture type in
  `tests/runner/connector-shared-compat.test.ts`, then passed after typing the
  fixture as `ResolvedSelection`.
- `npx vitest run tests/runner/connector-shared-compat.test.ts tests/runner/extract-json-object.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/agent-connector-smoke.test.ts tests/runner/codex-connector-smoke.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/materializer-schema-parse.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: initially failed once with unrelated full-suite
  cross-talk symptoms; isolated reruns of the affected suites passed, and the
  final `npm run verify` rerun passed.

Behavior changed? No runtime behavior changed. `selectedModelForProvider` and
`extractJsonObject` now live in `src/shared/connector-helpers.ts`;
`src/runtime/connectors/shared.ts` re-exports them for retained runtime and old
import compatibility.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules and relay materialization remain production
  safety boundaries.
- Registries remain catalog/report/writer discovery infrastructure.

Next recommended action: stop for review before moving subprocess connector
modules, relay materialization, or registries.

## 2026-05-04 - Phase 4.18 Connector, Materializer, And Registry Ownership Plans

Goal: prepare the next retained-runtime narrowing strategy without moving
production-sensitive connector subprocess modules, relay materialization, or
registries.

Files inspected:

- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `src/runtime/connectors/custom.ts`
- `src/runtime/connectors/relay-materializer.ts`
- `src/runtime/connectors/shared.ts`
- `src/runtime/registries/**`
- `src/runtime/catalog-derivations.ts`
- `src/flows/catalog.ts`
- `src/flows/types.ts`
- connector smoke fingerprint source lists
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`

Files changed:

- `docs/architecture/v2-connector-materializer-plan.md`
- `docs/architecture/v2-registry-ownership-plan.md`
- `docs/architecture/v2-checkpoint-4.18.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`
- `tests/runner/codex-relay-roundtrip.test.ts`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/connector-shared-compat.test.ts tests/runner/extract-json-object.test.ts tests/runner/codex-relay-roundtrip.test.ts tests/runner/explore-e2e-parity.test.ts`:
  passed.
- `npx vitest run tests/runner/catalog-derivations.test.ts tests/contracts/catalog-completeness.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/close-builder-registry.test.ts tests/runner/relay-shape-hint-registry.test.ts tests/runner/cross-report-validators.test.ts tests/properties/visible/cross-report-validator.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: initially failed when run concurrently with
  `test:fast` because the emit-flows drift test temporarily created stale
  `never-a-mode` fixtures; the files were gone after the test completed, and a
  serial rerun passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This slice adds ownership plans
and fixes a stale connector smoke comment that still said "three" source files
after the connector fingerprint list grew in Phases 4.16 and 4.17.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules and relay materialization remain production
  safety boundaries.
- Registries remain catalog/report/writer discovery infrastructure.

Next recommended action: run validation, then stop for heavy review before
moving connector subprocess modules, relay materialization, or registries.

## 2026-05-04 - Phase 4.38 Retained Runner Boundary Plan

Goal: decide whether further `src/runtime/runner.ts` shrinkage is safe after
the retained checkpoint resume preparation extraction.

Files inspected:

- `src/runtime/runner.ts`
- `src/runtime/checkpoint-resume.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/append-and-derive.ts`
- `src/runtime/progress-projector.ts`
- `src/runtime/result-writer.ts`
- `src/runtime/trace-writer.ts`
- `src/runtime/snapshot-writer.ts`
- runner import references across `README.md`, `commands/`, `plugins/`,
  `.claude-plugin/`, `generated/`, `docs/`, `specs/`, `scripts/`, `src/`,
  `tests/`, and `package.json`

Files changed:

- `docs/architecture/v2-retained-runner-boundary-plan.md`
- `docs/architecture/v2-checkpoint-4.38.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`: passed
  after folding in the parallel positioning and strategy doc terminology
  cleanup.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This is a planning checkpoint.

Decision:

- Stop shrinking `src/runtime/runner.ts` for now.
- Do not move `executeCompiledFlow(...)`.
- Do not move trace/progress/reducer/snapshot/checkpoint handler behavior.
- If the team wants another runner shrink later, prepare a focused
  close/result finalization proposal first.

Concerns:

- The remaining runner responsibilities are coupled to trace sequence
  assignment, route walking, step dispatch, progress side effects, checkpoint
  waiting, close/result finalization, and recursive child-run defaults.

Next recommended action: validate. No deep review is needed unless the next
step proposes moving close/result finalization or another high-risk runner
responsibility.

## 2026-05-04 - Phase 4.39 Refresh Runner And Handler Test Inventory

Goal: refresh the old runner/handler test classification and current import
inventory after the retained checkpoint resume extraction.

Files inspected:

- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-runner-handler-current-import-inventory.md`
- `docs/architecture/v2-retained-runner-boundary-plan.md`
- `tests/runner/build-checkpoint-exec.test.ts`
- old runner and handler import references across `src/`, `tests/`, `scripts/`,
  `docs/`, generated surfaces, and plugin surfaces

Files changed:

- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-runner-handler-current-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.39.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This is a docs/inventory
refresh.

Decision:

- No old runner or handler test is deletion-ready.
- `src/runtime/checkpoint-resume.ts` is retained checkpoint resume preparation,
  not a v2 resume path.
- Stop old runner/handler movement for now.

Next recommended action: continue selector soak. Prepare a focused proposal
before moving close/result finalization, `executeCompiledFlow(...)`,
trace/progress/reducer/snapshot/checkpoint handler internals, or old handler
files.

## 2026-05-04 - Phase 4.40 Close/Result Finalization Proposal

Goal: prepare the focused proposal required before any retained close/result
finalization move.

Files inspected:

- `src/runtime/runner.ts`
- `src/runtime/result-writer.ts`
- `src/runtime/runner-types.ts`
- `src/core-v2/run/result-writer.ts`
- `docs/architecture/v2-result-writer-plan.md`
- retained close/result, terminal outcome, verdict, progress, and runtrace
  tests

Files changed:

- `docs/architecture/v2-close-result-finalization-proposal.md`
- `docs/architecture/v2-checkpoint-4.40.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This is a proposal checkpoint.

Decision:

- Keep close/result finalization in `runner.ts` for now.
- Do not move `executeCompiledFlow(...)`.
- Do not move retained close progress, final snapshot derivation, trace
  sequence authority, or checkpoint waiting behavior.

Next recommended action: get focused review before implementing any
close/result finalization move.

## 2026-05-05 - Phase 4.41 Terminal Verdict Helper Extraction

Goal: implement the Phase 4.40 review's approved C1 move: extract only pure
terminal admitted verdict derivation out of `src/runtime/runner.ts`.

Files inspected:

- `src/runtime/runner.ts`
- `tests/runner/terminal-verdict-derivation.test.ts`
- `tests/runner/terminal-outcome-mapping.test.ts`
- `docs/architecture/v2-close-result-finalization-proposal.md`

Files changed:

- `src/runtime/terminal-verdict.ts`
- `src/runtime/runner.ts`
- `tests/runner/terminal-verdict-helper.test.ts`
- `docs/architecture/v2-checkpoint-4.41.md`
- `docs/architecture/v2-close-result-finalization-proposal.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-retained-runner-boundary-plan.md`
- `docs/architecture/v2-runner-handler-current-import-inventory.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/terminal-verdict-helper.test.ts tests/runner/terminal-verdict-derivation.test.ts tests/runner/terminal-outcome-mapping.test.ts`:
  initially failed because the new sub-run trace fixture included the
  `sub_run.started`-only `child_flow_id` field on a `sub_run.completed` entry,
  then passed after tightening the fixture to the schema.
- `npx vitest run tests/runner/handler-throw-recovery.test.ts tests/runner/fresh-run-root.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fanout-runtime.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/runner/run-status-projection.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Intended no. The retained close tail still lives in
`runner.ts`; only the pure verdict derivation helper moved.

Decision:

- Keep close/result finalization in `runner.ts`.
- Do not move `executeCompiledFlow(...)`.
- Do not move retained close progress, final snapshot derivation, trace
  sequence authority, or checkpoint waiting behavior.
- No old runtime deletion is approved.

Next recommended action: validate. No heavy review is needed for this helper
extraction unless validation reveals a behavior change.

## 2026-05-05 - Phase 4.42 Retained Boundary And Selector Soak

Goal: record the checkpoint resume ownership decision and mark the
default-selector milestone complete for matrix-supported fresh-run modes.

Files inspected:

- `HANDOFF.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-retained-runner-boundary-plan.md`
- `docs/architecture/v2-close-result-finalization-proposal.md`

Files changed:

- `docs/architecture/v2-retained-runtime-boundary.md`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-checkpoint-4.42.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run lint`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.

Behavior changed? No. This is a docs and evidence checkpoint.

Decision:

- Checkpoint resume remains retained-runtime-owned for the foreseeable future.
- The default-selector milestone is complete for matrix-supported fresh-run
  modes.
- Old runtime deletion is still not approved.
- Do not move connector subprocesses, relay materialization, registries,
  trace/progress/reducer/snapshot internals, checkpoint handler behavior,
  `executeCompiledFlow(...)`, old runner files, or old step handlers without a
  separate reviewed plan.

Next recommended action: selector soak and deletion-readiness evidence
gathering. No heavy review is needed for ordinary soak updates.

## 2026-05-05 - Phase 5.0 Automated V2 Selector Soak

Goal: add a deterministic soak command and focused soak suite for the current
core-v2 selector boundary.

Files inspected:

- `package.json`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/runner/run-status-projection.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `src/schemas/manifest.ts`
- `src/schemas/result.ts`
- `src/schemas/progress-event.ts`

Files changed:

- `package.json`
- `tests/soak/v2-runtime-surface.test.ts`
- `docs/architecture/v2-selector-soak-report.md`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-checkpoint-5.0.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed on sequential rerun.
- `npm run verify`: passed on final rerun after report updates.
- `git diff --check`: passed.

Note: a parallel `npm run check-flow-drift` attempt overlapped with
`tests/unit/emit-flows-drift.test.ts` and saw that test's temporary stale
sibling file. The sequential rerun passed after `test:fast` finished.

Behavior changed? No. This phase adds tests, scripts, and documentation only.

What the soak proves:

- matrix-supported fresh runs route through core-v2 by default;
- retained-owned paths remain retained;
- rollback and strict opt-in precedence stay explicit;
- strict opt-in fails closed before unsafe run-folder writes;
- `runs show --json`, progress JSONL, operator summaries, manifest snapshots,
  result files, child runs, fanout, and connector safety remain covered.

Next recommended action: declare the default-selector milestone complete with
precise wording, then begin Phase 5.1 as a v2 checkpoint resume parity plan.

## 2026-05-05 - Phase 5.1 V2 Checkpoint Resume Parity Plan

Goal: design v2 checkpoint pause/resume as a product feature before moving any
checkpoint mode, retained trace/reducer/snapshot/progress internals, checkpoint
handler behavior, old runner code, or old step handlers.

Files inspected:

- `docs/architecture/v2-checkpoint-resume-ownership-plan.md`
- `docs/architecture/v2-retained-runtime-boundary.md`
- `docs/architecture/v2-selector-soak-report.md`
- `src/runtime/checkpoint-resume.ts`
- `src/runtime/step-handlers/checkpoint.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/projections/progress.ts`
- `src/run-status/v2-run-folder.ts`
- `src/schemas/run-status.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/runner/run-status-projection.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`

Files changed:

- `docs/architecture/v2-checkpoint-resume-parity-plan.md`
- `docs/architecture/v2-checkpoint-5.1.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

Tests run:

- `npm run lint`: passed.
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`: passed.
- `git diff --check`: passed.

Behavior changed? No. This is a planning checkpoint only.

Decision:

- The first v2 checkpoint implementation should support new core-v2 checkpoint
  folders only.
- Old retained checkpoint folders should continue to resume through retained
  runtime.
- Resume dispatch should follow the saved run folder's engine marker, not
  fresh-run selector flags.
- Phase 5.2 should prove fixture-level pause and resume end to end before any
  public checkpoint mode routes through v2.
- Checkpoint request/resolution trace fields used by resume/status/progress must
  be first-class v2 fields, not only `data`.
- Waiting checkpoint must become a first-class graph result, not a thrown
  executor error.
- Resume graph execution must reconstruct completed attempt state from the
  existing trace before continuing.

Next recommended action: request focused architecture review of the Phase 5.1
plan before implementing v2 checkpoint pause/resume.

## 2026-05-04 - Phase 4.37 Extract Retained Checkpoint Resume Preparation

Goal: move retained checkpoint resume discovery and validation out of
`src/runtime/runner.ts` without changing checkpoint resume ownership or moving
the execution loop.

Files inspected:

- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/trace-writer.ts`
- `src/runtime/snapshot-writer.ts`
- `src/runtime/registries/checkpoint-writers/registry.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `docs/architecture/v2-retained-checkpoint-resume-shrink-proposal.md`

Files changed:

- `src/runtime/checkpoint-resume.ts`
- `src/runtime/runner.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `docs/architecture/v2-checkpoint-4.37.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No intended behavior change. Checkpoint resume remains
retained-runtime-owned.

What moved:

- manifest byte verification and flow parsing;
- manifest/trace identity validation;
- waiting checkpoint discovery;
- checkpoint request path/hash/schema/context validation;
- checkpoint report resume validation;
- original project root and selection config restoration data.

What stayed:

- public `resumeCompiledFlowCheckpoint(...)` in `src/runtime/runner.ts`;
- private `executeCompiledFlow(...)` in `src/runtime/runner.ts`;
- checkpoint handler, trace reader/writer, reducer, snapshot writer,
  progress projector, and old step handlers.

Concerns:

- This still does not make checkpoint resume v2-owned.
- Old runtime deletion remains blocked.

Next recommended action: validate. If green, continue only with another narrow
ownership slice; do not delete old runtime code.

## 2026-05-04 - Phase 4.36 Retained Checkpoint Resume Shrink Proposal

Goal: propose the first retained checkpoint resume shrink before moving code.

Files inspected:

- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/step-handlers/checkpoint.ts`
- `src/runtime/reducer.ts`
- `src/runtime/snapshot-writer.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/trace-writer.ts`
- `docs/architecture/v2-checkpoint-resume-ownership-plan.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-runner-handler-current-import-inventory.md`

Files changed:

- `docs/architecture/v2-retained-checkpoint-resume-shrink-proposal.md`
- `docs/architecture/v2-checkpoint-4.36.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No runtime behavior changed. This is a proposal checkpoint.

Proposal:

- Extract checkpoint resume discovery and validation from
  `src/runtime/runner.ts` to `src/runtime/checkpoint-resume.ts`.
- Keep public `resumeCompiledFlowCheckpoint(...)` in `runner.ts`.
- Keep private `executeCompiledFlow(...)` in `runner.ts`.
- Do not move checkpoint handler, trace reader/writer, reducer, snapshot
  writer, progress projector, or step handlers.

Concerns:

- This is the first proposal that names a concrete code move across the
  checkpoint resume boundary, so implementation should wait for review.

Next recommended action: review the proposal before code movement.

## 2026-05-04 - Phase 4.35 Retained Progress Contract Classification

Goal: classify retained progress projection ownership before adding a neutral
facade or moving `src/runtime/progress-projector.ts`.

Files inspected:

- `src/runtime/progress-projector.ts`
- `src/runtime/runner.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/progress-output.ts`
- `tests/unit/runtime/progress-projector.test.ts`
- `tests/contracts/progress-event-schema.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`

Files changed:

- `docs/architecture/v2-retained-progress-contract-plan.md`
- `docs/architecture/v2-checkpoint-4.35.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This is a planning and
classification checkpoint.

Decision:

- Keep retained v1 progress projection in `src/runtime/progress-projector.ts`
  for now.
- Do not add a neutral v1 progress facade yet.
- Do not move retained progress projector internals yet.

Concerns:

- Retained progress is still coupled to retained runner lifecycle events and
  checkpoint waiting/user-input progress.
- Moving only the projector would not reduce checkpoint resume ownership.

Next recommended action: validate. The next implementation move would be a
real architecture decision, likely a retained checkpoint resume shrink proposal.

## 2026-05-04 - Phase 4.34 Current Old Runner/Handler Import Inventory

Goal: produce a current-only import inventory for old runner and handler files
before any retained checkpoint resume shrink proposal.

Files inspected:

- `README.md`
- `commands/`
- `plugins/`
- `.claude-plugin/`
- `generated/`
- `docs/`
- `specs/`
- `scripts/`
- `src/`
- `tests/`
- `package.json`

Files changed:

- `docs/architecture/v2-runner-handler-current-import-inventory.md`
- `docs/architecture/v2-checkpoint-4.34.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This is an import inventory
checkpoint.

Decision:

- `src/runtime/runner.ts` remains a live product fallback and checkpoint resume
  owner.
- old step handlers remain live through retained fallback and direct handler
  tests.
- release evidence still imports `writeComposeReport` from the built runtime
  runner surface.
- no old runner or handler file is deletion-ready.

Concerns:

- Current imports remain broad enough that a retained checkpoint resume shrink
  proposal needs a dedicated implementation plan.

Next recommended action: classify retained progress projection ownership.

## 2026-05-04 - Phase 4.33 Old Runner And Handler Test Classification

Goal: classify old runner and direct handler tests before any retained resume
shrink, v2 checkpoint resume implementation, or old runtime deletion.

Files inspected:

- `tests/runner/*`
- `tests/unit/runtime/event-log-round-trip.test.ts`
- `tests/unit/runtime/progress-projector.test.ts`
- `tests/properties/visible/fanout-join-policy.test.ts`
- `tests/contracts/orphan-blocks.test.ts`
- `tests/contracts/flow-model-effort.test.ts`
- `tests/contracts/codex-host-plugin.test.ts`
- `src/runtime/runner.ts`
- `src/runtime/step-handlers/*`

Files changed:

- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-checkpoint-4.33.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This is a planning and
classification checkpoint.

Decision:

- No old runner/handler test is currently deletion-ready.
- The tests classify as retained product fallback, checkpoint-resume product
  coverage, old-runtime oracle, or compatibility import coverage.
- The next safe evidence slice is a current-only import inventory for old
  runner and handler files.

Concerns:

- Old runner and handler code still has broad product/test ownership.
- Connector subprocess, relay materializer, registry, trace/progress, and
  checkpoint resume ownership remain out of scope.

Next recommended action: create a current-only import inventory for old runner
and handler files before any retained checkpoint resume shrink proposal.

## 2026-05-04 - Phase 4.32 Checkpoint Resume Ownership Decision

Goal: decide checkpoint resume ownership before moving lower-level retained
trace/progress/checkpoint infrastructure or old runner/handler code.

Files inspected:

- `HANDOFF.md`
- `src/cli/circuit.ts`
- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/step-handlers/checkpoint.ts`
- `src/runtime/reducer.ts`
- `src/runtime/snapshot-writer.ts`
- `src/runtime/append-and-derive.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/trace-writer.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/unit/runtime/event-log-round-trip.test.ts`
- `tests/unit/runtime/progress-projector.test.ts`

Files changed:

- `docs/architecture/v2-checkpoint-resume-ownership-plan.md`
- `docs/architecture/v2-checkpoint-4.32.md`
- `docs/architecture/v2-trace-progress-checkpoint-boundary-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/run-status-projection.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This is a planning checkpoint.

Decision:

- Do not implement v2 checkpoint resume next.
- Do not shrink checkpoint resume into a smaller retained module yet.
- Classify old runner and direct handler tests before choosing v2 resume parity
  or retained resume shrinkage.

Concerns:

- Checkpoint resume remains retained-runtime-owned.
- The old runner and direct handler tests still need exact disposition.
- v1 trace/state snapshot infrastructure remains live until resume ownership
  changes or is explicitly retained.

Next recommended action: classify old runner and direct handler tests.

## 2026-05-04 - Phase 4.31 Trace, Progress, And Checkpoint Boundary Plan

Goal: document the next real boundary before moving lower-level retained
trace/progress/checkpoint infrastructure.

Files inspected:

- `docs/architecture/v2-trace-status-progress-plan.md`
- `src/runtime/runner.ts`
- `src/runtime/step-handlers/checkpoint.ts`
- `src/runtime/reducer.ts`
- `src/runtime/snapshot-writer.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/trace-writer.ts`
- `src/runtime/progress-projector.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/unit/runtime/event-log-round-trip.test.ts`
- `tests/unit/runtime/progress-projector.test.ts`

Files changed:

- `docs/architecture/v2-trace-progress-checkpoint-boundary-plan.md`
- `docs/architecture/v2-checkpoint-4.31.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. This is a planning checkpoint.

Concerns:

- Checkpoint resume remains retained-runtime-owned.
- v1 trace/state snapshot infrastructure remains retained-runtime-owned.
- retained v1 progress projection remains in `src/runtime/progress-projector.ts`.

Next recommended action: stop before moving lower-level retained
trace/progress/checkpoint infrastructure. The next useful work is checkpoint
resume ownership or old runner/handler test classification.

## 2026-05-04 - Phase 4.30.1 Run-Status Dependency Direction Cleanup

Goal: clean up neutral run-status imports so already-moved shared helpers are
not reached through retained runtime compatibility wrappers.

Files inspected:

- `src/run-status/projection-common.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`

Files changed:

- `src/run-status/projection-common.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-checkpoint-4.30.1.md`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts`:
  passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No intended behavior change. `projection-common.ts` now uses
`src/shared/result-path.ts`, and `v1-run-folder.ts` now uses
`src/shared/run-relative-path.ts`.

Concerns:

- Neutral status modules still depend on retained runtime for retained v1 trace
  reading, reduction, and checkpoint writer validation.
- Progress projection, trace writer, reducer implementation, snapshot writer,
  checkpoint resume, runner, and step handlers did not move.

Next recommended action: validate this cleanup, then write the
trace/progress/checkpoint boundary plan before moving lower-level retained
infrastructure.

## 2026-05-04 - Phase 4.30 V1 Run-Status Module Split

Goal: split retained v1 run-folder status projection out of the public
dispatcher without moving retained trace/reducer/checkpoint helper modules.

Files inspected:

- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `src/run-status/v2-run-folder.ts`
- `tests/runner/run-status-facade.test.ts`
- `tests/runner/run-status-projection.test.ts`

Files changed:

- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-checkpoint-4.30.md`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/fresh-run-root.test.ts tests/runner/build-checkpoint-exec.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No intended behavior change. The public dispatcher now
delegates retained v1 projection to `src/run-status/v1-run-folder.ts` and
marked core-v2 projection to `src/run-status/v2-run-folder.ts`.

Concerns:

- The retained v1 projector still depends on retained
  trace/reducer/checkpoint helpers.
- Progress projection, trace writer, reducer implementation, snapshot writer,
  checkpoint resume, runner, and step handlers did not move.

Next recommended action: validate this slice. Further status/progress work
should pause before moving retained trace, reducer, progress, snapshot,
checkpoint, runner, or handler infrastructure.

## 2026-05-04 - Phase 4.29 V2 Run-Status Module Split

Goal: split marked core-v2 run-folder status projection out of the public
dispatcher without moving retained v1 trace/reducer/checkpoint helpers.

Files inspected:

- `src/run-status/project-run-folder.ts`
- `src/runtime/run-status-projection.ts`
- `tests/runner/run-status-facade.test.ts`
- `tests/runner/run-status-projection.test.ts`
- `docs/architecture/v2-trace-status-progress-plan.md`

Files changed:

- `src/run-status/project-run-folder.ts`
- `src/run-status/projection-common.ts`
- `src/run-status/v2-run-folder.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-checkpoint-4.29.md`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/fresh-run-root.test.ts tests/runner/build-checkpoint-exec.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No intended behavior change. The marked core-v2 run-folder
projection now lives in `src/run-status/v2-run-folder.ts`; the public
dispatcher calls it when retained v1 trace reading fails and the trace is a
marked core-v2 trace.

Concerns:

- The retained v1 status path still depends on retained
  trace/reducer/checkpoint helpers.
- Progress projection, trace reader/writer, reducer, snapshot writer,
  checkpoint resume, runner, and step handlers did not move.

Next recommended action: validate this slice. Any further status work should
split retained v1 run-folder projection only with an explicit v1
trace/reducer/checkpoint ownership boundary.

## 2026-05-04 - Phase 4.28 Run-Status Dispatcher Move

Goal: move the run-status dispatcher implementation into the neutral
`src/run-status/` namespace without moving retained trace/reducer/checkpoint
helpers.

Files inspected:

- `src/runtime/run-status-projection.ts`
- `src/run-status/project-run-folder.ts`
- `tests/runner/run-status-projection.test.ts`
- `tests/runner/run-status-facade.test.ts`
- `docs/architecture/v2-trace-status-progress-plan.md`

Files changed:

- `src/run-status/project-run-folder.ts`
- `src/runtime/run-status-projection.ts`
- `tests/runner/run-status-projection.test.ts`
- `docs/architecture/v2-checkpoint-4.28.md`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/fresh-run-root.test.ts tests/runner/build-checkpoint-exec.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Note: one parallel `check-flow-drift` attempt raced with the emit-flow drift
fixture tests and saw temporary `never-a-mode.json` files. The fixture cleanup
removed those files, and `npm run check-flow-drift` passed when rerun by
itself.

Behavior changed? No intended behavior change. The same dispatcher now lives in
`src/run-status/project-run-folder.ts`; `src/runtime/run-status-projection.ts`
re-exports it for compatibility.

Concerns:

- The dispatcher still depends on retained v1 trace/reducer/checkpoint helpers.
- Progress projection, trace reader/writer, reducer, snapshot writer,
  checkpoint resume, runner, and step handlers did not move.

Next recommended action: validate this slice. Any further status work should
split v1 and v2 run-folder projection under `src/run-status/`; do not move
progress/reducer/trace/snapshot code without a focused plan.

## 2026-05-04 - Phase 4.27 Public Run-Status Facade

Goal: move the public `runs show` import surface away from `src/runtime/`
without moving projection internals.

Files inspected:

- `src/cli/runs.ts`
- `src/runtime/run-status-projection.ts`
- `src/runtime/result-writer.ts`
- `tests/runner/run-status-projection.test.ts`
- `docs/architecture/v2-trace-status-progress-plan.md`

Files changed:

- `src/run-status/project-run-folder.ts`
- `src/cli/runs.ts`
- `src/runtime/result-writer.ts`
- `tests/runner/run-status-facade.test.ts`
- `tests/runner/run-status-projection.test.ts`
- `docs/architecture/v2-checkpoint-4.27.md`
- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-facade.test.ts tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/fresh-run-root.test.ts tests/runner/build-checkpoint-exec.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No intended behavior change. At the end of Phase 4.27, the
neutral facade delegated to `src/runtime/run-status-projection.ts`; the CLI and
public status behavior tests imported the facade. Phase 4.28 later moved the
dispatcher body into the neutral facade.

Concerns:

- At the end of Phase 4.27, `src/runtime/run-status-projection.ts` remained the
  implementation and was not deletable. Phase 4.28 later turned it into a
  compatibility re-export.
- No progress projection, reducer, trace reader/writer, snapshot, checkpoint,
  runner, or step-handler code moved.

Next recommended action: validate this slice. If green, continue only with
another narrow ownership slice; stop before moving projection internals.

## 2026-05-04 - Phase 4.26 Trace, Status, And Progress Ownership Plan

Goal: plan trace/status/progress ownership before moving operator-facing
projection code.

Files inspected:

- `src/runtime/run-status-projection.ts`
- `src/runtime/progress-projector.ts`
- `src/runtime/reducer.ts`
- `src/runtime/append-and-derive.ts`
- `src/runtime/snapshot-writer.ts`
- `src/runtime/trace-reader.ts`
- `src/runtime/trace-writer.ts`
- `src/core-v2/projections/status.ts`
- `src/core-v2/projections/progress.ts`
- `src/cli/runs.ts`
- `src/shared/progress-output.ts`

Files changed:

- `docs/architecture/v2-trace-status-progress-plan.md`
- `docs/architecture/v2-checkpoint-4.26.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/unit/runtime/progress-projector.test.ts tests/contracts/progress-event-schema.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No runtime behavior changed. No trace, status, progress,
snapshot, reducer, runner, handler, or checkpoint code moved.

Concerns:

- This is a real operator-facing boundary. `runs show`, progress JSONL,
  v1 trace/reducer/snapshot state, and v2 projection compatibility should be
  reviewed before moving projection internals.
- The next safe implementation slice is only a neutral public import surface
  for `projectRunStatusFromRunFolder(...)`, not a rewrite of status/progress
  behavior.

Next recommended action: validate this packet and stop for review before moving
`run-status-projection.ts`, `progress-projector.ts`, trace reader/writer,
reducer, snapshot writer, or checkpoint-resume-adjacent code.

## 2026-05-04 - Phase 4.25 Result Path Helper Move

Goal: implement the path-only result helper extraction recommended by Phase
4.24 without merging retained and v2 result writers.

Files inspected:

- `src/runtime/result-writer.ts`
- `src/core-v2/run/result-writer.ts`
- `src/runtime/runner.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/operator-summary-writer.ts`
- `src/cli/circuit.ts`

Files changed:

- `src/shared/result-path.ts`
- `src/runtime/result-writer.ts`
- `src/core-v2/run/result-writer.ts`
- `src/runtime/runner.ts`
- `src/core-v2/projections/progress.ts`
- `src/shared/operator-summary-writer.ts`
- `src/cli/circuit.ts`
- `tests/runner/result-path-compat.test.ts`
- `docs/architecture/v2-checkpoint-4.25.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-result-writer-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/result-path-compat.test.ts tests/runner/runtime-smoke.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/run-status-projection.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fanout-runtime.test.ts tests/core-v2 tests/parity tests/runner/cli-v2-runtime.test.ts`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No intended behavior change. The shared helper owns the
`reports/result.json` path, while retained and v2 result writers remain
separate.

Concerns:

- `src/runtime/result-writer.ts` is still live and not deletable.
- The result writers still have different lifecycle ownership; do not merge
  them without a trace/status/progress ownership review.

Next recommended action: after validation, continue with a trace/status/progress
ownership plan if more narrowing is needed. Do not move those projection
modules without a plan.

## 2026-05-04 - Phase 4.24 Result Writer Plan

Goal: decide whether result writing can be narrowed safely before moving any
code across the retained/v2 result boundary.

Files inspected:

- `src/runtime/result-writer.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/schemas/result.ts`
- `src/runtime/runner.ts`
- `src/runtime/run-status-projection.ts`
- `src/runtime/step-handlers/sub-run.ts`
- `src/runtime/step-handlers/fanout.ts`
- `tests/runner/runtime-smoke.test.ts`
- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/runner/run-status-projection.test.ts`

Files changed:

- `docs/architecture/v2-result-writer-plan.md`
- `docs/architecture/v2-checkpoint-4.24.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`:
  passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No runtime behavior changed. This is a planning slice only.

Concerns:

- The retained and v2 result writers both write `reports/result.json`, but
  their lifecycle ownership differs enough that merging them now would be too
  broad.
- `checkpoint_waiting` remains retained-only and intentionally has no
  `reports/result.json`.

Next recommended action: after validation, implement only a path-helper
extraction for `reports/result.json` if the team wants a low-risk next code
slice. Do not merge retained and v2 writers yet.

## 2026-05-04 - Phase 4.23 Heavy Boundary Plan

Goal: stop the mechanical helper-extraction lane at the real architecture
boundary and classify the remaining runtime clusters before any risky move.

Files inspected:

- `docs/architecture/v2-connector-materializer-plan.md`
- `docs/architecture/v2-registry-ownership-plan.md`
- `docs/architecture/v2-deletion-plan.md`
- `scripts/release/emit-current-capabilities.mjs`
- `generated/release/current-capabilities.json`

Files changed:

- `docs/architecture/v2-heavy-boundary-plan.md`
- `docs/architecture/v2-checkpoint-4.23.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`
- `scripts/release/emit-current-capabilities.mjs`
- `generated/release/current-capabilities.json`

Tests run:

- `npm run check`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`
- `npm run lint`
- `npm run build`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`

Behavior changed? No runtime behavior changed. This is a planning and evidence
correction slice. Release evidence for write-capable worker disclosure now
includes both the shared implementation and runtime compatibility wrapper.

Concerns:

- Old runtime deletion is still not approved.
- Remaining runtime namespace work crosses real product/safety boundaries.

Next recommended action: review the heavy-boundary plan before implementing any
move involving connectors, relay materialization, registries, router/catalog,
trace/status/progress, checkpoint resume, the old runner, or old handlers.

## 2026-05-04 - Phase 4.22 Config Loader Move

Goal: continue retained-runtime narrowing without changing config precedence or
connector selection by moving schema-backed config discovery out of the runtime
namespace.

Files inspected:

- `src/runtime/config-loader.ts`
- `tests/runner/config-loader.test.ts`
- `src/cli/circuit.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/config-loader.ts`
- `src/runtime/config-loader.ts`
- `src/cli/circuit.ts`
- `tests/runner/config-loader.test.ts`
- `docs/architecture/v2-checkpoint-4.22.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`
- `npx vitest run tests/runner/config-loader.test.ts tests/core-v2/connectors-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/flow-model-effort.test.ts tests/runner/runner-relay-provenance.test.ts`
- `npm run lint`
- `npm run build`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`

Behavior changed? No runtime behavior changed. Config discovery now lives in
`src/shared/config-loader.ts`; `src/runtime/config-loader.ts` re-exports it for
compatibility. User-global, project, and invocation layer ordering is unchanged.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules, relay materialization, registries, router,
  trace/status projection, and checkpoint resume remain heavy-review
  boundaries.

Next recommended action: run validation, then stop. The obvious remaining
runtime namespace moves are no longer small helper extractions.

## 2026-05-04 - Phase 4.21 Operator Summary Writer Move

Goal: continue retained-runtime narrowing without changing user-visible summary
behavior by moving shared operator summary output infrastructure out of the
runtime namespace.

Files inspected:

- `src/runtime/operator-summary-writer.ts`
- `tests/runner/operator-summary-writer.test.ts`
- `scripts/release/emit-current-capabilities.mjs`
- `src/cli/circuit.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/operator-summary-writer.ts`
- `src/runtime/operator-summary-writer.ts`
- `src/cli/circuit.ts`
- `scripts/release/emit-current-capabilities.mjs`
- `tests/runner/operator-summary-writer.test.ts`
- `docs/architecture/v2-checkpoint-4.21.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`
- `npx vitest run tests/runner/operator-summary-writer.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/progress-event-schema.test.ts tests/contracts/terminology-active-surface.test.ts`
- `npm run lint`
- `npm run build`
- `npm run check-release-infra`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`

Behavior changed? No runtime behavior changed. Operator summary writing now
lives in `src/shared/operator-summary-writer.ts`; `src/runtime/operator-summary-writer.ts`
re-exports it for compatibility. The CLI imports the shared writer directly.

Concerns:

- Old runtime deletion is still not approved.
- User-visible summary wording did not intentionally change.
- Connector subprocess modules, relay materialization, and registries remain
  heavy-review boundaries.

Next recommended action: run validation, then stop if the next remaining move
would touch connector subprocess modules, relay materialization, registries,
checkpoint resume ownership, selector behavior, or old runtime deletion.

## 2026-05-04 - Phase 4.20 Manifest Snapshot Helper Move

Goal: continue retained-runtime narrowing without changing resume/checkpoint
ownership by moving the old manifest snapshot byte-match helper out of the
runtime namespace.

Files inspected:

- `src/runtime/manifest-snapshot-writer.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `src/runtime/run-status-projection.ts`
- `src/cli/handoff.ts`
- `tests/unit/runtime/event-log-round-trip.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/manifest-snapshot.ts`
- `src/runtime/manifest-snapshot-writer.ts`
- `src/runtime/run-status-projection.ts`
- `src/cli/handoff.ts`
- `tests/unit/runtime/event-log-round-trip.test.ts`
- `docs/architecture/v2-checkpoint-4.20.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`
- `npm run lint`
- `npx vitest run tests/unit/runtime/event-log-round-trip.test.ts tests/runner/run-status-projection.test.ts tests/runner/fresh-run-root.test.ts tests/runner/handoff-hook-adapters.test.ts`
- `npm run build`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`

Behavior changed? No runtime behavior changed. The old manifest snapshot
read/write/hash helper now lives in `src/shared/manifest-snapshot.ts`;
`src/runtime/manifest-snapshot-writer.ts` re-exports it for compatibility.
The v2 raw-byte manifest snapshot implementation remains separate in
`src/core-v2/run/manifest-snapshot.ts`.

Concerns:

- Old runtime deletion is still not approved.
- Checkpoint resume ownership did not change.
- Connector subprocess modules, relay materialization, and registries remain
  heavy-review boundaries.

Next recommended action: run validation, then stop if the next remaining move
would touch connector subprocess modules, relay materialization, registries,
checkpoint resume ownership, selector behavior, or old runtime deletion.

## 2026-05-04 - Phase 4.19 Flow-Kind Policy Wrapper Move

Goal: continue retained-runtime narrowing without crossing a production-sensitive
boundary by moving generated-surface/fixture flow-kind policy ownership out of
the runtime namespace.

Files inspected:

- `src/runtime/policy/flow-kind-policy.ts`
- `scripts/policy/flow-kind-policy.mjs`
- `scripts/policy/flow-kind-policy.d.mts`
- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `tests/contracts/flow-kind-policy.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `docs/architecture/v2-deletion-plan.md`

Files changed:

- `src/shared/flow-kind-policy.ts`
- `src/runtime/policy/flow-kind-policy.ts`
- `src/cli/circuit.ts`
- `src/cli/create.ts`
- `scripts/policy/flow-kind-policy.mjs`
- `scripts/policy/flow-kind-policy.d.mts`
- `tests/contracts/flow-kind-policy.test.ts`
- `tests/runner/explore-e2e-parity.test.ts`
- `docs/architecture/v2-checkpoint-4.19.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-runtime-import-inventory.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/contracts/flow-kind-policy.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/cli-v2-runtime.test.ts`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

Behavior changed? No runtime behavior changed. `validateCompiledFlowKindPolicy`
now lives in `src/shared/flow-kind-policy.ts`; `src/runtime/policy/flow-kind-policy.ts`
re-exports it for compatibility. The underlying canonical policy table remains
in `scripts/policy/flow-kind-policy.mjs`.

Concerns:

- Old runtime deletion is still not approved.
- Connector subprocess modules, relay materialization, and registries remain
  heavy-review boundaries.

Next recommended action: run validation, then continue only if the next slice
does not move connector subprocess modules, relay materialization, registries,
checkpoint resume, or old runtime deletion.

## 2026-05-04 - Phase 4.4 Default-Routing Candidate

Goal: begin a default-routing candidate slice without switching the production
default runtime or deleting old runtime code.

Files inspected:

- `src/cli/circuit.ts`
- `src/cli/runs.ts`
- `src/runtime/run-status-projection.ts`
- `src/schemas/run-status.ts`
- `src/schemas/progress-event.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `tests/runner/cli-v2-runtime.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `src/runtime/run-status-projection.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/projections/progress.ts`
- `src/schemas/progress-event.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.4.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Normal CLI default behavior is unchanged. The internal v2
path now has a matrix-based candidate selector behind
`CIRCUIT_V2_RUNTIME_CANDIDATE=1`, v2 run folders work with `runs show --json`,
and v2 progress includes nested child-run and fanout lifecycle evidence.

Concerns:

- Default routing is still not switched.
- Old runtime deletion is still not approved.
- Checkpoint pause/resume remains old-runtime-owned.
- Modes outside the matrix intentionally stay on the retained runtime.

Next recommended action: review the Phase 4.4 packet, then prepare a default
switch proposal only for matrix-supported fresh-run modes.

## 2026-05-04 - Phase 4.5 Default-Switch Proposal Hardening

Goal: prepare the default-routing proposal for matrix-supported fresh-run modes
without switching the production default runtime.

Files inspected:

- `src/cli/circuit.ts`
- `src/runtime/run-status-projection.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/core-v2/projections/progress.ts`
- `src/schemas/progress-event.ts`
- `tests/runner/run-status-projection.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/contracts/progress-event-schema.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `src/runtime/run-status-projection.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/core-v2/projections/progress.ts`
- `src/schemas/progress-event.ts`
- `tests/runner/run-status-projection.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/contracts/progress-event-schema.test.ts`
- `docs/architecture/v2-checkpoint-4.5.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Normal CLI default behavior is unchanged. The candidate path
is stricter around arbitrary fixtures, v2 traces now carry an explicit
`engine: "core-v2"` marker, v2 open status projection is retry-aware, and
fanout progress branch events carry `branch_kind` without requiring every
branch to expose child-run/worktree semantics.

Concerns:

- Default routing is still not switched.
- Old runtime deletion is still not approved.
- Checkpoint pause/resume remains old-runtime-owned.
- The next review should decide whether the selector can become the normal
  default for matrix-supported fresh-run modes.

Next recommended action: package Phase 4.5 for review as the default-switch
proposal gate.

## 2026-05-04 - Phase 4.6 Default-Switch Proposal

Goal: implement the default selector for matrix-supported fresh-run modes while
keeping rollback, strict opt-in, retained runtime fallback, and old runtime
code intact.

Files inspected:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.5.md`
- `docs/architecture/v2-worklog.md`

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.6.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed after rerunning without concurrent stale-file tests.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Normal fresh-run routing now uses the matrix-supported v2
selector by default. Unsupported modes, checkpoint resume, checkpoint-waiting
depths, and arbitrary explicit fixtures still use the retained runtime.
`CIRCUIT_DISABLE_V2_RUNTIME=1` rolls normal routing back to the retained
runtime. Strict `CIRCUIT_V2_RUNTIME=1` still force-tests v2 and fails closed for
unsupported invocations.

Concerns:

- Old runtime deletion is still not approved.
- Checkpoint pause/resume remains old-runtime-owned.
- Candidate mode is now primarily diagnostic and should be removed or
  reclassified after the default selector is reviewed.

Next recommended action: run full validation, then package Phase 4.6 for review
as the actual default-switch proposal gate.

## 2026-05-04 - Phase 4.6.1 Default Selector Stabilization

Goal: address the post-Phase-4.6 review note that exported
`main(..., { composeWriter })` behavior must not be silently ignored by the
default v2 selector.

Files inspected:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.6.md`
- `docs/architecture/v2-worklog.md`

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.6.md`
- `docs/architecture/v2-checkpoint-4.6.1.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Programmatic `composeWriter` injections now keep normal and
candidate routing on the retained runtime. Strict v2 opt-in fails closed when
`composeWriter` is supplied, because core-v2 does not yet expose an equivalent
compose writer hook.

Concerns:

- Old runtime deletion is still not approved.
- Candidate diagnostics should be removed or renamed after one release soak.

Next recommended action: run focused validation, then full validation.

## 2026-05-03 - Phase 4.1.1 Production Readiness Corrections

Goal: address the remaining review blockers before any opt-in v2 CLI routing.

Files inspected:

- `src/core-v2/executors/relay.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/runtime/step-handlers/relay.ts`
- `src/runtime/runner-types.ts`
- `docs/architecture/v2-deletion-plan.md`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/core-v2/core-v2-baseline.test.ts`

Files changed:

- `src/core-v2/executors/relay.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/runtime/relay-support.ts`
- `src/runtime/step-handlers/relay.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/default-executors-v2.test.ts`
- `docs/architecture/v2-checkpoint-4.1.1.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No production CLI behavior changed. The opt-in v2 relay path
now treats manifest connector identity as authoritative, blocks accidental
schema-tagged text writes, and proves one generated Review flow can run through
default v2 executors without parity helper executors.

Concerns:

- `RelayFn` still lives in `src/runtime/runner-types.ts` and should move to a
  neutral connector type module before old runtime deletion.
- Checkpoint resume remains intentionally retained on the old runtime path.

Next recommended action: run validation and request review before starting
opt-in v2 CLI routing.

## 2026-05-03 - Phase 4.1.2 Connector Precedence Preflight

Goal: fix the reviewer-identified custom connector descriptor precedence issue
before adding any opt-in v2 CLI routing.

Files inspected:

- `src/core-v2/connectors/resolver.ts`
- `src/core-v2/executors/relay.ts`
- `tests/core-v2/connectors-v2.test.ts`

Files changed:

- `src/core-v2/executors/relay.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2/connectors-v2.test.ts`: passed.
- Full validation pending.

Behavior changed? No production CLI behavior changed. The opt-in v2 relay
resolution bridge now resolves custom step connectors with the same effective
layer precedence used by the connector resolver: later config layers override
earlier connector descriptors.

Concerns:

- This is still a preflight for opt-in CLI routing. It does not switch the CLI
  or change old runtime deletion status.

Next recommended action: run validation, then start the opt-in v2 CLI routing
slice if the preflight remains green.

## 2026-05-04 - Phase 4.2.5 Sweep Opt-in CLI Routing

Goal: expand the internal v2 CLI opt-in path to generated Sweep default fresh
runs.

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.5.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Default CLI behavior did not change. With
`CIRCUIT_V2_RUNTIME=1`, fresh Sweep default runs can now route through the v2
CLI path. The opt-in allowlist now covers the current public generated flows:
Review, Fix, Build, Explore, Migrate, and Sweep.

Concerns:

- The generated Sweep default manifest currently has no fanout step, so this is
  not fanout CLI parity.
- v2 runtime progress/status projection is still incomplete.
- Old runtime deletion remains out of scope.

Next recommended action: run validation. If green, pause before default-routing
work, because the next gate is progress/status parity and default-route
readiness rather than another small allowlist expansion.

## 2026-05-04 - Phase 4.3 Progress/Status Projection

Goal: close the biggest default-routing blocker left after public-flow opt-in
coverage by adding CLI-visible v2 runtime progress.

Files changed:

- `src/core-v2/domain/trace.ts`
- `src/core-v2/trace/trace-store.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/projections/status.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/executors/sub-run.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/cli/circuit.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2 tests/parity`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Default CLI behavior did not change. With
`CIRCUIT_V2_RUNTIME=1` and `--progress jsonl`, v2 fresh runs now emit runtime
progress in addition to `route.selected`.

Concerns:

- v2 still does not implement checkpoint waiting or resume progress; those
  modes remain fail-closed or old-runtime-owned.
- Progress parity should get one more review before v2 becomes the default CLI
  runtime.

Next recommended action: run full validation. If green, prepare a heavyweight
review packet before default-routing work.

## 2026-05-04 - Phase 4.2.4 Migrate Opt-in CLI Routing

Goal: expand the internal v2 CLI opt-in path to generated Migrate default fresh
runs and prove child Build sub-run execution through the CLI path.

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.4.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Default CLI behavior did not change. With
`CIRCUIT_V2_RUNTIME=1`, fresh Migrate default runs can now route through the v2
CLI path and launch a generated Build child run. Sweep remains rejected by the
opt-in allowlist.

Concerns:

- Migrate deep/autonomous behavior beyond the generated default smoke is not
  claimed here.
- v2 runtime progress/status projection is still incomplete.
- Old runtime deletion remains out of scope.

Next recommended action: run validation, then continue to Sweep only if this
checkpoint remains green.

## 2026-05-04 - Phase 4.2.3 Explore Opt-in CLI Routing

Goal: expand the internal v2 CLI opt-in path by one flow, starting with
generated Explore default fresh runs.

Files changed:

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.3.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Default CLI behavior did not change. With
`CIRCUIT_V2_RUNTIME=1`, fresh Explore default runs can now route through the v2
CLI path. Migrate and Sweep remain rejected by the opt-in allowlist.

Concerns:

- Explore tournament mode still contains a checkpoint-waiting path and remains
  blocked by the checkpoint-depth guard.
- v2 runtime progress/status projection is still incomplete.
- Old runtime deletion remains out of scope.

Next recommended action: run validation, then continue one-flow-at-a-time with
Migrate only if the checkpoint remains green.

## 2026-05-03 - Phase 4.2.2 Opt-in CLI Evidence Completion

Goal: finish the reviewer-requested evidence before expanding the v2 CLI
allowlist.

Files changed:

- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.2.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No default CLI behavior changed. `CIRCUIT_V2_RUNTIME=1`
remains explicit and opt-in. The CLI evidence now proves normal generated Fix
lite resolution, real custom connector execution without an injected relayer,
and fail-closed rejection for Explore, Migrate, and Sweep.

Concerns:

- v2 runtime progress/status projection is still incomplete.
- Explore, Migrate, and Sweep remain outside the opt-in v2 CLI allowlist.
- Old runtime deletion remains out of scope.

Next recommended action: run validation, then proceed to one-flow-at-a-time
opt-in expansion only after this checkpoint is green.

## 2026-05-03 - Phase 4.2.1 Opt-in CLI Evidence Hardening

Goal: close the reviewer gap around the Phase 4.2 opt-in CLI allowlist before
expanding v2 routing.

Files changed:

- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.1.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No default CLI behavior changed. `CIRCUIT_V2_RUNTIME=1`
remains explicit and opt-in. The test evidence now includes generated Fix lite,
generated Build default, route-only progress behavior, and CLI-level custom
connector descriptor precedence.

Concerns:

- v2 runtime progress is still not threaded into the old progress projection
  surface. The opt-in CLI path currently emits `route.selected` only.
- Explore, Migrate, and Sweep remain outside the opt-in v2 CLI allowlist.

Next recommended action: run validation, package Phase 4.2.1 for review, and
wait for reviewer approval before expanding opt-in routing.

## 2026-05-03 - Phase 4.2 Opt-in v2 CLI Routing

Goal: add an explicitly opt-in v2 CLI execution path for fresh runs without
changing the production default runtime.

Files inspected:

- `src/cli/circuit.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/executors/checkpoint.ts`
- `tests/runner/cli-router.test.ts`

Files changed:

- `src/cli/circuit.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/executors/compose.ts`
- `src/core-v2/executors/sub-run.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-checkpoint-4.2.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? Production default behavior did not change. When
`CIRCUIT_V2_RUNTIME=1` is set, fresh Review/Fix/Build runs can use the v2
runtime through the CLI. Resume, checkpoint-waiting depths, and complex flows
outside the current opt-in allowlist fail closed before v2 writes a run folder.

Concerns:

- The opt-in allowlist is intentionally narrow. Explore, Migrate, and Sweep
  should be added only with dedicated CLI smoke coverage.
- Default routing and old runtime deletion remain out of scope.

Next recommended action: run validation and request review before expanding
the opt-in allowlist or considering any default routing.

## 2026-05-03 - Phase 4.1 Production Runtime Readiness

Goal: address Checkpoint 4 review findings without deleting old runtime code.

Files changed:

- `src/flows/types.ts`
- `src/flows/*/index.ts`
- `src/runtime/catalog-derivations.ts`
- `src/core-v2/run-files/report-validator.ts`
- `src/core-v2/run-files/run-file-store.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/run/v1-compat.ts`
- `src/core-v2/domain/trace.ts`
- `src/core-v2/executors/compose.ts`
- `src/core-v2/executors/verification.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/executors/relay.ts`
- `src/core-v2/executors/index.ts`
- `src/core-v2/executors/fanout.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/core-v2/sub-run-v2.test.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/explore-v2.test.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.1.md`
- `docs/architecture/v2-worklog.md`

Behavior changed? No production CLI behavior changed. The opt-in v2 path now
has production-capable bridges for compose, verification, checkpoint safe
choices, and relay execution. Report validation is enforced at schema-tagged
run-file writes through the catalog-derived report schema registry.

Checkpoint decision: old runner/checkpoint resume remains retained. v2 supports
fresh-run safe checkpoint choices, but deep/tournament pause/resume is not yet a
v2 production path.

Tests run so far:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2/core-v2-baseline.test.ts tests/core-v2/connectors-v2.test.ts tests/core-v2/sub-run-v2.test.ts tests/core-v2/fanout-v2.test.ts tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: initially failed when run in parallel with
  `npm run test:fast` because the emit-flow drift tests temporarily created
  stale sibling fixtures; passed when rerun serially after the tests cleaned up.
- `npm run verify`: passed.
- `git diff --check`: passed.

Next recommended action: package Phase 4.1 for review. Do not delete old runtime
files yet.

## 2026-05-03 - Phase 7 Pre-Deletion Analysis

Goal: prepare Checkpoint 4 without deleting old runtime files.

Files inspected:

- `src/runtime/`
- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
- `src/runtime/step-handlers/`
- `src/runtime/compile-schematic-to-flow.ts`
- `src/runtime/catalog-derivations.ts`
- `src/runtime/selection-resolver.ts`
- `src/runtime/relay-selection.ts`
- `src/runtime/registries/`
- `src/cli/circuit.ts`
- `src/core-v2/`
- `tests/runner/`
- `tests/core-v2/`
- `tests/parity/`
- `scripts/emit-flows.mjs`
- `scripts/release/capture-golden-run-proofs.mjs`

Files changed:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-checkpoint-4.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed.
- `npm run lint`: passed, Biome checked 396 files.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed, 11 files and 63 tests.
- `npm run test:fast`: passed, 63 files and 842 tests.
- `npm run test`: passed, 116 files, 1262 passed, 6 skipped.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Behavior changed? No. This is a documentation-only pre-deletion checkpoint.

Concerns:

- The old graph runner and step handlers have v2 replacements, but production
  CLI execution still imports `runCompiledFlow`.
- Some files under `src/runtime/` are still live compiler, catalog, registry,
  connector, config, projection, or handoff infrastructure and should not be
  deleted as part of a broad tree removal.
- Real connector subprocess execution and config-layer threading should be
  routed through v2 before old relay deletion.
- Checkpoint resume remains the largest unresolved production behavior before
  removing the old runner entirely.

Next recommended action: stop for Checkpoint 4 review before deleting old
runtime code.

## 2026-05-03 - Phase 4 Manifest Snapshot Binding Hardening

Goal: make the v2 manifest snapshot useful as a future resume/sub-run trust
boundary, not just a self-consistent JSON file.

Files inspected:

- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `tests/parity/review-v2.test.ts`

Files changed:

- `src/core-v2/run/manifest-snapshot.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-phase-4-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2/core-v2-baseline.test.ts tests/parity/review-v2.test.ts`:
  passed.

Behavior changed? No production behavior changed. The opt-in v2 snapshot reader
now rejects mismatched run id, flow id, hash, flow-id-in-bytes, and bytes that
do not parse through the current `CompiledFlow` schema.

Concerns:

- This still does not implement resume. It creates the validation boundary
  that resume and child-run snapshot checks can use.

Next recommended action: run validation, then proceed to Phase 5 authoring and
compiler simplification if Phase 4 remains green.

## 2026-05-03 - Phase 5 Authoring Schema First Slice

Goal: reduce authoring/compiler complexity after v2 parity by starting with
the smallest schema simplification that preserves generated output.

Files inspected:

- `src/schemas/flow-schematic.ts`
- `src/runtime/compile-schematic-to-flow.ts`
- `src/schemas/route-policy.ts`
- `tests/contracts/flow-schematic.test.ts`
- `tests/contracts/compile-schematic-to-flow.test.ts`

Files changed:

- `src/schemas/flow-schematic.ts`
- `src/schemas/flow-schematic-policy.ts`
- `tests/contracts/flow-schematic.test.ts`
- `docs/architecture/v2-phase-5-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/contracts/flow-schematic.test.ts tests/contracts/compile-schematic-to-flow.test.ts`:
  passed after updating expected invalid-execution error wording.
- `npx vitest run tests/contracts/flow-schematic.test.ts tests/contracts/compile-schematic-to-flow.test.ts tests/contracts/flow-kind-policy.test.ts`:
  passed.

Behavior changed? No runtime or generated behavior changed. Authoring execution
validation now uses a discriminated union, so invalid execution objects report
strict variant errors instead of the old manual cross-field messages.

Concerns:

- Report-ref-first authoring and Build checkpoint policy ownership remain
  deferred because they can affect generated manifest parity.

Next recommended action: run full validation, then proceed to generated-surface
cleanup if Phase 5 remains green.

## 2026-05-03 - Phase 6 Generated-Surface Cleanup

Goal: make generated surface ownership explicit, drift-resistant, and free of
known stale contract references.

Files inspected:

- `docs/generated-surfaces.md`
- `scripts/emit-flows.mjs`
- `tests/unit/emit-flows-drift.test.ts`
- `tests/contracts/catalog-completeness.test.ts`
- `specs/invariants.json`
- `specs/reports.json`
- `specs/behavioral/prose-yaml-parity.md`

Files changed:

- `scripts/emit-flows.mjs`
- `docs/generated-surfaces.md`
- `tests/contracts/catalog-completeness.test.ts`
- `specs/invariants.json`
- `specs/reports.json`
- `specs/behavioral/prose-yaml-parity.md`
- `docs/architecture/v2-phase-6-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run build`: passed before regenerating surfaces.
- `node scripts/emit-flows.mjs`: regenerated surfaces.

Behavior changed? No runtime behavior changed. The generated source map now
documents surface ownership more explicitly, and stale contract links now point
to `docs/contracts/compiled-flow.md`.

Concerns:

- No `commands/README.md` exists today; Phase 6 documents that absence rather
  than creating a new generated surface.

Next recommended action: run full validation, then begin Phase 7 pre-deletion
analysis.

## 2026-05-03 - Phase 4 Complex-Flow Parity Slice

Goal: complete the approved Phase 4 runtime parity slice for complex flow
behavior: sub-run, fanout, connector safety, worktree cleanup, aggregate
reports, and representative Explore/Migrate/Sweep parity.

Files inspected:

- `src/runtime/step-handlers/sub-run.ts`
- `src/runtime/step-handlers/fanout.ts`
- `src/runtime/step-handlers/fanout/branch-resolution.ts`
- `src/runtime/step-handlers/fanout/join-policy.ts`
- `src/runtime/relay-selection.ts`
- `src/runtime/connectors/claude-code.ts`
- `src/runtime/connectors/codex.ts`
- `src/schemas/connector.ts`
- `src/schemas/step.ts`
- `generated/flows/explore/circuit.json`
- `generated/flows/explore/tournament.json`
- `generated/flows/migrate/circuit.json`
- `generated/flows/sweep/circuit.json`

Files changed:

- `src/core-v2/domain/trace.ts`
- `src/core-v2/run/result-writer.ts`
- `src/core-v2/run/run-context.ts`
- `src/core-v2/run/child-runner.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/executors/index.ts`
- `src/core-v2/executors/sub-run.ts`
- `src/core-v2/executors/fanout.ts`
- `src/core-v2/fanout/aggregate-report.ts`
- `src/core-v2/fanout/branch-execution.ts`
- `src/core-v2/fanout/branch-expansion.ts`
- `src/core-v2/fanout/join-policy.ts`
- `src/core-v2/fanout/types.ts`
- `src/core-v2/fanout/worktree.ts`
- `src/core-v2/connectors/connector.ts`
- `src/core-v2/connectors/resolver.ts`
- `tests/core-v2/sub-run-v2.test.ts`
- `tests/core-v2/fanout-v2.test.ts`
- `tests/core-v2/connectors-v2.test.ts`
- `tests/parity/core-v2-parity-helpers.ts`
- `tests/parity/explore-v2.test.ts`
- `tests/parity/migrate-v2.test.ts`
- `tests/parity/sweep-v2.test.ts`
- `docs/architecture/v2-phase-4-notes.md`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npm run check`: passed before docs update.
- `npx vitest run tests/core-v2 tests/parity`: initially failed because new
  parity tests used non-UUID run ids with manifest snapshots, then passed after
  switching those run ids to UUIDs.

Behavior changed? No production behavior changed. The opt-in v2 path now has
sub-run execution, fanout execution, connector safety checks, aggregate report
writing, worktree cleanup, and representative complex-flow parity tests.

Concerns:

- v2 trace is closer to the current trace contract but still not fully schema
  identical.
- Real connector subprocess execution remains old-runtime-owned; v2 tests use
  injected connectors.
- Disjoint-merge validates branch file disjointness and cleanup, but does not
  yet merge branch worktrees into the parent tree.
- Resume and nested checkpoint handling remain deferred.

Next recommended action: run full validation, then review Phase 4 before
starting authoring/compiler simplification.

## 2026-05-02 - Phase 4 Manifest Snapshot Review Fix

Goal: address adversarial review finding that v2 snapshot bootstrap could
reuse a non-empty run directory or leave a snapshot behind on manifest hash
mismatch.

Files inspected:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `src/core-v2/trace/trace-store.ts`
- `tests/core-v2/core-v2-baseline.test.ts`

Files changed:

- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/manifest-snapshot.ts`
- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-worklog.md`

Tests run:

- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.

Behavior changed? No production behavior changed. The opt-in v2 runner now
rejects non-empty run directories before bootstrap writes, computes and checks
manifest hash before snapshot writing, and uses exclusive snapshot creation.

Concerns:

- This still covers fresh-run bootstrap only. Explicit resume behavior remains
  future Phase 4 work.

Next recommended action: continue Phase 4 with sub-run parity before fanout.
