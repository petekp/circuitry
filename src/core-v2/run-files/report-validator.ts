import { z } from 'zod';
import { flowPackages } from '../../flows/catalog.js';

export type ReportValidatorV2 = (schemaName: string, value: unknown) => void;

const MinimalVerdictShape = z.object({ verdict: z.string().min(1) }).passthrough();

const StrictPayloadShape = z
  .object({
    verdict: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

const FanoutAggregateFixtureBranchShape = z
  .object({
    branch_id: z.string().min(1),
    child_run_id: z.string().min(1),
    child_outcome: z.string().min(1),
    verdict: z.string().min(1),
    admitted: z.boolean(),
    result_path: z.string().min(1),
    duration_ms: z.number().nonnegative(),
  })
  .passthrough();

const FanoutAggregateFixtureShape = z
  .object({
    schema_version: z.literal(1),
    join_policy: z.enum(['pick-winner', 'disjoint-merge', 'aggregate-only']),
    branch_count: z.number().int().nonnegative(),
    winner_branch_id: z.string().min(1).optional(),
    branches: z.array(FanoutAggregateFixtureBranchShape),
  })
  .passthrough();

const TEST_FIXTURE_SCHEMAS: Readonly<Record<string, z.ZodType<unknown>>> = Object.freeze({
  'runtime-proof-canonical@v1': MinimalVerdictShape,
  'runtime-proof-strict@v1': StrictPayloadShape,
  'fanout-aggregate@v1': FanoutAggregateFixtureShape,
});

function buildReportValidationRegistryV2(): Readonly<Record<string, z.ZodType<unknown>>> {
  const out: Record<string, z.ZodType<unknown>> = { ...TEST_FIXTURE_SCHEMAS };
  for (const pkg of flowPackages) {
    for (const report of pkg.reportSchemas ?? []) {
      if (Object.hasOwn(out, report.schemaName)) {
        throw new Error(
          `duplicate v2 report schema '${report.schemaName}' registered (flow ${pkg.id})`,
        );
      }
      out[report.schemaName] = report.schema;
    }
    for (const report of pkg.relayReports) {
      if (Object.hasOwn(out, report.schemaName)) {
        throw new Error(
          `duplicate v2 relay report schema '${report.schemaName}' registered (flow ${pkg.id})`,
        );
      }
      out[report.schemaName] = report.schema;
    }
  }
  return Object.freeze(out);
}

const REGISTRY = buildReportValidationRegistryV2();

export const validateReportValueV2: ReportValidatorV2 = (schemaName, value) => {
  if (!Object.hasOwn(REGISTRY, schemaName)) {
    throw new Error(
      `report schema '${schemaName}' is not registered in the v2 report-schema registry (fail-closed default)`,
    );
  }
  const schema = REGISTRY[schemaName] as z.ZodType<unknown>;
  const result = schema.safeParse(value);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
        return `${path}: ${issue.message}`;
      })
      .join('; ');
    throw new Error(
      `report body did not validate against schema '${schemaName}' (${issueSummary})`,
    );
  }
};
