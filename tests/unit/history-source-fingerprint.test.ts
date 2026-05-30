import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type HistoryPathOptions,
  historyStatus,
  rebuildHistoryIndex,
} from '../../src/history/indexer.js';
import { collectRunSourceFiles } from '../../src/history/run-source-files.js';

let workdir: string;
let runsBase: string;
let indexDir: string;

function runOptions(): HistoryPathOptions {
  return { runsBase, indexDir };
}

const RUN_TRACE = [
  JSON.stringify({
    api_version: 'trace-event-v1',
    kind: 'run.bootstrapped',
    run_id: 'run-1',
    sequence: 0,
    recorded_at: '2026-01-01T00:00:00.000Z',
    goal: 'demo goal',
  }),
  JSON.stringify({
    api_version: 'trace-event-v1',
    kind: 'run.closed',
    run_id: 'run-1',
    sequence: 1,
    outcome: 'complete',
  }),
].join('\n');

const RESULT_JSON = JSON.stringify({
  api_version: 'circuit-run-result-v1',
  run_id: 'run-1',
  outcome: 'complete',
});

function writeFile(relPath: string, content: string, mtime: number): void {
  const abs = join(runsBase, 'run-1', relPath);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
  utimesSync(abs, new Date(mtime), new Date(mtime));
}

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'history-source-fingerprint-'));
  runsBase = join(workdir, 'runs');
  indexDir = join(workdir, 'history');
  mkdirSync(runsBase, { recursive: true });
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe('history source fingerprint enumerator', () => {
  // SD-FIX-1: the rebuild fingerprint and the staleness recompute must enumerate
  // an IDENTICAL set of source files. Before the fix, the rebuild side included
  // EVERY file under reports/ (including non-JSON outputs), while the staleness
  // side counted only .json — so a non-JSON report holding the newest mtime made
  // a fresh rebuild falsely report possibly_stale.
  it('is fresh immediately after rebuild when a non-JSON report holds the newest mtime', () => {
    const base = 1_700_000_000_000;
    writeFile('trace.ndjson', RUN_TRACE, base);
    writeFile('reports/result.json', RESULT_JSON, base);
    // A generated, non-JSON report output with a strictly NEWER mtime than every .json source.
    writeFile('reports/run-surface.md', '# run surface\n', base + 1_000_000);

    rebuildHistoryIndex(runOptions());
    const status = historyStatus(runOptions());

    expect(status.index_exists).toBe(true);
    expect(status.index_state).toBe('fresh');
  });

  it('still flips to possibly_stale when a real .json source changes after rebuild', () => {
    const base = 1_700_000_000_000;
    writeFile('trace.ndjson', RUN_TRACE, base);
    writeFile('reports/result.json', RESULT_JSON, base);
    writeFile('reports/run-surface.md', '# run surface\n', base + 1_000_000);

    rebuildHistoryIndex(runOptions());
    expect(historyStatus(runOptions()).index_state).toBe('fresh');

    // Bumping a JSON source (a real document source) must still be detected.
    utimesSync(
      join(runsBase, 'run-1', 'reports/result.json'),
      new Date(base + 5_000_000),
      new Date(base + 5_000_000),
    );
    expect(historyStatus(runOptions()).index_state).toBe('possibly_stale');
  });

  it('excludes non-JSON reports and returns an identical set on repeated calls', () => {
    // The load-bearing invariant of SD-FIX-1 is that BOTH the rebuild path and the
    // staleness recompute derive their fingerprint from the SAME canonical
    // enumerator, so they enumerate an identical file set by construction. Assert
    // that determinism directly, including a nested reports/ subdirectory, so the
    // two fingerprints cannot drift apart for any run shape.
    const base = 1_700_000_000_000;
    writeFile('trace.ndjson', RUN_TRACE, base);
    writeFile('reports/result.json', RESULT_JSON, base);
    writeFile('reports/checkpoints/frame-step-request.json', JSON.stringify({ prompt: 'x' }), base);
    writeFile('reports/run-surface.md', '# run surface\n', base + 1_000_000);

    const runFolder = join(runsBase, 'run-1');
    const first = collectRunSourceFiles(runFolder);
    expect(collectRunSourceFiles(runFolder)).toEqual(first);
    // The non-JSON report output must never enter the source set.
    expect(first.some((file) => file.endsWith('.md'))).toBe(false);
    // The nested .json report is a genuine source and must be included.
    expect(first.some((file) => file.endsWith('frame-step-request.json'))).toBe(true);

    rebuildHistoryIndex(runOptions());
    expect(historyStatus(runOptions()).index_state).toBe('fresh');
  });

  it('does not follow a symlinked report on either side, so the index stays fresh', () => {
    const base = 1_700_000_000_000;
    writeFile('trace.ndjson', RUN_TRACE, base);
    writeFile('reports/result.json', RESULT_JSON, base);

    // A target JSON outside reports/, symlinked into reports/ with a strictly newer
    // mtime. The symlink must be skipped by the single canonical enumerator (it is
    // not followed), so it never enters the fingerprint on either side and the
    // index reports fresh immediately after rebuild.
    const externalTarget = join(workdir, 'external-report.json');
    writeFileSync(externalTarget, JSON.stringify({ external: true }));
    utimesSync(externalTarget, new Date(base + 9_000_000), new Date(base + 9_000_000));
    symlinkSync(externalTarget, join(runsBase, 'run-1', 'reports', 'linked.json'));

    const enumerated = collectRunSourceFiles(join(runsBase, 'run-1'));
    expect(enumerated.some((file) => file.endsWith('linked.json'))).toBe(false);

    rebuildHistoryIndex(runOptions());
    expect(historyStatus(runOptions()).index_state).toBe('fresh');

    // Mutating the symlink target must NOT flip the index to stale, because the
    // symlink is not part of the fingerprint on either side.
    utimesSync(externalTarget, new Date(base + 20_000_000), new Date(base + 20_000_000));
    expect(historyStatus(runOptions()).index_state).toBe('fresh');
  });
});
