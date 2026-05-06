# Phase 5.17 - Closed-Abort Result Twins

Date: 2026-05-06

## Summary

Phase 5.17 adds a narrow v2 twin for two retained safety oracles:

- handler/executor throws must close cleanly;
- pass-route cycles must abort before writing step completion.

The existing core-v2 baseline already covered the trace behavior. This slice
adds strict final `reports/result.json` parsing so the v2 proof also covers the
operator-facing result artifact.

This is not a public behavior change. It does not widen selectors, change
rollback, change `composeWriter`, change arbitrary fixture/custom-root policy,
change retained/v1 checkpoint policy, move ownership boundaries, or delete old
runtime code.

## Files Changed

- `tests/core-v2/core-v2-baseline.test.ts`
- `docs/architecture/v2-checkpoint-5.17.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/core-v2/core-v2-baseline.test.ts` now proves:

- when a v2 executor throws, the run closes as `aborted`, writes a parseable
  `reports/result.json`, records the same reason in the result and close trace,
  and does not write `step.completed` for the failed step;
- when a pass route points back to the same step, the run closes as `aborted`,
  writes a parseable `reports/result.json`, records the route-cycle reason, and
  does not write `step.completed`.

The retained oracle references remain:

- `tests/runner/handler-throw-recovery.test.ts`
- `tests/runner/pass-route-cycle-guard.test.ts`

These retained tests remain live compatibility proof. Phase 5.17 only adds v2
evidence for behavior core-v2 already owns.

## Validation

Passed:

- `npx vitest run tests/core-v2/core-v2-baseline.test.ts tests/runner/handler-throw-recovery.test.ts tests/runner/pass-route-cycle-guard.test.ts`
- `npm run check`
- `npm run lint`
- `npm run build`
- `git diff --check`
- `npm run verify`

## Next

Continue low-risk oracle mapping only while the next slice stays inside
core-v2-owned behavior. Pause for review before public compatibility decisions
or ownership movement.
