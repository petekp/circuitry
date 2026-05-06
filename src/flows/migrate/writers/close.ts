// Migrate close-with-evidence builder.
//
// Reads brief + inventory + coexistence + batch + verification + review
// and emits migrate.result@v1 with verification_status, review_verdict,
// batch_count, summary, and the canonical 6-pointer set. Outcome is
// 'complete' iff verification passed AND the cutover review verdict is
// 'cutover-approved'; 'cutover-deferred' iff the review returned
// 'cutover-with-followups' OR verification passed but the review
// reported follow-ups; 'reverted' iff the batch RunResult outcome is
// not 'complete'; otherwise 'failed'. The batch report is the child
// Build's RunResult copied verbatim by the sub-run handler — its
// `outcome` field tells us whether the underlying Build succeeded.

import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type { CloseBuildContext, CloseBuilder } from '../../registries/close-writers/types.js';
import {
  MigrateBatch,
  MigrateBrief,
  MigrateCoexistence,
  MigrateInventory,
  MigrateResult,
  MigrateReview,
  MigrateVerification,
} from '../reports.js';

const POINTERS = [
  { report_id: 'migrate.brief', schema: 'migrate.brief@v1' },
  { report_id: 'migrate.inventory', schema: 'migrate.inventory@v1' },
  { report_id: 'migrate.coexistence', schema: 'migrate.coexistence@v1' },
  { report_id: 'migrate.batch', schema: 'migrate.batch@v1' },
  { report_id: 'migrate.verification', schema: 'migrate.verification@v1' },
  { report_id: 'migrate.review', schema: 'migrate.review@v1' },
] as const;

export const migrateCloseBuilder: CloseBuilder = {
  resultSchemaName: 'migrate.result@v1',
  reads: [
    { name: 'brief', schema: 'migrate.brief@v1', required: true },
    { name: 'inventory', schema: 'migrate.inventory@v1', required: true },
    { name: 'coexistence', schema: 'migrate.coexistence@v1', required: true },
    { name: 'batch', schema: 'migrate.batch@v1', required: true },
    { name: 'verification', schema: 'migrate.verification@v1', required: true },
    { name: 'review', schema: 'migrate.review@v1', required: true },
  ],
  build(context: CloseBuildContext): unknown {
    const brief = MigrateBrief.parse(context.inputs.brief);
    const inventory = MigrateInventory.parse(context.inputs.inventory);
    MigrateCoexistence.parse(context.inputs.coexistence);
    const batch = MigrateBatch.parse(context.inputs.batch);
    const verification = MigrateVerification.parse(context.inputs.verification);
    const review = MigrateReview.parse(context.inputs.review);

    const verificationOk = verification.overall_status === 'passed';
    const childComplete = batch.outcome === 'complete';

    const outcome = !childComplete
      ? 'reverted'
      : !verificationOk || review.verdict === 'reject' || review.verdict === 'cutover-blocked'
        ? 'failed'
        : review.verdict === 'cutover-with-followups'
          ? 'cutover-deferred'
          : 'complete';

    return MigrateResult.parse({
      summary: `Migrate result for ${brief.objective}: ${review.summary}`,
      outcome,
      verification_status: verification.overall_status,
      review_verdict: review.verdict,
      batch_count: inventory.batches.length,
      evidence_links: POINTERS.map((p) => ({
        ...p,
        path: reportPathForSchemaInCompiledFlow(context.flow, p.schema),
      })),
    });
  },
};
