import { existsSync, mkdirSync, readFileSync, utimesSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  appendLedgerEntry,
  cleanupStaleSidecars,
  findPendingInvocation,
  ledgerPath,
  sidecarPath,
  writePendingInvocation,
} from "./invocation-ledger.js";
import type { PendingInvocation } from "./invocation-ledger.js";

function makeTempHome() {
  const root = mkdtempSync(join(tmpdir(), "circuit-ledger-test-"));
  const homeDir = join(root, "home");
  const circuitHome = join(homeDir, ".circuit");
  mkdirSync(circuitHome, { recursive: true });
  return { circuitHome, homeDir, root };
}

function makePending(overrides: Partial<PendingInvocation> = {}): PendingInvocation {
  return {
    invocation_id: `inv_test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    session_id: "12345",
    requested_command: "circuit:build",
    requested_args: "test task",
    project_root: "/tmp/test-project",
    occurred_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("invocation-ledger", () => {
  describe("findPendingInvocation with exact invocationId", () => {
    it("finds a sidecar by exact invocation ID without scanning", () => {
      const { homeDir } = makeTempHome();
      const pending = makePending();
      writePendingInvocation(pending, homeDir);

      const found = findPendingInvocation(pending.project_root, homeDir, {
        invocationId: pending.invocation_id,
      });

      expect(found).toEqual(pending);
    });

    it("returns null when invocationId does not match any sidecar", () => {
      const { homeDir } = makeTempHome();
      const pending = makePending();
      writePendingInvocation(pending, homeDir);

      const found = findPendingInvocation(pending.project_root, homeDir, {
        invocationId: "inv_nonexistent",
      });

      expect(found).toBeNull();
    });

    it("returns null when invocationId exists but project_root mismatches", () => {
      const { homeDir } = makeTempHome();
      const pending = makePending({ project_root: "/tmp/project-a" });
      writePendingInvocation(pending, homeDir);

      const found = findPendingInvocation("/tmp/project-b", homeDir, {
        invocationId: pending.invocation_id,
      });

      expect(found).toBeNull();
    });

    it("picks the exact sidecar even when others exist for the same project", () => {
      const { homeDir } = makeTempHome();
      const projectRoot = "/tmp/same-project";
      const older = makePending({ invocation_id: "inv_older", project_root: projectRoot });
      const target = makePending({ invocation_id: "inv_target", project_root: projectRoot });
      const newer = makePending({ invocation_id: "inv_newer", project_root: projectRoot });

      writePendingInvocation(older, homeDir);
      writePendingInvocation(target, homeDir);
      writePendingInvocation(newer, homeDir);

      const found = findPendingInvocation(projectRoot, homeDir, {
        invocationId: "inv_target",
      });

      expect(found?.invocation_id).toBe("inv_target");
    });
  });

  describe("findPendingInvocation with session_id preference", () => {
    it("prefers a session-matched sidecar over a newer non-matched one", () => {
      const { homeDir } = makeTempHome();
      const projectRoot = "/tmp/session-test";

      const sameSession = makePending({
        invocation_id: "inv_same-session",
        project_root: projectRoot,
        session_id: "my-session",
      });
      writePendingInvocation(sameSession, homeDir);

      // Write a newer sidecar from a different session.
      const otherSession = makePending({
        invocation_id: "inv_other-session",
        project_root: projectRoot,
        session_id: "other-session",
      });
      writePendingInvocation(otherSession, homeDir);

      // Touch the other-session sidecar to make it newer by mtime.
      const otherPath = sidecarPath("inv_other-session", homeDir);
      const futureTime = new Date(Date.now() + 10_000);
      utimesSync(otherPath, futureTime, futureTime);

      const found = findPendingInvocation(projectRoot, homeDir, {
        sessionId: "my-session",
      });

      expect(found?.invocation_id).toBe("inv_same-session");
    });

    it("falls back to newest mtime when no session match exists", () => {
      const { homeDir } = makeTempHome();
      const projectRoot = "/tmp/no-session-match";

      const older = makePending({
        invocation_id: "inv_older-fallback",
        project_root: projectRoot,
        session_id: "session-a",
      });
      writePendingInvocation(older, homeDir);

      const newer = makePending({
        invocation_id: "inv_newer-fallback",
        project_root: projectRoot,
        session_id: "session-b",
      });
      writePendingInvocation(newer, homeDir);

      // Touch the newer sidecar to ensure it wins by mtime.
      const newerPath = sidecarPath("inv_newer-fallback", homeDir);
      const futureTime = new Date(Date.now() + 10_000);
      utimesSync(newerPath, futureTime, futureTime);

      const found = findPendingInvocation(projectRoot, homeDir, {
        sessionId: "no-such-session",
      });

      expect(found?.invocation_id).toBe("inv_newer-fallback");
    });
  });

  describe("readSidecarFile does not reject by age", () => {
    it("finds a sidecar older than 10 minutes", () => {
      const { homeDir } = makeTempHome();
      const pending = makePending();
      writePendingInvocation(pending, homeDir);

      // Backdate the sidecar to 30 minutes ago.
      const path = sidecarPath(pending.invocation_id, homeDir);
      const pastTime = new Date(Date.now() - 30 * 60 * 1000);
      utimesSync(path, pastTime, pastTime);

      const found = findPendingInvocation(pending.project_root, homeDir, {
        invocationId: pending.invocation_id,
      });

      expect(found).toEqual(pending);
    });

    it("finds a sidecar older than 10 minutes via scan fallback", () => {
      const { homeDir } = makeTempHome();
      const pending = makePending();
      writePendingInvocation(pending, homeDir);

      // Backdate to 30 minutes ago.
      const path = sidecarPath(pending.invocation_id, homeDir);
      const pastTime = new Date(Date.now() - 30 * 60 * 1000);
      utimesSync(path, pastTime, pastTime);

      const found = findPendingInvocation(pending.project_root, homeDir);

      expect(found).toEqual(pending);
    });
  });

  describe("cleanupStaleSidecars", () => {
    it("removes sidecars older than 60 minutes and writes abandoned entries", () => {
      const { homeDir } = makeTempHome();
      const pending = makePending();
      writePendingInvocation(pending, homeDir);

      // Backdate past the 60-minute threshold.
      const path = sidecarPath(pending.invocation_id, homeDir);
      const pastTime = new Date(Date.now() - 61 * 60 * 1000);
      utimesSync(path, pastTime, pastTime);

      cleanupStaleSidecars(homeDir);

      expect(existsSync(path)).toBe(false);

      // Verify an abandoned entry was written to the ledger.
      const ledger = readFileSync(ledgerPath(homeDir), "utf-8").trim();
      const entries = ledger.split("\n").map((l) => JSON.parse(l));
      const abandoned = entries.find(
        (e: { status: string; invocation_id: string }) =>
          e.status === "abandoned" && e.invocation_id === pending.invocation_id,
      );
      expect(abandoned).toBeTruthy();
    });

    it("does not remove sidecars younger than 60 minutes", () => {
      const { homeDir } = makeTempHome();
      const pending = makePending();
      writePendingInvocation(pending, homeDir);

      // Backdate to 30 minutes ago (within threshold).
      const path = sidecarPath(pending.invocation_id, homeDir);
      const pastTime = new Date(Date.now() - 30 * 60 * 1000);
      utimesSync(path, pastTime, pastTime);

      cleanupStaleSidecars(homeDir);

      expect(existsSync(path)).toBe(true);
    });
  });

  describe("legacy fallback (no options)", () => {
    it("still works when called without the options parameter", () => {
      const { homeDir } = makeTempHome();
      const pending = makePending();
      writePendingInvocation(pending, homeDir);

      const found = findPendingInvocation(pending.project_root, homeDir);

      expect(found).toEqual(pending);
    });
  });

  describe("appendLedgerEntry", () => {
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

      const path = ledgerPath(homeDir);
      const lines = readFileSync(path, "utf-8").trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).invocation_id).toBe("inv_1");
      expect(JSON.parse(lines[1]).invocation_id).toBe("inv_2");
    });
  });
});
