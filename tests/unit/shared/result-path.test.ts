import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { RUN_RESULT_RELATIVE_PATH, runResultPath } from '../../../src/shared/result-path.js';

describe('shared run result path helper', () => {
  it('points at the canonical close result path', () => {
    const runFolder = join('/tmp', 'circuit-run-result-path-test');

    expect(RUN_RESULT_RELATIVE_PATH).toBe('reports/result.json');
    expect(runResultPath(runFolder)).toBe(join(runFolder, 'reports', 'result.json'));
  });
});
