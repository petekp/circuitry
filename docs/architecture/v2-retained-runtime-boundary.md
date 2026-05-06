# Circuit v2 Retained Runtime Boundary

Phase 4.42 formalizes the retained-runtime boundary after the default selector
and low-risk helper extraction work.

## Decision

Retained/v1 checkpoint resume remains retained-runtime-owned for the
foreseeable future.

This is intentional product ownership, not unfinished cleanup. Core-v2 owns
marker-gated v2 checkpoint folders. Retained compatibility still owns old or
unmarked v1 trace state, checkpoint request files, derived snapshots,
checkpoint report validation, and post-resume route continuation.

## Current Execution Split

```text
matrix-supported fresh run -> core-v2
core-v2-marked checkpoint resume -> core-v2
retained/v1 checkpoint resume -> retained compatibility
unsupported flow/mode/depth -> retained runtime
arbitrary explicit fixture -> retained runtime unless strict opt-in is set
programmatic composeWriter injection -> retained runtime
rollback path -> retained runtime
```

The completed default-selector milestone is:

```text
Matrix-supported fresh runs default to core-v2.
```

It is not:

```text
core-v2 owns all runtime behavior
old runtime replacement is complete
checkpoint resume migration is complete
old runtime deletion is ready
```

## Retained Runtime Responsibilities

The retained runtime remains the owner for:

1. retained/v1 checkpoint resume;
2. retained/v1 checkpoint folders;
3. unsupported flow, mode, and depth fallback;
4. arbitrary fixture fallback outside the strict v2 opt-in path;
5. programmatic `composeWriter` fallback;
6. rollback through `CIRCUIT_DISABLE_V2_RUNTIME=1`;
7. retained runner and handler oracle tests;
8. retained v1 trace, reducer, snapshot, and progress projection behavior needed
   by retained runs.

## Checkpoint Resume Contract

Checkpoint resume includes:

- checkpoint request discovery;
- request path and hash validation;
- allowed-choice validation;
- checkpoint report resume validation;
- original project root restoration;
- selection and config restoration;
- retained trace, reducer, and snapshot interaction;
- post-resume route execution;
- result, progress, and status behavior after resume.

Moving retained/v1 resume into core-v2 later would be a product feature, not a
cleanup slice.

Phase 5.14 adds `src/compat/retained-runtime.ts` as the compatibility facade for
the retained side. Phase 5.21 narrows retained/v1 checkpoint folder support into
`src/compat/retained-checkpoint-folders.ts`. CLI resume, handoff snapshot
loading, and run-status retained trace projection should reach saved-folder
support through that smaller boundary instead of importing retained
implementation files directly.

## Revisit Triggers

Revisit this boundary only if one of these becomes true:

- core-v2-owned checkpoint resume is a product requirement;
- old runtime deletion becomes a near-term goal;
- checkpoint UX needs a single v2-owned resume model;
- retained resume semantics need to diverge from current behavior;
- the team chooses to shrink retained resume behind an even smaller explicit
  module.

## What This Does Not Approve

This decision does not approve:

- old runtime deletion;
- routing checkpoint resume through core-v2;
- moving trace reader/writer, reducer, snapshot writer, progress projector, or
  checkpoint handler internals;
- moving connector subprocess modules;
- moving relay materialization;
- moving registries, router, catalog, or compiler infrastructure;
- removing rollback;
- making unsupported modes fail instead of retained fallback.

## Deletion Implications

Before old runtime deletion is reconsidered, every `src/runtime` file needs an
exact disposition:

```text
delete
retain as product fallback
retain as oracle or test support
move to neutral namespace
compatibility wrapper
```

There should be no unknowns in a deletion slice.

Because checkpoint resume is retained-runtime-owned, files required for retained
resume are not deletion candidates unless a later reviewed slice moves or
replaces their responsibility. That likely includes:

- `src/runtime/runner.ts`;
- `src/runtime/checkpoint-resume.ts`;
- `src/runtime/step-handlers/checkpoint.ts`;
- `src/runtime/trace-reader.ts`;
- `src/runtime/trace-writer.ts`;
- `src/runtime/reducer.ts`;
- `src/runtime/snapshot-writer.ts`;
- `src/runtime/append-and-derive.ts`;
- checkpoint writer registries.

## Next Phase

The generated public fresh-run selector milestone is complete for the current
catalog. The next deletion-adjacent phase should either add behavior-preserving
v2/shared oracle twins or pause for review before moving heavier ownership
boundaries such as connector subprocesses, relay materialization,
router/compiler infrastructure, public compatibility behavior, or saved-folder
semantics.

Do not continue moving retained runtime internals unless the target is a tiny
pure helper with no trace writes, progress writes, run file side effects,
connector subprocess behavior, schema or report validation ownership change, or
route execution behavior.
