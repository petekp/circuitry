# Phase 5.24 - Verification Failure Evidence V2 Twin

Date: 2026-05-06

## Summary

Phase 5.24 adds core-v2 coverage for verification pre-write failure evidence.

Retained verification already records a `check.evaluated` failure and avoids
`step.report_written` when verification cannot write its report. Core-v2 now
does the same for verification failures that happen before the canonical report
is written, such as a missing `projectRoot` or an unsupported verification
report schema.

This is a narrow v2 executor and test slice. It does not change public runtime
routing, retained/v1 checkpoint folders, rollback, `composeWriter`, arbitrary
fixture or custom-root policy, ownership boundaries, or deletion status.

## Files Changed

- `src/core-v2/executors/verification.ts`
- `tests/core-v2/control-loop-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.24.md`
- `docs/architecture/v2-runner-handler-test-classification.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Proof

`tests/core-v2/control-loop-v2.test.ts` now proves that core-v2 verification
pre-write failures:

- close the run as aborted;
- write a parseable final `reports/result.json`;
- emit `check.evaluated` with `outcome: "fail"`;
- emit `step.aborted`;
- do not emit `step.report_written`;
- do not write the canonical verification report.

The old retained oracle remains live in
`tests/runner/verification-handler-direct.test.ts`. This v2 twin reduces oracle
risk but does not make the retained test obsolete while retained fallback and
retained/v1 folders remain supported.

## Validation

Passed:

- `npm run check`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts`
- `npx vitest run tests/core-v2/control-loop-v2.test.ts tests/runner/verification-handler-direct.test.ts`
- `npm run lint`
- `npm run build`
- `npm run verify`
- `git diff --check`

## Non-Approvals

Phase 5.24 does not approve:

- public compatibility behavior changes;
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
