import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  composeTransitionLine,
  silentAnnouncer,
  stderrAnnouncer,
  terminalLabelForStatus,
} from "./announcer.js";
import { bootstrapRun } from "./bootstrap.js";
import {
  loadBuildManifest,
  makeTempProject,
  writeManifestFile,
} from "./outer-engine-test-utils.js";

describe("composeTransitionLine", () => {
  it("renders bootstrap line", () => {
    expect(
      composeTransitionLine({
        kind: "bootstrap",
        stepTitle: "Frame",
        workflowId: "build",
      }),
    ).toBe("Build: run started at frame.");
  });

  it("renders checkpoint_requested line", () => {
    expect(
      composeTransitionLine({
        kind: "checkpoint_requested",
        stepId: "frame",
        workflowId: "build",
      }),
    ).toBe("Build: frame waiting on checkpoint.");
  });

  it("renders checkpoint_resolved line with route", () => {
    expect(
      composeTransitionLine({
        extra: { route: "plan" },
        kind: "checkpoint_resolved",
        stepTitle: "Frame",
        workflowId: "build",
      }),
    ).toBe("Build: frame resolved, advancing to plan.");
  });

  it("renders dispatch_requested line", () => {
    expect(
      composeTransitionLine({
        kind: "dispatch_requested",
        stepTitle: "Act",
        workflowId: "build",
      }),
    ).toBe("Build: act dispatching.");
  });

  it("renders dispatch_reconciled_pass line", () => {
    expect(
      composeTransitionLine({
        extra: { route: "verify", verdict: "complete_and_hardened" },
        kind: "dispatch_reconciled_pass",
        stepTitle: "Act",
        workflowId: "build",
      }),
    ).toBe(
      "Build: act reconciled (complete_and_hardened), advancing to verify.",
    );
  });

  it("renders dispatch_reconciled_fail line", () => {
    expect(
      composeTransitionLine({
        extra: { completion: "partial", verdict: "issues_remain" },
        kind: "dispatch_reconciled_fail",
        stepTitle: "Act",
        workflowId: "build",
      }),
    ).toBe("Build: act reconciled (partial, issues_remain); not advancing.");
  });

  it("renders synthesis_complete line", () => {
    expect(
      composeTransitionLine({
        extra: { route: "act" },
        kind: "synthesis_complete",
        stepTitle: "Plan",
        workflowId: "build",
      }),
    ).toBe("Build: plan synthesis complete, advancing to act.");
  });

  it("renders aborted line", () => {
    expect(
      composeTransitionLine({
        kind: "aborted",
        workflowId: "build",
      }),
    ).toBe("Build: run aborted.");
  });

  it("renders terminal line per label", () => {
    expect(
      composeTransitionLine({
        extra: { terminalLabel: "complete" },
        kind: "terminal",
        workflowId: "build",
      }),
    ).toBe("Build complete.");
    expect(
      composeTransitionLine({
        extra: { terminalLabel: "paused" },
        kind: "terminal",
        workflowId: "explore",
      }),
    ).toBe("Explore paused.");
  });
});

describe("terminalLabelForStatus", () => {
  it("maps terminal statuses", () => {
    expect(terminalLabelForStatus("completed")).toBe("complete");
    expect(terminalLabelForStatus("aborted")).toBe("aborted");
    expect(terminalLabelForStatus("blocked")).toBe("blocked");
    expect(terminalLabelForStatus("stopped")).toBe("paused");
    expect(terminalLabelForStatus("handed_off")).toBe("paused");
  });

  it("returns null for non-terminal statuses", () => {
    expect(terminalLabelForStatus("in_progress")).toBeNull();
    expect(terminalLabelForStatus("waiting_checkpoint")).toBeNull();
  });
});

describe("stderrAnnouncer", () => {
  it("writes a single line with newline to stderr", () => {
    const announcer = stderrAnnouncer();
    const captured: string[] = [];
    const original = process.stderr.write.bind(process.stderr);
    (process.stderr as unknown as { write: (chunk: string) => boolean }).write = (
      chunk: string,
    ) => {
      captured.push(chunk);
      return true;
    };
    try {
      announcer("Build: run started at frame.");
      announcer("Build: run started at frame.\n");
    } finally {
      (process.stderr as unknown as { write: typeof original }).write = original;
    }

    expect(captured).toEqual([
      "Build: run started at frame.\n",
      "Build: run started at frame.\n",
    ]);
  });
});

describe("silentAnnouncer", () => {
  it("is a no-op that does not throw", () => {
    expect(() => silentAnnouncer("anything")).not.toThrow();
  });
});

describe("bootstrapRun announce wiring", () => {
  it("calls the announce callback with the bootstrap line", () => {
    const { projectRoot, runRoot } = makeTempProject();
    const manifestPath = join(projectRoot, "build.manifest.yaml");
    writeManifestFile(manifestPath, loadBuildManifest());

    const lines: string[] = [];

    bootstrapRun({
      announce: (line) => lines.push(line),
      entryMode: "default",
      goal: "test announce wiring",
      headAtStart: "abc1234",
      manifestPath,
      projectRoot,
      runRoot,
    });

    expect(lines).toContain("Build: run started at frame.");
  });
});
