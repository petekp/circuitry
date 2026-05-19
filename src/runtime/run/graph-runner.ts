// Runtime graph execution loop.
//
// Owns step advancement for one run folder: bootstrap trace, step attempts,
// recovery routes, checkpoint waiting, terminal closure, and result.json.
// Keep flow-specific behavior in executors and flow registries; this file
// should only interpret the executable graph and append durable trace entries.

import { randomUUID } from 'node:crypto';
import type { Axes } from '../../schemas/axes.js';
import type { ChangeKindDeclaration } from '../../schemas/change-kind.js';
import { computeManifestHash } from '../../schemas/manifest.js';
import { isProofPlanBlockedError } from '../../shared/proof-plan.js';
import type { TerminalTarget } from '../domain/route.js';
import type { RunClosedOutcome } from '../domain/run.js';
import { isWaitingCheckpointStepOutcome } from '../domain/step.js';
import type { TraceEntry } from '../domain/trace.js';
import { type ExecutorRegistry, createDefaultExecutors } from '../executors/index.js';
import type { ExecutableFlow, ExecutableStep } from '../manifest/executable-flow.js';
import { buildRuntimePackageIndex } from '../manifest/runtime-package-index.js';
import { assertExecutableFlow } from '../manifest/validate-executable-flow.js';
import type { RuntimeExecutionCapabilities } from './capabilities.js';
import { writeRuntimeManifestSnapshot } from './manifest-snapshot.js';
import { type RuntimeRunResult, writeRuntimeRunResult } from './result-writer.js';
import { openRunBoundary } from './run-boundary.js';
import type { RunContext } from './run-context.js';

export interface GraphRunnerOptions extends RuntimeExecutionCapabilities {
  readonly runDir: string;
  readonly runId?: string;
  readonly goal?: string;
  readonly manifestHash?: string;
  readonly manifestBytes?: Uint8Array;
  readonly entryModeName?: string;
  readonly depth?: string;
  readonly axes?: Axes;
  readonly maxSteps?: number;
  readonly resumeCheckpoint?: {
    readonly stepId: string;
    readonly attempt: number;
    readonly selection: string;
  };
}

export interface GraphRunResult extends RuntimeRunResult {
  readonly resultPath: string;
}

export interface GraphClosedOutcome {
  readonly kind: 'closed';
  readonly result: GraphRunResult;
}

export interface GraphCheckpointWaitingResult {
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

export type GraphExecutionResult = GraphRunResult | GraphCheckpointWaitingResult;

export interface GraphRejectedOutcome {
  readonly kind: 'rejected';
  readonly outcome: 'rejected';
  readonly reason: string;
  readonly error: Error;
}

export type GraphExecutionOutcome =
  | GraphClosedOutcome
  | GraphCheckpointWaitingResult
  | GraphRejectedOutcome;

export function isGraphCheckpointWaitingResult(
  result: GraphExecutionResult | GraphExecutionOutcome,
): result is GraphCheckpointWaitingResult {
  return 'kind' in result && result.kind === 'checkpoint_waiting';
}

export function isGraphRejectedOutcome(
  result: GraphExecutionResult | GraphExecutionOutcome,
): result is GraphRejectedOutcome {
  return 'kind' in result && result.kind === 'rejected';
}

const RECOVERY_ROUTE_LABELS = new Set(['retry', 'revise']);

interface ActiveRecovery {
  readonly originStepId: string;
  readonly route: string;
  readonly reason?: string;
}

function defaultManifestHash(flow: ExecutableFlow): string {
  return `runtime:${flow.id}@${flow.version}`;
}

function resultSummary(outcome: RunClosedOutcome, terminalTarget?: TerminalTarget): string {
  if (terminalTarget === undefined) return `Run closed with outcome ${outcome}.`;
  return `Run closed with outcome ${outcome} via ${terminalTarget}.`;
}

function outcomeForTerminal(target: TerminalTarget): RunClosedOutcome {
  if (target === '@complete') return 'complete';
  if (target === '@stop') return 'stopped';
  if (target === '@handoff') return 'handoff';
  return 'escalated';
}

function latestAdmittedVerdict(context: RunContext): string | undefined {
  const entries = context.trace.getAll();
  const admitted = new Set<string>();
  for (const entry of entries) {
    if (
      entry.kind === 'check.evaluated' &&
      entry.check_kind === 'result_verdict' &&
      entry.outcome === 'pass' &&
      entry.step_id !== undefined &&
      entry.attempt !== undefined
    ) {
      admitted.add(`${entry.step_id}:${entry.attempt}`);
    }
  }
  for (const entry of [...entries].reverse()) {
    if (entry.kind !== 'relay.completed' && entry.kind !== 'sub_run.completed') continue;
    if (typeof entry.verdict !== 'string' || entry.verdict.length === 0) continue;
    if (entry.step_id === undefined || entry.attempt === undefined) continue;
    if (!admitted.has(`${entry.step_id}:${entry.attempt}`)) continue;
    if (entry.kind === 'sub_run.completed' && entry.child_outcome !== 'complete') continue;
    return entry.verdict;
  }
  return undefined;
}

function isRecoveryRoute(route: string | undefined): boolean {
  return route !== undefined && RECOVERY_ROUTE_LABELS.has(route);
}

function canReachStepViaNonRecoveryRoutes(input: {
  readonly steps: ReadonlyMap<string, ExecutableStep>;
  readonly fromStepId: string;
  readonly targetStepId: string;
}): boolean {
  if (input.fromStepId === input.targetStepId) return true;
  const seen = new Set<string>();
  const queue = [input.fromStepId];

  for (let index = 0; index < queue.length; index += 1) {
    const stepId = queue[index];
    if (stepId === undefined || seen.has(stepId)) continue;
    seen.add(stepId);
    const step = input.steps.get(stepId);
    if (step === undefined) continue;
    for (const [route, target] of Object.entries(step.routes)) {
      if (isRecoveryRoute(route) || target.kind !== 'step') continue;
      if (target.stepId === input.targetStepId) return true;
      queue.push(target.stepId);
    }
  }

  return false;
}

function isRecoveryReturnCorridor(input: {
  readonly steps: ReadonlyMap<string, ExecutableStep>;
  readonly activeRecovery: ActiveRecovery | undefined;
  readonly stepId: string;
  readonly route: string | undefined;
}): boolean {
  if (input.activeRecovery === undefined || isRecoveryRoute(input.route)) return false;
  return canReachStepViaNonRecoveryRoutes({
    steps: input.steps,
    fromStepId: input.stepId,
    targetStepId: input.activeRecovery.originStepId,
  });
}

function configuredMaxAttempts(step: ExecutableStep): number | undefined {
  const budgets = step.budgets;
  if (budgets === undefined || budgets === null || typeof budgets !== 'object') return undefined;
  const maxAttempts = (budgets as { readonly max_attempts?: unknown }).max_attempts;
  if (typeof maxAttempts !== 'number') return undefined;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) return undefined;
  return maxAttempts;
}

function maxAttemptsForRoute(step: ExecutableStep, route: string | undefined): number {
  return configuredMaxAttempts(step) ?? (isRecoveryRoute(route) ? 2 : 1);
}

function bootstrapChangeKind(input: {
  readonly flow: ExecutableFlow;
  readonly entryModeName?: string;
}): ChangeKindDeclaration {
  const defaultKind =
    input.flow.entryModes?.find((mode) => mode.name === input.entryModeName)?.defaultChangeKind ??
    'ratchet-advance';
  if (
    defaultKind !== 'ratchet-advance' &&
    defaultKind !== 'equivalence-refactor' &&
    defaultKind !== 'discovery' &&
    defaultKind !== 'disposable'
  ) {
    return {
      change_kind: 'ratchet-advance',
      failure_mode: 'runtime execution cannot produce required reports',
      acceptance_evidence: 'trace entries, reports, and result files satisfy their schemas',
      alternate_framing: 'start a fresh flow with a narrower goal',
    };
  }
  return {
    change_kind: defaultKind,
    failure_mode: 'runtime execution cannot produce required reports',
    acceptance_evidence: 'trace entries, reports, and result files satisfy their schemas',
    alternate_framing: 'start a fresh flow with a narrower goal',
  };
}

function completedStepCountsFromTrace(entries: readonly TraceEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== 'step.completed' || entry.step_id === undefined) continue;
    counts.set(entry.step_id, (counts.get(entry.step_id) ?? 0) + 1);
  }
  return counts;
}

function resolveManifestHash(flow: ExecutableFlow, options: GraphRunnerOptions): string {
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
  context: RunContext,
  outcome: RunClosedOutcome,
  terminalTarget?: TerminalTarget,
  reason?: string,
): Promise<GraphClosedOutcome> {
  await context.trace.append({
    run_id: context.runId,
    kind: 'run.closed',
    outcome,
    ...(reason === undefined ? {} : { reason }),
  });
  const verdict = outcome === 'complete' ? latestAdmittedVerdict(context) : undefined;
  const result: RuntimeRunResult = {
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
  const resultPath = await writeRuntimeRunResult(context.files, result);
  return { kind: 'closed', result: { ...result, resultPath } };
}

async function executeExecutableFlowOutcomeUnsafe(
  flow: ExecutableFlow,
  options: GraphRunnerOptions,
): Promise<GraphExecutionOutcome> {
  assertExecutableFlow(flow);
  const isResume = options.resumeCheckpoint !== undefined;
  const runId = options.runId ?? randomUUID();
  const boundary = await openRunBoundary({
    runDir: options.runDir,
    isResume,
    runId,
    flow,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.progress === undefined ? {} : { progress: options.progress }),
    ...(options.progressSurface === undefined ? {} : { progressSurface: options.progressSurface }),
  });
  const runDir = boundary.runDirectory.path;
  const { existingTrace, files, trace } = boundary;
  const packageIndex = buildRuntimePackageIndex(flow);
  const context: RunContext = {
    flow,
    packageIndex,
    runId,
    runDir,
    goal: options.goal ?? `Run ${flow.id}`,
    manifestHash: resolveManifestHash(flow, options),
    ...(options.entryModeName === undefined ? {} : { entryModeName: options.entryModeName }),
    ...(options.depth === undefined ? {} : { depth: options.depth }),
    ...(options.axes === undefined ? {} : { axes: options.axes }),
    now: boundary.clock.now,
    files,
    trace,
    externalFiles: options.externalFiles ?? boundary.externalFiles,
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
  const executors: ExecutorRegistry = {
    ...createDefaultExecutors({
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
    await writeRuntimeManifestSnapshot({
      runDir,
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
      recorded_at: bootstrapRecordedAt,
      flow_id: flow.id,
      goal: context.goal,
      manifest_hash: context.manifestHash,
      depth: context.depth ?? 'standard',
      change_kind: bootstrapChangeKind({
        flow,
        ...(context.entryModeName === undefined ? {} : { entryModeName: context.entryModeName }),
      }),
    });
  }

  let currentStepId = options.resumeCheckpoint?.stepId ?? flow.entry;
  let incomingRouteTaken: string | undefined;
  let activeRecovery: ActiveRecovery | undefined;
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
    const isRecoveryOriginReentry = isRecoveryReturnCorridor({
      steps,
      activeRecovery,
      stepId: step.id,
      route: incomingRouteTaken,
    });
    const attempt = isResumedCheckpoint ? options.resumeCheckpoint.attempt : completedCount + 1;
    if (
      !isResumedCheckpoint &&
      completedCount > 0 &&
      !isRecoveryOriginReentry &&
      (!isRecoveryRoute(incomingRouteTaken) || completedCount >= maxAttempts)
    ) {
      const recoverySuffix =
        activeRecovery?.reason === undefined
          ? ''
          : `; last recovery reason: ${activeRecovery.reason}`;
      const reason =
        incomingRouteTaken === undefined
          ? `route cycle detected at step '${step.id}'; aborting before re-entering an already completed step`
          : `route '${incomingRouteTaken}' for step '${step.id}' exhausted max_attempts=${maxAttempts}${recoverySuffix}`;
      await trace.append({
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        reason,
      });
      return await closeRun(context, 'aborted', undefined, reason);
    }

    if (!isResumedCheckpoint) {
      await trace.append({ run_id: runId, kind: 'step.entered', step_id: step.id, attempt });
    }

    let route: string;
    let details: Record<string, unknown>;
    try {
      const stepContext: RunContext = {
        ...context,
        activeStepAttempt: attempt,
        ...(isResumedCheckpoint && options.resumeCheckpoint !== undefined
          ? { resumeCheckpoint: options.resumeCheckpoint }
          : {}),
      };
      const outcome = await executors[step.kind](step, stepContext);
      if (isWaitingCheckpointStepOutcome(outcome)) {
        return {
          kind: 'checkpoint_waiting',
          outcome: 'checkpoint_waiting',
          runFolder: runDir,
          runId,
          flowId: flow.id,
          traceEntriesObserved: trace.getAll().length,
          checkpoint: outcome.checkpoint,
        };
      }
      route = outcome.route;
      details = outcome.details ?? {};
      const recoveryReason = details.reason;
      if (isRecoveryRoute(route) && typeof recoveryReason === 'string') {
        activeRecovery = { originStepId: step.id, route, reason: recoveryReason };
      } else if (isRecoveryRoute(route)) {
        activeRecovery = { originStepId: step.id, route };
      }
    } catch (error) {
      const message = (error as Error).message;
      const reason = isProofPlanBlockedError(error)
        ? message
        : `step '${step.id}' handler threw: ${message}`;
      await trace.append({
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        reason: message,
      });
      return await closeRun(context, 'aborted', undefined, reason);
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
        reason,
      });
      return await closeRun(context, 'aborted', undefined, reason);
    }

    if (target.kind === 'step') {
      const targetCompletedCount = completedStepCounts.get(target.stepId) ?? 0;
      const targetStep = steps.get(target.stepId);
      const isRecoveryReturnToOrigin = isRecoveryReturnCorridor({
        steps,
        activeRecovery,
        stepId: target.stepId,
        route,
      });
      const targetMaxAttempts =
        targetStep === undefined
          ? maxAttemptsForRoute(step, route)
          : maxAttemptsForRoute(targetStep, route);
      if (
        targetCompletedCount > 0 &&
        !isRecoveryReturnToOrigin &&
        (!isRecoveryRoute(route) || targetCompletedCount >= targetMaxAttempts)
      ) {
        const recoverySuffix =
          activeRecovery?.reason === undefined
            ? ''
            : `; last recovery reason: ${activeRecovery.reason}`;
        const reason = isRecoveryRoute(route)
          ? `route '${route}' for step '${target.stepId}' exhausted max_attempts=${targetMaxAttempts}${recoverySuffix}`
          : `route cycle detected: step '${step.id}' routes via '${route}' to already completed step '${target.stepId}'${recoverySuffix}`;
        await trace.append({
          run_id: runId,
          kind: 'step.aborted',
          step_id: step.id,
          attempt,
          reason,
        });
        return await closeRun(context, 'aborted', undefined, reason);
      }
    }

    if (
      activeRecovery !== undefined &&
      activeRecovery.originStepId === step.id &&
      !isRecoveryRoute(route)
    ) {
      activeRecovery = undefined;
    }

    await trace.append({
      run_id: runId,
      kind: 'step.completed',
      step_id: step.id,
      attempt,
      route_taken: route,
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

function errorFromUnknown(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function executeExecutableFlowOutcome(
  flow: ExecutableFlow,
  options: GraphRunnerOptions,
): Promise<GraphExecutionOutcome> {
  try {
    return await executeExecutableFlowOutcomeUnsafe(flow, options);
  } catch (error) {
    const normalized = errorFromUnknown(error);
    return {
      kind: 'rejected',
      outcome: 'rejected',
      reason: normalized.message,
      error: normalized,
    };
  }
}

function graphOutcomeToCompatibilityResult(outcome: GraphExecutionOutcome): GraphExecutionResult {
  if (outcome.kind === 'closed') return outcome.result;
  if (outcome.kind === 'rejected') throw outcome.error;
  return outcome;
}

export async function executeExecutableFlowWithWaiting(
  flow: ExecutableFlow,
  options: GraphRunnerOptions,
): Promise<GraphExecutionResult> {
  return graphOutcomeToCompatibilityResult(await executeExecutableFlowOutcome(flow, options));
}

export async function executeExecutableFlow(
  flow: ExecutableFlow,
  options: GraphRunnerOptions,
): Promise<GraphRunResult> {
  const result = await executeExecutableFlowWithWaiting(flow, options);
  if (isGraphCheckpointWaitingResult(result)) {
    throw new Error(
      `runtime run '${result.runId}' paused at checkpoint '${result.checkpoint.stepId}', which requires checkpoint-aware resume routing`,
    );
  }
  return result;
}
