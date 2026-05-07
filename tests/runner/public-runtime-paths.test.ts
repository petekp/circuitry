import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PUBLIC_RUNTIME_PATHS,
  PUBLIC_RUNTIME_RETAINED_PATHS,
  PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS,
  PUBLIC_RUNTIME_WRAPPER_PATHS,
} from '../../src/compat/public-runtime-paths.js';

function collectSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const repoRoot = `${resolve('.')}${sep}`;
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return collectSourceFiles(path);
    return path.endsWith('.ts') ? [path.replace(repoRoot, '').replaceAll(sep, '/')] : [];
  });
}

function importPathFrom(oldPath: string, ownerPath: string): string {
  const rel = relative(dirname(oldPath), ownerPath).replaceAll(sep, '/').replace(/\.ts$/, '.js');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

describe('public runtime import-path manifest', () => {
  it('covers every source file under src/runtime', () => {
    const runtimeFiles = collectSourceFiles('src/runtime').sort();
    const manifestFiles = PUBLIC_RUNTIME_PATHS.map((entry) => entry.oldPath).sort();

    expect(manifestFiles).toEqual(runtimeFiles);
  });

  it('keeps every declared old path and compatibility proof visible', () => {
    const seen = new Set<string>();

    for (const entry of PUBLIC_RUNTIME_PATHS) {
      expect(seen.has(entry.oldPath), `duplicate manifest entry for ${entry.oldPath}`).toBe(false);
      seen.add(entry.oldPath);
      expect(existsSync(entry.oldPath), `${entry.oldPath} exists`).toBe(true);
      expect(entry.requiresReviewBeforeDeletion).toBe(true);
      expect(entry.notes.length, `${entry.oldPath} explains why it exists`).toBeGreaterThan(0);
      expect(
        entry.compatibilityTestPaths.length,
        `${entry.oldPath} has compatibility tests`,
      ).toBeGreaterThan(0);
      for (const testPath of entry.compatibilityTestPaths) {
        expect(existsSync(testPath), `${entry.oldPath} test ${testPath} exists`).toBe(true);
      }
    }
  });

  it('proves wrapper paths are re-exports of their declared owners', () => {
    for (const entry of PUBLIC_RUNTIME_WRAPPER_PATHS) {
      expect(entry.currentOwnerPath, `${entry.oldPath} declares an owner`).toEqual(
        expect.any(String),
      );
      expect(existsSync(entry.currentOwnerPath as string), `${entry.currentOwnerPath} exists`).toBe(
        true,
      );
      const oldPathSource = readFileSync(entry.oldPath, 'utf8');
      const expectedImport = importPathFrom(entry.oldPath, entry.currentOwnerPath as string);
      expect(oldPathSource, `${entry.oldPath} exports from ${expectedImport}`).toContain(
        expectedImport,
      );
      expect(oldPathSource, `${entry.oldPath} is an export surface`).toContain('export');
    }
  });

  it('keeps retained-owned paths separate from wrapper retirement candidates', () => {
    for (const entry of PUBLIC_RUNTIME_RETAINED_PATHS) {
      expect(entry.currentOwnerPath, `${entry.oldPath} should not declare neutral owner`).toBe(
        undefined,
      );
      expect(entry.currentDisposition, `${entry.oldPath} is retained-owned`).toBe('retained-owned');
    }

    expect(PUBLIC_RUNTIME_RETAINED_PATHS).toEqual([]);
  });

  it('keeps wrapper categories explicit for later staged retirement decisions', () => {
    const categories = new Set(PUBLIC_RUNTIME_PATHS.map((entry) => entry.category));

    expect(categories).toEqual(new Set());

    expect(
      PUBLIC_RUNTIME_WRAPPER_PATHS.filter(
        (entry) => entry.currentDisposition === 'future-deprecation-candidate',
      ).map((entry) => entry.oldPath),
    ).toEqual([]);
  });

  it('marks only the approved low-risk wrapper paths as soft-deprecated', () => {
    const softDeprecatedPaths = PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS.map(
      (entry) => entry.oldPath,
    ).sort();

    expect(softDeprecatedPaths).toEqual([]);

    for (const entry of PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS) {
      expect(entry.currentOwnerPath, `${entry.oldPath} has replacement owner`).toEqual(
        expect.any(String),
      );
      expect(entry.currentDisposition, `${entry.oldPath} remains a candidate only`).toBe(
        'future-deprecation-candidate',
      );
      expect(entry.requiresReviewBeforeDeletion).toBe(true);
      expect(entry.compatibilityTestPaths.length, `${entry.oldPath} keeps proof`).toBeGreaterThan(
        0,
      );
    }
  });

  it('keeps sensitive old runtime categories out of soft deprecation', () => {
    const nonDeprecatedCategories = new Set();
    const incorrectlyDeprecated = PUBLIC_RUNTIME_PATHS.filter(
      (entry) =>
        nonDeprecatedCategories.has(entry.category) && entry.deprecationStage === 'soft-deprecated',
    ).map((entry) => entry.oldPath);

    expect(incorrectlyDeprecated).toEqual([]);
    expect(
      PUBLIC_RUNTIME_PATHS.find((entry) => entry.oldPath === 'src/runtime/result-writer.ts'),
    ).toBeUndefined();
    expect(
      PUBLIC_RUNTIME_PATHS.find((entry) => entry.oldPath === 'src/runtime/checkpoint-resume.ts'),
    ).toBeUndefined();
    expect(
      PUBLIC_RUNTIME_PATHS.find((entry) => entry.oldPath === 'src/runtime/runner.ts'),
    ).toBeUndefined();
  });

  it('does not add import-time warning scaffolding to soft-deprecated wrappers', () => {
    for (const entry of PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS) {
      const source = readFileSync(entry.oldPath, 'utf8');
      expect(source, `${entry.oldPath} should not warn at import time`).not.toContain(
        'process.emitWarning',
      );
      expect(source, `${entry.oldPath} should not warn at import time`).not.toContain(
        'console.warn',
      );
      expect(source, `${entry.oldPath} should not warn at import time`).not.toContain(
        'DeprecationWarning',
      );
    }
  });

  it('keeps the public import-path policy note aligned with the manifest', () => {
    const policy = readFileSync(
      'docs/architecture/v2-public-runtime-import-path-policy.md',
      'utf8',
    );

    expect(PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS).toEqual([]);
    expect(policy).toContain(
      'There are no remaining release-note-only soft-deprecated wrapper paths.',
    );
    expect(policy).toContain('docs/release/deprecations/public-runtime-import-paths.md');
  });

  it('keeps the release deprecation note aligned with the manifest', () => {
    const releaseNotePath = 'docs/release/deprecations/public-runtime-import-paths.md';
    expect(existsSync(releaseNotePath), `${releaseNotePath} exists`).toBe(true);

    const releaseNote = readFileSync(releaseNotePath, 'utf8');

    expect(PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS).toEqual([]);
    expect(releaseNote).toContain(
      'There are no remaining release-note-only soft-deprecated wrapper paths.',
    );
    expect(releaseNote).toContain('connector wrappers');
    expect(releaseNote).toContain('run-status wrapper');
    expect(releaseNote).toContain('progress projection wrapper');
    expect(releaseNote).toContain('src/run-status/project-run-folder.ts');
    expect(releaseNote).toContain('result writer wrapper');
    expect(releaseNote).toContain('old public runner surface');
    expect(releaseNote).toContain('no longer part of the old public import-path surface');
  });

  it('keeps build/package visibility assumptions explicit', () => {
    const tsconfigBuild = JSON.parse(readFileSync('tsconfig.build.json', 'utf8')) as {
      include?: string[];
      exclude?: string[];
    };
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      exports?: unknown;
      private?: unknown;
    };

    expect(tsconfigBuild.include).toContain('src/**/*.ts');
    expect(tsconfigBuild.exclude).toContain('tests');
    expect(packageJson.private).toBe(true);
    expect(packageJson.exports).toBeUndefined();
  });

  it('keeps wrapper retirement explicit after the last wrapper is removed', () => {
    const guardSource = readFileSync('tests/runner/retained-compat-facade.test.ts', 'utf8');

    expect(PUBLIC_RUNTIME_WRAPPER_PATHS).toEqual([]);
    expect(guardSource).not.toContain("from '../../src/compat/public-runtime-paths.js'");
    expect(guardSource).not.toContain('PUBLIC_RUNTIME_PATHS');
    expect(guardSource).not.toContain('PUBLIC_RUNTIME_WRAPPER_PATHS');
  });
});
