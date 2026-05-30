import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type MemoryInputV0, MemoryInputV0 as MemoryInputV0Schema } from '../../src/index.js';
import {
  PROJECT_FACTS_FILE,
  appendProjectFact,
  forgetProjectFact,
  readProjectFacts,
  rewriteProjectFacts,
} from '../../src/memory/project-store.js';

const tempRoots: string[] = [];

function tempMemoryDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'project-store-'));
  tempRoots.push(root);
  const memoryDir = join(root, '.circuit', 'memory');
  mkdirSync(memoryDir, { recursive: true });
  return memoryDir;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const sha = 'a'.repeat(64);

function projectFact(args: { id: string; flowId: string }): MemoryInputV0 {
  return MemoryInputV0Schema.parse({
    schema_version: 1,
    memory_id: args.id,
    kind: 'project',
    source: {
      ref: { kind: 'report', ref: 'reports/result.json', sha256: sha, flow_id: args.flowId },
      captured_at: '2026-05-29T00:00:00.000Z',
      sha256: sha,
    },
    summary: `fact for ${args.flowId}`,
    hints: [{ id: 'hint-1', text: 'do the thing', applies_to: 'operator_note' }],
    staleness: {
      status: 'fresh',
      checked_at: '2026-05-29T00:00:00.000Z',
      reason_codes: ['source_hash_verified'],
    },
    authority: 'hint_only',
  });
}

describe('project-store', () => {
  it('append then read round-trips a kind:project record', () => {
    const memoryDir = tempMemoryDir();
    appendProjectFact(projectFact({ id: 'project-note-1', flowId: 'build' }), { memoryDir });
    const { facts, warnings } = readProjectFacts({ memoryDir });
    expect(warnings).toEqual([]);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.memory_id).toBe('project-note-1');
    expect(facts[0]?.kind).toBe('project');
  });

  it('scopes reads by flow_id (the local store location is the project scope)', () => {
    const memoryDir = tempMemoryDir();
    appendProjectFact(projectFact({ id: 'project-note-build', flowId: 'build' }), { memoryDir });
    appendProjectFact(projectFact({ id: 'project-note-review', flowId: 'review' }), { memoryDir });
    const build = readProjectFacts({ memoryDir, flowId: 'build' });
    expect(build.facts.map((fact) => fact.memory_id)).toEqual(['project-note-build']);
    const review = readProjectFacts({ memoryDir, flowId: 'review' });
    expect(review.facts.map((fact) => fact.memory_id)).toEqual(['project-note-review']);
    const all = readProjectFacts({ memoryDir });
    expect(all.facts).toHaveLength(2);
  });

  it('eviction rewrites the store without the forgotten id', () => {
    const memoryDir = tempMemoryDir();
    appendProjectFact(projectFact({ id: 'project-note-keep', flowId: 'build' }), { memoryDir });
    appendProjectFact(projectFact({ id: 'project-note-drop', flowId: 'build' }), { memoryDir });
    const result = forgetProjectFact('project-note-drop', { memoryDir });
    expect(result.removed).toBe(true);
    const { facts } = readProjectFacts({ memoryDir });
    expect(facts.map((fact) => fact.memory_id)).toEqual(['project-note-keep']);
  });

  it('reports a no-op forget rather than failing', () => {
    const memoryDir = tempMemoryDir();
    appendProjectFact(projectFact({ id: 'project-note-keep', flowId: 'build' }), { memoryDir });
    const result = forgetProjectFact('project-note-absent', { memoryDir });
    expect(result.removed).toBe(false);
    expect(readProjectFacts({ memoryDir }).facts).toHaveLength(1);
  });

  it('reports an invalid line rather than silently dropping it', () => {
    const memoryDir = tempMemoryDir();
    appendProjectFact(projectFact({ id: 'project-note-good', flowId: 'build' }), { memoryDir });
    appendFileSync(join(memoryDir, PROJECT_FACTS_FILE), '{ not valid json\n', 'utf8');
    const { facts, warnings } = readProjectFacts({ memoryDir });
    expect(facts).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('project_fact_invalid');
    expect(warnings[0]?.line).toBe(2);
  });

  it('rejects a non-project record on rewrite', () => {
    const memoryDir = tempMemoryDir();
    const priorRun = MemoryInputV0Schema.parse({
      ...projectFact({ id: 'prior-run-1', flowId: 'build' }),
      kind: 'prior_run',
    });
    expect(() => rewriteProjectFacts([priorRun], { memoryDir })).toThrow(/kind:"project"/);
  });

  it('an absent store reads as zero facts (fail-open)', () => {
    const root = mkdtempSync(join(tmpdir(), 'project-store-empty-'));
    tempRoots.push(root);
    const memoryDir = join(root, '.circuit', 'memory');
    const { facts, warnings } = readProjectFacts({ memoryDir });
    expect(facts).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('persisted file re-parses (atomic write discipline)', () => {
    const memoryDir = tempMemoryDir();
    const path = appendProjectFact(projectFact({ id: 'project-note-1', flowId: 'build' }), {
      memoryDir,
    });
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (line.trim().length === 0) continue;
      expect(() => MemoryInputV0Schema.parse(JSON.parse(line))).not.toThrow();
    }
  });
});
