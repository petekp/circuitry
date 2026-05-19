import { describe, expect, it } from "vitest";

import {
  PROJECT_LEDGER_EVENT_TYPES,
  defineProjectLedgerEventHandlers,
  projectLedger,
} from "./project-ledger.js";
import { RUNTIME_EVENT_TYPES } from "./types.js";
import type {
  AbortReason,
  AttemptNumber,
  CheckpointKind,
  CheckpointSelection,
  EntryModeId,
  EventId,
  ExchangeId,
  FailureReason,
  GitHead,
  IsoTimestamp,
  ManifestSnapshotPath,
  ProtocolId,
  RuntimeEvent,
  RuntimeGoal,
  RuntimeManifestSnapshot,
  RuntimeMessage,
  RuntimeRouteTarget,
  SafeRelativeArtifactPath,
  SafeRelativeJsonPath,
  SafeRelativePath,
  StepId,
  WorkerCompletion,
  WorkerVerdict,
} from "./types.js";

const manifest: RuntimeManifestSnapshot = {
  schema_version: "2",
  manifestPath: "circuit.manifest.yaml" as ManifestSnapshotPath,
  circuitId: "test-circuit",
  version: "2026-04-17",
  steps: [
    {
      id: "step-one" as StepId,
      title: "Step One" as RuntimeMessage,
      executor: "orchestrator",
      kind: "synthesis",
      gate: {
        kind: "schema_sections",
        source: "artifacts/plan.md",
        required: ["Plan"] as RuntimeMessage[],
      },
    },
  ],
};

const occurredAt = "2026-04-17T00:00:00.000Z" as IsoTimestamp;
const laterOccurredAt = "2026-04-17T00:01:00.000Z" as IsoTimestamp;
const gateOccurredAt = "2026-04-17T00:02:00.000Z" as IsoTimestamp;
const terminalOccurredAt = "2026-04-17T00:03:00.000Z" as IsoTimestamp;
const abortOccurredAt = "2026-04-17T00:04:00.000Z" as IsoTimestamp;

function event<Event extends RuntimeEvent>(
  index: number,
  value: Omit<Event, "schema_version" | "event_id" | "occurred_at" | "run_id" | "circuit_id">,
  occurredAtOverride = occurredAt,
): Event {
  return {
    schema_version: "1",
    event_id: `event-${index}` as EventId,
    occurred_at: occurredAtOverride,
    run_id: "run-001",
    circuit_id: "test-circuit",
    ...value,
  } as Event;
}

describe("project ledger exhaustiveness harness", () => {
  it("requires a projection handler slot for every runtime event type", () => {
    expect([...PROJECT_LEDGER_EVENT_TYPES].sort()).toEqual([...RUNTIME_EVENT_TYPES].sort());

    const handlers = defineProjectLedgerEventHandlers({
      run_started: ({ projection }) => projection,
      step_started: ({ projection }) => projection,
      dispatch_requested: ({ projection }) => projection,
      dispatch_received: ({ projection }) => projection,
      job_completed: ({ projection }) => projection,
      artifact_written: ({ projection }) => projection,
      gate_passed: ({ projection }) => projection,
      gate_failed: ({ projection }) => projection,
      checkpoint_requested: ({ projection }) => projection,
      checkpoint_resolved: ({ projection }) => projection,
      run_completed: ({ projection }) => projection,
      run_aborted: ({ projection }) => projection,
    });

    expect(Object.keys(handlers).sort()).toEqual([...RUNTIME_EVENT_TYPES].sort());
  });

  it("projects run_started and initial step_started into runtime projection", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
            goal: "Ship a hardened runtime core" as RuntimeGoal,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
      ],
    });

    expect(projection).toMatchObject({
      runId: "run-001",
      circuitId: "test-circuit",
      manifestVersion: "2026-04-17",
      status: "in_progress",
      currentStep: "step-one",
      selectedEntryMode: "default",
      goal: "Ship a hardened runtime core",
      startedAt: occurredAt,
      updatedAt: occurredAt,
      git: {
        headAtStart: "abc1234",
      },
      artifacts: [],
      jobs: [],
      checkpoints: [],
      routes: [],
    });
  });

  it("projects artifact_written as a completed artifact with pending gate", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(3, {
          event_type: "artifact_written",
          payload: {
            artifact_path: "artifacts/step-one-output.md" as SafeRelativeArtifactPath,
          },
        }),
      ],
    });

    expect(projection.artifacts).toEqual([
      {
        artifactPath: "artifacts/step-one-output.md",
        status: "complete",
        gate: "pending",
        producedBy: "step-one",
        updatedAt: occurredAt,
      },
    ]);
    expect(projection.status).toBe("in_progress");
    expect(projection.currentStep).toBe("step-one");
    expect(projection.updatedAt).toBe(occurredAt);
  });

  it("upserts repeated artifact_written events by artifact path", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(3, {
          event_type: "artifact_written",
          payload: {
            artifact_path: "artifacts/step-one-output.md" as SafeRelativeArtifactPath,
          },
        }),
        event(
          4,
          {
            event_type: "artifact_written",
            step_id: "step-one" as StepId,
            payload: {
              artifact_path: "artifacts/step-one-output.md" as SafeRelativeArtifactPath,
            },
          },
          laterOccurredAt,
        ),
      ],
    });

    expect(projection.artifacts).toEqual([
      {
        artifactPath: "artifacts/step-one-output.md",
        status: "complete",
        gate: "pending",
        producedBy: "step-one",
        updatedAt: laterOccurredAt,
      },
    ]);
    expect(projection.updatedAt).toBe(laterOccurredAt);
  });

  it("projects gate_passed by marking produced artifacts and recording route", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(3, {
          event_type: "artifact_written",
          step_id: "step-one" as StepId,
          payload: {
            artifact_path: "artifacts/step-one-output.md" as SafeRelativeArtifactPath,
          },
        }),
        event(
          4,
          {
            event_type: "gate_passed",
            step_id: "step-one" as StepId,
            payload: {
              step_id: "step-one" as StepId,
              gate_kind: "all_outputs_present",
              route: "step-two" as RuntimeRouteTarget,
            },
          },
          gateOccurredAt,
        ),
      ],
    });

    expect(projection.artifacts).toEqual([
      {
        artifactPath: "artifacts/step-one-output.md",
        status: "complete",
        gate: "pass",
        producedBy: "step-one",
        updatedAt: gateOccurredAt,
      },
    ]);
    expect(projection.routes).toEqual([
      {
        stepId: "step-one",
        route: "step-two",
      },
    ]);
    expect(projection.currentStep).toBe("step-one");
    expect(projection.status).toBe("in_progress");
    expect(projection.updatedAt).toBe(gateOccurredAt);
  });

  it("projects routed gate_failed by marking produced artifacts and recording route", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(3, {
          event_type: "artifact_written",
          step_id: "step-one" as StepId,
          payload: {
            artifact_path: "artifacts/step-one-output.md" as SafeRelativeArtifactPath,
          },
        }),
        event(
          4,
          {
            event_type: "gate_failed",
            step_id: "step-one" as StepId,
            payload: {
              step_id: "step-one" as StepId,
              gate_kind: "schema_sections",
              failure_reason: "missing section" as FailureReason,
              route: "@escalate",
            },
          },
          gateOccurredAt,
        ),
      ],
    });

    expect(projection.artifacts).toEqual([
      {
        artifactPath: "artifacts/step-one-output.md",
        status: "complete",
        gate: "fail",
        producedBy: "step-one",
        updatedAt: gateOccurredAt,
      },
    ]);
    expect(projection.routes).toEqual([
      {
        stepId: "step-one",
        route: "@escalate",
      },
    ]);
    expect(projection.currentStep).toBe("step-one");
    expect(projection.status).toBe("in_progress");
    expect(projection.updatedAt).toBe(gateOccurredAt);
  });

  it("upserts repeated gate routes by step id", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "gate_passed",
            step_id: "step-one" as StepId,
            payload: {
              step_id: "step-one" as StepId,
              gate_kind: "schema_sections",
              route: "step-two" as RuntimeRouteTarget,
            },
          },
          gateOccurredAt,
        ),
        event(
          4,
          {
            event_type: "gate_failed",
            step_id: "step-one" as StepId,
            payload: {
              step_id: "step-one" as StepId,
              gate_kind: "schema_sections",
              failure_reason: "later route won" as FailureReason,
              route: "@escalate",
            },
          },
          laterOccurredAt,
        ),
      ],
    });

    expect(projection.routes).toEqual([
      {
        stepId: "step-one",
        route: "@escalate",
      },
    ]);
    expect(projection.updatedAt).toBe(laterOccurredAt);
  });

  it("projects dispatch_requested as requested job and waiting worker state", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/001/request.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("waiting_worker");
    expect(projection.currentStep).toBe("step-one");
    expect(projection.jobs).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "requested",
        requestPath: "jobs/step-one/001/request.json",
      },
    ]);
    expect(projection.updatedAt).toBe(laterOccurredAt);
  });

  it("projects dispatch_received as running job and waiting worker state", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/001/request.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
        event(
          4,
          {
            event_type: "dispatch_received",
            step_id: "step-one" as StepId,
            payload: {
              receipt_path: "jobs/step-one/001/receipt.json" as SafeRelativeJsonPath,
              exchange_id: "exchange-001" as ExchangeId,
              attempt: 1 as AttemptNumber,
            },
          },
          gateOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("waiting_worker");
    expect(projection.currentStep).toBe("step-one");
    expect(projection.jobs).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "running",
        requestPath: "jobs/step-one/001/request.json",
        receiptPath: "jobs/step-one/001/receipt.json",
      },
    ]);
    expect(projection.updatedAt).toBe(gateOccurredAt);
  });

  it("does not regress running jobs when dispatch_requested repeats", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/001/request.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
        event(
          4,
          {
            event_type: "dispatch_received",
            step_id: "step-one" as StepId,
            payload: {
              receipt_path: "jobs/step-one/001/receipt.json" as SafeRelativeJsonPath,
              exchange_id: "exchange-001" as ExchangeId,
              attempt: 1 as AttemptNumber,
            },
          },
          gateOccurredAt,
        ),
        event(
          5,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/001/request-retry.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 1 as AttemptNumber,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("waiting_worker");
    expect(projection.jobs).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "running",
        requestPath: "jobs/step-one/001/request-retry.json",
        receiptPath: "jobs/step-one/001/receipt.json",
      },
    ]);
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("projects completed jobs without routing by itself", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/001/request.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
        event(
          4,
          {
            event_type: "dispatch_received",
            step_id: "step-one" as StepId,
            payload: {
              receipt_path: "jobs/step-one/001/receipt.json" as SafeRelativeJsonPath,
              exchange_id: "exchange-001" as ExchangeId,
              attempt: 1 as AttemptNumber,
            },
          },
          gateOccurredAt,
        ),
        event(
          5,
          {
            event_type: "job_completed",
            step_id: "step-one" as StepId,
            payload: {
              result_path: "jobs/step-one/001/result.json" as SafeRelativeJsonPath,
              completion: "complete" as WorkerCompletion,
              attempt: 1 as AttemptNumber,
              verdict: "clean" as WorkerVerdict,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("in_progress");
    expect(projection.currentStep).toBe("step-one");
    expect(projection.jobs).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "complete",
        completion: "complete",
        verdict: "clean",
        requestPath: "jobs/step-one/001/request.json",
        receiptPath: "jobs/step-one/001/receipt.json",
        resultPath: "jobs/step-one/001/result.json",
      },
    ]);
    expect(projection.routes).toEqual([]);
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("projects partial jobs as failed while preserving completion", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "job_completed",
            step_id: "step-one" as StepId,
            payload: {
              result_path: "jobs/step-one/001/result.json" as SafeRelativeJsonPath,
              completion: "partial" as WorkerCompletion,
              attempt: 1 as AttemptNumber,
            },
          },
          gateOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("in_progress");
    expect(projection.jobs).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "failed",
        completion: "partial",
        resultPath: "jobs/step-one/001/result.json",
      },
    ]);
    expect(projection.routes).toEqual([]);
    expect(projection.updatedAt).toBe(gateOccurredAt);
  });

  it("clears stale verdict when repeated job_completed has no verdict", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "job_completed",
            step_id: "step-one" as StepId,
            payload: {
              result_path: "jobs/step-one/001/result.json" as SafeRelativeJsonPath,
              completion: "complete" as WorkerCompletion,
              attempt: 1 as AttemptNumber,
              verdict: "clean" as WorkerVerdict,
            },
          },
          gateOccurredAt,
        ),
        event(
          4,
          {
            event_type: "job_completed",
            step_id: "step-one" as StepId,
            payload: {
              result_path: "jobs/step-one/001/result-retry.json" as SafeRelativeJsonPath,
              completion: "partial" as WorkerCompletion,
              attempt: 1 as AttemptNumber,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.jobs).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "failed",
        completion: "partial",
        resultPath: "jobs/step-one/001/result-retry.json",
      },
    ]);
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("records late dispatch_received without regressing completed jobs", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/001/request.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
        event(
          4,
          {
            event_type: "job_completed",
            step_id: "step-one" as StepId,
            payload: {
              result_path: "jobs/step-one/001/result.json" as SafeRelativeJsonPath,
              completion: "complete" as WorkerCompletion,
              attempt: 1 as AttemptNumber,
              verdict: "clean" as WorkerVerdict,
            },
          },
          gateOccurredAt,
        ),
        event(
          5,
          {
            event_type: "dispatch_received",
            step_id: "step-one" as StepId,
            payload: {
              receipt_path: "jobs/step-one/001/receipt.json" as SafeRelativeJsonPath,
              exchange_id: "exchange-001" as ExchangeId,
              attempt: 1 as AttemptNumber,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("in_progress");
    expect(projection.jobs).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "complete",
        completion: "complete",
        verdict: "clean",
        requestPath: "jobs/step-one/001/request.json",
        receiptPath: "jobs/step-one/001/receipt.json",
        resultPath: "jobs/step-one/001/result.json",
      },
    ]);
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("does not regress completed jobs when dispatch_requested repeats", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/001/request.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
        event(
          4,
          {
            event_type: "job_completed",
            step_id: "step-one" as StepId,
            payload: {
              result_path: "jobs/step-one/001/result.json" as SafeRelativeJsonPath,
              completion: "complete" as WorkerCompletion,
              attempt: 1 as AttemptNumber,
              verdict: "clean" as WorkerVerdict,
            },
          },
          gateOccurredAt,
        ),
        event(
          5,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/001/request-retry.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 1 as AttemptNumber,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("in_progress");
    expect(projection.jobs).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "complete",
        completion: "complete",
        verdict: "clean",
        requestPath: "jobs/step-one/001/request-retry.json",
        resultPath: "jobs/step-one/001/result.json",
      },
    ]);
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("keeps dispatch attempts as separate job rows", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/001/request.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
        event(
          4,
          {
            event_type: "job_completed",
            step_id: "step-one" as StepId,
            payload: {
              result_path: "jobs/step-one/001/result.json" as SafeRelativeJsonPath,
              completion: "partial" as WorkerCompletion,
              attempt: 1 as AttemptNumber,
            },
          },
          gateOccurredAt,
        ),
        event(
          5,
          {
            event_type: "dispatch_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "jobs/step-one/002/request.json" as SafeRelativeJsonPath,
              protocol: "test-protocol@v1" as ProtocolId,
              attempt: 2 as AttemptNumber,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("waiting_worker");
    expect(projection.jobs).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "failed",
        completion: "partial",
        requestPath: "jobs/step-one/001/request.json",
        resultPath: "jobs/step-one/001/result.json",
      },
      {
        stepId: "step-one",
        attempt: 2,
        status: "requested",
        requestPath: "jobs/step-one/002/request.json",
      },
    ]);
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("projects checkpoint_requested as waiting checkpoint state", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "checkpoint_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "checkpoints/step-one/request.json" as SafeRelativeJsonPath,
              checkpoint_kind: "approval" as CheckpointKind,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("waiting_checkpoint");
    expect(projection.currentStep).toBe("step-one");
    expect(projection.checkpoints).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "waiting",
        requestPath: "checkpoints/step-one/request.json",
      },
    ]);
    expect(projection.updatedAt).toBe(laterOccurredAt);
  });

  it("projects checkpoint_resolved without routing by itself", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "checkpoint_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "checkpoints/step-one/request.json" as SafeRelativeJsonPath,
              checkpoint_kind: "approval" as CheckpointKind,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
        event(
          4,
          {
            event_type: "checkpoint_resolved",
            step_id: "step-one" as StepId,
            payload: {
              response_path: "checkpoints/step-one/response.json" as SafeRelativeJsonPath,
              selection: "continue" as CheckpointSelection,
              attempt: 1 as AttemptNumber,
            },
          },
          gateOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("in_progress");
    expect(projection.currentStep).toBe("step-one");
    expect(projection.checkpoints).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "resolved",
        requestPath: "checkpoints/step-one/request.json",
        responsePath: "checkpoints/step-one/response.json",
        selection: "continue",
      },
    ]);
    expect(projection.routes).toEqual([]);
    expect(projection.updatedAt).toBe(gateOccurredAt);
  });

  it("does not regress resolved checkpoints when checkpoint_requested repeats", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "checkpoint_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "checkpoints/step-one/request.json" as SafeRelativeJsonPath,
              checkpoint_kind: "approval" as CheckpointKind,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
        event(
          4,
          {
            event_type: "checkpoint_resolved",
            step_id: "step-one" as StepId,
            payload: {
              response_path: "checkpoints/step-one/response.json" as SafeRelativeJsonPath,
              selection: "continue" as CheckpointSelection,
              attempt: 1 as AttemptNumber,
            },
          },
          gateOccurredAt,
        ),
        event(
          5,
          {
            event_type: "checkpoint_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "checkpoints/step-one/request-retry.json" as SafeRelativeJsonPath,
              checkpoint_kind: "approval" as CheckpointKind,
              attempt: 1 as AttemptNumber,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("in_progress");
    expect(projection.checkpoints).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "resolved",
        requestPath: "checkpoints/step-one/request-retry.json",
        responsePath: "checkpoints/step-one/response.json",
        selection: "continue",
      },
    ]);
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("keeps checkpoint attempts as separate checkpoint rows", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "checkpoint_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "checkpoints/step-one/001/request.json" as SafeRelativeJsonPath,
              checkpoint_kind: "approval" as CheckpointKind,
              attempt: 1 as AttemptNumber,
            },
          },
          laterOccurredAt,
        ),
        event(
          4,
          {
            event_type: "checkpoint_resolved",
            step_id: "step-one" as StepId,
            payload: {
              response_path: "checkpoints/step-one/001/response.json" as SafeRelativeJsonPath,
              selection: "revise" as CheckpointSelection,
              attempt: 1 as AttemptNumber,
            },
          },
          gateOccurredAt,
        ),
        event(
          5,
          {
            event_type: "checkpoint_requested",
            step_id: "step-one" as StepId,
            payload: {
              request_path: "checkpoints/step-one/002/request.json" as SafeRelativeJsonPath,
              checkpoint_kind: "approval" as CheckpointKind,
              attempt: 2 as AttemptNumber,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("waiting_checkpoint");
    expect(projection.checkpoints).toEqual([
      {
        stepId: "step-one",
        attempt: 1,
        status: "resolved",
        requestPath: "checkpoints/step-one/001/request.json",
        responsePath: "checkpoints/step-one/001/response.json",
        selection: "revise",
      },
      {
        stepId: "step-one",
        attempt: 2,
        status: "waiting",
        requestPath: "checkpoints/step-one/002/request.json",
      },
    ]);
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("projects run_completed as terminal state and clears current step", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "run_completed",
            payload: {
              status: "completed",
              terminal_target: "@complete",
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("completed");
    expect(projection.terminalTarget).toBe("@complete");
    expect(projection.currentStep).toBeUndefined();
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("projects escalated run_completed payloads as blocked terminal state", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(
          2,
          {
            event_type: "run_completed",
            payload: {
              status: "blocked",
              terminal_target: "@escalate",
              diagnostic_path: "diagnostics/escalation.md" as SafeRelativePath,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("blocked");
    expect(projection.terminalTarget).toBe("@escalate");
    expect(projection.updatedAt).toBe(terminalOccurredAt);
  });

  it("projects run_aborted as aborted state and clears current step", () => {
    const projection = projectLedger({
      manifest,
      events: [
        event(1, {
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default" as EntryModeId,
            head_at_start: "abc1234" as GitHead,
          },
        }),
        event(2, {
          event_type: "step_started",
          step_id: "step-one" as StepId,
          payload: {
            step_id: "step-one" as StepId,
          },
        }),
        event(
          3,
          {
            event_type: "run_aborted",
            payload: {
              reason: "operator cancelled run" as AbortReason,
              aborted_at: abortOccurredAt,
            },
          },
          terminalOccurredAt,
        ),
      ],
    });

    expect(projection.status).toBe("aborted");
    expect(projection.currentStep).toBeUndefined();
    expect(projection.abortReason).toBe("operator cancelled run");
    expect(projection.updatedAt).toBe(abortOccurredAt);
  });
});
