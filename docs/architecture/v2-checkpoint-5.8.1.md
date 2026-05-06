# Phase 5.8.1 - Runtime Decision Diagnostics Alias

Date: 2026-05-05

## Summary

Phase 5.8.1 implements the candidate diagnostics rename with a compatibility
alias.

Decision:

```text
CIRCUIT_SHOW_RUNTIME_DECISION=1 is the preferred diagnostics flag.
CIRCUIT_V2_RUNTIME_CANDIDATE=1 remains as a temporary alias.
Either flag includes runtime/runtime_reason.
runtime_reason explains the actual selected runtime.
rollback wins the runtime_reason when rollback selects retained runtime.
strict v2 still wins over rollback.
```

No old runtime deletion is approved.

## Files Changed

- `src/cli/circuit.ts`
- `tests/runner/cli-v2-runtime.test.ts`
- `tests/soak/v2-runtime-surface.test.ts`
- `tests/runner/config-loader.test.ts`
- `docs/architecture/v2-candidate-diagnostics-disposition.md`
- `docs/architecture/v2-checkpoint-5.8.1.md`
- `docs/architecture/v2-retained-fallback-policy.md`
- `docs/architecture/v2-deletion-readiness-inventory.md`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`
- `circuit-v2-phase-5.8.1-runtime-decision-diagnostics-alias-review-prompt-20260505.md`
- `circuit-v2-phase-5.8.1-runtime-decision-diagnostics-alias-review-20260505.zip`

## Behavior Changed

Runtime behavior changed narrowly:

- `CIRCUIT_SHOW_RUNTIME_DECISION=1` now includes `runtime` and
  `runtime_reason` fields.
- `CIRCUIT_V2_RUNTIME_CANDIDATE=1` remains a temporary alias.
- If runtime diagnostics and rollback are both set, retained output now reports
  the rollback reason because rollback selected the actual runtime.
- CLI usage text now describes runtime diagnostics instead of candidate routing.

Routing behavior did not widen. The candidate support matrix still aliases the
default support matrix.

## Proof

`tests/runner/cli-v2-runtime.test.ts` proves:

- the preferred diagnostics flag emits v2 runtime fields for supported rows;
- the preferred diagnostics flag emits retained runtime fields for unsupported
  rows;
- the old candidate env var still works as an alias;
- both diagnostics flags together behave like either flag alone;
- diagnostics plus rollback reports the rollback reason;
- diagnostics plus rollback plus `composeWriter` stays retained and runs the
  retained compose writer;
- diagnostics plus rollback plus arbitrary fixture reports the rollback reason;
- strict v2 plus rollback plus diagnostics still follows strict v2;
- resume diagnostics report the saved-engine runtime;
- normal default output still omits runtime fields through existing tests;
- CLI usage mentions the new flag and the temporary alias.

## Non-Approvals

Phase 5.8.1 does not approve:

- removing `CIRCUIT_V2_RUNTIME_CANDIDATE`;
- old runtime deletion;
- changing arbitrary fixture routing;
- changing `composeWriter` behavior;
- removing rollback;
- routing more modes through core-v2;
- moving connector subprocesses, relay materialization, registries, router,
  catalog, compiler, trace, reducer, snapshot, progress, checkpoint, runner, or
  handler internals.

## Validation

Passed:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak`
- `npm run soak:v2:fast`
- `npm run soak:v2`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

## Stop Point

Stop here for external review.

The next diagnostics-specific slice should decide when to remove the temporary
`CIRCUIT_V2_RUNTIME_CANDIDATE=1` alias. Old runtime deletion remains blocked by
the retained fallback responsibilities listed in the deletion-readiness
inventory.
