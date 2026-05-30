import type { CloseBuilder } from '../../registries/close-writers/types.js';
import { reportPathForSchemaInRuntimeFlow } from '../../registries/runtime-index.js';
import {
  GoalAttempt,
  GoalContract,
  GoalEvidenceEvaluation,
  GoalGate,
  GoalRecovery,
  type GoalResult,
  type GoalResultEvidenceLink,
} from '../reports.js';

const RESULT_POINTERS = [
  { report_id: 'goal.contract', schema: 'goal.contract@v1', optional: false },
  { report_id: 'goal.attempt', schema: 'goal.attempt@v1', optional: false },
  {
    report_id: 'goal.evidence-evaluation',
    schema: 'goal.evidence-evaluation@v1',
    optional: false,
  },
  { report_id: 'goal.recovery', schema: 'goal.recovery@v1', optional: true },
  { report_id: 'goal.gate', schema: 'goal.gate@v1', optional: true },
] as const;

export const goalCloseBuilder: CloseBuilder = {
  resultSchemaName: 'goal.result@v1',
  reads: [
    { name: 'contract', schema: 'goal.contract@v1', required: true },
    { name: 'attempt', schema: 'goal.attempt@v1', required: true },
    { name: 'evaluation', schema: 'goal.evidence-evaluation@v1', required: true },
    { name: 'recovery', schema: 'goal.recovery@v1', required: false },
    { name: 'gate', schema: 'goal.gate@v1', required: false },
  ],
  build(context): GoalResult {
    const contract = GoalContract.parse(context.inputs.contract);
    const attempt = GoalAttempt.parse(context.inputs.attempt);
    const evaluation = GoalEvidenceEvaluation.parse(context.inputs.evaluation);
    const recovery =
      context.inputs.recovery === undefined
        ? undefined
        : GoalRecovery.parse(context.inputs.recovery);
    const gate =
      context.inputs.gate === undefined ? undefined : GoalGate.parse(context.inputs.gate);

    const provenClaims = evaluation.claim_results
      .filter((claim) => claim.status === 'proved')
      .map((claim) => claim.claim_id);
    const weakClaims = evaluation.claim_results
      .filter((claim) => claim.status !== 'proved')
      .map((claim) => `${claim.claim_id}: ${claim.gap ?? claim.status}`);
    const gateClean = gate?.verdict === 'gate-pass' && gate.clean_streak >= 2;
    const lowGateFindings = gate?.low_findings.map((finding) => finding.text) ?? [];
    const outcome: GoalResult['outcome'] =
      evaluation.verdict === 'satisfied' && gateClean
        ? 'complete'
        : recovery?.selected_route === 'handoff'
          ? 'handoff'
          : recovery?.selected_route === 'blocked'
            ? 'blocked'
            : attempt.outcome === 'failed'
              ? 'failed'
              : 'needs_attention';
    const links = RESULT_POINTERS.flatMap((pointer): GoalResultEvidenceLink[] => {
      if (pointer.optional && context.inputs[pointer.report_id.split('.')[1] ?? ''] === undefined) {
        return [];
      }
      return [
        {
          report_id: pointer.report_id,
          schema: pointer.schema,
          path: reportPathForSchemaInRuntimeFlow(context.flow, pointer.schema),
        },
      ];
    });
    return {
      schema: 'goal.result@v1',
      outcome,
      summary:
        outcome === 'complete'
          ? `Goal complete: ${contract.objective}`
          : `Goal ${outcome}: ${recovery?.rationale ?? 'required evidence or safety-review proof is incomplete.'}`,
      proven_claims: provenClaims,
      missing_or_weak_claims: weakClaims,
      recovery_history: recovery === undefined ? [] : [recovery.rationale],
      residual_risks: [...lowGateFindings],
      rerun_commands: [`./bin/circuit run goal --goal ${JSON.stringify(contract.objective)}`],
      evidence_links: links,
      gate: {
        clean_streak: gate?.clean_streak ?? 0,
        required_passes: 2,
        final_verdict: gate?.verdict ?? 'blocked',
      },
    };
  },
};
