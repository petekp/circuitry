import { mkdirSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  appendLedgerEntry,
  ledgerPath,
  recordInvocationFailed,
  recordInvocationReceived,
  recordInvocationRouted,
} from "./invocation-ledger.js";

function makeTempHome() {
  const root = mkdtempSync(join(tmpdir(), "circuit-ledger-test-"));
  const homeDir = join(root, "home");
  const circuitHome = join(homeDir, ".circuit");
  mkdirSync(circuitHome, { recursive: true });
  return { circuitHome, homeDir, root };
}

function readLedgerEntries(homeDir: string) {
  const ledger = readFileSync(ledgerPath(homeDir), "utf-8").trim();
  return ledger
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("invocation-ledger", () => {
  it("appends NDJSON entries to the ledger file", () => {
    const { homeDir } = makeTempHome();

    appendLedgerEntry({
      schema_version: "1",
      invocation_id: "inv_1",
      occurred_at: "2026-01-01T00:00:00Z",
      status: "received",
    }, homeDir);

    appendLedgerEntry({
      schema_version: "1",
      invocation_id: "inv_2",
      occurred_at: "2026-01-01T00:01:00Z",
      status: "routed",
    }, homeDir);

    const entries = readLedgerEntries(homeDir);
    expect(entries).toHaveLength(2);
    expect(entries[0].invocation_id).toBe("inv_1");
    expect(entries[1].invocation_id).toBe("inv_2");
  });

  it("records a received entry and returns the minted invocation id", () => {
    const { homeDir } = makeTempHome();

    const recorded = recordInvocationReceived({
      commandArgs: "add dark mode support",
      commandSlug: "build",
      homeDir,
      projectRoot: "/tmp/circuit-project",
      requestedCommand: "circuit:build",
    });

    expect(recorded).not.toBeNull();

    const entries = readLedgerEntries(homeDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        invocation_id: recorded?.invocationId,
        status: "received",
        requested_command: "circuit:build",
        command_slug: "build",
        command_args: "add dark mode support",
        project_root: "/tmp/circuit-project",
      }),
    );
  });

  it("records a routed entry keyed by the explicit invocation id", () => {
    const { homeDir } = makeTempHome();
    const invocationId = "inv_explicit-route";

    const recorded = recordInvocationRouted({
      circuitId: "build",
      commandArgs: "host surface smoke",
      entryMode: "lite",
      goal: "Host surface smoke",
      homeDir,
      invocationId,
      projectRoot: "/tmp/circuit-project",
      requestedCommand: "circuit:build",
      routedCommand: "circuit:build",
      routedTargetKind: "built_in",
      runId: "host-surface-smoke",
      runRoot: "/tmp/circuit-project/.circuit/circuit-runs/host-surface-smoke",
    });

    expect(recorded).toBe(true);

    const entries = readLedgerEntries(homeDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        invocation_id: invocationId,
        status: "routed",
        requested_command: "circuit:build",
        command_args: "host surface smoke",
        entry_mode: "lite",
        goal: "Host surface smoke",
        routed_command: "circuit:build",
        run_id: "host-surface-smoke",
      }),
    );
  });

  it("records a failed entry keyed by the explicit invocation id", () => {
    const { homeDir } = makeTempHome();
    const invocationId = "inv_explicit-failure";

    const recorded = recordInvocationFailed({
      commandArgs: "broken bootstrap",
      failureReason: "manifest not found",
      homeDir,
      invocationId,
      projectRoot: "/tmp/circuit-project",
      requestedCommand: "circuit:build",
    });

    expect(recorded).toBe(true);

    const entries = readLedgerEntries(homeDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        invocation_id: invocationId,
        status: "failed",
        requested_command: "circuit:build",
        command_args: "broken bootstrap",
        failure_reason: "manifest not found",
        launch_outcome: "bootstrap_failed",
      }),
    );
  });

  it("refuses to record routed or failed entries without an explicit invocation id", () => {
    const { homeDir } = makeTempHome();

    expect(recordInvocationRouted({
      circuitId: "build",
      entryMode: "default",
      homeDir,
      projectRoot: "/tmp/circuit-project",
      routedCommand: "circuit:build",
      routedTargetKind: "built_in",
      runId: "host-surface-smoke",
      runRoot: "/tmp/circuit-project/.circuit/circuit-runs/host-surface-smoke",
    })).toBe(false);

    expect(recordInvocationFailed({
      failureReason: "missing invocation id",
      homeDir,
      projectRoot: "/tmp/circuit-project",
    })).toBe(false);

    expect(() => readFileSync(ledgerPath(homeDir), "utf-8")).toThrow();
  });
});
