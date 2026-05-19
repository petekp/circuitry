import { describe, expect, it } from "vitest";

import { planRuntimeCommand } from "./plan-command.js";
import type {
  AbortReason,
  EntryModeId,
  GitHead,
  IsoTimestamp,
  ProjectRootPath,
  RuntimeFacts,
  RuntimeProjection,
  RuntimeRevision,
  RunId,
  RunRootPath,
} from "./types.js";

const runId = "run-001" as RunId;
const runRoot = "/tmp/project/.circuit/circuit-runs/run-001" as RunRootPath;
const projectRoot = "/tmp/project" as ProjectRootPath;
const expectedRevision = 3 as RuntimeRevision;
const plannedAt = "2026-04-17T00:00:00.000Z" as IsoTimestamp;
const facts: RuntimeFacts = {
  facts: [],
};

const projection: RuntimeProjection = {
  runId,
  circuitId: "test-circuit",
  manifestVersion: "2026-04-17",
  status: "in_progress",
  selectedEntryMode: "default" as EntryModeId,
  git: {
    headAtStart: "abc1234" as GitHead,
  },
  artifacts: [],
  jobs: [],
  checkpoints: [],
  routes: [],
};

describe("planRuntimeCommand", () => {
  it("plans abort-run as a decision-only run_aborted transition", () => {
    const command = {
      kind: "abort-run",
      ref: {
        runRoot,
      },
      projectRoot,
      reason: "operator requested stop" as AbortReason,
    } as const;

    const plan = planRuntimeCommand({
      command,
      projection,
      facts,
      expectedRevision,
      plannedAt,
    });

    expect(plan).toEqual({
      kind: "abort-run",
      command,
      expectedRevision,
      observationDrafts: [],
      decisionDrafts: [
        {
          event_type: "run_aborted",
          commitClass: "decision",
          idempotenceKey: "run:run-001|event:run_aborted",
          payload: {
            reason: "operator requested stop",
            aborted_at: plannedAt,
          },
        },
      ],
      materialization: {
        projection: {
          stateJson: "write",
          activeRunMarkdown: "write",
          reason: "execute",
        },
        continuity: {
          kind: "clear-current-run",
          projectRoot,
          runRoot,
          runId,
        },
      },
    });
  });

  it("plans terminal abort-run as a non-mutating materialization refresh", () => {
    const terminalProjection: RuntimeProjection = {
      ...projection,
      status: "completed",
    };

    const plan = planRuntimeCommand({
      command: {
        kind: "abort-run",
        ref: {
          runRoot,
        },
        projectRoot,
        reason: "operator requested stop" as AbortReason,
      },
      projection: terminalProjection,
      facts,
      expectedRevision,
      plannedAt,
    });

    expect(plan.decisionDrafts).toEqual([]);
    expect(plan.materialization).toEqual({
      projection: {
        stateJson: "skip",
        activeRunMarkdown: "skip",
        reason: "execute",
      },
      continuity: {
        kind: "none",
      },
    });
  });
});
