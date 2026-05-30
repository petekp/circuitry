// Shared building blocks for flow result-report schemas.
//
// Every flow's reports.ts declares a "result report pointer" — an
// { report_id, path, schema } object whose `schema` field must equal the
// canonical schema id registered for that `report_id`. The object shape
// and the schema-match refinement were byte-identical across build,
// explore, fix, prototype, and pursue, differing only in the per-flow
// report-id enum and the report-id → schema-id lookup. Two flows
// (fix, pursue) additionally pin `path` to a per-report-id value.
//
// This module owns the one factory so a shape change or a refinement
// message change happens once instead of five times.

import { z } from 'zod';

/**
 * Build a flow result-report pointer schema.
 *
 * @param reportId          The flow's report-id enum.
 * @param schemaByReportId  Canonical schema id for each report id; the
 *                          pointer's `schema` must equal the mapped value.
 * @param pathByReportId    Optional canonical path for each report id; when
 *                          provided, the pointer's `path` must equal the
 *                          mapped value (used by fix and pursue).
 *
 * The returned schema is `.strict()` and carries a `superRefine` that
 * emits the same messages every flow used:
 *   schema must be '<expected>' for report_id '<id>'
 *   path must be '<expected>' for report_id '<id>'  (only when pathByReportId given)
 */
export function resultReportPointer<ReportId extends string>(
  reportId: z.ZodType<ReportId>,
  schemaByReportId: Readonly<Record<ReportId, string>>,
  pathByReportId?: Readonly<Record<ReportId, string>>,
) {
  return z
    .object({
      report_id: reportId,
      path: z.string().min(1),
      schema: z.string().min(1),
    })
    .strict()
    .superRefine((pointer, ctx) => {
      const id = pointer.report_id as ReportId;
      const expectedSchema = schemaByReportId[id];
      if (pointer.schema !== expectedSchema) {
        ctx.addIssue({
          code: 'custom',
          path: ['schema'],
          message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`,
        });
      }
      if (pathByReportId !== undefined) {
        const expectedPath = pathByReportId[id];
        if (pointer.path !== expectedPath) {
          ctx.addIssue({
            code: 'custom',
            path: ['path'],
            message: `path must be '${expectedPath}' for report_id '${pointer.report_id}'`,
          });
        }
      }
    });
}
