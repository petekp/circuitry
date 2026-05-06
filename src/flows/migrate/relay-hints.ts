// Migrate flow relay shape hints.

import type { SchemaShapeHint } from '../registries/shape-hints/types.js';

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
