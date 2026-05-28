# Run-Supervisor Contract Sketch V1

Status: contract sketch and architecture proof, not current behavior.

Date: 2026-05-28

## Decision

The Run-centered target can be represented without changing production runtime
behavior if Run is modeled as a **supervisor envelope** over existing compiled
process runs.

The supervisor envelope is not a compiled flow graph. It does not walk steps,
resolve checkpoints, execute connectors, or append child trace entries. It owns
product-level decisions:

- turning operator intent into a goal contract;
- choosing one or more process attempts;
- calling the existing runtime for each process attempt;
- deciding whether the overall goal is done, blocked, or needs another process;
- writing a short human surface and agent-facing artifacts;
- recording memory update events with reasons.

Each process attempt remains an ordinary compiled-flow run with its own current
run folder, trace, reports, checkpoint records, and `RunResult`.

This keeps the runtime kernel small and makes the target testable before a
migration starts.

## Evidence Used

Current-source evidence:

- Product alignment: [CONTEXT.md](../../CONTEXT.md)
- Target audit: [run-centered-architecture-audit-v1.md](run-centered-architecture-audit-v1.md)
- Target hypothesis:
  [target-architecture-hypothesis-v1.md](target-architecture-hypothesis-v1.md)
- Current Run command: [src/commands/run.md](../../src/commands/run.md)
- CLI run path and history recall wiring: [src/cli/circuit.ts](../../src/cli/circuit.ts)
- Router: [src/flows/router.ts](../../src/flows/router.ts)
- Goal flow graph and schemas:
  [src/flows/goal/data.ts](../../src/flows/goal/data.ts),
  [src/flows/goal/reports.ts](../../src/flows/goal/reports.ts)
- Runtime graph execution:
  [src/runtime/run/graph-runner.ts](../../src/runtime/run/graph-runner.ts),
  [src/runtime/executors/sub-run.ts](../../src/runtime/executors/sub-run.ts)
- Runtime capabilities: [src/runtime/run/capabilities.ts](../../src/runtime/run/capabilities.ts)
- Checkpoints:
  [src/runtime/executors/checkpoint.ts](../../src/runtime/executors/checkpoint.ts),
  [docs/contracts/run.md](../contracts/run.md)
- Memory:
  [src/history/run-start-recall.ts](../../src/history/run-start-recall.ts),
  [src/history/memory-preview.ts](../../src/history/memory-preview.ts),
  [src/schemas/memory-input.ts](../../src/schemas/memory-input.ts)
- Host and generated surfaces:
  [docs/contracts/host-rendering.md](../contracts/host-rendering.md),
  [docs/generated-surfaces.md](../generated-surfaces.md)
- Current Goal proof tests:
  [tests/runner/goal-flow.test.ts](../../tests/runner/goal-flow.test.ts),
  [tests/contracts/goal-report-schemas.test.ts](../../tests/contracts/goal-report-schemas.test.ts)

Local probes:

```bash
git status --short
rg -n "Run supervisor|process attempt|memory update event" docs src tests -g '*.md' -g '*.ts'
rg -n "classifyCompiledFlowTask|prepareRunStartHistoryRecall|executeExecutableFlow|operatorSummary|historyRecall|progressSurface" src/cli/circuit.ts
rg -n "sub-run|selected_flow_target|goal.gate|goal.result|completion-gate" src/flows/goal tests/runner/goal-flow.test.ts tests/contracts/goal-report-schemas.test.ts
rg -n "checkpoint.requested|checkpoint.resolved|memoryInputs|historyRecallReport|run.closed|run.bootstrapped" src/runtime docs/contracts/run.md
```

## Current Facts That Bound The Contract

| Current Fact | Contract Consequence | Confidence |
| --- | --- | --- |
| `/circuit:run` is a direct command and router entry, not a flow. | A future Run supervisor can be source-owned outside the flow package model. | High |
| The CLI already prepares history recall and passes `memoryInputs` and `historyRecallReport` into runtime capabilities. | The supervisor can consume memory hints before process selection without changing child process execution. | High |
| Runtime graph execution writes a manifest snapshot, bootstraps trace, writes reports, handles checkpoints, and closes with `RunResult`. | The supervisor should call the runtime, then read `RunResult` and report paths. It should not duplicate graph mechanics. | High |
| The sub-run executor admits child work back into the parent only through the child `RunResult`. | A supervisor-level process attempt can use the same safe shape: child run result plus refs, not child trace internals as authority. | High |
| Goal already has contract, evidence evaluation, recovery, two-pass gate, and false-complete protections. | Run should reuse these semantics, but not Goal's static one-child-flow graph shape. | High |
| Checkpoint runtime already has request, waiting, resume, response, and trace pairing semantics. | A decision packet can reference current checkpoint artifacts or request a supervisor-level decision without changing checkpoint trace rules. | Medium |
| Memory input schema forces `authority: "hint_only"` and rejects authority-smuggling categories. | Memory update events must remain cited and explanatory; they must not grant proof, routing, checkpoint, or recovery authority. | High |
| Generated surfaces distinguish direct commands, public flows, internal flows, and generated host mirrors. | Run can become the dominant generated surface later without deleting existing process packages. | High |

## Boundary Contract

| Boundary | Owns | Must Not Own |
| --- | --- | --- |
| Host adapter | Invokes Run, renders progress, renders final surface output, renders decision packets or checkpoint questions. | Flow selection, done judgment, memory authority, or proof judgment. |
| Run supervisor | Goal contract, process plan, process attempts, completion gate, blocked decision, memory update event, compact surface output. | Step walking, connector execution, checkpoint resume validation, manifest snapshots, generated host rendering. |
| Process runtime | One compiled process graph at a time: trace, reports, checkpoint waiting/resume, result closure. | The operator's whole Run lifecycle. |
| Process library | Built-in flow packages and future authored flows as selectable process packages. | Product entrypoint ownership. |
| Memory service | Hint-only recall and explicit update events with scope, source, and reason. | Silent behavior changes or current proof authority. |
| Surface projector | Short human status and final answer over supervisor artifacts. | Agent-facing proof bundle or internal planning state. |

## Supervisor Envelope

The smallest useful top-level artifact is one supervisor record. Schema names
below are provisional; the important part is the shape.

```ts
type RunSupervisorRecord = {
  schema: 'run.supervisor@v0';
  run_id: string;
  operator_intent: string;
  explicit_constraints: string[];
  explicit_process_request?: ProcessId;
  memory_context: MemoryUseSummary;
  goal_contract: RunGoalContract;
  process_plan: RunProcessPlan;
  process_attempts: RunProcessAttempt[];
  completion_gate: RunCompletionGate;
  decision_packets: RunDecisionPacket[];
  memory_update_events: RunMemoryUpdateEvent[];
  surface_output: RunSurfaceOutput;
  outcome: 'complete' | 'needs_attention' | 'blocked' | 'failed' | 'handoff';
};
```

The envelope can live in a supervisor artifact folder while child process
attempts keep their normal runtime run folders. That avoids changing
`trace.ndjson`, manifest snapshots, checkpoint resume, or existing `runs`
inspection behavior during the proof phase.

## Input Shape

```ts
type RunSupervisorInput = {
  operator_intent: string;
  explicit_constraints: string[];
  explicit_process_request?: ProcessId;
  history_recall?: HistoryRecallReportV1;
  memory_inputs: MemoryInputV0[];
  host_capabilities: {
    progress_jsonl: boolean;
    native_questions: boolean;
    rich_html: boolean;
    deep_links: boolean;
  };
};
```

Rules:

- `operator_intent` is the operator's task text.
- `explicit_process_request` is optional. If present, it constrains selection
  but does not bypass the goal contract or completion gate.
- `memory_inputs` are hint-only context. They can inform the contract and plan,
  but current evidence still has to be produced by the current run.
- `host_capabilities` affect projection only. They must not alter proof
  authority.

## Output Shapes

### Goal Contract

The Run goal contract generalizes today's `goal.contract@v1` without carrying
Goal's static selected child flow requirement.

```ts
type RunGoalContract = {
  schema: 'run.goal-contract@v0';
  objective: string;
  scope: {
    in: string[];
    out: string[];
    assumptions: string[];
  };
  constraints: string[];
  done_when: Array<{
    id: string;
    claim: string;
    required_evidence: Array<{
      kind: 'command' | 'report' | 'review' | 'source' | 'checkpoint';
      description: string;
      required: boolean;
    }>;
  }>;
  recovery_policy: {
    max_process_attempts: number;
    allowed_routes: Array<
      | 'retry-process'
      | 'run-fix'
      | 'run-review'
      | 'run-explore'
      | 'split-to-pursue'
      | 'checkpoint'
      | 'handoff'
      | 'blocked'
    >;
  };
  stop_conditions: string[];
  completion_gate: {
    required_passes: 2;
    blocking_severities: Array<'critical' | 'high' | 'medium'>;
    reset_on_blocking_finding: true;
  };
};
```

Confirmed source fit:

- `GoalContract` already models objective, scope, constraints, done claims,
  required evidence, recovery routes, stop conditions, and a two-pass gate.
- The only current field that does not fit the target is `selected_flow_target`,
  because Run may need zero, one, or several process attempts over time.

### Process Plan

```ts
type RunProcessPlan = {
  schema: 'run.process-plan@v0';
  selection_source:
    | 'explicit_operator_request'
    | 'router'
    | 'goal_contract'
    | 'completion_followup'
    | 'recovery';
  rationale: string;
  planned_attempts: Array<{
    attempt_id: string;
    process_id: ProcessId;
    goal: string;
    expected_evidence: string[];
    depends_on_attempt_ids: string[];
  }>;
};
```

Rules:

- The plan selects process packages. It does not execute steps.
- A one-attempt plan can be produced by today's router.
- A follow-up plan can be produced after the completion gate finds missing
  evidence.
- A process sequence is an array of runtime calls, not a new graph interpreter.

### Process Attempt

```ts
type RunProcessAttempt = {
  schema: 'run.process-attempt@v0';
  attempt_id: string;
  process_id: ProcessId;
  goal: string;
  started_at: string;
  completed_at?: string;
  outcome: 'complete' | 'needs_attention' | 'blocked' | 'failed' | 'handoff' | 'checkpoint_waiting';
  child_run: {
    run_id: string;
    run_folder: string;
    result_path?: string;
    trace_entries_observed: number;
    manifest_hash?: string;
  };
  checkpoint?: {
    step_id: string;
    request_path: string;
    allowed_choices: string[];
  };
  evidence_refs: string[];
  summary: string;
};
```

Rules:

- `child_run` points at a normal current runtime run.
- `result_path` is present only after the child runtime closes.
- `checkpoint` is present when the child runtime returns waiting state.
- The supervisor may read the child result and named reports, but it must not
  reinterpret child trace internals as proof.
- `evidence_refs` must come from the child `RunResult`, operator summary,
  declared process report paths, or a future process evidence projection. They
  must not come from ad hoc path scraping.

### Completion Gate

```ts
type RunCompletionGate = {
  schema: 'run.completion-gate@v0';
  verdict: 'complete' | 'needs_followup' | 'blocked';
  claim_results: Array<{
    claim_id: string;
    status: 'proved' | 'missing' | 'contradicted' | 'blocked';
    evidence: string[];
    gap?: string;
  }>;
  gate_passes: Array<{
    pass_id: string;
    attack_lens:
      | 'contract-and-proof'
      | 'false-done-and-recovery'
      | 'scope-and-host-boundary';
    evidence_checked: string[];
    verdict: 'gate-pass' | 'blocked';
  }>;
  clean_streak: number;
  required_passes: 2;
  next_action:
    | 'close'
    | 'plan-followup-process'
    | 'ask-operator'
    | 'handoff'
    | 'blocked';
};
```

Rules:

- `complete` requires every required claim to be proved and two clean gate
  passes.
- Any medium-or-above blocking finding resets the clean streak.
- `needs_followup` chooses a new process plan. It does not close complete.
- `blocked` requires a reason and a useful next action.

Confirmed source fit:

- `GoalEvidenceEvaluation`, `GoalGate`, and `GoalResult` already enforce the
  important false-complete protections.
- Current tests cover missing evidence, two gate passes, medium finding reset,
  and false complete rejection.

### Decision Packet

```ts
type RunDecisionPacket = {
  schema: 'run.decision-packet@v0';
  decision_id: string;
  reason:
    | 'clarity-needed'
    | 'checkpoint-waiting'
    | 'risky-recovery'
    | 'visual-review'
    | 'blocked-choice';
  question: string;
  options: Array<{
    id: string;
    label: string;
    consequence: string;
  }>;
  evidence_refs: string[];
  projection?: {
    kind: 'html' | 'native-question' | 'markdown';
    path?: string;
  };
  resume_target: {
    kind: 'supervisor' | 'process-checkpoint';
    run_folder?: string;
    checkpoint_step_id?: string;
  };
};
```

Rules:

- Decision packets are rare. They exist only when human judgment materially
  changes the outcome.
- If a child runtime checkpoint is waiting, the packet references the current
  checkpoint request and resume target.
- If the decision is supervisor-level clarity or recovery, the packet belongs
  to the supervisor envelope and does not fake a runtime checkpoint trace.

### Memory Update Event

```ts
type RunMemoryUpdateEvent = {
  schema: 'run.memory-update-event@v0';
  event_id: string;
  scope: 'project' | 'flow';
  flow_id?: ProcessId;
  action: 'proposed' | 'recorded' | 'skipped';
  reason: string;
  source_refs: string[];
  summary: string;
  effect: 'execution_hint_only';
  operator_indicator: string;
};
```

Rules:

- The event explains what changed or why nothing changed.
- It is sourced from current run artifacts.
- It never grants proof, route, checkpoint, recovery, policy, or write
  authority.
- Human-facing output shows only `operator_indicator` unless a richer debug
  view is requested.

### Surface Output

```ts
type RunSurfaceOutput = {
  schema: 'run.surface-output@v0';
  status_text: string;
  selected_processes: Array<{ process_id: ProcessId; reason: string }>;
  outcome: 'complete' | 'needs_attention' | 'blocked' | 'failed' | 'handoff';
  operator_action?: string;
  memory_indicator?: string;
  artifact_links: string[];
};
```

Rules:

- The surface is short by default.
- Rich evidence stays in artifacts.
- Links may be present, but proof bundles are not the default human narrative.

## Lifecycle

1. Receive `RunSupervisorInput`.
2. Prepare or accept hint-only memory recall.
3. Decide whether clarification is needed.
4. Write `RunGoalContract`.
5. Write `RunProcessPlan`.
6. For each planned process attempt, call the existing compiled-flow runtime.
7. Record a `RunProcessAttempt` from the child `RunResult` or waiting
   checkpoint output.
8. Evaluate the contract against process attempt evidence.
9. If evidence is missing, write a follow-up process plan or a decision packet.
10. If evidence is satisfied, run the completion gate.
11. Close complete only after the required clean gate streak.
12. Write memory update events.
13. Write short surface output.

## Fixture-Style Proof Cases

These are the first tests the contract should be able to express. They can be
pure fixture tests over supervisor records before any production source changes.

| Case | Input | Process Attempts | Expected Gate | Expected Surface | Current Contract Fit |
| --- | --- | --- | --- | --- | --- |
| One-process complete | Clear implementation request; no direct process override. | One `build` or `fix` attempt with `RunResult.outcome = "complete"` and evidence refs satisfying every done claim. | Two clean passes, `next_action = "close"`, outcome `complete`. | One-sentence done status plus optional memory indicator. | Mirrors current Goal happy path without static child step. |
| Missing evidence follow-up | Child process closes complete but lacks required command/report evidence. | First attempt complete; second planned attempt is `review`, `fix`, or same process retry depending on missing evidence. | `needs_followup`, `next_action = "plan-followup-process"`. | "Still working; missing X evidence, running Y next." | Matches current Goal missing-evidence behavior, but allows another process instead of stopping at checkpoint by default. |
| Checkpoint needed | Runtime child process returns `checkpoint_waiting`. | Attempt has `checkpoint` with request path and allowed choices, no `result_path`. | Gate not run yet. | Short action-required status. | Reuses current checkpoint waiting output and host rendering contract. |
| Blocked | Attempts fail, recovery routes exhausted, or operator decision chooses blocked. | One or more attempts with blocked/failed outcomes and cited reasons. | `blocked`, with reason and next input needed. | Succinct blocked status and needed input. | Matches Goal's "do not close complete without proof" rule. |

## Fit Against Current Contracts

| Current Contract | Fit | Gap |
| --- | --- | --- |
| Runtime run contract | Fits. Child attempts remain normal runtime runs with current trace and result semantics. | Supervisor envelope is a new artifact type and should not be parsed as a runtime run until explicitly supported. |
| Goal schemas | Fits as source semantics. Goal contract, evidence evaluation, gate, recovery, and result rules map cleanly. | `selected_flow_target` and static child result aliases should not carry forward as Run primitives. |
| Runtime sub-run executor | Fits as an authority model: parent admits child only through `RunResult`. | Supervisor should avoid pretending to be a runtime parent unless it actually writes runtime trace entries. |
| History recall | Fits. Current recall can populate `memory_inputs` and a recall report before planning. | Memory update events are not current behavior. |
| Memory input schema | Fits. The target keeps memory hint-only. | Need a separate update-event schema because `MemoryInputV0` is an input shape, not an update log. |
| Checkpoint runtime | Fits. Waiting process attempts can carry current checkpoint request paths and allowed choices. | Supervisor-level decisions need their own decision packet instead of fake checkpoint trace entries. |
| Host rendering | Fits. Final output can be a short supervisor surface with artifact links. | Host tests will eventually need to distinguish supervisor output from child process summaries. |
| Generated surfaces | Fits. Run can stay the source-owned direct command while process packages remain generated flow surfaces. | A future visibility split needs generator and drift-check changes, but this contract sketch does not require them. |
| Process evidence | Partly fits. Current child runs produce `RunResult`, operator summaries, and flow reports that can be referenced. | The first implementation slice may need a small per-process evidence projection so the supervisor does not learn flow-specific report paths by convention. |

## What This Proves

The Run supervisor target is representable if these constraints hold:

1. The supervisor record is a product-level artifact, not a runtime trace.
2. Process attempts are ordinary current runtime runs referenced by result and
   report paths.
3. Completion logic is generalized from Goal, but does not preserve Goal's
   static one-child-flow graph.
4. Memory remains hint-only and cited.
5. Decision packets do not bypass checkpoint resume safety.
6. Human output is projected from artifacts, not treated as the source of truth.

## What It Does Not Prove

This sketch does not prove:

- the best file layout for supervisor artifacts;
- the final schema names;
- how `runs list/show` should display supervisor envelopes;
- how direct flow commands should be hidden or reclassified;
- whether memory updates should be automatic or proposed first;
- whether current process reports are sufficient or need a small evidence
  projection per process;
- whether a future host should render supervisor decision packets as HTML,
  native questions, or both.

Those are migration and implementation questions.

## Fast Disproofs

| Disproof | Meaning |
| --- | --- |
| A fixture cannot represent two process attempts without changing child runtime trace semantics. | The supervisor envelope is too weak or the run artifact model needs a deeper runtime change. |
| Completion cannot be decided from child `RunResult` plus report refs without reading arbitrary child trace internals. | The process result contract is not strong enough for Run-level proof. |
| Memory update events need to grant routing or proof authority to be useful. | The memory posture conflicts with the safety model. |
| Supervisor-level decisions must be encoded as runtime checkpoints to resume correctly. | Decision packets need a deeper runtime relationship than this sketch assumes. |
| Host output cannot stay short without losing required operator action. | The surface projector needs a richer but still bounded contract. |

## Recommended Next Step

Do not implement runtime changes yet. The next useful implementation-adjacent
artifact is a tiny fixture spec or test plan for `RunSupervisorRecord`:

- one fixture for each proof case above;
- validator rules for false complete, missing evidence, and memory authority;
- a mapping from fixture fields to current source contracts;
- no generated output changes.

If those fixtures are easy to express, the initiative can move to an
audit-and-migrate ledger for the first source-owned supervisor slice. If they
are awkward, the awkwardness will identify the exact contract that needs
stronger current runtime support.
