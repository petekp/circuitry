// Fix flow relay shape hints.

import type { SchemaShapeHint } from '../registries/shape-hints/types.js';

export const fixContextShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'fix.context@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "accept", "sources": [{ "kind": "<file|command|log|operator-note|reference>", "ref": "<project-relative path, command id, log line, note id, or external reference>", "summary": "<one-line summary of what this source contributed>" }], "observations": ["<observation grounded in the sources>"], "open_questions": ["<question still unresolved after gathering context>"] }',
    'sources must contain at least one entry; observations must contain at least one entry. Use an empty open_questions array only when nothing remains unresolved. Every observation must be grounded in the cited sources — do not invent details that the sources do not support.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against fix.context@v1 before writing reports/fix/context.json.',
  ].join(' '),
};

export const fixDiagnosisShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'fix.diagnosis@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "accept", "reproduction_status": "<reproduced|not-reproduced|intermittent|not-attempted>", "cause_summary": "<one-line root-cause statement>", "confidence": "<low|medium|high>", "evidence": ["<file:line, command result, or report reference that supports the cause>"], "residual_uncertainty": ["<remaining unknown that could still affect the fix>"] }',
    'evidence must contain at least one entry. residual_uncertainty must be non-empty whenever reproduction_status is anything other than "reproduced" — if you could not cleanly reproduce the bug, name the unknowns honestly. Calibrate confidence to the evidence: do not claim "high" without direct reproduction or equivalent proof.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against fix.diagnosis@v1 before writing reports/fix/diagnosis.json.',
  ].join(' '),
};

export const fixChangeShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'fix.change@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "accept", "summary": "<what changed and why>", "diagnosis_ref": "<reference to the diagnosis report or section that motivates this change>", "changed_files": ["<project-relative path that was edited>"], "evidence": ["<test output, command result, or before/after observation that confirms the change works>"] }',
    'Make the smallest change that resolves the diagnosed cause. Do not refactor adjacent code, broaden behavior, or address unrelated issues in the same edit. changed_files must contain at least one entry; evidence must contain at least one entry.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against fix.change@v1 before writing reports/fix/change.json.',
  ].join(' '),
};

export const fixReviewShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'fix.review@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<accept|accept-with-fixes|reject>", "summary": "<review summary>", "findings": [{ "severity": "<critical|high|medium|low>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    "Review the change against the diagnosed cause and the brief's success criteria, not just against passing verification. Flag changes that broaden semantics beyond the bug being fixed even when the regression test passes.",
    'Use an empty findings array only with verdict "accept". Verdicts "accept-with-fixes" and "reject" must include at least one finding. Use an empty file_refs array when a finding has no file-specific reference. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against fix.review@v1 before writing reports/fix/review.json.',
  ].join(' '),
};
