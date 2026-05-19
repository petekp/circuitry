import type { InspectRuntimeViewDeps } from "./ports.js";
import { projectLedger } from "./project-ledger.js";
import type {
  RuntimeFailure,
  RuntimeInspectReceipt,
  RuntimeMessage,
  RuntimeProjection,
  RuntimeRunRef,
} from "./types.js";

export interface InspectRuntimeViewInput {
  readonly ref: RuntimeRunRef;
  readonly deps: InspectRuntimeViewDeps;
}

export type InspectRuntimeView = (
  input: InspectRuntimeViewInput,
) => RuntimeInspectReceipt;

function viewFailure(
  failure: RuntimeFailure<"precondition_failed" | "runtime_corrupt">,
): RuntimeInspectReceipt {
  return {
    kind: "view_failure",
    failure,
  };
}

function preconditionFailure(message: RuntimeMessage): RuntimeInspectReceipt {
  return viewFailure({
    kind: "precondition_failed",
    message,
    retryable: false,
    diagnostics: {
      source: "store",
      details: {},
    },
  });
}

function runtimeCorruptFailure(message: RuntimeMessage): RuntimeInspectReceipt {
  return viewFailure({
    kind: "runtime_corrupt",
    message,
    retryable: false,
    diagnostics: {
      source: "store",
      details: {},
    },
  });
}

function viewReason(projection: RuntimeProjection): RuntimeMessage {
  if (
    projection.status === "aborted" ||
    projection.status === "blocked" ||
    projection.status === "completed" ||
    projection.status === "failed" ||
    projection.status === "handed_off" ||
    projection.status === "stopped"
  ) {
    return `run is ${projection.status}` as RuntimeMessage;
  }

  if (projection.currentStep) {
    if (projection.status === "waiting_checkpoint") {
      return `step ${projection.currentStep} is waiting for checkpoint resolution` as RuntimeMessage;
    }

    if (projection.status === "waiting_worker") {
      return `step ${projection.currentStep} is waiting for worker completion` as RuntimeMessage;
    }

    return `step ${projection.currentStep} is in progress` as RuntimeMessage;
  }

  return `run is ${projection.status}` as RuntimeMessage;
}

export const inspectRuntimeView: InspectRuntimeView = (input) => {
  const manifestResult = input.deps.manifestReader.readManifestSnapshot(input.ref);

  if (!manifestResult.ok) {
    return preconditionFailure(manifestResult.failure.message);
  }

  const ledgerResult = input.deps.ledgerReader.readEvents(input.ref);

  if (!ledgerResult.ok) {
    return viewFailure(ledgerResult.failure);
  }

  try {
    const projection = projectLedger({
      manifest: manifestResult.value,
      events: ledgerResult.value.events,
    });
    const reason = viewReason(projection);

    return {
      ref: input.ref,
      projection,
      reason,
      ...(projection.currentStep ? { resumeStep: projection.currentStep } : {}),
    };
  } catch (error) {
    return runtimeCorruptFailure(
      `runtime ledger replay failed: ${
        error instanceof Error ? error.message : String(error)
      }` as RuntimeMessage,
    );
  }
};
