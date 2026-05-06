// Explore brief compose writer.
//
// Fabricates a default ExploreBrief from the run goal alone. A real
// explore run would expect operator-supplied subject/task at frame
// time; the inline-compose fallback here keeps schematic execution
// honest when no operator input is available.

import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { ExploreBrief } from '../reports.js';

export const exploreBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'explore.brief@v1',
  build(context: ComposeBuildContext): unknown {
    return ExploreBrief.parse({
      subject: context.goal,
      task: context.goal,
      success_condition: `Produce a useful explore result for: ${context.goal}`,
    });
  },
};
