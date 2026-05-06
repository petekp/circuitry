# Circuit v2 Checkpoint 4.42

## Summary

Phase 4.42 records the retained-runtime boundary decision and starts selector
soak.

No runtime code moved. No old runtime files were deleted. Checkpoint resume
remains retained-runtime-owned. The completed milestone is the default selector
for matrix-supported fresh-run modes, not full old runtime replacement.

## What Changed

Added:

- `docs/architecture/v2-retained-runtime-boundary.md`
- `docs/architecture/v2-selector-soak-checklist.md`
- `docs/architecture/v2-checkpoint-4.42.md`

Updated:

- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`

## Decision

Choose option A from the decision checkpoint:

```text
Checkpoint resume remains retained-runtime-owned for the foreseeable future.
```

That means:

- core-v2 owns matrix-supported fresh-run execution;
- retained runtime owns checkpoint resume and checkpoint-waiting depths;
- retained runtime also owns unsupported fallback, arbitrary fixture fallback,
  programmatic `composeWriter` fallback, rollback, and old oracle coverage.

## Milestone

The default-selector milestone is ready for automated soak:

```text
Matrix-supported fresh runs default to core-v2.
```

This does not mean:

- core-v2 owns all runtime behavior;
- checkpoint resume has migrated to core-v2;
- old runtime deletion is ready;
- rollback can be removed.

## Next Phase

Move into selector soak and deletion-readiness evidence gathering.

Phase 5.0 adds `npm run soak:v2` as the deterministic gate before declaring
the default-selector milestone complete.

Do not move connector subprocesses, relay materialization, registries,
trace/progress/reducer/snapshot internals, checkpoint handler behavior,
`executeCompiledFlow(...)`, old runner files, or old step handlers without a
separate reviewed plan.

## Validation

Run for this docs/evidence checkpoint:

- `npm run lint`: passed.
- `npm run check-flow-drift`: passed.
- `git diff --check`: passed.
