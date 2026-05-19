#!/usr/bin/env node

import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCommandIds, listPackageDirs, packageTreeStatus } from './plugin-package-tree.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const pluginRoot = resolve(repoRoot, 'plugins/circuit');

function parseArgs(argv) {
  const parsed = {
    check: false,
    marketplace: 'circuit-local',
    cachePath: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') {
      parsed.check = true;
    } else if (arg === '--marketplace') {
      parsed.marketplace = argv[++i];
    } else if (arg === '--cache-path') {
      parsed.cachePath = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/sync-codex-plugin-cache.mjs [--check] [--marketplace <name>] [--cache-path <path>]

Copies the repo-local Codex plugin package into Codex's local plugin cache.

Defaults:
  marketplace: circuit-local
  cache root:  $CODEX_HOME/plugins/cache or ~/.codex/plugins/cache

Options:
  --check       compare package bytes with the cache and exit non-zero on drift
  --cache-path  explicit target package path, useful for tests
`);
}

function readManifest() {
  const manifestPath = resolve(pluginRoot, '.codex-plugin/plugin.json');
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function defaultCachePath(marketplace, manifest) {
  const codexHome = process.env.CODEX_HOME ?? resolve(homedir(), '.codex');
  return resolve(codexHome, 'plugins/cache', marketplace, manifest.name, manifest.version);
}

function assertSafePathSegment(value, label) {
  if (!/^[A-Za-z0-9._-]+$/.test(value) || value === '.' || value === '..') {
    throw new Error(`${label} must be a single safe path segment; got ${JSON.stringify(value)}`);
  }
}

function pathEndsWithSegments(path, suffix) {
  const parts = resolve(path)
    .split(/[\\/]+/)
    .filter(Boolean);
  if (parts.length < suffix.length) return false;
  return suffix.every((segment, index) => parts[parts.length - suffix.length + index] === segment);
}

function isPathInside(parent, child) {
  const rel = relative(parent, child);
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel);
}

function assertSafeCacheTarget(target, args, manifest) {
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

function summary(status, target, tree) {
  return {
    status,
    source: pluginRoot,
    target,
    package_tree: tree,
    check_command: 'npm run check:codex-plugin-cache',
    local_sync_command: 'npm run sync:codex-plugin-cache',
    git_marketplace_refresh: 'codex plugin marketplace upgrade circuit-local',
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
