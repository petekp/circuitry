// Checkpoint executor.
//
// This file owns the runtime side of checkpoint requests: writing the request,
// emitting trace evidence, deciding whether depth waits or auto-resolves, and
// applying an operator resume selection. Resume validation lives in the run
// resume path, not here.
import { findCheckpointBriefBuilder } from '../../flows/registries/checkpoint-writers/registry.js';
import { requireRuntimeIndexedStep } from '../../flows/registries/runtime-index.js';
import type { OperatorAutoResolution } from '../../schemas/operator-summary.js';
import type { CheckpointChoiceSource } from '../../schemas/runtime-source.js';
import type { AutoResolutionPolicy } from '../../schemas/step.js';
import { resolveHighestScoreAutoResolution } from '../../shared/checkpoint-auto-resolution.js';
import { sha256Hex } from '../../shared/connector-relay.js';
import { resolveDottedPath } from '../../shared/fanout-branch-template.js';
import {
  type CheckpointChoice,
  resolveCheckpointChoicesSource,
} from '../../shared/runtime-source.js';
import type { StepOutcome } from '../domain/step.js';
import type { CheckpointStep } from '../manifest/executable-flow.js';
import type { RunContext } from '../run/run-context.js';
import {
  type StepExecutionResult,
  stepExecutionFailed,
  stepExecutionFailedFrom,
  stepExecutionOutcome,
  unwrapStepExecutionResult,
} from './result.js';

type CheckpointResolution =
  | {
      readonly kind: 'resolved';
      readonly selection: string;
      readonly resolutionSource: 'operator' | 'safe-default' | 'safe-autonomous';
      readonly autoResolved: boolean;
      readonly autoResolution?: OperatorAutoResolution;
    }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'failed'; readonly reason: string };

function policy(step: CheckpointStep) {
  if (step.policy === undefined || step.policy === null || typeof step.policy !== 'object') {
    throw new Error(`checkpoint step '${step.id}' is missing checkpoint policy`);
  }
  return step.policy as {
    readonly prompt: string;
    readonly safe_default_choice?: string;
    readonly safe_autonomous_choice?: string;
    readonly choices?: readonly CheckpointChoice[];
    readonly choices_from?: CheckpointChoiceSource;
    readonly auto_resolution?: AutoResolutionPolicy;
  };
}

async function materializePolicy(
  step: CheckpointStep,
  context: RunContext,
): Promise<{
  readonly prompt: string;
  readonly safe_default_choice?: string;
  readonly safe_autonomous_choice?: string;
  readonly choices: readonly CheckpointChoice[];
  readonly auto_resolution?: AutoResolutionPolicy;
}> {
  const stepPolicy = policy(step);
  const choices =
    stepPolicy.choices ??
    (stepPolicy.choices_from === undefined
      ? undefined
      : await resolveCheckpointChoicesSource({
          source: stepPolicy.choices_from,
          files: context.files,
          ...(context.axes === undefined ? {} : { axes: context.axes }),
          owner: `checkpoint step '${step.id}' choices_from`,
        }));
  if (choices === undefined || choices.length === 0) {
    throw new Error(`checkpoint step '${step.id}' has no executable checkpoint choices`);
  }
  return {
    prompt: stepPolicy.prompt,
    choices,
    ...(stepPolicy.safe_default_choice === undefined
      ? {}
      : { safe_default_choice: stepPolicy.safe_default_choice }),
    ...(stepPolicy.safe_autonomous_choice === undefined
      ? {}
      : { safe_autonomous_choice: stepPolicy.safe_autonomous_choice }),
    ...(stepPolicy.auto_resolution === undefined
      ? {}
      : { auto_resolution: stepPolicy.auto_resolution }),
  };
}

async function resolveCheckpoint(
  step: CheckpointStep,
  context: RunContext,
  depth: string | undefined,
  stepPolicy: Awaited<ReturnType<typeof materializePolicy>>,
): Promise<CheckpointResolution> {
  const effectiveDepth = depth ?? 'standard';
  const autonomous = context.axes?.autonomous === true || effectiveDepth === 'autonomous';
  if (!autonomous && (effectiveDepth === 'deep' || effectiveDepth === 'tournament')) {
    return { kind: 'waiting' };
  }
  if (autonomous) {
    if (stepPolicy.auto_resolution !== undefined) {
      return await resolveAutoResolution(step, context, stepPolicy, stepPolicy.auto_resolution);
    }
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

async function resolveAutoResolution(
  step: CheckpointStep,
  context: RunContext,
  stepPolicy: Awaited<ReturnType<typeof materializePolicy>>,
  autoResolution: AutoResolutionPolicy,
): Promise<CheckpointResolution> {
  if (autoResolution.policy === 'refuse') {
    return {
      kind: 'failed',
      reason: `checkpoint step '${step.id}' cannot auto-resolve autonomous depth because policy is refuse`,
    };
  }
  if (autoResolution.policy === 'first-acceptable') {
    const selection = stepPolicy.choices[0]?.id;
    if (selection === undefined) {
      return { kind: 'failed', reason: `checkpoint step '${step.id}' has no executable choices` };
    }
    return {
      kind: 'resolved',
      selection,
      resolutionSource: 'safe-autonomous',
      autoResolved: true,
      autoResolution: simpleAutoResolutionRecord({
        step,
        context,
        stepPolicy,
        policy: autoResolution.policy,
        selection,
      }),
    };
  }
  if (autoResolution.policy === 'accept-as-is') {
    const selection = stepPolicy.safe_autonomous_choice ?? stepPolicy.safe_default_choice;
    if (selection === undefined) {
      return {
        kind: 'failed',
        reason: `checkpoint step '${step.id}' accept-as-is requires safe_autonomous_choice or safe_default_choice`,
      };
    }
    return {
      kind: 'resolved',
      selection,
      resolutionSource: 'safe-autonomous',
      autoResolved: true,
      autoResolution: simpleAutoResolutionRecord({
        step,
        context,
        stepPolicy,
        policy: autoResolution.policy,
        selection,
      }),
    };
  }

  const sourceRaw = await context.files.readJson(autoResolution.source_report);
  const branches = resolveDottedPath(sourceRaw, autoResolution.branches_path);
  if (!Array.isArray(branches)) {
    return {
      kind: 'failed',
      reason: `checkpoint step '${step.id}' highest-score source '${autoResolution.source_report}.${autoResolution.branches_path}' did not resolve to an array`,
    };
  }
  try {
    const highestScore = resolveHighestScoreAutoResolution({
      checkpointId: step.id,
      ...(step.title === undefined ? {} : { checkpointLabel: step.title }),
      choices: stepPolicy.choices.map((choice) => choice.id),
      resolvedAt: context.now().toISOString(),
      branches,
      idPath: autoResolution.id_path,
      rubricResultPath: autoResolution.rubric_result_path,
    });
    return {
      kind: 'resolved',
      selection: highestScore.selection,
      resolutionSource: 'safe-autonomous',
      autoResolved: true,
      autoResolution: highestScore.record,
    };
  } catch (error) {
    return {
      kind: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function simpleAutoResolutionRecord(input: {
  readonly step: CheckpointStep;
  readonly context: RunContext;
  readonly stepPolicy: Awaited<ReturnType<typeof materializePolicy>>;
  readonly policy: 'accept-as-is' | 'first-acceptable';
  readonly selection: string;
}): OperatorAutoResolution {
  return {
    checkpoint_id: input.step.id,
    ...(input.step.title === undefined ? {} : { checkpoint_label: input.step.title }),
    policy: input.policy,
    resolved_value: input.selection,
    alternatives_available: input.stepPolicy.choices
      .filter((choice) => choice.id !== input.selection)
      .map((choice) => choice.id),
    runtime_or_model: 'runtime',
    resolved_at: input.context.now().toISOString(),
  };
}

function checkpointRequestBody(input: {
  readonly step: CheckpointStep;
  readonly context: RunContext;
  readonly stepPolicy: Awaited<ReturnType<typeof materializePolicy>>;
  readonly checkpointReportSha256?: string;
}) {
  const stepPolicy = input.stepPolicy;
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
      ...(input.context.axes === undefined ? {} : { axes: input.context.axes }),
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

export async function executeCheckpointResult(
  step: CheckpointStep,
  context: RunContext,
): Promise<StepExecutionResult> {
  const attempt = context.activeStepAttempt ?? 1;
  try {
    const request = step.writes?.request;
    const response = step.writes?.response;
    if (request === undefined || response === undefined) {
      return stepExecutionFailed(
        `checkpoint step '${step.id}' requires writes.request and writes.response`,
      );
    }
    const indexedStep = requireRuntimeIndexedStep(context.packageIndex, step.id, 'checkpoint');
    const stepPolicy = await materializePolicy(step, context);

    let checkpointReportSha256: string | undefined;
    const report = step.writes?.report;
    const resumedSelection =
      context.resumeCheckpoint?.stepId === step.id ? context.resumeCheckpoint.selection : undefined;
    const resolution = await resolveCheckpoint(step, context, context.depth, stepPolicy);
    if (resumedSelection === undefined) {
      if (report !== undefined) {
        const builder =
          report.schema === undefined ? undefined : findCheckpointBriefBuilder(report.schema);
        if (builder === undefined || report.schema === undefined) {
          return stepExecutionFailed(`checkpoint step '${step.id}' has unsupported report schema`);
        }
        const body = builder.build({
          runFolder: context.runDir,
          step: indexedStep,
          goal: context.goal,
          ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
          responsePath: response.path,
        });
        await context.files.writeJson(report, body);
        checkpointReportSha256 = sha256Hex(await context.files.readText(report));
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
        stepPolicy,
        ...(checkpointReportSha256 === undefined ? {} : { checkpointReportSha256 }),
      });
      await context.files.writeJson(request, requestBody);
      const requestText = await context.files.readText(request);
      await context.trace.append({
        run_id: context.runId,
        kind: 'checkpoint.requested',
        step_id: step.id,
        attempt,
        request_path: request.path,
        request_report_hash: sha256Hex(requestText),
        options: stepPolicy.choices.map((choice) => choice.id),
        auto_resolved: resolution.kind === 'resolved' ? resolution.autoResolved : false,
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
      return stepExecutionOutcome({
        kind: 'waiting_checkpoint',
        checkpoint: {
          stepId: step.id,
          attempt,
          requestPath: context.files.resolve(request),
          allowedChoices: stepPolicy.choices.map((choice) => choice.id),
        },
      });
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
      return stepExecutionFailed(effectiveResolution.reason);
    }

    const allowed = (step.check as { readonly allow?: unknown }).allow;
    const effectiveAllowed = Array.isArray(allowed)
      ? allowed
      : stepPolicy.choices.map((choice) => choice.id);
    if (!effectiveAllowed.includes(effectiveResolution.selection)) {
      return stepExecutionFailed(
        `checkpoint step '${step.id}' selected '${effectiveResolution.selection}' but check.allow is [${effectiveAllowed.join(', ')}]`,
      );
    }
    await context.files.writeJson(response, {
      schema_version: 1,
      step_id: step.id,
      selection: effectiveResolution.selection,
      resolution_source: effectiveResolution.resolutionSource,
      ...(effectiveResolution.autoResolution === undefined
        ? {}
        : { auto_resolution: effectiveResolution.autoResolution }),
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
    });
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'checkpoint_selection',
      outcome: 'pass',
    });

    return stepExecutionOutcome({
      route: Object.hasOwn(step.routes, effectiveResolution.selection)
        ? effectiveResolution.selection
        : 'pass',
      details: { selection: effectiveResolution.selection },
    });
  } catch (error) {
    return stepExecutionFailedFrom(error);
  }
}

export async function executeCheckpoint(
  step: CheckpointStep,
  context: RunContext,
): Promise<StepOutcome> {
  return unwrapStepExecutionResult(await executeCheckpointResult(step, context));
}
