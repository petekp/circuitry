import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExecutorRegistry } from '../runtime/executors/index.js';
import { isRuntimeRunFolder, resumeCompiledFlow } from '../runtime/run/checkpoint-resume.js';
import type { ChildCompiledFlowResolver } from '../runtime/run/child-runner.js';
import { runCompiledFlowWithWaiting } from '../runtime/run/compiled-flow-runner.js';
import { isGraphCheckpointWaitingResult } from '../runtime/run/graph-runner.js';
import { CompiledFlow } from '../schemas/compiled-flow.js';
import { Depth } from '../schemas/depth.js';
import { CompiledFlowId, RunId } from '../schemas/ids.js';
import { computeManifestHash } from '../schemas/manifest.js';
import {
  ProgressEvent,
  type ProgressEvent as ProgressEventValue,
} from '../schemas/progress-event.js';
import { RunResult } from '../schemas/result.js';

import { classifyCompiledFlowTask } from '../flows/router.js';
import { discoverConfigLayers } from '../shared/config-loader.js';
import { validateCompiledFlowKindPolicy } from '../shared/flow-kind-policy.js';
import { readPriorRoute, writeOperatorSummary } from '../shared/operator-summary-writer.js';
import { progressDisplay, progressPresentation } from '../shared/progress-output.js';
import type { ComposeWriterFn, RelayFn } from '../shared/relay-runtime-types.js';
import { runCreateCommand } from './create.js';
import { runHandoffCommand } from './handoff.js';
import { runRunsCommand } from './runs.js';
import {
  CLI_RUNTIME_ROUTING_POLICY,
  RUNTIME_POLICY_REASONS,
  type RuntimeSupportDecision,
  applyComposeWriterPolicy,
  applyFixturePolicy,
  runtimeOutputFields,
  showRuntimeDecision,
} from './runtime-routing-policy.js';

// Runtime CLI entry point — invoked through ./bin/circuit-next.
//
// Loads the named flow fixture at generated/flows/<flow-name>/circuit.json,
// parses it through the CompiledFlow schema, validates kind-canonical
// stage-set policy, composes the runtime boundary via the runner, and
// prints the <run-folder> path on success.
//
// Invocation-layer flags stay narrow (--goal, --depth, --run-folder,
// --fixture, --flow-root). The product path discovers user-global and
// project config files and supplies them as LayeredConfigs to the
// selection resolver.
//
// `--dry-run` fails closed. An earlier version accepted the flag as a
// no-op while still spawning the real connector — a safety bug. The
// flag stays rejected until real dry-run support lands.

const DEFAULT_RUNS_BASE = '.circuit-next/runs';
const DEFAULT_DEV_VERSION = '0.0.0-dev';

interface RuntimeSupportRow {
  readonly entryModeName: string;
  readonly depth: string;
}

const RUNTIME_SUPPORT_MATRIX: Record<string, readonly RuntimeSupportRow[]> = {
  review: [{ entryModeName: 'default', depth: 'standard' }],
  fix: [
    { entryModeName: 'default', depth: 'standard' },
    { entryModeName: 'lite', depth: 'lite' },
    { entryModeName: 'deep', depth: 'deep' },
    { entryModeName: 'autonomous', depth: 'autonomous' },
  ],
  build: [
    { entryModeName: 'default', depth: 'standard' },
    { entryModeName: 'lite', depth: 'lite' },
    { entryModeName: 'deep', depth: 'deep' },
    { entryModeName: 'autonomous', depth: 'autonomous' },
  ],
  explore: [
    { entryModeName: 'default', depth: 'standard' },
    { entryModeName: 'lite', depth: 'lite' },
    { entryModeName: 'deep', depth: 'deep' },
    { entryModeName: 'autonomous', depth: 'autonomous' },
    { entryModeName: 'tournament', depth: 'tournament' },
  ],
  migrate: [
    { entryModeName: 'default', depth: 'standard' },
    { entryModeName: 'deep', depth: 'deep' },
    { entryModeName: 'autonomous', depth: 'autonomous' },
  ],
  sweep: [
    { entryModeName: 'default', depth: 'standard' },
    { entryModeName: 'lite', depth: 'lite' },
    { entryModeName: 'deep', depth: 'deep' },
    { entryModeName: 'autonomous', depth: 'autonomous' },
  ],
};

interface ParsedArgs {
  command?: 'run' | 'resume';
  flowName?: string;
  goal?: string;
  depth?: Depth;
  depthProvided: boolean;
  entryMode?: string;
  runFolder?: string;
  fixturePath?: string;
  flowRoot?: string;
  checkpointChoice?: string;
  progress?: 'jsonl';
  includeUntrackedContent: boolean;
}

interface ResolvedCompiledFlowRoute {
  flowName: string;
  source: 'explicit' | 'classifier';
  reason: string;
  matched_signal?: string;
  inferredEntryModeName?: string;
  inferredEntryModeReason?: string;
}

interface ResolvedEntryModeSelection {
  entryModeName?: string;
  source?: 'explicit' | 'classifier';
  reason?: string;
}

export interface CliMainOptions {
  relayer?: RelayFn;
  composeWriter?: ComposeWriterFn;
  now?: () => Date;
  runId?: string;
  configHomeDir?: string;
  configCwd?: string;
  runtimeExecutors?: Partial<ExecutorRegistry>;
}

export function usage(): string {
  return [
    'usage: circuit-next run [flow-name] --goal "<goal>" [--mode <default|lite|deep|autonomous>] [--depth <lite|standard|deep|tournament|autonomous>] [--run-folder <path>] [--fixture <path>] [--flow-root <path>] [--progress jsonl]',
    '       circuit-next resume --run-folder <path> --checkpoint-choice <choice> [--progress jsonl]',
    '       circuit-next runs show --run-folder <path> --json',
    '       circuit-next handoff [save|resume|done] [options]',
    '       circuit-next create --description "<flow idea>" [--name <slug>] [--publish --yes]',
    '       circuit-next version [--json]',
    '',
    '`--mode` is the friendly alias for `--entry-mode`; supplying both forms of that option is an error.',
    '',
    'With an explicit flow name, loads generated/flows/<name>/circuit.json. Without one, classifies the free-form goal across the registered explore/review/fix/build/migrate/sweep flows and then composes the runtime boundary using the configured relay connector.',
    '',
    'Config: if present, loads ~/.config/circuit-next/config.yaml and ./.circuit/config.yaml from the current working directory into the selection resolver before relay.',
    '',
    'Note: `--dry-run` is not implemented and is rejected. An earlier version silently invoked the real connector while reporting dry_run:true, which is a safety bug; the flag stays rejected until real dry-run support lands.',
    '',
    CLI_RUNTIME_ROUTING_POLICY,
    '',
    'Review evidence: untracked file contents are omitted by default. Add `--include-untracked-content` only when those files are safe to relay to the configured worker.',
  ].join('\n');
}

function readSourceVersion(): string {
  if (process.env.CIRCUIT_NEXT_VERSION !== undefined) return process.env.CIRCUIT_NEXT_VERSION;
  const candidates = [
    resolve(dirname(fileURLToPath(import.meta.url)), '../../plugins/version.json'),
    resolve(process.cwd(), 'plugins/version.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = JSON.parse(readFileSync(candidate, 'utf8')) as { version?: unknown };
      if (typeof raw.version === 'string' && raw.version.length > 0) return raw.version;
    } catch {
      // Keep version reporting useful when the repo manifest is unavailable.
    }
  }
  return DEFAULT_DEV_VERSION;
}

function versionInfo(): Record<string, unknown> {
  return {
    schema_version: 1,
    name: 'circuit-next',
    version: readSourceVersion(),
    node_version: process.versions.node,
    runtime_source: process.env.CIRCUIT_RUNTIME_SOURCE ?? 'direct',
    ...(process.env.CIRCUIT_RUNTIME_PATH === undefined
      ? {}
      : { runtime_path: process.env.CIRCUIT_RUNTIME_PATH }),
    ...(process.env.CIRCUIT_PLUGIN_ROOT === undefined
      ? {}
      : { plugin_root: process.env.CIRCUIT_PLUGIN_ROOT }),
  };
}

function runVersionCommand(argv: readonly string[]): number {
  if (argv.length === 0) {
    process.stdout.write(`${readSourceVersion()}\n`);
    return 0;
  }
  if (argv.length === 1 && argv[0] === '--json') {
    process.stdout.write(`${JSON.stringify(versionInfo(), null, 2)}\n`);
    return 0;
  }
  process.stderr.write('error: usage: circuit-next version [--json]\n');
  return 2;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  // Positional: first non-flag token is the flow name.
  let flowName: string | undefined;
  let command: 'run' | 'resume' | undefined;
  let goal: string | undefined;
  let depth: Depth | undefined;
  let depthProvided = false;
  let entryMode: string | undefined;
  let runFolder: string | undefined;
  let fixturePath: string | undefined;
  let flowRoot: string | undefined;
  let checkpointChoice: string | undefined;
  let progress: 'jsonl' | undefined;
  let includeUntrackedContent = false;

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === undefined) continue;
    if (tok === '--goal') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--goal requires a value');
      goal = next;
      i += 1;
      continue;
    }
    if (tok === '--depth') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`${tok} requires a value`);
      if (depthProvided) {
        throw new Error('supply --depth only once');
      }
      depth = Depth.parse(next);
      depthProvided = true;
      i += 1;
      continue;
    }
    if (tok === '--entry-mode' || tok === '--mode') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`${tok} requires a value`);
      if (next.length === 0) throw new Error(`${tok} requires a non-empty value`);
      if (entryMode !== undefined) {
        throw new Error('use either --mode or --entry-mode, not both');
      }
      entryMode = next;
      i += 1;
      continue;
    }
    if (tok === '--run-folder') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`${tok} requires a value`);
      if (runFolder !== undefined) {
        throw new Error('supply --run-folder only once');
      }
      runFolder = next;
      i += 1;
      continue;
    }
    if (tok === '--fixture') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--fixture requires a value');
      fixturePath = next;
      i += 1;
      continue;
    }
    if (tok === '--flow-root') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--flow-root requires a value');
      if (next.length === 0) throw new Error('--flow-root requires a non-empty value');
      if (flowRoot !== undefined) {
        throw new Error('supply --flow-root only once');
      }
      flowRoot = next;
      i += 1;
      continue;
    }
    if (tok === '--checkpoint-choice') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--checkpoint-choice requires a value');
      checkpointChoice = next;
      i += 1;
      continue;
    }
    if (tok === '--progress') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--progress requires a value');
      if (next !== 'jsonl') throw new Error("--progress only supports 'jsonl'");
      progress = 'jsonl';
      i += 1;
      continue;
    }
    if (tok === '--dry-run') {
      // Fail closed. An earlier version accepted the flag silently while
      // the real connector still ran. Re-enable once real dry-run support
      // lands (deterministic dry relayer + trace marker).
      throw new Error(
        '--dry-run is not currently implemented and is rejected. An earlier version silently invoked the real connector while reporting dry_run:true, which is a safety bug. The flag stays rejected until real dry-run support lands.',
      );
    }
    if (tok === '--include-untracked-content') {
      includeUntrackedContent = true;
      continue;
    }
    if (tok === '--help' || tok === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (tok.startsWith('--')) {
      throw new Error(`unknown flag: ${tok}`);
    }
    if ((tok === 'run' || tok === 'resume') && flowName === undefined && command === undefined) {
      command = tok;
      continue;
    }
    if (flowName === undefined) {
      flowName = tok;
      continue;
    }
    throw new Error(`unexpected positional argument: ${tok}`);
  }

  if (command === 'resume' || checkpointChoice !== undefined) {
    if (command !== 'resume') {
      throw new Error('checkpoint resume must use the `resume` subcommand');
    }
    if (runFolder === undefined) throw new Error('--run-folder is required for checkpoint resume');
    if (checkpointChoice === undefined || checkpointChoice.length === 0) {
      throw new Error('--checkpoint-choice is required for checkpoint resume');
    }
    if (flowName !== undefined) {
      throw new Error('checkpoint resume loads the saved flow manifest; omit flow-name');
    }
    if (goal !== undefined) {
      throw new Error('checkpoint resume reuses the saved run goal; omit --goal');
    }
    if (fixturePath !== undefined) {
      throw new Error('checkpoint resume loads the saved flow manifest; omit --fixture');
    }
    if (flowRoot !== undefined) {
      throw new Error('checkpoint resume loads the saved flow manifest; omit --flow-root');
    }
    if (depthProvided) {
      throw new Error('checkpoint resume reuses the saved run depth; omit --depth');
    }
    if (entryMode !== undefined) {
      throw new Error('checkpoint resume reuses the saved flow position; omit --mode/--entry-mode');
    }
    if (includeUntrackedContent) {
      throw new Error(
        'checkpoint resume reuses the saved evidence policy; omit --include-untracked-content',
      );
    }
  } else if (goal === undefined || goal.length === 0) {
    throw new Error('--goal is required and must be non-empty');
  }

  const result: ParsedArgs = {
    depthProvided,
    includeUntrackedContent,
  };
  if (depth !== undefined) result.depth = depth;
  if (entryMode !== undefined) result.entryMode = entryMode;
  if (command !== undefined) result.command = command;
  if (goal !== undefined) result.goal = goal;
  if (flowName !== undefined) result.flowName = flowName;
  if (runFolder !== undefined) result.runFolder = runFolder;
  if (fixturePath !== undefined) result.fixturePath = fixturePath;
  if (flowRoot !== undefined) result.flowRoot = flowRoot;
  if (checkpointChoice !== undefined) result.checkpointChoice = checkpointChoice;
  if (progress !== undefined) result.progress = progress;
  return result;
}

function resolveFixturePath(
  flowName: string,
  modeName: string | undefined,
  override: string | undefined,
  flowRoot: string | undefined,
): string {
  if (override !== undefined) return resolve(override);
  const root = resolve(flowRoot ?? 'generated/flows');
  // When a mode is explicitly requested, prefer the per-mode file if the
  // schematic author emitted one. Schematics with route_overrides produce
  // <mode>.json siblings of circuit.json — see scripts/emit-flows.ts.
  // Falls back to circuit.json otherwise.
  if (modeName !== undefined) {
    const perMode = resolve(root, flowName, `${modeName}.json`);
    if (existsSync(perMode)) return perMode;
  }
  return resolve(root, flowName, 'circuit.json');
}

function progressReporter(enabled: boolean): ((event: ProgressEventValue) => void) | undefined {
  if (!enabled) return undefined;
  return (event) => {
    const parsed = ProgressEvent.parse(event);
    process.stderr.write(`${JSON.stringify(parsed)}\n`);
  };
}

function routeSelectedStatusText(flowId: string, entryModeName: string | undefined): string {
  return entryModeName === undefined
    ? `Chose ${flowId}.`
    : `Chose ${flowId} with ${entryModeName} thoroughness.`;
}

function resolveCompiledFlowRoute(args: ParsedArgs): ResolvedCompiledFlowRoute {
  if (args.flowName !== undefined) {
    return {
      flowName: args.flowName,
      source: 'explicit',
      reason: 'explicit flow positional argument',
    };
  }
  if (args.goal === undefined) {
    throw new Error('--goal is required when not resuming a checkpoint');
  }
  return classifyCompiledFlowTask(args.goal);
}

function resolveEntryModeSelection(
  args: ParsedArgs,
  route: ResolvedCompiledFlowRoute,
): ResolvedEntryModeSelection {
  if (args.entryMode !== undefined) {
    return {
      entryModeName: args.entryMode,
      source: 'explicit',
      reason: 'explicit --mode/--entry-mode argument',
    };
  }
  if (args.depthProvided) return {};
  if (route.inferredEntryModeName !== undefined) {
    return {
      entryModeName: route.inferredEntryModeName,
      source: 'classifier',
      ...(route.inferredEntryModeReason === undefined
        ? {}
        : { reason: route.inferredEntryModeReason }),
    };
  }
  return {};
}

function loadFixture(fixturePath: string): { flow: CompiledFlow; bytes: Buffer } {
  if (!existsSync(fixturePath)) {
    throw new Error(`flow fixture not found: ${fixturePath}`);
  }
  const bytes = readFileSync(fixturePath);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  const flow = CompiledFlow.parse(raw);
  // Enforce flow-kind canonical stage-set policy at fixture load.
  // Validator: src/shared/flow-kind-policy.ts.
  const policy = validateCompiledFlowKindPolicy(flow);
  if (!policy.ok) {
    throw new Error(`flow fixture policy violation (${fixturePath}):\n  ${policy.reason}`);
  }
  return { flow, bytes };
}

function defaultChildCompiledFlowResolver(flowRoot: string | undefined): ChildCompiledFlowResolver {
  return (ref) => {
    const fixturePath = resolveFixturePath(ref.flowId, ref.entryMode, undefined, flowRoot);
    const { bytes } = loadFixture(fixturePath);
    return { flowBytes: bytes };
  };
}

function assertFixtureMatchesRoute(flow: CompiledFlow, route: ResolvedCompiledFlowRoute): void {
  const flowId = flow.id as unknown as string;
  if (flowId !== route.flowName) {
    throw new Error(
      `flow fixture id mismatch: selected flow '${route.flowName}' but fixture declares '${flowId}'`,
    );
  }
}

function selectedEntryMode(
  flow: CompiledFlow,
  entryModeSelection: ResolvedEntryModeSelection,
): CompiledFlow['entry_modes'][number] {
  const entryName = entryModeSelection.entryModeName;
  const entry =
    entryName === undefined
      ? flow.entry_modes[0]
      : flow.entry_modes.find((mode) => mode.name === entryName);
  if (entry === undefined) {
    throw new Error(
      entryName === undefined
        ? `flow '${flow.id}' declares no entry modes`
        : `flow '${flow.id}' declares no entry_mode named '${entryName}'`,
    );
  }
  return entry;
}

function selectedEntryModeName(
  flow: CompiledFlow,
  entryModeSelection: ResolvedEntryModeSelection,
): string {
  return selectedEntryMode(flow, entryModeSelection).name;
}

function selectedDepth(
  flow: CompiledFlow,
  args: ParsedArgs,
  entryModeSelection: ResolvedEntryModeSelection,
): string {
  if (args.depth !== undefined) return args.depth;
  return selectedEntryMode(flow, entryModeSelection).depth;
}

function customFlowArchetype(input: {
  readonly flow: CompiledFlow;
  readonly args: ParsedArgs;
  readonly fixturePath: string;
}): string | undefined {
  if (input.args.flowRoot === undefined || input.args.fixturePath !== undefined) return undefined;
  try {
    const flowRoot = resolve(input.args.flowRoot);
    const manifest = JSON.parse(readFileSync(resolve(dirname(flowRoot), 'manifest.json'), 'utf8'));
    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
      return undefined;
    }
    const customFlows = (manifest as { custom_flows?: unknown }).custom_flows;
    if (!Array.isArray(customFlows)) return undefined;
    const flowId = input.flow.id as unknown as string;
    const fixturePath = resolve(input.fixturePath);
    for (const candidate of customFlows) {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      const entry = candidate as Record<string, unknown>;
      if (entry.id !== flowId) continue;
      if (typeof entry.flow_path !== 'string' || resolve(entry.flow_path) !== fixturePath) continue;
      return typeof entry.archetype === 'string' && entry.archetype.length > 0
        ? entry.archetype
        : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function classifyRuntimeSupport(input: {
  readonly flow: CompiledFlow;
  readonly args: ParsedArgs;
  readonly entryModeSelection: ResolvedEntryModeSelection;
  readonly fixturePath: string;
  readonly supportMatrix?: Record<string, readonly RuntimeSupportRow[]>;
}): RuntimeSupportDecision {
  const flowId = input.flow.id as unknown as string;
  const entryModeName = selectedEntryModeName(input.flow, input.entryModeSelection);
  const depth = selectedDepth(input.flow, input.args, input.entryModeSelection);
  const supportMatrix = input.supportMatrix ?? RUNTIME_SUPPORT_MATRIX;
  const customArchetype = customFlowArchetype({
    flow: input.flow,
    args: input.args,
    fixturePath: input.fixturePath,
  });
  const directRows = supportMatrix[flowId];
  const customArchetypeRows =
    customArchetype === undefined ? undefined : supportMatrix[customArchetype];
  const rows = directRows ?? customArchetypeRows;
  const customArchetypeSupported = directRows === undefined && customArchetypeRows !== undefined;
  if (rows === undefined) {
    return {
      kind: 'unsupported',
      flowId,
      entryModeName,
      depth,
      reason: `flow '${flowId}' is not in the runtime support matrix`,
    };
  }

  const supported = rows.some((row) => row.entryModeName === entryModeName && row.depth === depth);
  if (supported) {
    return {
      kind: 'supported',
      flowId,
      entryModeName,
      depth,
      reason: !customArchetypeSupported
        ? `runtime supports fresh ${flowId} entry mode '${entryModeName}' at depth '${depth}'`
        : `runtime supports custom flow '${flowId}' via '${customArchetype}' archetype entry mode '${entryModeName}' at depth '${depth}'`,
    };
  }

  const hasCheckpoint = input.flow.steps.some((step) => step.kind === 'checkpoint');
  if ((depth === 'deep' || depth === 'tournament') && hasCheckpoint) {
    return {
      kind: 'unsupported',
      flowId,
      entryModeName,
      depth,
      reason: `checkpoint-waiting depth '${depth}' is not supported for this flow`,
    };
  }

  return {
    kind: 'unsupported',
    flowId,
    entryModeName,
    depth,
    reason: `fresh ${flowId} entry mode '${entryModeName}' at depth '${depth}' is not supported`,
  };
}

export async function main(argv: readonly string[], options: CliMainOptions = {}): Promise<number> {
  if (argv[0] === 'version') {
    return runVersionCommand(argv.slice(1));
  }
  if (argv[0] === 'handoff') {
    return runHandoffCommand(argv.slice(1), {
      ...(options.now === undefined ? {} : { now: options.now }),
    });
  }
  if (argv[0] === 'create') {
    return runCreateCommand(argv.slice(1), {
      ...(options.now === undefined ? {} : { now: options.now }),
    });
  }
  if (argv[0] === 'runs') {
    return runRunsCommand(argv.slice(1));
  }

  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 2;
  }

  if (
    args.command === 'resume' &&
    args.runFolder !== undefined &&
    args.checkpointChoice !== undefined
  ) {
    const runFolder = resolve(args.runFolder);
    const progress = progressReporter(args.progress === 'jsonl');
    if (await isRuntimeRunFolder(runFolder)) {
      const runtimeResult = await resumeCompiledFlow({
        runDir: runFolder,
        selection: args.checkpointChoice,
        now: options.now ?? (() => new Date()),
        childCompiledFlowResolver: defaultChildCompiledFlowResolver(undefined),
        ...(options.runtimeExecutors === undefined ? {} : { executors: options.runtimeExecutors }),
        ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
        ...(progress === undefined ? {} : { progress }),
      });
      const runResult = RunResult.parse(JSON.parse(readFileSync(runtimeResult.resultPath, 'utf8')));
      const priorRoute = readPriorRoute(runFolder);
      const operatorSummary = writeOperatorSummary({
        runFolder,
        runResult,
        route: {
          selectedFlow: runResult.flow_id as unknown as string,
          ...(priorRoute.routedBy === undefined ? {} : { routedBy: priorRoute.routedBy }),
          ...(priorRoute.routerReason === undefined
            ? {}
            : { routerReason: priorRoute.routerReason }),
        },
      });
      const resumeRuntimeFields = showRuntimeDecision()
        ? {
            runtime_reason: RUNTIME_POLICY_REASONS.checkpointResume,
          }
        : {};
      process.stdout.write(
        `${JSON.stringify(
          {
            schema_version: 1,
            run_id: runResult.run_id,
            flow_id: runResult.flow_id,
            run_folder: runFolder,
            outcome: runResult.outcome,
            trace_entries_observed: runResult.trace_entries_observed,
            result_path: runtimeResult.resultPath,
            ...resumeRuntimeFields,
            operator_summary_path: operatorSummary.jsonPath,
            operator_summary_markdown_path: operatorSummary.markdownPath,
            ...(operatorSummary.summary.status_text === undefined
              ? {}
              : { operator_summary_status_text: operatorSummary.summary.status_text }),
            ...(operatorSummary.htmlPath === undefined
              ? {}
              : { operator_summary_html_path: operatorSummary.htmlPath }),
          },
          null,
          2,
        )}\n`,
      );
      return 0;
    }
    process.stderr.write('error: run folder is not a resumable Circuit run folder\n');
    return 2;
  }

  if (args.goal === undefined) {
    throw new Error('internal error: --goal missing outside checkpoint resume mode');
  }

  const route = resolveCompiledFlowRoute(args);
  const entryModeSelection = resolveEntryModeSelection(args, route);
  const fixturePath = resolveFixturePath(
    route.flowName,
    entryModeSelection.entryModeName,
    args.fixturePath,
    args.flowRoot,
  );
  const { flow, bytes } = loadFixture(fixturePath);
  assertFixtureMatchesRoute(flow, route);
  const runId = RunId.parse(options.runId ?? randomUUID());
  const now = options.now ?? (() => new Date());
  const progress = progressReporter(args.progress === 'jsonl');
  const selectedStatusText = routeSelectedStatusText(flow.id, entryModeSelection.entryModeName);
  progress?.({
    schema_version: 1,
    type: 'route.selected',
    run_id: runId,
    flow_id: flow.id,
    recorded_at: now().toISOString(),
    label: `Selected ${route.flowName}`,
    display: progressDisplay(`Circuit: ${selectedStatusText}`, 'major', 'info'),
    presentation: progressPresentation({ blockId: runId, statusText: selectedStatusText }),
    selected_flow: flow.id,
    routed_by: route.source,
    router_reason: route.reason,
    ...(route.matched_signal === undefined ? {} : { router_signal: route.matched_signal }),
    ...(entryModeSelection.entryModeName === undefined
      ? {}
      : { entry_mode: entryModeSelection.entryModeName }),
    ...(entryModeSelection.source === undefined
      ? {}
      : { entry_mode_source: entryModeSelection.source }),
  });
  const runFolder = resolve(args.runFolder ?? `${DEFAULT_RUNS_BASE}/${runId as unknown as string}`);
  const selectionConfigLayers = discoverConfigLayers({
    ...(options.configHomeDir !== undefined ? { homeDir: options.configHomeDir } : {}),
    ...(options.configCwd !== undefined ? { cwd: options.configCwd } : {}),
  });

  const projectRoot = resolve(options.configCwd ?? process.cwd());

  const runtimeSupport = classifyRuntimeSupport({ flow, args, entryModeSelection, fixturePath });
  const runtimeDecisionDiagnostics = showRuntimeDecision();
  const defaultRuntimeSupport = applyComposeWriterPolicy(
    applyFixturePolicy(runtimeSupport, {
      args,
      fixturePath,
    }),
    { hasComposeWriter: options.composeWriter !== undefined },
  );
  const routeToRuntime = defaultRuntimeSupport.kind === 'supported';

  if (routeToRuntime) {
    const runtimeResult = await runCompiledFlowWithWaiting({
      flowBytes: bytes,
      runDir: runFolder,
      runId,
      goal: args.goal,
      now,
      projectRoot,
      childCompiledFlowResolver: defaultChildCompiledFlowResolver(args.flowRoot),
      ...(args.depth === undefined ? {} : { depth: args.depth }),
      ...(entryModeSelection.entryModeName === undefined
        ? {}
        : { entryModeName: entryModeSelection.entryModeName }),
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      ...(options.runtimeExecutors === undefined ? {} : { executors: options.runtimeExecutors }),
      ...(selectionConfigLayers.length === 0 ? {} : { selectionConfigLayers }),
      ...(progress === undefined ? {} : { progress }),
      ...(args.includeUntrackedContent
        ? { evidencePolicy: { includeUntrackedFileContent: true } }
        : {}),
    });
    if (isGraphCheckpointWaitingResult(runtimeResult)) {
      const waitingResult = {
        schema_version: 1 as const,
        run_id: RunId.parse(runtimeResult.runId),
        flow_id: CompiledFlowId.parse(runtimeResult.flowId),
        goal: args.goal,
        outcome: 'checkpoint_waiting' as const,
        summary: `checkpoint '${runtimeResult.checkpoint.stepId}' is waiting for an operator choice.`,
        trace_entries_observed: runtimeResult.traceEntriesObserved,
        manifest_hash: computeManifestHash(bytes),
        checkpoint: {
          step_id: runtimeResult.checkpoint.stepId,
          request_path: runtimeResult.checkpoint.requestPath,
          allowed_choices: runtimeResult.checkpoint.allowedChoices,
        },
      };
      const operatorSummary = writeOperatorSummary({
        runFolder,
        runResult: waitingResult,
        route: {
          selectedFlow: route.flowName,
          routedBy: route.source,
          routerReason: route.reason,
        },
      });
      process.stdout.write(
        `${JSON.stringify(
          {
            schema_version: 1,
            run_id: waitingResult.run_id,
            flow_id: waitingResult.flow_id,
            selected_flow: route.flowName,
            routed_by: route.source,
            router_reason: route.reason,
            ...(route.matched_signal === undefined ? {} : { router_signal: route.matched_signal }),
            ...(entryModeSelection.entryModeName === undefined
              ? {}
              : { entry_mode: entryModeSelection.entryModeName }),
            ...(entryModeSelection.source === undefined
              ? {}
              : { entry_mode_source: entryModeSelection.source }),
            run_folder: runFolder,
            outcome: waitingResult.outcome,
            trace_entries_observed: waitingResult.trace_entries_observed,
            ...runtimeOutputFields({
              include: runtimeDecisionDiagnostics,
              decision: defaultRuntimeSupport,
            }),
            operator_summary_path: operatorSummary.jsonPath,
            operator_summary_markdown_path: operatorSummary.markdownPath,
            ...(operatorSummary.summary.status_text === undefined
              ? {}
              : { operator_summary_status_text: operatorSummary.summary.status_text }),
            ...(operatorSummary.htmlPath === undefined
              ? {}
              : { operator_summary_html_path: operatorSummary.htmlPath }),
            checkpoint: waitingResult.checkpoint,
          },
          null,
          2,
        )}\n`,
      );
      return 0;
    }
    const runResult = RunResult.parse(JSON.parse(readFileSync(runtimeResult.resultPath, 'utf8')));
    const operatorSummary = writeOperatorSummary({
      runFolder,
      runResult,
      route: {
        selectedFlow: route.flowName,
        routedBy: route.source,
        routerReason: route.reason,
      },
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          schema_version: 1,
          run_id: runResult.run_id,
          flow_id: runResult.flow_id,
          selected_flow: route.flowName,
          routed_by: route.source,
          router_reason: route.reason,
          ...(route.matched_signal === undefined ? {} : { router_signal: route.matched_signal }),
          ...(entryModeSelection.entryModeName === undefined
            ? {}
            : { entry_mode: entryModeSelection.entryModeName }),
          ...(entryModeSelection.source === undefined
            ? {}
            : { entry_mode_source: entryModeSelection.source }),
          run_folder: runFolder,
          outcome: runResult.outcome,
          trace_entries_observed: runResult.trace_entries_observed,
          result_path: runtimeResult.resultPath,
          ...runtimeOutputFields({
            include: runtimeDecisionDiagnostics,
            decision: defaultRuntimeSupport,
          }),
          operator_summary_path: operatorSummary.jsonPath,
          operator_summary_markdown_path: operatorSummary.markdownPath,
          ...(operatorSummary.summary.status_text === undefined
            ? {}
            : { operator_summary_status_text: operatorSummary.summary.status_text }),
          ...(operatorSummary.htmlPath === undefined
            ? {}
            : { operator_summary_html_path: operatorSummary.htmlPath }),
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  process.stderr.write(`error: unsupported runtime invocation: ${defaultRuntimeSupport.reason}\n`);
  return 2;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith(process.argv[1].split('/').pop() ?? ''));

if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
