import {
  type CheckpointStep,
  checkpointChoiceIds,
} from '../../flows/registries/checkpoint-writers/types.js';
import { RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE } from '../../shared/retired-runtime-policy.js';

export type { CheckpointStep };
export { checkpointChoiceIds };

export function checkpointRequestBody(input: {
  readonly step: CheckpointStep;
  readonly projectRoot?: string;
  readonly selectionConfigLayers: readonly unknown[];
  readonly checkpointReportSha256?: string;
}): unknown {
  return {
    schema_version: 1,
    step_id: input.step.id,
    prompt: input.step.policy.prompt,
    allowed_choices: checkpointChoiceIds(input.step),
    ...(input.step.policy.safe_default_choice === undefined
      ? {}
      : { safe_default_choice: input.step.policy.safe_default_choice }),
    ...(input.step.policy.safe_autonomous_choice === undefined
      ? {}
      : { safe_autonomous_choice: input.step.policy.safe_autonomous_choice }),
    execution_context: {
      ...(input.projectRoot === undefined ? {} : { project_root: input.projectRoot }),
      selection_config_layers: input.selectionConfigLayers,
      ...(input.checkpointReportSha256 === undefined
        ? {}
        : { checkpoint_report_sha256: input.checkpointReportSha256 }),
    },
  };
}

export function runCheckpointStep(): never {
  throw new Error(RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE);
}
