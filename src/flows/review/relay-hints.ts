// Standalone review flow relay shape hint.
//
// The audit step does not register a typed report under
// writes.report (only request_path / receipt_path / result_path), so
// this hint cannot key off step.writes.report.schema. It matches by
// the structural shape of the relay step instead: reviewer role
// plus the NO_ISSUES_FOUND/ISSUES_FOUND check verdicts that mirror the
// review.relay-result body shape.

import type { StructuralShapeHint } from '../registries/shape-hints/types.js';

export const reviewRelayShapeHint: StructuralShapeHint = {
  kind: 'structural',
  id: 'review.relay-result@structural',
  match(step) {
    return (
      step.role === 'reviewer' &&
      step.check.pass.includes('NO_ISSUES_FOUND') &&
      step.check.pass.includes('ISSUES_FOUND')
    );
  },
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<one-of-accepted-verdicts>", "findings": [{ "severity": "<critical|high|low>", "id": "<stable finding id>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    'Use an empty findings array when there are no issues: { "verdict": "NO_ISSUES_FOUND", "findings": [] }.',
    'Use an empty file_refs array when a finding has no file-specific reference.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and the close step validates findings before writing reports/review-result.json.',
  ].join(' '),
};
