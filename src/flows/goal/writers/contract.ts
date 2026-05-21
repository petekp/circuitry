import type { ComposeBuilder } from '../../registries/compose-writers/types.js';
import { GoalClarifiedTask } from '../reports.js';
import type { GoalContract, GoalFlowTarget } from '../reports.js';

const ALL_TARGETS: readonly GoalFlowTarget[] = ['fix', 'build', 'review', 'explore', 'pursue'];

const REVIEW_INTENT = /\b(review|audit|inspect|assess|findings?)\b/i;
const EXPLORE_INTENT = /\b(explore|compare|decide|decision|tradeoff|options?)\b/i;
const PURSUE_INTENT = /\b(pursue|coordinate|multiple|batch|broad|cleanup)\b/i;
const FIX_INTENT = /\b(fix|bug|failing|failure|regression|crash|broken|flaky)\b/i;
const BUILD_INTENT =
  /\b(build|implement|add|change|update|ship|create|refactor|wire|integrate|test)\b/i;

function hasCodeChangingIntent(goal: string): boolean {
  return FIX_INTENT.test(goal) || BUILD_INTENT.test(goal) || PURSUE_INTENT.test(goal);
}

function selectFlowTarget(goal: string): GoalFlowTarget {
  const codeChanging = hasCodeChangingIntent(goal);
  if (PURSUE_INTENT.test(goal)) return 'pursue';
  if (FIX_INTENT.test(goal)) return 'fix';
  if (BUILD_INTENT.test(goal)) return 'build';
  if (REVIEW_INTENT.test(goal) && !codeChanging) return 'review';
  if (EXPLORE_INTENT.test(goal) && !codeChanging) return 'explore';
  if (REVIEW_INTENT.test(goal)) return 'review';
  if (EXPLORE_INTENT.test(goal)) return 'explore';
  return 'build';
}

function proofKindForTarget(target: GoalFlowTarget): 'command' | 'report' | 'review' {
  if (target === 'review' || target === 'explore') return 'review';
  if (target === 'pursue') return 'report';
  return 'command';
}

function nonEmptyUnique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function normalizeTaskText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export const goalContractBuilder: ComposeBuilder = {
  resultSchemaName: 'goal.contract@v1',
  reads: [{ name: 'clarified', schema: 'goal.clarified-task@v1', required: true }],
  build(context): GoalContract {
    const clarified = GoalClarifiedTask.parse(context.inputs.clarified);
    if (normalizeTaskText(clarified.original_request) !== normalizeTaskText(context.goal)) {
      throw new Error('Goal Clarify original_request must preserve the operator request');
    }
    const objective = clarified.objective.trim();
    const selected = selectFlowTarget(
      [
        context.goal,
        clarified.original_request,
        clarified.objective,
        clarified.clarified_prompt,
      ].join('\n'),
    );
    const proofKind = proofKindForTarget(selected);
    const requiredEvidence = clarified.proof_needed.map((proof) => ({
      kind: proof.kind,
      description: proof.description,
      required: proof.required,
    }));
    return {
      schema: 'goal.contract@v1',
      objective,
      source_of_truth: 'circuit-run-folder',
      scope: {
        in: nonEmptyUnique([
          ...clarified.scope.in_bounds,
          'The operator objective and the evidence needed to prove it.',
        ]),
        out: nonEmptyUnique([
          ...clarified.scope.out_of_bounds,
          'Project-level goal ledgers',
          'Cross-run recall',
          'Native host /goal as an authority layer',
          'Arbitrary dynamic child-flow loading',
        ]),
        assumptions: nonEmptyUnique([
          ...clarified.assumptions,
          'The current run folder is the authoritative Goal V1 state.',
        ]),
      },
      constraints: nonEmptyUnique([
        ...clarified.constraints,
        'Use only statically authored child flow targets.',
        'Do not close complete without satisfied evidence and the required gate streak.',
        'Escalate through recovery or checkpoint instead of guessing when proof is ambiguous.',
      ]),
      done_when: [
        {
          id: 'objective-proved',
          claim: clarified.desired_outcome,
          required_evidence:
            requiredEvidence.length === 0
              ? [
                  {
                    kind: proofKind,
                    description: `The selected ${selected} child flow produces report-backed evidence for the objective.`,
                    required: true,
                  },
                ]
              : requiredEvidence,
        },
      ],
      allowed_flow_targets: [...ALL_TARGETS],
      selected_flow_target: selected,
      recovery_policy: {
        max_attempts: 2,
        routes: [
          'retry-selected-flow',
          'run-fix',
          'run-review',
          'checkpoint',
          'handoff',
          'blocked',
        ],
      },
      check_in_triggers: nonEmptyUnique([
        ...clarified.missing_information.map((item) => `${item.question} ${item.why_it_matters}`),
        'Scope expands beyond the contract.',
        'Required evidence is missing, contradicted, or ambiguous.',
        'A medium-or-above gate finding needs operator judgment.',
      ]),
      stop_conditions: nonEmptyUnique([
        ...clarified.stop_conditions,
        'The attempt limit is reached without required evidence.',
        'The child flow blocks on information or permissions Circuit cannot infer.',
      ]),
      completion_gate: {
        required_passes: 2,
        blocking_severities: ['critical', 'high', 'medium'],
        reset_on_blocking_finding: true,
      },
    };
  },
};
