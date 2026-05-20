#!/usr/bin/env node

import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError } from 'commander';
import { listCommandIds, listPackageDirs, packageTreeStatus } from './package-tree.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');
const pluginRoot = resolve(repoRoot, 'plugins/codex');

type SyncArgs = {
  check: boolean;
  marketplace: string;
  cachePath: string | undefined;
};
type CodexPluginManifest = {
  name: string;
  version: string;
};

function parseArgs(argv: readonly string[]): SyncArgs {
  const program = new Command('sync-codex-cache')
    .exitOverride()
    .configureOutput({ writeErr: () => {} })
    .option('--check')
    .option('--marketplace <name>')
    .option('--cache-path <path>')
    .option('-h, --help');
  try {
    program.parse(argv, { from: 'user' });
  } catch (err) {
    if (err instanceof CommanderError && err.code === 'commander.helpDisplayed') process.exit(0);
    if (err instanceof CommanderError) throw new Error(err.message.replace(/^error: /, ''));
    throw err;
  }

  const opts = program.opts<{
    check?: boolean;
    marketplace?: string;
    cachePath?: string;
    help?: boolean;
  }>();
  return {
    check: opts.check === true,
    marketplace: opts.marketplace ?? 'circuit-local',
    cachePath: opts.cachePath,
  };
}

function readManifest(): CodexPluginManifest {
  const manifestPath = resolve(pluginRoot, '.codex-plugin/plugin.json');
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as CodexPluginManifest;
}

function defaultCachePath(marketplace: string, manifest: CodexPluginManifest): string {
  const codexHome = process.env.CODEX_HOME ?? resolve(homedir(), '.codex');
  return resolve(codexHome, 'plugins/cache', marketplace, manifest.name, manifest.version);
}

function assertSafePathSegment(value: string, label: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(value) || value === '.' || value === '..') {
    throw new Error(`${label} must be a single safe path segment; got ${JSON.stringify(value)}`);
  }
}

function pathEndsWithSegments(path: string, suffix: readonly string[]): boolean {
  const parts = resolve(path)
    .split(/[\\/]+/)
    .filter(Boolean);
  if (parts.length < suffix.length) return false;
  return suffix.every((segment, index) => parts[parts.length - suffix.length + index] === segment);
}

function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel);
}

function assertSafeCacheTarget(
  target: string,
  args: SyncArgs,
  manifest: CodexPluginManifest,
): void {
  assertSafePathSegment(args.marketplace, 'marketplace');
  assertSafePathSegment(manifest.name, 'plugin name');
  assertSafePathSegment(manifest.version, 'plugin version');

  const expectedSuffix = ['plugins', 'cache', args.marketplace, manifest.name, manifest.version];
  if (!pathEndsWithSegments(target, expectedSuffix)) {
    throw new Error(
      `refusing to sync Codex plugin cache outside expected package path suffix: ${expectedSuffix.join('/')}`,
    );
  }

  if (args.cachePath === undefined) {
    const expectedDefault = defaultCachePath(args.marketplace, manifest);
    if (target !== expectedDefault) {
      throw new Error(`refusing to sync unexpected default cache target: ${target}`);
    }
    return;
  }

  const tempRoot = resolve(tmpdir());
  if (!isPathInside(tempRoot, target)) {
    throw new Error('refusing explicit --cache-path outside the system temp directory');
  }
}

function summary(
  status: string,
  target: string,
  tree: ReturnType<typeof packageTreeStatus>,
): Record<string, unknown> {
  return {
    status,
    source: pluginRoot,
    target,
    package_tree: tree,
    check_command: 'npm run check:codex-plugin-cache',
    local_sync_command: 'npm run sync:codex-plugin-cache',
    commands: listCommandIds(pluginRoot),
    skills: listPackageDirs(pluginRoot, 'skills'),
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readManifest();
  const target = args.cachePath
    ? resolve(args.cachePath)
    : defaultCachePath(args.marketplace, manifest);
  assertSafeCacheTarget(target, args, manifest);
  const beforeTree = packageTreeStatus(pluginRoot, target);

  if (args.check) {
    console.log(JSON.stringify(summary(beforeTree.status, target, beforeTree), null, 2));
    process.exit(beforeTree.status === 'ok' ? 0 : 1);
  }

  mkdirSync(dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(pluginRoot, target, { recursive: true });
  const afterTree = packageTreeStatus(pluginRoot, target);
  console.log(
    JSON.stringify(
      summary(afterTree.status === 'ok' ? 'synced' : afterTree.status, target, afterTree),
      null,
      2,
    ),
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}
