// Prompt mutation: given an existing review.request.json text and a
// mutated compose JSON, produce a new prompt with the compose section
// replaced. The review.request.json files are plain text with sections
// delimited by '--- reports/<name>.json ---' headers.
//
// The eval also upgrades the shape-hint instruction at the end of the
// captured prompt to whatever the current exploreReviewVerdictShapeHint
// emits. Without that upgrade, the eval would freeze whichever prompt
// shape was in effect when the historical run was captured, so prompt
// improvements would never show up in catch-rate measurements.

import { exploreReviewVerdictShapeHint } from '../../dist/flows/explore/relay-hints.js';
import type { ComposeJsonShape } from './types.ts';

const COMPOSE_HEADER = '--- reports/compose.json ---';
const SHAPE_HINT_OPENING =
  'Respond with a single raw JSON object whose top-level shape is exactly:';

export interface ParsedRequest {
  readonly originalCompose: ComposeJsonShape;
  readonly preCompose: string;
  readonly postCompose: string;
}

export function parseRequest(requestText: string): ParsedRequest {
  const headerIndex = requestText.indexOf(COMPOSE_HEADER);
  if (headerIndex === -1) {
    throw new Error(`compose header '${COMPOSE_HEADER}' not found in request`);
  }
  const afterHeader = headerIndex + COMPOSE_HEADER.length;
  const newlineAfterHeader = requestText.indexOf('\n', afterHeader);
  if (newlineAfterHeader === -1) {
    throw new Error('no newline after compose header');
  }
  const composeStart = newlineAfterHeader + 1;
  // The compose JSON ends at the next blank-line + non-blank-line boundary
  // followed by either another '--- ' header or the trailing prompt body.
  // We rely on the JSON being a single top-level object: scan for the
  // matching closing brace.
  const closeBrace = findMatchingClosingBrace(requestText, composeStart);
  if (closeBrace === -1) {
    throw new Error('could not find closing brace for compose JSON');
  }
  const composeJson = requestText.slice(composeStart, closeBrace + 1);
  let originalCompose: ComposeJsonShape;
  try {
    originalCompose = JSON.parse(composeJson) as ComposeJsonShape;
  } catch (err) {
    throw new Error(`compose JSON parse failed: ${(err as Error).message}`);
  }
  return {
    originalCompose,
    preCompose: requestText.slice(0, composeStart),
    postCompose: requestText.slice(closeBrace + 1),
  };
}

export function rebuildRequest(parsed: ParsedRequest, mutated: ComposeJsonShape): string {
  const mutatedJson = JSON.stringify(mutated, null, 2);
  const upgradedPostCompose = upgradeShapeHintInstruction(parsed.postCompose);
  return `${parsed.preCompose}${mutatedJson}${upgradedPostCompose}`;
}

// Replace the shape-hint instruction in a captured request with the
// current exploreReviewVerdictShapeHint.instruction text so the eval
// always tests the production prompt, not a frozen historical version.
//
// The shape hint is the trailing instruction block that opens with
// SHAPE_HINT_OPENING ("Respond with a single raw JSON object…") and
// runs to end-of-string. We detect that anchor, slice everything
// before it (preserving leading whitespace and any prior sections),
// and append the current instruction text.
//
// Exported for use by buildControlPrompt below; not part of the public
// rebuildRequest contract.
export function upgradeShapeHintInstruction(text: string): string {
  const idx = text.indexOf(SHAPE_HINT_OPENING);
  if (idx === -1) return text;
  const prefix = text.slice(0, idx);
  return `${prefix}${exploreReviewVerdictShapeHint.instruction}\n`;
}

function findMatchingClosingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === undefined) break;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
