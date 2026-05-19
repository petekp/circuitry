import type {
  EntryModeId,
  GitHead,
  RunId,
  RuntimeArtifactProjection,
  RuntimeCheckpointProjection,
  RuntimeEvent,
  RuntimeEventType,
  RuntimeJobProjection,
  RuntimeManifestSnapshot,
  RuntimeProjection,
  RuntimeRouteProjection,
  StepId,
} from "./types.js";
import { RUNTIME_EVENT_TYPES } from "./types.js";

export interface ProjectLedgerInput {
  readonly manifest: RuntimeManifestSnapshot;
  readonly events: readonly RuntimeEvent[];
}

export type ProjectLedger = (input: ProjectLedgerInput) => RuntimeProjection;

export interface ProjectLedgerEventHandlerInput<Event extends RuntimeEvent> {
  readonly manifest: RuntimeManifestSnapshot;
  readonly projection: RuntimeProjection;
  readonly event: Event;
}

export type ProjectLedgerEventHandler<Event extends RuntimeEvent> = (
  input: ProjectLedgerEventHandlerInput<Event>,
) => RuntimeProjection;

export type ProjectLedgerEventHandlers = {
  readonly [EventType in RuntimeEventType]: ProjectLedgerEventHandler<
    Extract<RuntimeEvent, { readonly event_type: EventType }>
  >;
};

export const PROJECT_LEDGER_EVENT_TYPES = RUNTIME_EVENT_TYPES satisfies readonly RuntimeEventType[];

export function defineProjectLedgerEventHandlers(
  handlers: ProjectLedgerEventHandlers,
): ProjectLedgerEventHandlers {
  return handlers;
}

function initialProjection(manifest: RuntimeManifestSnapshot): RuntimeProjection {
  return {
    runId: "" as RunId,
    circuitId: manifest.circuitId,
    manifestVersion: manifest.version,
    status: "initialized",
    selectedEntryMode: "" as EntryModeId,
    git: {
      headAtStart: "" as GitHead,
    },
    artifacts: [],
    jobs: [],
    checkpoints: [],
    routes: [],
  };
}

function resolveStepId(
  projection: RuntimeProjection,
  eventStepId: StepId | undefined,
  eventType: RuntimeEventType,
): StepId {
  const stepId = eventStepId ?? projection.currentStep;
  if (!stepId) {
    throw new Error(`projectLedger: ${eventType} event has no step_id and no currentStep`);
  }
  return stepId;
}

function upsertArtifact(
  artifacts: readonly RuntimeArtifactProjection[],
  nextArtifact: RuntimeArtifactProjection,
): readonly RuntimeArtifactProjection[] {
  const remaining = artifacts.filter(
    (artifact) => artifact.artifactPath !== nextArtifact.artifactPath,
  );
  return [...remaining, nextArtifact];
}

function updateArtifactsForGate(
  artifacts: readonly RuntimeArtifactProjection[],
  stepId: StepId,
  gate: RuntimeArtifactProjection["gate"],
  updatedAt: RuntimeArtifactProjection["updatedAt"],
): readonly RuntimeArtifactProjection[] {
  return artifacts.map((artifact) =>
    artifact.producedBy === stepId
      ? {
          ...artifact,
          gate,
          updatedAt,
        }
      : artifact,
  );
}

function upsertRoute(
  routes: readonly RuntimeRouteProjection[],
  nextRoute: RuntimeRouteProjection,
): readonly RuntimeRouteProjection[] {
  const remaining = routes.filter((route) => route.stepId !== nextRoute.stepId);
  return [...remaining, nextRoute];
}

function upsertJob(
  jobs: readonly RuntimeJobProjection[],
  nextJob: RuntimeJobProjection,
): readonly RuntimeJobProjection[] {
  const remaining = jobs.filter(
    (job) => job.stepId !== nextJob.stepId || job.attempt !== nextJob.attempt,
  );
  return [...remaining, nextJob];
}

function findJob(
  jobs: readonly RuntimeJobProjection[],
  stepId: StepId,
  attempt: RuntimeJobProjection["attempt"],
): RuntimeJobProjection | undefined {
  return jobs.find((job) => job.stepId === stepId && job.attempt === attempt);
}

function upsertCheckpoint(
  checkpoints: readonly RuntimeCheckpointProjection[],
  nextCheckpoint: RuntimeCheckpointProjection,
): readonly RuntimeCheckpointProjection[] {
  const remaining = checkpoints.filter(
    (checkpoint) =>
      checkpoint.stepId !== nextCheckpoint.stepId ||
      checkpoint.attempt !== nextCheckpoint.attempt,
  );
  return [...remaining, nextCheckpoint];
}

function findCheckpoint(
  checkpoints: readonly RuntimeCheckpointProjection[],
  stepId: StepId,
  attempt: RuntimeCheckpointProjection["attempt"],
): RuntimeCheckpointProjection | undefined {
  return checkpoints.find(
    (checkpoint) => checkpoint.stepId === stepId && checkpoint.attempt === attempt,
  );
}

export const PROJECT_LEDGER_EVENT_HANDLERS = defineProjectLedgerEventHandlers({
  run_started: ({ projection, event }) => ({
    ...projection,
    runId: event.run_id,
    circuitId: event.circuit_id ?? projection.circuitId,
    status: "initialized",
    selectedEntryMode: event.payload.entry_mode,
    goal: event.payload.goal,
    startedAt: event.occurred_at,
    updatedAt: event.occurred_at,
    git: {
      ...projection.git,
      headAtStart: event.payload.head_at_start,
    },
  }),
  step_started: ({ projection, event }) => ({
    ...projection,
    status: "in_progress",
    currentStep: event.payload.step_id,
    updatedAt: event.occurred_at,
  }),
  dispatch_requested: ({ projection, event }) => {
    const stepId = resolveStepId(projection, event.step_id, event.event_type);
    const existingJob = findJob(projection.jobs, stepId, event.payload.attempt);
    const hasResult = existingJob?.status === "complete" || existingJob?.status === "failed";

    return {
      ...projection,
      status: hasResult ? projection.status : "waiting_worker",
      jobs: upsertJob(projection.jobs, {
        ...existingJob,
        stepId,
        attempt: event.payload.attempt,
        status: existingJob?.status ?? "requested",
        requestPath: event.payload.request_path,
      }),
      updatedAt: event.occurred_at,
    };
  },
  dispatch_received: ({ projection, event }) => {
    const stepId = resolveStepId(projection, event.step_id, event.event_type);
    const existingJob = findJob(projection.jobs, stepId, event.payload.attempt);
    const hasResult = existingJob?.status === "complete" || existingJob?.status === "failed";

    return {
      ...projection,
      status: hasResult ? projection.status : "waiting_worker",
      jobs: upsertJob(projection.jobs, {
        ...existingJob,
        stepId,
        attempt: event.payload.attempt,
        status: hasResult ? existingJob.status : "running",
        receiptPath: event.payload.receipt_path,
      }),
      updatedAt: event.occurred_at,
    };
  },
  job_completed: ({ projection, event }) => {
    const stepId = resolveStepId(projection, event.step_id, event.event_type);
    const existingJob = findJob(projection.jobs, stepId, event.payload.attempt);

    return {
      ...projection,
      status: "in_progress",
      jobs: upsertJob(projection.jobs, {
        stepId,
        attempt: event.payload.attempt,
        status: event.payload.completion === "complete" ? "complete" : "failed",
        completion: event.payload.completion,
        requestPath: existingJob?.requestPath,
        receiptPath: existingJob?.receiptPath,
        ...(event.payload.verdict ? { verdict: event.payload.verdict } : {}),
        resultPath: event.payload.result_path,
      }),
      updatedAt: event.occurred_at,
    };
  },
  artifact_written: ({ projection, event }) => ({
    ...projection,
    artifacts: upsertArtifact(projection.artifacts, {
      artifactPath: event.payload.artifact_path,
      status: "complete",
      gate: "pending",
      producedBy: resolveStepId(projection, event.step_id, event.event_type),
      updatedAt: event.occurred_at,
    }),
    updatedAt: event.occurred_at,
  }),
  gate_passed: ({ projection, event }) => ({
    ...projection,
    artifacts: updateArtifactsForGate(
      projection.artifacts,
      event.payload.step_id,
      "pass",
      event.occurred_at,
    ),
    routes: upsertRoute(projection.routes, {
      stepId: event.payload.step_id,
      route: event.payload.route,
    }),
    updatedAt: event.occurred_at,
  }),
  gate_failed: ({ projection, event }) => ({
    ...projection,
    artifacts: updateArtifactsForGate(
      projection.artifacts,
      event.payload.step_id,
      "fail",
      event.occurred_at,
    ),
    routes: upsertRoute(projection.routes, {
      stepId: event.payload.step_id,
      route: event.payload.route,
    }),
    updatedAt: event.occurred_at,
  }),
  checkpoint_requested: ({ projection, event }) => {
    const stepId = resolveStepId(projection, event.step_id, event.event_type);
    const existingCheckpoint = findCheckpoint(
      projection.checkpoints,
      stepId,
      event.payload.attempt,
    );
    const isResolved = existingCheckpoint?.status === "resolved";

    return {
      ...projection,
      status: isResolved ? projection.status : "waiting_checkpoint",
      checkpoints: upsertCheckpoint(projection.checkpoints, {
        ...existingCheckpoint,
        stepId,
        attempt: event.payload.attempt,
        status: isResolved ? "resolved" : "waiting",
        requestPath: event.payload.request_path,
      }),
      updatedAt: event.occurred_at,
    };
  },
  checkpoint_resolved: ({ projection, event }) => {
    const stepId = resolveStepId(projection, event.step_id, event.event_type);
    const existingCheckpoint = findCheckpoint(
      projection.checkpoints,
      stepId,
      event.payload.attempt,
    );

    return {
      ...projection,
      status: "in_progress",
      checkpoints: upsertCheckpoint(projection.checkpoints, {
        ...existingCheckpoint,
        stepId,
        attempt: event.payload.attempt,
        status: "resolved",
        responsePath: event.payload.response_path,
        selection: event.payload.selection,
      }),
      updatedAt: event.occurred_at,
    };
  },
  run_completed: ({ projection, event }) => ({
    ...projection,
    status: event.payload.status,
    currentStep: undefined,
    terminalTarget: event.payload.terminal_target,
    updatedAt: event.occurred_at,
  }),
  run_aborted: ({ projection, event }) => ({
    ...projection,
    status: "aborted",
    currentStep: undefined,
    abortReason: event.payload.reason,
    updatedAt: event.payload.aborted_at,
  }),
});

function applyProjectLedgerEvent(
  input: ProjectLedgerEventHandlerInput<RuntimeEvent>,
): RuntimeProjection {
  switch (input.event.event_type) {
    case "run_started":
      return PROJECT_LEDGER_EVENT_HANDLERS.run_started({
        ...input,
        event: input.event,
      });
    case "step_started":
      return PROJECT_LEDGER_EVENT_HANDLERS.step_started({
        ...input,
        event: input.event,
      });
    case "dispatch_requested":
      return PROJECT_LEDGER_EVENT_HANDLERS.dispatch_requested({
        ...input,
        event: input.event,
      });
    case "dispatch_received":
      return PROJECT_LEDGER_EVENT_HANDLERS.dispatch_received({
        ...input,
        event: input.event,
      });
    case "job_completed":
      return PROJECT_LEDGER_EVENT_HANDLERS.job_completed({
        ...input,
        event: input.event,
      });
    case "artifact_written":
      return PROJECT_LEDGER_EVENT_HANDLERS.artifact_written({
        ...input,
        event: input.event,
      });
    case "gate_passed":
      return PROJECT_LEDGER_EVENT_HANDLERS.gate_passed({
        ...input,
        event: input.event,
      });
    case "gate_failed":
      return PROJECT_LEDGER_EVENT_HANDLERS.gate_failed({
        ...input,
        event: input.event,
      });
    case "checkpoint_requested":
      return PROJECT_LEDGER_EVENT_HANDLERS.checkpoint_requested({
        ...input,
        event: input.event,
      });
    case "checkpoint_resolved":
      return PROJECT_LEDGER_EVENT_HANDLERS.checkpoint_resolved({
        ...input,
        event: input.event,
      });
    case "run_completed":
      return PROJECT_LEDGER_EVENT_HANDLERS.run_completed({
        ...input,
        event: input.event,
      });
    case "run_aborted":
      return PROJECT_LEDGER_EVENT_HANDLERS.run_aborted({
        ...input,
        event: input.event,
      });
  }
}

export const projectLedger: ProjectLedger = ({ manifest, events }) =>
  events.reduce(
    (projection, event) =>
      applyProjectLedgerEvent({
        manifest,
        projection,
        event,
      }),
    initialProjection(manifest),
  );
