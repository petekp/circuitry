#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(scriptDir, '..');
const defaultLauncher = resolve(pluginRoot, 'scripts/circuit-next.mjs');
const launcher = process.env.CIRCUIT_HANDOFF_HOOK_LAUNCHER ?? defaultLauncher;
const debug = process.env.CIRCUIT_HANDOFF_HOOK_DEBUG === '1';
const DEFAULT_BRIEF_TIMEOUT_MS = 3000;

function warn(message) {
  if (debug) process.stderr.write(`Circuit handoff hook: ${message}\n`);
}

function readInput() {
  if (process.stdin.isTTY) return {};
  const raw = readFileSync(0, 'utf8');
  if (raw.trim().length === 0) return {};
  return JSON.parse(raw);
}

function hookCwd(input) {
  return typeof input?.cwd === 'string' && input.cwd.length > 0 ? input.cwd : undefined;
}

function briefTimeoutMs() {
  const raw = process.env.CIRCUIT_HANDOFF_HOOK_TIMEOUT_MS;
  if (raw === undefined) return DEFAULT_BRIEF_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BRIEF_TIMEOUT_MS;
}

function main() {
  let input;
  try {
    input = readInput();
  } catch (err) {
    warn(`could not parse hook input: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }

  const cwd = hookCwd(input);
  if (cwd === undefined) {
    warn('hook input did not include cwd; skipping handoff injection');
    return 0;
  }

  if (!existsSync(launcher)) {
    warn(`launcher is missing: ${launcher}`);
    return 0;
  }

  const result = spawnSync(
    process.execPath,
    [launcher, 'handoff', 'brief', '--json', '--project-root', cwd],
    {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: briefTimeoutMs(),
    },
  );

  if (result.error !== undefined || result.status !== 0) {
    warn(
      `brief command failed: status=${result.status ?? 'unknown'} error=${
        result.error?.message ?? 'none'
      } stderr=${result.stderr.slice(0, 300)}`,
    );
    return 0;
  }

  let brief;
  try {
    brief = JSON.parse(result.stdout);
  } catch (err) {
    warn(
      `brief command returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 0;
  }

  if (brief.status === 'invalid') {
    warn(`brief state is invalid: ${brief.error?.code ?? 'unknown'}`);
    return 0;
  }

  if (brief.status !== 'available' || typeof brief.additional_context !== 'string') {
    return 0;
  }

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: brief.additional_context,
      },
    })}\n`,
  );
  return 0;
}

process.exit(main());
