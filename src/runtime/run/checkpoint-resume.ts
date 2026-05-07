// Checkpoint resume path for runtime run folders.
//
// Resume follows the saved run folder, not current generated files: it reloads
// the manifest snapshot, validates the unresolved checkpoint request and its
// hash, then re-enters graph-runner.ts with a single operator selection. Keep
// resume validation here so normal graph execution does not learn about host
// CLI state.

import { readFileSync } from 'node:fs';
import { findCheckpointBriefBuilder } from '../../flows/registries/checkpoint-writers/registry.js';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import { LayeredConfig } from '../../schemas/config.js';
import { sha256Hex } from '../../shared/connector-relay.js';
import type { ProgressReporter, RelayFn } from '../../shared/relay-runtime-types.js';
import type { TraceEntry } from '../domain/trace.js';
import type { ExecutorRegistry } from '../executors/index.js';
import type { RelayConnector } from '../executors/relay.js';
import type { CheckpointStep, ExecutableFlow } from '../manifest/executable-flow.js';
import { fromCompiledFlow } from '../manifest/from-compiled-flow.js';
import { resolveRunFilePath } from '../run-files/paths.js';
import { TraceStore } from '../trace/trace-store.js';
import type {
  ChildCompiledFlowResolver,
  CompiledFlowRunner,
  WorktreeRunner,
} from './child-runner.js';
import { runCompiledFlow } from './compiled-flow-runner.js';
import {
  type GraphRunResult,
  executeExecutableFlow,
  isGraphCheckpointWaitingResult,
} from './graph-runner.js';
import { readRuntimeCompiledFlowManifestSnapshot } from './manifest-snapshot.js';

export interface ResumeCompiledFlowOptions {
  readonly runDir: string;
  readonly selection: string;
  readonly now?: () => Date;
  readonly relayConnector?: RelayConnector;
  readonly relayer?: RelayFn;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolver;
  readonly childRunner?: CompiledFlowRunner;
  readonly worktreeRunner?: WorktreeRunner;
  readonly executors?: Partial<ExecutorRegistry>;
  readonly progress?: ProgressReporter;
}

interface CheckpointRequestContext {
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly checkpointReportSha256?: string;
}

type CompiledCheckpointStep = CompiledFlow['steps'][number] & {
  readonly kind: 'checkpoint';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function traceString(entry: TraceEntry | undefined, key: keyof TraceEntry): string | undefined {
  const value = entry?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function traceDataString(entry: TraceEntry | undefined, key: string): string | undefined {
  const data = entry?.data;
  if (!isRecord(data)) return undefined;
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function runtimeTraceString(
  entry: TraceEntry | undefined,
  key: keyof TraceEntry,
): string | undefined {
  return traceString(entry, key) ?? traceDataString(entry, key);
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((entry): entry is string => typeof entry === 'string');
  return entries.length === value.length && entries.length > 0 ? entries : undefined;
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRuntimeBootstrap(entry: TraceEntry | undefined): entry is TraceEntry {
  return (
    entry?.kind === 'run.bootstrapped' &&
    runtimeTraceString(entry, 'engine') === 'runtime' &&
    runtimeTraceString(entry, 'manifest_hash') !== undefined
  );
}

export async function isRuntimeRunFolder(runDir: string): Promise<boolean> {
  try {
    const trace = new TraceStore(runDir);
    const entries = await trace.load();
    return isRuntimeBootstrap(entries[0]);
  } catch {
    return false;
  }
}

function latestUnresolvedCheckpoint(entries: readonly TraceEntry[]): TraceEntry {
  const resolved = new Set<string>();
  for (const entry of entries) {
    if (entry.kind !== 'checkpoint.resolved' || entry.step_id === undefined) continue;
    if (entry.attempt === undefined) continue;
    resolved.add(`${entry.step_id}:${entry.attempt}`);
  }
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry === undefined || entry.kind !== 'checkpoint.requested') continue;
    if (entry.step_id === undefined || entry.attempt === undefined) continue;
    if (!resolved.has(`${entry.step_id}:${entry.attempt}`)) return entry;
  }
  throw new Error('runtime checkpoint resume rejected: run has no unresolved checkpoint request');
}

function checkpointStep(input: {
  readonly flow: ExecutableFlow;
  readonly stepId: string;
}): CheckpointStep {
  const step = input.flow.steps.find((candidate) => candidate.id === input.stepId);
  if (step === undefined || step.kind !== 'checkpoint') {
    throw new Error(
      `runtime checkpoint resume rejected: current step '${input.stepId}' is not a checkpoint`,
    );
  }
  return step;
}

function declaredCheckpointRequestPath(step: CheckpointStep): string {
  const requestPath = step.writes?.request?.path;
  if (requestPath === undefined) {
    throw new Error(
      `runtime checkpoint resume rejected: checkpoint step '${step.id}' has no declared request path`,
    );
  }
  return requestPath;
}

function readCheckpointRequestContext(input: {
  readonly runDir: string;
  readonly step: CheckpointStep;
  readonly requestPath: string;
  readonly expectedRequestHash: string;
}): CheckpointRequestContext {
  const requestAbs = resolveRunFilePath(input.runDir, input.requestPath);
  const requestText = readFileSync(requestAbs, 'utf8');
  if (sha256Hex(requestText) !== input.expectedRequestHash) {
    throw new Error(
      'runtime checkpoint resume rejected: checkpoint request hash differs from trace',
    );
  }
  const raw = JSON.parse(requestText) as unknown;
  if (!isRecord(raw)) {
    throw new Error(
      `runtime checkpoint resume rejected: request for '${input.step.id}' is invalid`,
    );
  }
  if (raw.schema_version !== 1 || raw.step_id !== input.step.id) {
    throw new Error(`runtime checkpoint resume rejected: request for '${input.step.id}' is stale`);
  }
  const requestChoices = stringArray(raw.allowed_choices);
  if (
    requestChoices === undefined ||
    requestChoices.length !== input.step.choices.length ||
    requestChoices.some((choice, index) => choice !== input.step.choices[index])
  ) {
    throw new Error(
      `runtime checkpoint resume rejected: request choices for '${input.step.id}' are stale`,
    );
  }
  const context = raw.execution_context;
  if (!isRecord(context)) {
    throw new Error(
      `runtime checkpoint resume rejected: request for '${input.step.id}' has no execution context`,
    );
  }
  const projectRoot = context.project_root;
  if (projectRoot !== undefined && typeof projectRoot !== 'string') {
    throw new Error('runtime checkpoint resume rejected: project_root is invalid');
  }
  const selectionConfigLayers = LayeredConfig.array().parse(context.selection_config_layers ?? []);
  const checkpointReportSha256 = context.checkpoint_report_sha256;
  if (checkpointReportSha256 !== undefined && typeof checkpointReportSha256 !== 'string') {
    throw new Error('runtime checkpoint resume rejected: checkpoint_report_sha256 is invalid');
  }
  return {
    ...(projectRoot === undefined ? {} : { projectRoot }),
    selectionConfigLayers,
    ...(checkpointReportSha256 === undefined ? {} : { checkpointReportSha256 }),
  };
}

function validateCheckpointReport(input: {
  readonly runDir: string;
  readonly compiledStep: CompiledCheckpointStep;
  readonly requestContext: CheckpointRequestContext;
}): void {
  const report = input.compiledStep.writes.report;
  if (report === undefined) {
    if (input.requestContext.checkpointReportSha256 !== undefined) {
      throw new Error(
        `runtime checkpoint resume rejected: checkpoint '${input.compiledStep.id}' request carries a report hash but the step writes no report`,
      );
    }
    return;
  }
  if (typeof report === 'string') {
    if (input.requestContext.checkpointReportSha256 !== undefined) {
      throw new Error(
        `runtime checkpoint resume rejected: checkpoint '${input.compiledStep.id}' request carries a report hash but the report has no schema validator`,
      );
    }
    return;
  }
  const builder = findCheckpointBriefBuilder(report.schema);
  if (builder?.validateResumeContext === undefined) {
    if (input.requestContext.checkpointReportSha256 !== undefined) {
      throw new Error(
        `runtime checkpoint resume rejected: builder for schema '${report.schema}' is missing validateResumeContext but the checkpoint request carries a report hash`,
      );
    }
    return;
  }
  builder.validateResumeContext({
    runFolder: input.runDir,
    step: input.compiledStep,
    reportPath: report.path,
    ...(input.requestContext.checkpointReportSha256 === undefined
      ? {}
      : { reportSha256: input.requestContext.checkpointReportSha256 }),
  });
}

function executableFlowForResume(input: {
  readonly flow: CompiledFlow;
  readonly bootstrap: TraceEntry;
}): ExecutableFlow {
  const executable = fromCompiledFlow(input.flow);
  const entryModeName = traceDataString(input.bootstrap, 'entry_mode');
  const entry =
    traceDataString(input.bootstrap, 'entry') ??
    input.flow.entry_modes.find((mode) => mode.name === entryModeName)?.start_at ??
    executable.entry;
  return {
    ...executable,
    entry,
    metadata: {
      ...executable.metadata,
      ...(entryModeName === undefined ? {} : { selected_entry_mode: entryModeName }),
      ...(runtimeTraceString(input.bootstrap, 'depth') === undefined
        ? {}
        : { selected_depth: runtimeTraceString(input.bootstrap, 'depth') }),
    },
  };
}

export async function resumeCompiledFlow(
  options: ResumeCompiledFlowOptions,
): Promise<GraphRunResult> {
  const trace = new TraceStore(options.runDir, {
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const entries = await trace.load();
  const bootstrap = entries[0];
  if (!isRuntimeBootstrap(bootstrap)) {
    throw new Error('runtime checkpoint resume rejected: run folder is not marked runtime');
  }
  if (entries.some((entry) => entry.kind === 'run.closed')) {
    throw new Error('runtime checkpoint resume rejected: run is already closed');
  }

  const bootstrapRunId = traceString(bootstrap, 'run_id');
  const bootstrapFlowId = runtimeTraceString(bootstrap, 'flow_id');
  const bootstrapGoal = runtimeTraceString(bootstrap, 'goal');
  const bootstrapManifestHash = runtimeTraceString(bootstrap, 'manifest_hash');
  if (
    bootstrapRunId === undefined ||
    bootstrapFlowId === undefined ||
    bootstrapGoal === undefined ||
    bootstrapManifestHash === undefined
  ) {
    throw new Error('runtime checkpoint resume rejected: bootstrap identity is incomplete');
  }

  const { flow, flowBytes, snapshot } = await readRuntimeCompiledFlowManifestSnapshot({
    runDir: options.runDir,
    expectedRunId: bootstrapRunId,
    expectedFlowId: bootstrapFlowId,
    expectedHash: bootstrapManifestHash,
  });
  const executable = executableFlowForResume({ flow, bootstrap });
  const requested = latestUnresolvedCheckpoint(entries);
  const stepId = traceString(requested, 'step_id');
  const attempt = requested.attempt;
  const requestPath = traceString(requested, 'request_path');
  const requestHash = traceString(requested, 'request_report_hash');
  const allowedChoices = stringArray(requested.allowed_choices);
  if (
    stepId === undefined ||
    attempt === undefined ||
    requestPath === undefined ||
    requestHash === undefined ||
    allowedChoices === undefined
  ) {
    throw new Error('runtime checkpoint resume rejected: checkpoint request trace is incomplete');
  }
  const step = checkpointStep({ flow: executable, stepId });
  const savedChoices = step.choices;
  if (!sameStringArray(allowedChoices, savedChoices)) {
    throw new Error(
      `runtime checkpoint resume rejected: checkpoint trace choices for '${stepId}' are stale`,
    );
  }
  if (!savedChoices.includes(options.selection)) {
    throw new Error(
      `runtime checkpoint resume rejected: selection '${options.selection}' is not allowed for checkpoint '${stepId}'`,
    );
  }
  const compiledStep = flow.steps.find(
    (candidate) => (candidate.id as unknown as string) === stepId,
  );
  if (compiledStep === undefined || compiledStep.kind !== 'checkpoint') {
    throw new Error(`runtime checkpoint resume rejected: saved flow step '${stepId}' is invalid`);
  }
  const allowed = (step.check as { readonly allow?: unknown }).allow;
  if (Array.isArray(allowed) && !allowed.includes(options.selection)) {
    throw new Error(
      `runtime checkpoint resume rejected: selection '${options.selection}' is outside check.allow for checkpoint '${stepId}'`,
    );
  }
  const declaredRequestPath = declaredCheckpointRequestPath(step);
  if (requestPath !== declaredRequestPath) {
    throw new Error(
      `runtime checkpoint resume rejected: checkpoint request path '${requestPath}' does not match saved flow path '${declaredRequestPath}'`,
    );
  }
  const requestContext = readCheckpointRequestContext({
    runDir: options.runDir,
    step,
    requestPath,
    expectedRequestHash: requestHash,
  });
  validateCheckpointReport({
    runDir: options.runDir,
    compiledStep,
    requestContext,
  });
  const entryModeName = traceDataString(bootstrap, 'entry_mode');
  const depth = runtimeTraceString(bootstrap, 'depth');

  const result = await executeExecutableFlow(executable, {
    runDir: options.runDir,
    runId: bootstrapRunId,
    goal: bootstrapGoal,
    manifestHash: snapshot.hash,
    manifestBytes: flowBytes,
    compiledFlow: flow,
    ...(entryModeName === undefined ? {} : { entryModeName }),
    ...(depth === undefined ? {} : { depth }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.executors === undefined ? {} : { executors: options.executors }),
    ...(options.childCompiledFlowResolver === undefined
      ? {}
      : { childCompiledFlowResolver: options.childCompiledFlowResolver }),
    childRunner: options.childRunner ?? runCompiledFlow,
    ...(requestContext.projectRoot === undefined
      ? {}
      : { projectRoot: requestContext.projectRoot }),
    ...(options.worktreeRunner === undefined ? {} : { worktreeRunner: options.worktreeRunner }),
    ...(options.relayConnector === undefined ? {} : { relayConnector: options.relayConnector }),
    ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
    ...(requestContext.selectionConfigLayers.length === 0
      ? {}
      : { selectionConfigLayers: requestContext.selectionConfigLayers }),
    ...(options.progress === undefined ? {} : { progress: options.progress }),
    resumeCheckpoint: { stepId, attempt, selection: options.selection },
  });
  if (isGraphCheckpointWaitingResult(result)) {
    throw new Error('runtime checkpoint resume rejected: resume did not resolve checkpoint');
  }
  return result;
}
