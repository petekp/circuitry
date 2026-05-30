import { compileFlowDefinition } from '../flow-definition.js';
import { buildFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(buildFlowDefinition);

export { compiledFlowPackage as buildCompiledFlowPackage };
// Public surface: the flow's operator-summary HTML projector. The catalog
// registers it into the shared registry; tests exercise it in isolation here.
export { buildCheckpointProjector } from './writers/checkpoint-html.js';
