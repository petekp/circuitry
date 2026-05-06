// Cross-report validators run after `parseReport` succeeds for a
// given schema. They enforce constraints that span more than one
// report and therefore cannot be expressed in the single-report Zod
// schema — e.g., `sweep.batch.items[].candidate_id` must be a subset of
// the upstream `sweep.queue.to_execute`.
//
// Why a separate registry rather than a Zod superRefine: superRefine
// only sees the report under validation, not other reports on disk.
// The validator gets `flow` (to resolve canonical report paths)
// and `runFolder` (to read previously-written reports).
//
// No-rule = pass: an unregistered schema returns `ok` because the
// catalog has no cross-report constraints declared for it. Registered
// validators are themselves expected to fail-closed when their required
// upstream report is missing or malformed — silent omission would
// re-open the gap each validator exists to close.
//
// Co-located on the relay report: each `CompiledFlowRelayReport`
// optionally carries its own `crossReportValidate`. This makes the
// invariant "validators only fire on relay-produced reports"
// structural — there is no other place to attach one. The runtime
// composes them into a single keyed registry through the catalog.

import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import { buildCrossReportValidatorRegistry } from '../catalog-derivations.js';
import { flowPackages } from '../catalog.js';

export type CrossReportResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'fail'; readonly reason: string };

export type CrossReportValidator = (
  flow: CompiledFlow,
  runFolder: string,
  resultBody: string,
) => CrossReportResult;

const REGISTRY = buildCrossReportValidatorRegistry(flowPackages);

export function runCrossReportValidator(
  schemaName: string,
  flow: CompiledFlow,
  runFolder: string,
  resultBody: string,
): CrossReportResult {
  const validator = REGISTRY.get(schemaName);
  if (validator === undefined) return { kind: 'ok' };
  return validator(flow, runFolder, resultBody);
}
