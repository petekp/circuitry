import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  recordEventsAndRender,
  resolveStepArtifactPath,
  resolveStepArtifactPaths,
  resolveStepArtifactSchema,
} from "./command-support.js";
import type { CircuitManifestStep } from "./manifest-utils.js";
import {
  loadBuildManifest,
  readState,
  writeManifestFile,
} from "./outer-engine-test-utils.js";

describe("command-support", () => {
  it("skips continuity mutation when no attachment context is provided", () => {
    const detachedBase = mkdtempSync(join(tmpdir(), "circuit-detached-run-"));
    const detachedRunRoot = join(detachedBase, "isolated", "detached", "run");
    const continuityIndexPath = resolve(
      detachedRunRoot,
      "..",
      "..",
      "..",
      ".circuit",
      "control-plane",
      "continuity-index.json",
    );

    writeManifestFile(
      join(detachedRunRoot, "circuit.manifest.yaml"),
      loadBuildManifest(),
    );

    recordEventsAndRender(detachedRunRoot, [
      {
        eventType: "run_started",
        payload: {
          manifest_path: "circuit.manifest.yaml",
          entry_mode: "default",
          head_at_start: "abc1234",
          goal: "Prove detached record-and-render safety",
        },
      },
      {
        eventType: "step_started",
        payload: {
          step_id: "frame",
        },
        stepId: "frame",
      },
    ]);

    const eventsPath = join(detachedRunRoot, "events.ndjson");
    expect(existsSync(eventsPath)).toBe(true);
    expect(
      readFileSync(eventsPath, "utf-8")
        .trim()
        .split("\n"),
    ).toHaveLength(2);

    expect(existsSync(join(detachedRunRoot, "artifacts", "active-run.md"))).toBe(true);
    expect(existsSync(join(detachedRunRoot, "state.json"))).toBe(true);
    expect(readState(detachedRunRoot)).toEqual(
      expect.objectContaining({
        current_step: "frame",
        goal: "Prove detached record-and-render safety",
        status: "in_progress",
      }),
    );

    expect(existsSync(continuityIndexPath)).toBe(false);
  });

  describe("resolveStepArtifactPath(s) / resolveStepArtifactSchema", () => {
    function stepWithSingular(): CircuitManifestStep {
      return {
        id: "plan",
        title: "Plan",
        executor: "orchestrator",
        kind: "synthesis",
        protocol: "plan@v1",
        reads: ["user.task"],
        writes: {
          artifact: { path: "artifacts/plan.md", schema: "plan@v1" },
        },
        gate: { kind: "schema_sections", source: "artifacts/plan.md", required: ["Approach"] },
        routes: { pass: "@complete" },
      } as unknown as CircuitManifestStep;
    }

    function stepWithPlural(): CircuitManifestStep {
      return {
        id: "decide",
        title: "Decide",
        executor: "orchestrator",
        kind: "synthesis",
        protocol: "decide@v1",
        reads: ["user.task"],
        writes: {
          artifacts: [
            { path: "artifacts/plan.md", schema: "plan@v1" },
            { path: "artifacts/decision.md", schema: "decision@v1" },
          ],
        },
        gate: {
          kind: "schema_sections",
          source: "artifacts/plan.md",
          required: ["Approach"],
          alternate_source: "artifacts/decision.md",
          alternate_required: ["Decision", "Rationale"],
        },
        routes: { pass: "@complete" },
      } as unknown as CircuitManifestStep;
    }

    it("returns the single artifact path for singular writes", () => {
      expect(resolveStepArtifactPath(stepWithSingular())).toBe("artifacts/plan.md");
      expect(resolveStepArtifactPaths(stepWithSingular())).toEqual(["artifacts/plan.md"]);
      expect(resolveStepArtifactSchema(stepWithSingular())).toBe("plan@v1");
    });

    it("returns the first artifact path for plural writes", () => {
      expect(resolveStepArtifactPath(stepWithPlural())).toBe("artifacts/plan.md");
      expect(resolveStepArtifactPaths(stepWithPlural())).toEqual([
        "artifacts/plan.md",
        "artifacts/decision.md",
      ]);
      expect(resolveStepArtifactSchema(stepWithPlural())).toBe("plan@v1");
    });

    it("throws when a step declares both writes.artifact and writes.artifacts", () => {
      const step = {
        id: "mixed",
        title: "Mixed",
        executor: "orchestrator",
        kind: "synthesis",
        protocol: "mixed@v1",
        reads: [],
        writes: {
          artifact: { path: "artifacts/a.md", schema: "a@v1" },
          artifacts: [{ path: "artifacts/b.md", schema: "b@v1" }],
        },
        gate: { kind: "schema_sections", source: "artifacts/a.md", required: ["X"] },
        routes: { pass: "@complete" },
      } as unknown as CircuitManifestStep;

      expect(() => resolveStepArtifactPaths(step)).toThrow(/both writes\.artifact and writes\.artifacts/);
      expect(() => resolveStepArtifactPath(step)).toThrow(/both writes\.artifact and writes\.artifacts/);
      expect(() => resolveStepArtifactSchema(step)).toThrow(/both writes\.artifact and writes\.artifacts/);
    });

    it("returns null / empty when the step declares neither shape", () => {
      const step = {
        id: "bare",
        title: "Bare",
        executor: "orchestrator",
        kind: "synthesis",
        protocol: "bare@v1",
        reads: [],
        writes: {},
        gate: { kind: "schema_sections", source: "artifacts/bare.md", required: ["X"] },
        routes: { pass: "@complete" },
      } as unknown as CircuitManifestStep;
      expect(resolveStepArtifactPath(step)).toBeNull();
      expect(resolveStepArtifactPaths(step)).toEqual([]);
      expect(resolveStepArtifactSchema(step)).toBeUndefined();
    });
  });
});
