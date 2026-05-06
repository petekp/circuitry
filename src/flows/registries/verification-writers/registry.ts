// Registry of verification writers, keyed by output schema name.
//
// Builders come from src/flows/catalog.ts via buildVerificationRegistry.

import { buildVerificationRegistry } from '../../catalog-derivations.js';
import { flowPackages } from '../../catalog.js';
import type { VerificationBuilder } from './types.js';

const REGISTRY = buildVerificationRegistry(flowPackages);

export function findVerificationWriter(resultSchemaName: string): VerificationBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}
