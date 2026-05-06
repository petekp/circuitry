// Explore flow relay shape hints.

import type { SchemaShapeHint } from '../registries/shape-hints/types.js';

export const exploreComposeShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'explore.compose@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<one-of-accepted-verdicts>", "subject": "<subject investigated>", "recommendation": "<primary conclusion or recommendation>", "success_condition_alignment": "<how the recommendation satisfies the brief success condition>", "supporting_aspects": [{ "aspect": "<analysis aspect name>", "contribution": "<how this aspect supports the recommendation>", "evidence_refs": ["<report path or file:line reference that supports this contribution>"] }] }',
    'Ground claims in the provided reports or files you inspect. If the evidence is thin, say so in the recommendation instead of inventing certainty. When asked to score or grade, include the rubric in the recommendation and cite the evidence refs behind the score.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against explore.compose@v1 before writing reports/compose.json.',
  ].join(' '),
};

export const exploreReviewVerdictShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'explore.review-verdict@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<one-of-accepted-verdicts>", "overall_assessment": "<review summary>", "objections": ["<blocking or follow-up objection>"], "missed_angles": ["<important angle not covered>"] }',
    'Use empty arrays when there are no objections or missed angles. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against explore.review-verdict@v1 before writing reports/review-verdict.json.',
  ].join(' '),
};

export const exploreTournamentProposalShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'explore.tournament-proposal@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "accept", "option_id": "<option-1-through-option-4>", "option_label": "<option label>", "case_summary": "<strongest case for this option>", "assumptions": ["<assumption>"], "evidence_refs": ["<report path or file:line reference>"], "risks": ["<risk>"], "next_action": "<next action if this option is selected>" }',
    'Argue for the option named in the branch title. Set option_id to the branch option id named in the step id and title. Do not compare every option; make the strongest evidence-backed case for this branch. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse and validates the full report body against explore.tournament-proposal@v1 before writing the branch report.',
  ].join(' '),
};

export const exploreTournamentReviewShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'explore.tournament-review@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<recommend|no-clear-winner|needs-operator>", "recommended_option_id": "<option-1-through-option-4>", "comparison": "<comparative assessment>", "objections": ["<objection>"], "missing_evidence": ["<missing evidence>"], "tradeoff_question": "<specific choice the operator must make>", "confidence": "<low|medium|high>" }',
    'Use the proposal aggregate and source reports. Treat this as the stress review inside the Decision stage, not as a separate canonical Review stage. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences.',
    'The runtime parses your response with JSON.parse and validates the full report body against explore.tournament-review@v1 before writing reports/tournament-review.json.',
  ].join(' '),
};
