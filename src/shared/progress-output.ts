import {
  MAX_DISPLAY_TEXT_CHARS,
  MAX_STATUS_TEXT_CHARS,
  type ProgressDisplay,
  type ProgressEvent,
  type ProgressPresentation,
} from '../schemas/progress-event.js';
import type { ProgressReporter } from './relay-runtime-types.js';

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
  if (text.length <= MAX_DISPLAY_TEXT_CHARS) return { text, importance, tone };
  return {
    text: `${text.slice(0, MAX_DISPLAY_TEXT_CHARS - 14)} [truncated]`,
    importance,
    tone,
  };
}

function truncateStatusText(text: string): string {
  if (text.length <= MAX_STATUS_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_STATUS_TEXT_CHARS - 14)} [truncated]`;
}

// Used at the progress-event boundary: input may already be a status line
// (with or without `Circuit:` / `⎿` chrome). Strips chrome, then truncates.
// Does NOT enforce sentence-final punctuation — that is the caller's concern
// and would risk double-period output if applied here.
function normalizeStatusText(text: string): string {
  const withoutChrome = text
    .replace(/^Circuit:\s*/i, '')
    .replace(/^⎿\s*/, '')
    .trim();
  return truncateStatusText(withoutChrome);
}

// Used when projecting an operator-summary headline (already chrome'd with
// `Circuit:`) into a status_text field. Strips the prefix, ensures sentence-
// final punctuation, then truncates. Co-located with normalizeStatusText so
// the shared cap and the chrome-strip rules stay synchronized.
export function statusTextFromHeadline(headline: string): string {
  const stripped = headline.replace(/^Circuit:\s*/i, '').trim();
  const withSentence = /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
  return truncateStatusText(withSentence);
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
