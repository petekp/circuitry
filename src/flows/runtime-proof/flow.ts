import { defineFlowFromFacts } from '../flow-definition.js';
import { runtimeProofFacts } from './facts.js';
import { RuntimeProofCompose } from './reports.js';
import { runtimeProofComposeBuilder } from './writers/compose.js';

export const runtimeProofFlowDefinition = defineFlowFromFacts({
  facts: runtimeProofFacts,
  reportSchemas: [{ schemaName: 'runtime-proof.compose@v1', schema: RuntimeProofCompose }],
  writers: {
    compose: [runtimeProofComposeBuilder],
  },
});
