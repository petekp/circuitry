import type { CompiledFlow } from '../schemas/compiled-flow.js';
import type { LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import type { TraceEntry } from '../schemas/trace-entry.js';
import { RETIRED_RUNTIME_RUN_FOLDER_MESSAGE } from '../shared/retired-runtime-policy.js';

export interface CheckpointRequestContext {
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly LayeredConfigValue[];
  readonly checkpointReportSha256?: string;
}

export interface PreparedCheckpointResume {
  readonly flow: CompiledFlow;
  readonly flowBytes: Buffer;
  readonly trace_entries: readonly TraceEntry[];
  readonly stepId: string;
  readonly attempt: number;
  readonly bootstrap: Extract<TraceEntry, { kind: 'run.bootstrapped' }>;
  readonly requestContext: CheckpointRequestContext;
}

export function prepareCheckpointResume(): never {
  throw new Error(RETIRED_RUNTIME_RUN_FOLDER_MESSAGE);
}
