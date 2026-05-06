// Sweep brief compose writer.
//
// Fabricates a default SweepBrief from the run goal alone. A real Sweep
// run would expect operator-supplied scope + sweep_type at frame time;
// the inline-compose fallback here keeps schematic execution honest when
// no operator input is available, defaulting to a cleanup sweep over
// the goal's described scope and an `npm run verify` candidate.

import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { SweepBrief } from '../reports.js';

const DEFAULT_SWEEP_VERIFICATION_COMMAND = {
  id: 'sweep-proof',
  cwd: '.',
  argv: ['npm', 'run', 'check'],
  timeout_ms: 120_000,
  max_output_bytes: 200_000,
  env: {},
} as const;

export const sweepBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'sweep.brief@v1',
  build(context: ComposeBuildContext): unknown {
    const goal = context.goal;
    return SweepBrief.parse({
      objective: goal,
      sweep_type: 'cleanup',
      scope: goal,
      success_criteria: [`Demonstrate the sweep addresses: ${goal}`],
      scope_exclusions: [],
      out_of_scope: [],
      high_risk_boundaries: [],
      verification_command_candidates: [DEFAULT_SWEEP_VERIFICATION_COMMAND],
    });
  },
};
