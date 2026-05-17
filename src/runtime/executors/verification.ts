import { requireRuntimeIndexedStep } from '../../flows/registries/runtime-index.js';
import { findVerificationWriter } from '../../flows/registries/verification-writers/registry.js';
import {
  ProofPlanBlockedError,
  isProofPlanBlockedError,
  runProofPlanCommand,
} from '../../shared/proof-plan.js';
import { recoveryRouteForStep } from '../../shared/recovery-route.js';
import type { StepOutcome } from '../domain/step.js';
import type { VerificationStep } from '../manifest/executable-flow.js';
import type { RunContext } from '../run/run-context.js';

function verificationFailureReason(stepId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `verification step '${stepId}': report writer failed (${message})`;
}

export async function executeVerification(
  step: VerificationStep,
  context: RunContext,
): Promise<StepOutcome> {
  const attempt = context.activeStepAttempt ?? 1;
  let report: NonNullable<NonNullable<VerificationStep['writes']>['report']>;
  let reportSchema: string;
  let body: {
    readonly overall_status?: unknown;
  };
  try {
    const stepReport = step.writes?.report;
    if (stepReport === undefined || stepReport.schema === undefined) {
      throw new Error(`verification step '${step.id}' is missing writes.report schema`);
    }
    report = stepReport;
    reportSchema = stepReport.schema;
    if (context.projectRoot === undefined) {
      throw new ProofPlanBlockedError(
        `verification step '${step.id}' requires projectRoot for project-relative cwd resolution`,
      );
    }
    const projectRoot = context.projectRoot;
    const indexedStep = requireRuntimeIndexedStep(context.packageIndex, step.id, 'verification');
    const builder = findVerificationWriter(reportSchema);
    if (builder === undefined) {
      throw new Error(`verification step '${step.id}' has unsupported report schema`);
    }

    const builderContext = {
      runFolder: context.runDir,
      flow: context.packageIndex.flow,
      step: indexedStep,
    };
    const commands = builder.loadCommands(builderContext);
    const observations = commands.map((command) => runProofPlanCommand(command, projectRoot));
    body = builder.buildResult(observations, builderContext) as {
      readonly overall_status?: unknown;
    };
    await context.files.writeJson(report, body);
  } catch (error) {
    const blocked = isProofPlanBlockedError(error);
    const reason = blocked ? error.message : verificationFailureReason(step.id, error);
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'schema_sections',
      outcome: 'fail',
      reason,
    });
    if (blocked) throw error;
    throw new Error(reason);
  }

  await context.trace.append({
    run_id: context.runId,
    kind: 'step.report_written',
    step_id: step.id,
    attempt,
    report_path: report.path,
    report_schema: reportSchema,
  });

  if (body.overall_status === 'passed') {
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'schema_sections',
      outcome: 'pass',
    });
    return { route: 'pass', details: { overall_status: 'passed' } };
  }

  const reason = `verification step '${step.id}' failed one or more commands`;
  await context.trace.append({
    run_id: context.runId,
    kind: 'check.evaluated',
    step_id: step.id,
    attempt,
    check_kind: 'schema_sections',
    outcome: 'fail',
    reason,
  });
  const recoveryRoute = recoveryRouteForStep(step);
  if (recoveryRoute !== undefined) {
    return { route: recoveryRoute, details: { reason } };
  }
  throw new Error(reason);
}
