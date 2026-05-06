# Circuit v2 Checkpoint 5.2

## Summary

Phase 5.2 implements fixture-level core-v2 checkpoint pause/resume.

This is a product-feature slice, not old-runtime cleanup. It does not route
Build deep through core-v2 by default, does not migrate old retained
checkpoint folders, and does not delete old runtime files.

## What Changed

Added:

- `src/core-v2/run/checkpoint-resume.ts`
- `tests/core-v2/checkpoint-resume-v2.test.ts`
- `docs/architecture/v2-checkpoint-5.2.md`

Updated:

- `src/core-v2/domain/trace.ts`
- `src/core-v2/domain/step.ts`
- `src/core-v2/executors/checkpoint.ts`
- `src/core-v2/projections/progress.ts`
- `src/core-v2/run/compiled-flow-runner.ts`
- `src/core-v2/run/graph-runner.ts`
- `src/core-v2/run/run-context.ts`
- `src/run-status/v2-run-folder.ts`
- `src/cli/circuit.ts`
- `docs/architecture/v2-deletion-plan.md`
- `docs/architecture/v2-worklog.md`
- `HANDOFF.md`

## Behavior Added

Core-v2 can now pause and resume a marked v2 checkpoint run folder in a
dedicated fixture path.

Pause now writes:

- checkpoint request file using the retained-compatible `schema_version: 1`
  request body;
- `checkpoint.requested` trace entry with first-class `request_path`,
  `request_report_hash`, `allowed_choices`, and optional
  `checkpoint_report_sha256`;
- `checkpoint.waiting` progress;
- `user_input.requested` progress.

Pause intentionally does not write:

- `step.completed`;
- `step.aborted`;
- `run.closed`;
- `reports/result.json`.

Resume now:

- detects a core-v2 run folder by saved bootstrap engine marker;
- verifies manifest snapshot bytes and bootstrap run identity;
- rejects closed runs;
- finds the latest unresolved checkpoint request;
- validates that the traced request path matches the saved flow's declared
  checkpoint request path;
- validates that traced checkpoint choices match the saved flow's checkpoint
  choices before accepting the operator selection;
- validates raw request hash before JSON parsing;
- validates request schema, step id, allowed choices, and `check.allow`;
- validates checkpoint report hash when the request carries one;
- restores `projectRoot` and selection config layers from the saved request;
- writes the response before appending `checkpoint.resolved`;
- appends first-class resolution fields on `checkpoint.resolved`;
- reconstructs completed step counts from existing trace before continuing;
- continues graph execution from the checkpoint step and closes normally.

The CLI resume dispatcher now follows saved run-folder engine identity:

```text
core-v2-marked run folder -> core-v2 resume
retained/v1 run folder -> retained resume
```

Fresh-run rollback and strict flags do not override saved resume ownership.

## Tests Added

`tests/core-v2/checkpoint-resume-v2.test.ts` covers:

- v2 fixture pause leaves the run open with no result;
- waiting status projection for v2 checkpoint folders;
- invalid waiting status projection when the traced request path or request
  choices do not match the saved flow;
- checkpoint waiting and user-input progress events;
- valid resume continues through relay, verification, close, and result write;
- project root and selection config restoration from the request;
- invalid choice rejection;
- request path mismatch rejection before accepting an alternate request file;
- missing request file rejection;
- tampered request hash rejection before JSON parsing;
- stale schema and step-id request rejection after updating the trace hash;
- stale request choice rejection after updating the trace hash;
- stale trace choice rejection before `checkpoint.resolved` is written;
- already-resolved checkpoint rejection;
- closed-run rejection;
- missing checkpoint report rejection when the request carries a report hash;
- checkpoint report hash validation when a request carries a report hash;
- completed-step reconstruction before resumed continuation;
- CLI resume dispatch by saved core-v2 engine marker with rollback disabled.

`tests/runner/build-checkpoint-exec.test.ts` also covers the inverse resume
dispatch boundary: retained/v1 checkpoint folders still resume on the retained
runtime even when `CIRCUIT_V2_RUNTIME=1`.

## Boundaries Preserved

No old runtime deletion is approved.

Still retained-runtime-owned:

- old retained checkpoint folders;
- public checkpoint-waiting modes not yet routed through core-v2;
- retained checkpoint handler behavior;
- retained trace reader/writer;
- retained reducer and snapshot writer;
- retained progress projector;
- old runner and old step handlers;
- unsupported mode fallback;
- arbitrary fixture fallback;
- programmatic `composeWriter` fallback;
- rollback for fresh runs.

## Validation

Passed for this checkpoint:

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run tests/core-v2/checkpoint-resume-v2.test.ts`
- `npx vitest run tests/core-v2 tests/parity`
- `npx vitest run tests/runner/run-status-projection.test.ts tests/runner/cli-v2-runtime.test.ts tests/contracts/progress-event-schema.test.ts`
- `npx vitest run tests/soak`
- `npm run soak:v2:fast`
- `npm run soak:v2`
- `npm run test:fast`
- `npm run check-flow-drift`
- `npm run verify`
- `git diff --check`

Note: `npm run soak:v2` itself runs `tests/soak`, `npm run verify`, and
`npm run check-flow-drift`. The explicit `test:fast` and `git diff --check`
passes were run after that gate.

## Next Recommended Action

Do not route Build deep by default yet.

Next should be a Build-deep candidate smoke:

```text
Phase 5.2.1:
  Build deep through explicit v2 candidate/strict path
  prove waiting status, resume, report hash validation, project root restore,
  selection config restore, post-checkpoint continuation, progress, and result
```

Only after that should Build deep be considered for the default selector
matrix.
