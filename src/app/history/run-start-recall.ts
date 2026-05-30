import { loadProjectFactCandidates } from '../../memory/project-injection.js';
import {
  HISTORY_AUTHORITY_NOTICE,
  type HistoryRecallPrecisionV1,
  type HistoryRecallReportV1 as HistoryRecallReport,
  HistoryRecallReportV1,
  type HistoryWarningV1,
} from '../../schemas/index.js';
import { HistoryCommandError, resolveHistoryPaths } from './indexer.js';
import { loadMemoryEffectReport } from './memory-effect-read.js';
import { historyMemoryInputPreview } from './memory-preview.js';
import { queryHistory } from './query.js';
import { applyEarnedPrecision } from './recall-precision.js';

export const HISTORY_RECALL_REPORT_PATH = 'reports/history/recall.json';
export const HISTORY_RECALL_PRECISION_PATH = 'reports/history/recall-precision.json';
const DEFAULT_RECALL_LIMIT = 3;

export interface RunStartHistoryRecallOptions {
  readonly repoRoot: string;
  readonly query: string;
  // The selected flow id. Slice 3: narrows recall to this flow (flow-scoped
  // queryHistory) and is the key under which per-(group_key, flow) verdicts are
  // looked up. Undefined keeps goal-lexical recall and disables verdict lookup.
  readonly flowId?: string;
  readonly indexDir?: string;
  readonly maxMemoryInputs?: number;
  readonly now?: () => Date;
}

// Slice 3: the recall path now returns both the (gated) recall report and the
// earned-precision audit sidecar, which is the indicator's guaranteed home.
export interface RunStartHistoryRecallResult {
  readonly report: HistoryRecallReport;
  readonly precision: HistoryRecallPrecisionV1;
}

function unavailableWarning(error: unknown): HistoryWarningV1 {
  const prefix =
    error instanceof HistoryCommandError
      ? `history recall unavailable (${error.code})`
      : 'history recall unavailable';
  return {
    code: 'source_invalid',
    message: `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
  };
}

function capReport(input: {
  readonly report: HistoryRecallReport;
  readonly maxMemoryInputs: number;
}): HistoryRecallReport {
  const memoryInputs = input.report.memory_inputs.slice(0, input.maxMemoryInputs);
  const memoryIds = new Set(memoryInputs.map((memory) => memory.memory_id));
  const matches = input.report.matches.filter((match) => memoryIds.has(match.memory_id));
  return HistoryRecallReportV1.parse({
    ...input.report,
    status: memoryInputs.length === 0 ? 'empty' : 'used',
    memory_input_count: memoryInputs.length,
    memory_inputs: memoryInputs,
    matches,
  });
}

export function prepareRunStartHistoryRecall(
  options: RunStartHistoryRecallOptions,
): RunStartHistoryRecallResult {
  const maxMemoryInputs = options.maxMemoryInputs ?? DEFAULT_RECALL_LIMIT;
  const now = options.now ?? (() => new Date());

  // Load Slice 2's verdicts read-only and fail-open: a missing/unreadable report
  // yields no verdicts plus an effect_report_unavailable warning, never a throw.
  const paths = resolveHistoryPaths({
    repoRoot: options.repoRoot,
    ...(options.indexDir === undefined ? {} : { indexDir: options.indexDir }),
  });
  const effect = loadMemoryEffectReport(paths);

  try {
    const result = queryHistory({
      repoRoot: options.repoRoot,
      query: options.query,
      limit: Math.max(maxMemoryInputs * 2, maxMemoryInputs),
      perRunLimit: 1,
      rebuildIfStale: true,
      // Flow-scoped recall (D5): narrow candidates to the flow about to run.
      ...(options.flowId === undefined ? {} : { flow: options.flowId }),
      ...(options.now === undefined ? {} : { now: options.now }),
    });
    const preview = historyMemoryInputPreview({
      query: result.query,
      indexState: result.index_state,
      rebuilt: result.rebuilt,
      warnings: result.warnings,
      hits: result.results,
      capturedAt: now().toISOString(),
    });

    // Slice 5 (D6): the cited-fact producer's project facts enter the SAME run-
    // start injection door as prior-run recall — loaded for (project, flow),
    // staleness re-verified at injection, then routed through the earned-
    // precision gate below. Prior-run candidates lead (query-ranked); project
    // facts follow, so the gate's stable-rank tie-break keeps recall order. An
    // empty/absent store contributes nothing (fail-open).
    const projectFacts = loadProjectFactCandidates({
      repoRoot: options.repoRoot,
      ...(options.flowId === undefined ? {} : { flowId: options.flowId }),
      now,
    }).candidates;

    // The earned-precision gate runs between the preview and the cap, so the cap
    // applies to the gated set. memoryInputs is the push set (suppressed dropped,
    // ranked by tier, top-budget); precision is the always-written audit sidecar.
    const { memoryInputs, precision } = applyEarnedPrecision({
      candidates: [...preview.memory_inputs, ...projectFacts],
      ...(options.flowId === undefined ? {} : { flowId: options.flowId }),
      ...(effect.report === undefined ? {} : { effect: effect.report }),
      budget: maxMemoryInputs,
      warnings: effect.warnings,
      now,
    });

    const report = capReport({
      report: HistoryRecallReportV1.parse({
        api_version: 'history-recall-report-v1',
        schema_version: 1,
        status: memoryInputs.length === 0 ? 'empty' : 'used',
        query: preview.query,
        index_state: preview.index_state,
        rebuilt: preview.rebuilt,
        authority_notice: preview.authority_notice,
        memory_input_count: memoryInputs.length,
        memory_inputs: memoryInputs,
        matches: preview.matches,
        warnings: preview.warnings,
      }),
      maxMemoryInputs,
    });
    return { report, precision };
  } catch (error) {
    // Recall itself failed (history unavailable). Still emit the sidecar — it is
    // the guaranteed home — with no decisions and the failure surfaced.
    const { precision } = applyEarnedPrecision({
      candidates: [],
      ...(options.flowId === undefined ? {} : { flowId: options.flowId }),
      budget: maxMemoryInputs,
      warnings: [...effect.warnings, unavailableWarning(error)],
      now,
    });
    const report = HistoryRecallReportV1.parse({
      api_version: 'history-recall-report-v1',
      schema_version: 1,
      status: 'unavailable',
      query: options.query,
      rebuilt: false,
      authority_notice: HISTORY_AUTHORITY_NOTICE,
      memory_input_count: 0,
      memory_inputs: [],
      matches: [],
      warnings: [unavailableWarning(error)],
    });
    return { report, precision };
  }
}
