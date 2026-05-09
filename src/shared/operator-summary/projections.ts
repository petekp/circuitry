// Per-flow operator-summary projector registry.
//
// Adding a new flow's projection is a single registry entry plus the
// projector function it references. Keep small projectors inline here; flows
// with substantial projection logic (currently: Explore) live in their own
// module and re-export through the registry.

import { exploreSummaryProjector } from './explore.js';
import { arrayField, type JsonObject, isObject, numberField, stringField } from './json.js';
import type { SummaryProjection, SummaryProjector } from './projector.js';
import {
  friendlyResultSummary,
  friendlyReviewStatus,
  friendlyVerificationStatus,
  plural,
} from './text.js';

function flowSummaryDetail(flowReport: JsonObject | undefined): string | undefined {
  const summary = stringField(flowReport, 'summary');
  return summary === undefined ? undefined : `Result: ${friendlyResultSummary(summary)}`;
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
  const details: string[] = [];
  if (summaryDetail !== undefined) details.push(summaryDetail);
  details.push(`Findings: ${findings}`);
  details.push(...reviewEvidenceDetails(flowReport));
  // When the working-tree diff was empty, the reviewer had nothing to inspect,
  // so a CLEAN/0-findings headline silently understates the scope limitation.
  // Lead with the limitation and qualify the verdict instead.
  const headline = scopeEmpty
    ? `Circuit: Review found no uncommitted changes to examine; committed history (HEAD~1) was not part of this review. Verdict ${verdict} reflects scope, not safety. Findings: ${findings}.`
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
function flowOutcomeOrRunFallback(
  flowReport: JsonObject | undefined,
  runOutcome: string,
): string {
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
  return {
    headline: `Circuit: Fix finished with outcome ${outcome}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`,
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
