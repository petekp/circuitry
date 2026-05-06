// Direct unit tests for the fanout step handler.
//
// `fanout-runtime.test.ts` and `fanout-real-recursion.test.ts` exercise
// the handler transitively through full runCompiledFlow runs. Neither
// covers the handler-local pre-execution aborts (childCompiledFlowResolver
// / projectRoot undefined, branch resolution throws, zero-branches),
// the per-branch failure paths (worktree provisioning throw, resolver
// throw, child runner throw), or each join-policy decision lattice in
// isolation. This file invokes `runFanoutStep` directly against a
// minimal in-memory `StepHandlerContext` so each handler-local branch
// is pinned with named-failure attribution.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
import { resultPath } from '../../src/runtime/result-writer.js';
import { runFanoutStep } from '../../src/runtime/step-handlers/fanout.js';
import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { type CompiledFlowId, RunId } from '../../src/schemas/ids.js';
import { RunResult } from '../../src/schemas/result.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import type { TraceEntry } from '../../src/schemas/trace-entry.js';

const PARENT_WORKFLOW_ID = 'fanout-direct-parent' as unknown as CompiledFlowId;
const CHILD_WORKFLOW_ID = 'fanout-direct-child' as unknown as CompiledFlowId;
const PARENT_RUN_ID = RunId.parse('88888888-8888-8888-8888-888888888888');

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'fanout handler emits the wrong trace_entry sequence on a known pre-execution, branch-level, or join-policy path',
    acceptance_evidence:
      'each handler-local error path emits the expected check.evaluated/fail + step.aborted pair with the right reason; each happy path emits fanout.joined + check.evaluated/pass',
    alternate_framing: 'unit test of the fanout step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

type JoinPolicy = 'pick-winner' | 'disjoint-merge' | 'aggregate-only';

interface ParentCompiledFlowOpts {
  readonly branches:
    | { readonly kind: 'static'; readonly branchIds: readonly string[] }
    | { readonly kind: 'dynamic'; readonly sourceReport: string; readonly itemsPath: string };
  readonly policy: JoinPolicy;
  readonly admit?: readonly string[];
  readonly onChildFailure?: 'abort-all' | 'continue-others';
}

function buildParentCompiledFlow(opts: ParentCompiledFlowOpts): CompiledFlow {
  const admit = opts.admit ?? ['ok'];
  const branches =
    opts.branches.kind === 'static'
      ? {
          kind: 'static',
          branches: opts.branches.branchIds.map((id) => ({
            branch_id: id,
            flow_ref: {
              flow_id: CHILD_WORKFLOW_ID as unknown as string,
              entry_mode: 'default',
            },
            goal: `branch-${id} goal`,
            depth: 'standard',
          })),
        }
      : {
          kind: 'dynamic',
          source_report: opts.branches.sourceReport,
          items_path: opts.branches.itemsPath,
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
  return CompiledFlow.parse({
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'fanout handler direct-test fixture (parent).',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'fanout-step',
        depth: 'standard',
        description: 'parent fixture',
      },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['fanout-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow direct fanout handler test fixture',
    },
    steps: [
      {
        id: 'fanout-step',
        title: 'Fanout — direct handler test',
        protocol: 'fanout-direct@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'fanout',
        branches,
        concurrency: { kind: 'bounded', max: 4 },
        on_child_failure: opts.onChildFailure ?? 'abort-all',
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
  });
}

function buildChildCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse({
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'fanout handler direct-test fixture (child) — never executed end-to-end.',
    entry: { signals: { include: ['y'], exclude: [] }, intent_prefixes: ['y'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'child-step',
        depth: 'standard',
        description: 'child fixture',
      },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['child-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow direct fanout handler test child',
    },
    steps: [
      {
        id: 'child-step',
        title: 'Child compose stub',
        protocol: 'fanout-direct-child@v1',
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
  });
}

interface BranchPlanEntry {
  // 'aborted' makes the stub childRunner return outcome='aborted'; any
  // other string is the verdict written into the child result body.
  // 'throw' makes the stub childRunner throw an Error.
  // 'checkpoint' makes the stub return outcome='checkpoint_waiting'.
  readonly mode: 'verdict' | 'aborted' | 'throw' | 'checkpoint';
  readonly verdict?: string;
}

function makeStubChildRunner(plan: Record<string, BranchPlanEntry>): CompiledFlowRunner {
  return async (inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> => {
    // Match plan entry by goal — the parent constructs goals as
    // "branch-<id> goal" (static) or "$item.goal" (dynamic). The plan key
    // must appear in inv.goal for matching.
    const planEntry = Object.entries(plan).find(([branchId]) => inv.goal.includes(branchId));
    const entry: BranchPlanEntry = planEntry?.[1] ?? { mode: 'verdict', verdict: 'ok' };
    if (entry.mode === 'throw') throw new Error('child runner exploded');
    if (entry.mode === 'checkpoint') {
      return {
        runFolder: inv.runFolder,
        result: {
          schema_version: 1,
          run_id: inv.runId,
          flow_id: inv.flow.id,
          goal: inv.goal,
          outcome: 'checkpoint_waiting',
          summary: 'stub child waiting at checkpoint',
          trace_entries_observed: 1,
          manifest_hash: 'stub-manifest-hash',
          checkpoint: {
            step_id: 'frame-checkpoint',
            request_path: 'reports/checkpoint.request.json',
            allowed_choices: ['continue', 'stop'],
          },
        },
        snapshot: Snapshot.parse({
          schema_version: 1,
          run_id: inv.runId as unknown as string,
          flow_id: inv.flow.id as unknown as string,
          depth: inv.depth ?? 'standard',
          change_kind: inv.change_kind,
          status: 'in_progress',
          steps: [],
          trace_entries_consumed: 1,
          manifest_hash: 'stub-manifest-hash',
          updated_at: new Date(0).toISOString(),
        }),
        trace_entries: [],
        relayResults: [],
      };
    }
    const outcome: 'complete' | 'aborted' = entry.mode === 'aborted' ? 'aborted' : 'complete';
    const childResultAbs = resultPath(inv.runFolder);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: inv.runId as unknown as string,
      flow_id: inv.flow.id as unknown as string,
      goal: inv.goal,
      outcome,
      summary: 'stub child for fanout direct test',
      closed_at: new Date(0).toISOString(),
      trace_entries_observed: 1,
      manifest_hash: 'stub-manifest-hash',
      ...(outcome === 'aborted' ? {} : { verdict: entry.verdict ?? 'ok' }),
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

function makeStubWorktreeRunner(
  opts: {
    readonly throwOnAdd?: readonly string[];
    readonly changedFilesByBranch?: Record<string, readonly string[]>;
  } = {},
): WorktreeStub {
  const provisioned = new Set<string>();
  const released = new Set<string>();
  const changedFilesByPath = new Map<string, readonly string[]>();
  const throwOnAddBranches = new Set(opts.throwOnAdd ?? []);
  const runner: WorktreeRunner = {
    add: ({ worktreePath }) => {
      // worktreePath ends in `/<step_id>/<branch_id>`. Match by the
      // branch_id segment.
      const branchId = worktreePath.split('/').pop() ?? '';
      if (throwOnAddBranches.has(branchId)) {
        throw new Error(`stub worktreeRunner.add refused branch '${branchId}'`);
      }
      provisioned.add(worktreePath);
      mkdirSync(worktreePath, { recursive: true });
      const files = opts.changedFilesByBranch?.[branchId];
      if (files !== undefined) changedFilesByPath.set(worktreePath, files);
    },
    remove: (worktreePath: string) => {
      released.add(worktreePath);
    },
    changedFiles: (worktreePath: string) => changedFilesByPath.get(worktreePath) ?? [],
  };
  return { provisioned, released, changedFilesByPath, runner };
}

interface BuildHarnessOpts {
  readonly parent: ParentCompiledFlowOpts;
  readonly skipResolver?: boolean;
  readonly resolverThrowsForBranch?: string;
  readonly omitProjectRoot?: boolean;
  readonly worktreeOpts?: Parameters<typeof makeStubWorktreeRunner>[0];
  readonly childPlan?: Record<string, BranchPlanEntry>;
  // For dynamic-branches tests: write a source report at this run-relative
  // path with this body before invoking the handler.
  readonly seedSourceReport?: { readonly path: string; readonly body: unknown };
}

interface Harness {
  readonly trace_entries: TraceEntry[];
  readonly state: RunState;
  readonly worktree: WorktreeStub;
  readonly ctx: StepHandlerContext & {
    readonly step: CompiledFlow['steps'][number] & { kind: 'fanout' };
  };
}

function buildHarness(
  opts: BuildHarnessOpts,
  parentRunFolder: string,
  projectRoot: string,
): Harness {
  const parent = buildParentCompiledFlow(opts.parent);
  const child = buildChildCompiledFlow();
  const childBytes = Buffer.from(JSON.stringify(child));
  const step = parent.steps[0];
  if (step === undefined || step.kind !== 'fanout') {
    throw new Error('test fixture invariant: step[0] must be a fanout step');
  }
  if (opts.seedSourceReport !== undefined) {
    const abs = join(parentRunFolder, opts.seedSourceReport.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(opts.seedSourceReport.body));
  }
  const trace_entries: TraceEntry[] = [];
  const state: RunState = { trace_entries, sequence: 0, relayResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  let resolver: ChildCompiledFlowResolver | undefined;
  if (opts.skipResolver === true) {
    resolver = undefined;
  } else {
    resolver = (ref) => {
      if (
        opts.resolverThrowsForBranch !== undefined &&
        ref.flow_id === (CHILD_WORKFLOW_ID as unknown as string)
      ) {
        // A pure resolver can't see branch_id directly; the test only
        // sets resolverThrowsForBranch when there's a single branch.
        throw new Error(`stub resolver refused branch '${opts.resolverThrowsForBranch}'`);
      }
      return { flow: child, bytes: childBytes };
    };
  }
  const worktree = makeStubWorktreeRunner(opts.worktreeOpts);
  const childRunner = makeStubChildRunner(opts.childPlan ?? {});
  const ctx: StepHandlerContext & {
    readonly step: CompiledFlow['steps'][number] & { kind: 'fanout' };
  } = {
    runFolder: parentRunFolder,
    flow: parent,
    runId: PARENT_RUN_ID,
    goal: 'direct fanout handler test goal',
    change_kind: change_kind(),
    depth: 'standard',
    executionSelectionConfigLayers: [],
    ...(opts.omitProjectRoot === true ? {} : { projectRoot }),
    relayer: {
      connectorName: 'claude-code',
      relay: async () => {
        throw new Error('relayer should not be invoked by these tests');
      },
    },
    composeWriter: () => {
      throw new Error('composeWriter should not be invoked by these tests');
    },
    now,
    recordedAt,
    state,
    push: (ev: TraceEntry) => {
      trace_entries.push({ ...ev, sequence: state.sequence });
      state.sequence += 1;
    },
    step,
    attempt: 1,
    isResumedCheckpoint: false,
    childRunner,
    ...(resolver === undefined ? {} : { childCompiledFlowResolver: resolver }),
    worktreeRunner: worktree.runner,
  };
  return { trace_entries, state, worktree, ctx };
}

let runFolderBase: string;
let parentRunFolder: string;
let projectRoot: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'fanout-handler-direct-'));
  parentRunFolder = join(runFolderBase, 'parent');
  mkdirSync(parentRunFolder, { recursive: true });
  projectRoot = mkdtempSync(join(tmpdir(), 'fanout-handler-direct-project-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('runFanoutStep direct — pre-execution aborts', () => {
  it('aborts when childCompiledFlowResolver is undefined', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        skipResolver: true,
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/childCompiledFlowResolver is required/);
    // No fanout.started should fire — the abort happens before any
    // branch is touched.
    expect(harness.trace_entries.find((e) => e.kind === 'fanout.started')).toBeUndefined();
    const check = harness.trace_entries.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('fail');
    expect(check.check_kind).toBe('fanout_aggregate');
    expect(harness.trace_entries.some((e) => e.kind === 'step.aborted')).toBe(true);
  });

  it('aborts when projectRoot is undefined', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        omitProjectRoot: true,
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/projectRoot is required to anchor per-branch worktrees/);
    expect(harness.trace_entries.find((e) => e.kind === 'fanout.started')).toBeUndefined();
  });

  it('aborts with branch-resolution-failed reason when dynamic source report has wrong shape', async () => {
    // Source report has items_path=items but the resolved value is an
    // object (not an array) — `dynamic fanout: items_path '...' did not
    // resolve to an array (got object)`.
    const harness = buildHarness(
      {
        parent: {
          branches: {
            kind: 'dynamic',
            sourceReport: 'reports/source.json',
            itemsPath: 'items',
          },
          policy: 'pick-winner',
        },
        seedSourceReport: {
          path: 'reports/source.json',
          body: { items: { not: 'an array' } },
        },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/branch resolution failed/);
    expect(result.reason).toMatch(/did not resolve to an array/);
    expect(harness.trace_entries.find((e) => e.kind === 'fanout.started')).toBeUndefined();
  });

  it('aborts with zero-branches reason when dynamic source resolves to an empty array', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: {
            kind: 'dynamic',
            sourceReport: 'reports/source.json',
            itemsPath: 'items',
          },
          policy: 'pick-winner',
        },
        seedSourceReport: {
          path: 'reports/source.json',
          body: { items: [] },
        },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/branch resolution produced zero branches/);
    expect(harness.trace_entries.find((e) => e.kind === 'fanout.started')).toBeUndefined();
  });
});

describe('runFanoutStep direct — branch-level failure paths', () => {
  it('records a branch as aborted when worktreeRunner.add throws', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        worktreeOpts: { throwOnAdd: ['a'] },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    // pick-winner with no admitted branch fails with the policy reason.
    expect(result.reason).toMatch(/pick-winner: no branch closed 'complete' with an admitted/);
    // The branch's branch_completed trace_entry records child_outcome='aborted'
    // and verdict=NO_VERDICT_SENTINEL.
    const completed = harness.trace_entries.find((e) => e.kind === 'fanout.branch_completed');
    if (completed?.kind !== 'fanout.branch_completed') {
      throw new Error('expected fanout.branch_completed');
    }
    expect(completed.child_outcome).toBe('aborted');
    expect(completed.verdict).toBe('<no-verdict>');
  });

  it('records a branch as aborted when childCompiledFlowResolver throws', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        resolverThrowsForBranch: 'a',
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/pick-winner: no branch closed 'complete' with an admitted/);
    const completed = harness.trace_entries.find((e) => e.kind === 'fanout.branch_completed');
    if (completed?.kind !== 'fanout.branch_completed') {
      throw new Error('expected fanout.branch_completed');
    }
    expect(completed.child_outcome).toBe('aborted');
    expect(completed.verdict).toBe('<no-verdict>');
    // Worktree provisioning succeeded for this branch (the resolver
    // throw happens AFTER the worktree is added), so the branch path
    // should appear in the released set after cleanup.
    expect(harness.worktree.released.size).toBe(1);
  });

  it('records a branch as aborted when childRunner throws', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        childPlan: { 'branch-a': { mode: 'throw' } },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/pick-winner: no branch closed 'complete' with an admitted/);
    const completed = harness.trace_entries.find((e) => e.kind === 'fanout.branch_completed');
    if (completed?.kind !== 'fanout.branch_completed') {
      throw new Error('expected fanout.branch_completed');
    }
    expect(completed.child_outcome).toBe('aborted');
  });

  it('records a checkpoint_waiting child as aborted (nested checkpoint resume not supported)', async () => {
    const harness = buildHarness(
      {
        parent: { branches: { kind: 'static', branchIds: ['a'] }, policy: 'pick-winner' },
        childPlan: { 'branch-a': { mode: 'checkpoint' } },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    const completed = harness.trace_entries.find((e) => e.kind === 'fanout.branch_completed');
    if (completed?.kind !== 'fanout.branch_completed') {
      throw new Error('expected fanout.branch_completed');
    }
    expect(completed.child_outcome).toBe('aborted');
    expect(completed.verdict).toBe('<no-verdict>');
  });
});

describe('runFanoutStep direct — join policies', () => {
  it('pick-winner: picks the first branch in admit order with a complete+admitted result', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a', 'b'] },
          policy: 'pick-winner',
          admit: ['gold', 'silver'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'silver' },
          'branch-b': { mode: 'verdict', verdict: 'gold' },
        },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const joined = harness.trace_entries.find((e) => e.kind === 'fanout.joined');
    if (joined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    // 'gold' precedes 'silver' in admit order, so branch-b wins despite
    // alphabetical order putting branch-a first.
    expect(joined.selected_branch_id).toBe('b');
    expect(joined.policy).toBe('pick-winner');
  });

  it('pick-winner: aborts when no branch has an admitted verdict', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a'] },
          policy: 'pick-winner',
          admit: ['gold'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'rust' },
        },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /pick-winner: no branch closed 'complete' with an admitted verdict \(admit order \[gold\]\)/,
    );
  });

  it('disjoint-merge: aborts when branches modify the same file', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a', 'b'] },
          policy: 'disjoint-merge',
          admit: ['ok'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'ok' },
          'branch-b': { mode: 'verdict', verdict: 'ok' },
        },
        worktreeOpts: {
          changedFilesByBranch: {
            a: ['src/shared.ts'],
            b: ['src/shared.ts'],
          },
        },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/disjoint-merge: file 'src\/shared\.ts' modified by branches/);
  });

  it('disjoint-merge: passes when each branch touches different files', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a', 'b'] },
          policy: 'disjoint-merge',
          admit: ['ok'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'ok' },
          'branch-b': { mode: 'verdict', verdict: 'ok' },
        },
        worktreeOpts: {
          changedFilesByBranch: {
            a: ['src/a.ts'],
            b: ['src/b.ts'],
          },
        },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
  });

  it('aggregate-only: passes when all branches close complete with parseable bodies', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a', 'b'] },
          policy: 'aggregate-only',
          admit: ['ok'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'ok' },
          // verdict that is NOT in admit list — aggregate-only ignores
          // verdicts and only checks parseable+complete.
          'branch-b': { mode: 'verdict', verdict: 'something-else' },
        },
      },
      parentRunFolder,
      projectRoot,
    );

    const result = await runFanoutStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const joined = harness.trace_entries.find((e) => e.kind === 'fanout.joined');
    if (joined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(joined.policy).toBe('aggregate-only');
  });
});

describe('runFanoutStep direct — trace_entry sequence invariants', () => {
  it('on success: fanout.started → branch_started/branch_completed × N → step.report_written → fanout.joined → check.evaluated/pass', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a'] },
          policy: 'pick-winner',
          admit: ['ok'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'ok' },
        },
      },
      parentRunFolder,
      projectRoot,
    );

    await runFanoutStep(harness.ctx);

    const kinds = harness.trace_entries.map((e) => e.kind);
    expect(kinds).toEqual([
      'fanout.started',
      'fanout.branch_started',
      'fanout.branch_completed',
      'step.report_written',
      'fanout.joined',
      'check.evaluated',
    ]);
  });

  it('on join failure: fanout.started → ... → step.report_written → fanout.joined → check.evaluated/fail → step.aborted', async () => {
    const harness = buildHarness(
      {
        parent: {
          branches: { kind: 'static', branchIds: ['a'] },
          policy: 'pick-winner',
          admit: ['gold'],
        },
        childPlan: {
          'branch-a': { mode: 'verdict', verdict: 'rust' },
        },
      },
      parentRunFolder,
      projectRoot,
    );

    await runFanoutStep(harness.ctx);

    const kinds = harness.trace_entries.map((e) => e.kind);
    expect(kinds).toEqual([
      'fanout.started',
      'fanout.branch_started',
      'fanout.branch_completed',
      'step.report_written',
      'fanout.joined',
      'check.evaluated',
      'step.aborted',
    ]);
  });
});
