// Runtime entry adapter for compiled-flow bytes.
//
// This file parses the saved or generated manifest bytes, chooses the
// requested entry mode and depth, then hands the normalized executable graph
// to graph-runner.ts. Keep manifest parsing and entry-mode selection here so
// graph-runner.ts can stay focused on step advancement and trace writes.

import {
  type CompiledFlow,
  CompiledFlow as CompiledFlowSchema,
} from '../../schemas/compiled-flow.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import { computeManifestHash } from '../../schemas/manifest.js';
import type {
  ProgressReporter,
  RelayFn,
  RuntimeEvidencePolicy,
} from '../../shared/relay-runtime-types.js';
import type { ExecutorRegistry } from '../executors/index.js';
import type { RelayConnector } from '../executors/relay.js';
import { fromCompiledFlow } from '../manifest/from-compiled-flow.js';
import type {
  ChildCompiledFlowResolver,
  CompiledFlowRunner,
  WorktreeRunner,
} from './child-runner.js';
import {
  type GraphExecutionResult,
  type GraphRunResult,
  executeExecutableFlowWithWaiting,
  isGraphCheckpointWaitingResult,
} from './graph-runner.js';

export interface CompiledFlowRunOptions {
  readonly flowBytes: Uint8Array;
  readonly runDir: string;
  readonly runId?: string;
  readonly goal: string;
  readonly entryModeName?: string;
  readonly depth?: string;
  readonly now?: () => Date;
  readonly executors?: Partial<ExecutorRegistry>;
  readonly childExecutors?: Partial<ExecutorRegistry>;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolver;
  readonly childRunner?: CompiledFlowRunner;
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
  readonly worktreeRunner?: WorktreeRunner;
  readonly relayConnector?: RelayConnector;
  readonly relayer?: RelayFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
  readonly progress?: ProgressReporter;
  readonly maxSteps?: number;
}

function selectEntryMode(
  flow: CompiledFlow,
  entryModeName: string | undefined,
): CompiledFlow['entry_modes'][number] {
  if (entryModeName === undefined) {
    const entry = flow.entry_modes[0];
    if (entry === undefined) throw new Error(`compiled flow '${flow.id}' declares no entry modes`);
    return entry;
  }
  const entry = flow.entry_modes.find((mode) => mode.name === entryModeName);
  if (entry === undefined) {
    throw new Error(`compiled flow '${flow.id}' declares no entry mode named '${entryModeName}'`);
  }
  return entry;
}

export function parseCompiledFlowBytes(bytes: Uint8Array): CompiledFlow {
  const raw = JSON.parse(Buffer.from(bytes).toString('utf8'));
  return CompiledFlowSchema.parse(raw);
}

export async function runCompiledFlowWithWaiting(
  options: CompiledFlowRunOptions,
): Promise<GraphExecutionResult> {
  const flow = parseCompiledFlowBytes(options.flowBytes);
  const entry = selectEntryMode(flow, options.entryModeName);
  const executable = fromCompiledFlow(flow);
  const depth = options.depth ?? entry.depth;
  return await executeExecutableFlowWithWaiting(
    {
      ...executable,
      entry: entry.start_at,
      metadata: {
        ...executable.metadata,
        selected_entry_mode: entry.name,
        selected_depth: depth,
      },
    },
    {
      runDir: options.runDir,
      ...(options.runId === undefined ? {} : { runId: options.runId }),
      goal: options.goal,
      manifestHash: computeManifestHash(options.flowBytes),
      manifestBytes: options.flowBytes,
      compiledFlow: flow,
      entryModeName: entry.name,
      depth,
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.executors === undefined ? {} : { executors: options.executors }),
      ...(options.childExecutors === undefined ? {} : { childExecutors: options.childExecutors }),
      ...(options.childCompiledFlowResolver === undefined
        ? {}
        : { childCompiledFlowResolver: options.childCompiledFlowResolver }),
      childRunner: options.childRunner ?? runCompiledFlow,
      ...(options.projectRoot === undefined ? {} : { projectRoot: options.projectRoot }),
      ...(options.evidencePolicy === undefined ? {} : { evidencePolicy: options.evidencePolicy }),
      ...(options.worktreeRunner === undefined ? {} : { worktreeRunner: options.worktreeRunner }),
      ...(options.relayConnector === undefined ? {} : { relayConnector: options.relayConnector }),
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      ...(options.selectionConfigLayers === undefined
        ? {}
        : { selectionConfigLayers: options.selectionConfigLayers }),
      ...(options.progress === undefined ? {} : { progress: options.progress }),
      ...(options.maxSteps === undefined ? {} : { maxSteps: options.maxSteps }),
    },
  );
}

export async function runCompiledFlow(options: CompiledFlowRunOptions): Promise<GraphRunResult> {
  const result = await runCompiledFlowWithWaiting(options);
  if (isGraphCheckpointWaitingResult(result)) {
    throw new Error(
      `runtime run '${result.runId}' paused at checkpoint '${result.checkpoint.stepId}', which requires checkpoint-aware resume routing`,
    );
  }
  return result;
}
