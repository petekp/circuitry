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
fail closed instead of preserving old behavior. There are no remaining old
public runtime paths tracked in `src/compat/public-runtime-paths.ts`.

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

None remain.

The old flow-authoring wrappers at `src/runtime/compile-schematic-to-flow.ts`
and `src/runtime/router.ts` were retired after production and tooling imports
moved to `src/flows/**`.

The old shared-helper wrappers under `src/runtime/**` were retired after tests,
production code, and docs moved to the neutral `src/shared/**` owners.

The old catalog and registry wrappers at `src/runtime/catalog-derivations.ts`
and `src/runtime/registries/**` were retired after tests and production code
moved to the neutral `src/flows/**` owners.

The old connector wrappers under `src/runtime/connectors/**` were retired after
tests and production code moved to the neutral `src/connectors/**` owners.

The old run-status wrapper at `src/runtime/run-status-projection.ts` was retired
after the CLI, tests, and active docs moved to the neutral
`src/run-status/project-run-folder.ts` owner.

The old progress projection wrapper at `src/runtime/progress-projector.ts` was
retired after live progress output ownership moved to
`src/shared/progress-output.ts` and old v1 trace projection stopped being
adapted.

The old result writer wrapper at `src/runtime/result-writer.ts` was retired
after live result path ownership moved to `src/shared/result-path.ts` and old
result writing stopped being adapted.

The old checkpoint resume and checkpoint handler stubs at
`src/runtime/checkpoint-resume.ts` and `src/runtime/step-handlers/checkpoint.ts`
were retired after retained and v1 checkpoint folders moved to fail-closed
policy without adapters.

The old public runner surface at `src/runtime/runner.ts` and
`src/runtime/runner-types.ts` was retired after the final cutover removed the
last direct old-runtime API import paths.

## Review Boundaries

Use local adversarial review and manifest/test updates before:

- recreating any old wrapper or fail-closed stub;
- changing package exports;
- adding import-time or runtime warnings;
- soft-deprecating public runner or type paths;
- changing the fail-closed retired-runtime behavior.

Do not prepare an external review packet for those steps by default. Escalate
only if a new ambiguity appears that local review and tests cannot resolve.
