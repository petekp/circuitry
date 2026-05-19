import { describe, expect, it } from "vitest";

import { inspectRuntimeView } from "./inspect-runtime.js";
import { createInMemoryRuntimeLedgerStore } from "./memory-ledger.js";
import type {
  EntryModeId,
  EventId,
  GitHead,
  IsoTimestamp,
  ManifestSnapshotPath,
  ManifestSchemaVersion,
  ProtocolId,
  RuntimeEvent,
  RuntimeFailure,
  RuntimeManifestSnapshot,
  RuntimeMessage,
  RunId,
  RunRootPath,
  SafeRelativeArtifactPath,
  StepId,
} from "./types.js";

const ref = {
  runRoot: "/tmp/circuit-runs/run-001" as RunRootPath,
};
const runId = "run-001" as RunId;
const stepId = "synthesis" as StepId;
const occurredAt = "2026-04-17T00:00:00.000Z" as IsoTimestamp;

const manifest: RuntimeManifestSnapshot = {
  schema_version: "2" as ManifestSchemaVersion,
  manifestPath: "circuit.manifest.yaml" as ManifestSnapshotPath,
  circuitId: "test-circuit",
  version: "2026-04-17",
  steps: [
    {
      id: stepId,
      title: "Synthesize" as RuntimeMessage,
      executor: "worker",
      kind: "dispatch",
      protocol: "test-protocol@v1" as ProtocolId,
      gate: {
        kind: "result_verdict",
        source: "jobs/synthesis/result.json",
        pass: ["ready"],
        reroute: [],
      },
    },
  ],
};

const events: readonly RuntimeEvent[] = [
  {
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
  },
  {
    schema_version: "1",
    event_id: "event-002" as EventId,
    event_type: "step_started",
    occurred_at: occurredAt,
    run_id: runId,
    payload: {
      step_id: stepId,
    },
  },
];

describe("inspectRuntimeView", () => {
  it("projects a runtime view from the manifest snapshot and event ledger", () => {
    const ledgerReader = createInMemoryRuntimeLedgerStore([
      {
        ref,
        events,
      },
    ]);

    const receipt = inspectRuntimeView({
      ref,
      deps: {
        manifestReader: {
          readManifestSnapshot(requestedRef) {
            expect(requestedRef).toBe(ref);
            return {
              ok: true,
              value: manifest,
            };
          },
        },
        ledgerReader,
      },
    });

    expect(receipt).toEqual({
      ref,
      projection: {
        runId,
        circuitId: "test-circuit",
        manifestVersion: "2026-04-17",
        status: "in_progress",
        currentStep: stepId,
        selectedEntryMode: "default",
        startedAt: occurredAt,
        updatedAt: occurredAt,
        git: {
          headAtStart: "abc1234",
        },
        artifacts: [],
        jobs: [],
        checkpoints: [],
        routes: [],
      },
      reason: "step synthesis is in progress",
      resumeStep: stepId,
    });
  });

  it("returns a precondition view failure without reading the ledger when the manifest is missing", () => {
    let ledgerReads = 0;
    const failure: RuntimeFailure<"missing_observed_file"> = {
      kind: "missing_observed_file",
      message: "manifest snapshot missing" as RuntimeMessage,
      retryable: false,
    };

    const receipt = inspectRuntimeView({
      ref,
      deps: {
        manifestReader: {
          readManifestSnapshot() {
            return {
              ok: false,
              failure,
            };
          },
        },
        ledgerReader: {
          readEvents() {
            ledgerReads += 1;
            return {
              ok: true,
              value: {
                ref,
                revision: 0,
                events: [],
              },
            };
          },
        },
      },
    });

    expect(ledgerReads).toBe(0);
    expect(receipt).toEqual({
      kind: "view_failure",
      failure: {
        kind: "precondition_failed",
        message: "manifest snapshot missing",
        retryable: false,
        diagnostics: {
          source: "store",
          details: {},
        },
      },
    });
  });

  it("returns corrupt ledger failures without rewriting them", () => {
    const failure: RuntimeFailure<"runtime_corrupt"> = {
      kind: "runtime_corrupt",
      message: "events.ndjson contains invalid json" as RuntimeMessage,
      retryable: false,
      diagnostics: {
        source: "store",
        details: {
          line: 3,
        },
      },
    };

    const receipt = inspectRuntimeView({
      ref,
      deps: {
        manifestReader: {
          readManifestSnapshot() {
            return {
              ok: true,
              value: manifest,
            };
          },
        },
        ledgerReader: {
          readEvents() {
            return {
              ok: false,
              failure,
            };
          },
        },
      },
    });

    expect(receipt).toEqual({
      kind: "view_failure",
      failure,
    });
  });

  it("reports projection replay exceptions as corrupt runtime views", () => {
    const receipt = inspectRuntimeView({
      ref,
      deps: {
        manifestReader: {
          readManifestSnapshot() {
            return {
              ok: true,
              value: manifest,
            };
          },
        },
        ledgerReader: createInMemoryRuntimeLedgerStore([
          {
            ref,
            events: [
              {
                schema_version: "1",
                event_id: "event-003" as EventId,
                event_type: "artifact_written",
                occurred_at: occurredAt,
                run_id: runId,
                payload: {
                  artifact_path: "artifacts/plan.md" as SafeRelativeArtifactPath,
                },
              },
            ],
          },
        ]),
      },
    });

    expect(receipt).toEqual({
      kind: "view_failure",
      failure: {
        kind: "runtime_corrupt",
        message:
          "runtime ledger replay failed: projectLedger: artifact_written event has no step_id and no currentStep",
        retryable: false,
        diagnostics: {
          source: "store",
          details: {},
        },
      },
    });
  });
});
