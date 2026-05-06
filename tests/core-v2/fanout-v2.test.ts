import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RelayConnectorV2 } from '../../src/core-v2/executors/relay.js';
import type { ExecutableFlowV2 } from '../../src/core-v2/manifest/executable-flow.js';
import { fromCompiledFlowV1 } from '../../src/core-v2/manifest/from-compiled-flow-v1.js';
import type { CompiledFlowRunOptionsV2Like } from '../../src/core-v2/run/child-runner.js';
import type { GraphRunResultV2 } from '../../src/core-v2/run/graph-runner.js';
import { executeExecutableFlowV2 } from '../../src/core-v2/run/graph-runner.js';
import { TraceStore } from '../../src/core-v2/trace/trace-store.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunResult } from '../../src/schemas/result.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

let baseDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'circuit-core-v2-fanout-'));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

function dynamicRelayFanoutFlow(
  options: {
    readonly role?: string;
    readonly selection?: unknown;
    readonly joinPolicy?: 'aggregate-only' | 'disjoint-merge' | 'pick-winner';
  } = {},
): ExecutableFlowV2 {
  return {
    id: 'fanout-test',
    version: '0.1.0',
    entry: 'options',
    stages: [{ id: 'act', stepIds: ['options', 'fanout'] }],
    steps: [
      {
        id: 'options',
        kind: 'compose',
        title: 'Options',
        protocol: 'options@v1',
        routes: { pass: { kind: 'step', stepId: 'fanout' } },
        writes: { report: { path: 'reports/options.json', schema: 'options@v1' } },
        writer: 'options',
      },
      {
        id: 'fanout',
        kind: 'fanout',
        title: 'Fanout',
        protocol: 'fanout@v1',
        routes: { pass: { kind: 'terminal', target: '@complete' } },
        writes: {
          branches_dir: { path: 'reports/branches' },
          aggregate: { path: 'reports/aggregate.json' },
        },
        branches: {
          kind: 'dynamic',
          source_report: 'reports/options.json',
          items_path: 'options',
          template: {
            branch_id: '$item.id',
            ...(options.selection === undefined ? {} : { selection: options.selection }),
            execution: {
              kind: 'relay',
              role: options.role ?? 'researcher',
              goal: '$item.prompt',
              report_schema: 'explore.tournament-proposal@v1',
              provenance_field: 'option_id',
            },
          },
          max_branches: 4,
        },
        concurrency: { kind: 'bounded', max: 2 },
        onChildFailure: 'abort-all',
        join: { aggregate: { path: 'reports/aggregate.json' } },
        check: {
          kind: 'fanout_aggregate',
          source: { kind: 'fanout_results', ref: 'aggregate' },
          join: { policy: options.joinPolicy ?? 'aggregate-only' },
          verdicts: { admit: ['accept'] },
        },
      },
    ],
  };
}

function compiledRelayFanoutFlow(
  opts: {
    readonly reportSchema?: string;
    readonly admit?: readonly string[];
    readonly provenanceField?: string;
    readonly seedSweepQueue?: boolean;
  } = {},
): CompiledFlow {
  const reportSchema = opts.reportSchema ?? 'explore.tournament-proposal@v1';
  const admit = opts.admit ?? ['accept'];
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
          branch_id: 'option-1',
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
      aggregate: { path: 'reports/aggregate.json', schema: 'explore.tournament-aggregate@v1' },
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
    id: seedSweepQueue ? 'sweep' : 'explore',
    version: '0.1.0',
    purpose: 'core-v2 relay fanout production parity test',
    entry: {
      signals: { include: ['fanout-relay-v2'], exclude: [] },
      intent_prefixes: ['fanout-relay-v2'],
    },
    entry_modes: [
      {
        name: 'default',
        start_at: seedSweepQueue ? 'seed-sweep-queue' : 'fanout-step',
        depth: 'standard',
        description: 'Relay fanout entry.',
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
      rationale: 'narrow relay fanout v2 test.',
    },
    steps,
  });
}

function validProposalBody(optionId = 'option-1'): string {
  return JSON.stringify({
    verdict: 'accept',
    option_id: optionId,
    option_label: `Option ${optionId}`,
    case_summary: `Case for ${optionId}`,
    assumptions: [],
    evidence_refs: ['reports/options.json'],
    risks: [],
    next_action: 'Continue.',
  });
}

async function runCompiledRelayFanoutV2(input: {
  readonly flow?: CompiledFlow;
  readonly relayer: RelayFn;
}) {
  const compiledFlow = input.flow ?? compiledRelayFanoutFlow();
  const runDir = join(baseDir, `compiled-relay-fanout-${randomUUID()}`);
  const result = await executeExecutableFlowV2(fromCompiledFlowV1(compiledFlow), {
    runDir,
    runId: 'compiled-relay-fanout-run',
    goal: 'fanout goal',
    manifestHash: 'compiled-relay-fanout-hash',
    compiledFlowV1: compiledFlow,
    relayer: input.relayer,
    executors: {
      compose: async (_step, context) => {
        await context.files.writeJson(
          { path: 'reports/sweep-queue.json', schema: 'sweep.queue@v1' },
          {
            classified: [
              { candidate_id: 'c-1', action: 'act', rationale: 'authorized cleanup' },
              { candidate_id: 'c-99', action: 'defer', rationale: 'not authorized' },
            ],
            to_execute: ['c-1'],
            deferred: ['c-99'],
          },
        );
        return { route: 'pass' };
      },
    },
    now: () => new Date('2026-05-03T00:00:00.000Z'),
  });
  return { result, runDir, entries: await trace(runDir) };
}

function subRunFanoutFlow(): ExecutableFlowV2 {
  return {
    id: 'fanout-sub-run-test',
    version: '0.1.0',
    entry: 'fanout',
    stages: [{ id: 'act', stepIds: ['fanout'] }],
    steps: [
      {
        id: 'fanout',
        kind: 'fanout',
        title: 'Fanout',
        protocol: 'fanout@v1',
        routes: { pass: { kind: 'terminal', target: '@complete' } },
        writes: {
          branches_dir: { path: 'reports/branches' },
          aggregate: { path: 'reports/aggregate.json' },
        },
        branches: {
          kind: 'static',
          branches: [
            {
              branch_id: 'one',
              flow_ref: { flow_id: 'child-test', entry_mode: 'default' },
              goal: 'child one',
              depth: 'standard',
            },
            {
              branch_id: 'two',
              flow_ref: { flow_id: 'child-test', entry_mode: 'default' },
              goal: 'child two',
              depth: 'standard',
            },
          ],
        },
        concurrency: { kind: 'bounded', max: 2 },
        onChildFailure: 'continue-others',
        join: { aggregate: { path: 'reports/aggregate.json' } },
        check: {
          kind: 'fanout_aggregate',
          source: { kind: 'fanout_results', ref: 'aggregate' },
          join: { policy: 'disjoint-merge' },
          verdicts: { admit: ['accept'] },
        },
      },
    ],
  };
}

function childFlowBytes(): Buffer {
  return Buffer.from(
    JSON.stringify({
      schema_version: '2',
      id: 'child-test',
      version: '0.1.0',
      purpose: 'fanout child',
      entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
      entry_modes: [
        {
          name: 'default',
          start_at: 'close',
          depth: 'standard',
          description: 'Default child entry',
        },
      ],
      stages: [{ id: 'close-stage', title: 'Close', canonical: 'close', steps: ['close'] }],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'plan', 'act', 'verify', 'review'],
        rationale: 'narrow fanout child fixture',
      },
      steps: [
        {
          id: 'close',
          title: 'Close',
          protocol: 'child-close@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'orchestrator',
          kind: 'compose',
          writes: { report: { path: 'reports/child.json', schema: 'child.result@v1' } },
          check: {
            kind: 'schema_sections',
            source: { kind: 'report', ref: 'report' },
            required: ['summary'],
          },
        },
      ],
    }),
  );
}

function stubChildRunner() {
  return async (options: CompiledFlowRunOptionsV2Like): Promise<GraphRunResultV2> => {
    const resultPath = join(options.runDir, 'reports', 'result.json');
    await mkdir(dirname(resultPath), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: options.runId ?? 'child-run',
      flow_id: 'child-test',
      goal: options.goal,
      outcome: 'complete',
      summary: 'child summary',
      closed_at: new Date(0).toISOString(),
      trace_entries_observed: 1,
      manifest_hash: 'child-hash',
      verdict: 'accept',
    });
    await writeFile(resultPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
    return {
      schema_version: 1,
      run_id: body.run_id,
      flow_id: body.flow_id,
      goal: body.goal,
      outcome: body.outcome,
      summary: body.summary,
      closed_at: body.closed_at,
      trace_entries_observed: body.trace_entries_observed,
      manifest_hash: body.manifest_hash,
      verdict: 'accept',
      resultPath,
    };
  };
}

async function trace(runDir: string) {
  return await new TraceStore(runDir).load();
}

describe('core-v2 fanout executor', () => {
  it('runs compiled relay branches through the production relayer prompt path', async () => {
    const prompts: string[] = [];
    const { result, runDir, entries } = await runCompiledRelayFanoutV2({
      relayer: {
        connectorName: 'claude-code',
        relay: async (input) => {
          prompts.push(input.prompt);
          return {
            request_payload: input.prompt,
            receipt_id: 'receipt-a',
            result_body: validProposalBody(),
            duration_ms: 3,
            cli_version: 'test-relay',
          };
        },
      },
    });

    expect(result.outcome).toBe('complete');
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('Step: fanout-step-option-1');
    expect(prompts[0]).toContain('Title: Fanout relay branch / option-1: branch-a goal');
    expect(prompts[0]).toContain('Accepted verdicts: accept');
    await expect(
      readFile(join(runDir, 'reports', 'branches', 'option-1', 'request.txt'), 'utf8'),
    ).resolves.toContain('Step: fanout-step-option-1');
    expect(existsSync(join(runDir, 'reports', 'branches', 'option-1', 'request.json'))).toBe(false);
    expect(entries.find((entry) => entry.kind === 'fanout.branch_completed')).toMatchObject({
      child_outcome: 'complete',
      verdict: 'accept',
      result_path: 'reports/branches/option-1/report.json',
    });
  });

  it('does not write relay branch reports for invalid JSON', async () => {
    const { result, runDir } = await runCompiledRelayFanoutV2({
      relayer: {
        connectorName: 'claude-code',
        relay: async (input) => ({
          request_payload: input.prompt,
          receipt_id: 'receipt-a',
          result_body: 'not-json{{{',
          duration_ms: 3,
          cli_version: 'test-relay',
        }),
      },
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain('did not parse as JSON');
    expect(existsSync(join(runDir, 'reports', 'branches', 'option-1', 'result.json'))).toBe(true);
    expect(existsSync(join(runDir, 'reports', 'branches', 'option-1', 'report.json'))).toBe(false);
  });

  it('does not write relay branch reports for schema or provenance failures', async () => {
    const badSchema = await runCompiledRelayFanoutV2({
      flow: compiledRelayFanoutFlow({ reportSchema: 'runtime-proof-strict@v1', admit: ['ok'] }),
      relayer: {
        connectorName: 'claude-code',
        relay: async (input) => ({
          request_payload: input.prompt,
          receipt_id: 'receipt-a',
          result_body: JSON.stringify({ verdict: 'ok' }),
          duration_ms: 3,
          cli_version: 'test-relay',
        }),
      },
    });

    expect(badSchema.result.outcome).toBe('aborted');
    expect(badSchema.result.reason).toContain('runtime-proof-strict@v1');
    expect(
      existsSync(join(badSchema.runDir, 'reports', 'branches', 'option-1', 'report.json')),
    ).toBe(false);

    const provenance = await runCompiledRelayFanoutV2({
      flow: compiledRelayFanoutFlow({ provenanceField: 'option_id' }),
      relayer: {
        connectorName: 'claude-code',
        relay: async (input) => ({
          request_payload: input.prompt,
          receipt_id: 'receipt-a',
          result_body: validProposalBody('option-2'),
          duration_ms: 3,
          cli_version: 'test-relay',
        }),
      },
    });

    expect(provenance.result.outcome).toBe('aborted');
    expect(provenance.result.reason).toContain(
      "report field 'option_id' must equal branch_id 'option-1'",
    );
    expect(
      existsSync(join(provenance.runDir, 'reports', 'branches', 'option-1', 'report.json')),
    ).toBe(false);
  });

  it('runs cross-report validation before admitting compiled relay fanout branches', async () => {
    const offPrescriptionBatch = {
      verdict: 'accept',
      summary: 'executed the wrong candidate',
      changed_files: ['src/off-prescription.ts'],
      items: [{ candidate_id: 'c-99', status: 'acted', evidence: 'off prescription' }],
    };
    const { result, runDir } = await runCompiledRelayFanoutV2({
      flow: compiledRelayFanoutFlow({
        reportSchema: 'sweep.batch@v1',
        admit: ['accept'],
        seedSweepQueue: true,
      }),
      relayer: {
        connectorName: 'claude-code',
        relay: async (input) => ({
          request_payload: input.prompt,
          receipt_id: 'receipt-a',
          result_body: JSON.stringify(offPrescriptionBatch),
          duration_ms: 3,
          cli_version: 'test-relay',
        }),
      },
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain('not in queue.to_execute');
    expect(existsSync(join(runDir, 'reports', 'branches', 'option-1', 'report.json'))).toBe(false);
  });

  it('expands dynamic relay branches, writes an aggregate, and joins aggregate-only', async () => {
    const runDir = join(baseDir, 'dynamic-relay-run');
    const relayConnector: RelayConnectorV2 = {
      async relay(request) {
        const optionId = request.stepId.endsWith('option-1') ? 'option-1' : 'option-2';
        return {
          verdict: 'accept',
          option_id: optionId,
          option_label: optionId === 'option-1' ? 'Option 1' : 'Option 2',
          case_summary: request.prompt,
          assumptions: [],
          evidence_refs: ['fanout fixture'],
          risks: [],
          next_action: 'Continue',
        };
      },
    };

    const result = await executeExecutableFlowV2(dynamicRelayFanoutFlow(), {
      runDir,
      runId: 'dynamic-relay-run',
      goal: 'fanout goal',
      relayConnector,
      executors: {
        compose: async (step, context) => {
          await context.files.writeJson('reports/options.json', {
            options: [
              { id: 'option-1', prompt: 'argue for option one' },
              { id: 'option-2', prompt: 'argue for option two' },
            ],
          });
          return { route: 'pass', details: { step: step.id } };
        },
      },
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    expect(result.outcome).toBe('complete');
    const aggregate = (await import('node:fs/promises')).readFile(
      join(runDir, 'reports', 'aggregate.json'),
      'utf8',
    );
    await expect(aggregate).resolves.toContain('"branch_count": 2');
    const entries = await trace(runDir);
    expect(entries.filter((entry) => entry.kind === 'fanout.branch_completed')).toHaveLength(2);
    expect(entries.find((entry) => entry.kind === 'fanout.joined')?.branches_completed).toBe(2);
  });

  it('cleans up sub-run branch worktrees after a disjoint-merge fanout', async () => {
    const runDir = join(baseDir, 'sub-run-fanout-run');
    const removed = new Set<string>();
    const added = new Set<string>();
    const worktreeRunner = {
      add({ worktreePath }: { readonly worktreePath: string }) {
        added.add(worktreePath);
      },
      remove(worktreePath: string) {
        removed.add(worktreePath);
      },
      changedFiles(worktreePath: string) {
        if (removed.has(worktreePath)) {
          throw new Error(`changedFiles called after cleanup for ${worktreePath}`);
        }
        return [worktreePath.endsWith('/one') ? 'one.ts' : 'two.ts'];
      },
    };

    const result = await executeExecutableFlowV2(subRunFanoutFlow(), {
      runDir,
      runId: 'sub-run-fanout-run',
      goal: 'fanout goal',
      projectRoot: join(baseDir, 'project'),
      worktreeRunner,
      childCompiledFlowResolver: () => ({ flowBytes: childFlowBytes() }),
      childRunner: stubChildRunner(),
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    expect(result.outcome).toBe('complete');
    expect(added.size).toBe(2);
    expect(removed).toEqual(added);
    const entries = await trace(runDir);
    expect(entries.find((entry) => entry.kind === 'fanout.joined')?.policy).toBe('disjoint-merge');
  });

  it('records branch completion when sub-run branch preflight fails', async () => {
    const runDir = join(baseDir, 'missing-child-runner-run');
    const result = await executeExecutableFlowV2(subRunFanoutFlow(), {
      runDir,
      runId: 'missing-child-runner-run',
      goal: 'fanout goal',
      projectRoot: join(baseDir, 'project'),
      worktreeRunner: {
        add() {},
        remove() {},
        changedFiles() {
          return [];
        },
      },
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    expect(result.outcome).toBe('aborted');
    const entries = await trace(runDir);
    expect(entries.filter((entry) => entry.kind === 'fanout.branch_started')).toHaveLength(2);
    expect(entries.filter((entry) => entry.kind === 'fanout.branch_completed')).toHaveLength(2);
    expect(entries.find((entry) => entry.kind === 'fanout.branch_completed')?.child_outcome).toBe(
      'aborted',
    );
  });

  it('rejects read-only connectors for implementer relay fanout branches before callback invocation', async () => {
    const runDir = join(baseDir, 'relay-fanout-read-only-run');
    let relayCalls = 0;
    const result = await executeExecutableFlowV2(dynamicRelayFanoutFlow({ role: 'implementer' }), {
      runDir,
      runId: 'relay-fanout-read-only-run',
      goal: 'fanout goal',
      relayConnector: {
        connectorName: 'codex',
        async relay() {
          relayCalls += 1;
          return { verdict: 'accept', option_id: 'option-one' };
        },
      },
      executors: {
        compose: async (_step, context) => {
          await context.files.writeJson('reports/options.json', {
            options: [{ id: 'option-one', prompt: 'argue for option one' }],
          });
          return { route: 'pass' };
        },
      },
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain("connector 'codex' is read-only");
    expect(relayCalls).toBe(0);
    const entries = await trace(runDir);
    expect(entries.filter((entry) => entry.kind === 'fanout.branch_started')).toHaveLength(1);
    const completed = entries.filter((entry) => entry.kind === 'fanout.branch_completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.child_outcome).toBe('aborted');
  });

  it('rejects incompatible relay fanout branch model selection before callback invocation', async () => {
    const runDir = join(baseDir, 'relay-fanout-provider-run');
    let relayCalls = 0;
    const result = await executeExecutableFlowV2(
      dynamicRelayFanoutFlow({
        selection: { model: { provider: 'openai', model: 'gpt-5.4' } },
      }),
      {
        runDir,
        runId: 'relay-fanout-provider-run',
        goal: 'fanout goal',
        relayConnector: {
          connectorName: 'claude-code',
          async relay() {
            relayCalls += 1;
            return { verdict: 'accept', option_id: 'option-one' };
          },
        },
        executors: {
          compose: async (_step, context) => {
            await context.files.writeJson('reports/options.json', {
              options: [{ id: 'option-one', prompt: 'argue for option one' }],
            });
            return { route: 'pass' };
          },
        },
        now: () => new Date('2026-05-03T00:00:00.000Z'),
      },
    );

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain("expected provider 'anthropic'");
    expect(relayCalls).toBe(0);
    const entries = await trace(runDir);
    expect(entries.filter((entry) => entry.kind === 'fanout.branch_started')).toHaveLength(1);
    const completed = entries.filter((entry) => entry.kind === 'fanout.branch_completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.child_outcome).toBe('aborted');
  });

  it('rejects relay fanout connector identity mismatch before callback invocation', async () => {
    const runDir = join(baseDir, 'relay-fanout-identity-mismatch-run');
    let relayCalls = 0;
    const result = await executeExecutableFlowV2(dynamicRelayFanoutFlow(), {
      runDir,
      runId: 'relay-fanout-identity-mismatch-run',
      goal: 'fanout goal',
      relayConnector: {
        connectorName: 'codex',
        connector: { kind: 'builtin', name: 'claude-code' },
        async relay() {
          relayCalls += 1;
          return { verdict: 'accept', option_id: 'option-one' };
        },
      },
      executors: {
        compose: async (_step, context) => {
          await context.files.writeJson('reports/options.json', {
            options: [{ id: 'option-one', prompt: 'argue for option one' }],
          });
          return { route: 'pass' };
        },
      },
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain(
      "relay connector identity mismatch: connectorName 'codex' does not match resolved connector 'claude-code'",
    );
    expect(relayCalls).toBe(0);
    const entries = await trace(runDir);
    expect(entries.filter((entry) => entry.kind === 'fanout.branch_started')).toHaveLength(1);
    const completed = entries.filter((entry) => entry.kind === 'fanout.branch_completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.child_outcome).toBe('aborted');
  });

  it('rejects disjoint-merge relay branches before relay callbacks or changed-file checks', async () => {
    const runDir = join(baseDir, 'relay-disjoint-merge-run');
    let relayCalls = 0;
    let changedFilesCalls = 0;
    const result = await executeExecutableFlowV2(
      dynamicRelayFanoutFlow({ joinPolicy: 'disjoint-merge' }),
      {
        runDir,
        runId: 'relay-disjoint-merge-run',
        goal: 'fanout goal',
        relayConnector: {
          async relay() {
            relayCalls += 1;
            return { verdict: 'accept', option_id: 'option-one' };
          },
        },
        worktreeRunner: {
          add() {},
          remove() {},
          changedFiles() {
            changedFilesCalls += 1;
            return [];
          },
        },
        executors: {
          compose: async (_step, context) => {
            await context.files.writeJson('reports/options.json', {
              options: [{ id: 'option-one', prompt: 'argue for option one' }],
            });
            return { route: 'pass' };
          },
        },
        now: () => new Date('2026-05-03T00:00:00.000Z'),
      },
    );

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain(
      'disjoint-merge is only supported for sub-run branches with worktrees',
    );
    expect(relayCalls).toBe(0);
    expect(changedFilesCalls).toBe(0);
  });
});
