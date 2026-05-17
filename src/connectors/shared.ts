export {
  type ConnectorRelayInput,
  type RelayResult,
  sha256Hex,
} from '../shared/connector-relay.js';

// Neutral connector relay surface.
// The neutral relay data contract and hash helper live in
// `src/shared/connector-relay.ts`. Subprocess lifecycle sharing lives in
// `src/connectors/subprocess.ts`; connector parsing and policy stay with each
// connector module.
