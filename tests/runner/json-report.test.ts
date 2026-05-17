import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeJsonReport } from '../../src/shared/json-report.js';

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'circuit-json-report-'));
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

describe('JSON report helper', () => {
  it('writes formatted JSON reports under the run folder', () => {
    writeJsonReport(runFolder, 'reports/example.json', { verdict: 'ok' });

    const path = join(runFolder, 'reports', 'example.json');
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe('{\n  "verdict": "ok"\n}\n');
  });

  it('still rejects escaping report paths', () => {
    expect(() => writeJsonReport(runFolder, '../escaped.json', {})).toThrow(/run-relative path/i);
    expect(existsSync(join(runFolder, '..', 'escaped.json'))).toBe(false);
  });
});
