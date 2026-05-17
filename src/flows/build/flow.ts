import { defineFlowFromFacts } from '../flow-definition.js';
import type { CompiledFlowSignal } from '../types.js';
import { buildFacts } from './facts.js';
import { buildImplementationShapeHint, buildReviewShapeHint } from './relay-hints.js';
import {
  BuildBrief,
  BuildImplementation,
  BuildPlan,
  BuildResult,
  BuildReview,
  BuildVerification,
} from './reports.js';
import { buildBriefCheckpointBuilder } from './writers/checkpoint-brief.js';
import { buildCloseBuilder } from './writers/close.js';
import { buildPlanComposeBuilder } from './writers/plan.js';
import { buildVerificationWriter } from './writers/verification.js';

const BUILD_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'develop prefix', pattern: /^\s*develop\s*:/i },
  {
    label: 'build implementation request',
    pattern:
      /^\s*(?:please\s+)?(?:build|implement|develop|add|create|ship)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+)?(?:new\s+|missing\s+)?(?:feature|change|fix|implementation|endpoint|component|command|tool|integration|helper|export|function|method|behavior)\b/i,
  },
  {
    label: 'missing implementation request',
    pattern:
      /^\s*(?:please\s+)?(?:add|implement|create|ship)\s+(?:the\s+)?missing\s+(?:[\w.-]+\s+)?(?:helper|export|function|method|component|command|endpoint|behavior)\b/i,
  },
  {
    label: 'test-passing implementation request',
    pattern:
      /^\s*(?:please\s+)?(?:add|implement|create|ship|make)\b.*\b(?:helper|export|function|method|component|command|endpoint|behavior)\b.*\b(?:test|tests|check|build|verification)\b.*\b(?:pass|passes|green)\b/i,
  },
  {
    label: 'make change request',
    pattern: /^\s*(?:please\s+)?make\s+(?:a\s+|the\s+|this\s+|that\s+)?(?:focused\s+)?change\b/i,
  },
];

export const buildFlowDefinition = defineFlowFromFacts({
  facts: buildFacts,
  routing: {
    order: 30,
    signals: BUILD_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to implementation Build flow`;
    },
  },
  relayReports: [
    {
      schemaName: 'build.implementation@v1',
      schema: BuildImplementation,
      relayHint: buildImplementationShapeHint.instruction,
    },
    {
      schemaName: 'build.review@v1',
      schema: BuildReview,
      relayHint: buildReviewShapeHint.instruction,
    },
  ],
  reportSchemas: [
    { schemaName: 'build.brief@v1', schema: BuildBrief },
    { schemaName: 'build.plan@v1', schema: BuildPlan },
    { schemaName: 'build.verification@v1', schema: BuildVerification },
    { schemaName: 'build.result@v1', schema: BuildResult },
  ],
  writers: {
    compose: [buildPlanComposeBuilder],
    close: [buildCloseBuilder],
    verification: [buildVerificationWriter],
    checkpoint: [buildBriefCheckpointBuilder],
  },
});
