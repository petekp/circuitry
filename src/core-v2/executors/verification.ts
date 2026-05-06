import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { findVerificationWriter } from '../../flows/registries/verification-writers/registry.js';
import type { VerificationCommand } from '../../flows/registries/verification-writers/types.js';
import type { StepOutcomeV2 } from '../domain/step.js';
import type { VerificationStepV2 } from '../manifest/executable-flow.js';
import type { RunContextV2 } from '../run/run-context.js';
import {
  recoveryRouteForExecutableStep,
  requireCompiledFlowV1,
  requireCompiledStepV1,
} from '../run/v1-compat.js';

const VERIFICATION_ENV_INHERIT_ALLOWLIST = [
  'PATH',
  'SystemRoot',
  'TEMP',
  'TMP',
  'TMPDIR',
  'WINDIR',
] as const;

function isInsideOrSame(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
}

function resolveProjectRelativeCwd(projectRoot: string, cwd: string): string {
  const rootAbs = resolve(projectRoot);
  const targetAbs = resolve(rootAbs, cwd);
  if (!isInsideOrSame(rootAbs, targetAbs)) {
    throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} escapes project root`);
  }
  if (!existsSync(rootAbs)) {
    throw new Error(`verification project root rejected: ${rootAbs} does not exist`);
  }
  const rootReal = realpathSync.native(rootAbs);
  let cursor = rootAbs;
  for (const segment of cwd.split('/')) {
    if (segment === '.') continue;
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) {
      throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} does not exist`);
    }
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) {
      throw new Error(
        `verification cwd rejected: ${JSON.stringify(cwd)} crosses symlink ${JSON.stringify(cursor)}`,
      );
    }
    const cursorReal = realpathSync.native(cursor);
    if (!isInsideOrSame(rootReal, cursorReal)) {
      throw new Error(
        `verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root through ${JSON.stringify(cursor)}`,
      );
    }
  }
  const targetReal = realpathSync.native(targetAbs);
  if (!isInsideOrSame(rootReal, targetReal)) {
    throw new Error(`verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root`);
  }
  return targetReal;
}

function verificationEnvironment(commandEnv: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of VERIFICATION_ENV_INHERIT_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...commandEnv };
}

function summarizeOutput(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value);
  if (bytes.length <= maxBytes) return value;
  return bytes.subarray(0, maxBytes).toString('utf8');
}

function verificationFailureReason(stepId: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `verification step '${stepId}': report writer failed (${message})`;
}

function runCommand(command: VerificationCommand, projectRoot: string) {
  const started = Date.now();
  const result = spawnSync(command.argv[0] as string, command.argv.slice(1), {
    cwd: resolveProjectRelativeCwd(projectRoot, command.cwd),
    env: verificationEnvironment(command.env),
    encoding: 'utf8',
    maxBuffer: command.max_output_bytes,
    shell: false,
    timeout: command.timeout_ms,
  });
  const exitCode =
    typeof result.status === 'number' && result.error === undefined ? result.status : 1;
  const stderrParts = [
    typeof result.stderr === 'string' ? result.stderr : '',
    result.error === undefined ? '' : result.error.message,
    result.signal === null ? '' : `signal: ${result.signal}`,
  ].filter((part) => part.length > 0);
  return {
    command,
    exit_code: exitCode,
    status: exitCode === 0 ? ('passed' as const) : ('failed' as const),
    duration_ms: Math.max(0, Date.now() - started),
    stdout_summary: summarizeOutput(
      typeof result.stdout === 'string' ? result.stdout : '',
      command.max_output_bytes,
    ),
    stderr_summary: summarizeOutput(stderrParts.join('\n'), command.max_output_bytes),
  };
}

export async function executeVerificationV2(
  step: VerificationStepV2,
  context: RunContextV2,
): Promise<StepOutcomeV2> {
  let report: NonNullable<NonNullable<VerificationStepV2['writes']>['report']>;
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
      throw new Error(
        `verification step '${step.id}' requires projectRoot for project-relative cwd resolution`,
      );
    }
    const projectRoot = context.projectRoot;
    const compiledFlow = requireCompiledFlowV1(context, step);
    const compiledStep = requireCompiledStepV1(context, step, 'verification');
    const builder = findVerificationWriter(reportSchema);
    if (builder === undefined) {
      throw new Error(`verification step '${step.id}' has unsupported report schema`);
    }

    const commands = builder.loadCommands({
      runFolder: context.runDir,
      flow: compiledFlow,
      step: compiledStep,
    });
    const observations = commands.map((command) => runCommand(command, projectRoot));
    body = builder.buildResult(observations) as {
      readonly overall_status?: unknown;
    };
    await context.files.writeJson(report, body);
  } catch (error) {
    const reason = verificationFailureReason(step.id, error);
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
      check_kind: 'schema_sections',
      outcome: 'fail',
      reason,
    });
    throw new Error(reason);
  }

  await context.trace.append({
    run_id: context.runId,
    kind: 'step.report_written',
    step_id: step.id,
    report_path: report.path,
    report_schema: reportSchema,
  });

  if (body.overall_status === 'passed') {
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
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
    check_kind: 'schema_sections',
    outcome: 'fail',
    reason,
  });
  const recoveryRoute = recoveryRouteForExecutableStep(step);
  if (recoveryRoute !== undefined) {
    return { route: recoveryRoute, details: { reason } };
  }
  throw new Error(reason);
}
