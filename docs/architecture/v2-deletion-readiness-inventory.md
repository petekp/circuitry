# Core-v2 Deletion Readiness Inventory

Date: 2026-05-07

## Current Status

Final cutover is complete for old runtime source paths. No old
`src/runtime/**` public import paths remain, and the public runtime path
manifest is intentionally empty.

Retained and v1 run folders fail closed with:

```text
This run folder was created by the retired runtime. Start a fresh run.
```

Do not recreate retained/v1 run-folder adapters.

## Removed Groups

The final cutover removed:

- retained compatibility facades;
- v1 run-status projection;
- old handler, trace, reducer, snapshot, and relay-selection implementation
  files;
- old flow-authoring wrappers;
- old shared-helper wrappers;
- old catalog and registry wrappers;
- old connector wrappers;
- old run-status, progress, and result writer wrappers;
- old checkpoint resume and checkpoint handler stubs;
- old public runner and runner type files.

## Current Owners

Current runtime behavior is owned by:

| Area | Owner |
|---|---|
| fresh flow execution | `src/core-v2/run/**` and `src/core-v2/executors/**` |
| checkpoint resume for v2 folders | `src/core-v2/run/checkpoint-resume.ts` |
| flow authoring, routing, and registries | `src/flows/**` |
| connector subprocesses and relay materialization | `src/connectors/**` |
| shared helper surfaces | `src/shared/**` |
| run-folder status projection | `src/run-status/**` |

## Historical Record

The old Phase 5.5 inventory was intentionally conservative because it still
preserved retained-runtime compatibility. That compatibility posture is now
superseded. The detailed file-by-file table was compressed into git history and
`docs/architecture/v2-architecture-history.md`.

Current deletion planning should start from this file and
`docs/architecture/v2-final-cutover-policy.md`, not from the removed historical
planning notes.
