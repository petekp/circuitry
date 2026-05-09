// Per-flow operator-summary projection contract.
//
// A projector turns a flow's typed report into the headline + details bullets
// that appear in the operator summary. Each flow registers a projector in
// SUMMARY_PROJECTORS; the writer dispatches by flow id and overlays shared
// concerns (worker disclosure, run note, warnings, abort reason, checkpoint
// detail) on top of the projection.
//
// Projectors are pure: input goes in, projection comes out. They do not write
// files, format markdown, or touch the OperatorSummary schema.

import type { JsonObject } from './json.js';

export type SummaryProjection = {
  readonly headline: string;
  readonly details: readonly string[];
};

export type SummaryProjectorInput = {
  readonly runFolder: string;
  readonly flowId: string;
  readonly flowReport: JsonObject | undefined;
  readonly resultSummary: string;
};

export type SummaryProjector = (input: SummaryProjectorInput) => SummaryProjection;
