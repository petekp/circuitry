import type { CloseBuildContext, CloseBuilder } from '../../registries/close-writers/types.js';
import { reportPathForSchemaInRuntimeFlow } from '../../registries/runtime-index.js';
import {
  PursuitBatch,
  PursuitContract,
  PursuitGraph,
  PursuitReview,
  PursuitVerification,
  PursuitWavePlan,
} from '../reports.js';
import { projectPursuitResult } from './result-projection.js';

const POINTERS = [
  { report_id: 'pursuit.contract', schema: 'pursuit.contract@v1' },
  { report_id: 'pursuit.graph', schema: 'pursuit.graph@v1' },
  { report_id: 'pursuit.wave-plan', schema: 'pursuit.wave-plan@v1' },
  { report_id: 'pursuit.batch', schema: 'pursuit.batch@v1' },
  { report_id: 'pursuit.verification', schema: 'pursuit.verification@v1' },
  { report_id: 'pursuit.review', schema: 'pursuit.review@v1' },
] as const;

export const pursuitCloseBuilder: CloseBuilder = {
  resultSchemaName: 'pursuit.result@v1',
  reads: [
    { name: 'contract', schema: 'pursuit.contract@v1', required: true },
    { name: 'graph', schema: 'pursuit.graph@v1', required: true },
    { name: 'wavePlan', schema: 'pursuit.wave-plan@v1', required: true },
    { name: 'batch', schema: 'pursuit.batch@v1', required: true },
    { name: 'verification', schema: 'pursuit.verification@v1', required: true },
    { name: 'review', schema: 'pursuit.review@v1', required: true },
  ],
  build(context: CloseBuildContext): unknown {
    const contract = PursuitContract.parse(context.inputs.contract);
    PursuitGraph.parse(context.inputs.graph);
    PursuitWavePlan.parse(context.inputs.wavePlan);
    const batch = PursuitBatch.parse(context.inputs.batch);
    const verification = PursuitVerification.parse(context.inputs.verification);
    const review = PursuitReview.parse(context.inputs.review);
    return projectPursuitResult({
      contract,
      batch,
      verification,
      review,
      evidenceLinks: POINTERS.map((pointer) => ({
        ...pointer,
        path: reportPathForSchemaInRuntimeFlow(context.flow, pointer.schema),
      })),
    });
  },
};
