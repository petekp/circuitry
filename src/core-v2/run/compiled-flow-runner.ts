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
import type { ExecutorRegistryV2 } from '../executors/index.js';
import type { RelayConnectorV2 } from '../executors/relay.js';
import { fromCompiledFlowV1 } from '../manifest/from-compiled-flow-v1.js';
import type {
  ChildCompiledFlowResolverV2,
  CompiledFlowRunnerV2,
  WorktreeRunnerV2,
} from './child-runner.js';
import {
  type GraphExecutionResultV2,
  type GraphRunResultV2,
  executeExecutableFlowV2WithWaiting,
  isGraphCheckpointWaitingResultV2,
} from './graph-runner.js';

export interface CompiledFlowRunOptionsV2 {
  readonly flowBytes: Uint8Array;
  readonly runDir: string;
  readonly runId?: string;
  readonly goal: string;
  readonly entryModeName?: string;
  readonly depth?: string;
  readonly now?: () => Date;
  readonly executors?: Partial<ExecutorRegistryV2>;
  readonly childExecutors?: Partial<ExecutorRegistryV2>;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolverV2;
  readonly childRunner?: CompiledFlowRunnerV2;
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
  readonly worktreeRunner?: WorktreeRunnerV2;
  readonly relayConnector?: RelayConnectorV2;
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

export function parseCompiledFlowBytesV2(bytes: Uint8Array): CompiledFlow {
  const raw = JSON.parse(Buffer.from(bytes).toString('utf8'));
  return CompiledFlowSchema.parse(raw);
}

export async function runCompiledFlowV2WithWaiting(
  options: CompiledFlowRunOptionsV2,
): Promise<GraphExecutionResultV2> {
  const flow = parseCompiledFlowBytesV2(options.flowBytes);
  const entry = selectEntryMode(flow, options.entryModeName);
  const executable = fromCompiledFlowV1(flow);
  const depth = options.depth ?? entry.depth;
  return await executeExecutableFlowV2WithWaiting(
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
      compiledFlowV1: flow,
      entryModeName: entry.name,
      depth,
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.executors === undefined ? {} : { executors: options.executors }),
      ...(options.childExecutors === undefined ? {} : { childExecutors: options.childExecutors }),
      ...(options.childCompiledFlowResolver === undefined
        ? {}
        : { childCompiledFlowResolver: options.childCompiledFlowResolver }),
      childRunner: options.childRunner ?? runCompiledFlowChildV2,
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

export async function runCompiledFlowV2(
  options: CompiledFlowRunOptionsV2,
): Promise<GraphRunResultV2> {
  const result = await runCompiledFlowV2WithWaiting(options);
  if (isGraphCheckpointWaitingResultV2(result)) {
    throw new Error(
      `core-v2 run '${result.runId}' paused at checkpoint '${result.checkpoint.stepId}', which requires checkpoint-aware resume routing`,
    );
  }
  return result;
}

export async function runCompiledFlowChildV2(
  options: CompiledFlowRunOptionsV2,
): Promise<GraphRunResultV2> {
  return await runCompiledFlowV2(options);
}
