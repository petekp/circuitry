import { spawn, spawnSync } from 'node:child_process';
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
import { delimiter, dirname, join, resolve } from 'node:path';
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
  'prototype',
  'review',
  'run',
];
const RAW_PROGRESS_INVOCATION =
  /node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/circuit\.ts" (?!present\b)[^\n]*--progress jsonl/;

const PluginManifest = z
  .object({
    name: z.literal('circuit'),
    version: z.string().min(1),
    description: z.string().min(1),
  })
  .passthrough();

const VersionManifest = z.object({ version: z.string().min(1) });
const MarketplaceManifest = z.object({
  name: z.literal('circuit'),
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

function noAmbientCliPath(): string {
  const systemSegments = process.platform === 'win32' ? [] : ['/usr/bin', '/bin'];
  return [dirname(process.execPath), ...systemSegments].join(delimiter);
}

function cleanPluginEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  env.CIRCUIT_CLI = undefined;
  env.CIRCUIT_DEV = undefined;
  env.PATH = noAmbientCliPath();
  return { ...env, ...extra };
}

function envWithOverride(fakeBin: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return cleanPluginEnv({ ...extra, CIRCUIT_CLI: fakeBin });
}

describe('Claude Code host plugin package', () => {
  it('declares a self-contained Claude Code plugin package', () => {
    const manifestPath = resolve(PLUGIN_ROOT, '.claude-plugin/plugin.json');
    const manifest = PluginManifest.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));

    expect(manifest.description).toContain('/circuit:run');
    expect(manifest).not.toHaveProperty('hooks');
    expect(existsSync(resolve(PLUGIN_ROOT, 'hooks/hooks.json'))).toBe(true);
    expect(existsSync(resolve(PLUGIN_ROOT, 'hooks/session-start.ts'))).toBe(true);
    expect(existsSync(resolve(PLUGIN_ROOT, 'scripts/circuit.ts'))).toBe(true);
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

      expect(commandMarkdown).toContain('node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts"');
      expect(commandMarkdown).toContain(' present ');
      expect(commandMarkdown).not.toMatch(RAW_PROGRESS_INVOCATION);
      expect(commandMarkdown).not.toContain('Parse the final JSON');
      expect(commandMarkdown).not.toContain("Parse the CLI's final JSON");
      expect(commandMarkdown).not.toContain('./bin/circuit');
      expect(commandMarkdown).not.toContain('repo-local launcher');
      expect(commandMarkdown).not.toContain('invokes `circuit`');
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

  it('wrapper uses the bundled runtime when PATH has no circuit binary', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-bundled-'));
    try {
      const result = spawnSync(
        process.execPath,
        [resolve(PLUGIN_ROOT, 'scripts/circuit.ts'), 'version', '--json'],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: cleanPluginEnv(),
        },
      );

      expect(result.status, result.stderr).toBe(0);
      const output = JSON.parse(result.stdout) as {
        runtime_source: string;
        runtime_path: string;
        version: string;
      };
      expect(output.runtime_source).toBe('bundled');
      expect(output.runtime_path).toBe(resolve(PLUGIN_ROOT, 'runtime/circuit.js'));
      expect(output.version).toBe(
        VersionManifest.parse(
          JSON.parse(readFileSync(resolve(REPO_ROOT, 'plugins/version.json'), 'utf8')),
        ).version,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('wrapper reports CIRCUIT_CLI as an explicit override', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-override-'));
    try {
      const binDir = join(tempDir, 'bin');
      const fakeBin = join(binDir, 'circuit');
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        fakeBin,
        [
          '#!/usr/bin/env node',
          'process.stdout.write(JSON.stringify({ runtime_source: process.env.CIRCUIT_RUNTIME_SOURCE, argv: process.argv.slice(2) }) + "\\n");',
          '',
        ].join('\n'),
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [resolve(PLUGIN_ROOT, 'scripts/circuit.ts'), 'version', '--json'],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: envWithOverride(fakeBin),
        },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        runtime_source: 'override',
        argv: ['version', '--json'],
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('wrapper refuses PATH fallback unless CIRCUIT_DEV is set', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-path-fallback-'));
    try {
      const tempPluginRoot = join(tempDir, 'plugin');
      const scriptsDir = join(tempPluginRoot, 'scripts');
      const binDir = join(tempDir, 'bin');
      const wrapperPath = join(scriptsDir, 'circuit.ts');
      const fakeBin = join(binDir, 'circuit');
      mkdirSync(scriptsDir, { recursive: true });
      mkdirSync(binDir, { recursive: true });
      writeFileSync(wrapperPath, readFileSync(resolve(PLUGIN_ROOT, 'scripts/circuit.ts')));
      // The wrapper imports ./auto-open-policy.ts at top-level — copy it so
      // the fixture script can load.
      writeFileSync(
        join(scriptsDir, 'auto-open-policy.ts'),
        readFileSync(resolve(PLUGIN_ROOT, 'scripts/auto-open-policy.ts')),
      );
      writeFileSync(
        fakeBin,
        [
          '#!/usr/bin/env node',
          'process.stdout.write(JSON.stringify({ runtime_source: process.env.CIRCUIT_RUNTIME_SOURCE, argv: process.argv.slice(2) }) + "\\n");',
          '',
        ].join('\n'),
      );
      chmodSync(fakeBin, 0o755);

      const noDev = spawnSync(process.execPath, [wrapperPath, 'version', '--json'], {
        cwd: tempDir,
        encoding: 'utf8',
        env: cleanPluginEnv({ PATH: `${binDir}${delimiter}${noAmbientCliPath()}` }),
      });
      expect(noDev.status).toBe(1);
      expect(noDev.stderr).toContain('bundled runtime is missing');
      expect(noDev.stderr).not.toContain('install a package');

      const withDev = spawnSync(process.execPath, [wrapperPath, 'version', '--json'], {
        cwd: tempDir,
        encoding: 'utf8',
        env: cleanPluginEnv({
          PATH: `${binDir}${delimiter}${noAmbientCliPath()}`,
          CIRCUIT_DEV: '1',
        }),
      });
      expect(withDev.status, withDev.stderr).toBe(0);
      expect(JSON.parse(withDev.stdout)).toEqual({
        runtime_source: 'dev-fallback',
        argv: ['version', '--json'],
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('wrapper runs from a target repo and injects the packaged Claude flow root', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-'));
    try {
      const binDir = join(tempDir, 'bin');
      const argvPath = join(tempDir, 'argv.json');
      const fakeBin = join(binDir, 'circuit');
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
        [resolve(PLUGIN_ROOT, 'scripts/circuit.ts'), 'run', 'review', '--goal', 'outside repo'],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: envWithOverride(fakeBin, {
            [GENERATED_FLOW_MIRROR_ROOT_ENV]: 'stale-parent-marker',
          }),
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

  it('wrapper preserves child stdout, stderr, and exit status separately', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-streams-'));
    try {
      const binDir = join(tempDir, 'bin');
      const fakeBin = join(binDir, 'circuit');
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        fakeBin,
        [
          '#!/usr/bin/env node',
          'process.stderr.write(\'{"type":"progress","step":"frame"}\\n\');',
          'process.stdout.write(\'{"outcome":"complete","result_path":"reports/result.json"}\\n\');',
          'process.exit(7);',
          '',
        ].join('\n'),
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [resolve(PLUGIN_ROOT, 'scripts/circuit.ts'), 'run', 'explore', '--goal', 'stream handling'],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: envWithOverride(fakeBin),
        },
      );

      expect(result.status).toBe(7);
      expect(result.stdout).toBe('{"outcome":"complete","result_path":"reports/result.json"}\n');
      expect(result.stderr).toBe('{"type":"progress","step":"frame"}\n');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('present mode streams clean progress before the child exits', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-present-stream-'));
    let child: ReturnType<typeof spawn> | undefined;
    try {
      const binDir = join(tempDir, 'bin');
      const summaryPath = join(tempDir, 'summary.md');
      const fakeBin = join(binDir, 'circuit');
      const finalJson = JSON.stringify({
        schema_version: 1,
        outcome: 'complete',
        run_folder: tempDir,
        operator_summary_markdown_path: summaryPath,
      });
      mkdirSync(binDir, { recursive: true });
      writeFileSync(summaryPath, '# Clean Summary\n\n- Done.\n');
      writeFileSync(
        fakeBin,
        [
          '#!/usr/bin/env node',
          'const progress = { schema_version: 1, type: "run.started", run_id: "87000000-0000-0000-0000-000000000001", flow_id: "explore", recorded_at: "2026-05-07T12:00:00.000Z", label: "Started", display: { text: "Circuit started explore.", importance: "major", tone: "info" }, run_folder: process.cwd() };',
          'process.stderr.write(`${JSON.stringify(progress)}\\n`);',
          'setTimeout(() => {',
          `  process.stdout.write(${JSON.stringify(`${finalJson}\n`)});`,
          '}, 900);',
          'setTimeout(() => process.exit(0), 950);',
          '',
        ].join('\n'),
      );
      chmodSync(fakeBin, 0o755);

      child = spawn(
        process.execPath,
        [
          resolve(PLUGIN_ROOT, 'scripts/circuit.ts'),
          'present',
          'run',
          'explore',
          '--goal',
          'stream handling',
        ],
        {
          cwd: tempDir,
          env: envWithOverride(fakeBin),
        },
      );
      const childProcess = child;
      const stdoutPipe = childProcess.stdout;
      if (stdoutPipe === null) throw new Error('expected child stdout pipe');

      let stdout = '';
      let closed = false;
      const closePromise = new Promise<number | null>((resolveClose) => {
        childProcess.on('close', (status) => {
          closed = true;
          resolveClose(status);
        });
      });
      const progressBeforeExit = await new Promise<boolean>((resolveProgress) => {
        const timer = setTimeout(() => resolveProgress(false), 700);
        stdoutPipe.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8');
          if (stdout.includes('Circuit started explore.')) {
            clearTimeout(timer);
            resolveProgress(!closed);
          }
        });
      });

      expect(progressBeforeExit).toBe(true);
      const status = await closePromise;
      expect(status).toBe(0);
      expect(stdout).toContain('# Clean Summary');
      expect(stdout).not.toContain('schema_version');
      expect(stdout).not.toContain('{"');
    } finally {
      child?.kill();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('present mode renders presentation status blocks and a summary continuation', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-status-block-'));
    try {
      const binDir = join(tempDir, 'bin');
      const summaryPath = join(tempDir, 'operator-summary.md');
      const summaryJsonPath = join(tempDir, 'operator-summary.json');
      const fakeBin = join(binDir, 'circuit');
      const runId = '87000000-0000-0000-0000-000000000001';
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        summaryJsonPath,
        JSON.stringify({
          schema_version: 1,
          run_id: runId,
          flow_id: 'review',
          selected_flow: 'review',
          outcome: 'complete',
          headline: 'Circuit: Review complete. Verdict: CLEAN. Findings: 0.',
          status_text: 'Review complete. Verdict: CLEAN. Findings: 0.',
          details: [],
          evidence_warnings: [],
          run_folder: tempDir,
          report_paths: [],
        }),
      );
      writeFileSync(
        summaryPath,
        'Circuit\n⎿ Review complete. Verdict: CLEAN. Findings: 0.\n\n- Full Markdown detail.\n',
      );
      writeFileSync(
        fakeBin,
        [
          '#!/usr/bin/env node',
          `const runId = ${JSON.stringify(runId)};`,
          'const route = { schema_version: 1, type: "route.selected", run_id: runId, flow_id: "review", recorded_at: "2026-05-07T12:00:00.000Z", label: "Selected review", display: { text: "Circuit: Chose review.", importance: "major", tone: "info" }, presentation: { block_id: runId, line_mode: "append", status_text: "Chose review." }, selected_flow: "review", routed_by: "explicit", router_reason: "explicit flow positional argument" };',
          'const relay = { schema_version: 1, type: "relay.started", run_id: runId, flow_id: "review", recorded_at: "2026-05-07T12:00:01.000Z", label: "Running review", display: { text: "Circuit: Asking the reviewer to check the result...", importance: "major", tone: "info" }, presentation: { block_id: runId, line_mode: "replace_slot", slot_id: "review-relay", status_text: "Reviewing the result..." }, step_id: "review-step", step_title: "Review", attempt: 1, role: "reviewer", connector_name: "claude-code", connector_kind: "builtin", filesystem_capability: "trusted-write" };',
          'const done = { schema_version: 1, type: "run.completed", run_id: runId, flow_id: "review", recorded_at: "2026-05-07T12:00:02.000Z", label: "Complete", display: { text: "Circuit: Finished Review.", importance: "major", tone: "success" }, presentation: { block_id: runId, line_mode: "append", status_text: "Finished Review." }, outcome: "complete", result_path: "reports/result.json" };',
          'process.stderr.write(`${JSON.stringify(route)}\\n${JSON.stringify(relay)}\\n${JSON.stringify(done)}\\n`);',
          `process.stdout.write(${JSON.stringify(
            `${JSON.stringify({
              schema_version: 1,
              run_id: runId,
              outcome: 'complete',
              run_folder: tempDir,
              operator_summary_path: summaryJsonPath,
              operator_summary_markdown_path: summaryPath,
              operator_summary_status_text: 'Review complete. Verdict: CLEAN. Findings: 0.',
            })}\n`,
          )});`,
          '',
        ].join('\n'),
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [
          resolve(PLUGIN_ROOT, 'scripts/circuit.ts'),
          'present',
          'run',
          'review',
          '--goal',
          'render status block',
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: envWithOverride(fakeBin),
        },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe(
        [
          'Circuit',
          '⎿ Chose review.',
          '⎿ Reviewing the result...',
          '⎿ Finished Review.',
          '⎿ Review complete. Verdict: CLEAN. Findings: 0.',
          '',
        ].join('\n'),
      );
      expect(result.stdout.match(/^Circuit$/gm)).toHaveLength(1);
      expect(result.stdout).not.toContain('Full Markdown detail');
      expect(result.stdout).not.toContain('schema_version');
      expect(result.stdout).not.toContain('{"');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('present mode prints only summary Markdown on success when no progress is emitted', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-present-success-'));
    try {
      const binDir = join(tempDir, 'bin');
      const summaryPath = join(tempDir, 'summary.md');
      const fakeBin = join(binDir, 'circuit');
      mkdirSync(binDir, { recursive: true });
      writeFileSync(summaryPath, '# Clean Summary\n\n- Recommendation: keep it short.\n');
      writeFileSync(
        fakeBin,
        [
          '#!/usr/bin/env node',
          `process.stdout.write(${JSON.stringify(
            `${JSON.stringify({
              schema_version: 1,
              outcome: 'complete',
              run_folder: tempDir,
              operator_summary_markdown_path: summaryPath,
            })}\n`,
          )});`,
          '',
        ].join('\n'),
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [
          resolve(PLUGIN_ROOT, 'scripts/circuit.ts'),
          'present',
          'run',
          'explore',
          '--goal',
          'clean success',
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: envWithOverride(fakeBin),
        },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe('# Clean Summary\n\n- Recommendation: keep it short.\n');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('present mode renders checkpoint choices and a resume command without raw JSON', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-present-checkpoint-'));
    try {
      const binDir = join(tempDir, 'bin');
      const runFolder = join(tempDir, 'run');
      const requestPath = join(runFolder, 'reports/checkpoints/tradeoff-request.json');
      const fakeBin = join(binDir, 'circuit');
      mkdirSync(binDir, { recursive: true });
      mkdirSync(join(requestPath, '..'), { recursive: true });
      writeFileSync(requestPath, JSON.stringify({ prompt: 'Choose the best tradeoff.' }));
      writeFileSync(
        fakeBin,
        [
          '#!/usr/bin/env node',
          `process.stdout.write(${JSON.stringify(
            `${JSON.stringify({
              schema_version: 1,
              outcome: 'checkpoint_waiting',
              run_folder: runFolder,
              checkpoint: {
                step_id: 'tradeoff-checkpoint-step',
                request_path: requestPath,
                allowed_choices: ['option-1', 'option-2'],
              },
            })}\n`,
          )});`,
          '',
        ].join('\n'),
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [
          resolve(PLUGIN_ROOT, 'scripts/circuit.ts'),
          'present',
          'run',
          'explore',
          '--goal',
          'needs checkpoint',
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: envWithOverride(fakeBin),
        },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('Choose the best tradeoff.');
      expect(result.stdout).toContain('Option 1');
      expect(result.stdout).toContain('Option 2');
      expect(result.stdout).toContain(
        `node "\${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present resume --run-folder '${runFolder}' --checkpoint-choice '<choice>'`,
      );
      expect(result.stdout).not.toContain('checkpoint_waiting');
      expect(result.stdout).not.toContain('{"');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('present mode surfaces checkpoint HTML and still prints the resume command when auto-open is skipped', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-present-checkpoint-html-'));
    try {
      const binDir = join(tempDir, 'bin');
      const runFolder = join(tempDir, 'run');
      const requestPath = join(runFolder, 'reports/checkpoints/frame-step-request.json');
      const htmlPath = join(runFolder, 'reports/operator-summary.html');
      const fakeBin = join(binDir, 'circuit');
      mkdirSync(binDir, { recursive: true });
      mkdirSync(join(requestPath, '..'), { recursive: true });
      writeFileSync(requestPath, JSON.stringify({ prompt: 'Confirm the Build brief.' }));
      writeFileSync(htmlPath, '<!doctype html><body>checkpoint</body>');
      writeFileSync(
        fakeBin,
        [
          '#!/usr/bin/env node',
          `process.stdout.write(${JSON.stringify(
            `${JSON.stringify({
              schema_version: 1,
              outcome: 'checkpoint_waiting',
              run_folder: runFolder,
              operator_summary_html_path: htmlPath,
              checkpoint: {
                step_id: 'frame-step',
                request_path: requestPath,
                allowed_choices: ['continue'],
              },
            })}\n`,
          )});`,
          '',
        ].join('\n'),
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [
          resolve(PLUGIN_ROOT, 'scripts/circuit.ts'),
          'present',
          'run',
          'build',
          '--goal',
          'needs checkpoint',
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: envWithOverride(fakeBin, { CIRCUIT_NO_AUTO_OPEN: '1' }),
        },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('Confirm the Build brief.');
      expect(result.stdout).toContain(`Rich summary: ${htmlPath}`);
      expect(result.stdout).toContain(
        `node "\${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present resume --run-folder '${runFolder}' --checkpoint-choice '<choice>'`,
      );
      expect(result.stdout).not.toContain('checkpoint_waiting');
      expect(result.stdout).not.toContain('{"');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('present mode suppresses progress JSONL and prints only a short stderr diagnostic on failure', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-present-failure-'));
    try {
      const binDir = join(tempDir, 'bin');
      const fakeBin = join(binDir, 'circuit');
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        fakeBin,
        [
          '#!/usr/bin/env node',
          'const selected = { schema_version: 1, type: "route.selected", run_id: "87000000-0000-0000-0000-000000000001", flow_id: "explore", recorded_at: "2026-05-07T12:00:00.000Z", label: "Selected explore", display: { text: "Circuit selected explore: explicit flow positional argument", importance: "major", tone: "info" }, selected_flow: "explore", routed_by: "explicit", router_reason: "explicit flow positional argument" };',
          'const started = { schema_version: 1, type: "run.started", run_id: "87000000-0000-0000-0000-000000000001", flow_id: "explore", recorded_at: "2026-05-07T12:00:01.000Z", label: "Started", display: { text: "Circuit started explore.", importance: "major", tone: "info" }, run_folder: process.cwd() };',
          'process.stderr.write(`${JSON.stringify(selected)}\\n`);',
          'process.stderr.write(`${JSON.stringify(started)}\\n`);',
          'process.stderr.write("relay crashed loudly\\nmore diagnostic detail\\n");',
          'process.exit(3);',
          '',
        ].join('\n'),
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [
          resolve(PLUGIN_ROOT, 'scripts/circuit.ts'),
          'present',
          'run',
          'explore',
          '--goal',
          'fails cleanly',
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: envWithOverride(fakeBin),
        },
      );

      expect(result.status).toBe(3);
      expect(result.stdout).toContain('Circuit started explore.');
      expect(result.stderr).toContain('Circuit run failed');
      expect(result.stderr).toContain('relay crashed loudly');
      expect(result.stdout).not.toContain('Circuit selected explore');
      expect(result.stdout).not.toContain('schema_version');
      expect(result.stderr).not.toContain('schema_version');
      expect(result.stderr).not.toContain('{"');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('wrapper does not inject a flow root for handoff save', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-claude-host-handoff-'));
    try {
      const binDir = join(tempDir, 'bin');
      const argvPath = join(tempDir, 'argv.json');
      const fakeBin = join(binDir, 'circuit');
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
          resolve(PLUGIN_ROOT, 'scripts/circuit.ts'),
          'handoff',
          'save',
          '--goal',
          'preserve continuity',
          '--next',
          'resume carefully',
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: envWithOverride(fakeBin, {
            [GENERATED_FLOW_MIRROR_ROOT_ENV]: 'stale-parent-marker',
          }),
        },
      );

      expect(result.status, result.stderr).toBe(0);
      const capture = JSON.parse(readFileSync(argvPath, 'utf8')) as {
        argv: string[];
        marker: string | null;
        cwd: string;
      };
      expect(capture.argv).toEqual([
        'handoff',
        'save',
        '--goal',
        'preserve continuity',
        '--next',
        'resume carefully',
      ]);
      expect(capture.marker).toBeNull();
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
        [resolve(PLUGIN_ROOT, 'scripts/circuit.ts'), 'doctor'],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: cleanPluginEnv(),
        },
      );

      expect(result.status, result.stderr).toBe(0);
      const output = JSON.parse(result.stdout) as {
        status: string;
        runtime_source: string;
        runtime_path: string;
        checks: Array<{ name: string; ok: boolean }>;
      };
      expect(output.status).toBe('ok');
      expect(output.runtime_source).toBe('bundled');
      expect(output.runtime_path).toBe(resolve(PLUGIN_ROOT, 'runtime/circuit.js'));
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'plugin_manifest_shape', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'session_start_hook_exists', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'packaged_flow_review', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'runtime_version_executes', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'temp_repo_review_smoke', ok: true }),
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
