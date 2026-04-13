import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { resolveCircuitHomePaths } from "./catalog/custom-circuits.js";

const LEDGER_FILENAME = "invocation-ledger.ndjson";
const SIDECAR_PREFIX = ".pending-invocation-";
const SIDECAR_SUFFIX = ".json";
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

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

export interface PendingInvocation {
  invocation_id: string;
  session_id: string;
  requested_command: string;
  requested_args: string;
  project_root: string;
  occurred_at: string;
}

export function createInvocationId(): string {
  return `inv_${randomUUID()}`;
}

export function ledgerPath(homeDir?: string): string {
  const { circuitHome } = resolveCircuitHomePaths(homeDir);
  return resolve(circuitHome, LEDGER_FILENAME);
}

export function sidecarDir(homeDir?: string): string {
  return resolveCircuitHomePaths(homeDir).circuitHome;
}

export function sidecarPath(invocationId: string, homeDir?: string): string {
  return resolve(sidecarDir(homeDir), `${SIDECAR_PREFIX}${invocationId}${SIDECAR_SUFFIX}`);
}

function listSidecarFiles(homeDir?: string): string[] {
  try {
    const dir = sidecarDir(homeDir);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => name.startsWith(SIDECAR_PREFIX) && name.endsWith(SIDECAR_SUFFIX))
      .map((name) => resolve(dir, name));
  } catch {
    return [];
  }
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
 * Write a per-invocation sidecar file atomically. Best-effort: never throws.
 * Each invocation gets its own file keyed by invocation_id, preventing races.
 */
export function writePendingInvocation(
  pending: PendingInvocation,
  homeDir?: string,
): boolean {
  try {
    const path = sidecarPath(pending.invocation_id, homeDir);
    mkdirSync(dirname(path), { recursive: true });
    const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmpPath, `${JSON.stringify(pending, null, 2)}\n`, "utf-8");
    renameSync(tmpPath, path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a specific pending-invocation sidecar by path.
 * Returns null if missing or unparseable.
 * Age-based expiry is enforced only by cleanupStaleSidecars, not here --
 * a long-running bootstrap must be able to read its own sidecar regardless of wall time.
 */
function readSidecarFile(path: string): PendingInvocation | null {
  try {
    if (!existsSync(path)) return null;

    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as PendingInvocation;

    if (!parsed.invocation_id || !parsed.project_root) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Find a pending-invocation sidecar.
 *
 * When `invocationId` is provided, looks up the exact sidecar file by name --
 * no scanning, no ambiguity. This is the preferred path once the ID is threaded
 * through bootstrap args.
 *
 * When `invocationId` is omitted (legacy/fallback), scans all sidecars for the
 * project and returns the freshest match. If `sessionId` is provided, prefers
 * sidecars from the same session to reduce cross-session mismatches.
 *
 * Does NOT delete the sidecar -- callers decide when to clean up.
 */
export function findPendingInvocation(
  projectRoot: string,
  homeDir?: string,
  options?: { invocationId?: string; sessionId?: string },
): PendingInvocation | null {
  // Fast path: exact lookup by invocation ID.
  if (options?.invocationId) {
    const path = sidecarPath(options.invocationId, homeDir);
    const pending = readSidecarFile(path);
    if (!pending) return null;
    // Sanity check: the sidecar should belong to the requested project.
    if (resolve(pending.project_root) !== resolve(projectRoot)) return null;
    return pending;
  }

  // Fallback: scan all sidecars and pick the best match.
  const files = listSidecarFiles(homeDir);
  let best: PendingInvocation | null = null;
  let bestTime = 0;
  let bestIsSessionMatch = false;

  for (const file of files) {
    const pending = readSidecarFile(file);
    if (!pending) continue;
    if (resolve(pending.project_root) !== resolve(projectRoot)) continue;

    const time = statSync(file).mtimeMs;
    const isSessionMatch = options?.sessionId != null
      && pending.session_id === options.sessionId;

    // Prefer session-matched sidecars over non-matched ones.
    // Among same-tier matches, prefer the newest by mtime.
    if (
      (!bestIsSessionMatch && isSessionMatch)
      || (isSessionMatch === bestIsSessionMatch && time > bestTime)
    ) {
      best = pending;
      bestTime = time;
      bestIsSessionMatch = isSessionMatch;
    }
  }

  return best;
}

/**
 * Delete the sidecar for a specific invocation. Best-effort: never throws.
 */
function deleteSidecar(invocationId: string, homeDir?: string): void {
  try {
    rmSync(sidecarPath(invocationId, homeDir), { force: true });
  } catch {
    // Best effort deletion.
  }
}

/**
 * Clean up all orphaned sidecar files older than the stale threshold.
 * Appends status:abandoned to the ledger for each cleaned-up sidecar.
 * Best-effort: never throws.
 */
export function cleanupStaleSidecars(homeDir?: string): void {
  try {
    for (const file of listSidecarFiles(homeDir)) {
      try {
        const stat = statSync(file);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs <= STALE_THRESHOLD_MS) continue;

        let invocationId: string | undefined;
        let projectRoot: string | undefined;
        try {
          const raw = readFileSync(file, "utf-8");
          const parsed = JSON.parse(raw) as PendingInvocation;
          invocationId = parsed.invocation_id;
          projectRoot = parsed.project_root;
        } catch {
          // Corrupt sidecar -- just delete it.
        }

        rmSync(file, { force: true });

        if (invocationId) {
          appendLedgerEntry({
            schema_version: "1",
            invocation_id: invocationId,
            occurred_at: new Date().toISOString(),
            status: "abandoned",
            project_root: projectRoot,
          }, homeDir);
        }
      } catch {
        // Best effort per-file.
      }
    }
  } catch {
    // Best effort only.
  }
}

/**
 * Record a "received" event: the hook saw a /circuit:* command.
 * Writes the sidecar and appends to the ledger. Best-effort: never throws.
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

    const pending: PendingInvocation = {
      invocation_id: invocationId,
      session_id: sessionId,
      requested_command: options.requestedCommand,
      requested_args: options.commandArgs,
      project_root: options.projectRoot,
      occurred_at: occurredAt,
    };

    writePendingInvocation(pending, options.homeDir);

    appendLedgerEntry({
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

    return { invocationId };
  } catch {
    return null;
  }
}

/**
 * Record a "routed" event: bootstrap successfully started a circuit run.
 * Finds the pending sidecar, appends to the ledger, then deletes the sidecar.
 * Sidecar deletion happens only after successful ledger append.
 * Best-effort: never throws.
 */
export function recordInvocationRouted(options: {
  circuitId: string;
  entryMode: string;
  goal?: string;
  homeDir?: string;
  invocationId?: string;
  projectRoot: string;
  routedCommand: string;
  routedTargetKind: "built_in" | "custom_global";
  runId: string;
  runRoot: string;
}): boolean {
  try {
    const pending = findPendingInvocation(options.projectRoot, options.homeDir, {
      invocationId: options.invocationId,
      sessionId: `${process.ppid}`,
    });
    if (!pending) return false;

    const appended = appendLedgerEntry({
      schema_version: "1",
      invocation_id: pending.invocation_id,
      occurred_at: new Date().toISOString(),
      status: "routed",
      session_id: pending.session_id,
      project_root: options.projectRoot,
      requested_command: pending.requested_command,
      command_args: pending.requested_args,
      routed_command: options.routedCommand,
      routed_target_kind: options.routedTargetKind,
      entry_mode: options.entryMode,
      goal: options.goal,
      run_root: options.runRoot,
      run_id: options.runId,
      circuit_id: options.circuitId,
      launch_outcome: "success",
    }, options.homeDir);

    // Only delete the sidecar after a successful ledger write.
    if (appended) {
      deleteSidecar(pending.invocation_id, options.homeDir);
    }

    return appended;
  } catch {
    return false;
  }
}

/**
 * Record a "failed" event: bootstrap failed to start a circuit run.
 * Finds the pending sidecar, appends to the ledger, then deletes the sidecar.
 * Sidecar deletion happens only after successful ledger append.
 * Best-effort: never throws.
 */
export function recordInvocationFailed(options: {
  failureReason: string;
  homeDir?: string;
  invocationId?: string;
  projectRoot: string;
}): boolean {
  try {
    const pending = findPendingInvocation(options.projectRoot, options.homeDir, {
      invocationId: options.invocationId,
      sessionId: `${process.ppid}`,
    });
    if (!pending) return false;

    const appended = appendLedgerEntry({
      schema_version: "1",
      invocation_id: pending.invocation_id,
      occurred_at: new Date().toISOString(),
      status: "failed",
      session_id: pending.session_id,
      project_root: options.projectRoot,
      requested_command: pending.requested_command,
      command_args: pending.requested_args,
      launch_outcome: "bootstrap_failed",
      failure_reason: options.failureReason,
    }, options.homeDir);

    // Only delete the sidecar after a successful ledger write.
    if (appended) {
      deleteSidecar(pending.invocation_id, options.homeDir);
    }

    return appended;
  } catch {
    return false;
  }
}
