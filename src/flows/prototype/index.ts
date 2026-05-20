import { compileFlowDefinition } from '../flow-definition.js';
import { prototypeFlowDefinition } from './flow.js';

const compiledFlowPackage = compileFlowDefinition(prototypeFlowDefinition);

export { compiledFlowPackage as prototypeCompiledFlowPackage };
