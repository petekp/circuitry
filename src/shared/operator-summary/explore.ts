// Explore-flow operator-summary projection.
//
// The Explore flow has substantially more projection logic than other flows
// because its model output is narrative prose (recommendation, proof, starting
// point, decision rationale) that must be compacted into terse bullets without
// losing structure. All Explore-specific helpers live here so the cross-flow
// surface (json.ts, text.ts, projector.ts) stays small.

import {
  type JsonObject,
  evidenceReportById,
  isObject,
  objectField,
  readJsonIfPresent,
  stringArrayField,
  stringField,
} from './json.js';
import type { SummaryProjection, SummaryProjector } from './projector.js';
import { friendlyResultSummary, sentence, withoutFinalPunctuation } from './text.js';

// Match a labeled list item of the form `(N) Capitalized label — explanation`.
// Guards:
//   - `\(\d+\)` requires a parenthesized number, not a parenthesized letter.
//   - `\s+` requires at least one space after the number, so back-references
//     like `Of these, (1), (4), and (5)...` (where `(N)` is followed by `,`)
//     do not match.
//   - `[A-Z]` requires the label to begin with a capital letter, ruling out
//     prose continuations like `(5) likely return the most signal...`.
//   - `[^—–()]` forbids parentheses inside the label, preventing a single
//     match from running across nested parenthetical asides and keeping
//     each numbered item isolated.
//   - The terminator is em-dash or en-dash only (never `:`). A colon can
//     appear far later in narrative prose; permitting it lets a single
//     match capture multiple sentences and produces malformed output when
//     the label list is reassembled.
//   - Length is capped so a missing terminator on one item does not pull
//     the rest of the paragraph into a single label.
const NUMBERED_LABEL_PATTERN = /\(\d+\)\s+([A-Z][^—–()]{1,120}?)\s*[—–]/g;

function stripExplorePrefix(summary: string): string {
  return friendlyResultSummary(summary).trim();
}

function numberedRecommendationLabels(text: string): string[] {
  const labels: string[] = [];
  for (const match of text.matchAll(NUMBERED_LABEL_PATTERN)) {
    const label = match[1]?.trim();
    if (label !== undefined && label.length > 0) labels.push(label);
  }
  return labels;
}

function firstNumberedItemPrefix(text: string): string | undefined {
  // Locate the first `(N) Capitalized label —` occurrence using the same
  // structural pattern. Anything before it is the intro; anything after
  // is the body of the numbered list (and any trailing back-references
  // or commentary the reviewer should not inherit into the headline).
  const match = new RegExp(NUMBERED_LABEL_PATTERN.source).exec(text);
  if (match === null || match.index === undefined) return undefined;
  const prefix = text.slice(0, match.index).trim();
  return prefix.length === 0 ? undefined : prefix;
}

function compactExploreRecommendation(summary: string): string | undefined {
  const text = stripExplorePrefix(summary);
  if (text.length === 0) return undefined;
  const labels = numberedRecommendationLabels(text);
  if (labels.length > 0) {
    // Intro is the prose BEFORE the first structural numbered item. When
    // the model uses an explicit `Concretely:` splitter, prefer that as
    // the intro boundary; otherwise cut at the first `(N) Label —` match
    // so the labels are not duplicated inline with the intro.
    const concretelySplit = text.split(/\s+Concretely:\s+/);
    const intro =
      concretelySplit.length > 1
        ? (concretelySplit[0] ?? text)
        : (firstNumberedItemPrefix(text) ?? text);
    return `Recommendation: ${withoutFinalPunctuation(intro.trim())}: ${labels.join('; ')}.`;
  }
  const [firstSentence = text] = text.split(/(?<=[.!?])\s+/);
  return `Recommendation: ${sentence(firstSentence.trim())}`;
}

function compactExploreProof(summary: string): string | undefined {
  const text = stripExplorePrefix(summary);
  const match =
    /Before building, the proof needed is:\s*(.*?)(?:\s+Recommend starting|\s+Recommend\s|$)/s.exec(
      text,
    );
  const raw = match?.[1]?.trim();
  if (raw === undefined || raw.length === 0) return undefined;
  const proof = raw
    .replace(/\([a-z]\)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*$/, '');
  return `Before building: ${proof}.`;
}

function compactExploreStartingPoint(summary: string): string | undefined {
  const text = stripExplorePrefix(summary);
  const match = /Recommend starting with\s+(.+?)\./s.exec(text);
  const raw = match?.[1]?.trim();
  return raw === undefined || raw.length === 0 ? undefined : `Start with: ${raw}.`;
}

function exploreDecisionReport(
  runFolder: string,
  flowReport: JsonObject | undefined,
): JsonObject | undefined {
  return (
    evidenceReportById(runFolder, flowReport, 'explore.decision') ??
    readJsonIfPresent(runFolder, 'reports/decision.json')
  );
}

// Looser gate than the HTML projector's `loadHtmlPayload`. Returns the
// snapshot as soon as a tournament has *picked* a winner — even before
// decision.json is finalized — because the markdown summary should surface
// the selected-option label and rationale-so-far the moment they exist. The
// HTML projector intentionally waits for `decision_verdict === 'decided'`
// since a checkpoint_waiting state without decision.json would render an
// empty/incomplete grid. Keep the asymmetry: do not tighten this gate
// without revisiting the projector.
function exploreTournamentSnapshot(flowReport: JsonObject | undefined): JsonObject | undefined {
  const snapshot = isObject(flowReport?.verdict_snapshot) ? flowReport.verdict_snapshot : undefined;
  if (stringField(snapshot, 'decision_verdict') === 'decided') return snapshot;
  return stringField(snapshot, 'selected_option_id') === undefined ? undefined : snapshot;
}

// Reviewer fold-ins split by weight:
//   - objections: things the reviewer says must be addressed → "Required
//     fold-in" so the operator treats them as work to do before acting on
//     the recommendation.
//   - missed_angles: lighter-weight considerations → "Consider" so the
//     operator treats them as enhancements, not blockers.
// Previously both rendered as the same generic "Follow-up:" line, which
// hid the distinction the reviewer was drawing.
function exploreReviewFoldInDetails(flowReport: JsonObject | undefined): string[] {
  const foldIns = objectField(flowReport, 'review_fold_ins');
  if (foldIns === undefined) return [];

  const objections = stringArrayField(foldIns, 'objections');
  const missedAngles = stringArrayField(foldIns, 'missed_angles');
  const details: string[] = [];
  if (objections.length > 0) {
    details.push('Reviewer: Accepted the direction, with required fold-ins.');
  } else if (missedAngles.length > 0) {
    details.push('Reviewer: Accepted the direction, with optional considerations.');
  } else {
    details.push('Reviewer: Accepted the direction.');
  }
  for (const objection of objections) details.push(`Required fold-in: ${objection}`);
  for (const angle of missedAngles) details.push(`Consider: ${angle}`);
  return details;
}

function reviewFoldInWeight(flowReport: JsonObject | undefined): 'required' | 'optional' | 'none' {
  const foldIns = objectField(flowReport, 'review_fold_ins');
  if (foldIns === undefined) return 'none';
  if (stringArrayField(foldIns, 'objections').length > 0) return 'required';
  if (stringArrayField(foldIns, 'missed_angles').length > 0) return 'optional';
  return 'none';
}

function exploreGuidanceDetails(flowReport: JsonObject | undefined): string[] {
  const summary = stringField(flowReport, 'summary');
  if (summary === undefined) return [];
  return [
    compactExploreRecommendation(summary),
    compactExploreProof(summary),
    compactExploreStartingPoint(summary),
  ].filter((detail): detail is string => detail !== undefined);
}

export const exploreSummaryProjector: SummaryProjector = ({
  runFolder,
  flowReport,
  resultSummary,
}) => {
  const verdictSnapshot = isObject(flowReport?.verdict_snapshot)
    ? flowReport.verdict_snapshot
    : undefined;

  const headline = ((): string => {
    if (exploreTournamentSnapshot(flowReport) !== undefined) {
      const decisionReport = exploreDecisionReport(runFolder, flowReport);
      const selected =
        stringField(decisionReport, 'selected_option_label') ??
        stringField(verdictSnapshot, 'selected_option_id') ??
        'selected option';
      const decision =
        stringField(decisionReport, 'decision') ??
        stringField(flowReport, 'summary') ??
        resultSummary;
      return `Circuit: Decision made. Selected: ${selected}. ${sentence(decision)}`;
    }
    const review = stringField(verdictSnapshot, 'review_verdict') ?? 'complete';
    if (review !== 'accept-with-fold-ins') {
      return 'Circuit: Recommendation ready. The direction is ready to use.';
    }
    // Don't say "ready" when the reviewer accepted only with caveats. Promote
    // the weight of the fold-ins (required vs optional) into the headline so
    // the operator sees the qualification before acting.
    const weight = reviewFoldInWeight(flowReport);
    if (weight === 'required') {
      return 'Circuit: Recommendation accepted, with required fold-ins to address.';
    }
    if (weight === 'optional') {
      return 'Circuit: Recommendation accepted, with optional considerations.';
    }
    return 'Circuit: Recommendation accepted, with reviewer notes.';
  })();

  const details: string[] = [
    ...exploreGuidanceDetails(flowReport),
    ...exploreReviewFoldInDetails(flowReport),
  ];

  if (exploreTournamentSnapshot(flowReport) !== undefined) {
    const decisionReport = exploreDecisionReport(runFolder, flowReport);
    const question = stringField(decisionReport, 'decision_question');
    const rationale = stringField(decisionReport, 'rationale');
    const risks = stringArrayField(decisionReport, 'residual_risks');
    const nextAction = stringField(decisionReport, 'next_action');
    if (question !== undefined) details.push(`Decision question: ${question}`);
    if (rationale !== undefined) details.push(`Rationale: ${rationale}`);
    if (risks.length > 0) details.push(`Residual risks: ${risks.join('; ')}`);
    if (nextAction !== undefined) details.push(`Next action: ${nextAction}`);
  }

  return { headline, details } satisfies SummaryProjection;
};
