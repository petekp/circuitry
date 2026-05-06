// Close-writer registry types.
//
// A close writer turns a schematic's close-with-evidence step into a
// schema-validated final report. The pattern is the same across
// every flow: read upstream reports, assemble pointers, derive
// summary + outcome, validate against the flow's result schema,
// write to disk. Per-flow logic (summary template, outcome
// rules, optional-pointer detection) lives in a `CloseBuilder` next
// to that flow's schemas, not in the runner.
//
// To add a new flow's close, an author:
//   1. Defines the result schema (Zod) in src/flows/<wf>/reports.ts
//   2. Implements a CloseBuilder in src/flows/<wf>/writers/close.ts
//   3. Registers it on the package's `writers.close`
//
// The runner.ts close path stays flow-agnostic — it relays by
// schema name to the registered builder.

import type { CompiledFlow } from '../../../schemas/compiled-flow.js';

// Each builder declares which report schemas it reads. The reader
// translates these into run-relative paths via the flow's step
// declarations. Required reads must be in the close step's reads list;
// optional reads are looked up only when the flow declares a step
// that writes them and the close step lists the path.
export interface CloseReadDescriptor {
  // Stable name the builder uses to address this input (e.g. 'brief',
  // 'change', 'review'). Lets the builder pull typed inputs from a
  // record rather than relying on read-order.
  readonly name: string;
  // Report schema string (e.g. 'fix.brief@v1'). The runner translates
  // this into a path via reportPathForSchema(flow, schema).
  readonly schema: string;
  // When true, the read must be present; absence aborts the run.
  // When false, absence is silent — the builder receives `undefined`
  // for that input. Used for mode-conditional inputs (e.g. lite Fix
  // skips review).
  readonly required: boolean;
}

// Context the builder receives when it runs.
export interface CloseBuildContext {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly closeStep: CompiledFlow['steps'][number] & {
    kind: 'compose';
    writes: { report: { schema: string; path: string } };
  };
  readonly goal: string;
  // Map of declared name → parsed JSON object (or undefined for absent
  // optional inputs). The builder narrows each via its own Zod schema.
  readonly inputs: Record<string, unknown | undefined>;
}

// A CloseBuilder is everything the runner needs to know to produce
// one flow's close report. The runner registers these by
// resultSchemaName so a schematic can wire a generic close-with-evidence
// item to the right builder via the schematic item's output contract.
export interface CloseBuilder {
  // Schema name of the report this builder produces (e.g.
  // 'build.result@v1'). Acts as the registry key.
  readonly resultSchemaName: string;
  // Inputs the builder needs from upstream reports.
  readonly reads: readonly CloseReadDescriptor[];
  // Per-flow logic: turn typed inputs into the result body.
  // Returns the unvalidated report — the caller validates against
  // the registered Zod schema.
  build(context: CloseBuildContext): unknown;
}
