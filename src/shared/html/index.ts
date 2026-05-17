// Operator-summary HTML projector registry.
//
// Adding HTML for a new flow is a single entry here plus the projector
// module the entry references. The writer dispatches by flowId through
// this map; flows without an entry skip HTML emission cleanly.

import { buildCheckpointProjector } from './build-checkpoint.js';
import { exploreTournamentProjector } from './explore-tournament.js';
import type { HtmlProjector } from './projector.js';

export type { HtmlProjector, HtmlProjectorContext, JsonObject } from './projector.js';

export const HTML_PROJECTORS: Partial<Record<string, HtmlProjector>> = {
  build: buildCheckpointProjector,
  explore: exploreTournamentProjector,
};
