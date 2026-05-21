import { compileFlowDefinition } from '../flow-definition.js';
import { goalFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(goalFlowDefinition);

export { compiledFlowPackage as goalCompiledFlowPackage };
