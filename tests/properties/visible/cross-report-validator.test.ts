// Property test for the cross-report validator that binds sweep.batch
// items to sweep.queue.to_execute. The example-based path is exercised
// by sweep-runtime-wiring.test.ts; this property test adds width — for
// any deterministic (queue, batch) pair, the validator must agree with
// the predicate "every batch.items[].candidate_id is in
// queue.to_execute."
//
// Validator under test: validateSweepBatchAgainstQueue at
// src/flows/sweep/cross-report-validators.ts.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reportPathForSchemaInCompiledFlow } from '../../../src/flows/registries/close-writers/shared.js';
import { runCrossReportValidator } from '../../../src/flows/registries/cross-report-validators.js';
import { CompiledFlow } from '../../../src/schemas/compiled-flow.js';

const SWEEP_FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'sweep', 'circuit.json');

function loadSweepCompiledFlow(): CompiledFlow {
  const raw: unknown = JSON.parse(readFileSync(SWEEP_FIXTURE_PATH, 'utf8'));
  return CompiledFlow.parse(raw);
}

// mulberry32 — deterministic 32-bit PRNG. Same generator the other
// property tests use; vanilla LCG low bits collapse `% 2` to a constant
// for some seeds and silently zero accept/reject branches.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

function nextInt(rng: () => number, mod: number): number {
  return Math.floor((rng() / 0x100000000) * mod);
}

function nextBool(rng: () => number): boolean {
  return (rng() & 0x80000000) !== 0;
}

interface QueueBatchSample {
  readonly queueBody: string;
  readonly batchBody: string;
  readonly expectsPass: boolean;
  readonly seed: number;
}

// Generate a schema-valid (queue, batch) pair plus the predicted
// validator outcome. The pair varies which batch items reference
// in-prescription vs off-prescription candidate ids; the predicate is
// the validator's contract: pass iff every batch item id is in
// queue.to_execute.
function generateSample(seed: number): QueueBatchSample {
  const rng = mulberry32(seed);

  const candidateCount = 3 + nextInt(rng, 5);
  const allCandidates = Array.from({ length: candidateCount }, (_, i) => `cand-${i}`);

  // Partition the candidate corpus into to_execute / deferred. Both
  // halves must be in classified[]. Anti-vacuity: ensure at least one
  // to_execute and at least one deferred so both branches of the
  // queue's superRefine are exercised across the sample.
  const executeMask = allCandidates.map(() => nextBool(rng));
  if (executeMask.every((b) => !b)) executeMask[0] = true;
  if (executeMask.every((b) => b)) executeMask[executeMask.length - 1] = false;

  const toExecute = allCandidates.filter((_, i) => executeMask[i] === true);
  const deferred = allCandidates.filter((_, i) => executeMask[i] === false);

  const classified = allCandidates.map((id, i) => ({
    candidate_id: id,
    action: executeMask[i] === true ? 'act' : 'defer',
    rationale: `seeded rationale for ${id}`,
  }));

  const queueBody = JSON.stringify({
    classified,
    to_execute: toExecute,
    deferred,
  });

  // Build the batch. Half the samples force every item in-prescription
  // (predicting pass); the other half draws each item randomly. Without
  // this bias the pass branch is dominated by 0.5^M and starves the
  // anti-vacuity floor for larger batches.
  const forceAllInPrescription = nextBool(rng);
  const itemCount = 1 + nextInt(rng, 5);
  const usedIds = new Set<string>();
  const items: Array<{ candidate_id: string; status: 'acted'; evidence: string }> = [];
  let usedAnyOffPrescription = false;

  for (let i = 0; i < itemCount; i++) {
    const drawInUniverse = forceAllInPrescription || nextBool(rng);
    let candidateId: string;
    if (drawInUniverse && toExecute.length > 0) {
      // Try to find an unused in-prescription id.
      let attempts = 0;
      do {
        candidateId = toExecute[nextInt(rng, toExecute.length)] ?? `off-${i}`;
        attempts++;
      } while (usedIds.has(candidateId) && attempts < 10);
      if (usedIds.has(candidateId)) {
        candidateId = `off-${i}`;
        usedAnyOffPrescription = true;
      }
    } else {
      candidateId = `off-${i}`;
      usedAnyOffPrescription = true;
    }
    if (usedIds.has(candidateId)) {
      candidateId = `${candidateId}-dup-${i}`;
      usedAnyOffPrescription = true;
    }
    usedIds.add(candidateId);
    items.push({
      candidate_id: candidateId,
      status: 'acted',
      evidence: `seeded evidence for ${candidateId}`,
    });
  }

  // With every item.status === 'acted' and items.length >= 1, the
  // SweepBatch superRefine pins the verdict to 'accept'.
  const batchBody = JSON.stringify({
    verdict: 'accept',
    summary: `seeded batch with ${itemCount} items`,
    changed_files: [],
    items,
  });

  return {
    queueBody,
    batchBody,
    expectsPass: !usedAnyOffPrescription,
    seed,
  };
}

describe('cross-report validator: sweep.batch.items[].candidate_id ⊆ sweep.queue.to_execute', () => {
  let flow: CompiledFlow;
  let queueRel: string;
  let runFolderBase: string;

  beforeEach(() => {
    flow = loadSweepCompiledFlow();
    queueRel = reportPathForSchemaInCompiledFlow(flow, 'sweep.queue@v1');
    runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-cross-report-'));
  });

  afterEach(() => {
    rmSync(runFolderBase, { recursive: true, force: true });
  });

  it('agrees with the predicate over 200 deterministic samples with anti-vacuity floors per branch', () => {
    const iterations = 200;
    let passSamples = 0;
    let failSamples = 0;

    for (let i = 0; i < iterations; i++) {
      const sample = generateSample(i + 1);
      const runFolder = join(runFolderBase, `iter-${i}`);
      mkdirSync(join(runFolder, dirname(queueRel)), { recursive: true });
      writeFileSync(join(runFolder, queueRel), sample.queueBody);

      const result = runCrossReportValidator('sweep.batch@v1', flow, runFolder, sample.batchBody);

      if (sample.expectsPass) {
        passSamples++;
        expect(
          result.kind,
          `seed=${sample.seed} expected ok, got fail: ${result.kind === 'fail' ? result.reason : ''}`,
        ).toBe('ok');
      } else {
        failSamples++;
        expect(result.kind, `seed=${sample.seed} expected fail, got ok`).toBe('fail');
      }
    }

    // Both accept and reject branches must carry real weight; the test
    // is vacuous if the generator collapses to one side.
    expect(passSamples, 'pass branch under-represented').toBeGreaterThanOrEqual(30);
    expect(failSamples, 'fail branch under-represented').toBeGreaterThanOrEqual(30);
  });

  it('returns fail when the queue file is missing', () => {
    const runFolder = join(runFolderBase, 'no-queue');
    mkdirSync(runFolder, { recursive: true });
    const batchBody = JSON.stringify({
      verdict: 'accept',
      summary: 'batch with no queue on disk',
      changed_files: [],
      items: [{ candidate_id: 'cand-1', status: 'acted', evidence: 'seeded' }],
    });
    const result = runCrossReportValidator('sweep.batch@v1', flow, runFolder, batchBody);
    expect(result.kind).toBe('fail');
    if (result.kind === 'fail') {
      expect(result.reason).toContain('sweep.queue');
    }
  });
});
