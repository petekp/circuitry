# Phase 5.7 - Compose Writer API Disposition

Date: 2026-05-05

## Summary

Phase 5.7 applies the external review verdict for `composeWriter`.

Decision:

```text
composeWriter remains retained-runtime-only compatibility.
core-v2 does not get a matching composeWriter hook.
internal v2 customization should use executor injection or generated reports.
release proof stays retained for now.
```

No old runtime deletion is approved.

## Files Changed

- `tests/runner/cli-v2-runtime.test.ts`
- `docs/architecture/v2-compose-writer-disposition.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `docs/architecture/v2-checkpoint-5.7.md`
- `HANDOFF.md`
- `circuit-v2-phase-5.7-compose-writer-disposition-review-prompt-20260505.md`
- `circuit-v2-phase-5.7-compose-writer-disposition-review-20260505.zip`

## Behavior Proof

`tests/runner/cli-v2-runtime.test.ts` now explicitly proves all four
`composeWriter` selector cases:

- normal routing plus `composeWriter` stays retained;
- candidate diagnostics plus `composeWriter` stays retained;
- strict v2 plus `composeWriter` fails closed;
- rollback plus `composeWriter` stays retained.

The soak suite already proves the broader retained `composeWriter` surface.

## Non-Approvals

Phase 5.7 does not approve:

- old runtime deletion;
- adding a core-v2 `composeWriter` hook;
- migrating release proof to core-v2;
- changing arbitrary fixture routing;
- removing rollback;
- removing or renaming candidate diagnostics;
- routing more modes through core-v2;
- moving connector subprocesses, relay materialization, registries, router,
  catalog, compiler, trace, reducer, snapshot, progress, checkpoint, runner, or
  handler internals.

## Validation

Phase 5.7 validation:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed after final packet refresh.

## Stop Point

Stop here for external review.

The next possible slice is a release-proof migration away from retained
`composeWriter`, but only if review agrees it is worth doing. It is not a
deletion prerequisite unless `composeWriter` is being retired or moved behind a
smaller retained compatibility module.
