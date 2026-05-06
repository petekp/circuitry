import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertConnectorCanRunRoleV2,
  assertConnectorSelectionCompatibleV2,
  resolveConnectorForRelayV2,
} from '../../src/core-v2/connectors/resolver.js';
import { resolveRelayExecutionV2 } from '../../src/core-v2/executors/relay.js';
import type { ExecutableFlowV2, RelayStepV2 } from '../../src/core-v2/manifest/executable-flow.js';
import { executeExecutableFlowV2 } from '../../src/core-v2/run/graph-runner.js';
import { LayeredConfig } from '../../src/schemas/config.js';
import { CustomConnectorDescriptor } from '../../src/schemas/connector.js';

describe('core-v2 connector safety', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'circuit-core-v2-connectors-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function relaySafetyFlow(overrides: Partial<RelayStepV2> = {}): ExecutableFlowV2 {
    const step: RelayStepV2 = {
      id: 'relay-step',
      kind: 'relay',
      role: 'implementer',
      routes: { pass: { kind: 'terminal', target: '@complete' } },
      writes: { report: { path: 'reports/relay-report.json' } },
      ...overrides,
    };

    return {
      id: 'connector-safety',
      version: '0.1.0',
      entry: step.id,
      stages: [{ id: 'act', stepIds: [step.id] }],
      steps: [step],
    };
  }

  it('defaults auto relay resolution to claude-code', () => {
    const decision = resolveConnectorForRelayV2({ flowId: 'review', role: 'reviewer' });
    expect(decision.connector).toEqual({ kind: 'builtin', name: 'claude-code' });
    expect(decision.resolvedFrom).toEqual({ source: 'auto' });
  });

  it('rejects read-only connectors for implementer roles', () => {
    expect(() =>
      assertConnectorCanRunRoleV2({ kind: 'builtin', name: 'codex' }, 'implementer'),
    ).toThrow(/read-only/);
  });

  it('resolves declared custom connectors by role without losing identity', () => {
    const custom = CustomConnectorDescriptor.parse({
      kind: 'custom',
      name: 'local-reviewer',
      command: ['node', 'reviewer.js'],
      prompt_transport: 'prompt-file',
      output: { kind: 'output-file' },
      capabilities: { filesystem: 'read-only', structured_output: 'json' },
    });
    const layer = LayeredConfig.parse({
      layer: 'project',
      config: {
        schema_version: 1,
        host: { kind: 'generic-shell' },
        relay: {
          default: 'auto',
          roles: { reviewer: { kind: 'named', name: 'local-reviewer' } },
          circuits: {},
          connectors: { 'local-reviewer': custom },
        },
        circuits: {},
        defaults: {},
      },
    });

    const decision = resolveConnectorForRelayV2({
      flowId: 'review',
      role: 'reviewer',
      configLayers: [layer],
    });
    expect(decision.connectorName).toBe('local-reviewer');
    expect(decision.resolvedFrom).toEqual({ source: 'role', role: 'reviewer' });
  });

  it('threads config layers through the v2 relay execution resolver', () => {
    const layer = LayeredConfig.parse({
      layer: 'project',
      config: {
        schema_version: 1,
        host: { kind: 'generic-shell' },
        relay: {
          default: 'codex',
          roles: {},
          circuits: {},
          connectors: {},
        },
        circuits: {},
        defaults: {},
      },
    });

    const decision = resolveRelayExecutionV2({
      flowId: 'review',
      role: 'reviewer',
      configLayers: [layer],
    });

    expect(decision.connectorName).toBe('codex');
    expect(decision.resolvedFrom).toEqual({ source: 'default' });
  });

  it('honors a builtin step connector without a supplied relay connector', () => {
    const decision = resolveRelayExecutionV2({
      flowId: 'review',
      role: 'reviewer',
      stepConnector: 'claude-code',
    });

    expect(decision.connectorName).toBe('claude-code');
    expect(decision.connector).toEqual({ kind: 'builtin', name: 'claude-code' });
    expect(decision.resolvedFrom).toEqual({ source: 'explicit' });
  });

  it('rejects read-only step connectors without a supplied relay connector', () => {
    expect(() =>
      resolveRelayExecutionV2({
        flowId: 'build',
        role: 'implementer',
        stepConnector: 'codex',
      }),
    ).toThrow(/connector 'codex' is read-only/);
  });

  it('resolves a custom step connector from config layers without a supplied relay connector', () => {
    const custom = CustomConnectorDescriptor.parse({
      kind: 'custom',
      name: 'local-reviewer',
      command: ['node', 'reviewer.js'],
      prompt_transport: 'prompt-file',
      output: { kind: 'output-file' },
      capabilities: { filesystem: 'read-only', structured_output: 'json' },
    });
    const layer = LayeredConfig.parse({
      layer: 'project',
      config: {
        schema_version: 1,
        host: { kind: 'generic-shell' },
        relay: {
          default: 'auto',
          roles: {},
          circuits: {},
          connectors: { 'local-reviewer': custom },
        },
        circuits: {},
        defaults: {},
      },
    });

    const decision = resolveRelayExecutionV2({
      flowId: 'review',
      role: 'reviewer',
      stepConnector: 'local-reviewer',
      configLayers: [layer],
    });

    expect(decision.connectorName).toBe('local-reviewer');
    expect(decision.connector).toEqual(custom);
    expect(decision.resolvedFrom).toEqual({ source: 'explicit' });
  });

  it('uses merged config precedence for custom step connector descriptors', () => {
    const lowerPrecedence = CustomConnectorDescriptor.parse({
      kind: 'custom',
      name: 'local-reviewer',
      command: ['node', 'user-reviewer.js'],
      prompt_transport: 'prompt-file',
      output: { kind: 'output-file' },
      capabilities: { filesystem: 'read-only', structured_output: 'json' },
    });
    const higherPrecedence = CustomConnectorDescriptor.parse({
      kind: 'custom',
      name: 'local-reviewer',
      command: ['node', 'project-reviewer.js'],
      prompt_transport: 'prompt-file',
      output: { kind: 'output-file' },
      capabilities: { filesystem: 'read-only', structured_output: 'json' },
    });
    const userLayer = LayeredConfig.parse({
      layer: 'user-global',
      config: {
        schema_version: 1,
        host: { kind: 'generic-shell' },
        relay: {
          default: 'auto',
          roles: {},
          circuits: {},
          connectors: { 'local-reviewer': lowerPrecedence },
        },
        circuits: {},
        defaults: {},
      },
    });
    const projectLayer = LayeredConfig.parse({
      layer: 'project',
      config: {
        schema_version: 1,
        host: { kind: 'generic-shell' },
        relay: {
          default: 'auto',
          roles: {},
          circuits: {},
          connectors: { 'local-reviewer': higherPrecedence },
        },
        circuits: {},
        defaults: {},
      },
    });

    const decision = resolveRelayExecutionV2({
      flowId: 'review',
      role: 'reviewer',
      stepConnector: 'local-reviewer',
      configLayers: [userLayer, projectLayer],
    });

    expect(decision.connectorName).toBe('local-reviewer');
    expect(decision.connector).toEqual(higherPrecedence);
    expect(decision.resolvedFrom).toEqual({ source: 'explicit' });
  });

  it('rejects a custom step connector that has no resolved capabilities', () => {
    expect(() =>
      resolveRelayExecutionV2({
        flowId: 'review',
        role: 'reviewer',
        stepConnector: 'local-reviewer',
      }),
    ).toThrow(
      "relay connector 'local-reviewer' requires resolved connector capabilities before execution",
    );
  });

  it('keeps custom connectors read-only and rejects empty argv elements', () => {
    expect(() =>
      CustomConnectorDescriptor.parse({
        kind: 'custom',
        name: 'writer',
        command: ['node', 'writer.js'],
        prompt_transport: 'prompt-file',
        output: { kind: 'output-file' },
        capabilities: { filesystem: 'trusted-write', structured_output: 'json' },
      }),
    ).toThrow(/custom connectors are read-only/);

    expect(() =>
      CustomConnectorDescriptor.parse({
        kind: 'custom',
        name: 'bad-argv',
        command: ['node', ''],
        prompt_transport: 'prompt-file',
        output: { kind: 'output-file' },
        capabilities: { filesystem: 'read-only', structured_output: 'json' },
      }),
    ).toThrow();
  });

  it('rejects connector/model provider and effort incompatibility', () => {
    expect(() =>
      assertConnectorSelectionCompatibleV2('claude-code', {
        model: { provider: 'openai', model: 'gpt-5.4' },
        skills: [],
        invocation_options: {},
      }),
    ).toThrow(/expected provider 'anthropic'/);

    expect(() =>
      assertConnectorSelectionCompatibleV2('codex', {
        effort: 'minimal',
        skills: [],
        invocation_options: {},
      }),
    ).toThrow(/cannot honor effort 'minimal'/);
  });

  it('enforces connector write capability before runtime relay invocation', async () => {
    let relayCalls = 0;

    const result = await executeExecutableFlowV2(relaySafetyFlow(), {
      runDir: join(tempDir, 'read-only-implementer'),
      runId: '11111111-1111-4111-8111-111111111111',
      goal: 'prove runtime connector safety',
      relayConnector: {
        connectorName: 'codex',
        async relay() {
          relayCalls += 1;
          return { ok: true };
        },
      },
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain("connector 'codex' is read-only");
    expect(relayCalls).toBe(0);
  });

  it('does not let a supplied resolved connector override the step connector', async () => {
    let relayCalls = 0;

    const result = await executeExecutableFlowV2(
      relaySafetyFlow({
        connector: 'codex',
      }),
      {
        runDir: join(tempDir, 'step-connector-mismatch'),
        runId: '33333333-3333-4333-8333-333333333333',
        goal: 'prove manifest connector identity wins',
        relayConnector: {
          connector: { kind: 'builtin', name: 'claude-code' },
          async relay() {
            relayCalls += 1;
            return { ok: true };
          },
        },
      },
    );

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain(
      "relay connector identity mismatch: step requests 'codex' but supplied connector is 'claude-code'",
    );
    expect(relayCalls).toBe(0);
  });

  it('rejects mismatched supplied connectorName and resolved connector', async () => {
    let relayCalls = 0;

    const result = await executeExecutableFlowV2(
      relaySafetyFlow({
        role: 'reviewer',
      }),
      {
        runDir: join(tempDir, 'supplied-connector-mismatch'),
        runId: '44444444-4444-4444-8444-444444444444',
        goal: 'prove callback connector identity is coherent',
        relayConnector: {
          connectorName: 'codex',
          connector: { kind: 'builtin', name: 'claude-code' },
          async relay() {
            relayCalls += 1;
            return { ok: true };
          },
        },
      },
    );

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain(
      "relay connector identity mismatch: connectorName 'codex' does not match resolved connector 'claude-code'",
    );
    expect(relayCalls).toBe(0);
  });

  it('rejects custom step connectors with non-matching supplied capabilities', async () => {
    let relayCalls = 0;
    const otherReviewer = CustomConnectorDescriptor.parse({
      kind: 'custom',
      name: 'other-reviewer',
      command: ['node', 'other-reviewer.js'],
      prompt_transport: 'prompt-file',
      output: { kind: 'output-file' },
      capabilities: { filesystem: 'read-only', structured_output: 'json' },
    });

    const result = await executeExecutableFlowV2(
      relaySafetyFlow({
        role: 'reviewer',
        connector: 'local-reviewer',
      }),
      {
        runDir: join(tempDir, 'custom-connector-mismatch'),
        runId: '55555555-5555-4555-8555-555555555555',
        goal: 'prove custom connector capabilities match requested identity',
        relayConnector: {
          connector: otherReviewer,
          async relay() {
            relayCalls += 1;
            return { ok: true };
          },
        },
      },
    );

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain(
      "relay connector identity mismatch: step requests 'local-reviewer' but supplied connector is 'other-reviewer'",
    );
    expect(relayCalls).toBe(0);
  });

  it('enforces connector model compatibility before runtime relay invocation', async () => {
    let relayCalls = 0;

    const result = await executeExecutableFlowV2(
      relaySafetyFlow({
        role: 'reviewer',
        selection: { model: { provider: 'openai', model: 'gpt-5.4' } },
      }),
      {
        runDir: join(tempDir, 'provider-mismatch'),
        runId: '22222222-2222-4222-8222-222222222222',
        goal: 'prove runtime connector compatibility',
        relayConnector: {
          connectorName: 'claude-code',
          async relay() {
            relayCalls += 1;
            return { ok: true };
          },
        },
      },
    );

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain("expected provider 'anthropic'");
    expect(relayCalls).toBe(0);
  });
});
