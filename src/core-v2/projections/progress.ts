import { join } from 'node:path';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import {
  BUILTIN_CONNECTOR_CAPABILITIES,
  type FilesystemCapability,
  type ResolvedConnector,
} from '../../schemas/connector.js';
import type { CompiledFlowId, RunId as ProgressRunId, StepId } from '../../schemas/ids.js';
import type { ProgressTask, ProgressTaskStatus } from '../../schemas/progress-event.js';
import { progressDisplay, reportProgress } from '../../shared/progress-output.js';
import type { ProgressReporter } from '../../shared/relay-runtime-types.js';
import { runResultPath } from '../../shared/result-path.js';
import {
  WRITE_CAPABLE_WORKER_DISCLOSURE,
  compiledFlowMayInvokeWriteCapableWorker,
  flowMayInvokeWriteCapableWorker,
} from '../../shared/write-capable-worker-disclosure.js';
import type { TraceEntryV2 } from '../domain/trace.js';
import type { ExecutableFlowV2 } from '../manifest/executable-flow.js';
import { tournamentCheckpointPresentationV2 } from './tournament-checkpoint-context.js';

function connectorFilesystemCapability(connector: ResolvedConnector): FilesystemCapability {
  return connector.kind === 'builtin'
    ? BUILTIN_CONNECTOR_CAPABILITIES[connector.name].filesystem
    : connector.capabilities.filesystem;
}

function connectorFromTrace(entry: TraceEntryV2): ResolvedConnector | undefined {
  const connector = entry.data?.connector;
  if (connector === undefined || connector === null || typeof connector !== 'object') {
    return undefined;
  }
  const record = connector as Record<string, unknown>;
  if (record.kind === 'builtin' && (record.name === 'claude-code' || record.name === 'codex')) {
    return { kind: 'builtin', name: record.name };
  }
  if (
    record.kind === 'custom' &&
    typeof record.name === 'string' &&
    Array.isArray(record.command) &&
    record.capabilities !== undefined
  ) {
    return connector as ResolvedConnector;
  }
  return undefined;
}

function relayRoleFromTrace(entry: TraceEntryV2): 'reviewer' | 'implementer' | undefined {
  const role = entry.data?.role;
  return role === 'reviewer' || role === 'implementer' ? role : undefined;
}

function stepTitle(input: {
  readonly flow: ExecutableFlowV2;
  readonly compiledFlow: CompiledFlow | undefined;
  readonly stepId: string | undefined;
}): string {
  if (input.stepId === undefined) return '<unknown step>';
  return (
    input.compiledFlow?.steps.find((step) => step.id === input.stepId)?.title ??
    input.flow.steps.find((step) => step.id === input.stepId)?.title ??
    input.stepId
  );
}

function progressTasks(
  flow: ExecutableFlowV2,
  statuses: ReadonlyMap<string, ProgressTaskStatus>,
): ProgressTask[] {
  return flow.steps.map((step) => ({
    id: step.id,
    title: step.title ?? step.id,
    status: statuses.get(step.id) ?? 'pending',
  }));
}

function reportTaskListProgressV2(input: {
  readonly progress: ProgressReporter | undefined;
  readonly runId: ProgressRunId;
  readonly flowId: CompiledFlowId;
  readonly flow: ExecutableFlowV2;
  readonly recordedAt: string;
  readonly statuses: ReadonlyMap<string, ProgressTaskStatus>;
  readonly label: string;
  readonly displayText: string;
  readonly tone?: 'info' | 'success' | 'warning' | 'error' | 'checkpoint';
}): void {
  reportProgress(input.progress, {
    schema_version: 1,
    type: 'task_list.updated',
    run_id: input.runId,
    flow_id: input.flowId,
    recorded_at: input.recordedAt,
    label: input.label,
    display: progressDisplay(input.displayText, 'detail', input.tone ?? 'info'),
    tasks: progressTasks(input.flow, input.statuses),
  });
}

function runOutcome(
  entry: TraceEntryV2,
): 'complete' | 'stopped' | 'handoff' | 'escalated' | 'aborted' {
  const outcome = entry.outcome ?? entry.data?.outcome;
  if (
    outcome === 'complete' ||
    outcome === 'stopped' ||
    outcome === 'handoff' ||
    outcome === 'escalated' ||
    outcome === 'aborted'
  ) {
    return outcome;
  }
  return 'aborted';
}

function runReason(entry: TraceEntryV2): string | undefined {
  const reason = entry.reason ?? entry.data?.reason;
  return typeof reason === 'string' && reason.length > 0 ? reason : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((entry): entry is string => typeof entry === 'string');
  return entries.length === value.length && entries.length > 0 ? entries : undefined;
}

function checkpointPrompt(entry: TraceEntryV2): string {
  const prompt = entry.data?.prompt;
  return typeof prompt === 'string' && prompt.length > 0
    ? prompt
    : 'Choose how to continue this checkpoint.';
}

function checkpointChoiceLabel(choice: string): string {
  return choice
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function checkpointRequestPath(runDir: string, requestPath: string): string {
  return requestPath.startsWith('/') ? requestPath : join(runDir, requestPath);
}

function fanoutChildOutcome(
  value: unknown,
): 'complete' | 'aborted' | 'handoff' | 'stopped' | 'escalated' | undefined {
  if (
    value === 'complete' ||
    value === 'aborted' ||
    value === 'handoff' ||
    value === 'stopped' ||
    value === 'escalated'
  ) {
    return value;
  }
  return undefined;
}

function fanoutPolicy(
  value: unknown,
): 'pick-winner' | 'disjoint-merge' | 'aggregate-only' | undefined {
  if (value === 'pick-winner' || value === 'disjoint-merge' || value === 'aggregate-only') {
    return value;
  }
  return undefined;
}

function fanoutBranchKind(value: unknown): 'relay' | 'sub-run' | undefined {
  if (value === 'relay' || value === 'sub-run') return value;
  return undefined;
}

function shouldWarnAboutWriteCapableWorker(
  flow: ExecutableFlowV2,
  compiledFlow: CompiledFlow | undefined,
): boolean {
  if (compiledFlow !== undefined) return compiledFlowMayInvokeWriteCapableWorker(compiledFlow);
  return (
    flowMayInvokeWriteCapableWorker(flow.id) ||
    flow.steps.some((step) => step.kind === 'relay' && step.role === 'implementer')
  );
}

export function createProgressProjectorV2(input: {
  readonly progress: ProgressReporter | undefined;
  readonly runDir: string;
  readonly runId: string;
  readonly flow: ExecutableFlowV2;
  readonly compiledFlow?: CompiledFlow;
}): (entry: TraceEntryV2) => void {
  const taskStatuses = new Map<string, ProgressTaskStatus>(
    input.flow.steps.map((step) => [step.id, 'pending'] as const),
  );
  const activeAttempts = new Map<string, number>();
  const flowId = input.flow.id as CompiledFlowId;
  const runId = input.runId as ProgressRunId;

  return (entry) => {
    const recordedAt = entry.recorded_at ?? new Date(0).toISOString();
    switch (entry.kind) {
      case 'run.bootstrapped': {
        const shouldWarn = shouldWarnAboutWriteCapableWorker(input.flow, input.compiledFlow);
        const startedText = `Circuit started ${input.flow.id}.`;
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'run.started',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: 'Started Circuit run',
          display: progressDisplay(
            shouldWarn ? `${startedText} ${WRITE_CAPABLE_WORKER_DISCLOSURE}` : startedText,
            'major',
            shouldWarn ? 'warning' : 'info',
          ),
          run_folder: input.runDir,
        });
        reportTaskListProgressV2({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: 'Flow checklist initialized',
          displayText: 'Circuit prepared the flow checklist.',
        });
        break;
      }
      case 'step.entered': {
        const stepId = entry.step_id;
        if (stepId === undefined || entry.attempt === undefined) break;
        activeAttempts.set(stepId, entry.attempt);
        taskStatuses.set(stepId, 'in_progress');
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'step.started',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: title,
          display: progressDisplay(`Circuit started ${title}.`, 'major', 'info'),
          step_id: stepId as StepId,
          step_title: title,
          attempt: entry.attempt,
        });
        reportTaskListProgressV2({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} in progress`,
          displayText: `Circuit is working on ${title}.`,
        });
        break;
      }
      case 'relay.started': {
        const stepId = entry.step_id;
        if (stepId === undefined) break;
        const connector = connectorFromTrace(entry);
        const role = relayRoleFromTrace(entry);
        if (connector === undefined || role === undefined) break;
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        const capability = connectorFilesystemCapability(connector);
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'relay.started',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Running ${role} relay with ${connector.name}`,
          display: progressDisplay(
            `Circuit is running the ${role} relay with ${connector.name} (${capability}).`,
            'major',
            'info',
          ),
          step_id: stepId as StepId,
          step_title: title,
          attempt: activeAttempts.get(stepId) ?? entry.attempt ?? 1,
          role,
          connector_name: connector.name,
          connector_kind: connector.kind,
          filesystem_capability: capability,
        });
        break;
      }
      case 'relay.completed': {
        const stepId = entry.step_id;
        if (
          stepId === undefined ||
          entry.verdict === undefined ||
          entry.duration_ms === undefined
        ) {
          break;
        }
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'relay.completed',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Relay completed with ${entry.verdict}`,
          display: progressDisplay(
            `Circuit relay completed with ${entry.verdict}.`,
            'major',
            'success',
          ),
          step_id: stepId as StepId,
          step_title: title,
          attempt: activeAttempts.get(stepId) ?? entry.attempt ?? 1,
          verdict: entry.verdict,
          duration_ms: entry.duration_ms,
        });
        break;
      }
      case 'fanout.started': {
        const stepId = entry.step_id;
        const branchIds = stringArray(entry.branch_ids);
        if (stepId === undefined || branchIds === undefined) break;
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'fanout.started',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Started ${title} fanout`,
          display: progressDisplay(
            `Circuit started ${title} with ${branchIds.length} branch${branchIds.length === 1 ? '' : 'es'}.`,
            'major',
            'info',
          ),
          step_id: stepId as StepId,
          step_title: title,
          branch_count: branchIds.length,
          branch_ids: branchIds,
        });
        break;
      }
      case 'fanout.branch_started': {
        const stepId = entry.step_id;
        const branchKind = fanoutBranchKind(entry.branch_kind ?? entry.data?.branch_kind);
        if (stepId === undefined || entry.branch_id === undefined || branchKind === undefined) {
          break;
        }
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'fanout.branch_started',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Started branch ${entry.branch_id}`,
          display: progressDisplay(`Circuit started branch ${entry.branch_id}.`, 'detail', 'info'),
          step_id: stepId as StepId,
          step_title: title,
          branch_id: entry.branch_id,
          branch_kind: branchKind,
          ...(entry.child_run_id === undefined
            ? {}
            : { child_run_id: entry.child_run_id as ProgressRunId }),
          ...(entry.worktree_path === undefined ? {} : { worktree_path: entry.worktree_path }),
        });
        break;
      }
      case 'fanout.branch_completed': {
        const stepId = entry.step_id;
        const childOutcome = fanoutChildOutcome(entry.child_outcome);
        const branchKind = fanoutBranchKind(entry.branch_kind ?? entry.data?.branch_kind);
        if (
          stepId === undefined ||
          entry.branch_id === undefined ||
          branchKind === undefined ||
          childOutcome === undefined ||
          entry.verdict === undefined ||
          entry.duration_ms === undefined
        ) {
          break;
        }
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'fanout.branch_completed',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Branch ${entry.branch_id} ${childOutcome}`,
          display: progressDisplay(
            `Circuit branch ${entry.branch_id} ${childOutcome}.`,
            'detail',
            childOutcome === 'complete' ? 'success' : 'error',
          ),
          step_id: stepId as StepId,
          step_title: title,
          branch_id: entry.branch_id,
          branch_kind: branchKind,
          ...(entry.child_run_id === undefined
            ? {}
            : { child_run_id: entry.child_run_id as ProgressRunId }),
          child_outcome: childOutcome,
          verdict: entry.verdict,
          duration_ms: entry.duration_ms,
        });
        break;
      }
      case 'fanout.joined': {
        const stepId = entry.step_id;
        const policy = fanoutPolicy(entry.policy);
        if (
          stepId === undefined ||
          policy === undefined ||
          entry.aggregate_path === undefined ||
          entry.branches_completed === undefined ||
          entry.branches_failed === undefined
        ) {
          break;
        }
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'fanout.joined',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Joined ${title}`,
          display: progressDisplay(`Circuit joined ${title}.`, 'major', 'success'),
          step_id: stepId as StepId,
          step_title: title,
          policy,
          aggregate_path: entry.aggregate_path,
          branches_completed: entry.branches_completed,
          branches_failed: entry.branches_failed,
          ...(entry.selected_branch_id === undefined
            ? {}
            : { selected_branch_id: entry.selected_branch_id }),
        });
        break;
      }
      case 'checkpoint.requested': {
        const stepId = entry.step_id;
        const allowedChoices = stringArray(entry.allowed_choices);
        if (
          stepId === undefined ||
          entry.request_path === undefined ||
          allowedChoices === undefined
        ) {
          break;
        }
        if (entry.auto_resolved === true) {
          break;
        }
        const requestPath = checkpointRequestPath(input.runDir, entry.request_path);
        taskStatuses.set(stepId, 'in_progress');
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        const checkpointPromptText = checkpointPrompt(entry);
        const presentation = tournamentCheckpointPresentationV2({
          runDir: input.runDir,
          allowedChoices,
          fallbackPrompt: checkpointPromptText,
          fallbackLabel: checkpointChoiceLabel,
          fallbackDescription: (choice) => `Resume with '${choice}'.`,
        });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'checkpoint.waiting',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Waiting for checkpoint ${stepId}`,
          display: progressDisplay(
            `Circuit is waiting for a checkpoint choice: ${presentation.choices
              .map((choice) => choice.label)
              .join(', ')}.`,
            'major',
            'checkpoint',
          ),
          step_id: stepId as StepId,
          request_path: requestPath,
          allowed_choices: allowedChoices,
        });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'user_input.requested',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: 'Checkpoint choice requested',
          display: progressDisplay(presentation.prompt, 'major', 'checkpoint'),
          checkpoint: {
            step_id: stepId as StepId,
            request_path: requestPath,
            allowed_choices: allowedChoices,
          },
          questions: [
            {
              id: 'checkpoint-choice',
              header: 'Choice',
              question: presentation.prompt,
              options: presentation.choices.map((choice) => ({
                label: choice.label,
                description: choice.description,
                checkpoint_choice: choice.id,
              })),
              allow_free_text: false,
            },
          ],
          resume: {
            run_folder: input.runDir,
            checkpoint_choice_arg: '<choice>',
            command: `circuit-next resume --run-folder ${input.runDir} --checkpoint-choice <choice>`,
          },
        });
        reportTaskListProgressV2({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} waiting`,
          displayText: `Circuit is waiting on ${title}.`,
          tone: 'checkpoint',
        });
        break;
      }
      case 'step.completed': {
        const stepId = entry.step_id;
        if (
          stepId === undefined ||
          entry.attempt === undefined ||
          entry.route_taken === undefined
        ) {
          break;
        }
        taskStatuses.set(stepId, 'completed');
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'step.completed',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Completed ${title}`,
          display: progressDisplay(`Circuit completed ${title}.`, 'detail', 'success'),
          step_id: stepId as StepId,
          step_title: title,
          attempt: entry.attempt,
          route_taken: entry.route_taken,
        });
        reportTaskListProgressV2({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} completed`,
          displayText: `Circuit finished ${title}.`,
          tone: 'success',
        });
        break;
      }
      case 'step.aborted': {
        const stepId = entry.step_id;
        if (stepId === undefined || entry.attempt === undefined || entry.reason === undefined) {
          break;
        }
        taskStatuses.set(stepId, 'failed');
        const title = stepTitle({ flow: input.flow, compiledFlow: input.compiledFlow, stepId });
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'step.aborted',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Aborted ${title}`,
          display: progressDisplay(`Circuit aborted ${title}: ${entry.reason}`, 'major', 'error'),
          step_id: stepId as StepId,
          step_title: title,
          attempt: entry.attempt,
          reason: entry.reason,
        });
        reportTaskListProgressV2({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} failed`,
          displayText: `Circuit marked ${title} as failed.`,
          tone: 'error',
        });
        break;
      }
      case 'run.closed': {
        const outcome = runOutcome(entry);
        if (outcome === 'aborted') {
          const reason = runReason(entry);
          reportProgress(input.progress, {
            schema_version: 1,
            type: 'run.aborted',
            run_id: runId,
            flow_id: flowId,
            recorded_at: recordedAt,
            label: 'Circuit run aborted',
            display: progressDisplay(
              reason === undefined ? 'Circuit run aborted.' : `Circuit run aborted: ${reason}`,
              'major',
              'error',
            ),
            outcome,
            result_path: runResultPath(input.runDir),
            ...(reason === undefined ? {} : { reason }),
          });
        } else {
          reportProgress(input.progress, {
            schema_version: 1,
            type: 'run.completed',
            run_id: runId,
            flow_id: flowId,
            recorded_at: recordedAt,
            label: `Circuit run ${outcome}`,
            display: progressDisplay(`Circuit run ${outcome}.`, 'major', 'success'),
            outcome,
            result_path: runResultPath(input.runDir),
          });
        }
        break;
      }
      default:
        break;
    }
  };
}
