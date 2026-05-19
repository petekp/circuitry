import { describe, expect, it } from "vitest";

import { commitLedgerPlan } from "./commit-ledger.js";
import type {
  CommitLedgerDeps,
  RuntimeAppendRequest,
} from "./ports.js";
import type {
  AttemptNumber,
  CircuitId,
  EventId,
  GitHead,
  IdempotenceKey,
  IsoTimestamp,
  LedgerAppendReceipt,
  ManifestSnapshotPath,
  ObservationCommitBatch,
  ProtocolId,
  RuntimeFailure,
  RuntimeMessage,
  RuntimeRevision,
  RunId,
  RunRootPath,
  SafeRelativeJsonPath,
  StepId,
} from "./types.js";

const ref = {
  runRoot: "/tmp/circuit-runs/run-001" as RunRootPath,
};
const runId = "run-001" as RunId;
const circuitId = "test-circuit";
const expectedRevision = 7 as RuntimeRevision;
const occurredAt = "2026-04-17T00:00:00.000Z" as IsoTimestamp;
const stepId = "step-one" as StepId;
const attempt = 1 as AttemptNumber;
const idempotenceKey = "logical-key" as IdempotenceKey;

function successfulDeps(eventIds: readonly EventId[]): {
  readonly deps: CommitLedgerDeps;
  readonly appended: RuntimeAppendRequest[];
} {
  const appended: RuntimeAppendRequest[] = [];
  let idIndex = 0;

  return {
    appended,
    deps: {
      appender: {
        appendEvents(request) {
          appended.push(request);

          return {
            ok: true,
            value: {
              expectedRevision: request.expectedRevision,
              finalRevision: 8 as RuntimeRevision,
              appendedEvents: request.events,
            },
          };
        },
      },
      clock: {
        now() {
          return occurredAt;
        },
      },
      ids: {
        newEventId() {
          const eventId = eventIds[idIndex];
          idIndex += 1;
          return eventId;
        },
      },
    },
  };
}

describe("commitLedgerPlan", () => {
  it("materializes observation drafts and appends them as one atomic batch", () => {
    const { deps, appended } = successfulDeps(["event-1" as EventId]);
    const batch: ObservationCommitBatch = {
      commitClass: "observation",
      expectedRevision,
      drafts: [
        {
          event_type: "dispatch_requested",
          commitClass: "observation",
          step_id: stepId,
          attempt,
          idempotenceKey,
          payload: {
            request_path: "jobs/step-one/001/request.json" as SafeRelativeJsonPath,
            protocol: "test-protocol@v1" as ProtocolId,
            attempt,
          },
        },
      ],
    };

    const result = commitLedgerPlan({
      ref,
      runId,
      circuitId: circuitId as CircuitId,
      batch,
      deps,
    });

    expect(result.ok).toBe(true);
    expect(appended).toEqual([
      {
        ref,
        commitClass: "observation",
        expectedRevision,
        events: [
          {
            schema_version: "1",
            event_id: "event-1",
            event_type: "dispatch_requested",
            occurred_at: occurredAt,
            run_id: runId,
            circuit_id: circuitId,
            step_id: stepId,
            attempt,
            payload: {
              request_path: "jobs/step-one/001/request.json",
              protocol: "test-protocol@v1",
              attempt,
            },
          },
        ],
      },
    ]);
    expect(result.ok && result.value.appendedEvents).toEqual(appended[0]?.events);
    expect("idempotenceKey" in appended[0].events[0]).toBe(false);
    expect("commitClass" in appended[0].events[0]).toBe(false);
  });

  it("materializes decision drafts with distinct event ids in the same batch", () => {
    const { deps, appended } = successfulDeps([
      "event-1" as EventId,
      "event-2" as EventId,
    ]);

    const result = commitLedgerPlan({
      ref,
      runId,
      circuitId: circuitId as CircuitId,
      batch: {
        commitClass: "decision",
        expectedRevision,
        drafts: [
          {
            event_type: "run_started",
            commitClass: "decision",
            idempotenceKey,
            payload: {
              manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
              entry_mode: "default",
              head_at_start: "abc1234" as GitHead,
            },
          },
          {
            event_type: "step_started",
            commitClass: "decision",
            idempotenceKey,
            payload: {
              step_id: stepId,
            },
          },
        ],
      },
      deps,
    });

    expect(result.ok).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0].commitClass).toBe("decision");
    expect(appended[0].events.map((event) => event.event_id)).toEqual([
      "event-1",
      "event-2",
    ]);
    expect(appended[0].events.map((event) => event.event_type)).toEqual([
      "run_started",
      "step_started",
    ]);
  });

  it("returns append failures without rewriting the receipt", () => {
    const failure: RuntimeFailure<"expected_revision_mismatch"> = {
      kind: "expected_revision_mismatch",
      message: "ledger changed" as RuntimeMessage,
      retryable: true,
    };
    const appended: RuntimeAppendRequest[] = [];
    const deps: CommitLedgerDeps = {
      appender: {
        appendEvents(request) {
          appended.push(request);

          return {
            ok: false,
            failure,
          };
        },
      },
      clock: {
        now() {
          return occurredAt;
        },
      },
      ids: {
        newEventId() {
          return "event-1" as EventId;
        },
      },
    };

    const result = commitLedgerPlan({
      ref,
      runId,
      batch: {
        commitClass: "observation",
        expectedRevision,
        drafts: [],
      },
      deps,
    });

    expect(appended).toHaveLength(1);
    expect(result).toEqual({
      ok: false,
      failure,
    });
  });

  it("rejects schema-invalid stamped events before append", () => {
    const appended: RuntimeAppendRequest[] = [];
    const deps: CommitLedgerDeps = {
      appender: {
        appendEvents(request) {
          appended.push(request);

          return {
            ok: true,
            value: {
              expectedRevision: request.expectedRevision,
              finalRevision: 8 as RuntimeRevision,
              appendedEvents: request.events,
            },
          };
        },
      },
      clock: {
        now() {
          return occurredAt;
        },
      },
      ids: {
        newEventId() {
          return "event-1" as EventId;
        },
      },
    };

    const result = commitLedgerPlan({
      ref,
      runId,
      batch: {
        commitClass: "observation",
        expectedRevision,
        drafts: [
          {
            event_type: "dispatch_requested",
            commitClass: "observation",
            step_id: stepId,
            attempt,
            idempotenceKey,
            payload: {
              request_path: "jobs/step-one/001/request.json" as SafeRelativeJsonPath,
              protocol: "invalid-protocol" as ProtocolId,
              attempt,
            },
          },
        ],
      },
      deps,
    });

    expect(appended).toEqual([]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.kind).toBe("runtime_corrupt");
    expect(!result.ok && result.failure.retryable).toBe(false);
    expect(!result.ok && result.failure.diagnostics?.source).toBe("schema");
  });
});
