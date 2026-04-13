import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  setContinuityPendingRecord,
  type ContinuityRecordV1,
  upsertContinuityCurrentRun,
  writeContinuityRecord,
} from "./continuity-control-plane.js";
import { REPO_ROOT } from "./schema.js";

const USER_PROMPT_SUBMIT = resolve(REPO_ROOT, "hooks/user-prompt-submit.js");

function runUserPromptSubmit(
  prompt: string,
  options?: { cwd?: string; env?: Record<string, string> },
): ReturnType<typeof spawnSync> {
  return spawnSync(USER_PROMPT_SUBMIT, {
    cwd: options?.cwd,
    input: JSON.stringify({ prompt }),
    encoding: "utf-8",
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: REPO_ROOT,
      ...options?.env,
    },
  });
}

function readAdditionalContext(result: ReturnType<typeof spawnSync>): string {
  const payload = JSON.parse(result.stdout);
  expect(payload.suppressOutput).toBe(true);
  expect(payload.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
  return payload.hookSpecificOutput.additionalContext as string;
}

function makeInstalledHookRoot(root: string): string {
  const installRoot = resolve(root, "install");
  mkdirSync(resolve(installRoot, "hooks"), { recursive: true });
  mkdirSync(resolve(installRoot, "scripts/runtime/bin"), { recursive: true });
  mkdirSync(resolve(installRoot, "scripts/runtime/generated"), { recursive: true });
  mkdirSync(resolve(installRoot, "schemas"), { recursive: true });

  copyFileSync(USER_PROMPT_SUBMIT, resolve(installRoot, "hooks/user-prompt-submit.js"));
  chmodSync(resolve(installRoot, "hooks/user-prompt-submit.js"), 0o755);
  copyFileSync(
    resolve(REPO_ROOT, "scripts/runtime/bin/user-prompt-submit.js"),
    resolve(installRoot, "scripts/runtime/bin/user-prompt-submit.js"),
  );
  copyFileSync(
    resolve(REPO_ROOT, "scripts/runtime/generated/prompt-contracts.json"),
    resolve(installRoot, "scripts/runtime/generated/prompt-contracts.json"),
  );
  copyFileSync(
    resolve(REPO_ROOT, "schemas/event.schema.json"),
    resolve(installRoot, "schemas/event.schema.json"),
  );
  copyFileSync(
    resolve(REPO_ROOT, "schemas/continuity-index.schema.json"),
    resolve(installRoot, "schemas/continuity-index.schema.json"),
  );
  copyFileSync(
    resolve(REPO_ROOT, "schemas/continuity-record.schema.json"),
    resolve(installRoot, "schemas/continuity-record.schema.json"),
  );

  return installRoot;
}

function writeCustomWorkflow(homeDir: string, slug: string): void {
  const skillDir = resolve(homeDir, ".claude", "circuit", "skills", slug);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    resolve(skillDir, "SKILL.md"),
    [
      "---",
      `name: ${slug}`,
      `description: "${slug} custom workflow. Additional detail."`,
      "---",
      "",
      `# ${slug}`,
      "",
    ].join("\n"),
    "utf-8",
  );
  writeFileSync(
    resolve(skillDir, "circuit.yaml"),
    [
      'schema_version: "2"',
      "circuit:",
      `  id: ${slug}`,
      '  version: "2026-04-11"',
      `  purpose: "${slug} custom workflow."`,
      "  entry:",
      "    usage: <task>",
      "    signals:",
      "      include: [research, deep_dive]",
      "      exclude: [bug]",
      "  entry_modes:",
      "    default:",
      "      start_at: frame",
      '      description: "Default"',
      "  steps: []",
      "",
    ].join("\n"),
    "utf-8",
  );
}

function writePendingContinuity(projectRoot: string): void {
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
      debt_markdown: "- CONSTRAINT: use engine commands only",
      goal: "Resume from the continuity control plane",
      next: "DO: resume-control-plane-sentinel",
      state_markdown: "- resume-control-plane-sentinel",
    },
    project_root: canonicalProjectRoot,
    record_id: "continuity-pending-record",
    resume_contract: {
      auto_resume: false,
      mode: "resume_standalone",
      requires_explicit_resume: true,
    },
    run_ref: null,
    schema_version: "1",
  };

  const { payloadRel } = writeContinuityRecord(projectRoot, record);
  setContinuityPendingRecord(projectRoot, {
    continuity_kind: "standalone",
    created_at: record.created_at,
    payload_rel: payloadRel,
    record_id: record.record_id,
    run_slug: null,
  });
}

function writeRunBackedPendingContinuity(projectRoot: string): string {
  const canonicalProjectRoot = realpathSync(projectRoot);
  const runSlug = "resume-attached-run";
  const runRoot = resolve(canonicalProjectRoot, ".circuit", "circuit-runs", runSlug);

  mkdirSync(runRoot, { recursive: true });

  const record: ContinuityRecordV1 = {
    created_at: "2026-04-12T00:00:00.000Z",
    git: {
      base_commit: null,
      branch: null,
      cwd: canonicalProjectRoot,
      head: null,
    },
    narrative: {
      debt_markdown: "- CONSTRAINT: continue the existing run without rebinding it",
      goal: "Resume the saved run through the control plane",
      next: "DO: resume-attached-run-sentinel",
      state_markdown: "- resume-attached-run-sentinel",
    },
    project_root: canonicalProjectRoot,
    record_id: "continuity-run-ref-record",
    resume_contract: {
      auto_resume: false,
      mode: "resume_run",
      requires_explicit_resume: true,
    },
    run_ref: {
      current_step_at_save: "plan",
      manifest_present: true,
      run_root_rel: `.circuit/circuit-runs/${runSlug}`,
      run_slug: runSlug,
      runtime_status_at_save: "in_progress",
      runtime_updated_at_at_save: "2026-04-12T00:00:00.000Z",
    },
    schema_version: "1",
  };

  const { payloadRel } = writeContinuityRecord(projectRoot, record);
  upsertContinuityCurrentRun({
    attachedAt: "2026-04-12T00:00:00.000Z",
    currentStep: "plan",
    lastValidatedAt: "2026-04-12T00:00:00.000Z",
    manifestPresent: true,
    projectRoot: canonicalProjectRoot,
    runSlug,
    runtimeStatus: "in_progress",
  });
  setContinuityPendingRecord(projectRoot, {
    continuity_kind: "run_ref",
    created_at: record.created_at,
    payload_rel: payloadRel,
    record_id: record.record_id,
    run_slug: runSlug,
  });

  return runRoot;
}

describe("user-prompt-submit integration", () => {
  it("injects targeted Build smoke bootstrap context from generated contracts", () => {
    const result = runUserPromptSubmit(
      "/circuit:run develop: smoke bootstrap the build path for host-surface verification",
    );

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Build bootstrap smoke verification");
    expect(context).toContain(".circuit/bin/circuit-engine bootstrap");
    expect(context).toContain('--manifest "@build"');
    expect(context).toContain("Do not use `Write`, `Edit`, heredocs, or manual file creation");
    expect(context).toContain("Do not continue into Frame, Plan, Act, Verify, Review, or Close");
  });

  it("routes /circuit:build smoke host-surface to build_smoke via parsed intent", () => {
    const result = runUserPromptSubmit(
      "/circuit:build smoke host-surface verification",
    );

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Build bootstrap smoke verification");
    expect(context).toContain(".circuit/bin/circuit-engine bootstrap");
    expect(context).toContain('--manifest "@build"');
  });

  it("stays silent for unrelated prompts", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-unrelated-"));
    const pluginRootPath = resolve(projectRoot, ".circuit", "plugin-root");
    const result = runUserPromptSubmit("please summarize this file", { cwd: projectRoot });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(existsSync(pluginRootPath)).toBe(false);
  });

  it("persists the installed plugin root and authors local helper wrappers for circuit prompts", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-root-"));
    const pluginRootPath = resolve(projectRoot, ".circuit", "plugin-root");

    const result = runUserPromptSubmit("/circuit:build add dark mode support", { cwd: projectRoot });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(readFileSync(pluginRootPath, "utf-8").trim()).toBe(REPO_ROOT);
    expect(existsSync(resolve(projectRoot, ".circuit/bin/circuit-engine"))).toBe(true);
    expect(existsSync(resolve(projectRoot, ".circuit/bin/compose-prompt"))).toBe(true);
    expect(existsSync(resolve(projectRoot, ".circuit/bin/dispatch"))).toBe(true);
  });

  it("does not hijack ordinary Build work that mentions smoke tests", () => {
    const result = runUserPromptSubmit(
      "/circuit:run develop: add smoke test coverage for login flow",
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("does not trigger any fast mode for prompts that mention smoke bootstrap without /circuit:", () => {
    const result = runUserPromptSubmit("please smoke bootstrap the host surface");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("does not trigger any fast mode when /circuit:build is mentioned but no smoke intent", () => {
    const result = runUserPromptSubmit("/circuit:build refactor the auth module");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("injects the custom routing overlay for /circuit:run when user-global circuits exist", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-custom-routing-"));
    const homeDir = resolve(projectRoot, "home");
    mkdirSync(homeDir, { recursive: true });
    writeCustomWorkflow(homeDir, "research");

    const result = runUserPromptSubmit("/circuit:run investigate auth provider choices", {
      cwd: projectRoot,
      env: { HOME: homeDir },
    });

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Custom Routing Overlay");
    expect(context).toContain("Built-ins win ties.");
    expect(context).toContain("`/circuit:research`");
    expect(context).toContain("include: deep_dive, research");
    expect(context).toContain("exclude: bug");
  });

  it("surfaces a warning context when the custom routing catalog is malformed", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-custom-routing-error-"));
    const homeDir = resolve(projectRoot, "home");
    const brokenSkillDir = resolve(homeDir, ".claude", "circuit", "skills", "broken");

    mkdirSync(brokenSkillDir, { recursive: true });
    writeFileSync(resolve(brokenSkillDir, "SKILL.md"), "# broken\n", "utf-8");

    const result = runUserPromptSubmit("/circuit:run investigate auth provider choices", {
      cwd: projectRoot,
      env: { HOME: homeDir },
    });

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Custom Routing Overlay Unavailable");
    expect(context).toContain("Do not consider user-global custom circuits");
    expect(context).toContain("no YAML frontmatter found");
  });

  it("does not hijack ordinary legacy-workflow work that mentions smoke tests", () => {
    const repairResult = runUserPromptSubmit("/circuit:repair fix flaky smoke test on CI");
    const exploreResult = runUserPromptSubmit(
      "/circuit:explore compare smoke-test strategies for staging",
    );

    expect(repairResult.status).toBe(0);
    expect(repairResult.stdout).toBe("");
    expect(exploreResult.status).toBe(0);
    expect(exploreResult.stdout).toBe("");
  });

  it("injects semantic workflow smoke bootstrap context from generated fast modes", () => {
    const result = runUserPromptSubmit(
      "/circuit:explore smoke inspect the public-surface bootstrap path",
    );

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Explore Smoke Contract");
    expect(context).toContain(".circuit/bin/circuit-engine bootstrap");
    expect(context).toContain('--workflow "explore"');
    expect(context).toContain('RUN_ROOT=".circuit/circuit-runs/${RUN_SLUG}"');
    expect(context).toContain('ENTRY_MODE="default"');
    expect(context).toContain("After bootstrap, validate with `test -e .circuit/current-run`");
  });

  it("injects review current-changes fast mode context", () => {
    const result = runUserPromptSubmit("/circuit:review current changes");

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Review Current-Changes Contract");
    expect(context).toContain("Review verdict:");
  });

  it("still routes /circuit:review current changes through the parsed-intent path", () => {
    const result = runUserPromptSubmit("/circuit:review current changes please");

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Review Current-Changes Contract");
    expect(context).toContain("Review verdict:");
  });

  it("injects handoff done fast mode context that points to the engine clear command", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-handoff-done-"));
    mkdirSync(projectRoot, { recursive: true });

    const result = runUserPromptSubmit("/circuit:handoff done", {
      cwd: projectRoot,
    });

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Handoff Done Contract");
    expect(context).toContain(".circuit/bin/circuit-engine continuity clear --json");
    expect(context).toContain("removes the mirrored `.circuit/current-run` pointer");
    expect(context).toContain("Do not manually delete handoff files");
    expect(context).not.toContain("handoff.md");
    expect(context).not.toContain("completed-run.md");
  });

  it("injects handoff capture context that prohibits invented aliases", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-handoff-capture-"));
    mkdirSync(projectRoot, { recursive: true });

    const result = runUserPromptSubmit("/circuit:handoff", {
      cwd: projectRoot,
    });

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Handoff Capture Contract");
    expect(context).toContain(".circuit/bin/circuit-engine continuity status --json");
    expect(context).toContain(".circuit/bin/circuit-engine continuity save");
    expect(context).toContain("Do not move `DECIDED:`, `CONSTRAINT:`, `BLOCKED:`, or `RULED OUT:` bullets into `--state-markdown`");
    expect(context).toContain("literal `none` is allowed only as a CLI convenience");
    expect(context).toContain("resume never shows the sentinel");
    expect(context).toContain("/circuit:handoff resume");
    expect(context).toContain("/circuit:handoff done");
    expect(context).toContain("Handoff saved. In the next session, use `/circuit:handoff resume` to pick it up; use `/circuit:handoff done` only to clear it.");
    expect(context).toContain("Do not invent `/circuit:handoff save` or `/circuit:handoff clear` aliases.");
    expect(context).toContain("## Control-Plane Status");
    expect(context).toContain("- selection: none");
    expect(context).toContain("- pending_record: none");
    expect(context).toContain("- current_run: none");
    expect(context).toContain("Do not inspect legacy handoff paths, scan run roots, or write `handoff.md`.");
  });

  it("injects handoff resume fast mode context with control-plane status", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-handoff-resume-"));
    mkdirSync(projectRoot, { recursive: true });

    const result = runUserPromptSubmit("/circuit:handoff resume", {
      cwd: projectRoot,
    });

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Handoff Resume Contract");
    expect(context).toContain(".circuit/bin/circuit-engine continuity resume --json");
    expect(context).toContain("# Circuit Resume");
    expect(context).toContain("## Control-Plane Status");
    expect(context).toContain("- selection: none");
    expect(context).not.toContain("canonical project handoff path");
    expect(context).not.toContain("Only fall back to `.circuit/current-run` when the handoff file is absent.");
  });

  it("injects handoff-reference guidance for workflow prompts that explicitly say continue with the handoff", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-handoff-guidance-"));
    mkdirSync(projectRoot, { recursive: true });
    writePendingContinuity(projectRoot);

    const result = runUserPromptSubmit("/circuit:build continue with the handoff", {
      cwd: projectRoot,
    });

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Continuity Reference");
    expect(context).toContain(".circuit/bin/circuit-engine continuity resume --json");
    expect(context).toContain("## Control-Plane Status");
    expect(context).toContain("- selection: pending_record");
    expect(context).toContain("- pending_record: continuity-pending-record");
    expect(context).not.toContain("canonical project handoff path");
    expect(context).not.toContain("Read this handoff first:");
  });

  it("injects continuity-reference guidance for workflow prompts that use the new continuity wording", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-continuity-guidance-"));
    mkdirSync(projectRoot, { recursive: true });
    writePendingContinuity(projectRoot);

    const result = runUserPromptSubmit("/circuit:build continue from saved continuity", {
      cwd: projectRoot,
    });

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Continuity Reference");
    expect(context).toContain(".circuit/bin/circuit-engine continuity resume --json");
    expect(context).toContain("- selection: pending_record");
  });

  it("injects a run-backed continuity bridge for /circuit:run continue from the handoff", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-run-handoff-"));
    mkdirSync(projectRoot, { recursive: true });
    const runRoot = writeRunBackedPendingContinuity(projectRoot);

    const result = runUserPromptSubmit("/circuit:run continue from the handoff", {
      cwd: projectRoot,
    });

    expect(result.status).toBe(0);
    const context = readAdditionalContext(result);
    expect(context).toContain("Circuit Continuity Reference");
    expect(context).toContain(".circuit/bin/circuit-engine continuity resume --json");
    expect(context).toContain(`- current_run_root: ${runRoot}`);
    expect(context).toContain("## Saved Next Action");
    expect(context).toContain("DO: resume-attached-run-sentinel");
    expect(context).toContain(`.circuit/bin/circuit-engine resume --run-root "${runRoot}" --json`);
    expect(context).toContain("do not invent `run attach`, `attach`, or other rebind commands");
    expect(context).toContain("Do not `cat` `.circuit/current-run`");
  });

  it("does not inject continuity guidance for unrelated prompts that only mention handoff as a noun", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-handoff-noun-"));
    mkdirSync(projectRoot, { recursive: true });
    writePendingContinuity(projectRoot);

    const result = runUserPromptSubmit("/circuit:build use handoff tests to debug the failure", {
      cwd: projectRoot,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("authors helper wrappers that fail clearly when .circuit/plugin-root is missing", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "circuit-local-wrappers-"));
    const pluginRootPath = resolve(projectRoot, ".circuit", "plugin-root");

    const result = runUserPromptSubmit("/circuit:build add dark mode support", { cwd: projectRoot });
    expect(result.status).toBe(0);

    rmSync(pluginRootPath);
    const wrapperResult = spawnSync(resolve(projectRoot, ".circuit/bin/circuit-engine"), ["--help"], {
      cwd: projectRoot,
      encoding: "utf-8",
    });

    expect(wrapperResult.status).not.toBe(0);
    expect(`${wrapperResult.stdout}\n${wrapperResult.stderr}`).toContain(
      "installed plugin root not found",
    );
  });

  it("is executable from an installed copy", () => {
    const copiedRoot = mkdtempSync(join(tmpdir(), "circuit-prompt-hook-"));
    const installRoot = makeInstalledHookRoot(copiedRoot);
    const copiedHook = resolve(installRoot, "hooks/user-prompt-submit.js");
    const projectRoot = resolve(copiedRoot, "project");
    const pluginRootPath = resolve(projectRoot, ".circuit", "plugin-root");
    mkdirSync(projectRoot, { recursive: true });

    const result = spawnSync(copiedHook, {
      cwd: projectRoot,
      input: JSON.stringify({ prompt: "/circuit:build smoke bootstrap" }),
      encoding: "utf-8",
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: installRoot,
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(".circuit/bin/circuit-engine bootstrap");
    expect(readFileSync(pluginRootPath, "utf-8").trim()).toBe(installRoot);
  });
});
