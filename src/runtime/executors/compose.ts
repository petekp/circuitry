import { readFileSync } from 'node:fs';
import {
  findCloseBuilder,
  resolveCloseReadPaths,
} from '../../flows/registries/close-writers/registry.js';
import {
  findComposeBuilder,
  resolveComposeReadPaths,
} from '../../flows/registries/compose-writers/registry.js';
import type { StepOutcome } from '../domain/step.js';
import type { ComposeStep } from '../manifest/executable-flow.js';
import { requireCompiledFlow, requireCompiledStep } from '../run/route-compat.js';
import type { RunContext } from '../run/run-context.js';

function readJsonReport(context: RunContext, path: string): unknown {
  return JSON.parse(readFileSync(context.files.resolve(path), 'utf8')) as unknown;
}

function readOptionalJsonReport(context: RunContext, path: string, required: boolean): unknown {
  try {
    return readJsonReport(context, path);
  } catch (error) {
    if (!required && (error as { readonly code?: unknown }).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function writeRegisteredComposeReport(
  step: ComposeStep,
  context: RunContext,
): Promise<boolean> {
  const report = step.writes?.report;
  if (report?.schema === undefined) return false;

  const flow = requireCompiledFlow(context, step);
  const compiledStep = requireCompiledStep(context, step, 'compose');
  const composeBuilder = findComposeBuilder(report.schema);
  if (composeBuilder !== undefined) {
    const readPaths = resolveComposeReadPaths(composeBuilder, flow, compiledStep);
    const inputs: Record<string, unknown | undefined> = {};
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === undefined ? undefined : readJsonReport(context, path);
    }
    const body = composeBuilder.build({
      runFolder: context.runDir,
      flow,
      step: compiledStep,
      goal: context.goal,
      ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
      ...(context.evidencePolicy === undefined ? {} : { evidencePolicy: context.evidencePolicy }),
      inputs,
    });
    await context.files.writeJson(report, body);
    return true;
  }

  const closeBuilder = findCloseBuilder(report.schema);
  if (closeBuilder !== undefined) {
    const readPaths = resolveCloseReadPaths(closeBuilder, flow, compiledStep);
    const inputs: Record<string, unknown | undefined> = {};
    for (const descriptor of closeBuilder.reads) {
      const path = readPaths[descriptor.name];
      inputs[descriptor.name] =
        path === undefined ? undefined : readOptionalJsonReport(context, path, descriptor.required);
    }
    const body = closeBuilder.build({
      runFolder: context.runDir,
      flow,
      closeStep: compiledStep,
      goal: context.goal,
      inputs,
    });
    await context.files.writeJson(report, body);
    return true;
  }

  throw new Error(
    `no compose report writer registered for schema '${report.schema}' at compose step '${step.id}'`,
  );
}

export async function executeCompose(step: ComposeStep, context: RunContext): Promise<StepOutcome> {
  if (step.writes?.report?.schema !== undefined && context.compiledFlow !== undefined) {
    await writeRegisteredComposeReport(step, context);
    await context.trace.append({
      run_id: context.runId,
      kind: 'step.report_written',
      step_id: step.id,
      attempt: context.activeStepAttempt ?? 1,
      report_path: step.writes.report.path,
      report_schema: step.writes.report.schema,
    });
    return { route: 'pass', details: { writer: step.writer } };
  }

  const body = step.body ?? { stepId: step.id, writer: step.writer };
  const writes = step.writes ?? {};
  await Promise.all(
    Object.values(writes).map((ref) =>
      context.files.writeJson(ref, {
        stepId: step.id,
        writer: step.writer,
        body,
      }),
    ),
  );
  return { route: 'pass', details: { writer: step.writer } };
}
