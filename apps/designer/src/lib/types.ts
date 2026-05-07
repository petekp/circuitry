// Local SPA types — mirror the v1 shape from src/schemas/flow-schematic.ts.
// The server is the source of truth; these types exist for editor convenience.
// Unknown fields pass through opaquely on save so we never drop content.

type FlowSchematicStatus = 'candidate' | 'active' | 'deprecated';

export type SchematicStep = {
  id: string;
  block: string;
  title: string;
  stage: string;
  input?: Record<string, string>;
  output: string;
  evidence_requirements: readonly string[];
  execution: { kind: string; role?: string };
  routes: Record<string, string>;
  [key: string]: unknown;
};

export type Schematic = {
  schema_version: '1';
  id: string;
  title: string;
  purpose: string;
  status: FlowSchematicStatus;
  starts_at: string;
  initial_contracts?: readonly string[];
  contract_aliases?: readonly { generic: string; actual: string }[];
  items: SchematicStep[];
  version?: string;
  [key: string]: unknown;
};

export type ValidationIssue = {
  code?: string;
  path?: (string | number)[];
  message: string;
};

export type Block = {
  id: string;
  title: string;
  purpose: string;
  allowed_routes: readonly string[];
  human_interaction: string;
  action_surface: string;
  input_contracts: readonly string[];
  output_contract: string;
  produces_evidence: readonly string[];
};

export type BlockCatalog = {
  schema_version: string;
  blocks: readonly Block[];
};
