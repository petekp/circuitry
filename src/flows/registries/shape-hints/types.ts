// Shape-hint registry types.
//
// A shape hint tells a worker what JSON shape its relay response
// must produce so the runner can parse + validate the result against
// the step's typed report schema. Without a hint, workers receive
// only a generic "respond with a verdict" instruction and produce
// acknowledgment-style responses that fail schema validation at the
// step check.
//
// Two hint kinds live in the registry:
//   - 'schema'     — keyed by `step.writes.report.schema`. The
//                    common case: each per-flow relay step
//                    that writes a typed report contributes one.
//   - 'structural' — keyed by a step-shape predicate (role + check).
//                    For relay steps that emit a structured result
//                    body but do not register a typed report under
//                    `writes.report` (e.g. the standalone review
//                    flow's audit step).
//
// To add a new flow's relay shape hint, an author writes:
//   1. The schema for the report body in src/flows/<wf>/reports.ts
//   2. A ShapeHint export in src/flows/<wf>/relay-hints.ts
//   3. Register it on the package's `relayReports[].relayHint`

import type { CompiledFlow } from '../../../schemas/compiled-flow.js';

export type RelayStep = CompiledFlow['steps'][number] & { readonly kind: 'relay' };

export interface SchemaShapeHint {
  readonly kind: 'schema';
  readonly schema: string;
  readonly instruction: string;
}

export interface StructuralShapeHint {
  readonly kind: 'structural';
  readonly id: string;
  match(step: RelayStep): boolean;
  readonly instruction: string;
}

export type ShapeHint = SchemaShapeHint | StructuralShapeHint;
