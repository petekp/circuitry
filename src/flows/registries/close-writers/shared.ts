// Shared helpers for close-with-evidence builders.
//
// `reportPathForSchemaInCompiledFlow` mirrors runner.ts's internal lookup
// so close builders can populate `evidence_links` paths without
// depending on the runner's private API surface. The lookup resolves
// the unique flow step that writes a given schema and returns its
// path — it's intentionally strict (exactly one writer required) so
// schematic shape errors surface here instead of producing ambiguous
// pointers in the result report.

import type { CompiledFlow } from '../../../schemas/compiled-flow.js';

// Sub-run / fanout step kinds widened the Step union — fanout's writes
// holds {branches_dir, aggregate} with no `report` slot. The `'report'
// in writes` guard narrows to step variants that carry an report slot
// before reading `.schema`, keeping this helper sound across all kinds.
export function reportPathForSchemaInCompiledFlow(flow: CompiledFlow, schemaName: string): string {
  const matches = flow.steps.filter(
    (candidate) => 'report' in candidate.writes && candidate.writes.report?.schema === schemaName,
  );
  if (matches.length !== 1) {
    throw new Error(
      `report schema '${schemaName}' must be written by exactly one flow step, found ${matches.length}`,
    );
  }
  const match = matches[0];
  if (match === undefined) {
    throw new Error(`report schema '${schemaName}' matched no flow step`);
  }
  const report = 'report' in match.writes ? match.writes.report : undefined;
  if (report === undefined) {
    throw new Error(`report schema '${schemaName}' matched a step without an report writer`);
  }
  return report.path as unknown as string;
}

export function flowHasReportSchemaInCompiledFlow(flow: CompiledFlow, schemaName: string): boolean {
  return flow.steps.some(
    (candidate) => 'report' in candidate.writes && candidate.writes.report?.schema === schemaName,
  );
}
