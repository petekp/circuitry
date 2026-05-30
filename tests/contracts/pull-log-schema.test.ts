import { describe, expect, it } from 'vitest';
import {
  HISTORY_AUTHORITY_NOTICE,
  HistoryPullLogV1,
  PullLogEntryV1,
  PullLogResultV1,
} from '../../src/index.js';

function result(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    pull_id: 'pull-1',
    recorded_at: '2026-05-29T00:00:00.000Z',
    decision_point: 'before-editing-auth-guard',
    query: 'auth guard',
    flow_id: 'build',
    result_count: 1,
    suppressed_count: 0,
    effect_report_available: false,
    results: [result()],
    authority: 'hint_only',
    ...overrides,
  };
}

function log(overrides: Record<string, unknown> = {}) {
  return {
    api_version: 'history-pull-log-v1',
    schema_version: 1,
    run_id: '00000000-0000-4000-8000-00000000a009',
    authority_notice: HISTORY_AUTHORITY_NOTICE,
    entries: [entry()],
    warnings: [],
    ...overrides,
  };
}

describe('history.pull-log@v1 schema', () => {
  it('accepts a well-formed log', () => {
    expect(() => HistoryPullLogV1.parse(log())).not.toThrow();
  });

  it('accepts an absent run_id (the header is optional)', () => {
    expect(HistoryPullLogV1.safeParse(log({ run_id: undefined })).success).toBe(true);
  });

  it('accepts an empty log (header synthesized before the first append)', () => {
    expect(HistoryPullLogV1.safeParse(log({ entries: [] })).success).toBe(true);
  });

  it('rejects an unknown api_version, schema_version, and wrong authority notice', () => {
    expect(HistoryPullLogV1.safeParse(log({ api_version: 'nope' })).success).toBe(false);
    expect(HistoryPullLogV1.safeParse(log({ schema_version: 2 })).success).toBe(false);
    expect(HistoryPullLogV1.safeParse(log({ authority_notice: 'x' })).success).toBe(false);
  });

  it('rejects unknown keys (strict) at every level', () => {
    expect(HistoryPullLogV1.safeParse({ ...log(), extra: 1 }).success).toBe(false);
    expect(HistoryPullLogV1.safeParse(log({ entries: [entry({ extra: 1 })] })).success).toBe(false);
    expect(
      HistoryPullLogV1.safeParse(log({ entries: [entry({ results: [result({ extra: 1 })] })] }))
        .success,
    ).toBe(false);
  });

  it('enforces authority is the hint_only literal on every entry', () => {
    expect(PullLogEntryV1.safeParse(entry({ authority: 'authoritative' })).success).toBe(false);
    expect(PullLogEntryV1.parse(entry()).authority).toBe('hint_only');
  });

  it('pins authority_notice to the canonical notice', () => {
    expect(HistoryPullLogV1.parse(log()).authority_notice).toBe(HISTORY_AUTHORITY_NOTICE);
  });

  it('rejects result_count that does not equal results.length (the refine)', () => {
    // Two results but result_count claims one.
    expect(
      PullLogEntryV1.safeParse(
        entry({
          result_count: 1,
          results: [result(), result({ memory_input_id: 'prior-run-s2-bbbbbbbbbbbb' })],
        }),
      ).success,
    ).toBe(false);
    // Zero results but result_count claims one.
    expect(PullLogEntryV1.safeParse(entry({ result_count: 1, results: [] })).success).toBe(false);
  });

  it('accepts a null content_id on a result (unhashed source)', () => {
    expect(
      PullLogResultV1.safeParse(
        result({
          content_id: null,
          source_ref: {
            kind: 'trace',
            ref: 'trace.ndjson#sequence=5',
            run_id: '00000000-0000-4000-8000-00000000a001',
            sequence: 5,
          },
        }),
      ).success,
    ).toBe(true);
  });

  it('carries effect_report_generated_at when the pull consulted verdicts', () => {
    const parsed = PullLogEntryV1.parse(
      entry({
        effect_report_available: true,
        effect_report_generated_at: '2026-05-28T00:00:00.000Z',
      }),
    );
    expect(parsed.effect_report_available).toBe(true);
    expect(parsed.effect_report_generated_at).toBe('2026-05-28T00:00:00.000Z');
  });

  it('rejects a negative result_count or suppressed_count', () => {
    expect(PullLogEntryV1.safeParse(entry({ result_count: -1, results: [] })).success).toBe(false);
    expect(PullLogEntryV1.safeParse(entry({ suppressed_count: -1 })).success).toBe(false);
  });
});
