import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { RuntimeProofCompose } from '../reports.js';

export const runtimeProofComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'plan.strategy@v1',
  build(context: ComposeBuildContext): unknown {
    return RuntimeProofCompose.parse({
      summary: `Runtime proof composed for: ${context.goal}`,
    });
  },
};
