import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  ChildCompiledFlowResolver,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  CompiledFlowRunner,
  WorktreeRunner,
} from '../../src/compat/retained-runtime.js';
import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import { resultPath } from '../../src/runtime/result-writer.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { type CompiledFlowId, RunId } from '../../src/schemas/ids.js';
import { RunResult } from '../../src/schemas/result.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

// Fanout runtime test. Verifies that a parent flow declaring a
// `fanout` step:
//   - Resolves static and dynamic branches.
//   - Provisions a per-branch worktree via the injected runner.
//   - Runs each branch through the injected childRunner with isolated
//     RunIds and the worktree path as projectRoot.
//   - Emits fanout.{started,branch_started,branch_completed,joined}
//     trace_entries with the resolved branch_ids on fanout.started.
//   - Materializes the aggregate report at writes.aggregate.path.
//   - Honors the join policy (pick-winner, disjoint-merge, aggregate-only)
//     and the check.evaluated outcome that follows.
//   - Cleans up worktrees in try/finally even when branches fail.

const PARENT_WORKFLOW_ID = 'parent-fanout' as unknown as CompiledFlowId;
const CHILD_WORKFLOW_ID = 'child-branch' as unknown as CompiledFlowId;

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'fanout omits worktree cleanup or audit linkage',
    acceptance_evidence:
      'parent log carries fanout.started + per-branch fanout.branch_{started,completed} + fanout.joined; aggregate report materialized; worktrees provisioned + released',
    alternate_framing: 'unit test of the fanout handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function unusedRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async () => {
      throw new Error('relayer should not run during fanout-only parent execution');
    },
  };
}

interface ParentCompiledFlowOpts {
  branches: 'static-two' | 'dynamic-from-source';
  policy: 'pick-winner' | 'disjoint-merge' | 'aggregate-only';
  admit?: readonly string[];
  concurrency?: { kind: 'unbounded' } | { kind: 'bounded'; max: number };
  on_child_failure?: 'abort-all' | 'continue-others';
}

function buildParentCompiledFlow(opts: ParentCompiledFlowOpts): CompiledFlow {
  const admit = opts.admit ?? ['ok'];
  const branches =
    opts.branches === 'static-two'
      ? {
          kind: 'static',
          branches: [
            {
              branch_id: 'a',
              flow_ref: {
                flow_id: CHILD_WORKFLOW_ID as unknown as string,
                entry_mode: 'default',
              },
              goal: 'branch-a goal',
              depth: 'standard',
            },
            {
              branch_id: 'b',
              flow_ref: {
                flow_id: CHILD_WORKFLOW_ID as unknown as string,
                entry_mode: 'default',
              },
              goal: 'branch-b goal',
              depth: 'standard',
            },
          ],
        }
      : {
          kind: 'dynamic',
          source_report: 'reports/source.json',
          items_path: 'items',
          template: {
            branch_id: '$item.id',
            flow_ref: {
              flow_id: CHILD_WORKFLOW_ID as unknown as string,
              entry_mode: 'default',
            },
            goal: '$item.goal',
            depth: 'standard',
          },
        };
  const raw = {
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'fanout runtime test parent',
    entry: {
      signals: { include: ['fanout-test'], exclude: [] },
      intent_prefixes: ['fanout-test'],
    },
    entry_modes: [
      {
        name: 'fanout-test',
        start_at: 'fanout-step',
        depth: 'standard',
        description: 'Default fanout entry.',
      },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['fanout-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow fanout runtime test.',
    },
    steps: [
      {
        id: 'fanout-step',
        title: 'Fanout — N parallel branches',
        protocol: 'fanout-protocol@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'fanout',
        branches,
        concurrency: opts.concurrency ?? { kind: 'bounded', max: 4 },
        on_child_failure: opts.on_child_failure ?? 'abort-all',
        writes: {
          branches_dir: 'reports/branches',
          aggregate: { path: 'reports/aggregate.json', schema: 'fanout-aggregate@v1' },
        },
        check: {
          kind: 'fanout_aggregate',
          source: { kind: 'fanout_results', ref: 'aggregate' },
          join: { policy: opts.policy },
          verdicts: { admit },
        },
      },
    ],
  };
  return CompiledFlow.parse(raw);
}

function buildChildCompiledFlow(): CompiledFlow {
  const raw = {
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'fanout test child',
    entry: { signals: { include: ['child'], exclude: [] }, intent_prefixes: ['child'] },
    entry_modes: [
      { name: 'default', start_at: 'child-step', depth: 'standard', description: 'Child entry.' },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['child-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow stub child for fanout test.',
    },
    steps: [
      {
        id: 'child-step',
        title: 'Child compose',
        protocol: 'child-compose@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: {
          report: { path: 'reports/child-compose.json', schema: 'child-compose@v1' },
        },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['summary'],
        },
      },
    ],
  };
  return CompiledFlow.parse(raw);
}

interface BranchVerdictPlan {
  // Map branch_id -> verdict to write into the child's result.json.
  // 'aborted' means the stub childRunner returns outcome='aborted' too.
  readonly verdicts: Record<string, string | 'aborted'>;
}

function makeStubChildRunner(plan: BranchVerdictPlan): CompiledFlowRunner {
  return async (inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> => {
    // Map by goal — branches differ by goal. For static fixtures we use
    // unique goals per branch; for dynamic fixtures the goal includes
    // the substituted $item.goal.
    const planEntry = Object.entries(plan.verdicts).find(
      ([branchId]) => inv.goal.includes(branchId) || inv.runFolder.includes(branchId),
    );
    const verdict: string | 'aborted' = planEntry?.[1] ?? 'ok';
    const outcome: 'complete' | 'aborted' = verdict === 'aborted' ? 'aborted' : 'complete';
    const childResultAbs = resultPath(inv.runFolder);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: inv.runId as unknown as string,
      flow_id: inv.flow.id as unknown as string,
      goal: inv.goal,
      outcome,
      summary: 'stub child result',
      closed_at: new Date(0).toISOString(),
      trace_entries_observed: 1,
      manifest_hash: 'stub-manifest-hash',
      ...(verdict === 'aborted' ? {} : { verdict }),
    });
    writeFileSync(childResultAbs, `${JSON.stringify(body, null, 2)}\n`);
    return {
      runFolder: inv.runFolder,
      result: body,
      snapshot: Snapshot.parse({
        schema_version: 1,
        run_id: body.run_id,
        flow_id: body.flow_id,
        depth: 'standard',
        change_kind: inv.change_kind,
        status: outcome === 'complete' ? 'complete' : 'aborted',
        steps: [],
        trace_entries_consumed: 1,
        manifest_hash: 'stub-manifest-hash',
        updated_at: new Date(0).toISOString(),
      }),
      trace_entries: [],
      relayResults: [],
    };
  };
}

interface WorktreeStub {
  provisioned: Set<string>;
  released: Set<string>;
  changedFilesByPath: Map<string, readonly string[]>;
  runner: WorktreeRunner;
}

function makeStubWorktreeRunner(initial: Map<string, readonly string[]> = new Map()): WorktreeStub {
  const provisioned = new Set<string>();
  const released = new Set<string>();
  const changedFilesByPath = initial;
  const runner: WorktreeRunner = {
    add: ({ worktreePath }) => {
      provisioned.add(worktreePath);
      mkdirSync(worktreePath, { recursive: true });
    },
    remove: (worktreePath: string) => {
      released.add(worktreePath);
    },
    changedFiles: (worktreePath: string) => changedFilesByPath.get(worktreePath) ?? [],
  };
  return { provisioned, released, changedFilesByPath, runner };
}

function makeChildResolver(child: {
  flow: CompiledFlow;
  bytes: Buffer;
}): ChildCompiledFlowResolver {
  return () => child;
}

interface RelayFanoutParentOpts {
  readonly reportSchema?: string;
  readonly admit?: readonly string[];
  readonly provenanceField?: string;
  readonly seedSweepQueue?: boolean;
}

function buildRelayFanoutParent(opts: RelayFanoutParentOpts = {}): CompiledFlow {
  const reportSchema = opts.reportSchema ?? 'runtime-proof-canonical@v1';
  const admit = opts.admit ?? ['ok'];
  const seedSweepQueue = opts.seedSweepQueue === true;
  const fanoutStep = {
    id: 'fanout-step',
    title: 'Fanout relay branch',
    protocol: 'fanout-protocol@v1',
    reads: seedSweepQueue ? ['reports/sweep-queue.json'] : [],
    routes: { pass: '@complete' },
    executor: 'orchestrator',
    kind: 'fanout',
    branches: {
      kind: 'static',
      branches: [
        {
          branch_id: 'a',
          execution: {
            kind: 'relay',
            role: 'researcher',
            goal: 'branch-a goal',
            report_schema: reportSchema,
            ...(opts.provenanceField === undefined
              ? {}
              : { provenance_field: opts.provenanceField }),
          },
        },
      ],
    },
    concurrency: { kind: 'bounded', max: 1 },
    on_child_failure: 'abort-all',
    writes: {
      branches_dir: 'reports/branches',
      aggregate: { path: 'reports/aggregate.json', schema: 'fanout-aggregate@v1' },
    },
    check: {
      kind: 'fanout_aggregate',
      source: { kind: 'fanout_results', ref: 'aggregate' },
      join: { policy: 'aggregate-only' },
      verdicts: { admit },
    },
  };
  const steps = seedSweepQueue
    ? [
        {
          id: 'seed-sweep-queue',
          title: 'Seed Sweep queue',
          protocol: 'seed-sweep-queue@v1',
          reads: [],
          routes: { pass: 'fanout-step' },
          executor: 'orchestrator',
          kind: 'compose',
          writes: { report: { path: 'reports/sweep-queue.json', schema: 'sweep.queue@v1' } },
          check: {
            kind: 'schema_sections',
            source: { kind: 'report', ref: 'report' },
            required: ['classified', 'to_execute', 'deferred'],
          },
        },
        fanoutStep,
      ]
    : [fanoutStep];
  return CompiledFlow.parse({
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'fanout relay failure test parent',
    entry: {
      signals: { include: ['fanout-relay-failure'], exclude: [] },
      intent_prefixes: ['fanout-relay-failure'],
    },
    entry_modes: [
      {
        name: 'fanout-relay-failure',
        start_at: seedSweepQueue ? 'seed-sweep-queue' : 'fanout-step',
        depth: 'standard',
        description: 'Relay fanout failure entry.',
      },
    ],
    stages: [
      {
        id: 'plan-stage',
        title: 'Plan',
        canonical: 'plan',
        steps: seedSweepQueue ? ['seed-sweep-queue', 'fanout-step'] : ['fanout-step'],
      },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
      rationale: 'narrow relay-fanout failure characterization test.',
    },
    steps,
  });
}

async function runRelayFanoutParent(input: {
  readonly parent: CompiledFlow;
  readonly runId: RunId;
  readonly relayer: RelayFn;
  readonly composeWriter?: CompiledFlowInvocation['composeWriter'];
}) {
  const parentRunFolder = join(runFolderBase, input.runId as unknown as string);
  const outcome = await runCompiledFlow({
    runFolder: parentRunFolder,
    flow: input.parent,
    flowBytes: Buffer.from(JSON.stringify(input.parent)),
    runId: input.runId,
    goal: 'relay fanout failure characterization',
    depth: 'standard',
    change_kind: change_kind(),
    now: deterministicNow(Date.UTC(2026, 3, 27, 16, 30, 0)),
    relayer: input.relayer,
    ...(input.composeWriter === undefined ? {} : { composeWriter: input.composeWriter }),
  });
  return { outcome, parentRunFolder };
}

function relayReturning(resultBody: string): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input) => ({
      request_payload: input.prompt,
      receipt_id: 'receipt-a',
      result_body: resultBody,
      duration_ms: 3,
      cli_version: 'test-relay',
    }),
  };
}

function expectRejectedRelayFanoutBranch(input: {
  readonly outcome: Awaited<ReturnType<typeof runCompiledFlow>>;
  readonly parentRunFolder: string;
  readonly reason: RegExp;
  readonly verdict: string;
  readonly resultPath: string;
}): void {
  expect(input.outcome.result.outcome).toBe('aborted');
  expect(input.outcome.result.reason).toMatch(input.reason);

  const branchCompleted = input.outcome.trace_entries.find(
    (entry) => entry.kind === 'fanout.branch_completed',
  );
  if (branchCompleted?.kind !== 'fanout.branch_completed') {
    throw new Error('expected fanout.branch_completed');
  }
  expect(branchCompleted.child_outcome).toBe('aborted');
  expect(branchCompleted.verdict).toBe(input.verdict);
  expect(branchCompleted.result_path).toBe(input.resultPath);

  const branchCheck = input.outcome.trace_entries.find(
    (entry) => entry.kind === 'check.evaluated' && entry.step_id === 'fanout-step-a',
  );
  if (branchCheck?.kind !== 'check.evaluated') {
    throw new Error('expected relay-branch check.evaluated');
  }
  expect(branchCheck.outcome).toBe('fail');
  expect(branchCheck.reason).toMatch(input.reason);

  const aggregate = JSON.parse(
    readFileSync(join(input.parentRunFolder, 'reports', 'aggregate.json'), 'utf8'),
  ) as {
    branches: ReadonlyArray<{
      branch_id: string;
      child_outcome: string;
      verdict: string;
      admitted: boolean;
      result_path: string;
    }>;
  };
  expect(aggregate.branches).toEqual([
    expect.objectContaining({
      branch_id: 'a',
      child_outcome: 'aborted',
      verdict: input.verdict,
      admitted: false,
      result_path: input.resultPath,
    }),
  ]);
}

let runFolderBase: string;
let projectRoot: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-fanout-'));
  projectRoot = mkdtempSync(join(tmpdir(), 'circuit-next-fanout-project-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('fanout runtime', () => {
  it('fans out to two static branches, picks the winner under pick-winner, and cleans up worktrees', async () => {
    const parent = buildParentCompiledFlow({
      branches: 'static-two',
      policy: 'pick-winner',
      admit: ['ok'],
    });
    const parentBytes = Buffer.from(JSON.stringify(parent));
    const child = buildChildCompiledFlow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'branch-a': 'ok', 'branch-b': 'ok' },
    });
    const worktree = makeStubWorktreeRunner();
    const childResolver = makeChildResolver({ flow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222221');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parent,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'fanout pick-winner test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 12, 0, 0)),
      relayer: unusedRelayer(),
      projectRoot,
      childCompiledFlowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    expect(outcome.result.outcome).toBe('complete');

    const fanoutStarted = outcome.trace_entries.find((e) => e.kind === 'fanout.started');
    if (fanoutStarted?.kind !== 'fanout.started') throw new Error('expected fanout.started');
    expect(fanoutStarted.branch_ids).toEqual(['a', 'b']);
    expect(fanoutStarted.on_child_failure).toBe('abort-all');

    const fanoutJoined = outcome.trace_entries.find((e) => e.kind === 'fanout.joined');
    if (fanoutJoined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(fanoutJoined.policy).toBe('pick-winner');
    expect(fanoutJoined.selected_branch_id).toBe('a');
    expect(fanoutJoined.aggregate_path).toBe('reports/aggregate.json');
    expect(fanoutJoined.branches_completed).toBe(2);
    expect(fanoutJoined.branches_failed).toBe(0);

    // Aggregate report materialized.
    const aggregateAbs = join(parentRunFolder, 'reports', 'aggregate.json');
    const aggregateBody = JSON.parse(readFileSync(aggregateAbs, 'utf8')) as {
      branch_count: number;
      winner_branch_id?: string;
      branches: ReadonlyArray<{ branch_id: string; admitted: boolean }>;
    };
    expect(aggregateBody.branch_count).toBe(2);
    expect(aggregateBody.winner_branch_id).toBe('a');

    // Worktrees provisioned and released for both branches.
    expect(worktree.provisioned.size).toBe(2);
    expect(worktree.released.size).toBe(2);
    for (const path of worktree.provisioned) {
      expect(worktree.released.has(path)).toBe(true);
    }
  });

  it('aggregate-only join admits all-complete + parseable branches', async () => {
    const parent = buildParentCompiledFlow({
      branches: 'static-two',
      policy: 'aggregate-only',
      admit: ['ok'],
    });
    const parentBytes = Buffer.from(JSON.stringify(parent));
    const child = buildChildCompiledFlow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'branch-a': 'ok', 'branch-b': 'something-else' },
    });
    const worktree = makeStubWorktreeRunner();
    const childResolver = makeChildResolver({ flow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222222');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parent,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'fanout aggregate-only test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 12, 30, 0)),
      relayer: unusedRelayer(),
      projectRoot,
      childCompiledFlowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    // aggregate-only passes when both branches close cleanly with parseable bodies — verdicts irrelevant.
    expect(outcome.result.outcome).toBe('complete');
    const fanoutJoined = outcome.trace_entries.find((e) => e.kind === 'fanout.joined');
    if (fanoutJoined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(fanoutJoined.policy).toBe('aggregate-only');
    expect(fanoutJoined.selected_branch_id).toBeUndefined();
  });

  it('fans out relay branches with per-branch request, receipt, result, report, and aggregate provenance', async () => {
    const parent = CompiledFlow.parse({
      schema_version: '2',
      id: PARENT_WORKFLOW_ID as unknown as string,
      version: '0.1.0',
      purpose: 'fanout relay branch test parent',
      entry: {
        signals: { include: ['fanout-relay'], exclude: [] },
        intent_prefixes: ['fanout-relay'],
      },
      entry_modes: [
        {
          name: 'fanout-relay',
          start_at: 'fanout-step',
          depth: 'standard',
          description: 'Relay fanout entry.',
        },
      ],
      stages: [{ id: 'plan-stage', title: 'Plan', canonical: 'plan', steps: ['fanout-step'] }],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
        rationale: 'narrow relay-fanout runtime test.',
      },
      steps: [
        {
          id: 'fanout-step',
          title: 'Fanout relay branches',
          protocol: 'fanout-protocol@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'orchestrator',
          kind: 'fanout',
          branches: {
            kind: 'static',
            branches: [
              {
                branch_id: 'a',
                execution: {
                  kind: 'relay',
                  role: 'researcher',
                  goal: 'branch-a goal',
                  report_schema: 'runtime-proof-canonical@v1',
                },
              },
              {
                branch_id: 'b',
                execution: {
                  kind: 'relay',
                  role: 'researcher',
                  goal: 'branch-b goal',
                  report_schema: 'runtime-proof-canonical@v1',
                },
              },
            ],
          },
          concurrency: { kind: 'bounded', max: 2 },
          on_child_failure: 'abort-all',
          writes: {
            branches_dir: 'reports/branches',
            aggregate: { path: 'reports/aggregate.json', schema: 'fanout-aggregate@v1' },
          },
          check: {
            kind: 'fanout_aggregate',
            source: { kind: 'fanout_results', ref: 'aggregate' },
            join: { policy: 'aggregate-only' },
            verdicts: { admit: ['ok'] },
          },
        },
      ],
    });
    const parentBytes = Buffer.from(JSON.stringify(parent));
    const relayer: RelayFn = {
      connectorName: 'claude-code',
      relay: async (input) => {
        const branch = input.prompt.includes('branch-a goal') ? 'a' : 'b';
        return {
          request_payload: input.prompt,
          receipt_id: `receipt-${branch}`,
          result_body: JSON.stringify({ verdict: 'ok', branch }),
          duration_ms: 3,
          cli_version: 'test-relay',
        };
      },
    };

    const parentRunId = RunId.parse('22222222-2222-2222-2222-22222222222c');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parent,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'fanout relay branch test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 16, 0, 0)),
      relayer,
    });

    expect(outcome.result.outcome).toBe('complete');
    const relayStarted = outcome.trace_entries.filter((e) => e.kind === 'relay.started');
    expect(relayStarted.map((e) => e.step_id).sort()).toEqual(['fanout-step-a', 'fanout-step-b']);

    for (const branch of ['a', 'b']) {
      const branchDir = join(parentRunFolder, 'reports', 'branches', branch);
      expect(existsSync(join(branchDir, 'request.txt'))).toBe(true);
      expect(existsSync(join(branchDir, 'receipt.txt'))).toBe(true);
      expect(existsSync(join(branchDir, 'result.json'))).toBe(true);
      expect(existsSync(join(branchDir, 'report.json'))).toBe(true);
    }

    const aggregate = JSON.parse(
      readFileSync(join(parentRunFolder, 'reports', 'aggregate.json'), 'utf8'),
    ) as {
      branches: ReadonlyArray<{
        branch_id: string;
        result_path: string;
        result_body?: { verdict: string; branch: string };
      }>;
    };
    expect(aggregate.branches.map((branch) => branch.branch_id).sort()).toEqual(['a', 'b']);
    for (const branch of aggregate.branches) {
      expect(branch.result_path).toBe(`reports/branches/${branch.branch_id}/report.json`);
      expect(branch.result_body).toEqual({ verdict: 'ok', branch: branch.branch_id });
    }
  });

  it('maps relay-fanout connector failure to an aborted branch outcome', async () => {
    const parent = buildRelayFanoutParent();
    const { outcome, parentRunFolder } = await runRelayFanoutParent({
      parent,
      runId: RunId.parse('22222222-2222-2222-2222-222222222230'),
      relayer: {
        connectorName: 'claude-code',
        relay: async () => {
          throw new Error('upstream connector exploded');
        },
      },
    });

    expectRejectedRelayFanoutBranch({
      outcome,
      parentRunFolder,
      reason:
        /relay fanout branch 'a': connector invocation failed \(upstream connector exploded\)/,
      verdict: '<no-verdict>',
      resultPath: 'reports/branches/a/result.json',
    });
    expect(outcome.trace_entries.some((entry) => entry.kind === 'relay.failed')).toBe(true);
    expect(outcome.trace_entries.some((entry) => entry.kind === 'relay.completed')).toBe(false);
  });

  it('maps relay-fanout invalid JSON to an aborted branch outcome', async () => {
    const parent = buildRelayFanoutParent();
    const { outcome, parentRunFolder } = await runRelayFanoutParent({
      parent,
      runId: RunId.parse('22222222-2222-2222-2222-222222222231'),
      relayer: relayReturning('not-json{{{'),
    });

    expectRejectedRelayFanoutBranch({
      outcome,
      parentRunFolder,
      reason: /did not parse as JSON/,
      verdict: '<no-verdict>',
      resultPath: 'reports/branches/a/result.json',
    });
    expect(existsSync(join(parentRunFolder, 'reports', 'branches', 'a', 'result.json'))).toBe(true);
    expect(existsSync(join(parentRunFolder, 'reports', 'branches', 'a', 'report.json'))).toBe(
      false,
    );
  });

  it('maps relay-fanout bad verdict to an aborted branch outcome', async () => {
    const parent = buildRelayFanoutParent();
    const { outcome, parentRunFolder } = await runRelayFanoutParent({
      parent,
      runId: RunId.parse('22222222-2222-2222-2222-222222222232'),
      relayer: relayReturning(JSON.stringify({ verdict: 'reject' })),
    });

    expectRejectedRelayFanoutBranch({
      outcome,
      parentRunFolder,
      reason: /not in check\.pass/,
      verdict: 'reject',
      resultPath: 'reports/branches/a/result.json',
    });
  });

  it('maps relay-fanout report schema failure to an aborted branch outcome', async () => {
    const parent = buildRelayFanoutParent({ reportSchema: 'runtime-proof-strict@v1' });
    const { outcome, parentRunFolder } = await runRelayFanoutParent({
      parent,
      runId: RunId.parse('22222222-2222-2222-2222-222222222233'),
      relayer: relayReturning(JSON.stringify({ verdict: 'ok' })),
    });

    expectRejectedRelayFanoutBranch({
      outcome,
      parentRunFolder,
      reason: /runtime-proof-strict@v1/,
      verdict: 'ok',
      resultPath: 'reports/branches/a/result.json',
    });
    expect(outcome.result.reason).toMatch(/rationale/);
  });

  it('maps relay-fanout provenance failure to an aborted branch outcome', async () => {
    const parent = buildRelayFanoutParent({ provenanceField: 'branch' });
    const { outcome, parentRunFolder } = await runRelayFanoutParent({
      parent,
      runId: RunId.parse('22222222-2222-2222-2222-222222222234'),
      relayer: relayReturning(JSON.stringify({ verdict: 'ok', branch: 'wrong-branch' })),
    });

    expectRejectedRelayFanoutBranch({
      outcome,
      parentRunFolder,
      reason: /report field 'branch' must equal branch_id 'a'/,
      verdict: 'ok',
      resultPath: 'reports/branches/a/result.json',
    });
  });

  it('maps relay-fanout cross-report failure to an aborted branch outcome', async () => {
    const parent = buildRelayFanoutParent({
      reportSchema: 'sweep.batch@v1',
      admit: ['accept'],
      seedSweepQueue: true,
    });
    const writeSweepQueue = (input: {
      runFolder: string;
      step: { writes: { report: { path: string } } };
    }): void => {
      const dest = join(input.runFolder, input.step.writes.report.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(
        dest,
        `${JSON.stringify(
          {
            classified: [
              { candidate_id: 'c-1', action: 'act', rationale: 'authorized cleanup' },
              { candidate_id: 'c-99', action: 'defer', rationale: 'not authorized' },
            ],
            to_execute: ['c-1'],
            deferred: ['c-99'],
          },
          null,
          2,
        )}\n`,
      );
    };
    const offPrescriptionBatch = {
      verdict: 'accept',
      summary: 'executed the wrong candidate',
      changed_files: ['src/off-prescription.ts'],
      items: [{ candidate_id: 'c-99', status: 'acted', evidence: 'off prescription' }],
    };
    const { outcome, parentRunFolder } = await runRelayFanoutParent({
      parent,
      runId: RunId.parse('22222222-2222-2222-2222-222222222235'),
      relayer: relayReturning(JSON.stringify(offPrescriptionBatch)),
      composeWriter: writeSweepQueue as never,
    });

    expectRejectedRelayFanoutBranch({
      outcome,
      parentRunFolder,
      reason: /not in queue\.to_execute/,
      verdict: 'accept',
      resultPath: 'reports/branches/a/result.json',
    });
  });

  it('disjoint-merge fails when two branches modify the same file', async () => {
    const parent = buildParentCompiledFlow({
      branches: 'static-two',
      policy: 'disjoint-merge',
      admit: ['ok'],
    });
    const parentBytes = Buffer.from(JSON.stringify(parent));
    const child = buildChildCompiledFlow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'branch-a': 'ok', 'branch-b': 'ok' },
    });
    // Pre-set changedFiles to overlap between the two branches.
    const initialChangedFiles = new Map<string, readonly string[]>();
    const worktree = makeStubWorktreeRunner(initialChangedFiles);
    // Override the runner so we can record worktree paths AT add-time
    // and seed changedFiles for them.
    const originalAdd = worktree.runner.add;
    worktree.runner.add = (input) => {
      originalAdd(input);
      // Both branches "modified" the same file.
      worktree.changedFilesByPath.set(input.worktreePath, ['shared.txt']);
    };
    const childResolver = makeChildResolver({ flow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222223');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parent,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'fanout disjoint-merge collision test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 13, 0, 0)),
      relayer: unusedRelayer(),
      projectRoot,
      childCompiledFlowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain('disjoint-merge');
    expect(outcome.result.reason).toContain('shared.txt');
  });

  it('expands dynamic branches from a source report via $item.<key> templates', async () => {
    // For dynamic, the parent schematic needs a compose upstream that
    // materializes the source report before fanout reads it. The
    // simplest path: build a 2-step parent (compose → fanout) where
    // compose writes source.json via the injected composeWriter.
    const child = buildChildCompiledFlow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const dynamicParent = CompiledFlow.parse({
      schema_version: '2',
      id: PARENT_WORKFLOW_ID as unknown as string,
      version: '0.1.0',
      purpose: 'fanout dynamic test',
      entry: { signals: { include: ['fanout-dyn'], exclude: [] }, intent_prefixes: ['fanout-dyn'] },
      entry_modes: [
        { name: 'fanout-dyn', start_at: 'seed-source', depth: 'standard', description: 'Dynamic.' },
      ],
      stages: [
        { id: 'plan-stage', title: 'Plan', canonical: 'plan', steps: ['seed-source'] },
        { id: 'act-stage', title: 'Act', canonical: 'act', steps: ['fanout-step'] },
      ],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'verify', 'review', 'close'],
        rationale: 'narrow dynamic-fanout test.',
      },
      steps: [
        {
          id: 'seed-source',
          title: 'Seed source report for fanout expansion',
          protocol: 'seed-source@v1',
          reads: [],
          routes: { pass: 'fanout-step' },
          executor: 'orchestrator',
          kind: 'compose',
          writes: { report: { path: 'reports/source.json', schema: 'fanout-source@v1' } },
          check: {
            kind: 'schema_sections',
            source: { kind: 'report', ref: 'report' },
            required: ['items'],
          },
        },
        {
          id: 'fanout-step',
          title: 'Fanout — dynamic branches',
          protocol: 'fanout-protocol@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'orchestrator',
          kind: 'fanout',
          branches: {
            kind: 'dynamic',
            source_report: 'reports/source.json',
            items_path: 'items',
            template: {
              branch_id: '$item.id',
              flow_ref: {
                flow_id: CHILD_WORKFLOW_ID as unknown as string,
                entry_mode: 'default',
              },
              goal: '$item.goal',
              depth: 'standard',
            },
          },
          concurrency: { kind: 'bounded', max: 4 },
          on_child_failure: 'continue-others',
          writes: {
            branches_dir: 'reports/branches',
            aggregate: { path: 'reports/aggregate.json', schema: 'fanout-aggregate@v1' },
          },
          check: {
            kind: 'fanout_aggregate',
            source: { kind: 'fanout_results', ref: 'aggregate' },
            join: { policy: 'aggregate-only' },
            verdicts: { admit: ['ok'] },
          },
        },
      ],
    });
    const dynamicParentBytes = Buffer.from(JSON.stringify(dynamicParent));

    const seedSourceReport = (input: {
      runFolder: string;
      step: { writes: { report: { path: string } } };
    }): void => {
      const dest = join(input.runFolder, input.step.writes.report.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(
        dest,
        `${JSON.stringify(
          {
            items: [
              { id: 'batch-1', goal: 'goal for batch-1' },
              { id: 'batch-2', goal: 'goal for batch-2' },
            ],
          },
          null,
          2,
        )}\n`,
      );
    };

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'batch-1': 'ok', 'batch-2': 'ok' },
    });
    const worktree = makeStubWorktreeRunner();
    const childResolver = makeChildResolver({ flow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222224');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: dynamicParent,
      flowBytes: dynamicParentBytes,
      runId: parentRunId,
      goal: 'dynamic fanout test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 14, 0, 0)),
      relayer: unusedRelayer(),
      projectRoot,
      composeWriter: seedSourceReport as never,
      childCompiledFlowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    expect(outcome.result.outcome).toBe('complete');

    const fanoutStarted = outcome.trace_entries.find((e) => e.kind === 'fanout.started');
    if (fanoutStarted?.kind !== 'fanout.started') throw new Error('expected fanout.started');
    expect(fanoutStarted.branch_ids).toEqual(['batch-1', 'batch-2']);

    const fanoutJoined = outcome.trace_entries.find((e) => e.kind === 'fanout.joined');
    if (fanoutJoined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(fanoutJoined.policy).toBe('aggregate-only');
    expect(fanoutJoined.branches_completed).toBe(2);
  });

  it('continue-others lets the parent join after one branch aborts (the other still completes)', async () => {
    // Coverage gap from the Stage 4 audit: continue-others was only
    // exercised in the dynamic fixture where every branch succeeded.
    // This case proves the parent does NOT propagate a single child
    // abort when on_child_failure='continue-others' is set.
    const parent = buildParentCompiledFlow({
      branches: 'static-two',
      policy: 'aggregate-only',
      on_child_failure: 'continue-others',
    });
    const parentBytes = Buffer.from(JSON.stringify(parent));
    const child = buildChildCompiledFlow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'branch-a': 'aborted', 'branch-b': 'ok' },
    });
    const worktree = makeStubWorktreeRunner();
    const childResolver = makeChildResolver({ flow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-22222222222a');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parent,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'fanout continue-others test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 15, 0, 0)),
      relayer: unusedRelayer(),
      projectRoot,
      childCompiledFlowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    // continue-others lets the fanout STEP complete (one branch
    // succeeded, one failed, the loop did not propagate the failure).
    // The aggregate-only join then evaluates: it requires every
    // branch to close cleanly with a parseable body, so it fails —
    // and the parent run aborts at the check. The behavioral
    // distinction continue-others draws is "the loop continues vs.
    // the loop aborts the moment one branch fails," which the
    // trace_entries surface and we pin here. The parent outcome is
    // intentionally pinned too so a future regression that
    // accidentally skipped the check fail (or accidentally aborted
    // mid-loop) flips this test red.
    const fanoutStarted = outcome.trace_entries.find((e) => e.kind === 'fanout.started');
    if (fanoutStarted?.kind !== 'fanout.started') throw new Error('expected fanout.started');
    expect(fanoutStarted.on_child_failure).toBe('continue-others');

    const fanoutJoined = outcome.trace_entries.find((e) => e.kind === 'fanout.joined');
    if (fanoutJoined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(fanoutJoined.branches_completed).toBe(1);
    expect(fanoutJoined.branches_failed).toBe(1);

    // The parent ultimately aborts because the join policy
    // (aggregate-only) requires every branch to complete cleanly.
    expect(outcome.result.outcome).toBe('aborted');

    // Both worktrees were still released — even on the failed branch.
    expect(worktree.provisioned.size).toBe(2);
    expect(worktree.released.size).toBe(2);
    for (const path of worktree.provisioned) {
      expect(worktree.released.has(path)).toBe(true);
    }
  });

  it('abort-all aborts the parent on first branch failure (default failure policy)', async () => {
    // Inverse of the continue-others case. abort-all is the default,
    // and a single child abort must cascade to a parent abort.
    const parent = buildParentCompiledFlow({
      branches: 'static-two',
      policy: 'aggregate-only',
      on_child_failure: 'abort-all',
    });
    const parentBytes = Buffer.from(JSON.stringify(parent));
    const child = buildChildCompiledFlow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'branch-a': 'aborted', 'branch-b': 'ok' },
    });
    const worktree = makeStubWorktreeRunner();
    const childResolver = makeChildResolver({ flow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-22222222222b');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parent,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'fanout abort-all test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 15, 30, 0)),
      relayer: unusedRelayer(),
      projectRoot,
      childCompiledFlowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    expect(outcome.result.outcome).toBe('aborted');

    // Worktrees still cleaned up even on the abort path. Pin the
    // exact provisioned count (not >0) so a future refactor that
    // serializes the bounded loop and short-circuits provisioning of
    // later branches doesn't silently regress the multi-branch
    // cleanup invariant.
    expect(worktree.provisioned.size).toBe(2);
    expect(worktree.released.size).toBe(2);
    for (const path of worktree.provisioned) {
      expect(worktree.released.has(path), `worktree at ${path} was not released after abort`).toBe(
        true,
      );
    }
  });
});
