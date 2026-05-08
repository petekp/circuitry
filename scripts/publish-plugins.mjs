#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_PATH);
const DEFAULT_REPO_ROOT = resolve(SCRIPT_DIR, '..');
const TARGETS = new Set(['check', 'local', 'release', 'bump']);
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function isRemoteCodexSource(source) {
  if (source === undefined || source.trim() === '') return false;
  if (source === '.' || source === './' || source === '..' || source === '../') return false;
  if (source.startsWith('./') || source.startsWith('../')) return false;
  if (source.startsWith('file:') || source.startsWith('~')) return false;
  if (isAbsolute(source)) return false;
  return true;
}

function splitLines(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function findClaudeMarketplacePlugin(marketplace) {
  return marketplace.plugins?.find((plugin) => plugin?.name === 'circuit');
}

function versionFiles(repoRoot) {
  return {
    source: resolve(repoRoot, 'plugins/version.json'),
    claude: resolve(repoRoot, 'plugins/claude/.claude-plugin/plugin.json'),
    codex: resolve(repoRoot, 'plugins/circuit/.codex-plugin/plugin.json'),
    claudeMarketplace: resolve(repoRoot, '.claude-plugin/marketplace.json'),
  };
}

function parseArgs(argv) {
  const args = {
    target: 'check',
    yes: false,
    dryRun: false,
    json: false,
    skipVerify: false,
    allowDirty: false,
    allowUnsafe: false,
    writeGenerated: false,
    version: undefined,
    codexSource: undefined,
    codexMarketplace: undefined,
  };

  function requireValue(input, index, flag) {
    const value = input[index + 1];
    if (value === undefined || value.startsWith('-')) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  }

  const input = [...argv];
  if (input[0] !== undefined && TARGETS.has(input[0])) {
    args.target = input.shift();
  } else if (input[0] !== undefined && !input[0].startsWith('-')) {
    throw new Error(`unknown publish target: ${input[0]}`);
  }

  for (let i = 0; i < input.length; i += 1) {
    const arg = input[i];
    if (arg === '--yes') {
      args.yes = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--skip-verify') {
      args.skipVerify = true;
    } else if (arg === '--allow-dirty') {
      args.allowDirty = true;
    } else if (arg === '--allow-unsafe') {
      args.allowUnsafe = true;
    } else if (arg === '--write-generated') {
      args.writeGenerated = true;
    } else if (arg === '--version') {
      args.version = requireValue(input, i, '--version');
      i += 1;
    } else if (arg === '--codex-source') {
      args.codexSource = requireValue(input, i, '--codex-source');
      i += 1;
    } else if (arg === '--codex-marketplace') {
      args.codexMarketplace = requireValue(input, i, '--codex-marketplace');
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  args.dryRun = args.target === 'release' ? !args.yes : args.dryRun;
  return args;
}

function defaultRunner(invocation) {
  const [command, ...args] = invocation.argv;
  const result = spawnSync(command, args, {
    cwd: invocation.cwd,
    env: { ...process.env, ...(invocation.env ?? {}) },
    encoding: 'utf8',
  });
  return {
    exitCode: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error ? result.error.message : ''),
  };
}

function createReport(args, repoRoot) {
  return {
    schema_version: 1,
    target: args.target,
    dry_run: args.dryRun,
    status: 'failed',
    repo_root: repoRoot,
    git: {
      branch: '',
      upstream: '',
      head: '',
      origin_main: '',
      dirty_files: [],
    },
    versions: {
      source: '',
      claude: '',
      codex: '',
      claude_marketplace: undefined,
      expected: args.version,
    },
    commands: [],
    outputs: {},
    warnings: [],
    errors: [],
  };
}

function runPublish(argv = process.argv.slice(2), options = {}) {
  const repoRoot = options.repoRoot ? resolve(options.repoRoot) : DEFAULT_REPO_ROOT;
  const runner = options.runner ?? defaultRunner;
  const args = parseArgs(argv);
  const report = createReport(args, repoRoot);
  let releaseCodexHome;
  let claudeSmokeHome;
  let claudeSmokeProject;

  function addWarning(message) {
    report.warnings.push(message);
  }

  function fail(message) {
    throw new Error(message);
  }

  function runCommand(id, argvForCommand, commandOptions = {}) {
    const entry = {
      id,
      argv: argvForCommand,
    };
    report.commands.push(entry);

    if (report.dry_run && commandOptions.effect === true) {
      entry.skipped = true;
      return { exitCode: 0, stdout: '', stderr: '' };
    }

    const result = runner({
      id,
      argv: argvForCommand,
      cwd: commandOptions.cwd ?? repoRoot,
      env: commandOptions.env,
    });
    entry.exit_code = result.exitCode;

    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
      fail(`${id} failed: ${detail}`);
    }

    return result;
  }

  function inspectMetadata() {
    const sourceVersion = readJson(resolve(repoRoot, 'plugins/version.json'));
    const claudeManifest = readJson(resolve(repoRoot, 'plugins/claude/.claude-plugin/plugin.json'));
    const codexManifest = readJson(resolve(repoRoot, 'plugins/circuit/.codex-plugin/plugin.json'));
    const codexMarketplace = readJson(resolve(repoRoot, '.agents/plugins/marketplace.json'));
    const claudeMarketplacePath = resolve(repoRoot, '.claude-plugin/marketplace.json');
    const claudeMarketplace = existsSync(claudeMarketplacePath)
      ? readJson(claudeMarketplacePath)
      : undefined;
    const claudeMarketplacePlugin = claudeMarketplace
      ? findClaudeMarketplacePlugin(claudeMarketplace)
      : undefined;

    report.versions.source = sourceVersion.version;
    report.versions.claude = claudeManifest.version;
    report.versions.codex = codexManifest.version;
    report.versions.claude_marketplace = claudeMarketplacePlugin?.version;
    report.outputs.codex_marketplace = codexMarketplace.name;
    report.outputs.codex_source = args.codexSource;

    if (claudeManifest.name !== 'circuit') fail('Claude plugin manifest name must be circuit');
    if (codexManifest.name !== 'circuit') fail('Codex plugin manifest name must be circuit');
    if (
      codexMarketplace.plugins?.some((plugin) => plugin?.source?.path === './plugins/circuit') !==
      true
    ) {
      fail('Codex marketplace must point at ./plugins/circuit');
    }

    const versionValues = [
      ['plugins/version.json', sourceVersion.version],
      ['Claude plugin manifest', claudeManifest.version],
      ['Codex plugin manifest', codexManifest.version],
      ['Claude marketplace entry', claudeMarketplacePlugin?.version],
      ['--version', args.version ?? sourceVersion.version],
    ];
    const mismatches = versionValues.filter(([, version]) => version !== sourceVersion.version);
    if (mismatches.length > 0) {
      const message = `version mismatch: ${versionValues
        .map(([label, version]) => `${label}=${version ?? '<missing>'}`)
        .join(', ')}`;
      if (args.target === 'release') fail(message);
      addWarning(message);
    }

    if (args.target === 'release') {
      if (!isRemoteCodexSource(args.codexSource)) {
        fail('release requires a remote Codex source');
      }
      if (!args.codexMarketplace) fail('release requires --codex-marketplace');
      if (args.codexMarketplace.endsWith('-local')) {
        fail('Codex release marketplace name must not end in -local');
      }
      if (codexMarketplace.name.endsWith('-local')) {
        fail('resolved Codex marketplace name must not end in -local');
      }
      if (args.codexMarketplace !== codexMarketplace.name) {
        fail('--codex-marketplace must match .agents/plugins/marketplace.json name');
      }
    }
  }

  function validateOptions() {
    if (args.target === 'bump') {
      if (!args.version) fail('bump requires --version');
      if (!VERSION_PATTERN.test(args.version)) fail('--version must be a semver string');
      if (args.skipVerify) fail('bump does not allow --skip-verify');
      if (args.writeGenerated) fail('bump does not allow --write-generated');
      return;
    }

    if (args.target === 'release') {
      if (args.allowDirty) fail('release does not allow --allow-dirty');
      if (args.writeGenerated) fail('release does not allow --write-generated');
      if (args.skipVerify) fail('release does not allow --skip-verify');
      if (args.allowUnsafe) fail('release does not allow --allow-unsafe');
      return;
    }

    if (args.writeGenerated && args.target !== 'local') {
      fail('--write-generated is only supported for local');
    }
    if (args.allowDirty && args.target === 'check') {
      addWarning('--allow-dirty has no effect for check');
    }
    if (args.skipVerify && !args.allowUnsafe) {
      fail('--skip-verify requires --allow-unsafe');
    }
  }

  function collectGitState() {
    const status = runCommand('git_status', ['git', 'status', '--short']).stdout;
    const branch = runCommand('git_branch', ['git', 'branch', '--show-current']).stdout.trim();
    const upstream = runCommand('git_upstream', [
      'git',
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}',
    ]).stdout.trim();
    const head = runCommand('git_head', ['git', 'rev-parse', 'HEAD']).stdout.trim();

    report.git.branch = branch;
    report.git.upstream = upstream;
    report.git.head = head;
    report.git.dirty_files = splitLines(status);

    if (args.target === 'local' && report.git.dirty_files.length > 0 && !args.allowDirty) {
      fail('local publish requires a clean working tree unless --allow-dirty is set');
    }

    if (args.target !== 'release') return;

    if (report.git.dirty_files.length > 0) fail('working tree must be clean for release');
    if (branch !== 'main') fail('release requires branch main');
    if (upstream !== 'origin/main') fail('release requires upstream origin/main');

    runCommand('git_fetch_origin_main', ['git', 'fetch', 'origin', 'main']);
    const originHead = runCommand('git_origin_head', [
      'git',
      'rev-parse',
      'origin/main',
    ]).stdout.trim();
    report.git.origin_main = originHead;
    if (head !== originHead) fail('HEAD must match origin/main');
  }

  function runValidation() {
    if (args.writeGenerated) {
      runCommand('emit_flows', ['npm', 'run', 'emit-flows']);
    }

    if (!args.skipVerify) {
      runCommand('check_flow_drift', ['npm', 'run', 'check-flow-drift']);
      runCommand('verify', ['npm', 'run', 'verify']);
      runCommand('check_release_ready', ['npm', 'run', 'check-release-ready']);
      runCommand('claude_validate_root', ['claude', 'plugin', 'validate', '.']);
      runCommand('claude_validate_plugin', ['claude', 'plugin', 'validate', 'plugins/claude']);
      runCommand('claude_doctor', [
        process.execPath,
        'plugins/claude/scripts/circuit-next.mjs',
        'doctor',
      ]);
      runCommand('codex_doctor', [
        process.execPath,
        'plugins/circuit/scripts/circuit-next.mjs',
        'doctor',
      ]);
      runClaudeInstallSmoke();
    }
  }

  function runClaudeInstallSmoke() {
    claudeSmokeHome = mkdtempSync(join(tmpdir(), 'circuit-claude-home-'));
    claudeSmokeProject = mkdtempSync(join(tmpdir(), 'circuit-claude-install-'));
    const smokeEnv = { HOME: claudeSmokeHome };
    runCommand(
      'claude_install_smoke_marketplace_add',
      ['claude', 'plugin', 'marketplace', 'add', repoRoot, '--scope', 'local'],
      { cwd: claudeSmokeProject, env: smokeEnv },
    );
    runCommand(
      'claude_install_smoke_install',
      ['claude', 'plugin', 'install', 'circuit@circuit-next', '--scope', 'local'],
      { cwd: claudeSmokeProject, env: smokeEnv },
    );
    const list = runCommand('claude_install_smoke_list', ['claude', 'plugin', 'list'], {
      cwd: claudeSmokeProject,
      env: smokeEnv,
    });
    const listOutput = `${list.stdout}\n${list.stderr}`;
    if (/Failed to load hooks|Duplicate hooks file detected/i.test(listOutput)) {
      fail('Claude install smoke reported duplicate or failed hook loading');
    }
    report.outputs.claude_install_smoke_status = 'ok';
  }

  function runBump() {
    const paths = versionFiles(repoRoot);
    const sourceVersion = readJson(paths.source);
    const claudeManifest = readJson(paths.claude);
    const codexManifest = readJson(paths.codex);
    const claudeMarketplace = readJson(paths.claudeMarketplace);
    const claudeMarketplacePlugin = findClaudeMarketplacePlugin(claudeMarketplace);
    if (claudeMarketplacePlugin === undefined) {
      fail('Claude marketplace entry must include circuit plugin');
    }

    sourceVersion.version = args.version;
    claudeManifest.version = args.version;
    codexManifest.version = args.version;
    claudeMarketplacePlugin.version = args.version;

    const touchedFiles = [
      'plugins/version.json',
      'plugins/claude/.claude-plugin/plugin.json',
      'plugins/circuit/.codex-plugin/plugin.json',
      '.claude-plugin/marketplace.json',
    ];

    if (args.dryRun) {
      report.commands.push({
        id: 'bump_versions',
        argv: ['write plugin versions', args.version],
        skipped: true,
      });
    } else {
      writeJson(paths.source, sourceVersion);
      writeJson(paths.claude, claudeManifest);
      writeJson(paths.codex, codexManifest);
      writeJson(paths.claudeMarketplace, claudeMarketplace);
      runCommand('format_bumped_versions', [
        'npm',
        'exec',
        'biome',
        '--',
        'check',
        '--write',
        ...touchedFiles,
      ]);
    }

    report.outputs.bumped_version = args.version;
    report.outputs.bumped_files = touchedFiles;
  }

  function runLocalPublish() {
    runCommand('codex_cache_sync', ['npm', 'run', 'sync:codex-plugin-cache'], { effect: true });
    const cacheCheck = runCommand('codex_cache_check', ['npm', 'run', 'check:codex-plugin-cache']);
    report.outputs.codex_cache_status = cacheCheck.stdout.includes('"status": "ok"')
      ? 'ok'
      : 'synced';
  }

  function runReleasePublish() {
    const tag = `circuit--v${report.versions.source}`;
    report.outputs.claude_tag = tag;

    runCommand('claude_tag_dry_run', ['claude', 'plugin', 'tag', 'plugins/claude', '--dry-run']);
    runCommand('claude_tag_push', ['claude', 'plugin', 'tag', 'plugins/claude', '--push'], {
      effect: true,
    });

    releaseCodexHome = mkdtempSync(join(tmpdir(), 'circuit-codex-release-'));
    const codexEnv = { CODEX_HOME: releaseCodexHome };
    runCommand(
      'codex_marketplace_add_release',
      ['codex', 'plugin', 'marketplace', 'add', args.codexSource, '--ref', tag],
      { effect: true, env: codexEnv },
    );
    runCommand(
      'codex_marketplace_upgrade_release',
      ['codex', 'plugin', 'marketplace', 'upgrade', args.codexMarketplace],
      { effect: true, env: codexEnv },
    );
  }

  try {
    if (args.help) {
      report.status = 'passed';
      return report;
    }

    validateOptions();
    if (args.target === 'bump') {
      runBump();
      inspectMetadata();
      collectGitState();
      report.status = 'passed';
      return report;
    }

    inspectMetadata();
    collectGitState();
    runValidation();

    if (args.target === 'local') runLocalPublish();
    if (args.target === 'release') runReleasePublish();

    report.status = args.target === 'release' && args.yes ? 'published' : 'passed';
  } catch (err) {
    report.status = 'failed';
    report.errors.push(err instanceof Error ? err.message : String(err));
  } finally {
    if (releaseCodexHome !== undefined) {
      rmSync(releaseCodexHome, { recursive: true, force: true });
    }
    if (claudeSmokeHome !== undefined) {
      rmSync(claudeSmokeHome, { recursive: true, force: true });
    }
    if (claudeSmokeProject !== undefined) {
      rmSync(claudeSmokeProject, { recursive: true, force: true });
    }
    writeJson(resolve(repoRoot, '.circuit-next/release/plugin-publish-report.json'), report);
  }

  return report;
}

function printHumanSummary(report) {
  const status = report.status.toUpperCase();
  console.log(`${status}: ${report.target} plugin publish ${report.dry_run ? '(dry-run)' : ''}`);
  if (report.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of report.warnings) console.log(`- ${warning}`);
  }
  if (report.errors.length > 0) {
    console.log('\nErrors:');
    for (const error of report.errors) console.log(`- ${error}`);
  }
  console.log(
    `\nReport: ${resolve(report.repo_root, '.circuit-next/release/plugin-publish-report.json')}`,
  );
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === SCRIPT_PATH) {
  const report = runPublish(process.argv.slice(2));
  const jsonOnly = process.argv.includes('--json');
  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanSummary(report);
  }
  process.exit(report.status === 'failed' ? 1 : 0);
}

export { defaultRunner, isRemoteCodexSource, parseArgs, runPublish };
