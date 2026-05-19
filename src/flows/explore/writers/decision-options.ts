// Explore tournament option writer.
//
// This is deliberately bounded. Tournament mode needs stable option ids
// so the checkpoint can route a real operator choice to the final
// decision writer, while still preserving options the user named.

import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { ExploreAnalysis, ExploreBrief } from '../reports.js';
import { projectExploreDecisionOptions } from './decision-options-projection.js';

export const exploreDecisionOptionsComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'explore.decision-options@v1',
  reads: [
    { name: 'brief', schema: 'explore.brief@v1', required: true },
    { name: 'analysis', schema: 'explore.analysis@v1', required: true },
  ],
  build(context: ComposeBuildContext): unknown {
    const brief = ExploreBrief.parse(context.inputs.brief);
    const analysis = ExploreAnalysis.parse(context.inputs.analysis);
    return projectExploreDecisionOptions({
      brief,
      analysis,
      fallbackEvidenceRef: context.step.reads[0] ?? 'reports/analysis.json',
      ...(context.axes === undefined ? {} : { optionCount: context.axes.tournament_n }),
    });
  },
};
