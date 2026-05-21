import { z } from 'zod';
import { CompiledFlowId } from './ids.js';
import { RelayRole } from './step.js';

export const EnabledConnector = z.enum(['claude-code', 'codex', 'cursor-agent']);
export type EnabledConnector = z.infer<typeof EnabledConnector>;

export const FilesystemCapability = z.enum(['read-only', 'trusted-write', 'isolated-write']);
export type FilesystemCapability = z.infer<typeof FilesystemCapability>;

export const StructuredOutputCapability = z.enum(['json']);
export type StructuredOutputCapability = z.infer<typeof StructuredOutputCapability>;

export const ConnectorCapabilities = z
  .object({
    filesystem: FilesystemCapability,
    structured_output: StructuredOutputCapability,
  })
  .strict();
export type ConnectorCapabilities = z.infer<typeof ConnectorCapabilities>;

export const PromptTransport = z.enum(['prompt-file']);
export type PromptTransport = z.infer<typeof PromptTransport>;

export const ConnectorOutputExtraction = z
  .object({
    kind: z.literal('output-file'),
  })
  .strict();
export type ConnectorOutputExtraction = z.infer<typeof ConnectorOutputExtraction>;

export const BUILTIN_CONNECTOR_CAPABILITIES: Readonly<
  Record<EnabledConnector, ConnectorCapabilities>
> = {
  'claude-code': { filesystem: 'trusted-write', structured_output: 'json' },
  codex: { filesystem: 'trusted-write', structured_output: 'json' },
  'cursor-agent': { filesystem: 'trusted-write', structured_output: 'json' },
} as const;

// connector-I2: the `'auto'` literal is a reserved sentinel for
// `RelayConfig.default`; connector names must not collide with it.
export const RESERVED_ADAPTER_NAMES: readonly string[] = [
  ...EnabledConnector.options,
  'auto',
] as const;

export const ConnectorName = z.string().regex(/^[a-z][a-z0-9-]*$/);
export type ConnectorName = z.infer<typeof ConnectorName>;

// connector-I3: element-level `.min(1)` forbids empty argv elements
// (e.g. `['']` or `['codex', '']`) which either signal a bug or are a
// silent gotcha — shells drop them; `execve(2)` does not.
export const CustomConnectorDescriptor = z
  .object({
    kind: z.literal('custom'),
    name: ConnectorName,
    command: z.array(z.string().min(1)).min(1),
    prompt_transport: PromptTransport,
    output: ConnectorOutputExtraction,
    capabilities: ConnectorCapabilities,
  })
  .strict()
  .superRefine((descriptor, ctx) => {
    if (descriptor.capabilities.filesystem !== 'read-only') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capabilities', 'filesystem'],
        message:
          'custom connectors are read-only in V1; writable custom workers require a later isolated mode',
      });
    }
  });
export type CustomConnectorDescriptor = z.infer<typeof CustomConnectorDescriptor>;

export const BuiltInConnectorRef = z
  .object({
    kind: z.literal('builtin'),
    name: EnabledConnector,
  })
  .strict();
export type BuiltInConnectorRef = z.infer<typeof BuiltInConnectorRef>;

export const NamedConnectorRef = z
  .object({
    kind: z.literal('named'),
    name: ConnectorName,
  })
  .strict();
export type NamedConnectorRef = z.infer<typeof NamedConnectorRef>;

export const ConnectorRef = z.union([
  BuiltInConnectorRef,
  NamedConnectorRef,
  CustomConnectorDescriptor,
]);
export type ConnectorRef = z.infer<typeof ConnectorRef>;

// A resolved connector MUST NOT still be a named
// reference. Named references are pre-resolution pointers at the registry;
// the relayer must dereference them before emitting RelayStartedTraceEntry.
// `ResolvedConnector` is the 2-variant discriminated union used at the trace_entry
// layer; `ConnectorRef` remains the 3-variant pre-resolution union used in
// config and CLI parsing.
export const ResolvedConnector = z.union([BuiltInConnectorRef, CustomConnectorDescriptor]);
export type ResolvedConnector = z.infer<typeof ResolvedConnector>;

// Relay resolution source carries a category plus a disambiguator. Same
// shape as the applied[] entries on the selection side. An audit reading
// `RelayStartedTraceEntry.resolved_from` can identify the exact config
// entry that chose the connector, not just the category.
const ExplicitResolutionSource = z.object({ source: z.literal('explicit') }).strict();
const RoleResolutionSource = z.object({ source: z.literal('role'), role: RelayRole }).strict();
const CircuitResolutionSource = z
  .object({ source: z.literal('circuit'), flow_id: CompiledFlowId })
  .strict();
const DefaultResolutionSource = z.object({ source: z.literal('default') }).strict();
const AutoResolutionSource = z.object({ source: z.literal('auto') }).strict();

export const RelayResolutionSource = z.discriminatedUnion('source', [
  ExplicitResolutionSource,
  RoleResolutionSource,
  CircuitResolutionSource,
  DefaultResolutionSource,
  AutoResolutionSource,
]);
export type RelayResolutionSource = z.infer<typeof RelayResolutionSource>;
