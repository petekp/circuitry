import type { ObserveRuntimeFactsDeps } from "./ports.js";
import type {
  RuntimeCommand,
  RuntimeFacts,
  RuntimeProjection,
} from "./types.js";

export interface ObserveRuntimeFactsInput {
  readonly command: RuntimeCommand;
  readonly projection: RuntimeProjection;
  readonly deps: ObserveRuntimeFactsDeps;
}

export type ObserveRuntimeFacts = (input: ObserveRuntimeFactsInput) => RuntimeFacts;
