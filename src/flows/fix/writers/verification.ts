// Fix verification writer.
//
// Sources commands from fix.brief@v1 — Fix has no separate plan step;
// the brief itself carries the verification command candidates. Emits
// the FixVerification report, which is wider than BuildVerification:
// each command result echoes timeout_ms/max_output_bytes/env so the
// result is self-contained as repro evidence even if the brief is
// later edited.

import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../registries/verification-writers/types.js';
import { FixBrief, FixVerification } from '../reports.js';

export const fixVerificationWriter: VerificationBuilder = {
  resultSchemaName: 'fix.verification@v1',
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[] {
    const briefPath = reportPathForSchemaInCompiledFlow(context.flow, 'fix.brief@v1');
    if (!context.step.reads.includes(briefPath as never)) {
      throw new Error(
        `fix.verification@v1 requires step '${context.step.id}' to read ${briefPath}`,
      );
    }
    const brief = FixBrief.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runFolder, briefPath), 'utf8')),
    );
    return brief.verification_command_candidates;
  },
  buildResult(observations: readonly VerificationCommandObservation[]): unknown {
    const overallStatus = observations.some((o) => o.status === 'failed') ? 'failed' : 'passed';
    return FixVerification.parse({
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
        timeout_ms: o.command.timeout_ms,
        max_output_bytes: o.command.max_output_bytes,
        env: o.command.env,
      })),
    });
  },
};
