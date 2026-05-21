import type { ComposeBuilder } from '../../registries/compose-writers/types.js';
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

export const goalContractBuilder: ComposeBuilder = {
  resultSchemaName: 'goal.contract@v1',
  build(context): GoalContract {
    const objective = context.goal.trim();
    const selected = selectFlowTarget(objective);
    const proofKind = proofKindForTarget(selected);
    return {
      schema: 'goal.contract@v1',
      objective,
      source_of_truth: 'circuit-run-folder',
      scope: {
        in: ['The operator objective and the evidence needed to prove it.'],
        out: [
          'Project-level goal ledgers',
          'Cross-run recall',
          'Native host /goal as an authority layer',
          'Arbitrary dynamic child-flow loading',
        ],
        assumptions: ['The current run folder is the authoritative Goal V1 state.'],
      },
      constraints: [
        'Use only statically authored child flow targets.',
        'Do not close complete without satisfied evidence and the required gate streak.',
        'Escalate through recovery or checkpoint instead of guessing when proof is ambiguous.',
      ],
      done_when: [
        {
          id: 'objective-proved',
          claim: objective,
          required_evidence: [
            {
              kind: proofKind,
              description: `The selected ${selected} child flow produces report-backed evidence for the objective.`,
              required: true,
            },
          ],
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
      check_in_triggers: [
        'Scope expands beyond the contract.',
        'Required evidence is missing, contradicted, or ambiguous.',
        'A medium-or-above gate finding needs operator judgment.',
      ],
      stop_conditions: [
        'The attempt limit is reached without required evidence.',
        'The child flow blocks on information or permissions Circuit cannot infer.',
      ],
      completion_gate: {
        required_passes: 2,
        blocking_severities: ['critical', 'high', 'medium'],
        reset_on_blocking_finding: true,
      },
    };
  },
};
