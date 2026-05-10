// Fix regression-rerun writer.
//
// Runtime-owned post-fix proof. Re-runs the brief's `regression_test.command`
// (the same command that fix-regression-baseline ran BEFORE fix-act) AFTER
// fix-verify and records what happened. The job is to detect the false-done
// pattern where:
//
//   - the brief declares a real regression command
//   - the baseline observes it failing as expected (proved)
//   - the brief's `verification_command_candidates` are unrelated/no-op and
//     pass after the fix
//   - the actual regression command would still fail
//
// Without this rerun, the chain would treat the unrelated noop verification
// as proof that the fix worked. With it, fix-close requires the same exact
// command that proved the bug to also clear post-fix; otherwise outcome
// 'fixed' is denied.
//
// If the brief deferred the regression test (no command available), this
// writer emits status='deferred', which mirrors the baseline. fix-close
// already gates on regression_status='proved' so the deferred case is
// already routed to outcome='partial'; the rerun's deferred status is
// recorded for transparency.

import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../registries/verification-writers/types.js';
import { FixBrief, FixRegressionRerun } from '../reports.js';

export const fixRegressionRerunWriter: VerificationBuilder = {
  resultSchemaName: 'fix.regression-rerun@v1',
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[] {
    const briefPath = reportPathForSchemaInCompiledFlow(context.flow, 'fix.brief@v1');
    if (!context.step.reads.includes(briefPath as never)) {
      throw new Error(
        `fix.regression-rerun@v1 requires step '${context.step.id}' to read ${briefPath}`,
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
      return FixRegressionRerun.parse({
        status: 'deferred',
        overall_status: 'passed',
        reason: 'Brief deferred the regression test; no runtime rerun was performed.',
      });
    }
    const observation = observations[0];
    if (observation === undefined) {
      throw new Error('fix.regression-rerun@v1: regression rerun observation missing');
    }
    const rerun = {
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
    if (observation.status === 'passed') {
      return FixRegressionRerun.parse({
        status: 'cleared',
        overall_status: 'passed',
        rerun,
      });
    }
    return FixRegressionRerun.parse({
      status: 'still-failing',
      overall_status: 'failed',
      reason:
        'Brief declared the regression test fails before the fix and the baseline confirmed that, but the same command still fails after the fix. The fix did not clear the regression.',
      rerun,
    });
  },
};
