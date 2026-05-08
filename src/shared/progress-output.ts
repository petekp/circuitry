import type {
  ProgressDisplay,
  ProgressEvent,
  ProgressPresentation,
} from '../schemas/progress-event.js';
import type { ProgressReporter } from './relay-runtime-types.js';

const MAX_PROGRESS_DISPLAY_TEXT_CHARS = 240;
const MAX_PROGRESS_STATUS_TEXT_CHARS = 180;

export function reportProgress(progress: ProgressReporter | undefined, event: ProgressEvent): void {
  if (progress === undefined) return;
  try {
    progress(event);
  } catch {
    // Progress is a host-facing side channel. A broken renderer must not
    // corrupt the run or change terminal behavior.
  }
}

export function progressDisplay(
  text: string,
  importance: ProgressDisplay['importance'],
  tone: ProgressDisplay['tone'],
): ProgressDisplay {
  if (text.length <= MAX_PROGRESS_DISPLAY_TEXT_CHARS) return { text, importance, tone };
  return {
    text: `${text.slice(0, MAX_PROGRESS_DISPLAY_TEXT_CHARS - 14)} [truncated]`,
    importance,
    tone,
  };
}

function normalizeStatusText(text: string): string {
  const withoutChrome = text
    .replace(/^Circuit:\s*/i, '')
    .replace(/^⎿\s*/, '')
    .trim();
  if (withoutChrome.length <= MAX_PROGRESS_STATUS_TEXT_CHARS) return withoutChrome;
  return `${withoutChrome.slice(0, MAX_PROGRESS_STATUS_TEXT_CHARS - 14)} [truncated]`;
}

export function progressPresentation(input: {
  readonly blockId: string;
  readonly lineMode?: ProgressPresentation['line_mode'];
  readonly slotId?: string;
  readonly statusText?: string;
  readonly depth?: number;
}): ProgressPresentation {
  const lineMode = input.lineMode ?? 'append';
  return {
    block_id: input.blockId,
    line_mode: lineMode,
    ...(input.slotId === undefined ? {} : { slot_id: input.slotId }),
    ...(input.statusText === undefined
      ? {}
      : { status_text: normalizeStatusText(input.statusText) }),
    ...(input.depth === undefined ? {} : { depth: input.depth }),
  };
}
