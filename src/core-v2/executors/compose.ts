import { readFileSync } from 'node:fs';
import {
  findCloseBuilder,
  resolveCloseReadPaths,
} from '../../flows/registries/close-writers/registry.js';
import {
  findComposeBuilder,
  resolveComposeReadPaths,
} from '../../flows/registries/compose-writers/registry.js';
import type { StepOutcomeV2 } from '../domain/step.js';
import type { ComposeStepV2 } from '../manifest/executable-flow.js';
import type { RunContextV2 } from '../run/run-context.js';
import { requireCompiledFlowV1, requireCompiledStepV1 } from '../run/v1-compat.js';

function readJsonReport(context: RunContextV2, path: string): unknown {
  return JSON.parse(readFileSync(context.files.resolve(path), 'utf8')) as unknown;
}

async function writeRegisteredComposeReportV2(
  step: ComposeStepV2,
  context: RunContextV2,
): Promise<boolean> {
  const report = step.writes?.report;
  if (report?.schema === undefined) return false;

  const flow = requireCompiledFlowV1(context, step);
  const compiledStep = requireCompiledStepV1(context, step, 'compose');
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
    for (const [name, path] of Object.entries(readPaths)) {
      inputs[name] = path === undefined ? undefined : readJsonReport(context, path);
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

export async function executeComposeV2(
  step: ComposeStepV2,
  context: RunContextV2,
): Promise<StepOutcomeV2> {
  if (step.writes?.report?.schema !== undefined && context.compiledFlowV1 !== undefined) {
    await writeRegisteredComposeReportV2(step, context);
    await context.trace.append({
      run_id: context.runId,
      kind: 'step.report_written',
      step_id: step.id,
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
