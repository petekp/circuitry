import type { RelayResolutionSource, ResolvedConnector } from '../schemas/connector.js';

export interface ResolvedConnectorDecision {
  readonly connectorName: ResolvedConnector['name'];
  readonly connector: ResolvedConnector;
  readonly resolvedFrom: RelayResolutionSource;
}
