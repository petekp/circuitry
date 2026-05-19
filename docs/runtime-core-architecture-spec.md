# Runtime Core Architecture Spec

Status: Proposed, revised after adversarial architecture review
Audience: Circuit maintainers and coding agents
Decision bar: establish a high-level architecture, seam map, and type vocabulary before implementation

Normative proof packet: [runtime-core-proof-packet.md](runtime-core-proof-packet.md).
Reviewers should use that packet as the closed checklist for authority,
side-effect, transaction, schema/type, migration, and review gates. Where this
prose spec is less precise, the proof packet is the stricter contract.

Implementation decision companion:
[runtime-core-implementation-decisions.md](runtime-core-implementation-decisions.md).
Use it for the port, idempotence, and materialization failure choices that guide
the first runtime-core migration slices.

## 1. Purpose

Circuit's runtime should become a single durable workflow boundary rather than a
collection of command-specific mini-runtimes.

Today the runtime behavior is spread across command modules:

- `bootstrap.ts`
- `checkpoint-step.ts`
- `complete-synthesis.ts`
- `dispatch-step.ts`
- `abort-run.ts`
- `resume.ts`
- `render-active-run.ts`
- shared helpers in `command-support.ts`
- event projection in `derive-state.ts`
- CLI branching in `cli/circuit-engine.ts`

Those modules work, but they make the architecture harder than necessary for
agents to learn. A reader has to reconstruct the workflow lifecycle by jumping
between command handlers, event helpers, schemas, dashboard rendering, and
continuity sync.

The goal of this spec is to define the next architecture at a high level:

- one runtime boundary
- one command vocabulary
- one event-ledger authority model
- explicit seams for local effects
- typed receipts that make CLI output, tests, and prompt contracts converge

## 2. Durable Runtime Principles

1. Orchestration is replayable.
2. Effects happen through adapters and are recorded or observed as local facts.
3. `events.ndjson` is canonical; `state.json` and `active-run.md` are projections.
4. Runtime commands return a single typed receipt.
5. Stable logical ids survive retries; attempts are secondary.
6. Human input, worker output, artifacts, receipts, and result files are observed facts.
7. Transitions are decisions; only the runtime core commits them.
8. Observation commits and transition commits are different things.
9. Pure inspection never writes files. Projection materialization is an explicit
   side effect.
10. Inspection is a first-class surface for humans and agents.

## 3. Proposed Shape

Create a new runtime module with an explicit kernel/shell split:

```text
scripts/runtime/engine/src/runtime-core/
  index.ts
  types.ts
  project-ledger.ts
  inspect-runtime.ts
  observe-facts.ts
  plan-command.ts
  commit-ledger.ts
  materialize-view.ts
  node-runtime-deps.ts
```

The public runtime surface is the effectful shell. It is intentionally small:

```ts
export interface CircuitRuntime {
  execute(command: RuntimeCommand): RuntimeReceipt;
  inspect(ref: RunRef): RuntimeView;
  materialize(ref: RunRef, reason: MaterializeReason): RuntimeMaterializationReceipt;
}

export function createCircuitRuntime(
  deps?: Partial<RuntimeDeps>,
): CircuitRuntime;
```

The runtime kernel is narrower than the public shell:

- `projectLedger` is pure projection.
- `inspectRuntimeView` reads only the manifest snapshot and event ledger, then
  returns an in-memory view.
- `observeRuntimeFacts` reads local runtime exchange files and artifacts, but
  writes nothing.
- `planRuntimeCommand` is pure planning over projection plus facts.
- `commitLedgerPlan` appends only runtime events.
- `materializeRuntimeView` writes derived projections and continuity attachment
  metadata, but is outside the ledger kernel.

The shell may call all of those pieces. The kernel may not call the shell.

The internal flow is explicit:

```ts
projectLedger(manifest, events) -> RuntimeProjection
observeRuntimeFacts(command, projection) -> RuntimeFacts
planRuntimeCommand(command, projection, facts) -> RuntimePlan
commitLedgerPlan(plan) -> LedgerCommitReceipt
materializeRuntimeView(projection) -> RuntimeMaterializationReceipt
```

`execute` is the only public runtime method that may append to
`events.ndjson`. It owns the shell-level transaction:

1. Load manifest snapshot and event ledger.
2. Project canonical state from the ledger.
3. Observe required local files.
4. Validate command preconditions.
5. Plan observation events and transition events as separate commit groups.
6. Validate every event draft before appending any batch.
7. Append one observation batch when durable local facts should be recorded.
8. Re-project from the ledger if an observation batch was appended.
9. Append one decision batch only when route, gate, and terminal decisions are
   valid against the post-observation projection.
10. Re-project state from the ledger after the final append.
11. Materialize `state.json`.
12. Render `active-run.md`.
13. Sync or clear the current-run continuity attachment for attached runs.
14. Return one typed receipt.

`commitLedgerPlan` must not write projection files, render dashboards, update
continuity, record invocation-ledger entries, print CLI output, or execute
workers. Those are shell responsibilities. This split is a hard architectural
boundary, not an implementation detail.

`execute` may report a materialization failure after events were appended. In
that case the ledger outcome remains authoritative, the receipt includes the
appended events and `materialization.ok=false`, and callers can retry
`materialize` without duplicating events.

`inspect` is read-only. It reads the manifest snapshot and ledger, projects the
runtime state, computes resume and dashboard facts in memory, and writes
nothing.

`materialize` is projection-only. It may write `state.json`, write
`artifacts/active-run.md`, and sync or clear the current-run continuity
attachment, but it must never append runtime events. Public `render`,
session-start active-run refresh, and current-run fallback continuity refresh
must use this method rather than smuggling writes through `inspect`.

The CLI adapter and invocation ledger are outside the kernel. They may consume
typed receipts, but they must not shape command planning.

## 4. Authority Model

| Domain | Authority |
|---|---|
| Workflow topology | `circuit.manifest.yaml` snapshot in the run root |
| Runtime state | `events.ndjson` replayed through `projectLedger` |
| Human-readable dashboard | `artifacts/active-run.md`, rendered from state |
| Machine-readable state snapshot | `state.json`, written from state projection |
| Continuity attachment | `.circuit/control-plane/continuity-index.json` |
| Current-run marker | `.circuit/current-run`, projection of the continuity index |
| Worker exchange | Runtime-owned local request/result protocol; transport metadata is non-authoritative |
| Worker execution | Outside runtime core; observed through local exchange files |

The runtime core must never treat `state.json` as canonical input. Reading
`state.json` may remain useful in tests or debugging tools, but command
execution must derive state from the event ledger.

The runtime core also must not treat `active-run.md` as command input. Dashboard
markdown may provide human context, but command decisions come from
`projectLedger` plus observed local facts.

The continuity control plane has its own authority model. Runtime commands may
sync or clear only `current_run` attachment metadata. They must not create,
consume, or reinterpret pending continuity records; that remains the
`continuity` command's responsibility.

## 5. Architecture Layers

### 5.1 Pure Projection

The pure projection layer has no filesystem, clock, uuid, git, dashboard,
schema, or continuity dependencies.

```ts
export function projectLedger(input: {
  manifest: CircuitManifest;
  events: readonly RuntimeEvent[];
}): RuntimeProjection;
```

It owns:

- event replay
- run status
- current step
- artifacts
- jobs
- checkpoints
- routes
- terminal target
- resume reasoning inputs

`projectLedger` must ignore projection files. It must not read `state.json`,
`active-run.md`, `.circuit/current-run`, continuity records, worker-private
batch state, or adapter logs.

### 5.2 Local Fact Observation

Local fact observation reads command-specific files from the run root and returns
typed facts. It has filesystem reads but no writes, no event ids, no timestamps,
no route choices, no continuity access, and no CLI presentation.

```ts
export function observeRuntimeFacts(input: {
  command: RuntimeCommand;
  projection: RuntimeProjection;
  deps: RuntimeDeps;
}): RuntimeFacts;
```

It owns:

- checking whether declared artifact, checkpoint, worker request, worker
  receipt, and worker result files exist
- parsing observed text or JSON files through typed readers
- returning missing/malformed file facts without deciding workflow advancement

It must not:

- append events
- read `state.json` or `active-run.md`
- read pending continuity records
- execute worker transport
- inspect worker-private batch state
- choose routes, retries, terminal targets, or failure classifications

### 5.3 Command Planning

The planner receives projected state plus observed local facts and returns a
plan. It must not mutate files.

```ts
export function planRuntimeCommand(input: {
  command: RuntimeCommand;
  projection: RuntimeProjection;
  facts: RuntimeFacts;
  expectedRevision: RuntimeRevision;
  plannedAt: IsoTimestamp;
}): RuntimePlan;
```

It owns:

- command preconditions
- no-op detection
- route validation
- gate decisions
- terminal route expansion
- dispatch attempt calculation
- failure classification
- observation event batch planning
- transition event batch planning

The planner must classify every planned event as either an observation or a
decision.

Observation events record durable facts that already exist outside the ledger or
runtime-accepted local exchange facts. Observation events may update projected
runtime status, jobs, checkpoints, or artifacts, but they must not select a
workflow route, choose a next step, or terminate a run.

Decision events are runtime choices. A decision event selects a route, starts a
new step, terminates or aborts a run, or records a routed gate failure. Decision
events may only be produced by the planner after manifest topology and command
preconditions have been validated.

A `gate_failed` event is a decision event, not a generic error log. The runtime
may append it only when the manifest defines a concrete failure or reroute
target that the planner has selected. A failed validation with no selected
route returns a failure receipt and commits only independently valid
observations.

Normative event classification:

| Event type | Commit class | Why |
|---|---|---|
| `run_started` | decision | Creates runtime identity from a validated bootstrap command. |
| `step_started` | decision | Selects the active workflow step. |
| `artifact_written` | observation | Records that a declared artifact already exists at a run-relative path. |
| `checkpoint_requested` | observation | Records that the prompt-authored checkpoint request file exists and is now accepted as waiting state. |
| `checkpoint_resolved` | observation | Records an accepted human response or explicit selection. |
| `dispatch_requested` | observation | Records that a prompt-authored worker request file exists and is now accepted as waiting-worker state. |
| `dispatch_received` | observation | Records the presence of a local worker receipt. |
| `job_completed` | observation | Records the presence and parsed outcome of a local worker result. |
| `gate_passed` | decision | Selects a manifest route after a gate succeeds. |
| `gate_failed` | decision | Selects a manifest failure or reroute target after a gate fails. |
| `run_completed` | decision | Selects a terminal target. |
| `run_aborted` | decision | Terminates a non-terminal run by explicit command. |

Observation first, decision second is a required ordering rule. If a command
needs a decision that depends on newly committed observations, the shell must
append the observation batch, re-project the ledger, re-check the decision
against that projection, then append the decision batch. A decision batch must
never be planned from stale pre-observation state.

### 5.4 Commit Boundary

The ledger commit layer is the only place that appends runtime events. It is
not the projection materialization layer.

```ts
export function commitLedgerPlan(input: {
  ref: RuntimeRunRef;
  runId: RunId;
  circuitId?: CircuitId;
  batch: ObservationCommitBatch | DecisionCommitBatch;
  deps: CommitLedgerDeps;
}): LedgerCommitReceipt;
```

It owns:

- event id and timestamp assignment
- event schema validation
- atomic append semantics for each committed batch

It must not own:

- state projection materialization
- active-run rendering
- continuity sync or clear
- invocation ledger side effects
- CLI printing
- worker execution

`commitLedgerPlan` must not loop over events with one filesystem append per
event. A committed batch is written in one append operation after all events in
that batch have received ids, timestamps, and schema validation.

`expectedRevision` is the count or hash of the event ledger that was projected
when the plan was produced. The first migration may implement this as an
in-process check rather than cross-process locking, but the contract must exist:
if the ledger changed since planning, append nothing, re-project, and re-plan.

Observation and transition batches are independent for failure handling:

- If preconditions, manifest validation, route validation, or runtime integrity
  checks fail, append nothing.
- If a local fact is missing, append nothing unless an earlier independently
  valid observation was already planned for that command.
- If durable facts are present but do not justify advancement, append the
  observation batch and return a non-advancing receipt.
- If durable facts justify advancement, append observations, re-project, then
  append decisions only if they are still valid.
- If projection materialization fails after events are appended, the ledger
  remains canonical. The shell receipt must mark projection materialization as
  failed so callers can retry `materialize`.

### 5.5 Projection Materialization

Projection materialization writes derived views. It is effectful but not
canonical.

```ts
export function materializeRuntimeView(input: {
  projection: RuntimeProjection;
  reason: MaterializeReason;
  deps: RuntimeDeps;
}): RuntimeMaterializationReceipt;
```

It owns:

- writing `state.json` from `RuntimeProjection.state`
- rendering `artifacts/active-run.md`
- syncing or clearing `current_run` attachment metadata
- returning active-run and resume facts for human and prompt surfaces

It must not:

- append runtime events
- read `state.json` as input
- read `active-run.md` as input when a manifest snapshot and ledger are valid
- create or consume pending continuity records

### 5.6 CLI Adapter

`cli/circuit-engine.ts` should become argument parsing plus receipt printing.
It should not directly import command-specific execution modules once migration
is complete.

```ts
const receipt = runtime.execute(commandFromFlags(flags));
return printResult(presentRuntimeReceipt(receipt), json);
```

CLI presentation is not planning. Command-specific presenters convert typed
receipts into the existing `key=value` or JSON payloads. The planner must not
own arbitrary CLI maps.

## 6. Core Types

### 6.1 Branded Runtime Vocabulary

The runtime core must not pass plain strings around for domain identifiers that
carry invariants. At minimum, the core vocabulary needs branded aliases:

```ts
export type AbsolutePath = string & { readonly __brand: "AbsolutePath" };
export type RunRelativePath = string & { readonly __brand: "RunRelativePath" };
export type StepId = string & { readonly __brand: "StepId" };
export type RunSlug = string & { readonly __brand: "RunSlug" };
export type WorkflowId = string & { readonly __brand: "WorkflowId" };
export type EventId = string & { readonly __brand: "EventId" };
export type LedgerRevision = string & { readonly __brand: "LedgerRevision" };
export type Attempt = number & { readonly __brand: "Attempt" };
export type RuntimeStatus =
  | "initialized"
  | "in_progress"
  | "waiting_checkpoint"
  | "waiting_worker"
  | "aborted"
  | "completed"
  | "stopped"
  | "blocked"
  | "failed"
  | "handed_off";
export type RouteTarget =
  | StepId
  | "@complete"
  | "@stop"
  | "@escalate"
  | "@handoff";
```

Path, id, route, and attempt constructors live at the runtime boundary and are
the only sanctioned way to create branded values:

```ts
makeAbsolutePath(value: string): AbsolutePath;
makeRunRelativePath(value: string): RunRelativePath;
makeStepId(value: string): StepId;
makeRunSlug(value: string): RunSlug;
makeWorkflowId(value: string): WorkflowId;
makeAttempt(value: number): Attempt;
makeRouteTarget(value: string, manifest: CircuitManifest): RouteTarget;
```

After parsing, internals must not re-validate the same string shape in every
helper. A helper that accepts a plain string for `step`, `route`, `runRoot`, or
run-relative paths is outside the runtime core.

### 6.2 Runtime Command

```ts
export type RuntimeCommand =
  | ({ name: "bootstrap" } & BootstrapCommand)
  | ({ name: "request-checkpoint" } & StepCommand)
  | ({ name: "resolve-checkpoint" } & ResolveCheckpointCommand)
  | ({ name: "complete-synthesis" } & CompleteSynthesisCommand)
  | ({ name: "dispatch-step" } & StepCommand)
  | ({ name: "reconcile-dispatch" } & ReconcileDispatchCommand)
  | ({ name: "abort-run" } & AbortRunCommand);

export type RuntimeViewCommand =
  | ({ name: "resume" } & RunRef)
  | ({ name: "render" } & RunRef);

export interface RunRef {
  runRoot: AbsolutePath;
  projectRoot?: AbsolutePath;
  attachment?: "attached" | "detached";
}

export interface StepCommand extends RunRef {
  step: StepId;
}

export interface BootstrapCommand extends RunRef {
  commandArgs?: string;
  entryMode: string;
  goal?: string;
  headAtStart?: string;
  invocationId?: string;
  manifestPath: string;
  routedCommand?: string;
  routedTargetKind?: "built_in" | "custom_global";
}

export interface CompleteSynthesisCommand extends StepCommand {
  route?: RouteTarget;
}

export interface ResolveCheckpointCommand extends StepCommand {
  route?: RouteTarget;
  selection?: string;
}

export interface ReconcileDispatchCommand extends StepCommand {
  completion?: "complete" | "partial" | "blocked";
  route?: RouteTarget;
  verdict?: string;
}

export interface AbortRunCommand extends RunRef {
  reason: string;
}
```

The `step` field stays for CLI compatibility and clearer failure messages. The
runtime still verifies it against the projected current step.

`RuntimeViewCommand` is intentionally separate. `resume` should call `inspect`;
`render` should call `materialize`. Neither command may append runtime events.

### 6.3 Runtime Projection

```ts
export interface RuntimeProjection {
  manifest: CircuitManifest;
  events: readonly RuntimeEvent[];
  state: RuntimeState;
  currentStep: CircuitManifestStep | null;
  resume: RuntimeResumePoint;
}

export interface RuntimeResumePoint {
  resumeStep: string | null;
  status: RuntimeStatus;
  reason: string;
}
```

The projection is the canonical in-memory view of a run. It replaces the
current split where `derive-state.ts`, `resume.ts`, and `render-active-run.ts`
each reinterpret related fields.

### 6.4 Runtime Events

Runtime events should be a discriminated union, not generic records. The JSON
Schema may remain the external validator, but TypeScript code must get
exhaustiveness checks over the event vocabulary.

```ts
export type RuntimeEvent =
  | RunStartedEvent
  | StepStartedEvent
  | ArtifactWrittenEvent
  | CheckpointRequestedEvent
  | CheckpointResolvedEvent
  | DispatchRequestedEvent
  | DispatchReceivedEvent
  | JobCompletedEvent
  | GatePassedEvent
  | GateFailedEvent
  | RunCompletedEvent
  | RunAbortedEvent;

export type ObservationEventDraft =
  | ArtifactWrittenDraft
  | CheckpointRequestedDraft
  | CheckpointResolvedDraft
  | DispatchRequestedDraft
  | DispatchReceivedDraft
  | JobCompletedDraft;

export type DecisionEventDraft =
  | RunStartedDraft
  | StepStartedDraft
  | GatePassedDraft
  | GateFailedDraft
  | RunCompletedDraft
  | RunAbortedDraft;

export type RuntimeEventDraft =
  | { commitClass: "observation"; event: ObservationEventDraft }
  | { commitClass: "decision"; event: DecisionEventDraft };
```

`projectLedger` must switch exhaustively on `event.event_type`. Unknown live
events are `runtime_corrupt` unless they are explicitly listed as legacy ignored
events in one compatibility table.

The event schema and TypeScript union must agree. A new event type is not added
until both the JSON Schema and discriminated TypeScript union are updated, and
projection has an exhaustive case for it.

Projection upserts must be stable under replay. A repeated request observation
for the same step and attempt may refresh the request path, but it must not
erase richer receipt, result, response, or selection fields that were already
accepted for that same step and attempt. A new attempt creates a separate job
or checkpoint row.

### 6.5 Runtime Facts

Facts are local observations. They are not decisions.

```ts
export type RuntimeFacts =
  | { kind: "none" }
  | {
      kind: "synthesis-output";
      artifactPaths: readonly RunRelativePath[];
      gateSource: ObservedTextFile | null;
      alternateGateSource?: ObservedTextFile | null;
    }
  | {
      kind: "checkpoint-request";
      requestPath: RunRelativePath;
      requestExists: boolean;
    }
  | {
      kind: "checkpoint-response";
      responsePath: RunRelativePath;
      selection: string | null;
    }
  | {
      kind: "dispatch-request";
      requestPath: RunRelativePath;
      requestExists: boolean;
      receipt?: WorkerReceiptFact | null;
    }
  | {
      kind: "dispatch-result";
      resultPath: RunRelativePath;
      result: WorkerResultFact | null;
      receipt?: WorkerReceiptFact | null;
      artifactPath?: RunRelativePath | null;
      artifactExists?: boolean;
    };

export interface WorkerReceiptFact {
  receiptPath: RunRelativePath;
  exchangeId: string;
  attempt: Attempt;
  observedAt?: string;
}

export interface WorkerResultFact {
  resultPath: RunRelativePath;
  completion: "complete" | "partial" | "blocked";
  verdict?: WorkerVerdict;
}
```

The distinction between facts and decisions is essential. For example,
observing that an artifact exists may justify an `artifact_written` event, while
advancing to the next step requires a gate decision.

Transport-specific receipt fields such as `adapter`, `transport`,
`resolved_from`, `runtime_boundary`, command argv, diagnostics, and fallback
details are not runtime facts. They may remain in the local receipt JSON and in
adapter diagnostics, but they must not be copied into new canonical runtime
events or exposed to the planner. Legacy events that already contain them are
handled only through the compatibility table in Section 7.8.

### 6.6 Runtime Plan

```ts
export type RuntimePlan =
  | BootstrapPlan
  | CompleteSynthesisPlan
  | CheckpointRequestPlan
  | CheckpointResolvePlan
  | DispatchRequestPlan
  | DispatchReconcilePlan
  | AbortPlan;

export type CommandPlanBase =
  | RuntimeRejectedPlan
  | RuntimeNoOpPlan
  | RuntimeObservationOnlyPlan
  | RuntimeTransitionPlan;

export interface RuntimeRejectedPlan {
  kind: "rejected";
  failure: RuntimeFailure;
  commit: "none";
  projectionWrites: ProjectionWritePolicy;
  continuityPolicy: ContinuitySyncPolicy;
  announcements: readonly RuntimeAnnouncement[];
}

export interface RuntimeNoOpPlan {
  kind: "no-op";
  reason: string;
  commit: "none";
  projectionWrites: ProjectionWritePolicy;
  continuityPolicy: ContinuitySyncPolicy;
  announcements: readonly RuntimeAnnouncement[];
}

export interface RuntimeObservationOnlyPlan {
  kind: "observation-only";
  reason: RuntimeFailure | RuntimeNonAdvancingOutcome;
  observationEvents: readonly RuntimeEventDraft[];
  commit: "observation";
  projectionWrites: ProjectionWritePolicy;
  continuityPolicy: ContinuitySyncPolicy;
  announcements: readonly RuntimeAnnouncement[];
}

export interface RuntimeTransitionPlan {
  kind: "transition";
  observationEvents: readonly RuntimeEventDraft[];
  decisionEvents: readonly RuntimeEventDraft[];
  transition: RuntimeTransition;
  commit: "observation-and-decision";
  projectionWrites: ProjectionWritePolicy;
  continuityPolicy: ContinuitySyncPolicy;
  announcements: readonly RuntimeAnnouncement[];
}

export type RuntimeTransition =
  | BootstrapTransition
  | CheckpointRequestedTransition
  | CheckpointResolvedTransition
  | SynthesisCompletedTransition
  | DispatchRequestedTransition
  | DispatchReconciledTransition
  | AbortTransition;

export interface TransitionBase {
  command: RuntimeCommand["name"];
  step?: StepId;
}

export interface DispatchReconciledTransition extends TransitionBase {
  command: "reconcile-dispatch";
  attempt?: number;
  gate: RuntimeGateOutcome;
}

export type RuntimeGateOutcome =
  | { kind: "passed"; route: RouteTarget }
  | { kind: "failed"; failure: RuntimeFailure; route?: RouteTarget }
  | { kind: "reroute"; verdict: WorkerVerdict; route: RouteTarget }
  | { kind: "terminal"; target: "@complete" | "@stop" | "@escalate" | "@handoff" };
```

`RuntimePlan` is deliberately not a bag of optional fields. Each command gets a
specific plan shape so invalid combinations are unrepresentable:

| Command plan | Allowed observation drafts | Allowed decision drafts |
|---|---|---|
| `BootstrapPlan` | none | `run_started`, initial `step_started` |
| `CompleteSynthesisPlan` | `artifact_written` | `gate_passed`, routed `gate_failed`, next `step_started`, `run_completed` |
| `CheckpointRequestPlan` | `artifact_written`, `checkpoint_requested` | none |
| `CheckpointResolvePlan` | `checkpoint_resolved` | `gate_passed`, routed `gate_failed`, next `step_started`, `run_completed` |
| `DispatchRequestPlan` | `artifact_written`, `dispatch_requested`, `dispatch_received` | none |
| `DispatchReconcilePlan` | `dispatch_received`, `job_completed`, `artifact_written` | `gate_passed`, routed `gate_failed`, next `step_started`, `run_completed` |
| `AbortPlan` | none | `run_aborted` |

`ProjectionWritePolicy`, `ContinuitySyncPolicy`, `RuntimeAnnouncement`,
`RuntimeNonAdvancingOutcome`, `ProjectionMaterializationStatus`, and
`MaterializeReason` must be concrete discriminated unions in the type skeleton.
They are not placeholders for `Record<string, unknown>` escape hatches.

### 6.7 Runtime Receipt

```ts
export type RuntimeReceipt =
  | RuntimeSuccessReceipt
  | RuntimeNonAdvancingReceipt
  | RuntimeFailureReceipt;

export interface RuntimeReceiptBase {
  command: RuntimeCommand["name"];
  runRoot: AbsolutePath;
  runSlug: RunSlug;
  workflowId: WorkflowId;
  status: RuntimeStatus;
  currentStep: StepId | null;
  noOp: boolean;
  appendedEvents: readonly RuntimeEvent[];
  projection: RuntimeProjection;
  activeRun?: ActiveRunView;
  resume: RuntimeResumePoint;
  announcements: readonly RuntimeAnnouncement[];
  materialization: ProjectionMaterializationStatus;
}

export interface RuntimeSuccessReceipt extends RuntimeReceiptBase {
  ok: true;
  outcome: RuntimeTransition;
}

export interface RuntimeNonAdvancingReceipt extends RuntimeReceiptBase {
  ok: true;
  outcome: RuntimeNonAdvancingOutcome;
}

export interface RuntimeFailureReceipt extends RuntimeReceiptBase {
  ok: false;
  failure: RuntimeFailure;
}

export interface ActiveRunView {
  path: AbsolutePath;
  markdown: string;
  currentPhase: string;
  nextStep: string;
  blockers: string;
}
```

The receipt is the bridge between the architecture and user-facing behavior.
Tests, generated prompt contracts, and future inspection commands should speak
this vocabulary. CLI output is derived from receipts by presenters, not embedded
inside plans.

`ok` describes the ledger command outcome, not projection materialization. If
events were validly appended and materialization failed, the receipt remains a
success or non-advancing receipt with `materialization.ok=false` and
`materialization.failure.kind="projection_materialization_failed"`. CLI
presenters may preserve historical non-zero exit behavior for projection write
failures, but they must not reinterpret the ledger as failed.

## 7. Seams And Ports

### 7.1 Runtime Store

Owns run-root filesystem access.

```ts
export interface RuntimeStore {
  readManifestSnapshot(runRoot: AbsolutePath): CircuitManifest;
  readManifestSource(path: AbsolutePath): { content: string; manifest: CircuitManifest };
  writeManifestSnapshot(runRoot: AbsolutePath, content: string): void;
  readEvents(runRoot: AbsolutePath): {
    events: readonly RuntimeEvent[];
    revision: LedgerRevision;
  };
  appendEvents(input: {
    runRoot: AbsolutePath;
    expectedRevision: LedgerRevision;
    events: readonly RuntimeEvent[];
  }): AppendReceipt;
  readText(runRoot: AbsolutePath, path: RunRelativePath): string;
  readJson(runRoot: AbsolutePath, path: RunRelativePath): unknown;
  exists(runRoot: AbsolutePath, path: RunRelativePath): boolean;
  writeState(runRoot: AbsolutePath, state: RuntimeState): void;
  writeActiveRun(runRoot: AbsolutePath, view: ActiveRunView): void;
}
```

`appendEvents` is batch-oriented. It either appends every event in the batch at
the expected ledger revision or throws before appending any event. It does not
need to provide cross-process locking in the first migration, but the port must
preserve expected-revision semantics so locking can be added behind the port
later.

The M1-M2 scaffold includes an in-memory ledger store for fast port and
boundary tests. It implements the same reader/appender contracts and
expected-revision behavior, but it is not a CLI storage adapter and does not
route any public command through runtime core.

### 7.2 Runtime Schemas

Owns validation, not policy.

```ts
export interface RuntimeSchemas {
  validateManifest(manifest: CircuitManifest): void;
  validateEvent(event: RuntimeEvent): void;
  validateState(state: RuntimeState): void;
}
```

### 7.3 Clock And Ids

Make event creation deterministic in tests.

```ts
export interface RuntimeClock {
  nowIso(): string;
}

export interface RuntimeIds {
  eventId(): string;
}
```

### 7.4 Worker Exchange Reader

The core owns the local worker exchange protocol, not worker transport.

```ts
export interface WorkerExchangeReader {
  readReceipt(input: {
    runRoot: AbsolutePath;
    receiptPath: RunRelativePath;
    step: StepId;
    attempt: Attempt;
  }): WorkerReceiptFact;

  readResult(input: {
    runRoot: AbsolutePath;
    resultPath: RunRelativePath;
  }): WorkerResultFact;
}
```

This port translates local JSON files into transport-neutral facts. Transport
adapters may write richer receipts, but only `WorkerReceiptFact` and
`WorkerResultFact` are visible to the planner.

`WorkerExchangeReader` validates the local exchange schema. A malformed receipt
or result is an invalid observed file. It must not normalize adapter process
failures into runtime gate outcomes.

### 7.5 Continuity

The runtime shell decides whether to sync or clear current-run attachment
metadata from the post-commit projection. The continuity port performs that
control-plane mutation. The planner may return a continuity policy, but it must
not read or mutate continuity state.

```ts
export interface ContinuityPort {
  syncCurrentRunAttachment(input: ContinuitySyncInput): void;
  clearCurrentRunAttachment(projectRoot: AbsolutePath): void;
}
```

This port must not expose pending-record creation, pending-record resolution, or
continuity narrative reads to runtime command planning.

### 7.6 Dashboard Renderer

The renderer converts projected state into a markdown dashboard. It does not
derive canonical state itself.

```ts
export interface ActiveRunRenderer {
  render(input: {
    runRoot: string;
    manifest: CircuitManifest;
    projection: RuntimeProjection;
  }): ActiveRunView;
}
```

The renderer may read non-authoritative artifacts for dashboard enrichment, such
as goal fallbacks and verification-command snippets. Those reads must be
clearly marked as view enrichment and cannot influence command planning.

### 7.7 CLI Presenter

CLI output lives outside planning and committing.

```ts
export interface RuntimePresenter {
  present(receipt: RuntimeReceipt | RuntimeMaterializationReceipt): CliPayload;
}
```

Presenters preserve public `circuit-engine` behavior while allowing the core
receipt vocabulary to stay strict.

### 7.8 Worker Transport

Worker transport is deliberately outside the runtime core.

`dispatch.ts`, `codex-runtime.ts`, custom wrappers, and Agent receipts remain
sibling adapter concerns. The runtime core observes only the local exchange
facts returned by `WorkerExchangeReader`:

- dispatch request JSON
- dispatch receipt JSON
- dispatch result JSON
- declared output artifacts

This keeps the runtime local-substitutable and prevents external execution
concerns from polluting the event-sourced core.

Canonical worker receipt observations must be transport-neutral. New runtime
core code must emit only receipt path, exchange id, step, attempt, and observed
time. Adapter name, transport, resolution source, runtime boundary, command argv,
diagnostics, and fallback details remain in local adapter receipts or diagnostic
files.

Compatibility table for legacy worker events:

| Legacy shape | Runtime handling |
|---|---|
| `dispatch_received.payload.adapter` | Ignore for projection and planning. |
| `dispatch_received.payload.transport` | Ignore for projection and planning. |
| `dispatch_received.payload.resolved_from` | Ignore for projection and planning. |
| `dispatch_received.payload.runtime_boundary` | Ignore for projection and planning. |
| `dispatch_received.payload.diagnostics_path` | Preserve only in diagnostic views, never in planning. |
| `dispatch_received.payload.warnings` | Preserve only in diagnostic views, never in planning. |

The canonical event union and JSON Schema must allow transport-neutral receipt
observations that do not require adapter metadata. If the event name remains
`dispatch_received` for compatibility, the schema must allow that neutral
payload while keeping legacy payloads readable.

## 8. Command Semantics

### 8.1 Bootstrap

Bootstrap creates the run root, snapshots the manifest, appends `run_started`
and initial `step_started`, then materializes projections.

It may record invocation ledger metadata, but that side effect is not runtime
authority.

Manifest snapshot writing is bootstrap setup, not ledger authority. If the
snapshot is written but event append fails, retrying bootstrap must either reuse
the byte-identical snapshot or fail before appending events.

### 8.2 Complete Synthesis

Complete synthesis observes declared artifact files, validates the configured
gate, records durable artifact observations, and advances by route only when
the gate passes.

Required behavior:

- missing artifact source: no event append, failure receipt
- artifact present with invalid sections: append `artifact_written` when needed,
  no route advancement, failure receipt
- artifact present with valid sections: append observation events and decision
  events, then advance
- unsupported gate kind: no route advancement; append only independently valid
  observations if they were already planned

This remains a high-leverage migration slice because it exercises observation
and decision commits without worker transport complexity. It should run after
the projection, materialization, abort, and bootstrap foundations are in place.

### 8.3 Checkpoint Request

Checkpoint request observes the prompt-authored checkpoint request file and
records that the run is waiting for user input.

Required behavior:

- missing request file: no event append, failure receipt
- already waiting for the same checkpoint: no-op receipt
- valid request file: append observation events only, including
  `checkpoint_requested`; the projection derives waiting-checkpoint state from
  that observation

### 8.4 Checkpoint Resolve

Checkpoint resolve observes the response file or explicit selection, validates
the selection against the manifest gate, appends a checkpoint resolution, and
routes forward.

Required behavior:

- missing or malformed response: no event append, failure receipt
- selection outside the allowed list: no event append, failure receipt
- valid selection: append `checkpoint_resolved`, re-project, then append route
  decision events

### 8.5 Dispatch Step

Dispatch step observes the dispatch request file and optional receipt. It does
not execute a worker.

Required behavior:

- missing request file: no event append, failure receipt
- existing requested/running job with newly appeared receipt: append only the
  receipt observation
- valid new request: append `dispatch_requested`; if a receipt already exists,
  append a receipt observation in the same observation batch. The projection
  derives waiting-worker state from those observations.

### 8.6 Reconcile Dispatch

Reconcile dispatch observes the result file and optional receipt, derives
completion and verdict, enforces artifact requirements, records worker
completion, and routes only when the result satisfies the manifest gate.

Required behavior:

- missing result file: no event append, failure receipt
- malformed or unsupported result shape: no event append, failure receipt
- `completion=partial` or `completion=blocked`: append job observation, no route
  advancement, non-advancing receipt
- `completion=complete` with non-passing verdict: append job observation, no
  route advancement, non-advancing receipt
- `completion=complete` with passing verdict: append job observation,
  artifact observation when applicable, and route decision events
- manifest `gate.reroute` entries must be honored before retry advice is
  generated. If verdict `coexistence_invalidated` maps to `plan`, the runtime
  records a routed gate decision rather than leaving agents to invent the
  branch.

Reroute event shape:

- A passing verdict emits `gate_passed(route=<routes.pass>)`.
- A non-passing verdict with a manifest `gate.reroute[verdict]` emits
  `gate_failed(failure_reason=<verdict>, route=<reroute target>)`, then the
  next `step_started` or terminal event for that target.
- A non-passing verdict without a reroute target emits no gate event and returns
  a non-advancing receipt after committing independently valid observations.

This keeps `gate_failed` a routed decision rather than an error log.

### 8.7 Resume And Render

Resume and render are not ledger state machines.

- `resume` calls `inspect` and writes nothing.
- `render` calls `materialize` and writes projection files only.
- session-start current-run refresh calls `materialize` and writes projection
  files only.
- continuity resume for an indexed current run may call `materialize`; pending
  continuity records remain outside runtime core.

### 8.8 Abort Run

Abort appends `run_aborted` based on canonical ledger projection, not the
current contents of `state.json`.

Required behavior:

- missing or corrupt ledger: no event append, failure receipt
- already terminal by ledger projection: no-op receipt
- non-terminal: append `run_aborted`, materialize projections, clear matching
  current-run attachment

## 9. Failure Model

```ts
export type RuntimeFailureKind =
  | "precondition_failed"
  | "missing_observed_file"
  | "invalid_observed_file"
  | "gate_failed"
  | "route_invalid"
  | "worker_non_passing"
  | "worker_partial"
  | "worker_blocked"
  | "runtime_corrupt"
  | "projection_materialization_failed"
  | "manifest_invalid"
  | "expected_revision_mismatch"
  | "ledger_append_failed";

export interface RuntimeDiagnosticDetails {
  source:
    | "schema"
    | "adapter"
    | "worker_exchange"
    | "store"
    | "continuity"
    | "cli";
  details: Readonly<Record<string, unknown>>;
}

export interface RuntimeFailure<
  Kind extends RuntimeFailureKind = RuntimeFailureKind,
> {
  kind: Kind;
  message: string;
  retryable: boolean;
  diagnostics?: RuntimeDiagnosticDetails;
}
```

Failure handling is part of the architecture, not an implementation detail.

No-mutation failures:

- manifest invalid
- ledger corrupt
- command precondition failed
- route override invalid
- current step mismatch
- missing required observed file
- malformed observed file
- complete worker result missing the declared artifact

Observation-only outcomes:

- synthesis artifact exists but fails its gate
- checkpoint request accepted and waiting on user response
- dispatch request accepted and waiting on worker result
- worker receipt appears for an already requested/running dispatch
- worker result is `partial`
- worker result is `blocked`
- worker result is complete but verdict does not pass and does not reroute

Transition outcomes:

- checkpoint selection routes through the manifest
- synthesis gate passed
- worker result passes
- worker result maps through `gate.reroute`
- terminal route expands to `run_completed`
- abort appends `run_aborted`

Projection materialization failure is not a ledger failure. If event append
succeeds but writing `state.json`, `active-run.md`, or current-run attachment
fails, the receipt must report `projection_materialization_failed` and callers
must be able to retry `materialize` without appending events.

## 10. Testing Strategy

The new test center should be boundary tests over `CircuitRuntime.execute`,
`CircuitRuntime.inspect`, and `CircuitRuntime.materialize`.

Test fixtures should use temp project roots and temp run roots. A memory store
can come later, but the first migration should use the same filesystem shape
the CLI uses.

Required boundary tests:

- bootstrap creates manifest snapshot, event ledger, state projection, active
  dashboard, and continuity attachment
- bootstrap retry after a written matching manifest snapshot but missing ledger
  is safe and deterministic
- complete synthesis advances on valid sections
- complete synthesis records artifact observation but rejects missing sections
  without route advancement
- complete synthesis rejects missing artifact without appending events
- checkpoint request and resolve round-trip through request/response files
- checkpoint invalid selection appends nothing
- dispatch request records requested/running state without executing transport
- dispatch receipt recovery records only receipt observation
- new dispatch receipt observations contain no adapter, transport,
  `resolved_from`, or runtime-boundary fields
- legacy `dispatch_received` events with adapter metadata still project
  compatibly but do not influence planning
- reconcile dispatch advances on allowed verdict
- reconcile dispatch records partial or blocked without route advancement
- reconcile dispatch records complete non-passing verdict without route
  advancement
- reconcile dispatch follows manifest `gate.reroute`
- reconcile dispatch emits routed `gate_failed` for manifest reroutes and emits
  no gate event for non-passing verdicts without reroute
- reconcile dispatch rejects complete result with missing declared artifact
  without appending events
- terminal routes clear current-run attachment
- abort derives current state from ledger, appends `run_aborted`, and clears
  attachment
- abort ignores corrupt or stale `state.json`
- `inspect` returns resume and active-run facts without writing files
- `materialize` writes `state.json`, writes `active-run.md`, syncs attachment,
  and appends no events
- corrupt `state.json` never changes command decisions
- projection materialization failure is retryable without event duplication
- injected batch append failure appends no partial event lines
- expected-revision mismatch appends nothing and forces re-plan
- observation-first commands re-project after observation before appending route
  decisions
- prompt, router, and session-start surfaces never use `active-run.md` as
  command input when a manifest snapshot and ledger are valid

Shallow tests should remain for:

- path safety
- markdown section extraction
- schema validators
- manifest parsing
- dispatch adapter execution outside runtime core
- CLI presenter compatibility

Golden CLI tests should pin the public command behavior for every migrated
slice. A migration slice is not done until the old command wrapper and the new
runtime path produce the same stdout/stderr shape, exit status, materialized
projection files, and event ledger for that command.

## 11. Migration Plan

0. Add boundary fixtures and golden CLI snapshots for the first migration slice.
   No command migration starts until its old wrapper behavior is pinned.
1. Add a type-only `runtime-core` skeleton with branded ids, constructors,
   command-specific plan unions, observation/decision event draft unions,
   event unions, plan unions, receipt unions, and presenter interfaces.
2. Add `projectLedger` as a strict wrapper around current event projection
   behavior. It must not read `state.json`.
3. Add batch-oriented `RuntimeStore.appendEvents` and route current event
   appends through it with expected-revision checks and atomic batch tests.
4. Add pure `CircuitRuntime.inspect`. The initial runtime-core slice is a
   read-only `inspectRuntimeView` seam; route `resume` through it only after
   golden CLI behavior is pinned.
5. Add `CircuitRuntime.materialize`. Route `render`, session-start active-run
   refresh, and current-run continuity fallback refresh through it.
6. Migrate `abort-run` early to remove the existing `state.json` authority
   backdoor.
7. Migrate `bootstrap`, because it owns run identity, manifest snapshotting,
   initial ledger creation, invocation-ledger side effects, and attachment
   setup.
8. Migrate `complete-synthesis` with explicit observation and decision batches.
9. Convert `completeSynthesisStep` into a compatibility wrapper after golden
   CLI tests pass.
10. Migrate checkpoint request and resolve.
11. Add `WorkerExchangeReader` and typed local worker exchange facts.
12. Update the canonical dispatch receipt event union so new core code emits
    transport-neutral receipt observations while still reading legacy
    `dispatch_received` entries. The JSON Schema already accepts both payload
    shapes.
13. Migrate dispatch request and reconcile, including receipt recovery,
    non-passing results, artifact requirements, and manifest reroutes.
14. Convert remaining command-specific exports into compatibility wrappers.
15. Delete helper-level tests only after equivalent boundary and golden CLI
    tests exist.

Each migration slice must reduce command-specific authority. Do not delete a
test merely because it is helper-level; delete it only when a boundary test
proves the same behavior at the runtime surface.

## 12. Non-Goals

- No worker transport rewrite. The runtime may define the local worker exchange
  facts it consumes, but adapter process execution stays outside the core.
- No new workflow authoring DSL.
- No registry-based extension framework in the first migration.
- No behavior change to public `circuit-engine` commands.
- No change to prompt contracts except references needed after command wrappers
  become thinner.
- No use of `state.json` or `active-run.md` as canonical command input.

## 13. Open Questions

1. Resolved for the scaffold: build a memory store for fast port and boundary
   tests, while still requiring the real filesystem store before CLI routing.
2. Should event and state TypeScript types be generated from JSON Schema, or
   should schemas continue to validate hand-authored TypeScript interfaces?
3. Should legacy `dispatch_received` adapter metadata be removed from the schema
   in the same release that introduces transport-neutral receipt observations,
   or accepted for one compatibility window?

## 14. Implementation Bar

The runtime-core migration is only successful if a new coding agent can answer
these questions from the new module alone:

- What is the canonical state authority?
- How does a command advance a run?
- What files are observations and what events are decisions?
- Which failures append nothing, which failures commit observations, and which
  outcomes commit transitions?
- What does a command return?
- Where do side effects happen?
- Which methods append events, which methods only materialize projections, and
  which methods are pure inspection?
- How are continuity attachment and active-run views updated?
- What is outside the runtime boundary?

If the answer requires reading every command-specific module, the migration has
not achieved its architectural purpose.
