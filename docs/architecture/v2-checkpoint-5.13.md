# Phase 5.13 - Registry And Catalog Neutral Ownership

Date: 2026-05-06

## Summary

Phase 5.13 moves shared flow registry and catalog derivation ownership out of
`src/runtime/**` and into `src/flows/**`.

This is an ownership slice, not a behavior slice. It does not change selector
routing, retained fallback behavior, arbitrary fixture policy, custom-root
policy, rollback, `composeWriter`, connector subprocesses, relay
materialization, router/catalog/compiler behavior, or old runtime deletion
status.

## Behavior

No production behavior changed.

The new ownership model is:

```text
src/flows/catalog-derivations.ts -> source implementation
src/flows/registries/** -> source implementation
src/runtime/catalog-derivations.ts -> compatibility re-export
src/runtime/registries/** -> compatibility re-exports
```

Flow packages, shared relay prompt support, core-v2 executors, and v1 run-status
projection now import registry code from `src/flows/**`. Retained runtime and
old import paths continue to work through wrappers.

## Files Changed

- `src/flows/catalog-derivations.ts`
- `src/flows/registries/**`
- `src/runtime/catalog-derivations.ts`
- `src/runtime/registries/**`
- `src/flows/**`
- `src/core-v2/**`
- `src/shared/relay-support.ts`
- `src/run-status/v1-run-folder.ts`
- `tests/contracts/catalog-completeness.test.ts`
- `tests/contracts/engine-flow-boundary.test.ts`
- `tests/runner/catalog-derivations.test.ts`

## Proof

`tests/runner/catalog-derivations.test.ts` now exercises the neutral
`src/flows/**` derivation and registry paths directly, then proves the old
`src/runtime/**` paths re-export the same function identities.

`tests/contracts/catalog-completeness.test.ts` now treats
`src/flows/catalog-derivations.ts` and `src/flows/registries/` as shared flow
infrastructure, not flow package drift.

`tests/contracts/engine-flow-boundary.test.ts` now treats those same paths as
shared flow infrastructure, not per-flow internals.

Existing registry tests continue to cover writer lookup, report schema parsing,
shape hints, and cross-report validators.

## Non-Approvals

Phase 5.13 does not approve:

- old runtime deletion;
- retained runtime facade changes;
- arbitrary fixture or custom-root v2 default routing;
- `composeWriter` behavior changes;
- rollback removal;
- connector subprocess movement;
- relay materializer movement;
- router/catalog/compiler movement;
- retained/v1 checkpoint folder policy changes;
- old oracle-test deletion.

## Validation

Passed in this checkpoint:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run check-flow-drift`
- `npx vitest run tests/core-v2 tests/parity`
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`
- `npx vitest run tests/soak/v2-runtime-surface.test.ts`
- `npx vitest run tests/runner/catalog-derivations.test.ts tests/contracts/catalog-completeness.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/close-builder-registry.test.ts tests/runner/relay-shape-hint-registry.test.ts tests/runner/cross-report-validators.test.ts tests/properties/visible/cross-report-validator.test.ts tests/contracts/explore-report-composition.test.ts`
- `npx vitest run tests/contracts/engine-flow-boundary.test.ts`
- `npm run verify`
- `git diff --check`

## Next

The next useful implementation checkpoint is a narrow retained-compatibility
facade. The goal should be to make retained fresh-run fallback, retained/v1
checkpoint resume, rollback fallback, and public `composeWriter` compatibility
visible through one small boundary without changing behavior.
