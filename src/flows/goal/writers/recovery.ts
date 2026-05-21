import { existsSync, readFileSync } from 'node:fs';

import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import type { ComposeBuilder } from '../../registries/compose-writers/types.js';
import { GoalAttempt, GoalEvidenceEvaluation, GoalGate, type GoalRecovery } from '../reports.js';

function routeFromEvaluation(
  evaluation: GoalEvidenceEvaluation,
): Pick<GoalRecovery, 'reason' | 'selected_route' | 'rationale'> {
  if (evaluation.verdict === 'missing-evidence') {
    return {
      reason: 'missing-evidence',
      selected_route:
        evaluation.next_route === 'completion-gate' ? 'checkpoint' : evaluation.next_route,
      rationale: 'Required evidence is missing, so Goal cannot close complete.',
    };
  }
  if (evaluation.verdict === 'contradicted') {
    return {
      reason: 'verification-failed',
      selected_route: 'run-fix',
      rationale: 'Evidence contradicted a done claim and needs a fixing pass.',
    };
  }
  return {
    reason: 'child-blocked',
    selected_route: 'checkpoint',
    rationale: 'The child result blocked or could not prove the contract without judgment.',
  };
}

function routeFromGate(
  gate: GoalGate,
): Pick<GoalRecovery, 'reason' | 'selected_route' | 'rationale'> | undefined {
  const firstFinding = gate.blocking_findings[0];
  if (firstFinding === undefined) return undefined;
  return {
    reason: 'review-blocked',
    selected_route: firstFinding.recovery_route,
    rationale: firstFinding.text,
  };
}

function readLatestGate(runFolder: string): GoalGate | undefined {
  for (const path of ['reports/goal/gate.json', 'reports/goal/gate-pass-1.json']) {
    const absolutePath = resolveRunRelative(runFolder, path);
    if (!existsSync(absolutePath)) continue;
    return GoalGate.parse(JSON.parse(readFileSync(absolutePath, 'utf8')));
  }
  return undefined;
}

export const goalRecoveryBuilder: ComposeBuilder = {
  resultSchemaName: 'goal.recovery@v1',
  reads: [
    { name: 'evaluation', schema: 'goal.evidence-evaluation@v1', required: true },
    { name: 'attempt', schema: 'goal.attempt@v1', required: false },
  ],
  build(context): GoalRecovery {
    const evaluation = GoalEvidenceEvaluation.parse(context.inputs.evaluation);
    const attempt =
      context.inputs.attempt === undefined ? undefined : GoalAttempt.parse(context.inputs.attempt);
    const gate = readLatestGate(context.runFolder);
    const decision =
      gate === undefined
        ? routeFromEvaluation(evaluation)
        : (routeFromGate(gate) ?? routeFromEvaluation(evaluation));
    return {
      schema: 'goal.recovery@v1',
      reason: decision.reason,
      selected_route: decision.selected_route,
      rationale: decision.rationale,
      attempt_count: attempt === undefined ? 0 : 1,
      operator_input_required: decision.selected_route !== 'retry-selected-flow',
    };
  },
};
