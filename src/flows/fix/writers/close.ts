// Fix close-with-evidence builder.
//
// Reads brief + context + diagnosis + regression-proof + baseline-snapshot +
// change + verification + regression-rerun + change-set (all required) plus
// review (optional — lite mode skips review via route_overrides).
// regression_status, regression_rerun_status, and change_set_status are read
// from the runtime-owned proofs, never derived from model output, so a model
// claim of "I fixed it" cannot grant outcome 'fixed' on its own.
//
// Outcome rules:
//   - reproduction_status='not-reproduced' → 'not-reproduced'
//   - verification passed AND regression proved AND regression-rerun cleared
//     AND change-set pass AND review accepted cleanly → 'fixed'
//   - verification passed AND any of (regression not proved, regression-rerun
//     not cleared, change-set fail, review accept-with-fixes) → 'partial'
//   - otherwise → 'failed'

import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type { CloseBuildContext, CloseBuilder } from '../../registries/close-writers/types.js';
import {
  FixBaselineSnapshot,
  FixBrief,
  FixChange,
  FixChangeSet,
  FixContext,
  FixDiagnosis,
  FixRegressionProof,
  FixRegressionRerun,
  FixResult,
  type FixResultReportPointer,
  FixReview,
  FixVerification,
} from '../reports.js';

const REQUIRED_POINTERS = [
  { report_id: 'fix.brief', schema: 'fix.brief@v1' },
  { report_id: 'fix.context', schema: 'fix.context@v1' },
  { report_id: 'fix.diagnosis', schema: 'fix.diagnosis@v1' },
  { report_id: 'fix.regression-proof', schema: 'fix.regression-proof@v1' },
  { report_id: 'fix.baseline-snapshot', schema: 'fix.baseline-snapshot@v1' },
  { report_id: 'fix.change', schema: 'fix.change@v1' },
  { report_id: 'fix.verification', schema: 'fix.verification@v1' },
  { report_id: 'fix.regression-rerun', schema: 'fix.regression-rerun@v1' },
  { report_id: 'fix.change-set', schema: 'fix.change-set@v1' },
] as const;

const OPTIONAL_REVIEW_POINTER = {
  report_id: 'fix.review',
  schema: 'fix.review@v1',
} as const;

export const fixCloseBuilder: CloseBuilder = {
  resultSchemaName: 'fix.result@v1',
  reads: [
    { name: 'brief', schema: 'fix.brief@v1', required: true },
    { name: 'context', schema: 'fix.context@v1', required: true },
    { name: 'diagnosis', schema: 'fix.diagnosis@v1', required: true },
    { name: 'regression', schema: 'fix.regression-proof@v1', required: true },
    { name: 'baseline_snapshot', schema: 'fix.baseline-snapshot@v1', required: true },
    { name: 'change', schema: 'fix.change@v1', required: true },
    { name: 'verification', schema: 'fix.verification@v1', required: true },
    { name: 'regression_rerun', schema: 'fix.regression-rerun@v1', required: true },
    { name: 'change_set', schema: 'fix.change-set@v1', required: true },
    { name: 'review', schema: 'fix.review@v1', required: false },
  ],
  build(context: CloseBuildContext): unknown {
    const brief = FixBrief.parse(context.inputs.brief);
    FixContext.parse(context.inputs.context);
    const diagnosis = FixDiagnosis.parse(context.inputs.diagnosis);
    const regression = FixRegressionProof.parse(context.inputs.regression);
    FixBaselineSnapshot.parse(context.inputs.baseline_snapshot);
    const change = FixChange.parse(context.inputs.change);
    const verification = FixVerification.parse(context.inputs.verification);
    const regressionRerun = FixRegressionRerun.parse(context.inputs.regression_rerun);
    const changeSet = FixChangeSet.parse(context.inputs.change_set);
    const review =
      context.inputs.review === undefined ? undefined : FixReview.parse(context.inputs.review);

    const verificationStatus = verification.overall_status === 'passed' ? 'passed' : 'failed';
    const regressionStatus: FixResult['regression_status'] =
      regression.status === 'proved' ? 'proved' : 'deferred';
    const regressionRerunStatus: FixResult['regression_rerun_status'] = regressionRerun.status;
    const changeSetStatus: FixResult['change_set_status'] = changeSet.status;
    const reviewStatus = review === undefined ? 'skipped' : 'completed';

    const fixedGate =
      verificationStatus === 'passed' &&
      regressionStatus === 'proved' &&
      regressionRerunStatus === 'cleared' &&
      changeSetStatus === 'pass' &&
      (review === undefined || review.verdict === 'accept');
    const partialGate =
      verificationStatus === 'passed' &&
      (regressionStatus !== 'proved' ||
        regressionRerunStatus !== 'cleared' ||
        changeSetStatus === 'fail' ||
        review?.verdict === 'accept-with-fixes');

    const outcome: FixResult['outcome'] =
      diagnosis.reproduction_status === 'not-reproduced'
        ? 'not-reproduced'
        : fixedGate
          ? 'fixed'
          : partialGate
            ? 'partial'
            : 'failed';

    const pointers: FixResultReportPointer[] = REQUIRED_POINTERS.map((p) => ({
      report_id: p.report_id,
      schema: p.schema,
      path: reportPathForSchemaInCompiledFlow(context.flow, p.schema),
    }));
    if (review !== undefined) {
      pointers.push({
        report_id: OPTIONAL_REVIEW_POINTER.report_id,
        schema: OPTIONAL_REVIEW_POINTER.schema,
        path: reportPathForSchemaInCompiledFlow(context.flow, OPTIONAL_REVIEW_POINTER.schema),
      });
    }

    return FixResult.parse({
      summary: `Fix '${brief.problem_statement}': ${change.summary}`,
      outcome,
      verification_status: verificationStatus,
      regression_status: regressionStatus,
      regression_rerun_status: regressionRerunStatus,
      change_set_status: changeSetStatus,
      review_status: reviewStatus,
      ...(review === undefined ? {} : { review_verdict: review.verdict }),
      ...(review === undefined
        ? { review_skip_reason: 'Lite mode skipped review per route_overrides.' }
        : {}),
      residual_risks: [...diagnosis.residual_uncertainty],
      evidence_links: pointers,
    });
  },
};
