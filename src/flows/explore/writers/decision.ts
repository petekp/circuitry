// Explore tournament decision writer.
//
// The checkpoint runtime records the operator selection as a response
// file. This writer reads that file directly and composes the
// final decision report from the tournament aggregate plus stress review.

import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import {
  ExploreDecision,
  ExploreDecisionOptionId,
  ExploreDecisionOptions,
  ExploreTournamentAggregate,
  ExploreTournamentReview,
} from '../reports.js';

const CHECKPOINT_RESPONSE_STEP_ID = 'tradeoff-checkpoint-step';

function readJson(runFolder: string, path: string): unknown {
  return JSON.parse(readFileSync(resolveRunRelative(runFolder, path), 'utf8'));
}

function requiredRead(stepReads: readonly string[], suffix: string): string {
  const path = stepReads.find((entry) => entry.endsWith(suffix));
  if (path === undefined) {
    throw new Error(`explore.decision@v1 requires a read ending in ${suffix}`);
  }
  return path;
}

function checkpointResponsePath(context: ComposeBuildContext): string {
  const checkpoint = context.flow.steps.find(
    (step) => step.kind === 'checkpoint' && step.id === CHECKPOINT_RESPONSE_STEP_ID,
  );
  if (checkpoint?.kind !== 'checkpoint') {
    throw new Error('explore.decision@v1 requires the tradeoff checkpoint step');
  }
  return checkpoint.writes.response;
}

function followUpWorkflowFor(nextAction: string): string {
  const match = /\b(Build|Fix|Explore|Review)\b/i.exec(nextAction);
  if (match?.[1] === undefined) return 'Explore';
  const lower = match[1].toLowerCase();
  return lower[0]?.toUpperCase() + lower.slice(1);
}

export const exploreDecisionComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'explore.decision@v1',
  build(context: ComposeBuildContext): unknown {
    const optionsPath = requiredRead(context.step.reads, 'decision-options.json');
    const aggregatePath = requiredRead(context.step.reads, 'tournament-aggregate.json');
    const reviewPath = requiredRead(context.step.reads, 'tournament-review.json');
    const responsePath = checkpointResponsePath(context);

    const options = ExploreDecisionOptions.parse(readJson(context.runFolder, optionsPath));
    const aggregate = ExploreTournamentAggregate.parse(readJson(context.runFolder, aggregatePath));
    const review = ExploreTournamentReview.parse(readJson(context.runFolder, reviewPath));
    const response = readJson(context.runFolder, responsePath);
    const rawSelection =
      response !== null && typeof response === 'object' && !Array.isArray(response)
        ? (response as Record<string, unknown>).selection
        : undefined;
    const selectedOptionId = ExploreDecisionOptionId.parse(rawSelection);
    const selectedOption = options.options.find((option) => option.id === selectedOptionId);
    if (selectedOption === undefined) {
      throw new Error(
        `explore.decision@v1 selected option '${selectedOptionId}' is not present in decision options`,
      );
    }
    const selectedBranch = aggregate.branches.find(
      (branch) => branch.branch_id === selectedOption.id,
    );
    const selectedProposal = selectedBranch?.result_body;
    if (selectedProposal === undefined) {
      throw new Error(
        `explore.decision@v1 selected option '${selectedOption.id}' has no completed proposal branch`,
      );
    }
    const rejectedOptions = options.options
      .filter((option) => option.id !== selectedOption.id)
      .map((option) => ({
        option_id: option.id,
        reason: `Not selected by the tradeoff checkpoint; review verdict was ${review.verdict}.`,
      }));

    return ExploreDecision.parse({
      verdict: 'decided',
      decision_question: options.decision_question,
      selected_option_id: selectedOption.id,
      selected_option_label: selectedOption.label,
      decision: selectedProposal.case_summary,
      rationale: review.comparison,
      rejected_options: rejectedOptions,
      evidence_links: [optionsPath, aggregatePath, reviewPath, responsePath],
      assumptions: selectedProposal.assumptions,
      residual_risks: [...selectedProposal.risks, ...review.objections, ...review.missing_evidence],
      next_action: selectedProposal.next_action,
      follow_up_workflow: followUpWorkflowFor(selectedProposal.next_action),
    });
  },
};
