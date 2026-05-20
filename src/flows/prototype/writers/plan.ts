import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { PrototypeBrief, PrototypePlan } from '../reports.js';

export const prototypePlanComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'prototype.plan@v1',
  reads: [{ name: 'brief', schema: 'prototype.brief@v1', required: true }],
  build(context: ComposeBuildContext): unknown {
    const brief = PrototypeBrief.parse(context.inputs.brief);
    const indexPath = `${brief.prototype_root}/index.html`;
    const readmePath = `${brief.prototype_root}/README.md`;
    return PrototypePlan.parse({
      objective: brief.objective,
      prototype_root: brief.prototype_root,
      files_to_create: [indexPath, readmePath],
      entry_points: [indexPath],
      interaction_path: indexPath,
      preview_instructions: `Open ${indexPath} in a browser or inspect the file directly.`,
      verification: {
        commands: brief.verification_command_candidates,
      },
      build_followup_prompt: [
        `Build from the Prototype artifact in ${brief.prototype_root}.`,
        `Preserve the useful interaction from ${indexPath}, but implement it as production code only after reviewing the Prototype result and limitations.`,
      ].join(' '),
      risks: [
        'Prototype polish can be mistaken for production readiness',
        'The artifact may validate the interaction idea without covering integration cost',
      ],
      claim_limits: brief.claim_limits,
    });
  },
};
