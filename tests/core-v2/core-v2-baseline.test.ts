import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TERMINAL_TARGETS } from '../../src/core-v2/domain/route.js';
import type { TraceEntryV2 } from '../../src/core-v2/domain/trace.js';
import { createStubRelayConnectorV2 } from '../../src/core-v2/executors/relay.js';
import type { ExecutableFlowV2 } from '../../src/core-v2/manifest/executable-flow.js';
import { validateExecutableFlowV2 } from '../../src/core-v2/manifest/validate-executable-flow.js';
import { projectStatusFromTraceV2 } from '../../src/core-v2/projections/status.js';
import { validateReportValueV2 } from '../../src/core-v2/run-files/report-validator.js';
import { RunFileStore } from '../../src/core-v2/run-files/run-file-store.js';
import { executeExecutableFlowV2 } from '../../src/core-v2/run/graph-runner.js';
import {
  manifestSnapshotPathV2,
  readCompiledFlowManifestSnapshotV2,
  writeManifestSnapshotV2,
} from '../../src/core-v2/run/manifest-snapshot.js';
import { TraceStore } from '../../src/core-v2/trace/trace-store.js';
import { computeManifestHash } from '../../src/schemas/manifest.js';
import { RunResult } from '../../src/schemas/result.js';

async function withTempRun<T>(fn: (runDir: string) => Promise<T>): Promise<T> {
  const runDir = await mkdtemp(join(tmpdir(), 'circuit-core-v2-'));
  try {
    return await fn(runDir);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

function validFlow(): ExecutableFlowV2 {
  return {
    id: 'baseline',
    version: '0.1.0',
    entry: 'compose',
    stages: [{ id: 'main', stepIds: ['compose', 'relay'] }],
    steps: [
      {
        id: 'compose',
        kind: 'compose',
        writer: 'baseline-writer',
        body: { ok: true },
        writes: { result: { path: 'reports/compose.json' } },
        routes: { pass: { kind: 'step', stepId: 'relay' } },
      },
      {
        id: 'relay',
        kind: 'relay',
        role: 'reviewer',
        prompt: 'inspect the composed file',
        writes: { report: { path: 'reports/relay.json' } },
        routes: { pass: { kind: 'terminal', target: '@complete' } },
      },
    ],
  };
}

function compiledFlowBytesForSnapshot(flowId = 'baseline'): Buffer {
  return Buffer.from(
    JSON.stringify({
      schema_version: '2',
      id: flowId,
      version: '0.1.0',
      purpose: 'core-v2 manifest snapshot fixture',
      entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
      entry_modes: [
        {
          name: 'default',
          start_at: 'close',
          depth: 'standard',
          description: 'Default snapshot fixture entry',
        },
      ],
      stages: [{ id: 'close-stage', title: 'Close', canonical: 'close', steps: ['close'] }],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'plan', 'act', 'verify', 'review'],
        rationale: 'narrow core-v2 manifest snapshot fixture',
      },
      steps: [
        {
          id: 'close',
          title: 'Close',
          protocol: 'snapshot-close@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'orchestrator',
          kind: 'compose',
          writes: { report: { path: 'reports/snapshot.json', schema: 'snapshot.result@v1' } },
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

describe('core-v2 baseline', () => {
  it('uses the v1 terminal target vocabulary', () => {
    expect(TERMINAL_TARGETS).toEqual(['@complete', '@stop', '@handoff', '@escalate']);
  });

  it('runs a valid executable flow to a terminal result', async () => {
    await withTempRun(async (runDir) => {
      const result = await executeExecutableFlowV2(validFlow(), {
        runDir,
        runId: 'run-valid',
        executors: {
          relay: async (step, context) => {
            if (step.kind !== 'relay') throw new Error('expected relay step');
            const relay = createStubRelayConnectorV2({ verdict: 'ok' });
            const { executeRelayV2 } = await import('../../src/core-v2/executors/relay.js');
            return executeRelayV2(step, context, relay);
          },
        },
      });

      expect(result.outcome).toBe('complete');

      const files = new RunFileStore(runDir);
      await expect(files.readJson('reports/result.json')).resolves.toMatchObject({
        schema_version: 1,
        run_id: 'run-valid',
        flow_id: 'baseline',
        outcome: 'complete',
        trace_entries_observed: 6,
      });
      await expect(files.readJson('reports/compose.json')).resolves.toMatchObject({
        writer: 'baseline-writer',
        body: { ok: true },
      });
      await expect(files.readJson('reports/relay.json')).resolves.toMatchObject({
        role: 'reviewer',
        response: { verdict: 'ok' },
      });
    });
  });

  it('validates schema-tagged run-file writes before persisting reports', async () => {
    await withTempRun(async (runDir) => {
      const files = new RunFileStore(runDir, validateReportValueV2);

      await expect(
        files.writeJson(
          { path: 'reports/strict.json', schema: 'runtime-proof-strict@v1' },
          { verdict: 'pass' },
        ),
      ).rejects.toThrow(/did not validate against schema 'runtime-proof-strict@v1'/);

      await expect(readFile(join(runDir, 'reports', 'strict.json'), 'utf8')).rejects.toThrow();
    });
  });

  it('rejects schema-tagged text writes before persisting reports', async () => {
    await withTempRun(async (runDir) => {
      const files = new RunFileStore(runDir, validateReportValueV2);

      await expect(
        files.writeText(
          { path: 'reports/strict-text.json', schema: 'runtime-proof-strict@v1' },
          '{"verdict":"pass"}\n',
        ),
      ).rejects.toThrow(/writeText cannot write schema-tagged run file/);

      await expect(readFile(join(runDir, 'reports', 'strict-text.json'), 'utf8')).rejects.toThrow();
    });
  });

  it('rejects an invalid route target during validation', () => {
    const flow: ExecutableFlowV2 = {
      ...validFlow(),
      steps: [
        {
          id: 'compose',
          kind: 'compose',
          writer: 'baseline-writer',
          routes: { pass: { kind: 'step', stepId: 'missing' } },
        },
      ],
      stages: [{ id: 'main', stepIds: ['compose'] }],
    };

    expect(validateExecutableFlowV2(flow)).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        "step 'compose' route 'pass' targets unknown step 'missing'",
      ]),
    });
  });

  it('allows a step to be listed in more than one stage', () => {
    const flow: ExecutableFlowV2 = {
      ...validFlow(),
      stages: [
        { id: 'main', stepIds: ['compose', 'relay'] },
        { id: 'overlap', stepIds: ['compose'] },
      ],
    };

    expect(validateExecutableFlowV2(flow)).toEqual({ ok: true, issues: [] });
  });

  it('validates basic entry mode structure', () => {
    expect(
      validateExecutableFlowV2({
        ...validFlow(),
        entryModes: [],
      }).issues,
    ).toContain('entryModes must not be empty when provided');

    expect(
      validateExecutableFlowV2({
        ...validFlow(),
        entryModes: [
          {
            name: 'default',
            startAt: 'compose',
            depth: 'standard',
            description: 'Default route',
          },
          {
            name: 'default',
            startAt: 'missing',
            depth: 'standard',
            description: 'Duplicate route',
          },
        ],
      }).issues,
    ).toEqual(
      expect.arrayContaining([
        'duplicate entry mode name: default',
        "entry mode 'default' startAt references unknown step 'missing'",
      ]),
    );
  });

  it('assigns monotonic trace sequence numbers and rejects append after close', async () => {
    await withTempRun(async (runDir) => {
      const trace = new TraceStore(runDir);
      await trace.append({ run_id: 'run-trace', kind: 'run.bootstrapped' });
      await trace.append({ run_id: 'run-trace', kind: 'step.entered', step_id: 'compose' });
      await trace.append({
        run_id: 'run-trace',
        kind: 'run.closed',
        data: { outcome: 'complete' },
      });

      expect(trace.getAll().map((entry) => entry.sequence)).toEqual([0, 1, 2]);
      await expect(
        trace.append({ run_id: 'run-trace', kind: 'step.completed', step_id: 'compose' }),
      ).rejects.toThrow('cannot append trace entry after run close');

      const reloaded = new TraceStore(runDir);
      await expect(reloaded.load()).resolves.toHaveLength(3);
    });
  });

  it('does not mutate trace memory when persistence fails', async () => {
    await withTempRun(async (runDir) => {
      const filePath = join(runDir, 'not-a-directory');
      await writeFile(filePath, 'blocks trace directory creation', 'utf8');
      const trace = new TraceStore(filePath);

      await expect(
        trace.append({ run_id: 'run-persist', kind: 'run.bootstrapped' }),
      ).rejects.toThrow();
      expect(trace.getAll()).toEqual([]);
    });
  });

  it('rejects path traversal in the run-file store', async () => {
    await withTempRun(async (runDir) => {
      const files = new RunFileStore(runDir);
      await expect(files.writeJson('../escape.json', { unsafe: true })).rejects.toThrow(
        'escapes run directory',
      );
    });
  });

  it('rejects invalid run-file paths before appending trace', async () => {
    await withTempRun(async (runDir) => {
      const flow: ExecutableFlowV2 = {
        ...validFlow(),
        steps: validFlow().steps.map((step) =>
          step.id === 'compose'
            ? { ...step, writes: { result: { path: '../escape.json' } } }
            : step,
        ),
      };

      await expect(
        executeExecutableFlowV2(flow, {
          runDir,
          runId: 'run-invalid-path',
        }),
      ).rejects.toThrow("step 'compose' write 'result' path must not contain");

      const trace = new TraceStore(runDir);
      await expect(trace.load()).resolves.toEqual([]);
    });
  });

  it('records failure and closes when an executor throws', async () => {
    await withTempRun(async (runDir) => {
      const result = await executeExecutableFlowV2(
        {
          id: 'failure',
          version: '0.1.0',
          entry: 'compose',
          stages: [{ id: 'main', stepIds: ['compose'] }],
          steps: [
            {
              id: 'compose',
              kind: 'compose',
              writer: 'will-fail',
              routes: { pass: { kind: 'terminal', target: '@complete' } },
            },
          ],
        },
        {
          runDir,
          runId: '40000000-0000-4000-8000-000000000001',
          goal: 'prove core-v2 closes cleanly when an executor throws',
          executors: {
            compose: async () => {
              throw new Error('compose failed');
            },
          },
        },
      );

      const trace = new TraceStore(runDir);
      const entries = await trace.load();
      const resultJson = RunResult.parse(
        JSON.parse(await readFile(join(runDir, 'reports', 'result.json'), 'utf8')),
      );
      const reason = "step 'compose' handler threw: compose failed";
      expect(result.outcome).toBe('aborted');
      expect(result.reason).toBe(reason);
      expect(resultJson.outcome).toBe('aborted');
      expect(resultJson.reason).toBe(reason);
      expect(entries.map((entry) => entry.kind)).toContain('step.aborted');
      expect(entries.at(-1)).toMatchObject({
        kind: 'run.closed',
        reason,
        data: { outcome: 'aborted' },
      });
      expect(entries).not.toContainEqual(
        expect.objectContaining({ kind: 'step.completed', step_id: 'compose' }),
      );
    });
  });

  it('does not complete a step whose executor returns an undeclared route', async () => {
    await withTempRun(async (runDir) => {
      const result = await executeExecutableFlowV2(
        {
          id: 'undeclared-route',
          version: '0.1.0',
          entry: 'compose',
          stages: [{ id: 'main', stepIds: ['compose'] }],
          steps: [
            {
              id: 'compose',
              kind: 'compose',
              writer: 'wrong-route',
              routes: { pass: { kind: 'terminal', target: '@complete' } },
            },
          ],
        },
        {
          runDir,
          runId: 'run-undeclared-route',
          executors: {
            compose: async () => ({ route: 'ghost' }),
          },
        },
      );

      const trace = new TraceStore(runDir);
      const entries = await trace.load();
      expect(result.outcome).toBe('aborted');
      expect(entries.map((entry) => entry.kind)).toEqual([
        'run.bootstrapped',
        'step.entered',
        'step.aborted',
        'run.closed',
      ]);
      expect(entries).not.toContainEqual(expect.objectContaining({ kind: 'step.completed' }));
    });
  });

  it('aborts a pass self-route before writing step completion', async () => {
    await withTempRun(async (runDir) => {
      const result = await executeExecutableFlowV2(
        {
          id: 'pass-self-route',
          version: '0.1.0',
          entry: 'compose',
          stages: [{ id: 'main', stepIds: ['compose'] }],
          steps: [
            {
              id: 'compose',
              kind: 'compose',
              writer: 'self-route',
              routes: { pass: { kind: 'step', stepId: 'compose' } },
            },
          ],
        },
        {
          runDir,
          runId: '40000000-0000-4000-8000-000000000002',
          goal: 'prove core-v2 aborts pass self-routes cleanly',
          executors: {
            compose: async () => ({ route: 'pass' }),
          },
        },
      );

      const entries = await new TraceStore(runDir).load();
      const resultJson = RunResult.parse(
        JSON.parse(await readFile(join(runDir, 'reports', 'result.json'), 'utf8')),
      );
      expect(result).toMatchObject({
        outcome: 'aborted',
        reason: "route cycle detected: step 'compose' routes via 'pass' to itself",
      });
      expect(resultJson).toMatchObject({
        outcome: 'aborted',
        reason: "route cycle detected: step 'compose' routes via 'pass' to itself",
      });
      expect(entries.map((entry) => entry.kind)).toEqual([
        'run.bootstrapped',
        'step.entered',
        'step.aborted',
        'run.closed',
      ]);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'step.aborted',
            step_id: 'compose',
            attempt: 1,
            route_taken: 'pass',
          }),
        ]),
      );
      expect(entries).not.toContainEqual(expect.objectContaining({ kind: 'step.completed' }));
    });
  });

  it('aborts a non-recovery route to an already completed step before completion', async () => {
    await withTempRun(async (runDir) => {
      const result = await executeExecutableFlowV2(
        {
          id: 'completed-step-route',
          version: '0.1.0',
          entry: 'first',
          stages: [{ id: 'main', stepIds: ['first', 'second'] }],
          steps: [
            {
              id: 'first',
              kind: 'compose',
              writer: 'first',
              routes: { pass: { kind: 'step', stepId: 'second' } },
            },
            {
              id: 'second',
              kind: 'compose',
              writer: 'second',
              routes: {
                pass: { kind: 'terminal', target: '@complete' },
                continue: { kind: 'step', stepId: 'first' },
              },
            },
          ],
        },
        {
          runDir,
          runId: 'run-completed-step-route',
          executors: {
            compose: async (step) => ({ route: step.id === 'first' ? 'pass' : 'continue' }),
          },
        },
      );

      const entries = await new TraceStore(runDir).load();
      expect(result).toMatchObject({
        outcome: 'aborted',
        reason:
          "route cycle detected: step 'second' routes via 'continue' to already completed step 'first'",
      });
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'step.completed',
            step_id: 'first',
            attempt: 1,
            route_taken: 'pass',
          }),
          expect.objectContaining({
            kind: 'step.aborted',
            step_id: 'second',
            attempt: 1,
            route_taken: 'continue',
          }),
        ]),
      );
      expect(entries).not.toContainEqual(
        expect.objectContaining({ kind: 'step.completed', step_id: 'second' }),
      );
    });
  });

  it('lets a non-pass self-route complete once before aborting on re-entry', async () => {
    await withTempRun(async (runDir) => {
      const result = await executeExecutableFlowV2(
        {
          id: 'non-pass-self-route',
          version: '0.1.0',
          entry: 'compose',
          stages: [{ id: 'main', stepIds: ['compose'] }],
          steps: [
            {
              id: 'compose',
              kind: 'compose',
              writer: 'self-route',
              routes: {
                pass: { kind: 'terminal', target: '@complete' },
                continue: { kind: 'step', stepId: 'compose' },
              },
            },
          ],
        },
        {
          runDir,
          runId: 'run-non-pass-self-route',
          executors: {
            compose: async () => ({ route: 'continue' }),
          },
        },
      );

      const entries = await new TraceStore(runDir).load();
      expect(result).toMatchObject({
        outcome: 'aborted',
        reason: "route 'continue' for step 'compose' exhausted max_attempts=1",
      });
      expect(entries.map((entry) => entry.kind)).toEqual([
        'run.bootstrapped',
        'step.entered',
        'step.completed',
        'step.aborted',
        'run.closed',
      ]);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'step.completed',
            step_id: 'compose',
            attempt: 1,
            route_taken: 'continue',
          }),
          expect.objectContaining({
            kind: 'step.aborted',
            step_id: 'compose',
            attempt: 2,
            reason: "route 'continue' for step 'compose' exhausted max_attempts=1",
          }),
        ]),
      );
    });
  });

  it('allows bounded revise re-entry before aborting when attempts are exhausted', async () => {
    await withTempRun(async (runDir) => {
      const result = await executeExecutableFlowV2(
        {
          id: 'revise-self-route',
          version: '0.1.0',
          entry: 'compose',
          stages: [{ id: 'main', stepIds: ['compose'] }],
          steps: [
            {
              id: 'compose',
              kind: 'compose',
              writer: 'self-route',
              routes: {
                pass: { kind: 'terminal', target: '@complete' },
                revise: { kind: 'step', stepId: 'compose' },
              },
            },
          ],
        },
        {
          runDir,
          runId: 'run-revise-self-route',
          executors: {
            compose: async () => ({ route: 'revise' }),
          },
        },
      );

      const entries = await new TraceStore(runDir).load();
      const completed = entries.filter((entry) => entry.kind === 'step.completed');
      expect(result).toMatchObject({
        outcome: 'aborted',
        reason: "route 'revise' for step 'compose' exhausted max_attempts=2",
      });
      expect(completed).toHaveLength(2);
      expect(completed.map((entry) => entry.attempt)).toEqual([1, 2]);
      expect(completed.map((entry) => entry.route_taken)).toEqual(['revise', 'revise']);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'step.aborted',
            step_id: 'compose',
            attempt: 3,
            reason: "route 'revise' for step 'compose' exhausted max_attempts=2",
          }),
        ]),
      );
    });
  });

  it('rejects non-empty existing traces instead of appending blindly', async () => {
    await withTempRun(async (runDir) => {
      const trace = new TraceStore(runDir);
      await trace.append({ run_id: 'existing-run', kind: 'run.bootstrapped' });

      await expect(
        executeExecutableFlowV2(validFlow(), {
          runDir,
          runId: 'new-run',
        }),
      ).rejects.toThrow('core-v2 baseline requires a fresh run directory');

      const reloaded = new TraceStore(runDir);
      await expect(reloaded.load()).resolves.toHaveLength(1);
    });
  });

  it('rejects a run directory with a stale manifest snapshot before overwriting it', async () => {
    await withTempRun(async (runDir) => {
      const snapshotPath = manifestSnapshotPathV2(runDir);
      await writeFile(snapshotPath, 'stale snapshot must survive rejection', 'utf8');

      await expect(
        executeExecutableFlowV2(validFlow(), {
          runDir,
          runId: '55555555-5555-4555-8555-555555555555',
          manifestBytes: Buffer.from('new manifest bytes'),
        }),
      ).rejects.toThrow('core-v2 baseline requires a fresh run directory');

      await expect(readFile(snapshotPath, 'utf8')).resolves.toBe(
        'stale snapshot must survive rejection',
      );
      await expect(new TraceStore(runDir).load()).resolves.toEqual([]);
    });
  });

  it('rejects manifest hash mismatch before writing a manifest snapshot', async () => {
    await withTempRun(async (runDir) => {
      const snapshotPath = manifestSnapshotPathV2(runDir);

      await expect(
        executeExecutableFlowV2(validFlow(), {
          runDir,
          runId: '66666666-6666-4666-8666-666666666666',
          manifestBytes: Buffer.from('manifest bytes'),
          manifestHash: 'different-hash',
        }),
      ).rejects.toThrow('manifest bytes hash differs from run manifest_hash');

      await expect(readFile(snapshotPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(new TraceStore(runDir).load()).resolves.toEqual([]);
    });
  });

  it('reads compiled-flow manifest snapshots only when run, flow, hash, and bytes agree', async () => {
    await withTempRun(async (runDir) => {
      const bytes = compiledFlowBytesForSnapshot();
      const hash = computeManifestHash(bytes);

      await writeManifestSnapshotV2({
        runDir,
        runId: '77777777-7777-4777-8777-777777777777',
        flowId: 'baseline',
        capturedAt: '2026-05-03T00:00:00.000Z',
        bytes,
      });

      const loaded = await readCompiledFlowManifestSnapshotV2({
        runDir,
        expectedRunId: '77777777-7777-4777-8777-777777777777',
        expectedFlowId: 'baseline',
        expectedHash: hash,
      });
      expect(loaded.snapshot.hash).toBe(hash);
      expect(loaded.flow.id).toBe('baseline');
      expect(loaded.flowBytes.equals(bytes)).toBe(true);
    });
  });

  it('rejects compiled-flow manifest snapshots with mismatched expected identity', async () => {
    await withTempRun(async (runDir) => {
      const bytes = compiledFlowBytesForSnapshot();
      await writeManifestSnapshotV2({
        runDir,
        runId: '88888888-8888-4888-8888-888888888888',
        flowId: 'baseline',
        capturedAt: '2026-05-03T00:00:00.000Z',
        bytes,
      });

      await expect(
        readCompiledFlowManifestSnapshotV2({
          runDir,
          expectedRunId: '99999999-9999-4999-8999-999999999999',
        }),
      ).rejects.toThrow(
        "manifest snapshot run_id mismatch: expected '99999999-9999-4999-8999-999999999999'",
      );
      await expect(
        readCompiledFlowManifestSnapshotV2({
          runDir,
          expectedFlowId: 'review',
        }),
      ).rejects.toThrow("manifest snapshot flow_id mismatch: expected 'review'");
      await expect(
        readCompiledFlowManifestSnapshotV2({
          runDir,
          expectedHash: '0'.repeat(64),
        }),
      ).rejects.toThrow(
        "manifest snapshot hash mismatch: expected '0000000000000000000000000000000000000000000000000000000000000000'",
      );
    });
  });

  it('rejects compiled-flow manifest snapshots whose bytes do not match the snapshot flow id', async () => {
    await withTempRun(async (runDir) => {
      await writeManifestSnapshotV2({
        runDir,
        runId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        flowId: 'baseline',
        capturedAt: '2026-05-03T00:00:00.000Z',
        bytes: compiledFlowBytesForSnapshot('other-flow'),
      });

      await expect(readCompiledFlowManifestSnapshotV2({ runDir })).rejects.toThrow(
        "manifest snapshot flow_id 'baseline' does not match compiled flow id 'other-flow'",
      );
    });
  });

  it('rejects compiled-flow manifest snapshots whose bytes are not a compiled flow', async () => {
    await withTempRun(async (runDir) => {
      await writeManifestSnapshotV2({
        runDir,
        runId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        flowId: 'baseline',
        capturedAt: '2026-05-03T00:00:00.000Z',
        bytes: Buffer.from('not json'),
      });

      await expect(readCompiledFlowManifestSnapshotV2({ runDir })).rejects.toThrow(
        'manifest snapshot bytes do not parse as CompiledFlow',
      );
    });
  });

  it('derives status from trace entries', () => {
    const entries: TraceEntryV2[] = [
      { sequence: 0, run_id: 'run-status', kind: 'run.bootstrapped' },
      {
        sequence: 1,
        run_id: 'run-status',
        kind: 'run.closed',
        outcome: 'complete',
        data: { outcome: 'complete' },
      },
    ];

    expect(projectStatusFromTraceV2([])).toBe('not_started');
    expect(projectStatusFromTraceV2(entries.slice(0, 1))).toBe('running');
    expect(projectStatusFromTraceV2(entries)).toBe('complete');
    for (const outcome of ['aborted', 'handoff', 'stopped', 'escalated'] as const) {
      expect(
        projectStatusFromTraceV2([
          { sequence: 0, run_id: `run-${outcome}`, kind: 'run.bootstrapped' },
          {
            sequence: 1,
            run_id: `run-${outcome}`,
            kind: 'run.closed',
            data: { outcome },
          },
        ]),
      ).toBe(outcome);
    }
    expect(
      projectStatusFromTraceV2([
        { sequence: 0, run_id: 'run-unknown', kind: 'run.bootstrapped' },
        {
          sequence: 1,
          run_id: 'run-unknown',
          kind: 'run.closed',
          data: { outcome: 'checkpoint_waiting' },
        },
      ]),
    ).toBe('aborted');
  });
});
