import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { extractRunHistoryDocuments } from '../../src/app/history/extract.js';
import { historyMemoryInputPreview } from '../../src/app/history/memory-preview.js';
import { HistoryDocumentV1, HistoryQueryHitV1 } from '../../src/schemas/index.js';
import { isFailureOutcome } from '../../src/shared/outcome.js';

const RUN_ID = '22222222-2222-4222-8222-222222222222';
const RECORDED_AT = '2026-05-30T12:00:00.000Z';
const SHA = 'a'.repeat(64);

const tempRoots: string[] = [];
afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

// Build a minimal run folder shaped like the circuit-land corpus: a manifest
// and a reports/result.json carrying the outcome/summary/reason fields the
// extractor reads. Returns the run-level history document.
function runDocFor(result: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), 'mem-fail-'));
  tempRoots.push(root);
  const runFolder = join(root, '.circuit', 'runs', RUN_ID);
  writeJson(join(runFolder, 'manifest.snapshot.json'), {
    schema_version: 1,
    run_id: RUN_ID,
    flow_id: 'build',
    captured_at: RECORDED_AT,
  });
  writeJson(join(runFolder, 'reports', 'result.json'), result);
  const output = extractRunHistoryDocuments(runFolder);
  const runDoc = output.documents.find((doc) => doc.doc_kind === 'run');
  expect(runDoc).toBeDefined();
  return runDoc;
}

// Envelope-vocabulary failures (`failed`, `blocked`) never appear on a run
// result — RunResult.outcome is RunClosedOutcome — they reach buildFacets only
// through a report body. This helper writes a clean run result plus one report
// file carrying the failure outcome and returns that report's document.
function reportDocFor(reportName: string, body: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), 'mem-fail-'));
  tempRoots.push(root);
  const runFolder = join(root, '.circuit', 'runs', RUN_ID);
  writeJson(join(runFolder, 'manifest.snapshot.json'), {
    schema_version: 1,
    run_id: RUN_ID,
    flow_id: 'goal',
    captured_at: RECORDED_AT,
  });
  writeJson(join(runFolder, 'reports', 'result.json'), {
    flow_id: 'goal',
    outcome: 'complete',
    goal: 'Wire the connector relay',
    summary: 'done',
  });
  writeJson(join(runFolder, 'reports', reportName), body);
  const output = extractRunHistoryDocuments(runFolder);
  const reportDoc = output.documents.find(
    (doc) => doc.doc_kind !== 'run' && doc.source_path === `reports/${reportName}`,
  );
  expect(reportDoc).toBeDefined();
  return reportDoc;
}

describe('isFailureOutcome predicate (two-vocabulary reconciliation)', () => {
  it('treats both vocabularies failure members as failures, neutrals as not', () => {
    // RunEnvelopeOutcome failures + RunClosedOutcome failures.
    for (const failure of ['aborted', 'escalated', 'failed', 'blocked']) {
      expect(isFailureOutcome(failure)).toBe(true);
    }
    // Neutral / success in either vocabulary.
    for (const neutral of ['complete', 'handoff', 'stopped', 'needs_attention', undefined]) {
      expect(isFailureOutcome(neutral)).toBe(false);
    }
  });
});

describe('failure facet covers both outcome vocabularies (extract.buildFacets)', () => {
  it('marks an escalated run (RunClosed vocabulary) with the failure facet', () => {
    // The realistic run-level failure the old `outcome === "aborted"` check
    // missed: escalated maps to a failure but was never facet-flagged.
    const runDoc = runDocFor({
      flow_id: 'build',
      outcome: 'escalated',
      goal: 'Wire the connector relay',
      summary: 'escalated after exhausting recovery attempts',
      reason: 'recovery exceeded the allowed attempts',
    });
    expect(runDoc?.facets).toContain('failure');
  });

  it('marks a report whose body outcome is blocked (envelope vocabulary)', () => {
    const reportDoc = reportDocFor('review-result.json', {
      schema: 'review.result@v1',
      outcome: 'blocked',
      summary: 'blocked before producing required proof',
    });
    expect(reportDoc?.facets).toContain('failure');
  });

  it('marks a report whose body outcome is failed (envelope vocabulary)', () => {
    const reportDoc = reportDocFor('fix-result.json', {
      schema: 'fix.result@v1',
      outcome: 'failed',
      summary: 'fix attempt failed verification',
    });
    expect(reportDoc?.facets).toContain('failure');
  });
});

describe('makeRunDocument failure summary leads with the failure reason', () => {
  it('leads with the reason, not a bare outcome restatement', () => {
    const runDoc = runDocFor({
      flow_id: 'build',
      outcome: 'aborted',
      goal: 'Wire the connector relay',
      summary: 'Run closed with outcome aborted.',
      reason: 'connector result_body lacked a non-empty result',
    });
    expect(runDoc?.summary).toContain('connector result_body lacked a non-empty result');
    expect(runDoc?.summary.startsWith('Run closed with outcome')).toBe(false);
  });
});

describe('memory-preview hintText leads with summary on a prior_failure hit', () => {
  it('leads with the failure summary instead of the lexical snippet', () => {
    const summary = 'Build failed: the connector relay produced an empty result body.';
    const doc = HistoryDocumentV1.parse({
      api_version: 'history-document-v1',
      schema_version: 1,
      doc_id: `${RUN_ID}/run/abcdef012345`,
      doc_kind: 'run',
      run_id: RUN_ID,
      flow_id: 'build',
      run_folder: '/tmp/run',
      source_path: 'reports/result.json',
      source_ref: { kind: 'report', ref: 'reports/result.json', sha256: SHA },
      source_sha256: SHA,
      recorded_at: RECORDED_AT,
      outcome: 'failed',
      title: 'build run failed',
      summary,
      text: 'goal: ...\noutcome: failed\nconnector relay empty body',
      extracted_from: [{ field_role: 'summary' }],
      facets: ['failure', 'flow:build', 'kind:run', 'outcome:failed'],
      memory_safe: true,
    });
    const hit = HistoryQueryHitV1.parse({
      rank: 1,
      score: 12,
      doc,
      // A low-signal lexical fragment of the kind the ranker matches on.
      snippet: 'src/index.ts changed M status_short',
      matched_terms: ['relay'],
      ranking_reasons: ['failure facet matched'],
      staleness: {
        status: 'unknown',
        reason_codes: ['memory_unverified'],
        checked_at: RECORDED_AT,
      },
    });
    const preview = historyMemoryInputPreview({
      query: 'connector relay empty result body',
      indexState: 'fresh',
      rebuilt: false,
      warnings: [],
      hits: [hit],
      capturedAt: RECORDED_AT,
    });
    const hintTextOut = preview.memory_inputs[0]?.hints[0]?.text ?? '';
    expect(hintTextOut.startsWith(summary)).toBe(true);
  });

  it('keeps leading with the snippet on a non-failure hit (unchanged behavior)', () => {
    const summary = 'Decision: index history before runtime injection.';
    const snippet = 'cited the explicit history index design over runtime injection';
    const doc = HistoryDocumentV1.parse({
      api_version: 'history-document-v1',
      schema_version: 1,
      doc_id: `${RUN_ID}/run/fedcba543210`,
      doc_kind: 'run',
      run_id: RUN_ID,
      flow_id: 'build',
      run_folder: '/tmp/run',
      source_path: 'reports/result.json',
      source_ref: { kind: 'report', ref: 'reports/result.json', sha256: SHA },
      source_sha256: SHA,
      recorded_at: RECORDED_AT,
      outcome: 'complete',
      title: 'build run complete',
      summary,
      // No 'failure' facet -> appliesTo is not prior_failure -> snippet leads.
      text: 'goal: ...\noutcome: complete',
      extracted_from: [{ field_role: 'summary' }],
      facets: ['flow:build', 'kind:run', 'outcome:complete'],
      memory_safe: true,
    });
    const hit = HistoryQueryHitV1.parse({
      rank: 1,
      score: 8,
      doc,
      snippet,
      matched_terms: ['history'],
      ranking_reasons: [],
      staleness: {
        status: 'fresh',
        reason_codes: ['source_match'],
        checked_at: RECORDED_AT,
      },
    });
    const preview = historyMemoryInputPreview({
      query: 'history index design',
      indexState: 'fresh',
      rebuilt: false,
      warnings: [],
      hits: [hit],
      capturedAt: RECORDED_AT,
    });
    const hintTextOut = preview.memory_inputs[0]?.hints[0]?.text ?? '';
    expect(hintTextOut.startsWith(snippet)).toBe(true);
  });
});
