import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, describe, it } from "vitest";

import { bootstrapRun } from "./bootstrap.js";
import { readContinuityIndex } from "./continuity-control-plane.js";
import {
  loadBuildManifest,
  makeTempProject,
  readActiveRun,
  readCurrentRunPointer,
  readEvents,
  readState,
  writeManifestFile,
  writeRunFile,
} from "./outer-engine-test-utils.js";

describe("bootstrap", () => {
  it("creates manifest snapshot, events, state, active-run, pointer, and uses the entry-mode start step", () => {
    const { projectRoot, runRoot, slug } = makeTempProject("bootstrap-run");
    const manifest = loadBuildManifest();
    manifest.circuit.entry_modes["plan-first"] = {
      description: "Start at plan for test coverage",
      start_at: "plan",
    };
    const manifestPath = join(projectRoot, "build.manifest.yaml");
    writeManifestFile(manifestPath, manifest);

    const result = bootstrapRun({
      entryMode: "plan-first",
      goal: "Bootstrap the semantic outer engine",
      headAtStart: "abc1234",
      manifestPath,
      projectRoot,
      runRoot,
    });

    expect(result.bootstrapped).toBe(true);
    expect(result.resumeStep).toBe("plan");
    expect(existsSync(join(runRoot, "artifacts"))).toBe(true);
    expect(existsSync(join(runRoot, "phases"))).toBe(true);
    expect(existsSync(join(runRoot, "checkpoints"))).toBe(true);

    const events = readEvents(runRoot);
    expect(events).toHaveLength(2);
    expect(events[0].event_type).toBe("run_started");
    expect(events[0].payload.goal).toBe("Bootstrap the semantic outer engine");
    expect(events[1].event_type).toBe("step_started");
    expect(events[1].payload.step_id).toBe("plan");

    const state = readState(runRoot);
    expect(state.goal).toBe("Bootstrap the semantic outer engine");
    expect(state.selected_entry_mode).toBe("plan-first");
    expect(state.current_step).toBe("plan");

    const activeRun = readActiveRun(runRoot);
    expect(activeRun).toContain("## Workflow\nBuild");
    expect(activeRun).toContain("## Rigor\nPlan First");
    expect(activeRun).toContain("## Current Phase\nplan");
    expect(activeRun).toContain("## Goal\nBootstrap the semantic outer engine");

    const pointer = readCurrentRunPointer(projectRoot);
    if (pointer.mode === "symlink") {
      expect(pointer.target).toBe(`circuit-runs/${slug}`);
    } else {
      expect(pointer.target).toBe(slug);
    }

    expect(readContinuityIndex(projectRoot)).toEqual(
      expect.objectContaining({
        current_run: expect.objectContaining({
          current_step: "plan",
          manifest_present: true,
          run_root_rel: `.circuit/circuit-runs/${slug}`,
          run_slug: slug,
          runtime_status: "in_progress",
        }),
      }),
    );
  });

  it("is idempotent when rerun against the same manifest snapshot", () => {
    const { projectRoot, runRoot } = makeTempProject("idempotent-run");
    const manifestPath = join(projectRoot, "build.manifest.yaml");
    writeManifestFile(manifestPath, loadBuildManifest());

    bootstrapRun({
      entryMode: "default",
      goal: "Do not duplicate run_started",
      headAtStart: "abc1234",
      manifestPath,
      projectRoot,
      runRoot,
    });
    const before = readEvents(runRoot).length;

    const result = bootstrapRun({
      entryMode: "default",
      goal: "Do not duplicate run_started",
      headAtStart: "abc1234",
      manifestPath,
      projectRoot,
      runRoot,
    });

    expect(result.bootstrapped).toBe(false);
    expect(readEvents(runRoot)).toHaveLength(before);
    expect(readContinuityIndex(projectRoot)?.current_run).toEqual(
      expect.objectContaining({
        current_step: "frame",
        manifest_present: true,
        run_root_rel: ".circuit/circuit-runs/idempotent-run",
        run_slug: "idempotent-run",
        runtime_status: "in_progress",
      }),
    );
  });

  it("fails on legacy run-root collision", () => {
    const { projectRoot, runRoot } = makeTempProject("legacy-run");
    const manifestPath = join(projectRoot, "build.manifest.yaml");
    writeManifestFile(manifestPath, loadBuildManifest());
    writeRunFile(runRoot, "artifacts/active-run.md", "# Active Run\n");

    expect(() =>
      bootstrapRun({
        entryMode: "default",
        headAtStart: "abc1234",
        manifestPath,
        projectRoot,
        runRoot,
      }),
    ).toThrow(/legacy run root/i);
  });
});
