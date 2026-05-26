import {
  HISTORY_AUTHORITY_NOTICE,
  type HistoryRecallReportV1 as HistoryRecallReport,
  HistoryRecallReportV1,
  type HistoryWarningV1,
} from '../schemas/index.js';
import { HistoryCommandError } from './indexer.js';
import { historyMemoryInputPreview } from './memory-preview.js';
import { queryHistory } from './query.js';

export const HISTORY_RECALL_REPORT_PATH = 'reports/history/recall.json';
const DEFAULT_RECALL_LIMIT = 3;

export interface RunStartHistoryRecallOptions {
  readonly repoRoot: string;
  readonly query: string;
  readonly maxMemoryInputs?: number;
  readonly now?: () => Date;
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
): HistoryRecallReport {
  const maxMemoryInputs = options.maxMemoryInputs ?? DEFAULT_RECALL_LIMIT;
  try {
    const result = queryHistory({
      repoRoot: options.repoRoot,
      query: options.query,
      limit: Math.max(maxMemoryInputs * 2, maxMemoryInputs),
      perRunLimit: 1,
      rebuildIfStale: true,
      ...(options.now === undefined ? {} : { now: options.now }),
    });
    const preview = historyMemoryInputPreview({
      query: result.query,
      indexState: result.index_state,
      rebuilt: result.rebuilt,
      warnings: result.warnings,
      hits: result.results,
      capturedAt: (options.now ?? (() => new Date()))().toISOString(),
    });
    return capReport({
      report: HistoryRecallReportV1.parse({
        api_version: 'history-recall-report-v1',
        schema_version: 1,
        status: preview.memory_inputs.length === 0 ? 'empty' : 'used',
        query: preview.query,
        index_state: preview.index_state,
        rebuilt: preview.rebuilt,
        authority_notice: preview.authority_notice,
        memory_input_count: preview.memory_inputs.length,
        memory_inputs: preview.memory_inputs,
        matches: preview.matches,
        warnings: preview.warnings,
      }),
      maxMemoryInputs,
    });
  } catch (error) {
    return HistoryRecallReportV1.parse({
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
  }
}
