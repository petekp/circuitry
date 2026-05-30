import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type HistoryMemoryEffectV1 as HistoryMemoryEffect,
  HistoryMemoryEffectV1,
  type HistoryWarningV1,
} from '../../schemas/index.js';
import { HISTORY_MEMORY_EFFECT_FILE, type HistoryPaths } from './indexer.js';

export interface LoadMemoryEffectResult {
  readonly report?: HistoryMemoryEffect;
  readonly warnings: readonly HistoryWarningV1[];
}

// Read <index-dir>/memory-effect.v1.json if present and parseable. This is the
// read-only consumer of Slice 2's verdicts for the Slice 3 push gate and the
// Slice 4 pull suppression. It NEVER builds the report (the report is produced by
// `circuit history memory-effect --write`); a missing or unreadable file is the
// fail-open case — it returns no report plus an effect_report_unavailable warning,
// so the gate degrades to today's behavior rather than blanking memory.
export function loadMemoryEffectReport(paths: HistoryPaths): LoadMemoryEffectResult {
  const effectPath = join(paths.indexDir, HISTORY_MEMORY_EFFECT_FILE);
  if (!existsSync(effectPath)) {
    return {
      warnings: [
        {
          code: 'effect_report_unavailable',
          message:
            'no memory-effect report found; earned-precision runs fail-open (no measured suppression)',
          source_path: HISTORY_MEMORY_EFFECT_FILE,
        },
      ],
    };
  }
  try {
    const report = HistoryMemoryEffectV1.parse(JSON.parse(readFileSync(effectPath, 'utf8')));
    return { report, warnings: [] };
  } catch (error) {
    return {
      warnings: [
        {
          code: 'effect_report_unavailable',
          message: `memory-effect report unreadable: ${error instanceof Error ? error.message : String(error)}; earned-precision runs fail-open`,
          source_path: HISTORY_MEMORY_EFFECT_FILE,
        },
      ],
    };
  }
}
