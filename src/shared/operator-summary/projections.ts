// Per-flow operator-summary projector registry.
//
// Adding a new flow's projection is a single registry entry plus the
// projector function it references. Keep small projectors inline here; flows
// with substantial projection logic (currently: Explore) live in their own
// module and re-export through the registry.

import { exploreSummaryProjector } from './explore.js';
import {
  type JsonObject,
  arrayField,
  isObject,
  numberField,
  stringArrayField,
  stringField,
} from './json.js';
import type { SummaryProjection, SummaryProjector } from './projector.js';
import {
  capitalized,
  friendlyFixOutcome,
  friendlyResultSummary,
  friendlyReviewStatus,
  friendlyVerificationStatus,
  plural,
} from './text.js';

function flowSummaryDetail(flowReport: JsonObject | undefined): string | undefined {
  const summary = stringField(flowReport, 'summary');
  return summary === undefined ? undefined : `Result: ${friendlyResultSummary(summary)}`;
}

function firstLineSummary(text: string, max: number): string {
  // Strip leading markdown-active markers (bullets, headings, blockquotes,
  // code-fence backticks) so a finding text that starts with "- foo" cannot
  // produce a nested bullet when concatenated into the operator summary's
  // "- <detail>" rendering.
  const firstLine = (text.split(/\r?\n/, 1)[0] ?? '').replace(/^[\s>#*\-`|]+/, '').trim();
  if (firstLine.length === 0) return '(no text)';
  if (firstLine.length <= max) return firstLine;
  return `${firstLine.slice(0, Math.max(1, max - 1))}…`;
}

function reviewFindingDetails(report: JsonObject | undefined): string[] {
  const findings = arrayField(report, 'findings');
  if (findings.length === 0) {
    // Drop the bare "Findings: 0" line when the reviewer included an
    // assessment paragraph — the assessment carries the same "no issues"
    // information with context. Old reports without an assessment fall
    // back to the legacy line so the summary still names the count.
    return stringField(report, 'assessment') === undefined ? ['Findings: 0'] : [];
  }
  const lines: string[] = [];
  for (const finding of findings) {
    if (!isObject(finding)) continue;
    const severity = (stringField(finding, 'severity') ?? 'unknown').toUpperCase();
    const text = stringField(finding, 'text') ?? '(no text)';
    const fileRefs = stringArrayField(finding, 'file_refs');
    const summary = firstLineSummary(text, 140);
    const fileSuffix = fileRefs.length === 0 ? '' : ` — at ${fileRefs.join(', ')}`;
    lines.push(`[${severity}] ${summary}${fileSuffix}`);
  }
  return lines;
}

// Reviewer-supplied prose: the assessment paragraph, the verification steps
// they took, and any confidence limitations they flagged. Required on the
// relay/result schema so a CLEAN verdict cannot collapse to a bare count;
// rendered here so the operator sees what was checked even when there are
// no findings to list.
function reviewAssessmentDetails(report: JsonObject | undefined): string[] {
  const lines: string[] = [];
  const assessment = stringField(report, 'assessment');
  if (assessment !== undefined && assessment.trim().length > 0) {
    lines.push(`Assessment: ${assessment.trim()}`);
  }
  const verification = stringArrayField(report, 'verification')
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
  if (verification.length > 0) {
    lines.push(`Reviewer steps: ${verification.join('; ')}`);
  }
  const limitations = stringArrayField(report, 'confidence_limitations')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (limitations.length > 0) {
    lines.push(`Confidence limitations: ${limitations.join('; ')}`);
  }
  return lines;
}

function reviewEvidenceDetails(report: JsonObject | undefined): string[] {
  const evidenceSummary = isObject(report?.evidence_summary) ? report.evidence_summary : undefined;
  const kind = stringField(evidenceSummary, 'kind');
  if (kind === 'unavailable') {
    const message = stringField(evidenceSummary, 'message');
    return message === undefined ? [] : [`Review evidence: unavailable (${message})`];
  }
  if (kind !== 'git-working-tree') return [];

  const policy = stringField(evidenceSummary, 'untracked_content_policy');
  const count = numberField(evidenceSummary, 'untracked_file_count') ?? 0;
  const sampled = numberField(evidenceSummary, 'untracked_files_sampled') ?? 0;
  const truncated = evidenceSummary?.untracked_files_truncated === true;
  if (policy === 'include-content') {
    const suffix = truncated ? '; additional untracked files were not sampled' : '';
    return [
      `Untracked evidence: contents included for ${plural(sampled, 'file')} (${plural(count, 'untracked file')} found${suffix}).`,
    ];
  }
  if (policy === 'metadata-only' && count > 0) {
    const suffix = truncated ? '; additional untracked files were not sampled' : '';
    return [
      `Untracked evidence: paths and sizes only for ${plural(sampled, 'file')} (${plural(count, 'untracked file')} found${suffix}).`,
    ];
  }
  return [];
}

function hasEvidenceWarningKind(report: JsonObject | undefined, kind: string): boolean {
  return arrayField(report, 'evidence_warnings').some(
    (item) => isObject(item) && stringField(item, 'kind') === kind,
  );
}

const reviewProjector: SummaryProjector = ({ flowReport }) => {
  const verdict = stringField(flowReport, 'verdict') ?? 'review complete';
  const findings = arrayField(flowReport, 'findings').length;
  const scopeEmpty = hasEvidenceWarningKind(flowReport, 'scope_empty');
  const summaryDetail = flowSummaryDetail(flowReport);
  const assessmentDetails = reviewAssessmentDetails(flowReport);
  // Order: legacy result-summary line, assessment paragraph (the reviewer's
  // framing), the findings list, then verification + limitations + evidence.
  // Assessment lives in `assessmentDetails`; we splice the verification and
  // limitations entries between findings and evidence so the operator reads
  // conclusion → specifics → methodology → caveats → metadata.
  const [assessmentLine, ...verificationAndLimitations] = assessmentDetails;
  const details: string[] = [];
  if (summaryDetail !== undefined) details.push(summaryDetail);
  if (assessmentLine !== undefined) details.push(assessmentLine);
  details.push(...reviewFindingDetails(flowReport));
  details.push(...verificationAndLimitations);
  details.push(...reviewEvidenceDetails(flowReport));
  // When the reviewer had no source content to inspect, a CLEAN/0-findings
  // headline silently understates the scope limitation. Drop the verdict
  // reference (it is meaningless when scope is empty, and would read awkwardly
  // through the fallback if verdict were ever absent) and lead with the
  // scope-was-empty fact instead.
  const headline = scopeEmpty
    ? `Circuit: Review had no uncommitted source content to examine; committed history (HEAD~1) was not part of this review. Findings: ${findings}.`
    : `Circuit: Review complete. Verdict: ${verdict}. Findings: ${findings}.`;
  return {
    headline,
    details,
  } satisfies SummaryProjection;
};

function buildFixMigrateDetails(flowReport: JsonObject | undefined): string[] {
  const details: string[] = [];
  const summaryDetail = flowSummaryDetail(flowReport);
  if (summaryDetail !== undefined) details.push(summaryDetail);
  const verification = stringField(flowReport, 'verification_status');
  const review = stringField(flowReport, 'review_verdict');
  if (verification !== undefined) {
    details.push(`Verification: ${friendlyVerificationStatus(verification)}.`);
  }
  if (review !== undefined) {
    details.push(`Review: ${friendlyReviewStatus(review)}.`);
  }
  return details;
}

// Fall back to the run-level outcome when the flow-result file is missing
// (e.g., the flow hit @stop before close-step ran). Defaulting to 'complete'
// would let the operator summary silently contradict result.json on any
// non-complete terminal path.
function flowOutcomeOrRunFallback(flowReport: JsonObject | undefined, runOutcome: string): string {
  return stringField(flowReport, 'outcome') ?? runOutcome;
}

const buildProjector: SummaryProjector = ({ flowReport, runOutcome }) => {
  const outcome = flowOutcomeOrRunFallback(flowReport, runOutcome);
  const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
  const review = stringField(flowReport, 'review_verdict') ?? 'unknown';
  const headline = ((): string => {
    if (outcome === 'complete' && verification === 'passed' && review === 'accept') {
      return 'Circuit: Build complete. Change implemented, verification passed, review accepted.';
    }
    if (outcome === 'needs_attention' && verification === 'passed') {
      return 'Circuit: Build needs follow-up. Verification passed, but review requested fixes.';
    }
    return `Circuit: Build finished with outcome ${outcome}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`;
  })();
  return { headline, details: buildFixMigrateDetails(flowReport) } satisfies SummaryProjection;
};

const fixProjector: SummaryProjector = ({ flowReport, runOutcome }) => {
  const outcome = flowOutcomeOrRunFallback(flowReport, runOutcome);
  const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
  const review =
    stringField(flowReport, 'review_verdict') ??
    stringField(flowReport, 'review_status') ??
    'unknown';
  // Avoid "outcome partial" on the happy-with-followups path — the operator
  // reads that as "the fix was only partially applied", but Fix uses 'partial'
  // for "applied + verified, regression test deferred or review asked for
  // follow-ups." Render every Fix outcome through friendlyFixOutcome so the
  // headline never collides with run-level outcome vocabulary.
  const headline = `Circuit: ${capitalized(friendlyFixOutcome(outcome))}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`;
  return {
    headline,
    details: buildFixMigrateDetails(flowReport),
  } satisfies SummaryProjection;
};

const migrateProjector: SummaryProjector = ({ flowReport, runOutcome }) => {
  const outcome = flowOutcomeOrRunFallback(flowReport, runOutcome);
  const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
  const review = stringField(flowReport, 'review_verdict') ?? 'unknown';
  return {
    headline: `Circuit: Migrate finished with outcome ${outcome}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`,
    details: buildFixMigrateDetails(flowReport),
  } satisfies SummaryProjection;
};

const sweepProjector: SummaryProjector = ({ flowReport, runOutcome }) => {
  const outcome = flowOutcomeOrRunFallback(flowReport, runOutcome);
  const deferred = numberField(flowReport, 'deferred_count');
  const headline =
    deferred === undefined
      ? `Circuit: Sweep finished with outcome ${outcome}.`
      : `Circuit: Sweep finished with outcome ${outcome}. Deferred: ${plural(deferred, 'item')}.`;
  const summaryDetail = flowSummaryDetail(flowReport);
  return {
    headline,
    details: summaryDetail === undefined ? [] : [summaryDetail],
  } satisfies SummaryProjection;
};

// Default projection used when no per-flow projector is registered. The
// resultSummary is the run-result summary string; the writer's overlay code
// adds run-note framing on top, so leaving details empty here keeps the
// shape symmetric across flows.
const defaultProjector: SummaryProjector = ({ resultSummary }) => ({
  headline: resultSummary,
  details: [],
});

export const SUMMARY_PROJECTORS: Partial<Record<string, SummaryProjector>> = {
  build: buildProjector,
  explore: exploreSummaryProjector,
  fix: fixProjector,
  migrate: migrateProjector,
  review: reviewProjector,
  sweep: sweepProjector,
};

export function projectSummary(input: Parameters<SummaryProjector>[0]): SummaryProjection {
  const projector = SUMMARY_PROJECTORS[input.flowId] ?? defaultProjector;
  return projector(input);
}
