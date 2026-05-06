// Registry of relay shape hints, keyed by output schema name.
//
// Hints come from src/flows/catalog.ts via buildSchemaHintMap and
// buildStructuralHintList. Schema lookup runs first; structural hints
// are tried in registration order only when the schema lookup misses.

import { buildSchemaHintMap, buildStructuralHintList } from '../../catalog-derivations.js';
import { flowPackages } from '../../catalog.js';
import type { RelayStep, SchemaShapeHint, StructuralShapeHint } from './types.js';

const SCHEMA_HINTS = buildSchemaHintMap(flowPackages);
const STRUCTURAL_HINTS = buildStructuralHintList(flowPackages);

export function findRelayShapeHint(step: RelayStep): string | undefined {
  const schema = step.writes.report?.schema;
  if (schema !== undefined) {
    const bySchema = SCHEMA_HINTS.get(schema);
    if (bySchema !== undefined) return bySchema;
  }
  for (const hint of STRUCTURAL_HINTS) {
    if (hint.match(step)) return hint.instruction;
  }
  return undefined;
}

export function listRegisteredSchemaHints(): readonly SchemaShapeHint[] {
  const out: SchemaShapeHint[] = [];
  for (const [schema, instruction] of SCHEMA_HINTS) {
    out.push({ kind: 'schema', schema, instruction });
  }
  return out;
}

export function listRegisteredStructuralHints(): readonly StructuralShapeHint[] {
  return STRUCTURAL_HINTS;
}
