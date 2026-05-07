# V2 Public Runtime Import Path Policy

Date: 2026-05-07

Current status: superseded for cutover planning by
`docs/architecture/v2-final-cutover-policy.md`. The release-note-only wrapper
deprecation below remains as the public import-path record. It should not be
read as retained runtime compatibility.

This note records the first approved old public import-path deprecation stage
for the v2 migration. The public release-note document lives at
`docs/release/deprecations/public-runtime-import-paths.md`.

## Policy

The listed wrapper paths remain import-compatible. Removed old execution files
do not get adapters, and retired runtime entrypoints fail closed instead of
preserving old behavior. No wrapper deletion, package export change, or
runtime/import-time warning is approved by this note.

No wrapper is deletion-ready.

The first public stage is a release-note-only soft deprecation for the
lowest-risk old helper and flow-authoring paths. Soft deprecation means:

- docs and release wording tell callers to prefer the neutral owner path;
- the old path continues to work;
- compatibility tests stay in place;
- production import guards stay in place;
- package exports do not change;
- no import-time warning is emitted;
- deletion still requires another review.

## Soft-Deprecated Paths

Prefer the replacement owner for new imports:

| Old path | Replacement owner |
|---|---|
| `src/runtime/config-loader.ts` | `src/shared/config-loader.ts` |
| `src/runtime/manifest-snapshot-writer.ts` | `src/shared/manifest-snapshot.ts` |
| `src/runtime/operator-summary-writer.ts` | `src/shared/operator-summary-writer.ts` |
| `src/runtime/policy/flow-kind-policy.ts` | `src/shared/flow-kind-policy.ts` |
| `src/runtime/relay-support.ts` | `src/shared/relay-support.ts` |
| `src/runtime/run-relative-path.ts` | `src/shared/run-relative-path.ts` |
| `src/runtime/selection-resolver.ts` | `src/shared/selection-resolver.ts` |
| `src/runtime/write-capable-worker-disclosure.ts` | `src/shared/write-capable-worker-disclosure.ts` |
| `src/runtime/terminal-verdict.ts` | `src/shared/terminal-verdict.ts` |
| `src/runtime/step-handlers/recovery-route.ts` | `src/shared/recovery-route.ts` |
| `src/runtime/step-handlers/shared.ts` | `src/shared/json-report.ts` |
| `src/runtime/step-handlers/fanout/aggregate.ts` | `src/shared/fanout-aggregate-report.ts` |
| `src/runtime/step-handlers/fanout/join-policy.ts` | `src/shared/fanout-join-policy.ts` |
| `src/runtime/compile-schematic-to-flow.ts` | `src/flows/compile-schematic-to-flow.ts` |
| `src/runtime/router.ts` | `src/flows/router.ts` |

## Release Note

The release-note deprecation document is
`docs/release/deprecations/public-runtime-import-paths.md`. It is checked
against `PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS` so the public deprecation list
stays identical to the manifest.

## Not In This Soft-Deprecation List

These categories are not part of the soft-deprecated wrapper table above:

- connector wrappers under `src/runtime/connectors/**`;
- catalog and registry wrappers under `src/runtime/catalog-derivations.ts` and
  `src/runtime/registries/**`;
- the run-status wrapper at `src/runtime/run-status-projection.ts`;
- the old result path helper at `src/runtime/result-writer.ts`;
- the old public runner surface at `src/runtime/runner.ts` and
  `src/runtime/runner-types.ts`;
- retired fail-closed runtime surfaces such as checkpoint resume, checkpoint
  handler, progress projection, and result writing.

## Review Boundaries

Use local adversarial review and manifest/test updates before:

- deleting any old wrapper;
- changing package exports;
- adding import-time or runtime warnings;
- soft-deprecating connector, registry, run-status, result-writer, or public
  runner paths;
- changing the fail-closed retired-runtime behavior.

Do not prepare an external review packet for those steps by default. Escalate
only if a new ambiguity appears that local review and tests cannot resolve.
