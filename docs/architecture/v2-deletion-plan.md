# Circuit v2 Runtime Deletion Plan

Date: 2026-05-07

## Current State

The retained-runtime compatibility posture is superseded by
`docs/architecture/v2-final-cutover-policy.md`.

There are zero external users. The desired direction is final cutover, not more
external review packets or a longer compatibility window.

Retained and v1 run folders fail closed with exactly:

```text
This run folder was created by the retired runtime. Start a fresh run.
```

Do not add a v1 run-folder adapter.

## Runtime Selector

Current routing is deliberately narrow:

```text
matrix-supported fresh run -> core-v2
core-v2-marked checkpoint resume -> core-v2
retained/v1 checkpoint resume -> fail closed
future or unproven generated entry modes -> fail closed until proven in v2
unsupported flow/mode/depth outside the generated catalog -> fail closed
arbitrary explicit fixture -> fail closed unless strict v2 opt-in is supported
custom flow root -> fail closed unless strict v2 opt-in is supported
official wrapper-provenanced packaged host flow root -> selector matrix
unprovenanced packaged host flow root -> fail closed by default
programmatic composeWriter injection -> fail closed; no v2 hook is planned
```

The old rollback switch requests the retired runtime and now fails closed unless
strict v2 opt-in routes a supported fresh run through core-v2:

```text
CIRCUIT_DISABLE_V2_RUNTIME=1
```

Strict opt-in remains:

```text
CIRCUIT_V2_RUNTIME=1
```

Runtime decision diagnostics are display-only:

```text
CIRCUIT_SHOW_RUNTIME_DECISION=1
```

## Deleted Old Runtime Surface

No old `src/runtime/**` public import paths remain. The public runtime path
registry is intentionally empty.

Removed old runtime groups:

- runner and runner types;
- checkpoint resume and checkpoint handler stubs;
- retained compatibility facades and v1 run-status projection;
- handler, trace, reducer, snapshot, and relay-selection implementation files;
- flow-authoring wrappers;
- shared-helper wrappers;
- catalog and registry wrappers;
- connector wrappers;
- run-status, progress, and result writer wrappers.

Current owners live under:

- `src/core-v2/**`
- `src/shared/**`
- `src/flows/**`
- `src/connectors/**`
- `src/run-status/**`

## Evidence

Current v2 evidence includes:

- core-v2 unit tests under `tests/core-v2/`;
- generated-flow parity tests under `tests/parity/`;
- CLI default-selector tests under `tests/runner/cli-v2-runtime.test.ts`;
- retired runtime fail-closed tests under `tests/runner/`;
- public import-path guard tests in
  `tests/runner/public-runtime-paths.test.ts`;
- runtime boundary tests in `tests/contracts/engine-flow-boundary.test.ts`;
- generated-surface drift checks through `scripts/emit-flows.mjs --check`;
- full validation through `npm run verify`.

## Historical Record

The detailed phase-by-phase migration record is compressed into git history,
`docs/architecture/v2-checkpoint-history.md`,
`docs/architecture/v2-architecture-history.md`, and
`docs/architecture/v2-worklog.md`.

No new review packet is required for the completed cutover work. Prepare one
only if a new compatibility or package-surface ambiguity appears that local
tests cannot settle.
