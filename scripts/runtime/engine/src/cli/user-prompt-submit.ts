#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ContinuityStatusPayload } from "../continuity-commands.js";
import { renderRunCustomCircuitContext } from "../catalog/custom-circuits.js";
import type { PromptContractsManifest } from "../catalog/prompt-surface-contracts.js";
import {
  CONTINUITY_RESUME_JSON_COMMAND,
  LOCAL_HELPER_DIR,
  PROMPT_CONTRACTS_PATH,
} from "../catalog/prompt-surface-contracts.js";
import { ensureProjectCircuitRoot } from "../ensure-circuit-dirs.js";
import { recordInvocationReceived } from "../invocation-ledger.js";
import { resolveProjectRoot } from "../project-root.js";
import { REPO_ROOT } from "../schema.js";
import {
  parseCircuitSlashCommand,
  type ParsedSlashCommand,
} from "./parse-slash-command.js";

function readInput(): { prompt?: string } {
  const raw = readFileSync(0, "utf-8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as { prompt?: string };
  } catch {
    return {};
  }
}

function currentProjectRoot(): string {
  return resolveProjectRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

function isCircuitPrompt(prompt: string): boolean {
  return parseCircuitSlashCommand(prompt) !== null;
}

// Intent matchers require the intent token to be the FIRST action after the
// slug, not a substring. This keeps ordinary work like
// `/circuit:repair fix flaky smoke test` from accidentally tripping the
// bootstrap-smoke fast mode.
function isHandoffDone(command: ParsedSlashCommand): boolean {
  return command.slug === "handoff" && /^done(\s|$)/.test(command.argsLower);
}

function isHandoffResume(command: ParsedSlashCommand): boolean {
  return command.slug === "handoff" && /^resume(\s|$)/.test(command.argsLower);
}

function isHandoffCapture(command: ParsedSlashCommand): boolean {
  return command.slug === "handoff" && !isHandoffDone(command) && !isHandoffResume(command);
}

function isReviewCurrentChanges(command: ParsedSlashCommand): boolean {
  return command.slug === "review" && /^current\s+changes(\s|$)/.test(command.argsLower);
}

function isBuildSmoke(command: ParsedSlashCommand): boolean {
  if (command.slug === "build") {
    return /^smoke(\s|$)/.test(command.argsLower);
  }

  if (command.slug === "run") {
    return /^develop:\s+smoke(\s|$)/.test(command.argsLower);
  }

  return false;
}

function isWorkflowSmoke(command: ParsedSlashCommand): boolean {
  return (
    ["explore", "migrate", "repair", "sweep"].includes(command.slug)
    && /^smoke(\s|$)/.test(command.argsLower)
  );
}

function requestsSavedContinuity(command: ParsedSlashCommand): boolean {
  if (command.slug === "handoff") {
    return false;
  }

  const args = command.argsLower;
  const continuityResumePatterns = [
    /\b(?:continue|resume|pick\s*up|pickup|pick-up|follow)\s+(?:from|with)?\s*(?:the\s+|saved\s+)?(?:continuity|handoff)\b(?:\s+(?:context|record|state|summary|notes?))?(?:\s|$)/,
    /\buse\s+(?:the\s+|saved\s+)?(?:continuity|handoff)\b(?:\s+(?:context|record|state|summary|notes?))?(?:\s+(?:for|to)\b|\s*$)/,
  ];

  return continuityResumePatterns.some((pattern) => pattern.test(args));
}

function loadPromptContracts(): PromptContractsManifest {
  return JSON.parse(
    readFileSync(resolve(REPO_ROOT, PROMPT_CONTRACTS_PATH), "utf-8"),
  ) as PromptContractsManifest;
}

function persistPluginRoot(projectRoot: string): void {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) {
    return;
  }

  try {
    const stateDir = resolve(projectRoot, ".circuit");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(resolve(stateDir, "plugin-root"), `${pluginRoot}\n`, "utf-8");
  } catch {
    // Best effort only.
  }
}

function renderWrapper(wrapper: PromptContractsManifest["helper_wrappers"][number]): string {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    "STATE_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"",
    "PLUGIN_ROOT_FILE=\"$STATE_DIR/plugin-root\"",
    "",
    "if [[ ! -f \"$PLUGIN_ROOT_FILE\" ]]; then",
    "  printf 'circuit: installed plugin root not found at %s; run a /circuit:* prompt first\\n' \"$PLUGIN_ROOT_FILE\" >&2",
    "  exit 1",
    "fi",
    "",
    "PLUGIN_ROOT=\"$(tr -d '\\n' < \"$PLUGIN_ROOT_FILE\")\"",
    "if [[ -z \"$PLUGIN_ROOT\" ]]; then",
    "  printf 'circuit: installed plugin root file is empty: %s\\n' \"$PLUGIN_ROOT_FILE\" >&2",
    "  exit 1",
    "fi",
    "",
    `TARGET=\"$PLUGIN_ROOT/${wrapper.target}\"`,
    "if [[ ! -f \"$TARGET\" ]]; then",
    "  printf 'circuit: helper not found at %s\\n' \"$TARGET\" >&2",
    "  exit 1",
    "fi",
    "",
    "exec \"$TARGET\" \"$@\"",
    "",
  ].join("\n");
}

function ensureLocalHelperWrappers(
  projectRoot: string,
  manifest: PromptContractsManifest,
): void {
  const binDir = resolve(projectRoot, ".circuit", "bin");
  mkdirSync(binDir, { recursive: true });

  for (const wrapper of manifest.helper_wrappers) {
    const wrapperPath = resolve(projectRoot, wrapper.path);
    const content = renderWrapper(wrapper);
    writeFileSync(wrapperPath, content, "utf-8");
    chmodSync(wrapperPath, 0o755);
  }
}

function renderTemplate(
  lines: string[],
  replacements: Record<string, string>,
): string {
  return lines
    .map((line) => line.replace(/\{([a-z_]+)\}/g, (_, key: string) => replacements[key] ?? `{${key}}`))
    .join("\n");
}

function emitContext(additionalContext: string): never {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext,
    },
    suppressOutput: true,
  }));
  process.exit(0);
}

function renderCustomRoutingUnavailableContext(error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);

  return [
    "# Circuit Custom Routing Overlay Unavailable",
    "Do not consider user-global custom circuits for this `/circuit:run` request.",
    "Route only among the built-in workflows unless the user invokes a custom circuit directly.",
    "",
    "## Reason",
    reason,
  ].join("\n");
}

function continuityStatusLines(status: ContinuityStatusPayload): string[] {
  return continuityStatusLinesWithCurrentRunRoot(status);
}

function continuityStatusLinesWithCurrentRunRoot(
  status: ContinuityStatusPayload,
  currentRunRoot: string | null = null,
): string[] {
  return [
    `- selection: ${status.selection}`,
    `- pending_record: ${status.pending_record?.record_id ?? "none"}`,
    `- current_run: ${status.current_run?.run_slug ?? "none"}`,
    ...(currentRunRoot
      ? [`- current_run_root: ${currentRunRoot}`]
      : []),
  ];
}

type ContinuityGuidance = {
  currentRunRoot: string | null;
  lines: string[];
};

function renderSavedNextAction(status: ContinuityStatusPayload): string[] {
  const savedNextAction = status.record?.narrative.next;
  if (!savedNextAction) {
    return [];
  }

  return [
    "",
    "## Saved Next Action",
    savedNextAction,
  ];
}

function renderRunResumeGuidance(runRoot: string, intro: string): string[] {
  const semanticResumeCommand = `${LOCAL_HELPER_DIR}/circuit-engine resume --run-root "${runRoot}" --json`;

  return [
    "",
    "## Resume Workflow Run",
    `${intro} \`${semanticResumeCommand}\` to get the semantic resume step for the attached run.`,
    "Continue from the reported `resume_step`; do not invent `run attach`, `attach`, or other rebind commands.",
  ];
}

function deriveContinuityGuidance(status: ContinuityStatusPayload): ContinuityGuidance {
  if (status.selection === "none") {
    return {
      currentRunRoot: null,
      lines: [
        "",
        "No continuity is currently saved in the control plane. Do not invent a legacy handoff file.",
      ],
    };
  }

  if (status.selection === "current_run" && status.current_run) {
    return {
      currentRunRoot: status.current_run.run_root,
      lines: [
        "",
        "## Active Run Fallback",
        "No saved continuity record is selected. The indexed current run is available only as a fallback, not as saved handoff authority.",
        ...renderRunResumeGuidance(
          status.current_run.run_root,
          "As a fallback, use",
        ),
      ],
    };
  }

  const savedNextActionLines = renderSavedNextAction(status);
  const isRunBackedPendingRecord = status.selection === "pending_record"
    && status.record?.resume_contract.mode === "resume_run"
    && status.record.run_ref !== null;

  if (!isRunBackedPendingRecord) {
    return {
      currentRunRoot: null,
      lines: savedNextActionLines,
    };
  }

  if (status.warnings.length > 0 || !status.current_run) {
    return {
      currentRunRoot: null,
      lines: [
        ...savedNextActionLines,
        "",
        "The selected continuity record is run-backed, but its continuity status is warning-bearing.",
        "Do not continue a run until the mismatch is resolved.",
      ],
    };
  }

  return {
    currentRunRoot: status.current_run.run_root,
    lines: [
      ...savedNextActionLines,
      ...renderRunResumeGuidance(
        status.current_run.run_root,
        "After resolving continuity, use",
      ),
    ],
  };
}

function renderHandoffReferenceContext(
  command: ParsedSlashCommand,
  status: ContinuityStatusPayload,
): string {
  const guidance = deriveContinuityGuidance(status);

  return [
    "# Circuit Continuity Reference",
    `The user explicitly referenced saved continuity while invoking \`/circuit:${command.slug}\`.`,
    `Resolve continuity through \`${CONTINUITY_RESUME_JSON_COMMAND}\` before unrelated repo exploration.`,
    "Do not inspect legacy handoff paths or scan run roots.",
    "",
    "## Control-Plane Status",
    ...continuityStatusLinesWithCurrentRunRoot(status, guidance.currentRunRoot),
    ...guidance.lines,
    ...(status.selection !== "none"
      ? [
        "",
        "Do not `cat` `.circuit/current-run`; the mirror may be a symlink. Use control-plane status as the source of truth, and use `test -e .circuit/current-run` only for presence checks.",
      ]
      : []),
    ...(status.warnings.length > 0
      ? [
        "",
        "## Warnings",
        ...status.warnings.map((warning) => `- ${warning}`),
      ]
      : []),
  ].join("\n");
}

function renderHandoffResumeContext(
  manifest: PromptContractsManifest,
  status: ContinuityStatusPayload,
): string {
  const lines = renderTemplate(manifest.fast_modes.handoff_resume.lines, {});

  return [
    lines,
    "",
    "## Control-Plane Status",
    ...continuityStatusLines(status),
    ...(status.warnings.length > 0
      ? [
        "",
        "## Warnings",
        ...status.warnings.map((warning) => `- ${warning}`),
      ]
      : []),
  ].join("\n");
}

function renderHandoffDoneContext(
  manifest: PromptContractsManifest,
): string {
  return renderTemplate(manifest.fast_modes.handoff_done.lines, {});
}

function renderHandoffCaptureContext(
  manifest: PromptContractsManifest,
  status: ContinuityStatusPayload,
): string {
  const lines = renderTemplate(manifest.fast_modes.handoff_capture.lines, {});

  return [
    lines,
    "",
    "## Control-Plane Status",
    ...continuityStatusLinesWithCurrentRunRoot(
      status,
      status.current_run?.run_root ?? null,
    ),
    ...(status.warnings.length > 0
      ? [
        "",
        "## Warnings",
        ...status.warnings.map((warning) => `- ${warning}`),
      ]
      : []),
  ].join("\n");
}

async function main(): Promise<number> {
  const input = readInput();
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const projectRoot = currentProjectRoot();
  const manifest = loadPromptContracts();

  if (isCircuitPrompt(prompt)) {
    // Best-effort: ensure per-project circuit directories exist.
    const projInit = ensureProjectCircuitRoot(projectRoot);
    for (const warning of projInit.warnings) {
      process.stderr.write(`circuit: ${warning}\n`);
    }

    persistPluginRoot(projectRoot);
    try {
      ensureLocalHelperWrappers(projectRoot, manifest);
    } catch {
      // Best effort only. The persisted plugin root remains the primary recovery path.
    }
  }

  const command = parseCircuitSlashCommand(prompt);
  if (!command) {
    return 0;
  }

  // Best-effort: record invocation and write sidecar for bootstrap correlation.
  recordInvocationReceived({
    commandArgs: command.args,
    commandSlug: command.slug,
    homeDir: process.env.HOME ?? undefined,
    projectRoot,
    requestedCommand: `circuit:${command.slug}`,
  });

  let continuityStatus: ContinuityStatusPayload | null = null;
  const readContinuityStatus = async (): Promise<ContinuityStatusPayload> => {
    if (continuityStatus) {
      return continuityStatus;
    }

    const { getContinuityStatus } = await import("../continuity-commands.js");
    continuityStatus = getContinuityStatus(resolveProjectRoot(projectRoot));
    return continuityStatus;
  };

  if (isReviewCurrentChanges(command)) {
    emitContext(renderTemplate(manifest.fast_modes.review_current_changes.lines, {}));
  }

  if (isHandoffDone(command)) {
    emitContext(renderHandoffDoneContext(manifest));
  }

  if (isHandoffResume(command)) {
    emitContext(renderHandoffResumeContext(manifest, await readContinuityStatus()));
  }

  if (isHandoffCapture(command)) {
    emitContext(renderHandoffCaptureContext(manifest, await readContinuityStatus()));
  }

  if (isWorkflowSmoke(command)) {
    emitContext(renderTemplate(
      manifest.fast_modes[`smoke_${command.slug}`].lines,
      {},
    ));
  }

  if (isBuildSmoke(command)) {
    emitContext(renderTemplate(manifest.fast_modes.build_smoke.lines, {}));
  }

  if (requestsSavedContinuity(command)) {
    emitContext(renderHandoffReferenceContext(command, await readContinuityStatus()));
  }

  if (command.slug === "run") {
    try {
      const customRoutingContext = renderRunCustomCircuitContext(process.env.HOME);
      if (customRoutingContext) {
        emitContext(customRoutingContext);
      }
    } catch (error) {
      emitContext(renderCustomRoutingUnavailableContext(error));
    }
  }

  return 0;
}

void main().then((code) => {
  process.exit(code);
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
