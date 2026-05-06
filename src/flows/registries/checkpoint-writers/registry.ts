// Registry of checkpoint brief builders, keyed by output schema name.
//
// Builders come from src/flows/catalog.ts via buildCheckpointRegistry.
// Most checkpoints don't write reports and skip this registry entirely;
// the runner only invokes a builder when step.writes.report is defined.

import { buildCheckpointRegistry } from '../../catalog-derivations.js';
import { flowPackages } from '../../catalog.js';
import type { CheckpointBriefBuilder } from './types.js';

const REGISTRY = buildCheckpointRegistry(flowPackages);

export function findCheckpointBriefBuilder(
  resultSchemaName: string,
): CheckpointBriefBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}
