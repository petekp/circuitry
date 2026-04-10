import { assertSafeRelativePath } from "./path-utils.js";

export interface CircuitManifestStep {
  id: string;
  gate?: Record<string, unknown>;
  routes?: Record<string, unknown>;
  writes?: Record<string, unknown>;
  [key: string]: unknown;
}

export function getManifestSteps(
  manifest: Record<string, unknown>,
): CircuitManifestStep[] {
  const circuit = (manifest.circuit ?? {}) as Record<string, unknown>;
  const steps = circuit.steps;

  return Array.isArray(steps) ? (steps as CircuitManifestStep[]) : [];
}

export function findStepById(
  manifest: Record<string, unknown>,
  stepId: string,
): CircuitManifestStep | null {
  return getManifestSteps(manifest).find((step) => step.id === stepId) ?? null;
}

export function requireStepById(
  manifest: Record<string, unknown>,
  stepId: string,
): CircuitManifestStep {
  const step = findStepById(manifest, stepId);

  if (!step) {
    throw new Error(`manifest step not found: ${stepId}`);
  }

  return step;
}

export function resolveStepTemplate(
  template: string,
  stepId: string,
  attempt: number,
): string {
  const resolved = template
    .replaceAll("{step_id}", stepId)
    .replaceAll("{attempt}", String(attempt));

  return assertSafeRelativePath(resolved, "resolved template path");
}

export function resolveRequestPath(
  step: CircuitManifestStep,
  stepId: string,
  attempt: number,
): string {
  const writes = (step.writes ?? {}) as Record<string, unknown>;
  if (typeof writes.request !== "string") {
    throw new Error(`step ${stepId} has no request path`);
  }

  return resolveStepTemplate(writes.request, stepId, attempt);
}

export function resolveResponsePath(
  step: CircuitManifestStep,
  stepId: string,
  attempt: number,
): string {
  const writes = (step.writes ?? {}) as Record<string, unknown>;
  if (typeof writes.response !== "string") {
    throw new Error(`step ${stepId} has no response path`);
  }

  return resolveStepTemplate(writes.response, stepId, attempt);
}

export function resolveReceiptPath(
  step: CircuitManifestStep,
  stepId: string,
  attempt: number,
): string {
  const writes = (step.writes ?? {}) as Record<string, unknown>;
  if (typeof writes.receipt !== "string") {
    throw new Error(`step ${stepId} has no receipt path`);
  }

  return resolveStepTemplate(writes.receipt, stepId, attempt);
}

export function resolveResultPath(
  step: CircuitManifestStep,
  stepId: string,
  attempt: number,
): string {
  const writes = (step.writes ?? {}) as Record<string, unknown>;
  if (typeof writes.result !== "string") {
    throw new Error(`step ${stepId} has no result path`);
  }

  return resolveStepTemplate(writes.result, stepId, attempt);
}
