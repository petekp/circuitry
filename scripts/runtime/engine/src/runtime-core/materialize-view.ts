import type { MaterializeRuntimeViewDeps } from "./ports.js";
import type {
  ContinuityAttachmentIntent,
  RuntimeFailure,
  RuntimeMaterializationPlan,
  RuntimeMaterializationReceipt,
  RuntimeMaterializationStatus,
  RuntimeProjection,
  RuntimeRunRef,
} from "./types.js";

export interface MaterializeRuntimeViewInput {
  readonly ref: RuntimeRunRef;
  readonly projection: RuntimeProjection;
  readonly plan: RuntimeMaterializationPlan;
  readonly deps: MaterializeRuntimeViewDeps;
}

export type MaterializeRuntimeView = (
  input: MaterializeRuntimeViewInput,
) => RuntimeMaterializationReceipt;

type ProjectionStatus = RuntimeMaterializationStatus["projectionStatus"];

function assertNever(value: never): never {
  throw new Error(`unhandled continuity attachment intent: ${JSON.stringify(value)}`);
}

function failedReceipt(
  ref: RuntimeRunRef,
  failure: RuntimeFailure<"projection_materialization_failed" | "runtime_corrupt">,
  projectionStatus: Extract<ProjectionStatus, "failed" | "written" | "skipped">,
  continuityStatus: "failed" | "applied" | "skipped",
): RuntimeMaterializationReceipt {
  return {
    kind: "materialization",
    ref,
    materialization: {
      ok: false,
      failure,
      projectionStatus,
      continuityStatus,
    },
  };
}

function applyContinuity(
  input: MaterializeRuntimeViewInput,
  projectionStatus: "written" | "skipped",
): RuntimeMaterializationReceipt {
  const intent: ContinuityAttachmentIntent = input.plan.continuity;

  if (intent.kind === "none") {
    return {
      kind: "materialization",
      ref: input.ref,
      materialization: {
        ok: true,
        projectionStatus,
        continuityStatus: "skipped",
      },
    };
  }

  const continuityResult =
    intent.kind === "sync-current-run"
      ? input.deps.continuity.syncCurrentRun(intent)
      : intent.kind === "clear-current-run"
        ? input.deps.continuity.clearCurrentRun(intent)
        : assertNever(intent);

  if (!continuityResult.ok) {
    return failedReceipt(input.ref, continuityResult.failure, projectionStatus, "failed");
  }

  return {
    kind: "materialization",
    ref: input.ref,
    materialization: {
      ok: true,
      projectionStatus,
      continuityStatus: "applied",
    },
  };
}

function materializeProjection(
  input: MaterializeRuntimeViewInput,
): RuntimeMaterializationReceipt | "written" | "skipped" {
  const writesState = input.plan.projection.stateJson === "write";
  const rendersActiveRun = input.plan.projection.activeRunMarkdown === "write";

  if (!writesState && !rendersActiveRun) {
    return "skipped";
  }

  if (writesState) {
    const stateResult = input.deps.projectionWriter.writeStateProjection({
      ref: input.ref,
      projection: input.projection,
    });

    if (!stateResult.ok) {
      return failedReceipt(input.ref, stateResult.failure, "failed", "skipped");
    }
  }

  if (rendersActiveRun) {
    const renderResult = input.deps.activeRunRenderer.renderActiveRun({
      ref: input.ref,
      projection: input.projection,
    });

    if (!renderResult.ok) {
      return failedReceipt(input.ref, renderResult.failure, "failed", "skipped");
    }
  }

  return "written";
}

export const materializeRuntimeView: MaterializeRuntimeView = (input) => {
  const projectionResult = materializeProjection(input);

  if (typeof projectionResult !== "string") {
    return projectionResult;
  }

  return applyContinuity(input, projectionResult);
};
