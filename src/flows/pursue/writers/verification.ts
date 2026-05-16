import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../registries/verification-writers/types.js';
import { PursuitContract, PursuitVerification } from '../reports.js';

export const pursuitVerificationWriter: VerificationBuilder = {
  resultSchemaName: 'pursuit.verification@v1',
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[] {
    const contractPath = reportPathForSchemaInCompiledFlow(context.flow, 'pursuit.contract@v1');
    if (!context.step.reads.includes(contractPath as never)) {
      throw new Error(
        `pursuit.verification@v1 requires step '${context.step.id}' to read ${contractPath}`,
      );
    }
    const contract = PursuitContract.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runFolder, contractPath), 'utf8')),
    );
    return contract.verification_command_candidates;
  },
  buildResult(observations: readonly VerificationCommandObservation[]): unknown {
    const overallStatus = observations.some((o) => o.status === 'failed') ? 'failed' : 'passed';
    return PursuitVerification.parse({
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
