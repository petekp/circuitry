# Core-v2 Migration Review: Phase 5.21 Next Boundary

Date: 2026-05-06

You are reviewing the current `circuit-next` core-v2 migration after Phases
5.18, 5.19, and 5.20.

## Context

Generated public fresh-run parity is complete for the current catalog. The
current selector matrix routes Review default; Fix default/lite/deep/autonomous;
Build default/lite/deep/autonomous; Explore default/lite/deep/autonomous/
tournament; Migrate default/deep/autonomous; and Sweep
default/lite/deep/autonomous through core-v2 by default.

Old runtime deletion is still not approved. Retained runtime remains the
compatibility carrier for arbitrary fixtures, custom roots, rollback,
retained/v1 checkpoint folders, public `composeWriter`, old helper public paths,
old oracle tests, retained trace/progress/checkpoint/status behavior, connector
subprocesses/materializer, and router/compiler compatibility.

Recent slices:

- Phase 5.18 hardened public compatibility policy wording without changing
  behavior.
- Phase 5.19 moved retained execution test calls behind
  `src/compat/retained-runtime.ts`.
- Phase 5.20 exposed retained helper calls through the same facade. Direct old
  runner test imports are now limited to the explicit `writeComposeReport`
  public-path proof in `tests/runner/fix-report-writer.test.ts`.

Reported validation after Phase 5.20:

```bash
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

All passed. `npm run verify` reported 126 test files passed, 1403 tests passed,
and 6 skipped.

## Review Questions

1. Are there any blocking correctness or compatibility findings in the Phase
   5.18-5.20 changes?

2. Is `src/compat/retained-runtime.ts` now an acceptable compatibility boundary
   for retained execution and retained helper calls?

3. Is it correct that `tests/runner/fix-report-writer.test.ts` remains the one
   explicit old `src/runtime/runner.js` public-path proof for
   `writeComposeReport`?

4. Should the next implementation checkpoint be:

   - A. public compatibility policy behavior for `composeWriter`, rollback,
     arbitrary fixtures, and custom roots;
   - B. retained/v1 checkpoint folder compatibility package strategy;
   - C. connector subprocess and relay materializer neutral ownership;
   - D. router/compiler ownership transfer;
   - E. more v2/shared oracle twins;
   - F. a different bounded slice?

5. For the recommended next checkpoint, say whether a pre-implementation review
   is required, which files are likely touched, what tests should prove the
   behavior, and what must not change.

6. Is old runtime deletion any closer after 5.18-5.20? If so, exactly which
   blocker moved? If not, say that clearly.

## Important Non-Goals

Do not approve deletion unless the evidence supports it.

Do not recommend changing public behavior casually. The following require an
explicit product/review decision:

- deprecating or removing `composeWriter`;
- adding a v2 `composeWriter` hook;
- changing rollback semantics;
- default-routing arbitrary fixtures or custom roots through v2;
- failing closed arbitrary fixtures or custom roots;
- changing retained/v1 checkpoint folder support;
- moving connector subprocesses/materializer;
- moving router/compiler ownership;
- deleting retained runtime files or old oracle tests.

## Files Included In The Zip

Primary implementation:

- `src/compat/retained-runtime.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/fix-report-writer.test.ts`

Representative migrated tests:

- `tests/runner/build-runtime-wiring.test.ts`
- `tests/runner/build-checkpoint-exec.test.ts`
- `tests/runner/explore-tournament-runtime.test.ts`
- `tests/runner/terminal-outcome-mapping.test.ts`
- `tests/unit/runtime/event-log-round-trip.test.ts`
- `tests/runner/agent-relay-roundtrip.test.ts`
- `tests/runner/codex-relay-roundtrip.test.ts`
- `tests/contracts/orphan-blocks.test.ts`

Policy and migration docs:

- `HANDOFF.md`
- `docs/architecture/v2-checkpoint-5.18.md`
- `docs/architecture/v2-checkpoint-5.19.md`
- `docs/architecture/v2-checkpoint-5.20.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-worklog.md`

Selector and public-policy code:

- `src/cli/circuit.ts`
- `src/cli/create.ts`

Retained implementation reference:

- `src/runtime/runner.ts`
- `src/runtime/runner-types.ts`
