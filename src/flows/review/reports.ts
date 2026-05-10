import { z } from 'zod';

export const ReviewFindingSeverity = z.enum(['critical', 'high', 'low']);
export type ReviewFindingSeverity = z.infer<typeof ReviewFindingSeverity>;

export const ReviewResultVerdict = z.enum(['CLEAN', 'ISSUES_FOUND']);
export type ReviewResultVerdict = z.infer<typeof ReviewResultVerdict>;

export const ReviewRelayVerdict = z.enum(['NO_ISSUES_FOUND', 'ISSUES_FOUND']);
export type ReviewRelayVerdict = z.infer<typeof ReviewRelayVerdict>;

export const ReviewEvidenceWarningKind = z.enum([
  'diff_truncated',
  'git_command_failed',
  'untracked_file_skipped',
  'untracked_file_content_omitted',
  'untracked_files_truncated',
  'evidence_unavailable',
  'scope_empty',
]);
export type ReviewEvidenceWarningKind = z.infer<typeof ReviewEvidenceWarningKind>;

export const ReviewEvidenceWarning = z
  .object({
    kind: ReviewEvidenceWarningKind,
    message: z.string().min(1),
    path: z.string().min(1).optional(),
  })
  .strict();
export type ReviewEvidenceWarning = z.infer<typeof ReviewEvidenceWarning>;

export const ReviewEvidenceText = z
  .object({
    text: z.string(),
    truncated: z.boolean(),
  })
  .strict();
export type ReviewEvidenceText = z.infer<typeof ReviewEvidenceText>;

export const ReviewUntrackedContentPolicy = z.enum(['metadata-only', 'include-content']);
export type ReviewUntrackedContentPolicy = z.infer<typeof ReviewUntrackedContentPolicy>;

export const ReviewUntrackedFileEvidence = z
  .object({
    path: z.string().min(1),
    byte_length: z.number().int().nonnegative(),
    content: ReviewEvidenceText.optional(),
    skipped_reason: z.string().min(1).optional(),
  })
  .strict();
export type ReviewUntrackedFileEvidence = z.infer<typeof ReviewUntrackedFileEvidence>;

export const ReviewEvidence = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('unavailable'),
      reason: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('git-working-tree'),
      project_root: z.string().min(1),
      status_short: z.string(),
      staged_diff: ReviewEvidenceText,
      unstaged_diff: ReviewEvidenceText,
      diff_stat: z.string(),
      untracked_file_count: z.number().int().nonnegative(),
      untracked_files_truncated: z.boolean(),
      untracked_content_policy: ReviewUntrackedContentPolicy,
      untracked_files: z.array(ReviewUntrackedFileEvidence),
    })
    .strict(),
]);
export type ReviewEvidence = z.infer<typeof ReviewEvidence>;

export const ReviewEvidenceSummary = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('unavailable'),
      message: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('git-working-tree'),
      untracked_content_policy: ReviewUntrackedContentPolicy,
      untracked_file_count: z.number().int().nonnegative(),
      untracked_files_sampled: z.number().int().nonnegative(),
      untracked_files_truncated: z.boolean(),
    })
    .strict(),
]);
export type ReviewEvidenceSummary = z.infer<typeof ReviewEvidenceSummary>;

export const ReviewIntake = z
  .object({
    scope: z.string().min(1),
    evidence: ReviewEvidence,
    evidence_warnings: z.array(ReviewEvidenceWarning).default([]),
  })
  .strict();
export type ReviewIntake = z.infer<typeof ReviewIntake>;

export const ReviewFinding = z
  .object({
    severity: ReviewFindingSeverity,
    id: z.string().min(1),
    text: z.string().min(1),
    file_refs: z.array(z.string().min(1)),
  })
  .strict();
export type ReviewFinding = z.infer<typeof ReviewFinding>;

export function computeReviewVerdict(
  findings: readonly { readonly severity: ReviewFindingSeverity }[],
): ReviewResultVerdict {
  return findings.some((finding) => finding.severity === 'critical' || finding.severity === 'high')
    ? 'ISSUES_FOUND'
    : 'CLEAN';
}

export const ReviewResult = z
  .object({
    scope: z.string().min(1),
    findings: z.array(ReviewFinding),
    verdict: ReviewResultVerdict,
    // Plain-language paragraph from the reviewer: what was checked and what
    // they concluded. Required even on a CLEAN verdict so a no-findings result
    // does not collapse to "Findings: 0" without context. The operator-summary
    // renderer reads this when the projection has no findings to list.
    assessment: z.string().min(1),
    // Concrete verification steps the reviewer performed: files inspected,
    // commands run, evidence cross-referenced. Empty array is permitted but
    // discouraged — the prompt asks the reviewer to name at least one step.
    verification: z.array(z.string().min(1)),
    // Known gaps that limit certainty (out-of-scope files, untracked content
    // omitted, missing context). Empty array is permitted when the reviewer
    // had complete coverage; the operator-summary renderer surfaces non-empty
    // entries so a CLEAN verdict cannot quietly stand in for "high confidence".
    confidence_limitations: z.array(z.string().min(1)),
    evidence_summary: ReviewEvidenceSummary.optional(),
    evidence_warnings: z.array(ReviewEvidenceWarning).default([]),
  })
  .strict()
  .superRefine((report, ctx) => {
    const expected = computeReviewVerdict(report.findings);
    if (report.verdict !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: `verdict must be ${expected} for the report findings (CLEAN iff critical_count == 0 and high_count == 0)`,
      });
    }
  });
export type ReviewResult = z.infer<typeof ReviewResult>;

export const ReviewRelayResult = z
  .object({
    verdict: ReviewRelayVerdict,
    findings: z.array(ReviewFinding),
    // See ReviewResult.assessment — the reviewer's plain-language paragraph
    // describing what was checked and what they concluded. Required for both
    // NO_ISSUES_FOUND and ISSUES_FOUND verdicts: a clean output without an
    // assessment is the regression that motivated this addition (vanilla
    // Claude Code says what it checked even on a no-findings review; Circuit
    // used to collapse to "Findings: 0").
    assessment: z.string().min(1),
    // Concrete verification steps the reviewer performed (files, commands,
    // evidence). Required as an array; the relay prompt asks for at least
    // one entry.
    verification: z.array(z.string().min(1)),
    // Known gaps that limit certainty. Required as an array (may be empty
    // when coverage was complete).
    confidence_limitations: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((report, ctx) => {
    const expected = report.findings.length === 0 ? 'NO_ISSUES_FOUND' : 'ISSUES_FOUND';
    if (report.verdict !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: `review relay verdict must be ${expected} for findings.length=${report.findings.length}`,
      });
    }
  });
export type ReviewRelayResult = z.infer<typeof ReviewRelayResult>;
