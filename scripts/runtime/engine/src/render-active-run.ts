import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadManifest } from "./derive-state.js";
import { deriveValidatedStateFromRun } from "./derive-state.js";
import { writeTextFileAtomic } from "./file-utils.js";
import {
  findStepById,
  resolveRequestPath,
  resolveResponsePath,
  resolveResultPath,
  type CircuitManifestStep,
} from "./manifest-utils.js";
import { extractFirstTitleLine, extractH2SectionBodies } from "./markdown-utils.js";
export interface RenderActiveRunResult {
  activeRunPath: string;
  currentPhase: string;
  markdown: string;
  nextStep: string;
  runRoot: string;
  state: Record<string, any>;
  status: string;
}

function titleCaseLabel(value: string): string {
  return value
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function rigorLabel(entryMode: string): string {
  switch (entryMode) {
    case "default":
      return "Standard";
    case "lite":
      return "Lite";
    case "deep":
      return "Deep";
    case "autonomous":
      return "Autonomous";
    default:
      return titleCaseLabel(entryMode);
  }
}

function readMarkdownIfPresent(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

function normalizeGoalTitle(title: string | null): string | null {
  if (!title) {
    return null;
  }

  const normalized = title.replace(/^(brief|result):\s*/i, "").trim();
  return normalized.length > 0 ? normalized : title.trim();
}

function fallbackGoal(runRoot: string): string {
  const briefTitle = normalizeGoalTitle(
    extractFirstTitleLine(
      readMarkdownIfPresent(join(runRoot, "artifacts/brief.md")) ?? "",
    ),
  );
  if (briefTitle) {
    return briefTitle;
  }

  const resultTitle = normalizeGoalTitle(
    extractFirstTitleLine(
      readMarkdownIfPresent(join(runRoot, "artifacts/result.md")) ?? "",
    ),
  );
  if (resultTitle) {
    return resultTitle;
  }

  return "unknown";
}

function verificationCommands(runRoot: string): string {
  const plan = readMarkdownIfPresent(join(runRoot, "artifacts/plan.md"));
  if (plan) {
    const section = extractH2SectionBodies(plan)["Verification Commands"];
    if (section && section.length > 0) {
      return section;
    }
  }

  const brief = readMarkdownIfPresent(join(runRoot, "artifacts/brief.md"));
  if (brief) {
    const section = extractH2SectionBodies(brief)["Verification Commands"];
    if (section && section.length > 0) {
      return section;
    }
  }

  return "TBD during Frame phase";
}

function isTerminalStatus(status: string): boolean {
  return ["aborted", "completed", "stopped", "blocked", "handed_off"].includes(status);
}

function terminalPhaseToken(status: string | undefined): string {
  switch (status) {
    case "completed":
      return "close";
    case "aborted":
      return "aborted";
    case "blocked":
      return "blocked";
    case "handed_off":
      return "pause";
    case "stopped":
      return "pause";
    default:
      return "initialized";
  }
}

function currentPhase(state: Record<string, any>): string {
  if (typeof state.current_step === "string" && state.current_step.length > 0) {
    return state.current_step;
  }

  return terminalPhaseToken(
    typeof state.status === "string" ? state.status : undefined,
  );
}

function routeAllowsVerdict(
  step: CircuitManifestStep | null,
  verdict: string | undefined,
): boolean {
  if (!step || !verdict) {
    return false;
  }

  const gate = (step.gate ?? {}) as Record<string, unknown>;
  const passList = Array.isArray(gate.pass)
    ? gate.pass.filter((entry): entry is string => typeof entry === "string")
    : [];

  return passList.includes(verdict);
}

function checkpointResponsePath(
  state: Record<string, any>,
  step: CircuitManifestStep,
): string {
  const attempt = state.checkpoints?.[step.id]?.attempt ?? 1;
  return resolveResponsePath(step, step.id, attempt);
}

function dispatchResultPath(
  state: Record<string, any>,
  step: CircuitManifestStep,
): string {
  const attempt = state.jobs?.[step.id]?.attempt ?? 1;
  return resolveResultPath(step, step.id, attempt);
}

function blockersForState(
  state: Record<string, any>,
  step: CircuitManifestStep | null,
): string {
  if (state.status === "waiting_checkpoint" && step) {
    return `waiting on checkpoint response at ${checkpointResponsePath(state, step)}`;
  }

  if (state.status === "waiting_worker" && step) {
    return `waiting on worker result at ${dispatchResultPath(state, step)}`;
  }

  if (state.status === "blocked") {
    return "run is blocked";
  }

  const job = step ? state.jobs?.[step.id] : null;
  if (job?.status === "failed" && job.completion === "partial") {
    return `partial completion for ${step?.id}; retry with next dispatch attempt`;
  }
  if (job?.status === "failed" && job.completion === "blocked") {
    return `blocked completion for ${step?.id}; resolve dependency before retry`;
  }
  if (
    step &&
    job?.status === "complete" &&
    typeof job.verdict === "string" &&
    !state.routes?.[step.id] &&
    !routeAllowsVerdict(step, job.verdict)
  ) {
    return `verdict mismatch for ${step.id}: ${job.verdict}`;
  }

  return "none";
}

function nextStepForState(
  state: Record<string, any>,
  step: CircuitManifestStep | null,
): string {
  if (isTerminalStatus(state.status ?? "")) {
    return "complete";
  }

  if (!step) {
    return "complete";
  }

  if (state.status === "waiting_checkpoint") {
    return `Resolve ${checkpointResponsePath(state, step)} and run resolve-checkpoint for ${step.id}.`;
  }

  if (state.status === "waiting_worker") {
    return `Reconcile ${dispatchResultPath(state, step)} and run reconcile-dispatch for ${step.id}.`;
  }

  const job = state.jobs?.[step.id];
  if (job?.status === "failed" && job.completion === "partial") {
    return `Retry dispatch for ${step.id} with attempt ${job.attempt + 1}.`;
  }
  if (job?.status === "failed" && job.completion === "blocked") {
    return `Resolve the dependency blocking ${step.id}, then retry dispatch.`;
  }
  if (
    job?.status === "complete" &&
    typeof job.verdict === "string" &&
    !state.routes?.[step.id] &&
    !routeAllowsVerdict(step, job.verdict)
  ) {
    return `Fix findings from verdict ${job.verdict} and re-dispatch ${step.id}.`;
  }

  if (step.kind === "synthesis") {
    const artifactPath = (step.writes as Record<string, any>)?.artifact?.path;
    return `Write ${artifactPath} and run complete-synthesis for ${step.id}.`;
  }

  if (step.kind === "checkpoint" && !state.checkpoints?.[step.id]) {
    const artifactPath = (step.writes as Record<string, any>)?.artifact?.path;
    const requestPath = resolveRequestPath(step, step.id, 1);
    return `Write ${artifactPath}, write ${requestPath}, then run request-checkpoint for ${step.id}.`;
  }

  if (step.kind === "dispatch" && !state.jobs?.[step.id]) {
    return `Prepare ${resolveRequestPath(step, step.id, 1)} for ${step.id} and run dispatch-step.`;
  }

  return `Continue ${step.id}.`;
}

export function renderActiveRun(runRoot: string): RenderActiveRunResult {
  const manifest = loadManifest(runRoot) as Record<string, any>;
  const state = deriveValidatedStateFromRun(runRoot, { persist: true });
  const activeRunPath = join(runRoot, "artifacts/active-run.md");
  const step = typeof state.current_step === "string"
    ? findStepById(manifest, state.current_step)
    : null;
  const phase = currentPhase(state);
  const markdown = [
    "# Active Run",
    "## Workflow",
    titleCaseLabel(manifest.circuit.id as string),
    "## Rigor",
    rigorLabel((state.selected_entry_mode ?? "default") as string),
    "## Current Phase",
    phase,
    "## Goal",
    (typeof state.goal === "string" && state.goal.length > 0)
      ? state.goal
      : fallbackGoal(runRoot),
    "## Next Step",
    nextStepForState(state, step),
    "## Verification Commands",
    verificationCommands(runRoot),
    "## Active Worktrees",
    "none",
    "## Blockers",
    blockersForState(state, step),
    "## Last Updated",
    (state.updated_at ?? state.started_at ?? "") as string,
    "",
  ].join("\n");

  writeTextFileAtomic(activeRunPath, markdown);

  return {
    activeRunPath,
    currentPhase: phase,
    markdown,
    nextStep: nextStepForState(state, step),
    runRoot,
    state,
    status: (state.status ?? "initialized") as string,
  };
}
