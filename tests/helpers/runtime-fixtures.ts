import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
