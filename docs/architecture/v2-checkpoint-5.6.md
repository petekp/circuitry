# Phase 5.6 - Fallback API Disposition Review

Date: 2026-05-05

## Summary

Phase 5.6 prepares the external review checkpoint after the Phase 5.5
deletion-readiness inventory.

This phase does not change runtime behavior, routing, tests, or product policy.
It identifies the next decisions that need review before implementation.

## Review Artifact

New doc:

- `docs/architecture/v2-fallback-api-disposition-review.md`

Review packet:

- `circuit-v2-phase-5.6-fallback-api-disposition-review-prompt-20260505.md`
- `circuit-v2-phase-5.6-fallback-api-disposition-review-20260505.zip`

## Decision Boundary

The next migration move needs external review because it would decide retained
compatibility policy for:

- arbitrary explicit fixtures;
- programmatic `composeWriter`;
- rollback;
- unsupported public modes;
- candidate diagnostics.

## Non-Approvals

Phase 5.6 does not approve:

- old runtime deletion;
- changing fixture routing;
- changing `composeWriter` behavior;
- removing rollback;
- removing or renaming candidate diagnostics;
- routing more modes through core-v2;
- moving retained trace/reducer/snapshot/progress/checkpoint/runner internals;
- moving connector subprocesses, relay materialization, registries, router,
  catalog, or compiler infrastructure.

## Validation

Phase 5.6 validation:

- `npm run check`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## Stop Point

Stop here for external review.

Phase 5.7 should not start until the reviewer decides which fallback
responsibility to keep, migrate, shrink, or retire first.
