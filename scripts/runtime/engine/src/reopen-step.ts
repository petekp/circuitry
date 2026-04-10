import { loadRunContext, recordEventsAndRender } from "./command-support.js";
import { requireStepById } from "./manifest-utils.js";

export interface ReopenStepOptions {
  fromStep: string;
  reason: string;
  runRoot: string;
  toStep: string;
}

export interface ReopenStepResult {
  activeRunPath: string;
  status: string;
  step: string;
}

export function reopenStep(options: ReopenStepOptions): ReopenStepResult {
  const context = loadRunContext(options.runRoot);
  requireStepById(context.manifest, options.fromStep);
  requireStepById(context.manifest, options.toStep);

  const renderResult = recordEventsAndRender(context.runRoot, [
    {
      eventType: "step_reopened",
      payload: {
        from_step: options.fromStep,
        reason: options.reason,
        to_step: options.toStep,
      },
      stepId: options.toStep,
    },
  ]);

  return {
    activeRunPath: renderResult.activeRunPath,
    status: renderResult.status,
    step: options.toStep,
  };
}
