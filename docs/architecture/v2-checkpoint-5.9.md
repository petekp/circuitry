# Phase 5.9 - Arbitrary Fixture Policy

Date: 2026-05-05

## Summary

Phase 5.9 records the arbitrary fixture policy and cleans the active retained
diagnostics wording for arbitrary fixtures.

Decision:

```text
arbitrary explicit fixtures remain retained-runtime-owned by default
custom flow roots remain retained-runtime-owned by default
generated/flows fixtures follow the selector matrix
strict CIRCUIT_V2_RUNTIME=1 remains the v2 experiment lane
```

No old runtime deletion is approved.

## Files Changed

- `docs/architecture/v2-arbitrary-fixture-policy.md`
- `docs/architecture/v2-checkpoint-5.9.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `circuit-v2-phase-5.10-trusted-generated-mirror-policy-review-prompt-20260505.md`
- `circuit-v2-phase-5.10-trusted-generated-mirror-policy-review-20260505.zip`

## Findings

The inventory confirmed one important edge: installed host flows are generated
mirrors, but the Codex wrapper injects them as `--flow-root <plugin root>/flows`.
That path is outside `generated/flows/**`, so current selector policy treats it
as retained-runtime-owned by default.

Changing that would be a trusted-generated-mirror selector change, not arbitrary
fixture deletion cleanup.

The active arbitrary fixture retained reason no longer says "candidate
routing". It now says explicit fixture/root inputs outside `generated/flows` are
retained-runtime-owned by default, and strict v2 is the experiment lane.

## Non-Approvals

Phase 5.9 does not approve:

- old runtime deletion;
- changing arbitrary fixture routing;
- routing packaged host flow roots through core-v2 by default;
- routing custom flow roots through core-v2 by default;
- changing `composeWriter` behavior;
- removing rollback;
- removing `CIRCUIT_V2_RUNTIME_CANDIDATE`;
- moving connector subprocesses, relay materialization, registries, router,
  catalog, compiler, trace, reducer, snapshot, progress, checkpoint, runner, or
  handler internals.

## Validation

Passed:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npm run test:fast`
- `npm run verify`
- `git diff --check`

## Next

Any slice that makes packaged host flow roots default-route through core-v2
should get deeper review first.

Prepared review packet:

- `circuit-v2-phase-5.10-trusted-generated-mirror-policy-review-prompt-20260505.md`
- `circuit-v2-phase-5.10-trusted-generated-mirror-policy-review-20260505.zip`
