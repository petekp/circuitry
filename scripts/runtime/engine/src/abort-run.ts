import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import {
  type Announce,
  composeTransitionLine,
  silentAnnouncer,
} from "./announcer.js";
import { appendValidatedEvents } from "./command-support.js";
import {
  clearContinuityCurrentRun,
  readContinuityIndex,
} from "./continuity-control-plane.js";
import { deriveValidatedStateFromRun, loadManifest } from "./derive-state.js";

const TERMINAL_STATUSES = new Set([
  "aborted",
  "blocked",
  "complete",
  "completed",
  "failed",
  "handed_off",
  "stopped",
]);

export interface AbortRunOptions {
  announce?: Announce;
  reason: string;
  runRoot: string;
}

export interface AbortRunResult {
  alreadyTerminal: boolean;
  continuityCleared: boolean;
  message: string;
  reason: string;
  runRoot: string;
  runSlug: string;
  status: string;
  updatedAt: string | null;
  workflowId: string;
}

function readWorkflowId(runRoot: string): string {
  try {
    const manifest = loadManifest(runRoot) as Record<string, unknown>;
    const circuit = manifest.circuit as Record<string, unknown> | undefined;
    const id = circuit && typeof circuit === "object" ? circuit.id : undefined;
    return typeof id === "string" ? id : "";
  } catch {
    return "";
  }
}

function inferAttachedProjectRoot(runRoot: string): string | null {
  const parent = dirname(runRoot);
  const grandparent = dirname(parent);
  if (basename(parent) !== "circuit-runs" || basename(grandparent) !== ".circuit") {
    return null;
  }

  return dirname(grandparent);
}

function readStateJson(runRoot: string): Record<string, unknown> {
  const statePath = resolve(runRoot, "state.json");
  if (!existsSync(statePath)) {
    throw new Error(`circuit: state.json not found in ${runRoot}`);
  }

  return JSON.parse(readFileSync(statePath, "utf-8")) as Record<string, unknown>;
}

export function abortRun(options: AbortRunOptions): AbortRunResult {
  const announce = options.announce ?? silentAnnouncer;
  const runRoot = resolve(options.runRoot);
  if (!existsSync(runRoot)) {
    throw new Error(`circuit: run root does not exist: ${runRoot}`);
  }
  if (!options.reason || options.reason.trim().length === 0) {
    throw new Error("circuit: --reason is required");
  }

  const currentState = readStateJson(runRoot);
  const currentStatus =
    typeof currentState.status === "string" ? currentState.status : "unknown";
  const runSlug = basename(runRoot);
  const workflowId = readWorkflowId(runRoot);

  if (TERMINAL_STATUSES.has(currentStatus)) {
    return {
      alreadyTerminal: true,
      continuityCleared: false,
      message: `already terminal: ${currentStatus}`,
      reason: options.reason,
      runRoot,
      runSlug,
      status: currentStatus,
      updatedAt:
        typeof currentState.updated_at === "string" ? currentState.updated_at : null,
      workflowId,
    };
  }

  const abortedAt = new Date().toISOString();
  appendValidatedEvents(runRoot, [
    {
      eventType: "run_aborted",
      payload: {
        aborted_at: abortedAt,
        reason: options.reason,
      },
    },
  ]);

  announce(
    composeTransitionLine({
      kind: "aborted",
      workflowId,
    }),
  );

  const nextState = deriveValidatedStateFromRun(runRoot, { persist: true });
  let continuityCleared = false;
  const projectRoot = inferAttachedProjectRoot(runRoot);
  if (projectRoot) {
    const index = readContinuityIndex(projectRoot);
    if (index?.current_run?.run_slug === runSlug) {
      clearContinuityCurrentRun(projectRoot);
      continuityCleared = true;
    }
  }

  return {
    alreadyTerminal: false,
    continuityCleared,
    message: "aborted",
    reason: options.reason,
    runRoot,
    runSlug,
    status: typeof nextState.status === "string" ? nextState.status : "aborted",
    updatedAt:
      typeof nextState.updated_at === "string" ? nextState.updated_at : null,
    workflowId,
  };
}
