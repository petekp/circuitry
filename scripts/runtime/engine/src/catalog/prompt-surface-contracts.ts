/**
 * Owns model-facing contract fragments for public prompt surfaces.
 * This is the single semantic source for generated command shims,
 * generated skill contract sections, generated CIRCUITS.md contract blocks,
 * and generated hook fast-mode payload templates.
 */

import { resolve } from "node:path";

import { getPublicCommandInvocation } from "./public-surface.js";
import { firstSentence } from "./surface-text.js";
import type {
  AdapterEntry,
  BlockGenerateTarget,
  Catalog,
  CircuitKind,
  UtilityEntry,
  WorkflowEntry,
} from "./types.js";

export const LOCAL_HELPER_DIR = ".circuit/bin";
export const PROMPT_CONTRACTS_PATH = "scripts/runtime/generated/prompt-contracts.json";
export const CONTINUITY_STATUS_JSON_COMMAND = `${LOCAL_HELPER_DIR}/circuit-engine continuity status --json`;
export const CONTINUITY_RESUME_JSON_COMMAND = `${LOCAL_HELPER_DIR}/circuit-engine continuity resume --json`;
export const CONTINUITY_CLEAR_JSON_COMMAND = `${LOCAL_HELPER_DIR}/circuit-engine continuity clear --json`;

export interface PromptHelperWrapper {
  name: string;
  path: string;
  target: string;
}

interface PromptSurfaceSummary {
  bootstrap_style: string;
  canonical_command?: string;
  canonical_invocation: string;
  helper_wrappers: string[];
  kind: CircuitKind;
  proof_artifacts: string[];
  stop_condition: string;
  forbidden_manual_fabrication?: string[];
}

export interface PromptFastModeContract {
  id: string;
  lines: string[];
  placeholders: string[];
  stop_condition: string;
}

interface SemanticWorkflowContract {
  slug: "explore" | "migrate" | "repair" | "sweep";
  label: string;
  blockName: string;
  defaultEntryMode: string;
  routeLine: string;
  stopLine: string;
}

interface SkillContractTargetSpec {
  blockName: string;
  filePath: string;
  render: () => string;
  slug: string;
}

export interface PromptContractsManifest {
  fast_modes: Record<string, PromptFastModeContract>;
  helper_wrappers: PromptHelperWrapper[];
  schema_version: "1";
  surfaces: Record<string, PromptSurfaceSummary>;
}

export const HELPER_WRAPPERS: PromptHelperWrapper[] = [
  {
    name: "circuit-engine",
    path: `${LOCAL_HELPER_DIR}/circuit-engine`,
    target: "scripts/relay/circuit-engine.sh",
  },
  {
    name: "compose-prompt",
    path: `${LOCAL_HELPER_DIR}/compose-prompt`,
    target: "scripts/relay/compose-prompt.sh",
  },
  {
    name: "dispatch",
    path: `${LOCAL_HELPER_DIR}/dispatch`,
    target: "scripts/relay/dispatch.sh",
  },
  {
    name: "update-batch",
    path: `${LOCAL_HELPER_DIR}/update-batch`,
    target: "scripts/relay/update-batch.sh",
  },
  {
    name: "gather-git-state",
    path: `${LOCAL_HELPER_DIR}/gather-git-state`,
    target: "skills/handoff/scripts/gather-git-state.sh",
  },
];

const BUILD_PROOF_ARTIFACTS = [
  "circuit.manifest.yaml",
  "events.ndjson",
  "state.json",
  "artifacts/active-run.md",
];

const SEMANTIC_PROOF_ARTIFACTS = BUILD_PROOF_ARTIFACTS;
const DERIVED_STATE_SNAPSHOT_TEXT = "the derived `state.json` snapshot";
const RUN_STATE_ARTIFACTS_TEXT =
  "`circuit.manifest.yaml`, `events.ndjson`, the derived `state.json` snapshot, and `artifacts/active-run.md`";

const BUILD_SMOKE_RUN_SLUG = 'RUN_SLUG="smoke-bootstrap-build-workflow-host-surface"';
const BUILD_SMOKE_RUN_ROOT_LINE = 'RUN_ROOT=".circuit/circuit-runs/${RUN_SLUG}"';
const BUILD_SMOKE_ENGINE_CHECK_LINE = `test -x ${LOCAL_HELPER_DIR}/circuit-engine`;
const BOOTSTRAP_INVOCATION_ID_FLAG = '--invocation-id "${INVOCATION_ID:-}"';
const BUILD_SMOKE_BOOTSTRAP_PREFIX_LINES = [
  `${LOCAL_HELPER_DIR}/circuit-engine bootstrap \\`,
  '  --workflow "build" \\',
  '  --run-root "$RUN_ROOT" \\',
];
const BUILD_SMOKE_BOOTSTRAP_SUFFIX_LINES = [
  '  --goal "<smoke bootstrap objective>" \\',
  `  ${BOOTSTRAP_INVOCATION_ID_FLAG} \\`,
  '  --project-root "$PWD"',
];
const BUILD_SMOKE_VALIDATION_CHECK_LINES = [
  'test -f "$RUN_ROOT/circuit.manifest.yaml"',
  'test -f "$RUN_ROOT/events.ndjson"',
  'test -f "$RUN_ROOT/state.json"',
  'test -f "$RUN_ROOT/artifacts/active-run.md"',
];

const SURFACE_SUMMARIES: Record<string, Omit<PromptSurfaceSummary, "canonical_invocation" | "kind">> = {
  build: {
    bootstrap_style: "semantic-bootstrap",
    canonical_command: `${LOCAL_HELPER_DIR}/circuit-engine bootstrap --workflow build`,
    helper_wrappers: ["circuit-engine", "compose-prompt", "dispatch"],
    proof_artifacts: BUILD_PROOF_ARTIFACTS,
    stop_condition: "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Plan, Act, Verify, Review, or Close.",
    forbidden_manual_fabrication: BUILD_PROOF_ARTIFACTS,
  },
  create: {
    bootstrap_style: "guided-utility",
    helper_wrappers: ["circuit-engine"],
    proof_artifacts: [
      "~/.claude/circuit/drafts/<slug>/SKILL.md",
      "~/.claude/circuit/drafts/<slug>/circuit.yaml",
      "~/.claude/circuit/overlay/manifest.json",
    ],
    stop_condition: "Draft, validate, summarize, and wait for explicit publish confirmation before materializing installed command surface changes.",
  },
  explore: {
    bootstrap_style: "semantic-bootstrap",
    canonical_command: `${LOCAL_HELPER_DIR}/circuit-engine bootstrap --workflow explore`,
    helper_wrappers: ["circuit-engine", "compose-prompt", "dispatch"],
    proof_artifacts: SEMANTIC_PROOF_ARTIFACTS,
    stop_condition: "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Analyze, Decide/Plan, or Close.",
    forbidden_manual_fabrication: SEMANTIC_PROOF_ARTIFACTS,
  },
  handoff: {
    bootstrap_style: "fast-mode-first",
    helper_wrappers: ["circuit-engine", "gather-git-state"],
    proof_artifacts: [
      ".circuit/control-plane/continuity-index.json",
      ".circuit/control-plane/continuity-records/<record-id>.json",
    ],
    stop_condition: "Resolve the selected fast mode before any broader repo exploration.",
  },
  migrate: {
    bootstrap_style: "semantic-bootstrap",
    canonical_command: `${LOCAL_HELPER_DIR}/circuit-engine bootstrap --workflow migrate`,
    helper_wrappers: ["circuit-engine", "compose-prompt", "dispatch"],
    proof_artifacts: SEMANTIC_PROOF_ARTIFACTS,
    stop_condition: "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Analyze, Plan, Act, Verify, Review, or Close.",
    forbidden_manual_fabrication: SEMANTIC_PROOF_ARTIFACTS,
  },
  repair: {
    bootstrap_style: "semantic-bootstrap",
    canonical_command: `${LOCAL_HELPER_DIR}/circuit-engine bootstrap --workflow repair`,
    helper_wrappers: ["circuit-engine"],
    proof_artifacts: SEMANTIC_PROOF_ARTIFACTS,
    stop_condition: "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Analyze, Fix, Verify, Review, or Close.",
    forbidden_manual_fabrication: SEMANTIC_PROOF_ARTIFACTS,
  },
  review: {
    bootstrap_style: "fast-mode-first",
    helper_wrappers: ["compose-prompt", "dispatch"],
    proof_artifacts: ["review.md"],
    stop_condition: "Execute the selected review fast mode before broader context gathering.",
  },
  run: {
    bootstrap_style: "router-then-bootstrap",
    canonical_command: `${LOCAL_HELPER_DIR}/circuit-engine bootstrap --workflow build`,
    helper_wrappers: ["circuit-engine", "dispatch"],
    proof_artifacts: BUILD_PROOF_ARTIFACTS,
    stop_condition: "If the task is an explicit smoke/bootstrap verification, stop after validating the selected workflow run state.",
    forbidden_manual_fabrication: BUILD_PROOF_ARTIFACTS,
  },
  sweep: {
    bootstrap_style: "semantic-bootstrap",
    canonical_command: `${LOCAL_HELPER_DIR}/circuit-engine bootstrap --workflow sweep`,
    helper_wrappers: ["circuit-engine", "compose-prompt", "dispatch"],
    proof_artifacts: SEMANTIC_PROOF_ARTIFACTS,
    stop_condition: "Stop after validation for smoke/bootstrap requests. Do not continue into Frame, Survey, Queue, Batch Execute, Verify, Deferred Review, or Close.",
    forbidden_manual_fabrication: SEMANTIC_PROOF_ARTIFACTS,
  },
  workers: {
    bootstrap_style: "adapter-orchestration",
    helper_wrappers: ["compose-prompt", "dispatch", "update-batch"],
    proof_artifacts: ["{relay_root}/batch.json"],
    stop_condition: "Use only the adapter-owned relay helpers and stop after the orchestration state is updated.",
  },
};

const SEMANTIC_WORKFLOW_CONTRACTS: readonly SemanticWorkflowContract[] = [
  {
    slug: "explore",
    label: "Explore",
    blockName: "EXPLORE_CONTRACT",
    defaultEntryMode: "default",
    routeLine: "If a spec or direct explore request already determined the route, follow it immediately instead of reclassifying.",
    stopLine: "Stop here. Do not continue into Frame/Analyze/Decide/Close or do unrelated repo exploration.",
  },
  {
    slug: "migrate",
    label: "Migrate",
    blockName: "MIGRATE_CONTRACT",
    defaultEntryMode: "default",
    routeLine: "When the slash command already selected Migrate, stay on that path immediately instead of reclassifying the task.",
    stopLine: "Stop here. Do not continue into Frame/Analyze/Plan/Act/Verify/Review/Close or do unrelated repo exploration.",
  },
  {
    slug: "repair",
    label: "Repair",
    blockName: "REPAIR_CONTRACT",
    defaultEntryMode: "default",
    routeLine: "When Repair is already selected, stay on the repair path immediately instead of reclassifying the task.",
    stopLine: "Stop here. Do not continue into Frame/Analyze/Fix/Verify/Review/Close or do unrelated repo exploration.",
  },
  {
    slug: "sweep",
    label: "Sweep",
    blockName: "SWEEP_CONTRACT",
    defaultEntryMode: "default",
    routeLine: "When Sweep is already selected, stay on that path immediately instead of reclassifying the task.",
    stopLine: "Stop here. Do not continue into Frame/Survey/Queue/Batch/Verify/Review/Close or do unrelated repo exploration.",
  },
];

const SEMANTIC_WORKFLOW_CONTRACTS_BY_SLUG = Object.fromEntries(
  SEMANTIC_WORKFLOW_CONTRACTS.map((contract) => [contract.slug, contract]),
) as Record<SemanticWorkflowContract["slug"], SemanticWorkflowContract>;

const HANDOFF_CONTINUATION_RULE = `When pending continuity exists, route as follows. If the Circuit slash-command args are an explicit continuation signal (\`continue\`, \`go\`, \`resume\`, \`pick up\`, \`keep going\`), resolve it through \`${CONTINUITY_RESUME_JSON_COMMAND}\` and auto-resume without asking first. Skip resume and treat the request as fresh when the args name a concrete new task -- a new task overrides saved continuity. For any other input -- including empty args, short acknowledgments like \`ok\`/\`yes\`/\`yep\`, or genuinely ambiguous args -- call AskUserQuestion with predicted responses (\`Resume pending continuity\` / \`Start fresh\` / \`Clear pending then start fresh\`) before consuming saved continuity. Only continue a run when the selected continuity output is run-backed and warning-free. If continuity resolves only to \`current_run\`, treat that as fallback instead of saved handoff authority. Do not invent attach or rebind commands.`;

const HANDOFF_CAPTURE_CONFIRMATION = "After a successful save, confirm briefly with: Handoff saved. Next session: run `/circuit:handoff resume` to inspect and continue, or name a new task via `/circuit:run <task>` to start fresh.";

export const FAST_MODE_CONTRACTS: Record<string, PromptFastModeContract> = {
  build_smoke: {
    id: "build_smoke",
    lines: [
      "# Circuit Build Smoke Contract",
      "This prompt is an explicit Build bootstrap smoke verification.",
      "If the prompt uses `/circuit:run develop:`, the route is already fixed to Build. Do not rediscover the workflow from repo docs.",
      "Do not run `--help`, inspect cache layout, or search the repo to rediscover the bootstrap flags. Use the exact command shape below.",
      renderBuildSmokeRunSlugLine("  # or the same slug derived from the task"),
      BUILD_SMOKE_RUN_ROOT_LINE,
      BUILD_SMOKE_ENGINE_CHECK_LINE,
      renderBuildSmokeBootstrapInlineCommand('"lite"'),
      `Do not use \`Write\`, \`Edit\`, heredocs, or manual file creation to fabricate \`circuit.manifest.yaml\`, \`events.ndjson\`, ${DERIVED_STATE_SNAPSHOT_TEXT}, or \`artifacts/active-run.md\`.`,
      `After bootstrap, validate with \`test -f\` checks for ${RUN_STATE_ARTIFACTS_TEXT} under \`$RUN_ROOT\`.`,
      "After bootstrap, validate those on-disk artifacts, report the selected run root briefly, and stop.",
      "Do not continue into Frame, Plan, Act, Verify, Review, or Close for this smoke request.",
    ],
    placeholders: [],
    stop_condition: "Stop after validating Build bootstrap artifacts.",
  },
  handoff_done: {
    id: "handoff_done",
    lines: [
      "# Circuit Handoff Done Contract",
      "This prompt is the explicit handoff completion fast mode.",
      `Run \`${CONTINUITY_CLEAR_JSON_COMMAND}\`.`,
      "This clears the pending continuity record and detaches indexed `current_run`.",
      "Do not manually delete handoff files, archive dashboards, or scan run roots.",
      "Do not bootstrap new work or do broad repo exploration.",
      "Stop after reporting completion.",
    ],
    placeholders: [],
    stop_condition: "Stop after clearing continuity.",
  },
  handoff_capture: {
    id: "handoff_capture",
    lines: [
      "# Circuit Handoff Capture Contract",
      "This prompt is the default continuity capture mode for `/circuit:handoff`.",
      "Default flow: draft from conversation, print a compact preview, save through the engine immediately. No modal cascade.",
      `Check current control-plane status with \`${CONTINUITY_STATUS_JSON_COMMAND}\` before deciding what to save.`,
      "Treat that status as reference only. An existing `pending_record` does not satisfy the current bare `/circuit:handoff` request.",
      "Step 1 -- Draft from conversation context. Infer goal, next (prefixed DO: or DECIDE:), state (facts the next session needs that git/log/diff cannot show), and debt (typed bullets: DECIDED:, CONSTRAINT:, BLOCKED:, RULED OUT:). Do not interrogate the user for fields the conversation already made clear.",
      "Detect closeout framing. If the user signaled a chapter close (e.g. 'we just finished', 'wrapping up', 'starting fresh on'), treat this as a closeout: goal seeds the next chapter; state lists completed work as DONE: reference bullets; debt carries forward only binding constraints.",
      "Step 2 -- Print a compact preview (no more than ~8 lines: Goal, Next, the State headline, the Debt count). Do not dump the full body. The preview is the user's chance to interrupt before save by typing.",
      "Step 3 -- Save through the engine immediately. Do NOT call AskUserQuestion in the default path. The chained `Save? / Edit? / Closeout? / Don't save?` modal cascade is removed.",
      "Only call AskUserQuestion when inference genuinely fails: (a) the auto-draft produced an empty or trivially-restated Goal or Next, or (b) closeout was detected and conversation context provided no clear seed candidate. When asking is warranted, ask exactly one question with predicted responses; never chain a second modal. Field edits go through a free-text revision after save, not through a follow-up modal.",
      `Save with \`${LOCAL_HELPER_DIR}/circuit-engine continuity save --cwd \"$PWD\" --goal \"...\" --next \"DO: ...\" --state-markdown \"$STATE_MARKDOWN\" --debt-markdown \"$DEBT_MARKDOWN\" --json\`.`,
      "When real debt exists, encode it as typed `--debt-markdown` bullets.",
      "Do not move `DECIDED:`, `CONSTRAINT:`, `BLOCKED:`, or `RULED OUT:` bullets into `--state-markdown`; those belong only in `--debt-markdown`.",
      "If there is no real debt, literal `none` is allowed only as a CLI convenience; the engine normalizes it before persistence so resume never shows the sentinel.",
      "If indexed `current_run` exists, bind the save to that run with `--run-root` using the indexed run root from control-plane status.",
      "Do not stop after merely summarizing current status, active-run state, or an already-saved pending record.",
      `Use \`${LOCAL_HELPER_DIR}/gather-git-state\` when git context is helpful, but do not restate facts a future session can recover cheaply from git.`,
      "If there is no indexed current run, no pending record, and no hard-to-rediscover session context worth preserving, say there is nothing useful to capture and stop.",
      "Supported handoff commands are `/circuit:handoff`, `/circuit:handoff resume`, and `/circuit:handoff done`.",
      "Do not invent `/circuit:handoff save` or `/circuit:handoff clear` aliases.",
      "Do not inspect legacy handoff paths, scan run roots, or write `handoff.md`.",
      HANDOFF_CAPTURE_CONFIRMATION,
      "Do not dump the saved continuity body back to the user during capture mode.",
      "Stop after either reporting that nothing useful could be captured or confirming the save.",
    ],
    placeholders: [],
    stop_condition: "Stop after saving continuity or reporting that no capture is needed.",
  },
  handoff_resume: {
    id: "handoff_resume",
    lines: [
      "# Circuit Handoff Resume Contract",
      "This prompt is the explicit continuity resume fast mode.",
      `Run \`${CONTINUITY_RESUME_JSON_COMMAND}\`.`,
      "This resolves continuity only through the control plane in priority order: pending_record, current_run, none.",
      "Start the response with `# Circuit Resume`.",
      "If `source` is `pending_record`, present the saved narrative and warnings from the command output.",
      "If `source` is `current_run`, present the returned `active_run_markdown`.",
      "If `source` is `none`, report `No saved continuity found. Nothing to resume.`",
      "Do not inspect canonical handoff paths, scan run roots, or surface fallback-only guesses.",
      "Do not bootstrap new work or do broad repo exploration.",
      "Stop after presenting the resume context.",
    ],
    placeholders: [],
    stop_condition: "Stop after presenting saved continuity.",
  },
  smoke_explore: createWorkflowSmokeFastMode("explore", "Explore", "default"),
  smoke_migrate: createWorkflowSmokeFastMode("migrate", "Migrate", "default"),
  smoke_repair: createWorkflowSmokeFastMode("repair", "Repair", "default"),
  smoke_sweep: createWorkflowSmokeFastMode("sweep", "Sweep", "default"),
  review_current_changes: {
    id: "review_current_changes",
    lines: [
      "# Circuit Review Current-Changes Contract",
      "This prompt is the explicit current-changes review fast mode.",
      "Do not bootstrap `.circuit` state or do broad repo exploration.",
      "Inspect only the current uncommitted diff in the working tree.",
      "Mention the concrete paths you reviewed, including `review-scope-sentinel.ts` when it is part of the diff.",
      "End the response with a line that begins `Review verdict:`.",
      "Stop after the review result.",
    ],
    placeholders: [],
    stop_condition: "Stop after the review result.",
  },
};

function createWorkflowSmokeFastMode(
  workflowSlug: string,
  workflowLabel: string,
  defaultEntryMode: string,
): PromptFastModeContract {
  return {
    id: `smoke_${workflowSlug}`,
    lines: [
      `# Circuit ${workflowLabel} Smoke Contract`,
      `This prompt is an explicit ${workflowLabel} bootstrap smoke verification.`,
      "Do not run `--help`, inspect cache layout, or search the repo to rediscover the bootstrap flags. Use the exact command shape below.",
      `RUN_SLUG="${workflowSlug}-smoke-bootstrap"  # or the same slug derived from the task`,
      "RUN_ROOT=\".circuit/circuit-runs/${RUN_SLUG}\"",
      `ENTRY_MODE="${defaultEntryMode}"`,
      BUILD_SMOKE_ENGINE_CHECK_LINE,
      renderWorkflowSmokeBootstrapInlineCommand(workflowSlug, `"$ENTRY_MODE"`),
      `After bootstrap, validate with \`test -f\` checks for ${RUN_STATE_ARTIFACTS_TEXT} under \`$RUN_ROOT\`.`,
      `Do not use \`Write\`, \`Edit\`, heredocs, or manual file creation to fabricate \`circuit.manifest.yaml\`, \`events.ndjson\`, ${DERIVED_STATE_SNAPSHOT_TEXT}, or \`artifacts/active-run.md\`.`,
      "Validate those on-disk artifacts, report the selected run root briefly, and stop.",
      "Do not continue into the normal workflow phases or broader repo exploration for this smoke request.",
    ],
    placeholders: [],
    stop_condition: "Stop after validating bootstrap artifacts.",
  };
}

function renderShellFence(lines: string[]): string {
  return ["```bash", ...lines, "```"].join("\n");
}

function renderBuildSmokeRunSlugLine(comment?: string): string {
  return comment ? `${BUILD_SMOKE_RUN_SLUG}${comment}` : BUILD_SMOKE_RUN_SLUG;
}

function renderBuildSmokeBootstrapInlineCommand(entryMode: string): string {
  return [
    `${LOCAL_HELPER_DIR}/circuit-engine bootstrap`,
    '--workflow "build"',
    '--run-root "$RUN_ROOT"',
    `--entry-mode ${entryMode}`,
    '--goal "<smoke bootstrap objective>"',
    BOOTSTRAP_INVOCATION_ID_FLAG,
    '--project-root "$PWD"',
  ].join(" ");
}

function renderWorkflowSmokeBootstrapInlineCommand(
  workflowSlug: string,
  entryMode: string,
): string {
  return [
    `${LOCAL_HELPER_DIR}/circuit-engine bootstrap`,
    `--workflow "${workflowSlug}"`,
    '--run-root "$RUN_ROOT"',
    `--entry-mode ${entryMode}`,
    '--goal "<smoke bootstrap objective>"',
    BOOTSTRAP_INVOCATION_ID_FLAG,
    '--project-root "$PWD"',
  ].join(" ");
}

function getBuildSmokeShellFenceLines({
  entryModeAssignment,
  entryModeArgument,
  includeValidationChecks = false,
  runSlugComment,
}: {
  entryModeArgument: string;
  entryModeAssignment?: string;
  includeValidationChecks?: boolean;
  runSlugComment?: string;
}): string[] {
  const lines = [
    renderBuildSmokeRunSlugLine(runSlugComment),
    BUILD_SMOKE_RUN_ROOT_LINE,
  ];

  if (entryModeAssignment) {
    lines.push(entryModeAssignment, "");
  }

  lines.push(
    BUILD_SMOKE_ENGINE_CHECK_LINE,
    "",
    ...BUILD_SMOKE_BOOTSTRAP_PREFIX_LINES,
    entryModeArgument,
    ...BUILD_SMOKE_BOOTSTRAP_SUFFIX_LINES,
  );

  if (includeValidationChecks) {
    lines.push("", ...BUILD_SMOKE_VALIDATION_CHECK_LINES);
  }

  return lines;
}

function getSurfaceContractDefinition(
  slug: string,
): Omit<PromptSurfaceSummary, "canonical_invocation" | "kind"> {
  const summary = SURFACE_SUMMARIES[slug];
  if (!summary) {
    throw new Error(`catalog-compiler: missing prompt-surface contract for ${slug}`);
  }

  return summary;
}

function renderHelperWrapperSection(wrapperNames: string[]): string {
  const checks = wrapperNames.length > 0
    ? wrapperNames.map((name) => `test -x ${LOCAL_HELPER_DIR}/${name}`)
    : [`test -d ${LOCAL_HELPER_DIR}`];

  return [
    "## Local Helper Wrappers",
    "",
    "Circuit's `/circuit:*` hook writes local helper wrappers under `.circuit/bin/` before these instructions run.",
    "Use those wrappers directly. Do not inspect plugin cache layout, repo structure, or installed helper paths to rediscover Circuit helpers.",
    "",
    renderShellFence(checks),
  ].join("\n");
}

function renderBuildContractBlock(): string {
  return [
    "## Direct Invocation Contract",
    "",
    "Action-first rules for `/circuit:build`:",
    "",
    "1. First action is semantic bootstrap through `.circuit/bin/circuit-engine`.",
    "2. Use hook-authored helper wrappers from `.circuit/bin/`. Do not inspect the plugin cache or repo structure to rediscover them.",
    "3. Create or validate `.circuit/circuit-runs/<slug>/...` before unrelated repo reads.",
    "4. Do not start with \"let me understand the current state first\" or broad repo exploration before bootstrap completes.",
    "5. If routing already selected Build, stay on that path immediately instead of reclassifying.",
    "6. If bootstrap already happened, continue from the current phase instead of re-exploring.",
    `7. ${HANDOFF_CONTINUATION_RULE}`,
    "8. Never use `Write`, `Edit`, heredocs, or manual file creation to fabricate Build run state; `.circuit/bin/circuit-engine bootstrap` must materialize it.",
    "",
    renderHelperWrapperSection(getSurfaceContractDefinition("build").helper_wrappers),
    "",
    "## Smoke Bootstrap Mode",
    "",
    "If the request is explicitly a smoke/bootstrap verification of the Build workflow (for example it says `smoke`, asks to bootstrap, or mentions host-surface verification), do not run the full Build lifecycle.",
    "",
    "Instead:",
    "",
    "1. Bootstrap the run root through `.circuit/bin/circuit-engine`.",
    `2. Validate Build scaffolding exists: ${RUN_STATE_ARTIFACTS_TEXT}.`,
    "3. Report the validated run root and scaffold state briefly.",
    "4. Stop here. Do not write `brief.md`, resolve checkpoints, inspect unrelated repo files, or continue into Plan/Act/Verify/Review/Close.",
    "",
    "A smoke verification that only reports git branch/status, repo cleanliness, or top-level directory contents is not valid smoke evidence. The proof must be the on-disk `.circuit` run state and Build scaffold.",
    "",
    `Hand-written \`Write\`/\`Edit\` creation of \`circuit.manifest.yaml\`, \`events.ndjson\`, ${DERIVED_STATE_SNAPSHOT_TEXT}, or \`artifacts/active-run.md\` is a smoke failure.`,
    "",
    "Use the real bootstrap path, then prove it with the concrete files:",
    "",
    renderShellFence(getBuildSmokeShellFenceLines({
      entryModeAssignment: 'ENTRY_MODE="lite"',
      entryModeArgument: '  --entry-mode "$ENTRY_MODE" \\',
      includeValidationChecks: true,
      runSlugComment: "  # derived from the task",
    })),
  ].join("\n");
}

function renderSemanticWorkflowContractBlock(
  contract: SemanticWorkflowContract,
): string {
  const { defaultEntryMode, label, routeLine, slug, stopLine } = contract;
  return [
    "## Direct Invocation Contract",
    "",
    `Action-first rules for \`/circuit:${slug}\`:`,
    "",
    "1. First action is semantic bootstrap through `.circuit/bin/circuit-engine`.",
    "2. Use hook-authored helper wrappers from `.circuit/bin/`. Do not inspect the plugin cache or repo structure to rediscover Circuit helpers.",
    "3. Create or validate `.circuit/circuit-runs/<slug>/...` before unrelated repo reads.",
    "4. Do not start with \"let me understand the current state first\" before bootstrap completes.",
    `5. ${routeLine}`,
    "6. If bootstrap already happened, continue from the current phase instead of re-exploring.",
    `7. ${HANDOFF_CONTINUATION_RULE}`,
    "8. Never use `Write`, `Edit`, heredocs, or manual file creation to fabricate workflow run state; `.circuit/bin/circuit-engine bootstrap` must materialize it.",
    "",
    renderHelperWrapperSection(getSurfaceContractDefinition(slug).helper_wrappers),
    "",
    "## Smoke Bootstrap Mode",
    "",
    `If the request is explicitly a smoke/bootstrap verification of ${label} (for example it says \`smoke\`, asks to bootstrap, or mentions host-surface verification), bootstrap only.`,
    "",
    `1. Bootstrap the ${label} run root through \`.circuit/bin/circuit-engine\`.`,
    `2. Validate ${label} scaffolding exists: ${RUN_STATE_ARTIFACTS_TEXT}.`,
    "3. Report the validated run root and scaffold state briefly.",
    `4. ${stopLine}`,
    "",
    `Repo cleanliness, branch status, or directory listings are not valid smoke evidence. The proof must be the on-disk \`.circuit\` run root and ${label} scaffold.`,
    "",
    "Use the real bootstrap path, then prove it with the concrete files:",
    "",
    renderShellFence([
      `RUN_SLUG="${slug}-smoke-bootstrap"  # or the same slug derived from the task`,
      'RUN_ROOT=".circuit/circuit-runs/${RUN_SLUG}"',
      `ENTRY_MODE="${defaultEntryMode}"`,
      "",
      BUILD_SMOKE_ENGINE_CHECK_LINE,
      "",
      `${LOCAL_HELPER_DIR}/circuit-engine bootstrap \\`,
      `  --workflow "${slug}" \\`,
      '  --run-root "$RUN_ROOT" \\',
      '  --entry-mode "$ENTRY_MODE" \\',
      '  --goal "<smoke bootstrap objective>" \\',
      `  ${BOOTSTRAP_INVOCATION_ID_FLAG} \\`,
      '  --project-root "$PWD"',
      "",
      ...BUILD_SMOKE_VALIDATION_CHECK_LINES,
    ]),
  ].join("\n");
}

function renderRunContractBlock(): string {
  return [
    "## Direct Invocation Contract",
    "",
    "Action-first rules for `/circuit:run`:",
    "",
    "1. If the task prefix already fixes the route (`fix:`, `develop:`, `decide:`, `migrate:`, `cleanup:`, `overnight:`), take that route immediately.",
    "2. When a route is already selected, bootstrap that workflow immediately or hand off into its bootstrap path immediately.",
    "3. Use hook-authored helper wrappers from `.circuit/bin/`. Do not inspect the plugin cache or repo structure to rediscover Circuit helpers.",
    "4. Do not use generic repo exploration or the trivial inline path before a predetermined route has created or validated workflow run state.",
    "5. Once a workflow is selected, create or validate `.circuit/circuit-runs/<slug>/...` before unrelated repo reads.",
    "6. If the run is already bootstrapped, continue from the current phase instead of re-exploring.",
    `7. ${HANDOFF_CONTINUATION_RULE}`,
    "8. If the request is an explicit smoke/bootstrap verification of the workflow, dispatch into that workflow's bootstrap-only smoke mode and stop after validating run state.",
    "9. Smoke validation is invalid unless the selected workflow scaffold exists on disk. Branch status, repo cleanliness, and top-level directory listings are not run-state evidence.",
    "10. Never use `Write`, `Edit`, heredocs, or manual file creation to fabricate `.circuit` run state; semantic bootstrap must create it.",
    "",
    renderHelperWrapperSection(getSurfaceContractDefinition("run").helper_wrappers),
    "",
    "## Smoke Bootstrap Dispatch",
    "",
    "When an intent hint already selects the workflow and the task is an explicit smoke/bootstrap verification, do not stop at classification.",
    "",
    "- Execute the real workflow bootstrap path.",
    "- Validate the resulting `.circuit` files on disk.",
    "- Stop after reporting those run-state facts.",
    "- Do not substitute git branch/status checks or repo inventory for bootstrap evidence.",
    "- Do not hand-write smoke artifacts with `Write` or ad hoc shell file creation.",
    "",
    "For `/circuit:run develop: ...` smoke requests, use the real Build bootstrap path with Lite rigor:",
    "",
    renderShellFence(getBuildSmokeShellFenceLines({
      entryModeAssignment: 'BUILD_ENTRY_MODE="lite"',
      entryModeArgument: '  --entry-mode "$BUILD_ENTRY_MODE" \\',
      includeValidationChecks: true,
      runSlugComment: "  # derived from the task",
    })),
  ].join("\n");
}

function renderHandoffFastModesBlock(): string {
  return [
    "## Fast Modes",
    "",
    `- \`/circuit:handoff done\` -- run \`${CONTINUITY_CLEAR_JSON_COMMAND}\`, report completion, and stop.`,
    `- \`/circuit:handoff resume\` -- run \`${CONTINUITY_RESUME_JSON_COMMAND}\`, present the selected continuity source, and stop before unrelated repo exploration.`,
    "",
    renderHelperWrapperSection(getSurfaceContractDefinition("handoff").helper_wrappers),
  ].join("\n");
}

function renderReviewFastModesBlock(): string {
  return [
    "## Fast Modes",
    "",
    "- Explicit scope: if the user names files, directories, or a diff target, use that scope immediately.",
    "- Current changes: if no explicit scope was given and the repo has uncommitted changes, review that diff immediately.",
    "- Recent commit diff: if there is no explicit scope and no uncommitted diff, review the most recent commit diff.",
    "",
    "Do not start with broad repo exploration. Scope selection is mechanical and happens before context gathering.",
    "",
    renderHelperWrapperSection(getSurfaceContractDefinition("review").helper_wrappers),
  ].join("\n");
}

function renderWorkersHelperBlock(): string {
  return renderHelperWrapperSection(getSurfaceContractDefinition("workers").helper_wrappers);
}

function renderCircuitsSmokeContract(): string {
  return [
    "## Smoke Bootstrap Verification",
    "",
    "For Build host-surface smoke checks such as `/circuit:run develop: smoke ...` or `/circuit:build smoke ...`:",
    "",
    "- Treat the request as Build bootstrap-only verification.",
    "- First action: run the real bootstrap command directly:",
    "",
    renderShellFence(getBuildSmokeShellFenceLines({
      entryModeArgument: '  --entry-mode "lite" \\',
    })),
    `- Valid proof is the canonical manifest/event pair plus derived outputs on disk: ${RUN_STATE_ARTIFACTS_TEXT}.`,
    "- Never fabricate those files with `Write`, `Edit`, heredocs, or ad hoc shell writes.",
    "- Do not run `--help` or search the repo to rediscover the required bootstrap flags; use the exact command shape above.",
    "- Stop after validation. Do not continue into planning or broader repo exploration for a smoke request.",
  ].join("\n");
}

function getSurfaceSummary(
  entry: WorkflowEntry | UtilityEntry | AdapterEntry,
): PromptSurfaceSummary {
  const summary = getSurfaceContractDefinition(entry.slug);

  return {
    ...summary,
    canonical_invocation: entry.kind === "adapter"
      ? `circuit:${entry.slug} (internal adapter)`
      : getPublicCommandInvocation(entry),
    kind: entry.kind,
  };
}

export function buildPromptContractsManifest(catalog: Catalog): PromptContractsManifest {
  const surfaces = Object.fromEntries(
    catalog.map((entry) => [entry.slug, getSurfaceSummary(entry)]),
  );

  return {
    fast_modes: FAST_MODE_CONTRACTS,
    helper_wrappers: HELPER_WRAPPERS,
    schema_version: "1",
    surfaces,
  };
}

export function renderPromptContractsJson(catalog: Catalog): string {
  return `${JSON.stringify(buildPromptContractsManifest(catalog), null, 2)}\n`;
}

const WORKFLOW_EXAMPLE_INVOCATIONS: Record<string, string[]> = {
  build: [
    "/circuit:build add a dark-mode toggle",
    "/circuit:build refactor the auth middleware",
  ],
  explore: [
    "/circuit:explore options for replacing zustand",
    "/circuit:explore how does the upload flow work",
  ],
  repair: [
    "/circuit:repair login drops the session after refresh",
    "/circuit:repair flaky auth-e2e test on CI",
  ],
  migrate: [
    "/circuit:migrate zustand -> redux-toolkit",
    "/circuit:migrate webpack -> vite",
  ],
  sweep: [
    "/circuit:sweep unused exports under src/",
    "/circuit:sweep any-types in the engine package",
  ],
};

interface RouterIntentPrefix {
  prefix: string;
  workflow: string;
  rigor: string;
}

const ROUTER_INTENT_PREFIXES: readonly RouterIntentPrefix[] = [
  { prefix: "fix:", workflow: "Repair", rigor: "Lite" },
  { prefix: "repair:", workflow: "Repair", rigor: "Deep" },
  { prefix: "develop:", workflow: "Build", rigor: "Standard" },
  { prefix: "decide:", workflow: "Explore", rigor: "Tournament" },
  { prefix: "migrate:", workflow: "Migrate", rigor: "Deep" },
  { prefix: "cleanup:", workflow: "Sweep", rigor: "Standard" },
  { prefix: "overnight:", workflow: "Sweep", rigor: "Autonomous" },
];

function renderShimExampleCodeBlock(lines: string[]): string {
  return ["```", ...lines, "```"].join("\n");
}

function renderShimPurposeSection(description: string): string {
  return ["## Purpose", "", firstSentence(description)].join("\n");
}

function renderShimExamplesSection(body: string): string {
  return ["## Examples", "", body].join("\n");
}

function renderWorkflowExamplesBody(slug: string): string {
  const invocations = WORKFLOW_EXAMPLE_INVOCATIONS[slug] ?? [`/circuit:${slug} <task>`];
  return renderShimExampleCodeBlock(invocations);
}

function renderRunExamplesBody(): string {
  const tableRows = ROUTER_INTENT_PREFIXES
    .map((row) => `| \`${row.prefix}\` | ${row.workflow} | ${row.rigor} |`)
    .join("\n");

  return [
    "Prefix a task with a built-in intent to skip classification and dispatch directly:",
    "",
    "| Prefix | Workflow | Rigor |",
    "|--------|----------|-------|",
    tableRows,
    "| (none) | (classify) | (auto) |",
    "",
    renderShimExampleCodeBlock([
      "/circuit:run <task>                         # Router classifies",
      "/circuit:run fix: login drops the session   # Dispatch to Repair Lite",
      "/circuit:run develop: add SSO flow          # Dispatch to Build Standard",
      "/circuit:run cleanup: unused exports        # Dispatch to Sweep Standard",
    ]),
  ].join("\n");
}

function renderHandoffExamplesBody(): string {
  return [
    "Fast modes are positional subcommands:",
    "",
    renderShimExampleCodeBlock([
      "/circuit:handoff                            # Draft continuity from conversation and save",
      "/circuit:handoff resume                     # Present saved continuity and pick up",
      "/circuit:handoff done                       # Clear continuity and detach the current run",
    ]),
  ].join("\n");
}

function renderReviewExamplesBody(): string {
  return [
    "Scope selection is mechanical. Name a scope or fall back to the repo's current diff:",
    "",
    renderShimExampleCodeBlock([
      "/circuit:review                             # Uncommitted diff, else most recent commit",
      "/circuit:review src/auth/                   # Explicit scope: named paths",
      "/circuit:review HEAD~3..HEAD                # Explicit scope: diff target",
    ]),
  ].join("\n");
}

function renderCreateExamplesBody(): string {
  return renderShimExampleCodeBlock([
    "/circuit:create                             # Guided flow: draft, validate, publish",
  ]);
}

function renderWorkflowBootstrapContractBody(
  entry: WorkflowEntry,
  summary: PromptSurfaceSummary,
): string {
  const lines = [
    "## Bootstrap Contract",
    "",
    `Launch the \`circuit:${entry.slug}\` skill immediately.`,
    "Use hook-authored helper wrappers from `.circuit/bin/` instead of rediscovering plugin paths or cache layout.",
    "If the request is an explicit smoke/bootstrap verification of the workflow, bootstrap and validate run state, then stop without unrelated repo exploration.",
    "Valid smoke evidence is the real `.circuit` run state and workflow scaffold on disk; repo hygiene or branch status alone does not count.",
    "Inside that skill, execute its compiled contract block before unrelated repo exploration.",
    "Do not reinterpret this command as a generic repo-understanding request.",
  ];

  if (summary.forbidden_manual_fabrication && summary.forbidden_manual_fabrication.length > 0) {
    lines.splice(
      6,
      0,
      `For smoke/bootstrap requests, manual \`Write\`/\`Edit\` creation of \`circuit.manifest.yaml\`, \`events.ndjson\`, ${DERIVED_STATE_SNAPSHOT_TEXT}, or \`artifacts/active-run.md\` is a failure; use \`${LOCAL_HELPER_DIR}/circuit-engine bootstrap\` instead.`,
    );
  }

  return lines.join("\n");
}

function renderCustomWorkflowShimBody(entry: WorkflowEntry & { origin: "user_global" }): string {
  const header = `Direct custom slash-command invocation for \`${getPublicCommandInvocation(entry)}\`.`;
  const purpose = renderShimPurposeSection(entry.skillDescription);
  const examples = renderShimExamplesSection(
    renderShimExampleCodeBlock([`${getPublicCommandInvocation(entry)}   # Custom workflow dispatch`]),
  );
  const contract = [
    "## Bootstrap Contract",
    "",
    "This command is overlay-managed from the user-global custom circuit catalog.",
    `Before broader repo exploration, verify \`${entry.skillMdPath}\` and \`${entry.manifestPath}\` both exist.`,
    `Read \`${entry.skillMdPath}\` directly and treat it as the authoritative execution contract for this command.`,
    `For explicit smoke/bootstrap verification, bootstrap with \`${LOCAL_HELPER_DIR}/circuit-engine bootstrap --manifest "${entry.manifestPath}"\` and validate the resulting run state before stopping.`,
    "Use hook-authored helper wrappers from `.circuit/bin/` instead of rediscovering plugin paths or cache layout.",
    "Treat this custom workflow as already selected. Do not reroute it through `/circuit:run`.",
    "If the external skill or manifest is missing, stop and tell the user to recreate or republish the custom circuit with `/circuit:create`.",
  ].join("\n");

  return `${[header, "", purpose, "", examples, "", contract].join("\n")}\n`;
}

function renderWorkflowCommandShim(entry: WorkflowEntry): string {
  if (entry.origin === "user_global") {
    return renderCustomWorkflowShimBody(entry as WorkflowEntry & { origin: "user_global" });
  }

  const summary = getSurfaceSummary(entry);
  const header = `Direct slash-command invocation for \`${getPublicCommandInvocation(entry)}\`.`;
  const purpose = renderShimPurposeSection(entry.skillDescription);
  const examplesBody = entry.slug === "run"
    ? renderRunExamplesBody()
    : renderWorkflowExamplesBody(entry.slug);
  const examples = renderShimExamplesSection(examplesBody);
  const contract = renderWorkflowBootstrapContractBody(entry, summary);

  return `${[header, "", purpose, "", examples, "", contract].join("\n")}\n`;
}

function renderUtilityCommandShim(entry: UtilityEntry): string {
  const header = `Direct utility invocation for \`${getPublicCommandInvocation(entry)}\`.`;
  const purpose = renderShimPurposeSection(entry.skillDescription);

  let examplesBody: string;
  let contractBody: string[];

  switch (entry.slug) {
    case "handoff":
      examplesBody = renderHandoffExamplesBody();
      contractBody = [
        `Launch the \`circuit:${entry.slug}\` skill immediately.`,
        "Execute argument-selected fast modes before context gathering.",
        "Use hook-authored helper wrappers from `.circuit/bin/` when the utility needs Circuit helpers.",
        "Do not do broad repo exploration unless the utility contract explicitly requires it.",
      ];
      break;
    case "review":
      examplesBody = renderReviewExamplesBody();
      contractBody = [
        `Launch the \`circuit:${entry.slug}\` skill immediately.`,
        "Execute argument-selected fast modes before context gathering.",
        "Use hook-authored helper wrappers from `.circuit/bin/` when the utility needs Circuit helpers.",
        "Do not do broad repo exploration unless the utility contract explicitly requires it.",
      ];
      break;
    case "create":
      examplesBody = renderCreateExamplesBody();
      contractBody = [
        "Launch the `circuit:create` skill immediately.",
        "First resolve the installed plugin root from `.circuit/plugin-root`.",
        "Do not search the whole repo, plugin cache, or `$HOME` to rediscover Circuit docs or skills.",
        "Use exact paths plus the bundled `custom-circuits` helper CLI for catalog checks, draft validation, and publish.",
        "Keep shell steps short and single-purpose; avoid long chained one-liners unless they are unavoidable.",
      ];
      break;
    default:
      examplesBody = renderShimExampleCodeBlock([`/circuit:${entry.slug}`]);
      contractBody = [
        `Launch the \`circuit:${entry.slug}\` skill immediately.`,
        "Execute argument-selected fast modes before context gathering.",
        "Use hook-authored helper wrappers from `.circuit/bin/` when the utility needs Circuit helpers.",
        "Do not do broad repo exploration unless the utility contract explicitly requires it.",
      ];
      break;
  }

  const examples = renderShimExamplesSection(examplesBody);
  const contract = ["## Bootstrap Contract", "", ...contractBody].join("\n");

  return `${[header, "", purpose, "", examples, "", contract].join("\n")}\n`;
}

function escapeYamlDoubleQuotedString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderCommandShim(entry: WorkflowEntry | UtilityEntry): string {
  const description = firstSentence(entry.skillDescription);
  const body = entry.kind === "workflow"
    ? renderWorkflowCommandShim(entry)
    : renderUtilityCommandShim(entry);
  return [
    "---",
    `description: "${escapeYamlDoubleQuotedString(description)}"`,
    "---",
    "",
    body,
  ].join("\n");
}

interface SkillContractTarget {
  slug: string;
  blockName: string;
  filePath: string;
  render: () => string;
}

const SKILL_CONTRACT_TARGET_SPECS: readonly SkillContractTargetSpec[] = [
  {
    slug: "build",
    blockName: "BUILD_CONTRACT",
    filePath: "skills/build/SKILL.md",
    render: renderBuildContractBlock,
  },
  {
    slug: "explore",
    blockName: SEMANTIC_WORKFLOW_CONTRACTS_BY_SLUG.explore.blockName,
    filePath: "skills/explore/SKILL.md",
    render: () => renderSemanticWorkflowContractBlock(SEMANTIC_WORKFLOW_CONTRACTS_BY_SLUG.explore),
  },
  {
    slug: "migrate",
    blockName: SEMANTIC_WORKFLOW_CONTRACTS_BY_SLUG.migrate.blockName,
    filePath: "skills/migrate/SKILL.md",
    render: () => renderSemanticWorkflowContractBlock(SEMANTIC_WORKFLOW_CONTRACTS_BY_SLUG.migrate),
  },
  {
    slug: "repair",
    blockName: SEMANTIC_WORKFLOW_CONTRACTS_BY_SLUG.repair.blockName,
    filePath: "skills/repair/SKILL.md",
    render: () => renderSemanticWorkflowContractBlock(SEMANTIC_WORKFLOW_CONTRACTS_BY_SLUG.repair),
  },
  {
    slug: "run",
    blockName: "RUN_CONTRACT",
    filePath: "skills/run/SKILL.md",
    render: renderRunContractBlock,
  },
  {
    slug: "sweep",
    blockName: SEMANTIC_WORKFLOW_CONTRACTS_BY_SLUG.sweep.blockName,
    filePath: "skills/sweep/SKILL.md",
    render: () => renderSemanticWorkflowContractBlock(SEMANTIC_WORKFLOW_CONTRACTS_BY_SLUG.sweep),
  },
  {
    slug: "handoff",
    blockName: "HANDOFF_FAST_MODES",
    filePath: "skills/handoff/SKILL.md",
    render: renderHandoffFastModesBlock,
  },
  {
    slug: "review",
    blockName: "REVIEW_FAST_MODES",
    filePath: "skills/review/SKILL.md",
    render: renderReviewFastModesBlock,
  },
  {
    slug: "workers",
    blockName: "WORKERS_HELPERS",
    filePath: "skills/workers/SKILL.md",
    render: renderWorkersHelperBlock,
  },
];

function getSkillContractTargets(repoRoot: string): SkillContractTarget[] {
  return SKILL_CONTRACT_TARGET_SPECS.map((target) => ({
    ...target,
    filePath: resolve(repoRoot, target.filePath),
  }));
}

export function getPromptSurfaceBlockTargets(
  repoRoot: string,
  catalog: Catalog,
): BlockGenerateTarget[] {
  const slugs = new Set(catalog.map((entry) => entry.slug));
  const targets = getSkillContractTargets(repoRoot)
    .filter((target) => slugs.has(target.slug))
    .map((target) => ({
      blockName: target.blockName,
      filePath: target.filePath,
      render: () => target.render(),
    }));

  if (slugs.has("build")) {
    targets.unshift({
      blockName: "SMOKE_BOOTSTRAP_VERIFICATION",
      filePath: resolve(repoRoot, "CIRCUITS.md"),
      render: () => renderCircuitsSmokeContract(),
    });
  }

  return targets;
}
