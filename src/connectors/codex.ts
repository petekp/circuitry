import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import type { Effort } from '../schemas/selection-policy.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import type { ConnectorRelayInput, RelayResult } from '../shared/connector-relay.js';
import { extractJsonObject } from '../shared/json-extraction.js';
import {
  type ConnectorSubprocessResult,
  isConnectorSubprocessSpawnError,
  runConnectorSubprocess,
} from './subprocess.js';

// Codex CLI connector. Invokes Codex as a Node subprocess (no external
// SDK dependency; Node stdlib only). Mirrors the claude-code.ts template.
//
// Capability boundary — OS-level sandbox.
//
// Where the claude-code connector enforces its boundary at the declarative
// tool layer (`claude -p` with `--tools ""`, `--strict-mcp-config`,
// `--disable-slash-commands`, plus a parse-time assertion against the
// subprocess's init trace_entry), the Codex connector relies on Codex's
// OS-level sandbox (Seatbelt on macOS, Landlock on Linux) via
// `codex exec -s read-only`. The sandbox blocks write syscalls at the
// process level, not at the tool level, so the parse-time assertion
// shape doesn't transfer — Codex's --json stream does not emit an init
// trace_entry enumerating tool surfaces.
//
// Capability-boundary proof is therefore two-layered:
//
//   (a) Argv-constant assertion at spawn time — CODEX_NO_WRITE_FLAGS
//       must include `-s read-only` and must NOT include
//       `--dangerously-bypass-approvals-and-sandbox`. Both facts are
//       provable at module-load time (assertions fire on a frozen
//       constant) and pinned by contract tests at
//       tests/contracts/codex-connector-schema.test.ts.
//
//   (b) TraceEntry-stream capability discipline — parseCodexStdout() is
//       fail-closed against missing `thread.started` trace_entries (no
//       session identifier available), missing or malformed terminal
//       `agent_message`, or `item.completed` trace_entries carrying
//       unexpected item.type values. A future Codex CLI that reintroduces
//       a write-capable tool trace_entry would surface as an unexpected
//       item type and be rejected rather than silently passed through.
//
// Each flag in CODEX_NO_WRITE_FLAGS is load-bearing:
//   'exec'                      — subcommand selecting non-interactive
//                                 run.
//   '--json'                    — JSONL trace_entries on stdout (one
//                                 object per line). Pure stream; stderr
//                                 carries Codex's skills-loader tracing
//                                 noise separately.
//   '-s', 'read-only'           — sandbox policy. The capability-boundary
//                                 anchor. `workspace-write` and
//                                 `danger-full-access` are the other two
//                                 values; both are forbidden by this
//                                 connector.
//   '--ephemeral'               — no session file persisted under
//                                 ~/.codex/sessions/**. Analog of the
//                                 claude-code connector's
//                                 --no-session-persistence.
//   '--skip-git-repo-check'     — allow running outside a git repo (the
//                                 subprocess cwd passed by the runtime
//                                 may or may not be a worktree; Codex
//                                 defaults to refusing non-repo cwd).
//
// If any of these assumptions change upstream (Codex CLI version bumps,
// sandbox enum grows a new value that bypasses read-only, --json format
// changes shape), this connector's contract is broken and the relevant
// guardrail above will catch it.
export const CODEX_NO_WRITE_FLAGS = Object.freeze([
  'exec',
  '--json',
  '-s',
  'read-only',
  '--ephemeral',
  '--skip-git-repo-check',
] as const);

export const CODEX_EXECUTABLE = 'codex';

// Forbidden flag / prefix set. Any of these in the spawn argv would
// undermine the `-s read-only` capability boundary:
//
//   --dangerously-bypass-approvals-and-sandbox
//     Skips all confirmations AND disables the sandbox entirely.
//   --full-auto
//     Codex convenience alias for `-a on-request --sandbox workspace-
//     write`; silently widens the sandbox to writable.
//   --add-dir <DIR>
//     Extends the writable root set — any directory passed here
//     becomes writable even under `-s read-only`.
//   -o / --output-last-message <FILE>
//     Codex CLI native write path: Codex writes the final message to
//     the named file regardless of model sandbox. This is a direct
//     repo-write surface that bypasses the `-s read-only` model
//     sandbox because it is performed by the Codex CLI wrapper, not
//     by a sandboxed model-invoked shell command.
//   -c / --config <key=value>
//     Can override `sandbox_mode` / `sandbox_permissions` /
//     `shell_environment_policy` / `approval_policy` and therefore
//     disable the boundary from inside config rather than argv. There is
//     one controlled exception outside CODEX_NO_WRITE_FLAGS:
//     buildCodexArgs may emit `-c model_reasoning_effort="<effort>"`
//     from the connector-owned effort allowlist. assertCodexSpawnArgvBoundary()
//     validates the final spawn argv so no caller-authored config key is
//     ever accepted.
//   -p / --profile <NAME>
//     Loads a named profile from `~/.codex/config.toml`; profiles can
//     carry sandbox / approval / MCP-server / shell-env overrides
//     that re-widen the surface outside the module's visibility.
//   --sandbox <MODE>
//     Long-form sandbox override. The one allowed sandbox declaration is
//     the base `-s read-only` pair in CODEX_NO_WRITE_FLAGS; any later
//     sandbox flag would let argv order re-widen the boundary.
//
// The module-load assertion below rejects any of these as either an
// exact token match or a prefix (the `<arg>` variants like
// `--add-dir` take the next argv slot, but a `-c sandbox_mode="..."`
// reaching this assertion would still fire on the `-c` match if it were
// added to CODEX_NO_WRITE_FLAGS).
//
// The forbidden-token set above covers `--full-auto`, `--add-dir`,
// `-c sandbox_mode=workspace-write`, `--profile`, and `-o` — all of
// which break the boundary while preserving `-s read-only`.
export const CODEX_FORBIDDEN_ARGV_TOKENS = Object.freeze([
  '--dangerously-bypass-approvals-and-sandbox',
  '--full-auto',
  '--add-dir',
  '-o',
  '--output-last-message',
  '-c',
  '--config',
  '-p',
  '--profile',
  '--sandbox',
] as const);
export const CODEX_REASONING_EFFORT_CONFIG_KEY = 'model_reasoning_effort';
export const CODEX_SUPPORTED_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;

// Fail-closed module-load assertion. The `CODEX_NO_WRITE_FLAGS` constant
// is frozen (see `Object.freeze` above) so this is a static-shape
// invariant: the connector refuses to load if the flags drift away from
// the capability-boundary-preserving set.
//
// Why assert here rather than at first relay: catches a regression
// on `import` so a test suite that imports the module but skips the
// CODEX_SMOKE path still surfaces the invariant break.
if (!CODEX_NO_WRITE_FLAGS.includes('-s') || !CODEX_NO_WRITE_FLAGS.includes('read-only')) {
  throw new Error(
    'CODEX_NO_WRITE_FLAGS capability-boundary invariant broken: must include "-s read-only"',
  );
}
const flagsAsStringArray: readonly string[] = CODEX_NO_WRITE_FLAGS;
for (const forbidden of CODEX_FORBIDDEN_ARGV_TOKENS) {
  if (flagsAsStringArray.includes(forbidden)) {
    throw new Error(
      `CODEX_NO_WRITE_FLAGS capability-boundary invariant broken: must NOT include "${forbidden}" (forbidden-token set)`,
    );
  }
}

// Default wall-clock budget for a single relay. A step's
// `budgets.wall_clock_ms` overrides this when present.
const DEFAULT_TIMEOUT_MS = 120_000;

// Grace period between SIGTERM and SIGKILL, modeled on claude-code.ts.
const SIGTERM_TO_SIGKILL_GRACE_MS = 2_000;

// stdout / stderr caps. Codex's `--json` stream is typically tiny
// (four trace_entries for a single-turn relay), but a misbehaving
// subprocess should not exhaust connector memory.
const STDOUT_MAX_BYTES = 16 * 1024 * 1024;
const STDERR_MAX_BYTES = 1024 * 1024;

// Version-capture timeout. `codex --version` is a fast local command
// (~150ms on a warm cache); a longer-than-a-few-seconds hang indicates
// a broken installation and should fail the relay rather than block
// indefinitely.
const VERSION_CAPTURE_TIMEOUT_MS = 5_000;

// `CodexRelayInput` does NOT carry a cwd field at v0. The codex
// subprocess inherits the parent Node process's cwd via `spawn`'s
// default behavior. This is intentional: `docs/contracts/connector.md`
// connector-I1 codex bullet says the connector runs "in the operator's
// current session context," which at v0 is the parent cwd. If future
// work needs per-relay cwd override (distinct-UID sandbox, git
// worktree routing, flow-scoped directories), the field is added
// here and threaded into the `spawn` options below. Noted as
// deferred-by-design, not oversight.
export interface CodexRelayInput extends ConnectorRelayInput {}

// The `CodexRelayResult` name parallels `ClaudeCodeRelayResult` —
// both alias the shared `RelayResult` shape and exist for call-site
// clarity at the connector boundary.
export type CodexRelayResult = RelayResult;

// Capture the Codex CLI version via a separate `codex --version`
// shellout. Codex's `--json` stream does not emit version in-band
// (unlike `claude`'s `system/init` trace_entry which carries
// `claude_code_version`), so a pre-invocation shellout is the only
// direct way to version-pin a relay.
//
// The version capture is memoized per process lifetime so the overhead
// is paid once per connector import, not once per relay. `codex
// --version` also prints PATH-update warnings to stderr on some
// installations; memoizing localizes that side-effect to the first
// relay in a process. Trade-off: if the operator upgrades the Codex
// CLI mid-process, the cached version goes stale until the process
// restarts. At v0 this is an accepted corner case — CLI upgrades
// mid-session are rare, and the fingerprint writer invokes
// relayCodex fresh each smoke run (so fingerprint evidence remains
// version-accurate as long as the smoke run process restarts after a
// CLI upgrade, which it does since vitest spawns fresh workers).
let cachedCodexVersion: string | undefined;
function captureCodexVersion(): string {
  if (cachedCodexVersion !== undefined) return cachedCodexVersion;
  let stdout: string;
  try {
    stdout = execFileSync(CODEX_EXECUTABLE, ['--version'], {
      encoding: 'utf8',
      timeout: VERSION_CAPTURE_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new Error(`codex --version failed: ${(err as Error).message}`);
  }
  // Expected format: "codex-cli 0.118.0" (one line, may include trailing
  // newline). Parse liberally: strip whitespace, keep whatever token(s)
  // remain. If the CLI output shape changes, version-pin still records
  // the raw bytes; downstream tools can normalize.
  const version = stdout.trim();
  if (version.length === 0) {
    throw new Error('codex --version produced empty output');
  }
  cachedCodexVersion = version;
  return version;
}

function assertCodexEffort(
  effort: Effort,
): asserts effort is (typeof CODEX_SUPPORTED_EFFORTS)[number] {
  if (!(CODEX_SUPPORTED_EFFORTS as readonly string[]).includes(effort)) {
    throw new Error(
      `codex connector cannot honor effort '${effort}'; supported efforts: ${CODEX_SUPPORTED_EFFORTS.join(', ')}`,
    );
  }
}

function selectedOpenAIModel(selection: ResolvedSelection | undefined): string | undefined {
  const model = selection?.model;
  if (model === undefined) return undefined;
  if (model.provider !== 'openai') {
    throw new Error(
      `codex connector cannot honor model provider '${model.provider}' for model '${model.model}'; expected provider 'openai'`,
    );
  }
  return model.model;
}

function codexReasoningEffortConfigValue(effort: (typeof CODEX_SUPPORTED_EFFORTS)[number]): string {
  return `${CODEX_REASONING_EFFORT_CONFIG_KEY}=${JSON.stringify(effort)}`;
}

function isForbiddenCodexArg(arg: string): boolean {
  return CODEX_FORBIDDEN_ARGV_TOKENS.some((token) => {
    if (token === '-c') return false;
    if (arg === token) return true;
    return token.startsWith('--') && arg.startsWith(`${token}=`);
  });
}

function isAllowedCodexConfigOverride(value: string | undefined): boolean {
  return (
    value !== undefined &&
    CODEX_SUPPORTED_EFFORTS.some((effort) => value === codexReasoningEffortConfigValue(effort))
  );
}

export function assertCodexSpawnArgvBoundary(args: readonly string[]): void {
  const sandboxFlagIndexes = args
    .map((arg, idx) => (arg === '-s' ? idx : -1))
    .filter((idx) => idx >= 0);
  const sandboxFlagIndex = sandboxFlagIndexes[0];
  if (
    sandboxFlagIndexes.length !== 1 ||
    sandboxFlagIndex === undefined ||
    args[sandboxFlagIndex + 1] !== 'read-only'
  ) {
    throw new Error(
      'codex spawn argv boundary broken: exactly one "-s read-only" pair is required',
    );
  }

  let configOverrideCount = 0;
  for (let idx = 0; idx < args.length; idx += 1) {
    const arg = args[idx];
    if (arg === undefined) continue;
    if (arg === '-c') {
      configOverrideCount += 1;
      if (configOverrideCount > 1) {
        throw new Error(
          'codex spawn argv boundary broken: at most one allowlisted -c override is allowed',
        );
      }
      const value = args[idx + 1];
      if (!isAllowedCodexConfigOverride(value)) {
        throw new Error(
          `codex spawn argv boundary broken: only ${CODEX_REASONING_EFFORT_CONFIG_KEY}=<supported effort> is allowed after -c`,
        );
      }
      idx += 1;
      continue;
    }
    if (isForbiddenCodexArg(arg)) {
      throw new Error(`codex spawn argv boundary broken: forbidden argv token "${arg}"`);
    }
  }
}

export function buildCodexArgs(input: CodexRelayInput, schemaPath?: string): string[] {
  const args: string[] = [...CODEX_NO_WRITE_FLAGS];
  const model = selectedOpenAIModel(input.resolvedSelection);
  if (model !== undefined) {
    args.push('-m', model);
  }
  const effort = input.resolvedSelection?.effort;
  if (effort !== undefined) {
    assertCodexEffort(effort);
    args.push('-c', codexReasoningEffortConfigValue(effort));
  }
  // Structured-output enforcement. `--output-schema` is not in
  // CODEX_FORBIDDEN_ARGV_TOKENS, so this passes assertCodexSpawnArgvBoundary
  // without widening the read-only sandbox. The path itself is also a
  // benign arg from the boundary check's perspective.
  if (schemaPath !== undefined) {
    args.push('--output-schema', schemaPath);
  }
  args.push(input.prompt);
  assertCodexSpawnArgvBoundary(args);
  return args;
}

// Allocate the temp directory FIRST and return it alongside the file path
// so the caller can register the dir for cleanup before any operation that
// might throw (JSON.stringify on a BigInt, EAGAIN on writeFile, etc.) gets
// a chance to leak it. Callers must hold the returned `dir` through a
// try/finally even if `path` is never written successfully.
//
// Exported for direct test coverage of the cleanup-on-throw path; not a
// stable runtime surface.
//
// Probe whether a JSON Schema can be passed to codex's `--output-schema`.
// The OpenAI Responses API backs that flag with the `response_format`
// slot, which requires a root of `type: "object"` (no top-level
// `anyOf`/`oneOf`/array/primitive). When this returns false, the caller
// must skip the flag and rely on the prose shape hint instead.
//
// Exported for direct test coverage; not a stable runtime surface.
export function isPlainObjectTypeRoot(schema: Record<string, unknown>): boolean {
  return schema.type === 'object';
}

export async function writeSchemaTempFile(
  schema: Record<string, unknown>,
): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(joinPath(tmpdir(), 'circuit-codex-schema-'));
  try {
    const path = joinPath(dir, 'schema.json');
    await writeFile(path, JSON.stringify(schema), 'utf8');
    return { dir, path };
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
}

async function cleanupSchemaTempDir(dir: string | undefined): Promise<void> {
  if (dir === undefined) return;
  // Remove the entire mkdtemp directory; the schema file is the only
  // thing in it, but `rm -rf` against the dir is safer than dance-
  // around-then-rmdir if any future code ever drops a sibling output.
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; a leaked temp dir is preferable to surfacing
    // a teardown error and masking the real relay result.
  }
}

export async function relayCodex(input: CodexRelayInput): Promise<RelayResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cli_version = captureCodexVersion();
  // Acquire the schema temp file FIRST and put every subsequent operation
  // inside the try block. If `buildCodexArgs` throws (boundary assertion)
  // or if `spawn` throws, the `finally` still runs and the mkdtemp
  // directory is cleaned. `writeSchemaTempFile` cleans up its own dir if
  // the JSON serialization itself throws (BigInt, circular ref) so this
  // local `tempDir` only sees a successfully-allocated directory.
  let tempDir: string | undefined;
  let schemaPath: string | undefined;
  try {
    // Codex's `--output-schema` is backed by the OpenAI Responses API
    // `response_format` slot, which rejects any root that is not
    // `type: "object"` (top-level `anyOf`, `oneOf`, arrays, primitives,
    // etc. all fail with `invalid_json_schema`). Discriminated unions
    // from Zod surface as top-level `anyOf` here. Degrade gracefully:
    // when the schema's root is not a plain object, skip the flag and
    // fall back to the prose shape hint already embedded in the prompt.
    // The downstream runtime Zod check still validates worker output.
    if (input.responseSchema !== undefined && isPlainObjectTypeRoot(input.responseSchema)) {
      const allocated = await writeSchemaTempFile(input.responseSchema);
      tempDir = allocated.dir;
      schemaPath = allocated.path;
    }
    const args = buildCodexArgs(input, schemaPath);
    let result: ConnectorSubprocessResult;
    try {
      // The shared subprocess helper owns stdin-ignore, detached process
      // groups, timeout kill, and bounded output capture. Codex-specific
      // sandbox flags and JSONL parsing remain in this module.
      result = await runConnectorSubprocess({
        executable: CODEX_EXECUTABLE,
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
        throw new Error(`codex subprocess ${verb}: ${error.message}`);
      }
      throw error;
    }

    if (result.timedOut) {
      throw new Error(
        `codex subprocess timed out after ${timeoutMs}ms; group-kill ${result.killGroupSucceeded ? 'sent' : 'failed'}; final signal=${result.signal ?? 'none'}; stderr[:500]=${result.stderr.slice(0, 500)}`,
      );
    }
    if (result.code !== 0) {
      throw new Error(
        `codex subprocess exited with code ${result.code}${result.signal ? ` (signal ${result.signal})` : ''}; stderr[:500]=${result.stderr.slice(0, 500)}`,
      );
    }
    if (result.stdoutCapped) {
      throw new Error(
        `codex subprocess stdout exceeded ${STDOUT_MAX_BYTES} bytes; capability-boundary check cannot be evaluated on truncated stream`,
      );
    }
    try {
      return parseCodexStdout(result.stdout, input.prompt, result.durationMs, cli_version);
    } catch (error) {
      const stderrSuffix = result.stderrCapped ? ' [stderr capped]' : '';
      throw new Error(
        `codex subprocess: ${(error as Error).message}; stdout[:500]=${result.stdout.slice(0, 500)}; stderr[:200]=${result.stderr.slice(0, 200)}${stderrSuffix}`,
      );
    }
  } finally {
    await cleanupSchemaTempDir(tempDir);
  }
}

// Known `item.completed` `item.type` values at Codex CLI 0.118-0.125. The
// connector accepts model narration plus read-only command execution
// events and rejects anything else — an unknown type may represent a new
// capability surface that bypasses the sandbox's intent and needs to be
// explicitly reviewed before we start emitting it into the relay transcript.
//
// A future CLI bump that introduces a genuinely-sandboxed item type
// (e.g., a reasoning variant) can extend this list; a bump that
// introduces a write-capable item type breaks the read-only boundary
// and must be reviewed before this allowlist is extended.
const KNOWN_CODEX_ITEM_TYPES = new Set<string>(['agent_message', 'command_execution', 'reasoning']);

// Top-level trace_entry types the parser expects at Codex CLI 0.118-0.128 —
// grounded in the `tests/fixtures/codex-smoke/protocol/happy-path-
// ok.jsonl` real capture, a 0.125 manual smoke that emitted
// `item.started` before a read-only `command_execution`, and a 0.128
// observation of `item.updated` carrying incremental progress on a
// `command_execution`. An trace_entry whose `type` is outside this set
// is rejected: the connector refuses to admit unfamiliar protocol
// surfaces into the relay transcript. `item.updated` carries no new
// capability — it is a progress beacon for a command already opened
// via `item.started` and gated by the existing `KNOWN_CODEX_ITEM_TYPES`
// allowlist on the contained `item.type`.
const KNOWN_CODEX_EVENT_TYPES = new Set<string>([
  'thread.started',
  'turn.started',
  'item.started',
  'item.updated',
  'item.completed',
  'turn.completed',
]);

// Explicit failure-trace_entry types. The challenger's no-network probe
// observed top-level `turn.failed` and `error` trace_entries alongside a
// partial `thread.started` / `turn.started`. Rejecting these with
// named error messages keeps relay failures legible — the connector
// says "codex reported turn.failed" rather than surfacing as "missing
// turn.completed" and letting the caller guess what happened.
const CODEX_FAILURE_EVENT_TYPES = new Set<string>(['turn.failed', 'error']);

export function parseCodexStdout(
  stdout: string,
  prompt: string,
  duration_ms: number,
  cli_version: string,
): RelayResult {
  const lines = stdout.split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error('codex --json stdout is empty');
  }
  const trace_entries: Array<Record<string, unknown>> = [];
  for (const [idx, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(
        `codex --json line ${idx + 1} is not valid JSON: ${(err as Error).message}; line[:200]=${line.slice(0, 200)}`,
      );
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`codex --json line ${idx + 1} is not a JSON object`);
    }
    trace_entries.push(parsed as Record<string, unknown>);
  }

  // Top-level trace_entry-type gating.
  //   (a) Reject failure trace_entries up front with a named error so relay
  //       callers see "codex reported turn.failed" / "codex reported
  //       error" instead of a generic downstream parse error.
  //   (b) Reject unknown top-level trace_entry types so a new Codex CLI
  //       version that adds a capability trace_entry cannot slip past the
  //       known-types allowlist and land in the transcript implicitly.
  for (const [idx, trace_entry] of trace_entries.entries()) {
    const type = trace_entry.type;
    if (typeof type !== 'string') {
      throw new Error(`codex --json line ${idx + 1}: trace_entry has no string 'type' field`);
    }
    if (CODEX_FAILURE_EVENT_TYPES.has(type)) {
      const msgField =
        typeof trace_entry.message === 'string'
          ? trace_entry.message
          : typeof trace_entry.error === 'string'
            ? trace_entry.error
            : JSON.stringify(trace_entry).slice(0, 200);
      throw new Error(
        `codex reported ${type}: ${msgField}. If this recurs, examine whether the failure shape indicates a capability-boundary regression (e.g., a sandboxed write attempt surfacing as turn.failed).`,
      );
    }
    if (!KNOWN_CODEX_EVENT_TYPES.has(type)) {
      throw new Error(
        `codex --json line ${idx + 1}: unknown top-level trace_entry type '${type}' (allowlist: ${Array.from(KNOWN_CODEX_EVENT_TYPES).join(', ')}). A new Codex trace_entry type must be reviewed before the connector admits it.`,
      );
    }
  }

  // `thread.started` carries the thread_id. It is emitted as the FIRST
  // trace_entry of any exec invocation under Codex 0.118.
  const threadStarted = trace_entries.find((e) => e.type === 'thread.started');
  if (threadStarted === undefined) {
    throw new Error('thread.started trace_entry missing from codex --json stdout');
  }
  const thread_id = threadStarted.thread_id;
  if (typeof thread_id !== 'string' || thread_id.length === 0) {
    throw new Error('thread.started.thread_id missing or empty');
  }

  // `turn.completed` is the terminal turn marker. Missing = the turn did
  // not complete cleanly even if the exit code was 0 (shouldn't happen
  // at v0 but the assertion is cheap).
  const turnCompleted = trace_entries.find((e) => e.type === 'turn.completed');
  if (turnCompleted === undefined) {
    throw new Error('turn.completed trace_entry missing from codex --json stdout');
  }

  // Collect `item.completed` trace_entries. Each carries an `item` object
  // with an `id`, `type`, and type-specific fields. Reject any item whose
  // type is not in KNOWN_CODEX_ITEM_TYPES: a silent pass-through of a
  // novel write-capable item would bypass the read-only sandbox proof.
  // New Codex item types must be reviewed before extending the allowlist.
  const itemCompleted = trace_entries.filter((e) => e.type === 'item.completed');
  for (const [idx, e] of itemCompleted.entries()) {
    const item = e.item;
    if (typeof item !== 'object' || item === null) {
      throw new Error(`item.completed[${idx}].item is not an object`);
    }
    const itemType = (item as Record<string, unknown>).type;
    if (typeof itemType !== 'string') {
      throw new Error(`item.completed[${idx}].item.type is not a string`);
    }
    if (!KNOWN_CODEX_ITEM_TYPES.has(itemType)) {
      throw new Error(
        `capability-boundary violation: item.completed[${idx}].item.type='${itemType}' is not in the known-types allowlist (${Array.from(KNOWN_CODEX_ITEM_TYPES).join(', ')}). A new Codex item type must be reviewed before the connector admits it.`,
      );
    }
  }

  // `item.updated` (Codex 0.128+) carries an incremental progress payload
  // for an item already opened via `item.started`. Check it against the
  // same KNOWN_CODEX_ITEM_TYPES allowlist as `item.completed` so a novel
  // item type cannot slip in via the update channel either.
  const itemUpdated = trace_entries.filter((e) => e.type === 'item.updated');
  for (const [idx, e] of itemUpdated.entries()) {
    const item = e.item;
    if (typeof item !== 'object' || item === null) {
      throw new Error(`item.updated[${idx}].item is not an object`);
    }
    const itemType = (item as Record<string, unknown>).type;
    if (typeof itemType !== 'string') {
      throw new Error(`item.updated[${idx}].item.type is not a string`);
    }
    if (!KNOWN_CODEX_ITEM_TYPES.has(itemType)) {
      throw new Error(
        `capability-boundary violation: item.updated[${idx}].item.type='${itemType}' is not in the known-types allowlist (${Array.from(KNOWN_CODEX_ITEM_TYPES).join(', ')}). A new Codex item type must be reviewed before the connector admits it.`,
      );
    }
  }

  // Take the LAST agent_message item — the terminal response. A Codex
  // exec may emit reasoning items between agent_message deltas
  // (though at 0.118 with --json we observe a single terminal
  // agent_message for the short prompts v0 relays carry).
  const agentMessages = itemCompleted.filter((e) => {
    const item = e.item as Record<string, unknown>;
    return (item.type as string) === 'agent_message';
  });
  const terminalMessage = agentMessages[agentMessages.length - 1];
  if (terminalMessage === undefined) {
    throw new Error('no item.completed/agent_message trace_entry found in codex --json stdout');
  }
  const item = terminalMessage.item as Record<string, unknown>;
  const result_body_raw = item.text;
  if (typeof result_body_raw !== 'string') {
    throw new Error('terminal agent_message item.text missing or not a string');
  }
  // Tolerant extraction: workers preamble status sentences before their
  // JSON response despite the shape-hint instruction. Symmetric with
  // `parseClaudeCodeStdout`. Non-JSON output flows through unchanged.
  const result_body = extractJsonObject(result_body_raw);

  return {
    request_payload: prompt,
    receipt_id: thread_id,
    result_body,
    duration_ms,
    cli_version,
  };
}
