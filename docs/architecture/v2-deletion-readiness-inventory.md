# Core-v2 Deletion Readiness Inventory

Date: 2026-05-05

Current status: superseded for cutover planning by
`docs/architecture/v2-final-cutover-policy.md`. This inventory remains useful
for finding old runtime files and tests, but its compatibility-preserving
recommendations are historical now.

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

The result:

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

## Runtime File Disposition

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
soft-deprecated in `src/compat/public-runtime-paths.ts`. This is metadata and
release-note scaffolding only: wrappers remain, old paths still work, no
import-time warnings are emitted, and deletion still requires review.

## Category Totals

| Category | Count | Current deletion-ready count |
|---|---:|---:|
| compatibility wrapper | 20 | 0 |
| retained fallback | 11 | 0 |
| retained product behavior | 9 | 0 |
| oracle/test support | 0 | 0 |
| neutral-move candidate | 16 | 0 |
| tiny deletion candidate | 0 | 0 |
| blocker/unknown | 0 | 0 |

No unknown owner remains after this inventory. That does not mean deletion is
ready. It means the blockers are known and policy-shaped.

## Retained Runner And Handler Test Disposition

| Bucket | Tests | Decision |
|---|---|---|
| retained fallback coverage | `tests/runner/agent-relay-roundtrip.test.ts`, `tests/runner/build-checkpoint-exec.test.ts`, `tests/runner/build-runtime-wiring.test.ts`, `tests/runner/check-evaluation.test.ts`, `tests/runner/checkpoint-handler-direct.test.ts`, `tests/runner/cli-v2-runtime.test.ts`, `tests/runner/codex-relay-roundtrip.test.ts`, `tests/runner/fresh-run-root.test.ts`, `tests/runner/handler-throw-recovery.test.ts`, `tests/runner/materializer-schema-parse.test.ts`, `tests/runner/pass-route-cycle-guard.test.ts`, `tests/runner/push-sequence-authority.test.ts`, `tests/runner/relay-invocation-failure.test.ts`, `tests/runner/run-relative-path.test.ts`, `tests/runner/run-status-projection.test.ts`, `tests/runner/runner-relay-connector-identity.test.ts`, `tests/runner/runner-relay-provenance.test.ts`, `tests/runner/runtime-smoke.test.ts`, `tests/runner/terminal-outcome-mapping.test.ts`, `tests/runner/terminal-verdict-derivation.test.ts`, `tests/runner/terminal-verdict-helper.test.ts`, `tests/runner/utility-cli.test.ts`, `tests/unit/runtime/event-log-round-trip.test.ts`, `tests/unit/runtime/progress-projector.test.ts` | Keep. These prove behavior still reached by retained/v1 folders, rollback, unsupported rows, retained status/progress, or compatibility surfaces. |
| oracle coverage | `tests/runner/build-report-writer.test.ts`, `tests/runner/build-verification-exec.test.ts`, `tests/runner/close-builder-registry.test.ts`, `tests/runner/compose-builder-registry.test.ts`, `tests/runner/explore-e2e-parity.test.ts`, `tests/runner/explore-report-writer.test.ts`, `tests/runner/explore-tournament-runtime.test.ts`, `tests/runner/fanout-handler-direct.test.ts`, `tests/runner/fanout-real-recursion.test.ts`, `tests/runner/fanout-runtime.test.ts`, `tests/runner/fix-report-writer.test.ts`, `tests/runner/fix-runtime-wiring.test.ts`, `tests/runner/migrate-runtime-wiring.test.ts`, `tests/runner/relay-handler-direct.test.ts`, `tests/runner/review-runtime-wiring.test.ts`, `tests/runner/sub-run-handler-direct.test.ts`, `tests/runner/sub-run-real-recursion.test.ts`, `tests/runner/sub-run-runtime.test.ts`, `tests/runner/sweep-runtime-wiring.test.ts`, `tests/runner/verification-handler-direct.test.ts` | Keep. These are still comparison proof for behavior v2 must preserve or deliberately retire. |
| migrated to v2 | none of the retained runner/handler tests | V2 coverage exists in `tests/core-v2/` and `tests/soak/`, but it does not make these retained tests deletable yet. |
| obsolete candidate | none | No retained runner or handler test is obsolete in this pass. |

Compatibility-import tests such as `tests/runner/config-loader.test.ts`,
`tests/runner/connector-shared-compat.test.ts`,
`tests/runner/operator-summary-writer.test.ts`,
`tests/runner/result-path-compat.test.ts`, and
`tests/runner/run-status-facade.test.ts` are not runner deletion blockers by
themselves, but they keep old import paths intentional until those paths are
retired.

## Deletion Blockers

Old runtime deletion remains blocked by live responsibilities:

- retained/v1 checkpoint folder resume;
- unsupported flow/mode/depth fallback outside the generated public catalog;
- arbitrary explicit fixture fallback;
- custom flow root fallback;
- programmatic `composeWriter` retained-runtime-only compatibility;
- rollback through `CIRCUIT_DISABLE_V2_RUNTIME=1`;
- retained trace, reducer, snapshot, progress, status, result, and checkpoint
  behavior;
- old connector compatibility wrappers under `src/runtime/connectors/**`;
- router, catalog/compiler modules, and compatibility wrappers still under
  `src/runtime`;
- retained runner and handler tests that are still fallback or oracle proof.

Runtime decision diagnostics are not an old runtime deletion blocker by
themselves. Phase 5.8.1 adds `CIRCUIT_SHOW_RUNTIME_DECISION=1` and keeps
`CIRCUIT_V2_RUNTIME_CANDIDATE=1` as a temporary alias, but that does not move or
delete retained execution code.

## Next Useful Slices

The next deletion-adjacent work should not delete files. Pick one narrow
decision at a time:

1. Decide whether rollback is a permanent operator safety feature.
2. Plan neutral ownership for router, catalog, or compiler modules before
   moving them; connector subprocesses and relay materialization moved to
   `src/connectors/**` in Phase 5.32.
3. Keep retained/v1 checkpoint folders supported unless a migration or
   retirement plan is approved.

Phase 5.7 resolved the programmatic `composeWriter` disposition without making
old runtime deletion possible: `composeWriter` remains retained-runtime-only
compatibility and should not be cloned into core-v2.

Phase 5.8.1 implements the runtime decision diagnostics rename:
`CIRCUIT_SHOW_RUNTIME_DECISION=1` is preferred and
`CIRCUIT_V2_RUNTIME_CANDIDATE=1` remains a temporary alias. The alias itself can
be removed later only by an explicit operator-facing slice.

Phase 5.9 resolves the arbitrary fixture disposition without making deletion
possible: arbitrary explicit fixtures, custom flow roots, and packaged host flow
roots remain retained-runtime-owned by default unless a future trusted-root or
deprecation policy explicitly changes that.

Phase 5.11 moves Explore tournament into the core-v2 selector matrix after
hardening v2 relay fanout branch execution and proving production checkpoint
wait/resume. This removes the last known generated public entry-mode gap in the
current catalog, but it does not change arbitrary fixture, custom-root,
rollback, retained/v1 checkpoint, public `composeWriter`, connector, or
oracle-test deletion blockers.

Phase 5.13 moves registry and catalog derivation implementations to
`src/flows/**`. The old `src/runtime/catalog-derivations.ts` and
`src/runtime/registries/**` paths are now compatibility re-exports. This reduces
the live `src/runtime/**` infrastructure surface, but it does not make retained
execution, retained/v1 checkpoint, router/compiler wrapper deletion, or old oracle-test deletion
safe.

Phase 5.56 moves retained runtime internal registry imports to the neutral
`src/flows/registries/**` owners and strengthens the wrapper import guard to use
the public runtime path manifest. The old runtime registry paths are still
compatibility re-exports; this removes an internal dependency on them, not the
public compatibility obligation.

Phase 5.32 moves connector subprocess modules and relay materialization to
`src/connectors/**`, with old `src/runtime/connectors/**` paths left as
compatibility re-exports. This removes the connector/materializer ownership
move from the deletion gate, but it does not approve deleting old connector
wrappers or changing connector behavior.

Phase 5.14 adds `src/compat/retained-runtime.ts` as the neutral facade for
retained fresh-run fallback, retained/v1 checkpoint resume, retained snapshot
derivation, retained trace reading, and retained trace reduction. This narrows
CLI/status/handoff imports, but the underlying retained modules remain live and
are not deletion-ready.

Phase 5.34 confirms that retained trace reader/writer, reducer, snapshot,
append-and-derive, progress projector, checkpoint resume, and retained
checkpoint handler implementations should not move yet. The approved work was
guard/test hardening around `src/compat/retained-checkpoint-folders.ts`, not
neutral implementation ownership.

Phase 5.35 cleans up imports for helper modules that were already neutral:
retained runtime code now imports manifest snapshot, run-relative path, relay
support, and write-capable worker disclosure helpers from `src/shared/**`
directly. The old `src/runtime/**` helper paths remain compatibility wrappers
and are not deletion-approved.

Phase 5.37 moves the pure terminal verdict derivation helper to
`src/shared/terminal-verdict.ts` and leaves `src/runtime/terminal-verdict.ts`
as a compatibility re-export. Retained result finalization imports the neutral
helper, but old wrapper deletion is still not approved.

Phase 5.38 moves the pure fanout join-policy helper to
`src/shared/fanout-join-policy.ts`. Retained fanout and core-v2 fanout both call
the shared helper; the old retained runtime path remains a compatibility
re-export and is not deletion-approved.

Phase 5.39 moves the pure recovery route priority helper to
`src/shared/recovery-route.ts`. Retained relay/verification and core-v2
production relay/verification now use the shared priority helper through their
existing adapters; the old retained runtime path remains a compatibility
re-export.

Phase 5.40 moves the generic path-safe JSON report helper to
`src/shared/json-report.ts`. Retained handlers and retained result finalization
now import the shared helper, while `src/runtime/step-handlers/shared.ts`
remains an old-path compatibility re-export.

Phase 5.10 implements the trusted-root exception only for official installed
plugin generated mirrors with wrapper provenance. That reduces retained fallback
for installed host wrapper fresh runs, but old runtime deletion remains blocked
by arbitrary external fixtures, custom flow roots, rollback, `composeWriter`,
retained checkpoints, unsupported modes, old oracle tests, and retained runtime
infrastructure.

The release golden proof no longer imports `dist/runtime/runner.js` or passes a
public `composeWriter`. Its deterministic Fix proof now uses internal v2
executor injection. That removes one release-infrastructure dependency, but
public `composeWriter` compatibility and retained fallback still block deletion.

Phase 5.12 adds explicit compatibility proof for retained/v1 checkpoint folders:
actual retained waiting folders still project through `runs show`, resume
through retained compatibility, and corrupted unmarked retained folders do not
fall through to the marker-gated v2 handoff status path. This is proof of the
retained policy, not deletion approval.
