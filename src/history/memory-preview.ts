import {
  HISTORY_AUTHORITY_NOTICE,
  type HistoryMemoryInputPreviewV1 as HistoryMemoryInputPreview,
  HistoryMemoryInputPreviewV1,
  type HistoryQueryHitV1 as HistoryQueryHit,
  type HistoryWarningV1,
  MemoryInputV0,
} from '../schemas/index.js';
import { sha256Hex } from '../shared/connector-relay.js';

function fileStem(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const trimmed = normalized.replace(/^[^a-z0-9]+/, '').slice(0, 96);
  return trimmed.length === 0 ? 'memory' : trimmed;
}

function appliesTo(hit: HistoryQueryHit) {
  const facets = new Set(hit.doc.facets);
  if (facets.has('failure')) return 'prior_failure' as const;
  if (facets.has('verification')) return 'verification' as const;
  if (facets.has('operator-note')) return 'operator_note' as const;
  return 'context' as const;
}

function hintText(hit: HistoryQueryHit): string {
  const caution =
    hit.doc.facets.includes('checkpoint') || hit.doc.facets.includes('verification')
      ? ' This is prior-run context only; rerun current checks before relying on it.'
      : '';
  const base = hit.snippet.trim().length > 0 ? hit.snippet.trim() : hit.doc.summary;
  return `${base}\nSource: ${hit.doc.run_id} ${hit.doc.source_path}.${caution}`.trim();
}

export function historyMemoryInputPreview(input: {
  readonly query: string;
  readonly indexState: 'fresh' | 'possibly_stale';
  readonly rebuilt: boolean;
  readonly warnings: readonly HistoryWarningV1[];
  readonly hits: readonly HistoryQueryHit[];
  readonly capturedAt?: string;
}): HistoryMemoryInputPreview {
  const memoryInputs = [];
  const matches = [];
  for (const hit of input.hits) {
    if (!hit.doc.memory_safe) continue;
    const hash = sha256Hex(hit.doc.doc_id).slice(0, 12);
    const runPrefix = fileStem(hit.doc.run_id).slice(0, 32);
    const memoryId = `prior-run-${runPrefix}-${hash}`.slice(0, 128);
    const source =
      hit.doc.source_ref.sha256 !== undefined &&
      hit.doc.source_sha256 !== undefined &&
      hit.doc.source_ref.sha256 === hit.doc.source_sha256
        ? {
            ref: hit.doc.source_ref,
            captured_at: hit.doc.recorded_at ?? input.capturedAt ?? new Date().toISOString(),
            ...(hit.doc.source_mtime_ms === undefined
              ? {}
              : { source_updated_at: new Date(hit.doc.source_mtime_ms).toISOString() }),
            sha256: hit.doc.source_sha256,
          }
        : {
            ref: hit.doc.source_ref,
            captured_at: hit.doc.recorded_at ?? input.capturedAt ?? new Date().toISOString(),
            ...(hit.doc.source_mtime_ms === undefined
              ? {}
              : { source_updated_at: new Date(hit.doc.source_mtime_ms).toISOString() }),
          };
    const memory = MemoryInputV0.parse({
      schema_version: 1,
      memory_id: memoryId,
      kind: 'prior_run',
      source,
      summary: hit.doc.summary,
      hints: [
        {
          id: `hint-${hash}`,
          text: hintText(hit),
          applies_to: appliesTo(hit),
        },
      ],
      staleness: hit.staleness,
      authority: 'hint_only',
    });
    memoryInputs.push(memory);
    matches.push({
      memory_id: memoryId,
      rank: hit.rank,
      score: hit.score,
      source_doc_id: hit.doc.doc_id,
      source_ref: hit.doc.source_ref,
      snippet: hit.snippet,
    });
  }

  return HistoryMemoryInputPreviewV1.parse({
    api_version: 'history-memory-input-preview-v1',
    schema_version: 1,
    query: input.query,
    format: 'memory-input',
    index_state: input.indexState,
    rebuilt: input.rebuilt,
    authority_notice: HISTORY_AUTHORITY_NOTICE,
    warnings: input.warnings,
    memory_inputs: memoryInputs,
    matches,
  });
}
