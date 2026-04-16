#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ContinuityStatusPayload } from "../continuity-commands.js";
import { renderRunCustomCircuitContext } from "../catalog/custom-circuits.js";
import {
  CONTINUITY_RESUME_JSON_COMMAND,
  FAST_MODE_CONTRACTS,
  HELPER_WRAPPERS,
  LOCAL_HELPER_DIR,
  type PromptHelperWrapper,
} from "../catalog/prompt-surface-contracts.js";
import { ensureProjectCircuitRoot } from "../ensure-circuit-dirs.js";
import {
  recordInvocationClassifiedStandalone,
  recordInvocationReceived,
} from "../invocation-ledger.js";
import { resolveProjectRoot } from "../project-root.js";
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

// --verbose on a bare /circuit:handoff asks the capture hook to inline
// control-plane status + warnings into the injected context. Default capture
// stays quiet: the contract already tells the model to run
// `circuit-engine continuity status --json` itself before saving, so pre-
// reading and inlining it is wasted work on every invocation.
function isHandoffCaptureVerbose(command: ParsedSlashCommand): boolean {
  return isHandoffCapture(command) && /(?:^|\s)--verbose(?:\s|$)/.test(command.argsLower);
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

function renderWrapper(wrapper: PromptHelperWrapper): string {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    "STATE_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"",
    "PLUGIN_ROOT_FILE=\"$STATE_DIR/plugin-root\"",
    "",
    "if [[ ! -f \"$PLUGIN_ROOT_FILE\" ]]; then",
    "  printf 'circuit: installed plugin root not found at %s; invoke any /circuit:* command in this project first (e.g. /circuit:run) so the plugin hook populates it\\n' \"$PLUGIN_ROOT_FILE\" >&2",
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
): void {
  const binDir = resolve(projectRoot, ".circuit", "bin");
  mkdirSync(binDir, { recursive: true });

  for (const wrapper of HELPER_WRAPPERS) {
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

function recordStandaloneClassification(
  invocationId: string | null,
  projectRoot: string,
): void {
  if (!invocationId) {
    return;
  }

  recordInvocationClassifiedStandalone({
    homeDir: process.env.HOME ?? undefined,
    invocationId,
    projectRoot,
  });
}

function renderInvocationContext(invocationId: string): string {
  return [
    "# Circuit Invocation",
    `This slash-command invocation id is \`${invocationId}\`.`,
    `If you bootstrap a workflow run for this request, include \`--invocation-id "${invocationId}"\` on the bootstrap command.`,
    "Reuse this exact invocation id end-to-end for the run started from this prompt. Do not mint another id.",
  ].join("\n");
}

function mergeContextSections(
  invocationId: string | null,
  ...sections: Array<string | null | undefined>
): string | null {
  const merged = [
    invocationId ? renderInvocationContext(invocationId) : null,
    ...sections,
  ].filter((section): section is string => typeof section === "string" && section.length > 0);

  if (merged.length === 0) {
    return null;
  }

  return merged.join("\n\n");
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
      ] : []),
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
  status: ContinuityStatusPayload,
): string {
  const lines = renderTemplate(FAST_MODE_CONTRACTS.handoff_resume.lines, {});

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

function renderHandoffDoneContext(): string {
  return renderTemplate(FAST_MODE_CONTRACTS.handoff_done.lines, {});
}

function renderHandoffCaptureContext(
  status: ContinuityStatusPayload | null,
): string {
  const lines = renderTemplate(FAST_MODE_CONTRACTS.handoff_capture.lines, {});

  if (!status) {
    return lines;
  }

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

  if (isCircuitPrompt(prompt)) {
    // Best-effort: ensure per-project circuit directories exist.
    const projInit = ensureProjectCircuitRoot(projectRoot);
    for (const warning of projInit.warnings) {
      process.stderr.write(`circuit: ${warning}\n`);
    }

    persistPluginRoot(projectRoot);
    try {
      ensureLocalHelperWrappers(projectRoot);
    } catch {
      // Best effort only. The persisted plugin root remains the primary recovery path.
    }
  }

  const command = parseCircuitSlashCommand(prompt);
  if (!command) {
    return 0;
  }

  const recordedInvocation = recordInvocationReceived({
    commandArgs: command.args,
    commandSlug: command.slug,
    homeDir: process.env.HOME ?? undefined,
    projectRoot,
    requestedCommand: `circuit:${command.slug}`,
  });
  const invocationId = recordedInvocation?.invocationId ?? null;

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
    recordStandaloneClassification(invocationId, projectRoot);
    emitContext(mergeContextSections(
      invocationId,
      renderTemplate(FAST_MODE_CONTRACTS.review_current_changes.lines, {}),
    ) ?? "");
  }

  if (isHandoffDone(command)) {
    recordStandaloneClassification(invocationId, projectRoot);
    emitContext(mergeContextSections(
      invocationId,
      renderHandoffDoneContext(),
    ) ?? "");
  }

  if (isHandoffResume(command)) {
    recordStandaloneClassification(invocationId, projectRoot);
    emitContext(mergeContextSections(
      invocationId,
      renderHandoffResumeContext(await readContinuityStatus()),
    ) ?? "");
  }

  if (isHandoffCapture(command)) {
    recordStandaloneClassification(invocationId, projectRoot);
    const status = isHandoffCaptureVerbose(command)
      ? await readContinuityStatus()
      : null;
    emitContext(mergeContextSections(
      invocationId,
      renderHandoffCaptureContext(status),
    ) ?? "");
  }

  if (isWorkflowSmoke(command)) {
    recordStandaloneClassification(invocationId, projectRoot);
    emitContext(mergeContextSections(
      invocationId,
      renderTemplate(
        FAST_MODE_CONTRACTS[`smoke_${command.slug}`].lines,
        {},
      ),
    ) ?? "");
  }

  if (isBuildSmoke(command)) {
    emitContext(mergeContextSections(
      invocationId,
      renderTemplate(FAST_MODE_CONTRACTS.build_smoke.lines, {}),
    ) ?? "");
  }

  if (requestsSavedContinuity(command)) {
    emitContext(mergeContextSections(
      invocationId,
      renderHandoffReferenceContext(command, await readContinuityStatus()),
    ) ?? "");
  }

  if (command.slug === "run") {
    try {
      const customRoutingContext = renderRunCustomCircuitContext(process.env.HOME);
      if (customRoutingContext) {
        emitContext(mergeContextSections(
          invocationId,
          customRoutingContext,
        ) ?? "");
      }
    } catch (error) {
      emitContext(mergeContextSections(
        invocationId,
        renderCustomRoutingUnavailableContext(error),
      ) ?? "");
    }
  }

  const baseInvocationContext = mergeContextSections(invocationId);
  if (baseInvocationContext) {
    emitContext(baseInvocationContext);
  }

  return 0;
}

void main().then((code) => {
  process.exit(code);
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
