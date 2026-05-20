#!/usr/bin/env node
import {
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
  spawnSync,
} from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const CIRCUIT_BIN = resolve(REPO_ROOT, 'bin/circuit');
const LIVE_FLAG = '--use-real-user-hooks';
const TIMEOUT_MS = 120_000;

type SmokeStatus = 'pass' | 'fail' | 'skip';
type Evidence = {
  name: string;
  ok: boolean;
  detail: string | undefined;
};
type StoredFile = { existed: true; contents: string } | { existed: false };
type RunOptions = Omit<SpawnSyncOptionsWithStringEncoding, 'encoding' | 'stdio'>;

class SmokeResult extends Error {
  status: SmokeStatus;
  reason: string;
  evidence: Evidence[];

  constructor(status: SmokeStatus, reason: string, evidence: Evidence[]) {
    super(reason);
    this.status = status;
    this.reason = reason;
    this.evidence = evidence;
  }
}

function usage(): string {
  return [
    'Usage: npm run smoke:host:codex -- [--use-real-user-hooks]',
    '',
    'Without --use-real-user-hooks, this performs safe preflight only and',
    'returns skip. With the flag, it temporarily installs the Codex user-level',
    'Circuit handoff hook, runs a live Codex session, and restores the original',
    'hooks file before exiting.',
  ].join('\n');
}

function findOnPath(command: string): string | undefined {
  for (const segment of (process.env.PATH ?? '').split(delimiter)) {
    if (segment.length === 0) continue;
    const candidate = resolve(segment, command);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function writeResult(status: SmokeStatus, reason: string, evidence: Evidence[] = []): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        schema_version: 1,
        host: 'codex',
        status,
        reason,
        evidence,
      },
      null,
      2,
    )}\n`,
  );
}

function finish(status: SmokeStatus, reason: string, evidence: Evidence[] = []): never {
  throw new SmokeResult(status, reason, evidence);
}

function run(
  command: string,
  args: readonly string[],
  options: RunOptions = {},
): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function codexHome(): string {
  return process.env.CODEX_HOME ?? resolve(process.env.HOME ?? '', '.codex');
}

function codexHooksPath(): string {
  return resolve(codexHome(), 'hooks.json');
}

function codexHooksFeatureVisible(codexPath: string): { ok: boolean; detail: string } {
  const result = run(codexPath, ['features', 'list'], { timeout: 5_000 });
  if (
    result.error === undefined &&
    result.status === 0 &&
    (/\bhooks\b[^\n]*\btrue\b/.test(result.stdout) ||
      /\bcodex_hooks\b[^\n]*\btrue\b/.test(result.stdout))
  ) {
    return {
      ok: true,
      detail: 'codex features list reports hooks true',
    };
  }

  const configPath = resolve(codexHome(), 'config.toml');
  if (existsSync(configPath)) {
    const text = readFileSync(configPath, 'utf8');
    if (/^\s*(?:hooks|codex_hooks)\s*=\s*true\s*$/m.test(text)) {
      return {
        ok: true,
        detail: `${configPath} enables Codex hooks`,
      };
    }
  }

  return {
    ok: false,
    detail:
      result.error?.message ??
      `Codex hooks not visible; stdout=${result.stdout.slice(0, 300)} stderr=${result.stderr.slice(0, 300)}`,
  };
}

function missingAuth(text: string): boolean {
  return /auth|login|logged in|api key|unauthorized|401/i.test(text);
}

function saveHandoff(projectRoot: string, token: string) {
  return run(CIRCUIT_BIN, [
    'handoff',
    'save',
    '--goal',
    `Codex host smoke ${token}`,
    '--next',
    `Repeat the unique smoke token ${token}.`,
    '--state-markdown',
    `- Unique smoke token: ${token}`,
    '--debt-markdown',
    '- No smoke debt.',
    '--project-root',
    projectRoot,
  ]);
}

function readOriginal(path: string): StoredFile {
  if (!existsSync(path)) return { existed: false };
  return { existed: true, contents: readFileSync(path, 'utf8') };
}

function restore(path: string, original: StoredFile): void {
  if (original.existed) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, original.contents);
    return;
  }
  rmSync(path, { force: true });
}

function main(): number {
  const program = new Command('codex-handoff-smoke').option('-h, --help').option(LIVE_FLAG);
  program.parse(process.argv.slice(2), { from: 'user' });
  const args = program.opts<{ help?: boolean; useRealUserHooks?: boolean }>();
  if (args.help === true) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  const evidence: Evidence[] = [];
  const codexPath = findOnPath('codex');
  evidence.push({ name: 'codex_cli_found', ok: codexPath !== undefined, detail: codexPath });
  evidence.push({
    name: 'circuit_launcher_exists',
    ok: existsSync(CIRCUIT_BIN),
    detail: CIRCUIT_BIN,
  });

  if (codexPath === undefined) {
    finish('skip', 'Codex CLI is not available on PATH.', evidence);
  }
  if (!existsSync(CIRCUIT_BIN)) {
    finish('skip', 'Circuit launcher is missing.', evidence);
  }

  const feature = codexHooksFeatureVisible(codexPath);
  evidence.push({ name: 'codex_hooks_feature_visible', ok: feature.ok, detail: feature.detail });
  if (!feature.ok) {
    finish('skip', 'Codex SessionStart hooks are not enabled or visible.', evidence);
  }

  if (args.useRealUserHooks !== true) {
    finish(
      'skip',
      `Safe preflight passed. Re-run with ${LIVE_FLAG} to temporarily install the user-level hook and run live Codex injection.`,
      evidence,
    );
  }

  const projectRoot = mkdtempSync(join(tmpdir(), 'circuit-codex-handoff-smoke-'));
  const outputPath = join(projectRoot, 'codex-last-message.txt');
  const token = `CIRCUIT_CODEX_HANDOFF_${randomUUID()}`;
  const hooksPath = codexHooksPath();
  const originalHooks = readOriginal(hooksPath);

  try {
    const save = saveHandoff(projectRoot, token);
    evidence.push({
      name: 'handoff_saved',
      ok: save.status === 0,
      detail: save.status === 0 ? projectRoot : save.stderr.slice(0, 500),
    });
    if (save.status !== 0 || save.error !== undefined) {
      finish('fail', 'Could not save the temp handoff.', evidence);
    }

    const install = run(CIRCUIT_BIN, [
      'handoff',
      'hooks',
      'install',
      '--host',
      'codex',
      '--hooks-file',
      hooksPath,
      '--launcher',
      CIRCUIT_BIN,
    ]);
    evidence.push({
      name: 'user_hook_installed',
      ok: install.status === 0,
      detail: install.status === 0 ? hooksPath : install.stderr.slice(0, 500),
    });
    if (install.status !== 0 || install.error !== undefined) {
      finish('fail', 'Could not install the temporary Codex user-level hook.', evidence);
    }

    const prompt = [
      'Read the session context.',
      'If a Circuit handoff is present, reply with only the unique smoke token from that handoff.',
      'If no Circuit handoff is present, reply NO_HANDOFF_CONTEXT.',
    ].join(' ');
    const codex = run(codexPath, [
      'exec',
      '--cd',
      projectRoot,
      '--skip-git-repo-check',
      '--ephemeral',
      '--sandbox',
      'read-only',
      '--output-last-message',
      outputPath,
      prompt,
    ]);
    const combined = `${codex.stdout}\n${codex.stderr}`;
    const output = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : codex.stdout;
    evidence.push({
      name: 'codex_exec_completed',
      ok: codex.status === 0,
      detail: codex.status === 0 ? 'codex exec exited 0' : combined.slice(0, 700),
    });
    evidence.push({
      name: 'last_message_contains_token',
      ok: output.includes(token),
      detail: output.slice(0, 700),
    });

    if (codex.status !== 0 || codex.error !== undefined) {
      if (missingAuth(combined)) {
        finish('skip', 'Codex CLI is present but not authenticated for a live smoke.', evidence);
      }
      finish('fail', 'Codex live smoke failed after prerequisites passed.', evidence);
    }
    if (!output.includes(token)) {
      finish('fail', 'Codex did not receive or repeat the Circuit handoff token.', evidence);
    }

    finish('pass', 'Codex received Circuit handoff context in a live session.', evidence);
  } finally {
    restore(hooksPath, originalHooks);
    rmSync(projectRoot, { recursive: true, force: true });
  }
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  if (err instanceof SmokeResult) {
    writeResult(err.status, err.reason, err.evidence);
    process.exit(err.status === 'fail' ? 1 : 0);
  }
  throw err;
}
