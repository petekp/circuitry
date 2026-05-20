// Flow catalog — single source of truth for the engine.
//
// The router, registries (compose, close, verification, checkpoint,
// report-schemas, shape-hints), and emit script all derive their
// state from `flowPackages`. The engine never imports a flow
// module directly.

import { buildFlowDefinition } from './build/flow.js';
import { exploreFlowDefinition } from './explore/flow.js';
import { fixFlowDefinition } from './fix/flow.js';
import { compileFlowDefinitions } from './flow-definition.js';
import type { FlowDefinition } from './flow-definition.js';
import { prototypeFlowDefinition } from './prototype/flow.js';
import { pursueFlowDefinition } from './pursue/flow.js';
import { reviewFlowDefinition } from './review/flow.js';
import { runtimeProofFlowDefinition } from './runtime-proof/flow.js';
import type { CompiledFlowPackage } from './types.js';

export const flowDefinitions: readonly FlowDefinition[] = [
  reviewFlowDefinition,
  fixFlowDefinition,
  pursueFlowDefinition,
  runtimeProofFlowDefinition,
  prototypeFlowDefinition,
  buildFlowDefinition,
  exploreFlowDefinition,
];

export const flowPackages: readonly CompiledFlowPackage[] = compileFlowDefinitions(flowDefinitions);

const PACKAGES_BY_ID: ReadonlyMap<string, CompiledFlowPackage> = (() => {
  const map = new Map<string, CompiledFlowPackage>();
  for (const pkg of flowPackages) {
    if (map.has(pkg.id)) {
      throw new Error(`duplicate flow package id '${pkg.id}'`);
    }
    map.set(pkg.id, pkg);
  }
  return map;
})();

// Look up a flow package by id. Used by engine layers that hold
// only a CompiledFlow value and need package-level metadata (e.g. engine
// flags). Returns undefined when no package is registered for the id.
export function findCompiledFlowPackageById(id: string): CompiledFlowPackage | undefined {
  return PACKAGES_BY_ID.get(id);
}

export type { CompiledFlowPackage } from './types.js';
