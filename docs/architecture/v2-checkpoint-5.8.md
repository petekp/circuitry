# Phase 5.8 - Candidate Diagnostics Disposition

Date: 2026-05-05

## Summary

Phase 5.8 decides the status of `CIRCUIT_V2_RUNTIME_CANDIDATE=1` after the
default selector is active.

Decision:

```text
CIRCUIT_V2_RUNTIME_CANDIDATE=1 stays for now.
It is a temporary migration diagnostic, not a separate routing promise.
It should be renamed later to CIRCUIT_SHOW_RUNTIME_DECISION=1 or similar.
The rename needs a dedicated follow-up slice.
```

No runtime behavior changes in this phase.

## Files Changed

- `docs/architecture/v2-candidate-diagnostics-disposition.md`
- `docs/architecture/v2-checkpoint-5.8.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `circuit-v2-phase-5.8-candidate-diagnostics-disposition-review-prompt-20260505.md`
- `circuit-v2-phase-5.8-candidate-diagnostics-disposition-review-20260505.zip`

## Current Proof

Existing tests already cover the current behavior:

- candidate-supported rows emit `runtime: "v2"` and a v2 `runtime_reason`;
- candidate-unsupported rows emit `runtime: "retained"` and a retained reason;
- candidate plus arbitrary explicit fixture remains retained unless the fixture
  resolves under `generated/flows`;
- candidate plus `composeWriter` remains retained;
- normal default outputs omit runtime fields;
- rollback and strict v2 precedence remain covered separately.

Primary proof lives in `tests/runner/cli-v2-runtime.test.ts`.

## Non-Approvals

Phase 5.8 does not approve:

- renaming or removing `CIRCUIT_V2_RUNTIME_CANDIDATE`;
- adding `CIRCUIT_SHOW_RUNTIME_DECISION`;
- old runtime deletion;
- changing arbitrary fixture routing;
- changing `composeWriter` behavior;
- removing rollback;
- routing more modes through core-v2;
- moving connector subprocesses, relay materialization, registries, router,
  catalog, compiler, trace, reducer, snapshot, progress, checkpoint, runner, or
  handler internals.

## Validation

Phase 5.8 validation:

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

The next possible slice is Phase 5.8.1: rename candidate diagnostics to a
clearer runtime-decision diagnostics flag, with an explicit compatibility
decision for the old env var.
