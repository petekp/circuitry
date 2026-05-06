// Sweep queue compose writer.
//
// Reads sweep.analysis@v1 and classifies each candidate into a triage
// action (act / prove-then-act / prove / defer) per the
// confidence × risk decision table in the sweep skill. Builds the
// to_execute list in low-risk-first order; defers high-risk + low-
// confidence items for human review.

import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { SweepAnalysis, SweepQueue } from '../reports.js';

type TriageAction = 'act' | 'prove-then-act' | 'prove' | 'defer';

const RISK_ORDER: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 1, high: 2 };

function triageAction(
  confidence: 'low' | 'medium' | 'high',
  risk: 'low' | 'medium' | 'high',
): TriageAction {
  if (confidence === 'high' && risk === 'low') return 'act';
  if (confidence === 'high' && risk !== 'low') return 'prove-then-act';
  if (confidence === 'low' && risk === 'high') return 'defer';
  return 'prove';
}

export const sweepQueueComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'sweep.queue@v1',
  reads: [{ name: 'analysis', schema: 'sweep.analysis@v1', required: true }],
  build(context: ComposeBuildContext): unknown {
    const analysis = SweepAnalysis.parse(context.inputs.analysis);

    const classified = analysis.candidates.map((candidate) => ({
      candidate_id: candidate.id,
      action: triageAction(candidate.confidence, candidate.risk),
      rationale: `${candidate.confidence}-confidence × ${candidate.risk}-risk: ${candidate.description}`,
    }));

    const deferred = classified
      .filter((item) => item.action === 'defer')
      .map((item) => item.candidate_id);

    const executable = classified.filter((item) => item.action !== 'defer');

    const candidateById = new Map(
      analysis.candidates.map((candidate) => [candidate.id, candidate]),
    );
    const to_execute = executable
      .slice()
      .sort((a, b) => {
        const candidateA = candidateById.get(a.candidate_id);
        const candidateB = candidateById.get(b.candidate_id);
        if (candidateA === undefined || candidateB === undefined) return 0;
        return RISK_ORDER[candidateA.risk] - RISK_ORDER[candidateB.risk];
      })
      .map((item) => item.candidate_id);

    return SweepQueue.parse({
      classified,
      to_execute,
      deferred,
    });
  },
};
