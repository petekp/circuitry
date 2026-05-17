import { defineFlowFromFacts } from '../flow-definition.js';
import type { CompiledFlowSignal } from '../types.js';
import { fixFacts } from './facts.js';
import {
  fixChangeShapeHint,
  fixContextShapeHint,
  fixDiagnosisShapeHint,
  fixReviewShapeHint,
} from './relay-hints.js';
import {
  FixBaselineSnapshot,
  FixBrief,
  FixChange,
  FixChangeSet,
  FixContext,
  FixDiagnosis,
  FixNoReproDecision,
  FixRegressionProof,
  FixRegressionRerun,
  FixResult,
  FixReview,
  FixVerification,
} from './reports.js';
import { fixBaselineSnapshotWriter } from './writers/baseline-snapshot.js';
import { fixBriefComposeBuilder } from './writers/brief.js';
import { fixChangeSetWriter } from './writers/change-set.js';
import { fixCloseBuilder } from './writers/close.js';
import { fixRegressionBaselineWriter } from './writers/regression-baseline.js';
import { fixRegressionRerunWriter } from './writers/regression-rerun.js';
import { fixVerificationWriter } from './writers/verification.js';

const FIX_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'fix prefix', pattern: /^\s*fix\s*:/i },
  { label: 'quick fix prefix', pattern: /^\s*(?:quick|small|tiny|simple)\s+fix\s*:/i },
  {
    label: 'fix request',
    pattern:
      /^\s*(?:please\s+)?(?:fix|patch|debug|diagnose|reproduce)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|my\s+|some\s+)?\S+/i,
  },
  {
    label: 'trailing fix request',
    pattern:
      /\b(?:bug|buggy|broken|failing|fails|failed|wrong|incorrect|instead\s+of|regression|crash|crashes|throw|throws)\b[\s\S]{0,200}\bfix\s+(?:it|this|that|please)\b/i,
  },
];

export const fixFlowDefinition = defineFlowFromFacts({
  facts: fixFacts,
  routing: {
    order: 20,
    signals: FIX_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Fix flow`;
    },
  },
  relayReports: [
    {
      schemaName: 'fix.context@v1',
      schema: FixContext,
      relayHint: fixContextShapeHint.instruction,
    },
    {
      schemaName: 'fix.diagnosis@v1',
      schema: FixDiagnosis,
      relayHint: fixDiagnosisShapeHint.instruction,
    },
    {
      schemaName: 'fix.change@v1',
      schema: FixChange,
      relayHint: fixChangeShapeHint.instruction,
    },
    {
      schemaName: 'fix.review@v1',
      schema: FixReview,
      relayHint: fixReviewShapeHint.instruction,
    },
  ],
  reportSchemas: [
    { schemaName: 'fix.brief@v1', schema: FixBrief },
    { schemaName: 'fix.no-repro-decision@v1', schema: FixNoReproDecision },
    { schemaName: 'fix.regression-proof@v1', schema: FixRegressionProof },
    { schemaName: 'fix.baseline-snapshot@v1', schema: FixBaselineSnapshot },
    { schemaName: 'fix.verification@v1', schema: FixVerification },
    { schemaName: 'fix.regression-rerun@v1', schema: FixRegressionRerun },
    { schemaName: 'fix.change-set@v1', schema: FixChangeSet },
    { schemaName: 'fix.result@v1', schema: FixResult },
  ],
  writers: {
    compose: [fixBriefComposeBuilder],
    close: [fixCloseBuilder],
    verification: [
      fixRegressionBaselineWriter,
      fixBaselineSnapshotWriter,
      fixVerificationWriter,
      fixRegressionRerunWriter,
      fixChangeSetWriter,
    ],
  },
});
