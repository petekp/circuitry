// Compose writer registry types.
//
// A compose writer turns a schematic's compose step into a
// schema-validated report. It generalizes the close-writer pattern:
// every flow's brief, plan, intake, analysis, etc., gets its own
// builder file under src/flows/<wf>/writers/ and is registered
// by output schema name on the flow package. The runner relays
// via the catalog-derived registry — it does not need to know which
// schemas exist.
//
// To add a new flow's compose step, an author writes:
//   1. The schema for the output report in src/flows/<wf>/reports.ts
//   2. A ComposeBuilder in src/flows/<wf>/writers/<schema>.ts
//   3. Register it on the package's `writers.compose`
//
// Close-with-evidence has its own registry under
// src/flows/registries/close-writers/. The two registries are intentionally
// kept separate because close steps have additional contract concerns
// (evidence_links, optional reads for mode-conditional inputs)
// that don't apply to upstream compose steps.

import type { CompiledFlow } from '../../../schemas/compiled-flow.js';
import type { RuntimeEvidencePolicy } from '../../../shared/relay-runtime-types.js';

export type ComposeStep = CompiledFlow['steps'][number] & {
  readonly kind: 'compose';
  readonly writes: { readonly report: { readonly schema: string; readonly path: string } };
};

// Declarative description of a typed-report read. The runner uses
// this to pre-resolve paths and read JSON before invoking build().
// Builders that need non-standard resolution (e.g., review.result
// reads a relay result body, not a typed report) can omit
// `reads` and resolve paths themselves inside build().
export interface ComposeReadDescriptor {
  readonly name: string;
  readonly schema: string;
  readonly required: boolean;
}

export interface ComposeBuildContext {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly step: ComposeStep;
  readonly goal: string;
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
  // Pre-resolved inputs from declared reads (or empty if no reads
  // declared). Builders narrow each via their own Zod schema.
  readonly inputs: Record<string, unknown | undefined>;
}

export interface ComposeBuilder {
  // Schema name of the report this builder produces (e.g.
  // 'build.plan@v1', 'explore.brief@v1'). Acts as the registry key.
  readonly resultSchemaName: string;
  // Optional declarative reads. When omitted, the builder resolves
  // paths itself in build().
  readonly reads?: readonly ComposeReadDescriptor[];
  // Per-flow logic. Returns the unvalidated report body — the
  // builder is responsible for validating against the registered
  // result schema before returning.
  build(context: ComposeBuildContext): unknown;
}
