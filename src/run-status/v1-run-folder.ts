import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { reduceRetainedRunTrace } from '../compat/retained-checkpoint-folders.js';
import { findCheckpointBriefBuilder } from '../flows/registries/checkpoint-writers/registry.js';
import type { CompiledFlow } from '../schemas/compiled-flow.js';
import { LayeredConfig } from '../schemas/config.js';
import { RunStatusProjectionV1 } from '../schemas/run-status.js';
import type { RunTrace } from '../schemas/run.js';
import type { Snapshot } from '../schemas/snapshot.js';
import type { TraceEntry } from '../schemas/trace-entry.js';
import { sha256Hex } from '../shared/connector-relay.js';
import type { verifyManifestSnapshotBytes } from '../shared/manifest-snapshot.js';
import { resolveRunRelative } from '../shared/run-relative-path.js';
import {
  type BootstrapTraceEntry,
  errorMessage,
  invalidProjection,
  optionalReportPaths,
  readSavedFlowForProjection,
  stepMetadata,
} from './projection-common.js';

const CheckpointRequestProjection = z
  .object({
    schema_version: z.literal(1),
    step_id: z.string().min(1),
    prompt: z.string().min(1).optional(),
    allowed_choices: z.array(z.string().min(1)).min(1),
    execution_context: z
      .object({
        project_root: z.string().optional(),
        selection_config_layers: z.array(z.unknown()).optional(),
        checkpoint_report_sha256: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

type CheckpointRequestProjection = z.infer<typeof CheckpointRequestProjection>;
type CheckpointRequestedTraceEntry = Extract<TraceEntry, { kind: 'checkpoint.requested' }>;
type CheckpointStep = CompiledFlow['steps'][number] & { readonly kind: 'checkpoint' };

function lastEvent(log: RunTrace): {
  readonly sequence: number;
  readonly type: string;
  readonly timestamp: string;
} {
  const entry = log[log.length - 1];
  if (entry === undefined) {
    throw new Error('validated RunTrace unexpectedly had no final trace_entry');
  }
  return {
    sequence: entry.sequence,
    type: entry.kind,
    timestamp: entry.recorded_at,
  };
}

function currentStepProjection(
  snapshot: Snapshot,
  log: RunTrace,
  flow: CompiledFlow | undefined,
):
  | {
      readonly step_id: string;
      readonly attempt?: number;
      readonly stage_id?: string;
      readonly label?: string;
    }
  | undefined {
  if (snapshot.current_step === undefined) return undefined;
  const stepId = snapshot.current_step as unknown as string;
  const attempt = latestAttemptForStep(log, stepId);
  return {
    step_id: stepId,
    ...(attempt === undefined ? {} : { attempt }),
    ...stepMetadata(flow, stepId),
  };
}

function latestAttemptForStep(log: RunTrace, stepId: string): number | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry === undefined || !('step_id' in entry) || !('attempt' in entry)) continue;
    if ((entry.step_id as unknown as string) !== stepId) continue;
    return entry.attempt;
  }
  return undefined;
}

function findNewestUnresolvedCheckpoint(log: RunTrace): CheckpointRequestedTraceEntry | undefined {
  const resolved = new Set<string>();
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry === undefined) continue;
    if (entry.kind === 'checkpoint.resolved') {
      resolved.add(`${entry.step_id as unknown as string}:${entry.attempt}`);
      continue;
    }
    if (entry.kind !== 'checkpoint.requested') continue;
    const key = `${entry.step_id as unknown as string}:${entry.attempt}`;
    if (!resolved.has(key)) return entry;
  }
  return undefined;
}

function arrayEquals(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function checkpointInvalid(
  runFolder: string,
  bootstrap: BootstrapTraceEntry,
  code: string,
  message: string,
): RunStatusProjectionV1 {
  return invalidProjection({
    runFolder,
    reason: 'checkpoint_invalid',
    code,
    message,
    bootstrap,
  });
}

function validateCheckpointRequest(input: {
  readonly runFolder: string;
  readonly bootstrap: BootstrapTraceEntry;
  readonly snapshot: Snapshot;
  readonly flow: CompiledFlow | undefined;
  readonly requested: CheckpointRequestedTraceEntry;
}):
  | {
      readonly ok: true;
      readonly checkpoint: {
        readonly checkpoint_id: string;
        readonly step_id: string;
        readonly attempt: number;
        readonly prompt?: string;
        readonly choices: readonly {
          readonly id: string;
          readonly label: string;
          readonly value: string;
        }[];
        readonly request_path?: string;
      };
    }
  | { readonly ok: false; readonly projection: RunStatusProjectionV1 } {
  const stepId = input.requested.step_id as unknown as string;
  if (input.snapshot.current_step === undefined) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_snapshot_missing_current_step',
        `checkpoint '${stepId}' is waiting but the derived snapshot has no current step`,
      ),
    };
  }
  if ((input.snapshot.current_step as unknown as string) !== stepId) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_snapshot_mismatch',
        `checkpoint '${stepId}' is waiting but the derived snapshot current step is '${input.snapshot.current_step as unknown as string}'`,
      ),
    };
  }
  if (input.flow === undefined) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_flow_unreadable',
        `checkpoint '${stepId}' cannot be resumed because the saved flow manifest bytes cannot be parsed`,
      ),
    };
  }

  const step = input.flow.steps.find(
    (candidate): candidate is CheckpointStep =>
      (candidate.id as unknown as string) === stepId && candidate.kind === 'checkpoint',
  );
  if (step === undefined) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_step_missing',
        `checkpoint '${stepId}' is not a checkpoint step in the saved flow`,
      ),
    };
  }

  let requestAbs: string;
  let requestText: string;
  let request: CheckpointRequestProjection;
  try {
    if (input.requested.request_path !== step.writes.request) {
      throw new Error(
        `checkpoint request path '${input.requested.request_path}' differs from saved flow path '${step.writes.request}'`,
      );
    }
    requestAbs = resolveRunRelative(input.runFolder, step.writes.request);
    requestText = readFileSync(requestAbs, 'utf8');
    const observedHash = sha256Hex(requestText);
    if (observedHash !== input.requested.request_report_hash) {
      throw new Error('checkpoint request hash differs from trace');
    }
    request = CheckpointRequestProjection.parse(JSON.parse(requestText));
  } catch (err) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_request_invalid',
        `checkpoint '${stepId}' request file is missing or corrupt (${errorMessage(err)})`,
      ),
    };
  }

  if (request.step_id !== stepId) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_request_stale',
        `checkpoint '${stepId}' request file belongs to '${request.step_id}'`,
      ),
    };
  }
  if (!arrayEquals(request.allowed_choices, input.requested.options)) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_choices_mismatch',
        `checkpoint '${stepId}' request choices differ from trace choices`,
      ),
    };
  }
  try {
    LayeredConfig.array().parse(request.execution_context.selection_config_layers ?? []);
  } catch (err) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_context_invalid',
        `checkpoint '${stepId}' execution context is invalid (${errorMessage(err)})`,
      ),
    };
  }

  const disallowedChoice = request.allowed_choices.find(
    (choice) => !step.check.allow.includes(choice),
  );
  if (disallowedChoice !== undefined) {
    return {
      ok: false,
      projection: checkpointInvalid(
        input.runFolder,
        input.bootstrap,
        'checkpoint_choice_not_allowed',
        `checkpoint '${stepId}' choice '${disallowedChoice}' is not allowed by the saved flow`,
      ),
    };
  }

  const report = step.writes.report;
  const reportHash = request.execution_context.checkpoint_report_sha256;
  if (report !== undefined && reportHash !== undefined) {
    const builder = findCheckpointBriefBuilder(report.schema);
    if (builder?.validateResumeContext === undefined) {
      return {
        ok: false,
        projection: checkpointInvalid(
          input.runFolder,
          input.bootstrap,
          'checkpoint_report_validator_missing',
          `checkpoint '${stepId}' report '${report.schema}' has no resume validator`,
        ),
      };
    }
    try {
      builder.validateResumeContext({
        runFolder: input.runFolder,
        step,
        reportPath: report.path,
        reportSha256: reportHash,
      });
    } catch (err) {
      return {
        ok: false,
        projection: checkpointInvalid(
          input.runFolder,
          input.bootstrap,
          'checkpoint_report_invalid',
          `checkpoint '${stepId}' report is missing or corrupt (${errorMessage(err)})`,
        ),
      };
    }
  }

  const labels = new Map(
    step.policy.choices.map((choice) => [choice.id, choice.label ?? choice.id] as const),
  );
  return {
    ok: true,
    checkpoint: {
      checkpoint_id: `${stepId}:${input.requested.attempt}`,
      step_id: stepId,
      attempt: input.requested.attempt,
      ...(request.prompt === undefined ? {} : { prompt: request.prompt }),
      choices: request.allowed_choices.map((choice) => ({
        id: choice,
        label: labels.get(choice) ?? choice,
        value: choice,
      })),
      request_path: requestAbs,
    },
  };
}

export function projectV1RunStatusFromTrace(input: {
  readonly runFolder: string;
  readonly manifest: ReturnType<typeof verifyManifestSnapshotBytes>;
  readonly log: RunTrace;
}): RunStatusProjectionV1 {
  const bootstrap = input.log[0];
  if (bootstrap === undefined || bootstrap.kind !== 'run.bootstrapped') {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: 'trace_invalid',
      code: 'trace_bootstrap_missing',
      message: 'trace is missing its run.bootstrapped entry',
      manifestIdentity: {
        run_id: input.manifest.run_id as unknown as string,
        flow_id: input.manifest.flow_id as unknown as string,
      },
    });
  }

  if (
    bootstrap.run_id !== input.manifest.run_id ||
    bootstrap.flow_id !== input.manifest.flow_id ||
    bootstrap.manifest_hash !== input.manifest.hash
  ) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: 'identity_mismatch',
      code: 'identity_mismatch',
      message: 'manifest snapshot does not match the bootstrapped trace identity',
      manifestIdentity: {
        run_id: input.manifest.run_id as unknown as string,
        flow_id: input.manifest.flow_id as unknown as string,
      },
      bootstrap,
    });
  }

  let snapshot: Snapshot;
  try {
    snapshot = reduceRetainedRunTrace(input.log);
  } catch (err) {
    return invalidProjection({
      runFolder: input.runFolder,
      reason: 'unknown',
      code: 'projection_reduce_failed',
      message: `trace could not be reduced (${errorMessage(err)})`,
      bootstrap,
    });
  }

  const savedFlow = readSavedFlowForProjection(
    input.manifest.bytes_base64,
    input.manifest.flow_id as unknown as string,
  );
  const flow = savedFlow.kind === 'available' ? savedFlow.flow : undefined;
  const reportPaths = optionalReportPaths(input.runFolder);
  const event = lastEvent(input.log);
  const terminal = input.log[input.log.length - 1];
  if (terminal?.kind === 'run.closed') {
    const base = {
      api_version: 'run-status-v1' as const,
      schema_version: 1 as const,
      run_folder: input.runFolder,
      run_id: bootstrap.run_id,
      flow_id: bootstrap.flow_id,
      goal: bootstrap.goal,
      reason: 'run_closed' as const,
      legal_next_actions: ['inspect'] as const,
      terminal_outcome: terminal.outcome,
      last_event: event,
      ...reportPaths,
    };
    return RunStatusProjectionV1.parse(
      terminal.outcome === 'aborted'
        ? { ...base, engine_state: 'aborted' as const }
        : { ...base, engine_state: 'completed' as const },
    );
  }

  const waiting = findNewestUnresolvedCheckpoint(input.log);
  if (waiting !== undefined) {
    if (savedFlow.kind === 'identity_mismatch') {
      return invalidProjection({
        runFolder: input.runFolder,
        reason: 'identity_mismatch',
        code: 'flow_identity_mismatch',
        message: `manifest flow_id '${input.manifest.flow_id as unknown as string}' does not match saved flow bytes '${savedFlow.parsedFlowId}'`,
        manifestIdentity: {
          run_id: input.manifest.run_id as unknown as string,
          flow_id: input.manifest.flow_id as unknown as string,
        },
        bootstrap,
      });
    }
    const projectedCheckpoint = validateCheckpointRequest({
      runFolder: input.runFolder,
      bootstrap,
      snapshot,
      flow,
      requested: waiting,
    });
    if (!projectedCheckpoint.ok) return projectedCheckpoint.projection;
    return RunStatusProjectionV1.parse({
      api_version: 'run-status-v1',
      schema_version: 1,
      run_folder: input.runFolder,
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
      run_id: bootstrap.run_id,
      flow_id: bootstrap.flow_id,
      goal: bootstrap.goal,
      current_step: currentStepProjection(snapshot, input.log, flow),
      checkpoint: projectedCheckpoint.checkpoint,
      last_event: event,
      ...reportPaths,
    });
  }

  return RunStatusProjectionV1.parse({
    api_version: 'run-status-v1',
    schema_version: 1,
    run_folder: input.runFolder,
    engine_state: 'open',
    reason: 'active_or_unknown',
    legal_next_actions: ['inspect'],
    run_id: bootstrap.run_id,
    flow_id: bootstrap.flow_id,
    goal: bootstrap.goal,
    current_step: currentStepProjection(snapshot, input.log, flow),
    last_event: event,
    ...reportPaths,
  });
}
