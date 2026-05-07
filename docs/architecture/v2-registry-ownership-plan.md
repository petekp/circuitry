# Circuit v2 Registry Ownership Plan

Phase 4.18 is a planning checkpoint. It does not move registries, catalog
derivation code, flow packages, selector behavior, or checkpoint resume
ownership.

Phase 5.13 implemented the neutral registry ownership move described here:
`src/flows/catalog-derivations.ts` and `src/flows/registries/**` now own the
shared flow-package infrastructure. Final cutover has since retired the old
`src/runtime/catalog-derivations.ts` and `src/runtime/registries/**`
compatibility re-exports.

The registry modules used to live under `src/runtime/`, but they were not old
graph-runner debris. They are flow package and report infrastructure shared by
the retained runtime, core-v2, generated-flow validation, tests, and release
evidence.

## Current Source Of Truth

The source of truth is:

- `src/flows/catalog.ts`;
- `src/flows/types.ts`;
- `src/flows/catalog-derivations.ts`;
- `src/flows/registries/**`.

The old `src/runtime/**` registry paths are retired.

`src/flows/catalog.ts` aggregates flow packages. `src/flows/types.ts` defines
the package shape. `src/flows/catalog-derivations.ts` turns packages into
maps with duplicate detection and default-flow invariants. Registry modules
wrap those derivations for runtime and test consumers. The old `src/runtime`
registry paths no longer exist.

## Registry Classification

| Surface | Role | Current consumers | Current status | Neutral home |
|---|---|---|---|---|
| catalog derivations | Pure derivation layer from flow packages to registries and routable packages | router, registry modules, catalog tests, flow-router property tests | old runtime wrapper retired | `src/flows/catalog-derivations.ts` |
| compose-writer registry | Compose writer lookup and read-path resolution | core-v2 compose executor, flow writers/tests | old runtime wrapper retired | `src/flows/registries/compose-writers/*` |
| close-writer registry | Close/result writer lookup and report-path helper | core-v2 compose/close executor, flow close writers, cross-report validators, tests | old runtime wrapper retired | `src/flows/registries/close-writers/*` |
| verification-writer registry | Verification writer lookup and writer type surface | core-v2 verification executor, flow verification writers, tests | old runtime wrapper retired | `src/flows/registries/verification-writers/*` |
| checkpoint-writer registry | Checkpoint brief writer lookup and writer type surface | core-v2 checkpoint executor, run status projection, Build checkpoint writer, tests | old runtime wrapper retired | `src/flows/registries/checkpoint-writers/*` |
| report schema registry | Relay report schema parse registry | core-v2 relay executor, report composition tests, connector smoke fingerprints | old runtime wrapper retired | `src/flows/registries/report-schemas.ts` |
| cross-report validator registry | Cross-report validator registry | core-v2 relay executor, Sweep validators/tests | old runtime wrapper retired | `src/flows/registries/cross-report-validators.ts` |
| shape-hint registry | Relay shape hint lookup | shared relay prompt support, flow relay hints, tests | old runtime wrapper retired | `src/flows/registries/shape-hints/*` |
| `src/flows/types.ts` | Flow package descriptor type | every flow package, catalog, catalog derivations, tests | It is the package contract, not execution code | Already neutral enough; may only need type-import cleanup after registry move |
| `src/flows/catalog.ts` | Flow package aggregation | router, registries, compiler/generator, release checks, tests | Single source of truth for installed flows | Keep where it is |

## Consumers To Preserve

Any registry move must preserve these consumer groups:

- flow package writers and relay hints under `src/flows/**`;
- core-v2 executors for compose, checkpoint, verification, and relay;
- fail-closed old public stubs that still need shared flow types;
- compiler and generated-flow checks;
- report schema tests;
- catalog completeness and catalog derivation tests;
- relay shape hint tests;
- connector smoke fingerprint lists;
- release capability and proof coverage scripts.

The current imports are intentionally broad because registries are shared
infrastructure. Reducing `src/runtime/` namespace pressure should not be
mistaken for deleting or weakening this infrastructure.

## Original Move Strategy

Phase 4.18 recommended not moving registries yet. Phase 5.13 later implements
the move after a consolidated compatibility review identified registry/catalog
neutralization as the next useful implementation checkpoint.

The implemented strategy matches the original future plan:

1. Create a neutral registry namespace, likely `src/flows/registries/`, because
   registry state is derived from flow packages and catalog data.
2. Move type-only registry surfaces first.
3. Move pure catalog derivations next.
4. Move registry lookup modules one family at a time:
   compose, close, verification, checkpoint, shape hints, report schemas,
   cross-report validators.
5. Update core-v2 and flow package imports to the neutral path.
6. Retire old runtime wrappers after final cutover confirms no old imports
   remain.

## Required Proof For A Registry Move

Before moving registry modules, run:

- `npm run check`;
- `npm run lint`;
- `npm run build`;
- `npx vitest run tests/runner/catalog-derivations.test.ts`;
- `npx vitest run tests/contracts/catalog-completeness.test.ts`;
- `npx vitest run tests/runner/compose-builder-registry.test.ts tests/runner/close-builder-registry.test.ts tests/runner/relay-shape-hint-registry.test.ts`;
- `npx vitest run tests/runner/cross-report-validators.test.ts tests/properties/visible/cross-report-validator.test.ts`;
- `npx vitest run tests/core-v2 tests/parity`;
- `npx vitest run tests/runner/cli-v2-runtime.test.ts`;
- `npm run test:fast`;
- `npm run check-flow-drift`;
- `npm run verify`;
- `git diff --check`.

## Recommendation

Original recommendation for this checkpoint:

```text
D. Do not move registries yet. Treat registry movement as a separate
   flow-package infrastructure migration after connector/materializer
   ownership is reviewed.
```

Old runtime registry deletion is complete under the final cutover policy.

Phase 5.13 superseded the "do not move yet" part of this recommendation after a
consolidated compatibility review asked for implementation-backed neutral
ownership work. Final cutover later approved deleting the old runtime registry
wrappers after imports and tests moved to the neutral owners.
