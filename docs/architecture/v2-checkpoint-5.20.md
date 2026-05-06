# Phase 5.20 - Retained Helper Facade Boundary

Date: 2026-05-06

## Summary

Phase 5.20 extends the retained compatibility facade to cover the remaining
retained helper calls used by tests.

The facade now exposes neutral retained names for:

- append-and-derive trace updates;
- bootstrap run setup;
- retained run-folder initialization;
- fresh-run folder claims;
- fresh-run folder claim release;
- retained compose report writing;
- retained prototype compose report writing.

Tests now use those facade exports instead of importing helper values directly
from `src/runtime/runner.js`.

This is still behavior-preserving. The retained helper implementations did not
move, public old-path compatibility did not change, and old runtime deletion is
not approved.

## Files Changed

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

## Proof

`src/compat/retained-runtime.ts` re-exports retained helper surfaces under
explicit retained names:

- `appendAndDeriveRetainedTrace`;
- `bootstrapRetainedRun`;
- `initRetainedRunFolder`;
- `claimRetainedFreshRunFolder`;
- `releaseRetainedFreshRunFolderClaim`;
- `writeRetainedComposeReport`;
- `writeRetainedPrototypeComposeReport`.

`tests/runner/retained-compat-facade.test.ts` now proves:

- the facade exposes those helper functions;
- retained execution entrypoints are not imported directly from the old runner
  path in tests;
- direct old runner test imports are limited to
  `tests/runner/fix-report-writer.test.ts`, which intentionally proves the
  public `writeComposeReport` path.

## Validation

Passed:

- `npm run check`
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/contracts/orphan-blocks.test.ts tests/runner/terminal-outcome-mapping.test.ts tests/runner/build-report-writer.test.ts tests/runner/close-builder-registry.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/fix-runtime-wiring.test.ts tests/runner/fresh-run-root.test.ts tests/unit/runtime/event-log-round-trip.test.ts`
- `npx vitest run tests/runner/agent-relay-roundtrip.test.ts tests/runner/codex-relay-roundtrip.test.ts`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.20 does not approve:

- moving retained helper implementations;
- deleting retained helper public paths;
- deleting retained runtime files;
- retiring `writeComposeReport`;
- changing `composeWriter`;
- changing rollback;
- changing arbitrary fixture/custom-root policy;
- changing retained/v1 checkpoint folder policy.

## Next

Continue only with behavior-preserving cleanup or v2/shared oracle twins.

Pause and prepare a review package before changing public compatibility,
saved-state semantics, ownership boundaries, or deletion status.
