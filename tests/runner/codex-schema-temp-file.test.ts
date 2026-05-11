// Codex schema temp-file cleanup-on-throw coverage.
//
// `writeSchemaTempFile` allocates an mkdtemp directory and writes a
// JSON-serialized schema into it. If serialization (or the write itself)
// throws AFTER the directory has been created, the directory MUST be
// cleaned up — otherwise every failed relay leaks a `circuit-codex-
// schema-*` directory under the OS temp dir.

import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { writeSchemaTempFile } from '../../src/connectors/codex.js';

async function countSchemaTempDirs(): Promise<number> {
  const entries = await readdir(tmpdir());
  return entries.filter((entry) => entry.startsWith('circuit-codex-schema-')).length;
}

describe('codex writeSchemaTempFile cleanup', () => {
  it('cleans up the mkdtemp dir when JSON.stringify throws on a BigInt schema', async () => {
    const before = await countSchemaTempDirs();
    // BigInt is not JSON-serializable; JSON.stringify throws synchronously
    // after the temp dir has been allocated. Without cleanup, the dir
    // leaks.
    const badSchema = { weird: 1n } as unknown as Record<string, unknown>;
    await expect(writeSchemaTempFile(badSchema)).rejects.toThrow();
    const after = await countSchemaTempDirs();
    expect(after).toBe(before);
  });

  it('returns dir + path for a well-formed schema and creates a real file', async () => {
    const allocated = await writeSchemaTempFile({ type: 'object' });
    try {
      expect(allocated.dir).toContain('circuit-codex-schema-');
      expect(allocated.path.endsWith('schema.json')).toBe(true);
    } finally {
      // Clean up the dir the test allocated so subsequent test runs start
      // from a clean tmpdir state.
      const { rm } = await import('node:fs/promises');
      await rm(allocated.dir, { recursive: true, force: true });
    }
  });
});
