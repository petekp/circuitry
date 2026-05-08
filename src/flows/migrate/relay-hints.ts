// Migrate flow relay shape hints.

import type { SchemaShapeHint } from '../registries/shape-hints/types.js';

export const migrateReviewShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'migrate.review@v1',
  instruction: [
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "<release-approved|release-with-followups|release-blocked|reject>", "summary": "<release-review summary>", "findings": [{ "severity": "<critical|high|medium|low>", "text": "<finding text>", "file_refs": ["<file:line reference>"] }] }',
    'Audit the migration as a release decision: do the staged batches together satisfy the migration brief, did verification pass, and is anything left that would block ratification? Flag findings that name specific files, batches, or behaviors — do not file generic "looks good" notes.',
    'Use an empty findings array only with verdict "release-approved". Verdicts "release-with-followups", "release-blocked", and "reject" must include at least one finding. Use an empty file_refs array when a finding has no file-specific reference. Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against migrate.review@v1 before writing reports/migrate/review.json.',
  ].join(' '),
};

export const migrateInventoryShapeHint: SchemaShapeHint = {
  kind: 'schema',
  schema: 'migrate.inventory@v1',
  instruction: [
    "Walk the project to enumerate every concrete location that needs to change for this migration. Use Glob, Grep, and Read to find real files and code patterns matching the brief's source / target / scope. Every items[].path must be a project-relative path that exists on disk; do not fabricate items. This step is read-only by intent: do NOT call Edit, Write, or any Bash command that modifies files.",
    'Respond with a single raw JSON object whose top-level shape is exactly:',
    '{ "verdict": "accept", "summary": "<what was inventoried>", "items": [{ "id": "<stable item id>", "path": "<project-relative path>", "category": "<e.g. import-site, config-file, test-only>", "description": "<one-line description of why this item is in scope>" }], "batches": [{ "id": "<stable batch id>", "title": "<short batch name>", "item_ids": ["<id from items above>"], "rationale": "<why these items group together>" }] }',
    'Each items[].id must be unique. Each batches[].item_ids[] must reference an items[].id (no orphans). The items array must contain at least one entry; if the walk finds nothing, investigate further before responding rather than emitting an empty inventory. The batches array must contain at least one entry covering at least one item.',
    'Do not include extra top-level keys. Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object.',
    'The runtime parses your response with JSON.parse, rejects any verdict not drawn from the accepted-verdicts list, and validates the full report body against migrate.inventory@v1 before writing reports/migrate/inventory.json.',
  ].join(' '),
};
