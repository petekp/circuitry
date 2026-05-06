import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type { Depth } from '../../schemas/depth.js';
import { sha256Hex } from '../connectors/shared.js';
import { findCheckpointBriefBuilder } from '../registries/checkpoint-writers/registry.js';
import {
  type CheckpointStep,
  checkpointChoiceIds,
} from '../registries/checkpoint-writers/types.js';
import { resolveRunRelative } from '../run-relative-path.js';
import { writeDerivedSnapshot } from '../snapshot-writer.js';
import { isRunRelativePathError, writeJsonReport } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

export type { CheckpointStep };
export { checkpointChoiceIds };

type CheckpointResolution =
  | {
      readonly kind: 'resolved';
      readonly selection: string;
      readonly resolutionSource: 'safe-default' | 'safe-autonomous' | 'operator';
      readonly autoResolved: boolean;
    }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'failed'; readonly reason: string };

function resolveCheckpoint(step: CheckpointStep, depth: Depth): CheckpointResolution {
  if (depth === 'deep' || depth === 'tournament') return { kind: 'waiting' };
  if (depth === 'autonomous') {
    const selection = step.policy.safe_autonomous_choice;
    if (selection === undefined) {
      return {
        kind: 'failed',
        reason: `checkpoint step '${step.id}' cannot auto-resolve autonomous depth without a declared safe autonomous choice`,
      };
    }
    return {
      kind: 'resolved',
      selection,
      resolutionSource: 'safe-autonomous',
      autoResolved: true,
    };
  }
  const selection = step.policy.safe_default_choice;
  if (selection === undefined) {
    return {
      kind: 'failed',
      reason: `checkpoint step '${step.id}' cannot resolve ${depth} depth without a declared safe default choice`,
    };
  }
  return {
    kind: 'resolved',
    selection,
    resolutionSource: 'safe-default',
    autoResolved: true,
  };
}

export function checkpointRequestBody(input: {
  readonly step: CheckpointStep;
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly checkpointReportSha256?: string;
}): unknown {
  return {
    schema_version: 1,
    step_id: input.step.id,
    prompt: input.step.policy.prompt,
    allowed_choices: checkpointChoiceIds(input.step),
    ...(input.step.policy.safe_default_choice === undefined
      ? {}
      : { safe_default_choice: input.step.policy.safe_default_choice }),
    ...(input.step.policy.safe_autonomous_choice === undefined
      ? {}
      : { safe_autonomous_choice: input.step.policy.safe_autonomous_choice }),
    execution_context: {
      ...(input.projectRoot === undefined ? {} : { project_root: input.projectRoot }),
      selection_config_layers: input.selectionConfigLayers,
      ...(input.checkpointReportSha256 === undefined
        ? {}
        : { checkpoint_report_sha256: input.checkpointReportSha256 }),
    },
  };
}

function checkpointResponseBody(input: {
  readonly step: CheckpointStep;
  readonly selection: string;
  readonly resolutionSource: 'safe-default' | 'safe-autonomous' | 'operator';
}): unknown {
  return {
    schema_version: 1,
    step_id: input.step.id,
    selection: input.selection,
    resolution_source: input.resolutionSource,
  };
}

function checkpointFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `checkpoint step '${stepId}': checkpoint handling failed (${message})`;
}

// Checkpoint report writer. Most checkpoints don't write reports;
// when they do, a registered CheckpointBriefBuilder owns the flow-
// specific assembly. Adding a new flow's checkpoint-with-report
// means adding a builder under src/flows/registries/checkpoint-writers/.
//
// The brief is written exactly once per checkpoint instance, with the
// brief.checkpoint.response_path already pointing at step.writes.response.
// No re-stamp happens after operator resolution, so the on-disk hash
// captured in the request stays valid through the entire resolution
// path — eliminating the crash window between a stamped-brief write and
// the checkpoint.resolved trace_entry.
function writeCheckpointOwnedReport(input: {
  readonly runFolder: string;
  readonly step: CheckpointStep;
  readonly goal: string;
}): void {
  const report = input.step.writes.report;
  if (report === undefined) return;
  const builder = findCheckpointBriefBuilder(report.schema);
  if (builder === undefined) {
    throw new Error(`checkpoint step '${input.step.id}' has unsupported report schema`);
  }
  const body = builder.build({
    runFolder: input.runFolder,
    step: input.step,
    goal: input.goal,
    responsePath: input.step.writes.response,
  });
  writeJsonReport(input.runFolder, report.path, body);
}

export function runCheckpointStep(
  ctx: StepHandlerContext & { readonly step: CheckpointStep },
): StepHandlerResult {
  const {
    runFolder,
    step,
    goal,
    runId,
    depth,
    attempt,
    recordedAt,
    push,
    state,
    isResumedCheckpoint,
    resumeCheckpoint,
    projectRoot,
    executionSelectionConfigLayers,
  } = ctx;

  try {
    const requestAbs = resolveRunRelative(runFolder, step.writes.request);
    if (!isResumedCheckpoint) {
      writeCheckpointOwnedReport({ runFolder, step, goal });
      const checkpointReportSha256 =
        step.writes.report !== undefined &&
        findCheckpointBriefBuilder(step.writes.report.schema) !== undefined
          ? sha256Hex(readFileSync(resolveRunRelative(runFolder, step.writes.report.path), 'utf8'))
          : undefined;
      const requestText = `${JSON.stringify(
        checkpointRequestBody({
          step,
          ...(projectRoot === undefined ? {} : { projectRoot }),
          selectionConfigLayers: executionSelectionConfigLayers,
          ...(checkpointReportSha256 === undefined ? {} : { checkpointReportSha256 }),
        }),
        null,
        2,
      )}\n`;
      mkdirSync(dirname(requestAbs), { recursive: true });
      writeFileSync(requestAbs, requestText);
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'checkpoint.requested',
        step_id: step.id,
        attempt,
        options: checkpointChoiceIds(step),
        request_path: step.writes.request,
        request_report_hash: sha256Hex(requestText),
      });
      if (step.writes.report !== undefined) {
        push({
          schema_version: 1,
          sequence: state.sequence,
          recorded_at: recordedAt(),
          run_id: runId,
          kind: 'step.report_written',
          step_id: step.id,
          attempt,
          report_path: step.writes.report.path,
          report_schema: step.writes.report.schema,
        });
      }
    }

    const resolution: CheckpointResolution =
      isResumedCheckpoint && resumeCheckpoint !== undefined
        ? {
            kind: 'resolved',
            selection: resumeCheckpoint.selection,
            resolutionSource: 'operator',
            autoResolved: false,
          }
        : resolveCheckpoint(step, depth);

    if (resolution.kind === 'waiting') {
      // Snapshot is derived for the waiting result; coordinator owns the
      // CheckpointWaitingResult assembly. Re-deriving here so the
      // snapshot file on disk reflects the most recent trace_entries.
      writeDerivedSnapshot(runFolder);
      return {
        kind: 'waiting_checkpoint',
        checkpoint: {
          stepId: step.id as unknown as string,
          requestPath: requestAbs,
          allowedChoices: checkpointChoiceIds(step),
        },
      };
    }

    if (resolution.kind === 'failed') {
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'check.evaluated',
        step_id: step.id,
        attempt,
        check_kind: 'checkpoint_selection',
        outcome: 'fail',
        reason: resolution.reason,
      });
      push({
        schema_version: 1,
        sequence: state.sequence,
        recorded_at: recordedAt(),
        run_id: runId,
        kind: 'step.aborted',
        step_id: step.id,
        attempt,
        reason: resolution.reason,
      });
      return { kind: 'aborted', reason: resolution.reason };
    }

    if (!step.check.allow.includes(resolution.selection)) {
      throw new Error(
        `checkpoint step '${step.id}' selected '${resolution.selection}' but check.allow is [${step.check.allow.join(', ')}]`,
      );
    }
    writeJsonReport(
      runFolder,
      step.writes.response,
      checkpointResponseBody({
        step,
        selection: resolution.selection,
        resolutionSource: resolution.resolutionSource,
      }),
    );
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'checkpoint.resolved',
      step_id: step.id,
      attempt,
      selection: resolution.selection,
      auto_resolved: resolution.autoResolved,
      resolution_source: resolution.resolutionSource,
      response_path: step.writes.response,
    });
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'checkpoint_selection',
      outcome: 'pass',
    });
    return {
      kind: 'advance',
      ...(Object.hasOwn(step.routes, resolution.selection) ? { route: resolution.selection } : {}),
    };
  } catch (err) {
    if (isRunRelativePathError(err)) throw err;
    const reason = checkpointFailureReason(step.id as unknown as string, err);
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'checkpoint_selection',
      outcome: 'fail',
      reason,
    });
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
    return { kind: 'aborted', reason };
  }
}
