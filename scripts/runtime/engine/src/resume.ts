/**
 * Find the resume point for a Circuit run.
 *
 * Library module -- exports pure functions, no CLI concerns.
 * Loads the manifest and state, walks steps in graph order,
 * and finds the first incomplete step as the resume point.
 */

import {
  deriveValidatedStateFromRun,
} from "./derive-state.js";
import { findStepById } from "./manifest-utils.js";

export class RebuildError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RebuildError";
  }
}

// ─── State loading ───────────────────────────────────────────────────

/**
 * Derive the canonical run state from replay and refresh state.json as an
 * output artifact for tooling and inspection.
 */
export function loadOrRebuildState(runRoot: string): object {
  try {
    return deriveValidatedStateFromRun(runRoot, { persist: true });
  } catch (err) {
    throw new RebuildError(
      `State replay failed for ${runRoot}: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}

// ─── Step graph helpers ──────────────────────────────────────────────

/**
 * Extract the ordered list of steps from the manifest.
 */
export function buildStepGraph(manifest: any): any[] {
  return manifest?.circuit?.steps ?? [];
}

/**
 * Get the start_at step for a given entry mode.
 */
export function getEntryModeStart(
  manifest: any,
  modeName: string,
): string | null {
  const entryModes = manifest?.circuit?.entry_modes ?? {};
  const mode = entryModes[modeName] ?? {};
  return mode.start_at ?? null;
}

/**
 * Walk steps in graph order starting from startStep.
 *
 * If no explicit start is given, returns the full manifest step order.
 * If a start is given, begins from that step in the ordered list.
 */
export function walkStepOrder(
  manifest: any,
  startStep: string | null,
  state?: any,
): string[] {
  const steps = buildStepGraph(manifest);
  const stepIds = steps.map((s: any) => s.id as string);
  const linearOrder = (() => {
    if (startStep && stepIds.includes(startStep)) {
      const startIdx = stepIds.indexOf(startStep);
      return stepIds.slice(startIdx);
    }

    return stepIds;
  })();

  const recordedRoutes = state?.routes;
  if (!recordedRoutes || typeof recordedRoutes !== "object") {
    return linearOrder;
  }

  if (stepIds.length === 0) {
    return [];
  }

  if (startStep && !stepIds.includes(startStep)) {
    return linearOrder;
  }

  const routeMap = recordedRoutes as Record<string, string>;
  if (Object.keys(routeMap).length === 0) {
    return linearOrder;
  }

  let currentStep = startStep ?? stepIds[0];
  const visited = new Set<string>();
  const traversedSteps: string[] = [];

  while (currentStep && stepIds.includes(currentStep) && !visited.has(currentStep)) {
    traversedSteps.push(currentStep);
    visited.add(currentStep);

    const nextStep = routeMap[currentStep];
    if (!nextStep || nextStep.startsWith("@")) {
      break;
    }
    if (!stepIds.includes(nextStep)) {
      break;
    }

    currentStep = nextStep;
  }

  return traversedSteps;
}

// ─── Step completeness ───────────────────────────────────────────────

/**
 * Determine whether a step is complete.
 *
 * A step is complete when its gate was evaluated and a route was recorded.
 * We check artifacts, jobs, and checkpoints for completion indicators.
 */
export function isStepComplete(stepId: string, state: any): boolean {
  const routes: Record<string, string> = state?.routes ?? {};
  if (stepId in routes) {
    return true;
  }

  // Check artifacts produced by this step
  const artifacts: Record<string, any> = state.artifacts ?? {};
  let stepHasArtifacts = false;
  let allGatesEvaluated = true;

  for (const artInfo of Object.values(artifacts)) {
    if (artInfo.produced_by === stepId) {
      stepHasArtifacts = true;
      const gate = artInfo.gate;
      if (gate === "pending" || gate == null) {
        allGatesEvaluated = false;
      }
    }
  }

  if (stepHasArtifacts && allGatesEvaluated) {
    return true;
  }

  // Check if this is a dispatch step that completed
  const jobs: Record<string, any> = state.jobs ?? {};
  if (stepId in jobs) {
    const job = jobs[stepId];
    if (job.status === "complete") {
      // Job completed, but step is only complete if gate was evaluated.
      if (stepHasArtifacts && allGatesEvaluated) {
        return true;
      }
      // If no artifacts but job is complete, not yet complete
      if (!stepHasArtifacts) {
        return false;
      }
    }
  }

  // Check if this is a checkpoint step that was resolved
  const checkpoints: Record<string, any> = state.checkpoints ?? {};
  if (stepId in checkpoints) {
    const cp = checkpoints[stepId];
    if (cp.status === "resolved") {
      // Checkpoint resolved -- step is evaluated
      if (stepHasArtifacts && allGatesEvaluated) {
        return true;
      }
      // For checkpoint steps, resolution itself indicates completion
      // when there are no artifacts to check
      if (!stepHasArtifacts) {
        return true;
      }
    }
  }

  return false;
}

// ─── Resume point ────────────────────────────────────────────────────

interface ResumeResult {
  resumeStep: string | null;
  status: string;
  reason: string;
}

/**
 * Find the first incomplete step in graph order.
 */
export function findResumePoint(manifest: any, state: any): ResumeResult {
  const status: string = state.status ?? "initialized";

  // Terminal states
  const terminalStatuses = [
    "completed",
    "stopped",
    "blocked",
    "handed_off",
  ];
  if (terminalStatuses.includes(status)) {
    return {
      resumeStep: null,
      status,
      reason: `run is ${status}`,
    };
  }

  // Get the entry mode and walk from its start
  const selectedMode: string = state.selected_entry_mode ?? "default";
  const startStep = getEntryModeStart(manifest, selectedMode);
  const stepOrder = walkStepOrder(manifest, startStep, state);

  if (stepOrder.length === 0) {
    return {
      resumeStep: null,
      status,
      reason: "no steps found in manifest",
    };
  }

  // Walk steps and find first incomplete
  for (const stepId of stepOrder) {
    if (!isStepComplete(stepId, state)) {
      // Determine reason
      const currentStep = state.current_step ?? null;
      let reason: string;

      if (currentStep === stepId && status === "waiting_checkpoint") {
        reason = `step ${stepId} is waiting for checkpoint resolution`;
      } else if (currentStep === stepId && status === "waiting_worker") {
        reason = `step ${stepId} is waiting for worker completion`;
      } else if (
        stepId in (state.jobs ?? {}) &&
        state.jobs[stepId]?.status === "complete"
      ) {
        const verdict = state.jobs[stepId]?.verdict;
        const step = findStepById(manifest as Record<string, unknown>, stepId);
        const gate = (step?.gate ?? {}) as Record<string, unknown>;
        const passList = Array.isArray(gate.pass)
          ? gate.pass.filter((value): value is string => typeof value === "string")
          : [];

        if (
          typeof verdict === "string" &&
          passList.length > 0 &&
          !passList.includes(verdict)
        ) {
          reason = `step ${stepId} verdict ${verdict} does not satisfy gate; retry or reroute`;
        } else {
          reason = `step ${stepId} has completed job output but gate has not advanced`;
        }
      } else if (
        stepId in (state.jobs ?? {}) &&
        state.jobs[stepId]?.status === "failed"
      ) {
        const completion = state.jobs[stepId]?.completion;
        if (completion === "blocked") {
          reason = `step ${stepId} is blocked, needs dependency resolution or reroute`;
        } else if (completion === "partial") {
          reason = `step ${stepId} partially completed, needs retry to finish remaining work`;
        } else {
          reason = `step ${stepId} job failed, needs retry or reroute`;
        }
      } else {
        reason = `step ${stepId} has not been completed`;
      }

      return {
        resumeStep: stepId,
        status,
        reason,
      };
    }
  }

  // All steps complete
  return {
    resumeStep: null,
    status: "completed",
    reason: "all steps complete",
  };
}
