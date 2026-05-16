import type { CompiledFlowPackage, CompiledFlowSignal } from '../types.js';
import { pursuitBatchShapeHint, pursuitReviewShapeHint } from './relay-hints.js';
import {
  PursuitBatch,
  PursuitContract,
  PursuitGraph,
  PursuitResult,
  PursuitReview,
  PursuitVerification,
  PursuitWavePlan,
} from './reports.js';
import { pursuitCloseBuilder } from './writers/close.js';
import { pursuitContractComposeBuilder } from './writers/contract.js';
import { pursuitGraphComposeBuilder } from './writers/graph.js';
import { pursuitVerificationWriter } from './writers/verification.js';
import { pursuitWavePlanComposeBuilder } from './writers/wave-plan.js';

const PURSUE_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'pursue prefix', pattern: /^\s*pursue\s*:/i },
  {
    label: 'pursuit request',
    pattern:
      /^\s*(?:please\s+)?(?:pursue|coordinate|handle)\b.*\b(?:pursuit|pursuits|ideas|goals|tracks)\b/i,
  },
  {
    label: 'multiple autonomous goals',
    pattern:
      /^\s*(?:please\s+)?(?:run|execute|coordinate)\b.*\b(?:multiple|several|parallel)\b.*\b(?:goals|ideas|changes|tracks)\b/i,
  },
];

export const pursueCompiledFlowPackage: CompiledFlowPackage = {
  id: 'pursue',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/pursue/schematic.json',
  },
  routing: {
    order: 25,
    signals: PURSUE_SIGNALS,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Pursue flow`;
    },
  },
  relayReports: [
    {
      schemaName: 'pursuit.batch@v1',
      schema: PursuitBatch,
      relayHint: pursuitBatchShapeHint.instruction,
    },
    {
      schemaName: 'pursuit.review@v1',
      schema: PursuitReview,
      relayHint: pursuitReviewShapeHint.instruction,
    },
  ],
  reportSchemas: [
    { schemaName: 'pursuit.contract@v1', schema: PursuitContract },
    { schemaName: 'pursuit.graph@v1', schema: PursuitGraph },
    { schemaName: 'pursuit.wave-plan@v1', schema: PursuitWavePlan },
    { schemaName: 'pursuit.verification@v1', schema: PursuitVerification },
    { schemaName: 'pursuit.result@v1', schema: PursuitResult },
  ],
  writers: {
    compose: [
      pursuitContractComposeBuilder,
      pursuitGraphComposeBuilder,
      pursuitWavePlanComposeBuilder,
    ],
    close: [pursuitCloseBuilder],
    verification: [pursuitVerificationWriter],
    checkpoint: [],
  },
};
