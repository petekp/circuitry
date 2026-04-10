import { join } from "node:path";

import { bootstrapRun } from "./bootstrap.js";
import { requestCheckpoint, resolveCheckpoint } from "./checkpoint-step.js";
import { completeSynthesisStep } from "./complete-synthesis.js";
import { dispatchStep, reconcileDispatch } from "./dispatch-step.js";
import {
  loadBuildManifest,
  makeTempProject,
  writeManifestFile,
  writeRunFile,
  writeRunJson,
} from "./outer-engine-test-utils.js";

export function buildBriefMarkdown(): string {
  return [
    "# Brief: Event-backed Build",
    "## Objective",
    "Ship the outer event engine.",
    "## Scope",
    "Build only.",
    "## Output Types",
    "code, tests, docs",
    "## Success Criteria",
    "All targeted checks pass.",
    "## Constraints",
    "Do not broaden scope.",
    "## Verification Commands",
    "npm test",
    "npm run lint",
    "## Out of Scope",
    "Other workflows.",
    "",
  ].join("\n");
}

export function buildPlanMarkdown(): string {
  return [
    "# Plan: Event-backed Build",
    "## Approach",
    "Wire the semantic engine on the outer path.",
    "## Slices",
    "### Slice 1: bootstrap",
    "Create the run and render the dashboard.",
    "## Verification Commands",
    "npm test",
    "npm run lint",
    "",
  ].join("\n");
}

export function buildVerificationMarkdown(): string {
  return [
    "# Verification: Event-backed Build",
    "## Verification Results",
    "- npm test: PASS",
    "- npm run lint: PASS",
    "",
  ].join("\n");
}

export function buildResultMarkdown(): string {
  return [
    "# Result: Event-backed Build",
    "## Changes",
    "Implemented the outer engine path.",
    "## Verification",
    "All targeted checks passed.",
    "## PR Summary",
    "Ready to ship.",
    "",
  ].join("\n");
}

export function createBuildRun(goal = "Make Build event-backed") {
  const { projectRoot, runRoot, slug } = makeTempProject();
  const manifestPath = join(projectRoot, "build.manifest.yaml");
  writeManifestFile(manifestPath, loadBuildManifest());

  bootstrapRun({
    entryMode: "default",
    goal,
    headAtStart: "abc1234",
    manifestPath,
    projectRoot,
    runRoot,
  });

  return {
    manifestPath,
    projectRoot,
    runRoot,
    slug,
  };
}

export function writeFrameInputs(runRoot: string): void {
  writeRunFile(runRoot, "artifacts/brief.md", buildBriefMarkdown());
  writeRunJson(runRoot, "checkpoints/frame-1.request.json", {
    prompt: "continue?",
  });
}

export function resolveFrame(runRoot: string): void {
  writeFrameInputs(runRoot);
  requestCheckpoint({ runRoot, step: "frame" });
  writeRunJson(runRoot, "checkpoints/frame-1.response.json", {
    selection: "continue",
  });
  resolveCheckpoint({ runRoot, step: "frame" });
}

export function advanceToAct(runRoot: string): void {
  resolveFrame(runRoot);
  writeRunFile(runRoot, "artifacts/plan.md", buildPlanMarkdown());
  completeSynthesisStep({ runRoot, step: "plan" });
}

export function startAct(runRoot: string, withReceipt = false): void {
  advanceToAct(runRoot);
  writeRunFile(
    runRoot,
    "artifacts/implementation-handoff.md",
    "# Implementation Handoff\n\nDeliver the change.\n",
  );
  writeRunJson(runRoot, "phases/implement/jobs/act-1.request.json", {
    task: "implement",
  });
  if (withReceipt) {
    writeRunJson(runRoot, "phases/implement/jobs/act-1.receipt.json", {
      adapter: "codex",
      output_file: "unused",
      prompt_file: "unused",
      resolved_from: "dispatch.default",
      status: "completed",
      transport: "process",
    });
  }
  dispatchStep({ runRoot, step: "act" });
}

export function finishAct(runRoot: string): void {
  startAct(runRoot);
  writeRunJson(runRoot, "phases/implement/jobs/act-1.result.json", {
    completion: "complete",
    verdict: "complete_and_hardened",
  });
  reconcileDispatch({ runRoot, step: "act" });
}

export function advanceToReview(runRoot: string): void {
  finishAct(runRoot);
  writeRunFile(runRoot, "artifacts/verification.md", buildVerificationMarkdown());
  completeSynthesisStep({ runRoot, step: "verify" });
}

export function startReview(runRoot: string, withReceipt = false): void {
  advanceToReview(runRoot);
  writeRunFile(runRoot, "artifacts/review.md", "# Review\n\nReview findings.\n");
  writeRunJson(runRoot, "phases/review/jobs/review-1.request.json", {
    task: "review",
  });
  if (withReceipt) {
    writeRunJson(runRoot, "phases/review/jobs/review-1.receipt.json", {
      adapter: "codex",
      output_file: "unused",
      prompt_file: "unused",
      resolved_from: "dispatch.default",
      status: "completed",
      transport: "process",
    });
  }
  dispatchStep({ runRoot, step: "review" });
}
