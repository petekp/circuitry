# Phase 5.19 - Retained Execution Test Import Boundary

Date: 2026-05-06

## Summary

Phase 5.19 continues the old runner/handler oracle mapping lane without changing
runtime behavior.

The slice moves retained execution calls in tests through
`src/compat/retained-runtime.ts`:

- `runCompiledFlow` test calls now import
  `runRetainedCompiledFlow as runCompiledFlow`;
- retained checkpoint resume test calls now import
  `resumeRetainedCompiledFlowCheckpoint as resumeCompiledFlowCheckpoint`;
- old `src/runtime/runner.js` imports remain only for retained helper surfaces
  such as `writeComposeReport`, `writePrototypeComposeReport`,
  `appendAndDerive`, `bootstrapRun`, `initRunFolder`, and fresh-run claim
  helpers.

This is an import-boundary change only. It does not change public behavior,
selector policy, retained/v1 checkpoint semantics, rollback, `composeWriter`,
arbitrary fixtures, custom roots, connector ownership, or old runtime deletion
status.

## Files Changed

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

## Proof

`tests/runner/retained-compat-facade.test.ts` now guards the boundary in two
ways:

- the already-migrated retained-execution-only tests must not import
  `src/runtime/runner.js`;
- no test may directly import `runCompiledFlow` or
  `resumeCompiledFlowCheckpoint` from `src/runtime/runner.js`.

The remaining direct old runner imports are intentionally helper-specific:

- `writeComposeReport`;
- `writePrototypeComposeReport`;
- `appendAndDerive`;
- `bootstrapRun`;
- `initRunFolder`;
- `claimFreshRunFolder`;
- `releaseFreshRunFolderClaim`.

Those helpers are still live retained compatibility/oracle surfaces. This slice
does not retire them.

## Validation

Passed:

- `npm run check`
- `npx vitest run tests/runner/runtime-smoke.test.ts tests/runner/run-relative-path.test.ts tests/runner/explore-report-writer.test.ts tests/runner/terminal-verdict-derivation.test.ts`
- `npx vitest run tests/runner/push-sequence-authority.test.ts tests/runner/relay-invocation-failure.test.ts tests/runner/runner-relay-connector-identity.test.ts tests/contracts/flow-model-effort.test.ts tests/runner/retained-compat-facade.test.ts`
- `npx vitest run tests/runner/build-verification-exec.test.ts tests/runner/check-evaluation.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/fanout-real-recursion.test.ts tests/runner/fanout-runtime.test.ts tests/runner/handler-throw-recovery.test.ts tests/runner/materializer-schema-parse.test.ts tests/runner/pass-route-cycle-guard.test.ts tests/runner/runner-relay-provenance.test.ts tests/runner/sub-run-real-recursion.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/retained-compat-facade.test.ts`
- `npx vitest run tests/runner/build-runtime-wiring.test.ts tests/runner/migrate-runtime-wiring.test.ts tests/runner/review-runtime-wiring.test.ts tests/runner/sweep-runtime-wiring.test.ts`
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/explore-tournament-runtime.test.ts tests/contracts/orphan-blocks.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/build-report-writer.test.ts tests/runner/close-builder-registry.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/fix-runtime-wiring.test.ts tests/runner/fresh-run-root.test.ts tests/runner/retained-compat-facade.test.ts`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.19 does not approve:

- deleting old runner/handler oracle tests;
- deleting retained runtime files;
- moving retained helper implementations;
- changing public runtime imports;
- changing `composeWriter`;
- changing rollback;
- changing arbitrary fixture/custom-root policy;
- changing retained/v1 checkpoint folder policy.

## Next

Continue with another behavior-preserving cleanup or v2/shared oracle-twin
slice.

Pause and prepare a review package before changing public compatibility,
saved-state semantics, ownership boundaries, or deletion status.
