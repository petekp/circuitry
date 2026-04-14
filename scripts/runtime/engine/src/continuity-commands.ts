import { existsSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, join, resolve } from "node:path";

import {
  type ContinuityCurrentRunV1,
  type ContinuityIndexV1,
  type ContinuityKind,
  type ContinuityPendingRecordV1,
  type ContinuityRecordV1,
  type ContinuitySaveRequestV1,
  continuityRunRootPath,
  continuityRunRootRel,
  createContinuityRecordId,
  createEmptyContinuityIndex,
  deleteContinuityRecordByPayload,
  readContinuityIndexOrEmpty,
  readPendingContinuityRecord,
  setContinuityPendingRecord,
  writeContinuityIndex,
  writeContinuityRecord,
} from "./continuity-control-plane.js";
import { resolveProjectRoot } from "./project-root.js";
import { renderActiveRun } from "./render-active-run.js";
import { loadOrRebuildState } from "./resume.js";

type ContinuityCommand = "clear" | "resume" | "save" | "status";

type Writer = {
  write(chunk: string): void;
};

interface ParsedContinuityArgs {
  command: ContinuityCommand;
  field?: string;
  flags: Record<string, string>;
  help: boolean;
  json: boolean;
}

export interface ContinuityCurrentRunSummary extends ContinuityCurrentRunV1 {
  run_root: string;
}

export interface ContinuityStatusPayload {
  current_run: ContinuityCurrentRunSummary | null;
  pending_record: ContinuityPendingRecordV1 | null;
  project_root: string;
  record: ContinuityRecordV1 | null;
  selection: "current_run" | "none" | "pending_record";
  warnings: string[];
}

export const CONTINUITY_USAGE = [
  "Usage: continuity [status|save|resume|clear] [options]",
  "",
  "Commands:",
  "  status  Show indexed current run, pending record, and continuity warnings",
  "  save    Write a continuity record and update index.pending_record",
  "  resume  Resolve continuity in priority order: pending_record, current_run, none",
  "  clear   Delete pending continuity and detach current_run",
  "",
  "Common options:",
  "  --project-root <path>  Resolve continuity for this project root (defaults to cwd/git root)",
  "  --json                 Print JSON instead of key=value lines",
  "  --field <name>         Print one flattened field instead of the full payload",
  "",
  "Save options:",
  "  --run-root <path>         Optional run root for run-backed continuity",
  "  --cwd <path>              Working directory recorded in the continuity record",
  "  --goal <text>             Required narrative goal",
  "  --next <text>             Required next action",
  "  --state-markdown <text>   Required state markdown",
  "  --debt-markdown <text>    Required debt markdown (typed bullets or literal `none` when no debt should be stored)",
  "",
].join("\n");

const TYPED_DEBT_PREFIX_PATTERN = "(RULED OUT|DECIDED|BLOCKED|CONSTRAINT)";
const TYPED_DEBT_LINE = new RegExp(`^\\s*-\\s+${TYPED_DEBT_PREFIX_PATTERN}:\\s+.+$`);
const TYPED_DEBT_IN_STATE_LINE = new RegExp(
  `^\\s*[-*]\\s+(?:\\*\\*)?${TYPED_DEBT_PREFIX_PATTERN}(?:\\*\\*)?:\\s+.+$`,
  "i",
);

function requireFlagValue(flag: string, next?: string): string {
  if (!next || next.startsWith("--")) {
    throw new Error(`continuity: missing value for ${flag}`);
  }

  return next;
}

function parseContinuityArgs(argv: string[]): ParsedContinuityArgs {
  let command: ContinuityCommand = "status";
  let startIndex = 0;

  if (argv[0]) {
    if (argv[0] === "status" || argv[0] === "save" || argv[0] === "resume" || argv[0] === "clear") {
      command = argv[0];
      startIndex = 1;
    } else if (!argv[0].startsWith("--")) {
      throw new Error(`continuity: unknown command: ${argv[0]}`);
    }
  }

  const flags: Record<string, string> = {};
  let field: string | undefined;
  let help = false;
  let json = false;

  for (let index = startIndex; index < argv.length; index++) {
    const value = argv[index];

    switch (value) {
      case "--help":
        help = true;
        break;
      case "--json":
        json = true;
        break;
      case "--field":
        field = requireFlagValue(value, argv[index + 1]);
        index++;
        break;
      default:
        if (!value.startsWith("--")) {
          throw new Error(`continuity: unknown argument: ${value}`);
        }
        flags[value.slice(2)] = requireFlagValue(value, argv[index + 1]);
        index++;
        break;
    }
  }

  return {
    command,
    field,
    flags,
    help,
    json,
  };
}

function flattenPayload(
  value: unknown,
  prefix = "",
  output: Record<string, string> = {},
): Record<string, string> {
  if (value === null || value === undefined) {
    if (prefix) {
      output[prefix] = "";
    }
    return output;
  }

  if (Array.isArray(value)) {
    if (prefix) {
      output[prefix] = JSON.stringify(value);
    }
    return output;
  }

  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenPayload(nestedValue, nextPrefix, output);
    }
    return output;
  }

  if (prefix) {
    output[prefix] = String(value);
  }
  return output;
}

function printPayload(
  payload: object,
  json: boolean,
  field: string | undefined,
  stdout: Writer,
): number {
  if (json) {
    stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  const flat = flattenPayload(payload);
  if (field) {
    if (!(field in flat)) {
      throw new Error(`continuity: unknown field: ${field}`);
    }

    stdout.write(`${flat[field]}\n`);
    return 0;
  }

  stdout.write(
    `${Object.entries(flat).map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
  );
  return 0;
}

function resolveCliProjectRoot(flags: Record<string, string>): string {
  const projectRoot = resolveProjectRoot(flags["project-root"] ?? process.cwd());
  return existsSync(projectRoot) ? realpathSync(projectRoot) : resolve(projectRoot);
}

function gitValue(projectRoot: string, args: string[]): string | null {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    return null;
  }

  const trimmed = result.stdout.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function gitSnapshot(projectRoot: string, cwd: string): ContinuityRecordV1["git"] {
  const head = gitValue(projectRoot, ["rev-parse", "--verify", "HEAD"]);
  return {
    base_commit: head,
    branch: gitValue(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]),
    cwd,
    head,
  };
}

function selectContinuitySource(index: ContinuityIndexV1): "current_run" | "none" | "pending_record" {
  if (index.pending_record) {
    return "pending_record";
  }

  if (index.current_run) {
    return "current_run";
  }

  return "none";
}

function continuityWarnings(
  index: ContinuityIndexV1,
  pendingRecord: ContinuityRecordV1 | null,
): string[] {
  const warnings: string[] = [];

  if (!pendingRecord?.run_ref) {
    return warnings;
  }

  if (!index.current_run) {
    warnings.push(
      `Pending continuity references run ${pendingRecord.run_ref.run_slug}, but no indexed current run is attached.`,
    );
    return warnings;
  }

  if (index.current_run.run_slug !== pendingRecord.run_ref.run_slug) {
    warnings.push(
      `Pending continuity references run ${pendingRecord.run_ref.run_slug}, but the indexed current run is ${index.current_run.run_slug}.`,
    );
    return warnings;
  }

  if (index.current_run.runtime_status !== pendingRecord.run_ref.runtime_status_at_save) {
    warnings.push(
      `Pending continuity was saved at runtime status ${pendingRecord.run_ref.runtime_status_at_save ?? "null"}, but the indexed current run is now ${index.current_run.runtime_status ?? "null"}.`,
    );
  }

  if (index.current_run.current_step !== pendingRecord.run_ref.current_step_at_save) {
    warnings.push(
      `Pending continuity was saved at current step ${pendingRecord.run_ref.current_step_at_save ?? "null"}, but the indexed current run is now ${index.current_run.current_step ?? "null"}.`,
    );
  }

  return warnings;
}

function validateRunRoot(projectRoot: string, runRoot: string): { runRoot: string; runSlug: string } {
  const resolvedRunRoot = resolve(runRoot);
  const canonicalRunRoot = existsSync(resolvedRunRoot)
    ? realpathSync(resolvedRunRoot)
    : resolvedRunRoot;
  const runSlug = basename(resolvedRunRoot);
  const expectedRunRoot = continuityRunRootPath(projectRoot, runSlug);

  if (canonicalRunRoot !== expectedRunRoot) {
    throw new Error(
      `continuity: run root must live under ${join(projectRoot, ".circuit", "circuit-runs")}: ${canonicalRunRoot}`,
    );
  }

  return {
    runRoot: canonicalRunRoot,
    runSlug,
  };
}

function resolveSaveRunRoot(
  projectRoot: string,
  explicitRunRoot: string | undefined,
  index: ContinuityIndexV1,
): { runRoot: string; runSlug: string } | null {
  if (explicitRunRoot) {
    return validateRunRoot(projectRoot, explicitRunRoot);
  }

  if (!index.current_run) {
    return null;
  }

  return {
    runRoot: continuityRunRootPath(projectRoot, index.current_run.run_slug),
    runSlug: index.current_run.run_slug,
  };
}

function currentRunSummary(
  projectRoot: string,
  currentRun: ContinuityCurrentRunV1 | null,
): ContinuityCurrentRunSummary | null {
  if (!currentRun) {
    return null;
  }

  return {
    ...currentRun,
    run_root: continuityRunRootPath(projectRoot, currentRun.run_slug),
  };
}

function pendingRecordSummary(
  pendingRecord: ContinuityPendingRecordV1 | null,
): ContinuityPendingRecordV1 | null {
  return pendingRecord;
}

function normalizeDebtMarkdown(rawDebtMarkdown: string): string {
  const trimmed = rawDebtMarkdown.trim();
  if (!trimmed) {
    throw new Error(
      "continuity: --debt-markdown is required (use typed bullets, or literal `none` only when there is no real debt)",
    );
  }

  return /^none$/i.test(trimmed) ? "" : rawDebtMarkdown;
}

function validateDebtMarkdownPlacement(stateMarkdown: string, debtMarkdown: string): void {
  const stateDebtLine = stateMarkdown.split(/\r?\n/u).find((line) => TYPED_DEBT_IN_STATE_LINE.test(line));
  if (stateDebtLine) {
    throw new Error(
      "continuity: move DECIDED:/CONSTRAINT:/BLOCKED:/RULED OUT: bullets from --state-markdown to --debt-markdown",
    );
  }

  if (!debtMarkdown) {
    return;
  }

  const invalidDebtLine = debtMarkdown
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .find((line) => line.trim().length > 0 && !TYPED_DEBT_LINE.test(line));

  if (invalidDebtLine) {
    throw new Error(
      "continuity: --debt-markdown entries must be typed bullets beginning with RULED OUT:, DECIDED:, BLOCKED:, or CONSTRAINT:",
    );
  }
}

function saveContinuity(
  projectRoot: string,
  flags: Record<string, string>,
): Record<string, unknown> {
  const saveRequest: ContinuitySaveRequestV1 = {
    cwd: resolve(flags.cwd ?? process.cwd()),
    debt_markdown: flags["debt-markdown"] ?? "",
    goal: flags.goal ?? "",
    next: flags.next ?? "",
    state_markdown: flags["state-markdown"] ?? "",
  };

  if (!saveRequest.goal) {
    throw new Error("continuity: --goal is required");
  }
  if (!saveRequest.next) {
    throw new Error("continuity: --next is required");
  }
  if (!saveRequest.state_markdown) {
    throw new Error("continuity: --state-markdown is required");
  }
  const debtMarkdown = normalizeDebtMarkdown(saveRequest.debt_markdown);
  validateDebtMarkdownPlacement(saveRequest.state_markdown, debtMarkdown);

  const index = readContinuityIndexOrEmpty(projectRoot);
  const resolvedRun = resolveSaveRunRoot(projectRoot, flags["run-root"], index);
  const createdAt = new Date().toISOString();

  let continuityKind: ContinuityKind = "standalone";
  let runRef: ContinuityRecordV1["run_ref"] = null;
  let runSlug: string | null = null;

  if (resolvedRun) {
    const state = loadOrRebuildState(resolvedRun.runRoot) as Record<string, any>;
    const manifestPresent = existsSync(join(resolvedRun.runRoot, "circuit.manifest.yaml"));
    continuityKind = "run_ref";
    runSlug = resolvedRun.runSlug;
    runRef = {
      current_step_at_save:
        typeof state.current_step === "string" ? state.current_step : null,
      manifest_present: manifestPresent,
      run_root_rel: continuityRunRootRel(resolvedRun.runSlug),
      run_slug: resolvedRun.runSlug,
      runtime_status_at_save:
        typeof state.status === "string" ? state.status : null,
      runtime_updated_at_at_save:
        typeof state.updated_at === "string" ? state.updated_at : null,
    };
  }

  const record: ContinuityRecordV1 = {
    created_at: createdAt,
    git: gitSnapshot(projectRoot, saveRequest.cwd),
    narrative: {
      debt_markdown: debtMarkdown,
      goal: saveRequest.goal,
      next: saveRequest.next,
      state_markdown: saveRequest.state_markdown,
    },
    project_root: projectRoot,
    record_id: createContinuityRecordId(),
    resume_contract: {
      auto_resume: false,
      mode: runRef ? "resume_run" : "resume_standalone",
      requires_explicit_resume: true,
    },
    run_ref: runRef,
    schema_version: "1",
  };

  const { path, payloadRel } = writeContinuityRecord(projectRoot, record);
  const pendingRecord: ContinuityPendingRecordV1 = {
    continuity_kind: continuityKind,
    created_at: createdAt,
    payload_rel: payloadRel,
    record_id: record.record_id,
    run_slug: runSlug,
  };
  const updatedIndex = setContinuityPendingRecord(projectRoot, pendingRecord);

  return {
    continuity_kind: continuityKind,
    current_run: currentRunSummary(projectRoot, updatedIndex.current_run),
    pending_record: pendingRecordSummary(updatedIndex.pending_record),
    project_root: projectRoot,
    record,
    record_path: path,
  };
}

function refreshActiveRunFromCurrentRun(
  projectRoot: string,
  currentRun: ContinuityCurrentRunV1,
): { active_run_markdown: string | null; active_run_path: string | null } {
  const runRoot = continuityRunRootPath(projectRoot, currentRun.run_slug);
  const activeRunPath = join(runRoot, "artifacts", "active-run.md");
  const manifestPath = join(runRoot, "circuit.manifest.yaml");

  if (existsSync(manifestPath)) {
    const rendered = renderActiveRun(runRoot);
    return {
      active_run_markdown: rendered.markdown,
      active_run_path: rendered.activeRunPath,
    };
  }

  if (existsSync(activeRunPath)) {
    return {
      active_run_markdown: readFileSync(activeRunPath, "utf-8"),
      active_run_path: activeRunPath,
    };
  }

  return {
    active_run_markdown: null,
    active_run_path: null,
  };
}

export function getContinuityStatus(projectRoot: string): ContinuityStatusPayload {
  const index = readContinuityIndexOrEmpty(projectRoot);
  const pendingRecord = readPendingContinuityRecord(projectRoot, index);

  return {
    current_run: currentRunSummary(projectRoot, index.current_run),
    pending_record: pendingRecordSummary(index.pending_record),
    project_root: projectRoot,
    record: pendingRecord,
    selection: selectContinuitySource(index),
    warnings: continuityWarnings(index, pendingRecord),
  };
}

function resumeContinuity(projectRoot: string): Record<string, unknown> {
  const index = readContinuityIndexOrEmpty(projectRoot);
  const pendingRecord = readPendingContinuityRecord(projectRoot, index);
  const warnings = continuityWarnings(index, pendingRecord);

  if (pendingRecord) {
    return {
      current_run: currentRunSummary(projectRoot, index.current_run),
      pending_record: pendingRecordSummary(index.pending_record),
      project_root: projectRoot,
      record: pendingRecord,
      source: "pending_record",
      warnings,
    };
  }

  if (index.current_run) {
    return {
      ...refreshActiveRunFromCurrentRun(projectRoot, index.current_run),
      current_run: currentRunSummary(projectRoot, index.current_run),
      pending_record: null,
      project_root: projectRoot,
      record: null,
      source: "current_run",
      warnings: [],
    };
  }

  return {
    active_run_markdown: null,
    active_run_path: null,
    current_run: null,
    message: "No saved continuity found. Nothing to resume.",
    pending_record: null,
    project_root: projectRoot,
    record: null,
    source: "none",
    warnings: [],
  };
}

function clearContinuity(projectRoot: string): Record<string, unknown> {
  const index = readContinuityIndexOrEmpty(projectRoot);
  const deletedRecordId = index.pending_record?.record_id ?? null;
  const deletedRecordPath = index.pending_record
    ? deleteContinuityRecordByPayload(projectRoot, index.pending_record.payload_rel)
    : null;

  index.pending_record = null;
  index.current_run = null;
  writeContinuityIndex(projectRoot, index);

  return {
    cleared_current_run: true,
    cleared_pending_record: true,
    deleted_record_id: deletedRecordId,
    deleted_record_path: deletedRecordPath,
    project_root: projectRoot,
  };
}

export function runContinuityCommand(
  argv: string[],
  io: { stderr?: Writer; stdout?: Writer } = {},
): number {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;

  try {
    const parsed = parseContinuityArgs(argv);
    if (parsed.help) {
      stdout.write(`${CONTINUITY_USAGE}\n`);
      return 0;
    }

    const projectRoot = resolveCliProjectRoot(parsed.flags);
    let payload: object;

    switch (parsed.command) {
      case "status":
        payload = getContinuityStatus(projectRoot);
        break;
      case "save":
        payload = saveContinuity(projectRoot, parsed.flags);
        break;
      case "resume":
        payload = resumeContinuity(projectRoot);
        break;
      case "clear":
        payload = clearContinuity(projectRoot);
        break;
    }

    return printPayload(payload, parsed.json, parsed.field, stdout);
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
