// Scoped process.env mutation helpers for tests.
//
// Why this exists: `process.env.X = undefined` does NOT clear an env var.
// Node coerces the assigned value to a string, so the key ends up holding the
// literal string `'undefined'` — a truthy, non-empty value that defeats both
// `=== '1'` style reads and `?? fallback` style reads. The correct way to
// clear a key is `delete process.env.X`.
//
// `setEnv` centralises that rule: passing `undefined` deletes the key, any
// other value is assigned as-is. `withScopedEnv` builds on it to set a batch
// of overrides, run a (sync or async) body, then restore every touched key to
// its exact prior state (re-deleting keys that were originally absent).

export type EnvValue = string | undefined;

/**
 * Set or clear a single `process.env` key. `undefined` deletes the key
 * (the only correct way to "unset" it); any string is assigned verbatim.
 */
export function setEnv(key: string, value: EnvValue): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

/**
 * Apply a batch of env overrides for the duration of `body`, then restore each
 * touched key to its original value (deleting keys that were absent before).
 * Restoration runs even if `body` throws or rejects. Returns whatever `body`
 * returns, preserving its sync/async shape.
 */
export function withScopedEnv<T>(vars: Record<string, EnvValue>, body: () => T): T {
  const keys = Object.keys(vars);
  const originals = new Map<string, EnvValue>();
  for (const key of keys) {
    originals.set(key, process.env[key]);
  }

  const restore = (): void => {
    for (const key of keys) {
      setEnv(key, originals.get(key));
    }
  };

  for (const key of keys) {
    setEnv(key, vars[key]);
  }

  let result: T;
  try {
    result = body();
  } catch (error) {
    restore();
    throw error;
  }

  if (result instanceof Promise) {
    return result.finally(restore) as T;
  }

  restore();
  return result;
}
