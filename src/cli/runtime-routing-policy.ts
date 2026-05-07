// CLI runtime routing policy.
//
// The CLI uses the runtime by default only when the requested inputs are trusted
// runtime surfaces: generated flows, generated mirrors, or published custom
// flows. External fixtures and programmatic composeWriter injection fail closed
// here so one-off test hooks cannot silently become production behavior.
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

export const GENERATED_FLOW_MIRROR_ROOT_ENV = 'CIRCUIT_GENERATED_FLOW_MIRROR_ROOT';

const COMPOSE_WRITER_UNSUPPORTED_REASON =
  'programmatic composeWriter injections are not supported by the CLI runtime; use executor injection or generated reports';

export const COMPOSE_WRITER_RUNTIME_POLICY = {
  status: 'unsupported',
  runtimeCustomization: 'executor-injection-or-generated-reports',
  reason: COMPOSE_WRITER_UNSUPPORTED_REASON,
} as const;

export const RUNTIME_POLICY_REASONS = {
  externalFixtureOrRoot:
    'explicit --fixture/--flow-root inputs must point at generated flows, trusted generated mirrors, or published custom flows',
  composeWriter: COMPOSE_WRITER_UNSUPPORTED_REASON,
  checkpointResume: 'checkpoint resume follows the saved run folder engine marker',
} as const;

export const CUSTOM_FLOW_ROOT_RUNTIME_POLICY =
  'Custom roots created by `circuit-next create` publish a normal runnable flow command.';

export const CLI_RUNTIME_ROUTING_POLICY =
  'Runtime routing: supported flow modes use the runtime by default. Unsupported modes, untrusted fixtures, and programmatic composeWriter injection fail closed. Runtime diagnostics: CIRCUIT_SHOW_RUNTIME_DECISION=1 includes runtime_reason for the selector decision.';

export type RuntimeSelectionKind = 'supported' | 'unsupported';

export interface RuntimeSupportDecision {
  readonly kind: RuntimeSelectionKind;
  readonly flowId: string;
  readonly entryModeName: string;
  readonly depth: string;
  readonly reason: string;
}

interface FixturePolicyArgs {
  readonly fixturePath?: string;
  readonly flowRoot?: string;
}

function pathIsInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel.length === 0 || (!rel.startsWith('..') && !rel.startsWith('/'));
}

export function fixtureEligibleForRuntime(input: {
  readonly args: FixturePolicyArgs;
  readonly fixturePath: string;
  readonly generatedFlowsRoot?: string;
  readonly generatedFlowMirrorRoot?: string;
}): boolean {
  if (input.args.fixturePath === undefined && input.args.flowRoot === undefined) return true;
  const fixturePath = resolve(input.fixturePath);
  if (pathIsInside(resolve(input.generatedFlowsRoot ?? 'generated/flows'), fixturePath)) {
    return true;
  }
  if (
    input.args.flowRoot !== undefined &&
    publishedCustomFlowMatches(input.args.flowRoot, fixturePath)
  ) {
    return true;
  }
  const mirrorRoot = input.generatedFlowMirrorRoot ?? process.env[GENERATED_FLOW_MIRROR_ROOT_ENV];
  if (mirrorRoot === undefined || mirrorRoot.length === 0 || input.args.flowRoot === undefined) {
    return false;
  }
  const trustedMirrorRoot = resolve(mirrorRoot);
  return (
    resolve(input.args.flowRoot) === trustedMirrorRoot &&
    pathIsInside(trustedMirrorRoot, fixturePath)
  );
}

function publishedCustomFlowMatches(flowRoot: string, fixturePath: string): boolean {
  try {
    const manifest = JSON.parse(
      readFileSync(resolve(dirname(resolve(flowRoot)), 'manifest.json'), 'utf8'),
    );
    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) return false;
    const customFlows = (manifest as { custom_flows?: unknown }).custom_flows;
    if (!Array.isArray(customFlows)) return false;
    return customFlows.some((candidate) => {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return false;
      }
      const flowPath = (candidate as Record<string, unknown>).flow_path;
      return typeof flowPath === 'string' && resolve(flowPath) === fixturePath;
    });
  } catch {
    return false;
  }
}

export function applyFixturePolicy(
  decision: RuntimeSupportDecision,
  input: {
    readonly args: FixturePolicyArgs;
    readonly fixturePath: string;
  },
): RuntimeSupportDecision {
  if (decision.kind !== 'supported') return decision;
  if (fixtureEligibleForRuntime(input)) return decision;
  return {
    ...decision,
    kind: 'unsupported',
    reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot,
  };
}

export function applyComposeWriterPolicy(
  decision: RuntimeSupportDecision,
  input: { readonly hasComposeWriter: boolean },
): RuntimeSupportDecision {
  if (decision.kind !== 'supported' || !input.hasComposeWriter) return decision;
  return {
    ...decision,
    kind: 'unsupported',
    reason: RUNTIME_POLICY_REASONS.composeWriter,
  };
}

export function showRuntimeDecision(): boolean {
  return process.env.CIRCUIT_SHOW_RUNTIME_DECISION === '1';
}

export function runtimeOutputFields(input: {
  readonly include: boolean;
  readonly decision: RuntimeSupportDecision;
}): { readonly runtime_reason?: string } {
  if (!input.include) return {};
  return {
    runtime_reason: input.decision.reason,
  };
}
