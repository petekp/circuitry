export { extractJsonObject, selectedModelForProvider } from '../shared/connector-helpers.js';
export {
  type ConnectorRelayInput,
  type RelayResult,
  sha256Hex,
} from '../shared/connector-relay.js';

// Neutral connector compatibility surface.
// The neutral relay data contract and hash helper live in
// `src/shared/connector-relay.ts`; connector parsing/model helpers live in
// `src/shared/connector-helpers.ts`. Subprocess connector modules and relay
// materialization live in `src/connectors/`.
