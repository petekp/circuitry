// CompiledFlow catalog — single source of truth for the engine.
//
// The router, registries (compose, close, verification, checkpoint,
// report-schemas, shape-hints), and emit script all derive their
// state from `flowPackages`. The engine never imports a flow
// module directly. Adding a flow means appending here.

import { buildCompiledFlowPackage } from './build/index.js';
import { exploreCompiledFlowPackage } from './explore/index.js';
import { fixCompiledFlowPackage } from './fix/index.js';
import { pursueCompiledFlowPackage } from './pursue/index.js';
import { reviewCompiledFlowPackage } from './review/index.js';
import { runtimeProofCompiledFlowPackage } from './runtime-proof/index.js';
import type { CompiledFlowPackage } from './types.js';

export const flowPackages: readonly CompiledFlowPackage[] = [
  reviewCompiledFlowPackage,
  fixCompiledFlowPackage,
  pursueCompiledFlowPackage,
  runtimeProofCompiledFlowPackage,
  buildCompiledFlowPackage,
  exploreCompiledFlowPackage,
];

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
