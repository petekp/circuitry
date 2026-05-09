// Fix brief compose writer.
//
// Fabricates a default FixBrief from the run goal alone. A real Fix
// run would expect an interactive frame step (host checkpoint) to
// enrich the regression contract; the inline-compose fallback here
// keeps schematic execution honest when no operator input is available,
// defaulting to deferred repro and a verification command derived from
// the project's package.json scripts.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { FixBrief } from '../reports.js';

// Priority order for verification-style scripts. `verify` is the
// canonical name; `test` and `check` are the next-most-common signals
// of "did this break the project". `lint` is intentionally omitted
// because lint failures usually warn rather than fail the build.
const PREFERRED_VERIFY_SCRIPTS = ['verify', 'test', 'check'] as const;
const DEFAULT_VERIFY_SCRIPT = 'verify';

function pickVerificationScript(projectRoot: string | undefined): string {
  if (projectRoot === undefined) return DEFAULT_VERIFY_SCRIPT;
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return DEFAULT_VERIFY_SCRIPT;
  let pkg: { scripts?: Record<string, unknown> };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, unknown> };
  } catch {
    return DEFAULT_VERIFY_SCRIPT;
  }
  const scripts = pkg.scripts ?? {};
  for (const name of PREFERRED_VERIFY_SCRIPTS) {
    if (typeof scripts[name] === 'string') return name;
  }
  return DEFAULT_VERIFY_SCRIPT;
}

export const fixBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'fix.brief@v1',
  build(context: ComposeBuildContext): unknown {
    const goal = context.goal;
    const scriptName = pickVerificationScript(context.projectRoot);
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
      verification_command_candidates: [
        {
          id: 'fix-proof',
          cwd: '.',
          argv: ['npm', 'run', scriptName],
          timeout_ms: 600_000,
          max_output_bytes: 200_000,
          env: {},
        },
      ],
    });
  },
};
