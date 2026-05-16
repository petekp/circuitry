// Operator summary projection — orchestration layer.
//
// This file orchestrates the operator-summary write:
//   - Resolves the per-flow result report path and runs the flow's projection
//     through SUMMARY_PROJECTORS in operator-summary/projections.ts.
//   - Drives HTML emission through HTML_PROJECTORS in shared/html/.
//   - Overlays cross-flow concerns on top of the projection: worker
//     disclosure, run note, evidence warnings, abort reason, checkpoint
//     detail, and the report_paths artifact list.
//   - Builds the OperatorSummary schema, writes JSON + markdown + HTML.
//
// Per-flow projection logic lives in src/shared/operator-summary/. Schema-
// loose JSON helpers and friendly-* text projections live there too.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  OperatorSummary,
  type OperatorSummaryReportLink,
  type OperatorSummaryWarning,
} from '../schemas/operator-summary.js';
import type { RunResult } from '../schemas/result.js';
import { HTML_PROJECTORS, type HtmlProjectorContext } from './html/index.js';
import {
  type JsonObject,
  arrayField,
  evidenceReportById,
  friendlyRunNote,
  isObject,
  projectSummary,
  readJsonIfPresent,
  stringField,
} from './operator-summary/index.js';
import { statusTextFromHeadline } from './progress-output.js';
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

// On resume, the CLI has the flow id but no longer has the original
// `routedBy` / `routerReason` (those came from the route classifier on
// the initial run). Recover them from the previously-written operator
// summary so a resume rewrite does not strip routing metadata that the
// initial close site captured.
export function readPriorRoute(runFolder: string): {
  readonly routedBy?: 'explicit' | 'classifier';
  readonly routerReason?: string;
} {
  const path = join(runFolder, 'reports', 'operator-summary.json');
  if (!existsSync(path)) return {};
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!isObject(raw)) return {};
    const routedBy = raw.routed_by;
    const routerReason = raw.router_reason;
    return {
      ...(routedBy === 'explicit' || routedBy === 'classifier' ? { routedBy } : {}),
      ...(typeof routerReason === 'string' && routerReason.length > 0 ? { routerReason } : {}),
    };
  } catch {
    return {};
  }
}

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

const FLOW_RESULT_PATHS: Record<string, string> = {
  build: 'reports/build-result.json',
  explore: 'reports/explore-result.json',
  fix: 'reports/fix-result.json',
  pursue: 'reports/pursuit-result.json',
  review: 'reports/review-result.json',
};

// Label used when listing the HTML artifact in report_paths. Not load-bearing
// for control flow — markdown rendering and CLI plumbing read summary.html_path
// directly. Kept as a friendly label for the artifact list.
const HTML_REPORT_LABEL = 'Operator summary (HTML)' as const;

function jsonPath(runFolder: string): string {
  return join(runFolder, 'reports', 'operator-summary.json');
}

function markdownPath(runFolder: string): string {
  return join(runFolder, 'reports', 'operator-summary.md');
}

function htmlPath(runFolder: string): string {
  return join(runFolder, 'reports', 'operator-summary.html');
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
    try {
      return [reportLink(runFolder, reportId, path, stringField(item, 'schema'))];
    } catch {
      // A malformed evidence_links[].path (traversal, absolute, symlink-cross)
      // would otherwise throw inside resolveRunRelative and abort the close.
      // Drop the link instead — the operator summary stays whole, with the
      // bad link silently omitted.
      return [];
    }
  });
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

function renderMarkdown(summary: OperatorSummary): string {
  const lines = ['Circuit', `⎿ ${summary.status_text ?? statusTextFromHeadline(summary.headline)}`];

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

  if (summary.html_path !== undefined) {
    lines.push('', `Rich summary: ${summary.html_path}`);
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

  const outJsonPath = jsonPath(input.runFolder);
  const outMarkdownPath = markdownPath(input.runFolder);
  mkdirSync(dirname(outJsonPath), { recursive: true });

  // Write HTML first so JSON+markdown only promise a path that actually
  // exists on disk. Failure here degrades to a markdown-only summary; it
  // must not abort the run or break the JSON/MD siblings.
  const projector = HTML_PROJECTORS[flowId];
  const candidateHtmlPath = htmlPath(input.runFolder);
  let outHtmlPath: string | undefined;
  let htmlEmitWarning: OperatorSummaryWarning | undefined;
  let renderedHtml: string | undefined;
  if (projector !== undefined) {
    try {
      const ctx: HtmlProjectorContext = {
        runFolder: input.runFolder,
        runId: input.runResult.run_id as unknown as string,
        flowId,
        flowReport,
        readJsonRunRelative: (relPath) => readJsonIfPresent(input.runFolder, relPath),
        readEvidenceReportById: (reportId) =>
          evidenceReportById(input.runFolder, flowReport, reportId),
      };
      renderedHtml = projector(ctx);
    } catch (err) {
      htmlEmitWarning = {
        kind: 'html_render_failed',
        message: err instanceof Error ? err.message : String(err),
        path: candidateHtmlPath,
      };
    }
  }
  if (renderedHtml === undefined) {
    // Stale-cleanup: a resume whose projector returned undefined (or that
    // has no projector at all) must not leave the previous run's HTML
    // behind. The operator may have bookmarked or scrolled to that path
    // and would otherwise open stale content silently.
    if (existsSync(candidateHtmlPath)) rmSync(candidateHtmlPath, { force: true, recursive: true });
  } else {
    try {
      writeFileSync(candidateHtmlPath, renderedHtml);
      outHtmlPath = candidateHtmlPath;
    } catch (err) {
      // writeFileSync may have left a partial file behind. Remove it so
      // neither the envelope nor any reader points at a half-written
      // artifact, and surface the failure as a warning the operator can
      // see in the markdown summary.
      if (existsSync(candidateHtmlPath))
        rmSync(candidateHtmlPath, { force: true, recursive: true });
      htmlEmitWarning = {
        kind: 'html_write_failed',
        message: err instanceof Error ? err.message : String(err),
        path: candidateHtmlPath,
      };
    }
  }

  const reportPaths: OperatorSummaryReportLink[] = [];
  if (resultPath !== undefined)
    reportPaths.push(reportLink(input.runFolder, 'Run result', resultRelPath));
  if (flowResultRelPath !== undefined && flowReport !== undefined) {
    reportPaths.push(reportLink(input.runFolder, `${flowId} result`, flowResultRelPath));
  }
  if (outHtmlPath !== undefined) {
    reportPaths.push({ label: HTML_REPORT_LABEL, path: outHtmlPath });
  }
  if (input.runResult.outcome === 'checkpoint_waiting') {
    const checkpoint = input.runResult.checkpoint;
    reportPaths.push({
      label: 'Checkpoint request',
      path: checkpoint.request_path,
    });
  }
  reportPaths.push(...evidenceLinks(input.runFolder, flowReport));

  // Compute headline + per-flow details via the registry, then overlay shared
  // concerns: worker disclosure, run note framing, abort reason, checkpoint
  // option detail, and the special-case checkpoint_waiting / aborted headlines.
  const projection = projectSummary({
    runFolder: input.runFolder,
    flowId,
    flowReport,
    resultSummary: input.runResult.summary,
    runOutcome: input.runResult.outcome,
  });

  const details = [
    ...(flowMayInvokeWriteCapableWorker(flowId)
      ? [`Worker access: ${WRITE_CAPABLE_WORKER_DISCLOSURE}`]
      : []),
    ...(flowId === 'explore'
      ? []
      : [`Run note: ${friendlyRunNote(flowId, input.runResult.summary)}`]),
    ...projection.details,
  ];
  if (input.runResult.outcome === 'checkpoint_waiting') {
    const checkpoint = input.runResult.checkpoint;
    const optionDetails = checkpointOptionDetails(input.runFolder, checkpoint.allowed_choices);
    if (optionDetails.length > 0) details.push(`Checkpoint options: ${optionDetails.join('; ')}`);
  }
  if (input.runResult.outcome === 'aborted' && input.runResult.reason !== undefined) {
    details.push(`Abort reason: ${input.runResult.reason}`);
  }

  const headline =
    input.runResult.outcome === 'checkpoint_waiting'
      ? 'Circuit: Waiting for a checkpoint choice.'
      : input.runResult.outcome === 'aborted'
        ? 'Circuit: Run aborted.'
        : projection.headline;

  const candidate = OperatorSummary.parse({
    schema_version: 1,
    run_id: input.runResult.run_id,
    flow_id: input.runResult.flow_id,
    selected_flow: input.route.selectedFlow,
    ...(input.route.routedBy === undefined ? {} : { routed_by: input.route.routedBy }),
    ...(input.route.routerReason === undefined ? {} : { router_reason: input.route.routerReason }),
    outcome: input.runResult.outcome,
    headline,
    status_text: statusTextFromHeadline(headline),
    details,
    evidence_warnings: [
      ...warningRecords(flowReport),
      ...(htmlEmitWarning === undefined ? [] : [htmlEmitWarning]),
    ],
    run_folder: input.runFolder,
    ...(resultPath === undefined ? {} : { result_path: resultPath }),
    ...(outHtmlPath === undefined ? {} : { html_path: outHtmlPath }),
    report_paths: reportPaths,
    ...(input.runResult.outcome === 'checkpoint_waiting'
      ? { checkpoint: input.runResult.checkpoint }
      : {}),
  });

  writeFileSync(outJsonPath, `${JSON.stringify(candidate, null, 2)}\n`);
  writeFileSync(outMarkdownPath, renderMarkdown(candidate));

  return outHtmlPath === undefined
    ? { summary: candidate, jsonPath: outJsonPath, markdownPath: outMarkdownPath }
    : {
        summary: candidate,
        jsonPath: outJsonPath,
        markdownPath: outMarkdownPath,
        htmlPath: outHtmlPath,
      };
}
