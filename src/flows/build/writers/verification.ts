// Build verification writer.
//
// Sources commands from build.plan@v1 (the plan step lifts brief
// candidates into a deliberate, check-able command list). Emits the
// canonical BuildVerification report — narrower than Fix's: result
// rows do not echo timeout_ms/max_output_bytes/env (those live on the
// plan, not the result).

import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../registries/verification-writers/types.js';
import { BuildPlan, BuildVerification } from '../reports.js';

export const buildVerificationWriter: VerificationBuilder = {
  resultSchemaName: 'build.verification@v1',
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[] {
    const planPath = reportPathForSchemaInCompiledFlow(context.flow, 'build.plan@v1');
    if (!context.step.reads.includes(planPath as never)) {
      throw new Error(
        `build.verification@v1 requires step '${context.step.id}' to read ${planPath}`,
      );
    }
    const plan = BuildPlan.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runFolder, planPath), 'utf8')),
    );
    return plan.verification.commands;
  },
  buildResult(observations: readonly VerificationCommandObservation[]): unknown {
    const overallStatus = observations.some((o) => o.status === 'failed') ? 'failed' : 'passed';
    return BuildVerification.parse({
      overall_status: overallStatus,
      commands: observations.map((o) => ({
        command_id: o.command.id,
        argv: o.command.argv,
        cwd: o.command.cwd,
        exit_code: o.exit_code,
        status: o.status,
        duration_ms: o.duration_ms,
        stdout_summary: o.stdout_summary,
        stderr_summary: o.stderr_summary,
      })),
    });
  },
};
