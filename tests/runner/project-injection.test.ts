import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareRunStartHistoryRecall } from '../../src/app/history/run-start-recall.js';
import { type MemoryInputV0, MemoryInputV0 as MemoryInputV0Schema } from '../../src/index.js';
import { loadProjectFactCandidates } from '../../src/memory/project-injection.js';
import { appendProjectFact } from '../../src/memory/project-store.js';

const tempRoots: string[] = [];

const RUN_ID = '00000000-0000-4000-8000-00000000a001';

function tempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'project-injection-'));
  tempRoots.push(root);
  // queryHistory rebuilds over the runs base; it must exist.
  mkdirSync(join(root, '.circuit', 'runs'), { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// Seed a project fact citing a real run artifact so injection-time staleness
// re-verification reads `fresh`.
function seedFact(repoRoot: string, args: { id: string; flowId: string }): void {
  const runFolder = join(repoRoot, '.circuit', 'runs', RUN_ID);
  mkdirSync(join(runFolder, 'reports'), { recursive: true });
  const body = `${JSON.stringify({ run_id: RUN_ID, flow_id: args.flowId }, null, 2)}\n`;
  writeFileSync(join(runFolder, 'reports', 'result.json'), body, 'utf8');
  const sha = sha256Text(body);
  const fact: MemoryInputV0 = MemoryInputV0Schema.parse({
    schema_version: 1,
    memory_id: args.id,
    kind: 'project',
    source: {
      ref: {
        kind: 'report',
        ref: 'reports/result.json',
        sha256: sha,
        run_id: RUN_ID,
        flow_id: args.flowId,
      },
      captured_at: '2026-05-29T00:00:00.000Z',
      sha256: sha,
    },
    summary: `operator note for ${args.flowId}`,
    hints: [{ id: 'hint-1', text: 'verify with npm run verify', applies_to: 'verification' }],
    staleness: {
      status: 'fresh',
      checked_at: '2026-05-29T00:00:00.000Z',
      reason_codes: ['source_hash_verified'],
    },
    authority: 'hint_only',
  });
  appendProjectFact(fact, { repoRoot });
}

describe('project-fact injection at run start (Slice 5 D6)', () => {
  it('loads a filed fact into the same-flow run-start recall and authority stays hint_only', () => {
    const repoRoot = tempRepo();
    seedFact(repoRoot, { id: 'project-note-build', flowId: 'build' });

    const { report, precision } = prepareRunStartHistoryRecall({
      repoRoot,
      query: 'add the dashboard filter',
      flowId: 'build',
      now: () => new Date('2026-05-29T01:00:00.000Z'),
    });

    const injectedIds = report.memory_inputs.map((memory) => memory.memory_id);
    expect(injectedIds).toContain('project-note-build');
    // Boundary: recall is always hint-only.
    expect(report.memory_inputs.every((memory) => memory.authority === 'hint_only')).toBe(true);
    // The earned-precision sidecar recorded a decision for the project fact.
    expect(precision.decisions.some((decision) => decision.injected)).toBe(true);
  });

  it('does not surface a fact filed for a different flow', () => {
    const repoRoot = tempRepo();
    seedFact(repoRoot, { id: 'project-note-review', flowId: 'review' });

    const { report } = prepareRunStartHistoryRecall({
      repoRoot,
      query: 'add the dashboard filter',
      flowId: 'build',
      now: () => new Date('2026-05-29T01:00:00.000Z'),
    });

    expect(report.memory_inputs.map((memory) => memory.memory_id)).not.toContain(
      'project-note-review',
    );
  });

  it('injects nothing when no flow is in scope (D6: injection is (project, flow)-scoped)', () => {
    const repoRoot = tempRepo();
    // facts exist for two flows, but with no flowId there is no scope to inject under
    seedFact(repoRoot, { id: 'project-note-build', flowId: 'build' });
    const { candidates } = loadProjectFactCandidates({
      repoRoot,
      now: () => new Date('2026-05-29T01:00:00.000Z'),
    });
    expect(candidates).toHaveLength(0);
  });

  it('reads but never mutates the project store at run start (boundary §6)', () => {
    const repoRoot = tempRepo();
    seedFact(repoRoot, { id: 'project-note-build', flowId: 'build' });
    const storePath = join(repoRoot, '.circuit', 'memory', 'project.v1.jsonl');
    const before = readFileSync(storePath, 'utf8');
    prepareRunStartHistoryRecall({
      repoRoot,
      query: 'add the dashboard filter',
      flowId: 'build',
      now: () => new Date('2026-05-29T01:00:00.000Z'),
    });
    // the recall path only READS project facts; the store is byte-identical after
    expect(readFileSync(storePath, 'utf8')).toBe(before);
  });

  it('does not create the project store when recall runs without one', () => {
    const repoRoot = tempRepo();
    prepareRunStartHistoryRecall({
      repoRoot,
      query: 'add the dashboard filter',
      flowId: 'build',
      now: () => new Date('2026-05-29T01:00:00.000Z'),
    });
    expect(existsSync(join(repoRoot, '.circuit', 'memory', 'project.v1.jsonl'))).toBe(false);
  });
});
