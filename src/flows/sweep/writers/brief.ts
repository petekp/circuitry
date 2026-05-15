// Sweep brief compose writer.
//
// Fabricates a default SweepBrief from the run goal alone. A real Sweep
// run would expect operator-supplied scope + sweep_type at frame time;
// the inline-compose fallback here keeps schematic execution honest when
// no operator input is available, defaulting to a cleanup sweep over
// the goal's described scope and a general proof command resolved from
// real package scripts.

import { requireResolvedVerificationCommands } from '../../../shared/verification-resolver.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { SweepBrief } from '../reports.js';

export const sweepBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'sweep.brief@v1',
  build(context: ComposeBuildContext): unknown {
    const goal = context.goal;
    const verificationCommands = requireResolvedVerificationCommands({
      ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
      goal,
      requestedNeeds: ['general'],
      commandIdPrefix: 'sweep',
      timeoutMs: 120_000,
      maxOutputBytes: 200_000,
    });
    return SweepBrief.parse({
      objective: goal,
      sweep_type: 'cleanup',
      scope: goal,
      success_criteria: [`Demonstrate the sweep addresses: ${goal}`],
      scope_exclusions: [],
      out_of_scope: [],
      high_risk_boundaries: [],
      verification_command_candidates: verificationCommands,
    });
  },
};
