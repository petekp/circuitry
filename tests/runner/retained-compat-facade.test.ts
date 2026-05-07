import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PUBLIC_RUNTIME_PATHS,
  PUBLIC_RUNTIME_WRAPPER_PATHS,
  type PublicRuntimePathCategory,
} from '../../src/compat/public-runtime-paths.js';
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
import {
  compileSchematicToCompiledFlow as neutralCompileSchematicToCompiledFlow,
  FlowSchematicCompileError as neutralFlowSchematicCompileError,
} from '../../src/flows/compile-schematic-to-flow.js';
import {
  classifyCompiledFlowTask as neutralClassifyCompiledFlowTask,
  classifyTaskAgainstRoutables as neutralClassifyTaskAgainstRoutables,
  deriveRoutingForTesting as neutralDeriveRoutingForTesting,
  ROUTABLE_WORKFLOWS as neutralRoutableWorkflows,
} from '../../src/flows/router.js';
import {
  compileSchematicToCompiledFlow as runtimeCompileSchematicToCompiledFlow,
  FlowSchematicCompileError as runtimeFlowSchematicCompileError,
} from '../../src/runtime/compile-schematic-to-flow.js';
import {
  classifyCompiledFlowTask as runtimeClassifyCompiledFlowTask,
  classifyTaskAgainstRoutables as runtimeClassifyTaskAgainstRoutables,
  deriveRoutingForTesting as runtimeDeriveRoutingForTesting,
  ROUTABLE_WORKFLOWS as runtimeRoutableWorkflows,
} from '../../src/runtime/router.js';

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return collectSourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function collectFiles(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return collectFiles(path, extensions);
    return extensions.some((extension) => path.endsWith(extension)) ? [path] : [];
  });
}

function manifestPathsFor(categories: readonly PublicRuntimePathCategory[]): Set<string> {
  const wrapperPaths = new Set(PUBLIC_RUNTIME_WRAPPER_PATHS.map((entry) => resolve(entry.oldPath)));
  return new Set(
    PUBLIC_RUNTIME_PATHS.filter(
      (entry) => categories.includes(entry.category) && wrapperPaths.has(resolve(entry.oldPath)),
    ).map((entry) => resolve(entry.oldPath)),
  );
}

function collectImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importPattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null = importPattern.exec(source);
  while (match !== null) {
    const specifier = match[1];
    if (specifier) specifiers.push(specifier);
    match = importPattern.exec(source);
  }
  return specifiers;
}

function runtimeSourcePathForImportSpecifier(file: string, specifier: string): string | undefined {
  if (specifier.startsWith('.')) {
    const resolved = resolve(dirname(file), specifier).replace(/\.js$/, '.ts');
    const runtimeRoot = resolve('src/runtime');
    if (resolved === runtimeRoot || resolved.startsWith(`${runtimeRoot}${sep}`)) return resolved;
  }

  const srcRuntimeMatch = specifier.match(/(?:^|\/)src\/runtime\/(.+)\.js$/);
  if (srcRuntimeMatch) return resolve('src/runtime', `${srcRuntimeMatch[1]}.ts`);

  const distRuntimeMatch = specifier.match(/(?:^|\/)dist\/runtime\/(.+)\.js$/);
  if (distRuntimeMatch) return resolve('src/runtime', `${distRuntimeMatch[1]}.ts`);

  return undefined;
}

function oldRuntimeWrapperImportOffenders(input: {
  readonly categories: readonly PublicRuntimePathCategory[];
  readonly files: readonly string[];
  readonly reason: string;
}): string[] {
  const repoRoot = resolve('.');
  const guardedWrapperPaths = manifestPathsFor(input.categories);

  return input.files
    .filter((file) => !guardedWrapperPaths.has(file))
    .flatMap((file) => {
      const specifiers = collectImportSpecifiers(readFileSync(file, 'utf8'));
      return specifiers.flatMap((specifier) => {
        const runtimeSourcePath = runtimeSourcePathForImportSpecifier(file, specifier);
        if (!runtimeSourcePath || !guardedWrapperPaths.has(runtimeSourcePath)) return [];
        return [
          `${file.slice(repoRoot.length + 1)} imports ${specifier} (${input.reason}: ${runtimeSourcePath.slice(
            repoRoot.length + 1,
          )})`,
        ];
      });
    })
    .sort();
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

  it('keeps old runtime router/compiler paths as compatibility re-exports', () => {
    expect(runtimeRoutableWorkflows).toBe(neutralRoutableWorkflows);
    expect(runtimeClassifyCompiledFlowTask).toBe(neutralClassifyCompiledFlowTask);
    expect(runtimeClassifyTaskAgainstRoutables).toBe(neutralClassifyTaskAgainstRoutables);
    expect(runtimeDeriveRoutingForTesting).toBe(neutralDeriveRoutingForTesting);
    expect(runtimeFlowSchematicCompileError).toBe(neutralFlowSchematicCompileError);
    expect(runtimeCompileSchematicToCompiledFlow).toBe(neutralCompileSchematicToCompiledFlow);
  });

  it('keeps CLI and status surfaces off retained checkpoint-folder adapters', () => {
    const cli = readFileSync(resolve('src/cli/circuit.ts'), 'utf8');
    expect(cli).not.toContain('../compat/retained-runtime.js');
    expect(cli).toContain('../shared/retired-runtime-policy.js');
    expect(cli).not.toContain('../compat/retained-checkpoint-folders.js');
    expect(cli).not.toContain('../runtime/runner.js');
    expect(cli).not.toContain('runRetainedCompiledFlow');
    expect(cli).not.toContain('resumeRetainedCompiledFlowCheckpoint');

    const handoff = readFileSync(resolve('src/cli/handoff.ts'), 'utf8');
    expect(handoff).toContain('../shared/retired-runtime-policy.js');
    expect(handoff).not.toContain('../compat/retained-checkpoint-folders.js');
    expect(handoff).not.toContain('../compat/retained-runtime.js');
    expect(handoff).not.toContain('../runtime/snapshot-writer.js');

    const runStatusDispatcher = readFileSync(
      resolve('src/run-status/project-run-folder.ts'),
      'utf8',
    );
    expect(runStatusDispatcher).toContain('../shared/retired-runtime-policy.js');
    expect(runStatusDispatcher).not.toContain('../compat/retained-checkpoint-folders.js');
    expect(runStatusDispatcher).not.toContain('../compat/retained-runtime.js');
    expect(runStatusDispatcher).not.toContain('../runtime/trace-reader.js');
    expect(runStatusDispatcher).not.toContain("'./v1-run-folder.js'");
    expect(existsSync(resolve('src/run-status/v1-run-folder.ts'))).toBe(false);
  });

  it('keeps retained execution and saved-state implementation imports behind the facades in production code', () => {
    const repoRoot = resolve('.');
    const facadePaths = new Set([
      resolve('src/compat/retained-runtime.ts'),
      resolve('src/compat/retained-checkpoint-folders.ts'),
    ]);
    const forbiddenImports = [
      '../runtime/runner.js',
      '../runtime/append-and-derive.js',
      '../runtime/checkpoint-resume.js',
      '../runtime/progress-projector.js',
      '../runtime/reducer.js',
      '../runtime/snapshot-writer.js',
      '../runtime/trace-reader.js',
      '../runtime/trace-writer.js',
      '../runtime/step-handlers/checkpoint.js',
      '../../runtime/runner.js',
      '../../runtime/append-and-derive.js',
      '../../runtime/checkpoint-resume.js',
      '../../runtime/progress-projector.js',
      '../../runtime/reducer.js',
      '../../runtime/snapshot-writer.js',
      '../../runtime/trace-reader.js',
      '../../runtime/trace-writer.js',
      '../../runtime/step-handlers/checkpoint.js',
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

  it('keeps core-v2 and neutral connector code off runtime connector imports', () => {
    const repoRoot = resolve('.');
    const neutralConnectorOffenders = collectSourceFiles(resolve('src/connectors'))
      .flatMap((file) =>
        /from\s+['"][^'"]*runtime\//.test(readFileSync(file, 'utf8'))
          ? [`${file.slice(repoRoot.length + 1)} imports runtime namespace`]
          : [],
      )
      .sort();
    const productionOffenders = oldRuntimeWrapperImportOffenders({
      categories: ['connector-wrapper'],
      files: collectSourceFiles(resolve('src')),
      reason: 'old connector wrapper',
    });

    expect(neutralConnectorOffenders).toEqual([]);
    expect(productionOffenders).toEqual([]);
  });

  it('keeps router/compiler implementation imports on neutral flow ownership', () => {
    const productionSourceOffenders = oldRuntimeWrapperImportOffenders({
      categories: ['flow-authoring-wrapper'],
      files: collectSourceFiles(resolve('src')),
      reason: 'old router/compiler wrapper',
    });
    const scriptOffenders = oldRuntimeWrapperImportOffenders({
      categories: ['flow-authoring-wrapper'],
      files: collectFiles(resolve('scripts'), ['.mjs', '.js', '.ts']),
      reason: 'old router/compiler wrapper',
    });

    expect(productionSourceOffenders).toEqual([]);
    expect(scriptOffenders).toEqual([]);
  });

  it('keeps registry and catalog derivation imports on neutral flow ownership', () => {
    const productionSourceOffenders = oldRuntimeWrapperImportOffenders({
      categories: ['registry-wrapper'],
      files: collectSourceFiles(resolve('src')),
      reason: 'old registry/catalog wrapper',
    });
    const scriptOffenders = oldRuntimeWrapperImportOffenders({
      categories: ['registry-wrapper'],
      files: collectFiles(resolve('scripts'), ['.mjs', '.js', '.ts']),
      reason: 'old registry/catalog wrapper',
    });

    expect(productionSourceOffenders).toEqual([]);
    expect(scriptOffenders).toEqual([]);
  });

  it('keeps run-status implementation imports on the neutral dispatcher', () => {
    const productionSourceOffenders = oldRuntimeWrapperImportOffenders({
      categories: ['run-status-wrapper'],
      files: collectSourceFiles(resolve('src')),
      reason: 'old run-status wrapper',
    });
    const scriptOffenders = oldRuntimeWrapperImportOffenders({
      categories: ['run-status-wrapper'],
      files: collectFiles(resolve('scripts'), ['.mjs', '.js', '.ts']),
      reason: 'old run-status wrapper',
    });

    expect(productionSourceOffenders).toEqual([]);
    expect(scriptOffenders).toEqual([]);
  });

  it('keeps shared helper implementation imports on neutral ownership', () => {
    const productionSourceOffenders = oldRuntimeWrapperImportOffenders({
      categories: ['shared-helper-wrapper'],
      files: collectSourceFiles(resolve('src')),
      reason: 'old shared-helper wrapper',
    });
    const scriptOffenders = oldRuntimeWrapperImportOffenders({
      categories: ['shared-helper-wrapper'],
      files: collectFiles(resolve('scripts'), ['.mjs', '.js', '.ts']),
      reason: 'old shared-helper wrapper',
    });

    expect(productionSourceOffenders).toEqual([]);
    expect(scriptOffenders).toEqual([]);
  });

  it('keeps result-path helper imports on shared ownership outside the old compatibility proof', () => {
    const repoRoot = resolve('.');
    const retainedHandlerOffenders = collectSourceFiles(resolve('src/runtime/step-handlers'))
      .flatMap((file) =>
        readFileSync(file, 'utf8').includes('../result-writer.js')
          ? [file.slice(repoRoot.length + 1)]
          : [],
      )
      .sort();
    const testOffenders = collectSourceFiles(resolve('tests'))
      .filter((file) => file !== resolve('tests/runner/result-path-compat.test.ts'))
      .filter((file) => file !== resolve('tests/runner/retained-compat-facade.test.ts'))
      .flatMap((file) =>
        readFileSync(file, 'utf8').includes('src/runtime/result-writer.js')
          ? [file.slice(repoRoot.length + 1)]
          : [],
      )
      .sort();

    expect(retainedHandlerOffenders).toEqual([]);
    expect(testOffenders).toEqual([]);
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

  it('keeps direct retained trace/status/checkpoint test imports explicit', () => {
    const repoRoot = resolve('.');
    const retainedSavedStateImport =
      /import\s+\{[^}]+\}\s+from\s+['"][^'"]*src\/runtime\/(?:trace-reader|trace-writer|reducer|snapshot-writer|progress-projector|checkpoint-resume|append-and-derive|step-handlers\/checkpoint)\.js['"]/m;

    const imports = collectSourceFiles(resolve('tests'))
      .flatMap((file) =>
        retainedSavedStateImport.test(readFileSync(file, 'utf8'))
          ? [file.slice(repoRoot.length + 1)]
          : [],
      )
      .sort();

    expect(imports).toEqual([
      'tests/contracts/relay-transcript-schema.test.ts',
      'tests/runner/checkpoint-handler-direct.test.ts',
      'tests/runner/run-status-projection.test.ts',
      'tests/unit/runtime/progress-projector.test.ts',
    ]);
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
