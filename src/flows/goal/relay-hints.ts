import type { SchemaShapeHint } from '../registries/shape-hints/types.js';

export const goalGateShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'goal.gate@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "schema": "goal.gate@v1", "verdict": "gate-pass|blocked", "clean_streak": 0, "required_passes": 2, "blocking_findings": [], "low_findings": [], "passes": [], "next_route": "run-next-gate-pass|recover|close" }',
    'Blocking findings are severities critical, high, or medium. Any blocking finding must set verdict to blocked, clean_streak to 0, and next_route to recover.',
    'A gate-pass verdict must have no blocking findings. Use next_route close only when clean_streak is at least 2. Use run-next-gate-pass when this pass is clean but another clean pass is still required.',
    'Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
  ].join(' '),
};

export const goalGatePassShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'goal.gate-pass@v1',
  instruction: [
    'Respond with a single raw JSON object for goal.gate-pass@v1 whose top-level shape is exactly:',
    '{ "schema": "goal.gate@v1", "verdict": "gate-pass|blocked", "clean_streak": 0, "required_passes": 2, "blocking_findings": [], "low_findings": [], "passes": [], "next_route": "run-next-gate-pass|recover|close" }',
    'The report is bound as goal.gate-pass@v1, but the JSON schema field remains goal.gate@v1 so both gate passes share the same body validator.',
    'Blocking findings are severities critical, high, or medium. Any blocking finding must set verdict to blocked, clean_streak to 0, and next_route to recover.',
    'A gate-pass verdict must have no blocking findings. Use next_route run-next-gate-pass when this pass is clean but another clean pass is still required.',
    'Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
  ].join(' '),
};
