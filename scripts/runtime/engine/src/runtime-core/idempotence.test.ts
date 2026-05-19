import { describe, expect, it } from "vitest";

import {
  runtimeEventDraftNaturalKey,
  runtimeEventNaturalKey,
  withRuntimeEventDraftNaturalKey,
} from "./idempotence.js";
import type { RuntimeEventNaturalKeyContext } from "./idempotence.js";
import type {
  AbortReason,
  AttemptNumber,
  CheckpointKind,
  CheckpointSelection,
  EventId,
  ExchangeId,
  FailureReason,
  GitHead,
  IdempotenceKey,
  IsoTimestamp,
  ManifestSnapshotPath,
  RunId,
  RuntimeEvent,
  RuntimeEventDraft,
  RuntimeRouteTarget,
  SafeRelativeArtifactPath,
  SafeRelativeJsonPath,
  SafeRelativePath,
  SchemaId,
  StepId,
  WorkerVerdict,
} from "./types.js";

const runId = "run-001" as RunId;
const eventId = "evt-001" as EventId;
const occurredAt = "2026-04-17T00:00:00.000Z" as IsoTimestamp;
const stepId = "synthesis" as StepId;
const nextStepId = "review" as StepId;
const route = "pass" as RuntimeRouteTarget;
const attempt = 2 as AttemptNumber;
const placeholderKey = "placeholder" as IdempotenceKey;

function baseEvent<Event extends RuntimeEvent>(
  event: Omit<Event, "schema_version" | "event_id" | "occurred_at" | "run_id">,
): Event {
  return {
    schema_version: "1",
    event_id: eventId,
    occurred_at: occurredAt,
    run_id: runId,
    ...event,
  } as Event;
}

function draftFromEvent(event: RuntimeEvent): RuntimeEventDraft {
  switch (event.event_type) {
    case "run_started":
    case "step_started":
    case "gate_passed":
    case "gate_failed":
    case "run_completed":
    case "run_aborted":
      return {
        event_type: event.event_type,
        commitClass: "decision",
        step_id: event.step_id,
        attempt: event.attempt,
        idempotenceKey: placeholderKey,
        payload: event.payload,
      } as RuntimeEventDraft;
    case "dispatch_requested":
    case "dispatch_received":
    case "job_completed":
    case "artifact_written":
    case "checkpoint_requested":
    case "checkpoint_resolved":
      return {
        event_type: event.event_type,
        commitClass: "observation",
        step_id: event.step_id,
        attempt: event.attempt,
        idempotenceKey: placeholderKey,
        payload: event.payload,
      } as RuntimeEventDraft;
  }
}

describe("runtime event idempotence keys", () => {
  it("builds deterministic natural keys for every canonical event type", () => {
    const cases: Array<{
      readonly event: RuntimeEvent;
      readonly context?: RuntimeEventNaturalKeyContext;
      readonly expected: string;
    }> = [
      {
        event: baseEvent({
          event_type: "run_started",
          payload: {
            manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
            entry_mode: "default",
            head_at_start: "abcdef1" as GitHead,
          },
        }),
        expected: "run:run-001|event:run_started",
      },
      {
        event: baseEvent({
          event_type: "step_started",
          payload: { step_id: stepId },
        }),
        context: { stepStarted: "bootstrap" },
        expected: "run:run-001|event:step_started|step:synthesis|bootstrap",
      },
      {
        event: baseEvent({
          event_type: "dispatch_requested",
          step_id: stepId,
          attempt,
          payload: {
            request_path: "jobs/synthesis-2/request.json" as SafeRelativeJsonPath,
            protocol: "worker@v1",
            attempt,
          },
        }),
        expected:
          "run:run-001|step:synthesis|event:dispatch_requested|attempt:2|path:jobs/synthesis-2/request.json",
      },
      {
        event: baseEvent({
          event_type: "dispatch_received",
          step_id: stepId,
          attempt,
          payload: {
            receipt_path: "jobs/synthesis-2/receipt.json" as SafeRelativeJsonPath,
            exchange_id: "exchange-001" as ExchangeId,
            attempt,
          },
        }),
        expected:
          "run:run-001|step:synthesis|event:dispatch_received|attempt:2|path:jobs/synthesis-2/receipt.json",
      },
      {
        event: baseEvent({
          event_type: "job_completed",
          step_id: stepId,
          attempt,
          payload: {
            result_path: "jobs/synthesis-2/result.json" as SafeRelativeJsonPath,
            completion: "complete",
            attempt,
            verdict: "ready" as WorkerVerdict,
          },
        }),
        expected:
          "run:run-001|step:synthesis|event:job_completed|attempt:2|path:jobs/synthesis-2/result.json",
      },
      {
        event: baseEvent({
          event_type: "artifact_written",
          step_id: stepId,
          payload: {
            artifact_path: "artifacts/plan.md" as SafeRelativeArtifactPath,
            schema: "plan@v1" as SchemaId,
          },
        }),
        expected: "run:run-001|step:synthesis|event:artifact_written|path:artifacts/plan.md",
      },
      {
        event: baseEvent({
          event_type: "gate_passed",
          step_id: stepId,
          payload: {
            step_id: stepId,
            gate_kind: "schema_sections",
            route,
          },
        }),
        expected:
          "run:run-001|step:synthesis|event:gate_passed|gate:schema_sections|route:pass",
      },
      {
        event: baseEvent({
          event_type: "gate_failed",
          step_id: stepId,
          payload: {
            step_id: stepId,
            gate_kind: "schema_sections",
            failure_reason: "missing section" as FailureReason,
            route: "@escalate",
          },
        }),
        expected:
          "run:run-001|step:synthesis|event:gate_failed|gate:schema_sections|route:@escalate",
      },
      {
        event: baseEvent({
          event_type: "checkpoint_requested",
          step_id: stepId,
          attempt,
          payload: {
            request_path: "checkpoints/synthesis-2/request.json" as SafeRelativeJsonPath,
            checkpoint_kind: "review" as CheckpointKind,
            attempt,
          },
        }),
        expected:
          "run:run-001|step:synthesis|event:checkpoint_requested|attempt:2|path:checkpoints/synthesis-2/request.json",
      },
      {
        event: baseEvent({
          event_type: "checkpoint_resolved",
          step_id: stepId,
          attempt,
          payload: {
            response_path: "checkpoints/synthesis-2/response.json" as SafeRelativeJsonPath,
            selection: "continue" as CheckpointSelection,
            attempt,
          },
        }),
        expected:
          "run:run-001|step:synthesis|event:checkpoint_resolved|attempt:2|path:checkpoints/synthesis-2/response.json",
      },
      {
        event: baseEvent({
          event_type: "run_completed",
          payload: {
            status: "blocked",
            terminal_target: "@escalate",
            diagnostic_path: "diagnostics/escalation.md" as SafeRelativePath,
          },
        }),
        expected: "run:run-001|event:run_completed|target:@escalate",
      },
      {
        event: baseEvent({
          event_type: "run_aborted",
          payload: {
            reason: "operator requested stop" as AbortReason,
            aborted_at: occurredAt,
          },
        }),
        expected: "run:run-001|event:run_aborted",
      },
    ];

    expect(cases.map(({ event, context }) => runtimeEventNaturalKey(event, context))).toEqual(
      cases.map(({ expected }) => expected),
    );

    for (const { event, context } of cases) {
      const draft = draftFromEvent(event);
      const draftKey = runtimeEventDraftNaturalKey({ runId, draft, context });

      expect(draftKey).toBe(runtimeEventNaturalKey(event, context));
      expect(withRuntimeEventDraftNaturalKey({ runId, draft, context })).toEqual({
        ...draft,
        idempotenceKey: draftKey,
      });
    }
  });

  it("uses predecessor route context for routed step_started events", () => {
    const event = baseEvent({
      event_type: "step_started",
      payload: { step_id: nextStepId },
    });

    expect(
      runtimeEventNaturalKey(event, {
        stepStarted: "routed",
        predecessorStepId: stepId,
        route,
      }),
    ).toBe("run:run-001|event:step_started|from:synthesis|route:pass|step:review");
  });

  it("rejects step_started keys without explicit bootstrap or route context", () => {
    const event = baseEvent({
      event_type: "step_started",
      payload: { step_id: nextStepId },
    });

    expect(() => runtimeEventNaturalKey(event)).toThrow(
      "cannot build natural key for step_started: missing step start context",
    );
  });

  it("does not let append occurrence fields change the natural key", () => {
    const event = baseEvent({
      event_type: "dispatch_received",
      step_id: stepId,
      attempt,
      payload: {
        receipt_path: "jobs/synthesis-2/receipt.json" as SafeRelativeJsonPath,
        exchange_id: "exchange-001" as ExchangeId,
        attempt,
      },
    });
    const retriedAppend = {
      ...event,
      event_id: "evt-retry" as EventId,
      occurred_at: "2026-04-17T01:00:00.000Z" as IsoTimestamp,
      payload: {
        ...event.payload,
        exchange_id: "exchange-retry" as ExchangeId,
      },
    };

    expect(runtimeEventNaturalKey(retriedAppend)).toBe(runtimeEventNaturalKey(event));
  });

  it("uses explicit projection context when an event needs a resolved step id", () => {
    const event = baseEvent({
      event_type: "artifact_written",
      payload: {
        artifact_path: "artifacts/plan.md" as SafeRelativeArtifactPath,
      },
    });

    expect(runtimeEventNaturalKey(event, { stepId })).toBe(
      "run:run-001|step:synthesis|event:artifact_written|path:artifacts/plan.md",
    );
    expect(() => runtimeEventNaturalKey(event)).toThrow(
      "cannot build natural key for artifact_written: missing step id",
    );
  });
});
