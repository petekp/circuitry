#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageTreeStatus } from './package-tree.ts';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_PATH);
const repoRoot = resolve(SCRIPT_DIR, '../..');

type JsonRecord = Record<string, unknown>;
type DoctorResult = {
  status: string;
  runtime_source: string | undefined;
  runtime_path: string | undefined;
  error?: string;
};

function readJson<T = JsonRecord>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function noAmbientCliPath() {
  const systemSegments = process.platform === 'win32' ? [] : ['/usr/bin', '/bin'];
  return [dirname(process.execPath), ...systemSegments].join(delimiter);
}

function noAmbientCliEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: noAmbientCliPath(),
    CIRCUIT_CLI: undefined,
    CIRCUIT_DEV: undefined,
    ...extra,
  };
}

function runDoctor(scriptPath: string, env: NodeJS.ProcessEnv = {}): DoctorResult {
  if (!existsSync(scriptPath)) {
    return {
      status: 'missing',
      runtime_source: undefined,
      runtime_path: undefined,
      error: `missing doctor script: ${scriptPath}`,
    };
  }

  const result = spawnSync(process.execPath, [scriptPath, 'doctor'], {
    cwd: repoRoot,
    env: noAmbientCliEnv(env),
    encoding: 'utf8',
  });
  if ((result.status ?? 1) !== 0) {
    return {
      status: 'invalid',
      runtime_source: undefined,
      runtime_path: undefined,
      error: (result.stderr || result.stdout || `exit ${result.status ?? 1}`).trim(),
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return {
      status: parsed.status,
      runtime_source: parsed.runtime_source,
      runtime_path: parsed.runtime_path,
    };
  } catch (err) {
    return {
      status: 'invalid',
      runtime_source: undefined,
      runtime_path: undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function splitShellWords(value: string): string[] {
  const words: string[] = [];
  let current = '';
  let quote: string | undefined;
  let escaped = false;
  for (const ch of value) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (quote !== undefined) {
      if (ch === quote) {
        quote = undefined;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) {
        words.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) words.push(current);
  return words;
}

function commandFromHookHandler(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as JsonRecord;
  return typeof record.command === 'string' ? record.command : undefined;
}

function circuitHookCommands(entries: readonly unknown[]): string[] {
  const commands: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    if (!('hooks' in entry) || !Array.isArray(entry.hooks)) continue;
    for (const hook of entry.hooks) {
      const command = commandFromHookHandler(hook);
      if (command?.includes('handoff hook --host codex')) commands.push(command);
    }
  }
  return commands;
}

function launcherPathFromCommand(command: string): string | undefined {
  const words = splitShellWords(command);
  const index = words.findIndex(
    (word, candidateIndex) =>
      word === 'handoff' &&
      words[candidateIndex + 1] === 'hook' &&
      words[candidateIndex + 2] === '--host' &&
      words[candidateIndex + 3] === 'codex',
  );
  return index >= 1 ? words[index - 1] : undefined;
}

function codexHookSummary(codexHome: string): JsonRecord {
  const hooksPath = resolve(codexHome, 'hooks.json');
  if (!existsSync(hooksPath)) {
    return {
      status: 'missing',
      hooks_path: hooksPath,
      circuit_hook_count: 0,
      foreign_session_start_count: 0,
      launchers: [],
      missing_launchers: [],
    };
  }

  let parsed: JsonRecord;
  try {
    parsed = readJson(hooksPath);
  } catch (err) {
    return {
      status: 'invalid',
      hooks_path: hooksPath,
      circuit_hook_count: 0,
      foreign_session_start_count: 0,
      launchers: [],
      missing_launchers: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const hooks = parsed.hooks as JsonRecord | undefined;
  const entries = hooks?.SessionStart;
  if (!Array.isArray(entries)) {
    return {
      status: 'missing',
      hooks_path: hooksPath,
      circuit_hook_count: 0,
      foreign_session_start_count: 0,
      launchers: [],
      missing_launchers: [],
    };
  }

  const commands = circuitHookCommands(entries);
  const launchers = commands.map(launcherPathFromCommand).filter((item) => item !== undefined);
  const missingLaunchers = launchers.filter((launcher) => !existsSync(launcher));
  const status =
    commands.length === 0
      ? 'missing'
      : commands.length > 1 || launchers.length !== commands.length || missingLaunchers.length > 0
        ? 'invalid'
        : 'ok';

  return {
    status,
    hooks_path: hooksPath,
    circuit_hook_count: commands.length,
    foreign_session_start_count: entries.length - commands.length,
    launchers,
    missing_launchers: missingLaunchers,
  };
}

function pluginStatus(
  sourceRoot: string,
  installedRoot: string,
  env: NodeJS.ProcessEnv,
): JsonRecord {
  const packageTree = packageTreeStatus(sourceRoot, installedRoot);
  const doctor = runDoctor(resolve(installedRoot, 'scripts/circuit.ts'), env);
  return {
    installed_root: installedRoot,
    package_tree: packageTree,
    runtime_source: doctor.runtime_source,
    runtime_path: doctor.runtime_path,
    doctor_status: doctor.status,
    ...(doctor.error === undefined ? {} : { doctor_error: doctor.error }),
    status:
      packageTree.status === 'ok' && doctor.status === 'ok' && doctor.runtime_source === 'bundled'
        ? 'ok'
        : 'invalid',
  };
}

try {
  const version = readJson<{ version: string }>(resolve(repoRoot, 'plugins/version.json')).version;
  const home = process.env.HOME ?? homedir();
  const codexHome = process.env.CODEX_HOME ?? resolve(home, '.codex');
  const claudeInstalledRoot = resolve(home, '.claude/plugins/cache/circuit/circuit', version);
  const codexInstalledRoot = resolve(codexHome, 'plugins/cache/circuit-local/circuit', version);
  const claude = pluginStatus(resolve(repoRoot, 'plugins/claude'), claudeInstalledRoot, {
    HOME: home,
  });
  const codex = pluginStatus(resolve(repoRoot, 'plugins/codex'), codexInstalledRoot, {
    CODEX_HOME: codexHome,
  });
  const codexHooks = codexHookSummary(codexHome);
  const status =
    claude.status === 'ok' &&
    codex.status === 'ok' &&
    (codexHooks.status === 'ok' || codexHooks.status === 'missing')
      ? 'ok'
      : 'invalid';

  console.log(
    JSON.stringify(
      {
        schema_version: 1,
        status,
        repo_root: repoRoot,
        repo_version: version,
        claude,
        codex,
        codex_hooks: codexHooks,
      },
      null,
      2,
    ),
  );
  process.exit(status === 'ok' ? 0 : 1);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}
