import { readFileSync } from 'node:fs';
import { findCheckpointBriefBuilder } from '../../flows/registries/checkpoint-writers/registry.js';
import { sha256Hex } from '../../shared/connector-relay.js';
import type { StepOutcomeV2 } from '../domain/step.js';
import type { CheckpointStepV2 } from '../manifest/executable-flow.js';
import type { RunContextV2 } from '../run/run-context.js';
import { requireCompiledStepV1 } from '../run/v1-compat.js';

type CheckpointResolution =
  | {
      readonly kind: 'resolved';
      readonly selection: string;
      readonly resolutionSource: 'operator' | 'safe-default' | 'safe-autonomous';
      readonly autoResolved: boolean;
    }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'failed'; readonly reason: string };

function policy(step: CheckpointStepV2) {
  if (step.policy === undefined || step.policy === null || typeof step.policy !== 'object') {
    throw new Error(`checkpoint step '${step.id}' is missing checkpoint policy`);
  }
  return step.policy as {
    readonly prompt: string;
    readonly safe_default_choice?: string;
    readonly safe_autonomous_choice?: string;
    readonly choices: readonly { readonly id: string; readonly label?: string }[];
  };
}

function resolveCheckpoint(
  step: CheckpointStepV2,
  depth: string | undefined,
): CheckpointResolution {
  const effectiveDepth = depth ?? 'standard';
  const stepPolicy = policy(step);
  if (effectiveDepth === 'deep' || effectiveDepth === 'tournament') return { kind: 'waiting' };
  if (effectiveDepth === 'autonomous') {
    const selection = stepPolicy.safe_autonomous_choice;
    if (selection === undefined) {
      return {
        kind: 'failed',
        reason: `checkpoint step '${step.id}' cannot auto-resolve autonomous depth without a declared safe autonomous choice`,
      };
    }
    return { kind: 'resolved', selection, resolutionSource: 'safe-autonomous', autoResolved: true };
  }
  const selection = stepPolicy.safe_default_choice;
  if (selection === undefined) {
    return {
      kind: 'failed',
      reason: `checkpoint step '${step.id}' cannot resolve ${effectiveDepth} depth without a declared safe default choice`,
    };
  }
  return { kind: 'resolved', selection, resolutionSource: 'safe-default', autoResolved: true };
}

function checkpointRequestBody(input: {
  readonly step: CheckpointStepV2;
  readonly context: RunContextV2;
  readonly checkpointReportSha256?: string;
}) {
  const stepPolicy = policy(input.step);
  return {
    schema_version: 1,
    step_id: input.step.id,
    prompt: stepPolicy.prompt,
    allowed_choices: stepPolicy.choices.map((choice) => choice.id),
    ...(stepPolicy.safe_default_choice === undefined
      ? {}
      : { safe_default_choice: stepPolicy.safe_default_choice }),
    ...(stepPolicy.safe_autonomous_choice === undefined
      ? {}
      : { safe_autonomous_choice: stepPolicy.safe_autonomous_choice }),
    execution_context: {
      ...(input.context.projectRoot === undefined
        ? {}
        : { project_root: input.context.projectRoot }),
      selection_config_layers: input.context.selectionConfigLayers ?? [],
      ...(input.checkpointReportSha256 === undefined
        ? {}
        : { checkpoint_report_sha256: input.checkpointReportSha256 }),
    },
  };
}

export async function executeCheckpointV2(
  step: CheckpointStepV2,
  context: RunContextV2,
): Promise<StepOutcomeV2> {
  const attempt = context.activeStepAttempt ?? 1;
  const request = step.writes?.request;
  const response = step.writes?.response;
  if (request === undefined || response === undefined) {
    throw new Error(`checkpoint step '${step.id}' requires writes.request and writes.response`);
  }
  const compiledStep = requireCompiledStepV1(context, step, 'checkpoint');

  let checkpointReportSha256: string | undefined;
  const report = step.writes?.report;
  const resumedSelection =
    context.resumeCheckpoint?.stepId === step.id ? context.resumeCheckpoint.selection : undefined;
  const resolution = resolveCheckpoint(step, context.depth);
  if (resumedSelection === undefined) {
    if (report !== undefined) {
      const builder =
        report.schema === undefined ? undefined : findCheckpointBriefBuilder(report.schema);
      if (builder === undefined || report.schema === undefined) {
        throw new Error(`checkpoint step '${step.id}' has unsupported report schema`);
      }
      const body = builder.build({
        runFolder: context.runDir,
        step: compiledStep,
        goal: context.goal,
        responsePath: response.path,
      });
      await context.files.writeJson(report, body);
      checkpointReportSha256 = sha256Hex(readFileSync(context.files.resolve(report), 'utf8'));
      await context.trace.append({
        run_id: context.runId,
        kind: 'step.report_written',
        step_id: step.id,
        attempt,
        report_path: report.path,
        report_schema: report.schema,
      });
    }

    const requestBody = checkpointRequestBody({
      step,
      context,
      ...(checkpointReportSha256 === undefined ? {} : { checkpointReportSha256 }),
    });
    await context.files.writeJson(request, requestBody);
    const requestText = readFileSync(context.files.resolve(request), 'utf8');
    await context.trace.append({
      run_id: context.runId,
      kind: 'checkpoint.requested',
      step_id: step.id,
      attempt,
      request_path: request.path,
      request_report_hash: sha256Hex(requestText),
      allowed_choices: step.choices,
      ...(resolution.kind === 'resolved' && resolution.autoResolved
        ? {
            auto_resolved: true,
            resolution_source: resolution.resolutionSource,
          }
        : {}),
      ...(checkpointReportSha256 === undefined
        ? {}
        : { checkpoint_report_sha256: checkpointReportSha256 }),
      data: { prompt: policy(step).prompt },
    });
  }

  const effectiveResolution: CheckpointResolution =
    resumedSelection === undefined
      ? resolution
      : {
          kind: 'resolved',
          selection: resumedSelection,
          resolutionSource: 'operator',
          autoResolved: false,
        };
  if (effectiveResolution.kind === 'waiting') {
    return {
      kind: 'waiting_checkpoint',
      checkpoint: {
        stepId: step.id,
        attempt,
        requestPath: context.files.resolve(request),
        allowedChoices: step.choices,
      },
    };
  }
  if (effectiveResolution.kind === 'failed') {
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'checkpoint_selection',
      outcome: 'fail',
      reason: effectiveResolution.reason,
    });
    throw new Error(effectiveResolution.reason);
  }

  const allowed = (step.check as { readonly allow?: unknown }).allow;
  if (Array.isArray(allowed) && !allowed.includes(effectiveResolution.selection)) {
    throw new Error(
      `checkpoint step '${step.id}' selected '${effectiveResolution.selection}' but check.allow is [${allowed.join(', ')}]`,
    );
  }
  await context.files.writeJson(response, {
    schema_version: 1,
    step_id: step.id,
    selection: effectiveResolution.selection,
    resolution_source: effectiveResolution.resolutionSource,
  });
  await context.trace.append({
    run_id: context.runId,
    kind: 'checkpoint.resolved',
    step_id: step.id,
    attempt,
    selection: effectiveResolution.selection,
    auto_resolved: effectiveResolution.autoResolved,
    resolution_source: effectiveResolution.resolutionSource,
    response_path: response.path,
    data: {
      selection: effectiveResolution.selection,
      auto_resolved: effectiveResolution.autoResolved,
      resolution_source: effectiveResolution.resolutionSource,
      response_path: response.path,
    },
  });
  await context.trace.append({
    run_id: context.runId,
    kind: 'check.evaluated',
    step_id: step.id,
    attempt,
    check_kind: 'checkpoint_selection',
    outcome: 'pass',
  });

  return {
    route: Object.hasOwn(step.routes, effectiveResolution.selection)
      ? effectiveResolution.selection
      : 'pass',
    details: { selection: effectiveResolution.selection },
  };
}
