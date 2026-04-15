import { existsSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { abortRun } from "./abort-run.js";
import { bootstrapRun } from "./bootstrap.js";
import {
  readContinuityIndex,
  upsertContinuityCurrentRun,
} from "./continuity-control-plane.js";
import { appendValidatedEvents } from "./command-support.js";
import { deriveValidatedStateFromRun } from "./derive-state.js";
import { loadBuildManifest, makeTempProject, writeManifestFile } from "./outer-engine-test-utils.js";

function bootstrapBuildRun(slug = "abort-run-test") {
  const { projectRoot, runRoot } = makeTempProject(slug);
  const manifestPath = resolve(projectRoot, "build.manifest.yaml");
  writeManifestFile(manifestPath, loadBuildManifest());

  bootstrapRun({
    entryMode: "default",
    goal: "Abort stuck run",
    headAtStart: "abc1234",
    manifestPath,
    projectRoot,
    runRoot,
  });

  return { projectRoot, runRoot, slug };
}

function readEvents(runRoot: string): Array<Record<string, unknown>> {
  return readFileSync(join(runRoot, "events.ndjson"), "utf-8")
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("abortRun", () => {
  it("aborts a non-terminal run, appends a run_aborted event, and updates state", () => {
    const { projectRoot, runRoot } = bootstrapBuildRun("abort-happy-path");
    const beforeEvents = readEvents(runRoot);

    const result = abortRun({
      reason: "manual cleanup",
      runRoot,
    });

    const afterEvents = readEvents(runRoot);
    const state = JSON.parse(readFileSync(join(runRoot, "state.json"), "utf-8")) as Record<string, unknown>;

    expect(result.status).toBe("aborted");
    expect(result.alreadyTerminal).toBe(false);
    expect(afterEvents).toHaveLength(beforeEvents.length + 1);
    expect(afterEvents.at(-1)?.event_type).toBe("run_aborted");
    expect(afterEvents.at(-1)?.payload).toMatchObject({
      reason: "manual cleanup",
    });
    expect(state.status).toBe("aborted");
    expect(state.abort_reason).toBe("manual cleanup");
    expect(state.current_step).toBeNull();
    expect(readContinuityIndex(projectRoot)?.current_run).toBeNull();
    expect(existsSync(join(projectRoot, ".circuit", "current-run"))).toBe(false);
  });

  it("is idempotent for terminal runs and does not append another event", () => {
    const { runRoot } = bootstrapBuildRun("abort-terminal-idempotent");
    appendValidatedEvents(runRoot, [
      {
        eventType: "run_completed",
        payload: {
          status: "completed",
          terminal_target: "@complete",
        },
      },
    ]);
    deriveValidatedStateFromRun(runRoot, { persist: true });
    const beforeEvents = readEvents(runRoot);

    const result = abortRun({
      reason: "should not apply",
      runRoot,
    });

    expect(result.alreadyTerminal).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.message).toBe("already terminal: completed");
    expect(readEvents(runRoot)).toEqual(beforeEvents);
  });

  it("treats complete as an already-terminal compatibility status", () => {
    const { runRoot } = bootstrapBuildRun("abort-complete-compat");
    const beforeEvents = readEvents(runRoot);
    const statePath = join(runRoot, "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8")) as Record<string, unknown>;

    state.status = "complete";
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

    const result = abortRun({
      reason: "should not apply",
      runRoot,
    });

    expect(result.alreadyTerminal).toBe(true);
    expect(result.status).toBe("complete");
    expect(result.message).toBe("already terminal: complete");
    expect(readEvents(runRoot)).toEqual(beforeEvents);
  });

  it("fails cleanly when the run root does not exist", () => {
    expect(() =>
      abortRun({
        reason: "missing",
        runRoot: "/tmp/does-not-exist-for-abort-run",
      }),
    ).toThrow(/run root does not exist/i);
  });

  it("fails cleanly when the run root has no state.json", () => {
    const { projectRoot, runRoot } = makeTempProject("abort-missing-state");

    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(runRoot, { recursive: true });

    expect(() =>
      abortRun({
        reason: "missing-state",
        runRoot,
      }),
    ).toThrow(/state\.json not found/i);
  });

  it("clears continuity current_run only when the aborted run matches the indexed current run", () => {
    const { projectRoot, runRoot } = bootstrapBuildRun("abort-continuity-miss");
    mkdirSync(join(projectRoot, ".circuit", "circuit-runs", "different-run"), {
      recursive: true,
    });
    upsertContinuityCurrentRun({
      currentStep: "frame",
      lastValidatedAt: "2026-04-14T10:00:00.000Z",
      manifestPresent: true,
      projectRoot,
      runSlug: "different-run",
      runtimeStatus: "in_progress",
    });

    abortRun({
      reason: "abort non-current run",
      runRoot,
    });

    expect(readContinuityIndex(projectRoot)?.current_run?.run_slug).toBe("different-run");
    expect(existsSync(join(projectRoot, ".circuit", "current-run"))).toBe(true);
    expect(readlinkSync(join(projectRoot, ".circuit", "current-run"))).toBe("circuit-runs/different-run");
  });
});
