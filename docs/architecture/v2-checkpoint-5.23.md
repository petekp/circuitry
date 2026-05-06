# Phase 5.23 - Checkpoint Resume Test Import Narrowing

Date: 2026-05-06

## Summary

Phase 5.23 narrows the remaining retained checkpoint resume test imports to the
saved-folder compatibility boundary.

The changed tests now import:

```text
resumeRetainedCompiledFlowCheckpoint
```

from:

```text
src/compat/retained-checkpoint-folders.ts
```

instead of the broader retained-runtime facade.

This is behavior-preserving. It does not change retained/v1 checkpoint resume,
status projection, handoff behavior, rollback, `composeWriter`, fixture/root
routing, ownership boundaries, or deletion status.

## Files Changed

- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/runner/explore-tournament-runtime.test.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `docs/architecture/v2-checkpoint-5.23.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

After this slice, direct test imports of retained saved-folder helpers use the
same narrower boundary that production CLI/handoff/run-status code uses.

`tests/runner/retained-compat-facade.test.ts` now guards against importing
retained saved-folder helpers from the broad retained-runtime facade in tests.

The broader `src/compat/retained-runtime.ts` still re-exports those helpers for
compatibility, but new saved-folder call sites should prefer
`src/compat/retained-checkpoint-folders.ts`.

## Validation

Passed:

- `npm run check`
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/explore-tournament-runtime.test.ts tests/runner/retained-compat-facade.test.ts`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.23 does not approve:

- saved-folder behavior changes;
- retained/v1 checkpoint folder migration or expiry;
- status or handoff fallback widening;
- rollback behavior changes;
- `composeWriter` behavior changes;
- arbitrary fixture or custom-root v2 default routing;
- connector/materializer movement;
- router/compiler movement;
- old runtime deletion;
- old oracle test deletion.

## Next

Continue autonomously only with behavior-preserving import/test cleanup or
v2/shared oracle twins.

Stop for review before changing public compatibility behavior, saved-folder
semantics, ownership boundaries, or deletion status.
