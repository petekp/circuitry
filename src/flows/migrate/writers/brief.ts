// Migrate brief compose writer.
//
// Fabricates a default MigrateBrief from the run goal alone. A real
// Migrate run would expect operator-supplied source/target/coexistence
// inputs at frame time; the inline-compose fallback here keeps schematic
// execution honest when no operator input is available, defaulting to
// a short-window coexistence appetite and a general proof command resolved
// from real package scripts.

import { requireResolvedVerificationCommands } from '../../../shared/verification-resolver.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { MigrateBrief } from '../reports.js';

export const migrateBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'migrate.brief@v1',
  build(context: ComposeBuildContext): unknown {
    const goal = context.goal;
    const verificationCommands = requireResolvedVerificationCommands({
      ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
      goal,
      requestedNeeds: ['general'],
      commandIdPrefix: 'migrate',
      timeoutMs: 120_000,
      maxOutputBytes: 200_000,
    });
    return MigrateBrief.parse({
      objective: goal,
      source: `Existing implementation referenced by: ${goal}`,
      target: `Replacement implementation requested by: ${goal}`,
      scope: goal,
      success_criteria: [`Demonstrate the migration addresses: ${goal}`],
      coexistence_appetite: 'short-window',
      rollback_plan:
        'Revert the batch sub-run commit; the pre-migration source still works because coexistence kept it in place.',
      verification_command_candidates: verificationCommands,
    });
  },
};
