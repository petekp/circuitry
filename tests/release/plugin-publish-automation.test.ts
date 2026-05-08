import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type CommandInvocation, runPublish } from '../../scripts/publish-plugins.ts';

const REPO_ROOT = resolve('.');

type FixtureOptions = {
  version?: string;
  claudeVersion?: string;
  codexVersion?: string;
  marketplaceName?: string;
};

type GitFixture = {
  branch?: string;
  upstream?: string;
  head?: string;
  originHead?: string;
  dirty?: string;
};

function writeJson(path: string, value: unknown): void {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture(options: FixtureOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'circuit-publish-test-'));
  const version = options.version ?? '0.1.0-alpha.2';
  const claudeVersion = options.claudeVersion ?? version;
  const codexVersion = options.codexVersion ?? version;
  const marketplaceName = options.marketplaceName ?? 'circuit-next';

  writeJson(join(root, 'package.json'), {
    scripts: {
      'publish:plugins': 'node scripts/publish-plugins.ts check',
      'publish:plugins:bump': 'node scripts/publish-plugins.ts bump',
      'publish:plugins:check': 'node scripts/publish-plugins.ts check',
      'publish:plugins:local': 'node scripts/publish-plugins.ts local',
      'publish:plugins:release':
        'node scripts/publish-plugins.ts release --codex-source petekp/circuit-next --codex-marketplace circuit-next',
    },
  });
  writeJson(join(root, 'plugins/version.json'), { version });
  writeJson(join(root, 'plugins/claude/.claude-plugin/plugin.json'), {
    name: 'circuit',
    version: claudeVersion,
    description: 'Claude plugin',
  });
  writeJson(join(root, 'plugins/circuit/.codex-plugin/plugin.json'), {
    name: 'circuit',
    version: codexVersion,
    description: 'Codex plugin',
    homepage: 'https://github.com/petekp/circuit-next',
    repository: 'https://github.com/petekp/circuit-next',
    skills: './skills/',
    interface: {
      displayName: 'Circuit',
      shortDescription: 'Choose and run the right Circuit flow',
      longDescription: 'Use @Circuit with a natural-language coding task.',
      category: 'Coding',
      capabilities: ['Interactive', 'Write'],
      defaultPrompt: ['Use Circuit on this task'],
    },
  });
  writeJson(join(root, '.claude-plugin/marketplace.json'), {
    name: 'circuit-next',
    owner: { name: 'Pete Petrash' },
    plugins: [
      {
        name: 'circuit',
        version: claudeVersion,
        source: './plugins/claude',
      },
    ],
  });
  writeJson(join(root, '.agents/plugins/marketplace.json'), {
    name: marketplaceName,
    plugins: [
      {
        name: 'circuit',
        source: { source: 'local', path: './plugins/circuit' },
        policy: { installation: 'INSTALLED_BY_DEFAULT', authentication: 'ON_INSTALL' },
        category: 'Coding',
      },
    ],
  });

  return root;
}

function createRunner(git: GitFixture = {}) {
  const calls: CommandInvocation[] = [];
  const branch = git.branch ?? 'main';
  const upstream = git.upstream ?? 'origin/main';
  const head = git.head ?? 'abc123';
  const originHead = git.originHead ?? head;
  const dirty = git.dirty ?? '';

  return {
    calls,
    runner(invocation: CommandInvocation) {
      calls.push(invocation);
      switch (invocation.id) {
        case 'git_status':
          return { exitCode: 0, stdout: dirty, stderr: '' };
        case 'git_branch':
          return { exitCode: 0, stdout: `${branch}\n`, stderr: '' };
        case 'git_upstream':
          return { exitCode: 0, stdout: `${upstream}\n`, stderr: '' };
        case 'git_head':
          return { exitCode: 0, stdout: `${head}\n`, stderr: '' };
        case 'git_origin_head':
          return { exitCode: 0, stdout: `${originHead}\n`, stderr: '' };
        case 'claude_doctor':
        case 'codex_doctor':
        case 'claude_install_smoke_doctor':
          return {
            exitCode: 0,
            stdout: `${JSON.stringify({
              status: 'ok',
              runtime_source: 'bundled',
              runtime_path: '/tmp/plugin/runtime/circuit-next.js',
            })}\n`,
            stderr: '',
          };
        default:
          return { exitCode: 0, stdout: '', stderr: '' };
      }
    },
  };
}

function ids(calls: CommandInvocation[]): string[] {
  return calls.map((call) => call.id);
}

describe('plugin publish automation', () => {
  it('exposes package scripts for check, local, and release targets', () => {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['publish:plugins']).toBe('node scripts/publish-plugins.ts check');
    expect(pkg.scripts['publish:plugins:bump']).toBe('node scripts/publish-plugins.ts bump');
    expect(pkg.scripts['publish:plugins:check']).toBe('node scripts/publish-plugins.ts check');
    expect(pkg.scripts['publish:plugins:local']).toBe('node scripts/publish-plugins.ts local');
    expect(pkg.scripts['publish:plugins:release']).toBe(
      'node scripts/publish-plugins.ts release --codex-source petekp/circuit-next --codex-marketplace circuit-next',
    );
  });

  it('reads plugin manifests and marketplace metadata into the report', () => {
    const root = createFixture();
    const { runner } = createRunner();
    try {
      const report = runPublish(['check', '--skip-verify', '--allow-unsafe'], {
        repoRoot: root,
        runner,
      });

      expect(report.status).toBe('passed');
      expect(report.versions).toMatchObject({
        source: '0.1.0-alpha.2',
        claude: '0.1.0-alpha.2',
        codex: '0.1.0-alpha.2',
        claude_marketplace: '0.1.0-alpha.2',
      });
      expect(report.outputs).toMatchObject({
        codex_marketplace: 'circuit-next',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('bumps every plugin version file explicitly without running validation', () => {
    const root = createFixture();
    const { calls, runner } = createRunner();
    try {
      const report = runPublish(['bump', '--version', '0.1.0-alpha.3'], {
        repoRoot: root,
        runner,
      });

      expect(report.status).toBe('passed');
      expect(report.outputs).toMatchObject({
        bumped_version: '0.1.0-alpha.3',
      });
      expect(ids(calls)).not.toContain('verify');
      expect(JSON.parse(readFileSync(join(root, 'plugins/version.json'), 'utf8'))).toMatchObject({
        version: '0.1.0-alpha.3',
      });
      expect(
        JSON.parse(readFileSync(join(root, 'plugins/claude/.claude-plugin/plugin.json'), 'utf8')),
      ).toMatchObject({ version: '0.1.0-alpha.3' });
      expect(
        JSON.parse(readFileSync(join(root, 'plugins/circuit/.codex-plugin/plugin.json'), 'utf8')),
      ).toMatchObject({ version: '0.1.0-alpha.3' });
      expect(
        JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8')),
      ).toMatchObject({
        plugins: [expect.objectContaining({ name: 'circuit', version: '0.1.0-alpha.3' })],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects plugin bumps without an explicit semver version', () => {
    const root = createFixture();
    const { runner } = createRunner();
    try {
      const missing = runPublish(['bump'], { repoRoot: root, runner });
      const invalid = runPublish(['bump', '--version', 'next'], { repoRoot: root, runner });

      expect(missing.status).toBe('failed');
      expect(missing.errors.join('\n')).toContain('bump requires --version');
      expect(invalid.status).toBe('failed');
      expect(invalid.errors.join('\n')).toContain('--version must be a semver string');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails release on version mismatch but only warns for check/local', () => {
    const root = createFixture({ codexVersion: '0.1.0' });
    const { runner } = createRunner();
    try {
      const check = runPublish(['check', '--skip-verify', '--allow-unsafe'], {
        repoRoot: root,
        runner,
      });
      expect(check.status).toBe('passed');
      expect(check.warnings.join('\n')).toContain('version mismatch');

      const release = runPublish(
        ['release', '--codex-source', 'petekp/circuit-next', '--codex-marketplace', 'circuit-next'],
        {
          repoRoot: root,
          runner,
        },
      );
      expect(release.status).toBe('failed');
      expect(release.errors.join('\n')).toContain('version mismatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks unsafe release preconditions before publish effects', () => {
    const cases: Array<{ name: string; git?: GitFixture; args?: string[]; error: string }> = [
      { name: 'dirty tree', git: { dirty: '?? file\n' }, error: 'working tree must be clean' },
      {
        name: 'non-main branch',
        git: { branch: 'feature' },
        error: 'release requires branch main',
      },
      {
        name: 'stale origin/main',
        git: { originHead: 'def456' },
        error: 'HEAD must match origin/main',
      },
      {
        name: 'local source',
        args: ['--codex-source', './', '--codex-marketplace', 'circuit-next'],
        error: 'remote Codex source',
      },
      {
        name: 'local marketplace name',
        args: [
          '--codex-source',
          'petekp/circuit-next',
          '--codex-marketplace',
          'circuit-next-local',
        ],
        error: 'must not end in -local',
      },
      {
        name: 'allow dirty option',
        args: [
          '--allow-dirty',
          '--codex-source',
          'petekp/circuit-next',
          '--codex-marketplace',
          'circuit-next',
        ],
        error: 'release does not allow --allow-dirty',
      },
    ];

    for (const testCase of cases) {
      const root = createFixture({
        marketplaceName: testCase.args?.includes('circuit-next-local')
          ? 'circuit-next-local'
          : 'circuit-next',
      });
      const { calls, runner } = createRunner(testCase.git);
      try {
        const report = runPublish(
          [
            'release',
            ...(testCase.args ?? [
              '--codex-source',
              'petekp/circuit-next',
              '--codex-marketplace',
              'circuit-next',
            ]),
          ],
          {
            repoRoot: root,
            runner,
          },
        );

        expect(report.status, testCase.name).toBe('failed');
        expect(report.errors.join('\n'), testCase.name).toContain(testCase.error);
        expect(ids(calls), testCase.name).not.toContain('claude_tag_push');
        expect(ids(calls), testCase.name).not.toContain('codex_marketplace_add_release');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('keeps check and release read-only with respect to generated surfaces', () => {
    const root = createFixture();
    const { calls, runner } = createRunner();
    try {
      runPublish(['check'], { repoRoot: root, runner });
      runPublish(
        ['release', '--codex-source', 'petekp/circuit-next', '--codex-marketplace', 'circuit-next'],
        {
          repoRoot: root,
          runner,
        },
      );

      expect(ids(calls)).toContain('check_flow_drift');
      expect(ids(calls)).not.toContain('emit_flows');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lets local publish opt into generated writes and Codex cache sync', () => {
    const root = createFixture();
    const { calls, runner } = createRunner();
    try {
      const report = runPublish(['local', '--write-generated'], { repoRoot: root, runner });

      expect(report.status).toBe('passed');
      expect(ids(calls)).toEqual(
        expect.arrayContaining(['emit_flows', 'codex_cache_sync', 'codex_cache_check']),
      );
      expect(ids(calls)).not.toContain('codex_marketplace_add_local');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('installs Claude in a temporary home and fails duplicate hook load errors', () => {
    const root = createFixture();
    const { calls, runner: baseRunner } = createRunner();
    const runner = (invocation: CommandInvocation) => {
      if (invocation.id === 'claude_install_smoke_list') {
        calls.push(invocation);
        return {
          exitCode: 0,
          stdout: '1 error:\nFailed to load hooks: Duplicate hooks file detected\n',
          stderr: '',
        };
      }
      return baseRunner(invocation);
    };
    try {
      const report = runPublish(['check'], { repoRoot: root, runner });

      expect(report.status).toBe('failed');
      expect(report.errors.join('\n')).toContain('Claude install smoke');
      expect(ids(calls)).toEqual(
        expect.arrayContaining([
          'claude_install_smoke_marketplace_add',
          'claude_install_smoke_install',
          'claude_install_smoke_list',
        ]),
      );
      const smokeAdd = calls.find((call) => call.id === 'claude_install_smoke_marketplace_add');
      expect(smokeAdd?.cwd).toContain('circuit-claude-install-');
      expect(smokeAdd?.env?.HOME).toContain('circuit-claude-home-');
      expect(smokeAdd?.env?.HOME).not.toBe(process.env.HOME);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails validation when a plugin doctor does not use the bundled runtime', () => {
    const root = createFixture();
    const { calls, runner: baseRunner } = createRunner();
    const runner = (invocation: CommandInvocation) => {
      if (invocation.id === 'codex_doctor') {
        calls.push(invocation);
        return {
          exitCode: 0,
          stdout: `${JSON.stringify({
            status: 'ok',
            runtime_source: 'dev-fallback',
            runtime_path: '/tmp/bin/circuit-next',
          })}\n`,
          stderr: '',
        };
      }
      return baseRunner(invocation);
    };
    try {
      const report = runPublish(['check'], { repoRoot: root, runner });

      expect(report.status).toBe('failed');
      expect(report.errors.join('\n')).toContain('must use bundled runtime');
      const doctor = calls.find((call) => call.id === 'codex_doctor');
      expect(doctor?.env?.PATH).not.toContain('.local/bin');
      expect(doctor?.env?.CIRCUIT_NEXT_CLI).toBeUndefined();
      expect(doctor?.env?.CIRCUIT_NEXT_DEV).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('dry-runs release effects and executes them only with --yes using temp CODEX_HOME', () => {
    const root = createFixture();
    const dry = createRunner();
    const yes = createRunner();
    try {
      const dryRun = runPublish(
        ['release', '--codex-source', 'petekp/circuit-next', '--codex-marketplace', 'circuit-next'],
        {
          repoRoot: root,
          runner: dry.runner,
        },
      );
      expect(dryRun.status).toBe('passed');
      expect(dryRun.commands).toContainEqual(
        expect.objectContaining({ id: 'claude_tag_push', skipped: true }),
      );
      expect(ids(dry.calls)).not.toContain('claude_tag_push');

      const published = runPublish(
        [
          'release',
          '--yes',
          '--codex-source',
          'petekp/circuit-next',
          '--codex-marketplace',
          'circuit-next',
        ],
        {
          repoRoot: root,
          runner: yes.runner,
        },
      );

      expect(published.status).toBe('published');
      expect(ids(yes.calls)).toContain('claude_tag_push');
      const codexAdd = yes.calls.find((call) => call.id === 'codex_marketplace_add_release');
      expect(codexAdd?.env?.CODEX_HOME).toContain('circuit-codex-release-');
      expect(codexAdd?.env?.CODEX_HOME).not.toBe(process.env.CODEX_HOME);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a local report with commands, warnings, and errors', () => {
    const root = createFixture({ codexVersion: '0.1.0' });
    const { runner } = createRunner();
    try {
      const report = runPublish(['check'], { repoRoot: root, runner });
      const reportPath = join(root, '.circuit-next/release/plugin-publish-report.json');

      expect(report.status).toBe('passed');
      expect(existsSync(reportPath)).toBe(true);
      const written = JSON.parse(readFileSync(reportPath, 'utf8')) as typeof report;
      expect(written.commands.length).toBeGreaterThan(0);
      expect(written.warnings.join('\n')).toContain('version mismatch');
      expect(written.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
