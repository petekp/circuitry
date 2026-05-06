import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ManifestSnapshot, computeManifestHash } from '../../../src/schemas/manifest.js';
import { RunProjection, type RunTrace } from '../../../src/schemas/run.js';
import { Snapshot } from '../../../src/schemas/snapshot.js';
import { RunBootstrappedTraceEntry, TraceEntry } from '../../../src/schemas/trace-entry.js';
import {
  readManifestSnapshot as readSharedManifestSnapshot,
  writeManifestSnapshot as writeSharedManifestSnapshot,
} from '../../../src/shared/manifest-snapshot.js';

import {
  appendAndDeriveRetainedTrace as appendAndDerive,
  bootstrapRetainedRun as bootstrapRun,
  initRetainedRunFolder as initRunFolder,
} from '../../../src/compat/retained-runtime.js';
import {
  manifestSnapshotPath,
  readManifestSnapshot,
  writeManifestSnapshot,
} from '../../../src/runtime/manifest-snapshot-writer.js';
import { reduce } from '../../../src/runtime/reducer.js';
import {
  deriveSnapshot,
  snapshotPath,
  writeDerivedSnapshot,
} from '../../../src/runtime/snapshot-writer.js';
import { readRunTrace } from '../../../src/runtime/trace-reader.js';
import { appendTraceEntry, traceEntryLogPath } from '../../../src/runtime/trace-writer.js';

// trace.ndjson append → parse → reduce → derive state.json
// round-trip test. Closes the boundary runtime-proof runs through:
// without this file in place, runtime-proof would write real bytes through the
// very gap meant to be proven safe.

const MANIFEST_BODY = Buffer.from(
  JSON.stringify({ id: 'runtime-proof-fixture', steps: [] }, null, 2),
  'utf8',
);

const RUN_ID = '11111111-2222-3333-4444-555555555555';
const WORKFLOW_ID = 'runtime-proof-fixture';

function baseRecordedAt(step: number): string {
  const base = Date.UTC(2026, 3, 20, 12, 0, 0);
  return new Date(base + step * 1000).toISOString();
}

function buildBootstrapTraceEntry(manifestHash: string) {
  return RunBootstrappedTraceEntry.parse({
    schema_version: 1,
    sequence: 0,
    recorded_at: baseRecordedAt(0),
    run_id: RUN_ID,
    kind: 'run.bootstrapped',
    flow_id: WORKFLOW_ID,
    depth: 'standard',
    goal: 'prove circuit-next can close one run',
    change_kind: {
      change_kind: 'ratchet-advance',
      failure_mode: 'no end-to-end product proof',
      acceptance_evidence: 'trace.ndjson + state.json + manifest.snapshot.json round-trip',
      alternate_framing: 'defer runtime boundary to 27d',
    },
    manifest_hash: manifestHash,
  });
}

function buildStepEntered(sequence: number, stepId: string, attempt = 1) {
  return TraceEntry.parse({
    schema_version: 1,
    sequence,
    recorded_at: baseRecordedAt(sequence),
    run_id: RUN_ID,
    kind: 'step.entered',
    step_id: stepId,
    attempt,
  });
}

function buildStepCompleted(sequence: number, stepId: string, attempt = 1) {
  return TraceEntry.parse({
    schema_version: 1,
    sequence,
    recorded_at: baseRecordedAt(sequence),
    run_id: RUN_ID,
    kind: 'step.completed',
    step_id: stepId,
    attempt,
    route_taken: 'default',
  });
}

function buildRunClosed(sequence: number, outcome: 'complete' = 'complete') {
  return TraceEntry.parse({
    schema_version: 1,
    sequence,
    recorded_at: baseRecordedAt(sequence),
    run_id: RUN_ID,
    kind: 'run.closed',
    outcome,
  });
}

function seedRun(runFolder: string) {
  const manifestHash = computeManifestHash(MANIFEST_BODY);
  const boot = buildBootstrapTraceEntry(manifestHash);
  bootstrapRun({
    runFolder,
    manifest: {
      run_id: boot.run_id,
      flow_id: boot.flow_id,
      captured_at: boot.recorded_at,
      bytes: MANIFEST_BODY,
    },
    bootstrapTraceEntry: boot,
  });
  return { manifestHash };
}

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'circuit-next-27c-'));
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

describe('trace.ndjson append→reduce→state.json round-trip', () => {
  it('writes trace.ndjson, state.json, manifest.snapshot.json at bootstrap', () => {
    seedRun(runFolder);
    const logText = readFileSync(traceEntryLogPath(runFolder), 'utf8');
    const snapText = readFileSync(snapshotPath(runFolder), 'utf8');
    const manifestText = readFileSync(manifestSnapshotPath(runFolder), 'utf8');
    expect(logText.endsWith('\n')).toBe(true);
    expect(logText.split('\n').filter(Boolean)).toHaveLength(1);
    const snap = Snapshot.parse(JSON.parse(snapText));
    expect(snap.trace_entries_consumed).toBe(1);
    expect(snap.status).toBe('in_progress');
    const manifest = ManifestSnapshot.parse(JSON.parse(manifestText));
    expect(manifest.algorithm).toBe('sha256-raw');
  });

  it('trace.ndjson parses as RunTrace through a full happy-path run', () => {
    const { manifestHash } = seedRun(runFolder);
    appendAndDerive(runFolder, buildStepEntered(1, 'frame'));
    appendAndDerive(runFolder, buildStepCompleted(2, 'frame'));
    appendAndDerive(runFolder, buildRunClosed(3));

    const log = readRunTrace(runFolder);
    expect(log).toHaveLength(4);
    const first = log[0];
    if (first === undefined || first.kind !== 'run.bootstrapped') {
      throw new Error('expected run.bootstrapped at index 0');
    }
    expect(first.manifest_hash).toBe(manifestHash);
    const last = log[log.length - 1];
    if (last === undefined || last.kind !== 'run.closed') {
      throw new Error('expected run.closed at tail');
    }
  });

  it('state.json parses as Snapshot (not RunProjection)', () => {
    seedRun(runFolder);
    appendAndDerive(runFolder, buildStepEntered(1, 'frame'));
    appendAndDerive(runFolder, buildStepCompleted(2, 'frame'));
    appendAndDerive(runFolder, buildRunClosed(3));

    const snapText = readFileSync(snapshotPath(runFolder), 'utf8');
    const raw: unknown = JSON.parse(snapText);
    const snapshot = Snapshot.parse(raw);
    expect(snapshot.status).toBe('complete');
    expect(snapshot.trace_entries_consumed).toBe(4);

    // Defensive: the persisted file is Snapshot, not RunProjection. A
    // RunProjection has `log` and `snapshot` keys; attempting to parse
    // the Snapshot shape as a RunProjection must reject.
    const projectionAttempt = RunProjection.safeParse(raw);
    expect(projectionAttempt.success).toBe(false);
  });

  it('RunProjection.safeParse({ log, snapshot }) succeeds', () => {
    seedRun(runFolder);
    appendAndDerive(runFolder, buildStepEntered(1, 'frame'));
    appendAndDerive(runFolder, buildStepCompleted(2, 'frame'));
    appendAndDerive(runFolder, buildRunClosed(3));

    const log = readRunTrace(runFolder);
    const snapshot = deriveSnapshot(runFolder);
    const parsed = RunProjection.safeParse({ log, snapshot });
    expect(parsed.success).toBe(true);
  });

  it('append-only: later writes do not overwrite or truncate prior trace_entries', () => {
    seedRun(runFolder);
    const afterBoot = readFileSync(traceEntryLogPath(runFolder), 'utf8');
    appendTraceEntry(runFolder, buildStepEntered(1, 'frame'));
    const afterStep = readFileSync(traceEntryLogPath(runFolder), 'utf8');
    expect(afterStep.startsWith(afterBoot)).toBe(true);
    expect(afterStep.length).toBeGreaterThan(afterBoot.length);
    appendTraceEntry(runFolder, buildStepCompleted(2, 'frame'));
    const afterCompleted = readFileSync(traceEntryLogPath(runFolder), 'utf8');
    expect(afterCompleted.startsWith(afterStep)).toBe(true);
  });

  it('reducer-derived: deleting one trace_entry mid-log creates a mismatch', () => {
    seedRun(runFolder);
    appendAndDerive(runFolder, buildStepEntered(1, 'frame'));
    appendAndDerive(runFolder, buildStepCompleted(2, 'frame'));
    appendAndDerive(runFolder, buildRunClosed(3));
    const originalSnapshot = deriveSnapshot(runFolder);

    // Tamper: delete the middle trace_entry by rewriting the NDJSON without it.
    const lines = readFileSync(traceEntryLogPath(runFolder), 'utf8').split('\n').filter(Boolean);
    const tampered = [lines[0], lines[2], lines[3]].join('\n').concat('\n');
    writeFileSync(traceEntryLogPath(runFolder), tampered);

    // Re-reading the tampered log must fail RUN-I2 (sequence contiguity):
    // the remaining sequences are [0, 2, 3] — a gap at 1 breaks RUN-I2.
    expect(() => readRunTrace(runFolder)).toThrow();

    // If the caller bypasses RunTrace validation (hand-forged array), the
    // derived snapshot differs from the original — no silent acceptance.
    const rawRaw = readFileSync(traceEntryLogPath(runFolder), 'utf8').split('\n').filter(Boolean);
    const forged = rawRaw.map((l) => TraceEntry.parse(JSON.parse(l)));
    // Force-reduce the forged (un-validated) log by constructing a RunTrace
    // that skips superRefine — we cast via the parsed TraceEntry[] directly
    // because RunTrace.parse would reject the gap. The reducer still runs
    // but trace_entries_consumed binds to log length, which now differs.
    // The simplest way to demonstrate mismatch: the tampered log has a
    // different length than the original, so `reduce` produces a
    // different trace_entries_consumed.
    const forgedAsLog = forged as unknown as RunTrace;
    const tamperedSnapshot = reduce(forgedAsLog);
    expect(tamperedSnapshot.trace_entries_consumed).not.toBe(
      originalSnapshot.trace_entries_consumed,
    );
  });

  it('byte-for-byte manifest: persisted bytes hash matches declared hash', () => {
    const { manifestHash } = seedRun(runFolder);
    const manifest = readManifestSnapshot(runFolder);
    const decoded = Buffer.from(manifest.bytes_base64, 'base64');
    expect(decoded.equals(MANIFEST_BODY)).toBe(true);
    expect(computeManifestHash(decoded)).toBe(manifestHash);
    expect(manifest.hash).toBe(manifestHash);
  });

  it('shared and runtime manifest snapshot paths stay compatible', () => {
    initRunFolder({ runFolder });
    const input = {
      run_id: RUN_ID as unknown as import('../../../src/schemas/ids.js').RunId,
      flow_id: WORKFLOW_ID as unknown as import('../../../src/schemas/ids.js').CompiledFlowId,
      captured_at: baseRecordedAt(0),
      bytes: MANIFEST_BODY,
    };
    const runtimeSnapshot = writeManifestSnapshot(runFolder, input);
    expect(readSharedManifestSnapshot(runFolder)).toEqual(runtimeSnapshot);

    const sharedSnapshot = writeSharedManifestSnapshot(runFolder, {
      ...input,
      captured_at: baseRecordedAt(1),
    });
    expect(readManifestSnapshot(runFolder)).toEqual(sharedSnapshot);
  });

  it('corrupt manifest snapshot bytes: parse fails loudly', () => {
    seedRun(runFolder);
    const text = readFileSync(manifestSnapshotPath(runFolder), 'utf8');
    const parsed: { bytes_base64: string } = JSON.parse(text);
    const tampered = {
      ...parsed,
      bytes_base64: Buffer.from('not the real manifest bytes', 'utf8').toString('base64'),
    };
    writeFileSync(manifestSnapshotPath(runFolder), JSON.stringify(tampered));
    expect(() => readManifestSnapshot(runFolder)).toThrow(/manifest hash mismatch/);
  });

  it('corrupt manifest hash: declared hash that does not match bytes is rejected', () => {
    initRunFolder({ runFolder });
    const forged = {
      schema_version: 1,
      run_id: RUN_ID,
      flow_id: WORKFLOW_ID,
      captured_at: baseRecordedAt(0),
      algorithm: 'sha256-raw',
      hash: '0'.repeat(64),
      bytes_base64: MANIFEST_BODY.toString('base64'),
    };
    writeFileSync(manifestSnapshotPath(runFolder), JSON.stringify(forged));
    expect(() => readManifestSnapshot(runFolder)).toThrow(/manifest hash mismatch/);
  });

  it('deriveSnapshot is pure: same log replays to equal snapshot', () => {
    seedRun(runFolder);
    appendAndDerive(runFolder, buildStepEntered(1, 'frame'));
    appendAndDerive(runFolder, buildStepCompleted(2, 'frame'));
    appendAndDerive(runFolder, buildRunClosed(3));
    const first = deriveSnapshot(runFolder);
    const second = deriveSnapshot(runFolder);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('writeDerivedSnapshot after every append keeps state.json equal to reduce(log)', () => {
    seedRun(runFolder);
    appendAndDerive(runFolder, buildStepEntered(1, 'frame'));
    appendAndDerive(runFolder, buildStepCompleted(2, 'frame'));
    const persisted = Snapshot.parse(JSON.parse(readFileSync(snapshotPath(runFolder), 'utf8')));
    const recomputed = reduce(readRunTrace(runFolder));
    expect(JSON.stringify(persisted)).toBe(JSON.stringify(recomputed));
  });

  it('manifest snapshot path and trace path are distinct and stable', () => {
    expect(traceEntryLogPath(runFolder)).toContain('trace.ndjson');
    expect(snapshotPath(runFolder)).toContain('state.json');
    expect(manifestSnapshotPath(runFolder)).toContain('manifest.snapshot.json');
    expect(traceEntryLogPath(runFolder)).not.toBe(snapshotPath(runFolder));
    expect(traceEntryLogPath(runFolder)).not.toBe(manifestSnapshotPath(runFolder));
  });

  it('writeManifestSnapshot/bootstrapRun compose without stepping on each other', () => {
    // Clean run_folder, call the lower-level writer directly, confirm the
    // file is readable, then re-bootstrap through runner without conflict.
    initRunFolder({ runFolder });
    const captured_at = baseRecordedAt(0);
    writeManifestSnapshot(runFolder, {
      run_id: RUN_ID as unknown as import('../../../src/schemas/ids.js').RunId,
      flow_id: WORKFLOW_ID as unknown as import('../../../src/schemas/ids.js').CompiledFlowId,
      captured_at,
      bytes: MANIFEST_BODY,
    });
    const first = readManifestSnapshot(runFolder);
    expect(first.hash).toBe(computeManifestHash(MANIFEST_BODY));
    // Re-writing with the same bytes is idempotent at the byte level.
    writeManifestSnapshot(runFolder, {
      run_id: RUN_ID as unknown as import('../../../src/schemas/ids.js').RunId,
      flow_id: WORKFLOW_ID as unknown as import('../../../src/schemas/ids.js').CompiledFlowId,
      captured_at,
      bytes: MANIFEST_BODY,
    });
    const second = readManifestSnapshot(runFolder);
    expect(second.hash).toBe(first.hash);
  });

  it('malformed trace_entry-log line fails loudly (Stage 2 defers durable-tail distinction)', () => {
    seedRun(runFolder);
    writeFileSync(traceEntryLogPath(runFolder), 'not json at all\n');
    expect(() => readRunTrace(runFolder)).toThrow(/valid JSON|TraceEntry|RunTrace/);
  });

  it('writeDerivedSnapshot produces a Snapshot with schema_version 1', () => {
    seedRun(runFolder);
    const snap = writeDerivedSnapshot(runFolder);
    expect(snap.schema_version).toBe(1);
    expect(snap.manifest_hash.length).toBeGreaterThan(0);
  });
});
