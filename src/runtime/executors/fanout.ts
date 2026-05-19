import { join as joinPath } from 'node:path';
import { FanoutFailurePolicy } from '../../schemas/step.js';
import { buildFanoutAggregate } from '../../shared/fanout-aggregate-report.js';
import { evaluateFanoutJoinPolicy } from '../../shared/fanout-join-policy.js';
import type { RunFileRef } from '../domain/run-file.js';
import type { StepOutcome } from '../domain/step.js';
import {
  branchNeedsWorktree,
  executeRelayFanoutBranch,
  executeSubRunFanoutBranch,
} from '../fanout/branch-execution.js';
import { expandFanoutBranches } from '../fanout/branch-expansion.js';
import type { BranchOutcome, FanoutJoinPolicy } from '../fanout/types.js';
import { gitWorktreeRunner } from '../fanout/worktree.js';
import type { FanoutStep } from '../manifest/executable-flow.js';
import type { RunContext } from '../run/run-context.js';
import type { RelayConnector } from './relay.js';
import {
  type StepExecutionResult,
  stepExecutionFailedFrom,
  stepExecutionOutcome,
  unwrapStepExecutionResult,
} from './result.js';

function aggregateRef(step: FanoutStep): RunFileRef {
  const aggregate = step.writes?.aggregate;
  if (aggregate !== undefined) return aggregate;
  const joinAggregate = (step.join as { readonly aggregate?: RunFileRef }).aggregate;
  if (joinAggregate !== undefined) return joinAggregate;
  throw new Error(`fanout step '${step.id}' is missing writes.aggregate`);
}

function branchesDir(step: FanoutStep): string {
  const branchesDirRef = step.writes?.branches_dir;
  if (branchesDirRef !== undefined) return branchesDirRef.path;
  throw new Error(`fanout step '${step.id}' is missing writes.branches_dir`);
}

function joinPolicy(step: FanoutStep): FanoutJoinPolicy {
  const policy = (step.check as { readonly join?: { readonly policy?: unknown } }).join?.policy;
  if (
    policy === 'pick-winner' ||
    policy === 'disjoint-merge' ||
    policy === 'aggregate-only' ||
    policy === 'aggregate-survivors'
  ) {
    return policy;
  }
  throw new Error(`fanout step '${step.id}' has unsupported join policy`);
}

function admitOrder(step: FanoutStep): readonly string[] {
  const admit = (step.check as { readonly verdicts?: { readonly admit?: unknown } }).verdicts
    ?.admit;
  return Array.isArray(admit)
    ? admit.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function concurrencyLimit(step: FanoutStep): number | 'unbounded' {
  const concurrency = step.concurrency as { readonly kind?: unknown; readonly max?: unknown };
  if (concurrency?.kind === 'unbounded') return 'unbounded';
  if (concurrency?.kind === 'bounded' && typeof concurrency.max === 'number') {
    return concurrency.max;
  }
  return 4;
}

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number | 'unbounded',
  worker: (item: T, abortSignal: { value: boolean }) => Promise<void>,
): Promise<void> {
  const abortSignal = { value: false };
  if (limit === 'unbounded') {
    await Promise.all(items.map((item) => worker(item, abortSignal)));
    return;
  }
  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i += 1) {
    workers.push(
      (async () => {
        while (!abortSignal.value) {
          const index = cursor;
          cursor += 1;
          const item = items[index];
          if (item === undefined) return;
          await worker(item, abortSignal);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

async function executeFanoutInternal(
  step: FanoutStep,
  context: RunContext,
  relayConnector?: RelayConnector,
): Promise<StepOutcome> {
  const attempt = context.activeStepAttempt ?? 1;
  const branchDirRoot = branchesDir(step);
  const aggregate = aggregateRef(step);
  const branches = await expandFanoutBranches(step, context.files, context);
  if (branches.length === 0) {
    throw new Error(`fanout step '${step.id}': branch resolution produced zero branches`);
  }
  const policy = joinPolicy(step);
  if (policy === 'disjoint-merge' && branches.some((branch) => branch.kind !== 'sub-run')) {
    throw new Error(
      `fanout step '${step.id}': disjoint-merge is only supported for sub-run branches with worktrees`,
    );
  }
  const branchIds = branches.map((branch) => branch.branch_id);
  await context.trace.append({
    run_id: context.runId,
    kind: 'fanout.started',
    step_id: step.id,
    attempt,
    branch_ids: branchIds,
    on_child_failure: FanoutFailurePolicy.parse(step.onChildFailure ?? 'abort-all'),
  });

  const worktreeRunner = context.worktreeRunner ?? gitWorktreeRunner;
  const provisioned: string[] = [];
  const outcomes: BranchOutcome[] = [];
  const onChildFailure = step.onChildFailure ?? 'abort-all';
  let branchFiles: ReadonlyMap<string, readonly string[]> | undefined;
  let branchFilesError: string | undefined;

  try {
    await runWithConcurrency(branches, concurrencyLimit(step), async (branch, abortSignal) => {
      if (abortSignal.value) return;
      const branchDirRel = `${branchDirRoot}/${branch.branch_id}`;
      const branchDirAbs = context.files.resolve(branchDirRel);
      let outcome: BranchOutcome;
      if (branch.kind === 'relay') {
        outcome = await executeRelayFanoutBranch(
          step,
          context,
          branch,
          relayConnector,
          branchDirRel,
          branchDirAbs,
        );
      } else {
        if (context.projectRoot === undefined) {
          throw new Error(
            `fanout step '${step.id}': projectRoot is required to anchor per-branch worktrees`,
          );
        }
        const worktreePath = joinPath(
          context.projectRoot,
          '.circuit-next',
          'worktrees',
          context.runId,
          step.id,
          branch.branch_id,
        );
        if (branchNeedsWorktree(branch)) provisioned.push(worktreePath);
        outcome = await executeSubRunFanoutBranch(
          step,
          context,
          branch,
          worktreeRunner,
          branchDirRel,
          worktreePath,
        );
      }
      outcomes.push(outcome);
      if (!outcome.admitted && onChildFailure === 'abort-all') {
        abortSignal.value = true;
      }
    });

    if (policy === 'disjoint-merge' && outcomes.every((outcome) => outcome.admitted)) {
      try {
        const collected = await Promise.all(
          outcomes.map(async (outcome) => {
            const files = worktreeRunner.changedFiles
              ? await Promise.resolve(worktreeRunner.changedFiles(outcome.worktree_path, 'HEAD'))
              : [];
            return [outcome.branch_id, files] as const;
          }),
        );
        branchFiles = new Map(collected);
      } catch (error) {
        branchFilesError = (error as Error).message;
      }
    }
  } finally {
    for (const worktreePath of provisioned) {
      try {
        await Promise.resolve(worktreeRunner.remove(worktreePath));
      } catch {
        // Cleanup is best-effort here, matching the v1 runtime. A leftover
        // worktree is operator-visible but should not hide the primary failure.
      }
    }
  }

  const joinResult = evaluateFanoutJoinPolicy({
    policy,
    stepId: step.id,
    admitOrder: admitOrder(step),
    outcomes: outcomes.map((outcome) => ({
      branch_id: outcome.branch_id,
      child_outcome: outcome.child_outcome,
      verdict: outcome.verdict,
      admitted: outcome.admitted,
      ...(outcome.result_body === undefined ? {} : { result_body: outcome.result_body }),
      ...(outcome.failure_reason === undefined ? {} : { failure_reason: outcome.failure_reason }),
    })),
    ...(branchFiles === undefined ? {} : { branchFiles }),
    ...(branchFilesError === undefined ? {} : { branchFilesError }),
  });

  await context.files.writeJson(
    aggregate,
    buildFanoutAggregate(policy, outcomes, joinResult.winnerBranchId, step.rubric),
  );
  await context.trace.append({
    run_id: context.runId,
    kind: 'step.report_written',
    step_id: step.id,
    attempt,
    report_path: aggregate.path,
    report_schema: aggregate.schema ?? 'fanout-aggregate@v1',
  });
  const branchesCompleted = outcomes.filter(
    (outcome) => outcome.child_outcome === 'complete',
  ).length;
  await context.trace.append({
    run_id: context.runId,
    kind: 'fanout.joined',
    step_id: step.id,
    attempt,
    policy,
    ...(joinResult.winnerBranchId === undefined
      ? {}
      : { selected_branch_id: joinResult.winnerBranchId }),
    aggregate_path: aggregate.path,
    branches_completed: branchesCompleted,
    branches_failed: outcomes.length - branchesCompleted,
  });

  if (joinResult.joinedSuccessfully) {
    await context.trace.append({
      run_id: context.runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'fanout_aggregate',
      outcome: 'pass',
    });
    return { route: 'pass', details: { aggregate: aggregate.path } };
  }

  const reason =
    joinResult.failureReason ?? `fanout step '${step.id}': join policy '${policy}' did not pass`;
  await context.trace.append({
    run_id: context.runId,
    kind: 'check.evaluated',
    step_id: step.id,
    attempt,
    check_kind: 'fanout_aggregate',
    outcome: 'fail',
    reason,
  });
  throw new Error(reason);
}

export async function executeFanoutResult(
  step: FanoutStep,
  context: RunContext,
  relayConnector?: RelayConnector,
): Promise<StepExecutionResult> {
  try {
    return stepExecutionOutcome(await executeFanoutInternal(step, context, relayConnector));
  } catch (error) {
    return stepExecutionFailedFrom(error);
  }
}

export async function executeFanout(
  step: FanoutStep,
  context: RunContext,
  relayConnector?: RelayConnector,
): Promise<StepOutcome> {
  return unwrapStepExecutionResult(await executeFanoutResult(step, context, relayConnector));
}
