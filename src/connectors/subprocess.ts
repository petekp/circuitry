import { type ChildProcess, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export class ConnectorSubprocessSpawnError extends Error {
  constructor(
    readonly phase: 'spawn-failed' | 'spawn-error',
    message: string,
  ) {
    super(message);
    this.name = 'ConnectorSubprocessSpawnError';
  }
}

export function isConnectorSubprocessSpawnError(
  error: unknown,
): error is ConnectorSubprocessSpawnError {
  return (
    error instanceof ConnectorSubprocessSpawnError ||
    (error instanceof Error && error.name === 'ConnectorSubprocessSpawnError')
  );
}

export interface ConnectorSubprocessResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly stdoutCapped: boolean;
  readonly stderrCapped: boolean;
  readonly timedOut: boolean;
  readonly killGroupSucceeded: boolean;
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly durationMs: number;
}

export interface RunConnectorSubprocessInput {
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
  readonly stdoutMaxBytes: number;
  readonly stderrMaxBytes: number;
  readonly sigtermToSigkillGraceMs: number;
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
}

function appendCapped(
  current: string,
  currentBytes: number,
  chunk: string,
  maxBytes: number,
): { readonly text: string; readonly bytes: number; readonly capped: boolean } {
  const chunkBytes = Buffer.byteLength(chunk, 'utf8');
  if (currentBytes + chunkBytes <= maxBytes) {
    return { text: current + chunk, bytes: currentBytes + chunkBytes, capped: false };
  }

  const remaining = maxBytes - currentBytes;
  if (remaining <= 0) {
    return { text: current, bytes: currentBytes, capped: true };
  }

  return {
    text: current + Buffer.from(chunk, 'utf8').subarray(0, remaining).toString('utf8'),
    bytes: maxBytes,
    capped: true,
  };
}

// Human-readable verb for a spawn failure, shared by every connector's
// `catch (error) { if (isConnectorSubprocessSpawnError(error)) ... }` block.
// `spawn-failed` is a synchronous throw from `spawn()`; `spawn-error` is an
// async `'error'` event (e.g. ENOENT surfaced after the call returned).
export function spawnErrorVerb(
  error: ConnectorSubprocessSpawnError,
): 'spawn failed' | 'spawn error' {
  return error.phase === 'spawn-failed' ? 'spawn failed' : 'spawn error';
}

// Trailing annotation appended to a stream sample when capture hit its byte
// cap, so a truncated tail in an error message is never mistaken for the
// stream's true end. `stream` names which stream the sample came from.
export function cappedSuffix(capped: boolean, stream: 'stdout' | 'stderr'): string {
  return capped ? ` [${stream} capped]` : '';
}

// Split a connector's stdout into NDJSON objects: one JSON object per
// non-empty line. `label` prefixes per-line parse errors so callers can tell
// which stream failed (e.g. 'stream-json' for claude-code, 'codex --json' for
// codex). The empty-stdout guard stays in each connector because the exact
// wording is pinned by contract tests and varies per connector.
export function parseNdjsonObjects(stdout: string, label: string): Array<Record<string, unknown>> {
  const lines = stdout.split('\n').filter((line) => line.length > 0);
  const objects: Array<Record<string, unknown>> = [];
  for (const [idx, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(
        `${label} line ${idx + 1} is not valid JSON: ${(err as Error).message}; line[:200]=${line.slice(0, 200)}`,
      );
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`${label} line ${idx + 1} is not a JSON object`);
    }
    objects.push(parsed as Record<string, unknown>);
  }
  return objects;
}

export async function runConnectorSubprocess(
  input: RunConnectorSubprocessInput,
): Promise<ConnectorSubprocessResult> {
  const start = performance.now();
  return await new Promise<ConnectorSubprocessResult>((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(input.executable, [...input.args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: input.env ?? process.env,
        detached: true,
        ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
      });
    } catch (error) {
      reject(
        new ConnectorSubprocessSpawnError(
          'spawn-failed',
          error instanceof Error ? error.message : String(error),
        ),
      );
      return;
    }

    let stdout = '';
    let stdoutBytes = 0;
    let stderr = '';
    let stderrBytes = 0;
    let stdoutCapped = false;
    let stderrCapped = false;
    let timedOut = false;
    let killGroupSucceeded = false;

    const killProcessGroup = (signal: NodeJS.Signals): boolean => {
      const pid = child.pid;
      if (typeof pid !== 'number') return false;
      try {
        process.kill(-pid, signal);
        return true;
      } catch {
        try {
          child.kill(signal);
          return true;
        } catch {
          return false;
        }
      }
    };

    let killGraceTimer: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroupSucceeded = killProcessGroup('SIGTERM');
      killGraceTimer = setTimeout(() => {
        killProcessGroup('SIGKILL');
        killGraceTimer = undefined;
      }, input.sigtermToSigkillGraceMs);
    }, input.timeoutMs);

    const clearAllTimers = () => {
      clearTimeout(timer);
      if (killGraceTimer !== undefined) {
        clearTimeout(killGraceTimer);
        killGraceTimer = undefined;
      }
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      const next = appendCapped(stdout, stdoutBytes, chunk, input.stdoutMaxBytes);
      stdout = next.text;
      stdoutBytes = next.bytes;
      stdoutCapped = stdoutCapped || next.capped;
    });
    child.stderr?.on('data', (chunk: string) => {
      const next = appendCapped(stderr, stderrBytes, chunk, input.stderrMaxBytes);
      stderr = next.text;
      stderrBytes = next.bytes;
      stderrCapped = stderrCapped || next.capped;
    });
    child.on('error', (error) => {
      clearAllTimers();
      reject(new ConnectorSubprocessSpawnError('spawn-error', error.message));
    });
    child.on('close', (code, signal) => {
      clearAllTimers();
      resolve({
        stdout,
        stderr,
        stdoutCapped,
        stderrCapped,
        timedOut,
        killGroupSucceeded,
        code,
        signal,
        durationMs: performance.now() - start,
      });
    });
  });
}
