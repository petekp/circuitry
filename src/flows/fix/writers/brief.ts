// Fix brief compose writer.
//
// Fabricates a default FixBrief from the run goal alone. A real Fix
// run would expect an interactive frame step (host checkpoint) to
// enrich the regression contract; the inline-compose fallback here keeps
// schematic execution honest when no operator input is available, defaulting
// to deferred repro and a verification command resolved from real package
// scripts.

import { requireResolvedVerificationCommands } from '../../../shared/verification-resolver.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { FixBrief } from '../reports.js';

export const fixBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'fix.brief@v1',
  build(context: ComposeBuildContext): unknown {
    const goal = context.goal;
    const verificationCommands = requireResolvedVerificationCommands({
      ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
      goal,
      requestedNeeds: ['general'],
      commandIdPrefix: 'fix',
      timeoutMs: 600_000,
      maxOutputBytes: 200_000,
    });
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
      verification_command_candidates: verificationCommands,
    });
  },
};
