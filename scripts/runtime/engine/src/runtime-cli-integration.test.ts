import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readContinuityIndex } from "./continuity-control-plane.js";

const THIS_DIR =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = resolve(THIS_DIR, "../../../..");
const COMPOSE_PROMPT = resolve(REPO_ROOT, "scripts/relay/compose-prompt.sh");
const VERIFY_INSTALL = resolve(REPO_ROOT, "scripts/verify-install.sh");
const READ_CONFIG = resolve(REPO_ROOT, "scripts/runtime/bin/read-config.js");
const APPEND_EVENT = resolve(REPO_ROOT, "scripts/runtime/bin/append-event.js");
const CIRCUIT_ENGINE = resolve(REPO_ROOT, "scripts/runtime/bin/circuit-engine.js");
const CONTINUITY = resolve(REPO_ROOT, "scripts/runtime/bin/continuity.js");
const DERIVE_STATE = resolve(REPO_ROOT, "scripts/runtime/bin/derive-state.js");
const RESUME = resolve(REPO_ROOT, "scripts/runtime/bin/resume.js");

function run(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
) {
  return spawnSync(command, args, {
    cwd: options?.cwd ?? REPO_ROOT,
    encoding: "utf-8",
    env: options?.env ? { ...process.env, ...options.env } : process.env,
  });
}

function writeManifest(runRoot: string) {
  writeFileSync(
    resolve(runRoot, "circuit.manifest.yaml"),
    [
      'schema_version: "2"',
      "circuit:",
      "  id: integration-test",
      '  version: "2026-04-07"',
      '  purpose: "Integration test manifest"',
      "  entry:",
      "    signals:",
      "      include: [feature]",
      "      exclude: []",
      "  entry_modes:",
      "    default:",
      "      start_at: frame",
      '      description: "Default test mode"',
      "  steps:",
      "    - id: frame",
      '      title: "Frame"',
      "      executor: orchestrator",
      "      kind: synthesis",
      "      reads: [user.task]",
      "      writes:",
      "        artifact:",
      "          path: artifacts/brief.md",
      "          schema: brief@v1",
      "      gate:",
      "        kind: schema_sections",
      "        source: artifacts/brief.md",
      "        required: [Objective]",
      "      routes:",
      '        pass: "@complete"',
      "",
    ].join("\n"),
    "utf-8",
  );
}

function copyInstallRoot(targetRoot: string) {
  for (const entry of [
    ".claude-plugin",
    "commands",
    "hooks",
    "schemas",
    "skills",
    "circuit.config.example.yaml",
  ]) {
    cpSync(resolve(REPO_ROOT, entry), resolve(targetRoot, entry), { recursive: true });
  }

  mkdirSync(resolve(targetRoot, "scripts"), { recursive: true });
  cpSync(resolve(REPO_ROOT, "scripts/relay"), resolve(targetRoot, "scripts/relay"), { recursive: true });
  cpSync(resolve(REPO_ROOT, "scripts/runtime/bin"), resolve(targetRoot, "scripts/runtime/bin"), { recursive: true });
  cpSync(resolve(REPO_ROOT, "scripts/runtime/generated"), resolve(targetRoot, "scripts/runtime/generated"), { recursive: true });
  cpSync(resolve(REPO_ROOT, "scripts/verify-install.sh"), resolve(targetRoot, "scripts/verify-install.sh"));
  cpSync(resolve(REPO_ROOT, "scripts/sync-to-cache.sh"), resolve(targetRoot, "scripts/sync-to-cache.sh"));

  chmodSync(resolve(targetRoot, "scripts/verify-install.sh"), 0o755);
  chmodSync(resolve(targetRoot, "scripts/relay/compose-prompt.sh"), 0o755);
  chmodSync(resolve(targetRoot, "scripts/relay/circuit-engine.sh"), 0o755);
  chmodSync(resolve(targetRoot, "scripts/relay/dispatch.sh"), 0o755);
  chmodSync(resolve(targetRoot, "scripts/relay/update-batch.sh"), 0o755);
  chmodSync(resolve(targetRoot, "hooks/session-start.sh"), 0o755);
  chmodSync(resolve(targetRoot, "hooks/user-prompt-submit.js"), 0o755);
}

describe("runtime CLI integration", () => {
  it("keeps verify-install.sh as a thin wrapper around the bundled verifier", () => {
    const script = readFileSync(VERIFY_INSTALL, "utf-8");

    expect(script).toContain("verify-install.js");
    expect(script).not.toContain("verify-installed-surface.js");
    expect(script).not.toContain("<<'NODE'");
    expect(script).not.toContain("const installedRoots");
    expect(script).not.toMatch(/sha256\(|lstatSync\(|readdirSync\(/);
  });

  it("read-config honors explicit config over project and home", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const homeDir = resolve(tempRoot, "home");
    const repoDir = resolve(tempRoot, "repo");
    const nestedDir = resolve(repoDir, "nested", "deeper");
    const explicitConfig = resolve(tempRoot, "explicit.yaml");

    mkdirSync(resolve(homeDir, ".claude"), { recursive: true });
    mkdirSync(nestedDir, { recursive: true });

    writeFileSync(
      resolve(homeDir, ".claude/circuit.config.yaml"),
      ["dispatch:", "  roles:", "    implementer: home-role", ""].join("\n"),
      "utf-8",
    );
    writeFileSync(
      resolve(repoDir, "circuit.config.yaml"),
      ["dispatch:", "  roles:", "    implementer: project-role", ""].join("\n"),
      "utf-8",
    );
    writeFileSync(
      explicitConfig,
      ["dispatch:", "  roles:", "    implementer: explicit-role", ""].join("\n"),
      "utf-8",
    );

    run("git", ["init"], { cwd: repoDir });

    const result = run(
      "node",
      [READ_CONFIG, "--config", explicitConfig, "--key", "dispatch.roles.implementer", "--fallback", "auto"],
      { cwd: nestedDir, env: { HOME: homeDir } },
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("explicit-role");
  });

  it("read-config finds the nearest project config before home from nested directories", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const homeDir = resolve(tempRoot, "home");
    const repoDir = resolve(tempRoot, "repo");
    const nestedDir = resolve(repoDir, "nested", "deeper");

    mkdirSync(resolve(homeDir, ".claude"), { recursive: true });
    mkdirSync(nestedDir, { recursive: true });

    writeFileSync(
      resolve(homeDir, ".claude/circuit.config.yaml"),
      ["dispatch:", "  roles:", "    implementer: home-role", ""].join("\n"),
      "utf-8",
    );
    writeFileSync(
      resolve(repoDir, "circuit.config.yaml"),
      ["dispatch:", "  roles:", "    implementer: project-role", ""].join("\n"),
      "utf-8",
    );

    run("git", ["init"], { cwd: repoDir });

    const result = run(
      "node",
      [READ_CONFIG, "--key", "dispatch.roles.implementer", "--fallback", "auto"],
      { cwd: nestedDir, env: { HOME: homeDir } },
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("project-role");
  });

  it("compose-prompt injects config-defined build skills when --circuit build is passed without --skills", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const skillRoot = resolve(tempRoot, "skills");
    const skillDir = resolve(skillRoot, "build-extra");
    const config = resolve(tempRoot, "circuit.config.yaml");
    const header = resolve(tempRoot, "review-header.md");
    const out = resolve(tempRoot, "prompt.md");
    const outWithoutCircuit = resolve(tempRoot, "prompt-without-circuit.md");

    mkdirSync(skillDir, { recursive: true });
    writeFileSync(header, "# Review Header\n", "utf-8");
    writeFileSync(
      config,
      [
        "circuits:",
        "  build:",
        '    skills: "build-extra"',
        "",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      resolve(skillDir, "SKILL.md"),
      [
        "---",
        "name: build-extra",
        'description: "Synthetic build skill for integration coverage."',
        "---",
        "",
        "Synthetic build skill guidance.",
        "",
      ].join("\n"),
      "utf-8",
    );

    const result = run(
      "bash",
      [
        COMPOSE_PROMPT,
        "--header",
        header,
        "--circuit",
        "build",
        "--config",
        config,
        "--out",
        out,
      ],
      {
        env: {
          CIRCUIT_PLUGIN_SKILL_DIR: skillRoot,
        },
      },
    );

    expect(result.status).toBe(0);
    const contents = readFileSync(out, "utf-8");
    expect(contents).toContain("## Domain Guidance: build-extra");
    expect(contents).toContain("Synthetic build skill guidance.");

    const resultWithoutCircuit = run(
      "bash",
      [
        COMPOSE_PROMPT,
        "--header",
        header,
        "--config",
        config,
        "--out",
        outWithoutCircuit,
      ],
      {
        env: {
          CIRCUIT_PLUGIN_SKILL_DIR: skillRoot,
        },
      },
    );

    expect(resultWithoutCircuit.status).toBe(0);
    expect(readFileSync(outWithoutCircuit, "utf-8")).not.toContain(
      "## Domain Guidance: build-extra",
    );
  });

  it("append-event -> derive-state -> resume succeeds through bundled CLIs", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const runRoot = resolve(tempRoot, "run-root");
    mkdirSync(runRoot, { recursive: true });
    writeManifest(runRoot);

    const appendStarted = run(
      "node",
      [
        APPEND_EVENT,
        runRoot,
        "run_started",
        "--payload",
        '{"manifest_path":"circuit.manifest.yaml","entry_mode":"default","head_at_start":"abc1234"}',
      ],
    );
    expect(appendStarted.status).toBe(0);

    const appendStep = run(
      "node",
      [
        APPEND_EVENT,
        runRoot,
        "step_started",
        "--payload",
        '{"step_id":"frame"}',
        "--step-id",
        "frame",
        "--attempt",
        "1",
      ],
    );
    expect(appendStep.status).toBe(0);

    const derive = run("node", [DERIVE_STATE, runRoot]);
    expect(derive.status).toBe(0);

    const resume = run("node", [RESUME, runRoot]);
    expect(resume.status).toBe(0);
    const payload = JSON.parse(resume.stdout);
    expect(payload.status).toBe("in_progress");
    expect(payload.resume_step).toBe("frame");
  });

  it("derive-state can emit canonical state without persisting state.json", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const runRoot = resolve(tempRoot, "run-root");
    mkdirSync(runRoot, { recursive: true });
    writeManifest(runRoot);

    const appendStarted = run(
      "node",
      [
        APPEND_EVENT,
        runRoot,
        "run_started",
        "--payload",
        '{"manifest_path":"circuit.manifest.yaml","entry_mode":"default","head_at_start":"abc1234"}',
      ],
    );
    expect(appendStarted.status).toBe(0);

    const appendStep = run(
      "node",
      [
        APPEND_EVENT,
        runRoot,
        "step_started",
        "--payload",
        '{"step_id":"frame"}',
        "--step-id",
        "frame",
        "--attempt",
        "1",
      ],
    );
    expect(appendStep.status).toBe(0);

    const derive = run("node", [DERIVE_STATE, "--json", "--no-persist", runRoot]);
    expect(derive.status).toBe(0);
    expect(existsSync(resolve(runRoot, "state.json"))).toBe(false);

    const payload = JSON.parse(derive.stdout);
    expect(payload.status).toBe("in_progress");
    expect(payload.current_step).toBe("frame");
  });

  it("circuit-engine emits plain-text bootstrap output and JSON resume output", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");
    const runRoot = resolve(projectRoot, ".circuit", "circuit-runs", "plain-text-bootstrap");
    const manifestRoot = resolve(tempRoot, "manifest-root");
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(runRoot, { recursive: true });
    mkdirSync(manifestRoot, { recursive: true });
    const manifestPath = resolve(manifestRoot, "source.manifest.yaml");
    writeManifest(manifestRoot);
    cpSync(resolve(manifestRoot, "circuit.manifest.yaml"), manifestPath);
    run("git", ["init", "-q"], { cwd: projectRoot });

    const bootstrap = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "bootstrap",
        "--run-root",
        runRoot,
        "--manifest",
        manifestPath,
        "--entry-mode",
        "default",
        "--goal",
        "CLI bootstrap test",
        "--head-at-start",
        "abc1234",
        "--project-root",
        projectRoot,
      ],
      { cwd: projectRoot },
    );

    expect(bootstrap.status).toBe(0);
    expect(bootstrap.stdout).toContain("bootstrapped=true");
    expect(bootstrap.stdout).toContain(`run_root=${runRoot}`);
    expect(bootstrap.stdout).toContain("resume_step=frame");

    const resume = run("node", [
      CIRCUIT_ENGINE,
      "resume",
      "--run-root",
      runRoot,
      "--json",
    ]);

    expect(resume.status).toBe(0);
    const payload = JSON.parse(resume.stdout);
    expect(payload.status).toBe("in_progress");
    expect(payload.resume_step).toBe("frame");
    expect(payload.reason).toContain("frame");
    expect(readContinuityIndex(projectRoot)?.current_run).toEqual(
      expect.objectContaining({
        current_step: "frame",
        manifest_present: true,
        run_root_rel: ".circuit/circuit-runs/plain-text-bootstrap",
        run_slug: "plain-text-bootstrap",
        runtime_status: "in_progress",
      }),
    );
  });

  it("circuit-engine continuity save and resume use the control plane without terminating the run", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");
    const runRoot = resolve(projectRoot, ".circuit", "circuit-runs", "run-backed-save");
    const manifestRoot = resolve(tempRoot, "manifest-root");

    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(runRoot, { recursive: true });
    mkdirSync(manifestRoot, { recursive: true });
    run("git", ["init", "-q"], { cwd: projectRoot });

    writeManifest(manifestRoot);
    const manifestPath = resolve(manifestRoot, "source.manifest.yaml");
    cpSync(resolve(manifestRoot, "circuit.manifest.yaml"), manifestPath);

    const bootstrap = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "bootstrap",
        "--run-root",
        runRoot,
        "--manifest",
        manifestPath,
        "--entry-mode",
        "default",
        "--goal",
        "Run-backed continuity save",
        "--project-root",
        projectRoot,
      ],
      { cwd: projectRoot },
    );

    expect(bootstrap.status).toBe(0);

    const save = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "continuity",
        "save",
        "--project-root",
        projectRoot,
        "--run-root",
        runRoot,
        "--cwd",
        projectRoot,
        "--goal",
        "Preserve run-backed continuity",
        "--next",
        "Resume at frame",
        "--state-markdown",
        "- frame is still active",
        "--debt-markdown",
        "- CONSTRAINT: stay run-backed",
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(save.status).toBe(0);
    const savePayload = JSON.parse(save.stdout);
    expect(savePayload.continuity_kind).toBe("run_ref");
    expect(savePayload.record.run_ref.run_slug).toBe("run-backed-save");
    expect(savePayload.record.narrative.goal).toBe("Preserve run-backed continuity");
    expect(savePayload.record.resume_contract.mode).toBe("resume_run");
    expect(existsSync(savePayload.record_path)).toBe(true);

    const state = JSON.parse(readFileSync(resolve(runRoot, "state.json"), "utf-8"));
    expect(state.status).toBe("in_progress");
    expect(state.current_step).toBe("frame");

    const resume = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "continuity",
        "resume",
        "--project-root",
        projectRoot,
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(resume.status).toBe(0);
    const resumePayload = JSON.parse(resume.stdout);
    expect(resumePayload.source).toBe("pending_record");
    expect(resumePayload.record.record_id).toBe(savePayload.record.record_id);
    expect(resumePayload.record.narrative.next).toBe("Resume at frame");
    expect(resumePayload.warnings).toEqual([]);
  });

  it("continuity save normalizes literal none debt markers to empty stored debt", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");

    mkdirSync(projectRoot, { recursive: true });

    const save = run(
      "node",
      [
        CONTINUITY,
        "save",
        "--project-root",
        projectRoot,
        "--cwd",
        projectRoot,
        "--goal",
        "Preserve standalone continuity",
        "--next",
        "DO: decide whether to bootstrap a run",
        "--state-markdown",
        "- still deciding",
        "--debt-markdown",
        "none",
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(save.status).toBe(0);
    const savePayload = JSON.parse(save.stdout);
    expect(savePayload.record.narrative.debt_markdown).toBe("");
    const persistedRecord = JSON.parse(readFileSync(savePayload.record_path, "utf-8"));
    expect(persistedRecord.narrative.debt_markdown).toBe("");

    const resume = run(
      "node",
      [
        CONTINUITY,
        "resume",
        "--project-root",
        projectRoot,
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(resume.status).toBe(0);
    const resumePayload = JSON.parse(resume.stdout);
    expect(resumePayload.record.narrative.debt_markdown).toBe("");
    expect(JSON.stringify(resumePayload.record.narrative)).not.toContain('"none"');
  });

  it("continuity save rejects typed debt markers parked in state_markdown", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");

    mkdirSync(projectRoot, { recursive: true });

    const save = run(
      "node",
      [
        CONTINUITY,
        "save",
        "--project-root",
        projectRoot,
        "--cwd",
        projectRoot,
        "--goal",
        "Preserve standalone continuity",
        "--next",
        "DO: rerun the validation chain",
        "--state-markdown",
        "- DECIDED: keep session-start passive",
        "--debt-markdown",
        "none",
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(save.status).toBe(1);
    expect(save.stderr).toContain("move DECIDED:/CONSTRAINT:/BLOCKED:/RULED OUT: bullets");
  });

  it("standalone continuity CLI saves and resumes standalone continuity records", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");

    mkdirSync(projectRoot, { recursive: true });

    const save = run(
      "node",
      [
        CONTINUITY,
        "save",
        "--project-root",
        projectRoot,
        "--cwd",
        projectRoot,
        "--goal",
        "Preserve standalone continuity",
        "--next",
        "Decide whether to bootstrap a run",
        "--state-markdown",
        "- still deciding",
        "--debt-markdown",
        "- BLOCKED: waiting for a bootstrap decision",
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(save.status).toBe(0);
    const savePayload = JSON.parse(save.stdout);
    expect(savePayload.continuity_kind).toBe("standalone");
    expect(savePayload.record.run_ref).toBeNull();
    expect(savePayload.record.resume_contract.mode).toBe("resume_standalone");

    const status = run(
      "node",
      [
        CONTINUITY,
        "status",
        "--project-root",
        projectRoot,
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(status.status).toBe(0);
    const statusPayload = JSON.parse(status.stdout);
    expect(statusPayload.selection).toBe("pending_record");
    expect(statusPayload.pending_record.continuity_kind).toBe("standalone");

    const resume = run(
      "node",
      [
        CONTINUITY,
        "resume",
        "--project-root",
        projectRoot,
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(resume.status).toBe(0);
    const resumePayload = JSON.parse(resume.stdout);
    expect(resumePayload.source).toBe("pending_record");
    expect(resumePayload.record.run_ref).toBeNull();
    expect(resumePayload.record.narrative.goal).toBe("Preserve standalone continuity");
  });

  it("continuity resume falls back to the indexed current run when no pending record exists", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");
    const runRoot = resolve(projectRoot, ".circuit", "circuit-runs", "resume-current-run");
    const manifestRoot = resolve(tempRoot, "manifest-root");

    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(runRoot, { recursive: true });
    mkdirSync(manifestRoot, { recursive: true });
    run("git", ["init", "-q"], { cwd: projectRoot });

    writeManifest(manifestRoot);
    const manifestPath = resolve(manifestRoot, "source.manifest.yaml");
    cpSync(resolve(manifestRoot, "circuit.manifest.yaml"), manifestPath);

    const bootstrap = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "bootstrap",
        "--run-root",
        runRoot,
        "--manifest",
        manifestPath,
        "--entry-mode",
        "default",
        "--goal",
        "Resume current run fallback",
        "--project-root",
        projectRoot,
      ],
      { cwd: projectRoot },
    );

    expect(bootstrap.status).toBe(0);

    const resume = run(
      "node",
      [
        CONTINUITY,
        "resume",
        "--project-root",
        projectRoot,
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(resume.status).toBe(0);
    const resumePayload = JSON.parse(resume.stdout);
    expect(resumePayload.source).toBe("current_run");
    expect(resumePayload.current_run.run_slug).toBe("resume-current-run");
    expect(resumePayload.active_run_markdown).toContain("# Active Run");
    expect(resumePayload.active_run_markdown).toContain("Resume current run fallback");
  });

  it("continuity clear deletes the pending record and detaches indexed current_run", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");
    const runRoot = resolve(projectRoot, ".circuit", "circuit-runs", "clear-continuity");
    const manifestRoot = resolve(tempRoot, "manifest-root");

    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(runRoot, { recursive: true });
    mkdirSync(manifestRoot, { recursive: true });
    run("git", ["init", "-q"], { cwd: projectRoot });

    writeManifest(manifestRoot);
    const manifestPath = resolve(manifestRoot, "source.manifest.yaml");
    cpSync(resolve(manifestRoot, "circuit.manifest.yaml"), manifestPath);

    const bootstrap = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "bootstrap",
        "--run-root",
        runRoot,
        "--manifest",
        manifestPath,
        "--entry-mode",
        "default",
        "--goal",
        "Clear continuity state",
        "--project-root",
        projectRoot,
      ],
      { cwd: projectRoot },
    );

    expect(bootstrap.status).toBe(0);

    const save = run(
      "node",
      [
        CONTINUITY,
        "save",
        "--project-root",
        projectRoot,
        "--run-root",
        runRoot,
        "--cwd",
        projectRoot,
        "--goal",
        "Save before clear",
        "--next",
        "Clear continuity",
        "--state-markdown",
        "- pending",
        "--debt-markdown",
        "- CONSTRAINT: clear through the engine",
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(save.status).toBe(0);
    const savePayload = JSON.parse(save.stdout);
    expect(existsSync(savePayload.record_path)).toBe(true);
    expect(existsSync(resolve(projectRoot, ".circuit", "current-run"))).toBe(false);

    const clear = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "continuity",
        "clear",
        "--project-root",
        projectRoot,
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(clear.status).toBe(0);
    const clearPayload = JSON.parse(clear.stdout);
    expect(clearPayload.deleted_record_id).toBe(savePayload.record.record_id);
    expect(clearPayload.cleared_current_run).toBe(true);
    expect(clearPayload.cleared_pending_record).toBe(true);
    expect(existsSync(savePayload.record_path)).toBe(false);
    expect(existsSync(resolve(projectRoot, ".circuit", "current-run"))).toBe(false);
    expect(readContinuityIndex(projectRoot)).toEqual(
      expect.objectContaining({
        current_run: null,
        pending_record: null,
      }),
    );
  });

  it("continuity CLI fails closed when the continuity index is corrupt", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");
    const indexPath = resolve(projectRoot, ".circuit", "control-plane", "continuity-index.json");

    mkdirSync(resolve(indexPath, ".."), { recursive: true });
    writeFileSync(indexPath, "{\"schema_version\":\"2\"}\n", "utf-8");

    const status = run(
      "node",
      [
        CONTINUITY,
        "status",
        "--project-root",
        projectRoot,
      ],
      { cwd: projectRoot },
    );

    expect(status.status).toBe(1);
    expect(status.stderr).toContain("Continuity index failed validation");
  });

  it("continuity clear is idempotent when no pending record exists", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");

    mkdirSync(resolve(projectRoot, ".circuit", "control-plane"), { recursive: true });

    // Clear with no existing continuity state should exit cleanly.
    const clear = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "continuity",
        "clear",
        "--project-root",
        projectRoot,
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(clear.status).toBe(0);
    const payload = JSON.parse(clear.stdout);
    // clearContinuity always reports true (it writes the cleared state unconditionally).
    expect(payload.cleared_pending_record).toBe(true);
    expect(payload.cleared_current_run).toBe(true);
    // But nothing was actually deleted.
    expect(payload.deleted_record_id).toBeNull();
  });

  it("continuity full CLI lifecycle: save -> status -> resume -> clear -> verify empty", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");

    mkdirSync(resolve(projectRoot, ".circuit"), { recursive: true });

    // Save standalone continuity.
    const save = run(
      "node",
      [
        CONTINUITY,
        "save",
        "--project-root",
        projectRoot,
        "--cwd",
        projectRoot,
        "--goal",
        "Full lifecycle test",
        "--next",
        "DO: verify lifecycle",
        "--state-markdown",
        "- lifecycle in progress",
        "--debt-markdown",
        "none",
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(save.status).toBe(0);
    const savePayload = JSON.parse(save.stdout);
    expect(savePayload.continuity_kind).toBe("standalone");
    expect(existsSync(savePayload.record_path)).toBe(true);

    // Status should show the pending record.
    const status = run(
      "node",
      [
        CONTINUITY,
        "status",
        "--project-root",
        projectRoot,
      ],
      { cwd: projectRoot },
    );

    expect(status.status).toBe(0);
    expect(status.stdout).toContain("pending_record");

    // Resume should yield the saved record.
    const resume = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "continuity",
        "resume",
        "--project-root",
        projectRoot,
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(resume.status).toBe(0);
    const resumePayload = JSON.parse(resume.stdout);
    expect(resumePayload.source).toBe("pending_record");
    expect(resumePayload.record.narrative.goal).toBe("Full lifecycle test");

    // Clear should delete the record file and null the index.
    const clear = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "continuity",
        "clear",
        "--project-root",
        projectRoot,
        "--json",
      ],
      { cwd: projectRoot },
    );

    expect(clear.status).toBe(0);
    const clearPayload = JSON.parse(clear.stdout);
    expect(clearPayload.cleared_pending_record).toBe(true);
    expect(existsSync(savePayload.record_path)).toBe(false);

    // Index should be fully empty.
    const finalIndex = readContinuityIndex(projectRoot);
    expect(finalIndex).not.toBeNull();
    expect(finalIndex!.current_run).toBeNull();
    expect(finalIndex!.pending_record).toBeNull();
  });

  it("circuit-engine bootstrap accepts workflow shorthand and normalizes a bare .circuit root", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");
    mkdirSync(projectRoot, { recursive: true });
    run("git", ["init", "-q"], { cwd: projectRoot });

    const bootstrap = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "bootstrap",
        "--workflow",
        "build",
        "--run-root",
        resolve(projectRoot, ".circuit"),
        "--goal",
        "Host surface smoke",
      ],
      { cwd: projectRoot },
    );

    const expectedRunRoot = resolve(
      projectRoot,
      ".circuit",
      "circuit-runs",
      "host-surface-smoke",
    );

    expect(bootstrap.status).toBe(0);
    expect(bootstrap.stdout).toContain(`run_root=${expectedRunRoot}`);
    expect(bootstrap.stdout).toContain("resume_step=frame");
    expect(existsSync(resolve(projectRoot, ".circuit", "current-run"))).toBe(false);
    expect(existsSync(resolve(expectedRunRoot, "circuit.manifest.yaml"))).toBe(true);
    expect(existsSync(resolve(expectedRunRoot, "events.ndjson"))).toBe(true);
    expect(existsSync(resolve(expectedRunRoot, "state.json"))).toBe(true);
    expect(existsSync(resolve(expectedRunRoot, "artifacts", "active-run.md"))).toBe(true);
    expect(readContinuityIndex(projectRoot)?.current_run).toEqual(
      expect.objectContaining({
        current_step: "frame",
        manifest_present: true,
        run_root_rel: ".circuit/circuit-runs/host-surface-smoke",
        run_slug: "host-surface-smoke",
        runtime_status: "in_progress",
      }),
    );
  });

  it("circuit-engine bootstrap supports agent-friendly positional shorthand with --rigor", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");
    mkdirSync(projectRoot, { recursive: true });
    run("git", ["init", "-q"], { cwd: projectRoot });

    const bootstrap = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "bootstrap",
        "explore",
        "Paddock architecture tournament",
        "--rigor",
        "tournament",
        "--run-root",
        resolve(projectRoot, ".circuit"),
      ],
      { cwd: projectRoot },
    );

    const expectedRunRoot = resolve(
      projectRoot,
      ".circuit",
      "circuit-runs",
      "paddock-architecture-tournament",
    );

    expect(bootstrap.status).toBe(0);
    expect(bootstrap.stdout).toContain(`run_root=${expectedRunRoot}`);
    expect(bootstrap.stdout).toContain("resume_step=frame");
    expect(existsSync(resolve(projectRoot, ".circuit", "current-run"))).toBe(false);
    expect(existsSync(resolve(expectedRunRoot, "circuit.manifest.yaml"))).toBe(true);
    expect(existsSync(resolve(expectedRunRoot, "events.ndjson"))).toBe(true);
    expect(existsSync(resolve(expectedRunRoot, "state.json"))).toBe(true);
    expect(existsSync(resolve(expectedRunRoot, "artifacts", "active-run.md"))).toBe(true);
    expect(readContinuityIndex(projectRoot)?.current_run).toEqual(
      expect.objectContaining({
        current_step: "frame",
        manifest_present: true,
        run_root_rel: ".circuit/circuit-runs/paddock-architecture-tournament",
        run_slug: "paddock-architecture-tournament",
        runtime_status: "in_progress",
      }),
    );
  });

  it("terminal completion detaches indexed current_run", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const projectRoot = resolve(tempRoot, "project");
    const runRoot = resolve(projectRoot, ".circuit", "circuit-runs", "terminal-run");
    const manifestRoot = resolve(tempRoot, "manifest-root");

    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(runRoot, { recursive: true });
    mkdirSync(manifestRoot, { recursive: true });
    run("git", ["init", "-q"], { cwd: projectRoot });

    writeManifest(manifestRoot);
    const manifestPath = resolve(manifestRoot, "source.manifest.yaml");
    cpSync(resolve(manifestRoot, "circuit.manifest.yaml"), manifestPath);

    const bootstrap = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "bootstrap",
        "--run-root",
        runRoot,
        "--manifest",
        manifestPath,
        "--entry-mode",
        "default",
        "--goal",
        "Terminal completion",
        "--project-root",
        projectRoot,
      ],
      { cwd: projectRoot },
    );

    expect(bootstrap.status).toBe(0);
    writeFileSync(
      resolve(runRoot, "artifacts", "brief.md"),
      [
        "# Brief: Terminal completion",
        "## Objective",
        "Finish the run cleanly.",
        "",
      ].join("\n"),
      "utf-8",
    );

    const complete = run(
      "node",
      [
        CIRCUIT_ENGINE,
        "complete-synthesis",
        "--run-root",
        runRoot,
        "--step",
        "frame",
      ],
      { cwd: projectRoot },
    );

    expect(complete.status).toBe(0);
    expect(complete.stdout).toContain("status=completed");
    expect(readContinuityIndex(projectRoot)?.current_run).toBeNull();
    expect(existsSync(resolve(projectRoot, ".circuit", "current-run"))).toBe(false);
  });

  it("circuit-engine bootstrap --help prints bootstrap usage instead of treating --help as a valued flag", () => {
    const result = run("node", [CIRCUIT_ENGINE, "bootstrap", "--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: circuit-engine bootstrap --run-root <path>");
    expect(result.stdout).toContain("Agent-friendly shorthand:");
    expect(result.stderr).toBe("");
  });

  it("circuit-engine wrapper resolves the bundled runtime bin from an installed copy", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const installRoot = resolve(tempRoot, "install-root");
    const projectRoot = resolve(tempRoot, "project");
    mkdirSync(installRoot, { recursive: true });
    mkdirSync(projectRoot, { recursive: true });
    copyInstallRoot(installRoot);
    run("git", ["init", "-q"], { cwd: projectRoot });

    const manifestRoot = resolve(tempRoot, "manifest-root");
    const runRoot = resolve(projectRoot, ".circuit", "circuit-runs", "wrapper-installed-copy");
    mkdirSync(manifestRoot, { recursive: true });
    mkdirSync(runRoot, { recursive: true });
    writeManifest(manifestRoot);
    const manifestPath = resolve(manifestRoot, "source.manifest.yaml");
    cpSync(resolve(manifestRoot, "circuit.manifest.yaml"), manifestPath);

    const bootstrap = run(
      "bash",
      [
        resolve(installRoot, "scripts/relay/circuit-engine.sh"),
        "bootstrap",
        "--run-root",
        runRoot,
        "--manifest",
        manifestPath,
        "--entry-mode",
        "default",
        "--goal",
        "Wrapper bootstrap test",
        "--head-at-start",
        "abc1234",
        "--project-root",
        projectRoot,
      ],
      {
        cwd: installRoot,
        env: { NODE_BIN: process.execPath },
      },
    );

    expect(bootstrap.status).toBe(0);
    expect(bootstrap.stdout).toContain("bootstrapped=true");

    const render = run(
      "bash",
      [
        resolve(installRoot, "scripts/relay/circuit-engine.sh"),
        "render",
        "--run-root",
        runRoot,
      ],
      {
        cwd: installRoot,
        env: { NODE_BIN: process.execPath },
      },
    );

    expect(render.status).toBe(0);
    expect(render.stdout).toContain(`active_run_path=${resolve(runRoot, "artifacts/active-run.md")}`);
    expect(render.stdout).toContain("status=in_progress");
  });

  it("verify-install succeeds from a copied install root in installed mode", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const installRoot = resolve(tempRoot, "install-root");
    const homeDir = resolve(tempRoot, "home");
    mkdirSync(resolve(homeDir, ".claude"), { recursive: true });
    mkdirSync(installRoot, { recursive: true });
    copyInstallRoot(installRoot);

    const result = run(
      resolve(installRoot, "scripts/verify-install.sh"),
      ["--mode", "installed"],
      {
        cwd: installRoot,
        env: { HOME: homeDir, NODE_BIN: process.execPath },
      },
    );

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Selected mode: installed");
    expect(`${result.stdout}\n${result.stderr}`).toContain("All checks passed");
  });

  it("verify-install succeeds from a copied repo root in repo mode", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const repoRoot = resolve(tempRoot, "repo-root");
    mkdirSync(repoRoot, { recursive: true });

    for (const entry of [
      ".claude-plugin",
      "commands",
      "hooks",
      "schemas",
      "scripts",
      "skills",
      "README.md",
      "ARCHITECTURE.md",
      "CIRCUITS.md",
      "CUSTOM-CIRCUITS.md",
      "docs",
      "circuit.config.example.yaml",
    ]) {
      cpSync(resolve(REPO_ROOT, entry), resolve(repoRoot, entry), { recursive: true });
    }

    chmodSync(resolve(repoRoot, "scripts/verify-install.sh"), 0o755);
    chmodSync(resolve(repoRoot, "scripts/relay/compose-prompt.sh"), 0o755);
    chmodSync(resolve(repoRoot, "scripts/relay/dispatch.sh"), 0o755);
    chmodSync(resolve(repoRoot, "scripts/relay/update-batch.sh"), 0o755);
    chmodSync(resolve(repoRoot, "hooks/session-start.sh"), 0o755);
    chmodSync(resolve(repoRoot, "hooks/user-prompt-submit.js"), 0o755);

    const result = run(resolve(repoRoot, "scripts/verify-install.sh"), ["--mode", "repo"], {
      cwd: repoRoot,
      env: { NODE_BIN: process.execPath },
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Selected mode: repo");
    expect(`${result.stdout}\n${result.stderr}`).toContain("All checks passed");
  }, 20000);

  it("verify-install fails in repo mode when engine sources do not typecheck", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const repoRoot = resolve(tempRoot, "repo-root");
    mkdirSync(repoRoot, { recursive: true });

    for (const entry of [
      ".claude-plugin",
      "commands",
      "hooks",
      "schemas",
      "scripts",
      "skills",
      "README.md",
      "ARCHITECTURE.md",
      "CIRCUITS.md",
      "CUSTOM-CIRCUITS.md",
      "docs",
      "circuit.config.example.yaml",
    ]) {
      cpSync(resolve(REPO_ROOT, entry), resolve(repoRoot, entry), { recursive: true });
    }

    const brokenFile = resolve(repoRoot, "scripts/runtime/engine/src/catalog/surface-fs.ts");
    writeFileSync(
      brokenFile,
      `${readFileSync(brokenFile, "utf-8")}\nconst verifyInstallTypecheckFailure: string = 123;\n`,
      "utf-8",
    );

    chmodSync(resolve(repoRoot, "scripts/verify-install.sh"), 0o755);
    chmodSync(resolve(repoRoot, "scripts/relay/compose-prompt.sh"), 0o755);
    chmodSync(resolve(repoRoot, "scripts/relay/dispatch.sh"), 0o755);
    chmodSync(resolve(repoRoot, "scripts/relay/update-batch.sh"), 0o755);
    chmodSync(resolve(repoRoot, "hooks/session-start.sh"), 0o755);
    chmodSync(resolve(repoRoot, "hooks/user-prompt-submit.js"), 0o755);

    const result = run(resolve(repoRoot, "scripts/verify-install.sh"), ["--mode", "repo"], {
      cwd: repoRoot,
      env: { NODE_BIN: process.execPath },
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Engine source typecheck");
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "runtime engine TypeScript sources failed to typecheck",
    );
  }, 20000);

  it("verify-install fails when discovered config is malformed", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const installRoot = resolve(tempRoot, "install-root");
    const homeDir = resolve(tempRoot, "home");
    mkdirSync(resolve(homeDir, ".claude"), { recursive: true });
    mkdirSync(installRoot, { recursive: true });
    copyInstallRoot(installRoot);

    writeFileSync(
      resolve(homeDir, ".claude/circuit.config.yaml"),
      "roles: [broken\n",
      "utf-8",
    );

    const result = run(
      resolve(installRoot, "scripts/verify-install.sh"),
      ["--mode", "installed"],
      {
        cwd: installRoot,
        env: { HOME: homeDir },
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("failed to parse");
  });

  it("verify-install fails when a bundled runtime CLI is broken", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const installRoot = resolve(tempRoot, "install-root");
    mkdirSync(installRoot, { recursive: true });
    copyInstallRoot(installRoot);

    writeFileSync(
      resolve(installRoot, "scripts/runtime/bin/resume.js"),
      [
        "#!/usr/bin/env node",
        "process.stderr.write('broken resume bundle\\n');",
        "process.exit(1);",
        "",
      ].join("\n"),
      "utf-8",
    );

    const result = run(resolve(installRoot, "scripts/verify-install.sh"), ["--mode", "installed"], {
      cwd: installRoot,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /(broken resume bundle|resume round trip)/,
    );
  });

  it("verify-install fails when stale generated public surfaces still ship workers", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "circuit-cli-int-"));
    const installRoot = resolve(tempRoot, "install-root");
    mkdirSync(installRoot, { recursive: true });
    copyInstallRoot(installRoot);

    writeFileSync(
      resolve(installRoot, ".claude-plugin/public-commands.txt"),
      [
        "build",
        "explore",
        "handoff",
        "migrate",
        "repair",
        "review",
        "run",
        "sweep",
        "workers",
        "",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      resolve(installRoot, "commands/workers.md"),
      [
        "---",
        'description: "Stale workers shim."',
        "---",
        "",
        "Use the circuit:workers skill to handle this request.",
        "",
      ].join("\n"),
      "utf-8",
    );

    const result = run(resolve(installRoot, "scripts/verify-install.sh"), ["--mode", "installed"], {
      cwd: installRoot,
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /(workers|surface|unexpected|hash)/i,
    );
  });
});
