// Relay selection derivation.
//
// Most flows resolve relay model and effort from config and step metadata only.
// A flow must opt into `bindsExecutionDepthToRelaySelection` before the run
// depth is layered into relay selection.
import { findCompiledFlowPackageById } from '../flows/catalog.js';
import type { CompiledFlow } from '../schemas/compiled-flow.js';
import {
  Config,
  LayeredConfig,
  type LayeredConfig as LayeredConfigValue,
} from '../schemas/config.js';
import type { Depth } from '../schemas/depth.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import type { RelayFn } from './relay-runtime-types.js';
import { resolveSelectionForRelay } from './selection-resolver.js';

export type RelayerInvocationConfig = {
  readonly relayer?: RelayFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
};

export function bindsExecutionDepthToRelaySelection(flow: CompiledFlow): boolean {
  const pkg = findCompiledFlowPackageById(flow.id as unknown as string);
  return pkg?.engineFlags?.bindsExecutionDepthToRelaySelection === true;
}

export function selectionConfigLayersWithExecutionDepth(
  inv: RelayerInvocationConfig,
  flow: CompiledFlow,
  depth: Depth,
): readonly LayeredConfigValue[] {
  const layers = [...(inv.selectionConfigLayers ?? [])];
  const flowId = flow.id;
  const existingIndex = layers.findIndex((layer) => layer.layer === 'invocation');
  const existing = existingIndex === -1 ? undefined : layers[existingIndex];
  const baseConfig = existing?.config ?? Config.parse({ schema_version: 1 });
  const existingCircuit = baseConfig.circuits[flowId];
  const selection = {
    ...(existingCircuit?.selection ?? {}),
    depth,
  };
  const invocationLayer = LayeredConfig.parse({
    layer: 'invocation',
    ...(existing?.source_path === undefined ? {} : { source_path: existing.source_path }),
    config: {
      ...baseConfig,
      circuits: {
        ...baseConfig.circuits,
        [flowId]: {
          ...(existingCircuit ?? {}),
          selection,
        },
      },
    },
  });
  if (existingIndex === -1) {
    layers.push(invocationLayer);
  } else {
    layers[existingIndex] = invocationLayer;
  }
  return layers;
}

function selectionConfigLayersForRelay(
  inv: RelayerInvocationConfig,
  flow: CompiledFlow,
  depth: Depth,
): readonly LayeredConfigValue[] {
  if (!bindsExecutionDepthToRelaySelection(flow)) {
    return inv.selectionConfigLayers ?? [];
  }
  return selectionConfigLayersWithExecutionDepth(inv, flow, depth);
}

export function deriveResolvedSelection(
  inv: RelayerInvocationConfig,
  flow: CompiledFlow,
  step: CompiledFlow['steps'][number] & { kind: 'relay' },
  depth: Depth,
): ResolvedSelection {
  return resolveSelectionForRelay({
    flow,
    step,
    configLayers: selectionConfigLayersForRelay(inv, flow, depth),
  }).resolved;
}
