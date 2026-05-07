# Public Runtime Import Path Deprecations

Date: 2026-05-07

This release publicly soft-deprecates the old runtime helper and flow-authoring
wrapper import paths listed below for new imports.

This is a release-note deprecation only:

- these listed wrapper paths continue to work;
- these listed wrapper files remain in place;
- compatibility tests stay in place;
- package exports do not change;
- no import-time or runtime warning is emitted;
- deletion is not part of this release-note deprecation.

This note is only about the listed wrappers. Retired runtime execution and saved
run-folder behavior now fail closed under the final cutover policy.

## Deprecated For New Imports

New code should prefer the replacement owner path.

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

## Not In This Soft-Deprecation List

The following old runtime path categories are not part of the soft-deprecated
wrapper table above:

- connector wrappers under `src/runtime/connectors/**`;
- catalog and registry wrappers under `src/runtime/catalog-derivations.ts` and
  `src/runtime/registries/**`;
- the run-status wrapper at `src/runtime/run-status-projection.ts`;
- the old result path helper at `src/runtime/result-writer.ts`;
- the old public runner surface at `src/runtime/runner.ts` and
  `src/runtime/runner-types.ts`;
- retired fail-closed runtime surfaces such as checkpoint resume, checkpoint
  handler, progress projection, and result writing.

## Removal Policy

This release does not retire old public import paths. It also does not delete
wrapper files, change package exports, or add import-time/runtime warnings.

Plainly: this release does not delete wrappers.

Future wrapper deletion or stronger deprecation should update the manifest,
tests, and this release note together.
