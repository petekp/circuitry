import type {
  AbortPlan,
  ArtifactWrittenObservationDraft,
  BootstrapPlan,
  CheckpointRequestPlan,
  CheckpointRequestedObservationDraft,
  CheckpointResolvePlan,
  CheckpointResolvedObservationDraft,
  CompleteSynthesisPlan,
  ContinuityAttachmentIntent,
  DecisionEventDraft,
  DispatchReceivedObservationDraft,
  DispatchReconcilePlan,
  DispatchRequestPlan,
  DispatchRequestedObservationDraft,
  GateFailedDecisionDraft,
  GatePassedDecisionDraft,
  JobCompletedObservationDraft,
  LedgerAppendReceipt,
  LedgerCommitBatch,
  ObservationCommitBatch,
  ObservationEventDraft,
  ProjectionWritePolicy,
  RunAbortedDecisionDraft,
  RunCompletedDecisionDraft,
  RunStartedDecisionDraft,
  RuntimeCommand,
  RuntimeFailureKind,
  RuntimeMaterializationPlan,
  RuntimeMaterializationStatus,
  RuntimeEventType,
  RuntimeViewCommand,
  StepStartedDecisionDraft,
  WorkerReceiptFact,
  WorkerResultFact,
} from "./types.js";
import type {
  CommitLedgerInput,
  CommitLedgerDeps,
  ContinuityAttachmentFailure,
  MaterializeRuntimeViewDeps,
  InspectRuntimeViewDeps,
  ManifestSnapshotReader,
  ObservedFileReader,
  ObserveRuntimeFactsDeps,
  ProjectionWriter,
  RuntimeEventLedgerAppender,
  RuntimeEventLedgerReader,
  WorkerExchangeReader,
} from "./ports.js";
import type { ProjectLedgerEventHandlers } from "./project-ledger.js";
import type { PlanRuntimeCommandInput } from "./plan-command.js";

type AssertAssignable<Actual extends Expected, Expected> = [Actual, Expected];
type AssertExact<Actual, Expected> =
  [Actual] extends [Expected]
    ? [Expected] extends [Actual]
      ? true
      : never
    : never;
type AssertNever<Value extends never> = Value;

type ProofPacketFailureKind =
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

export type FailureKindsMatchProofPacket = AssertExact<
  RuntimeFailureKind,
  ProofPacketFailureKind
>;

export type RuntimeCommandsDoNotIncludeViewCommands = AssertNever<
  Extract<RuntimeCommand, RuntimeViewCommand>
>;
export type RuntimeViewCommandsDoNotIncludeMutatingCommands = AssertNever<
  Extract<RuntimeViewCommand, RuntimeCommand>
>;

export type ObservationDraftsRejectDecisionDrafts = AssertNever<
  Extract<ObservationEventDraft, DecisionEventDraft>
>;
export type DecisionDraftsRejectObservationDrafts = AssertNever<
  Extract<DecisionEventDraft, ObservationEventDraft>
>;

export type BootstrapAllowsRunStarted = AssertAssignable<
  RunStartedDecisionDraft,
  BootstrapPlan["decisionDrafts"][number]
>;
export type BootstrapAllowsInitialStepStarted = AssertAssignable<
  StepStartedDecisionDraft,
  BootstrapPlan["decisionDrafts"][number]
>;
// @ts-expect-error bootstrap has no observation batch.
export type BootstrapRejectsArtifactObservation = AssertAssignable<ArtifactWrittenObservationDraft, BootstrapPlan["observationDrafts"][number]>;
// @ts-expect-error bootstrap cannot abort a run.
export type BootstrapRejectsAbortDecision = AssertAssignable<RunAbortedDecisionDraft, BootstrapPlan["decisionDrafts"][number]>;

export type CompleteSynthesisAllowsArtifact = AssertAssignable<
  ArtifactWrittenObservationDraft,
  CompleteSynthesisPlan["observationDrafts"][number]
>;
export type CompleteSynthesisAllowsGatePass = AssertAssignable<
  GatePassedDecisionDraft,
  CompleteSynthesisPlan["decisionDrafts"][number]
>;
export type CompleteSynthesisAllowsRoutedGateFailure = AssertAssignable<
  GateFailedDecisionDraft,
  CompleteSynthesisPlan["decisionDrafts"][number]
>;
export type CompleteSynthesisAllowsNextStep = AssertAssignable<
  StepStartedDecisionDraft,
  CompleteSynthesisPlan["decisionDrafts"][number]
>;
export type CompleteSynthesisAllowsTerminal = AssertAssignable<
  RunCompletedDecisionDraft,
  CompleteSynthesisPlan["decisionDrafts"][number]
>;
// @ts-expect-error complete-synthesis cannot observe checkpoint responses.
export type CompleteSynthesisRejectsCheckpointResponse = AssertAssignable<CheckpointResolvedObservationDraft, CompleteSynthesisPlan["observationDrafts"][number]>;
// @ts-expect-error complete-synthesis cannot emit abort decisions.
export type CompleteSynthesisRejectsAbortDecision = AssertAssignable<RunAbortedDecisionDraft, CompleteSynthesisPlan["decisionDrafts"][number]>;

export type CheckpointRequestAllowsArtifact = AssertAssignable<
  ArtifactWrittenObservationDraft,
  CheckpointRequestPlan["observationDrafts"][number]
>;
export type CheckpointRequestAllowsCheckpointRequest = AssertAssignable<
  CheckpointRequestedObservationDraft,
  CheckpointRequestPlan["observationDrafts"][number]
>;
// @ts-expect-error request-checkpoint cannot make route decisions.
export type CheckpointRequestRejectsGatePass = AssertAssignable<GatePassedDecisionDraft, CheckpointRequestPlan["decisionDrafts"][number]>;
// @ts-expect-error request-checkpoint cannot observe worker dispatch.
export type CheckpointRequestRejectsDispatchRequest = AssertAssignable<DispatchRequestedObservationDraft, CheckpointRequestPlan["observationDrafts"][number]>;

export type CheckpointResolveAllowsResponse = AssertAssignable<
  CheckpointResolvedObservationDraft,
  CheckpointResolvePlan["observationDrafts"][number]
>;
export type CheckpointResolveAllowsGatePass = AssertAssignable<
  GatePassedDecisionDraft,
  CheckpointResolvePlan["decisionDrafts"][number]
>;
export type CheckpointResolveAllowsTerminal = AssertAssignable<
  RunCompletedDecisionDraft,
  CheckpointResolvePlan["decisionDrafts"][number]
>;
// @ts-expect-error resolve-checkpoint cannot observe artifacts.
export type CheckpointResolveRejectsArtifact = AssertAssignable<ArtifactWrittenObservationDraft, CheckpointResolvePlan["observationDrafts"][number]>;

export type DispatchRequestAllowsArtifact = AssertAssignable<
  ArtifactWrittenObservationDraft,
  DispatchRequestPlan["observationDrafts"][number]
>;
export type DispatchRequestAllowsRequest = AssertAssignable<
  DispatchRequestedObservationDraft,
  DispatchRequestPlan["observationDrafts"][number]
>;
export type DispatchRequestAllowsReceipt = AssertAssignable<
  DispatchReceivedObservationDraft,
  DispatchRequestPlan["observationDrafts"][number]
>;
// @ts-expect-error dispatch-step cannot observe job completion.
export type DispatchRequestRejectsJobCompletion = AssertAssignable<JobCompletedObservationDraft, DispatchRequestPlan["observationDrafts"][number]>;
// @ts-expect-error dispatch-step cannot make route decisions.
export type DispatchRequestRejectsGatePass = AssertAssignable<GatePassedDecisionDraft, DispatchRequestPlan["decisionDrafts"][number]>;

export type DispatchReconcileAllowsReceipt = AssertAssignable<
  DispatchReceivedObservationDraft,
  DispatchReconcilePlan["observationDrafts"][number]
>;
export type DispatchReconcileAllowsJobCompletion = AssertAssignable<
  JobCompletedObservationDraft,
  DispatchReconcilePlan["observationDrafts"][number]
>;
export type DispatchReconcileAllowsArtifact = AssertAssignable<
  ArtifactWrittenObservationDraft,
  DispatchReconcilePlan["observationDrafts"][number]
>;
export type DispatchReconcileAllowsGatePass = AssertAssignable<
  GatePassedDecisionDraft,
  DispatchReconcilePlan["decisionDrafts"][number]
>;
export type DispatchReconcileAllowsTerminal = AssertAssignable<
  RunCompletedDecisionDraft,
  DispatchReconcilePlan["decisionDrafts"][number]
>;
// @ts-expect-error reconcile-dispatch cannot create a new dispatch request.
export type DispatchReconcileRejectsDispatchRequest = AssertAssignable<DispatchRequestedObservationDraft, DispatchReconcilePlan["observationDrafts"][number]>;

export type AbortAllowsRunAborted = AssertAssignable<
  RunAbortedDecisionDraft,
  AbortPlan["decisionDrafts"][number]
>;
// @ts-expect-error abort-run has no observation batch.
export type AbortRejectsArtifactObservation = AssertAssignable<ArtifactWrittenObservationDraft, AbortPlan["observationDrafts"][number]>;
// @ts-expect-error abort-run cannot start another step.
export type AbortRejectsStepStarted = AssertAssignable<StepStartedDecisionDraft, AbortPlan["decisionDrafts"][number]>;

export type ObservationCommitBatchRejectsDecisionDrafts = AssertNever<
  Extract<
    Extract<LedgerCommitBatch, { readonly commitClass: "observation" }>["drafts"][number],
    GatePassedDecisionDraft
  >
>;
export type DecisionCommitBatchRejectsObservationDrafts = AssertNever<
  Extract<
    Extract<LedgerCommitBatch, { readonly commitClass: "decision" }>["drafts"][number],
    CheckpointRequestedObservationDraft
  >
>;

export type WorkerFactsHaveNoTransportKeys = AssertNever<
  Extract<
    keyof WorkerReceiptFact | keyof WorkerResultFact,
    | "adapter"
    | "transport"
    | "argv"
    | "fallback"
    | "diagnostics_path"
    | "warnings"
    | "resolved_from"
    | "raw"
  >
>;

export type LedgerReceiptDoesNotContainMaterialization = AssertNever<
  Extract<keyof LedgerAppendReceipt, "materialization" | "projectionStatus" | "continuityStatus">
>;
export type ProjectionPolicyDoesNotContainContinuityIntent = AssertNever<
  Extract<keyof ProjectionWritePolicy, "continuity" | "attachment" | "attachmentIntent">
>;
export type MaterializationPlanKeepsContinuitySeparate = AssertExact<
  keyof RuntimeMaterializationPlan,
  "projection" | "continuity"
>;
export type MaterializationFailureCanReportProjectionOrCorruptLedger = AssertExact<
  Extract<RuntimeMaterializationStatus, { readonly ok: false }>["failure"]["kind"],
  "projection_materialization_failed" | "runtime_corrupt"
>;
export type ContinuityIntentIsNotProjectionPolicy = AssertNever<
  Extract<ContinuityAttachmentIntent, ProjectionWritePolicy>
>;

export type LedgerReaderAndAppenderCapabilitiesDoNotOverlap = AssertNever<
  Extract<keyof RuntimeEventLedgerReader, keyof RuntimeEventLedgerAppender>
>;
export type CommitLedgerDepsAreAppendOnly = AssertExact<
  keyof CommitLedgerDeps,
  "appender" | "clock" | "ids"
>;
export type CommitLedgerInputCarriesRunIdentity = AssertExact<
  Extract<CommitLedgerInput, { readonly batch: ObservationCommitBatch }>,
  {
    readonly ref: Extract<CommitLedgerInput, { readonly batch: ObservationCommitBatch }>["ref"];
    readonly runId: Extract<
      CommitLedgerInput,
      { readonly batch: ObservationCommitBatch }
    >["runId"];
    readonly circuitId?: Extract<
      CommitLedgerInput,
      { readonly batch: ObservationCommitBatch }
    >["circuitId"];
    readonly batch: ObservationCommitBatch;
    readonly deps: CommitLedgerDeps;
  }
>;
export type ObserveRuntimeFactsDepsAreReadOnly = AssertExact<
  keyof ObserveRuntimeFactsDeps,
  "observedFiles" | "workerExchange" | "hash"
>;
export type MaterializeRuntimeViewDepsAreProjectionOnly = AssertExact<
  keyof MaterializeRuntimeViewDeps,
  "projectionWriter" | "activeRunRenderer" | "continuity"
>;
export type InspectRuntimeViewDepsAreReadOnly = AssertExact<
  keyof InspectRuntimeViewDeps,
  "manifestReader" | "ledgerReader"
>;
export type ObserversCannotWriteRuntimeArtifacts = AssertNever<
  Extract<
    keyof ObservedFileReader | keyof WorkerExchangeReader,
    | "appendEvents"
    | "writeStateProjection"
    | "renderActiveRun"
    | "syncCurrentRun"
    | "clearCurrentRun"
  >
>;
export type ProjectionWriterCannotAppendOrAttach = AssertNever<
  Extract<
    keyof ProjectionWriter,
    "appendEvents" | "syncCurrentRun" | "clearCurrentRun" | "readEvents"
  >
>;
export type InspectRuntimeViewDepsCannotWriteRuntimeArtifacts = AssertNever<
  Extract<
    keyof ManifestSnapshotReader | keyof RuntimeEventLedgerReader,
    | "appendEvents"
    | "writeManifestSnapshot"
    | "writeStateProjection"
    | "renderActiveRun"
    | "syncCurrentRun"
    | "clearCurrentRun"
  >
>;
export type ContinuityFailureDiagnosticsSourceIsPinned = AssertExact<
  ContinuityAttachmentFailure["diagnostics"]["source"],
  "continuity"
>;

export type ProjectLedgerHandlersCoverEveryRuntimeEvent = AssertExact<
  keyof ProjectLedgerEventHandlers,
  RuntimeEventType
>;
export type ProjectLedgerRunStartedHandlerReceivesRunStartedEvent = AssertExact<
  Parameters<ProjectLedgerEventHandlers["run_started"]>[0]["event"]["event_type"],
  "run_started"
>;
// @ts-expect-error project-ledger handlers cannot omit an event type.
export type ProjectLedgerHandlersRejectMissingCase = AssertAssignable<Omit<ProjectLedgerEventHandlers, "run_aborted">, ProjectLedgerEventHandlers>;
// @ts-expect-error project-ledger handlers cannot add a non-event handler key.
export type ProjectLedgerHandlersRejectExtraCase = AssertAssignable<keyof (ProjectLedgerEventHandlers & { readonly fake_event: ProjectLedgerEventHandlers["run_started"] }), RuntimeEventType>;

export type PlanRuntimeCommandInputCarriesRevisionAndTime = AssertExact<
  keyof PlanRuntimeCommandInput,
  "command" | "projection" | "facts" | "expectedRevision" | "plannedAt"
>;
