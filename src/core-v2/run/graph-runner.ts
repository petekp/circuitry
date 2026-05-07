import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir } from 'node:fs/promises';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import { computeManifestHash } from '../../schemas/manifest.js';
import type {
  ProgressReporter,
  RelayFn,
  RuntimeEvidencePolicy,
} from '../../shared/relay-runtime-types.js';
import type { TerminalTarget } from '../domain/route.js';
import type { RunClosedOutcomeV2 } from '../domain/run.js';
import { isWaitingCheckpointStepOutcomeV2 } from '../domain/step.js';
import type { TraceEntryV2 } from '../domain/trace.js';
import { type ExecutorRegistryV2, createDefaultExecutorsV2 } from '../executors/index.js';
import type { RelayConnectorV2 } from '../executors/relay.js';
import type { ExecutableFlowV2, ExecutableStepV2 } from '../manifest/executable-flow.js';
import { assertExecutableFlowV2 } from '../manifest/validate-executable-flow.js';
import { createProgressProjectorV2 } from '../projections/progress.js';
import { validateReportValueV2 } from '../run-files/report-validator.js';
import { RunFileStore } from '../run-files/run-file-store.js';
import { TraceStore } from '../trace/trace-store.js';
import type {
  ChildCompiledFlowResolverV2,
  CompiledFlowRunnerV2,
  WorktreeRunnerV2,
} from './child-runner.js';
import { writeManifestSnapshotV2 } from './manifest-snapshot.js';
import { type RunResultV2, writeRunResultV2 } from './result-writer.js';
import type { RunContextV2 } from './run-context.js';

export interface GraphRunnerOptionsV2 {
  readonly runDir: string;
  readonly runId?: string;
  readonly goal?: string;
  readonly manifestHash?: string;
  readonly manifestBytes?: Uint8Array;
  readonly compiledFlowV1?: CompiledFlow;
  readonly entryModeName?: string;
  readonly depth?: string;
  readonly now?: () => Date;
  readonly executors?: Partial<ExecutorRegistryV2>;
  readonly childExecutors?: Partial<ExecutorRegistryV2>;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolverV2;
  readonly childRunner?: CompiledFlowRunnerV2;
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
  readonly worktreeRunner?: WorktreeRunnerV2;
  readonly relayConnector?: RelayConnectorV2;
  readonly relayer?: RelayFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
  readonly progress?: ProgressReporter;
  readonly maxSteps?: number;
  readonly resumeCheckpoint?: {
    readonly stepId: string;
    readonly attempt: number;
    readonly selection: string;
  };
}

export interface GraphRunResultV2 extends RunResultV2 {
  readonly resultPath: string;
}

export interface GraphCheckpointWaitingResultV2 {
  readonly kind: 'checkpoint_waiting';
  readonly outcome: 'checkpoint_waiting';
  readonly runFolder: string;
  readonly runId: string;
  readonly flowId: string;
  readonly traceEntriesObserved: number;
  readonly checkpoint: {
    readonly stepId: string;
    readonly attempt: number;
    readonly requestPath: string;
    readonly allowedChoices: readonly string[];
  };
}

export type GraphExecutionResultV2 = GraphRunResultV2 | GraphCheckpointWaitingResultV2;

export function isGraphCheckpointWaitingResultV2(
  result: GraphExecutionResultV2,
): result is GraphCheckpointWaitingResultV2 {
  return 'kind' in result && result.kind === 'checkpoint_waiting';
}

const RECOVERY_ROUTE_LABELS = new Set(['retry', 'revise']);

function defaultManifestHash(flow: ExecutableFlowV2): string {
  return `core-v2:${flow.id}@${flow.version}`;
}

function resultSummary(outcome: RunClosedOutcomeV2, terminalTarget?: TerminalTarget): string {
  if (terminalTarget === undefined) return `Run closed with outcome ${outcome}.`;
  return `Run closed with outcome ${outcome} via ${terminalTarget}.`;
}

function outcomeForTerminal(target: TerminalTarget): RunClosedOutcomeV2 {
  if (target === '@complete') return 'complete';
  if (target === '@stop') return 'stopped';
  if (target === '@handoff') return 'handoff';
  return 'escalated';
}

function latestAdmittedVerdict(context: RunContextV2): string | undefined {
  const entries = [...context.trace.getAll()].reverse();
  for (const entry of entries) {
    if (entry.kind !== 'relay.completed' && entry.kind !== 'sub_run.completed') continue;
    if (typeof entry.verdict !== 'string' || entry.verdict.length === 0) continue;
    if (entry.data?.admitted === false) continue;
    if (entry.kind === 'sub_run.completed' && entry.child_outcome !== 'complete') continue;
    return entry.verdict;
  }
  return undefined;
}

function isRecoveryRoute(route: string | undefined): boolean {
  return route !== undefined && RECOVERY_ROUTE_LABELS.has(route);
}

function configuredMaxAttempts(step: ExecutableStepV2): number | undefined {
  const budgets = step.budgets;
  if (budgets === undefined || budgets === null || typeof budgets !== 'object') return undefined;
  const maxAttempts = (budgets as { readonly max_attempts?: unknown }).max_attempts;
  if (typeof maxAttempts !== 'number') return undefined;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) return undefined;
  return maxAttempts;
}

function maxAttemptsForRoute(step: ExecutableStepV2, route: string | undefined): number {
  return configuredMaxAttempts(step) ?? (isRecoveryRoute(route) ? 2 : 1);
}

function completedStepCountsFromTrace(entries: readonly TraceEntryV2[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== 'step.completed' || entry.step_id === undefined) continue;
    counts.set(entry.step_id, (counts.get(entry.step_id) ?? 0) + 1);
  }
  return counts;
}

async function assertFreshRunDir(runDir: string): Promise<void> {
  let stat: Awaited<ReturnType<typeof lstat>> | undefined;
  try {
    stat = await lstat(runDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(runDir, { recursive: true });
    stat = await lstat(runDir);
  }
  if (stat.isSymbolicLink()) {
    throw new Error('core-v2 baseline requires a fresh run directory; existing path is a symlink');
  }
  if (!stat.isDirectory()) {
    throw new Error(
      'core-v2 baseline requires a fresh run directory; existing path is not a directory',
    );
  }
  const entries = await readdir(runDir);
  if (entries.length > 0) {
    throw new Error(
      `core-v2 baseline requires a fresh run directory; existing directory is not empty (${entries.join(', ')})`,
    );
  }
}

function resolveManifestHash(flow: ExecutableFlowV2, options: GraphRunnerOptionsV2): string {
  if (options.manifestBytes === undefined) {
    return options.manifestHash ?? defaultManifestHash(flow);
  }
  const computed = computeManifestHash(options.manifestBytes);
  if (options.manifestHash !== undefined && options.manifestHash !== computed) {
    throw new Error('manifest bytes hash differs from run manifest_hash');
  }
  return computed;
}

async function closeRun(
  context: RunContextV2,
  outcome: RunClosedOutcomeV2,
  terminalTarget?: TerminalTarget,
  reason?: string,
): Promise<GraphRunResultV2> {
  await context.trace.append({
    run_id: context.runId,
    kind: 'run.closed',
    outcome,
    ...(reason === undefined ? {} : { reason }),
    data: {
      outcome,
      ...(terminalTarget === undefined ? {} : { terminal_target: terminalTarget }),
      ...(reason === undefined ? {} : { reason }),
    },
  });
  const verdict = outcome === 'complete' ? latestAdmittedVerdict(context) : undefined;
  const result: RunResultV2 = {
    schema_version: 1,
    run_id: context.runId,
    flow_id: context.flow.id,
    goal: context.goal,
    outcome,
    summary: resultSummary(outcome, terminalTarget),
    closed_at: context.now().toISOString(),
    trace_entries_observed: context.trace.getAll().length,
    manifest_hash: context.manifestHash,
    ...(reason === undefined ? {} : { reason }),
    ...(verdict === undefined ? {} : { verdict }),
  };
  const resultPath = await writeRunResultV2(context.files, result);
  return { ...result, resultPath };
}

export async function executeExecutableFlowV2WithWaiting(
  flow: ExecutableFlowV2,
  options: GraphRunnerOptionsV2,
): Promise<GraphExecutionResultV2> {
  assertExecutableFlowV2(flow);
  const isResume = options.resumeCheckpoint !== undefined;
  if (!isResume) {
    await assertFreshRunDir(options.runDir);
  } else {
    await mkdir(options.runDir, { recursive: true });
  }

  const runId = options.runId ?? randomUUID();
  const progressProjector = createProgressProjectorV2({
    progress: options.progress,
    runDir: options.runDir,
    runId,
    flow,
    ...(options.compiledFlowV1 === undefined ? {} : { compiledFlow: options.compiledFlowV1 }),
  });
  const trace = new TraceStore(options.runDir, {
    ...(options.now === undefined ? {} : { now: options.now }),
    onAppend: progressProjector,
  });
  const existingTrace = await trace.load();
  if (!isResume && existingTrace.length > 0) {
    throw new Error('core-v2 baseline requires a fresh run directory');
  }
  if (isResume && existingTrace.length === 0) {
    throw new Error('core-v2 resume requires an existing trace');
  }
  if (isResume && existingTrace.some((entry) => entry.kind === 'run.closed')) {
    throw new Error('core-v2 resume rejected: run is already closed');
  }

  const files = new RunFileStore(options.runDir, validateReportValueV2);
  const context: RunContextV2 = {
    flow,
    ...(options.compiledFlowV1 === undefined ? {} : { compiledFlowV1: options.compiledFlowV1 }),
    runId,
    runDir: options.runDir,
    goal: options.goal ?? '',
    manifestHash: resolveManifestHash(flow, options),
    ...(options.entryModeName === undefined ? {} : { entryModeName: options.entryModeName }),
    ...(options.depth === undefined ? {} : { depth: options.depth }),
    now: options.now ?? (() => new Date()),
    files,
    trace,
    ...(options.childCompiledFlowResolver === undefined
      ? {}
      : { childCompiledFlowResolver: options.childCompiledFlowResolver }),
    ...(options.childRunner === undefined ? {} : { childRunner: options.childRunner }),
    ...(options.childExecutors === undefined ? {} : { childExecutors: options.childExecutors }),
    ...(options.projectRoot === undefined ? {} : { projectRoot: options.projectRoot }),
    ...(options.evidencePolicy === undefined ? {} : { evidencePolicy: options.evidencePolicy }),
    ...(options.worktreeRunner === undefined ? {} : { worktreeRunner: options.worktreeRunner }),
    ...(options.relayConnector === undefined ? {} : { relayConnector: options.relayConnector }),
    ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
    ...(options.selectionConfigLayers === undefined
      ? {}
      : { selectionConfigLayers: options.selectionConfigLayers }),
    ...(options.progress === undefined ? {} : { progress: options.progress }),
    ...(options.resumeCheckpoint === undefined
      ? {}
      : { resumeCheckpoint: options.resumeCheckpoint }),
  };
  const executors: ExecutorRegistryV2 = {
    ...createDefaultExecutorsV2({
      ...(options.relayConnector === undefined ? {} : { relayConnector: options.relayConnector }),
    }),
    ...options.executors,
  };
  const steps = new Map(flow.steps.map((step) => [step.id, step]));
  const completedStepCounts = isResume
    ? completedStepCountsFromTrace(existingTrace)
    : new Map<string, number>();
  const maxSteps = options.maxSteps ?? Math.max(flow.steps.length * 4, 8);

  const bootstrapRecordedAt = context.now().toISOString();
  if (!isResume && options.manifestBytes !== undefined) {
    await writeManifestSnapshotV2({
      runDir: options.runDir,
      runId,
      flowId: flow.id,
      capturedAt: bootstrapRecordedAt,
      bytes: options.manifestBytes,
    });
  }

  if (!isResume) {
    await trace.append({
      run_id: runId,
      kind: 'run.bootstrapped',
      engine: 'core-v2',
      recorded_at: bootstrapRecordedAt,
      flow_id: flow.id,
      goal: context.goal,
      manifest_hash: context.manifestHash,
      ...(context.depth === undefined ? {} : { depth: context.depth }),
      data: {
        flow_id: flow.id,
        engine: 'core-v2',
        version: flow.version,
        entry: flow.entry,
        manifest_hash: context.manifestHash,
        ...(context.entryModeName === undefined ? {} : { entry_mode: context.entryModeName }),
        ...(context.depth === undefined ? {} : { depth: context.depth }),
      },
    });
  }

  let currentStepId = options.resumeCheckpoint?.stepId ?? flow.entry;
  let incomingRouteTaken: string | undefined;
  for (let index = 0; index < maxSteps; index += 1) {
    const step = steps.get(currentStepId);
    if (step === undefined) {
      return await closeRun(
        context,
        'aborted',
        undefined,
        `route target '${currentStepId}' is not a known step id`,
      );
    }

    const isResumedCheckpoint = options.resumeCheckpoint?.stepId === currentStepId;
    const completedCount = completedStepCounts.get(step.id) ?? 0;
    const maxAttempts = maxAttemptsForRoute(step, incomingRouteTaken);
    const attempt = isResumedCheckpoint ? options.resumeCheckpoint.attempt : completedCount + 1;
    if (
      !isResumedCheckpoint &&
      completedCount > 0 &&
      (!isRecoveryRoute(incomingRouteTaken) || completedCount >= maxAttempts)
    ) {
      const reason =
        incomingRouteTaken === undefined
          ? `route cycle detected at step '${step.id}'; aborting before re-entering an already completed step`
          : `route '${incomingRouteTaken}' for step '${step.id}' exhausted max_attempts=${maxAttempts}`;
      await trace.append({
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        reason,
        data: { message: reason },
      });
      return await closeRun(context, 'aborted', undefined, reason);
    }

    if (!isResumedCheckpoint) {
      await trace.append({ run_id: runId, kind: 'step.entered', step_id: step.id, attempt });
    }

    let route: string;
    let details: Record<string, unknown>;
    try {
      const stepContext: RunContextV2 = {
        ...context,
        activeStepAttempt: attempt,
        ...(isResumedCheckpoint && options.resumeCheckpoint !== undefined
          ? { resumeCheckpoint: options.resumeCheckpoint }
          : {}),
      };
      const outcome = await executors[step.kind](step, stepContext);
      if (isWaitingCheckpointStepOutcomeV2(outcome)) {
        return {
          kind: 'checkpoint_waiting',
          outcome: 'checkpoint_waiting',
          runFolder: options.runDir,
          runId,
          flowId: flow.id,
          traceEntriesObserved: trace.getAll().length,
          checkpoint: outcome.checkpoint,
        };
      }
      route = outcome.route;
      details = outcome.details ?? {};
    } catch (error) {
      const message = (error as Error).message;
      await trace.append({
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        reason: message,
        data: { message },
      });
      return await closeRun(
        context,
        'aborted',
        undefined,
        `step '${step.id}' handler threw: ${message}`,
      );
    }

    const target = step.routes[route];
    if (target === undefined) {
      const reason = `step '${step.id}' selected undeclared route '${route}'`;
      await trace.append({
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        reason,
        data: { message: reason },
      });
      return await closeRun(context, 'aborted', undefined, reason);
    }

    if (target.kind === 'step' && target.stepId === step.id && route === 'pass') {
      const reason = `route cycle detected: step '${step.id}' routes via '${route}' to itself`;
      await trace.append({
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        route_taken: route,
        reason,
        data: { message: reason },
      });
      return await closeRun(context, 'aborted', undefined, reason);
    }

    if (target.kind === 'step') {
      const targetCompletedCount = completedStepCounts.get(target.stepId) ?? 0;
      const targetStep = steps.get(target.stepId);
      const targetMaxAttempts =
        targetStep === undefined
          ? maxAttemptsForRoute(step, route)
          : maxAttemptsForRoute(targetStep, route);
      if (
        targetCompletedCount > 0 &&
        (!isRecoveryRoute(route) || targetCompletedCount >= targetMaxAttempts)
      ) {
        const reason = isRecoveryRoute(route)
          ? `route '${route}' for step '${target.stepId}' exhausted max_attempts=${targetMaxAttempts}`
          : `route cycle detected: step '${step.id}' routes via '${route}' to already completed step '${target.stepId}'`;
        await trace.append({
          run_id: runId,
          kind: 'step.aborted',
          step_id: step.id,
          attempt,
          route_taken: route,
          reason,
          data: { message: reason },
        });
        return await closeRun(context, 'aborted', undefined, reason);
      }
    }

    await trace.append({
      run_id: runId,
      kind: 'step.completed',
      step_id: step.id,
      attempt,
      route_taken: route,
      data: { route, details },
    });
    completedStepCounts.set(step.id, completedCount + 1);

    if (target.kind === 'terminal') {
      return await closeRun(context, outcomeForTerminal(target.target), target.target);
    }

    currentStepId = target.stepId;
    incomingRouteTaken = route;
  }

  return await closeRun(context, 'aborted', undefined, `maxSteps exceeded: ${maxSteps}`);
}

export async function executeExecutableFlowV2(
  flow: ExecutableFlowV2,
  options: GraphRunnerOptionsV2,
): Promise<GraphRunResultV2> {
  const result = await executeExecutableFlowV2WithWaiting(flow, options);
  if (isGraphCheckpointWaitingResultV2(result)) {
    throw new Error(
      `core-v2 run '${result.runId}' paused at checkpoint '${result.checkpoint.stepId}', which requires checkpoint-aware resume routing`,
    );
  }
  return result;
}
