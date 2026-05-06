// Build flow relay shape hints.

import type { SchemaShapeHint } from '../registries/shape-hints/types.js';

export const buildImplementationShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'build.implementation@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "accept", "summary": "<what changed>", "changed_files": ["<project-relative path>"], "evidence": ["<verification or implementation evidence>"] }',
    'Make the smallest behaviorally scoped change that satisfies the requested goal. Do not broaden semantics, normalize data, or add extra behavior just because tests still pass.',
    'Use an empty changed_files array only when no file changed. Evidence must contain at least one item. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against build.implementation@v1 before writing reports/build/implementation.json.',
  ].join(' '),
};

export const buildReviewShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'build.review@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<accept|accept-with-fixes|reject>", "summary": "<review summary>", "findings": [{ "severity": "<critical|high|medium|low>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    'Review the change against the requested scope, not just against passing tests. Flag behavior that broadens semantics beyond the goal even when verification passes.',
    'Use an empty findings array only with verdict "accept". Verdicts "accept-with-fixes" and "reject" must include at least one finding. Use an empty file_refs array when a finding has no file-specific reference. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against build.review@v1 before writing reports/build/review.json.',
  ].join(' '),
};
