import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";

import { loadJsonSchemaCached, validate } from "./schema.js";

export const CONTINUITY_CONTROL_PLANE_DIR_REL = ".circuit/control-plane";
export const CONTINUITY_INDEX_REL = `${CONTINUITY_CONTROL_PLANE_DIR_REL}/continuity-index.json`;
export const CONTINUITY_RECORDS_DIR_REL = `${CONTINUITY_CONTROL_PLANE_DIR_REL}/continuity-records`;

export type ContinuityKind = "run_ref" | "standalone";

export interface ContinuityCurrentRunV1 {
  attached_at: string;
  current_step: string | null;
  last_validated_at: string;
  manifest_present: boolean;
  run_root_rel: `.circuit/circuit-runs/${string}`;
  run_slug: string;
  runtime_status: string | null;
}

export interface ContinuityPendingRecordV1 {
  continuity_kind: ContinuityKind;
  created_at: string;
  payload_rel: `.circuit/control-plane/continuity-records/${string}.json`;
  record_id: string;
  run_slug: string | null;
}

export interface ContinuityIndexV1 {
  current_run: ContinuityCurrentRunV1 | null;
  pending_record: ContinuityPendingRecordV1 | null;
  project_root: string;
  schema_version: "1";
}

export interface ContinuityRunRefV1 {
  current_step_at_save: string | null;
  manifest_present: boolean;
  run_root_rel: `.circuit/circuit-runs/${string}`;
  run_slug: string;
  runtime_status_at_save: string | null;
  runtime_updated_at_at_save: string | null;
}

export interface ContinuityRecordV1 {
  created_at: string;
  git: {
    base_commit: string | null;
    branch: string | null;
    cwd: string;
    head: string | null;
  };
  narrative: {
    debt_markdown: string;
    goal: string;
    next: string;
    state_markdown: string;
  };
  project_root: string;
  record_id: string;
  resume_contract: {
    auto_resume: false;
    mode: "resume_run" | "resume_standalone";
    requires_explicit_resume: true;
  };
  run_ref: ContinuityRunRefV1 | null;
  schema_version: "1";
}

export interface ContinuitySaveRequestV1 {
  cwd: string;
  debt_markdown: string;
  goal: string;
  next: string;
  state_markdown: string;
}

export type ContinuityControlPlaneErrorCode =
  | "continuity_index_invalid"
  | "continuity_index_io"
  | "continuity_record_invalid"
  | "continuity_record_io"
  | "continuity_record_not_found";

export class ContinuityControlPlaneError extends Error {
  code: ContinuityControlPlaneErrorCode;
  details: Record<string, unknown>;

  constructor(
    code: ContinuityControlPlaneErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ContinuityControlPlaneError";
    this.code = code;
    this.details = details;
  }
}

const CONTINUITY_INDEX_SCHEMA = loadJsonSchemaCached(
  "schemas/continuity-index.schema.json",
);
const CONTINUITY_RECORD_SCHEMA = loadJsonSchemaCached(
  "schemas/continuity-record.schema.json",
);

function canonicalProjectRoot(projectRoot: string): string {
  return realpathSync(projectRoot);
}

export function continuityControlPlaneDir(projectRoot: string): string {
  return resolve(projectRoot, CONTINUITY_CONTROL_PLANE_DIR_REL);
}

export function continuityIndexPath(projectRoot: string): string {
  return resolve(projectRoot, CONTINUITY_INDEX_REL);
}

export function continuityRecordsDir(projectRoot: string): string {
  return resolve(projectRoot, CONTINUITY_RECORDS_DIR_REL);
}

export function continuityRecordPayloadRel(
  recordId: string,
): `.circuit/control-plane/continuity-records/${string}.json` {
  return `${CONTINUITY_RECORDS_DIR_REL}/${recordId}.json`;
}

export function continuityRunRootRel(
  runSlug: string,
): `.circuit/circuit-runs/${string}` {
  return `.circuit/circuit-runs/${runSlug}`;
}

export function continuityRecordPath(projectRoot: string, recordId: string): string {
  return resolve(projectRoot, continuityRecordPayloadRel(recordId));
}

export function continuityRunRootPath(
  projectRoot: string,
  runSlug: string,
): string {
  return resolve(projectRoot, continuityRunRootRel(runSlug));
}

export function createContinuityRecordId(): string {
  return `continuity-${randomUUID()}`;
}

export function createEmptyContinuityIndex(projectRoot: string): ContinuityIndexV1 {
  const canonicalRoot = canonicalProjectRoot(projectRoot);
  return {
    current_run: null,
    pending_record: null,
    project_root: canonicalRoot,
    schema_version: "1",
  };
}

export function validateContinuityIndex(index: ContinuityIndexV1): string[] {
  const schemaErrors = validate(CONTINUITY_INDEX_SCHEMA, index as unknown as object);
  if (schemaErrors.length > 0) {
    return schemaErrors;
  }

  const errors: string[] = [];

  if (
    index.pending_record
    && index.pending_record.payload_rel !== continuityRecordPayloadRel(index.pending_record.record_id)
  ) {
    errors.push("/pending_record/payload_rel: must match record_id");
  }

  if (
    index.pending_record?.continuity_kind === "standalone"
    && index.pending_record.run_slug !== null
  ) {
    errors.push("/pending_record/run_slug: must be null for standalone continuity");
  }

  if (
    index.pending_record?.continuity_kind === "run_ref"
    && (!index.pending_record.run_slug || index.pending_record.run_slug.length === 0)
  ) {
    errors.push("/pending_record/run_slug: must be present for run_ref continuity");
  }

  return errors;
}

export function validateContinuityRecord(record: ContinuityRecordV1): string[] {
  const schemaErrors = validate(CONTINUITY_RECORD_SCHEMA, record as unknown as object);
  if (schemaErrors.length > 0) {
    return schemaErrors;
  }

  const errors: string[] = [];

  if (
    record.run_ref
    && record.resume_contract.mode !== "resume_run"
  ) {
    errors.push("/resume_contract/mode: must be resume_run when run_ref is present");
  }

  if (
    !record.run_ref
    && record.resume_contract.mode !== "resume_standalone"
  ) {
    errors.push("/resume_contract/mode: must be resume_standalone when run_ref is null");
  }

  return errors;
}

function assertIndexMatchesProjectRoot(
  projectRoot: string,
  index: ContinuityIndexV1,
): string[] {
  const canonicalRoot = canonicalProjectRoot(projectRoot);
  const errors: string[] = [];

  if (index.project_root !== canonicalRoot) {
    errors.push("/project_root: must match the real project root");
  }

  if (
    index.current_run
    && index.current_run.run_root_rel !== `.circuit/circuit-runs/${index.current_run.run_slug}`
  ) {
    errors.push("/current_run/run_root_rel: must match current_run.run_slug");
  }

  return errors;
}

function assertRecordMatchesProjectRoot(
  projectRoot: string,
  record: ContinuityRecordV1,
): string[] {
  const canonicalRoot = canonicalProjectRoot(projectRoot);
  const errors: string[] = [];

  if (record.project_root !== canonicalRoot) {
    errors.push("/project_root: must match the real project root");
  }

  if (
    record.run_ref
    && record.run_ref.run_root_rel !== `.circuit/circuit-runs/${record.run_ref.run_slug}`
  ) {
    errors.push("/run_ref/run_root_rel: must match run_ref.run_slug");
  }

  return errors;
}

function writeJsonAtomically(
  targetPath: string,
  data: object,
  errorCode: "continuity_index_io" | "continuity_record_io",
): void {
  const directory = dirname(targetPath);
  mkdirSync(directory, { recursive: true });
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;

  try {
    writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
    renameSync(tempPath, targetPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw new ContinuityControlPlaneError(
      errorCode,
      `Failed to write ${targetPath}`,
      {
        cause: error instanceof Error ? error.message : String(error),
        path: targetPath,
      },
    );
  }
}

function readJsonFile(targetPath: string): unknown {
  const contents = readFileSync(targetPath, "utf-8");
  return JSON.parse(contents) as unknown;
}

export function readContinuityIndex(projectRoot: string): ContinuityIndexV1 | null {
  const path = continuityIndexPath(projectRoot);
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = readJsonFile(path) as ContinuityIndexV1;
    const errors = [
      ...validateContinuityIndex(parsed),
      ...assertIndexMatchesProjectRoot(projectRoot, parsed),
    ];
    if (errors.length > 0) {
      throw new ContinuityControlPlaneError(
        "continuity_index_invalid",
        "Continuity index failed validation",
        { errors, path },
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof ContinuityControlPlaneError) {
      throw error;
    }

    throw new ContinuityControlPlaneError(
      "continuity_index_invalid",
      "Continuity index could not be parsed",
      {
        cause: error instanceof Error ? error.message : String(error),
        path,
      },
    );
  }
}

export function writeContinuityIndex(projectRoot: string, index: ContinuityIndexV1): string {
  const errors = [
    ...validateContinuityIndex(index),
    ...assertIndexMatchesProjectRoot(projectRoot, index),
  ];
  if (errors.length > 0) {
    throw new ContinuityControlPlaneError(
      "continuity_index_invalid",
      "Refusing to write an invalid continuity index",
      { errors, path: continuityIndexPath(projectRoot) },
    );
  }

  const path = continuityIndexPath(projectRoot);
  writeJsonAtomically(path, index as unknown as object, "continuity_index_io");
  return path;
}

function loadOrCreateContinuityIndex(projectRoot: string): ContinuityIndexV1 {
  return readContinuityIndex(projectRoot) ?? createEmptyContinuityIndex(projectRoot);
}

export function readContinuityIndexOrEmpty(projectRoot: string): ContinuityIndexV1 {
  return readContinuityIndex(projectRoot) ?? createEmptyContinuityIndex(projectRoot);
}

export interface UpsertContinuityCurrentRunOptions {
  attachedAt?: string;
  currentStep: string | null;
  lastValidatedAt?: string;
  manifestPresent: boolean;
  projectRoot: string;
  runSlug: string;
  runtimeStatus: string | null;
}

export function upsertContinuityCurrentRun(
  options: UpsertContinuityCurrentRunOptions,
): ContinuityIndexV1 {
  const index = loadOrCreateContinuityIndex(options.projectRoot);
  const timestamp = options.lastValidatedAt ?? new Date().toISOString();
  const existingAttachedAt =
    index.current_run?.run_slug === options.runSlug
      ? index.current_run.attached_at
      : null;

  index.current_run = {
    attached_at: options.attachedAt ?? existingAttachedAt ?? timestamp,
    current_step: options.currentStep,
    last_validated_at: timestamp,
    manifest_present: options.manifestPresent,
    run_root_rel: continuityRunRootRel(options.runSlug),
    run_slug: options.runSlug,
    runtime_status: options.runtimeStatus,
  };
  writeContinuityIndex(options.projectRoot, index);
  return index;
}

export function clearContinuityCurrentRun(projectRoot: string): ContinuityIndexV1 {
  const index = loadOrCreateContinuityIndex(projectRoot);
  index.current_run = null;
  writeContinuityIndex(projectRoot, index);
  return index;
}

export function setContinuityPendingRecord(
  projectRoot: string,
  pendingRecord: ContinuityPendingRecordV1 | null,
): ContinuityIndexV1 {
  const index = loadOrCreateContinuityIndex(projectRoot);
  index.pending_record = pendingRecord;
  writeContinuityIndex(projectRoot, index);
  return index;
}

export function clearContinuityPendingRecord(projectRoot: string): ContinuityIndexV1 {
  return setContinuityPendingRecord(projectRoot, null);
}

export function readContinuityRecordByPayload(
  projectRoot: string,
  payloadRel: `.circuit/control-plane/continuity-records/${string}.json`,
): ContinuityRecordV1 {
  if (!payloadRel.startsWith(`${CONTINUITY_RECORDS_DIR_REL}/`)) {
    throw new ContinuityControlPlaneError(
      "continuity_record_invalid",
      "Continuity record payload path is outside the control-plane record store",
      { payload_rel: payloadRel },
    );
  }

  const recordPath = resolve(projectRoot, payloadRel);
  if (!existsSync(recordPath)) {
    throw new ContinuityControlPlaneError(
      "continuity_record_not_found",
      "Continuity record does not exist",
      {
        path: recordPath,
        payload_rel: payloadRel,
      },
    );
  }

  try {
    const parsed = readJsonFile(recordPath) as ContinuityRecordV1;
    const errors = [
      ...validateContinuityRecord(parsed),
      ...assertRecordMatchesProjectRoot(projectRoot, parsed),
    ];
    if (errors.length > 0) {
      throw new ContinuityControlPlaneError(
        "continuity_record_invalid",
        "Continuity record failed validation",
        {
          errors,
          path: recordPath,
          payload_rel: payloadRel,
        },
      );
    }

    if (payloadRel !== continuityRecordPayloadRel(parsed.record_id)) {
      throw new ContinuityControlPlaneError(
        "continuity_record_invalid",
        "Continuity record payload path does not match its record_id",
        {
          expected_payload_rel: continuityRecordPayloadRel(parsed.record_id),
          path: recordPath,
          payload_rel: payloadRel,
          record_id: parsed.record_id,
        },
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof ContinuityControlPlaneError) {
      throw error;
    }

    throw new ContinuityControlPlaneError(
      "continuity_record_invalid",
      "Continuity record could not be parsed",
      {
        cause: error instanceof Error ? error.message : String(error),
        path: recordPath,
        payload_rel: payloadRel,
      },
    );
  }
}

export function readContinuityRecord(
  projectRoot: string,
  recordId: string,
): ContinuityRecordV1 {
  return readContinuityRecordByPayload(
    projectRoot,
    continuityRecordPayloadRel(recordId),
  );
}

export function writeContinuityRecord(
  projectRoot: string,
  record: ContinuityRecordV1,
): { path: string; payloadRel: `.circuit/control-plane/continuity-records/${string}.json` } {
  const errors = [
    ...validateContinuityRecord(record),
    ...assertRecordMatchesProjectRoot(projectRoot, record),
  ];
  if (errors.length > 0) {
    throw new ContinuityControlPlaneError(
      "continuity_record_invalid",
      "Refusing to write an invalid continuity record",
      {
        errors,
        path: continuityRecordPath(projectRoot, record.record_id),
      },
    );
  }

  const payloadRel = continuityRecordPayloadRel(record.record_id);
  const path = resolve(projectRoot, payloadRel);
  writeJsonAtomically(path, record as unknown as object, "continuity_record_io");
  return { path, payloadRel };
}

export function readPendingContinuityRecord(
  projectRoot: string,
  index: ContinuityIndexV1 = readContinuityIndexOrEmpty(projectRoot),
): ContinuityRecordV1 | null {
  const pending = index.pending_record;
  if (!pending) {
    return null;
  }

  const record = readContinuityRecordByPayload(projectRoot, pending.payload_rel);
  const errors: string[] = [];

  if (pending.record_id !== record.record_id) {
    errors.push("/pending_record/record_id: must match record.record_id");
  }

  if (pending.continuity_kind === "standalone" && record.run_ref !== null) {
    errors.push("/pending_record/continuity_kind: standalone pending record must point to a standalone record");
  }

  if (pending.continuity_kind === "run_ref") {
    if (!record.run_ref) {
      errors.push("/pending_record/continuity_kind: run_ref pending record must point to a run_ref record");
    } else if (pending.run_slug !== record.run_ref.run_slug) {
      errors.push("/pending_record/run_slug: must match record.run_ref.run_slug");
    }
  }

  if (errors.length > 0) {
    throw new ContinuityControlPlaneError(
      "continuity_record_invalid",
      "Pending continuity record does not match the continuity index",
      {
        errors,
        payload_rel: pending.payload_rel,
        record_id: pending.record_id,
      },
    );
  }

  return record;
}

export function deleteContinuityRecordByPayload(
  projectRoot: string,
  payloadRel: `.circuit/control-plane/continuity-records/${string}.json`,
): string {
  if (!payloadRel.startsWith(`${CONTINUITY_RECORDS_DIR_REL}/`)) {
    throw new ContinuityControlPlaneError(
      "continuity_record_invalid",
      "Continuity record payload path is outside the control-plane record store",
      { payload_rel: payloadRel },
    );
  }

  const recordPath = resolve(projectRoot, payloadRel);
  rmSync(recordPath, { force: true });
  return recordPath;
}
