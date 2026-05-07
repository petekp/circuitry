// Sweep flow package.
//
// Sweep is routable through /circuit:run and also exposed through a
// direct command surface. It has no flow-owned command source because
// src/commands/sweep.md owns that host command source.

import type { CompiledFlowPackage, CompiledFlowSignal } from '../types.js';
import { validateSweepBatchAgainstQueue } from './cross-report-validators.js';
import {
  sweepAnalysisShapeHint,
  sweepBatchShapeHint,
  sweepReviewShapeHint,
} from './relay-hints.js';
import {
  SweepAnalysis,
  SweepBatch,
  SweepBrief,
  SweepQueue,
  SweepResult,
  SweepReview,
  SweepVerification,
} from './reports.js';
import { sweepBriefComposeBuilder } from './writers/brief.js';
import { sweepCloseBuilder } from './writers/close.js';
import { sweepQueueComposeBuilder } from './writers/queue.js';
import { sweepVerificationWriter } from './writers/verification.js';

const SWEEP_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'cleanup prefix', pattern: /^\s*cleanup\s*:/i },
  { label: 'overnight prefix', pattern: /^\s*overnight\s*:/i },
  {
    label: 'sweep request',
    pattern:
      /^\s*(?:please\s+)?(?:sweep|cleanup|clean\s+up)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|our\s+|my\s+)?(?:repo|repository|codebase|dead\s+code|lint|docs|documentation|coverage|quality)\b/i,
  },
];

export const sweepCompiledFlowPackage: CompiledFlowPackage = {
  id: 'sweep',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/sweep/schematic.json',
  },
  routing: {
    order: 40,
    signals: SWEEP_SIGNALS,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Sweep flow`;
    },
  },
  relayReports: [
    {
      schemaName: 'sweep.analysis@v1',
      schema: SweepAnalysis,
      relayHint: sweepAnalysisShapeHint.instruction,
    },
    {
      schemaName: 'sweep.batch@v1',
      schema: SweepBatch,
      relayHint: sweepBatchShapeHint.instruction,
      crossReportValidate: validateSweepBatchAgainstQueue,
    },
    {
      schemaName: 'sweep.review@v1',
      schema: SweepReview,
      relayHint: sweepReviewShapeHint.instruction,
    },
  ],
  reportSchemas: [
    { schemaName: 'sweep.brief@v1', schema: SweepBrief },
    { schemaName: 'sweep.queue@v1', schema: SweepQueue },
    { schemaName: 'sweep.verification@v1', schema: SweepVerification },
    { schemaName: 'sweep.result@v1', schema: SweepResult },
  ],
  writers: {
    compose: [sweepBriefComposeBuilder, sweepQueueComposeBuilder],
    close: [sweepCloseBuilder],
    verification: [sweepVerificationWriter],
    checkpoint: [],
  },
};
