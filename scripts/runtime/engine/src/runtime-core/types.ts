type Brand<Value, Name extends string> = Value & { readonly __brand: Name };
type AssertNever<Value extends never> = Value;

export type RuntimeSchemaVersion = "1";
export type ManifestSchemaVersion = "2";

export type RuntimeRevision = Brand<number, "RuntimeRevision">;
export type AttemptNumber = Brand<number, "AttemptNumber">;
export type ByteSize = Brand<number, "ByteSize">;
export type MtimeMilliseconds = Brand<number, "MtimeMilliseconds">;
export type MtimeNanoseconds = Brand<number, "MtimeNanoseconds">;
export type OptionCount = Brand<number, "OptionCount">;

export type RunId = Brand<string, "RunId">;
export type CircuitId = Brand<string, "CircuitId">;
export type StepId = Brand<string, "StepId">;
export type EventId = Brand<string, "EventId">;
export type RuntimeGoal = Brand<string, "RuntimeGoal">;
export type EntryModeId = Brand<string, "EntryModeId">;
export type GitHead = Brand<string, "GitHead">;
export type IsoTimestamp = Brand<string, "IsoTimestamp">;
export type RuntimeMessage = Brand<string, "RuntimeMessage">;
export type FailureReason = Brand<string, "FailureReason">;
export type AbortReason = Brand<string, "AbortReason">;
export type ProjectRootPath = Brand<string, "ProjectRootPath">;
export type RunRootPath = Brand<string, "RunRootPath">;
export type ManifestSourcePath = Brand<string, "ManifestSourcePath">;
export type ManifestSnapshotPath = Brand<string, "ManifestSnapshotPath">;
export type SafeRelativePath = Brand<string, "SafeRelativePath">;
export type SafeRelativeJsonPath = Brand<string, "SafeRelativeJsonPath">;
export type SafeRelativeArtifactPath = Brand<string, "SafeRelativeArtifactPath">;
export type ProtocolId = Brand<string, "ProtocolId">;
export type SchemaId = Brand<string, "SchemaId">;
export type ExchangeId = Brand<string, "ExchangeId">;
export type CheckpointKind = Brand<string, "CheckpointKind">;
export type CheckpointSelection = Brand<string, "CheckpointSelection">;
export type WorkerVerdict = Brand<string, "WorkerVerdict">;
export type ContentHash = Brand<string, "ContentHash">;
export type ParserId = Brand<string, "ParserId">;
export type SectionName = Brand<string, "SectionName">;
export type IdempotenceKey = Brand<string, "IdempotenceKey">;

export type RuntimeCommitClass = "observation" | "decision";
export type RuntimeAttachmentMode = "attached" | "detached";
export type RuntimeTerminalTarget = "@complete" | "@stop" | "@escalate" | "@handoff";
export type RuntimeRouteTarget = RuntimeTerminalTarget | StepId;
export type RuntimeTerminalStatus = "completed" | "stopped" | "blocked" | "handed_off";
export type RuntimeStatus =
  | "initialized"
  | "in_progress"
  | "waiting_checkpoint"
  | "waiting_worker"
  | "aborted"
  | RuntimeTerminalStatus
  | "failed";
export type RuntimeGateKind =
  | "schema_sections"
  | "all_outputs_present"
  | "checkpoint_selection"
  | "result_verdict"
  | "option_count";
export type WorkerCompletion = "complete" | "partial" | "blocked";
export type RuntimeMaterializeReason =
  | "execute"
  | "render"
  | "session_start"
  | "manual_retry";

export const RUNTIME_FAILURE_KINDS = [
  "precondition_failed",
  "missing_observed_file",
  "invalid_observed_file",
  "gate_failed",
  "route_invalid",
  "worker_non_passing",
  "worker_partial",
  "worker_blocked",
  "runtime_corrupt",
  "projection_materialization_failed",
  "manifest_invalid",
  "expected_revision_mismatch",
  "ledger_append_failed",
] as const;

export type RuntimeFailureKind = (typeof RUNTIME_FAILURE_KINDS)[number];

export interface RuntimeDiagnosticDetails {
  readonly source:
    | "schema"
    | "adapter"
    | "worker_exchange"
    | "store"
    | "continuity"
    | "cli";
  readonly details: Readonly<Record<string, unknown>>;
}

export interface RuntimeFailure<Kind extends RuntimeFailureKind = RuntimeFailureKind> {
  readonly kind: Kind;
  readonly message: RuntimeMessage;
  readonly retryable: boolean;
  readonly diagnostics?: RuntimeDiagnosticDetails;
}

export interface RuntimeRunRef {
  readonly runRoot: RunRootPath;
}

export interface BootstrapCommand {
  readonly kind: "bootstrap";
  readonly projectRoot: ProjectRootPath;
  readonly runRoot: RunRootPath;
  readonly manifestSource: ManifestSourcePath;
  readonly entryMode: EntryModeId;
  readonly attachment: RuntimeAttachmentMode;
  readonly goal?: RuntimeGoal;
}

export interface CompleteSynthesisCommand {
  readonly kind: "complete-synthesis";
  readonly ref: RuntimeRunRef;
  readonly stepId?: StepId;
  readonly routeOverride?: RuntimeRouteTarget;
}

export interface CheckpointRequestCommand {
  readonly kind: "request-checkpoint";
  readonly ref: RuntimeRunRef;
  readonly stepId?: StepId;
}

export interface CheckpointResolveCommand {
  readonly kind: "resolve-checkpoint";
  readonly ref: RuntimeRunRef;
  readonly stepId?: StepId;
  readonly selectionOverride?: CheckpointSelection;
  readonly routeOverride?: RuntimeRouteTarget;
}

export interface DispatchRequestCommand {
  readonly kind: "dispatch-step";
  readonly ref: RuntimeRunRef;
  readonly stepId?: StepId;
}

export interface DispatchReconcileCommand {
  readonly kind: "reconcile-dispatch";
  readonly ref: RuntimeRunRef;
  readonly stepId?: StepId;
}

export interface AbortCommand {
  readonly kind: "abort-run";
  readonly ref: RuntimeRunRef;
  readonly projectRoot: ProjectRootPath;
  readonly reason: AbortReason;
}

export type RuntimeCommand =
  | BootstrapCommand
  | CompleteSynthesisCommand
  | CheckpointRequestCommand
  | CheckpointResolveCommand
  | DispatchRequestCommand
  | DispatchReconcileCommand
  | AbortCommand;

export type RuntimeCommandKind = RuntimeCommand["kind"];

export interface InspectViewCommand {
  readonly kind: "inspect";
  readonly ref: RuntimeRunRef;
}

export interface ResumeViewCommand {
  readonly kind: "resume";
  readonly ref: RuntimeRunRef;
}

export interface RenderViewCommand {
  readonly kind: "render";
  readonly ref: RuntimeRunRef;
  readonly reason: RuntimeMaterializeReason;
}

export interface SessionStartViewCommand {
  readonly kind: "session-start";
  readonly projectRoot: ProjectRootPath;
}

export type RuntimeViewCommand =
  | InspectViewCommand
  | ResumeViewCommand
  | RenderViewCommand
  | SessionStartViewCommand;

export type RuntimeViewCommandKind = RuntimeViewCommand["kind"];

export interface RunStartedPayload {
  readonly manifest_path: ManifestSnapshotPath;
  readonly entry_mode: EntryModeId;
  readonly head_at_start: GitHead;
  readonly goal?: RuntimeGoal;
}

export interface StepStartedPayload {
  readonly step_id: StepId;
}

export interface DispatchRequestedPayload {
  readonly request_path: SafeRelativeJsonPath;
  readonly protocol: ProtocolId;
  readonly attempt: AttemptNumber;
}

export interface DispatchReceivedPayload {
  readonly receipt_path: SafeRelativeJsonPath;
  readonly exchange_id: ExchangeId;
  readonly attempt: AttemptNumber;
}

export interface JobCompletedPayload {
  readonly result_path: SafeRelativeJsonPath;
  readonly completion: WorkerCompletion;
  readonly attempt: AttemptNumber;
  readonly verdict?: WorkerVerdict;
}

export interface ArtifactWrittenPayload {
  readonly artifact_path: SafeRelativeArtifactPath;
  readonly schema?: SchemaId;
}

export interface GatePassedPayload {
  readonly step_id: StepId;
  readonly gate_kind: RuntimeGateKind;
  readonly route: RuntimeRouteTarget;
}

export interface GateFailedPayload {
  readonly step_id: StepId;
  readonly gate_kind: RuntimeGateKind;
  readonly failure_reason: FailureReason;
  readonly route: RuntimeRouteTarget;
}

export interface CheckpointRequestedPayload {
  readonly request_path: SafeRelativeJsonPath;
  readonly checkpoint_kind: CheckpointKind;
  readonly attempt: AttemptNumber;
}

export interface CheckpointResolvedPayload {
  readonly response_path: SafeRelativeJsonPath;
  readonly selection: CheckpointSelection;
  readonly attempt: AttemptNumber;
}

export type RunCompletedPayload =
  | {
      readonly status: "completed";
      readonly terminal_target: "@complete";
    }
  | {
      readonly status: "stopped";
      readonly terminal_target: "@stop";
    }
  | {
      readonly status: "blocked";
      readonly terminal_target: "@escalate";
      readonly diagnostic_path: SafeRelativePath;
    }
  | {
      readonly status: "handed_off";
      readonly terminal_target: "@handoff";
      readonly handoff_path: SafeRelativePath;
    };

export interface RunAbortedPayload {
  readonly reason: AbortReason;
  readonly aborted_at: IsoTimestamp;
}

export interface RuntimeEventBase<EventType extends string, Payload> {
  readonly schema_version: RuntimeSchemaVersion;
  readonly event_id: EventId;
  readonly event_type: EventType;
  readonly occurred_at: IsoTimestamp;
  readonly run_id: RunId;
  readonly circuit_id?: CircuitId;
  readonly step_id?: StepId;
  readonly attempt?: AttemptNumber;
  readonly payload: Payload;
}

export type RunStartedEvent = RuntimeEventBase<"run_started", RunStartedPayload>;
export type StepStartedEvent = RuntimeEventBase<"step_started", StepStartedPayload>;
export type DispatchRequestedEvent = RuntimeEventBase<
  "dispatch_requested",
  DispatchRequestedPayload
>;
export type DispatchReceivedEvent = RuntimeEventBase<
  "dispatch_received",
  DispatchReceivedPayload
>;
export type JobCompletedEvent = RuntimeEventBase<"job_completed", JobCompletedPayload>;
export type ArtifactWrittenEvent = RuntimeEventBase<
  "artifact_written",
  ArtifactWrittenPayload
>;
export type GatePassedEvent = RuntimeEventBase<"gate_passed", GatePassedPayload>;
export type GateFailedEvent = RuntimeEventBase<"gate_failed", GateFailedPayload>;
export type CheckpointRequestedEvent = RuntimeEventBase<
  "checkpoint_requested",
  CheckpointRequestedPayload
>;
export type CheckpointResolvedEvent = RuntimeEventBase<
  "checkpoint_resolved",
  CheckpointResolvedPayload
>;
export type RunCompletedEvent = RuntimeEventBase<"run_completed", RunCompletedPayload>;
export type RunAbortedEvent = RuntimeEventBase<"run_aborted", RunAbortedPayload>;

export type RuntimeEvent =
  | RunStartedEvent
  | StepStartedEvent
  | DispatchRequestedEvent
  | DispatchReceivedEvent
  | JobCompletedEvent
  | ArtifactWrittenEvent
  | GatePassedEvent
  | GateFailedEvent
  | CheckpointRequestedEvent
  | CheckpointResolvedEvent
  | RunCompletedEvent
  | RunAbortedEvent;

export type RuntimeEventType = RuntimeEvent["event_type"];

export const RUNTIME_EVENT_TYPES = [
  "run_started",
  "step_started",
  "dispatch_requested",
  "dispatch_received",
  "job_completed",
  "artifact_written",
  "gate_passed",
  "gate_failed",
  "checkpoint_requested",
  "checkpoint_resolved",
  "run_completed",
  "run_aborted",
] as const satisfies readonly RuntimeEventType[];

export type RuntimeEventTypesMissingFromList = AssertNever<
  Exclude<RuntimeEventType, (typeof RUNTIME_EVENT_TYPES)[number]>
>;
export type RuntimeEventListEntriesMissingFromUnion = AssertNever<
  Exclude<(typeof RUNTIME_EVENT_TYPES)[number], RuntimeEventType>
>;

export interface RuntimeEventDraftBase<
  EventType extends RuntimeEventType,
  CommitClass extends RuntimeCommitClass,
  Payload,
> {
  readonly event_type: EventType;
  readonly commitClass: CommitClass;
  readonly step_id?: StepId;
  readonly attempt?: AttemptNumber;
  readonly idempotenceKey: IdempotenceKey;
  readonly payload: Payload;
}

export type RunStartedDecisionDraft = RuntimeEventDraftBase<
  "run_started",
  "decision",
  RunStartedPayload
>;
export type StepStartedDecisionDraft = RuntimeEventDraftBase<
  "step_started",
  "decision",
  StepStartedPayload
>;
export type GatePassedDecisionDraft = RuntimeEventDraftBase<
  "gate_passed",
  "decision",
  GatePassedPayload
>;
export type GateFailedDecisionDraft = RuntimeEventDraftBase<
  "gate_failed",
  "decision",
  GateFailedPayload
>;
export type RunCompletedDecisionDraft = RuntimeEventDraftBase<
  "run_completed",
  "decision",
  RunCompletedPayload
>;
export type RunAbortedDecisionDraft = RuntimeEventDraftBase<
  "run_aborted",
  "decision",
  RunAbortedPayload
>;

export type DispatchRequestedObservationDraft = RuntimeEventDraftBase<
  "dispatch_requested",
  "observation",
  DispatchRequestedPayload
>;
export type DispatchReceivedObservationDraft = RuntimeEventDraftBase<
  "dispatch_received",
  "observation",
  DispatchReceivedPayload
>;
export type JobCompletedObservationDraft = RuntimeEventDraftBase<
  "job_completed",
  "observation",
  JobCompletedPayload
>;
export type ArtifactWrittenObservationDraft = RuntimeEventDraftBase<
  "artifact_written",
  "observation",
  ArtifactWrittenPayload
>;
export type CheckpointRequestedObservationDraft = RuntimeEventDraftBase<
  "checkpoint_requested",
  "observation",
  CheckpointRequestedPayload
>;
export type CheckpointResolvedObservationDraft = RuntimeEventDraftBase<
  "checkpoint_resolved",
  "observation",
  CheckpointResolvedPayload
>;

export type ObservationEventDraft =
  | DispatchRequestedObservationDraft
  | DispatchReceivedObservationDraft
  | JobCompletedObservationDraft
  | ArtifactWrittenObservationDraft
  | CheckpointRequestedObservationDraft
  | CheckpointResolvedObservationDraft;

export type DecisionEventDraft =
  | RunStartedDecisionDraft
  | StepStartedDecisionDraft
  | GatePassedDecisionDraft
  | GateFailedDecisionDraft
  | RunCompletedDecisionDraft
  | RunAbortedDecisionDraft;

export type RuntimeEventDraft = ObservationEventDraft | DecisionEventDraft;

export interface ObservationCommitBatch {
  readonly commitClass: "observation";
  readonly expectedRevision: RuntimeRevision;
  readonly drafts: readonly ObservationEventDraft[];
}

export interface DecisionCommitBatch {
  readonly commitClass: "decision";
  readonly expectedRevision: RuntimeRevision;
  readonly drafts: readonly DecisionEventDraft[];
}

export type LedgerCommitBatch = ObservationCommitBatch | DecisionCommitBatch;

export interface ProjectionWritePolicy {
  readonly stateJson: "skip" | "write";
  readonly activeRunMarkdown: "skip" | "write";
  readonly reason: RuntimeMaterializeReason;
}

export type ContinuityAttachmentIntent =
  | {
      readonly kind: "none";
    }
  | {
      readonly kind: "sync-current-run";
      readonly projectRoot: ProjectRootPath;
      readonly runRoot: RunRootPath;
      readonly runId: RunId;
    }
  | {
      readonly kind: "clear-current-run";
      readonly projectRoot: ProjectRootPath;
      readonly runRoot: RunRootPath;
      readonly runId: RunId;
    };

export interface RuntimeMaterializationPlan {
  readonly projection: ProjectionWritePolicy;
  readonly continuity: ContinuityAttachmentIntent;
}

export interface RuntimePlanBase<
  Command extends RuntimeCommand,
  ObservationDraft extends ObservationEventDraft,
  DecisionDraft extends DecisionEventDraft,
> {
  readonly kind: Command["kind"];
  readonly command: Command;
  readonly expectedRevision: RuntimeRevision;
  readonly observationDrafts: readonly ObservationDraft[];
  readonly decisionDrafts: readonly DecisionDraft[];
  readonly materialization: RuntimeMaterializationPlan;
}

export type BootstrapPlan = RuntimePlanBase<
  BootstrapCommand,
  never,
  RunStartedDecisionDraft | StepStartedDecisionDraft
>;

export type CompleteSynthesisPlan = RuntimePlanBase<
  CompleteSynthesisCommand,
  ArtifactWrittenObservationDraft,
  | GatePassedDecisionDraft
  | GateFailedDecisionDraft
  | StepStartedDecisionDraft
  | RunCompletedDecisionDraft
>;

export type CheckpointRequestPlan = RuntimePlanBase<
  CheckpointRequestCommand,
  ArtifactWrittenObservationDraft | CheckpointRequestedObservationDraft,
  never
>;

export type CheckpointResolvePlan = RuntimePlanBase<
  CheckpointResolveCommand,
  CheckpointResolvedObservationDraft,
  | GatePassedDecisionDraft
  | GateFailedDecisionDraft
  | StepStartedDecisionDraft
  | RunCompletedDecisionDraft
>;

export type DispatchRequestPlan = RuntimePlanBase<
  DispatchRequestCommand,
  | ArtifactWrittenObservationDraft
  | DispatchRequestedObservationDraft
  | DispatchReceivedObservationDraft,
  never
>;

export type DispatchReconcilePlan = RuntimePlanBase<
  DispatchReconcileCommand,
  DispatchReceivedObservationDraft | JobCompletedObservationDraft | ArtifactWrittenObservationDraft,
  | GatePassedDecisionDraft
  | GateFailedDecisionDraft
  | StepStartedDecisionDraft
  | RunCompletedDecisionDraft
>;

export type AbortPlan = RuntimePlanBase<AbortCommand, never, RunAbortedDecisionDraft>;

export type RuntimePlan =
  | BootstrapPlan
  | CompleteSynthesisPlan
  | CheckpointRequestPlan
  | CheckpointResolvePlan
  | DispatchRequestPlan
  | DispatchReconcilePlan
  | AbortPlan;

export interface FileEvidenceToken {
  readonly path: SafeRelativePath;
  readonly exists: boolean;
  readonly fileType?: "file" | "directory" | "missing" | "other";
  readonly byteSize?: ByteSize;
  readonly mtimeMilliseconds?: MtimeMilliseconds;
  readonly mtimeNanoseconds?: MtimeNanoseconds;
  readonly contentHash?: ContentHash;
  readonly parserId?: ParserId;
}

export interface MissingObservedFileFact {
  readonly kind: "missing-observed-file";
  readonly evidence: FileEvidenceToken;
}

export interface InvalidObservedFileFact {
  readonly kind: "invalid-observed-file";
  readonly evidence: FileEvidenceToken;
  readonly failure: RuntimeFailure<"invalid_observed_file">;
}

export interface ObservedMarkdownSectionsFact {
  readonly kind: "observed-markdown-sections";
  readonly evidence: FileEvidenceToken;
  readonly presentSections: readonly SectionName[];
  readonly missingSections: readonly SectionName[];
}

export interface OutputPresenceFact {
  readonly kind: "output-presence";
  readonly outputs: readonly FileEvidenceToken[];
}

export interface OptionCountFact {
  readonly kind: "option-count";
  readonly evidence: FileEvidenceToken;
  readonly count: OptionCount;
}

export interface ArtifactFact {
  readonly kind: "artifact";
  readonly evidence: FileEvidenceToken;
  readonly artifactPath: SafeRelativeArtifactPath;
  readonly schema?: SchemaId;
}

export interface CheckpointRequestFact {
  readonly kind: "checkpoint-request";
  readonly evidence: FileEvidenceToken;
  readonly requestPath: SafeRelativeJsonPath;
  readonly checkpointKind: CheckpointKind;
  readonly attempt: AttemptNumber;
}

export interface CheckpointResponseFact {
  readonly kind: "checkpoint-response";
  readonly evidence: FileEvidenceToken;
  readonly responsePath: SafeRelativeJsonPath;
  readonly selection: CheckpointSelection;
  readonly attempt: AttemptNumber;
}

export interface DispatchRequestFact {
  readonly kind: "dispatch-request";
  readonly evidence: FileEvidenceToken;
  readonly requestPath: SafeRelativeJsonPath;
  readonly protocol: ProtocolId;
  readonly attempt: AttemptNumber;
}

export interface WorkerReceiptFact {
  readonly kind: "worker-receipt";
  readonly evidence: FileEvidenceToken;
  readonly receiptPath: SafeRelativeJsonPath;
  readonly exchangeId: ExchangeId;
  readonly attempt: AttemptNumber;
}

export interface WorkerResultFact {
  readonly kind: "worker-result";
  readonly evidence: FileEvidenceToken;
  readonly resultPath: SafeRelativeJsonPath;
  readonly completion: WorkerCompletion;
  readonly attempt: AttemptNumber;
  readonly verdict?: WorkerVerdict;
}

export type RuntimeFact =
  | MissingObservedFileFact
  | InvalidObservedFileFact
  | ObservedMarkdownSectionsFact
  | OutputPresenceFact
  | OptionCountFact
  | ArtifactFact
  | CheckpointRequestFact
  | CheckpointResponseFact
  | DispatchRequestFact
  | WorkerReceiptFact
  | WorkerResultFact;

export interface RuntimeFacts {
  readonly facts: readonly RuntimeFact[];
}

export interface RuntimeGateBase<Kind extends RuntimeGateKind> {
  readonly kind: Kind;
}

export interface SchemaSectionsGate extends RuntimeGateBase<"schema_sections"> {
  readonly source: SafeRelativePath;
  readonly required: readonly SectionName[];
  readonly alternateSource?: SafeRelativePath;
  readonly alternateRequired?: readonly SectionName[];
}

export interface AllOutputsPresentGate extends RuntimeGateBase<"all_outputs_present"> {
  readonly requiredPaths: readonly SafeRelativePath[];
}

export interface CheckpointSelectionGate extends RuntimeGateBase<"checkpoint_selection"> {
  readonly source: SafeRelativeJsonPath;
  readonly allow: readonly CheckpointSelection[];
}

export interface ResultVerdictGate extends RuntimeGateBase<"result_verdict"> {
  readonly source: SafeRelativeJsonPath;
  readonly pass: readonly WorkerVerdict[];
  readonly reroute: readonly RuntimeVerdictRoute[];
}

export interface OptionCountGate extends RuntimeGateBase<"option_count"> {
  readonly source: SafeRelativePath;
  readonly minimum: OptionCount;
}

export type RuntimeGate =
  | SchemaSectionsGate
  | AllOutputsPresentGate
  | CheckpointSelectionGate
  | ResultVerdictGate
  | OptionCountGate;

export interface RuntimeVerdictRoute {
  readonly verdict: WorkerVerdict;
  readonly route: RuntimeRouteTarget;
}

export interface RuntimeManifestStep {
  readonly id: StepId;
  readonly title: RuntimeMessage;
  readonly executor: "orchestrator" | "worker";
  readonly kind: "synthesis" | "checkpoint" | "dispatch";
  readonly protocol?: ProtocolId;
  readonly gate: RuntimeGate;
}

export interface RuntimeManifestSnapshot {
  readonly schema_version: ManifestSchemaVersion;
  readonly manifestPath: ManifestSnapshotPath;
  readonly circuitId: CircuitId;
  readonly version: Brand<string, "ManifestVersion">;
  readonly steps: readonly RuntimeManifestStep[];
}

export interface RuntimeArtifactProjection {
  readonly artifactPath: SafeRelativeArtifactPath;
  readonly status: "pending" | "in_progress" | "complete" | "stale" | "failed";
  readonly gate: "pass" | "fail" | "pending" | "none";
  readonly producedBy?: StepId;
  readonly updatedAt?: IsoTimestamp;
}

export interface RuntimeJobProjection {
  readonly stepId: StepId;
  readonly attempt: AttemptNumber;
  readonly status: "requested" | "running" | "complete" | "failed" | "reconciling";
  readonly completion?: WorkerCompletion;
  readonly verdict?: WorkerVerdict;
  readonly requestPath?: SafeRelativeJsonPath;
  readonly receiptPath?: SafeRelativeJsonPath;
  readonly resultPath?: SafeRelativeJsonPath;
}

export interface RuntimeCheckpointProjection {
  readonly stepId: StepId;
  readonly attempt: AttemptNumber;
  readonly status: "requested" | "waiting" | "resolved";
  readonly requestPath?: SafeRelativeJsonPath;
  readonly responsePath?: SafeRelativeJsonPath;
  readonly selection?: CheckpointSelection;
}

export interface RuntimeRouteProjection {
  readonly stepId: StepId;
  readonly route: RuntimeRouteTarget;
}

export interface RuntimeProjection {
  readonly runId: RunId;
  readonly circuitId: CircuitId;
  readonly manifestVersion: Brand<string, "ManifestVersion">;
  readonly status: RuntimeStatus;
  readonly currentStep?: StepId;
  readonly selectedEntryMode: EntryModeId;
  readonly goal?: RuntimeGoal;
  readonly startedAt?: IsoTimestamp;
  readonly updatedAt?: IsoTimestamp;
  readonly git: RuntimeGitProjection;
  readonly artifacts: readonly RuntimeArtifactProjection[];
  readonly jobs: readonly RuntimeJobProjection[];
  readonly checkpoints: readonly RuntimeCheckpointProjection[];
  readonly routes: readonly RuntimeRouteProjection[];
  readonly terminalTarget?: RuntimeTerminalTarget;
  readonly abortReason?: AbortReason;
}

export interface RuntimeGitProjection {
  readonly headAtStart: GitHead;
  readonly currentHead?: GitHead;
}

export type RuntimeSuccessOutcome =
  | "bootstrap"
  | "synthesis_completed"
  | "checkpoint_resolved"
  | "dispatch_reconciled"
  | "dispatch_rerouted"
  | "terminal"
  | "aborted";

export type RuntimeNonAdvancingOutcome =
  | "already_bootstrapped"
  | "synthesis_gate_not_satisfied"
  | "step_already_completed"
  | "waiting_checkpoint"
  | "waiting_worker"
  | "worker_receipt_observed"
  | "dispatch_already_reconciled"
  | "worker_partial"
  | "worker_blocked"
  | "worker_non_passing"
  | "already_terminal"
  | "observation_committed_decision_replanned";

export interface LedgerAppendReceipt {
  readonly expectedRevision: RuntimeRevision;
  readonly finalRevision: RuntimeRevision;
  readonly appendedEvents: readonly RuntimeEvent[];
}

export type RuntimeMaterializationStatus =
  | {
      readonly ok: true;
      readonly projectionStatus: "written" | "skipped";
      readonly continuityStatus: "applied" | "skipped";
    }
  | {
      readonly ok: false;
      readonly failure: RuntimeFailure<
        "projection_materialization_failed" | "runtime_corrupt"
      >;
      readonly projectionStatus: "failed" | "written" | "skipped";
      readonly continuityStatus: "failed" | "applied" | "skipped";
    };

export interface RuntimeReceiptBase {
  readonly command: RuntimeCommand;
  readonly materialization: RuntimeMaterializationStatus;
}

export interface RuntimeSuccessReceipt<
  Outcome extends RuntimeSuccessOutcome = RuntimeSuccessOutcome,
> extends RuntimeReceiptBase {
  readonly kind: "success";
  readonly outcome: Outcome;
  readonly ledger: LedgerAppendReceipt;
}

export interface RuntimeNonAdvancingReceipt<
  Outcome extends RuntimeNonAdvancingOutcome = RuntimeNonAdvancingOutcome,
> extends RuntimeReceiptBase {
  readonly kind: "non_advancing";
  readonly outcome: Outcome;
  readonly noOp: boolean;
  readonly ledger?: LedgerAppendReceipt;
}

export interface RuntimeFailureReceipt<
  FailureKind extends RuntimeFailureKind = RuntimeFailureKind,
> extends RuntimeReceiptBase {
  readonly kind: "failure";
  readonly failure: RuntimeFailure<FailureKind>;
  readonly ledger?: LedgerAppendReceipt;
}

export type RuntimeReceipt =
  | RuntimeSuccessReceipt
  | RuntimeNonAdvancingReceipt
  | RuntimeFailureReceipt;

export interface RuntimeView {
  readonly ref: RuntimeRunRef;
  readonly projection: RuntimeProjection;
  readonly reason: RuntimeMessage;
  readonly resumeStep?: StepId;
}

export interface RuntimeViewFailure {
  readonly kind: "view_failure";
  readonly failure: RuntimeFailure<"precondition_failed" | "runtime_corrupt">;
}

export type RuntimeInspectReceipt = RuntimeView | RuntimeViewFailure;

export type RuntimeMaterializationReceipt =
  | {
      readonly kind: "materialization";
      readonly ref: RuntimeRunRef;
      readonly materialization: RuntimeMaterializationStatus & { readonly ok: true };
    }
  | {
      readonly kind: "materialization";
      readonly ref: RuntimeRunRef;
      readonly materialization: RuntimeMaterializationStatus & { readonly ok: false };
    };

export type SessionStartReceipt =
  | {
      readonly kind: "pending_continuity_banner";
    }
  | {
      readonly kind: "stale_current_run_cleared";
    }
  | {
      readonly kind: "welcome_banner";
    }
  | {
      readonly kind: "active_run_banner";
      readonly ref: RuntimeRunRef;
      readonly materialization: RuntimeMaterializationStatus;
    }
  | {
      readonly kind: "continuity_failure";
      readonly failure: "continuity_index_invalid";
    };

export interface CircuitRuntime {
  execute(command: RuntimeCommand): RuntimeReceipt;
  inspect(ref: RuntimeRunRef): RuntimeInspectReceipt;
  materialize(
    ref: RuntimeRunRef,
    reason: RuntimeMaterializeReason,
    continuity: ContinuityAttachmentIntent,
  ): RuntimeMaterializationReceipt;
}
