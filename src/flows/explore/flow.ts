import { defineFlowFromFacts } from '../flow-definition.js';
import { exploreFacts } from './facts.js';
import {
  exploreComposeShapeHint,
  exploreReviewVerdictShapeHint,
  exploreTournamentProposalShapeHint,
  exploreTournamentReviewShapeHint,
} from './relay-hints.js';
import {
  ExploreAnalysis,
  ExploreBrief,
  ExploreCompose,
  ExploreDecision,
  ExploreDecisionOptions,
  ExploreResult,
  ExploreReviewVerdict,
  ExploreTournamentAggregate,
  ExploreTournamentProposal,
  ExploreTournamentReview,
} from './reports.js';
import { exploreAnalysisComposeBuilder } from './writers/analysis.js';
import { exploreBriefComposeBuilder } from './writers/brief.js';
import { exploreCloseBuilder } from './writers/close.js';
import { exploreDecisionOptionsComposeBuilder } from './writers/decision-options.js';
import { exploreDecisionComposeBuilder } from './writers/decision.js';

export const exploreFlowDefinition = defineFlowFromFacts({
  facts: exploreFacts,
  routing: {
    order: Number.MAX_SAFE_INTEGER,
    signals: [],
    reasonForMatch() {
      throw new Error('explore is the default flow; reasonForMatch should not be called');
    },
    isDefault: true,
    defaultReason: 'no routed flow signal matched; routed to explore as the conservative default',
  },
  relayReports: [
    {
      schemaName: 'explore.compose@v1',
      schema: ExploreCompose,
      relayHint: exploreComposeShapeHint.instruction,
    },
    {
      schemaName: 'explore.review-verdict@v1',
      schema: ExploreReviewVerdict,
      relayHint: exploreReviewVerdictShapeHint.instruction,
    },
    {
      schemaName: 'explore.tournament-proposal@v1',
      schema: ExploreTournamentProposal,
      relayHint: exploreTournamentProposalShapeHint.instruction,
    },
    {
      schemaName: 'explore.tournament-review@v1',
      schema: ExploreTournamentReview,
      relayHint: exploreTournamentReviewShapeHint.instruction,
    },
  ],
  reportSchemas: [
    { schemaName: 'explore.brief@v1', schema: ExploreBrief },
    { schemaName: 'explore.analysis@v1', schema: ExploreAnalysis },
    { schemaName: 'explore.decision-options@v1', schema: ExploreDecisionOptions },
    { schemaName: 'explore.tournament-aggregate@v1', schema: ExploreTournamentAggregate },
    { schemaName: 'explore.decision@v1', schema: ExploreDecision },
    { schemaName: 'explore.result@v1', schema: ExploreResult },
  ],
  writers: {
    compose: [
      exploreBriefComposeBuilder,
      exploreAnalysisComposeBuilder,
      exploreDecisionOptionsComposeBuilder,
      exploreDecisionComposeBuilder,
    ],
    close: [exploreCloseBuilder],
  },
});
