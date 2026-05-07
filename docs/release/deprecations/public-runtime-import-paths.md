# Public Runtime Import Path Deprecations

Date: 2026-05-07

There are no remaining release-note-only soft-deprecated wrapper paths.

Retired runtime execution and saved run-folder behavior now fail closed under
the final cutover policy. The old shared-helper wrapper paths that previously
appeared in this note have been removed after production code and tests moved to
their neutral shared owners.

## Deprecated For New Imports

None.

New code should import current owners directly.
## Not In This Soft-Deprecation List

The following old runtime path categories are not soft-deprecated:

- connector wrappers under `src/runtime/connectors/**`;
- the run-status wrapper at `src/runtime/run-status-projection.ts`;
- the old result path helper at `src/runtime/result-writer.ts`;
- the old public runner surface at `src/runtime/runner.ts` and
  `src/runtime/runner-types.ts`;
- retired fail-closed runtime surfaces such as checkpoint resume, checkpoint
  handler, progress projection, and result writing.

The old flow-authoring wrappers at `src/runtime/compile-schematic-to-flow.ts`
and `src/runtime/router.ts` are no longer part of the old public import-path
surface. New code should use `src/flows/compile-schematic-to-flow.ts` and
`src/flows/router.ts`.

The old shared-helper wrappers under `src/runtime/**` are also no longer part of
the old public import-path surface. New code should use the corresponding
`src/shared/**` owner modules.

The old catalog and registry wrappers at `src/runtime/catalog-derivations.ts`
and `src/runtime/registries/**` are also no longer part of the old public
import-path surface. New code should use the corresponding `src/flows/**` owner
modules.

## Removal Policy

This release note does not change package exports or add import-time/runtime
warnings.

Future wrapper deletion or stronger deprecation should update the manifest,
tests, and this release note together.
