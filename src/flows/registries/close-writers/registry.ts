// Registry of close-with-evidence builders, keyed by result schema name.
//
// Builders come from src/flows/catalog.ts via buildCloseRegistry.

import { buildCloseRegistry } from '../../catalog-derivations.js';
import { flowPackages } from '../../catalog.js';
import {
  type RuntimeIndexedFlow,
  flowHasReportSchemaInRuntimeFlow,
  reportPathForSchemaInRuntimeFlow,
} from '../runtime-index.js';
import type { CloseBuildContext, CloseBuilder } from './types.js';

const REGISTRY = buildCloseRegistry(flowPackages);

export function findCloseBuilder(resultSchemaName: string): CloseBuilder | undefined {
  return REGISTRY.get(resultSchemaName);
}

// Resolve the read paths for a builder against a specific runtime flow index +
// close step. Required reads must be in the close step's reads list;
// optional reads are returned only when both the flow declares a
// step that writes the schema AND the close step lists the path.
// Required-but-missing throws with a clear "<schema> requires close
// step '<id>' to read <path>" message that matches the runner's
// existing requiredCloseReadForSchema phrasing.
export function resolveCloseReadPaths(
  builder: CloseBuilder,
  flow: RuntimeIndexedFlow,
  closeStep: CloseBuildContext['closeStep'],
): Record<string, string | undefined> {
  const paths: Record<string, string | undefined> = {};
  for (const descriptor of builder.reads) {
    if (descriptor.required) {
      const path = reportPathForSchemaInRuntimeFlow(flow, descriptor.schema);
      if (!closeStep.reads.includes(path as never)) {
        throw new Error(
          `${closeStep.writes.report.schema} requires close step '${closeStep.id}' to read ${path}`,
        );
      }
      paths[descriptor.name] = path;
    } else {
      if (!flowHasReportSchemaInRuntimeFlow(flow, descriptor.schema)) {
        paths[descriptor.name] = undefined;
        continue;
      }
      const path = reportPathForSchemaInRuntimeFlow(flow, descriptor.schema);
      paths[descriptor.name] = closeStep.reads.includes(path as never) ? path : undefined;
    }
  }
  return paths;
}
