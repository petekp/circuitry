// Guidance selection derivation.
//
// Most flows resolve relay model and effort from config and step metadata only.
// The serialized engine flag still uses its historical name; this module treats
// it as guidance selection input.
import { findCompiledFlowPackageById } from '../flows/catalog.js';
import type {
  RuntimeIndexedFlow,
  RuntimeIndexedRelayStep,
} from '../flows/registries/runtime-index.js';
import {
  Config,
  LayeredConfig,
  type LayeredConfig as LayeredConfigValue,
} from '../schemas/config.js';
import type { Depth } from '../schemas/depth.js';
import type { CompiledFlowId } from '../schemas/ids.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import { resolveSelectionForGuidanceInput } from './selection-resolver.js';

type GuidanceSelectionConfig = {
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
};

function bindsExecutionDepthToGuidanceSelection(flow: RuntimeIndexedFlow): boolean {
  const pkg = findCompiledFlowPackageById(flow.id as unknown as string);
  return pkg?.engineFlags?.bindsExecutionDepthToRelaySelection === true;
}

function guidanceSelectionConfigLayersWithExecutionDepth(
  inv: GuidanceSelectionConfig,
  flow: RuntimeIndexedFlow,
  depth: Depth,
): readonly LayeredConfigValue[] {
  const layers = [...(inv.selectionConfigLayers ?? [])];
  const flowId = flow.id as CompiledFlowId;
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

function selectionConfigLayersForGuidanceInput(
  inv: GuidanceSelectionConfig,
  flow: RuntimeIndexedFlow,
  depth: Depth,
): readonly LayeredConfigValue[] {
  if (!bindsExecutionDepthToGuidanceSelection(flow)) {
    return inv.selectionConfigLayers ?? [];
  }
  return guidanceSelectionConfigLayersWithExecutionDepth(inv, flow, depth);
}

export function deriveResolvedSelection(
  inv: GuidanceSelectionConfig,
  flow: RuntimeIndexedFlow,
  step: RuntimeIndexedRelayStep,
  depth: Depth,
): ResolvedSelection {
  return resolveSelectionForGuidanceInput({
    flow,
    step,
    configLayers: selectionConfigLayersForGuidanceInput(inv, flow, depth),
  }).resolved;
}
