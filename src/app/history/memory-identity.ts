import type { MemoryInputV0 } from '../../schemas/index.js';
import { sha256Hex } from '../../shared/connector-relay.js';

// The content-addressed, run-independent identity of a memory item, shared by the
// Slice 1 merge reader and the Slice 3/4 injection/pull gates so the cross-run
// join key cannot drift between producer and consumer (a contract test pins
// parity). It hashes only the cited source artifact (kind, path, content sha),
// deliberately excluding run_id / flow_id / step_id and the run-scoped memory_id
// string, so two runs that recalled the same source artifact share one
// content_id.
//
// When no content hash is available we return null rather than hashing the path
// alone. contentSha is source.ref.sha256 ?? source.sha256; we reach the null
// branch only when both are absent. A path alone (e.g. a trace ref's
// trace.ndjson#sequence=5) is identical across runs, so hashing it without a
// content sha would falsely conflate genuinely distinct artifacts into one
// cross-run group. Content-bearing ref kinds (report, evidence, ...) are
// schema-required to carry ref.sha256 and so are always content-addressed; a
// hashless kind reaches the null branch unless it independently carries
// source.sha256.
//
// This computation must stay STABLE: changing the hash basis silently re-buckets
// every cross-run comparison.
export function contentIdentityOf(memory: MemoryInputV0): {
  readonly contentId: string | null;
  readonly unhashedSource: boolean;
} {
  const contentSha = memory.source.ref.sha256 ?? memory.source.sha256 ?? null;
  if (contentSha === null) {
    return { contentId: null, unhashedSource: true };
  }
  const basis = JSON.stringify([memory.source.ref.kind, memory.source.ref.ref, contentSha]);
  return { contentId: `mem-c-${sha256Hex(basis).slice(0, 16)}`, unhashedSource: false };
}

// The Slice 1/2/3/4 grouping key: content_id when content-addressed, else the
// unresolved:<memory_id> fallback. memory_id is source-doc-scoped (stable across
// recalling runs), so two same-flow runs recalling the same unhashed source doc
// share one unresolved group. Centralized here so every consumer forms the key
// identically.
export function groupKeyForMemory(memory: MemoryInputV0): string {
  const { contentId } = contentIdentityOf(memory);
  return contentId ?? `unresolved:${memory.memory_id}`;
}
