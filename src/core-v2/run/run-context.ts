import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type {
  ProgressReporter,
  RelayFn,
  RuntimeEvidencePolicy,
} from '../../shared/relay-runtime-types.js';
import type { RunId } from '../domain/run.js';
import type { ExecutorRegistryV2 } from '../executors/index.js';
import type { RelayConnectorV2 } from '../executors/relay.js';
import type { ExecutableFlowV2 } from '../manifest/executable-flow.js';
import type { RunFileStore } from '../run-files/run-file-store.js';
import type { TraceStore } from '../trace/trace-store.js';
import type {
  ChildCompiledFlowResolverV2,
  CompiledFlowRunnerV2,
  WorktreeRunnerV2,
} from './child-runner.js';

export interface RunContextV2 {
  readonly flow: ExecutableFlowV2;
  readonly compiledFlowV1?: CompiledFlow;
  readonly runId: RunId;
  readonly runDir: string;
  readonly goal: string;
  readonly manifestHash: string;
  readonly entryModeName?: string;
  readonly depth?: string;
  readonly now: () => Date;
  readonly files: RunFileStore;
  readonly trace: TraceStore;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolverV2;
  readonly childRunner?: CompiledFlowRunnerV2;
  readonly childExecutors?: Partial<ExecutorRegistryV2>;
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
  readonly worktreeRunner?: WorktreeRunnerV2;
  readonly relayConnector?: RelayConnectorV2;
  readonly relayer?: RelayFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
  readonly progress?: ProgressReporter;
  readonly activeStepAttempt?: number;
  readonly resumeCheckpoint?: {
    readonly stepId: string;
    readonly attempt: number;
    readonly selection: string;
  };
}
