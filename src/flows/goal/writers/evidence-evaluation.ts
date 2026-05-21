import { existsSync, readFileSync } from 'node:fs';

import { RunResult } from '../../../schemas/result.js';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import type { ComposeBuilder } from '../../registries/compose-writers/types.js';
import {
  GoalAttempt,
  type GoalClaimResult,
  GoalContract,
  type GoalEvidenceEvaluation,
  type GoalFlowTarget,
} from '../reports.js';

const PROOF_ELIGIBLE_VERDICTS = {
  fix: ['accept'],
  build: ['accept'],
  review: ['NO_ISSUES_FOUND', 'ISSUES_FOUND'],
  explore: ['accept'],
  pursue: ['clean'],
} as const satisfies Record<GoalFlowTarget, readonly string[]>;

function readChildRunResult(
  runFolder: string,
  path: string,
): ReturnType<typeof RunResult.parse> | undefined {
  const absPath = resolveRunRelative(runFolder, path);
  if (!existsSync(absPath)) return undefined;
  return RunResult.parse(JSON.parse(readFileSync(absPath, 'utf8')));
}

function childResultIsProofEligible(input: {
  readonly target: GoalFlowTarget;
  readonly result: ReturnType<typeof RunResult.parse>;
}): boolean {
  const allowedVerdicts: readonly string[] = PROOF_ELIGIBLE_VERDICTS[input.target];
  return (
    input.result.outcome === 'complete' && allowedVerdicts.includes(input.result.verdict ?? '')
  );
}

function proofEligibilityGap(input: {
  readonly target: GoalFlowTarget;
  readonly result: ReturnType<typeof RunResult.parse> | undefined;
  readonly attempt: GoalAttempt;
}): string {
  if (input.result === undefined) {
    return 'The selected child flow did not leave a child result path in the Goal run folder.';
  }
  const verdict = input.result.verdict ?? '<missing verdict>';
  return [
    `The selected ${input.target} child flow closed with outcome ${input.attempt.outcome}`,
    `and verdict ${verdict}, but Goal requires outcome complete with verdict`,
    PROOF_ELIGIBLE_VERDICTS[input.target].join(' or '),
    'before treating the done claim as proved.',
  ].join(' ');
}

function claimResult(input: {
  readonly claimId: string;
  readonly target: GoalFlowTarget;
  readonly attempt: GoalAttempt;
  readonly childResult: ReturnType<typeof RunResult.parse> | undefined;
}): GoalClaimResult {
  if (
    input.attempt.child_report_paths.length > 0 &&
    input.childResult !== undefined &&
    childResultIsProofEligible({ target: input.target, result: input.childResult })
  ) {
    return {
      claim_id: input.claimId,
      status: 'proved',
      evidence: input.attempt.child_report_paths,
      gap: null,
    };
  }
  return {
    claim_id: input.claimId,
    status: input.attempt.outcome === 'blocked' ? 'blocked' : 'missing',
    evidence: input.attempt.child_report_paths,
    gap: proofEligibilityGap({
      target: input.target,
      result: input.childResult,
      attempt: input.attempt,
    }),
  };
}

export const goalEvidenceEvaluationBuilder: ComposeBuilder = {
  resultSchemaName: 'goal.evidence-evaluation@v1',
  reads: [
    { name: 'contract', schema: 'goal.contract@v1', required: true },
    { name: 'attempt', schema: 'goal.attempt@v1', required: true },
  ],
  build(context): GoalEvidenceEvaluation {
    const contract = GoalContract.parse(context.inputs.contract);
    const attempt = GoalAttempt.parse(context.inputs.attempt);
    const childResult = readChildRunResult(context.runFolder, attempt.child_result_path);
    const claimResults = contract.done_when.map((claim) =>
      claimResult({
        claimId: claim.id,
        target: contract.selected_flow_target,
        attempt,
        childResult,
      }),
    );
    const allProved = claimResults.every((claim) => claim.status === 'proved');
    if (allProved) {
      return {
        schema: 'goal.evidence-evaluation@v1',
        verdict: 'satisfied',
        claim_results: claimResults,
        next_route: 'completion-gate',
      };
    }
    return {
      schema: 'goal.evidence-evaluation@v1',
      verdict: claimResults.some((claim) => claim.status === 'blocked')
        ? 'blocked'
        : 'missing-evidence',
      claim_results: claimResults,
      next_route: attempt.outcome === 'failed' ? 'run-fix' : 'checkpoint',
    };
  },
};
