// Operator-summary projection module.
//
// Exposes the per-flow projector registry plus the JSON/text helpers the
// writer uses to assemble its shared overlay. Keep imports from other modules
// pinned to this barrel so the file tree under operator-summary/ can reorganize
// without changing every callsite.

export type { JsonObject } from './json.js';
export {
  arrayField,
  evidenceReportById,
  isObject,
  numberField,
  readJsonIfPresent,
  stringArrayField,
  stringField,
} from './json.js';
export type { SummaryProjection, SummaryProjector, SummaryProjectorInput } from './projector.js';
export { SUMMARY_PROJECTORS, projectSummary } from './projections.js';
export { friendlyRunNote } from './text.js';
