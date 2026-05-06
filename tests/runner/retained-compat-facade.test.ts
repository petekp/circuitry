import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveRetainedSnapshot as deriveRetainedCheckpointSnapshot,
  readRetainedRunTrace as readRetainedCheckpointRunTrace,
  reduceRetainedRunTrace as reduceRetainedCheckpointRunTrace,
  resumeRetainedCompiledFlowCheckpoint as resumeRetainedCheckpoint,
} from '../../src/compat/retained-checkpoint-folders.js';
import {
  appendAndDeriveRetainedTrace,
  bootstrapRetainedRun,
  claimRetainedFreshRunFolder,
  deriveRetainedSnapshot,
  initRetainedRunFolder,
  readRetainedRunTrace,
  reduceRetainedRunTrace,
  releaseRetainedFreshRunFolderClaim,
  resumeRetainedCompiledFlowCheckpoint,
  runRetainedCompiledFlow,
  writeRetainedComposeReport,
  writeRetainedPrototypeComposeReport,
} from '../../src/compat/retained-runtime.js';

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return collectSourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('retained runtime compatibility facade', () => {
  it('exposes the retained execution and v1 run-folder operations through one neutral module', () => {
    expect(typeof runRetainedCompiledFlow).toBe('function');
    expect(typeof resumeRetainedCompiledFlowCheckpoint).toBe('function');
    expect(typeof deriveRetainedSnapshot).toBe('function');
    expect(typeof readRetainedRunTrace).toBe('function');
    expect(typeof reduceRetainedRunTrace).toBe('function');
    expect(typeof appendAndDeriveRetainedTrace).toBe('function');
    expect(typeof bootstrapRetainedRun).toBe('function');
    expect(typeof initRetainedRunFolder).toBe('function');
    expect(typeof claimRetainedFreshRunFolder).toBe('function');
    expect(typeof releaseRetainedFreshRunFolderClaim).toBe('function');
    expect(typeof writeRetainedComposeReport).toBe('function');
    expect(typeof writeRetainedPrototypeComposeReport).toBe('function');

    const facade = readFileSync(resolve('src/compat/retained-runtime.ts'), 'utf8');
    expect(facade).toContain('../runtime/runner.js');
    expect(facade).toContain('./retained-checkpoint-folders.js');
  });

  it('exposes retained/v1 checkpoint folder operations through a smaller boundary', () => {
    expect(typeof resumeRetainedCheckpoint).toBe('function');
    expect(typeof deriveRetainedCheckpointSnapshot).toBe('function');
    expect(typeof readRetainedCheckpointRunTrace).toBe('function');
    expect(typeof reduceRetainedCheckpointRunTrace).toBe('function');

    const checkpointFacade = readFileSync(
      resolve('src/compat/retained-checkpoint-folders.ts'),
      'utf8',
    );
    expect(checkpointFacade).toContain('../runtime/runner.js');
    expect(checkpointFacade).toContain('../runtime/snapshot-writer.js');
    expect(checkpointFacade).toContain('../runtime/trace-reader.js');
    expect(checkpointFacade).toContain('../runtime/reducer.js');
  });

  it('keeps CLI and status surfaces off direct retained runtime imports', () => {
    const cli = readFileSync(resolve('src/cli/circuit.ts'), 'utf8');
    expect(cli).toContain('../compat/retained-runtime.js');
    expect(cli).toContain('../compat/retained-checkpoint-folders.js');
    expect(cli).not.toContain('../runtime/runner.js');
    expect(cli).toContain('runRetainedCompiledFlow');
    expect(cli).toContain('resumeRetainedCompiledFlowCheckpoint');

    const handoff = readFileSync(resolve('src/cli/handoff.ts'), 'utf8');
    expect(handoff).toContain('../compat/retained-checkpoint-folders.js');
    expect(handoff).not.toContain('../compat/retained-runtime.js');
    expect(handoff).not.toContain('../runtime/snapshot-writer.js');

    const runStatusDispatcher = readFileSync(
      resolve('src/run-status/project-run-folder.ts'),
      'utf8',
    );
    expect(runStatusDispatcher).toContain('../compat/retained-checkpoint-folders.js');
    expect(runStatusDispatcher).not.toContain('../compat/retained-runtime.js');
    expect(runStatusDispatcher).not.toContain('../runtime/trace-reader.js');

    const v1Projection = readFileSync(resolve('src/run-status/v1-run-folder.ts'), 'utf8');
    expect(v1Projection).toContain('../compat/retained-checkpoint-folders.js');
    expect(v1Projection).not.toContain('../compat/retained-runtime.js');
    expect(v1Projection).not.toContain('../runtime/reducer.js');
  });

  it('keeps retained execution implementation imports behind the facade in production code', () => {
    const repoRoot = resolve('.');
    const facadePaths = new Set([
      resolve('src/compat/retained-runtime.ts'),
      resolve('src/compat/retained-checkpoint-folders.ts'),
    ]);
    const forbiddenImports = [
      '../runtime/runner.js',
      '../runtime/reducer.js',
      '../runtime/snapshot-writer.js',
      '../runtime/trace-reader.js',
      '../../runtime/runner.js',
      '../../runtime/reducer.js',
      '../../runtime/snapshot-writer.js',
      '../../runtime/trace-reader.js',
    ];

    const offenders = collectSourceFiles(resolve('src'))
      .filter((file) => !file.startsWith(resolve('src/runtime')))
      .filter((file) => !facadePaths.has(file))
      .flatMap((file) => {
        const text = readFileSync(file, 'utf8');
        return forbiddenImports
          .filter((importPath) => text.includes(importPath))
          .map((importPath) => `${file.slice(repoRoot.length + 1)} imports ${importPath}`);
      });

    expect(offenders).toEqual([]);
  });

  it('keeps retained-execution-only tests on the compatibility facade', () => {
    const migratedTests = [
      'tests/contracts/flow-model-effort.test.ts',
      'tests/runner/build-runtime-wiring.test.ts',
      'tests/runner/build-verification-exec.test.ts',
      'tests/runner/check-evaluation.test.ts',
      'tests/runner/explore-e2e-parity.test.ts',
      'tests/runner/explore-report-writer.test.ts',
      'tests/runner/fanout-real-recursion.test.ts',
      'tests/runner/fanout-runtime.test.ts',
      'tests/runner/handler-throw-recovery.test.ts',
      'tests/runner/materializer-schema-parse.test.ts',
      'tests/runner/migrate-runtime-wiring.test.ts',
      'tests/runner/pass-route-cycle-guard.test.ts',
      'tests/runner/push-sequence-authority.test.ts',
      'tests/runner/relay-invocation-failure.test.ts',
      'tests/runner/review-runtime-wiring.test.ts',
      'tests/runner/run-relative-path.test.ts',
      'tests/runner/runner-relay-connector-identity.test.ts',
      'tests/runner/runner-relay-provenance.test.ts',
      'tests/runner/runtime-smoke.test.ts',
      'tests/runner/sub-run-real-recursion.test.ts',
      'tests/runner/sub-run-runtime.test.ts',
      'tests/runner/sweep-runtime-wiring.test.ts',
      'tests/runner/terminal-verdict-derivation.test.ts',
    ];

    const offenders = migratedTests.filter((file) =>
      readFileSync(resolve(file), 'utf8').includes("from '../../src/runtime/runner.js'"),
    );

    expect(offenders).toEqual([]);
  });

  it('keeps retained execution entrypoints out of direct old runner test imports', () => {
    const repoRoot = resolve('.');
    const directRunnerExecutionImport =
      /import\s+\{[^}]*\b(?:runCompiledFlow|resumeCompiledFlowCheckpoint)\b[^}]*\}\s+from\s+['"][^'"]*src\/runtime\/runner\.js['"]/m;

    const offenders = collectSourceFiles(resolve('tests'))
      .flatMap((file) =>
        directRunnerExecutionImport.test(readFileSync(file, 'utf8'))
          ? [file.slice(repoRoot.length + 1)]
          : [],
      )
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps retained saved-folder test imports on the checkpoint-folder boundary', () => {
    const repoRoot = resolve('.');
    const broadSavedFolderImport =
      /import\s+\{[^}]*\b(?:resumeRetainedCompiledFlowCheckpoint|deriveRetainedSnapshot|readRetainedRunTrace|reduceRetainedRunTrace)\b[^}]*\}\s+from\s+['"][^'"]*src\/compat\/retained-runtime\.js['"]/m;

    const offenders = collectSourceFiles(resolve('tests'))
      .filter((file) => file !== resolve('tests/runner/retained-compat-facade.test.ts'))
      .flatMap((file) =>
        broadSavedFolderImport.test(readFileSync(file, 'utf8'))
          ? [file.slice(repoRoot.length + 1)]
          : [],
      )
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps direct old runner test imports limited to the explicit compose report compatibility proof', () => {
    const repoRoot = resolve('.');
    const directRunnerImport =
      /import\s+\{[^}]+\}\s+from\s+['"][^'"]*src\/runtime\/runner\.js['"]/m;

    const offenders = collectSourceFiles(resolve('tests'))
      .filter((file) => file !== resolve('tests/runner/retained-compat-facade.test.ts'))
      .flatMap((file) =>
        directRunnerImport.test(readFileSync(file, 'utf8'))
          ? [file.slice(repoRoot.length + 1)]
          : [],
      )
      .sort();

    expect(offenders).toEqual(['tests/runner/fix-report-writer.test.ts']);
  });
});
