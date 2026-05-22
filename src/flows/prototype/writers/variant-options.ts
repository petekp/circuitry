import {
  assertConnectorSelectionCompatible,
  resolveConnectorForGuidanceInput,
  resolveConnectorReference,
} from '../../../runtime/connectors/resolver.js';
import type {
  CircuitVariantModels,
  LayeredConfig as LayeredConfigValue,
} from '../../../schemas/config.js';
import type { ResolvedSelection } from '../../../schemas/selection-policy.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { PrototypeBrief, PrototypePlan, PrototypeVariantOptions } from '../reports.js';

type ConfiguredVariantModels = CircuitVariantModels | undefined;
type ConfiguredVariantModel = NonNullable<ConfiguredVariantModels>[number];

function configuredVariants(layers: readonly LayeredConfigValue[] | undefined) {
  let variants: ConfiguredVariantModels;
  for (const layer of layers ?? []) {
    const circuits = layer.config.circuits as Record<
      string,
      { readonly variant_models?: CircuitVariantModels } | undefined
    >;
    const next = circuits.prototype?.variant_models;
    if (next !== undefined) variants = next;
  }
  return variants;
}

function resolvedSelectionForCompatibility(
  selection: ConfiguredVariantModel['selection'],
): ResolvedSelection {
  return {
    ...(selection.model === undefined ? {} : { model: selection.model }),
    ...(selection.effort === undefined ? {} : { effort: selection.effort }),
    skills: [],
    ...(selection.depth === undefined ? {} : { depth: selection.depth }),
    invocation_options: selection.invocation_options,
  };
}

function validateVariantModelMatrix(input: {
  readonly variants: NonNullable<ReturnType<typeof configuredVariants>>;
  readonly expectedCount: number;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
}): void {
  if (input.variants.length !== input.expectedCount) {
    throw new Error(
      `prototype.variant-options@v1 requires exactly axes.tournament_n (${input.expectedCount}) variant_models entries; found ${input.variants.length}`,
    );
  }
  for (const variant of input.variants) {
    const relay = resolveVariantRelay({
      variant,
      ...(input.selectionConfigLayers === undefined
        ? {}
        : { selectionConfigLayers: input.selectionConfigLayers }),
    });
    assertConnectorSelectionCompatible(
      relay.connectorName,
      resolvedSelectionForCompatibility(variant.selection),
    );
  }
}

function resolveVariantRelay(input: {
  readonly variant: ConfiguredVariantModel;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
}) {
  const explicitConnector =
    input.variant.connector === undefined
      ? undefined
      : resolveConnectorReference({
          ref: input.variant.connector,
          ...(input.selectionConfigLayers === undefined
            ? {}
            : { configLayers: input.selectionConfigLayers }),
        });
  return resolveConnectorForGuidanceInput({
    flowId: 'prototype',
    role: 'implementer',
    ...(explicitConnector === undefined ? {} : { explicitConnector }),
    ...(input.selectionConfigLayers === undefined
      ? {}
      : { configLayers: input.selectionConfigLayers }),
  });
}

export const prototypeVariantOptionsComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'prototype.variant-options@v1',
  reads: [
    { name: 'brief', schema: 'prototype.brief@v1', required: true },
    { name: 'plan', schema: 'prototype.plan@v1', required: true },
  ],
  build(context: ComposeBuildContext): unknown {
    const brief = PrototypeBrief.parse(context.inputs.brief);
    const plan = PrototypePlan.parse(context.inputs.plan);
    const variants = configuredVariants(context.selectionConfigLayers);
    if (variants === undefined) {
      throw new Error(
        'prototype.variant-options@v1 requires circuits.prototype.variant_models in Circuit config',
      );
    }
    const expectedCount = context.axes?.tournament_n ?? 3;
    validateVariantModelMatrix({
      variants,
      expectedCount,
      ...(context.selectionConfigLayers === undefined
        ? {}
        : { selectionConfigLayers: context.selectionConfigLayers }),
    });
    return PrototypeVariantOptions.parse({
      schema_version: 1,
      objective: brief.objective,
      prototype_root: plan.prototype_root,
      variant_count: variants.length,
      claim_limits: brief.claim_limits,
      variants: variants.map((variant) => {
        const model = variant.selection.model;
        const effort = variant.selection.effort;
        if (model === undefined || effort === undefined) {
          throw new Error(
            `prototype.variant-options@v1 variant '${variant.id}' requires selection.model and selection.effort`,
          );
        }
        const artifactRoot = `${plan.prototype_root}/variants/${variant.id}`;
        const relay = resolveVariantRelay({
          variant,
          ...(context.selectionConfigLayers === undefined
            ? {}
            : { selectionConfigLayers: context.selectionConfigLayers }),
        });
        return {
          variant_id: variant.id,
          label: variant.label,
          provider: model.provider,
          model: model.model,
          effort,
          ...(variant.connector === undefined ? {} : { connector: variant.connector }),
          connector_name: relay.connectorName,
          connector_source: relay.resolvedFrom,
          prototype_root: plan.prototype_root,
          variant_root: artifactRoot,
          entry_point_hint: `${artifactRoot}/index.html`,
          selection: {
            model,
            effort,
          },
          selection_source: 'circuits.prototype.variant_models',
          goal: [
            `Create Prototype variant '${variant.label}' (${variant.id}) for: ${brief.objective}.`,
            `Write only disposable files under ${artifactRoot}.`,
            `The shared Prototype root is ${plan.prototype_root}.`,
            'Do not claim deployment, production readiness, branch previews, screenshots, provider behavior, or model behavior.',
          ].join(' '),
        };
      }),
    });
  },
};
