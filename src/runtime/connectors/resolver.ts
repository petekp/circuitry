// Relay connector resolution.
//
// Relay connector choice is layered: explicit invocation, role config, flow
// config, default config, then the auto fallback. Keep capability and provider
// checks here so executors can assume the selected connector can run the role.
import { CLAUDE_CODE_SUPPORTED_EFFORTS } from '../../connectors/claude-code.js';
import { CODEX_SUPPORTED_EFFORTS } from '../../connectors/codex.js';
import { CURSOR_AGENT_SUPPORTED_EFFORTS } from '../../connectors/cursor-agent.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type { ConnectorReference } from '../../schemas/config.js';
import type {
  ConnectorCapabilities,
  EnabledConnector,
  RelayResolutionSource,
  ResolvedConnector,
} from '../../schemas/connector.js';
import {
  BUILTIN_CONNECTOR_CAPABILITIES,
  EnabledConnector as EnabledConnectorSchema,
} from '../../schemas/connector.js';
import type { CompiledFlowId } from '../../schemas/ids.js';
import type { ResolvedSelection } from '../../schemas/selection-policy.js';
import type { RelayRole } from '../../schemas/step.js';
import type { ResolvedConnectorDecision } from './connector.js';

type RelayConfigValue = LayeredConfigValue['config']['relay'];

function mergedRelayConfig(layers: readonly LayeredConfigValue[] | undefined): RelayConfigValue {
  const merged: RelayConfigValue = {
    default: 'auto',
    roles: {},
    circuits: {},
    connectors: {},
  };
  for (const layer of layers ?? []) {
    if (layer.config.relay.default !== 'auto' || merged.default === 'auto') {
      merged.default = layer.config.relay.default;
    }
    merged.roles = { ...merged.roles, ...layer.config.relay.roles };
    merged.circuits = { ...merged.circuits, ...layer.config.relay.circuits };
    merged.connectors = { ...merged.connectors, ...layer.config.relay.connectors };
  }
  return merged;
}

export function connectorCapabilities(connector: ResolvedConnector): ConnectorCapabilities {
  if (connector.kind === 'builtin') return BUILTIN_CONNECTOR_CAPABILITIES[connector.name];
  return connector.capabilities;
}

export function assertConnectorCanRunRole(connector: ResolvedConnector, role: RelayRole): void {
  const capabilities = connectorCapabilities(connector);
  if (role === 'implementer' && capabilities.filesystem === 'read-only') {
    throw new Error(
      `relay connector '${connector.name}' is read-only and cannot run implementer step role '${role}'`,
    );
  }
}

function resolvedConnectorFromReference(
  ref: ConnectorReference,
  relay: RelayConfigValue,
): ResolvedConnector {
  if (ref.kind === 'builtin') return ref;
  const descriptor = relay.connectors[ref.name];
  if (descriptor === undefined) {
    throw new Error(`relay connector '${ref.name}' is referenced but not declared`);
  }
  return descriptor;
}

export function resolveConnectorReference(input: {
  readonly ref: ConnectorReference;
  readonly configLayers?: readonly LayeredConfigValue[];
}): ResolvedConnector {
  return resolvedConnectorFromReference(input.ref, mergedRelayConfig(input.configLayers));
}

function isEnabledConnector(value: string): value is EnabledConnector {
  return (EnabledConnectorSchema.options as readonly string[]).includes(value);
}

function resolvedConnectorFromDefault(
  defaultRef: RelayConfigValue['default'],
  relay: RelayConfigValue,
): ResolvedConnector {
  if (isEnabledConnector(defaultRef)) {
    return { kind: 'builtin', name: defaultRef };
  }
  const descriptor = relay.connectors[defaultRef];
  if (descriptor === undefined) {
    throw new Error(`relay default connector '${defaultRef}' is referenced but not declared`);
  }
  return descriptor;
}

function decision(
  connector: ResolvedConnector,
  resolvedFrom: RelayResolutionSource,
  role: RelayRole,
): ResolvedConnectorDecision {
  assertConnectorCanRunRole(connector, role);
  return {
    connectorName: connector.name,
    connector,
    resolvedFrom,
  };
}

export function resolveConnectorForRelay(input: {
  readonly flowId: string;
  readonly role: RelayRole;
  readonly configLayers?: readonly LayeredConfigValue[];
  readonly explicitConnector?: ResolvedConnector;
}): ResolvedConnectorDecision {
  if (input.explicitConnector !== undefined) {
    return decision(input.explicitConnector, { source: 'explicit' }, input.role);
  }

  const relay = mergedRelayConfig(input.configLayers);
  const roleRef = relay.roles[input.role];
  if (roleRef !== undefined) {
    return decision(
      resolvedConnectorFromReference(roleRef, relay),
      {
        source: 'role',
        role: input.role,
      },
      input.role,
    );
  }

  const flowId = input.flowId as CompiledFlowId;
  const flowRef = relay.circuits[flowId];
  if (flowRef !== undefined) {
    return decision(
      resolvedConnectorFromReference(flowRef, relay),
      {
        source: 'circuit',
        flow_id: flowId,
      },
      input.role,
    );
  }

  if (relay.default !== 'auto') {
    return decision(
      resolvedConnectorFromDefault(relay.default, relay),
      { source: 'default' },
      input.role,
    );
  }

  return decision({ kind: 'builtin', name: 'claude-code' }, { source: 'auto' }, input.role);
}

function expectedProvider(connectorName: string): 'anthropic' | 'openai' | 'gemini' | undefined {
  if (connectorName === 'claude-code') return 'anthropic';
  if (connectorName === 'codex') return 'openai';
  if (connectorName === 'cursor-agent') return 'gemini';
  return undefined;
}

function supportedEfforts(connectorName: string): readonly string[] | undefined {
  if (connectorName === 'claude-code') return CLAUDE_CODE_SUPPORTED_EFFORTS;
  if (connectorName === 'codex') return CODEX_SUPPORTED_EFFORTS;
  if (connectorName === 'cursor-agent') return CURSOR_AGENT_SUPPORTED_EFFORTS;
  return undefined;
}

export function assertConnectorSelectionCompatible(
  connectorName: string,
  selection: ResolvedSelection | undefined,
): void {
  const expected = expectedProvider(connectorName);
  const model = selection?.model;
  if (expected !== undefined && model !== undefined && model.provider !== expected) {
    throw new Error(
      `${connectorName} connector cannot honor model provider '${model.provider}' for model '${model.model}'; expected provider '${expected}'`,
    );
  }
  const effort = selection?.effort;
  if (effort === undefined) return;
  const supported = supportedEfforts(connectorName);
  if (supported !== undefined && !supported.includes(effort)) {
    throw new Error(
      `${connectorName} connector cannot honor effort '${effort}'; supported efforts: ${supported.join(', ')}`,
    );
  }
}
