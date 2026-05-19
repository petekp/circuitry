import { describe, expect, it } from "vitest";

import { createInMemoryRuntimeLedgerStore } from "./memory-ledger.js";
import type {
  EntryModeId,
  EventId,
  GitHead,
  IsoTimestamp,
  ManifestSnapshotPath,
  RuntimeEvent,
  RuntimeRevision,
  RunId,
  RunRootPath,
  StepId,
} from "./types.js";

const ref = {
  runRoot: "/tmp/circuit-runs/run-001" as RunRootPath,
};
const otherRef = {
  runRoot: "/tmp/circuit-runs/run-002" as RunRootPath,
};
const runId = "run-001" as RunId;
const occurredAt = "2026-04-17T00:00:00.000Z" as IsoTimestamp;

const runStarted: RuntimeEvent = {
  schema_version: "1",
  event_id: "event-001" as EventId,
  event_type: "run_started",
  occurred_at: occurredAt,
  run_id: runId,
  payload: {
    manifest_path: "circuit.manifest.yaml" as ManifestSnapshotPath,
    entry_mode: "default" as EntryModeId,
    head_at_start: "abc1234" as GitHead,
  },
};

const stepStarted: RuntimeEvent = {
  schema_version: "1",
  event_id: "event-002" as EventId,
  event_type: "step_started",
  occurred_at: occurredAt,
  run_id: runId,
  payload: {
    step_id: "synthesis" as StepId,
  },
};

describe("createInMemoryRuntimeLedgerStore", () => {
  it("reads an empty ledger for unseen run refs", () => {
    const store = createInMemoryRuntimeLedgerStore();

    expect(store.readEvents(ref)).toEqual({
      ok: true,
      value: {
        ref,
        revision: 0 as RuntimeRevision,
        events: [],
      },
    });
  });

  it("appends one atomic batch at the expected revision", () => {
    const store = createInMemoryRuntimeLedgerStore();

    const receipt = store.appendEvents({
      ref,
      commitClass: "decision",
      expectedRevision: 0 as RuntimeRevision,
      events: [runStarted, stepStarted],
    });

    expect(receipt).toEqual({
      ok: true,
      value: {
        expectedRevision: 0,
        finalRevision: 2,
        appendedEvents: [runStarted, stepStarted],
      },
    });
    expect(store.readEvents(ref)).toEqual({
      ok: true,
      value: {
        ref,
        revision: 2,
        events: [runStarted, stepStarted],
      },
    });
  });

  it("rejects stale expected revisions without changing the ledger", () => {
    const store = createInMemoryRuntimeLedgerStore([
      {
        ref,
        events: [runStarted],
      },
    ]);

    const receipt = store.appendEvents({
      ref,
      commitClass: "decision",
      expectedRevision: 0 as RuntimeRevision,
      events: [stepStarted],
    });

    expect(receipt.ok).toBe(false);
    expect(!receipt.ok && receipt.failure.kind).toBe("expected_revision_mismatch");
    expect(!receipt.ok && receipt.failure.retryable).toBe(true);
    expect(!receipt.ok && receipt.failure.diagnostics?.source).toBe("store");
    expect(store.readEvents(ref)).toEqual({
      ok: true,
      value: {
        ref,
        revision: 1,
        events: [runStarted],
      },
    });
  });

  it("keeps independent run refs isolated", () => {
    const store = createInMemoryRuntimeLedgerStore([
      {
        ref,
        events: [runStarted],
      },
    ]);

    const receipt = store.appendEvents({
      ref: otherRef,
      commitClass: "decision",
      expectedRevision: 0 as RuntimeRevision,
      events: [stepStarted],
    });

    expect(receipt.ok).toBe(true);
    expect(store.readEvents(ref).ok && store.readEvents(ref).value.events).toEqual([
      runStarted,
    ]);
    expect(store.readEvents(otherRef).ok && store.readEvents(otherRef).value.events).toEqual([
      stepStarted,
    ]);
  });
});
