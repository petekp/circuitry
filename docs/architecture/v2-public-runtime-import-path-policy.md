# V2 Public Runtime Import Path Policy

Date: 2026-05-07

Current status: superseded for cutover planning by
`docs/architecture/v2-final-cutover-policy.md`. This file remains as the public
import-path record. It should not be read as retained runtime compatibility.

This note records the current old public import-path posture for the v2
migration. The public release-note document lives at
`docs/release/deprecations/public-runtime-import-paths.md`.

## Policy

There are no remaining release-note-only soft-deprecated wrapper paths.

Removed old execution files do not get adapters, and retired runtime entrypoints
fail closed instead of preserving old behavior. The remaining old public runtime
paths are either explicit wrappers that still have manifest coverage or
fail-closed stubs tracked in `src/compat/public-runtime-paths.ts`.

No package export change or runtime/import-time warning is approved by this
note.

## Soft-Deprecated Paths

None.

The old shared-helper wrapper paths that previously appeared here have been
retired. New code should import their shared owners directly.
## Release Note

The release-note deprecation document is
`docs/release/deprecations/public-runtime-import-paths.md`. It is checked
against `PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS` so the public deprecation state
stays identical to the manifest.

## Not In This Soft-Deprecation List

These categories are not soft-deprecated:

- connector wrappers under `src/runtime/connectors/**`;
- the run-status wrapper at `src/runtime/run-status-projection.ts`;
- the old result path helper at `src/runtime/result-writer.ts`;
- the old public runner surface at `src/runtime/runner.ts` and
  `src/runtime/runner-types.ts`;
- retired fail-closed runtime surfaces such as checkpoint resume, checkpoint
  handler, progress projection, and result writing.

The old flow-authoring wrappers at `src/runtime/compile-schematic-to-flow.ts`
and `src/runtime/router.ts` were retired after production and tooling imports
moved to `src/flows/**`.

The old shared-helper wrappers under `src/runtime/**` were retired after tests,
production code, and docs moved to the neutral `src/shared/**` owners.

The old catalog and registry wrappers at `src/runtime/catalog-derivations.ts`
and `src/runtime/registries/**` were retired after tests and production code
moved to the neutral `src/flows/**` owners.

## Review Boundaries

Use local adversarial review and manifest/test updates before:

- deleting any old wrapper or fail-closed stub;
- changing package exports;
- adding import-time or runtime warnings;
- soft-deprecating connector, registry, run-status, result-writer, public runner,
  or type paths;
- changing the fail-closed retired-runtime behavior.

Do not prepare an external review packet for those steps by default. Escalate
only if a new ambiguity appears that local review and tests cannot resolve.
