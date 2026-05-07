import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveRunRelative } from './run-relative-path.js';

export function writeJsonReport(runFolder: string, path: string, body: unknown): void {
  const abs = resolveRunRelative(runFolder, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}
