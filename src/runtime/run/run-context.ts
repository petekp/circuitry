import type { RuntimePackageIndex } from '../../flows/registries/runtime-index.js';
import type { Axes } from '../../schemas/axes.js';
import type { RunId } from '../domain/run.js';
import type { ExecutableFlow } from '../manifest/executable-flow.js';
import type { RunFileStore } from '../run-files/run-file-store.js';
import type { TraceStore } from '../trace/trace-store.js';
import type { RuntimeExecutionCapabilities } from './capabilities.js';
import type { ExternalFileReader } from './external-files.js';

export interface RunContext
  extends Omit<RuntimeExecutionCapabilities, 'executors' | 'progressSurface'> {
  readonly flow: ExecutableFlow;
  readonly packageIndex: RuntimePackageIndex;
  readonly runId: RunId;
  readonly runDir: string;
  readonly goal: string;
  readonly manifestHash: string;
  readonly entryModeName?: string;
  readonly depth?: string;
  readonly axes?: Axes;
  readonly now: () => Date;
  readonly files: RunFileStore;
  readonly trace: TraceStore;
  readonly externalFiles: ExternalFileReader;
  readonly activeStepAttempt?: number;
  readonly resumeCheckpoint?: {
    readonly stepId: string;
    readonly attempt: number;
    readonly selection: string;
  };
}
