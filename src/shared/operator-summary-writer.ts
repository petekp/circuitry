// Operator summary projection.
//
// This file turns run outputs into a concise human-facing summary. Treat it
// as a lossy projection over result reports and traces, not as an authority for
// runtime state or report schemas.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ExploreDecision,
  ExploreDecisionOptions,
  ExploreTournamentReview,
} from '../flows/explore/reports.js';
import {
  OperatorSummary,
  type OperatorSummaryReportLink,
  type OperatorSummaryWarning,
} from '../schemas/operator-summary.js';
import type { RunResult } from '../schemas/result.js';
import { renderExploreTournamentHTML } from './operator-summary-html.js';
import { RUN_RESULT_RELATIVE_PATH } from './result-path.js';
import { resolveRunRelative } from './run-relative-path.js';
import {
  WRITE_CAPABLE_WORKER_DISCLOSURE,
  flowMayInvokeWriteCapableWorker,
} from './write-capable-worker-disclosure.js';

type RouteSummary = {
  readonly selectedFlow: string;
  readonly routedBy?: 'explicit' | 'classifier';
  readonly routerReason?: string;
};

export type OperatorSummaryWriteResult = {
  readonly summary: OperatorSummary;
  readonly jsonPath: string;
  readonly markdownPath: string;
  readonly htmlPath?: string;
};

export interface CheckpointWaitingOperatorSummaryResult {
  readonly schema_version: 1;
  readonly run_id: RunResult['run_id'];
  readonly flow_id: RunResult['flow_id'];
  readonly goal: string;
  readonly outcome: 'checkpoint_waiting';
  readonly summary: string;
  readonly trace_entries_observed: number;
  readonly manifest_hash: string;
  readonly checkpoint: {
    readonly step_id: string;
    readonly request_path: string;
    readonly allowed_choices: readonly string[];
  };
  readonly reason?: string;
}

export type OperatorSummaryRunResult = RunResult | CheckpointWaitingOperatorSummaryResult;

type JsonObject = Record<string, unknown>;

const FLOW_RESULT_PATHS: Record<string, string> = {
  build: 'reports/build-result.json',
  explore: 'reports/explore-result.json',
  fix: 'reports/fix-result.json',
  migrate: 'reports/migrate-result.json',
  review: 'reports/review-result.json',
  sweep: 'reports/sweep-result.json',
};

function jsonPath(runFolder: string): string {
  return join(runFolder, 'reports', 'operator-summary.json');
}

function markdownPath(runFolder: string): string {
  return join(runFolder, 'reports', 'operator-summary.md');
}

function htmlPath(runFolder: string): string {
  return join(runFolder, 'reports', 'operator-summary.html');
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJsonIfPresent(runFolder: string, relPath: string): JsonObject | undefined {
  const path = resolveRunRelative(runFolder, relPath);
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return isObject(parsed) ? parsed : undefined;
}

function stringField(report: JsonObject | undefined, key: string): string | undefined {
  const value = report?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberField(report: JsonObject | undefined, key: string): number | undefined {
  const value = report?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function arrayField(report: JsonObject | undefined, key: string): unknown[] {
  const value = report?.[key];
  return Array.isArray(value) ? value : [];
}

function stringArrayField(report: JsonObject | undefined, key: string): string[] {
  return arrayField(report, key).filter((item): item is string => typeof item === 'string');
}

function objectField(report: JsonObject | undefined, key: string): JsonObject | undefined {
  const value = report?.[key];
  return isObject(value) ? value : undefined;
}

function plural(count: number, singular: string, pluralText = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralText}`;
}

function capitalized(value: string): string {
  const first = value[0];
  if (first === undefined) return value;
  return `${first.toUpperCase()}${value.slice(1)}`;
}

function friendlyRunNote(flowId: string, summary: string): string {
  const match = /^([a-z-]+) v[\d.]+ closed (\d+) step\(s\) for goal ".+"\.$/.exec(summary);
  if (match !== null) {
    return `Completed ${match[2]} ${capitalized(flowId)} steps for this goal.`;
  }
  return summary;
}

function friendlyResultSummary(summary: string): string {
  return summary
    .replace(/^(?:Build|Fix|Migrate|Review|Explore|Sweep) result for .+?:\s*/, '')
    .replace(/^Explore .+?:\s*/, '');
}

function sentence(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function withoutFinalPunctuation(value: string): string {
  return value.replace(/[.!?]\s*$/, '');
}

function stripExplorePrefix(summary: string): string {
  return friendlyResultSummary(summary).trim();
}

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

function numberedRecommendationLabels(text: string): string[] {
  const labels: string[] = [];
  for (const match of text.matchAll(NUMBERED_LABEL_PATTERN)) {
    const label = match[1]?.trim();
    if (label !== undefined && label.length > 0) labels.push(label);
  }
  return labels;
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
        ? concretelySplit[0]!
        : firstNumberedItemPrefix(text) ?? text;
    return `Recommendation: ${withoutFinalPunctuation(intro.trim())}: ${labels.join('; ')}.`;
  }
  const [firstSentence = text] = text.split(/(?<=[.!?])\s+/);
  return `Recommendation: ${sentence(firstSentence.trim())}`;
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

function reportLink(
  runFolder: string,
  label: string,
  relPath: string,
  schema?: string,
): OperatorSummaryReportLink {
  return {
    label,
    path: resolveRunRelative(runFolder, relPath),
    ...(schema === undefined ? {} : { schema }),
  };
}

function warningRecords(report: JsonObject | undefined): OperatorSummaryWarning[] {
  return arrayField(report, 'evidence_warnings').flatMap((item) => {
    if (!isObject(item)) return [];
    const kind = stringField(item, 'kind');
    const message = stringField(item, 'message');
    if (kind === undefined || message === undefined) return [];
    const path = stringField(item, 'path');
    return [{ kind, message, ...(path === undefined ? {} : { path }) }];
  });
}

function evidenceLinks(
  runFolder: string,
  report: JsonObject | undefined,
): OperatorSummaryReportLink[] {
  return arrayField(report, 'evidence_links').flatMap((item) => {
    if (!isObject(item)) return [];
    const reportId = stringField(item, 'report_id');
    const path = stringField(item, 'path');
    if (reportId === undefined || path === undefined) return [];
    return [reportLink(runFolder, reportId, path, stringField(item, 'schema'))];
  });
}

function evidenceReportById(
  runFolder: string,
  report: JsonObject | undefined,
  reportId: string,
): JsonObject | undefined {
  for (const item of arrayField(report, 'evidence_links')) {
    if (!isObject(item)) continue;
    if (stringField(item, 'report_id') !== reportId) continue;
    const path = stringField(item, 'path');
    if (path === undefined) return undefined;
    return readJsonIfPresent(runFolder, path);
  }
  return undefined;
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

function exploreTournamentSnapshot(flowReport: JsonObject | undefined): JsonObject | undefined {
  const snapshot = isObject(flowReport?.verdict_snapshot) ? flowReport.verdict_snapshot : undefined;
  if (stringField(snapshot, 'decision_verdict') === 'decided') return snapshot;
  return stringField(snapshot, 'selected_option_id') === undefined ? undefined : snapshot;
}

type ExploreTournamentHtmlPayload = {
  readonly decisionOptions: ExploreDecisionOptions;
  readonly tournamentReview: ExploreTournamentReview;
  readonly decision?: ExploreDecision;
};

function exploreTournamentHtmlPayload(
  runFolder: string,
  flowReport: JsonObject | undefined,
): ExploreTournamentHtmlPayload | undefined {
  if (exploreTournamentSnapshot(flowReport) === undefined) return undefined;
  const optionsRaw = evidenceReportById(runFolder, flowReport, 'explore.decision-options');
  const reviewRaw = evidenceReportById(runFolder, flowReport, 'explore.tournament-review');
  const decisionRaw = evidenceReportById(runFolder, flowReport, 'explore.decision');
  if (optionsRaw === undefined || reviewRaw === undefined) return undefined;

  const optionsParsed = ExploreDecisionOptions.safeParse(optionsRaw);
  const reviewParsed = ExploreTournamentReview.safeParse(reviewRaw);
  if (!optionsParsed.success || !reviewParsed.success) return undefined;

  const decisionParsed =
    decisionRaw === undefined ? undefined : ExploreDecision.safeParse(decisionRaw);
  return {
    decisionOptions: optionsParsed.data,
    tournamentReview: reviewParsed.data,
    ...(decisionParsed?.success === true ? { decision: decisionParsed.data } : {}),
  };
}

function exploreReviewFoldInDetails(flowReport: JsonObject | undefined): string[] {
  const foldIns = objectField(flowReport, 'review_fold_ins');
  if (foldIns === undefined) return [];

  const details: string[] = [];
  const objections = stringArrayField(foldIns, 'objections');
  const missedAngles = stringArrayField(foldIns, 'missed_angles');
  details.push('Reviewer: Accepted the direction, with notes to fold in.');
  for (const objection of objections) details.push(`Follow-up: ${objection}`);
  for (const angle of missedAngles) details.push(`Follow-up: ${angle}`);
  return details;
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

function checkpointOptionDetails(runFolder: string, allowedChoices: readonly string[]): string[] {
  const optionsReport = readJsonIfPresent(runFolder, 'reports/decision-options.json');
  const labelsById = new Map<string, string>();
  for (const option of arrayField(optionsReport, 'options')) {
    if (!isObject(option)) continue;
    const id = stringField(option, 'id');
    const label = stringField(option, 'label');
    if (id === undefined || label === undefined) continue;
    labelsById.set(id, label);
  }
  return allowedChoices.flatMap((choice) => {
    const label = labelsById.get(choice);
    return label === undefined ? [] : [`${label} (${choice})`];
  });
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

function friendlyReviewStatus(status: string): string {
  if (status === 'accept') return 'accepted';
  if (status === 'accept-with-fixes') return 'requested follow-up fixes';
  if (status === 'accept-with-fold-ins') return 'accepted with follow-up notes';
  if (status === 'release-approved') return 'approved for release';
  return status;
}

function friendlyVerificationStatus(status: string): string {
  if (status === 'passed') return 'passed';
  if (status === 'failed') return 'failed';
  return status;
}

function flowHeadline(input: {
  readonly runFolder: string;
  readonly flowId: string;
  readonly resultSummary: string;
  readonly flowReport: JsonObject | undefined;
}): string {
  const { flowId, flowReport, resultSummary, runFolder } = input;
  if (flowId === 'review') {
    const verdict = stringField(flowReport, 'verdict') ?? 'review complete';
    const findings = arrayField(flowReport, 'findings').length;
    return `Circuit: Review complete. Verdict: ${verdict}. Findings: ${findings}.`;
  }
  if (flowId === 'build') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
    const review = stringField(flowReport, 'review_verdict') ?? 'unknown';
    if (outcome === 'complete' && verification === 'passed' && review === 'accept') {
      return 'Circuit: Build complete. Change implemented, verification passed, review accepted.';
    }
    if (outcome === 'needs_attention' && verification === 'passed') {
      return 'Circuit: Build needs follow-up. Verification passed, but review requested fixes.';
    }
    return `Circuit: Build finished with outcome ${outcome}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`;
  }
  if (flowId === 'fix') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
    const review =
      stringField(flowReport, 'review_verdict') ??
      stringField(flowReport, 'review_status') ??
      'unknown';
    return `Circuit: Fix finished with outcome ${outcome}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`;
  }
  if (flowId === 'migrate') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
    const review = stringField(flowReport, 'review_verdict') ?? 'unknown';
    return `Circuit: Migrate finished with outcome ${outcome}. Verification: ${friendlyVerificationStatus(verification)}. Review: ${friendlyReviewStatus(review)}.`;
  }
  if (flowId === 'explore') {
    const verdictSnapshot = isObject(flowReport?.verdict_snapshot)
      ? flowReport.verdict_snapshot
      : undefined;
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
    return review === 'accept-with-fold-ins'
      ? 'Circuit: Recommendation ready. The direction is useful, with follow-up notes.'
      : 'Circuit: Recommendation ready. The direction is ready to use.';
  }
  if (flowId === 'sweep') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const deferred = numberField(flowReport, 'deferred_count');
    return deferred === undefined
      ? `Circuit: Sweep finished with outcome ${outcome}.`
      : `Circuit: Sweep finished with outcome ${outcome}. Deferred: ${plural(deferred, 'item')}.`;
  }
  return resultSummary;
}

function flowDetails(input: {
  readonly runFolder: string;
  readonly flowId: string;
  readonly flowReport: JsonObject | undefined;
}): string[] {
  const { flowId, flowReport, runFolder } = input;
  const details: string[] = [];
  const summary = stringField(flowReport, 'summary');
  if (summary !== undefined && flowId !== 'explore')
    details.push(`Result: ${friendlyResultSummary(summary)}`);
  if (flowId === 'review') {
    const findings = arrayField(flowReport, 'findings').length;
    details.push(`Findings: ${findings}`);
    details.push(...reviewEvidenceDetails(flowReport));
  }
  if (flowId === 'build' || flowId === 'fix' || flowId === 'migrate') {
    const verification = stringField(flowReport, 'verification_status');
    const review = stringField(flowReport, 'review_verdict');
    if (verification !== undefined)
      details.push(`Verification: ${friendlyVerificationStatus(verification)}.`);
    if (review !== undefined) details.push(`Review: ${friendlyReviewStatus(review)}.`);
  }
  if (flowId === 'explore') {
    details.push(...exploreGuidanceDetails(flowReport));
    details.push(...exploreReviewFoldInDetails(flowReport));
  }
  if (flowId === 'explore' && exploreTournamentSnapshot(flowReport) !== undefined) {
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
  return details;
}

function renderMarkdown(summary: OperatorSummary): string {
  const lines = [summary.headline];

  if (summary.checkpoint !== undefined) {
    lines.push('', '## Checkpoint', '');
    lines.push(`- Step: \`${summary.checkpoint.step_id}\``);
    lines.push(`- Request: ${summary.checkpoint.request_path}`);
    lines.push(`- Choices: ${summary.checkpoint.allowed_choices.join(', ')}`);
  }

  const visibleDetails = summary.details.filter((detail) => !detail.startsWith('Run note:'));
  if (visibleDetails.length > 0) {
    lines.push('');
    for (const detail of visibleDetails) lines.push(`- ${detail}`);
  }

  if (summary.evidence_warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of summary.evidence_warnings) {
      const path = warning.path === undefined ? '' : ` (${warning.path})`;
      lines.push(`- ${warning.kind}${path}: ${warning.message}`);
    }
  }

  const htmlLink = summary.report_paths.find(
    (report) => report.label === 'Operator summary (HTML)',
  );
  if (htmlLink !== undefined) {
    lines.push('', `Rich summary: ${htmlLink.path}`);
  }

  return `${lines.join('\n')}\n`;
}

export function writeOperatorSummary(input: {
  readonly runFolder: string;
  readonly runResult: OperatorSummaryRunResult;
  readonly route: RouteSummary;
}): OperatorSummaryWriteResult {
  const flowId = input.runResult.flow_id as unknown as string;
  const flowResultRelPath = FLOW_RESULT_PATHS[flowId];
  const flowReport =
    flowResultRelPath === undefined
      ? undefined
      : readJsonIfPresent(input.runFolder, flowResultRelPath);
  const resultRelPath = RUN_RESULT_RELATIVE_PATH;
  const resultPath =
    input.runResult.outcome === 'checkpoint_waiting'
      ? undefined
      : resolveRunRelative(input.runFolder, resultRelPath);

  const htmlPayload =
    flowId === 'explore' ? exploreTournamentHtmlPayload(input.runFolder, flowReport) : undefined;
  const outHtmlPath = htmlPayload === undefined ? undefined : htmlPath(input.runFolder);

  const reportPaths: OperatorSummaryReportLink[] = [];
  if (resultPath !== undefined)
    reportPaths.push(reportLink(input.runFolder, 'Run result', resultRelPath));
  if (flowResultRelPath !== undefined && flowReport !== undefined) {
    reportPaths.push(reportLink(input.runFolder, `${flowId} result`, flowResultRelPath));
  }
  if (outHtmlPath !== undefined) {
    reportPaths.push({ label: 'Operator summary (HTML)', path: outHtmlPath });
  }
  if (input.runResult.outcome === 'checkpoint_waiting') {
    const checkpoint = input.runResult.checkpoint;
    reportPaths.push({
      label: 'Checkpoint request',
      path: checkpoint.request_path,
    });
  }
  reportPaths.push(...evidenceLinks(input.runFolder, flowReport));

  const details = [
    ...(flowMayInvokeWriteCapableWorker(flowId)
      ? [`Worker access: ${WRITE_CAPABLE_WORKER_DISCLOSURE}`]
      : []),
    ...(flowId === 'explore'
      ? []
      : [`Run note: ${friendlyRunNote(flowId, input.runResult.summary)}`]),
    ...flowDetails({ runFolder: input.runFolder, flowId, flowReport }),
  ];
  if (input.runResult.outcome === 'checkpoint_waiting') {
    const checkpoint = input.runResult.checkpoint;
    const optionDetails = checkpointOptionDetails(input.runFolder, checkpoint.allowed_choices);
    if (optionDetails.length > 0) details.push(`Checkpoint options: ${optionDetails.join('; ')}`);
  }
  if (input.runResult.outcome === 'aborted' && input.runResult.reason !== undefined) {
    details.push(`Abort reason: ${input.runResult.reason}`);
  }

  const candidate = OperatorSummary.parse({
    schema_version: 1,
    run_id: input.runResult.run_id,
    flow_id: input.runResult.flow_id,
    selected_flow: input.route.selectedFlow,
    ...(input.route.routedBy === undefined ? {} : { routed_by: input.route.routedBy }),
    ...(input.route.routerReason === undefined ? {} : { router_reason: input.route.routerReason }),
    outcome: input.runResult.outcome,
    headline:
      input.runResult.outcome === 'checkpoint_waiting'
        ? 'Circuit: Waiting for a checkpoint choice.'
        : input.runResult.outcome === 'aborted'
          ? 'Circuit: Run aborted.'
          : flowHeadline({
              runFolder: input.runFolder,
              flowId,
              flowReport,
              resultSummary: input.runResult.summary,
            }),
    details,
    evidence_warnings: warningRecords(flowReport),
    run_folder: input.runFolder,
    ...(resultPath === undefined ? {} : { result_path: resultPath }),
    report_paths: reportPaths,
    ...(input.runResult.outcome === 'checkpoint_waiting'
      ? { checkpoint: input.runResult.checkpoint }
      : {}),
  });

  const outJsonPath = jsonPath(input.runFolder);
  const outMarkdownPath = markdownPath(input.runFolder);
  mkdirSync(dirname(outJsonPath), { recursive: true });
  writeFileSync(outJsonPath, `${JSON.stringify(candidate, null, 2)}\n`);
  writeFileSync(outMarkdownPath, renderMarkdown(candidate));

  if (htmlPayload !== undefined && outHtmlPath !== undefined) {
    const html = renderExploreTournamentHTML({
      runId: input.runResult.run_id as unknown as string,
      flowId,
      decisionOptions: htmlPayload.decisionOptions,
      tournamentReview: htmlPayload.tournamentReview,
      ...(htmlPayload.decision === undefined ? {} : { decision: htmlPayload.decision }),
    });
    writeFileSync(outHtmlPath, html);
    return {
      summary: candidate,
      jsonPath: outJsonPath,
      markdownPath: outMarkdownPath,
      htmlPath: outHtmlPath,
    };
  }

  return { summary: candidate, jsonPath: outJsonPath, markdownPath: outMarkdownPath };
}
