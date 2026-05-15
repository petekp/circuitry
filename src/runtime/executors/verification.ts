import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { findVerificationWriter } from '../../flows/registries/verification-writers/registry.js';
import type { VerificationCommand } from '../../flows/registries/verification-writers/types.js';
import {
  ProofPlanBlockedError,
  isProofPlanBlockedError,
} from '../../shared/verification-resolver.js';
import type { StepOutcome } from '../domain/step.js';
import type { VerificationStep } from '../manifest/executable-flow.js';
import {
  recoveryRouteForExecutableStep,
  requireCompiledFlow,
  requireCompiledStep,
} from '../run/route-compat.js';
import type { RunContext } from '../run/run-context.js';

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
    throw new ProofPlanBlockedError(
      `verification cwd rejected: ${JSON.stringify(cwd)} escapes project root`,
    );
  }
  if (!existsSync(rootAbs)) {
    throw new ProofPlanBlockedError(
      `verification project root rejected: ${rootAbs} does not exist`,
    );
  }
  const rootReal = realpathSync.native(rootAbs);
  let cursor = rootAbs;
  for (const segment of cwd.split('/')) {
    if (segment === '.') continue;
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) {
      throw new ProofPlanBlockedError(
        `verification cwd rejected: ${JSON.stringify(cwd)} does not exist`,
      );
    }
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) {
      throw new ProofPlanBlockedError(
        `verification cwd rejected: ${JSON.stringify(cwd)} crosses symlink ${JSON.stringify(cursor)}`,
      );
    }
    const cursorReal = realpathSync.native(cursor);
    if (!isInsideOrSame(rootReal, cursorReal)) {
      throw new ProofPlanBlockedError(
        `verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root through ${JSON.stringify(cursor)}`,
      );
    }
  }
  const targetReal = realpathSync.native(targetAbs);
  if (!isInsideOrSame(rootReal, targetReal)) {
    throw new ProofPlanBlockedError(
      `verification cwd rejected: ${JSON.stringify(cwd)} escapes real project root`,
    );
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

function commandBinaryName(argv0: string): string {
  const normalized = argv0.replaceAll('\\', '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase();
}

function packageScriptInvocation(command: VerificationCommand): string | undefined {
  const argv0 = command.argv[0];
  if (argv0 === undefined) return undefined;
  const binary = commandBinaryName(argv0);
  if (binary !== 'npm' && binary !== 'pnpm' && binary !== 'yarn') return undefined;
  if (command.argv[1] !== 'run') return undefined;
  const script = command.argv[2];
  if (script === undefined) {
    throw new ProofPlanBlockedError(
      `Proof plan blocked: verification command '${command.id}' invokes ${binary} run without a script name.`,
    );
  }
  return script;
}

function preflightPackageScript(command: VerificationCommand, cwdAbs: string): void {
  const script = packageScriptInvocation(command);
  if (script === undefined) return;

  const packageJsonPath = join(cwdAbs, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new ProofPlanBlockedError(
      `Proof plan blocked: verification command '${command.id}' requires package.json at cwd ${JSON.stringify(command.cwd)}.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ProofPlanBlockedError(
      `Proof plan blocked: verification command '${command.id}' could not parse package.json at cwd ${JSON.stringify(command.cwd)}: ${message}.`,
    );
  }

  const scripts =
    parsed && typeof parsed === 'object' ? (parsed as { scripts?: unknown }).scripts : undefined;
  if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) {
    throw new ProofPlanBlockedError(
      `Proof plan blocked: verification command '${command.id}' requires package.json scripts at cwd ${JSON.stringify(command.cwd)}.`,
    );
  }
  if (typeof (scripts as Record<string, unknown>)[script] !== 'string') {
    throw new ProofPlanBlockedError(
      `Proof plan blocked: verification command '${command.id}' references missing package script "${script}" at cwd ${JSON.stringify(command.cwd)}.`,
    );
  }
}

function isLaunchError(error: Error): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'EACCES' || code === 'ENOTDIR';
}

function runCommand(command: VerificationCommand, projectRoot: string) {
  const started = Date.now();
  const cwd = resolveProjectRelativeCwd(projectRoot, command.cwd);
  preflightPackageScript(command, cwd);
  const result = spawnSync(command.argv[0] as string, command.argv.slice(1), {
    cwd,
    env: verificationEnvironment(command.env),
    encoding: 'utf8',
    maxBuffer: command.max_output_bytes,
    shell: false,
    timeout: command.timeout_ms,
  });
  if (result.error !== undefined && isLaunchError(result.error)) {
    throw new ProofPlanBlockedError(
      `Proof plan blocked: verification command '${command.id}' could not launch ${JSON.stringify(command.argv[0])}: ${result.error.message}`,
    );
  }
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
    const compiledFlow = requireCompiledFlow(context, step);
    const compiledStep = requireCompiledStep(context, step, 'verification');
    const builder = findVerificationWriter(reportSchema);
    if (builder === undefined) {
      throw new Error(`verification step '${step.id}' has unsupported report schema`);
    }

    const builderContext = {
      runFolder: context.runDir,
      flow: compiledFlow,
      step: compiledStep,
    };
    const commands = builder.loadCommands(builderContext);
    const observations = commands.map((command) => runCommand(command, projectRoot));
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
  const recoveryRoute = recoveryRouteForExecutableStep(step);
  if (recoveryRoute !== undefined) {
    return { route: recoveryRoute, details: { reason } };
  }
  throw new Error(reason);
}
