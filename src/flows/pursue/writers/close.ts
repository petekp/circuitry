import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type { CloseBuildContext, CloseBuilder } from '../../registries/close-writers/types.js';
import {
  PursuitBatch,
  PursuitContract,
  PursuitGraph,
  PursuitResult,
  PursuitReview,
  PursuitVerification,
  PursuitWavePlan,
} from '../reports.js';

const POINTERS = [
  { report_id: 'pursuit.contract', schema: 'pursuit.contract@v1' },
  { report_id: 'pursuit.graph', schema: 'pursuit.graph@v1' },
  { report_id: 'pursuit.wave-plan', schema: 'pursuit.wave-plan@v1' },
  { report_id: 'pursuit.batch', schema: 'pursuit.batch@v1' },
  { report_id: 'pursuit.verification', schema: 'pursuit.verification@v1' },
  { report_id: 'pursuit.review', schema: 'pursuit.review@v1' },
] as const;

function assertBatchCoversContract(contract: PursuitContract, batch: PursuitBatch): void {
  const expected = new Set(contract.pursuits.map((pursuit) => pursuit.id));
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const item of [...batch.completed, ...batch.skipped, ...batch.blocked, ...batch.failed]) {
    if (!expected.has(item.pursuit_id)) {
      issues.push(`unknown pursuit id '${item.pursuit_id}'`);
      continue;
    }
    if (seen.has(item.pursuit_id)) {
      issues.push(`duplicate pursuit id '${item.pursuit_id}'`);
      continue;
    }
    seen.add(item.pursuit_id);
  }
  for (const id of expected) {
    if (!seen.has(id)) issues.push(`missing pursuit id '${id}'`);
  }
  if (issues.length > 0) {
    throw new Error(`pursuit.batch@v1 does not cover pursuit.contract@v1: ${issues.join('; ')}`);
  }
}

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
    assertBatchCoversContract(contract, batch);

    const completedCount = batch.completed.length;
    const skippedCount = batch.skipped.length;
    const blockedCount = batch.blocked.length;
    const failedCount = batch.failed.length;
    const verificationOk = verification.overall_status === 'passed';

    const outcome =
      failedCount > 0 || !verificationOk || review.verdict === 'blocked'
        ? 'failed'
        : blockedCount > 0 || batch.verdict === 'blocked'
          ? 'blocked'
          : skippedCount > 0 || review.verdict === 'needs-followup' || batch.verdict === 'partial'
            ? 'needs_attention'
            : 'complete';

    return PursuitResult.parse({
      summary: `Pursuits result for ${contract.objective}: ${batch.summary}`,
      outcome,
      verification_status: verification.overall_status,
      review_verdict: review.verdict,
      total_pursuits: contract.pursuits.length,
      completed_count: completedCount,
      skipped_count: skippedCount,
      blocked_count: blockedCount,
      failed_count: failedCount,
      serial_code_writes: true,
      evidence_links: POINTERS.map((pointer) => ({
        ...pointer,
        path: reportPathForSchemaInCompiledFlow(context.flow, pointer.schema),
      })),
    });
  },
};
