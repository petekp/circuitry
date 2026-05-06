# Phase 5.14 - Retained Compatibility Facade

Date: 2026-05-06

## Summary

Phase 5.14 introduces a narrow retained compatibility facade at
`src/compat/retained-runtime.ts`.

This is an ownership slice, not a behavior slice. It does not change selector
routing, arbitrary fixture policy, custom-root policy, rollback,
`composeWriter`, retained/v1 checkpoint folder behavior, connector subprocesses,
relay materialization, router/catalog/compiler ownership, or old runtime
deletion status.

## Behavior

No production behavior changed.

The new boundary is:

```text
src/compat/retained-runtime.ts -> retained execution and v1 folder facade
src/runtime/runner.ts -> retained implementation
src/runtime/snapshot-writer.ts -> retained snapshot implementation
src/runtime/trace-reader.ts -> retained trace reader implementation
src/runtime/reducer.ts -> retained trace reducer implementation
```

CLI fresh-run fallback and retained/v1 checkpoint resume now call
`runRetainedCompiledFlow(...)` and
`resumeRetainedCompiledFlowCheckpoint(...)` through the facade. Handoff and
run-status code use the facade for retained snapshot, trace, and reducer access.

## Files Changed

- `src/compat/retained-runtime.ts`
- `src/cli/circuit.ts`
- `src/cli/handoff.ts`
- `src/run-status/project-run-folder.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/runner/retained-compat-facade.test.ts`
- `tests/runner/run-status-facade.test.ts`

## Proof

`tests/runner/retained-compat-facade.test.ts` proves the facade exposes retained
fresh-run execution, retained checkpoint resume, retained snapshot derivation,
retained trace reading, and retained trace reduction from one neutral module.

The same test proves `src/cli/circuit.ts`, `src/cli/handoff.ts`,
`src/run-status/project-run-folder.ts`, and `src/run-status/v1-run-folder.ts`
no longer import those retained implementation modules directly.

`tests/runner/run-status-facade.test.ts` keeps the old
`src/runtime/run-status-projection.ts` public compatibility path intact while
asserting that the neutral status dispatcher and v1 projection use the retained
facade for v1 trace work.

## Non-Approvals

Phase 5.14 does not approve:

- old runtime deletion;
- retained/v1 checkpoint folder policy changes;
- arbitrary fixture or custom-root v2 default routing;
- `composeWriter` behavior changes or v2 hook creation;
- rollback removal;
- connector subprocess movement;
- relay materializer movement;
- router/catalog/compiler movement;
- retained trace/reducer/snapshot/progress/checkpoint internals deletion;
- old oracle-test deletion.

## Validation

Passed in this checkpoint:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/runner/retained-compat-facade.test.ts tests/runner/run-status-facade.test.ts`
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts tests/runner/utility-cli.test.ts tests/runner/run-status-projection.test.ts`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak/v2-runtime-surface.test.ts`
- `npm run check-flow-drift`
- `npm run verify`

## Next

The next useful checkpoint should not be old runtime deletion. The retained
compatibility facade makes the remaining public decisions visible:

- whether public `composeWriter` stays as legacy compatibility or gets a
  release deprecation path;
- what rollback should mean after retained fallback is no longer bundled;
- whether arbitrary fixtures and custom flow roots stay in a compatibility
  package, get a v2 support contract, or eventually fail closed.

Those are product behavior changes and deserve review before implementation. If
we want another low-risk implementation slice first, map old runner/handler
oracle tests to `v2`, `shared`, `compat`, or `obsolete-with-evidence` buckets
and move only the mechanically proven tests.
