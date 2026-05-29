import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn, RelayInput } from '../../src/shared/relay-runtime-types.js';

/**
 * Shared runtime-test fixtures.
 *
 * These primitives were previously re-derived byte-for-byte across dozens of
 * test files (deterministicNow in ~46, withTempRun in 3). Hoisting them behind
 * one small interface means a change to clock granularity or temp-run lifecycle
 * is a single edit here instead of a fan-out across the suite.
 */

/**
 * A deterministic monotonic clock: returns a `() => Date` that advances exactly
 * one second per call, starting at `startMs`. Lets trace/runtime tests assert on
 * stable, ordered timestamps without touching the wall clock.
 */
export function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

/**
 * Run `fn` against a fresh temporary run directory, removing it afterward even
 * if `fn` throws. The mkdtemp prefix defaults to `circuit-runtime-`; pass an
 * explicit prefix as the first argument when a test needs a recognizable name.
 */
export function withTempRun<T>(fn: (runDir: string) => Promise<T>): Promise<T>;
export function withTempRun<T>(prefix: string, fn: (runDir: string) => Promise<T>): Promise<T>;
export async function withTempRun<T>(
  prefixOrFn: string | ((runDir: string) => Promise<T>),
  maybeFn?: (runDir: string) => Promise<T>,
): Promise<T> {
  const prefix = typeof prefixOrFn === 'string' ? prefixOrFn : 'circuit-runtime-';
  const fn = typeof prefixOrFn === 'function' ? prefixOrFn : maybeFn;
  if (fn === undefined) {
    throw new Error('withTempRun requires a callback');
  }
  const runDir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(runDir);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

/**
 * The common stub `RelayResult` literal, previously hand-built byte-for-byte
 * across ~40 test files. Tests assert on `result_body` (and, via the relayer,
 * `request_payload`) — never on `receipt_id`, `duration_ms`, or `cli_version` —
 * so those three carry stable, arbitrary defaults. Pass `overrides` (shallow
 * merged) for the per-site `result_body`/`receipt_id` a given test needs.
 */
export function stubRelayResult(overrides: Partial<RelayResult> = {}): RelayResult {
  return {
    request_payload: '',
    receipt_id: 'stub-receipt',
    result_body: '',
    duration_ms: 1,
    cli_version: '0.0.0-stub',
    ...overrides,
  };
}

/**
 * Build a `RelayFn` whose `relay` yields `stubRelayResult` with `request_payload`
 * bound to the live `input.prompt` and `result_body` taken from `body` — either a
 * constant string or a function of the relay input (for prompt-dependent stubs).
 * `connectorName` defaults to `claude-code`; pass `overrides` for a different
 * `receipt_id`, connector identity, or any other RelayResult field.
 */
export function makeStubRelayer(
  body: string | ((input: RelayInput) => string),
  overrides: Partial<RelayResult> & { connectorName?: string } = {},
): RelayFn {
  const { connectorName = 'claude-code', ...resultOverrides } = overrides;
  return {
    connectorName,
    relay: async (input: RelayInput): Promise<RelayResult> =>
      stubRelayResult({
        request_payload: input.prompt,
        result_body: typeof body === 'function' ? body(input) : body,
        ...resultOverrides,
      }),
  };
}
