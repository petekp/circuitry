// Build plan compose writer.
//
// Reads the build brief and lifts its verification command candidates
// into a deliberate, check-able plan. The plan is the report that
// build's verification step consumes (via build.plan@v1 → commands).

import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { BuildBrief, BuildPlan } from '../reports.js';

export const buildPlanComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'build.plan@v1',
  reads: [{ name: 'brief', schema: 'build.brief@v1', required: true }],
  build(context: ComposeBuildContext): unknown {
    const brief = BuildBrief.parse(context.inputs.brief);
    return BuildPlan.parse({
      objective: brief.objective,
      approach: `Make the smallest safe change inside scope: ${brief.scope}`,
      slices: brief.success_criteria.map((criterion) => `Satisfy: ${criterion}`),
      verification: {
        commands: brief.verification_command_candidates,
      },
    });
  },
};
