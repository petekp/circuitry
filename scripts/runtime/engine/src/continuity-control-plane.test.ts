import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ContinuityControlPlaneError,
  type ContinuityIndexV1,
  type ContinuityRecordV1,
  CONTINUITY_CONTROL_PLANE_DIR_REL,
  CONTINUITY_INDEX_REL,
  clearContinuityCurrentRun,
  clearContinuityPendingRecord,
  createContinuityRecordId,
  createEmptyContinuityIndex,
  deleteContinuityRecordByPayload,
  continuityControlPlaneDir,
  continuityIndexPath,
  continuityRecordPath,
  continuityRecordPayloadRel,
  continuityRunRootRel,
  readContinuityIndex,
  readPendingContinuityRecord,
  readContinuityRecord,
  readContinuityRecordByPayload,
  setContinuityPendingRecord,
  upsertContinuityCurrentRun,
  writeContinuityIndex,
  writeContinuityRecord,
} from "./continuity-control-plane.js";

function makeProjectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "circuit-control-plane-"));
  mkdirSync(resolve(root, ".circuit"), { recursive: true });
  return realpathSync(root);
}

function makeIndex(projectRoot: string): ContinuityIndexV1 {
  return {
    current_run: {
      attached_at: "2026-04-12T12:00:00.000Z",
      current_step: "frame",
      last_validated_at: "2026-04-12T12:01:00.000Z",
      manifest_present: true,
      run_root_rel: ".circuit/circuit-runs/run-001",
      run_slug: "run-001",
      runtime_status: "in_progress",
    },
    pending_record: {
      continuity_kind: "run_ref",
      created_at: "2026-04-12T12:02:00.000Z",
      payload_rel: continuityRecordPayloadRel("continuity-001"),
      record_id: "continuity-001",
      run_slug: "run-001",
    },
    project_root: projectRoot,
    schema_version: "1",
  };
}

function makeRecord(projectRoot: string): ContinuityRecordV1 {
  return {
    created_at: "2026-04-12T12:02:00.000Z",
    git: {
      base_commit: "abc123",
      branch: "main",
      cwd: projectRoot,
      head: "def456",
    },
    narrative: {
      debt_markdown: "",
      goal: "Replace markdown authority with a control plane",
      next: "Implement engine-owned resume",
      state_markdown: "- Slice 1 in progress",
    },
    project_root: projectRoot,
    record_id: "continuity-001",
    resume_contract: {
      auto_resume: false,
      mode: "resume_run",
      requires_explicit_resume: true,
    },
    run_ref: {
      current_step_at_save: "frame",
      manifest_present: true,
      run_root_rel: ".circuit/circuit-runs/run-001",
      run_slug: "run-001",
      runtime_status_at_save: "in_progress",
      runtime_updated_at_at_save: "2026-04-12T12:01:00.000Z",
    },
    schema_version: "1",
  };
}

describe("continuity control plane", () => {
  it("creates canonical control-plane paths and metadata helpers", () => {
    const projectRoot = makeProjectRoot();
    const index = createEmptyContinuityIndex(projectRoot);
    const firstId = createContinuityRecordId();
    const secondId = createContinuityRecordId();

    expect(continuityControlPlaneDir(projectRoot)).toBe(
      resolve(projectRoot, CONTINUITY_CONTROL_PLANE_DIR_REL),
    );
    expect(continuityIndexPath(projectRoot)).toBe(
      resolve(projectRoot, CONTINUITY_INDEX_REL),
    );
    expect(continuityRecordPayloadRel("continuity-001")).toBe(
      ".circuit/control-plane/continuity-records/continuity-001.json",
    );
    expect(continuityRecordPath(projectRoot, "continuity-001")).toBe(
      resolve(projectRoot, ".circuit/control-plane/continuity-records/continuity-001.json"),
    );
    expect(index.project_root).toBe(projectRoot);
    expect(index.pending_record).toBeNull();
    expect(firstId).toMatch(/^continuity-[0-9a-f-]+$/);
    expect(secondId).toMatch(/^continuity-[0-9a-f-]+$/);
    expect(firstId).not.toBe(secondId);
  });

  it("writes and reads a validated continuity index atomically", () => {
    const projectRoot = makeProjectRoot();
    const index = makeIndex(projectRoot);

    const writtenPath = writeContinuityIndex(projectRoot, index);

    expect(writtenPath).toBe(continuityIndexPath(projectRoot));
    expect(existsSync(writtenPath)).toBe(true);
    expect(readContinuityIndex(projectRoot)).toEqual(index);
    expect(
      readdirSync(resolve(projectRoot, ".circuit/control-plane")).filter((entry) => entry.includes(".tmp-")),
    ).toEqual([]);
  });

  it("upserts indexed current_run while preserving pending_record metadata", () => {
    const projectRoot = makeProjectRoot();
    const initial = makeIndex(projectRoot);
    initial.current_run = null;
    writeContinuityIndex(projectRoot, initial);

    const updated = upsertContinuityCurrentRun({
      attachedAt: "2026-04-12T12:03:00.000Z",
      currentStep: "verify",
      lastValidatedAt: "2026-04-12T12:04:00.000Z",
      manifestPresent: true,
      projectRoot,
      runSlug: "run-002",
      runtimeStatus: "waiting_worker",
    });

    expect(updated.pending_record).toEqual(initial.pending_record);
    expect(updated.current_run).toEqual({
      attached_at: "2026-04-12T12:03:00.000Z",
      current_step: "verify",
      last_validated_at: "2026-04-12T12:04:00.000Z",
      manifest_present: true,
      run_root_rel: continuityRunRootRel("run-002"),
      run_slug: "run-002",
      runtime_status: "waiting_worker",
    });
    expect(readContinuityIndex(projectRoot)?.current_run).toEqual(updated.current_run);
  });

  it("clears indexed current_run without deleting the pending record", () => {
    const projectRoot = makeProjectRoot();
    const index = makeIndex(projectRoot);
    writeContinuityIndex(projectRoot, index);

    const cleared = clearContinuityCurrentRun(projectRoot);

    expect(cleared.current_run).toBeNull();
    expect(cleared.pending_record).toEqual(index.pending_record);
    expect(readContinuityIndex(projectRoot)?.current_run).toBeNull();
  });

  it("writes and reads a validated continuity record atomically", () => {
    const projectRoot = makeProjectRoot();
    const record = makeRecord(projectRoot);

    const result = writeContinuityRecord(projectRoot, record);

    expect(result.payloadRel).toBe(".circuit/control-plane/continuity-records/continuity-001.json");
    expect(result.path).toBe(continuityRecordPath(projectRoot, record.record_id));
    expect(readContinuityRecord(projectRoot, record.record_id)).toEqual(record);
    expect(readContinuityRecordByPayload(projectRoot, result.payloadRel)).toEqual(record);
    expect(
      readdirSync(resolve(projectRoot, ".circuit/control-plane/continuity-records")).filter((entry) => entry.includes(".tmp-")),
    ).toEqual([]);
  });

  it("reads the pending continuity record through the index and validates the cross-link", () => {
    const projectRoot = makeProjectRoot();
    const record = makeRecord(projectRoot);
    const { payloadRel } = writeContinuityRecord(projectRoot, record);
    const index = createEmptyContinuityIndex(projectRoot);
    index.pending_record = {
      continuity_kind: "run_ref",
      created_at: record.created_at,
      payload_rel: payloadRel,
      record_id: record.record_id,
      run_slug: record.run_ref?.run_slug ?? null,
    };
    writeContinuityIndex(projectRoot, index);

    expect(readPendingContinuityRecord(projectRoot)).toEqual(record);
  });

  it("fails closed when the pending-record link disagrees with the record payload", () => {
    const projectRoot = makeProjectRoot();
    const record = makeRecord(projectRoot);
    const { payloadRel } = writeContinuityRecord(projectRoot, record);
    const index = createEmptyContinuityIndex(projectRoot);
    index.pending_record = {
      continuity_kind: "standalone",
      created_at: record.created_at,
      payload_rel: payloadRel,
      record_id: record.record_id,
      run_slug: null,
    };
    writeContinuityIndex(projectRoot, index);

    expect(() => readPendingContinuityRecord(projectRoot)).toThrowError(
      expect.objectContaining({
        code: "continuity_record_invalid",
        name: "ContinuityControlPlaneError",
      }),
    );
  });

  it("updates and clears pending_record metadata without disturbing current_run", () => {
    const projectRoot = makeProjectRoot();
    const index = makeIndex(projectRoot);
    writeContinuityIndex(projectRoot, index);

    const updated = setContinuityPendingRecord(projectRoot, {
      continuity_kind: "standalone",
      created_at: "2026-04-12T12:05:00.000Z",
      payload_rel: continuityRecordPayloadRel("continuity-standalone"),
      record_id: "continuity-standalone",
      run_slug: null,
    });

    expect(updated.current_run).toEqual(index.current_run);
    expect(updated.pending_record).toEqual({
      continuity_kind: "standalone",
      created_at: "2026-04-12T12:05:00.000Z",
      payload_rel: continuityRecordPayloadRel("continuity-standalone"),
      record_id: "continuity-standalone",
      run_slug: null,
    });

    const cleared = clearContinuityPendingRecord(projectRoot);
    expect(cleared.current_run).toEqual(index.current_run);
    expect(cleared.pending_record).toBeNull();
  });

  it("deletes a continuity record payload directly from the record store", () => {
    const projectRoot = makeProjectRoot();
    const record = makeRecord(projectRoot);
    const { payloadRel, path } = writeContinuityRecord(projectRoot, record);

    expect(existsSync(path)).toBe(true);
    expect(deleteContinuityRecordByPayload(projectRoot, payloadRel)).toBe(path);
    expect(existsSync(path)).toBe(false);
  });

  it("rejects invalid continuity index writes with a machine-readable error", () => {
    const projectRoot = makeProjectRoot();
    const index = makeIndex(projectRoot);
    index.project_root = resolve(projectRoot, "..", "other-project");

    expect(() => writeContinuityIndex(projectRoot, index)).toThrowError(
      expect.objectContaining({
        code: "continuity_index_invalid",
        name: "ContinuityControlPlaneError",
      }),
    );
    expect(existsSync(continuityIndexPath(projectRoot))).toBe(false);
  });

  it("rejects invalid continuity record writes with a machine-readable error", () => {
    const projectRoot = makeProjectRoot();
    const record = makeRecord(projectRoot);
    record.resume_contract.mode = "resume_standalone";

    expect(() => writeContinuityRecord(projectRoot, record)).toThrowError(
      expect.objectContaining({
        code: "continuity_record_invalid",
        name: "ContinuityControlPlaneError",
      }),
    );
    expect(existsSync(continuityRecordPath(projectRoot, record.record_id))).toBe(false);
  });

  it("fails closed when a continuity record is missing", () => {
    const projectRoot = makeProjectRoot();

    expect(() => readContinuityRecord(projectRoot, "continuity-missing")).toThrowError(
      expect.objectContaining({
        code: "continuity_record_not_found",
        name: "ContinuityControlPlaneError",
      }),
    );
  });

  it("fails closed when a continuity record is corrupt", () => {
    const projectRoot = makeProjectRoot();
    const recordPath = continuityRecordPath(projectRoot, "continuity-001");
    mkdirSync(resolve(projectRoot, ".circuit/control-plane/continuity-records"), { recursive: true });
    writeFileSync(recordPath, "{not-json}\n", "utf-8");

    expect(() => readContinuityRecord(projectRoot, "continuity-001")).toThrowError(
      expect.objectContaining({
        code: "continuity_record_invalid",
        name: "ContinuityControlPlaneError",
      }),
    );
  });

  it("fails closed when a continuity index is corrupt", () => {
    const projectRoot = makeProjectRoot();
    const indexPath = continuityIndexPath(projectRoot);
    mkdirSync(dirname(indexPath), { recursive: true });
    writeFileSync(indexPath, "{\"schema_version\":\"2\"}\n", "utf-8");

    try {
      readContinuityIndex(projectRoot);
      throw new Error("expected corrupt index to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ContinuityControlPlaneError);
      expect((error as ContinuityControlPlaneError).code).toBe("continuity_index_invalid");
    }
  });
});
