# V2 Public Runtime Import Path Policy

Date: 2026-05-06

Current status: superseded for cutover planning by
`docs/architecture/v2-final-cutover-policy.md`. The release-note-only
compatibility details below remain as the historical record of the last public
import-path posture; do not extend this path by default.

This note records the first approved old public import-path deprecation stage
for the v2 migration.

## Policy

Old `src/runtime/**` paths remain import-compatible. No wrapper is deletion-ready
and no runtime/import-time warning is approved.

The first stage is a soft deprecation for the lowest-risk old helper and
flow-authoring paths. Soft deprecation means:

- docs and release wording can tell callers to prefer the neutral owner path;
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

## Release-Note Wording

Draft release note:

```text
The old runtime helper import paths listed in the v2 public runtime import-path
policy are now soft-deprecated. They continue to work during the compatibility
window, but new code should import from the listed `src/shared/**` or
`src/flows/**` owner paths. This release does not remove wrappers, change
package exports, or emit import-time deprecation warnings.
```

## Not Soft-Deprecated Yet

These paths remain supported without soft deprecation:

- connector wrappers under `src/runtime/connectors/**`;
- catalog and registry wrappers under `src/runtime/catalog-derivations.ts` and
  `src/runtime/registries/**`;
- `src/runtime/run-status-projection.ts`;
- `src/runtime/result-writer.ts`;
- `src/runtime/runner.ts` and `src/runtime/runner-types.ts`;
- retained runner, handler, trace, checkpoint, reducer, snapshot, and progress
  files.

## Review Boundaries

Review is still required before:

- deleting any old wrapper;
- changing package exports;
- adding import-time or runtime warnings;
- soft-deprecating connector, registry, run-status, result-writer, public
  runner, retained handler, retained trace, retained checkpoint, or saved-state
  paths;
- changing public compatibility behavior;
- changing retained/v1 checkpoint folder behavior;
- deleting retained runner/handler oracle tests;
- starting old runtime deletion.
