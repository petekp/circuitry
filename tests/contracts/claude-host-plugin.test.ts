import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const REPO_ROOT = resolve('.');
const PLUGIN_ROOT = resolve(REPO_ROOT, 'plugins/claude');
const GENERATED_FLOW_MIRROR_ROOT_ENV = 'CIRCUIT_GENERATED_FLOW_MIRROR_ROOT';
const EXPECTED_CLAUDE_COMMANDS = [
  'build',
  'create',
  'explore',
  'fix',
  'handoff',
  'migrate',
  'review',
  'run',
  'sweep',
];

const PluginManifest = z
  .object({
    name: z.literal('circuit'),
    version: z.string().min(1),
    description: z.string().min(1),
  })
  .passthrough();

const VersionManifest = z.object({ version: z.string().min(1) });
const MarketplaceManifest = z.object({
  name: z.literal('circuit-next'),
  owner: z.object({ name: z.literal('Pete Petrash') }),
  plugins: z.array(
    z.object({
      name: z.literal('circuit'),
      version: z.string().min(1),
      source: z.literal('./plugins/claude'),
    }),
  ),
});

function collectJsonFiles(root: string, prefix = ''): string[] {
  const entries = readdirSync(resolve(root, prefix), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const rel = join(prefix, entry.name);
    if (entry.isDirectory()) return collectJsonFiles(root, rel);
    return entry.isFile() && entry.name.endsWith('.json') ? [rel] : [];
  });
}

describe('Claude Code host plugin package', () => {
  it('declares a self-contained Claude Code plugin package', () => {
    const manifestPath = resolve(PLUGIN_ROOT, '.claude-plugin/plugin.json');
    const manifest = PluginManifest.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));

    expect(manifest.description).toContain('/circuit:run');
    expect(manifest).not.toHaveProperty('hooks');
    expect(existsSync(resolve(PLUGIN_ROOT, 'hooks/hooks.json'))).toBe(true);
    expect(existsSync(resolve(PLUGIN_ROOT, 'hooks/session-start.mjs'))).toBe(true);
    expect(existsSync(resolve(PLUGIN_ROOT, 'scripts/circuit-next.mjs'))).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, 'hooks'))).toBe(false);
    expect(existsSync(resolve(REPO_ROOT, 'commands'))).toBe(false);
  });

  it('ships a root Claude marketplace entry that matches the plugin version', () => {
    const versionManifest = VersionManifest.parse(
      JSON.parse(readFileSync(resolve(REPO_ROOT, 'plugins/version.json'), 'utf8')),
    );
    const pluginManifest = PluginManifest.parse(
      JSON.parse(readFileSync(resolve(PLUGIN_ROOT, '.claude-plugin/plugin.json'), 'utf8')),
    );
    const marketplace = MarketplaceManifest.parse(
      JSON.parse(readFileSync(resolve(REPO_ROOT, '.claude-plugin/marketplace.json'), 'utf8')),
    );

    expect(pluginManifest.version).toBe(versionManifest.version);
    expect(marketplace.plugins).toContainEqual({
      name: 'circuit',
      version: versionManifest.version,
      source: './plugins/claude',
    });
    expect(marketplace.owner.name).toBe('Pete Petrash');
  });

  it('exposes Claude Code command files that invoke the installed plugin wrapper', () => {
    for (const command of EXPECTED_CLAUDE_COMMANDS) {
      const commandPath = resolve(PLUGIN_ROOT, `commands/${command}.md`);
      expect(existsSync(commandPath)).toBe(true);
      const commandMarkdown = readFileSync(commandPath, 'utf8');

      expect(commandMarkdown).toContain('node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs"');
      expect(commandMarkdown).toContain('--progress jsonl');
      expect(commandMarkdown).not.toContain('./bin/circuit-next');
      expect(commandMarkdown).not.toContain('repo-local launcher');
    }
  });

  it('mirrors every public canonical generated flow JSON file into the Claude package', () => {
    const canonicalRoot = resolve(REPO_ROOT, 'generated/flows');
    const claudeRoot = resolve(PLUGIN_ROOT, 'skills');
    const canonicalFiles = collectJsonFiles(canonicalRoot).sort();
    const claudeFiles = collectJsonFiles(claudeRoot).sort();

    expect(claudeFiles).toEqual(
      canonicalFiles.filter((file) => !file.startsWith('runtime-proof/')),
    );

    for (const file of claudeFiles) {
      const canonical = readFileSync(resolve(canonicalRoot, file));
      const claude = readFileSync(resolve(claudeRoot, file));
      expect(claude, file).toEqual(canonical);
    }
    expect(existsSync(resolve(PLUGIN_ROOT, 'skills/runtime-proof'))).toBe(false);
  });

  it('wrapper runs from a target repo and injects the packaged Claude flow root', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-'));
    try {
      const binDir = join(tempDir, 'bin');
      const argvPath = join(tempDir, 'argv.json');
      const fakeBin = join(binDir, 'circuit-next');
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        fakeBin,
        `#!/usr/bin/env node\nconst { writeFileSync } = require('node:fs');\nwriteFileSync(${JSON.stringify(
          argvPath,
        )}, JSON.stringify({ argv: process.argv.slice(2), marker: process.env.${GENERATED_FLOW_MIRROR_ROOT_ENV} ?? null, cwd: process.cwd() }));\n`,
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [
          resolve(PLUGIN_ROOT, 'scripts/circuit-next.mjs'),
          'run',
          'review',
          '--goal',
          'outside repo',
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
            [GENERATED_FLOW_MIRROR_ROOT_ENV]: 'stale-parent-marker',
          },
        },
      );

      expect(result.status, result.stderr).toBe(0);
      const capture = JSON.parse(readFileSync(argvPath, 'utf8')) as {
        argv: string[];
        marker: string | null;
        cwd: string;
      };
      expect(capture.argv).toEqual([
        'run',
        'review',
        '--goal',
        'outside repo',
        '--flow-root',
        resolve(PLUGIN_ROOT, 'skills'),
      ]);
      expect(capture.marker).toBe(resolve(PLUGIN_ROOT, 'skills'));
      expect(realpathSync(capture.cwd)).toBe(realpathSync(tempDir));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('doctor verifies the installed Claude Code host package from a target repo', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-doctor-'));
    try {
      const result = spawnSync(
        process.execPath,
        [resolve(PLUGIN_ROOT, 'scripts/circuit-next.mjs'), 'doctor'],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${resolve(REPO_ROOT, 'bin')}${delimiter}${process.env.PATH ?? ''}`,
          },
        },
      );

      expect(result.status, result.stderr).toBe(0);
      const output = JSON.parse(result.stdout) as {
        status: string;
        checks: Array<{ name: string; ok: boolean }>;
      };
      expect(output.status).toBe('ok');
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'plugin_manifest_shape', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'session_start_hook_exists', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'packaged_flow_review', ok: true }),
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
