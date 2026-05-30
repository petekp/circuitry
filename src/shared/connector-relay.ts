import type { ResolvedSelection } from '../schemas/selection-policy.js';
export { sha256OfString as sha256Hex } from '../schemas/hashing.js';

// Shared relay-result shape produced by connector subprocess implementations.
// Materializers and runtime executors consume this shape without branching on the
// connector that produced it.
export interface RelayResult {
  readonly request_payload: string;
  readonly receipt_id: string;
  readonly result_body: string;
  readonly duration_ms: number;
  readonly cli_version: string;
}

export interface ConnectorRelayInput {
  prompt: string;
  timeoutMs?: number;
  cwd?: string;
  resolvedSelection?: ResolvedSelection;
  // JSON Schema (draft-07) describing the worker's final response shape.
  // Connectors that support a native structured-output flag (claude-code's
  // `--json-schema`, codex's `--output-schema`) pass this through. Custom
  // connectors and any connector that does not yet honor it fall back to
  // the prose shape hint already in the prompt.
  responseSchema?: Record<string, unknown>;
}
