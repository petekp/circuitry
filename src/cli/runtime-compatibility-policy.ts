export const GENERATED_FLOW_MIRROR_ROOT_ENV = 'CIRCUIT_GENERATED_FLOW_MIRROR_ROOT';

export const RUNTIME_POLICY_REASONS = {
  externalFixtureOrRoot:
    'explicit --fixture/--flow-root inputs outside generated/flows or the trusted generated mirror are retained-runtime-owned by default; use CIRCUIT_V2_RUNTIME=1 only for explicit v2 fixture experiments',
  composeWriter:
    'programmatic composeWriter injections are retained-runtime-owned compatibility; core-v2 customization uses executor injection or generated reports',
  rollback: 'CIRCUIT_DISABLE_V2_RUNTIME=1 keeps default runtime routing on the retained runtime',
  v2CheckpointResume: 'checkpoint resume follows the saved core-v2 run folder engine marker',
  retainedCheckpointResume: 'checkpoint resume remains on the retained runtime',
} as const;

export const CUSTOM_FLOW_ROOT_RUNTIME_POLICY =
  'Custom flow roots run on retained compatibility by default. Use `CIRCUIT_V2_RUNTIME=1` only for explicit v2 experiments.';

export const CLI_RUNTIME_ROUTING_POLICY =
  'Runtime routing: proven fresh modes use the v2 runtime by default; unsupported modes, arbitrary fixtures/custom roots, rollback, composeWriter, and unmarked retained checkpoint folders stay on retained compatibility paths. Custom roots created by `circuit-next create` are retained by default. CIRCUIT_DISABLE_V2_RUNTIME=1 disables default v2 routing. Internal opt-in: CIRCUIT_V2_RUNTIME=1 forces supported fresh runs through v2 and fails closed for unsupported modes. Runtime diagnostics: CIRCUIT_SHOW_RUNTIME_DECISION=1 includes runtime/runtime_reason fields for the current selector decision. CIRCUIT_V2_RUNTIME_CANDIDATE=1 is a temporary alias for the same diagnostics.';
