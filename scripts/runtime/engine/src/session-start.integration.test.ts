import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createBuildRun } from "./build-run-test-helpers.js";
import {
  setContinuityPendingRecord,
  type ContinuityRecordV1,
  writeContinuityRecord,
} from "./continuity-control-plane.js";
import { REPO_ROOT } from "./schema.js";

const SESSION_START = resolve(REPO_ROOT, "hooks/session-start.sh");

function runSessionStart(
  cwd: string,
  homeDir: string,
  extraEnv: Record<string, string> = {},
): ReturnType<typeof spawnSync> {
  return spawnSync("bash", [SESSION_START], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: REPO_ROOT,
      HOME: homeDir,
      NODE_BIN: process.execPath,
      ...extraEnv,
    },
  });
}

function legacyFixtureProjectKey(projectRoot: string): string {
  return projectRoot
    .replace(/\\/g, "/")
    .replace(/\//g, "-")
    .replace(/[:<>"|?*]/g, "");
}

function legacyFixturePath(baseDir: string, projectRoot: string): string {
  return resolve(
    baseDir,
    ".circuit-projects",
    legacyFixtureProjectKey(projectRoot),
    "handoff.md",
  );
}

function writePendingRunContinuity(projectRoot: string, runRoot: string): void {
  const runSlug = basename(runRoot);
  const canonicalProjectRoot = realpathSync(projectRoot);
  const record: ContinuityRecordV1 = {
    created_at: "2026-04-12T00:00:00.000Z",
    git: {
      base_commit: null,
      branch: null,
      cwd: canonicalProjectRoot,
      head: null,
    },
    narrative: {
      debt_markdown: "- CONSTRAINT: debt-sentinel-do-not-leak",
      goal: "goal-display-ok",
      next: "DO: next-display-ok",
      state_markdown: "- state-sentinel-do-not-leak",
    },
    project_root: canonicalProjectRoot,
    record_id: `continuity-${runSlug}`,
    resume_contract: {
      auto_resume: false,
      mode: "resume_run",
      requires_explicit_resume: true,
    },
    run_ref: {
      current_step_at_save: "frame",
      manifest_present: true,
      run_root_rel: `.circuit/circuit-runs/${runSlug}`,
      run_slug: runSlug,
      runtime_status_at_save: "in_progress",
      runtime_updated_at_at_save: "2026-04-12T00:00:00.000Z",
    },
    schema_version: "1",
  };

  const { payloadRel } = writeContinuityRecord(projectRoot, record);
  setContinuityPendingRecord(projectRoot, {
    continuity_kind: "run_ref",
    created_at: record.created_at,
    payload_rel: payloadRel,
    record_id: record.record_id,
    run_slug: runSlug,
  });
}

describe("session-start integration", () => {
  it("announces pending continuity with goal/next and explicit slash-command guidance", () => {
    const { projectRoot, runRoot } = createBuildRun("Pending continuity should stay passive");
    const homeDir = mkdtempSync(join(tmpdir(), "circuit-session-home-"));

    writeFileSync(
      join(runRoot, "artifacts", "active-run.md"),
      "# Active Run\n## Workflow\nSTALE\n",
      "utf-8",
    );
    writePendingRunContinuity(projectRoot, runRoot);

    const result = runSessionStart(projectRoot, homeDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Circuit continuity pending");
    expect(result.stdout).toContain("Goal: goal-display-ok");
    expect(result.stdout).toContain("Next: DO: next-display-ok");
    expect(result.stdout).toContain("/circuit:handoff resume");
    expect(result.stdout).toContain("/circuit:run continue");
    expect(result.stdout).toContain("Available: pending continuity");
    expect(result.stdout).not.toContain("short ack");
    expect(result.stdout).not.toContain("state-sentinel-do-not-leak");
    expect(result.stdout).not.toContain("debt-sentinel-do-not-leak");
    expect(result.stdout).not.toContain("Resume from the handoff above.");
    expect(result.stdout).not.toContain("execute NEXT");

    const saved = readFileSync(join(runRoot, "artifacts", "active-run.md"), "utf-8");
    expect(saved).toContain("STALE");
  });

  it("ignores legacy home handoff fixtures even when CIRCUIT_HANDOFF_HOME is set", () => {
    const root = mkdtempSync(join(tmpdir(), "circuit-session-sibling-home-"));
    const projectRoot = join(root, "project");
    const siblingHome = join(root, "home");
    const homeDir = mkdtempSync(join(tmpdir(), "circuit-session-home-"));

    mkdirSync(projectRoot, { recursive: true });
    spawnSync("git", ["init", "-q"], { cwd: projectRoot, encoding: "utf-8" });
    const gitRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: projectRoot,
      encoding: "utf-8",
    }).stdout.trim();
    const siblingHandoffPath = legacyFixturePath(siblingHome, gitRoot);
    mkdirSync(resolve(siblingHandoffPath, ".."), { recursive: true });
    writeFileSync(
      siblingHandoffPath,
      [
        "# Handoff",
        "WRITTEN: 2026-04-10T00:00:00Z",
        `DIR: ${gitRoot}`,
        "",
        "NEXT: DO: sibling-home-sentinel",
        "STATE:",
        "- sibling-home-sentinel",
        "",
      ].join("\n"),
      "utf-8",
    );

    const defaultResult = runSessionStart(projectRoot, homeDir);
    expect(defaultResult.status).toBe(0);
    expect(defaultResult.stdout).toContain("Circuit is active.");
    expect(defaultResult.stdout).not.toContain("Circuit continuity pending");

    const overrideResult = runSessionStart(projectRoot, homeDir, {
      CIRCUIT_HANDOFF_HOME: siblingHome,
    });
    expect(overrideResult.status).toBe(0);
    expect(overrideResult.stdout).toContain("Circuit is active.");
    expect(overrideResult.stdout).not.toContain("Circuit continuity pending");
  });

  it("refreshes event-backed runs before announcing passive active-run continuity", () => {
    const { projectRoot, runRoot } = createBuildRun("Refresh before injection");
    const homeDir = mkdtempSync(join(tmpdir(), "circuit-session-home-"));

    writeFileSync(
      join(runRoot, "artifacts", "active-run.md"),
      "# Active Run\n## Workflow\nSTALE\n",
      "utf-8",
    );

    const result = runSessionStart(projectRoot, homeDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Circuit active run attached");
    expect(result.stdout).not.toContain("/circuit:handoff resume");
    expect(result.stdout).toContain("Available: active run");
    expect(result.stdout).not.toContain("Circuit continuity pending");
    expect(result.stdout).not.toContain("/circuit:handoff done");
    expect(result.stdout).not.toContain("short ack");
    expect(result.stdout).not.toContain("## Workflow\nBuild");
    expect(result.stdout).not.toContain("Refresh before injection");
    expect(result.stdout).not.toContain("STALE");
    expect(result.stdout).not.toContain("resume from the current phase");

    const refreshed = readFileSync(
      join(runRoot, "artifacts", "active-run.md"),
      "utf-8",
    );
    expect(refreshed).toContain("## Workflow\nBuild");
    expect(refreshed).not.toContain("STALE");
  });

  it("current-run-only banner does not advertise /circuit:handoff done or pending-continuity copy", () => {
    const { projectRoot, runRoot } = createBuildRun("Current run only, no pending record");
    const homeDir = mkdtempSync(join(tmpdir(), "circuit-session-home-"));

    writeFileSync(
      join(runRoot, "artifacts", "active-run.md"),
      "# Active Run\n## Workflow\nBuild\n",
      "utf-8",
    );

    const result = runSessionStart(projectRoot, homeDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Circuit active run attached");
    expect(result.stdout).toContain("Available: active run");
    expect(result.stdout).not.toContain("/circuit:handoff done");
    expect(result.stdout).not.toContain("Circuit continuity pending.");
    expect(result.stdout).not.toContain("auto-resumes saved state");
    expect(result.stdout).not.toContain("Available: pending continuity");
    expect(result.stdout).not.toContain("short ack");
  });

  it("pending-record banner uses explicit slash-command guidance, not bare-word continuation", () => {
    const { projectRoot, runRoot } = createBuildRun("Pending banner must cite explicit slash commands");
    const homeDir = mkdtempSync(join(tmpdir(), "circuit-session-home-"));

    writePendingRunContinuity(projectRoot, runRoot);

    const result = runSessionStart(projectRoot, homeDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("/circuit:handoff resume");
    expect(result.stdout).not.toContain("short ack");
    expect(result.stdout).not.toMatch(/Reply with a continuation signal \([^)]*\bok\b/);
    expect(result.stdout).not.toMatch(/Reply with a continuation signal \([^)]*\byep\b/);
  });

  it("ignores a mirrored current-run marker when it is not backed by indexed current_run", () => {
    const root = mkdtempSync(join(tmpdir(), "circuit-session-mirror-only-"));
    const projectRoot = join(root, "project");
    const runRoot = join(projectRoot, ".circuit", "circuit-runs", "orphan-run");
    const homeDir = mkdtempSync(join(tmpdir(), "circuit-session-home-"));

    mkdirSync(join(projectRoot, ".circuit"), { recursive: true });
    mkdirSync(join(runRoot, "artifacts"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".circuit", "current-run"),
      "orphan-run\n",
      "utf-8",
    );
    writeFileSync(
      join(runRoot, "artifacts", "active-run.md"),
      "# Active Run\n## Workflow\nLegacy\n## Current Phase\nframe\n",
      "utf-8",
    );

    const result = runSessionStart(projectRoot, homeDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Circuit is active.");
    expect(result.stdout).not.toContain("Circuit continuity pending");

    const saved = readFileSync(join(runRoot, "artifacts", "active-run.md"), "utf-8");
    expect(saved).toContain("## Workflow\nLegacy");
  });
});
