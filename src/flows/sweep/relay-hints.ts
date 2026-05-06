// Sweep flow relay shape hints.

import type { SchemaShapeHint } from '../registries/shape-hints/types.js';

export const sweepAnalysisShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'sweep.analysis@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "accept", "summary": "<what was surveyed>", "candidates": [{ "id": "<stable candidate id>", "category": "<candidate category, e.g. dead-code, lint, coverage-gap>", "path": "<project-relative path>", "description": "<one-line description of the candidate>", "confidence": "<low|medium|high>", "risk": "<low|medium|high>" }] }',
    'Each candidate id must be unique within candidates. The candidates array must contain at least one entry; if the survey finds none, do not respond — instead investigate further reads first.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against sweep.analysis@v1 before writing reports/sweep/analysis.json.',
  ].join(' '),
};

export const sweepBatchShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'sweep.batch@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<accept|partial|reverted>", "summary": "<what changed>", "changed_files": ["<project-relative path>"], "items": [{ "candidate_id": "<id from sweep.queue.to_execute>", "status": "<acted|reverted|partial>", "evidence": "<how the change was applied or reverted>" }] }',
    'The items array must include exactly one entry for every candidate_id in the queue\'s to_execute list, with no duplicates. The verdict is computed from item statuses: "reverted" iff every item is reverted (and items is non-empty); "partial" iff any item is reverted or no item is acted; otherwise "accept". Use an empty changed_files array only when no file changed.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against sweep.batch@v1 before writing reports/sweep/batch.json.',
  ].join(' '),
};

export const sweepReviewShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'sweep.review@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<clean|minor-injections|critical-injections|reject>", "summary": "<review summary>", "findings": [{ "severity": "<critical|high|medium|low>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    'Use an empty findings array only with verdict "clean". Any other verdict must include at least one finding. Use an empty file_refs array when a finding has no file-specific reference.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against sweep.review@v1 before writing reports/sweep/review.json.',
  ].join(' '),
};
