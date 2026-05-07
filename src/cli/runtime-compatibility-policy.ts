import { relative, resolve } from 'node:path';

export const GENERATED_FLOW_MIRROR_ROOT_ENV = 'CIRCUIT_GENERATED_FLOW_MIRROR_ROOT';

const COMPOSE_WRITER_COMPATIBILITY_REASON =
  'programmatic composeWriter injections are retained-runtime-owned compatibility; core-v2 customization uses executor injection or generated reports';

export const COMPOSE_WRITER_COMPATIBILITY_POLICY = {
  status: 'retained-runtime-only',
  runtime: 'retained',
  v2Hook: 'not-planned',
  v2Customization: 'executor-injection-or-generated-reports',
  reason: COMPOSE_WRITER_COMPATIBILITY_REASON,
} as const;

export const RUNTIME_POLICY_REASONS = {
  externalFixtureOrRoot:
    'explicit --fixture/--flow-root inputs outside generated/flows or the trusted generated mirror are retained-runtime-owned by default; use CIRCUIT_V2_RUNTIME=1 only for explicit v2 fixture experiments',
  composeWriter: COMPOSE_WRITER_COMPATIBILITY_REASON,
  rollback: 'CIRCUIT_DISABLE_V2_RUNTIME=1 keeps default runtime routing on the retained runtime',
  v2CheckpointResume: 'checkpoint resume follows the saved core-v2 run folder engine marker',
  retiredRuntimeRunFolder:
    'retained and v1 run folders were created by the retired runtime and must start fresh',
} as const;

export const CUSTOM_FLOW_ROOT_RUNTIME_POLICY =
  'Custom flow roots run on retained compatibility by default. Use `CIRCUIT_V2_RUNTIME=1` only for explicit v2 experiments.';

export const CLI_RUNTIME_ROUTING_POLICY =
  'Runtime routing: proven fresh modes use the v2 runtime by default; unsupported modes, arbitrary fixtures/custom roots, rollback, and composeWriter still use retained fresh-run fallback. Retained and v1 run folders fail closed with a fresh-run instruction instead of a resume adapter. Custom roots created by `circuit-next create` are retained by default. CIRCUIT_DISABLE_V2_RUNTIME=1 disables default v2 routing. Internal opt-in: CIRCUIT_V2_RUNTIME=1 forces supported fresh runs through v2 and fails closed for unsupported modes. Runtime diagnostics: CIRCUIT_SHOW_RUNTIME_DECISION=1 includes runtime/runtime_reason fields for the current selector decision. CIRCUIT_V2_RUNTIME_CANDIDATE=1 is a temporary alias for the same diagnostics.';

export type RuntimeSelectionKind = 'v2-supported' | 'old-runtime-required' | 'unsupported';
export type RuntimeSelectionName = 'v2' | 'retained';

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

export function pathIsInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel.length === 0 || (!rel.startsWith('..') && !rel.startsWith('/'));
}

export function fixtureEligibleForCandidateV2(input: {
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

export function applyCandidateFixturePolicy(
  decision: RuntimeSupportDecision,
  input: {
    readonly args: FixturePolicyArgs;
    readonly fixturePath: string;
  },
): RuntimeSupportDecision {
  if (decision.kind !== 'v2-supported') return decision;
  if (fixtureEligibleForCandidateV2(input)) return decision;
  return {
    ...decision,
    kind: 'old-runtime-required',
    reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot,
  };
}

export function applyComposeWriterPolicy(
  decision: RuntimeSupportDecision,
  input: { readonly hasComposeWriter: boolean },
): RuntimeSupportDecision {
  if (decision.kind !== 'v2-supported' || !input.hasComposeWriter) return decision;
  return {
    ...decision,
    kind: 'old-runtime-required',
    reason: RUNTIME_POLICY_REASONS.composeWriter,
  };
}

export function assertStrictV2FreshRunSupported(decision: RuntimeSupportDecision): void {
  if (decision.kind === 'v2-supported') return;
  throw new Error(
    `CIRCUIT_V2_RUNTIME=1 cannot route this invocation through v2: ${decision.reason}`,
  );
}

export function useV2Runtime(): boolean {
  return process.env.CIRCUIT_V2_RUNTIME === '1';
}

export function showRuntimeDecision(): boolean {
  return (
    process.env.CIRCUIT_SHOW_RUNTIME_DECISION === '1' ||
    process.env.CIRCUIT_V2_RUNTIME_CANDIDATE === '1'
  );
}

export function disableDefaultV2Runtime(): boolean {
  return process.env.CIRCUIT_DISABLE_V2_RUNTIME === '1';
}

export function disabledV2Decision(decision: RuntimeSupportDecision): RuntimeSupportDecision {
  return {
    ...decision,
    kind: 'old-runtime-required',
    reason: RUNTIME_POLICY_REASONS.rollback,
  };
}

export function runtimeOutputFields(input: {
  readonly include: boolean;
  readonly runtime: RuntimeSelectionName;
  readonly decision: RuntimeSupportDecision;
}): { readonly runtime?: RuntimeSelectionName; readonly runtime_reason?: string } {
  if (!input.include) return {};
  return {
    runtime: input.runtime,
    runtime_reason: input.decision.reason,
  };
}
