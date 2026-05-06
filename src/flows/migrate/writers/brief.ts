// Migrate brief compose writer.
//
// Fabricates a default MigrateBrief from the run goal alone. A real
// Migrate run would expect operator-supplied source/target/coexistence
// inputs at frame time; the inline-compose fallback here keeps schematic
// execution honest when no operator input is available, defaulting to
// a short-window coexistence appetite and an `npm run check`
// verification candidate.

import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { MigrateBrief } from '../reports.js';

const DEFAULT_MIGRATE_VERIFICATION_COMMAND = {
  id: 'migrate-proof',
  cwd: '.',
  argv: ['npm', 'run', 'check'],
  timeout_ms: 120_000,
  max_output_bytes: 200_000,
  env: {},
} as const;

export const migrateBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'migrate.brief@v1',
  build(context: ComposeBuildContext): unknown {
    const goal = context.goal;
    return MigrateBrief.parse({
      objective: goal,
      source: `Existing implementation referenced by: ${goal}`,
      target: `Replacement implementation requested by: ${goal}`,
      scope: goal,
      success_criteria: [`Demonstrate the migration addresses: ${goal}`],
      coexistence_appetite: 'short-window',
      rollback_plan:
        'Revert the batch sub-run commit; the pre-migration source still works because coexistence kept it in place.',
      verification_command_candidates: [DEFAULT_MIGRATE_VERIFICATION_COMMAND],
    });
  },
};
