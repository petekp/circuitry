# Dead Code Sweep Report

**Scope:** Full codebase
**Date:** May 7, 2026
**Status:** Findings addressed
**Inventory:** TypeScript package with one nested Vite designer app
**Entry points checked:** `bin/circuit-next`, `src/cli/circuit.ts`, `src/index.ts`, `scripts/**/*.mjs`, `tests/**/*.test.ts`, `apps/designer/src/main.tsx`, `apps/designer/server.ts`, generated flow/plugin surfaces
**Build and tooling:** root `tsc`, Vitest, Biome, generated-flow drift checks; nested designer app with Vite, Fastify, and separate `tsconfig`

## Cleanup Completed

### Removed Orphaned Files

- Removed `apps/designer/src/lib/spine.ts`.
- Removed `src/runtime/domain/connector.ts`.
- Removed `src/runtime/domain/report.ts`.
- Removed unused designer UI files:
  - `apps/designer/src/components/ui/alert.tsx`
  - `apps/designer/src/components/ui/card.tsx`
  - `apps/designer/src/components/ui/dialog.tsx`
  - `apps/designer/src/components/ui/popover.tsx`

### Removed Unused Helpers and Exports

- Removed unused `validateSchematic()` from `apps/designer/src/lib/api.ts`.
- Removed unused `isRunRelativePathError()` from `src/shared/json-report.ts`.
- Removed unused connector alias exports from `src/runtime/connectors/connector.ts`.
- Removed unused `ShapeHint` alias from `src/flows/registries/shape-hints/types.ts`.
- Removed unused `createPathsForTests` and `handoffPathsForTests` exports.
- Changed internal-only `CreateMainOptions`, `HandoffMainOptions`, and `pathIsInside()` from exported to local declarations.
- Removed export-only designer UI helpers from `badge.tsx`, `button.tsx`, `scroll-area.tsx`, `select.tsx`, and `tabs.tsx`.
- Changed internal designer view-model types from exported to local declarations.
- Removed unused designer validation DTO types that no longer had a caller.

### Removed Stale Thin Wrappers

- Removed `src/runtime/fanout/aggregate-report.ts`.
- Removed `src/runtime/fanout/join-policy.ts`.
- Updated the runtime fanout executor to import the shared helpers directly.
- Removed the `runCompiledFlowChild()` pass-through wrapper and use `runCompiledFlow()` directly as the default child runner.
- Updated `tests/runner/fanout-aggregate-compat.test.ts` to exercise the shared aggregate helper directly.

### Removed Orphaned Dependency

- Removed the direct `zod` dependency from `apps/designer/package.json`.
- Regenerated `apps/designer/package-lock.json` with `npm uninstall zod`.
- `zod` remains in the designer lockfile only as a transitive dependency.

### Fixed Dependency Ownership

- Added `vitest` as a designer app dev dependency because `apps/designer/src/lib/designer-model.test.ts` imports it directly.

### Resolved Review Items

- Kept `docs/architecture/runtime.md` and linked it from `README.md` because it describes the current runtime foundation.
- Kept `docs/positioning-and-strategy.md` and linked it from `README.md` because it is current product/strategy context.
- Removed the untracked `docs/ideas/` notes from the active docs tree. They were not part of the tracked repo and were failing the active terminology scan.
- Removed the untracked `runtime-foundation-production-audit-20260507.zip` archive.

## Not Removed

- Generated flow and host surfaces under `generated/flows/**`, `.claude-plugin/skills/**`, `plugins/circuit/flows/**`, `plugins/circuit/commands/**`, and `plugins/circuit/skills/**`.
- Generated release surfaces under `generated/release/**` and `docs/release/*.generated.md`.
- `examples/runs/**`, because release proof indexes, tests, progress logs, and trace files consume these fixture trees by path or structure.
- Root dependencies, because each has source, script, or config usage.

## Verification

- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
- `npm --prefix apps/designer run check`
- `npx --yes knip --directory apps/designer --use-tsconfig-files --reporter compact --no-progress --no-exit-code`
- `npm run test -- tests/contracts/terminology-active-surface.test.ts tests/contracts/terminology-product-surface.test.ts tests/runner/fanout-aggregate-compat.test.ts`
- `npm --prefix apps/designer run build`
- `npm run verify`
- `git diff --check`

All verification commands passed after cleanup, and the designer-specific `knip` pass reported no remaining findings.
