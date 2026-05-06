import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStubRelayConnectorV2 } from '../../src/core-v2/executors/relay.js';
import type { ExecutableFlowV2 } from '../../src/core-v2/manifest/executable-flow.js';
import type { CompiledFlowRunOptionsV2Like } from '../../src/core-v2/run/child-runner.js';
import type { GraphRunResultV2 } from '../../src/core-v2/run/graph-runner.js';
import { executeExecutableFlowV2 } from '../../src/core-v2/run/graph-runner.js';
import { TraceStore } from '../../src/core-v2/trace/trace-store.js';
import { LayeredConfig } from '../../src/schemas/config.js';
import { RunResult } from '../../src/schemas/result.js';

let baseDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'circuit-core-v2-sub-run-'));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

function parentFlow(pass: readonly string[] = ['accept']): ExecutableFlowV2 {
  return {
    id: 'parent-test',
    version: '0.1.0',
    entry: 'child-step',
    stages: [{ id: 'act', stepIds: ['child-step'] }],
    steps: [
      {
        id: 'child-step',
        kind: 'sub-run',
        title: 'Run child',
        protocol: 'sub-run-test@v1',
        routes: { pass: { kind: 'terminal', target: '@complete' } },
        flowRef: 'child-test',
        entryMode: 'default',
        goal: 'child goal',
        depth: 'standard',
        writes: { result: { path: 'reports/child-result.json' } },
        check: {
          kind: 'result_verdict',
          source: { kind: 'sub_run_result', ref: 'result' },
          pass,
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
      purpose: 'core-v2 sub-run child',
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
        rationale: 'narrow core-v2 child fixture',
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

function stubChildRunner(verdict: string, outcome: 'complete' | 'aborted' = 'complete') {
  return async (options: CompiledFlowRunOptionsV2Like): Promise<GraphRunResultV2> => {
    const resultPath = join(options.runDir, 'reports', 'result.json');
    await mkdir(dirname(resultPath), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: options.runId ?? 'child-run',
      flow_id: 'child-test',
      goal: options.goal,
      outcome,
      summary: 'child summary',
      closed_at: new Date(0).toISOString(),
      trace_entries_observed: 1,
      manifest_hash: 'child-hash',
      verdict,
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
      verdict,
      resultPath,
    };
  };
}

function stubChildRunnerWithResultBody(body: {
  readonly outcome?: 'complete' | 'aborted' | 'stopped' | 'handoff' | 'escalated';
  readonly verdict?: string;
}) {
  return async (options: CompiledFlowRunOptionsV2Like): Promise<GraphRunResultV2> => {
    const resultPath = join(options.runDir, 'reports', 'result.json');
    await mkdir(dirname(resultPath), { recursive: true });
    const parsed = RunResult.parse({
      schema_version: 1,
      run_id: options.runId ?? 'child-run',
      flow_id: 'child-test',
      goal: options.goal,
      outcome: body.outcome ?? 'complete',
      summary: 'child summary',
      closed_at: new Date(0).toISOString(),
      trace_entries_observed: 1,
      manifest_hash: 'child-hash',
      ...(body.verdict === undefined ? {} : { verdict: body.verdict }),
    });
    await writeFile(resultPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    return { ...parsed, resultPath };
  };
}

async function trace(runDir: string) {
  return await new TraceStore(runDir).load();
}

describe('core-v2 sub-run executor', () => {
  it('runs a sibling child run, copies result.json, and admits an allowed verdict', async () => {
    const runDir = join(baseDir, 'parent-run');
    const result = await executeExecutableFlowV2(parentFlow(), {
      runDir,
      runId: 'parent-run',
      goal: 'parent goal',
      childCompiledFlowResolver: () => ({ flowBytes: childFlowBytes() }),
      childRunner: stubChildRunner('accept'),
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    expect(result.outcome).toBe('complete');
    expect(result.verdict).toBe('accept');
    const copied = RunResult.parse(
      JSON.parse(await readFile(join(runDir, 'reports', 'child-result.json'), 'utf8')),
    );
    expect(copied.verdict).toBe('accept');

    const entries = await trace(runDir);
    const started = entries.find((entry) => entry.kind === 'sub_run.started');
    const completed = entries.find((entry) => entry.kind === 'sub_run.completed');
    expect(started?.child_run_id).toBeDefined();
    expect(completed?.child_run_id).toBe(started?.child_run_id);
    expect(completed?.verdict).toBe('accept');
    expect(
      await readFile(
        join(baseDir, String(started?.child_run_id), 'reports', 'result.json'),
        'utf8',
      ),
    ).toContain('"verdict": "accept"');
  });

  it('rejects a child verdict outside the parent check.pass list', async () => {
    const runDir = join(baseDir, 'parent-reject-run');
    const result = await executeExecutableFlowV2(parentFlow(['accept']), {
      runDir,
      runId: 'parent-reject-run',
      goal: 'parent goal',
      childCompiledFlowResolver: () => ({ flowBytes: childFlowBytes() }),
      childRunner: stubChildRunner('reject'),
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain("child verdict 'reject'");
    const entries = await trace(runDir);
    expect(entries.find((entry) => entry.kind === 'sub_run.completed')?.verdict).toBe('reject');
    expect(entries.find((entry) => entry.kind === 'check.evaluated')?.outcome).toBe('fail');
  });

  it('fails before child start when the resolver is missing', async () => {
    const runDir = join(baseDir, 'parent-missing-resolver-run');
    const result = await executeExecutableFlowV2(parentFlow(), {
      runDir,
      runId: '50000000-0000-4000-8000-000000000001',
      goal: 'parent goal',
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    const entries = await trace(runDir);
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain('childCompiledFlowResolver is required');
    expect(entries.map((entry) => entry.kind)).toEqual([
      'run.bootstrapped',
      'step.entered',
      'check.evaluated',
      'step.aborted',
      'run.closed',
    ]);
    expect(entries).toContainEqual(
      expect.objectContaining({
        kind: 'check.evaluated',
        step_id: 'child-step',
        outcome: 'fail',
        reason: expect.stringContaining('childCompiledFlowResolver is required'),
      }),
    );
    expect(entries).not.toContainEqual(
      expect.objectContaining({ kind: 'sub_run.started', step_id: 'child-step' }),
    );
  });

  it('fails before child start when the resolver returns the wrong flow id', async () => {
    const runDir = join(baseDir, 'parent-wrong-child-id-run');
    const wrongChildFlow = JSON.parse(childFlowBytes().toString('utf8'));
    wrongChildFlow.id = 'wrong-child-test';

    const result = await executeExecutableFlowV2(parentFlow(), {
      runDir,
      runId: '50000000-0000-4000-8000-000000000002',
      goal: 'parent goal',
      childCompiledFlowResolver: () => ({ flowBytes: Buffer.from(JSON.stringify(wrongChildFlow)) }),
      childRunner: stubChildRunner('accept'),
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    const entries = await trace(runDir);
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain("resolver returned flow id 'wrong-child-test'");
    expect(entries).toContainEqual(
      expect.objectContaining({
        kind: 'check.evaluated',
        step_id: 'child-step',
        outcome: 'fail',
        reason: expect.stringContaining("resolver returned flow id 'wrong-child-test'"),
      }),
    );
    expect(entries).not.toContainEqual(
      expect.objectContaining({ kind: 'sub_run.started', step_id: 'child-step' }),
    );
  });

  it('records child invocation failures after sub_run.started without completing the child', async () => {
    const runDir = join(baseDir, 'parent-child-throw-run');
    const result = await executeExecutableFlowV2(parentFlow(), {
      runDir,
      runId: '50000000-0000-4000-8000-000000000003',
      goal: 'parent goal',
      childCompiledFlowResolver: () => ({ flowBytes: childFlowBytes() }),
      childRunner: async () => {
        throw new Error('child runner boom');
      },
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    const entries = await trace(runDir);
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain('child flow invocation failed');
    expect(entries).toContainEqual(
      expect.objectContaining({
        kind: 'sub_run.started',
        step_id: 'child-step',
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        kind: 'check.evaluated',
        step_id: 'child-step',
        outcome: 'fail',
        reason: expect.stringContaining('child runner boom'),
      }),
    );
    expect(entries).not.toContainEqual(
      expect.objectContaining({ kind: 'sub_run.completed', step_id: 'child-step' }),
    );
  });

  it('copies child result evidence but rejects a missing child verdict', async () => {
    const runDir = join(baseDir, 'parent-missing-verdict-run');
    const result = await executeExecutableFlowV2(parentFlow(), {
      runDir,
      runId: '50000000-0000-4000-8000-000000000004',
      goal: 'parent goal',
      childCompiledFlowResolver: () => ({ flowBytes: childFlowBytes() }),
      childRunner: stubChildRunnerWithResultBody({ outcome: 'complete' }),
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    const entries = await trace(runDir);
    const copied = RunResult.parse(
      JSON.parse(await readFile(join(runDir, 'reports', 'child-result.json'), 'utf8')),
    );
    const finalResult = RunResult.parse(
      JSON.parse(await readFile(join(runDir, 'reports', 'result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain("lacks a non-empty string 'verdict' field");
    expect(copied.verdict).toBeUndefined();
    expect(finalResult.verdict).toBeUndefined();
    expect(entries).toContainEqual(
      expect.objectContaining({
        kind: 'sub_run.completed',
        step_id: 'child-step',
        verdict: '<no-verdict>',
        data: { admitted: false },
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        kind: 'check.evaluated',
        step_id: 'child-step',
        outcome: 'fail',
        reason: expect.stringContaining("lacks a non-empty string 'verdict' field"),
      }),
    );
  });

  it('propagates relay connector and config inputs into child run options', async () => {
    const runDir = join(baseDir, 'parent-child-relay-propagation');
    const relayConnector = createStubRelayConnectorV2({ verdict: 'accept' });
    const layer = LayeredConfig.parse({
      layer: 'project',
      config: {
        schema_version: 1,
        host: { kind: 'generic-shell' },
        relay: {
          default: 'codex',
          roles: {},
          circuits: {},
          connectors: {},
        },
        circuits: {},
        defaults: {},
      },
    });
    let observed: CompiledFlowRunOptionsV2Like | undefined;

    await executeExecutableFlowV2(parentFlow(), {
      runDir,
      runId: 'parent-propagation-run',
      goal: 'parent goal',
      childCompiledFlowResolver: () => ({ flowBytes: childFlowBytes() }),
      childRunner: async (options) => {
        observed = options;
        return stubChildRunner('accept')(options);
      },
      relayConnector,
      selectionConfigLayers: [layer],
      now: () => new Date('2026-05-03T00:00:00.000Z'),
    });

    expect(observed?.relayConnector).toBe(relayConnector);
    expect(observed?.selectionConfigLayers).toEqual([layer]);
  });
});
