import { defineFlowFromFacts } from '../flow-definition.js';
import type { CompiledFlowSignal } from '../types.js';
import { reviewFacts } from './facts.js';
import { reviewRelayShapeHint } from './relay-hints.js';
import { ReviewIntake, ReviewResult } from './reports.js';
import { reviewIntakeComposeBuilder } from './writers/intake.js';
import { reviewResultComposeBuilder } from './writers/result.js';

const REVIEW_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'code review', pattern: /\bcode\s+review\b/i },
  {
    label: 'change review request',
    pattern:
      /\breview\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:[\w-]+\s+){0,8}(?:changes?|diff|patch|commit|pr|pull\s+request|code|report|file)\b/i,
  },
  { label: 'audit request', pattern: /\baudit\b/i },
  { label: 'critique request', pattern: /\bcritique\b/i },
  {
    label: 'change inspection request',
    pattern:
      /\binspect\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:change|diff|patch|commit|pr|pull\s+request|code|report|file)\b/i,
  },
  {
    label: 'change-check request',
    pattern: /\bcheck\s+(?:this\s+)?(?:change|diff|patch|commit|pr|pull\s+request)\b/i,
  },
  {
    label: 'issue-finding request',
    pattern:
      /\b(?:find|surface|identify|spot|detect|look\s+for)\s+(?:an?\s+|any\s+)?(?:(?:issue|issues)(?!\s*(?:#|\d))|bug|bugs|defect|defects|problem|problems|regression|regressions|risk|risks)\b/i,
  },
  {
    label: 'risk-hunt request',
    pattern: /\blook\s+for\s+(?:bugs|issues|regressions|risks)\b/i,
  },
];

export const reviewFlowDefinition = defineFlowFromFacts({
  facts: reviewFacts,
  routing: {
    order: 0,
    signals: REVIEW_SIGNALS,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to audit-only review flow`;
    },
  },
  reportSchemas: [
    { schemaName: 'review.intake@v1', schema: ReviewIntake },
    { schemaName: 'review.result@v1', schema: ReviewResult },
  ],
  writers: {
    compose: [reviewIntakeComposeBuilder, reviewResultComposeBuilder],
  },
  structuralHints: [reviewRelayShapeHint],
});
