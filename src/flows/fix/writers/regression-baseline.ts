// Fix regression-baseline writer.
//
// Runtime-owned regression proof. Reads the brief's regression_test contract.
// If the brief declared a real `failing-before-fix` command, the runtime runs
// it before fix-act and records what actually happened. If the test failed as
// expected, the proof is 'proved' and the flow continues. If it unexpectedly
// passed, the proof is 'not-proved' and the verification executor routes to
// recovery — the diagnosis was wrong about how the bug reproduces. If the
// brief deferred the regression test entirely, no command runs and the proof
// records 'deferred' so fix-close can refuse to claim outcome 'fixed' on a
// deferred proof.

import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../registries/verification-writers/types.js';
import { FixBrief, FixRegressionProof } from '../reports.js';

export const fixRegressionBaselineWriter: VerificationBuilder = {
  resultSchemaName: 'fix.regression-proof@v1',
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[] {
    const briefPath = reportPathForSchemaInCompiledFlow(context.flow, 'fix.brief@v1');
    if (!context.step.reads.includes(briefPath as never)) {
      throw new Error(
        `fix.regression-proof@v1 requires step '${context.step.id}' to read ${briefPath}`,
      );
    }
    const brief = FixBrief.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runFolder, briefPath), 'utf8')),
    );
    if (brief.regression_contract.regression_test.status !== 'failing-before-fix') {
      return [];
    }
    return [brief.regression_contract.regression_test.command];
  },
  buildResult(observations: readonly VerificationCommandObservation[]): unknown {
    if (observations.length === 0) {
      return FixRegressionProof.parse({
        status: 'deferred',
        overall_status: 'passed',
        reason: 'Brief deferred the regression test; no runtime baseline was collected.',
      });
    }
    const observation = observations[0];
    if (observation === undefined) {
      throw new Error('fix.regression-proof@v1: regression baseline observation missing');
    }
    const baseline = {
      command_id: observation.command.id,
      cwd: observation.command.cwd,
      argv: observation.command.argv,
      timeout_ms: observation.command.timeout_ms,
      max_output_bytes: observation.command.max_output_bytes,
      env: observation.command.env,
      exit_code: observation.exit_code,
      command_status: observation.status,
      duration_ms: observation.duration_ms,
      stdout_summary: observation.stdout_summary,
      stderr_summary: observation.stderr_summary,
    };
    if (observation.status === 'failed') {
      return FixRegressionProof.parse({
        status: 'proved',
        overall_status: 'passed',
        baseline,
      });
    }
    return FixRegressionProof.parse({
      status: 'not-proved',
      overall_status: 'failed',
      reason:
        'Brief claimed the regression test fails before the fix, but the runtime observed it pass. Diagnosis is wrong about how the bug reproduces.',
      baseline,
    });
  },
};
