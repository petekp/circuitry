import { z } from 'zod';
import { VerificationCommand } from '../../schemas/verification.js';

const FIX_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  'fix.brief': 'fix.brief@v1',
  'fix.context': 'fix.context@v1',
  'fix.diagnosis': 'fix.diagnosis@v1',
  'fix.no-repro-decision': 'fix.no-repro-decision@v1',
  'fix.regression-proof': 'fix.regression-proof@v1',
  'fix.change': 'fix.change@v1',
  'fix.verification': 'fix.verification@v1',
  'fix.review': 'fix.review@v1',
} as const;

const FIX_RESULT_PATH_BY_ARTIFACT_ID = {
  'fix.brief': 'reports/fix/brief.json',
  'fix.context': 'reports/fix/context.json',
  'fix.diagnosis': 'reports/fix/diagnosis.json',
  'fix.no-repro-decision': 'reports/fix/no-repro-decision.json',
  'fix.regression-proof': 'reports/fix/regression-proof.json',
  'fix.change': 'reports/fix/change.json',
  'fix.verification': 'reports/fix/verification.json',
  'fix.review': 'reports/fix/review.json',
} as const;

const REQUIRED_FIX_RESULT_ARTIFACT_IDS = [
  'fix.brief',
  'fix.context',
  'fix.diagnosis',
  'fix.regression-proof',
  'fix.change',
  'fix.verification',
] as const;

const NonEmptyStringArray = z.array(z.string().min(1)).min(1);

// Lenient form for relay-emitted evidence-style fields. Workers occasionally
// answer with a single string ("git diff README.md shows: ...") on retry
// attempts where the recovery context confuses the schema field name with a
// freeform-prose request. Coerce a single non-empty string to a one-element
// array before validation so the run does not abort over a shape detail
// that has no downstream consumer (evidence is documentation/audit only).
const LenientNonEmptyStringArray = z.preprocess(
  (val) => (typeof val === 'string' && val.length > 0 ? [val] : val),
  z.array(z.string().min(1)).min(1),
);

export const FixVerificationCommand = VerificationCommand;
export type FixVerificationCommand = z.infer<typeof FixVerificationCommand>;

export const FixRegressionContract = z
  .object({
    expected_behavior: z.string().min(1),
    actual_behavior: z.string().min(1),
    repro: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('command'),
          command: FixVerificationCommand,
        })
        .strict(),
      z
        .object({
          kind: z.literal('procedure'),
          procedure: z.string().min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal('not-reproducible'),
          deferred_reason: z.string().min(1),
        })
        .strict(),
    ]),
    regression_test: z.discriminatedUnion('status', [
      z
        .object({
          status: z.literal('failing-before-fix'),
          command: FixVerificationCommand,
        })
        .strict(),
      z
        .object({
          status: z.literal('deferred'),
          deferred_reason: z.string().min(1),
        })
        .strict(),
    ]),
  })
  .strict()
  .superRefine((contract, ctx) => {
    if (
      contract.repro.kind !== 'not-reproducible' &&
      contract.regression_test.status !== 'failing-before-fix'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['regression_test', 'status'],
        message: "regression_test.status must be 'failing-before-fix' when repro evidence exists",
      });
    }
  });
export type FixRegressionContract = z.infer<typeof FixRegressionContract>;

export const FixBrief = z
  .object({
    problem_statement: z.string().min(1),
    expected_behavior: z.string().min(1),
    observed_behavior: z.string().min(1),
    scope: z.string().min(1),
    regression_contract: FixRegressionContract,
    success_criteria: NonEmptyStringArray,
    verification_command_candidates: z.array(FixVerificationCommand).min(1),
  })
  .strict();
export type FixBrief = z.infer<typeof FixBrief>;

export const FixContextSource = z
  .object({
    kind: z.enum(['file', 'command', 'log', 'operator-note', 'reference']),
    ref: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict();
export type FixContextSource = z.infer<typeof FixContextSource>;

export const FixContext = z
  .object({
    verdict: z.literal('accept'),
    sources: z.array(FixContextSource).min(1),
    observations: NonEmptyStringArray,
    open_questions: z.array(z.string().min(1)),
  })
  .strict();
export type FixContext = z.infer<typeof FixContext>;

export const FixReproductionStatus = z.enum([
  'reproduced',
  'not-reproduced',
  'intermittent',
  'not-attempted',
]);
export type FixReproductionStatus = z.infer<typeof FixReproductionStatus>;

export const FixDiagnosis = z
  .object({
    verdict: z.literal('accept'),
    reproduction_status: FixReproductionStatus,
    cause_summary: z.string().min(1),
    confidence: z.enum(['low', 'medium', 'high']),
    evidence: LenientNonEmptyStringArray,
    residual_uncertainty: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((diagnosis, ctx) => {
    if (
      diagnosis.reproduction_status !== 'reproduced' &&
      diagnosis.residual_uncertainty.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['residual_uncertainty'],
        message:
          'residual_uncertainty must be non-empty when the problem was not cleanly reproduced',
      });
    }
  });
export type FixDiagnosis = z.infer<typeof FixDiagnosis>;

export const FixNoReproDecisionKind = z.enum([
  'add-diagnostics',
  'continue-with-small-fix',
  'stop-as-not-reproduced',
  'handoff',
  'escalate',
]);
export type FixNoReproDecisionKind = z.infer<typeof FixNoReproDecisionKind>;

export const FixNoReproRoute = z.enum(['continue', 'revise', 'stop', 'handoff', 'escalate']);
export type FixNoReproRoute = z.infer<typeof FixNoReproRoute>;

const NO_REPRO_DECISION_ROUTE = {
  'add-diagnostics': 'revise',
  'continue-with-small-fix': 'continue',
  'stop-as-not-reproduced': 'stop',
  handoff: 'handoff',
  escalate: 'escalate',
} as const satisfies Record<FixNoReproDecisionKind, FixNoReproRoute>;

export const FixNoReproDecision = z
  .object({
    decision: FixNoReproDecisionKind,
    selected_route: FixNoReproRoute,
    answered_by: z.enum(['operator', 'mode-default', 'host-default']),
    rationale: z.string().min(1),
  })
  .strict()
  .superRefine((decision, ctx) => {
    const expected = NO_REPRO_DECISION_ROUTE[decision.decision];
    if (decision.selected_route !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selected_route'],
        message: `selected_route must be '${expected}' for decision '${decision.decision}'`,
      });
    }
  });
export type FixNoReproDecision = z.infer<typeof FixNoReproDecision>;

export const FixChange = z
  .object({
    verdict: z.literal('accept'),
    summary: z.string().min(1),
    diagnosis_ref: z.string().min(1),
    changed_files: NonEmptyStringArray,
    evidence: LenientNonEmptyStringArray,
  })
  .strict();
export type FixChange = z.infer<typeof FixChange>;

export const FixVerificationCommandResult = z
  .object({
    command_id: z.string().min(1),
    cwd: z.string().min(1),
    argv: z.array(z.string().min(1)).min(1),
    timeout_ms: z.number().int().positive(),
    max_output_bytes: z.number().int().positive(),
    env: z.record(z.string(), z.string()),
    exit_code: z.number().int().nonnegative(),
    status: z.enum(['passed', 'failed']),
    duration_ms: z.number().int().nonnegative(),
    stdout_summary: z.string(),
    stderr_summary: z.string(),
  })
  .strict()
  .superRefine((result, ctx) => {
    const commandParse = FixVerificationCommand.safeParse({
      id: result.command_id,
      cwd: result.cwd,
      argv: result.argv,
      timeout_ms: result.timeout_ms,
      max_output_bytes: result.max_output_bytes,
      env: result.env,
    });
    if (!commandParse.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['argv'],
        message: `verification command result must include a safe command spec: ${commandParse.error.issues
          .map((issue) => issue.message)
          .join('; ')}`,
      });
    }

    const expected = result.exit_code === 0 ? 'passed' : 'failed';
    if (result.status !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: `status must be '${expected}' when exit_code is ${result.exit_code}`,
      });
    }
  });
export type FixVerificationCommandResult = z.infer<typeof FixVerificationCommandResult>;

export const FixVerification = z
  .object({
    overall_status: z.enum(['passed', 'failed']),
    commands: z.array(FixVerificationCommandResult).min(1),
  })
  .strict()
  .superRefine((verification, ctx) => {
    const expected = verification.commands.some((command) => command.status === 'failed')
      ? 'failed'
      : 'passed';
    if (verification.overall_status !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['overall_status'],
        message: `overall_status must be '${expected}' for command results`,
      });
    }
  });
export type FixVerification = z.infer<typeof FixVerification>;

// Runtime-owned regression proof. The brief's regression contract states the
// model's *intent* — what test should reproduce the bug. This artifact records
// what the runtime actually observed when it executed that test before the fix
// was applied:
//   - 'proved'     — runtime ran the regression command and observed it fail
//                    (matching the brief's failing-before-fix expectation, so
//                    the test does reproduce the bug).
//   - 'deferred'   — brief did not specify a runnable regression test; no
//                    proof was collected. fix-close cannot mark outcome
//                    'fixed' on a deferred proof.
//   - 'not-proved' — runtime ran the regression command but it passed,
//                    contradicting the brief. The bug is not actually being
//                    reproduced by the named test, so any later "fix" is
//                    unfounded. Treated as a verification failure.
//
// `overall_status` exists so the verification executor can route on the
// outcome: 'passed' when status is 'proved' or 'deferred' (continue), 'failed'
// when status is 'not-proved' (recovery).
export const FixRegressionProofObservation = z
  .object({
    command_id: z.string().min(1),
    cwd: z.string().min(1),
    argv: z.array(z.string().min(1)).min(1),
    timeout_ms: z.number().int().positive(),
    max_output_bytes: z.number().int().positive(),
    env: z.record(z.string(), z.string()),
    exit_code: z.number().int().nonnegative(),
    command_status: z.enum(['passed', 'failed']),
    duration_ms: z.number().int().nonnegative(),
    stdout_summary: z.string(),
    stderr_summary: z.string(),
  })
  .strict()
  .superRefine((observation, ctx) => {
    const expected = observation.exit_code === 0 ? 'passed' : 'failed';
    if (observation.command_status !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['command_status'],
        message: `command_status must be '${expected}' when exit_code is ${observation.exit_code}`,
      });
    }
  });
export type FixRegressionProofObservation = z.infer<typeof FixRegressionProofObservation>;

export const FixRegressionProofStatus = z.enum(['proved', 'deferred', 'not-proved']);
export type FixRegressionProofStatus = z.infer<typeof FixRegressionProofStatus>;

export const FixRegressionProof = z
  .object({
    status: FixRegressionProofStatus,
    overall_status: z.enum(['passed', 'failed']),
    reason: z.string().min(1).optional(),
    baseline: FixRegressionProofObservation.optional(),
  })
  .strict()
  .superRefine((proof, ctx) => {
    const expectedOverall = proof.status === 'not-proved' ? 'failed' : 'passed';
    if (proof.overall_status !== expectedOverall) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['overall_status'],
        message: `overall_status must be '${expectedOverall}' when status is '${proof.status}'`,
      });
    }
    if (proof.status === 'deferred') {
      if (proof.baseline !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['baseline'],
          message: "baseline must be omitted when status is 'deferred'",
        });
      }
      if (proof.reason === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: "reason is required when status is 'deferred'",
        });
      }
    } else {
      if (proof.baseline === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['baseline'],
          message: `baseline is required when status is '${proof.status}'`,
        });
      }
      if (proof.status === 'proved' && proof.baseline?.command_status !== 'failed') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['status'],
          message: "status 'proved' requires baseline command_status 'failed'",
        });
      }
      if (proof.status === 'not-proved' && proof.baseline?.command_status !== 'passed') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['status'],
          message: "status 'not-proved' requires baseline command_status 'passed'",
        });
      }
    }
  });
export type FixRegressionProof = z.infer<typeof FixRegressionProof>;

export const FixReviewVerdict = z.enum(['accept', 'accept-with-fixes', 'reject']);
export type FixReviewVerdict = z.infer<typeof FixReviewVerdict>;

export const FixReviewFinding = z
  .object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    text: z.string().min(1),
    file_refs: z.array(z.string().min(1)),
  })
  .strict();
export type FixReviewFinding = z.infer<typeof FixReviewFinding>;

export const FixReview = z
  .object({
    verdict: FixReviewVerdict,
    summary: z.string().min(1),
    findings: z.array(FixReviewFinding),
  })
  .strict()
  .superRefine((review, ctx) => {
    if (review.verdict !== 'accept' && review.findings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['findings'],
        message: `findings must be non-empty when verdict is '${review.verdict}'`,
      });
    }
  });
export type FixReview = z.infer<typeof FixReview>;

export const FixResultOutcome = z.enum([
  'fixed',
  'not-reproduced',
  'partial',
  'stopped',
  'handoff',
  'failed',
]);
export type FixResultOutcome = z.infer<typeof FixResultOutcome>;

export const FixResultReportId = z.enum([
  'fix.brief',
  'fix.context',
  'fix.diagnosis',
  'fix.no-repro-decision',
  'fix.regression-proof',
  'fix.change',
  'fix.verification',
  'fix.review',
]);
export type FixResultReportId = z.infer<typeof FixResultReportId>;

export const FixResultReportPointer = z
  .object({
    report_id: FixResultReportId,
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict()
  .superRefine((pointer, ctx) => {
    const expectedSchema = FIX_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.report_id];
    if (pointer.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schema'],
        message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`,
      });
    }
    const expectedPath = FIX_RESULT_PATH_BY_ARTIFACT_ID[pointer.report_id];
    if (pointer.path !== expectedPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['path'],
        message: `path must be '${expectedPath}' for report_id '${pointer.report_id}'`,
      });
    }
  });
export type FixResultReportPointer = z.infer<typeof FixResultReportPointer>;

export const FixReviewStatus = z.enum(['completed', 'skipped']);
export type FixReviewStatus = z.infer<typeof FixReviewStatus>;

export const FixResult = z
  .object({
    summary: z.string().min(1),
    outcome: FixResultOutcome,
    verification_status: z.enum(['passed', 'failed', 'not-run']),
    regression_status: z.enum(['proved', 'deferred', 'not-applicable']),
    review_status: FixReviewStatus,
    review_verdict: FixReviewVerdict.optional(),
    review_skip_reason: z.string().min(1).optional(),
    residual_risks: z.array(z.string().min(1)),
    evidence_links: z
      .array(FixResultReportPointer)
      .min(REQUIRED_FIX_RESULT_ARTIFACT_IDS.length)
      .max(FixResultReportId.options.length),
  })
  .strict()
  .superRefine((result, ctx) => {
    const seen = new Set<FixResultReportId>();
    for (const [index, pointer] of result.evidence_links.entries()) {
      if (seen.has(pointer.report_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evidence_links', index, 'report_id'],
          message: `duplicate report_id '${pointer.report_id}'`,
        });
      }
      seen.add(pointer.report_id);
    }

    for (const reportId of REQUIRED_FIX_RESULT_ARTIFACT_IDS) {
      if (!seen.has(reportId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evidence_links'],
          message: `missing report_id '${reportId}'`,
        });
      }
    }

    if (result.outcome === 'fixed' && result.verification_status !== 'passed') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verification_status'],
        message: "verification_status must be 'passed' when outcome is 'fixed'",
      });
    }

    if (result.outcome === 'fixed' && result.regression_status !== 'proved') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['regression_status'],
        message: "regression_status must be 'proved' when outcome is 'fixed'",
      });
    }

    if (result.outcome === 'fixed' && result.review_verdict === 'reject') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['review_verdict'],
        message: "review_verdict cannot be 'reject' when outcome is 'fixed'",
      });
    }

    if (
      result.outcome === 'fixed' &&
      result.review_status === 'completed' &&
      result.review_verdict !== 'accept'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['review_verdict'],
        message: "review_verdict must be 'accept' when outcome is 'fixed' and review completed",
      });
    }

    if (result.review_status === 'completed') {
      if (result.review_verdict === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['review_verdict'],
          message: "review_verdict is required when review_status is 'completed'",
        });
      }
      if (!seen.has('fix.review')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evidence_links'],
          message: "review_status 'completed' must include the fix.review evidence link",
        });
      }
    }

    if (result.review_status === 'skipped') {
      if (result.review_skip_reason === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['review_skip_reason'],
          message: "review_skip_reason is required when review_status is 'skipped'",
        });
      }
      if (result.review_verdict !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['review_verdict'],
          message: "review_verdict must be omitted when review_status is 'skipped'",
        });
      }
    }

    if (result.outcome === 'not-reproduced' && !seen.has('fix.no-repro-decision')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidence_links'],
        message: "outcome 'not-reproduced' must include the fix.no-repro-decision evidence link",
      });
    }
  });
export type FixResult = z.infer<typeof FixResult>;
