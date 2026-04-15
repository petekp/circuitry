import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { bootstrapRun } from "./bootstrap.js";
import { loadBuildManifest, makeTempProject, writeManifestFile } from "./outer-engine-test-utils.js";

const THIS_DIR =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = resolve(THIS_DIR, "../../../..");
const ABORT_STUCK_RUNS = resolve(REPO_ROOT, "scripts/runtime/bin/abort-stuck-runs.sh");

function runScript(cwd: string, args: string[]) {
  return spawnSync("bash", [ABORT_STUCK_RUNS, ...args], {
    cwd,
    encoding: "utf-8",
  });
}

describe("abort-stuck-runs migration", () => {
  it("reports stuck runs in dry-run mode and aborts them with --execute", () => {
    const { projectRoot, runRoot } = makeTempProject("stuck-run");
    const manifestPath = resolve(projectRoot, "build.manifest.yaml");
    writeManifestFile(manifestPath, loadBuildManifest());

    bootstrapRun({
      entryMode: "default",
      goal: "Migration target",
      headAtStart: "abc1234",
      manifestPath,
      projectRoot,
      runRoot,
    });

    chmodSync(ABORT_STUCK_RUNS, 0o755);

    const dryRun = runScript(projectRoot, []);

    expect(dryRun.status).toBe(0);
    expect(`${dryRun.stdout}${dryRun.stderr}`).toContain("stuck-run status=in_progress");
    expect(`${dryRun.stdout}${dryRun.stderr}`).toContain("Re-run with --execute to abort them.");
    expect(JSON.parse(readFileSync(join(runRoot, "state.json"), "utf-8")).status).toBe("in_progress");

    const execute = runScript(projectRoot, ["--execute"]);

    expect(execute.status).toBe(0);
    expect(JSON.parse(readFileSync(join(runRoot, "state.json"), "utf-8")).status).toBe("aborted");
    expect(JSON.parse(readFileSync(join(runRoot, "state.json"), "utf-8")).abort_reason).toContain("stuck-run migration:");
  });

  it("ignores already-terminal compatibility states and rejects conflicting mode flags", () => {
    const { projectRoot, runRoot } = makeTempProject("complete-compatible-run");
    const manifestPath = resolve(projectRoot, "build.manifest.yaml");
    writeManifestFile(manifestPath, loadBuildManifest());

    bootstrapRun({
      entryMode: "default",
      goal: "Compatibility terminal",
      headAtStart: "abc1234",
      manifestPath,
      projectRoot,
      runRoot,
    });

    chmodSync(ABORT_STUCK_RUNS, 0o755);

    const statePath = join(runRoot, "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf-8")) as Record<string, unknown>;
    state.status = "complete";
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

    const dryRun = runScript(projectRoot, []);

    expect(dryRun.status).toBe(0);
    expect(`${dryRun.stdout}${dryRun.stderr}`).not.toContain("complete-compatible-run status=complete");
    expect(`${dryRun.stdout}${dryRun.stderr}`).toContain("No stuck runs found.");

    const conflictingModes = runScript(projectRoot, ["--dry-run", "--execute"]);

    expect(conflictingModes.status).not.toBe(0);
    expect(`${conflictingModes.stdout}${conflictingModes.stderr}`).toContain(
      "--execute and --dry-run cannot be used together",
    );
  });
});
