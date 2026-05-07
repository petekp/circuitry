import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reportPathForSchemaInCompiledFlow } from '../../src/flows/registries/close-writers/shared.js';
import { runCrossReportValidator } from '../../src/flows/registries/cross-report-validators.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';

// Cross-report validators close gaps that single-report Zod schemas
// cannot reach. Specifically: sweep.batch.items[].candidate_id MUST be
// drawn from the upstream sweep.queue.to_execute set. Without this
// check, an off-prescription execute worker (one that ignored the
// triage queue and picked its own candidates) produces a schema-valid
// sweep.batch that the runtime would otherwise admit.

const SWEEP_FIXTURE_PATH = resolve('generated/flows/sweep/circuit.json');

function loadSweepCompiledFlow(): CompiledFlow {
  const raw: unknown = JSON.parse(readFileSync(SWEEP_FIXTURE_PATH, 'utf8'));
  return CompiledFlow.parse(raw);
}

const VALID_QUEUE = {
  classified: [
    { candidate_id: 'c-1', action: 'act', rationale: 'low-risk dead code' },
    { candidate_id: 'c-2', action: 'defer', rationale: 'needs review' },
  ],
  to_execute: ['c-1'],
  deferred: ['c-2'],
};

describe('runCrossReportValidator — sweep.batch ⊆ sweep.queue.to_execute', () => {
  let runFolder: string;
  let flow: CompiledFlow;
  let queueRel: string;

  beforeEach(() => {
    runFolder = mkdtempSync(join(tmpdir(), 'cross-report-test-'));
    flow = loadSweepCompiledFlow();
    queueRel = reportPathForSchemaInCompiledFlow(flow, 'sweep.queue@v1');
  });

  afterEach(() => {
    rmSync(runFolder, { recursive: true, force: true });
  });

  function writeQueue(queue: unknown): void {
    const queueAbs = join(runFolder, queueRel);
    mkdirSync(dirname(queueAbs), { recursive: true });
    writeFileSync(queueAbs, JSON.stringify(queue));
  }

  it('returns ok for unregistered schemas', () => {
    const result = runCrossReportValidator('unregistered.schema@v1', flow, runFolder, '{}');
    expect(result.kind).toBe('ok');
  });

  it('admits a batch whose items.candidate_id are all in queue.to_execute', () => {
    writeQueue(VALID_QUEUE);
    const batch = {
      verdict: 'accept',
      summary: 'applied 1 cleanup',
      changed_files: ['src/foo.ts'],
      items: [{ candidate_id: 'c-1', status: 'acted', evidence: 'removed dead function' }],
    };
    const result = runCrossReportValidator(
      'sweep.batch@v1',
      flow,
      runFolder,
      JSON.stringify(batch),
    );
    expect(result.kind).toBe('ok');
  });

  it('rejects a batch whose items reference candidate_ids not in queue.to_execute', () => {
    writeQueue(VALID_QUEUE);
    const batch = {
      verdict: 'accept',
      summary: 'applied 1 cleanup',
      changed_files: ['src/foo.ts'],
      items: [{ candidate_id: 'c-99', status: 'acted', evidence: 'off-prescription' }],
    };
    const result = runCrossReportValidator(
      'sweep.batch@v1',
      flow,
      runFolder,
      JSON.stringify(batch),
    );
    expect(result.kind).toBe('fail');
    if (result.kind === 'fail') {
      expect(result.reason).toContain('c-99');
      expect(result.reason).toContain('not in queue.to_execute');
    }
  });

  it('rejects a batch that mixes prescribed and off-prescription candidate_ids', () => {
    writeQueue(VALID_QUEUE);
    const batch = {
      verdict: 'accept',
      summary: 'mixed',
      changed_files: ['src/foo.ts', 'src/bar.ts'],
      items: [
        { candidate_id: 'c-1', status: 'acted', evidence: 'prescribed' },
        { candidate_id: 'c-3', status: 'acted', evidence: 'off-prescription' },
      ],
    };
    const result = runCrossReportValidator(
      'sweep.batch@v1',
      flow,
      runFolder,
      JSON.stringify(batch),
    );
    expect(result.kind).toBe('fail');
    if (result.kind === 'fail') {
      // c-1 is allowed; only c-3 should be reported as off-prescription.
      const offPrescriptionList = result.reason.match(/not in queue\.to_execute: \[([^\]]*)\]/);
      expect(offPrescriptionList).not.toBeNull();
      expect(offPrescriptionList?.[1]).toBe('c-3');
    }
  });

  it('fails closed when sweep.queue is missing on disk', () => {
    const batch = {
      verdict: 'accept',
      summary: 'no queue on disk',
      changed_files: ['src/foo.ts'],
      items: [{ candidate_id: 'c-1', status: 'acted', evidence: 'whatever' }],
    };
    const result = runCrossReportValidator(
      'sweep.batch@v1',
      flow,
      runFolder,
      JSON.stringify(batch),
    );
    expect(result.kind).toBe('fail');
    if (result.kind === 'fail') {
      expect(result.reason).toContain('sweep.queue');
      expect(result.reason).toContain('missing');
    }
  });

  it('fails closed when sweep.queue on disk is not valid JSON', () => {
    const queueAbs = join(runFolder, queueRel);
    mkdirSync(dirname(queueAbs), { recursive: true });
    writeFileSync(queueAbs, 'not json');
    const batch = {
      verdict: 'accept',
      summary: 'broken queue',
      changed_files: ['src/foo.ts'],
      items: [{ candidate_id: 'c-1', status: 'acted', evidence: 'whatever' }],
    };
    const result = runCrossReportValidator(
      'sweep.batch@v1',
      flow,
      runFolder,
      JSON.stringify(batch),
    );
    expect(result.kind).toBe('fail');
    if (result.kind === 'fail') {
      expect(result.reason).toContain('not valid JSON');
    }
  });

  it('fails closed when sweep.batch body is not parseable', () => {
    writeQueue(VALID_QUEUE);
    const result = runCrossReportValidator('sweep.batch@v1', flow, runFolder, 'not json at all');
    expect(result.kind).toBe('fail');
    if (result.kind === 'fail') {
      expect(result.reason).toContain('sweep.batch');
    }
  });
});
