import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RelayStartedTraceEntry } from '../../../schemas/trace-entry.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { PrototypeVariantOptions, PrototypeVariantProviderEvidence } from '../reports.js';

function readTraceEntries(runFolder: string): unknown[] {
  const tracePath = join(runFolder, 'trace.ndjson');
  if (!existsSync(tracePath)) return [];
  return readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

function isRelayStarted(value: unknown): value is RelayStartedTraceEntry {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { readonly kind?: unknown }).kind === 'relay.started'
  );
}

function branchRelayStepId(variantId: string): string {
  return `variant-fanout-step-${variantId}`;
}

export const prototypeVariantProviderEvidenceComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'prototype.variant-provider-evidence@v1',
  reads: [{ name: 'options', schema: 'prototype.variant-options@v1', required: true }],
  build(context: ComposeBuildContext): unknown {
    const options = PrototypeVariantOptions.parse(context.inputs.options);
    const relayStartedByStep = new Map<string, RelayStartedTraceEntry>();
    for (const entry of readTraceEntries(context.runFolder)) {
      if (!isRelayStarted(entry)) continue;
      relayStartedByStep.set(entry.step_id as unknown as string, entry);
    }
    const variants = options.variants.map((variant) => {
      const relayStepId = branchRelayStepId(variant.variant_id);
      const started = relayStartedByStep.get(relayStepId);
      const model = started?.resolved_selection.model;
      const effort = started?.resolved_selection.effort;
      if (started === undefined || model === undefined || effort === undefined) {
        return {
          variant_id: variant.variant_id,
          label: variant.label,
          relay_step_id: relayStepId,
          status: 'missing' as const,
        };
      }
      return {
        variant_id: variant.variant_id,
        label: variant.label,
        relay_step_id: relayStepId,
        status: 'captured' as const,
        connector_name: started.connector.name,
        provider: model.provider,
        model: model.model,
        effort,
        trace_sequence: started.sequence,
        trace_entry_kind: 'relay.started',
        resolved_from: started.resolved_from,
      };
    });
    const missingEvidence = variants.flatMap((variant) =>
      variant.status === 'missing'
        ? [
            {
              variant_id: variant.variant_id,
              relay_step_id: variant.relay_step_id,
              reason:
                'Missing relay.started trace entry with resolved_selection.model and effort for this variant.',
            },
          ]
        : [],
    );
    return PrototypeVariantProviderEvidence.parse({
      schema_version: 1,
      evidence_source: 'relay.started resolved_selection trace entries',
      required_captured_count: 2,
      captured_count: variants.filter((variant) => variant.status === 'captured').length,
      variants,
      missing_evidence: missingEvidence,
    });
  },
};
