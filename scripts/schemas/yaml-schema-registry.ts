import { resolve } from 'node:path';
import { type ZodTypeAny, z } from 'zod';
import type * as ReleaseSchemasModule from '../../src/release/schemas.js';
import type * as ConfigSchemaModule from '../../src/schemas/config.js';
import type * as CustomFlowDescriptorModule from '../../src/schemas/custom-flow-descriptor.js';
import type * as PolicyEnvelopeModule from '../../src/schemas/policy-envelope.js';

export type YamlEditorSchemaKey =
  | 'runtime-config'
  | 'release-public-claims'
  | 'release-parity-exceptions'
  | 'release-original-capabilities'
  | 'release-proof-index'
  | 'custom-flow-descriptor';

export interface YamlEditorSchemaTargetMetadata {
  readonly name: string;
  readonly schemaKey: YamlEditorSchemaKey;
  readonly schemaPath: string;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly yamlPatterns: readonly string[];
}

export interface YamlEditorSchemaTarget extends YamlEditorSchemaTargetMetadata {
  readonly schema: ZodTypeAny;
}

export const yamlEditorSchemaTargets = [
  {
    name: 'circuit-config',
    schemaKey: 'runtime-config',
    schemaPath: 'schemas/yaml/circuit-config.schema.json',
    id: 'https://schemas.circuit.dev/yaml/circuit-config.schema.json',
    title: 'Circuit config',
    description:
      'Circuit runtime config. Supports schema_version 1 selection config and schema_version 2 policy envelopes.',
    yamlPatterns: ['.circuit/config.yaml', '**/.circuit/config.yaml'],
  },
  {
    name: 'release-public-claims',
    schemaKey: 'release-public-claims',
    schemaPath: 'schemas/yaml/release-public-claims.schema.json',
    id: 'https://schemas.circuit.dev/yaml/release-public-claims.schema.json',
    title: 'Circuit release public claims',
    description: 'Release ledger for public claims and their backing proof evidence.',
    yamlPatterns: ['docs/release/claims/public-claims.yaml'],
  },
  {
    name: 'release-parity-exceptions',
    schemaKey: 'release-parity-exceptions',
    schemaPath: 'schemas/yaml/release-parity-exceptions.schema.json',
    id: 'https://schemas.circuit.dev/yaml/release-parity-exceptions.schema.json',
    title: 'Circuit release parity exceptions',
    description: 'Release ledger for tracked parity exceptions and approved release blockers.',
    yamlPatterns: ['docs/release/parity/exceptions.yaml'],
  },
  {
    name: 'release-original-capabilities',
    schemaKey: 'release-original-capabilities',
    schemaPath: 'schemas/yaml/release-original-capabilities.schema.json',
    id: 'https://schemas.circuit.dev/yaml/release-original-capabilities.schema.json',
    title: 'Circuit original capability snapshot',
    description: 'Release snapshot of original Circuit capabilities used for parity checks.',
    yamlPatterns: ['docs/release/parity/original-circuit.yaml'],
  },
  {
    name: 'release-proof-index',
    schemaKey: 'release-proof-index',
    schemaPath: 'schemas/yaml/release-proof-index.schema.json',
    id: 'https://schemas.circuit.dev/yaml/release-proof-index.schema.json',
    title: 'Circuit release proof index',
    description: 'Release proof scenario index for golden proof runs and public claim backing.',
    yamlPatterns: ['docs/release/proofs/index.yaml'],
  },
  {
    name: 'custom-flow-descriptor',
    schemaKey: 'custom-flow-descriptor',
    schemaPath: 'schemas/yaml/custom-flow-descriptor.schema.json',
    id: 'https://schemas.circuit.dev/yaml/custom-flow-descriptor.schema.json',
    title: 'Circuit custom flow descriptor',
    description: 'Descriptor emitted by circuit create next to a custom compiled flow package.',
    yamlPatterns: [
      'docs/release/proofs/runs/customization/custom-home/drafts/release-note-flow/circuit.yaml',
      'docs/release/proofs/runs/customization/custom-home/skills/release-note-flow/circuit.yaml',
      '**/drafts/*/circuit.yaml',
      '**/skills/*/circuit.yaml',
    ],
  },
] as const satisfies readonly YamlEditorSchemaTargetMetadata[];

export function yamlLanguageServerSchemaMappings(): Record<string, readonly string[]> {
  return Object.fromEntries(
    yamlEditorSchemaTargets.map((target) => [
      `./${target.schemaPath}`,
      [...target.yamlPatterns].sort(),
    ]),
  );
}

const projectRoot = resolve(new URL('../..', import.meta.url).pathname);

async function importDistModule<T>(relPath: string): Promise<T> {
  try {
    return (await import(resolve(projectRoot, relPath))) as T;
  } catch (err) {
    throw new Error(
      `Could not import ${relPath}. Run \`npm run build\` before emitting YAML schemas.\n${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function loadSchemaMap(): Promise<Record<YamlEditorSchemaKey, ZodTypeAny>> {
  const [releaseSchemas, configSchemas, customFlowDescriptorSchemas, policyEnvelopeSchemas] =
    await Promise.all([
      importDistModule<typeof ReleaseSchemasModule>('dist/release/schemas.js'),
      importDistModule<typeof ConfigSchemaModule>('dist/schemas/config.js'),
      importDistModule<typeof CustomFlowDescriptorModule>('dist/schemas/custom-flow-descriptor.js'),
      importDistModule<typeof PolicyEnvelopeModule>('dist/schemas/policy-envelope.js'),
    ]);

  return {
    'runtime-config': z.union([configSchemas.Config, policyEnvelopeSchemas.PolicyEnvelopeV2]),
    'release-public-claims': releaseSchemas.PublicClaimLedger,
    'release-parity-exceptions': releaseSchemas.ParityExceptionLedger,
    'release-original-capabilities': releaseSchemas.OriginalCapabilitySnapshot,
    'release-proof-index': releaseSchemas.ProofScenarioIndex,
    'custom-flow-descriptor': customFlowDescriptorSchemas.CustomFlowPackageDescriptor,
  };
}

export async function loadYamlEditorSchemaTargets(): Promise<readonly YamlEditorSchemaTarget[]> {
  const schemasByKey = await loadSchemaMap();
  return yamlEditorSchemaTargets.map((target) => ({
    ...target,
    schema: schemasByKey[target.schemaKey],
  }));
}
