import {
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import type { ChangeKindDeclaration } from '../schemas/change-kind.js';
import type { CompiledFlow } from '../schemas/compiled-flow.js';
import type { LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import type { Depth } from '../schemas/depth.js';
import { type CompiledFlowId, type InvocationId, type RunId, StepId } from '../schemas/ids.js';
import { computeManifestHash } from '../schemas/manifest.js';
import type { ProgressEvent, ProgressTaskStatus } from '../schemas/progress-event.js';
import type { Snapshot } from '../schemas/snapshot.js';
import type { RunClosedOutcome, TraceEntry } from '../schemas/trace-entry.js';
import { appendAndDerive } from './append-and-derive.js';
import { prepareCheckpointResume } from './checkpoint-resume.js';
import {
  type ManifestSnapshotInput,
  manifestSnapshotPath,
  writeManifestSnapshot,
} from './manifest-snapshot-writer.js';
import {
  progressDisplay,
  projectTraceEntryToProgress,
  reportProgress,
  reportTaskListProgress,
  taskStatusesFromTrace,
} from './progress-projector.js';
import { findCloseBuilder, resolveCloseReadPaths } from './registries/close-writers/registry.js';
import {
  findComposeBuilder,
  resolveComposeReadPaths,
} from './registries/compose-writers/registry.js';
import {
  bindsExecutionDepthToRelaySelection,
  selectionConfigLayersWithExecutionDepth,
} from './relay-selection.js';
import { resultPath, writeResult } from './result-writer.js';
import { resolveRunRelative } from './run-relative-path.js';
import type {
  CheckpointResumeInvocation,
  ChildCompiledFlowResolver,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  CompiledFlowRunner,
  ComposeWriterFn,
  ComposeWriterInput,
  ProgressReporter,
  RelayFn,
  RelayResultMetadata,
  WorktreeRunner,
} from './runner-types.js';
import { writeDerivedSnapshot } from './snapshot-writer.js';
import {
  type ResumeCheckpointState,
  type RunState,
  type StepHandlerResult,
  runStepHandler,
} from './step-handlers/index.js';
import { isRunRelativePathError, writeJsonReport } from './step-handlers/shared.js';
import { deriveTerminalVerdict } from './terminal-verdict.js';
import { appendTraceEntry, traceEntryLogPath } from './trace-writer.js';
import {
  WRITE_CAPABLE_WORKER_DISCLOSURE,
  compiledFlowMayInvokeWriteCapableWorker,
} from './write-capable-worker-disclosure.js';

// Public API surface from runner.ts. Implementations have moved to
// dedicated modules during the handler-extraction split; the surface
// stays stable so existing callers (CLI, tests) keep their imports.
export type {
  CheckpointResumeInvocation,
  CheckpointWaitingResult,
  ChildCompiledFlowResolver,
  RelayFn,
  RelayInput,
  RelayResultMetadata,
  ResolvedChildCompiledFlow,
  ComposeWriterFn,
  ComposeWriterInput,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  CompiledFlowRunner,
  WorktreeRunner,
  WorktreeProvisionInput,
} from './runner-types.js';
export { appendAndDerive } from './append-and-derive.js';
export type { AppendResult } from './append-and-derive.js';

interface RunFolderInit {
  runFolder: string;
}

export function initRunFolder({ runFolder }: RunFolderInit): void {
  mkdirSync(runFolder, { recursive: true });
  mkdirSync(dirname(traceEntryLogPath(runFolder)), { recursive: true });
}

const RUN_ROOT_CLAIM_FILE = '.run-folder.claim';

export interface FreshRunFolderClaim {
  readonly runFolder: string;
  readonly path: string;
}

function runFolderReuseError(runFolder: string, detail: string): Error {
  return new Error(
    `run-folder reuse rejected for ${runFolder}: ${detail}; use checkpoint resume for paused checkpoint runs`,
  );
}

export function claimFreshRunFolder(runFolder: string): FreshRunFolderClaim {
  const existing = lstatSync(runFolder, { throwIfNoEntry: false });
  if (existing === undefined) {
    try {
      mkdirSync(runFolder, { recursive: true });
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err.code === 'EEXIST' || err.code === 'ENOTDIR')
      ) {
        throw runFolderReuseError(runFolder, 'path already exists and is not an empty directory');
      }
      throw err;
    }
  }
  const stat = lstatSync(runFolder);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw runFolderReuseError(runFolder, 'path already exists and is not an empty directory');
  }
  const claimPath = join(runFolder, RUN_ROOT_CLAIM_FILE);
  let fd: number | undefined;
  try {
    fd = openSync(claimPath, 'wx');
    writeSync(fd, `${new Date().toISOString()}\n`);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') {
      throw runFolderReuseError(
        runFolder,
        'another invocation has already claimed this run folder',
      );
    }
    throw err;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }

  const claim = { runFolder, path: claimPath };
  try {
    const entries = readdirSync(runFolder).filter((entry) => entry !== RUN_ROOT_CLAIM_FILE);
    if (entries.length > 0) {
      throw runFolderReuseError(
        runFolder,
        `existing directory is not empty (${entries.join(', ')})`,
      );
    }
    return claim;
  } catch (err) {
    releaseFreshRunFolderClaim(claim);
    throw err;
  }
}

export function releaseFreshRunFolderClaim(claim: FreshRunFolderClaim): void {
  rmSync(claim.path, { force: true });
}

interface BootstrapInput {
  runFolder: string;
  manifest: ManifestSnapshotInput;
  bootstrapTraceEntry: TraceEntry;
}

interface BootstrapResult {
  manifestSnapshotPath: string;
  traceEntryLogPath: string;
  snapshot: Snapshot;
}

export function bootstrapRun(input: BootstrapInput): BootstrapResult {
  const claim = claimFreshRunFolder(input.runFolder);
  try {
    initRunFolder({ runFolder: input.runFolder });
    writeManifestSnapshot(input.runFolder, input.manifest);
    appendTraceEntry(input.runFolder, input.bootstrapTraceEntry);
    const snapshot = writeDerivedSnapshot(input.runFolder);
    return {
      manifestSnapshotPath: manifestSnapshotPath(input.runFolder),
      traceEntryLogPath: traceEntryLogPath(input.runFolder),
      snapshot,
    };
  } finally {
    releaseFreshRunFolderClaim(claim);
  }
}

const TERMINAL_ROUTE_OUTCOME = {
  '@complete': 'complete',
  '@stop': 'stopped',
  '@escalate': 'escalated',
  '@handoff': 'handoff',
} as const satisfies Record<string, RunClosedOutcome>;
const RECOVERY_ROUTE_LABELS = new Set(['retry', 'revise']);

function terminalOutcomeForRoute(route: string): RunClosedOutcome | undefined {
  return Object.hasOwn(TERMINAL_ROUTE_OUTCOME, route)
    ? TERMINAL_ROUTE_OUTCOME[route as keyof typeof TERMINAL_ROUTE_OUTCOME]
    : undefined;
}

function maxAttemptsForRoute(
  step: CompiledFlow['steps'][number],
  routeTaken: string | undefined,
): number {
  if (step.budgets?.max_attempts !== undefined) return step.budgets.max_attempts;
  return routeTaken !== undefined && RECOVERY_ROUTE_LABELS.has(routeTaken) ? 2 : 1;
}

function readJsonReport(runFolder: string, path: string): unknown {
  return JSON.parse(readFileSync(resolveRunRelative(runFolder, path), 'utf8')) as unknown;
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function markInProgressTasksFailed(statuses: Map<string, ProgressTaskStatus>): boolean {
  let changed = false;
  for (const [id, status] of statuses) {
    if (status === 'in_progress') {
      statuses.set(id, 'failed');
      changed = true;
    }
  }
  return changed;
}

function choiceLabel(choice: { readonly id: string; readonly label?: string | undefined }): string {
  return choice.label ?? choice.id;
}

type UserInputRequestedProgressEvent = Extract<ProgressEvent, { type: 'user_input.requested' }>;

type CheckpointChoiceUi = {
  readonly label?: string;
  readonly description?: string;
};

function jsonObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readJsonObjectReport(
  runFolder: string,
  path: string,
): Record<string, unknown> | undefined {
  try {
    return jsonObject(readJsonReport(runFolder, path));
  } catch {
    return undefined;
  }
}

function normalizedSingleLine(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function boundedUserInputText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const suffix = ' [truncated]';
  return `${normalized.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
}

function decisionOptionCheckpointChoices(input: {
  readonly runFolder: string;
  readonly allowedChoices: readonly string[];
}): ReadonlyMap<string, CheckpointChoiceUi> {
  const report = readJsonObjectReport(input.runFolder, 'reports/decision-options.json');
  const options = Array.isArray(report?.options) ? report.options : [];
  const allowed = new Set(input.allowedChoices);
  const byChoice = new Map<string, CheckpointChoiceUi>();

  for (const rawOption of options) {
    const option = jsonObject(rawOption);
    const id = normalizedSingleLine(option?.id);
    if (id === undefined || !allowed.has(id)) continue;
    const label = normalizedSingleLine(option?.label);
    const summary = normalizedSingleLine(option?.summary);
    const tradeoffs = Array.isArray(option?.tradeoffs)
      ? option.tradeoffs.flatMap((item) => normalizedSingleLine(item) ?? [])
      : [];
    const description = summary ?? (tradeoffs.length > 0 ? tradeoffs.join('; ') : undefined);
    byChoice.set(id, {
      ...(label === undefined ? {} : { label }),
      ...(description === undefined ? {} : { description }),
    });
  }

  return byChoice;
}

function tournamentCheckpointQuestion(runFolder: string): string | undefined {
  return normalizedSingleLine(
    readJsonObjectReport(runFolder, 'reports/tournament-review.json')?.tradeoff_question,
  );
}

function checkpointChoiceDisplayLabels(input: {
  readonly runFolder: string;
  readonly allowedChoices: readonly string[];
}): readonly string[] {
  const dynamicChoices = decisionOptionCheckpointChoices(input);
  return input.allowedChoices.map((choiceId) =>
    boundedUserInputText(dynamicChoices.get(choiceId)?.label ?? choiceId, 80),
  );
}

function userInputQuestionsForCheckpoint(input: {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly stepId: string;
  readonly allowedChoices: readonly string[];
}): UserInputRequestedProgressEvent['questions'] {
  const step = input.flow.steps.find(
    (candidate) => (candidate.id as unknown as string) === input.stepId,
  );
  const policyChoices =
    step?.kind === 'checkpoint'
      ? new Map(step.policy.choices.map((choice) => [choice.id, choice] as const))
      : new Map<
          string,
          {
            readonly id: string;
            readonly label?: string | undefined;
            readonly description?: string | undefined;
          }
        >();
  const question = boundedUserInputText(
    tournamentCheckpointQuestion(input.runFolder) ??
      (step?.kind === 'checkpoint' ? step.policy.prompt : 'Choose how Circuit should continue.'),
    240,
  );
  const dynamicChoices = decisionOptionCheckpointChoices({
    runFolder: input.runFolder,
    allowedChoices: input.allowedChoices,
  });

  return [
    {
      id: 'checkpoint-choice',
      header: 'Choice',
      question,
      options: input.allowedChoices.slice(0, 4).map((choiceId) => {
        const choice = policyChoices.get(choiceId);
        const dynamicChoice = dynamicChoices.get(choiceId);
        return {
          label: boundedUserInputText(
            dynamicChoice?.label ?? (choice === undefined ? choiceId : choiceLabel(choice)),
            80,
          ),
          description: boundedUserInputText(
            dynamicChoice?.description ??
              choice?.description ??
              `Resume Circuit with '${choiceId}'.`,
            160,
          ),
          checkpoint_choice: choiceId,
        };
      }),
      allow_free_text: false,
    },
  ];
}

function reportUserInputRequested(input: {
  readonly progress: ProgressReporter | undefined;
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly runId: RunId;
  readonly recordedAt: string;
  readonly checkpoint: {
    readonly stepId: string;
    readonly requestPath: string;
    readonly allowedChoices: readonly string[];
  };
}): void {
  const command = [
    'circuit-next resume',
    `--run-folder ${shellSingleQuote(input.runFolder)}`,
    "--checkpoint-choice '<choice>'",
    '--progress jsonl',
  ].join(' ');
  reportProgress(input.progress, {
    schema_version: 1,
    type: 'user_input.requested',
    run_id: input.runId,
    flow_id: input.flow.id,
    recorded_at: input.recordedAt,
    label: 'Circuit needs input',
    display: progressDisplay(
      'Circuit needs your checkpoint choice to continue.',
      'major',
      'checkpoint',
    ),
    checkpoint: {
      step_id: StepId.parse(input.checkpoint.stepId),
      request_path: input.checkpoint.requestPath,
      allowed_choices: [...input.checkpoint.allowedChoices],
    },
    questions: userInputQuestionsForCheckpoint({
      runFolder: input.runFolder,
      flow: input.flow,
      stepId: input.checkpoint.stepId,
      allowedChoices: input.checkpoint.allowedChoices,
    }),
    resume: {
      run_folder: input.runFolder,
      checkpoint_choice_arg: '<choice>',
      command,
    },
  });
}

// Compose writer fallback. CompiledFlow-specific compose logic lives
// under src/flows/registries/compose-writers/ and is registered by
// output schema name; close-with-evidence relay lives in
// src/flows/registries/close-writers/. The runner stays flow-
// agnostic — adding a new compose step means adding a ComposeBuilder
// file + registry entry.
function tryWriteRegisteredComposeReport(input: ComposeWriterInput): boolean {
  const { runFolder, flow, step, goal, projectRoot, evidencePolicy } = input;
  const schemaName = step.writes.report.schema;

  const composeBuilder = findComposeBuilder(schemaName);
  if (composeBuilder !== undefined) {
    const readPaths = resolveComposeReadPaths(composeBuilder, flow, step);
    const inputs: Record<string, unknown | undefined> = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === undefined ? undefined : readJsonReport(runFolder, path);
    }
    const report = composeBuilder.build({
      runFolder,
      flow,
      step,
      goal,
      ...(projectRoot === undefined ? {} : { projectRoot }),
      ...(evidencePolicy === undefined ? {} : { evidencePolicy }),
      inputs,
    });
    writeJsonReport(runFolder, step.writes.report.path, report);
    return true;
  }

  const closeBuilder = findCloseBuilder(schemaName);
  if (closeBuilder !== undefined && step.kind === 'compose') {
    const readPaths = resolveCloseReadPaths(closeBuilder, flow, step);
    const inputs: Record<string, unknown | undefined> = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === undefined ? undefined : readJsonReport(runFolder, path);
    }
    const report = closeBuilder.build({
      runFolder,
      flow,
      closeStep: step,
      goal,
      inputs,
    });
    writeJsonReport(runFolder, step.writes.report.path, report);
    return true;
  }

  return false;
}

export function writeComposeReport(input: ComposeWriterInput): void {
  if (tryWriteRegisteredComposeReport(input)) return;
  const schemaName = input.step.writes.report.schema;
  const stepId = input.step.id as unknown as string;
  throw new Error(
    `no compose report writer registered for schema '${schemaName}' at compose step '${stepId}'`,
  );
}

export function writePrototypeComposeReport(input: ComposeWriterInput): void {
  const { runFolder, step } = input;
  if (tryWriteRegisteredComposeReport(input)) return;
  const body: Record<string, string> = {};
  for (const section of step.check.required) {
    body[section] = `<${step.id as unknown as string}-placeholder-${section}>`;
  }
  writeJsonReport(runFolder, step.writes.report.path, body);
}

interface CompiledFlowExecutionContext {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly flowBytes: Buffer;
  readonly runId: RunId;
  readonly goal: string;
  readonly depth?: Depth;
  readonly entryModeName?: string;
  readonly change_kind: ChangeKindDeclaration;
  readonly now: () => Date;
  readonly relayer?: RelayFn;
  readonly composeWriter?: ComposeWriterFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
  readonly projectRoot?: string;
  readonly evidencePolicy?: CompiledFlowInvocation['evidencePolicy'];
  readonly invocationId?: InvocationId;
  readonly initialTraceEntries?: readonly TraceEntry[];
  readonly startStepId?: string;
  readonly resumeCheckpoint?: ResumeCheckpointState;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolver;
  readonly childRunner?: CompiledFlowRunner;
  readonly worktreeRunner?: WorktreeRunner;
  readonly progress?: ProgressReporter;
}

function selectEntryMode(
  flow: CompiledFlow,
  entryModeName: string | undefined,
): CompiledFlow['entry_modes'][number] {
  if (flow.entry_modes.length === 0) {
    throw new Error(`runCompiledFlow: flow ${flow.id} declares no entry_modes`);
  }
  if (entryModeName === undefined) {
    const entry = flow.entry_modes[0];
    if (entry === undefined) {
      throw new Error(`runCompiledFlow: flow ${flow.id} entry_modes[0] unreadable`);
    }
    return entry;
  }
  const entry = flow.entry_modes.find((mode) => mode.name === entryModeName);
  if (entry === undefined) {
    throw new Error(
      `runCompiledFlow: flow ${flow.id} declares no entry_mode named '${entryModeName}'`,
    );
  }
  return entry;
}

// Execution loop. Bootstrap, walk routes from entry.start_at, delegate
// per-step work to the kind→handler relayer, advance pass route, emit
// run.closed, write result.json. The loop stays narrow: it owns the
// route walk and run-level trace_entries; per-kind logic lives in
// src/runtime/step-handlers/.
async function executeCompiledFlow(
  ctx: CompiledFlowExecutionContext,
): Promise<CompiledFlowRunResult> {
  const { runFolder, flow, flowBytes, runId, goal, change_kind, now } = ctx;
  const composeWriter = ctx.composeWriter ?? writeComposeReport;
  const entry = selectEntryMode(flow, ctx.entryModeName);
  const depth = ctx.depth ?? entry.depth;
  const executionSelectionConfigLayers = bindsExecutionDepthToRelaySelection(flow)
    ? selectionConfigLayersWithExecutionDepth(ctx, flow, depth)
    : (ctx.selectionConfigLayers ?? []);

  const manifestHash = computeManifestHash(flowBytes);
  const bootstrapTs = now().toISOString();
  const bootstrapTraceEntry: TraceEntry = {
    schema_version: 1,
    sequence: 0,
    recorded_at: bootstrapTs,
    run_id: runId,
    kind: 'run.bootstrapped',
    flow_id: flow.id as CompiledFlowId,
    ...(ctx.invocationId === undefined ? {} : { invocation_id: ctx.invocationId }),
    depth,
    goal,
    change_kind,
    manifest_hash: manifestHash,
  };

  const trace_entries: TraceEntry[] =
    ctx.initialTraceEntries === undefined ? [bootstrapTraceEntry] : [...ctx.initialTraceEntries];
  if (ctx.initialTraceEntries === undefined) {
    bootstrapRun({
      runFolder,
      manifest: {
        run_id: runId,
        flow_id: flow.id as CompiledFlowId,
        captured_at: bootstrapTs,
        bytes: flowBytes,
      },
      bootstrapTraceEntry,
    });
  }
  const runStartedText =
    ctx.initialTraceEntries === undefined
      ? `Circuit started ${flow.id}.`
      : `Circuit resumed ${flow.id}.`;
  const shouldDiscloseWriteCapableWorker = compiledFlowMayInvokeWriteCapableWorker(flow);
  const runStartedDisplayText = shouldDiscloseWriteCapableWorker
    ? `${runStartedText} ${WRITE_CAPABLE_WORKER_DISCLOSURE}`
    : runStartedText;
  reportProgress(ctx.progress, {
    schema_version: 1,
    type: 'run.started',
    run_id: runId,
    flow_id: flow.id,
    recorded_at: bootstrapTs,
    label: ctx.initialTraceEntries === undefined ? 'Started Circuit run' : 'Resumed Circuit run',
    display: progressDisplay(
      runStartedDisplayText,
      'major',
      shouldDiscloseWriteCapableWorker ? 'warning' : 'info',
    ),
    run_folder: runFolder,
  });
  const taskStatuses = taskStatusesFromTrace(flow, trace_entries, ctx.startStepId);
  reportTaskListProgress({
    progress: ctx.progress,
    runId,
    flow,
    recordedAt: bootstrapTs,
    statuses: taskStatuses,
    label: 'Flow checklist initialized',
    displayText: 'Circuit prepared the flow checklist.',
  });
  // Capture per-relay metadata for AGENT_SMOKE / CODEX_SMOKE
  // fingerprint binding to cli_version without forcing a relay trace_entry
  // schema bump.
  const relayResults: RelayResultMetadata[] = [];
  const state: RunState = { trace_entries, sequence: trace_entries.length, relayResults };
  const recordedAt = (): string => now().toISOString();
  // push() is the single sequence-assignment authority: it overwrites
  // the caller-supplied `sequence` field on the trace_entry with the current
  // state.sequence and increments. JS is single-threaded and push() is
  // fully synchronous (appendAndDerive uses sync fs writes), so today
  // concurrent callers cannot interleave at the trace_entry-loop level. The
  // overwrite locks that property in by construction and guards
  // against (a) future async refactors that would expose the
  // read-then-increment as a real race, and (b) callers reading a
  // stale `state.sequence` snapshot into an trace_entry literal across an
  // await boundary. Adversarial-review fix #3 + #12: handlers can no
  // longer corrupt the sequence stream by passing wrong values, and
  // the only path to emit an trace_entry is push().
  const push = (ev: TraceEntry): void => {
    const sequenced: TraceEntry = { ...ev, sequence: state.sequence };
    trace_entries.push(sequenced);
    appendAndDerive(runFolder, sequenced);
    projectTraceEntryToProgress({
      progress: ctx.progress,
      runFolder,
      flow,
      runId,
      taskStatuses,
      traceEntry: sequenced,
    });
    state.sequence += 1;
  };

  // Walk the routes graph from entry.start_at. Terminate when a step route
  // resolves to one of the terminal route labels, or when a step handler
  // reports an aborted outcome.
  const stepsById = new Map(flow.steps.map((s) => [s.id as unknown as string, s] as const));
  const completedStepCounts = new Map<string, number>();
  for (const trace_entry of trace_entries) {
    if (trace_entry.kind !== 'step.completed') continue;
    const stepId = trace_entry.step_id as unknown as string;
    completedStepCounts.set(stepId, (completedStepCounts.get(stepId) ?? 0) + 1);
  }
  let currentStepId: string | undefined = ctx.startStepId ?? (entry.start_at as unknown as string);
  let incomingRouteTaken: string | undefined;
  let activeRecoveryReason: string | undefined;
  let runOutcome: RunClosedOutcome = 'complete';
  let closeReason: string | undefined;

  while (currentStepId !== undefined) {
    const step = stepsById.get(currentStepId);
    if (step === undefined) {
      throw new Error(
        `runCompiledFlow: route target '${currentStepId}' is not a known step id (fixture/reduction mismatch)`,
      );
    }
    const priorCompletions = completedStepCounts.get(currentStepId) ?? 0;
    const maxAttempts = maxAttemptsForRoute(step, incomingRouteTaken);
    const incomingIsRecovery =
      incomingRouteTaken !== undefined && RECOVERY_ROUTE_LABELS.has(incomingRouteTaken);
    if (priorCompletions > 0 && (!incomingIsRecovery || priorCompletions >= maxAttempts)) {
      runOutcome = 'aborted';
      const recoverySuffix =
        activeRecoveryReason === undefined ? '' : `; last recovery reason: ${activeRecoveryReason}`;
      closeReason = incomingIsRecovery
        ? `route '${incomingRouteTaken}' for step '${currentStepId}' exhausted max_attempts=${maxAttempts}${recoverySuffix}`
        : `route cycle detected at step '${currentStepId}' via '${incomingRouteTaken ?? 'pass'}'; aborting run before re-entering an already executed step${recoverySuffix}`;
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt: priorCompletions + 1,
        reason: closeReason,
      });
      currentStepId = undefined;
      break;
    }
    const isResumedCheckpoint = ctx.resumeCheckpoint?.stepId === currentStepId;
    const attempt = isResumedCheckpoint ? ctx.resumeCheckpoint.attempt : priorCompletions + 1;

    if (!isResumedCheckpoint) {
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.entered',
        step_id: step.id,
        attempt,
      });
    }

    // Handler exceptions must not corrupt the run-folder: a thrown error
    // that escapes executeCompiledFlow leaves step.entered on disk with no
    // matching step.aborted, no run.closed, and no result.json — the
    // run-folder is then half-bootstrapped and claimFreshRunFolder rejects
    // every retry. Wrap so unexpected throws emit step.aborted and fall
    // through to the standard close path. Path-escape errors are a
    // security boundary (callers must see no partial output is trusted)
    // and continue to propagate.
    let result: StepHandlerResult;
    try {
      result = await runStepHandler({
        runFolder,
        flow,
        runId,
        goal,
        change_kind,
        depth,
        executionSelectionConfigLayers,
        ...(ctx.projectRoot === undefined ? {} : { projectRoot: ctx.projectRoot }),
        ...(ctx.evidencePolicy === undefined ? {} : { evidencePolicy: ctx.evidencePolicy }),
        ...(ctx.invocationId === undefined ? {} : { invocationId: ctx.invocationId }),
        ...(ctx.relayer === undefined ? {} : { relayer: ctx.relayer }),
        composeWriter,
        now,
        recordedAt,
        state,
        push,
        step,
        attempt,
        isResumedCheckpoint,
        ...(ctx.resumeCheckpoint === undefined ? {} : { resumeCheckpoint: ctx.resumeCheckpoint }),
        childRunner: ctx.childRunner ?? runCompiledFlow,
        ...(ctx.childCompiledFlowResolver === undefined
          ? {}
          : { childCompiledFlowResolver: ctx.childCompiledFlowResolver }),
        ...(ctx.worktreeRunner === undefined ? {} : { worktreeRunner: ctx.worktreeRunner }),
      });
    } catch (err) {
      if (isRunRelativePathError(err)) throw err;
      const message = err instanceof Error ? err.message : String(err);
      const reason = `step '${step.id as unknown as string}' (kind '${step.kind}') handler threw: ${message}`;
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        reason,
      });
      runOutcome = 'aborted';
      closeReason = reason;
      currentStepId = undefined;
      break;
    }

    if (result.kind === 'waiting_checkpoint') {
      const waitingRecordedAt = recordedAt();
      const checkpointChoiceLabels = checkpointChoiceDisplayLabels({
        runFolder,
        allowedChoices: result.checkpoint.allowedChoices,
      });
      reportProgress(ctx.progress, {
        schema_version: 1,
        type: 'checkpoint.waiting',
        run_id: runId,
        flow_id: flow.id,
        recorded_at: waitingRecordedAt,
        label: `Waiting for checkpoint ${result.checkpoint.stepId}`,
        display: progressDisplay(
          `Circuit is waiting for a checkpoint choice: ${checkpointChoiceLabels.join(', ')}.`,
          'major',
          'checkpoint',
        ),
        step_id: StepId.parse(result.checkpoint.stepId),
        request_path: result.checkpoint.requestPath,
        allowed_choices: [...result.checkpoint.allowedChoices],
      });
      reportUserInputRequested({
        progress: ctx.progress,
        runFolder,
        flow,
        runId,
        recordedAt: waitingRecordedAt,
        checkpoint: result.checkpoint,
      });
      const snapshot = writeDerivedSnapshot(runFolder);
      return {
        runFolder,
        result: {
          schema_version: 1,
          run_id: runId,
          flow_id: flow.id,
          goal,
          outcome: 'checkpoint_waiting',
          summary: `checkpoint '${result.checkpoint.stepId}' is waiting for an operator choice.`,
          trace_entries_observed: trace_entries.length,
          manifest_hash: manifestHash,
          checkpoint: {
            step_id: result.checkpoint.stepId,
            request_path: result.checkpoint.requestPath,
            allowed_choices: result.checkpoint.allowedChoices,
          },
        },
        snapshot,
        trace_entries,
        relayResults,
      };
    }

    if (result.kind === 'aborted') {
      taskStatuses.set(step.id as unknown as string, 'failed');
      reportTaskListProgress({
        progress: ctx.progress,
        runId,
        flow,
        recordedAt: recordedAt(),
        statuses: taskStatuses,
        label: `${step.title} failed`,
        displayText: `Circuit marked ${step.title} as failed.`,
        tone: 'error',
      });
      runOutcome = 'aborted';
      closeReason = result.reason;
      currentStepId = undefined;
      break;
    }

    const routeTaken = result.route ?? 'pass';
    if (result.recovery_reason !== undefined) {
      activeRecoveryReason = result.recovery_reason;
    }
    const nextRoute = step.routes[routeTaken];
    if (nextRoute === undefined) {
      throw new Error(
        `runCompiledFlow: step '${step.id}' selected route '${routeTaken}' but the compiled step has no target for that route`,
      );
    }
    const terminalOutcome = terminalOutcomeForRoute(nextRoute);

    if (terminalOutcome === undefined) {
      const nextStep = stepsById.get(nextRoute);
      if (nextStep === undefined) {
        throw new Error(
          `runCompiledFlow: route target '${nextRoute}' is not a known step id (fixture/reduction mismatch)`,
        );
      }
      const nextCompletedCount = completedStepCounts.get(nextRoute) ?? 0;
      const nextIsRecovery = RECOVERY_ROUTE_LABELS.has(routeTaken);
      const nextMaxAttempts = maxAttemptsForRoute(nextStep, routeTaken);
      if (nextCompletedCount > 0 && (!nextIsRecovery || nextCompletedCount >= nextMaxAttempts)) {
        const recoverySuffix =
          activeRecoveryReason === undefined
            ? ''
            : `; last recovery reason: ${activeRecoveryReason}`;
        const reason = nextIsRecovery
          ? `route '${routeTaken}' from step '${step.id}' to '${nextRoute}' exhausted max_attempts=${nextMaxAttempts}${recoverySuffix}`
          : `route cycle detected: step '${step.id}' routes via '${routeTaken}' to already executed step '${nextRoute}'${recoverySuffix}`;
        push({
          schema_version: 1,
          sequence: state.sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'step.aborted',
          step_id: step.id,
          attempt,
          reason,
        });
        runOutcome = 'aborted';
        closeReason = reason;
        currentStepId = undefined;
        break;
      }
    }

    if (terminalOutcome === undefined && nextRoute === currentStepId && routeTaken === 'pass') {
      const reason = `pass-route cycle detected: step '${step.id}' routes via 'pass' to itself`;
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        reason,
      });
      runOutcome = 'aborted';
      closeReason = reason;
      currentStepId = undefined;
      break;
    }

    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'step.completed',
      step_id: step.id,
      attempt,
      route_taken: routeTaken,
    });
    completedStepCounts.set(currentStepId, (completedStepCounts.get(currentStepId) ?? 0) + 1);

    if (terminalOutcome !== undefined) {
      runOutcome = terminalOutcome;
      currentStepId = undefined;
      if (nextRoute !== '@complete') {
        closeReason = `terminal route ${nextRoute}`;
      }
    } else {
      currentStepId = nextRoute;
      incomingRouteTaken = routeTaken;
    }
  }

  const closedAt = recordedAt();
  const closed: TraceEntry = {
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: closedAt,
    run_id: runId,
    kind: 'run.closed',
    outcome: runOutcome,
    ...(closeReason === undefined ? {} : { reason: closeReason }),
  };
  push(closed);

  const terminalVerdict = deriveTerminalVerdict(trace_entries, runOutcome);
  const result = writeResult(runFolder, {
    schema_version: 1,
    run_id: runId,
    flow_id: flow.id,
    goal,
    outcome: runOutcome,
    summary: buildSummary({ flow, goal, trace_entries }),
    closed_at: closedAt,
    trace_entries_observed: trace_entries.length,
    manifest_hash: manifestHash,
    // Mirror the close-entry reason onto the user-visible result.json so
    // an aborted run explains itself without forcing readers to walk the
    // trace.
    ...(closeReason === undefined ? {} : { reason: closeReason }),
    // Expose the run's terminal admitted verdict so a parent sub-run
    // can admit/reject the child against its own check.pass.
    ...(terminalVerdict === undefined ? {} : { verdict: terminalVerdict }),
  });
  if (runOutcome === 'aborted') {
    if (markInProgressTasksFailed(taskStatuses)) {
      reportTaskListProgress({
        progress: ctx.progress,
        runId,
        flow,
        recordedAt: closedAt,
        statuses: taskStatuses,
        label: 'Flow checklist failed',
        displayText: 'Circuit marked the active flow step as failed.',
        tone: 'error',
      });
    }
    reportProgress(ctx.progress, {
      schema_version: 1,
      type: 'run.aborted',
      run_id: runId,
      flow_id: flow.id,
      recorded_at: closedAt,
      label: 'Circuit run aborted',
      display: progressDisplay(
        closeReason === undefined ? 'Circuit run aborted.' : `Circuit run aborted: ${closeReason}`,
        'major',
        'error',
      ),
      outcome: 'aborted',
      result_path: resultPath(runFolder),
      ...(closeReason === undefined ? {} : { reason: closeReason }),
    });
  } else {
    reportProgress(ctx.progress, {
      schema_version: 1,
      type: 'run.completed',
      run_id: runId,
      flow_id: flow.id,
      recorded_at: closedAt,
      label: `Circuit run ${runOutcome}`,
      display: progressDisplay(`Circuit run ${runOutcome}.`, 'major', 'success'),
      outcome: runOutcome,
      result_path: resultPath(runFolder),
    });
  }

  // Final snapshot is whatever the last appendAndDerive produced; re-derive
  // once at close to return the definitive state.
  const finalSnapshot = writeDerivedSnapshot(runFolder);

  return {
    runFolder,
    result,
    snapshot: finalSnapshot,
    trace_entries,
    relayResults,
  };
}

export async function runCompiledFlow(inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> {
  return executeCompiledFlow(inv);
}

export async function resumeCompiledFlowCheckpoint(
  inv: CheckpointResumeInvocation,
): Promise<CompiledFlowRunResult> {
  const prepared = prepareCheckpointResume({
    runFolder: inv.runFolder,
    selection: inv.selection,
  });

  return executeCompiledFlow({
    runFolder: inv.runFolder,
    flow: prepared.flow,
    flowBytes: prepared.flowBytes,
    runId: prepared.bootstrap.run_id,
    goal: prepared.bootstrap.goal,
    depth: prepared.bootstrap.depth,
    change_kind: prepared.bootstrap.change_kind,
    now: inv.now,
    ...(inv.relayer === undefined ? {} : { relayer: inv.relayer }),
    ...(inv.composeWriter === undefined ? {} : { composeWriter: inv.composeWriter }),
    ...(inv.childCompiledFlowResolver === undefined
      ? {}
      : { childCompiledFlowResolver: inv.childCompiledFlowResolver }),
    ...(inv.childRunner === undefined ? {} : { childRunner: inv.childRunner }),
    ...(inv.worktreeRunner === undefined ? {} : { worktreeRunner: inv.worktreeRunner }),
    ...(inv.progress === undefined ? {} : { progress: inv.progress }),
    selectionConfigLayers: prepared.requestContext.selectionConfigLayers,
    ...(prepared.requestContext.projectRoot !== undefined
      ? { projectRoot: prepared.requestContext.projectRoot }
      : {}),
    ...(prepared.bootstrap.invocation_id === undefined
      ? {}
      : { invocationId: prepared.bootstrap.invocation_id }),
    initialTraceEntries: prepared.trace_entries,
    startStepId: prepared.stepId,
    resumeCheckpoint: {
      stepId: prepared.stepId,
      attempt: prepared.attempt,
      selection: inv.selection,
    },
  });
}

function buildSummary(input: {
  flow: CompiledFlow;
  goal: string;
  trace_entries: TraceEntry[];
}): string {
  const stepCount = input.trace_entries.filter((e) => e.kind === 'step.completed').length;
  return `${input.flow.id} v${input.flow.version} closed ${stepCount} step(s) for goal "${input.goal}".`;
}

export type { RunId, CompiledFlowId };
