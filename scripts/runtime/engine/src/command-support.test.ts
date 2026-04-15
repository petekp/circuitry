import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { recordEventsAndRender } from "./command-support.js";
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
});
