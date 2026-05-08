// Fix flow package.

import type { CompiledFlowPackage, CompiledFlowSignal } from '../types.js';
import {
  fixChangeShapeHint,
  fixContextShapeHint,
  fixDiagnosisShapeHint,
  fixReviewShapeHint,
} from './relay-hints.js';
import {
  FixBrief,
  FixChange,
  FixContext,
  FixDiagnosis,
  FixNoReproDecision,
  FixResult,
  FixReview,
  FixVerification,
} from './reports.js';
import { fixBriefComposeBuilder } from './writers/brief.js';
import { fixCloseBuilder } from './writers/close.js';
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

export const fixCompiledFlowPackage: CompiledFlowPackage = {
  id: 'fix',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/fix/schematic.json',
    command: 'src/flows/fix/command.md',
    contract: 'src/flows/fix/contract.md',
  },
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
    { schemaName: 'fix.verification@v1', schema: FixVerification },
    { schemaName: 'fix.result@v1', schema: FixResult },
  ],
  writers: {
    compose: [fixBriefComposeBuilder],
    close: [fixCloseBuilder],
    verification: [fixVerificationWriter],
    checkpoint: [],
  },
};
