import { existsSync, readFileSync } from "node:fs";

import {
  type Announce,
  composeTransitionLine,
  silentAnnouncer,
} from "./announcer.js";
import {
  appendStepTransitionEvents,
  appendValidatedEvents,
  assertNextStepExists,
  assertCommandStepUsable,
  getRouteTarget,
  loadRunContext,
  maybeAppendArtifactWrittenEvent,
  recordEventsAndRender,
  resolveStepArtifactPaths,
} from "./command-support.js";
import { requireStepById } from "./manifest-utils.js";
import { extractH2SectionBodies } from "./markdown-utils.js";
import { resolveRunRelativePath } from "./path-utils.js";

export interface CompleteSynthesisOptions {
  announce?: Announce;
  projectRoot: string;
  route?: string;
  runRoot: string;
  step: string;
}

export interface CompleteSynthesisResult {
  activeRunPath: string;
  gatePassed: boolean;
  noOp: boolean;
  route?: string;
  status: string;
  step: string;
  workflowId: string;
}

function workflowIdFromManifest(manifest: Record<string, unknown>): string {
  const circuit = manifest.circuit as Record<string, unknown> | undefined;
  const id = circuit && typeof circuit === "object" ? circuit.id : undefined;
  return typeof id === "string" ? id : "";
}

function validateRequiredSections(
  markdownPath: string,
  required: string[],
): void {
  const markdown = readFileSync(markdownPath, "utf-8");
  const sections = extractH2SectionBodies(markdown);
  const missing = required.filter((heading) => !sections[heading] || sections[heading].trim().length === 0);

  if (missing.length > 0) {
    throw new Error(`missing required sections: ${missing.join(", ")}`);
  }
}

interface SchemaSectionsGateContext {
  gateFullPath: string;
  gateSourceExists: boolean;
  alternateFullPath: string | null;
  alternateSourceExists: boolean;
}

function validateSchemaSectionsGate(
  gate: Record<string, unknown>,
  ctx: SchemaSectionsGateContext,
): void {
  const primaryRequired = Array.isArray(gate.required)
    ? (gate.required as string[])
    : [];
  const alternateRequired = Array.isArray(gate.alternate_required)
    ? (gate.alternate_required as string[])
    : primaryRequired;

  if (ctx.gateSourceExists) {
    try {
      validateRequiredSections(ctx.gateFullPath, primaryRequired);
      return;
    } catch (primaryError) {
      if (!ctx.alternateSourceExists || !ctx.alternateFullPath) {
        throw primaryError;
      }
      validateRequiredSections(ctx.alternateFullPath, alternateRequired);
      return;
    }
  }

  if (ctx.alternateSourceExists && ctx.alternateFullPath) {
    validateRequiredSections(ctx.alternateFullPath, alternateRequired);
    return;
  }

  throw new Error("missing required sections: gate source unavailable");
}

export function completeSynthesisStep(
  options: CompleteSynthesisOptions,
): CompleteSynthesisResult {
  const announce = options.announce ?? silentAnnouncer;
  const context = {
    ...loadRunContext(options.runRoot),
    projectRoot: options.projectRoot,
  };
  const step = requireStepById(context.manifest, options.step);
  const stepId = step.id;
  const workflowId = workflowIdFromManifest(context.manifest);

  if (step.executor !== "orchestrator" || step.kind !== "synthesis") {
    throw new Error(`step ${stepId} is not an orchestrator synthesis step`);
  }

  const precondition = assertCommandStepUsable({
    allowCompletedStepNoOp: true,
    allowedStatuses: ["in_progress"],
    commandName: "complete-synthesis",
    state: context.state,
    stepId,
  });

  if (precondition.noOp) {
    const renderResult = recordEventsAndRender(context.runRoot, [], {
      projectRoot: context.projectRoot,
    });
    return {
      activeRunPath: renderResult.activeRunPath,
      gatePassed: true,
      noOp: true,
      route: precondition.route,
      status: renderResult.status,
      step: stepId,
      workflowId,
    };
  }

  const artifactPaths = resolveStepArtifactPaths(step);
  if (artifactPaths.length === 0) {
    throw new Error(`step ${stepId} has no artifact path`);
  }

  const gate = (step.gate ?? {}) as Record<string, any>;
  const gateSource =
    typeof gate.source === "string" && gate.source.length > 0
      ? gate.source
      : artifactPaths[0];
  const gateFullPath = resolveRunRelativePath(context.runRoot, gateSource);
  const gateSourceExists = existsSync(gateFullPath);

  const alternateSource =
    typeof gate.alternate_source === "string" && gate.alternate_source.length > 0
      ? gate.alternate_source
      : null;
  const alternateFullPath = alternateSource
    ? resolveRunRelativePath(context.runRoot, alternateSource)
    : null;
  const alternateSourceExists = !!(
    alternateFullPath && existsSync(alternateFullPath)
  );

  if (!gateSourceExists && !alternateSourceExists) {
    throw new Error(
      `artifact not found: ${alternateSource ? `${gateSource} or ${alternateSource}` : gateSource}`,
    );
  }

  const route = assertNextStepExists(
    context.manifest,
    getRouteTarget(step, "pass", options.route),
  );

  const events: Array<{
    attempt?: number;
    eventType: string;
    payload: Record<string, unknown>;
    stepId?: string;
  }> = [];
  maybeAppendArtifactWrittenEvent(
    context.runRoot,
    context.state,
    step,
    stepId,
    events,
  );
  if (events.length > 0) {
    appendValidatedEvents(context.runRoot, events);
  }

  if (gate.kind === "schema_sections") {
    try {
      validateSchemaSectionsGate(gate, {
        gateFullPath,
        gateSourceExists,
        alternateFullPath,
        alternateSourceExists,
      });
    } catch (error) {
      recordEventsAndRender(context.runRoot, [], {
        projectRoot: context.projectRoot,
      });
      throw error;
    }
  } else {
    recordEventsAndRender(context.runRoot, [], {
      projectRoot: context.projectRoot,
    });
    throw new Error(`unsupported synthesis gate for ${stepId}: ${String(gate.kind)}`);
  }

  const transitionEvents: typeof events = [];
  appendStepTransitionEvents(transitionEvents, {
    gateKind: gate.kind,
    route,
    stepId,
  });

  announce(
    composeTransitionLine({
      extra: { route },
      kind: "synthesis_complete",
      stepId,
      stepTitle: typeof step.title === "string" ? (step.title as string) : undefined,
      workflowId,
    }),
  );

  const renderResult = recordEventsAndRender(context.runRoot, transitionEvents, {
    projectRoot: context.projectRoot,
  });
  return {
    activeRunPath: renderResult.activeRunPath,
    gatePassed: true,
    noOp: false,
    route,
    status: renderResult.status,
    step: stepId,
    workflowId,
  };
}
