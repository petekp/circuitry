import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createBuildRun } from "./build-run-test-helpers.js";
import { REPO_ROOT } from "./schema.js";

const SESSION_START = resolve(REPO_ROOT, "hooks/session-start.sh");

function runSessionStart(
  cwd: string,
  homeDir: string,
): ReturnType<typeof spawnSync> {
  return spawnSync("bash", [SESSION_START], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: REPO_ROOT,
      HOME: homeDir,
      NODE_BIN: process.execPath,
    },
  });
}

describe("session-start integration", () => {
  it("refreshes event-backed runs before injecting stale active-run content", () => {
    const { projectRoot, runRoot } = createBuildRun("Refresh before injection");
    const homeDir = mkdtempSync(join(tmpdir(), "circuit-session-home-"));

    writeFileSync(
      join(runRoot, "artifacts", "active-run.md"),
      "# Active Run\n## Workflow\nSTALE\n",
      "utf-8",
    );

    const result = runSessionStart(projectRoot, homeDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Active circuit run detected");
    expect(result.stdout).toContain("## Workflow\nBuild");
    expect(result.stdout).toContain("## Goal\nRefresh before injection");
    expect(result.stdout).not.toContain("STALE");

    const refreshed = readFileSync(
      join(runRoot, "artifacts", "active-run.md"),
      "utf-8",
    );
    expect(refreshed).toContain("## Workflow\nBuild");
    expect(refreshed).not.toContain("STALE");
  });

  it("keeps legacy runs on the saved dashboard path", () => {
    const root = mkdtempSync(join(tmpdir(), "circuit-session-legacy-"));
    const projectRoot = join(root, "project");
    const runRoot = join(projectRoot, ".circuit", "circuit-runs", "legacy-run");
    const homeDir = mkdtempSync(join(tmpdir(), "circuit-session-home-"));

    mkdirSync(join(projectRoot, ".circuit"), { recursive: true });
    mkdirSync(join(runRoot, "artifacts"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".circuit", "current-run"),
      "legacy-run\n",
      "utf-8",
    );
    writeFileSync(
      join(runRoot, "artifacts", "active-run.md"),
      "# Active Run\n## Workflow\nLegacy\n## Current Phase\nframe\n",
      "utf-8",
    );

    const result = runSessionStart(projectRoot, homeDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Active circuit run detected");
    expect(result.stdout).toContain("## Workflow\nLegacy");

    const saved = readFileSync(join(runRoot, "artifacts", "active-run.md"), "utf-8");
    expect(saved).toContain("## Workflow\nLegacy");
  });
});
