// Fix brief compose writer.
//
// Fabricates a default FixBrief from the run goal alone. A real Fix
// run would expect an interactive frame step (host checkpoint) to
// enrich the regression contract; the inline-compose fallback here
// keeps schematic execution honest when no operator input is available,
// defaulting to deferred repro and an `npm run verify` candidate.

import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { FixBrief } from '../reports.js';

const DEFAULT_FIX_VERIFICATION_COMMAND = {
  id: 'fix-proof',
  cwd: '.',
  argv: ['npm', 'run', 'verify'],
  timeout_ms: 600_000,
  max_output_bytes: 200_000,
  env: {},
} as const;

export const fixBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'fix.brief@v1',
  build(context: ComposeBuildContext): unknown {
    const goal = context.goal;
    return FixBrief.parse({
      problem_statement: goal,
      expected_behavior: `Resolve: ${goal}`,
      observed_behavior: `Currently: ${goal}`,
      scope: goal,
      regression_contract: {
        expected_behavior: `After fix: ${goal}`,
        actual_behavior: `Before fix: ${goal}`,
        repro: {
          kind: 'not-reproducible',
          deferred_reason:
            'Default Fix brief — operator-supplied repro evidence not available at frame time',
        },
        regression_test: {
          status: 'deferred',
          deferred_reason:
            'Default Fix brief — regression-test authoring deferred until repro evidence is supplied',
        },
      },
      success_criteria: [`Demonstrate the fix addresses: ${goal}`],
      verification_command_candidates: [DEFAULT_FIX_VERIFICATION_COMMAND],
    });
  },
};
