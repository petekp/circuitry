# Declarative Fold-In Progress

Date: 2026-05-17

Status: staged implementation record.

Archive note: this is a dated implementation record. Use current code, tests,
`docs/README.md`, and canonical architecture docs for live guidance.

Goal: fold more built-in flow authoring into the data-first declarative kernel
without changing generated surfaces, runtime behavior, report contracts, or host
mirrors.

## Completed Batches

Already folded in before this implementation run:

- `src/flows/flow-definition.ts` compiles fact-owned flow definitions into
  package, schematic, runtime surface, and generated manifest inputs.
- `src/flows/runtime-surface.ts` derives runtime support, primary result, and
  progress metadata from `flowPackages`.
- `src/runtime/projections/progress.ts` uses package-owned progress metadata for
  public flow copy, with fallback behavior still present for compatibility.
- `src/connectors/subprocess.ts` owns shared subprocess lifecycle mechanics.
- `src/shared/proof-plan.ts` owns bounded proof command execution policy.

Implemented in this run:

- Added `src/flows/declarative-flow-facts.ts`, a compact value-to-`FlowFact[]`
  projection helper.
- Re-expressed `build`, `review`, `runtime-proof`, `pursue`, `fix`, and
  `explore` facts through that helper.
- Kept flow-specific schemas, writers, relay hints, and routing in each flow's
  package-owned `flow.ts` adapter.
- Moved block schematic policy ownership into
  `src/schemas/flow-block-definitions.ts`, with compatibility projections for
  existing catalog consumers.
- Moved canonical stage policy to flow-owned definition data, with
  `src/shared/flow-kind-policy-core.ts` still exporting the compatibility
  names used by existing checks.
- Added package-owned report declarations and projected them into the legacy
  relay report, report schema, and writer registries.
- Added typed `defineFlowFromFactsValue` errors while keeping the existing
  throwing `defineFlowFromFacts` adapter.
- Named runtime execution capabilities in `src/runtime/run/capabilities.ts`
  without changing execution behavior.
- Split CLI JSON output field construction into `src/cli/run-output.ts` so
  domain values can be tested apart from process rendering.

Preservation constraints kept:

- No generated flow or host surface drift after `scripts/emit-flows.ts --check`.
- No plugin runtime drift after `npm run build-plugin-runtime` and
  `npm run check-plugin-runtime`.
- The runtime engine boundary still rejects direct imports of flow authoring
  helpers.
- Existing throwing adapters, public report schema names, route output keys,
  and canonical flow vocabulary are preserved.

## Evidence

Focused checks run across the staged batches:

```bash
npm run test:fast -- tests/runner/flow-definition-compiler.test.ts tests/runner/flow-facts.test.ts tests/contracts/catalog-completeness.test.ts tests/contracts/flow-schematic.test.ts tests/runtime/progress-projection.test.ts tests/runner/pursue-runtime-wiring.test.ts
npm run test:fast -- tests/runner/flow-definition-compiler.test.ts tests/contracts/catalog-completeness.test.ts tests/contracts/flow-schematic.test.ts tests/runner/fix-runtime-wiring.test.ts tests/contracts/fix-report-schemas.test.ts
npm run test:fast -- tests/runner/flow-definition-compiler.test.ts tests/contracts/compile-schematic-to-flow.test.ts tests/runner/explore-e2e-parity.test.ts tests/runner/explore-tournament-runtime.test.ts tests/contracts/explore-report-schemas.test.ts
npm run test -- tests/runner/cli-router.test.ts
npm run test:fast -- tests/contracts/flow-block-catalog.test.ts tests/contracts/flow-schematic.test.ts tests/contracts/orphan-blocks.test.ts
npm run test:fast -- tests/contracts/flow-kind-policy.test.ts tests/contracts/catalog-completeness.test.ts tests/runner/catalog-derivations.test.ts tests/runner/flow-definition-compiler.test.ts
npm run test:fast -- tests/contracts/catalog-completeness.test.ts tests/runner/catalog-derivations.test.ts tests/runner/flow-definition-compiler.test.ts tests/contracts/flow-schematic.test.ts tests/contracts/fix-report-schemas.test.ts tests/contracts/explore-report-schemas.test.ts tests/contracts/build-report-schemas.test.ts
npm run test:fast -- tests/runtime/runtime-capabilities.test.ts tests/runner/review-runtime-wiring.test.ts tests/runner/build-verification-exec.test.ts tests/runner/compose-builder-registry.test.ts tests/runner/sub-run-runtime.test.ts
npm run test -- tests/runner/cli-router.test.ts tests/runner/cli-run-output.test.ts
```

Drift and final checks:

```bash
npm run build-plugin-runtime
npm run verify
```
