import {
  appendFileSync,
  mkdirSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { resolveCircuitHomePaths } from "./catalog/custom-circuits.js";

const LEDGER_FILENAME = "invocation-ledger.ndjson";

export interface LedgerEntry {
  schema_version: "1";
  invocation_id: string;
  occurred_at: string;
  status: "received" | "routed" | "failed" | "abandoned";

  session_id?: string;
  project_root?: string;
  cwd?: string;
  git_branch?: string | null;

  requested_command?: string;
  command_slug?: string;
  command_args?: string;

  routed_command?: string;
  routed_target_kind?: "built_in" | "custom_global";
  entry_mode?: string;
  goal?: string;

  run_root?: string;
  run_id?: string;
  circuit_id?: string;

  launch_outcome?: "success" | "bootstrap_failed" | "routing_failed";
  failure_reason?: string;
}

export function createInvocationId(): string {
  return `inv_${randomUUID()}`;
}

export function ledgerPath(homeDir?: string): string {
  const { circuitHome } = resolveCircuitHomePaths(homeDir);
  return resolve(circuitHome, LEDGER_FILENAME);
}

function readGitBranch(cwd: string): string | null {
  try {
    const result = spawnSync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd, encoding: "utf-8", timeout: 3000 },
    );
    if (result.status !== 0) return null;
    const branch = result.stdout.trim();
    return branch === "HEAD" ? null : branch;
  } catch {
    return null;
  }
}

/**
 * Append a single entry to the NDJSON ledger. Best-effort: never throws.
 */
export function appendLedgerEntry(entry: LedgerEntry, homeDir?: string): boolean {
  try {
    const path = ledgerPath(homeDir);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Record a "received" event: the hook saw a /circuit:* command and minted the
 * invocation_id that should be threaded into any later bootstrap call.
 */
export function recordInvocationReceived(options: {
  commandArgs: string;
  commandSlug: string;
  homeDir?: string;
  projectRoot: string;
  requestedCommand: string;
}): { invocationId: string } | null {
  try {
    const invocationId = createInvocationId();
    const occurredAt = new Date().toISOString();
    const sessionId = `${process.ppid}`;
    const cwd = process.cwd();
    const gitBranch = readGitBranch(options.projectRoot);

    const appended = appendLedgerEntry({
      schema_version: "1",
      invocation_id: invocationId,
      occurred_at: occurredAt,
      status: "received",
      session_id: sessionId,
      project_root: options.projectRoot,
      cwd,
      git_branch: gitBranch,
      requested_command: options.requestedCommand,
      command_slug: options.commandSlug,
      command_args: options.commandArgs,
    }, options.homeDir);

    return appended ? { invocationId } : null;
  } catch {
    return null;
  }
}

/**
 * Record a "routed" event for an explicitly-threaded invocation_id.
 */
export function recordInvocationRouted(options: {
  circuitId: string;
  entryMode: string;
  goal?: string;
  homeDir?: string;
  invocationId?: string;
  projectRoot: string;
  requestedCommand?: string;
  commandArgs?: string;
  routedCommand: string;
  routedTargetKind: "built_in" | "custom_global";
  runId: string;
  runRoot: string;
}): boolean {
  try {
    if (!options.invocationId) {
      return false;
    }

    return appendLedgerEntry({
      schema_version: "1",
      invocation_id: options.invocationId,
      occurred_at: new Date().toISOString(),
      status: "routed",
      session_id: `${process.ppid}`,
      project_root: options.projectRoot,
      requested_command: options.requestedCommand,
      command_args: options.commandArgs,
      routed_command: options.routedCommand,
      routed_target_kind: options.routedTargetKind,
      entry_mode: options.entryMode,
      goal: options.goal,
      run_root: options.runRoot,
      run_id: options.runId,
      circuit_id: options.circuitId,
      launch_outcome: "success",
    }, options.homeDir);
  } catch {
    return false;
  }
}

/**
 * Record a "failed" event for an explicitly-threaded invocation_id.
 */
export function recordInvocationFailed(options: {
  failureReason: string;
  homeDir?: string;
  invocationId?: string;
  projectRoot: string;
  requestedCommand?: string;
  commandArgs?: string;
}): boolean {
  try {
    if (!options.invocationId) {
      return false;
    }

    return appendLedgerEntry({
      schema_version: "1",
      invocation_id: options.invocationId,
      occurred_at: new Date().toISOString(),
      status: "failed",
      session_id: `${process.ppid}`,
      project_root: options.projectRoot,
      requested_command: options.requestedCommand,
      command_args: options.commandArgs,
      launch_outcome: "bootstrap_failed",
      failure_reason: options.failureReason,
    }, options.homeDir);
  } catch {
    return false;
  }
}
