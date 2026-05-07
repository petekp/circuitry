// Operator summary projection.
//
// This file turns run outputs into a concise human-facing summary. Treat it
// as a lossy projection over result reports and traces, not as an authority for
// runtime state or report schemas.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  OperatorSummary,
  type OperatorSummaryReportLink,
  type OperatorSummaryWarning,
} from '../schemas/operator-summary.js';
import type { RunResult } from '../schemas/result.js';
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
    return `Circuit completed ${match[2]} ${capitalized(flowId)} steps for this goal.`;
  }
  return summary;
}

function friendlyResultSummary(summary: string): string {
  return summary.replace(/^(?:Build|Fix|Migrate|Review|Explore|Sweep) result for .+?:\s*/, '');
}

function sentence(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
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
    return `Circuit finished Review. Verdict: ${verdict}. Findings: ${findings}.`;
  }
  if (flowId === 'build') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
    const review = stringField(flowReport, 'review_verdict') ?? 'unknown';
    if (outcome === 'complete' && verification === 'passed' && review === 'accept') {
      return 'Circuit finished Build. The change was implemented, verification passed, and review accepted it.';
    }
    if (outcome === 'needs_attention' && verification === 'passed') {
      return 'Circuit finished Build. Verification passed, but review requested follow-up fixes.';
    }
    return `Circuit finished Build with outcome ${outcome}. Verification: ${verification}. Review: ${review}.`;
  }
  if (flowId === 'fix') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
    const review =
      stringField(flowReport, 'review_verdict') ??
      stringField(flowReport, 'review_status') ??
      'unknown';
    return `Circuit finished Fix with outcome ${outcome}. Verification: ${verification}. Review: ${review}.`;
  }
  if (flowId === 'migrate') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const verification = stringField(flowReport, 'verification_status') ?? 'unknown';
    const review = stringField(flowReport, 'review_verdict') ?? 'unknown';
    return `Circuit finished Migrate with outcome ${outcome}. Verification: ${verification}. Review: ${review}.`;
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
      return `Circuit finished Explore decision. Selected: ${selected}. ${sentence(decision)}`;
    }
    const review = stringField(verdictSnapshot, 'review_verdict') ?? 'complete';
    const summary = stringField(flowReport, 'summary') ?? resultSummary;
    return `Circuit finished Explore. Review: ${review}. ${summary}`;
  }
  if (flowId === 'sweep') {
    const outcome = stringField(flowReport, 'outcome') ?? 'complete';
    const deferred = numberField(flowReport, 'deferred_count');
    return deferred === undefined
      ? `Circuit finished Sweep with outcome ${outcome}.`
      : `Circuit finished Sweep with outcome ${outcome}. Deferred: ${plural(deferred, 'item')}.`;
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
  if (summary !== undefined) details.push(`Result: ${friendlyResultSummary(summary)}`);
  if (flowId === 'review') {
    const findings = arrayField(flowReport, 'findings').length;
    details.push(`Findings: ${findings}`);
    details.push(...reviewEvidenceDetails(flowReport));
  }
  if (flowId === 'build' || flowId === 'fix' || flowId === 'migrate') {
    const verification = stringField(flowReport, 'verification_status');
    const review = stringField(flowReport, 'review_verdict');
    if (verification !== undefined) details.push(`Verification: ${verification}`);
    if (review !== undefined) details.push(`Review verdict: ${review}`);
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
  const lines = [
    '# Circuit Summary',
    '',
    summary.headline,
    '',
    '## What Happened',
    '',
    `- Selected flow: \`${summary.selected_flow}\``,
    `- Outcome: \`${summary.outcome}\``,
  ];
  if (summary.routed_by !== undefined) lines.push(`- Routed by: \`${summary.routed_by}\``);
  if (summary.router_reason !== undefined) lines.push(`- Router reason: ${summary.router_reason}`);

  if (summary.checkpoint !== undefined) {
    lines.push('', '## Checkpoint', '');
    lines.push(`- Step: \`${summary.checkpoint.step_id}\``);
    lines.push(`- Request: ${summary.checkpoint.request_path}`);
    lines.push(`- Choices: ${summary.checkpoint.allowed_choices.join(', ')}`);
  }

  if (summary.details.length > 0) {
    lines.push('', '## Details', '');
    for (const detail of summary.details) lines.push(`- ${detail}`);
  }

  lines.push('', '## Evidence Warnings', '');
  if (summary.evidence_warnings.length === 0) {
    lines.push('- None');
  } else {
    for (const warning of summary.evidence_warnings) {
      const path = warning.path === undefined ? '' : ` (${warning.path})`;
      lines.push(`- ${warning.kind}${path}: ${warning.message}`);
    }
  }

  lines.push('', '## Run Files', '');
  lines.push(`- Run folder: ${summary.run_folder}`);
  if (summary.result_path !== undefined) lines.push(`- Result path: ${summary.result_path}`);

  lines.push('', '## Reports', '');
  for (const report of summary.report_paths) {
    const schema = report.schema === undefined ? '' : ` — ${report.schema}`;
    lines.push(`- ${report.label}: ${report.path}${schema}`);
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

  const reportPaths: OperatorSummaryReportLink[] = [];
  if (resultPath !== undefined)
    reportPaths.push(reportLink(input.runFolder, 'Run result', resultRelPath));
  if (flowResultRelPath !== undefined && flowReport !== undefined) {
    reportPaths.push(reportLink(input.runFolder, `${flowId} result`, flowResultRelPath));
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
    `Run note: ${friendlyRunNote(flowId, input.runResult.summary)}`,
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
        ? 'Circuit is waiting for a checkpoint choice.'
        : input.runResult.outcome === 'aborted'
          ? 'Circuit run aborted.'
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
  return { summary: candidate, jsonPath: outJsonPath, markdownPath: outMarkdownPath };
}
