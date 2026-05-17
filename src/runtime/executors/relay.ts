import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { relayClaudeCode } from '../../connectors/claude-code.js';
import { relayCodex } from '../../connectors/codex.js';
import { relayCustom } from '../../connectors/custom.js';
import { runCrossReportValidator } from '../../flows/registries/cross-report-validators.js';
import { findReportZodSchema, parseReport } from '../../flows/registries/report-schemas.js';
import { requireRuntimeIndexedStep } from '../../flows/registries/runtime-index.js';
import type { ResolvedConnector } from '../../schemas/connector.js';
import { Depth } from '../../schemas/depth.js';
import type { CompiledFlowId } from '../../schemas/ids.js';
import { ResolvedSelection } from '../../schemas/selection-policy.js';
import type { SkillSlot } from '../../schemas/skill.js';
import { RelayRole } from '../../schemas/step.js';
import { type RelayResult, sha256Hex } from '../../shared/connector-relay.js';
import { recoveryRouteForStep } from '../../shared/recovery-route.js';
import { deriveResolvedSelection } from '../../shared/relay-selection.js';
import {
  type CheckEvaluation,
  type RelayStep as CompiledRelayStepV1,
  NO_VERDICT_SENTINEL,
  composeRelayPrompt,
  evaluateRelayCheck,
} from '../../shared/relay-support.js';
import { resolveLoadedRelaySkills } from '../../shared/skill-loading.js';
import { responseJsonSchemaFromZod } from '../../shared/zod-to-response-schema.js';
import {
  assertConnectorSelectionCompatible,
  resolveConnectorForRelay,
} from '../connectors/resolver.js';
import type { StepOutcome } from '../domain/step.js';
import type { RelayStep } from '../manifest/executable-flow.js';
import type { RunContext } from '../run/run-context.js';

export interface RelayRequest {
  readonly runId: string;
  readonly stepId: string;
  readonly role: string;
  readonly prompt: string;
  readonly connector?: string;
}

export interface RelayConnector {
  readonly connectorName?: string;
  readonly connector?: ResolvedConnector;
  relay(request: RelayRequest): Promise<unknown>;
}

export function createStubRelayConnector(response: unknown = { ok: true }): RelayConnector {
  return {
    async relay() {
      return response;
    },
  };
}

function builtinConnector(name: string): ResolvedConnector | undefined {
  if (name === 'claude-code' || name === 'codex') {
    return { kind: 'builtin', name };
  }
  return undefined;
}

function resolvedConnectorName(connector: ResolvedConnector | undefined): string | undefined {
  return connector?.name;
}

function configLayerConnector(
  name: string,
  configLayers: Parameters<typeof resolveConnectorForRelay>[0]['configLayers'],
): ResolvedConnector | undefined {
  let descriptor: ResolvedConnector | undefined;
  for (const layer of configLayers ?? []) {
    descriptor = layer.config.relay.connectors[name] ?? descriptor;
  }
  return descriptor;
}

function requestedConnectorForRelay(input: {
  readonly stepConnector?: string;
  readonly suppliedConnector?: RelayConnector;
  readonly configLayers?: Parameters<typeof resolveConnectorForRelay>[0]['configLayers'];
}): ResolvedConnector | undefined {
  const suppliedResolved = input.suppliedConnector?.connector;
  const suppliedResolvedName = resolvedConnectorName(suppliedResolved);
  const suppliedName = input.suppliedConnector?.connectorName ?? suppliedResolvedName;

  if (
    input.suppliedConnector?.connectorName !== undefined &&
    suppliedResolvedName !== undefined &&
    input.suppliedConnector.connectorName !== suppliedResolvedName
  ) {
    throw new Error(
      `relay connector identity mismatch: connectorName '${input.suppliedConnector.connectorName}' does not match resolved connector '${suppliedResolvedName}'`,
    );
  }

  if (
    input.stepConnector !== undefined &&
    suppliedName !== undefined &&
    input.stepConnector !== suppliedName
  ) {
    throw new Error(
      `relay connector identity mismatch: step requests '${input.stepConnector}' but supplied connector is '${suppliedName}'`,
    );
  }

  const requested = input.stepConnector ?? suppliedName;
  if (requested === undefined) return undefined;

  const builtin = builtinConnector(requested);
  if (builtin !== undefined) return builtin;

  if (suppliedResolved !== undefined && suppliedResolved.name === requested) {
    return suppliedResolved;
  }

  const configured = configLayerConnector(requested, input.configLayers);
  if (configured !== undefined) return configured;

  throw new Error(
    `relay connector '${requested}' requires resolved connector capabilities before execution`,
  );
}

function selectionForCompatibility(selection: unknown) {
  if (selection === undefined) return undefined;
  if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) {
    return undefined;
  }
  const selectionRecord = selection as {
    readonly model?: unknown;
    readonly effort?: unknown;
  };
  return ResolvedSelection.parse({
    ...(selectionRecord.model === undefined ? {} : { model: selectionRecord.model }),
    ...(selectionRecord.effort === undefined ? {} : { effort: selectionRecord.effort }),
    skills: [],
    invocation_options: {},
  });
}

export function resolveRelayExecution(input: {
  readonly flowId: string;
  readonly role: string;
  readonly selection?: unknown;
  readonly stepConnector?: string;
  readonly suppliedConnector?: RelayConnector;
  readonly configLayers?: Parameters<typeof resolveConnectorForRelay>[0]['configLayers'];
}): {
  readonly role: string;
  readonly connectorName: string;
  readonly connector: ResolvedConnector;
  readonly resolvedFrom: ReturnType<typeof resolveConnectorForRelay>['resolvedFrom'];
} {
  const role = RelayRole.parse(input.role);
  const explicitConnector = requestedConnectorForRelay({
    ...(input.stepConnector === undefined ? {} : { stepConnector: input.stepConnector }),
    ...(input.suppliedConnector === undefined
      ? {}
      : { suppliedConnector: input.suppliedConnector }),
    ...(input.configLayers === undefined ? {} : { configLayers: input.configLayers }),
  });
  const resolved = resolveConnectorForRelay({
    flowId: input.flowId,
    role,
    ...(input.configLayers === undefined ? {} : { configLayers: input.configLayers }),
    ...(explicitConnector === undefined ? {} : { explicitConnector }),
  });
  const resolvedConnector = resolved.connector;
  assertConnectorSelectionCompatible(
    resolvedConnector.name,
    selectionForCompatibility(input.selection),
  );
  return {
    role,
    connectorName: resolvedConnector.name,
    connector: resolvedConnector,
    resolvedFrom: resolved.resolvedFrom,
  };
}

export async function relayWithResolvedConnector(
  connector: ResolvedConnector,
  input: {
    readonly prompt: string;
    readonly timeoutMs?: number;
    readonly resolvedSelection?: unknown;
    readonly responseSchema?: Record<string, unknown>;
  },
): Promise<RelayResult> {
  const relayInput = {
    prompt: input.prompt,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    ...(input.resolvedSelection === undefined
      ? {}
      : { resolvedSelection: ResolvedSelection.parse(input.resolvedSelection) }),
    ...(input.responseSchema === undefined ? {} : { responseSchema: input.responseSchema }),
  };
  if (connector.kind === 'builtin' && connector.name === 'claude-code') {
    return relayClaudeCode(relayInput);
  }
  if (connector.kind === 'builtin' && connector.name === 'codex') {
    return relayCodex(relayInput);
  }
  if (connector.kind === 'custom') {
    return relayCustom({ ...relayInput, descriptor: connector });
  }
  throw new Error(`unsupported relay connector '${connector.name}'`);
}

function timeoutMs(step: RelayStep): number | undefined {
  const wallClock = (step.budgets as { readonly wall_clock_ms?: unknown } | undefined)
    ?.wall_clock_ms;
  return typeof wallClock === 'number' ? wallClock : undefined;
}

function suppliedConnectorFromRelayer(context: RunContext): RelayConnector | undefined {
  if (context.relayer === undefined) return undefined;
  return {
    connectorName: context.relayer.connectorName,
    ...(context.relayer.connector === undefined ? {} : { connector: context.relayer.connector }),
    async relay() {
      throw new Error('relay identity placeholder should not be invoked');
    },
  };
}

export interface ProductionRelayAttemptValidationInput {
  readonly flow: RunContext['packageIndex']['flow'];
  readonly context: RunContext;
  readonly step: RelayStep;
  readonly compiledStep: CompiledRelayStepV1;
  readonly relayResult: RelayResult;
  readonly checkEvaluation: Extract<CheckEvaluation, { kind: 'pass' }>;
}

export interface ProductionRelayAttemptValidationResult {
  readonly evaluation: CheckEvaluation;
  readonly parsedBody?: unknown;
}

export type ProductionRelayAttemptResult =
  | {
      readonly kind: 'connector_failed';
      readonly reason: string;
      readonly duration_ms: number;
    }
  | {
      readonly kind: 'completed';
      readonly evaluation: CheckEvaluation;
      readonly relay_completed_verdict: string;
      readonly duration_ms: number;
      readonly result_path: string;
      readonly parsed_body?: unknown;
      readonly report_path?: string;
    };

function defaultValidateAcceptedProductionRelay(
  input: ProductionRelayAttemptValidationInput,
): ProductionRelayAttemptValidationResult {
  const { flow, context, step, relayResult, checkEvaluation } = input;
  if (step.report?.schema === undefined) return { evaluation: checkEvaluation };
  const parseResult = parseReport(step.report.schema, relayResult.result_body);
  if (parseResult.kind === 'fail') {
    return {
      evaluation: {
        kind: 'fail',
        reason: `relay step '${step.id}': ${parseResult.reason}`,
        observedVerdict: checkEvaluation.verdict,
      },
    };
  }
  const crossResult = runCrossReportValidator(
    step.report.schema,
    flow,
    context.runDir,
    relayResult.result_body,
  );
  if (crossResult.kind === 'fail') {
    return {
      evaluation: {
        kind: 'fail',
        reason: `relay step '${step.id}': ${crossResult.reason}`,
        observedVerdict: checkEvaluation.verdict,
      },
    };
  }
  return { evaluation: checkEvaluation };
}

export async function executeProductionRelayAttempt(input: {
  readonly step: RelayStep;
  readonly compiledStep: CompiledRelayStepV1;
  readonly context: RunContext;
  readonly formatConnectorFailureReason?: (stepId: string, error: unknown) => string;
  readonly validateAcceptedResult?: (
    input: ProductionRelayAttemptValidationInput,
  ) => ProductionRelayAttemptValidationResult;
}): Promise<ProductionRelayAttemptResult> {
  const { step, compiledStep, context } = input;
  const flow = context.packageIndex.flow;
  const suppliedConnector = suppliedConnectorFromRelayer(context);
  const relayExecution = resolveRelayExecution({
    flowId: context.flow.id,
    role: step.role,
    ...(suppliedConnector === undefined ? {} : { suppliedConnector }),
    ...(context.selectionConfigLayers === undefined
      ? {}
      : { configLayers: context.selectionConfigLayers }),
    ...(step.selection === undefined ? {} : { selection: step.selection }),
    ...(step.connector === undefined ? {} : { stepConnector: step.connector }),
  });
  const resolvedSelection = deriveResolvedSelection(
    {
      ...(context.relayer === undefined ? {} : { relayer: context.relayer }),
      ...(context.selectionConfigLayers === undefined
        ? {}
        : { selectionConfigLayers: context.selectionConfigLayers }),
    },
    flow,
    compiledStep,
    Depth.parse(context.depth ?? 'standard'),
  );
  assertConnectorSelectionCompatible(relayExecution.connectorName, resolvedSelection);
  const loadedSkills = resolveLoadedRelaySkills({
    flowId: flow.id as CompiledFlowId,
    stepId: step.id,
    skillSlots: (compiledStep.skill_slots ?? []) as readonly SkillSlot[],
    resolvedSelection,
    ...(context.selectionConfigLayers === undefined
      ? {}
      : { configLayers: context.selectionConfigLayers }),
  });
  const prompt = composeRelayPrompt(compiledStep, context.runDir, loadedSkills);

  const request = step.writes?.request;
  const receipt = step.writes?.receipt;
  const result = step.writes?.result;
  if (request === undefined || receipt === undefined || result === undefined) {
    throw new Error(
      `relay step '${step.id}' requires writes.request, writes.receipt, and writes.result`,
    );
  }
  const requestPath = context.files.resolve(request);
  await mkdir(dirname(requestPath), { recursive: true });
  await writeFile(requestPath, prompt, 'utf8');
  const requestPayloadHash = sha256Hex(prompt);
  const startMs = Date.now();
  const attempt = context.activeStepAttempt ?? 1;
  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.started',
    step_id: step.id,
    attempt,
    connector: relayExecution.connector,
    role: RelayRole.parse(relayExecution.role),
    resolved_selection: resolvedSelection,
    resolved_from: relayExecution.resolvedFrom,
  });
  if (loadedSkills.length > 0) {
    await context.trace.append({
      run_id: context.runId,
      kind: 'skills.loaded',
      step_id: step.id,
      attempt,
      skills: loadedSkills.map(({ body: _body, ...skill }) => skill),
    });
  }
  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.request',
    step_id: step.id,
    attempt,
    request_payload_hash: requestPayloadHash,
  });

  // Convert the step's Zod report schema to JSON Schema so connectors
  // that accept a structured-output flag can enforce the response shape
  // natively. Connectors without that capability ignore the field and
  // fall back to the prose hint embedded in the prompt.
  const responseSchema = (() => {
    const schemaName = step.report?.schema;
    if (schemaName === undefined) return undefined;
    const zodSchema = findReportZodSchema(schemaName);
    if (zodSchema === undefined) return undefined;
    return responseJsonSchemaFromZod(zodSchema);
  })();

  let relayResult: RelayResult;
  try {
    const relayTimeoutMs = timeoutMs(step);
    relayResult =
      context.relayer === undefined
        ? await relayWithResolvedConnector(relayExecution.connector, {
            prompt,
            ...(relayTimeoutMs === undefined ? {} : { timeoutMs: relayTimeoutMs }),
            resolvedSelection,
            ...(responseSchema === undefined ? {} : { responseSchema }),
          })
        : await context.relayer.relay({
            prompt,
            ...(relayTimeoutMs === undefined ? {} : { timeoutMs: relayTimeoutMs }),
            resolvedSelection,
            ...(responseSchema === undefined ? {} : { responseSchema }),
          });
  } catch (error) {
    const reason = (
      input.formatConnectorFailureReason ??
      ((stepId: string, caught: unknown) =>
        `relay step '${stepId}': connector invocation failed (${(caught as Error).message})`)
    )(step.id, error);
    await context.trace.append({
      run_id: context.runId,
      kind: 'relay.failed',
      step_id: step.id,
      attempt,
      connector: relayExecution.connector,
      role: RelayRole.parse(relayExecution.role),
      resolved_selection: resolvedSelection,
      resolved_from: relayExecution.resolvedFrom,
      request_payload_hash: requestPayloadHash,
      reason,
    });
    return { kind: 'connector_failed', reason, duration_ms: Math.max(0, Date.now() - startMs) };
  }

  await context.files.writeText(receipt, relayResult.receipt_id);
  await context.files.writeText(result, relayResult.result_body);
  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.receipt',
    step_id: step.id,
    attempt,
    cli_version: relayResult.cli_version,
    receipt_id: relayResult.receipt_id,
  });
  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.result',
    step_id: step.id,
    attempt,
    result_report_hash: sha256Hex(relayResult.result_body),
  });

  const checkEvaluation = evaluateRelayCheck(compiledStep, relayResult.result_body);
  let evaluation: CheckEvaluation = checkEvaluation;
  let parsedBody: unknown;
  if (checkEvaluation.kind === 'pass') {
    const validation = (input.validateAcceptedResult ?? defaultValidateAcceptedProductionRelay)({
      flow,
      context,
      step,
      compiledStep,
      relayResult,
      checkEvaluation,
    });
    evaluation = validation.evaluation;
    parsedBody = validation.parsedBody;
  }

  const relayCompletedVerdict =
    evaluation.kind === 'pass'
      ? evaluation.verdict
      : (evaluation.observedVerdict ?? NO_VERDICT_SENTINEL);
  const durationMs = Math.max(0, Date.now() - startMs);

  // Persist the schema-tied report when downstream readers (operator-summary
  // projection, CI tooling, status storyboard) need it. Two paths:
  //   - verdict-gate pass AND validator (if any) approved: write as before.
  //   - verdict-gate fail BUT body parses against the declared schema:
  //     write anyway. The verdict gate governs route selection only; it
  //     does not gate artifact emission. A relay step that returned a
  //     structurally valid body (e.g., review with verdict 'release-blocked')
  //     must still produce its schema-tied report so the close-path can
  //     read it and the operator summary can render the real verdict.
  // A pass-then-downgrade (validator rejected on schema/cross-validator/
  // provenance grounds) is intentionally NOT written — those are substantive
  // validation failures, not gate failures.
  let writtenReportPath: string | undefined;
  if (step.report !== undefined) {
    let reportBody: unknown;
    if (checkEvaluation.kind === 'pass' && evaluation.kind === 'pass') {
      reportBody = parsedBody;
      if (reportBody === undefined) {
        try {
          reportBody = JSON.parse(relayResult.result_body) as unknown;
        } catch {
          reportBody = undefined;
        }
      }
    } else if (checkEvaluation.kind === 'fail' && step.report.schema !== undefined) {
      const parseResult = parseReport(step.report.schema, relayResult.result_body);
      if (parseResult.kind === 'ok') {
        try {
          reportBody = JSON.parse(relayResult.result_body) as unknown;
        } catch {
          reportBody = undefined;
        }
      }
    }
    if (reportBody !== undefined) {
      await context.files.writeJson(step.report, reportBody);
      parsedBody = reportBody;
      writtenReportPath = step.report.path;
    }
  }

  await context.trace.append({
    run_id: context.runId,
    kind: 'relay.completed',
    step_id: step.id,
    attempt,
    verdict: relayCompletedVerdict,
    duration_ms: durationMs,
    result_path: result.path,
    receipt_path: receipt.path,
  });
  await context.trace.append({
    run_id: context.runId,
    kind: 'check.evaluated',
    step_id: step.id,
    attempt,
    check_kind: 'result_verdict',
    outcome: evaluation.kind === 'pass' ? 'pass' : 'fail',
    ...(evaluation.kind === 'pass' ? {} : { reason: evaluation.reason }),
  });

  return {
    kind: 'completed',
    evaluation,
    relay_completed_verdict: relayCompletedVerdict,
    duration_ms: durationMs,
    result_path: result.path,
    ...(parsedBody === undefined ? {} : { parsed_body: parsedBody }),
    ...(writtenReportPath === undefined ? {} : { report_path: writtenReportPath }),
  };
}

export async function executeRelay(
  step: RelayStep,
  context: RunContext,
  connector?: RelayConnector,
): Promise<StepOutcome> {
  // Production runs without an injected connector use the full relay path:
  // prompt composition, connector resolution, durable relay trace entries,
  // and report materialization. The injected-connector path below is for
  // focused tests that exercise executor wiring without production relay IO.
  if (connector === undefined) {
    return executeProductionRelay(step, context);
  }
  const suppliedConnector = connector ?? createStubRelayConnector();
  const relayExecution = resolveRelayExecution({
    flowId: context.flow.id,
    role: step.role,
    suppliedConnector,
    ...(context.selectionConfigLayers === undefined
      ? {}
      : { configLayers: context.selectionConfigLayers }),
    ...(step.selection === undefined ? {} : { selection: step.selection }),
    ...(step.connector === undefined ? {} : { stepConnector: step.connector }),
  });

  const request: RelayRequest = {
    runId: context.runId,
    stepId: step.id,
    role: relayExecution.role,
    prompt: step.prompt ?? '',
    connector: relayExecution.connectorName,
  };
  const response = await suppliedConnector.relay(request);

  const writes = step.writes ?? {};
  await Promise.all(
    Object.values(writes).map((ref) =>
      context.files.writeJson(ref, {
        stepId: step.id,
        role: step.role,
        response,
      }),
    ),
  );

  return { route: 'pass', details: { role: step.role } };
}

async function executeProductionRelay(step: RelayStep, context: RunContext): Promise<StepOutcome> {
  const compiledStep = requireRuntimeIndexedStep(context.packageIndex, step.id, 'relay');
  const relayAttempt = await executeProductionRelayAttempt({ step, context, compiledStep });
  if (relayAttempt.kind === 'connector_failed') {
    if (Object.hasOwn(step.routes, 'connector-failed')) {
      return { route: 'connector-failed', details: { reason: relayAttempt.reason } };
    }
    const recoveryRoute = recoveryRouteForStep(step);
    if (recoveryRoute !== undefined)
      return { route: recoveryRoute, details: { reason: relayAttempt.reason } };
    throw new Error(relayAttempt.reason);
  }

  const { evaluation } = relayAttempt;
  if (evaluation.kind === 'pass')
    return { route: 'pass', details: { verdict: evaluation.verdict } };

  const recoveryRoute = recoveryRouteForStep(step);
  if (recoveryRoute !== undefined)
    return { route: recoveryRoute, details: { reason: evaluation.reason } };
  throw new Error(evaluation.reason);
}
