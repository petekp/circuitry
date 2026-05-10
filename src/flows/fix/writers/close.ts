// Fix close-with-evidence builder.
//
// Reads brief + context + diagnosis + regression-proof + change + verification
// (all required) plus review (optional — lite mode skips review via
// route_overrides). regression_status is read from the runtime-owned
// fix.regression-proof@v1 artifact, never derived from the brief, so a model
// claim of "failing-before-fix" cannot grant outcome 'fixed' on its own.
//
// Outcome rules:
//   - reproduction_status='not-reproduced' → 'not-reproduced'
//   - verification passed AND regression proved AND review accepted cleanly → 'fixed'
//   - verification passed AND regression proved AND review accepted with fixes → 'partial'
//   - verification passed AND regression not proved (deferred) → 'partial'
//   - otherwise → 'failed'

import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type { CloseBuildContext, CloseBuilder } from '../../registries/close-writers/types.js';
import {
  FixBrief,
  FixChange,
  FixContext,
  FixDiagnosis,
  FixRegressionProof,
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
  { report_id: 'fix.change', schema: 'fix.change@v1' },
  { report_id: 'fix.verification', schema: 'fix.verification@v1' },
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
    { name: 'change', schema: 'fix.change@v1', required: true },
    { name: 'verification', schema: 'fix.verification@v1', required: true },
    { name: 'review', schema: 'fix.review@v1', required: false },
  ],
  build(context: CloseBuildContext): unknown {
    const brief = FixBrief.parse(context.inputs.brief);
    FixContext.parse(context.inputs.context);
    const diagnosis = FixDiagnosis.parse(context.inputs.diagnosis);
    const regression = FixRegressionProof.parse(context.inputs.regression);
    const change = FixChange.parse(context.inputs.change);
    const verification = FixVerification.parse(context.inputs.verification);
    const review =
      context.inputs.review === undefined ? undefined : FixReview.parse(context.inputs.review);

    const verificationStatus = verification.overall_status === 'passed' ? 'passed' : 'failed';
    const regressionStatus: FixResult['regression_status'] =
      regression.status === 'proved' ? 'proved' : 'deferred';
    const reviewStatus = review === undefined ? 'skipped' : 'completed';

    const outcome: FixResult['outcome'] =
      diagnosis.reproduction_status === 'not-reproduced'
        ? 'not-reproduced'
        : verificationStatus === 'passed' &&
            regressionStatus === 'proved' &&
            (review === undefined || review.verdict === 'accept')
          ? 'fixed'
          : verificationStatus === 'passed' &&
              (regressionStatus !== 'proved' || review?.verdict === 'accept-with-fixes')
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
