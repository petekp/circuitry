import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RunStatusFolderError as facadeError,
  projectRunStatusFromRunFolder as facadeProject,
} from '../../src/run-status/project-run-folder.js';
import {
  RunStatusFolderError as runtimeError,
  projectRunStatusFromRunFolder as runtimeProject,
} from '../../src/runtime/run-status-projection.js';

describe('run-status public facade', () => {
  it('preserves the retained implementation surface while moving CLI imports neutral', () => {
    expect(facadeProject).toBe(runtimeProject);
    expect(facadeError).toBe(runtimeError);

    const runsCli = readFileSync(resolve('src/cli/runs.ts'), 'utf8');
    expect(runsCli).toContain("'../run-status/project-run-folder.js'");
    expect(runsCli).not.toContain("'../runtime/run-status-projection.js'");
  });

  it('keeps v2 projection and retired-folder policy outside the public facade', () => {
    const dispatcher = readFileSync(resolve('src/run-status/project-run-folder.ts'), 'utf8');
    expect(dispatcher).toContain("'./v2-run-folder.js'");
    expect(dispatcher).toContain('../shared/retired-runtime-policy.js');
    expect(dispatcher).not.toContain("'./v1-run-folder.js'");
    expect(dispatcher).not.toContain('../compat/retained-checkpoint-folders.js');
    expect(dispatcher).not.toContain('../compat/retained-runtime.js');
    expect(dispatcher).not.toContain('function projectV1RunStatusFromTrace');
    expect(dispatcher).not.toContain('function projectV2RunStatusFromRunFolder');
    expect(dispatcher).not.toContain('../runtime/trace-reader.js');

    const projectionCommon = readFileSync(resolve('src/run-status/projection-common.ts'), 'utf8');
    expect(projectionCommon).toContain('../shared/result-path.js');
    expect(projectionCommon).not.toContain('../runtime/result-writer.js');

    const v1Projector = readFileSync(resolve('src/run-status/v1-run-folder.ts'), 'utf8');
    expect(v1Projector).toContain('../compat/retained-checkpoint-folders.js');
    expect(v1Projector).not.toContain('../compat/retained-runtime.js');
    expect(v1Projector).toContain('../shared/run-relative-path.js');
    expect(v1Projector).not.toContain('../runtime/reducer.js');
    expect(v1Projector).not.toContain('../runtime/run-relative-path.js');
    expect(v1Projector).not.toContain('../runtime/trace-reader.js');
    expect(v1Projector).not.toContain('../runtime/trace-writer.js');

    const v2Projector = readFileSync(resolve('src/run-status/v2-run-folder.ts'), 'utf8');
    expect(v2Projector).not.toContain('../runtime/reducer.js');
    expect(v2Projector).not.toContain('../runtime/trace-reader.js');
    expect(v2Projector).not.toContain('../runtime/trace-writer.js');
  });
});
