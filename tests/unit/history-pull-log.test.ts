import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  HISTORY_PULL_LOG_RELATIVE_PATH,
  appendPullLogEntry,
  readPullLog,
} from '../../src/app/history/pull-log.js';
import { HistoryPullLogV1, PullLogEntryV1 } from '../../src/index.js';

const tempRoots: string[] = [];

function tempRunFolder(): string {
  const root = mkdtempSync(join(tmpdir(), 'pull-log-'));
  tempRoots.push(root);
  return root;
}

function entry(overrides: Record<string, unknown> = {}): PullLogEntryV1 {
  return PullLogEntryV1.parse({
    pull_id: 'pull-1',
    recorded_at: '2026-05-29T00:00:00.000Z',
    decision_point: 'before-editing-auth-guard',
    query: 'auth guard',
    flow_id: 'build',
    result_count: 1,
    suppressed_count: 0,
    effect_report_available: false,
    results: [
      {
        memory_input_id: 'prior-run-s1-aaaaaaaaaaaa',
        content_id: 'mem-c-0123456789abcdef',
        staleness: 'fresh',
        source_ref: {
          kind: 'report',
          ref: 'reports/result.json',
          sha256: 'a'.repeat(64),
          run_id: '00000000-0000-4000-8000-00000000a001',
          flow_id: 'build',
        },
      },
    ],
    authority: 'hint_only',
    ...overrides,
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('appendPullLogEntry / readPullLog', () => {
  it('synthesizes a valid header (with run_id) on the first pull', () => {
    const runFolder = tempRunFolder();
    const { path, warnings } = appendPullLogEntry(runFolder, {
      entry: entry(),
      runId: '00000000-0000-4000-8000-00000000a009',
    });
    expect(warnings).toEqual([]);
    expect(path).toBe(join(runFolder, HISTORY_PULL_LOG_RELATIVE_PATH));
    const log = readPullLog(runFolder);
    expect(log).toBeDefined();
    expect(log?.api_version).toBe('history-pull-log-v1');
    expect(log?.run_id).toBe('00000000-0000-4000-8000-00000000a009');
    expect(log?.entries).toHaveLength(1);
    expect(log?.entries[0]?.pull_id).toBe('pull-1');
    // The on-disk file re-parses as a valid log.
    expect(() =>
      HistoryPullLogV1.parse(JSON.parse(readFileSync(path as string, 'utf8'))),
    ).not.toThrow();
  });

  it('omits run_id from the synthesized header when none is supplied', () => {
    const runFolder = tempRunFolder();
    appendPullLogEntry(runFolder, { entry: entry() });
    expect(readPullLog(runFolder)?.run_id).toBeUndefined();
  });

  it('appends on subsequent pulls, preserving order and the header', () => {
    const runFolder = tempRunFolder();
    appendPullLogEntry(runFolder, {
      entry: entry({ pull_id: 'pull-1' }),
      runId: '00000000-0000-4000-8000-00000000a009',
    });
    appendPullLogEntry(runFolder, {
      entry: entry({ pull_id: 'pull-2', effect_report_available: true }),
      // A later pull may supply a different runId; the original header is preserved.
      runId: 'ignored-on-append',
    });
    const log = readPullLog(runFolder);
    expect(log?.run_id).toBe('00000000-0000-4000-8000-00000000a009');
    expect(log?.entries.map((e) => e.pull_id)).toEqual(['pull-1', 'pull-2']);
    // Each entry keeps its own effect_report_available (per-pull, not file-level).
    expect(log?.entries[0]?.effect_report_available).toBe(false);
    expect(log?.entries[1]?.effect_report_available).toBe(true);
  });

  it('does not throw and warns when the run folder is unwritable (the pull is never blocked)', () => {
    // A run folder whose parent path is a file, so mkdir/write must fail.
    const root = tempRunFolder();
    const blocker = join(root, 'blocker');
    writeFileSync(blocker, 'not a directory', 'utf8');
    const runFolder = join(blocker, 'nested-run');
    const { path, warnings } = appendPullLogEntry(runFolder, { entry: entry() });
    expect(path).toBeUndefined();
    expect(warnings.some((w) => w.code === 'pull_log_unavailable')).toBe(true);
  });

  it('resets a corrupt prior log to a fresh header and records a file-level warning', () => {
    const runFolder = tempRunFolder();
    appendPullLogEntry(runFolder, { entry: entry({ pull_id: 'pull-1' }) });
    // Corrupt the file on disk.
    const path = join(runFolder, HISTORY_PULL_LOG_RELATIVE_PATH);
    writeFileSync(path, '{ not valid json', 'utf8');
    const { warnings } = appendPullLogEntry(runFolder, { entry: entry({ pull_id: 'pull-2' }) });
    const log = readPullLog(runFolder);
    // The corrupt prior log was reset; only the new entry survives.
    expect(log?.entries.map((e) => e.pull_id)).toEqual(['pull-2']);
    expect(log?.warnings.some((w) => w.code === 'pull_log_unavailable')).toBe(true);
    expect(warnings.some((w) => w.code === 'pull_log_unavailable')).toBe(true);
  });

  it('readPullLog returns undefined when no log exists', () => {
    expect(readPullLog(tempRunFolder())).toBeUndefined();
  });
});
