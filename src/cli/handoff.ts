import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRunStatusFromRunFolder } from '../run-status/project-run-folder.js';
import { CompiledFlow } from '../schemas/compiled-flow.js';
import {
  ContinuityIndex,
  type ContinuityIndex as ContinuityIndexValue,
  ContinuityRecord,
  type ContinuityRecord as ContinuityRecordValue,
} from '../schemas/continuity.js';
import type { ControlPlaneFileStem } from '../schemas/scalars.js';
import type { Snapshot, SnapshotStatus } from '../schemas/snapshot.js';
import { readManifestSnapshot } from '../shared/manifest-snapshot.js';
import { progressPresentation } from '../shared/progress-output.js';
import { utilityProgress } from './utility-progress.js';

type HandoffAction = 'save' | 'resume' | 'done' | 'brief' | 'hook' | 'hooks';
type HandoffHookHost = 'codex';
type HandoffHooksAction = 'install' | 'uninstall' | 'doctor';

interface HandoffArgs {
  readonly action: HandoffAction;
  readonly hooksAction?: HandoffHooksAction;
  readonly host?: string;
  readonly goal?: string;
  readonly next?: string;
  readonly stateMarkdown?: string;
  readonly debtMarkdown?: string;
  readonly runFolder?: string;
  readonly controlPlane?: string;
  readonly projectRoot?: string;
  readonly hooksFile?: string;
  readonly launcher?: string;
  readonly recordId?: string;
  readonly createdAt?: string;
  readonly progress: boolean;
  readonly json: boolean;
}

interface HandoffMainOptions {
  readonly now?: () => Date;
}

const DEFAULT_CONTROL_PLANE = '.circuit-next';
const HANDOFF_BRIEF_API_VERSION = 'handoff-brief-v1';
const HANDOFF_BRIEF_SCHEMA_VERSION = 1;
const HANDOFF_BRIEF_MAX_CHARS = 3000;
const HANDOFF_HOOKS_API_VERSION = 'handoff-hooks-v1';
const HANDOFF_HOOKS_SCHEMA_VERSION = 1;
const CIRCUIT_HOOK_MARKER = 'CIRCUIT_HANDOFF_HOOK=1';

type HandoffBriefRenderResult =
  | { readonly ok: true; readonly additionalContext: string }
  | { readonly ok: false; readonly code: string; readonly message: string };

function usage(): string {
  return [
    'usage: circuit-next handoff [save] --goal "<goal>" --next "<next>" [--state-markdown <md>] [--debt-markdown <md>] [--run-folder <path>] [--control-plane <path>] [--record-id <stem>] [--progress jsonl]',
    '       circuit-next handoff resume [--control-plane <path>] [--progress jsonl]',
    '       circuit-next handoff done [--control-plane <path>] [--progress jsonl]',
    '       circuit-next handoff brief --json [--control-plane <path>] [--project-root <path>]',
    '       circuit-next handoff hook --host codex [--project-root <path>]',
    '       circuit-next handoff hooks install|uninstall|doctor --host codex [--hooks-file <path>] [--launcher <path>]',
  ].join('\n');
}

function takeValue(argv: readonly string[], index: number, flag: string): string {
  const next = argv[index + 1];
  if (next === undefined || next.length === 0) throw new Error(`${flag} requires a value`);
  return next;
}

function parseArgs(argv: readonly string[]): HandoffArgs {
  let action: HandoffAction = 'save';
  let hooksAction: HandoffHooksAction | undefined;
  let host: string | undefined;
  let goal: string | undefined;
  let next: string | undefined;
  let stateMarkdown: string | undefined;
  let debtMarkdown: string | undefined;
  let runFolder: string | undefined;
  let controlPlane: string | undefined;
  let projectRoot: string | undefined;
  let hooksFile: string | undefined;
  let launcher: string | undefined;
  let recordId: string | undefined;
  let createdAt: string | undefined;
  let progress = false;
  let json = false;

  let start = 0;
  const first = argv[0];
  if (
    first === 'save' ||
    first === 'resume' ||
    first === 'done' ||
    first === 'brief' ||
    first === 'hook'
  ) {
    action = first;
    start = 1;
  } else if (first === 'hooks') {
    action = 'hooks';
    const subcommand = argv[1];
    if (subcommand !== 'install' && subcommand !== 'uninstall' && subcommand !== 'doctor') {
      throw new Error('handoff hooks requires install, uninstall, or doctor');
    }
    hooksAction = subcommand;
    start = 2;
  }

  for (let i = start; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === undefined) continue;
    if (tok === '--host') {
      host = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--goal') {
      goal = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--next') {
      next = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--state-markdown') {
      stateMarkdown = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--debt-markdown') {
      debtMarkdown = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--run-folder') {
      runFolder = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--control-plane') {
      controlPlane = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--project-root') {
      projectRoot = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--hooks-file') {
      hooksFile = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--launcher') {
      launcher = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--record-id') {
      recordId = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--created-at') {
      createdAt = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--progress') {
      const value = takeValue(argv, i, tok);
      if (value !== 'jsonl') throw new Error("--progress only supports 'jsonl'");
      progress = true;
      i += 1;
      continue;
    }
    if (tok === '--json') {
      json = true;
      continue;
    }
    if (tok === '--help' || tok === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    throw new Error(tok.startsWith('--') ? `unknown flag: ${tok}` : `unexpected argument: ${tok}`);
  }

  return {
    action,
    ...(hooksAction === undefined ? {} : { hooksAction }),
    ...(host === undefined ? {} : { host }),
    progress,
    json,
    ...(goal === undefined ? {} : { goal }),
    ...(next === undefined ? {} : { next }),
    ...(stateMarkdown === undefined ? {} : { stateMarkdown }),
    ...(debtMarkdown === undefined ? {} : { debtMarkdown }),
    ...(runFolder === undefined ? {} : { runFolder }),
    ...(controlPlane === undefined ? {} : { controlPlane }),
    ...(projectRoot === undefined ? {} : { projectRoot }),
    ...(hooksFile === undefined ? {} : { hooksFile }),
    ...(launcher === undefined ? {} : { launcher }),
    ...(recordId === undefined ? {} : { recordId }),
    ...(createdAt === undefined ? {} : { createdAt }),
  };
}

function resolveProjectRootArg(args: HandoffArgs): string {
  return resolve(args.projectRoot ?? process.cwd());
}

function resolveControlPlaneArg(args: HandoffArgs): string {
  if (args.controlPlane !== undefined) return resolve(args.controlPlane);
  return resolve(resolveProjectRootArg(args), DEFAULT_CONTROL_PLANE);
}

function continuityRoot(controlPlane: string): string {
  return resolve(controlPlane, 'continuity');
}

function recordsRoot(controlPlane: string): string {
  return join(continuityRoot(controlPlane), 'records');
}

function indexPath(controlPlane: string): string {
  return join(continuityRoot(controlPlane), 'index.json');
}

function recordPath(controlPlane: string, recordId: string): string {
  return join(recordsRoot(controlPlane), `${recordId}.json`);
}

function utilityReportsRoot(controlPlane: string): string {
  return join(continuityRoot(controlPlane), 'reports');
}

function handoffResultPath(controlPlane: string, action: HandoffAction): string {
  return join(utilityReportsRoot(controlPlane), `${action}-result.json`);
}

function operatorSummaryPath(controlPlane: string): string {
  return join(utilityReportsRoot(controlPlane), 'operator-summary.md');
}

function activeRunPath(controlPlane: string): string {
  return join(controlPlane, 'active-run.md');
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeMarkdown(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`);
}

function composeHandoffBrief(record: ContinuityRecordValue, state: string, debt: string): string {
  return [
    'Circuit handoff is present for this repo.',
    '',
    `Goal: ${record.narrative.goal}`,
    `Next: ${record.narrative.next}`,
    '',
    'State:',
    state,
    '',
    'Open constraints or debt:',
    debt,
    '',
    'Boundary: Use this as context only. Do not continue unless the user asks.',
    'Useful commands: /circuit:handoff resume, /circuit:handoff done',
  ].join('\n');
}

function fitText(value: string, budget: number): string {
  const marker = '\n[truncated]';
  if (value.length <= budget) return value;
  if (budget <= 0) return '';
  if (budget <= marker.length) return marker.slice(0, budget);
  return `${value.slice(0, budget - marker.length)}${marker}`;
}

function renderHandoffBrief(record: ContinuityRecordValue): HandoffBriefRenderResult {
  const state = record.narrative.state_markdown;
  const debt = record.narrative.debt_markdown;
  const full = composeHandoffBrief(record, state, debt);
  if (full.length <= HANDOFF_BRIEF_MAX_CHARS) {
    return { ok: true, additionalContext: full };
  }

  const fixed = composeHandoffBrief(record, '', '');
  if (fixed.length > HANDOFF_BRIEF_MAX_CHARS) {
    return {
      ok: false,
      code: 'brief_too_large',
      message:
        'Handoff goal and next action are too large to inject without dropping required safety framing.',
    };
  }
  const remaining = Math.max(0, HANDOFF_BRIEF_MAX_CHARS - fixed.length);
  let stateBudget = Math.floor(remaining / 2);
  let debtBudget = remaining - stateBudget;

  if (state.length < stateBudget) {
    debtBudget += stateBudget - state.length;
    stateBudget = state.length;
  }
  if (debt.length < debtBudget) {
    stateBudget += debtBudget - debt.length;
    debtBudget = debt.length;
  }

  let renderedState = fitText(state, stateBudget);
  let renderedDebt = fitText(debt, debtBudget);
  let rendered = composeHandoffBrief(record, renderedState, renderedDebt);

  if (rendered.length > HANDOFF_BRIEF_MAX_CHARS) {
    const overflow = rendered.length - HANDOFF_BRIEF_MAX_CHARS;
    renderedDebt = fitText(renderedDebt, Math.max(0, renderedDebt.length - overflow));
    rendered = composeHandoffBrief(record, renderedState, renderedDebt);
  }
  if (rendered.length > HANDOFF_BRIEF_MAX_CHARS) {
    const overflow = rendered.length - HANDOFF_BRIEF_MAX_CHARS;
    renderedState = fitText(renderedState, Math.max(0, renderedState.length - overflow));
    rendered = composeHandoffBrief(record, renderedState, renderedDebt);
  }

  if (rendered.length > HANDOFF_BRIEF_MAX_CHARS) {
    return {
      ok: false,
      code: 'brief_too_large',
      message: 'Handoff brief could not fit within the injection cap.',
    };
  }

  return { ok: true, additionalContext: rendered };
}

function emptyBrief(args: HandoffArgs, reason: 'no_index' | 'no_pending_record') {
  const projectRoot = resolveProjectRootArg(args);
  const controlPlane = resolveControlPlaneArg(args);
  return {
    api_version: HANDOFF_BRIEF_API_VERSION,
    schema_version: HANDOFF_BRIEF_SCHEMA_VERSION,
    status: 'empty',
    reason,
    project_root: projectRoot,
    control_plane: controlPlane,
    index_path: indexPath(controlPlane),
  };
}

function invalidBrief(
  args: HandoffArgs,
  code: string,
  message: string,
  recordId?: ControlPlaneFileStem,
) {
  const projectRoot = resolveProjectRootArg(args);
  const controlPlane = resolveControlPlaneArg(args);
  return {
    api_version: HANDOFF_BRIEF_API_VERSION,
    schema_version: HANDOFF_BRIEF_SCHEMA_VERSION,
    status: 'invalid',
    project_root: projectRoot,
    control_plane: controlPlane,
    index_path: indexPath(controlPlane),
    ...(recordId === undefined ? {} : { record_id: recordId }),
    error: { code, message },
  };
}

function handoffBrief(args: HandoffArgs) {
  const projectRoot = resolveProjectRootArg(args);
  const controlPlane = resolveControlPlaneArg(args);
  const indexAbs = indexPath(controlPlane);
  if (!existsSync(indexAbs)) return emptyBrief(args, 'no_index');

  let index: ContinuityIndexValue;
  try {
    index = ContinuityIndex.parse(JSON.parse(readFileSync(indexAbs, 'utf8')));
  } catch {
    return invalidBrief(args, 'index_invalid', 'Continuity index is malformed.');
  }

  if (index.pending_record === null) return emptyBrief(args, 'no_pending_record');

  const recordAbs = recordPath(controlPlane, index.pending_record.record_id);
  if (!existsSync(recordAbs)) {
    return invalidBrief(
      args,
      'record_missing',
      'Continuity index points at a missing record.',
      index.pending_record.record_id,
    );
  }

  let record: ContinuityRecordValue;
  try {
    record = ContinuityRecord.parse(JSON.parse(readFileSync(recordAbs, 'utf8')));
  } catch {
    return invalidBrief(
      args,
      'record_invalid',
      'Continuity record is malformed.',
      index.pending_record.record_id,
    );
  }

  if (record.continuity_kind !== index.pending_record.continuity_kind) {
    return invalidBrief(
      args,
      'record_kind_mismatch',
      'Continuity index kind disagrees with the pointed record.',
      index.pending_record.record_id,
    );
  }

  const rendered = renderHandoffBrief(record);
  if (!rendered.ok) {
    return invalidBrief(args, rendered.code, rendered.message, index.pending_record.record_id);
  }

  return {
    api_version: HANDOFF_BRIEF_API_VERSION,
    schema_version: HANDOFF_BRIEF_SCHEMA_VERSION,
    status: 'available',
    project_root: projectRoot,
    control_plane: controlPlane,
    index_path: indexAbs,
    record_id: record.record_id,
    continuity_kind: record.continuity_kind,
    created_at: record.created_at,
    additional_context: rendered.additionalContext,
  };
}

function debugHook(message: string): void {
  if (process.env.CIRCUIT_HANDOFF_HOOK_DEBUG === '1') {
    process.stderr.write(`Circuit handoff hook: ${message}\n`);
  }
}

function readHookInput(): unknown {
  if (process.stdin.isTTY) return {};
  const raw = readFileSync(0, 'utf8');
  if (raw.trim().length === 0) return {};
  return JSON.parse(raw);
}

function projectRootFromHookInput(input: unknown): string | undefined {
  if (
    typeof input === 'object' &&
    input !== null &&
    'cwd' in input &&
    typeof input.cwd === 'string' &&
    input.cwd.length > 0
  ) {
    return input.cwd;
  }
  return undefined;
}

function parseHookHost(args: HandoffArgs): HandoffHookHost {
  if (args.host === 'codex') return 'codex';
  throw new Error('handoff hook requires --host codex');
}

function runHandoffHook(args: HandoffArgs): number {
  try {
    parseHookHost(args);
  } catch (err) {
    debugHook(err instanceof Error ? err.message : String(err));
    return 0;
  }

  let projectRoot = args.projectRoot;
  if (projectRoot === undefined) {
    let input: unknown;
    try {
      input = readHookInput();
    } catch (err) {
      debugHook(`could not parse hook input: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
    projectRoot = projectRootFromHookInput(input);
  }

  if (projectRoot === undefined || projectRoot.length === 0) {
    debugHook('hook input did not include cwd; skipping handoff injection');
    return 0;
  }

  try {
    const brief = handoffBrief({
      action: 'brief',
      projectRoot,
      progress: false,
      json: true,
    }) as { status?: string; additional_context?: unknown; error?: { code?: string } };
    if (brief.status === 'invalid') {
      debugHook(`brief state is invalid: ${brief.error?.code ?? 'unknown'}`);
      return 0;
    }
    if (brief.status !== 'available' || typeof brief.additional_context !== 'string') return 0;

    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: brief.additional_context,
        },
      })}\n`,
    );
  } catch (err) {
    debugHook(`brief command failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return 0;
}

function defaultCodexHooksFile(): string {
  const codexHome = process.env.CODEX_HOME ?? resolve(homedir(), '.codex');
  return resolve(codexHome, 'hooks.json');
}

function defaultLauncherPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'bin/circuit-next');
}

function parseCodexHooksHost(args: HandoffArgs): HandoffHookHost {
  if (args.host === 'codex') return 'codex';
  throw new Error('handoff hooks requires --host codex');
}

function resolveHooksFileArg(args: HandoffArgs): string {
  return resolve(args.hooksFile ?? defaultCodexHooksFile());
}

function resolveLauncherArg(args: HandoffArgs): string {
  const launcher = resolve(args.launcher ?? defaultLauncherPath());
  if (!existsSync(launcher)) {
    throw new Error(`Circuit launcher not found: ${launcher}`);
  }
  return launcher;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function codexHookCommand(launcher: string): string {
  return [
    CIRCUIT_HOOK_MARKER,
    shellQuote(process.execPath),
    shellQuote(launcher),
    'handoff',
    'hook',
    '--host',
    'codex',
  ].join(' ');
}

function defaultHooksConfig(): Record<string, unknown> {
  return { hooks: {} };
}

function readHooksConfig(path: string): Record<string, unknown> {
  if (!existsSync(path)) return defaultHooksConfig();
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('hooks file must contain a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function hooksObject(config: Record<string, unknown>): Record<string, unknown> {
  const hooks = config.hooks;
  if (hooks === undefined) {
    const next: Record<string, unknown> = {};
    config.hooks = next;
    return next;
  }
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) {
    throw new Error('hooks file has invalid hooks object');
  }
  return hooks as Record<string, unknown>;
}

function sessionStartEntries(config: Record<string, unknown>): unknown[] {
  const entries = hooksObject(config).SessionStart;
  if (entries === undefined) return [];
  if (!Array.isArray(entries)) {
    throw new Error('hooks.SessionStart must be an array');
  }
  return entries;
}

function setSessionStartEntries(config: Record<string, unknown>, entries: unknown[]): void {
  hooksObject(config).SessionStart = entries;
}

function circuitCodexHookEntry(command: string): Record<string, unknown> {
  return {
    matcher: 'startup|resume|clear',
    hooks: [
      {
        type: 'command',
        command,
        timeout: 3,
      },
    ],
  };
}

function isCircuitCodexHookEntry(entry: unknown): boolean {
  return JSON.stringify(entry).includes('handoff hook --host codex');
}

function splitShellWords(command: string): string[] {
  const words: string[] = [];
  let current = '';
  let inSingle = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (char === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && char === '\\' && i + 1 < command.length) {
      current += command[i + 1];
      i += 1;
      continue;
    }
    if (!inSingle && /\s/.test(char ?? '')) {
      if (current.length > 0) {
        words.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (current.length > 0) words.push(current);
  return words;
}

function commandFromHookHandler(value: unknown): string | undefined {
  if (
    typeof value === 'object' &&
    value !== null &&
    'command' in value &&
    typeof value.command === 'string'
  ) {
    return value.command;
  }
  return undefined;
}

function circuitHookCommands(entries: readonly unknown[]): string[] {
  const commands: string[] = [];
  for (const entry of entries) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('hooks' in entry) ||
      !Array.isArray(entry.hooks)
    ) {
      continue;
    }
    for (const hook of entry.hooks) {
      const command = commandFromHookHandler(hook);
      if (command?.includes('handoff hook --host codex')) {
        commands.push(command);
      }
    }
  }
  return commands;
}

function circuitHookEntryCount(entries: readonly unknown[]): number {
  return entries.filter(isCircuitCodexHookEntry).length;
}

function launcherPathFromCircuitHookCommand(command: string): string | undefined {
  const words = splitShellWords(command);
  const handoffIndex = words.findIndex(
    (word, index) =>
      word === 'handoff' &&
      words[index + 1] === 'hook' &&
      words[index + 2] === '--host' &&
      words[index + 3] === 'codex',
  );
  if (handoffIndex < 1) return undefined;
  const launcher = words[handoffIndex - 1];
  if (launcher === undefined || launcher.length === 0) return undefined;
  return launcher;
}

function writeHooksConfig(
  path: string,
  config: Record<string, unknown>,
): { readonly backupPath?: string } {
  mkdirSync(dirname(path), { recursive: true });
  let backupPath: string | undefined;
  if (existsSync(path)) {
    const candidate = `${path}.circuit-backup`;
    if (!existsSync(candidate)) {
      copyFileSync(path, candidate);
      backupPath = candidate;
    }
  }
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return backupPath === undefined ? {} : { backupPath };
}

function installCodexHandoffHook(args: HandoffArgs) {
  parseCodexHooksHost(args);
  const hooksPath = resolveHooksFileArg(args);
  const launcher = resolveLauncherArg(args);
  const command = codexHookCommand(launcher);
  const config = readHooksConfig(hooksPath);
  const entry = circuitCodexHookEntry(command);
  const entries = sessionStartEntries(config);
  const existingCircuitEntries = entries.filter(isCircuitCodexHookEntry);
  const alreadyInstalled =
    existingCircuitEntries.length === 1 &&
    JSON.stringify(existingCircuitEntries[0]) === JSON.stringify(entry);

  if (alreadyInstalled) {
    return {
      api_version: HANDOFF_HOOKS_API_VERSION,
      schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
      host: 'codex',
      action: 'install',
      status: 'already_installed',
      hooks_path: hooksPath,
      launcher,
      command,
    };
  }

  setSessionStartEntries(config, [
    ...entries.filter((item) => !isCircuitCodexHookEntry(item)),
    entry,
  ]);
  const { backupPath } = writeHooksConfig(hooksPath, config);
  return {
    api_version: HANDOFF_HOOKS_API_VERSION,
    schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
    host: 'codex',
    action: 'install',
    status: 'installed',
    hooks_path: hooksPath,
    launcher,
    command,
    ...(backupPath === undefined ? {} : { backup_path: backupPath }),
  };
}

function uninstallCodexHandoffHook(args: HandoffArgs) {
  parseCodexHooksHost(args);
  const hooksPath = resolveHooksFileArg(args);
  if (!existsSync(hooksPath)) {
    return {
      api_version: HANDOFF_HOOKS_API_VERSION,
      schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
      host: 'codex',
      action: 'uninstall',
      status: 'not_installed',
      hooks_path: hooksPath,
    };
  }
  const config = readHooksConfig(hooksPath);
  const entries = sessionStartEntries(config);
  const nextEntries = entries.filter((item) => !isCircuitCodexHookEntry(item));
  if (nextEntries.length === entries.length) {
    return {
      api_version: HANDOFF_HOOKS_API_VERSION,
      schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
      host: 'codex',
      action: 'uninstall',
      status: 'not_installed',
      hooks_path: hooksPath,
    };
  }

  setSessionStartEntries(config, nextEntries);
  const { backupPath } = writeHooksConfig(hooksPath, config);
  return {
    api_version: HANDOFF_HOOKS_API_VERSION,
    schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
    host: 'codex',
    action: 'uninstall',
    status: 'uninstalled',
    hooks_path: hooksPath,
    ...(backupPath === undefined ? {} : { backup_path: backupPath }),
  };
}

function doctorCodexHandoffHook(args: HandoffArgs) {
  parseCodexHooksHost(args);
  const hooksPath = resolveHooksFileArg(args);
  const checks: Array<{ name: string; ok: boolean; detail?: string; severity?: 'warning' }> = [];
  checks.push({ name: 'hooks_file_exists', ok: existsSync(hooksPath), detail: hooksPath });

  let config: Record<string, unknown> | undefined;
  try {
    config = readHooksConfig(hooksPath);
    checks.push({ name: 'hooks_file_parseable', ok: true, detail: hooksPath });
  } catch (err) {
    checks.push({
      name: 'hooks_file_parseable',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  if (config !== undefined) {
    try {
      const entries = sessionStartEntries(config);
      const circuitEntryCount = circuitHookEntryCount(entries);
      const commands = circuitHookCommands(entries);
      const launchers = commands
        .map(launcherPathFromCircuitHookCommand)
        .filter((item): item is string => item !== undefined);
      checks.push({ name: 'session_start_array', ok: true, detail: `${entries.length} entries` });
      checks.push({
        name: 'circuit_handoff_hook_installed',
        ok: circuitEntryCount > 0,
        detail: `${circuitEntryCount} Circuit hooks in ${hooksPath}`,
      });
      checks.push({
        name: 'circuit_handoff_hook_single',
        ok: circuitEntryCount === 1 && commands.length === 1,
        detail: `${circuitEntryCount} Circuit entries, ${commands.length} Circuit commands`,
      });
      checks.push({
        name: 'circuit_handoff_hook_launcher_exists',
        ok: launchers.length > 0 && launchers.every((launcher) => existsSync(launcher)),
        detail: launchers.length > 0 ? launchers.join(', ') : 'launcher not found in hook command',
      });
    } catch (err) {
      checks.push({
        name: 'session_start_array',
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
      checks.push({
        name: 'circuit_handoff_hook_installed',
        ok: false,
        detail: hooksPath,
      });
      checks.push({
        name: 'circuit_handoff_hook_launcher_exists',
        ok: false,
        detail: 'launcher not found in hook command',
      });
    }
  }

  const failed = checks.filter((item) => !item.ok && item.severity !== 'warning');
  const installedCheck = checks.find((item) => item.name === 'circuit_handoff_hook_installed');
  const structuralFailure = failed.some(
    (item) => item.name === 'hooks_file_parseable' || item.name === 'session_start_array',
  );
  const status = !existsSync(hooksPath)
    ? 'missing'
    : structuralFailure
      ? 'invalid'
      : installedCheck?.ok === false
        ? 'missing'
        : failed.length === 0
          ? 'ok'
          : 'invalid';
  return {
    api_version: HANDOFF_HOOKS_API_VERSION,
    schema_version: HANDOFF_HOOKS_SCHEMA_VERSION,
    host: 'codex',
    action: 'doctor',
    status,
    hooks_path: hooksPath,
    checks,
  };
}

function runHandoffHooksCommand(args: HandoffArgs): unknown {
  if (args.hooksAction === 'install') return installCodexHandoffHook(args);
  if (args.hooksAction === 'uninstall') return uninstallCodexHandoffHook(args);
  if (args.hooksAction === 'doctor') return doctorCodexHandoffHook(args);
  throw new Error('handoff hooks requires install, uninstall, or doctor');
}

function stageForCurrentStep(flow: CompiledFlow, currentStep: string): string {
  const stage = flow.stages.find((candidate) => candidate.steps.includes(currentStep as never));
  return stage?.canonical ?? stage?.id ?? 'frame';
}

function snapshotStatusFromRunStatus(
  status: ReturnType<typeof projectRunStatusFromRunFolder>,
): SnapshotStatus {
  switch (status.engine_state) {
    case 'open':
    case 'waiting_checkpoint':
      return 'in_progress';
    case 'completed':
      return status.terminal_outcome;
    case 'aborted':
      return 'aborted';
    case 'invalid':
      throw new Error('cannot save run-backed continuity: run status is invalid');
  }
}

function loadRunBackedSnapshot(runFolder: string): {
  readonly snapshot: Pick<
    Snapshot,
    'run_id' | 'invocation_id' | 'current_step' | 'status' | 'updated_at'
  >;
  readonly currentStage: string;
} {
  const status = projectRunStatusFromRunFolder(runFolder);
  if (status.engine_state === 'invalid') {
    throw new Error(`cannot save run-backed continuity: ${status.error.message}`);
  }
  const manifest = readManifestSnapshot(runFolder);
  const flow = CompiledFlow.parse(
    JSON.parse(Buffer.from(manifest.bytes_base64, 'base64').toString('utf8')),
  );
  const currentStep =
    ('current_step' in status ? status.current_step?.step_id : undefined) ??
    flow.entry_modes[0]?.start_at;
  if (currentStep === undefined) {
    throw new Error(`cannot save run-backed continuity: ${runFolder} has no current step`);
  }
  const updatedAt = status.last_event?.timestamp;
  if (updatedAt === undefined) {
    throw new Error(`cannot save run-backed continuity: ${runFolder} has no latest event`);
  }
  return {
    snapshot: {
      run_id: status.run_id,
      current_step: currentStep,
      status: snapshotStatusFromRunStatus(status),
      updated_at: updatedAt,
    },
    currentStage: stageForCurrentStep(flow, currentStep),
  };
}

function buildRecord(args: HandoffArgs, now: () => Date): ContinuityRecordValue {
  if (args.goal === undefined || args.goal.length === 0) {
    throw new Error('--goal is required when saving handoff continuity');
  }
  if (args.next === undefined || args.next.length === 0) {
    throw new Error('--next is required when saving handoff continuity');
  }
  const projectRoot = resolveProjectRootArg(args);
  const createdAt = args.createdAt ?? now().toISOString();
  const recordId = (args.recordId ?? `continuity-${randomUUID()}`) as ControlPlaneFileStem;
  const base = {
    schema_version: 1 as const,
    record_id: recordId,
    project_root: projectRoot,
    created_at: createdAt,
    git: { cwd: projectRoot },
    narrative: {
      goal: args.goal,
      next: args.next,
      state_markdown: args.stateMarkdown ?? '- No extra session state was provided.',
      debt_markdown: args.debtMarkdown ?? '- No open debt was recorded.',
    },
  };

  if (args.runFolder === undefined) {
    return ContinuityRecord.parse({
      ...base,
      continuity_kind: 'standalone',
      resume_contract: {
        mode: 'resume_standalone',
        auto_resume: false,
        requires_explicit_resume: true,
      },
    });
  }

  const runFolder = resolve(args.runFolder);
  const { snapshot, currentStage } = loadRunBackedSnapshot(runFolder);
  if (snapshot.current_step === undefined) {
    throw new Error(`cannot save run-backed continuity: ${runFolder} has no current step`);
  }
  return ContinuityRecord.parse({
    ...base,
    continuity_kind: 'run-backed',
    run_ref: {
      run_id: snapshot.run_id,
      ...(snapshot.invocation_id === undefined ? {} : { invocation_id: snapshot.invocation_id }),
      current_stage: currentStage,
      current_step: snapshot.current_step,
      runtime_status: snapshot.status,
      runtime_updated_at: snapshot.updated_at,
    },
    resume_contract: {
      mode: 'resume_run',
      auto_resume: false,
      requires_explicit_resume: true,
    },
  });
}

function summaryForRecord(record: ContinuityRecordValue, source: string): string {
  return [
    '# Circuit Handoff',
    '',
    `Source: ${source}`,
    `Record: ${record.record_id}`,
    `Kind: ${record.continuity_kind}`,
    '',
    '## Goal',
    record.narrative.goal,
    '',
    '## Next Action',
    record.narrative.next,
    '',
    '## State',
    record.narrative.state_markdown,
    '',
    '## Debt',
    record.narrative.debt_markdown,
  ].join('\n');
}

function writeActiveRun(controlPlane: string, record: ContinuityRecordValue): string | undefined {
  if (record.continuity_kind !== 'run-backed') return undefined;
  const path = activeRunPath(controlPlane);
  writeMarkdown(
    path,
    [
      '# Active Circuit Run',
      '',
      `Run: ${record.run_ref.run_id}`,
      `Status: ${record.run_ref.runtime_status}`,
      `Stage: ${record.run_ref.current_stage}`,
      `Step: ${record.run_ref.current_step}`,
      '',
      `Next: ${record.narrative.next}`,
    ].join('\n'),
  );
  return path;
}

function saveContinuity(args: HandoffArgs, now: () => Date) {
  const controlPlane = resolveControlPlaneArg(args);
  const record = buildRecord(args, now);
  const recordAbs = recordPath(controlPlane, record.record_id);
  writeJson(recordAbs, record);
  const index = ContinuityIndex.parse({
    schema_version: 1,
    project_root: record.project_root,
    pending_record: {
      record_id: record.record_id,
      continuity_kind: record.continuity_kind,
      created_at: record.created_at,
    },
    current_run:
      record.continuity_kind === 'run-backed'
        ? {
            run_id: record.run_ref.run_id,
            current_stage: record.run_ref.current_stage,
            current_step: record.run_ref.current_step,
            runtime_status: record.run_ref.runtime_status,
            attached_at: record.created_at,
            last_validated_at: record.created_at,
          }
        : null,
  });
  writeJson(indexPath(controlPlane), index);
  const activeRun = writeActiveRun(controlPlane, record);
  const summaryPath = operatorSummaryPath(controlPlane);
  writeMarkdown(summaryPath, summaryForRecord(record, 'saved continuity record'));
  const result = {
    schema_version: 1,
    action: 'save',
    status: 'saved',
    record_id: record.record_id,
    continuity_path: recordAbs,
    index_path: indexPath(controlPlane),
    ...(activeRun === undefined ? {} : { active_run_path: activeRun }),
    operator_summary_markdown_path: summaryPath,
  };
  const resultPath = handoffResultPath(controlPlane, 'save');
  writeJson(resultPath, result);
  return { ...result, result_path: resultPath };
}

function readJsonSafely(path: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, 'utf8')) };
  } catch {
    return { ok: false };
  }
}

function invalidResumeResult(
  controlPlane: string,
  code: string,
  message: string,
  recordId?: ControlPlaneFileStem,
) {
  const summaryPath = operatorSummaryPath(controlPlane);
  writeMarkdown(
    summaryPath,
    `# Circuit Handoff\n\nSaved continuity record could not be resumed: ${message}`,
  );
  const result = {
    schema_version: 1 as const,
    action: 'resume' as const,
    status: 'invalid' as const,
    index_path: indexPath(controlPlane),
    ...(recordId === undefined ? {} : { record_id: recordId }),
    operator_summary_markdown_path: summaryPath,
    error: { code, message },
  };
  const resultPath = handoffResultPath(controlPlane, 'resume');
  writeJson(resultPath, result);
  return { ...result, result_path: resultPath };
}

function resumeContinuity(args: HandoffArgs) {
  const controlPlane = resolveControlPlaneArg(args);
  const indexAbs = indexPath(controlPlane);
  if (!existsSync(indexAbs)) {
    const summaryPath = operatorSummaryPath(controlPlane);
    writeMarkdown(summaryPath, '# Circuit Handoff\n\nNo saved continuity found.');
    const result = {
      schema_version: 1,
      action: 'resume',
      status: 'not_found',
      index_path: indexAbs,
      operator_summary_markdown_path: summaryPath,
    };
    const resultPath = handoffResultPath(controlPlane, 'resume');
    writeJson(resultPath, result);
    return { ...result, result_path: resultPath };
  }
  const indexRaw = readJsonSafely(indexAbs);
  if (!indexRaw.ok) {
    return invalidResumeResult(controlPlane, 'index_invalid', 'Continuity index is malformed.');
  }
  const indexParsed = ContinuityIndex.safeParse(indexRaw.value);
  if (!indexParsed.success) {
    return invalidResumeResult(controlPlane, 'index_invalid', 'Continuity index is malformed.');
  }
  const index = indexParsed.data;
  if (index.pending_record === null) {
    const summaryPath = operatorSummaryPath(controlPlane);
    writeMarkdown(summaryPath, '# Circuit Handoff\n\nNo saved continuity found.');
    const result = {
      schema_version: 1,
      action: 'resume',
      status: 'not_found',
      index_path: indexAbs,
      operator_summary_markdown_path: summaryPath,
    };
    const resultPath = handoffResultPath(controlPlane, 'resume');
    writeJson(resultPath, result);
    return { ...result, result_path: resultPath };
  }
  const recordAbs = recordPath(controlPlane, index.pending_record.record_id);
  if (!existsSync(recordAbs)) {
    return invalidResumeResult(
      controlPlane,
      'record_missing',
      'Continuity index points at a missing record.',
      index.pending_record.record_id,
    );
  }
  const recordRaw = readJsonSafely(recordAbs);
  if (!recordRaw.ok) {
    return invalidResumeResult(
      controlPlane,
      'record_invalid',
      'Continuity record is malformed.',
      index.pending_record.record_id,
    );
  }
  const recordParsed = ContinuityRecord.safeParse(recordRaw.value);
  if (!recordParsed.success) {
    return invalidResumeResult(
      controlPlane,
      'record_invalid',
      'Continuity record is malformed.',
      index.pending_record.record_id,
    );
  }
  const record = recordParsed.data;
  if (record.continuity_kind !== index.pending_record.continuity_kind) {
    return invalidResumeResult(
      controlPlane,
      'record_kind_mismatch',
      'Continuity index kind disagrees with the pointed record.',
      record.record_id,
    );
  }
  const summaryPath = operatorSummaryPath(controlPlane);
  writeMarkdown(summaryPath, summaryForRecord(record, 'pending_record'));
  const result = {
    schema_version: 1,
    action: 'resume',
    status: 'resumed',
    source: 'pending_record',
    record_id: record.record_id,
    continuity_path: recordAbs,
    index_path: indexAbs,
    operator_summary_markdown_path: summaryPath,
  };
  const resultPath = handoffResultPath(controlPlane, 'resume');
  writeJson(resultPath, result);
  return { ...result, result_path: resultPath };
}

function clearContinuity(args: HandoffArgs, now: () => Date) {
  const controlPlane = resolveControlPlaneArg(args);
  const projectRoot = resolveProjectRootArg(args);
  const createdAt = args.createdAt ?? now().toISOString();
  const index = ContinuityIndex.parse({
    schema_version: 1,
    project_root: projectRoot,
    pending_record: null,
    current_run: null,
  });
  writeJson(indexPath(controlPlane), index);
  const summaryPath = operatorSummaryPath(controlPlane);
  writeMarkdown(summaryPath, '# Circuit Handoff\n\nContinuity cleared.');
  const result = {
    schema_version: 1,
    action: 'done',
    status: 'cleared',
    index_path: indexPath(controlPlane),
    operator_summary_markdown_path: summaryPath,
    cleared_at: createdAt,
  };
  const resultPath = handoffResultPath(controlPlane, 'done');
  writeJson(resultPath, result);
  return { ...result, result_path: resultPath };
}

export async function runHandoffCommand(
  argv: readonly string[],
  options: HandoffMainOptions = {},
): Promise<number> {
  let args: HandoffArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 2;
  }

  if (args.action === 'brief') {
    if (!args.json) {
      process.stderr.write('error: handoff brief requires --json\n');
      return 2;
    }
    process.stdout.write(`${JSON.stringify(handoffBrief(args), null, 2)}\n`);
    return 0;
  }

  if (args.action === 'hook') {
    return runHandoffHook(args);
  }

  if (args.action === 'hooks') {
    try {
      process.stdout.write(`${JSON.stringify(runHandoffHooksCommand(args), null, 2)}\n`);
      return 0;
    } catch (err) {
      process.stderr.write(`error: ${(err as Error).message}\n`);
      return 1;
    }
  }

  const now = options.now ?? (() => new Date());
  const progress = utilityProgress({
    enabled: args.progress,
    flowId: 'handoff',
    now,
  });
  if (progress !== undefined) {
    progress.emit({
      type: 'route.selected',
      recorded_at: now().toISOString(),
      label: 'Selected Handoff',
      display: {
        text: `Circuit selected handoff ${args.action}.`,
        importance: 'major',
        tone: 'info',
      },
      presentation: progressPresentation({
        blockId: progress.runId,
        statusText: `Chose handoff ${args.action}.`,
      }),
      selected_flow: 'handoff' as never,
      routed_by: 'explicit',
      router_reason: 'explicit handoff utility command',
    });
  }

  try {
    const result =
      args.action === 'save'
        ? saveContinuity(args, now)
        : args.action === 'resume'
          ? resumeContinuity(args)
          : clearContinuity(args, now);
    const isInvalidResume = args.action === 'resume' && result.status === 'invalid';
    const isNotFoundResume = args.action === 'resume' && result.status === 'not_found';
    const invalidMessage =
      isInvalidResume && 'error' in result && typeof result.error === 'object' && result.error !== null && 'message' in result.error && typeof result.error.message === 'string'
        ? result.error.message
        : 'malformed continuity record';
    if (progress !== undefined) {
      const statusText = isInvalidResume
        ? 'Saved Circuit handoff could not be resumed.'
        : isNotFoundResume
          ? 'No saved Circuit handoff was found.'
          : `Handoff ${args.action} completed.`;
      const text = isInvalidResume
        ? `Circuit handoff resume aborted: ${invalidMessage}`
        : isNotFoundResume
          ? 'No saved Circuit handoff was found.'
          : `Circuit handoff ${args.action} completed.`;
      const tone = isInvalidResume ? 'error' : isNotFoundResume ? 'warning' : 'success';
      if (isInvalidResume) {
        progress.emit({
          type: 'run.aborted',
          recorded_at: now().toISOString(),
          label: 'Handoff aborted',
          display: { text, importance: 'major', tone },
          presentation: progressPresentation({ blockId: progress.runId, statusText }),
          outcome: 'aborted',
          result_path: result.result_path,
          reason: invalidMessage,
        });
      } else {
        progress.emit({
          type: 'run.completed',
          recorded_at: now().toISOString(),
          label: 'Handoff completed',
          display: { text, importance: 'major', tone },
          presentation: progressPresentation({ blockId: progress.runId, statusText }),
          outcome: 'complete',
          result_path: result.result_path,
        });
      }
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return isInvalidResume ? 1 : 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}\n`);
    return 1;
  }
}
