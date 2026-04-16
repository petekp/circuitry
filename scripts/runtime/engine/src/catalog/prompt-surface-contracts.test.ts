import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../schema.js";
import { extract } from "./extract.js";
import {
  buildPromptContractsManifest,
  getPromptSurfaceBlockTargets,
  renderCommandShim,
  renderPromptContractsJson,
} from "./prompt-surface-contracts.js";
import type { UtilityEntry, WorkflowEntry } from "./types.js";

const catalog = extract(resolve(REPO_ROOT, "skills"));

function getWorkflowEntry(slug: string): WorkflowEntry {
  const entry = catalog.find((candidate) => candidate.slug === slug);
  if (!entry || entry.kind !== "workflow") {
    throw new Error(`expected workflow entry for ${slug}`);
  }

  return entry;
}

function getUtilityEntry(slug: string): UtilityEntry {
  const entry = catalog.find((candidate) => candidate.slug === slug);
  if (!entry || entry.kind !== "utility") {
    throw new Error(`expected utility entry for ${slug}`);
  }

  return entry;
}

function getBlockTarget(blockName: string) {
  const target = getPromptSurfaceBlockTargets(REPO_ROOT, catalog).find(
    (candidate) => candidate.blockName === blockName,
  );
  if (!target) {
    throw new Error(`expected block target for ${blockName}`);
  }

  return target;
}

describe("prompt surface contracts", () => {
  it("builds the expected prompt contracts manifest", () => {
    const manifest = buildPromptContractsManifest(catalog);

    expect(manifest.schema_version).toBe("1");
    expect(manifest.helper_wrappers).toEqual([
      {
        name: "circuit-engine",
        path: ".circuit/bin/circuit-engine",
        target: "scripts/relay/circuit-engine.sh",
      },
      {
        name: "compose-prompt",
        path: ".circuit/bin/compose-prompt",
        target: "scripts/relay/compose-prompt.sh",
      },
      {
        name: "dispatch",
        path: ".circuit/bin/dispatch",
        target: "scripts/relay/dispatch.sh",
      },
      {
        name: "update-batch",
        path: ".circuit/bin/update-batch",
        target: "scripts/relay/update-batch.sh",
      },
      {
        name: "gather-git-state",
        path: ".circuit/bin/gather-git-state",
        target: "skills/handoff/scripts/gather-git-state.sh",
      },
    ]);
    expect(Object.keys(manifest.fast_modes).sort()).toEqual([
      "build_smoke",
      "handoff_capture",
      "handoff_done",
      "handoff_resume",
      "review_current_changes",
      "smoke_explore",
      "smoke_migrate",
      "smoke_repair",
      "smoke_sweep",
    ]);
    expect(Object.keys(manifest.surfaces).sort()).toEqual([
      "build",
      "create",
      "explore",
      "handoff",
      "migrate",
      "repair",
      "review",
      "run",
      "sweep",
      "workers",
    ]);
    expect(manifest.surfaces).toMatchObject({
      build: { bootstrap_style: "semantic-bootstrap" },
      create: { bootstrap_style: "guided-utility" },
      explore: { bootstrap_style: "semantic-bootstrap" },
      handoff: { bootstrap_style: "fast-mode-first" },
      migrate: { bootstrap_style: "semantic-bootstrap" },
      repair: { bootstrap_style: "semantic-bootstrap" },
      review: { bootstrap_style: "fast-mode-first" },
      run: { bootstrap_style: "router-then-bootstrap" },
      sweep: { bootstrap_style: "semantic-bootstrap" },
      workers: { bootstrap_style: "adapter-orchestration" },
    });
  });

  it("HANDOFF_CONTINUATION_RULE does not treat empty args or short acknowledgments as auto-resume triggers", () => {
    const workflowBlockNames = [
      "RUN_CONTRACT",
      "BUILD_CONTRACT",
      "EXPLORE_CONTRACT",
      "MIGRATE_CONTRACT",
      "REPAIR_CONTRACT",
      "SWEEP_CONTRACT",
    ] as const;

    for (const blockName of workflowBlockNames) {
      const contract = getBlockTarget(blockName).render(catalog);

      // Narrow auto-resume trigger list: only explicit resume verbs.
      expect(
        contract,
        `${blockName} should have the narrow trigger list`,
      ).toContain(
        "explicit continuation signal (`continue`, `go`, `resume`, `pick up`, `keep going`)",
      );

      // Old trigger text that treated weak signals as auto-resume consent must not reappear.
      expect(
        contract,
        `${blockName} must not re-list empty args as an auto-resume trigger`,
      ).not.toMatch(/`keep going`,\s*empty args/);
      expect(
        contract,
        `${blockName} must not wire weak signals to auto-resume without asking`,
      ).not.toMatch(/short acknowledgment[^\n]*auto-resume without asking/);

      // Weak signals must route through AskUserQuestion, not silent auto-resume.
      expect(
        contract,
        `${blockName} must route weak signals through AskUserQuestion`,
      ).toMatch(/(empty args|short acknowledgments?|ambiguous)[^\n]*AskUserQuestion/);
      expect(
        contract,
        `${blockName} must require consent before consuming saved continuity`,
      ).toContain("before consuming saved continuity");
    }
  });

  it("forbids built-in workflow contracts from using the custom-circuit `--manifest \"@...\"` flag form", () => {
    // Built-in workflows must canonicalize on `--workflow "<slug>"`. The
    // `--manifest "@..."` alias form is reserved for custom circuits per
    // skills/create/SKILL.md. This lint catches drift like "Build's bootstrap
    // contract uses the custom-circuit flag form" (review I3).
    const builtInBlocks = [
      "BUILD_CONTRACT",
      "EXPLORE_CONTRACT",
      "MIGRATE_CONTRACT",
      "REPAIR_CONTRACT",
      "RUN_CONTRACT",
      "SWEEP_CONTRACT",
      "SMOKE_BOOTSTRAP_VERIFICATION",
    ] as const;

    for (const blockName of builtInBlocks) {
      const contract = getBlockTarget(blockName).render(catalog);
      expect(
        contract,
        `${blockName} must not use the custom-circuit \`--manifest "@..."\` flag form`,
      ).not.toMatch(/--manifest\s+"?@/);
    }

    // Built-in fast-mode contracts have the same constraint.
    const manifest = buildPromptContractsManifest(catalog);
    const builtInFastModes = [
      "build_smoke",
      "smoke_explore",
      "smoke_migrate",
      "smoke_repair",
      "smoke_sweep",
    ] as const;

    for (const id of builtInFastModes) {
      const lines = manifest.fast_modes[id].lines.join("\n");
      expect(
        lines,
        `fast mode ${id} must not use the custom-circuit \`--manifest "@..."\` flag form`,
      ).not.toMatch(/--manifest\s+"?@/);
    }
  });

  it("keeps build smoke command fragments aligned across generated surfaces", () => {
    const manifest = buildPromptContractsManifest(catalog);
    const buildContract = getBlockTarget("BUILD_CONTRACT").render(catalog);
    const runContract = getBlockTarget("RUN_CONTRACT").render(catalog);
    const circuitsSmokeContract = getBlockTarget("SMOKE_BOOTSTRAP_VERIFICATION").render(catalog);

    expect(manifest.fast_modes.build_smoke.lines.join("\n")).toContain(
      ".circuit/bin/circuit-engine bootstrap",
    );
    expect(manifest.fast_modes.build_smoke.lines.join("\n")).toContain('--workflow "build"');
    expect(manifest.fast_modes.build_smoke.lines.join("\n")).not.toContain('--manifest "@build"');
    expect(manifest.fast_modes.build_smoke.lines.join("\n")).toContain('--entry-mode "lite"');

    expect(circuitsSmokeContract).toContain(".circuit/bin/circuit-engine bootstrap");
    expect(circuitsSmokeContract).toContain('--workflow "build"');
    expect(circuitsSmokeContract).not.toContain('--manifest "@build"');
    expect(circuitsSmokeContract).toContain('--entry-mode "lite"');

    expect(buildContract).toContain(".circuit/bin/circuit-engine bootstrap");
    expect(buildContract).toContain('--workflow "build"');
    expect(buildContract).not.toContain('--manifest "@build"');
    expect(buildContract).toContain('ENTRY_MODE="lite"');
    expect(buildContract).toContain('--entry-mode "$ENTRY_MODE"');

    expect(runContract).toContain(".circuit/bin/circuit-engine bootstrap");
    expect(runContract).toContain('--workflow "build"');
    expect(runContract).not.toContain('--manifest "@build"');
    expect(runContract).toContain('BUILD_ENTRY_MODE="lite"');
    expect(runContract).toContain('--entry-mode "$BUILD_ENTRY_MODE"');
  });

  it("routes handoff continuity through engine commands across prompt surfaces", () => {
    const manifest = buildPromptContractsManifest(catalog);
    const buildContract = getBlockTarget("BUILD_CONTRACT").render(catalog);
    const exploreContract = getBlockTarget("EXPLORE_CONTRACT").render(catalog);
    const runContract = getBlockTarget("RUN_CONTRACT").render(catalog);
    const handoffBlock = getBlockTarget("HANDOFF_FAST_MODES").render(catalog);

    expect(manifest.fast_modes.handoff_done.lines.join("\n")).toContain(
      ".circuit/bin/circuit-engine continuity clear --json",
    );
    expect(manifest.fast_modes.handoff_resume.lines.join("\n")).toContain(
      ".circuit/bin/circuit-engine continuity resume --json",
    );
    expect(manifest.fast_modes.handoff_done.placeholders).toEqual([]);
    expect(manifest.fast_modes.handoff_resume.placeholders).toEqual([]);

    expect(buildContract).toContain(
      "resolve it through `.circuit/bin/circuit-engine continuity resume --json`",
    );
    expect(buildContract).toContain(
      "Only continue a run when the selected continuity output is run-backed and warning-free.",
    );
    expect(exploreContract).toContain(
      "resolve it through `.circuit/bin/circuit-engine continuity resume --json`",
    );
    expect(exploreContract).toContain(
      "Only continue a run when the selected continuity output is run-backed and warning-free.",
    );
    expect(runContract).toContain(
      "resolve it through `.circuit/bin/circuit-engine continuity resume --json`",
    );
    expect(runContract).toContain(
      "Only continue a run when the selected continuity output is run-backed and warning-free.",
    );
    expect(handoffBlock).toContain(
      "run `.circuit/bin/circuit-engine continuity clear --json`, report completion, and stop.",
    );
    expect(handoffBlock).toContain(
      "run `.circuit/bin/circuit-engine continuity resume --json`, present the selected continuity source",
    );
    expect(handoffBlock).not.toContain("handoff first, active-run fallback second");
  });

  it("uses AskUserQuestion confirmation and explicit-resume guidance in handoff capture", () => {
    const manifest = buildPromptContractsManifest(catalog);
    const handoffCaptureLines = manifest.fast_modes.handoff_capture.lines.join("\n");

    expect(handoffCaptureLines).toContain("AskUserQuestion");
    expect(handoffCaptureLines).toContain(
      "run `/circuit:handoff resume` to inspect and continue",
    );
    expect(handoffCaptureLines).not.toContain("reply with a continuation signal");
    expect(handoffCaptureLines).toContain("closeout");
    expect(handoffCaptureLines).not.toContain("pick it up");
  });

  it("forbids AskUserQuestion in the handoff capture happy path", () => {
    const manifest = buildPromptContractsManifest(catalog);
    const lines = manifest.fast_modes.handoff_capture.lines;
    const joined = lines.join("\n");

    expect(joined).toContain("No modal cascade");
    expect(joined).toContain("Do NOT call AskUserQuestion in the default path");
    expect(joined).not.toContain("Save? / Edit? / Closeout? / Don't save?\n");
    expect(joined).toContain(
      "Only call AskUserQuestion when inference genuinely fails",
    );

    const stepOneIndex = lines.findIndex((line) =>
      line.startsWith("Step 1 -- Draft from conversation context"),
    );
    const stepTwoIndex = lines.findIndex((line) =>
      line.startsWith("Step 2 -- Print a compact preview"),
    );
    const stepThreeIndex = lines.findIndex((line) =>
      line.startsWith("Step 3 -- Save through the engine immediately"),
    );

    expect(stepOneIndex).toBeGreaterThan(-1);
    expect(stepTwoIndex).toBeGreaterThan(stepOneIndex);
    expect(stepThreeIndex).toBeGreaterThan(stepTwoIndex);

    const happyPath = lines.slice(stepOneIndex, stepThreeIndex).join("\n");
    expect(happyPath).not.toContain("AskUserQuestion");
  });

  it("returns the expected prompt surface block targets", () => {
    const pairs = getPromptSurfaceBlockTargets(REPO_ROOT, catalog)
      .map((target) => ({
        blockName: target.blockName,
        filePath: relative(REPO_ROOT, target.filePath),
      }))
      .sort((left, right) => `${left.filePath}:${left.blockName}`.localeCompare(`${right.filePath}:${right.blockName}`));

    expect(pairs).toEqual([
      {
        blockName: "SMOKE_BOOTSTRAP_VERIFICATION",
        filePath: "CIRCUITS.md",
      },
      {
        blockName: "BUILD_CONTRACT",
        filePath: "skills/build/SKILL.md",
      },
      {
        blockName: "EXPLORE_CONTRACT",
        filePath: "skills/explore/SKILL.md",
      },
      {
        blockName: "HANDOFF_FAST_MODES",
        filePath: "skills/handoff/SKILL.md",
      },
      {
        blockName: "MIGRATE_CONTRACT",
        filePath: "skills/migrate/SKILL.md",
      },
      {
        blockName: "REPAIR_CONTRACT",
        filePath: "skills/repair/SKILL.md",
      },
      {
        blockName: "REVIEW_FAST_MODES",
        filePath: "skills/review/SKILL.md",
      },
      {
        blockName: "RUN_CONTRACT",
        filePath: "skills/run/SKILL.md",
      },
      {
        blockName: "SWEEP_CONTRACT",
        filePath: "skills/sweep/SKILL.md",
      },
      {
        blockName: "WORKERS_HELPERS",
        filePath: "skills/workers/SKILL.md",
      },
    ]);
  });

  it("renders the build command shim", () => {
    expect(renderCommandShim(getWorkflowEntry("build"))).toMatchInlineSnapshot(`
      "---
      description: "Build features, scoped refactors, docs, tests, or mixed changes."
      ---

      Direct slash-command invocation for \`/circuit:build\`.

      ## Purpose

      Build features, scoped refactors, docs, tests, or mixed changes.

      ## Examples

      \`\`\`
      /circuit:build add a dark-mode toggle
      /circuit:build refactor the auth middleware
      \`\`\`

      ## Bootstrap Contract

      Launch the \`circuit:build\` skill immediately.
      Use hook-authored helper wrappers from \`.circuit/bin/\` instead of rediscovering plugin paths or cache layout.
      If the request is an explicit smoke/bootstrap verification of the workflow, bootstrap and validate run state, then stop without unrelated repo exploration.
      Valid smoke evidence is the real \`.circuit\` run state and workflow scaffold on disk; repo hygiene or branch status alone does not count.
      For smoke/bootstrap requests, manual \`Write\`/\`Edit\` creation of \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, or \`artifacts/active-run.md\` is a failure; use \`.circuit/bin/circuit-engine bootstrap\` instead.
      Inside that skill, execute its compiled contract block before unrelated repo exploration.
      Do not reinterpret this command as a generic repo-understanding request.
      "
    `);
  });

  it("renders the run command shim", () => {
    expect(renderCommandShim(getWorkflowEntry("run"))).toMatchInlineSnapshot(`
      "---
      description: "The primary Circuit router."
      ---

      Direct slash-command invocation for \`/circuit:run <task>\`.

      ## Purpose

      The primary Circuit router.

      ## Examples

      Prefix a task with a built-in intent to skip classification and dispatch directly:

      | Prefix | Workflow | Rigor |
      |--------|----------|-------|
      | \`fix:\` | Repair | Lite |
      | \`repair:\` | Repair | Deep |
      | \`develop:\` | Build | Standard |
      | \`decide:\` | Explore | Tournament |
      | \`migrate:\` | Migrate | Deep |
      | \`cleanup:\` | Sweep | Standard |
      | \`overnight:\` | Sweep | Autonomous |
      | (none) | (classify) | (auto) |

      \`\`\`
      /circuit:run <task>                         # Router classifies
      /circuit:run fix: login drops the session   # Dispatch to Repair Lite
      /circuit:run develop: add SSO flow          # Dispatch to Build Standard
      /circuit:run cleanup: unused exports        # Dispatch to Sweep Standard
      \`\`\`

      ## Bootstrap Contract

      Launch the \`circuit:run\` skill immediately.
      Use hook-authored helper wrappers from \`.circuit/bin/\` instead of rediscovering plugin paths or cache layout.
      If the request is an explicit smoke/bootstrap verification of the workflow, bootstrap and validate run state, then stop without unrelated repo exploration.
      Valid smoke evidence is the real \`.circuit\` run state and workflow scaffold on disk; repo hygiene or branch status alone does not count.
      For smoke/bootstrap requests, manual \`Write\`/\`Edit\` creation of \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, or \`artifacts/active-run.md\` is a failure; use \`.circuit/bin/circuit-engine bootstrap\` instead.
      Inside that skill, execute its compiled contract block before unrelated repo exploration.
      Do not reinterpret this command as a generic repo-understanding request.
      "
    `);
  });

  it("renders the create command shim", () => {
    expect(renderCommandShim(getUtilityEntry("create"))).toMatchInlineSnapshot(`
      "---
      description: "Generate, validate, and publish a user-global custom circuit workflow."
      ---

      Direct utility invocation for \`/circuit:create\`.

      ## Purpose

      Generate, validate, and publish a user-global custom circuit workflow.

      ## Examples

      \`\`\`
      /circuit:create                             # Guided flow: draft, validate, publish
      \`\`\`

      ## Bootstrap Contract

      Launch the \`circuit:create\` skill immediately.
      First resolve the installed plugin root from \`.circuit/plugin-root\`.
      Do not search the whole repo, plugin cache, or \`$HOME\` to rediscover Circuit docs or skills.
      Use exact paths plus the bundled \`custom-circuits\` helper CLI for catalog checks, draft validation, and publish.
      Keep shell steps short and single-purpose; avoid long chained one-liners unless they are unavoidable.
      "
    `);
  });

  it("renders the prompt contracts json", () => {
    expect(renderPromptContractsJson(catalog)).toMatchInlineSnapshot(`
      "{
        "fast_modes": {
          "build_smoke": {
            "id": "build_smoke",
            "lines": [
              "# Circuit Build Smoke Contract",
              "This prompt is an explicit Build bootstrap smoke verification.",
              "If the prompt uses \`/circuit:run develop:\`, the route is already fixed to Build. Do not rediscover the workflow from repo docs.",
              "Do not run \`--help\`, inspect cache layout, or search the repo to rediscover the bootstrap flags. Use the exact command shape below.",
              "RUN_SLUG=\\"smoke-bootstrap-build-workflow-host-surface\\"  # or the same slug derived from the task",
              "RUN_ROOT=\\".circuit/circuit-runs/\${RUN_SLUG}\\"",
              "test -x .circuit/bin/circuit-engine",
              ".circuit/bin/circuit-engine bootstrap --workflow \\"build\\" --run-root \\"$RUN_ROOT\\" --entry-mode \\"lite\\" --goal \\"<smoke bootstrap objective>\\" --invocation-id \\"\${INVOCATION_ID:-}\\" --project-root \\"$PWD\\"",
              "Do not use \`Write\`, \`Edit\`, heredocs, or manual file creation to fabricate \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, or \`artifacts/active-run.md\`.",
              "After bootstrap, validate with \`test -f\` checks for \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, and \`artifacts/active-run.md\` under \`$RUN_ROOT\`.",
              "After bootstrap, validate those on-disk artifacts, report the selected run root briefly, and stop.",
              "Do not continue into Frame, Plan, Act, Verify, Review, or Close for this smoke request."
            ],
            "placeholders": [],
            "stop_condition": "Stop after validating Build bootstrap artifacts."
          },
          "handoff_done": {
            "id": "handoff_done",
            "lines": [
              "# Circuit Handoff Done Contract",
              "This prompt is the explicit handoff completion fast mode.",
              "Run \`.circuit/bin/circuit-engine continuity clear --json\`.",
              "This clears the pending continuity record and detaches indexed \`current_run\`.",
              "Do not manually delete handoff files, archive dashboards, or scan run roots.",
              "Do not bootstrap new work or do broad repo exploration.",
              "Stop after reporting completion."
            ],
            "placeholders": [],
            "stop_condition": "Stop after clearing continuity."
          },
          "handoff_capture": {
            "id": "handoff_capture",
            "lines": [
              "# Circuit Handoff Capture Contract",
              "This prompt is the default continuity capture mode for \`/circuit:handoff\`.",
              "Default flow: draft from conversation, print a compact preview, save through the engine immediately. No modal cascade.",
              "Check current control-plane status with \`.circuit/bin/circuit-engine continuity status --json\` before deciding what to save. Bare \`/circuit:handoff\` does not pre-inject status; pass \`/circuit:handoff --verbose\` when you want the preamble to include a Control-Plane Status / Warnings block instead of running the status command yourself.",
              "Treat that status as reference only. An existing \`pending_record\` does not satisfy the current bare \`/circuit:handoff\` request.",
              "Step 1 -- Draft from conversation context. Infer goal, next (prefixed DO: or DECIDE:), state (facts the next session needs that git/log/diff cannot show), and debt (typed bullets: DECIDED:, CONSTRAINT:, BLOCKED:, RULED OUT:). Do not interrogate the user for fields the conversation already made clear.",
              "Detect closeout framing. If the user signaled a chapter close (e.g. 'we just finished', 'wrapping up', 'starting fresh on'), treat this as a closeout: goal seeds the next chapter; state lists completed work as DONE: reference bullets; debt carries forward only binding constraints.",
              "Step 2 -- Print a compact preview (no more than ~8 lines: Goal, Next, the State headline, the Debt count). Do not dump the full body. The preview is the user's chance to interrupt before save by typing.",
              "Step 3 -- Save through the engine immediately. Do NOT call AskUserQuestion in the default path. The chained \`Save? / Edit? / Closeout? / Don't save?\` modal cascade is removed.",
              "Only call AskUserQuestion when inference genuinely fails: (a) the auto-draft produced an empty or trivially-restated Goal or Next, or (b) closeout was detected and conversation context provided no clear seed candidate. When asking is warranted, ask exactly one question with predicted responses; never chain a second modal. Field edits go through a free-text revision after save, not through a follow-up modal.",
              "Save with \`.circuit/bin/circuit-engine continuity save --cwd \\"$PWD\\" --goal \\"...\\" --next \\"DO: ...\\" --state-markdown \\"$STATE_MARKDOWN\\" --debt-markdown \\"$DEBT_MARKDOWN\\" --json\`.",
              "When real debt exists, encode it as typed \`--debt-markdown\` bullets.",
              "Do not move \`DECIDED:\`, \`CONSTRAINT:\`, \`BLOCKED:\`, or \`RULED OUT:\` bullets into \`--state-markdown\`; those belong only in \`--debt-markdown\`.",
              "If there is no real debt, literal \`none\` is allowed only as a CLI convenience; the engine normalizes it before persistence so resume never shows the sentinel.",
              "If indexed \`current_run\` exists, bind the save to that run with \`--run-root\` using the indexed run root from control-plane status.",
              "Do not stop after merely summarizing current status, active-run state, or an already-saved pending record.",
              "Use \`.circuit/bin/gather-git-state\` when git context is helpful, but do not restate facts a future session can recover cheaply from git.",
              "If there is no indexed current run, no pending record, and no hard-to-rediscover session context worth preserving, say there is nothing useful to capture and stop.",
              "Supported handoff commands are \`/circuit:handoff\`, \`/circuit:handoff resume\`, and \`/circuit:handoff done\`.",
              "Do not invent \`/circuit:handoff save\` or \`/circuit:handoff clear\` aliases.",
              "Do not inspect legacy handoff paths, scan run roots, or write \`handoff.md\`.",
              "After a successful save, confirm briefly with: Handoff saved. Next session: run \`/circuit:handoff resume\` to inspect and continue, or name a new task via \`/circuit:run <task>\` to start fresh.",
              "Do not dump the saved continuity body back to the user during capture mode.",
              "Stop after either reporting that nothing useful could be captured or confirming the save."
            ],
            "placeholders": [],
            "stop_condition": "Stop after saving continuity or reporting that no capture is needed."
          },
          "handoff_resume": {
            "id": "handoff_resume",
            "lines": [
              "# Circuit Handoff Resume Contract",
              "This prompt is the explicit continuity resume fast mode.",
              "Run \`.circuit/bin/circuit-engine continuity resume --json\`.",
              "This resolves continuity only through the control plane in priority order: pending_record, current_run, none.",
              "Start the response with \`# Circuit Resume\`.",
              "If \`source\` is \`pending_record\`, present the saved narrative and warnings from the command output.",
              "If \`source\` is \`current_run\`, present the returned \`active_run_markdown\`.",
              "If \`source\` is \`none\`, report \`No saved continuity found. Nothing to resume.\`",
              "Do not inspect canonical handoff paths, scan run roots, or surface fallback-only guesses.",
              "Do not bootstrap new work or do broad repo exploration.",
              "Stop after presenting the resume context."
            ],
            "placeholders": [],
            "stop_condition": "Stop after presenting saved continuity."
          },
          "smoke_explore": {
            "id": "smoke_explore",
            "lines": [
              "# Circuit Explore Smoke Contract",
              "This prompt is an explicit Explore bootstrap smoke verification.",
              "Do not run \`--help\`, inspect cache layout, or search the repo to rediscover the bootstrap flags. Use the exact command shape below.",
              "RUN_SLUG=\\"explore-smoke-bootstrap\\"  # or the same slug derived from the task",
              "RUN_ROOT=\\".circuit/circuit-runs/\${RUN_SLUG}\\"",
              "ENTRY_MODE=\\"default\\"",
              "test -x .circuit/bin/circuit-engine",
              ".circuit/bin/circuit-engine bootstrap --workflow \\"explore\\" --run-root \\"$RUN_ROOT\\" --entry-mode \\"$ENTRY_MODE\\" --goal \\"<smoke bootstrap objective>\\" --invocation-id \\"\${INVOCATION_ID:-}\\" --project-root \\"$PWD\\"",
              "After bootstrap, validate with \`test -f\` checks for \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, and \`artifacts/active-run.md\` under \`$RUN_ROOT\`.",
              "Do not use \`Write\`, \`Edit\`, heredocs, or manual file creation to fabricate \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, or \`artifacts/active-run.md\`.",
              "Validate those on-disk artifacts, report the selected run root briefly, and stop.",
              "Do not continue into the normal workflow phases or broader repo exploration for this smoke request."
            ],
            "placeholders": [],
            "stop_condition": "Stop after validating bootstrap artifacts."
          },
          "smoke_migrate": {
            "id": "smoke_migrate",
            "lines": [
              "# Circuit Migrate Smoke Contract",
              "This prompt is an explicit Migrate bootstrap smoke verification.",
              "Do not run \`--help\`, inspect cache layout, or search the repo to rediscover the bootstrap flags. Use the exact command shape below.",
              "RUN_SLUG=\\"migrate-smoke-bootstrap\\"  # or the same slug derived from the task",
              "RUN_ROOT=\\".circuit/circuit-runs/\${RUN_SLUG}\\"",
              "ENTRY_MODE=\\"default\\"",
              "test -x .circuit/bin/circuit-engine",
              ".circuit/bin/circuit-engine bootstrap --workflow \\"migrate\\" --run-root \\"$RUN_ROOT\\" --entry-mode \\"$ENTRY_MODE\\" --goal \\"<smoke bootstrap objective>\\" --invocation-id \\"\${INVOCATION_ID:-}\\" --project-root \\"$PWD\\"",
              "After bootstrap, validate with \`test -f\` checks for \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, and \`artifacts/active-run.md\` under \`$RUN_ROOT\`.",
              "Do not use \`Write\`, \`Edit\`, heredocs, or manual file creation to fabricate \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, or \`artifacts/active-run.md\`.",
              "Validate those on-disk artifacts, report the selected run root briefly, and stop.",
              "Do not continue into the normal workflow phases or broader repo exploration for this smoke request."
            ],
            "placeholders": [],
            "stop_condition": "Stop after validating bootstrap artifacts."
          },
          "smoke_repair": {
            "id": "smoke_repair",
            "lines": [
              "# Circuit Repair Smoke Contract",
              "This prompt is an explicit Repair bootstrap smoke verification.",
              "Do not run \`--help\`, inspect cache layout, or search the repo to rediscover the bootstrap flags. Use the exact command shape below.",
              "RUN_SLUG=\\"repair-smoke-bootstrap\\"  # or the same slug derived from the task",
              "RUN_ROOT=\\".circuit/circuit-runs/\${RUN_SLUG}\\"",
              "ENTRY_MODE=\\"default\\"",
              "test -x .circuit/bin/circuit-engine",
              ".circuit/bin/circuit-engine bootstrap --workflow \\"repair\\" --run-root \\"$RUN_ROOT\\" --entry-mode \\"$ENTRY_MODE\\" --goal \\"<smoke bootstrap objective>\\" --invocation-id \\"\${INVOCATION_ID:-}\\" --project-root \\"$PWD\\"",
              "After bootstrap, validate with \`test -f\` checks for \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, and \`artifacts/active-run.md\` under \`$RUN_ROOT\`.",
              "Do not use \`Write\`, \`Edit\`, heredocs, or manual file creation to fabricate \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, or \`artifacts/active-run.md\`.",
              "Validate those on-disk artifacts, report the selected run root briefly, and stop.",
              "Do not continue into the normal workflow phases or broader repo exploration for this smoke request."
            ],
            "placeholders": [],
            "stop_condition": "Stop after validating bootstrap artifacts."
          },
          "smoke_sweep": {
            "id": "smoke_sweep",
            "lines": [
              "# Circuit Sweep Smoke Contract",
              "This prompt is an explicit Sweep bootstrap smoke verification.",
              "Do not run \`--help\`, inspect cache layout, or search the repo to rediscover the bootstrap flags. Use the exact command shape below.",
              "RUN_SLUG=\\"sweep-smoke-bootstrap\\"  # or the same slug derived from the task",
              "RUN_ROOT=\\".circuit/circuit-runs/\${RUN_SLUG}\\"",
              "ENTRY_MODE=\\"default\\"",
              "test -x .circuit/bin/circuit-engine",
              ".circuit/bin/circuit-engine bootstrap --workflow \\"sweep\\" --run-root \\"$RUN_ROOT\\" --entry-mode \\"$ENTRY_MODE\\" --goal \\"<smoke bootstrap objective>\\" --invocation-id \\"\${INVOCATION_ID:-}\\" --project-root \\"$PWD\\"",
              "After bootstrap, validate with \`test -f\` checks for \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, and \`artifacts/active-run.md\` under \`$RUN_ROOT\`.",
              "Do not use \`Write\`, \`Edit\`, heredocs, or manual file creation to fabricate \`circuit.manifest.yaml\`, \`events.ndjson\`, the derived \`state.json\` snapshot, or \`artifacts/active-run.md\`.",
              "Validate those on-disk artifacts, report the selected run root briefly, and stop.",
              "Do not continue into the normal workflow phases or broader repo exploration for this smoke request."
            ],
            "placeholders": [],
            "stop_condition": "Stop after validating bootstrap artifacts."
          },
          "review_current_changes": {
            "id": "review_current_changes",
            "lines": [
              "# Circuit Review Current-Changes Contract",
              "This prompt is the explicit current-changes review fast mode.",
              "Do not bootstrap \`.circuit\` state or do broad repo exploration.",
              "Inspect only the current uncommitted diff in the working tree.",
              "Mention the concrete paths you reviewed, including \`review-scope-sentinel.ts\` when it is part of the diff.",
              "End the response with a line that begins \`Review verdict:\`.",
              "Stop after the review result."
            ],
            "placeholders": [],
            "stop_condition": "Stop after the review result."
          }
        },
        "helper_wrappers": [
          {
            "name": "circuit-engine",
            "path": ".circuit/bin/circuit-engine",
            "target": "scripts/relay/circuit-engine.sh"
          },
          {
            "name": "compose-prompt",
            "path": ".circuit/bin/compose-prompt",
            "target": "scripts/relay/compose-prompt.sh"
          },
          {
            "name": "dispatch",
            "path": ".circuit/bin/dispatch",
            "target": "scripts/relay/dispatch.sh"
          },
          {
            "name": "update-batch",
            "path": ".circuit/bin/update-batch",
            "target": "scripts/relay/update-batch.sh"
          },
          {
            "name": "gather-git-state",
            "path": ".circuit/bin/gather-git-state",
            "target": "skills/handoff/scripts/gather-git-state.sh"
          }
        ],
        "schema_version": "1",
        "surfaces": {
          "build": {
            "bootstrap_style": "semantic-bootstrap",
            "canonical_command": ".circuit/bin/circuit-engine bootstrap --workflow build",
            "helper_wrappers": [
              "circuit-engine",
              "compose-prompt",
              "dispatch"
            ],
            "proof_artifacts": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "stop_condition": "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Plan, Act, Verify, Review, or Close.",
            "forbidden_manual_fabrication": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "canonical_invocation": "/circuit:build",
            "kind": "workflow"
          },
          "create": {
            "bootstrap_style": "guided-utility",
            "helper_wrappers": [
              "circuit-engine"
            ],
            "proof_artifacts": [
              "~/.claude/circuit/drafts/<slug>/SKILL.md",
              "~/.claude/circuit/drafts/<slug>/circuit.yaml",
              "~/.claude/circuit/overlay/manifest.json"
            ],
            "stop_condition": "Draft, validate, summarize, and wait for explicit publish confirmation before materializing installed command surface changes.",
            "canonical_invocation": "/circuit:create",
            "kind": "utility"
          },
          "explore": {
            "bootstrap_style": "semantic-bootstrap",
            "canonical_command": ".circuit/bin/circuit-engine bootstrap --workflow explore",
            "helper_wrappers": [
              "circuit-engine",
              "compose-prompt",
              "dispatch"
            ],
            "proof_artifacts": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "stop_condition": "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Analyze, Decide/Plan, or Close.",
            "forbidden_manual_fabrication": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "canonical_invocation": "/circuit:explore",
            "kind": "workflow"
          },
          "handoff": {
            "bootstrap_style": "fast-mode-first",
            "helper_wrappers": [
              "circuit-engine",
              "gather-git-state"
            ],
            "proof_artifacts": [
              ".circuit/control-plane/continuity-index.json",
              ".circuit/control-plane/continuity-records/<record-id>.json"
            ],
            "stop_condition": "Resolve the selected fast mode before any broader repo exploration.",
            "canonical_invocation": "/circuit:handoff",
            "kind": "utility"
          },
          "migrate": {
            "bootstrap_style": "semantic-bootstrap",
            "canonical_command": ".circuit/bin/circuit-engine bootstrap --workflow migrate",
            "helper_wrappers": [
              "circuit-engine",
              "compose-prompt",
              "dispatch"
            ],
            "proof_artifacts": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "stop_condition": "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Analyze, Plan, Act, Verify, Review, or Close.",
            "forbidden_manual_fabrication": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "canonical_invocation": "/circuit:migrate",
            "kind": "workflow"
          },
          "repair": {
            "bootstrap_style": "semantic-bootstrap",
            "canonical_command": ".circuit/bin/circuit-engine bootstrap --workflow repair",
            "helper_wrappers": [
              "circuit-engine"
            ],
            "proof_artifacts": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "stop_condition": "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Analyze, Fix, Verify, Review, or Close.",
            "forbidden_manual_fabrication": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "canonical_invocation": "/circuit:repair",
            "kind": "workflow"
          },
          "review": {
            "bootstrap_style": "fast-mode-first",
            "helper_wrappers": [
              "compose-prompt",
              "dispatch"
            ],
            "proof_artifacts": [
              "review.md"
            ],
            "stop_condition": "Execute the selected review fast mode before broader context gathering.",
            "canonical_invocation": "/circuit:review",
            "kind": "utility"
          },
          "run": {
            "bootstrap_style": "router-then-bootstrap",
            "canonical_command": ".circuit/bin/circuit-engine bootstrap --workflow build",
            "helper_wrappers": [
              "circuit-engine",
              "dispatch"
            ],
            "proof_artifacts": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "stop_condition": "If the task is an explicit smoke/bootstrap verification, stop after validating the selected workflow run state.",
            "forbidden_manual_fabrication": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "canonical_invocation": "/circuit:run <task>",
            "kind": "workflow"
          },
          "sweep": {
            "bootstrap_style": "semantic-bootstrap",
            "canonical_command": ".circuit/bin/circuit-engine bootstrap --workflow sweep",
            "helper_wrappers": [
              "circuit-engine",
              "compose-prompt",
              "dispatch"
            ],
            "proof_artifacts": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "stop_condition": "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Survey, Queue, Batch Execute, Verify, Deferred Review, or Close.",
            "forbidden_manual_fabrication": [
              "circuit.manifest.yaml",
              "events.ndjson",
              "state.json",
              "artifacts/active-run.md"
            ],
            "canonical_invocation": "/circuit:sweep",
            "kind": "workflow"
          },
          "workers": {
            "bootstrap_style": "adapter-orchestration",
            "helper_wrappers": [
              "compose-prompt",
              "dispatch",
              "update-batch"
            ],
            "proof_artifacts": [
              "{relay_root}/batch.json"
            ],
            "stop_condition": "Use only the adapter-owned relay helpers and stop after the orchestration state is updated.",
            "canonical_invocation": "circuit:workers (internal adapter)",
            "kind": "adapter"
          }
        }
      }
      "
    `);
  });
});
