import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import {
  BUILTIN_CONNECTOR_CAPABILITIES,
  type FilesystemCapability,
  type ResolvedConnector,
} from '../../schemas/connector.js';
import type { CompiledFlowId, RunId as ProgressRunId, StepId } from '../../schemas/ids.js';
import type {
  ProgressPresentation,
  ProgressTask,
  ProgressTaskStatus,
} from '../../schemas/progress-event.js';
import {
  progressDisplay,
  progressPresentation,
  reportProgress,
} from '../../shared/progress-output.js';
import type { ProgressReporter } from '../../shared/relay-runtime-types.js';
import { runResultPath } from '../../shared/result-path.js';
import {
  WRITE_CAPABLE_WORKER_DISCLOSURE,
  compiledFlowMayInvokeWriteCapableWorker,
  flowMayInvokeWriteCapableWorker,
} from '../../shared/write-capable-worker-disclosure.js';
import type { TraceEntry } from '../domain/trace.js';
import type { ExecutableFlow } from '../manifest/executable-flow.js';
import { tournamentCheckpointPresentation } from './tournament-checkpoint-context.js';

function connectorFilesystemCapability(connector: ResolvedConnector): FilesystemCapability {
  return connector.kind === 'builtin'
    ? BUILTIN_CONNECTOR_CAPABILITIES[connector.name].filesystem
    : connector.capabilities.filesystem;
}

function connectorFromTrace(entry: TraceEntry): ResolvedConnector | undefined {
  const connector = entry.connector;
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

function relayRoleFromTrace(entry: TraceEntry): 'reviewer' | 'implementer' | undefined {
  const role = entry.role;
  return role === 'reviewer' || role === 'implementer' ? role : undefined;
}

function stepTitle(input: {
  readonly flow: ExecutableFlow;
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

function flowLabel(flowId: string): string {
  return flowId
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function stepLead(title: string): string {
  return title.split('—')[0]?.trim().toLowerCase() ?? title.toLowerCase();
}

function operatorStepTitle(flowId: string, title: string): string {
  const lead = stepLead(title);
  if (lead.startsWith('frame') || lead.startsWith('intake')) return 'Frame the work';
  if (lead.startsWith('analyze') || lead.startsWith('inventory')) return 'Check the context';
  if (lead.startsWith('synthesize') || lead.startsWith('compose')) {
    return flowId === 'explore' ? 'Draft the recommendation' : 'Draft the result';
  }
  if (lead.startsWith('review') || lead.startsWith('independent') || lead.startsWith('release')) {
    return flowId === 'explore' ? 'Check the recommendation' : 'Check the result';
  }
  if (lead.startsWith('close')) return 'Wrap up';
  if (lead.startsWith('verify')) return 'Check the work';
  if (lead.startsWith('plan') || lead.startsWith('coexistence')) return 'Plan the work';
  if (lead.startsWith('act') || lead.startsWith('batch') || lead.startsWith('execute')) {
    return 'Make the change';
  }
  return title.replace(/\s+—\s+.+$/, '').replace(/\s+\(.+\)$/, '');
}

function operatorStepAction(flowId: string, title: string): string {
  const lead = stepLead(title);
  if (lead.startsWith('frame') || lead.startsWith('intake')) return 'Framing the work';
  if (lead.startsWith('analyze') || lead.startsWith('inventory')) return 'Checking the context';
  if (lead.startsWith('synthesize') || lead.startsWith('compose')) {
    return flowId === 'explore' ? 'Drafting the recommendation' : 'Drafting the result';
  }
  if (lead.startsWith('review') || lead.startsWith('independent') || lead.startsWith('release')) {
    return flowId === 'explore' ? 'Checking the recommendation' : 'Checking the result';
  }
  if (lead.startsWith('close')) return 'Wrapping up';
  if (lead.startsWith('verify')) return 'Checking the work';
  if (lead.startsWith('plan') || lead.startsWith('coexistence')) return 'Planning the work';
  if (lead.startsWith('act') || lead.startsWith('batch') || lead.startsWith('execute')) {
    return 'Making the change';
  }
  return `Working on ${operatorStepTitle(flowId, title).toLowerCase()}`;
}

function relayStartedStatusText(flowId: string, role: 'reviewer' | 'implementer'): string {
  if (role === 'reviewer') {
    return flowId === 'explore'
      ? 'Asking the reviewer to check the recommendation...'
      : 'Asking the reviewer to check the result...';
  }
  return flowId === 'explore'
    ? 'Asking the specialist to draft the recommendation...'
    : 'Asking the specialist to make the change...';
}

function relayCompletedStatusText(flowId: string, role: 'reviewer' | 'implementer'): string {
  if (role === 'reviewer') {
    return flowId === 'explore'
      ? 'Finished checking the recommendation.'
      : 'Finished checking the result.';
  }
  return flowId === 'explore'
    ? 'Finished drafting the recommendation.'
    : 'Finished the specialist pass.';
}

function relayRoleFromStepTitle(title: string): 'reviewer' | 'implementer' {
  const lead = stepLead(title);
  return lead.startsWith('review') || lead.startsWith('independent') || lead.startsWith('release')
    ? 'reviewer'
    : 'implementer';
}

function circuitDisplayText(statusText: string): string {
  return `Circuit: ${statusText}`;
}

function appendStatus(blockId: ProgressRunId, statusText: string): ProgressPresentation {
  return progressPresentation({ blockId, lineMode: 'append', statusText });
}

function replaceStatus(
  blockId: ProgressRunId,
  slotId: string,
  statusText: string,
): ProgressPresentation {
  return progressPresentation({
    blockId,
    lineMode: 'replace_slot',
    slotId,
    statusText,
  });
}

function suppressStatus(blockId: ProgressRunId): ProgressPresentation {
  return progressPresentation({ blockId, lineMode: 'suppress' });
}

function progressTasks(
  flow: ExecutableFlow,
  statuses: ReadonlyMap<string, ProgressTaskStatus>,
): ProgressTask[] {
  return flow.steps.map((step) => ({
    id: step.id,
    title: operatorStepTitle(flow.id, step.title ?? step.id),
    status: statuses.get(step.id) ?? 'pending',
  }));
}

function reportTaskListProgress(input: {
  readonly progress: ProgressReporter | undefined;
  readonly runId: ProgressRunId;
  readonly flowId: CompiledFlowId;
  readonly flow: ExecutableFlow;
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
    presentation: suppressStatus(input.runId),
    tasks: progressTasks(input.flow, input.statuses),
  });
}

function readJsonReport(runDir: string, reportPath: string): unknown {
  return JSON.parse(readFileSync(join(runDir, reportPath), 'utf8')) as unknown;
}

function warningRecordsFromReport(body: unknown): Array<{
  readonly kind: string;
  readonly message: string;
  readonly path?: string;
}> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return [];
  const raw = (body as Record<string, unknown>).evidence_warnings;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.kind !== 'string' || typeof record.message !== 'string') return [];
    return [
      {
        kind: record.kind,
        message: record.message,
        ...(typeof record.path === 'string' ? { path: record.path } : {}),
      },
    ];
  });
}

function reportEvidenceProgress(input: {
  readonly progress: ProgressReporter | undefined;
  readonly runDir: string;
  readonly flowId: CompiledFlowId;
  readonly runId: ProgressRunId;
  readonly recordedAt: string;
  readonly traceEntry: TraceEntry;
}): void {
  if (
    input.traceEntry.step_id === undefined ||
    input.traceEntry.report_path === undefined ||
    input.traceEntry.report_schema === undefined
  ) {
    return;
  }
  let body: unknown;
  try {
    body = readJsonReport(input.runDir, input.traceEntry.report_path);
  } catch {
    return;
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return;
  const record = body as Record<string, unknown>;
  const hasEvidence = Object.hasOwn(record, 'evidence');
  const warnings = warningRecordsFromReport(record);
  if (!hasEvidence && warnings.length === 0) return;

  reportProgress(input.progress, {
    schema_version: 1,
    type: 'evidence.collected',
    run_id: input.runId,
    flow_id: input.flowId,
    recorded_at: input.recordedAt,
    label: warnings.length > 0 ? 'Collected evidence with warnings' : 'Collected evidence',
    display: progressDisplay(
      warnings.length > 0
        ? `Circuit: Collected evidence with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`
        : 'Circuit: Collected evidence.',
      'major',
      warnings.length > 0 ? 'warning' : 'info',
    ),
    presentation:
      warnings.length > 0
        ? appendStatus(
            input.runId,
            `Collected evidence with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
          )
        : suppressStatus(input.runId),
    step_id: input.traceEntry.step_id as StepId,
    report_path: input.traceEntry.report_path,
    report_schema: input.traceEntry.report_schema,
    warning_count: warnings.length,
  });
  for (const warning of warnings) {
    reportProgress(input.progress, {
      schema_version: 1,
      type: 'evidence.warning',
      run_id: input.runId,
      flow_id: input.flowId,
      recorded_at: input.recordedAt,
      label: 'Evidence warning',
      display: progressDisplay(`Circuit: Evidence warning: ${warning.message}`, 'major', 'warning'),
      presentation: appendStatus(input.runId, `Evidence warning: ${warning.message}`),
      step_id: input.traceEntry.step_id as StepId,
      report_path: input.traceEntry.report_path,
      warning_kind: warning.kind,
      message: warning.message,
      ...(warning.path === undefined ? {} : { path: warning.path }),
    });
  }
}

function runOutcome(
  entry: TraceEntry,
): 'complete' | 'stopped' | 'handoff' | 'escalated' | 'aborted' {
  const outcome = entry.outcome;
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

function runReason(entry: TraceEntry): string | undefined {
  const reason = entry.reason;
  return typeof reason === 'string' && reason.length > 0 ? reason : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((entry): entry is string => typeof entry === 'string');
  return entries.length === value.length && entries.length > 0 ? entries : undefined;
}

function checkpointPrompt(requestPath: string): string {
  try {
    const raw = JSON.parse(readFileSync(requestPath, 'utf8')) as unknown;
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const prompt = (raw as Record<string, unknown>).prompt;
      if (typeof prompt === 'string' && prompt.length > 0) return prompt;
    }
  } catch {
    // A damaged request file should not block progress projection.
  }
  return 'Choose how to continue this checkpoint.';
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
  flow: ExecutableFlow,
  compiledFlow: CompiledFlow | undefined,
): boolean {
  if (compiledFlow !== undefined) return compiledFlowMayInvokeWriteCapableWorker(compiledFlow);
  return (
    flowMayInvokeWriteCapableWorker(flow.id) ||
    flow.steps.some((step) => step.kind === 'relay' && step.role === 'implementer')
  );
}

export function createProgressProjector(input: {
  readonly progress: ProgressReporter | undefined;
  readonly runDir: string;
  readonly runId: string;
  readonly flow: ExecutableFlow;
  readonly compiledFlow?: CompiledFlow;
}): (entry: TraceEntry) => void {
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
        const startedText = `Circuit: Started ${flowLabel(input.flow.id)}.`;
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
          presentation: shouldWarn
            ? appendStatus(runId, WRITE_CAPABLE_WORKER_DISCLOSURE)
            : suppressStatus(runId),
          run_folder: input.runDir,
        });
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: 'Flow checklist initialized',
          displayText: 'Circuit: Prepared the flow checklist.',
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
          display: progressDisplay(
            `Circuit: ${operatorStepAction(input.flow.id, title)}...`,
            'major',
            'info',
          ),
          presentation: appendStatus(runId, `${operatorStepAction(input.flow.id, title)}...`),
          step_id: stepId as StepId,
          step_title: title,
          attempt: entry.attempt,
        });
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} in progress`,
          displayText: `Circuit: ${operatorStepAction(input.flow.id, title)}...`,
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
        const statusText = relayStartedStatusText(input.flow.id, role);
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'relay.started',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Running ${role} relay with ${connector.name}`,
          display: progressDisplay(circuitDisplayText(statusText), 'major', 'info'),
          presentation: replaceStatus(runId, `${stepId}:relay`, statusText),
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
        const role = relayRoleFromTrace(entry) ?? relayRoleFromStepTitle(title);
        const statusText = relayCompletedStatusText(input.flow.id, role);
        reportProgress(input.progress, {
          schema_version: 1,
          type: 'relay.completed',
          run_id: runId,
          flow_id: flowId,
          recorded_at: recordedAt,
          label: `Relay completed with ${entry.verdict}`,
          display: progressDisplay(circuitDisplayText(statusText), 'major', 'success'),
          presentation: replaceStatus(runId, `${stepId}:relay`, statusText),
          step_id: stepId as StepId,
          step_title: title,
          attempt: activeAttempts.get(stepId) ?? entry.attempt ?? 1,
          verdict: entry.verdict,
          duration_ms: entry.duration_ms,
        });
        break;
      }
      case 'step.report_written': {
        reportEvidenceProgress({
          progress: input.progress,
          runDir: input.runDir,
          flowId,
          runId,
          recordedAt,
          traceEntry: entry,
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
            `Circuit: Comparing ${branchIds.length} option${branchIds.length === 1 ? '' : 's'}...`,
            'major',
            'info',
          ),
          presentation: replaceStatus(
            runId,
            `${stepId}:fanout`,
            `Comparing ${branchIds.length} option${branchIds.length === 1 ? '' : 's'}...`,
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
        const branchKind = fanoutBranchKind(entry.branch_kind);
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
          display: progressDisplay(`Circuit: Started branch ${entry.branch_id}.`, 'detail', 'info'),
          presentation: suppressStatus(runId),
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
        const branchKind = fanoutBranchKind(entry.branch_kind);
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
            `Circuit: Branch ${entry.branch_id} ${childOutcome}.`,
            'detail',
            childOutcome === 'complete' ? 'success' : 'error',
          ),
          presentation: suppressStatus(runId),
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
          display: progressDisplay('Circuit: Finished comparing the options.', 'major', 'success'),
          presentation: replaceStatus(runId, `${stepId}:fanout`, 'Finished comparing the options.'),
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
        const allowedChoices = stringArray(entry.options);
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
        const checkpointPromptText = checkpointPrompt(requestPath);
        const presentation = tournamentCheckpointPresentation({
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
            `Circuit: Waiting for a checkpoint choice: ${presentation.choices
              .map((choice) => choice.label)
              .join(', ')}...`,
            'major',
            'checkpoint',
          ),
          presentation: appendStatus(runId, 'Waiting for your choice...'),
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
          presentation: suppressStatus(runId),
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
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} waiting`,
          displayText: 'Circuit: Waiting for your choice...',
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
          display: progressDisplay(
            `Finished ${operatorStepAction(input.flow.id, title).toLowerCase()}.`,
            'detail',
            'success',
          ),
          presentation: suppressStatus(runId),
          step_id: stepId as StepId,
          step_title: title,
          attempt: entry.attempt,
          route_taken: entry.route_taken,
        });
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} completed`,
          displayText: `Finished ${operatorStepAction(input.flow.id, title).toLowerCase()}.`,
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
          display: progressDisplay(`Circuit: Aborted ${title}: ${entry.reason}`, 'major', 'error'),
          presentation: appendStatus(
            runId,
            `Marked ${operatorStepTitle(input.flow.id, title)} as failed.`,
          ),
          step_id: stepId as StepId,
          step_title: title,
          attempt: entry.attempt,
          reason: entry.reason,
        });
        reportTaskListProgress({
          progress: input.progress,
          runId,
          flowId,
          flow: input.flow,
          recordedAt,
          statuses: taskStatuses,
          label: `${title} failed`,
          displayText: `Circuit: Marked ${title} as failed.`,
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
              reason === undefined ? 'Circuit: Run aborted.' : `Circuit: Run aborted: ${reason}`,
              'major',
              'error',
            ),
            presentation: appendStatus(
              runId,
              reason === undefined ? 'Run aborted.' : `Run aborted: ${reason}`,
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
            display: progressDisplay(
              `Circuit: Finished ${flowLabel(input.flow.id)}.`,
              'major',
              'success',
            ),
            presentation: appendStatus(runId, `Finished ${flowLabel(input.flow.id)}.`),
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
