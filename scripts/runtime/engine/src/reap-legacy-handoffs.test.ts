import {
  existsSync,
  readdirSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./schema.js";

const REAPER = resolve(REPO_ROOT, "scripts/runtime/bin/reap-legacy-handoffs.sh");

function createLegacyFile(root: string, relativePath: string, daysOld: number): string {
  const filePath = resolve(root, relativePath);
  mkdirSync(resolve(filePath, ".."), { recursive: true });
  writeFileSync(filePath, `legacy ${relativePath}\n`, "utf-8");

  const ageSeconds = daysOld * 24 * 60 * 60;
  const agedAt = new Date(Date.now() - (ageSeconds * 1000));
  utimesSync(filePath, agedAt, agedAt);
  return filePath;
}

function runReaper(
  homeDir: string,
  args: string[],
): ReturnType<typeof spawnSync> {
  return spawnSync("bash", [REAPER, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    env: {
      ...process.env,
      HOME: homeDir,
    },
  });
}

describe("reap-legacy-handoffs.sh", () => {
  it("dry-runs legacy handoff inventory with file ages and a summary", () => {
    const root = mkdtempSync(join(tmpdir(), "circuit-legacy-handoffs-"));
    const homeDir = resolve(root, "home");
    const projectRoot = resolve(root, "project");

    const claudeFile = createLegacyFile(homeDir, ".claude/handoffs/from-claude.md", 63);
    const relayFile = createLegacyFile(homeDir, ".relay/handoffs/from-relay.md", 14);
    const projectRelayFile = createLegacyFile(projectRoot, ".relay/handoffs/from-project.md", 7);

    const result = runReaper(homeDir, [projectRoot]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("mode=dry-run");
    expect(result.stdout).toContain(relative(homeDir, claudeFile));
    expect(result.stdout).toContain(relative(homeDir, relayFile));
    expect(result.stdout).toContain(projectRelayFile);
    expect(result.stdout).toMatch(/age_days=\d+/);
    expect(result.stdout).toContain("SUMMARY total_files=3");
    expect(result.stdout).toContain("would_archive=3");
    expect(result.stdout).toContain("moved=0");
    expect(existsSync(claudeFile)).toBe(true);
    expect(existsSync(relayFile)).toBe(true);
    expect(existsSync(projectRelayFile)).toBe(true);
  });

  it("archives files under a timestamped circuit archive when --execute is set", () => {
    const root = mkdtempSync(join(tmpdir(), "circuit-legacy-handoffs-"));
    const homeDir = resolve(root, "home");
    const projectRoot = resolve(root, "project");

    const claudeFile = createLegacyFile(homeDir, ".claude/handoffs/from-claude.md", 30);
    const relayFile = createLegacyFile(homeDir, ".relay/handoffs/from-relay.md", 13);
    const projectRelayFile = createLegacyFile(projectRoot, ".relay/handoffs/from-project.md", 5);

    const result = runReaper(homeDir, ["--execute", projectRoot]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("mode=execute");
    expect(result.stdout).toContain("SUMMARY total_files=3");
    expect(result.stdout).toContain("would_archive=3");
    expect(result.stdout).toContain("moved=3");

    const archiveDirMatch = result.stdout.match(/archive_dir=(.+)/);
    expect(archiveDirMatch).not.toBeNull();
    const archiveDir = archiveDirMatch?.[1]?.trim() ?? "";

    expect(existsSync(archiveDir)).toBe(true);
    expect(existsSync(claudeFile)).toBe(false);
    expect(existsSync(relayFile)).toBe(false);
    expect(existsSync(projectRelayFile)).toBe(false);

    const archivedFiles = readdirSync(archiveDir, { recursive: true })
      .map((entry) => String(entry))
      .filter((entry) => entry.endsWith(".md"));
    const archivedClaudeRel = archivedFiles.find((entry) => entry.endsWith("from-claude.md"));
    const archivedRelayRel = archivedFiles.find((entry) => entry.endsWith("from-relay.md"));
    const archivedProjectRel = archivedFiles.find((entry) => entry.endsWith("from-project.md"));

    expect(archivedClaudeRel).toBeDefined();
    expect(archivedRelayRel).toBeDefined();
    expect(archivedProjectRel).toBeDefined();

    const archivedClaude = resolve(archiveDir, archivedClaudeRel ?? "");
    const archivedRelay = resolve(archiveDir, archivedRelayRel ?? "");
    const archivedProject = resolve(archiveDir, archivedProjectRel ?? "");

    expect(readFileSync(archivedClaude, "utf-8")).toContain("from-claude");
    expect(readFileSync(archivedRelay, "utf-8")).toContain("from-relay");
    expect(readFileSync(archivedProject, "utf-8")).toContain("from-project");
    expect(statSync(archivedClaude).isFile()).toBe(true);
    expect(statSync(archivedRelay).isFile()).toBe(true);
    expect(statSync(archivedProject).isFile()).toBe(true);
  });
});
