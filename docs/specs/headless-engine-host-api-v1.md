# Headless Engine Host API V1

Status: Draft

Plan note: this draft is also used as a local plan-execution proof input. Do
not treat it as a shipped host API unless current code and contracts agree.

## Purpose

Circuit needs a small, stable headless surface that visual hosts can build on
without learning Circuit's internal trace format.

The V1 promise is:

> Given a Circuit run folder, Circuit can produce a stable status object that a
> host can render and act on.

This spec is intentionally narrow. It does not turn Circuit into a full
platform, a cockpit, a memory system, or a Capacitor backend. It gives those
things one dependable engine surface to build on later.

## Non-Goals

V1 does not include:

- a run index
- global run lookup
- process-liveness detection
- an attention model
- project profiles
- skill routing
- report manifests
- visual-host assumptions
- Capacitor-specific fields
- generated flow changes
- new terminal outcomes

## Core Principle

The host-facing state of a run is a projection:

```text
trace + state + reports -> RunStatusProjectionV1
```

The projection is authoritative for hosts. Events are only a live convenience.
If a host misses every event, it must still be able to recover by asking Circuit
for the current projection.

## Stage 0: Orientation Check

Purpose: prevent implementation from starting from guesses.

Before editing code, the implementing agent must produce a short orientation
note with:

- existing trace reader/parser functions to reuse
- existing snapshot/report helpers to reuse
- exact CLI entry point to modify
- exact test patterns to copy
- known ambiguities before implementation

No code changes begin until this note exists.

Check: if the agent cannot identify reusable readers and existing CLI/test
patterns, it must stop. Do not create a second trace parser.

## Stage 1: Run Status Projection Schema

Purpose: define the one host-facing object.

Add `RunStatusProjectionV1`.

Required fields:

```ts
api_version: "run-status-v1";
schema_version: 1;
run_id: string;
flow_id: string;
goal: string;
run_folder: string;
engine_state: "open" | "waiting_checkpoint" | "completed" | "aborted" | "invalid";
reason:
  | "active_or_unknown"
  | "checkpoint_waiting"
  | "run_closed"
  | "trace_invalid"
  | "manifest_invalid"
  | "unknown";
legal_next_actions: Array<"inspect" | "resume" | "none">;
```

Optional fields:

```ts
current_step?: {
  step_id: string;
  stage_id?: string;
  label?: string;
};

checkpoint?: {
  checkpoint_id: string;
  prompt: string;
  choices: Array<{
    id: string;
    label: string;
    value: string;
  }>;
};

terminal_outcome?: "complete" | "aborted" | "handoff" | "stopped" | "escalated";

last_event?: {
  sequence?: number;
  type: string;
  timestamp?: string;
};

operator_summary_path?: string;
operator_summary_markdown_path?: string;
result_path?: string;
```

Use `open`, not `running`. A run folder cannot prove that a process is alive.
It can only prove that the persisted run has not closed.

Check: schema tests must prove checkpoint choices are structural. Hosts must not
parse checkpoint choices from display text.

## Stage 2: Projection Runtime

Purpose: derive host truth from existing run files.

Implement exactly one function:

```ts
projectRunStatusFromRunFolder(runFolder: string): RunStatusProjectionV1
```

Rules:

- read files only
- do not write snapshots
- do not repair traces
- do not infer process liveness
- do not duplicate trace parsing if existing readers can be reused
- missing optional summaries do not make a run invalid
- corrupt required files produce `engine_state: "invalid"`

State derivation:

| File condition | `engine_state` | `reason` | Notes |
|---|---|---|---|
| manifest unreadable or malformed | `invalid` | `manifest_invalid` | Host can show a broken run. |
| trace unreadable or malformed | `invalid` | `trace_invalid` | Do not throw for normal host reads. |
| terminal outcome `complete` | `completed` | `run_closed` | Include `terminal_outcome`. |
| terminal outcome `aborted` | `aborted` | `run_closed` | Include `terminal_outcome`. |
| terminal outcome `handoff` | `completed` | `run_closed` | V1 treats non-error terminal closure as completed-with-outcome. |
| terminal outcome `stopped` | `completed` | `run_closed` | Include outcome so hosts can distinguish it. |
| terminal outcome `escalated` | `completed` | `run_closed` | Include outcome so hosts can distinguish it. |
| unresolved checkpoint exists | `waiting_checkpoint` | `checkpoint_waiting` | Must include structural choices. |
| no terminal outcome, no checkpoint | `open` | `active_or_unknown` | Means file-open, not process-running. |

Check: no other code path may independently compute `engine_state`.

## Stage 3: Golden Fixtures

Purpose: stop idealized tests from lying.

Fixtures must come from real run folders when possible. Minimize them only as
needed.

Required fixtures:

- completed run
- aborted run
- handoff, stopped, or escalated terminal run, if cheap to produce; otherwise
  add a narrow synthetic fixture
- waiting checkpoint with valid choices
- open run with no terminal event
- missing operator summary
- corrupt trace
- malformed or missing manifest

Tests assert semantic fields, not entire JSON blobs.

Required assertions:

- corrupt trace returns projection JSON, not an uncaught crash
- missing summary keeps the run valid
- checkpoint choices include stable `id`, `label`, and `value`
- terminal outcomes are preserved
- open run is not called running

Check: no host-facing CLI work until projection fixtures pass.

## Stage 4: `runs show`

Purpose: expose projection without creating a second implementation.

Command:

```bash
circuit runs show --run-folder <path> --json
```

Rules:

- CLI only parses args, calls `projectRunStatusFromRunFolder`, and prints JSON
- no CLI-specific interpretation
- no trace parsing in CLI
- no hidden fallback behavior

Exit behavior:

| Case | Output | Exit |
|---|---|---|
| valid projection | `RunStatusProjectionV1` | `0` |
| invalid run files | `RunStatusProjectionV1` with `engine_state: "invalid"` | `0` |
| folder does not exist | `EngineErrorV1` | `1` |
| bad invocation | `EngineErrorV1` | `2` |
| unexpected crash | `EngineErrorV1` | `1` |

Check: `runs show` must work against every Stage 3 fixture.

## Stage 5: `runs list` First, `status` Later

Purpose: avoid smuggling UX policy into the engine.

Split this stage.

### Stage 5A: `runs list`

Command:

```bash
circuit runs list --project-root <path> --json
```

Rules:

- scan `<project-root>/.circuit/runs/*`
- call the same projection function for each run folder
- skip non-directories
- include per-run projection failures without failing the whole list
- sort by latest known file timestamp descending
- do not recommend, prioritize, infer attention state, or claim an active run

### Stage 5B: `status`

Command:

```bash
circuit status --project-root <path> --json
```

V1 `status` may only summarize counts and return projections. It must not
decide what the host should show first.

Check: if `status` needs terms like `needs attention`, `stale`, or `primary`,
defer it. That belongs to a host or a later product layer.

## Stage 6: Resume by Run Id

Purpose: make host control easier without inventing global state.

Command:

```bash
circuit resume \
  --project-root <path> \
  --run-id <id> \
  --checkpoint-choice <value> \
  --progress jsonl
```

Rules:

- `--project-root` is required with `--run-id`
- scan project run folders to resolve the run id
- fail if zero matches
- fail if multiple matches
- call the projection internally before resume
- only allow resume if `legal_next_actions` includes `resume`
- validate `checkpoint-choice` against `checkpoint.choices[].value`
- then delegate to the existing run-folder resume path
- output the resolved run folder

Errors:

- `run_not_found`
- `run_not_resumable`
- `checkpoint_choice_invalid`
- `invalid_invocation`
- `internal_error`

Check: resume-by-id must not bypass existing checkpoint validation.

## Stage 7: Host Events

Purpose: improve live streams without making them authoritative.

Minimal event changes only:

- add `event_id`
- add per-run `sequence`
- ensure `run_id` is present
- ensure `project_root` is present when known

Do not add broad new event types.

Do not add `engine_state` to every event in V1 unless it is computed by the
same projection/state-mapping module. Safer default: omit it. Events say what
happened; `runs show` says what is true now.

Check: if a host misses all events, it must still recover fully from `runs show`.

## Stage 8: Proof Host

Purpose: prove a non-Circuit host can supervise a run.

Build:

```bash
scripts/dev/circuit-watch.mjs <run-folder>
```

Behavior:

- calls `circuit runs show --run-folder <path> --json`
- prints state
- prints checkpoint choices when present
- accepts one checkpoint choice
- resumes using the public CLI
- re-queries projection after resume
- never reads trace files directly
- never imports Circuit internals

Success test: delete all live-event assumptions. The proof host should still
work by polling `runs show`.

Check: if `circuit-watch` needs trace-specific knowledge, the API failed.

## Cross-Stage Guardrails

These apply everywhere:

- one projection function owns host-facing run state
- `open` never means confirmed process liveness
- checkpoint choices are machine values, not parsed prose
- events are convenience, not truth
- hosts never parse trace files
- no run index in V1
- no global lookup in V1
- no Capacitor-specific fields
- no attention model
- no project profile
- no skill routing
- no report manifest
- no visual-host assumptions
- no generated flow changes
- no new terminal outcomes

## Done Criteria

A solid V1 is done when:

1. A host can inspect any run folder through `runs show`.
2. The host can tell whether the run is open, waiting, completed, aborted, or
   invalid.
3. The host can display checkpoint choices without parsing prose.
4. The host can resume by run id inside a project.
5. The host can recover after missing all live events.
6. The proof host can supervise a run without reading trace files.
