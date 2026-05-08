// Explore close-with-evidence builder.
//
// Reads brief + compose + review-verdict and emits explore.result@v1
// with a brief-referencing summary, verdict snapshot, and the canonical
// 4-pointer set (brief, analysis, compose, review-verdict). Brief is
// part of `reads` per the close-with-evidence scalar contract — the
// summary references brief.subject so the result is self-contained.

import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type { CloseBuildContext, CloseBuilder } from '../../registries/close-writers/types.js';
import {
  ExploreBrief,
  ExploreCompose,
  ExploreDecision,
  ExploreDecisionOptions,
  ExploreResult,
  ExploreReviewVerdict,
  type ExploreReviewVerdict as ExploreReviewVerdictReport,
  ExploreTournamentAggregate,
  ExploreTournamentReview,
} from '../reports.js';

const POINTERS = [
  { report_id: 'explore.brief', schema: 'explore.brief@v1' },
  { report_id: 'explore.analysis', schema: 'explore.analysis@v1' },
  { report_id: 'explore.compose', schema: 'explore.compose@v1' },
  { report_id: 'explore.review-verdict', schema: 'explore.review-verdict@v1' },
] as const;

const TOURNAMENT_POINTERS = [
  { report_id: 'explore.brief', schema: 'explore.brief@v1' },
  { report_id: 'explore.analysis', schema: 'explore.analysis@v1' },
  { report_id: 'explore.decision-options', schema: 'explore.decision-options@v1' },
  { report_id: 'explore.tournament-aggregate', schema: 'explore.tournament-aggregate@v1' },
  { report_id: 'explore.tournament-review', schema: 'explore.tournament-review@v1' },
  { report_id: 'explore.decision', schema: 'explore.decision@v1' },
] as const;

function requiredTournamentAggregatePath(context: CloseBuildContext): string {
  const path = context.closeStep.reads.find((entry) => entry.endsWith('tournament-aggregate.json'));
  if (path === undefined) {
    throw new Error('explore.result@v1 tournament close requires tournament aggregate read');
  }
  return path;
}

function requiredInput(context: CloseBuildContext, name: string, schema: string): unknown {
  const input = context.inputs[name];
  if (input !== undefined) return input;
  const path = reportPathForSchemaInCompiledFlow(context.flow, schema);
  throw new Error(
    `explore.result@v1 requires close step '${context.closeStep.id}' to read ${path}`,
  );
}

function reviewHasFoldIns(review: ExploreReviewVerdictReport): boolean {
  return (
    review.verdict === 'accept-with-fold-ins' ||
    review.objections.length > 0 ||
    review.missed_angles.length > 0
  );
}

export const exploreCloseBuilder: CloseBuilder = {
  resultSchemaName: 'explore.result@v1',
  reads: [
    { name: 'brief', schema: 'explore.brief@v1', required: true },
    { name: 'compose', schema: 'explore.compose@v1', required: false },
    { name: 'review', schema: 'explore.review-verdict@v1', required: false },
    { name: 'decisionOptions', schema: 'explore.decision-options@v1', required: false },
    { name: 'tournamentReview', schema: 'explore.tournament-review@v1', required: false },
    { name: 'decision', schema: 'explore.decision@v1', required: false },
  ],
  build(context: CloseBuildContext): unknown {
    const brief = ExploreBrief.parse(context.inputs.brief);
    if (context.inputs.decision !== undefined) {
      ExploreDecisionOptions.parse(context.inputs.decisionOptions);
      const review = ExploreTournamentReview.parse(context.inputs.tournamentReview);
      const decision = ExploreDecision.parse(context.inputs.decision);
      const aggregatePath = requiredTournamentAggregatePath(context);
      ExploreTournamentAggregate.parse(
        JSON.parse(readFileSync(resolveRunRelative(context.runFolder, aggregatePath), 'utf8')),
      );
      return ExploreResult.parse({
        summary: `Explore '${brief.subject}': ${decision.decision}`,
        verdict_snapshot: {
          decision_verdict: decision.verdict,
          tournament_review_verdict: review.verdict,
          selected_option_id: decision.selected_option_id,
          objection_count: review.objections.length,
          missing_evidence_count: review.missing_evidence.length,
        },
        evidence_links: TOURNAMENT_POINTERS.map((p) => ({
          ...p,
          path:
            p.schema === 'explore.tournament-aggregate@v1'
              ? aggregatePath
              : reportPathForSchemaInCompiledFlow(context.flow, p.schema),
        })),
      });
    }

    const compose = ExploreCompose.parse(requiredInput(context, 'compose', 'explore.compose@v1'));
    const review = ExploreReviewVerdict.parse(
      requiredInput(context, 'review', 'explore.review-verdict@v1'),
    );
    return ExploreResult.parse({
      summary: `Explore '${brief.subject}': ${compose.recommendation}`,
      verdict_snapshot: {
        compose_verdict: compose.verdict,
        review_verdict: review.verdict,
        objection_count: review.objections.length,
        missed_angle_count: review.missed_angles.length,
      },
      ...(reviewHasFoldIns(review)
        ? {
            review_fold_ins: {
              overall_assessment: review.overall_assessment,
              objections: review.objections,
              missed_angles: review.missed_angles,
            },
          }
        : {}),
      evidence_links: POINTERS.map((p) => ({
        ...p,
        path: reportPathForSchemaInCompiledFlow(context.flow, p.schema),
      })),
    });
  },
};
