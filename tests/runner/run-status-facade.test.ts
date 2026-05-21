import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RunStatusFolderError,
  projectRunStatusFromRunFolder,
} from '../../src/run-status/run-folder-projector.js';

describe('run-status public facade', () => {
  it('keeps CLI imports on the neutral status dispatcher', () => {
    const runsCli = readFileSync(resolve('src/cli/runs.ts'), 'utf8');
    expect(runsCli).toContain("'../run-status/run-folder-projector.js'");
    expect(runsCli).not.toContain("'../runtime/run-status-projection.js'");
    expect(existsSync(resolve('src/runtime/run-status-projection.ts'))).toBe(false);
    expect(projectRunStatusFromRunFolder).toEqual(expect.any(Function));
    expect(RunStatusFolderError).toEqual(expect.any(Function));
  });

  it('keeps runtime projection and folder policy outside the public facade', () => {
    const dispatcher = readFileSync(resolve('src/run-status/run-folder-projector.ts'), 'utf8');
    expect(dispatcher).toContain("'./runtime-run-folder.js'");
    expect(dispatcher).not.toContain("'./v1-run-folder.js'");
    expect(dispatcher).not.toContain('../compat/kept-checkpoint-folders.js');
    expect(dispatcher).not.toContain('../compat/unsupported runtime.js');
    expect(dispatcher).not.toContain('function projectV1RunStatusFromTrace');
    expect(dispatcher).not.toContain('function projectRuntimeRunStatusFromRunFolder');
    expect(dispatcher).not.toContain('../runtime/trace-reader.js');

    const projectionCommon = readFileSync(resolve('src/run-status/projection-common.ts'), 'utf8');
    expect(projectionCommon).toContain('../shared/result-path.js');
    expect(projectionCommon).not.toContain('../runtime/result-writer.js');

    expect(existsSync(resolve('src/run-status/v1-run-folder.ts'))).toBe(false);

    const runtimeProjector = readFileSync(resolve('src/run-status/runtime-run-folder.ts'), 'utf8');
    expect(runtimeProjector).not.toContain('../runtime/reducer.js');
    expect(runtimeProjector).not.toContain('../runtime/trace-reader.js');
    expect(runtimeProjector).not.toContain('../runtime/trace-writer.js');
  });
});
