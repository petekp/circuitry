# Circuit v2 Checkpoint Resume Parity Plan

Phase 5.1 designs checkpoint pause/resume parity for core-v2.

This is a product feature plan, not cleanup. It does not approve code movement,
old runtime deletion, or routing checkpoint modes through core-v2.

## Implementation Status

Phase 5.2 implements the first fixture-level vertical slice from this plan:

- waiting checkpoint is a first-class core-v2 graph result;
- v2 checkpoint request/resolution fields are first-class trace fields;
- a dedicated test fixture pauses, projects waiting status/progress, resumes,
  restores saved request context, continues the graph, and closes;
- CLI resume dispatch follows saved run-folder engine identity for core-v2
  folders;
- Phase 5.3 routes Build deep through the core-v2 checkpoint path by default.

Old retained checkpoint folders still resume through retained runtime. Build
tournament and other checkpoint/tournament modes remain retained until
separately proven.

## Decision

Implement v2 checkpoint pause/resume only for **new core-v2 checkpoint run
folders** in the first implementation slice.

Retained checkpoint run folders continue to resume through the retained runtime.
No migration of existing retained checkpoint folders is required for the first
v2 checkpoint slice.

## Why This Comes Next

The default selector milestone is complete for matrix-supported fresh-run modes
after `npm run soak:v2` passed.

The largest remaining retained-runtime responsibility is checkpoint resume. As
long as checkpoint resume stays retained-only, these files remain legitimately
live:

- `src/runtime/runner.ts`;
- `src/runtime/checkpoint-resume.ts`;
- `src/runtime/step-handlers/checkpoint.ts`;
- `src/runtime/trace-reader.ts`;
- `src/runtime/trace-writer.ts`;
- `src/runtime/reducer.ts`;
- `src/runtime/snapshot-writer.ts`;
- `src/runtime/append-and-derive.ts`;
- checkpoint writer registries;
- retained checkpoint resume tests.

So the next migration work is not more helper extraction. It is a v2 feature:
teach core-v2 how to pause at a checkpoint, project waiting status, accept a
resume choice, validate the durable request context, continue the graph, and
close the result.

## Current State

core-v2 handles auto-resolved checkpoint choices:

```text
lite / standard / autonomous safe choice
  -> executeCheckpointV2(...)
  -> write checkpoint request
  -> write checkpoint response
  -> append checkpoint.resolved
  -> continue graph
```

For the dedicated Phase 5.2 fixture, waiting depths now return a v2 waiting
checkpoint result:

```text
deep / tournament
  -> write checkpoint request
  -> append checkpoint.requested
  -> return checkpoint_waiting without run.closed
```

Public generated checkpoint modes that are not yet in the v2 selector matrix
remain retained today.

Retained runtime currently owns waiting and resume:

```text
checkpoint step pauses
  -> writes checkpoint request
  -> appends checkpoint.requested
  -> returns checkpoint_waiting without run.closed

resume command
  -> verifies manifest snapshot
  -> reads retained trace
  -> derives snapshot
  -> validates checkpoint request path/hash/schema/context
  -> validates checkpoint report hash
  -> restores original project root and selection config
  -> appends checkpoint.resolved
  -> continues post-checkpoint route
  -> writes result/progress/operator summary
```

## First Implementation Target

Use a dedicated v2 checkpoint fixture before routing any public Build
checkpoint mode through v2.

Recommended fixture:

```text
generated? no
tests/core-v2 fixture or tests/soak fixture
flow id: build or runtime-proof
entry mode: deep
steps:
  checkpoint -> relay or verification -> close
```

Rationale:

- avoids changing generated public flow routing while parity is still being
  proven;
- keeps the test small enough to reason about request/resume contracts;
- exercises the graph continuation path without bringing all Build behavior into
  the first slice.

After the fixture is green, the next public routing candidate is:

```text
Build deep -> core-v2
```

Do not route Build tournament or Explore tournament in the first public slice.

## V2 Trace Contract

Add explicit v2 trace fields for waiting checkpoints. The trace entries should
stay in the v2 trace model, not reuse v1 trace entries.

### checkpoint.requested

Required top-level fields:

```text
kind: checkpoint.requested
run_id
step_id
attempt
request_path
request_report_hash
allowed_choices
checkpoint_report_sha256?
```

Required data fields:

```text
prompt
```

The request hash is the SHA-256 hash of the exact request file bytes.

Do not use `report_path` for checkpoint request files. A checkpoint request is
not a report, and overloading report-path semantics would confuse future
status, progress, report discovery, and audit tools.

### checkpoint.resolved

Required top-level fields:

```text
kind: checkpoint.resolved
run_id
step_id
attempt
selection
auto_resolved
resolution_source
response_path
```

Optional data fields:

```text
debug or descriptive fields only
```

Auto-resolved checkpoint behavior can keep the existing `auto_resolved: true`
shape, but waiting/resume parity should assert the operator path explicitly.
Resume, status, and progress code should read these first-class fields rather
than relying on `data`.

## Request File Contract

The v2 request file should stay compatible with the retained request body shape
where practical:

```json
{
  "schema_version": 1,
  "step_id": "checkpoint-step",
  "prompt": "Choose how to proceed.",
  "allowed_choices": ["continue"],
  "safe_default_choice": "continue",
  "safe_autonomous_choice": "continue",
  "execution_context": {
    "project_root": "/original/project/root",
    "selection_config_layers": [],
    "checkpoint_report_sha256": "..."
  }
}
```

Rules:

- write the request before returning waiting status;
- hash the raw request text after writing it;
- append the request hash to `checkpoint.requested`;
- on resume, read raw request text first and compare its hash before parsing;
- only parse JSON after hash validation passes;
- reject stale request files whose `schema_version` or `step_id` does not match;
- restore `project_root` and `selection_config_layers` from the request, not
  from resume-time invocation.

## Response File Contract

On valid resume, write:

```json
{
  "schema_version": 1,
  "step_id": "checkpoint-step",
  "selection": "continue",
  "resolution_source": "operator"
}
```

Rules:

- reject selections outside checkpoint allowed choices;
- reject selections outside `check.allow`;
- write the response before appending `checkpoint.resolved`;
- append `checkpoint.resolved` with `response_path`;
- continue routing from the selected route if present, otherwise from `pass`.

## Checkpoint Report Validation

If the checkpoint step writes a report and the request execution context carries
`checkpoint_report_sha256`, resume must validate that report through the
registered checkpoint writer before accepting a choice.

Rules:

- if a report hash is present and no `validateResumeContext` exists, reject;
- if the report file is missing, reject;
- if the report hash differs, reject;
- if the report shape is invalid, reject;
- do not re-stamp the checkpoint report after resume.

The first v2 implementation can reuse the existing checkpoint writer registry.
Do not move registries in the same slice.

## Resume Command Behavior

The CLI should dispatch resume by inspecting the saved run folder:

```text
resume --run-folder <folder> --checkpoint-choice <choice>
  -> if trace is marked engine=core-v2, call v2 resume
  -> otherwise call retained resume
```

This keeps old retained checkpoint folders supported and lets new v2 checkpoint
folders resume through core-v2.

Strict and rollback flags:

- `CIRCUIT_DISABLE_V2_RUNTIME=1` should not force a v2 checkpoint folder through
  retained resume if the folder is already a v2 checkpoint folder. Resume should
  follow the run folder's engine marker.
- `CIRCUIT_V2_RUNTIME=1` should not force retained checkpoint folders through v2.
  Resume should still follow the run folder's engine marker.

Reason: resume is not a fresh routing decision. It is continuation of a saved
run identity.

## Core-V2 Runner Shape

Add a v2 resume entry point rather than overloading the fresh-run API:

```ts
resumeCompiledFlowV2({
  runDir,
  selection,
  now,
  relayer,
  relayConnector,
  childRunner,
  worktreeRunner,
  progress,
})
```

The resume entry point should:

1. verify manifest snapshot bytes;
2. parse saved flow bytes;
3. load v2 trace;
4. validate bootstrap run id, flow id, and manifest hash against the snapshot;
5. reject closed runs;
6. find the latest unresolved `checkpoint.requested`;
7. validate request hash and request body;
8. validate allowed choice and `check.allow`;
9. validate checkpoint report hash if present;
10. restore project root and selection config from the request;
11. resume graph execution at the checkpoint step and attempt;
12. write checkpoint response;
13. append `checkpoint.resolved`;
14. continue post-checkpoint routing;
15. close result and emit progress/operator summary.

## Graph Continuation

Do not restart the graph from the entry step.

The v2 runner needs a resume mode with:

```text
initialTraceEntries
startStepId
resumeCheckpoint { stepId, attempt, selection }
restored projectRoot
restored selectionConfigLayers
```

The execution loop should:

- load existing trace entries into `TraceStore`;
- preserve existing sequence numbers;
- skip fresh run bootstrap;
- reconstruct completed step counts and attempt state from existing trace
  entries before continuing;
- count prior `step.completed` entries by `step_id` the same way the fresh graph
  loop would have counted them in memory;
- handle prior `step.aborted` entries according to current fresh-run cycle and
  attempt semantics;
- require the resume attempt to match the latest unresolved
  `checkpoint.requested` attempt;
- enter the checkpoint step as a resumed checkpoint;
- write the response and append `checkpoint.resolved`;
- continue from the selected route or pass route;
- close normally.

This reconstruction is required so retry, revise, cycle protection, attempt
numbering, and already-completed step checks do not diverge after resume.

## Status Projection

`src/run-status/v2-run-folder.ts` should project waiting v2 checkpoints.

Waiting projection requires:

- v2 trace marker;
- manifest snapshot identity match;
- open run, no `run.closed`;
- latest `checkpoint.requested` without matching `checkpoint.resolved`;
- request file exists;
- request hash matches trace;
- saved flow bytes parse;
- checkpoint step exists;
- choices can be projected to `RunStatusProjectionV1.checkpoint`.

Output shape should match the existing public status schema:

```text
engine_state: waiting_checkpoint
reason: checkpoint_waiting
legal_next_actions: [inspect, resume]
checkpoint:
  checkpoint_id
  step_id
  attempt
  prompt
  choices
  request_path
```

Malformed request, stale request, identity mismatch, or invalid saved flow should
produce invalid projection, not a resume action.

## Progress Events

For pause:

- `checkpoint.waiting`;
- `user_input.requested`;
- task list update showing checkpoint step in progress or checkpoint tone.

For resume:

- `checkpoint.resolved` does not currently have a public progress schema event;
  the minimum acceptable public progress is continued `step.completed` /
  downstream step progress / `run.completed`.
- If a new public `checkpoint.resolved` progress event is desired, add it as a
  separate schema change with contract tests. Do not invent an untyped event.

For aborts during resume:

- `step.aborted`;
- `run.aborted`;
- result reason carries the resume failure if the run closes.

## Result And Operator Summary

After resumed close:

- `reports/result.json` path remains `reports/result.json`;
- `manifest_hash` matches the saved manifest snapshot and bootstrap trace;
- `trace_entries_observed` includes pre-resume and post-resume trace entries;
- `closed_at` is set at close time;
- terminal outcome follows the same mapping as fresh v2 close;
- operator summary paths are written by the CLI wrapper as they are today for
  fresh v2 runs.

## Non-Support For Old Retained Checkpoint Folders

The first v2 checkpoint implementation should not support migrating old
retained checkpoint folders into v2 resume.

Policy:

```text
retained checkpoint folder -> retained resume
core-v2 checkpoint folder -> core-v2 resume
```

This avoids inventing a trace translation layer during the first v2 resume
slice.

## Minimal Implementation Slices

### Phase 5.2 - fixture-level v2 checkpoint pause/resume

Add a dedicated fixture/test path where core-v2 can pause and resume end to
end before any public checkpoint mode routes through v2.

Pause proof:

- write a checkpoint report if the step has one;
- write a request file;
- append `checkpoint.requested` with first-class `request_path`,
  `request_report_hash`, and `allowed_choices` fields;
- return a first-class waiting graph result instead of throwing;
- emit checkpoint/user-input progress;
- leave the run open without `run.closed` and without `reports/result.json`;
- project `runs show --json` as waiting checkpoint.

Resume proof:

- add `resumeCompiledFlowV2(...)` for v2-marked checkpoint folders;
- accept a valid resume choice;
- reject invalid choices;
- reject tampered, stale, or missing requests;
- validate checkpoint report hashes;
- restore original project root;
- restore original selection config;
- continue through a post-checkpoint relay step;
- continue through a post-checkpoint verification step;
- reconstruct prior completed attempts before continuing;
- continue trace sequence numbers after existing entries;
- write `reports/result.json` after resumed close;
- project `runs show --json` before and after resume.

No CLI default routing change yet.

### Phase 5.3 - route one public checkpoint mode

After the fixture proves pause and resume:

```text
Build deep -> core-v2
```

Keep Build tournament and other checkpoint-heavy modes retained until separately
proven.

### Phase 5.4 - retained checkpoint deletion review

Only after public v2 checkpoint resume is proven:

- classify retained checkpoint tests again;
- classify `src/runtime/checkpoint-resume.ts`;
- classify checkpoint handler dependencies;
- decide what old checkpoint code remains product fallback versus deletion
  candidate.

## Required Tests

Before any public checkpoint mode routes through v2, require:

```text
npm run check
npm run lint
npm run build
npx vitest run tests/core-v2 tests/parity
npx vitest run tests/soak
npx vitest run tests/runner/build-checkpoint-exec.test.ts
npx vitest run tests/runner/run-status-projection.test.ts
npx vitest run tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/contracts/progress-event-schema.test.ts
npm run soak:v2:fast
npm run soak:v2
npm run verify
git diff --check
```

## Hard Non-Goals

Do not combine v2 checkpoint resume with:

- old runtime deletion;
- retained trace reader/writer movement;
- reducer or snapshot writer movement;
- progress projector movement;
- connector subprocess movement;
- relay materializer movement;
- registry movement;
- route changes for more than one public checkpoint mode;
- generated surface changes outside the specific mode being enabled.

## Required Plan Corrections Before Coding

Phase 5.2 starts only after these review corrections are reflected in the
implementation work order:

1. checkpoint request and resolution fields used by resume/status/progress are
   first-class v2 trace fields, not only `data` fields;
2. `report_path` is not used for checkpoint request paths;
3. waiting checkpoint is a first-class graph result, not a thrown executor
   error;
4. resumed graph execution reconstructs prior completed step counts and attempt
   state from the existing v2 trace before continuing.

## Review Gate

Request focused architecture review before Phase 5.2 implementation.

The review should decide whether this plan's first implementation target,
request/response contracts, resume dispatch rule, and status/progress semantics
are acceptable.

## Review Questions

Ask the reviewer to answer these before implementation:

1. Should Phase 5.2 implement the fixture-level pause and resume path as one
   vertical slice?
2. Are the proposed v2 trace fields acceptable as explicit `data` fields, or
   should any of them become first-class v2 trace fields?
3. Should rollback flags be ignored for existing v2 checkpoint folders, as this
   plan recommends, because resume follows saved run identity?
4. Should v2 request/response bodies intentionally match retained
   `schema_version: 1` checkpoint files for the first slice?
5. Is Build deep the right first public routing candidate after fixture parity,
   or should a narrower public fixture remain the only v2 checkpoint path until
   more evidence exists?
