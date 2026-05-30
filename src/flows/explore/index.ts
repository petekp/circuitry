import { compileFlowDefinition } from '../flow-definition.js';
import { exploreFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(exploreFlowDefinition);

export { compiledFlowPackage as exploreCompiledFlowPackage };
// Public surface: the flow's operator-summary HTML projector. The catalog
// registers it into the shared registry; tests exercise it in isolation here.
export { exploreTournamentProjector } from './writers/tournament-html.js';
