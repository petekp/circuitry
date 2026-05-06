// Explore analysis compose writer.
//
// Reads the explore brief and emits a minimal initial-framing analysis.
// The analysis is the input to the synthesize-step's worker relay;
// real runs would have a worker fill out aspects/evidence in detail.

import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { ExploreAnalysis, ExploreBrief } from '../reports.js';

export const exploreAnalysisComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'explore.analysis@v1',
  reads: [{ name: 'brief', schema: 'explore.brief@v1', required: true }],
  build(context: ComposeBuildContext): unknown {
    const brief = ExploreBrief.parse(context.inputs.brief);
    // The brief read uses the schema-name resolver, so this lookup
    // matches whatever path the flow's explore-brief step writes.
    const briefPath = context.step.reads.find((path) => path.endsWith('brief.json'));
    if (briefPath === undefined) {
      throw new Error(
        `explore.analysis@v1 requires step '${context.step.id}' to read the brief report`,
      );
    }
    return ExploreAnalysis.parse({
      subject: brief.subject,
      aspects: [
        {
          name: 'task-framing',
          summary: `Initial analysis for: ${brief.task}`,
          evidence: [
            {
              source: briefPath as unknown as string,
              summary: brief.success_condition,
            },
          ],
        },
      ],
    });
  },
};
