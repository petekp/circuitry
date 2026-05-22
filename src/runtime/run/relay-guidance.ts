import type {
  RuntimeIndexedFlow,
  RuntimeIndexedRelayStep,
} from '../../flows/registries/runtime-index.js';
import type { ResolvedConnector } from '../../schemas/connector.js';
import type { Depth } from '../../schemas/depth.js';
import type { CompiledFlowId } from '../../schemas/ids.js';
import {
  ResolvedSelection,
  type ResolvedSelection as ResolvedSelectionValue,
} from '../../schemas/selection-policy.js';
import type { SkillSlot } from '../../schemas/skill.js';
import { RelayRole } from '../../schemas/step.js';
import { composePolicyHardConstraints } from '../../shared/policy-envelope.js';
import { deriveResolvedSelection } from '../../shared/relay-selection.js';
import { type LoadedRelaySkill, resolveLoadedRelaySkills } from '../../shared/skill-loading.js';
import {
  assertConnectorSelectionCompatible,
  resolveConnectorForRelay,
} from '../connectors/resolver.js';
import type { RelayConnector } from '../executors/relay.js';
import type { RelayStep } from '../manifest/executable-flow.js';
import type { RunContext } from './run-context.js';

function builtinConnector(name: string): ResolvedConnector | undefined {
  if (name === 'claude-code' || name === 'codex' || name === 'cursor-agent') {
    return { kind: 'builtin', name };
  }
  return undefined;
}

function resolvedConnectorName(connector: ResolvedConnector | undefined): string | undefined {
  return connector?.name;
}

function configLayerConnector(
  name: string,
  configLayers: Parameters<typeof resolveConnectorForRelay>[0]['configLayers'],
): ResolvedConnector | undefined {
  let descriptor: ResolvedConnector | undefined;
  for (const layer of configLayers ?? []) {
    descriptor = layer.config.relay.connectors[name] ?? descriptor;
  }
  return descriptor;
}

function requestedConnectorForRelay(input: {
  readonly stepConnector?: string;
  readonly suppliedConnector?: RelayConnector;
  readonly configLayers?: Parameters<typeof resolveConnectorForRelay>[0]['configLayers'];
}): ResolvedConnector | undefined {
  const suppliedResolved = input.suppliedConnector?.connector;
  const suppliedResolvedName = resolvedConnectorName(suppliedResolved);
  const suppliedName = input.suppliedConnector?.connectorName ?? suppliedResolvedName;

  if (
    input.suppliedConnector?.connectorName !== undefined &&
    suppliedResolvedName !== undefined &&
    input.suppliedConnector.connectorName !== suppliedResolvedName
  ) {
    throw new Error(
      `relay connector identity mismatch: connectorName '${input.suppliedConnector.connectorName}' does not match resolved connector '${suppliedResolvedName}'`,
    );
  }

  if (
    input.stepConnector !== undefined &&
    suppliedName !== undefined &&
    input.stepConnector !== suppliedName
  ) {
    throw new Error(
      `relay connector identity mismatch: step requests '${input.stepConnector}' but supplied connector is '${suppliedName}'`,
    );
  }

  const requested = input.stepConnector ?? suppliedName;
  if (requested === undefined) return undefined;

  const builtin = builtinConnector(requested);
  if (builtin !== undefined) return builtin;

  if (suppliedResolved !== undefined && suppliedResolved.name === requested) {
    return suppliedResolved;
  }

  const configured = configLayerConnector(requested, input.configLayers);
  if (configured !== undefined) return configured;

  throw new Error(
    `relay connector '${requested}' requires resolved connector capabilities before execution`,
  );
}

function selectionForCompatibility(selection: unknown) {
  if (selection === undefined) return undefined;
  if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) {
    return undefined;
  }
  const selectionRecord = selection as {
    readonly model?: unknown;
    readonly effort?: unknown;
  };
  return ResolvedSelection.parse({
    ...(selectionRecord.model === undefined ? {} : { model: selectionRecord.model }),
    ...(selectionRecord.effort === undefined ? {} : { effort: selectionRecord.effort }),
    skills: [],
    invocation_options: {},
  });
}

const EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

function effortExceedsMax(effort: string | undefined, maxEffort: string | undefined): boolean {
  if (effort === undefined || maxEffort === undefined) return false;
  return EFFORT_ORDER.indexOf(effort as never) > EFFORT_ORDER.indexOf(maxEffort as never);
}

function assertPolicyAllowsRelayPlan(input: {
  readonly context: RunContext;
  readonly role: RelayRole;
  readonly connectorName: string;
  readonly resolvedSelection: ResolvedSelectionValue;
  readonly loadedSkills: readonly LoadedRelaySkill[];
}): void {
  const policyLayers = input.context.policyLayers ?? [];
  if (policyLayers.length === 0) return;

  const constraints = composePolicyHardConstraints(policyLayers.map((layer) => layer.envelope));
  const { connectorName } = input;
  const allowedConnectors = constraints.connectors.allow;
  if (allowedConnectors !== undefined && !allowedConnectors.includes(connectorName)) {
    throw new Error(
      `PolicyEnvelope disallows connector '${connectorName}': not in allowed connectors`,
    );
  }
  if (constraints.connectors.deny.includes(connectorName)) {
    throw new Error(`PolicyEnvelope disallows connector '${connectorName}': connector is denied`);
  }
  if (
    input.role === 'implementer' &&
    constraints.connectors.deny_for_write.includes(connectorName)
  ) {
    throw new Error(
      `PolicyEnvelope disallows connector '${connectorName}': connector is denied for write-capable relays`,
    );
  }

  const provider = input.resolvedSelection.model?.provider;
  if (provider !== undefined && constraints.models.deny_providers.includes(provider)) {
    throw new Error(`PolicyEnvelope disallows provider '${provider}': provider is denied`);
  }
  const requiredProvider = constraints.models.require_provider_for_connector[connectorName];
  if (requiredProvider !== undefined && provider !== requiredProvider) {
    throw new Error(
      `PolicyEnvelope requires connector '${connectorName}' to use provider '${requiredProvider}'`,
    );
  }

  if (effortExceedsMax(input.resolvedSelection.effort, constraints.limits.max_effort)) {
    throw new Error(
      `PolicyEnvelope disallows effort '${input.resolvedSelection.effort}': max effort is '${constraints.limits.max_effort}'`,
    );
  }

  const deniedSkills = new Set(constraints.skills.deny);
  const deniedLoadedSkill = input.loadedSkills.find((skill) => deniedSkills.has(skill.id));
  if (deniedLoadedSkill !== undefined) {
    throw new Error(`PolicyEnvelope disallows skill '${deniedLoadedSkill.id}': skill is denied`);
  }
}

export function resolveRelayExecution(input: {
  readonly flowId: string;
  readonly role: string;
  readonly selection?: unknown;
  readonly stepConnector?: string;
  readonly suppliedConnector?: RelayConnector;
  readonly configLayers?: Parameters<typeof resolveConnectorForRelay>[0]['configLayers'];
}): {
  readonly role: string;
  readonly connectorName: string;
  readonly connector: ResolvedConnector;
  readonly resolvedFrom: ReturnType<typeof resolveConnectorForRelay>['resolvedFrom'];
} {
  const role = RelayRole.parse(input.role);
  const explicitConnector = requestedConnectorForRelay({
    ...(input.stepConnector === undefined ? {} : { stepConnector: input.stepConnector }),
    ...(input.suppliedConnector === undefined
      ? {}
      : { suppliedConnector: input.suppliedConnector }),
    ...(input.configLayers === undefined ? {} : { configLayers: input.configLayers }),
  });
  const resolved = resolveConnectorForRelay({
    flowId: input.flowId,
    role,
    ...(input.configLayers === undefined ? {} : { configLayers: input.configLayers }),
    ...(explicitConnector === undefined ? {} : { explicitConnector }),
  });
  const resolvedConnector = resolved.connector;
  assertConnectorSelectionCompatible(
    resolvedConnector.name,
    selectionForCompatibility(input.selection),
  );
  return {
    role,
    connectorName: resolvedConnector.name,
    connector: resolvedConnector,
    resolvedFrom: resolved.resolvedFrom,
  };
}

function suppliedConnectorFromRelayer(context: RunContext): RelayConnector | undefined {
  if (context.relayer === undefined) return undefined;
  return {
    connectorName: context.relayer.connectorName,
    ...(context.relayer.connector === undefined ? {} : { connector: context.relayer.connector }),
    async relay() {
      throw new Error('relay identity placeholder should not be invoked');
    },
  };
}

export interface RelayGuidancePlan {
  readonly relayExecution: ReturnType<typeof resolveRelayExecution>;
  readonly resolvedSelection: ResolvedSelectionValue;
  readonly loadedSkills: readonly LoadedRelaySkill[];
}

export function planRelayGuidanceDecision(input: {
  readonly context: RunContext;
  readonly step: RelayStep;
  readonly compiledStep: RuntimeIndexedRelayStep;
  readonly depth: Depth;
}): RelayGuidancePlan {
  const { context, step, compiledStep } = input;
  const flow = context.packageIndex.flow;
  const suppliedConnector = suppliedConnectorFromRelayer(context);
  const relayExecution = resolveRelayExecution({
    flowId: context.flow.id,
    role: step.role,
    ...(suppliedConnector === undefined ? {} : { suppliedConnector }),
    ...(context.selectionConfigLayers === undefined
      ? {}
      : { configLayers: context.selectionConfigLayers }),
    ...(step.selection === undefined ? {} : { selection: step.selection }),
    ...(step.connector === undefined ? {} : { stepConnector: step.connector }),
  });
  const resolvedSelection = deriveResolvedSelection(
    {
      ...(context.relayer === undefined ? {} : { relayer: context.relayer }),
      ...(context.selectionConfigLayers === undefined
        ? {}
        : { selectionConfigLayers: context.selectionConfigLayers }),
    },
    flow as RuntimeIndexedFlow,
    compiledStep,
    input.depth,
  );
  assertConnectorSelectionCompatible(relayExecution.connectorName, resolvedSelection);
  const loadedSkills = resolveLoadedRelaySkills({
    flowId: flow.id as CompiledFlowId,
    stepId: step.id,
    skillSlots: (compiledStep.skill_slots ?? []) as readonly SkillSlot[],
    resolvedSelection,
    ...(context.selectionConfigLayers === undefined
      ? {}
      : { configLayers: context.selectionConfigLayers }),
  });
  assertPolicyAllowsRelayPlan({
    context,
    role: RelayRole.parse(relayExecution.role),
    connectorName: relayExecution.connectorName,
    resolvedSelection,
    loadedSkills,
  });
  return { relayExecution, resolvedSelection, loadedSkills };
}
