import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Sha256 } from './ref.js';

// Canonical JSON: object keys sorted recursively for stable, order-independent
// serialization. Byte-identical to the former per-module stableJson copies.
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
    );
  });
}

// sha256 hex of an already-in-memory UTF-8 string. == former sha256Hex.
export function sha256OfString(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

// sha256 hex of a value's canonical JSON. == former
// createHash().update(stableJson(value)).digest('hex').
export function sha256OfJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

// sha256 of file CONTENTS, validated as a Sha256 scalar. (Used by SD-FIX-2 next;
// export it now.)
export function sha256OfFile(path: string): Sha256 {
  return Sha256.parse(createHash('sha256').update(readFileSync(path)).digest('hex'));
}
