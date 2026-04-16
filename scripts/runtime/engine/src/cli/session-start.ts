#!/usr/bin/env node

import { existsSync } from "node:fs";

import { getContinuityStatus } from "../continuity-commands.js";
import {
  clearContinuityCurrentRun,
  type ContinuityRecordV1,
} from "../continuity-control-plane.js";
import { ensureCircuitHome } from "../ensure-circuit-dirs.js";
import { resolveProjectRoot } from "../project-root.js";
import { renderActiveRun } from "../render-active-run.js";

function printPendingContinuityBanner(
  record: ContinuityRecordV1 | null,
  warnings: string[],
): void {
  const lines: string[] = ["> **Circuit continuity pending.**"];

  if (record?.narrative.goal) {
    lines.push(`> Goal: ${record.narrative.goal}`);
  }
  if (record?.narrative.next) {
    lines.push(`> Next: ${record.narrative.next}`);
  }

  lines.push(
    ">",
    "> **To pick back up:**",
    "> - Run `/circuit:handoff resume` to inspect and continue the saved record.",
    "> - Or invoke a Circuit workflow with a continuation arg (for example `/circuit:run continue`) -- Circuit auto-resumes from pending continuity.",
    "> - Or name a concrete new task via `/circuit:run <task>` -- Circuit treats that as override and starts fresh.",
    "> - Or run `/circuit:handoff done` to clear pending continuity.",
    "> Available: pending continuity",
    ...warnings.map((warning) => `> Warning: ${warning}`),
    "",
  );

  process.stdout.write(lines.join("\n"));
}

function printCurrentRunFallbackBanner(): void {
  const lines: string[] = [
    "> **Circuit active run attached.**",
    "> No pending continuity record -- the indexed current_run is a fallback attachment, not saved handoff authority.",
    "> Name your next task to continue, or use a Circuit handoff command to manage the attachment.",
    "> Available: active run",
    "",
  ];

  process.stdout.write(lines.join("\n"));
}

function printWelcome(): void {
  process.stdout.write(
    [
      "Circuit is active. Try one of these to get started:",
      "",
      "  /circuit:run fix: login form rejects valid emails       Bug fix with test-first discipline",
      "  /circuit:run add dark mode support to the settings page  Router picks the right workflow",
      "  /circuit:run decide: REST vs GraphQL for the new API     Adversarial evaluation of options",
      "  /circuit:create research workflow for RFC pre-reads      Draft and publish a reusable custom circuit",
      "",
      "Intent-hint prefixes skip routing and dispatch directly:",
      "  fix: → Repair Lite      repair: → Repair Deep      develop: → Build Standard",
      "  decide: → Explore Tournament      migrate: → Migrate Deep",
      "  cleanup: → Sweep Standard      overnight: → Sweep Autonomous",
      "",
      "Circuit classifies your task into the right workflow (Explore, Build, Repair,",
      "Migrate, Sweep), selects a rigor level, and runs it. You step in at checkpoints.",
      "If a session crashes, the next one picks up where it stopped.",
      "",
    ].join("\n"),
  );
}

function main(): number {
  // Best-effort: ensure user-global circuit directories exist.
  const homeInit = ensureCircuitHome(process.env.HOME ?? undefined);
  for (const warning of homeInit.warnings) {
    process.stderr.write(`circuit: ${warning}\n`);
  }

  const projectRoot = resolveProjectRoot(process.cwd());
  let continuity = getContinuityStatus(projectRoot);

  // Clear stale current_run pointers whose run root no longer exists, then
  // re-read the control-plane snapshot so downstream banner/render decisions
  // don't operate on the pre-clear in-memory state.
  if (continuity.current_run) {
    const runRoot = continuity.current_run.run_root;
    if (!existsSync(runRoot)) {
      clearContinuityCurrentRun(projectRoot);
      process.stderr.write(
        `circuit: cleared stale current_run attachment: ${continuity.current_run.run_slug}\n`,
      );
      continuity = getContinuityStatus(projectRoot);
    }
  }

  if (!continuity.pending_record && continuity.current_run?.manifest_present) {
    try {
      renderActiveRun(continuity.current_run.run_root);
    } catch {
      process.stderr.write(
        `warning: circuit-engine render failed for ${continuity.current_run.run_root}; using last saved dashboard\n`,
      );
    }
  }

  if (continuity.pending_record) {
    printPendingContinuityBanner(continuity.record, continuity.warnings);
    return 0;
  }

  if (continuity.current_run) {
    printCurrentRunFallbackBanner();
    return 0;
  }

  printWelcome();
  return 0;
}

process.exit(main());
