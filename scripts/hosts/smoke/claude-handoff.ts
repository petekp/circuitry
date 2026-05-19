#!/usr/bin/env node
import {
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
  spawnSync,
} from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const CIRCUIT_BIN = resolve(REPO_ROOT, 'bin/circuit');
const TIMEOUT_MS = 120_000;

type SmokeStatus = 'pass' | 'fail' | 'skip';
type Evidence = {
  name: string;
  ok: boolean;
  detail: string | undefined;
};
type JsonRecord = Record<string, unknown>;
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
    'Usage: npm run smoke:host:claude',
    '',
    'Runs a live Claude Code smoke using --plugin-dir and a temp project root.',
    'It does not install or modify user-level Claude Code plugin config.',
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
        host: 'claude-code',
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

function missingAuth(text: string): boolean {
  return /auth|login|logged in|api key|unauthorized|401|subscription/i.test(text);
}

function saveHandoff(projectRoot: string, token: string) {
  return run(CIRCUIT_BIN, [
    'handoff',
    'save',
    '--goal',
    `Claude Code host smoke ${token}`,
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

function parseClaudeEvents(stdout: string): JsonRecord[] {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return [];

  const events = [];
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    try {
      events.push(JSON.parse(line) as JsonRecord);
    } catch {
      events.length = 0;
      break;
    }
  }
  if (events.length > 0) return events;

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? (parsed as JsonRecord[]) : [parsed as JsonRecord];
  } catch {
    return [];
  }
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => stringValues(item));
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((item) => stringValues(item));
  }
  return [];
}

function eventContainsToken(event: unknown, token: string): boolean {
  return stringValues(event).some((value) => value.includes(token));
}

function eventLooksLikeHookContext(event: unknown): boolean {
  const values = stringValues(event);
  return (
    values.some((value) => value.includes('SessionStart')) &&
    values.some((value) => value.includes('additionalContext'))
  );
}

function eventLooksLikeFinalMessage(event: unknown): boolean {
  if (typeof event !== 'object' || event === null) return false;
  const record = event as JsonRecord;
  return (
    record.type === 'result' ||
    record.type === 'assistant' ||
    record.subtype === 'success' ||
    typeof record.result === 'string'
  );
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  const evidence: Evidence[] = [];
  const claudePath = findOnPath('claude');
  evidence.push({ name: 'claude_cli_found', ok: claudePath !== undefined, detail: claudePath });
  evidence.push({
    name: 'circuit_launcher_exists',
    ok: existsSync(CIRCUIT_BIN),
    detail: CIRCUIT_BIN,
  });

  if (claudePath === undefined) {
    finish('skip', 'Claude Code CLI is not available on PATH.', evidence);
  }
  if (!existsSync(CIRCUIT_BIN)) {
    finish('skip', 'Circuit launcher is missing.', evidence);
  }

  const validate = run(claudePath, ['plugin', 'validate', REPO_ROOT]);
  evidence.push({
    name: 'plugin_validate',
    ok: validate.status === 0,
    detail:
      validate.status === 0
        ? 'claude plugin validate passed'
        : `${validate.stdout}\n${validate.stderr}`.slice(0, 700),
  });
  if (validate.status !== 0 || validate.error !== undefined) {
    finish('fail', 'Claude Code plugin validation failed.', evidence);
  }

  const projectRoot = mkdtempSync(join(tmpdir(), 'circuit-claude-handoff-smoke-'));
  const token = `CIRCUIT_CLAUDE_HANDOFF_${randomUUID()}`;

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

    const prompt = [
      'Read the session context.',
      'If a Circuit handoff is present, reply with only the unique smoke token from that handoff.',
      'If no Circuit handoff is present, reply NO_HANDOFF_CONTEXT.',
    ].join(' ');
    const claude = run(
      claudePath,
      [
        '--print',
        '--plugin-dir',
        REPO_ROOT,
        '--output-format',
        'stream-json',
        '--include-hook-events',
        '--max-budget-usd',
        '0.25',
        prompt,
      ],
      { cwd: projectRoot },
    );
    const combined = `${claude.stdout}\n${claude.stderr}`;
    const events = parseClaudeEvents(claude.stdout);
    const hookContextContainsToken = events.some(
      (event) => eventLooksLikeHookContext(event) && eventContainsToken(event, token),
    );
    const finalMessageContainsToken = events.some(
      (event) => eventLooksLikeFinalMessage(event) && eventContainsToken(event, token),
    );

    evidence.push({
      name: 'claude_print_completed',
      ok: claude.status === 0,
      detail: claude.status === 0 ? 'claude --print exited 0' : combined.slice(0, 700),
    });
    evidence.push({
      name: 'hook_context_contains_token',
      ok: hookContextContainsToken,
      detail:
        events.length > 0
          ? `parsed ${events.length} Claude stream events`
          : `stdout=${claude.stdout.slice(0, 700)}`,
    });
    evidence.push({
      name: 'final_message_contains_token',
      ok: finalMessageContainsToken,
      detail: finalMessageContainsToken
        ? 'parsed final Claude output contained the token'
        : 'final Claude output did not contain the token',
    });

    if (claude.status !== 0 || claude.error !== undefined) {
      if (missingAuth(combined)) {
        finish(
          'skip',
          'Claude Code CLI is present but not authenticated for a live smoke.',
          evidence,
        );
      }
      finish('fail', 'Claude Code live smoke failed after plugin validation passed.', evidence);
    }
    if (!hookContextContainsToken) {
      finish(
        'fail',
        'Claude Code did not expose the Circuit handoff token in hook context.',
        evidence,
      );
    }

    finish(
      'pass',
      finalMessageContainsToken
        ? 'Claude Code received Circuit handoff context and the model repeated the token.'
        : 'Claude Code received Circuit handoff context at the hook boundary.',
      evidence,
    );
  } finally {
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
