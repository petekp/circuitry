import type { StepKind, StepOutcome } from '../domain/step.js';
import type { ExecutableStep } from '../manifest/executable-flow.js';
import type { RunContext } from '../run/run-context.js';
import { executeCheckpoint } from './checkpoint.js';
import { executeCompose } from './compose.js';
import { executeFanout } from './fanout.js';
import { type RelayConnector, executeRelay } from './relay.js';
import { executeSubRun } from './sub-run.js';
import { executeVerification } from './verification.js';

export type StepExecutor = (step: ExecutableStep, context: RunContext) => Promise<StepOutcome>;

export type ExecutorRegistry = Readonly<Record<StepKind, StepExecutor>>;

export interface DefaultExecutorOptions {
  readonly relayConnector?: RelayConnector;
}

// The `ExecutableStep` union member whose `kind` is `K`.
type StepOfKind<K extends StepKind> = Extract<ExecutableStep, { readonly kind: K }>;

function unsupportedStep(step: ExecutableStep): never {
  throw new Error(`step kind '${step.kind}' is not implemented in runtime baseline`);
}

// Wraps a kind-specific executor in the registry-facing `StepExecutor` shape:
// guard the incoming step's kind (so the inner executor receives the narrowed
// step type) and delegate. Centralizing the guard means each registry entry is
// a single typed binding rather than a hand-written `if (step.kind !== ...)`.
function bindExecutor<K extends StepKind>(
  kind: K,
  execute: (step: StepOfKind<K>, context: RunContext) => Promise<StepOutcome>,
): StepExecutor {
  return async (step, context) => {
    if (step.kind !== kind) return unsupportedStep(step);
    return execute(step as StepOfKind<K>, context);
  };
}

export function createDefaultExecutors(options: DefaultExecutorOptions = {}): ExecutorRegistry {
  const relayConnector = options.relayConnector;
  return {
    compose: bindExecutor('compose', (step, context) => executeCompose(step, context)),
    relay: bindExecutor('relay', (step, context) => executeRelay(step, context, relayConnector)),
    verification: bindExecutor('verification', (step, context) =>
      executeVerification(step, context),
    ),
    checkpoint: bindExecutor('checkpoint', (step, context) => executeCheckpoint(step, context)),
    'sub-run': bindExecutor('sub-run', (step, context) => executeSubRun(step, context)),
    fanout: bindExecutor('fanout', (step, context) => executeFanout(step, context, relayConnector)),
  };
}
