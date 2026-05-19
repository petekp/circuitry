import type {
  ContentHash,
  ContinuityAttachmentIntent,
  CircuitId,
  DecisionCommitBatch,
  DispatchRequestFact,
  EventId,
  FileEvidenceToken,
  IdempotenceKey,
  IsoTimestamp,
  LedgerAppendReceipt,
  ManifestSnapshotPath,
  ManifestSourcePath,
  ObservationCommitBatch,
  ProjectRootPath,
  RuntimeCommitClass,
  RuntimeEvent,
  RuntimeDiagnosticDetails,
  RuntimeFailure,
  RuntimeManifestSnapshot,
  RuntimeMaterializationStatus,
  RuntimeProjection,
  RuntimeRevision,
  RuntimeRunRef,
  RunId,
  SafeRelativeJsonPath,
  SafeRelativePath,
  WorkerReceiptFact,
  WorkerResultFact,
} from "./types.js";

export type RuntimePortResult<Value, Failure extends RuntimeFailure> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly failure: Failure;
    };

export interface ManifestSourceReadRequest {
  readonly projectRoot: ProjectRootPath;
  readonly sourcePath: ManifestSourcePath;
}

export interface ManifestSourceReadReceipt {
  readonly sourcePath: ManifestSourcePath;
  readonly snapshot: RuntimeManifestSnapshot;
  readonly evidence: FileEvidenceToken;
}

export interface ManifestSnapshotWriteRequest {
  readonly ref: RuntimeRunRef;
  readonly snapshot: RuntimeManifestSnapshot;
}

export interface ManifestSnapshotWriteReceipt {
  readonly manifestPath: ManifestSnapshotPath;
  readonly evidence: FileEvidenceToken;
}

export interface ManifestSnapshotReader {
  readManifestSnapshot(
    ref: RuntimeRunRef,
  ): RuntimePortResult<
    RuntimeManifestSnapshot,
    RuntimeFailure<"missing_observed_file" | "manifest_invalid">
  >;
}

export interface ManifestSourceReader {
  readManifestSource(
    request: ManifestSourceReadRequest,
  ): RuntimePortResult<
    ManifestSourceReadReceipt,
    RuntimeFailure<"missing_observed_file" | "manifest_invalid" | "invalid_observed_file">
  >;
}

export interface ManifestSnapshotWriter {
  writeManifestSnapshot(
    request: ManifestSnapshotWriteRequest,
  ): RuntimePortResult<
    ManifestSnapshotWriteReceipt,
    RuntimeFailure<"precondition_failed" | "manifest_invalid">
  >;
}

export interface RuntimeLedgerSnapshot {
  readonly ref: RuntimeRunRef;
  readonly revision: RuntimeRevision;
  readonly events: readonly RuntimeEvent[];
}

export interface RuntimeAppendRequest {
  readonly ref: RuntimeRunRef;
  readonly commitClass: RuntimeCommitClass;
  readonly expectedRevision: RuntimeRevision;
  readonly events: readonly RuntimeEvent[];
}

export interface RuntimeEventLedgerReader {
  readEvents(
    ref: RuntimeRunRef,
  ): RuntimePortResult<RuntimeLedgerSnapshot, RuntimeFailure<"runtime_corrupt">>;
}

export interface RuntimeEventLedgerAppender {
  appendEvents(
    request: RuntimeAppendRequest,
  ): RuntimePortResult<
    LedgerAppendReceipt,
    RuntimeFailure<"expected_revision_mismatch" | "ledger_append_failed" | "runtime_corrupt">
  >;
}

export interface ObservedFileReadRequest {
  readonly ref: RuntimeRunRef;
  readonly path: SafeRelativePath;
  readonly contentHashRequired: boolean;
}

export interface ObservedTextFile {
  readonly evidence: FileEvidenceToken;
  readonly text: string;
}

export interface ObservedFileReader {
  statObservedFile(
    request: ObservedFileReadRequest,
  ): RuntimePortResult<
    FileEvidenceToken,
    RuntimeFailure<"missing_observed_file" | "invalid_observed_file">
  >;
  readObservedText(
    request: ObservedFileReadRequest,
  ): RuntimePortResult<
    ObservedTextFile,
    RuntimeFailure<"missing_observed_file" | "invalid_observed_file">
  >;
}

export interface WorkerExchangeReadRequest {
  readonly ref: RuntimeRunRef;
  readonly path: SafeRelativeJsonPath;
  readonly contentHashRequired: boolean;
}

export interface WorkerExchangeReader {
  readDispatchRequest(request: WorkerExchangeReadRequest): RuntimePortResult<
    DispatchRequestFact,
    RuntimeFailure<"missing_observed_file" | "invalid_observed_file">
  >;
  readWorkerReceipt(request: WorkerExchangeReadRequest): RuntimePortResult<
    WorkerReceiptFact,
    RuntimeFailure<"missing_observed_file" | "invalid_observed_file">
  >;
  readWorkerResult(request: WorkerExchangeReadRequest): RuntimePortResult<
    WorkerResultFact,
    RuntimeFailure<"missing_observed_file" | "invalid_observed_file">
  >;
}

export interface ProjectionWriteRequest {
  readonly ref: RuntimeRunRef;
  readonly projection: RuntimeProjection;
}

export interface ProjectionWriteReceipt {
  readonly ref: RuntimeRunRef;
  readonly statePath: SafeRelativePath;
}

export interface ProjectionWriter {
  writeStateProjection(
    request: ProjectionWriteRequest,
  ): RuntimePortResult<
    ProjectionWriteReceipt,
    RuntimeFailure<"projection_materialization_failed">
  >;
}

export interface ActiveRunRenderRequest {
  readonly ref: RuntimeRunRef;
  readonly projection: RuntimeProjection;
}

export interface ActiveRunRenderReceipt {
  readonly ref: RuntimeRunRef;
  readonly activeRunPath: SafeRelativePath;
}

export interface ActiveRunRenderer {
  renderActiveRun(
    request: ActiveRunRenderRequest,
  ): RuntimePortResult<
    ActiveRunRenderReceipt,
    RuntimeFailure<"projection_materialization_failed">
  >;
}

export type ContinuitySyncIntent = Extract<
  ContinuityAttachmentIntent,
  { readonly kind: "sync-current-run" }
>;

export type ContinuityClearIntent = Extract<
  ContinuityAttachmentIntent,
  { readonly kind: "clear-current-run" }
>;

export type ContinuityAttachmentFailure =
  RuntimeFailure<"projection_materialization_failed"> & {
    readonly diagnostics: RuntimeDiagnosticDetails & { readonly source: "continuity" };
  };

export interface ContinuityAttachmentReceipt {
  readonly materialization: RuntimeMaterializationStatus;
}

export interface ContinuityPort {
  syncCurrentRun(
    intent: ContinuitySyncIntent,
  ): RuntimePortResult<ContinuityAttachmentReceipt, ContinuityAttachmentFailure>;
  clearCurrentRun(
    intent: ContinuityClearIntent,
  ): RuntimePortResult<ContinuityAttachmentReceipt, ContinuityAttachmentFailure>;
}

export interface Clock {
  now(): IsoTimestamp;
}

export interface IdGenerator {
  newEventId(): EventId;
}

export interface HashPort {
  hashText(text: string): ContentHash;
}

export interface RuntimeEventDraftIdempotence {
  readonly idempotenceKey: IdempotenceKey;
}

export interface CommitLedgerDeps {
  readonly appender: RuntimeEventLedgerAppender;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export interface ObserveRuntimeFactsDeps {
  readonly observedFiles: ObservedFileReader;
  readonly workerExchange: WorkerExchangeReader;
  readonly hash: HashPort;
}

export interface MaterializeRuntimeViewDeps {
  readonly projectionWriter: ProjectionWriter;
  readonly activeRunRenderer: ActiveRunRenderer;
  readonly continuity: ContinuityPort;
}

export interface InspectRuntimeViewDeps {
  readonly manifestReader: ManifestSnapshotReader;
  readonly ledgerReader: RuntimeEventLedgerReader;
}

export type CommitLedgerInput =
  | {
      readonly ref: RuntimeRunRef;
      readonly runId: RunId;
      readonly circuitId?: CircuitId;
      readonly batch: ObservationCommitBatch;
      readonly deps: CommitLedgerDeps;
    }
  | {
      readonly ref: RuntimeRunRef;
      readonly runId: RunId;
      readonly circuitId?: CircuitId;
      readonly batch: DecisionCommitBatch;
      readonly deps: CommitLedgerDeps;
    };
