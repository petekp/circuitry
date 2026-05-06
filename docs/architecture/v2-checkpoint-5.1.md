# Circuit v2 Checkpoint 5.1

## Summary

Phase 5.1 plans v2 checkpoint pause/resume parity.

No runtime code moved. No old runtime files were deleted. No checkpoint mode was
routed through core-v2. This is a product feature plan before implementation.

## What Changed

Added:

- `docs/architecture/v2-checkpoint-resume-parity-plan.md`
- `docs/architecture/v2-checkpoint-5.1.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Decision

The first v2 checkpoint implementation should support only new core-v2
checkpoint run folders.

Old retained checkpoint folders continue to resume through retained runtime.

Review corrections accepted before implementation:

- checkpoint request and resolution fields required by resume/status/progress
  should be first-class v2 trace fields;
- `report_path` must not be overloaded for checkpoint request paths;
- waiting checkpoint should be a graph result, not a thrown executor error;
- resumed graph execution must reconstruct completed attempts and sequence state
  from the existing trace before continuing.

## Proposed Implementation Sequence

1. Phase 5.2: add fixture-level v2 checkpoint pause/resume end to end.
2. Phase 5.2.1: smoke Build deep through explicit v2 candidate/strict routing
   without making it the default.
3. Phase 5.3: route one public checkpoint mode, likely Build deep, through v2
   only after the smoke is strong.
4. Phase 5.4: review retained checkpoint code and tests for narrowing or
   deletion.

## Review Boundary

Request focused architecture review before Phase 5.2 implementation.

Review should cover:

- first fixture target;
- v2 checkpoint trace fields;
- request and response file contracts;
- resume dispatch by saved run-folder engine marker;
- status projection for waiting v2 checkpoints;
- progress semantics;
- non-support for old retained checkpoint folder migration.

## Validation

Run for this planning checkpoint:

- `npm run lint`
- `npx vitest run tests/contracts/terminology-active-surface.test.ts`
- `git diff --check`
