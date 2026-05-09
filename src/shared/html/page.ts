// Shared HTML page primitives used by every flow projector.
//
// Centralizes HTML escaping, Unicode sanitization, length caps, and the
// page chrome (CSS tokens, document shell, clipboard script). Flow-specific
// projectors compose primitives from html/components.ts on top of this.

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Strip C0 controls (except \t \n \r), bidi overrides, and bidi isolates.
// These survive Zod string validation but distort visual rendering: a
// U+202E in an option label flips subsequent text right-to-left, which
// could deceive an operator about which option they are picking.
// Pattern is built from char-code ranges to keep this source file free of
// literal control characters.
function buildSanitizePattern(): RegExp {
  const ranges: ReadonlyArray<readonly [number, number]> = [
    [0x00, 0x08],
    [0x0b, 0x0c],
    [0x0e, 0x1f],
    [0x202a, 0x202e],
    [0x2066, 0x2069],
  ];
  const klass = ranges
    .map(([lo, hi]) => {
      const loEsc = `\\u${lo.toString(16).padStart(4, '0')}`;
      const hiEsc = `\\u${hi.toString(16).padStart(4, '0')}`;
      return `${loEsc}-${hiEsc}`;
    })
    .join('');
  return new RegExp(`[${klass}]`, 'g');
}

const SANITIZE_PATTERN = buildSanitizePattern();

export const MAX_BULLET_LEN = 4096;
export const MAX_PROMPT_LEN = 32_768;

// Strip dangerous-but-validation-passing characters before HTML escaping.
// Separated from escapeHtml so each step is named for what it does — and so
// callers that compose primitives (e.g. building HTML fragments by hand) can
// invoke just the sanitizer if they need to.
export function sanitizeForRender(value: string): string {
  return value.replace(SANITIZE_PATTERN, '');
}

function escapeHtmlChars(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char);
}

// Escape operator-controlled text for safe insertion into HTML body or
// attribute contexts. Composes sanitizeForRender + the 5-char escape map;
// the 5-char map covers both contexts because we always quote attributes
// with double quotes.
export function escapeHtml(value: string): string {
  return escapeHtmlChars(sanitizeForRender(value));
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function styles(): string {
  return `:root{--bg:#fafaf9;--surface:#fff;--surface-2:#f5f5f4;--border:#e7e5e4;--border-strong:#d6d3d1;--text:#1c1917;--text-2:#57534e;--text-3:#a8a29e;--accent:#0f172a;--intent-positive:#166534;--intent-positive-soft:#f0fdf4;--intent-info:#1e40af;--intent-info-soft:#eff6ff;--intent-attention:#9a3412;--intent-attention-soft:#fff7ed;--intent-negative:#991b1b;--intent-negative-soft:#fef2f2}@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--surface:#1c1917;--surface-2:#292524;--border:#292524;--border-strong:#44403c;--text:#fafaf9;--text-2:#a8a29e;--text-3:#78716c;--accent:#fafaf9;--intent-positive:#4ade80;--intent-positive-soft:#052e16;--intent-info:#93c5fd;--intent-info-soft:#172554;--intent-attention:#fb923c;--intent-attention-soft:#431407;--intent-negative:#f87171;--intent-negative-soft:#450a0a}}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}.wrap{max-width:1200px;margin:0 auto;padding:48px 32px 96px}header.top{margin-bottom:24px}.meta{font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}h1{font:600 28px/1.25 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;margin:0 0 8px;letter-spacing:-.01em}.subtitle{color:var(--text-2);font-size:16px;margin:0}.verdict{margin:24px 0 32px;padding:16px 20px;background:var(--intent-info-soft);border:1px solid var(--intent-info);border-radius:8px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.verdict.intent-positive{background:var(--intent-positive-soft);border-color:var(--intent-positive)}.verdict.intent-attention{background:var(--intent-attention-soft);border-color:var(--intent-attention)}.verdict.intent-negative{background:var(--intent-negative-soft);border-color:var(--intent-negative)}.verdict .badge{font:600 11px/1 -apple-system,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--intent-info);padding:4px 8px;border:1px solid var(--intent-info);border-radius:4px}.verdict.intent-positive .badge{color:var(--intent-positive);border-color:var(--intent-positive)}.verdict.intent-attention .badge{color:var(--intent-attention);border-color:var(--intent-attention)}.verdict.intent-negative .badge{color:var(--intent-negative);border-color:var(--intent-negative)}.verdict .text{color:var(--text);font-size:14px;flex:1;min-width:200px}.verdict .text strong{font-weight:600}.verdict .confidence{font-size:12px;color:var(--text-2);text-transform:lowercase}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:16px;position:relative}.card.intent-info{border-color:var(--intent-info);box-shadow:0 0 0 3px var(--intent-info-soft)}.card.intent-positive{border-color:var(--intent-positive);box-shadow:0 0 0 3px var(--intent-positive-soft)}.card.intent-attention{border-color:var(--intent-attention);box-shadow:0 0 0 3px var(--intent-attention-soft)}.card.intent-negative{border-color:var(--intent-negative);box-shadow:0 0 0 3px var(--intent-negative-soft)}.card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.card-id{font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace;color:var(--text-3);letter-spacing:.05em}.card h2{font:600 17px/1.3 -apple-system,system-ui,sans-serif;margin:4px 0 0;letter-spacing:-.005em}.intent-badge{font:600 10px/1 -apple-system,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;padding:4px 8px;border-radius:4px;white-space:nowrap;color:var(--intent-info);background:var(--intent-info-soft)}.intent-badge.intent-positive{color:var(--intent-positive);background:var(--intent-positive-soft)}.intent-badge.intent-attention{color:var(--intent-attention);background:var(--intent-attention-soft)}.intent-badge.intent-negative{color:var(--intent-negative);background:var(--intent-negative-soft)}.summary{color:var(--text-2);font-size:14px;margin:0}.section-label{font:600 10px/1 -apple-system,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin:0 0 8px}ul.tradeoffs{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}ul.tradeoffs li{font-size:13px;color:var(--text);padding-left:18px;position:relative;line-height:1.5}ul.tradeoffs li::before{content:"\\2022";position:absolute;left:6px;color:var(--text-3);font-weight:700}.evidence{display:flex;flex-wrap:wrap;gap:6px}.chip{font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace;padding:4px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text-2)}.actions{display:flex;gap:8px;margin-top:auto;padding-top:8px}button.copy{font:500 13px/1 -apple-system,system-ui,sans-serif;padding:8px 12px;border:1px solid var(--border-strong);border-radius:6px;background:var(--surface);color:var(--text);cursor:pointer}button.copy:hover{background:var(--surface-2)}button.copy.primary{background:var(--accent);color:var(--bg);border-color:var(--accent)}button.copy.primary:hover{opacity:.9}details{margin-top:32px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px}details summary{cursor:pointer;font:500 13px/1.4 -apple-system,system-ui,sans-serif;color:var(--text-2);user-select:none}details[open] summary{margin-bottom:12px}details .body{font-size:13px;color:var(--text-2)}details ul{margin:6px 0;padding-left:20px}details li{margin-bottom:4px}footer{margin-top:48px;padding-top:24px;border-top:1px solid var(--border);color:var(--text-3);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}footer code{font:500 11px/1 ui-monospace,"SF Mono",Menlo,monospace}`;
}

function clipboardScript(): string {
  return `document.querySelectorAll('button.copy').forEach(btn=>{btn.addEventListener('click',async()=>{const p=btn.dataset.prompt;if(!p)return;try{await navigator.clipboard.writeText(p);const o=btn.textContent;btn.textContent='Copied';setTimeout(()=>{btn.textContent=o;},1200);}catch(e){btn.textContent='Copy failed';}});});`;
}

export type RenderPageInput = {
  readonly title: string;
  readonly metaLine: string;
  readonly headline: string;
  readonly subtitle: string;
  readonly bodyHtml: string;
  readonly footerLeft?: string;
  readonly footerRight?: string;
};

export function renderPage(input: RenderPageInput): string {
  const footerLeft =
    input.footerLeft === undefined ? '' : `<span>${escapeHtml(input.footerLeft)}</span>`;
  const footerRight =
    input.footerRight === undefined
      ? ''
      : `<span><code>${escapeHtml(input.footerRight)}</code></span>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<style>${styles()}</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="meta">${escapeHtml(input.metaLine)}</div>
    <h1>${escapeHtml(input.headline)}</h1>
    <p class="subtitle">${escapeHtml(input.subtitle)}</p>
  </header>
${input.bodyHtml}
  <footer>
    ${footerLeft}
    ${footerRight}
  </footer>
</div>
<script>${clipboardScript()}</script>
</body>
</html>
`;
}
