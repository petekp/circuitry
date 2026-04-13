#!/usr/bin/env node

import { getContinuityStatus } from "../continuity-commands.js";
import { resolveProjectRoot } from "../project-root.js";
import { renderActiveRun } from "../render-active-run.js";

function printContinuityBanner(available: string, warnings: string[]): void {
  process.stdout.write(
    [
      "> **Circuit continuity available.** This is context only.",
      "> Fresh `/circuit:*` commands should be honored as the active task.",
      "> Resume saved continuity only through `/circuit:handoff resume`.",
      `> Available: ${available}`,
      ...warnings.map((warning) => `> Warning: ${warning}`),
      "",
    ].join("\n"),
  );
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
      "Circuit classifies your task into the right workflow (Explore, Build, Repair,",
      "Migrate, Sweep), selects a rigor level, and runs it. You step in at checkpoints.",
      "If a session crashes, the next one picks up where it stopped.",
      "",
    ].join("\n"),
  );
}

function main(): number {
  const projectRoot = resolveProjectRoot(process.cwd());
  const continuity = getContinuityStatus(projectRoot);

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
    printContinuityBanner("pending continuity", continuity.warnings);
    return 0;
  }

  if (continuity.current_run) {
    printContinuityBanner("active run", []);
    return 0;
  }

  printWelcome();
  return 0;
}

process.exit(main());
