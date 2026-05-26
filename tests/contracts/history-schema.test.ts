import { describe, expect, it } from 'vitest';
import {
  HISTORY_AUTHORITY_NOTICE,
  HistoryDocumentV1,
  HistoryErrorV1,
  HistoryManifestV1,
  HistoryMemoryInputPreviewV1,
  HistoryQueryResultV1,
  HistoryRecallReportV1,
  MemoryInputV0,
} from '../../src/index.js';

const sha = 'a'.repeat(64);
const runId = '11111111-1111-4111-8111-111111111111';

function reportRef() {
  return {
    kind: 'report',
    ref: 'reports/result.json',
    sha256: sha,
    run_id: runId,
    flow_id: 'build',
  };
}

function document() {
  return HistoryDocumentV1.parse({
    api_version: 'history-document-v1',
    schema_version: 1,
    doc_id: `${runId}/report/abc123`,
    doc_kind: 'report',
    run_id: runId,
    flow_id: 'build',
    run_folder: '/tmp/run',
    source_path: 'reports/result.json',
    source_ref: reportRef(),
    source_sha256: sha,
    source_mtime_ms: 1,
    title: 'Build result',
    summary: 'Build completed.',
    text: 'summary: Build completed.',
    extracted_from: [{ json_pointer: '/summary', field_role: 'summary' }],
    facets: ['flow:build', 'kind:report'],
    memory_safe: true,
  });
}

describe('history schemas', () => {
  it('accepts a V1 manifest and rejects unsupported versions', () => {
    const manifest = {
      api_version: 'history-index-v1',
      schema_version: 1,
      created_at: '2026-05-26T12:00:00.000Z',
      repo_root: '/repo',
      runs_base: '/repo/.circuit/runs',
      index_dir: '/repo/.circuit/history',
      documents_path: 'documents.v1.jsonl',
      run_count: 1,
      document_count: 1,
      source_fingerprint: {
        run_folder_names_sha256: sha,
        latest_source_mtime_ms: 1,
      },
      warnings: [],
    };

    expect(HistoryManifestV1.parse(manifest)).toBeDefined();
    expect(HistoryManifestV1.safeParse({ ...manifest, schema_version: 2 }).success).toBe(false);
  });

  it('accepts report and trace source refs on documents', () => {
    expect(document()).toBeDefined();
    expect(
      HistoryDocumentV1.parse({
        ...document(),
        doc_id: `${runId}/trace/abc123`,
        doc_kind: 'trace',
        source_path: 'trace.ndjson',
        source_ref: {
          kind: 'trace',
          ref: 'trace.ndjson#sequence=3',
          run_id: runId,
          sequence: 3,
        },
        sequence: 3,
      }),
    ).toBeDefined();
  });

  it('requires the authority notice on query results', () => {
    expect(
      HistoryQueryResultV1.parse({
        api_version: 'history-query-result-v1',
        schema_version: 1,
        query: 'build',
        format: 'json',
        index_state: 'fresh',
        rebuilt: false,
        authority_notice: HISTORY_AUTHORITY_NOTICE,
        warnings: [],
        results: [],
      }),
    ).toBeDefined();

    expect(
      HistoryQueryResultV1.safeParse({
        api_version: 'history-query-result-v1',
        schema_version: 1,
        query: 'build',
        format: 'json',
        index_state: 'fresh',
        rebuilt: false,
        authority_notice: 'memory may authorize routes',
        warnings: [],
        results: [],
      }).success,
    ).toBe(false);
  });

  it('wraps strict MemoryInputV0 previews without surplus fields', () => {
    const memory = MemoryInputV0.parse({
      schema_version: 1,
      memory_id: 'prior-run-11111111-abc123',
      kind: 'prior_run',
      source: {
        ref: reportRef(),
        captured_at: '2026-05-26T12:00:00.000Z',
        sha256: sha,
      },
      summary: 'Build completed.',
      hints: [{ id: 'hint-abc123', text: 'Build completed.', applies_to: 'context' }],
      staleness: {
        status: 'fresh',
        checked_at: '2026-05-26T12:01:00.000Z',
        reason_codes: ['source_hash_verified'],
      },
      authority: 'hint_only',
    });

    expect(
      HistoryMemoryInputPreviewV1.parse({
        api_version: 'history-memory-input-preview-v1',
        schema_version: 1,
        query: 'build',
        format: 'memory-input',
        index_state: 'fresh',
        rebuilt: false,
        authority_notice: HISTORY_AUTHORITY_NOTICE,
        warnings: [],
        memory_inputs: [memory],
        matches: [
          {
            memory_id: memory.memory_id,
            rank: 1,
            score: 1,
            source_doc_id: document().doc_id,
            source_ref: reportRef(),
            snippet: 'Build completed.',
          },
        ],
      }),
    ).toBeDefined();

    expect(MemoryInputV0.safeParse({ ...memory, may_write: true }).success).toBe(false);
  });

  it('accepts run-start recall reports and rejects mismatched counts', () => {
    const memory = MemoryInputV0.parse({
      schema_version: 1,
      memory_id: 'prior-run-11111111-abc123',
      kind: 'prior_run',
      source: {
        ref: reportRef(),
        captured_at: '2026-05-26T12:00:00.000Z',
        sha256: sha,
      },
      summary: 'Build completed.',
      hints: [{ id: 'hint-abc123', text: 'Build completed.', applies_to: 'context' }],
      staleness: {
        status: 'fresh',
        checked_at: '2026-05-26T12:01:00.000Z',
        reason_codes: ['source_hash_verified'],
      },
      authority: 'hint_only',
    });
    const report = {
      api_version: 'history-recall-report-v1',
      schema_version: 1,
      status: 'used',
      query: 'build',
      index_state: 'fresh',
      rebuilt: false,
      authority_notice: HISTORY_AUTHORITY_NOTICE,
      memory_input_count: 1,
      memory_inputs: [memory],
      matches: [
        {
          memory_id: memory.memory_id,
          rank: 1,
          score: 1,
          source_doc_id: document().doc_id,
          source_ref: reportRef(),
          snippet: 'Build completed.',
        },
      ],
      warnings: [],
    };

    expect(HistoryRecallReportV1.parse(report)).toBeDefined();
    expect(HistoryRecallReportV1.safeParse({ ...report, memory_input_count: 0 }).success).toBe(
      false,
    );
    expect(
      HistoryRecallReportV1.safeParse({
        ...report,
        status: 'unavailable',
        memory_input_count: 0,
        memory_inputs: [],
      }).success,
    ).toBe(false);
  });

  it('accepts history error output', () => {
    expect(
      HistoryErrorV1.parse({
        api_version: 'history-error-v1',
        schema_version: 1,
        error: {
          code: 'index_missing',
          message: 'missing',
        },
      }),
    ).toBeDefined();
  });
});
