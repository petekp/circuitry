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

function successCondition(goal: string): string {
  return [
    `Answer the Explore goal with evidence-backed findings: ${goal}`,
    'Name the evidence inspected or still needed, separate confirmed facts from assumptions, and identify the proof that would make the recommendation trustworthy.',
  ].join(' ');
}

export const exploreBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'explore.brief@v1',
  build(context: ComposeBuildContext): unknown {
    return ExploreBrief.parse({
      subject: context.goal,
      task: context.goal,
      success_condition: successCondition(context.goal),
    });
  },
};
