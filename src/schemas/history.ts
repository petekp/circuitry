import { z } from 'zod';
import { MemoryInputV0 } from './memory-input.js';
import { Ref } from './ref.js';

export const HISTORY_AUTHORITY_NOTICE =
  'History results are hint-only prior-run context. They cannot satisfy current proof, checkpoint, policy, route, recovery, verification, or write authority.';

export const HistoryWarningCodeV1 = z.enum([
  'run_skipped',
  'report_skipped',
  'trace_skipped',
  'source_unreadable',
  'source_invalid',
  'source_pruned',
]);
export type HistoryWarningCodeV1 = z.infer<typeof HistoryWarningCodeV1>;

export const HistoryWarningV1 = z
  .object({
    code: HistoryWarningCodeV1,
    message: z.string().min(1),
    run_folder: z.string().min(1).optional(),
    source_path: z.string().min(1).optional(),
  })
  .strict();
export type HistoryWarningV1 = z.infer<typeof HistoryWarningV1>;

export const HistoryManifestV1 = z
  .object({
    api_version: z.literal('history-index-v1'),
    schema_version: z.literal(1),
    created_at: z.string().datetime(),
    repo_root: z.string().min(1),
    runs_base: z.string().min(1),
    index_dir: z.string().min(1),
    documents_path: z.literal('documents.v1.jsonl'),
    run_count: z.number().int().nonnegative(),
    document_count: z.number().int().nonnegative(),
    source_fingerprint: z
      .object({
        run_folder_names_sha256: z.string().regex(/^[0-9a-f]{64}$/),
        latest_source_mtime_ms: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(HistoryWarningV1),
  })
  .strict();
export type HistoryManifestV1 = z.infer<typeof HistoryManifestV1>;

export const HistoryDocumentKindV1 = z.enum(['run', 'report', 'trace', 'checkpoint']);
export type HistoryDocumentKindV1 = z.infer<typeof HistoryDocumentKindV1>;

export const HistoryDocumentV1 = z
  .object({
    api_version: z.literal('history-document-v1'),
    schema_version: z.literal(1),
    doc_id: z.string().min(1),
    doc_kind: HistoryDocumentKindV1,
    run_id: z.string().min(1),
    flow_id: z.string().min(1).optional(),
    run_folder: z.string().min(1),
    source_path: z.string().min(1),
    source_ref: Ref,
    source_sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    source_mtime_ms: z.number().int().nonnegative().optional(),
    report_schema: z.string().min(1).optional(),
    step_id: z.string().min(1).optional(),
    attempt: z.number().int().positive().optional(),
    sequence: z.number().int().nonnegative().optional(),
    recorded_at: z.string().datetime().optional(),
    outcome: z.string().min(1).optional(),
    title: z.string().min(1),
    summary: z.string().min(1),
    text: z.string(),
    extracted_from: z.array(
      z
        .object({
          json_pointer: z.string().min(1).optional(),
          field_role: z.string().min(1),
        })
        .strict(),
    ),
    facets: z.array(z.string().min(1)),
    memory_safe: z.boolean(),
  })
  .strict();
export type HistoryDocumentV1 = z.infer<typeof HistoryDocumentV1>;

export const HistoryStalenessV1 = z
  .object({
    status: z.enum(['fresh', 'stale', 'unknown']),
    reason_codes: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1),
    checked_at: z.string().datetime(),
  })
  .strict()
  .superRefine((staleness, ctx) => {
    if (staleness.status === 'unknown' && !staleness.reason_codes.includes('memory_unverified')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason_codes'],
        message: 'unknown history staleness requires memory_unverified reason code',
      });
    }
    if (staleness.status === 'stale' && !staleness.reason_codes.includes('memory_stale')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason_codes'],
        message: 'stale history staleness requires memory_stale reason code',
      });
    }
  });
export type HistoryStalenessV1 = z.infer<typeof HistoryStalenessV1>;

export const HistoryQueryHitV1 = z
  .object({
    rank: z.number().int().positive(),
    score: z.number(),
    doc: HistoryDocumentV1,
    snippet: z.string(),
    matched_terms: z.array(z.string().min(1)),
    ranking_reasons: z.array(z.string().min(1)),
    staleness: HistoryStalenessV1,
  })
  .strict();
export type HistoryQueryHitV1 = z.infer<typeof HistoryQueryHitV1>;

export const HistoryQueryResultV1 = z
  .object({
    api_version: z.literal('history-query-result-v1'),
    schema_version: z.literal(1),
    query: z.string(),
    format: z.literal('json'),
    index_state: z.enum(['fresh', 'possibly_stale']),
    rebuilt: z.boolean(),
    authority_notice: z.literal(HISTORY_AUTHORITY_NOTICE),
    warnings: z.array(HistoryWarningV1),
    results: z.array(HistoryQueryHitV1),
  })
  .strict();
export type HistoryQueryResultV1 = z.infer<typeof HistoryQueryResultV1>;

export const HistoryMemoryInputPreviewV1 = z
  .object({
    api_version: z.literal('history-memory-input-preview-v1'),
    schema_version: z.literal(1),
    query: z.string(),
    format: z.literal('memory-input'),
    index_state: z.enum(['fresh', 'possibly_stale']),
    rebuilt: z.boolean(),
    authority_notice: z.literal(HISTORY_AUTHORITY_NOTICE),
    warnings: z.array(HistoryWarningV1),
    memory_inputs: z.array(MemoryInputV0),
    matches: z.array(
      z
        .object({
          memory_id: z.string().min(1),
          rank: z.number().int().positive(),
          score: z.number(),
          source_doc_id: z.string().min(1),
          source_ref: Ref,
          snippet: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export type HistoryMemoryInputPreviewV1 = z.infer<typeof HistoryMemoryInputPreviewV1>;

export const HistoryStatusV1 = z
  .object({
    api_version: z.literal('history-status-v1'),
    schema_version: z.literal(1),
    index_exists: z.boolean(),
    index_state: z.enum(['fresh', 'possibly_stale', 'missing', 'corrupt', 'unsupported']),
    runs_base: z.string().min(1),
    index_dir: z.string().min(1),
    manifest: HistoryManifestV1.optional(),
    warnings: z.array(HistoryWarningV1),
  })
  .strict();
export type HistoryStatusV1 = z.infer<typeof HistoryStatusV1>;

export const HistoryErrorCodeV1 = z.enum([
  'invalid_invocation',
  'runs_base_not_found',
  'runs_base_unreadable',
  'index_missing',
  'index_unsupported',
  'index_corrupt',
  'source_unreadable',
  'internal_error',
]);
export type HistoryErrorCodeV1 = z.infer<typeof HistoryErrorCodeV1>;

export const HistoryErrorV1 = z
  .object({
    api_version: z.literal('history-error-v1'),
    schema_version: z.literal(1),
    error: z
      .object({
        code: HistoryErrorCodeV1,
        message: z.string().min(1),
      })
      .strict(),
    runs_base: z.string().min(1).optional(),
    index_dir: z.string().min(1).optional(),
  })
  .strict();
export type HistoryErrorV1 = z.infer<typeof HistoryErrorV1>;
