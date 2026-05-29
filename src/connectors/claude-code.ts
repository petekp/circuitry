import { CLAUDE_CODE_SUPPORTED_EFFORTS } from '../schemas/connector.js';
import type { Effort } from '../schemas/selection-policy.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import {
  type ConnectorRelayInput,
  type RelayResult,
  sha256Hex,
} from '../shared/connector-relay.js';
import { extractJsonObject } from '../shared/json-extraction.js';
import {
  type ConnectorSubprocessResult,
  isConnectorSubprocessSpawnError,
  runConnectorSubprocess,
} from './subprocess.js';

export { sha256Hex };

// Real claude-code connector. Invokes the Claude Code CLI as a subprocess of the
// Node.js runtime (subprocess-per-connector at v0). No external SDK
// dependency; Node stdlib only (`node:child_process` + `node:perf_hooks`
// here; `node:crypto` via `../shared/connector-relay.ts` for the shared
// `sha256Hex` helper).
//
// Tool surface: the subprocess receives Claude Code's default tool surface
// — Read, Write, Edit, Bash, Glob, Grep, etc. The runtime check (Zod
// report validation + accepted-verdict allowlist) is the only safety
// net for what the worker produces. MCP servers and slash commands stay
// closed because they can re-introduce arbitrary surfaces the check cannot
// reason about; every other tool is on by default and the worker decides
// what it needs.
//
// Each flag in CLAUDE_CODE_DISPATCH_FLAGS is load-bearing:
//   -p                       — print mode (non-interactive single relay).
//   --permission-mode        — bypassPermissions: the worker can invoke
//   bypassPermissions          its tools without an interactive approval
//                              prompt. The default permission check exists
//                              to checkpoint a human in the loop; in
//                              autonomous relay there is no human to
//                              approve, so the check just deadlocks Edit/
//                              Write/Bash. The runtime check (Zod report
//                              validation + accepted-verdict allowlist) is
//                              the substituted safety net for what the
//                              worker produces.
//   --strict-mcp-config      — empty MCP server list; no remote-write paths
//                              via MCP (Gmail, Notion, Slack, etc.).
//   --disable-slash-commands — zero skill/slash surface; the worker's
//                              behaviour is bounded by its prompt + tools,
//                              not by user-defined skills.
//   --setting-sources ''     — skip user, project, and local settings files.
//                              Prevents operator-configured hooks from
//                              firing inside the connector subprocess (e.g.
//                              this project's Stop hook), which would
//                              otherwise deadlock the subprocess via
//                              hook-feedback retry loops when spawned from
//                              within Circuit.
//   --settings '{}'          — explicit empty inline settings override so
//                              nothing (including keychain reads for stray
//                              settings) reintroduces a hook registration.
//   --output-format stream-json — NDJSON trace_entry stream (one object per
//                              line). The documented `json` format returns
//                              an array in observed behaviour; `stream-json`
//                              is the explicitly documented streaming
//                              protocol and is robust against future
//                              format-shape drift. Requires `--verbose`.
//   --verbose                — required by `--output-format stream-json`.
//   --no-session-persistence — ephemeral session; no resumable session file
//                              written under ~/.claude/projects/** per run.
export const CLAUDE_CODE_DISPATCH_FLAGS = [
  '-p',
  '--permission-mode',
  'bypassPermissions',
  '--strict-mcp-config',
  '--disable-slash-commands',
  '--setting-sources',
  '',
  '--settings',
  '{}',
  '--output-format',
  'stream-json',
  '--verbose',
  '--no-session-persistence',
] as const;

export const CLAUDE_CODE_EXECUTABLE = 'claude';
// Re-exported from the built-in connector registry (the single source of
// truth); kept under this name for the connector's own effort guard and for
// call sites bound to the claude-code connector.
export { CLAUDE_CODE_SUPPORTED_EFFORTS };

// Default wall-clock budget for a single relay. With the open tool
// surface, workers do real file inspection / edits / verification before
// responding, so the default has headroom for that. A step's
// `budgets.wall_clock_ms` (per src/schemas/step.ts StepBase.budgets)
// overrides this when present.
const DEFAULT_TIMEOUT_MS = 600_000;

// Grace period between SIGTERM and SIGKILL. SIGTERM gives the
// subprocess a chance to close cleanly; if it is still alive after this
// window, SIGKILL is delivered and we resolve only after `close`
// actually fires.
const SIGTERM_TO_SIGKILL_GRACE_MS = 2_000;

// stdout / stderr caps. A misbehaving subprocess emitting an unbounded
// byte stream should not exhaust connector memory. Real relay
// transcripts for v0 are well under these bounds (the smoke test
// produces ~30 KB). 16 MiB stdout + 1 MiB stderr is the current ceiling.
const STDOUT_MAX_BYTES = 16 * 1024 * 1024;
const STDERR_MAX_BYTES = 1024 * 1024;

export interface ClaudeCodeRelayInput extends ConnectorRelayInput {}

// The `ClaudeCodeRelayResult` name is kept as the connector-specific
// alias for call sites that want a name bound to the `claude-code` connector's
// producer contract. The shape lives in `../shared/connector-relay.ts`
// `RelayResult` so the `codex` connector produces the same shape and
// the materializer consumes it uniformly.
export type ClaudeCodeRelayResult = RelayResult;

function selectedAnthropicModel(selection: ResolvedSelection | undefined): string | undefined {
  const model = selection?.model;
  if (model === undefined) return undefined;
  if (model.provider !== 'anthropic') {
    throw new Error(
      `claude-code connector cannot honor model provider '${model.provider}' for model '${model.model}'; expected provider 'anthropic'`,
    );
  }
  return model.model;
}

function assertClaudeCodeEffort(
  effort: Effort,
): asserts effort is (typeof CLAUDE_CODE_SUPPORTED_EFFORTS)[number] {
  if (!(CLAUDE_CODE_SUPPORTED_EFFORTS as readonly string[]).includes(effort)) {
    throw new Error(
      `claude-code connector cannot honor effort '${effort}'; supported efforts: ${CLAUDE_CODE_SUPPORTED_EFFORTS.join(', ')}`,
    );
  }
}

export function buildClaudeCodeArgs(input: ClaudeCodeRelayInput): string[] {
  const args: string[] = [...CLAUDE_CODE_DISPATCH_FLAGS];
  const model = selectedAnthropicModel(input.resolvedSelection);
  if (model !== undefined) {
    args.push('--model', model);
  }
  const effort = input.resolvedSelection?.effort;
  if (effort !== undefined) {
    assertClaudeCodeEffort(effort);
    args.push('--effort', effort);
  }
  // Structured-output enforcement at the CLI layer. Claude Code's
  // --json-schema path is reliable for plain object roots; top-level
  // anyOf/oneOf schemas can make the CLI exit before returning a receipt.
  // For those shapes, fall back to the prompt shape hint and let the runtime
  // Zod parse remain the authoritative validator.
  if (
    input.responseSchema !== undefined &&
    isClaudeCodeStructuredOutputCompatible(input.responseSchema)
  ) {
    args.push('--json-schema', JSON.stringify(input.responseSchema));
  }
  args.push(input.prompt);
  return args;
}

function claudeCodeStdoutDiagnostic(stdout: string): string | undefined {
  try {
    parseClaudeCodeStdout(stdout, '', 0);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function isClaudeCodeStructuredOutputCompatible(schema: Record<string, unknown>): boolean {
  return schema.type === 'object';
}

export async function relayClaudeCode(input: ClaudeCodeRelayInput): Promise<RelayResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const args = buildClaudeCodeArgs(input);
  let result: ConnectorSubprocessResult;
  try {
    // stdin is `ignore` (connected to /dev/null) and the child is detached:
    // the shared subprocess helper owns those lifecycle mechanics for all
    // connectors while this module keeps the claude-specific argv and parser.
    result = await runConnectorSubprocess({
      executable: CLAUDE_CODE_EXECUTABLE,
      args,
      timeoutMs,
      stdoutMaxBytes: STDOUT_MAX_BYTES,
      stderrMaxBytes: STDERR_MAX_BYTES,
      sigtermToSigkillGraceMs: SIGTERM_TO_SIGKILL_GRACE_MS,
      env: process.env,
    });
  } catch (error) {
    if (isConnectorSubprocessSpawnError(error)) {
      const verb = error.phase === 'spawn-failed' ? 'spawn failed' : 'spawn error';
      throw new Error(`claude-code subprocess ${verb}: ${error.message}`);
    }
    throw error;
  }

  if (result.timedOut) {
    const stdoutSuffix = result.stdoutCapped ? ' [stdout capped]' : '';
    const stderrSuffix = result.stderrCapped ? ' [stderr capped]' : '';
    throw new Error(
      `claude-code subprocess timed out after ${timeoutMs}ms; group-kill ${result.killGroupSucceeded ? 'sent' : 'failed'}; final signal=${result.signal ?? 'none'}; stdout[:500]=${result.stdout.slice(0, 500)}${stdoutSuffix}; stderr[:500]=${result.stderr.slice(0, 500)}${stderrSuffix}`,
    );
  }
  if (result.code !== 0) {
    const stdoutSuffix = result.stdoutCapped ? ' [stdout capped]' : '';
    const stderrSuffix = result.stderrCapped ? ' [stderr capped]' : '';
    const stdoutDiagnostic = claudeCodeStdoutDiagnostic(result.stdout);
    const diagnosticText =
      stdoutDiagnostic === undefined ? '' : `; stdout_diagnostic=${stdoutDiagnostic}`;
    throw new Error(
      `claude-code subprocess exited with code ${result.code}${result.signal ? ` (signal ${result.signal})` : ''}${diagnosticText}; stdout[:500]=${result.stdout.slice(0, 500)}${stdoutSuffix}; stderr[:500]=${result.stderr.slice(0, 500)}${stderrSuffix}`,
    );
  }
  if (result.stdoutCapped) {
    throw new Error(
      `claude-code subprocess stdout exceeded ${STDOUT_MAX_BYTES} bytes; capability-boundary check cannot be evaluated on truncated stream`,
    );
  }
  try {
    return parseClaudeCodeStdout(result.stdout, input.prompt, result.durationMs);
  } catch (error) {
    const stderrSuffix = result.stderrCapped ? ' [stderr capped]' : '';
    throw new Error(
      `claude-code subprocess: ${(error as Error).message}; stdout[:500]=${result.stdout.slice(0, 500)}; stderr[:200]=${result.stderr.slice(0, 200)}${stderrSuffix}`,
    );
  }
}

// Parsing is extracted so contract tests can exercise the parse branch
// without spawning a real subprocess. The claude CLI emits one JSON
// object per line (NDJSON) under `--output-format stream-json --verbose`.
// We need:
//   - the `{type:'system', subtype:'init'}` trace_entry (for session_id);
//   - the terminal `{type:'result'}` trace_entry (for the text result).
// MCP servers and slash commands stay closed at the flag layer and are
// re-asserted here at parse time so a future flag regression that
// silently widens either surface is caught before the connector result
// reaches any downstream trace-writer. Tools are unconstrained by design
// — the runtime check is the safety net for what workers produce.
export function parseClaudeCodeStdout(
  stdout: string,
  prompt: string,
  duration_ms: number,
): RelayResult {
  const lines = stdout.split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error('stream-json stdout is empty');
  }
  const trace_entries: Array<Record<string, unknown>> = [];
  for (const [idx, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(
        `stream-json line ${idx + 1} is not valid JSON: ${(err as Error).message}; line[:200]=${line.slice(0, 200)}`,
      );
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`stream-json line ${idx + 1} is not a JSON object`);
    }
    trace_entries.push(parsed as Record<string, unknown>);
  }

  // Filter strictly for `subtype === 'init'`.
  const initTraceEntry = trace_entries.find((e) => e.type === 'system' && e.subtype === 'init');
  // Take the LAST result trace_entry (terminal), not the first. `stream-json`
  // emits a single terminal result trace_entry at v0, but depending on future
  // CLI changes multiple result trace_entries could appear; the terminal one is
  // authoritative.
  const resultTraceEntries = trace_entries.filter((e) => e.type === 'result');
  const resultTraceEntry = resultTraceEntries[resultTraceEntries.length - 1];

  if (initTraceEntry === undefined) {
    throw new Error('system/init trace_entry missing from subprocess stdout');
  }
  if (resultTraceEntry === undefined) {
    throw new Error('result trace_entry missing from subprocess stdout');
  }
  if (resultTraceEntry.is_error === true) {
    const message =
      typeof resultTraceEntry.result === 'string' ? resultTraceEntry.result : '<no message>';
    throw new Error(`subprocess reported is_error: ${message}`);
  }

  // MCP and slash-command surfaces are closed at the flag layer and
  // re-asserted here so a flag regression cannot silently widen them.
  // Tools are unrestricted by design — the runtime check validates worker
  // output before it becomes flow state.
  const mcpServers = initTraceEntry.mcp_servers;
  const slashCommands = initTraceEntry.slash_commands;
  if (!Array.isArray(mcpServers) || mcpServers.length !== 0) {
    throw new Error(
      `init.mcp_servers must be []; got ${JSON.stringify(mcpServers)}. CLAUDE_CODE_DISPATCH_FLAGS includes --strict-mcp-config to keep this surface closed.`,
    );
  }
  if (!Array.isArray(slashCommands) || slashCommands.length !== 0) {
    throw new Error(
      `init.slash_commands must be []; got ${JSON.stringify(slashCommands)}. CLAUDE_CODE_DISPATCH_FLAGS includes --disable-slash-commands to keep this surface closed.`,
    );
  }

  const receipt_id = initTraceEntry.session_id;
  const cli_version = initTraceEntry.claude_code_version;
  if (typeof receipt_id !== 'string' || receipt_id.length === 0) {
    throw new Error('init.session_id missing or empty');
  }
  if (typeof cli_version !== 'string' || cli_version.length === 0) {
    throw new Error('init.claude_code_version missing or empty');
  }
  // When `--json-schema` is in effect, claude-code routes the validated
  // JSON payload into `result.structured_output` (as a parsed object) and
  // leaves `result.result` as model prose (or empty when the model emits
  // zero free-form text alongside the StructuredOutput tool call). Prefer
  // the structured payload; fall back to the prose field when the schema
  // flag wasn't set.
  const structuredOutput = resultTraceEntry.structured_output;
  let result_body: string;
  if (structuredOutput !== undefined && structuredOutput !== null) {
    if (typeof structuredOutput !== 'object') {
      throw new Error('result.structured_output present but not an object');
    }
    result_body = JSON.stringify(structuredOutput);
  } else {
    const result_body_raw = resultTraceEntry.result;
    if (typeof result_body_raw !== 'string') {
      throw new Error('result.result missing or not a string');
    }
    // Tolerant extraction: workers preamble status sentences before their
    // JSON response despite the shape-hint instruction. Strip any prose
    // wrapping the JSON object so downstream check evaluation and report
    // schema parsing see clean JSON. Non-JSON output (rare) flows through
    // unchanged.
    result_body = extractJsonObject(result_body_raw);
  }
  return {
    request_payload: prompt,
    receipt_id,
    result_body,
    duration_ms,
    cli_version,
  };
}
