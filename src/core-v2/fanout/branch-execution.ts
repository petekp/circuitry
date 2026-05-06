import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { runCrossReportValidator } from '../../flows/registries/cross-report-validators.js';
import { parseReport } from '../../flows/registries/report-schemas.js';
import { CompiledFlow as CompiledFlowSchema } from '../../schemas/compiled-flow.js';
import { RunResult } from '../../schemas/result.js';
import type { RelayStep as CompiledRelayStepV1 } from '../../shared/relay-support.js';
import {
  type ProductionRelayAttemptValidationInputV2,
  type RelayConnectorV2,
  executeProductionRelayAttemptV2,
  relayWithResolvedConnectorV2,
  resolveRelayExecutionV2,
} from '../executors/relay.js';
import type { FanoutStepV2, RelayStepV2 } from '../manifest/executable-flow.js';
import type { WorktreeRunnerV2 } from '../run/child-runner.js';
import type { RunContextV2 } from '../run/run-context.js';
import {
  type BranchOutcomeV2,
  NO_VERDICT_SENTINEL_V2,
  type ResolvedBranchV2,
  type ResolvedRelayBranchV2,
  type ResolvedSubRunBranchV2,
} from './types.js';

function admitList(step: FanoutStepV2): readonly string[] {
  const admit = (step.check as { readonly verdicts?: { readonly admit?: unknown } }).verdicts
    ?.admit;
  return Array.isArray(admit)
    ? admit.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function branchResult(
  body: unknown,
  admit: readonly string[],
): { verdict: string; admitted: boolean } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { verdict: NO_VERDICT_SENTINEL_V2, admitted: false };
  }
  const verdict = (body as { readonly verdict?: unknown }).verdict;
  if (typeof verdict !== 'string' || verdict.length === 0) {
    return { verdict: NO_VERDICT_SENTINEL_V2, admitted: false };
  }
  return { verdict, admitted: admit.includes(verdict) };
}

function parseConnectorResponse(response: unknown): unknown {
  if (typeof response !== 'string') return response;
  return JSON.parse(response);
}

function relayBranchProvenanceFailure(
  branch: ResolvedRelayBranchV2,
  reportBody: unknown,
): string | undefined {
  const field = branch.provenance_field;
  if (field === undefined) return undefined;
  if (reportBody === null || typeof reportBody !== 'object' || Array.isArray(reportBody)) {
    return `relay fanout branch '${branch.branch_id}': report field '${field}' must equal branch_id '${branch.branch_id}' but report body is not an object`;
  }
  const observed = (reportBody as Record<string, unknown>)[field];
  if (observed !== branch.branch_id) {
    return `relay fanout branch '${branch.branch_id}': report field '${field}' must equal branch_id '${branch.branch_id}'`;
  }
  return undefined;
}

function relayBranchReads(step: FanoutStepV2): readonly string[] {
  return (step.reads ?? []).map((ref) => ref.path);
}

function syntheticRelayTitle(step: FanoutStepV2, branch: ResolvedRelayBranchV2): string {
  return `${step.title ?? step.id} / ${branch.branch_id}: ${branch.goal}`;
}

function syntheticRelayStepV2(
  step: FanoutStepV2,
  branch: ResolvedRelayBranchV2,
  branchDirRel: string,
): RelayStepV2 {
  const selection =
    branch.selection === undefined || branch.selection === null
      ? {}
      : { selection: branch.selection as NonNullable<RelayStepV2['selection']> };
  return {
    id: `${step.id}-${branch.branch_id}`,
    title: syntheticRelayTitle(step, branch),
    ...(step.protocol === undefined ? {} : { protocol: step.protocol }),
    routes: { pass: { kind: 'terminal', target: '@complete' } },
    ...(step.reads === undefined ? {} : { reads: step.reads }),
    writes: {
      request: { path: `${branchDirRel}/request.txt` },
      receipt: { path: `${branchDirRel}/receipt.txt` },
      result: { path: `${branchDirRel}/result.json` },
      report: { path: `${branchDirRel}/report.json`, schema: branch.report_schema },
    },
    ...selection,
    check: {
      kind: 'result_verdict',
      source: { kind: 'relay_result', ref: 'result' },
      pass: admitList(step),
    },
    kind: 'relay',
    role: branch.role,
    report: { path: `${branchDirRel}/report.json`, schema: branch.report_schema },
  };
}

function syntheticCompiledRelayStepV1(
  step: FanoutStepV2,
  branch: ResolvedRelayBranchV2,
  branchDirRel: string,
): CompiledRelayStepV1 {
  return {
    id: `${step.id}-${branch.branch_id}` as never,
    title: syntheticRelayTitle(step, branch),
    protocol: (step.protocol ?? `${step.id}@v1`) as never,
    reads: relayBranchReads(step) as never,
    routes: { pass: '@complete' },
    ...(branch.selection === undefined ? {} : { selection: branch.selection as never }),
    executor: 'worker',
    kind: 'relay',
    role: branch.role as never,
    writes: {
      request: `${branchDirRel}/request.txt` as never,
      receipt: `${branchDirRel}/receipt.txt` as never,
      result: `${branchDirRel}/result.json` as never,
      report: {
        path: `${branchDirRel}/report.json` as never,
        schema: branch.report_schema,
      },
    },
    check: {
      kind: 'result_verdict',
      source: { kind: 'relay_result', ref: 'result' },
      pass: [...admitList(step)],
    },
  };
}

function validateAcceptedRelayFanoutBranchV2(
  branch: ResolvedRelayBranchV2,
  input: ProductionRelayAttemptValidationInputV2,
) {
  const parseResult = parseReport(branch.report_schema, input.relayResult.result_body);
  if (parseResult.kind === 'fail') {
    return {
      evaluation: {
        kind: 'fail' as const,
        reason: `relay fanout branch '${branch.branch_id}': ${parseResult.reason}`,
        observedVerdict: input.checkEvaluation.verdict,
      },
    };
  }
  const parsedBody = JSON.parse(input.relayResult.result_body) as unknown;
  const provenanceFailure = relayBranchProvenanceFailure(branch, parsedBody);
  if (provenanceFailure !== undefined) {
    return {
      evaluation: {
        kind: 'fail' as const,
        reason: provenanceFailure,
        observedVerdict: input.checkEvaluation.verdict,
      },
    };
  }
  const crossResult = runCrossReportValidator(
    branch.report_schema,
    input.compiledFlow,
    input.context.runDir,
    input.relayResult.result_body,
  );
  if (crossResult.kind === 'fail') {
    return {
      evaluation: {
        kind: 'fail' as const,
        reason: `relay fanout branch '${branch.branch_id}': ${crossResult.reason}`,
        observedVerdict: input.checkEvaluation.verdict,
      },
    };
  }
  return { evaluation: input.checkEvaluation, parsedBody };
}

export async function executeRelayFanoutBranchV2(
  step: FanoutStepV2,
  context: RunContextV2,
  branch: ResolvedRelayBranchV2,
  relayConnector: RelayConnectorV2 | undefined,
  branchDirRel: string,
  branchDirAbs: string,
): Promise<BranchOutcomeV2> {
  const startMs = Date.now();
  const childRunId = randomUUID();
  const resultPath = `${branchDirRel}/result.json`;
  const reportPath = `${branchDirRel}/report.json`;
  await context.trace.append({
    run_id: context.runId,
    kind: 'fanout.branch_started',
    step_id: step.id,
    branch_id: branch.branch_id,
    branch_kind: 'relay',
    child_run_id: childRunId,
    worktree_path: branchDirAbs,
  });

  try {
    if (relayConnector === undefined && context.compiledFlowV1 !== undefined) {
      const relayStep = syntheticRelayStepV2(step, branch, branchDirRel);
      const relayAttempt = await executeProductionRelayAttemptV2({
        step: relayStep,
        compiledStep: syntheticCompiledRelayStepV1(step, branch, branchDirRel),
        context,
        formatConnectorFailureReason: (_stepId, error) => {
          const reason = error instanceof Error ? error.message : String(error);
          return `relay fanout branch '${branch.branch_id}': connector invocation failed (${reason})`;
        },
        validateAcceptedResult: (input) => validateAcceptedRelayFanoutBranchV2(branch, input),
      });
      const durationMs = Math.max(0, Date.now() - startMs);
      const outcome =
        relayAttempt.kind === 'connector_failed'
          ? {
              child_outcome: 'aborted' as const,
              verdict: NO_VERDICT_SENTINEL_V2,
              result_path: resultPath,
              admitted: false,
              failure_reason: relayAttempt.reason,
            }
          : relayAttempt.evaluation.kind === 'pass'
            ? {
                child_outcome: 'complete' as const,
                verdict: relayAttempt.evaluation.verdict,
                result_path: relayAttempt.report_path ?? reportPath,
                result_body: relayAttempt.parsed_body,
                admitted: true,
              }
            : {
                child_outcome: 'aborted' as const,
                verdict: relayAttempt.relay_completed_verdict,
                result_path: resultPath,
                admitted: false,
                failure_reason: relayAttempt.evaluation.reason,
              };
      await context.trace.append({
        run_id: context.runId,
        kind: 'fanout.branch_completed',
        step_id: step.id,
        branch_id: branch.branch_id,
        branch_kind: 'relay',
        child_run_id: childRunId,
        child_outcome: outcome.child_outcome,
        verdict: outcome.verdict,
        duration_ms: durationMs,
        result_path: outcome.result_path,
      });
      return {
        branch_id: branch.branch_id,
        child_run_id: childRunId,
        worktree_path: branchDirAbs,
        duration_ms: durationMs,
        ...outcome,
      };
    }

    const requestPath = context.files.resolve(`${branchDirRel}/request.json`);
    await mkdir(dirname(requestPath), { recursive: true });
    await writeFile(
      requestPath,
      `${JSON.stringify({ branch_id: branch.branch_id, goal: branch.goal }, null, 2)}\n`,
      'utf8',
    );
    const relayExecution = resolveRelayExecutionV2({
      flowId: context.flow.id,
      role: branch.role,
      selection: branch.selection,
      ...(relayConnector === undefined ? {} : { suppliedConnector: relayConnector }),
      ...(context.selectionConfigLayers === undefined
        ? {}
        : { configLayers: context.selectionConfigLayers }),
    });
    const response =
      relayConnector === undefined
        ? (
            await relayWithResolvedConnectorV2(relayExecution.connector, {
              prompt: branch.goal,
            })
          ).result_body
        : await relayConnector.relay({
            runId: context.runId,
            stepId: `${step.id}-${branch.branch_id}`,
            role: relayExecution.role,
            prompt: branch.goal,
            connector: relayExecution.connectorName,
          });
    const reportBody = parseConnectorResponse(response);
    const provenanceFailure = relayBranchProvenanceFailure(branch, reportBody);
    const evaluation = branchResult(reportBody, admitList(step));
    const admitted = provenanceFailure === undefined && evaluation.admitted;
    await context.files.writeJson(resultPath, reportBody);
    await context.files.writeJson({ path: reportPath, schema: branch.report_schema }, reportBody);
    const receiptPath = context.files.resolve(`${branchDirRel}/receipt.txt`);
    await mkdir(dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, `stub relay receipt for ${branch.branch_id}\n`, 'utf8');
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: 'fanout.branch_completed',
      step_id: step.id,
      branch_id: branch.branch_id,
      branch_kind: 'relay',
      child_run_id: childRunId,
      child_outcome: admitted ? 'complete' : 'aborted',
      verdict: evaluation.verdict,
      duration_ms: durationMs,
      result_path: reportPath,
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: branchDirAbs,
      child_outcome: admitted ? 'complete' : 'aborted',
      verdict: evaluation.verdict,
      result_path: reportPath,
      result_body: reportBody,
      duration_ms: durationMs,
      admitted,
      ...(provenanceFailure === undefined ? {} : { failure_reason: provenanceFailure }),
    };
  } catch (error) {
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: 'fanout.branch_completed',
      step_id: step.id,
      branch_id: branch.branch_id,
      branch_kind: 'relay',
      child_run_id: childRunId,
      child_outcome: 'aborted',
      verdict: NO_VERDICT_SENTINEL_V2,
      duration_ms: durationMs,
      result_path: resultPath,
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: branchDirAbs,
      child_outcome: 'aborted',
      verdict: NO_VERDICT_SENTINEL_V2,
      result_path: resultPath,
      duration_ms: durationMs,
      admitted: false,
      failure_reason: (error as Error).message,
    };
  }
}

export async function executeSubRunFanoutBranchV2(
  step: FanoutStepV2,
  context: RunContextV2,
  branch: ResolvedSubRunBranchV2,
  worktreeRunner: WorktreeRunnerV2,
  branchDirRel: string,
  worktreePath: string,
): Promise<BranchOutcomeV2> {
  const startMs = Date.now();
  const childRunId = randomUUID();
  const resultPath = `${branchDirRel}/result.json`;
  await context.trace.append({
    run_id: context.runId,
    kind: 'fanout.branch_started',
    step_id: step.id,
    branch_id: branch.branch_id,
    branch_kind: 'sub-run',
    child_run_id: childRunId,
    worktree_path: worktreePath,
  });

  if (context.childCompiledFlowResolver === undefined || context.childRunner === undefined) {
    const failureReason = `fanout step '${step.id}': child resolver and child runner are required for sub-run branches`;
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: 'fanout.branch_completed',
      step_id: step.id,
      branch_id: branch.branch_id,
      branch_kind: 'sub-run',
      child_run_id: childRunId,
      child_outcome: 'aborted',
      verdict: NO_VERDICT_SENTINEL_V2,
      duration_ms: durationMs,
      result_path: resultPath,
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: worktreePath,
      child_outcome: 'aborted',
      verdict: NO_VERDICT_SENTINEL_V2,
      result_path: resultPath,
      duration_ms: durationMs,
      admitted: false,
      failure_reason: failureReason,
    };
  }

  try {
    const branchName = `circuit-next/${context.runId}/${step.id}/${branch.branch_id}`;
    await Promise.resolve(worktreeRunner.add({ worktreePath, baseRef: 'HEAD', branchName }));
    const resolved = await context.childCompiledFlowResolver({
      flowId: branch.flowRef,
      entryMode: branch.entryMode,
      ...(branch.version === undefined ? {} : { version: branch.version }),
    });
    const childFlow = CompiledFlowSchema.parse(
      JSON.parse(Buffer.from(resolved.flowBytes).toString('utf8')),
    );
    if (childFlow.id !== branch.flowRef) {
      throw new Error(
        `resolver returned flow id '${childFlow.id}' but branch flow_ref names '${branch.flowRef}'`,
      );
    }
    const childRunDir = join(dirname(context.runDir), childRunId);
    const child = await context.childRunner({
      flowBytes: resolved.flowBytes,
      runDir: childRunDir,
      runId: childRunId,
      goal: branch.goal,
      entryModeName: branch.entryMode,
      depth: branch.depth,
      now: context.now,
      ...(context.childExecutors === undefined ? {} : { executors: context.childExecutors }),
      ...(context.childCompiledFlowResolver === undefined
        ? {}
        : { childCompiledFlowResolver: context.childCompiledFlowResolver }),
      childRunner: context.childRunner,
      projectRoot: worktreePath,
      ...(context.evidencePolicy === undefined ? {} : { evidencePolicy: context.evidencePolicy }),
      worktreeRunner,
      ...(context.relayConnector === undefined ? {} : { relayConnector: context.relayConnector }),
      ...(context.relayer === undefined ? {} : { relayer: context.relayer }),
      ...(context.selectionConfigLayers === undefined
        ? {}
        : { selectionConfigLayers: context.selectionConfigLayers }),
      ...(context.progress === undefined ? {} : { progress: context.progress }),
    });
    const childResultText = await readFile(child.resultPath, 'utf8');
    const childResult = RunResult.parse(JSON.parse(childResultText));
    await context.files.writeJson(resultPath, childResult);
    const evaluation = branchResult(childResult, admitList(step));
    const admitted = childResult.outcome === 'complete' && evaluation.admitted;
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: 'fanout.branch_completed',
      step_id: step.id,
      branch_id: branch.branch_id,
      branch_kind: 'sub-run',
      child_run_id: childRunId,
      child_outcome: childResult.outcome,
      verdict: evaluation.verdict,
      duration_ms: durationMs,
      result_path: resultPath,
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: worktreePath,
      child_outcome: childResult.outcome,
      verdict: evaluation.verdict,
      result_path: resultPath,
      result_body: childResult,
      duration_ms: durationMs,
      admitted,
    };
  } catch (error) {
    const durationMs = Math.max(0, Date.now() - startMs);
    await context.trace.append({
      run_id: context.runId,
      kind: 'fanout.branch_completed',
      step_id: step.id,
      branch_id: branch.branch_id,
      branch_kind: 'sub-run',
      child_run_id: childRunId,
      child_outcome: 'aborted',
      verdict: NO_VERDICT_SENTINEL_V2,
      duration_ms: durationMs,
      result_path: resultPath,
    });
    return {
      branch_id: branch.branch_id,
      child_run_id: childRunId,
      worktree_path: worktreePath,
      child_outcome: 'aborted',
      verdict: NO_VERDICT_SENTINEL_V2,
      result_path: resultPath,
      duration_ms: durationMs,
      admitted: false,
      failure_reason: (error as Error).message,
    };
  }
}

export function branchNeedsWorktree(branch: ResolvedBranchV2): boolean {
  return branch.kind === 'sub-run';
}
