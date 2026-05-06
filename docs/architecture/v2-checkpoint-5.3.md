# Phase 5.3 - Build Deep Default Routing

Date: 2026-05-05

## Summary

Phase 5.3 moves Build deep from explicit candidate/strict v2 routing into the
normal default selector matrix.

This is the first default-routed core-v2 checkpoint mode.

The slice does not approve:

- Build tournament routing;
- other checkpoint or tournament modes;
- retained/v1 checkpoint folders through core-v2;
- old runtime deletion;
- movement of retained trace, reducer, snapshot, progress, checkpoint handler,
  runner, connector, materializer, registry, router, catalog, or compiler
  infrastructure.

## Selector Change

`src/cli/circuit.ts` now includes Build deep in the default support matrix:

```text
build default -> core-v2
build lite -> core-v2
build deep -> core-v2
```

The candidate support matrix no longer carries a Build-deep-only exception. It
aliases the default support matrix.

Rollback remains unchanged:

```text
CIRCUIT_DISABLE_V2_RUNTIME=1 build --mode deep -> retained runtime
```

Resume remains identity-based:

```text
core-v2-marked run folder -> core-v2 resume
retained/v1 run folder -> retained resume
```

## Public Proof

`tests/runner/cli-v2-runtime.test.ts` now proves no-env Build deep default
routing:

- Build deep starts on core-v2 without v2 env vars;
- the run pauses with `outcome: checkpoint_waiting`;
- stdout omits normal runtime diagnostics;
- `reports/result.json` is not written while waiting;
- the Build brief and checkpoint request parse;
- `runs show --json` reports `waiting_checkpoint`;
- checkpoint and user-input progress events parse;
- resume follows the saved core-v2 run-folder marker;
- resume stdout omits normal runtime diagnostics;
- resumed progress includes step/run completion;
- saved project root and selection config restore;
- `reports/result.json` and Build result parse;
- final `runs show --json` reports completed.

The same file keeps rollback proof for Build deep:

```text
CIRCUIT_DISABLE_V2_RUNTIME=1 build --mode deep -> retained runtime
```

`tests/soak/v2-runtime-surface.test.ts` adds the same default Build deep
checkpoint wait/resume path to the automated soak gate.

## Validation

Phase 5.3 validation:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2/checkpoint-resume-v2.test.ts`:
  passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`:
  passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed after fixing handoff run-backed continuity to read
  v2 run status projections when a run folder is core-v2 marked.
- `npm run test:fast`: passed.
- `git diff --check`: passed before this validation-result refresh.

`npm run soak:v2` ran the focused soak suite, full `npm run verify`, and
`npm run check-flow-drift`.

## Utility Compatibility

Build deep becoming default-routed surfaced one old assumption in
`src/cli/handoff.ts`: run-backed handoff continuity tried to derive a retained
v1 snapshot directly from `trace.jsonl`. That fails for core-v2 trace entries.

Phase 5.3 keeps retained/v1 behavior on the old reducer path and adds a v2
fallback through the neutral run-status projection. Handoff save can now bind to
both retained waiting runs and core-v2 waiting runs.

## Remaining Boundaries

Build deep default routing does not make retained runtime deletion safe.

Retained runtime still owns:

- retained/v1 checkpoint folders;
- unsupported flow/mode/depth fallback;
- arbitrary explicit fixtures;
- programmatic `composeWriter` fallback;
- rollback;
- old runner/handler oracle coverage;
- retained trace, reducer, snapshot, progress, and checkpoint infrastructure;
- connector subprocess modules;
- relay materialization;
- registries;
- router/catalog/compiler infrastructure not yet moved or intentionally
  retained.

## Next Step

Request focused review of Phase 5.3 before adding any other checkpoint or
tournament mode to the default selector matrix.
