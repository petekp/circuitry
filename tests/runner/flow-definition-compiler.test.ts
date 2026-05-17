import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { flowDefinitions, flowPackages } from '../../src/flows/catalog.js';
import { compileSchematicToCompiledFlow } from '../../src/flows/compile-schematic-to-flow.js';
import {
  type FlowDefinition,
  type FlowFact,
  compileFlowDefinition,
  compileFlowDefinitions,
  defineFlow,
  schematicForFlowDefinition,
  validateFlowFacts,
} from '../../src/flows/flow-definition.js';
import type { ComposeBuilder } from '../../src/flows/registries/compose-writers/types.js';
import type { CompiledFlowPackage } from '../../src/flows/types.js';
import {
  CompiledFlow,
  type CompiledFlow as CompiledFlowValue,
} from '../../src/schemas/compiled-flow.js';
import { FlowSchematic } from '../../src/schemas/flow-schematic.js';

const schema = z.object({ ok: z.boolean() }).strict();
const definitionsById = new Map(flowDefinitions.map((definition) => [definition.id, definition]));
const packagesById = new Map(flowPackages.map((pkg) => [pkg.id, pkg]));

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function definitionFor(flowId: string): FlowDefinition {
  const definition = definitionsById.get(flowId);
  if (definition === undefined) {
    throw new Error(`missing FlowDefinition for ${flowId}`);
  }
  return definition;
}

function packageFor(flowId: string): CompiledFlowPackage {
  const pkg = packagesById.get(flowId);
  if (pkg === undefined) {
    throw new Error(`missing CompiledFlowPackage for ${flowId}`);
  }
  return pkg;
}

function withoutEntryModes(flow: CompiledFlowValue): Omit<CompiledFlowValue, 'entry_modes'> {
  const { entry_modes: _entryModes, ...rest } = flow;
  return rest;
}

function graphIdentityHash(flow: CompiledFlowValue): string {
  return JSON.stringify(withoutEntryModes(flow));
}

function plannedGeneratedFlows(
  flowId: string,
  compiled: ReturnType<typeof compileSchematicToCompiledFlow>,
): ReadonlyMap<string, CompiledFlowValue> {
  if (compiled.kind === 'single') {
    return new Map([[`generated/flows/${flowId}/circuit.json`, compiled.flow]]);
  }

  const groups = new Map<string, { modes: string[]; flow: CompiledFlowValue }>();
  for (const [modeName, flow] of compiled.flows) {
    const hash = graphIdentityHash(flow);
    const existing = groups.get(hash);
    if (existing === undefined) {
      groups.set(hash, { modes: [modeName], flow });
    } else {
      existing.modes.push(modeName);
    }
  }

  const ordered = [...groups.values()].sort((a, b) => {
    if (b.modes.length !== a.modes.length) return b.modes.length - a.modes.length;
    const aFirst = a.modes[0] ?? '';
    const bFirst = b.modes[0] ?? '';
    return aFirst.localeCompare(bFirst);
  });

  const planned = new Map<string, CompiledFlowValue>();
  const main = ordered[0];
  if (main === undefined) return planned;
  planned.set(`generated/flows/${flowId}/circuit.json`, {
    ...main.flow,
    entry_modes: main.modes.map((modeName) => {
      const flow = compiled.flows.get(modeName);
      const entryMode = flow?.entry_modes[0];
      if (entryMode === undefined) {
        throw new Error(`compiled flow '${flowId}' mode '${modeName}' has no entry mode`);
      }
      return entryMode;
    }),
  });
  for (let i = 1; i < ordered.length; i++) {
    const group = ordered[i];
    if (group === undefined) continue;
    for (const modeName of group.modes) {
      const flow = compiled.flows.get(modeName);
      if (flow === undefined) {
        throw new Error(`compiled flow '${flowId}' mode '${modeName}' is missing`);
      }
      planned.set(`generated/flows/${flowId}/${modeName}.json`, flow);
    }
  }
  return planned;
}

function assertGeneratedManifests(flowId: string): void {
  const definition = definitionFor(flowId);
  const compiled = compileSchematicToCompiledFlow(schematicForFlowDefinition(definition));
  for (const [path, flow] of plannedGeneratedFlows(flowId, compiled)) {
    expect(flow).toEqual(CompiledFlow.parse(readJson(path)));
  }
}

function assertDefinitionPackageParity(flowId: string): void {
  const definition = definitionFor(flowId);
  const pkg = packageFor(flowId);
  const generatedSchematic = FlowSchematic.parse(readJson(pkg.paths.schematic));

  expect(schematicForFlowDefinition(definition)).toEqual(generatedSchematic);
  expect(pkg).toEqual(compileFlowDefinition(definition));
  expect(pkg.relayReports).toEqual(definition.relayReports ?? []);
  expect(pkg.reportSchemas).toEqual(definition.reportSchemas);
  expect(pkg.writers).toEqual({
    compose: definition.writers?.compose ?? [],
    close: definition.writers?.close ?? [],
    verification: definition.writers?.verification ?? [],
    checkpoint: definition.writers?.checkpoint ?? [],
  });
  expect(pkg.structuralHints).toEqual(definition.structuralHints);
  expect(pkg.engineFlags).toEqual(definition.engineFlags);
  assertGeneratedManifests(flowId);
}

function minimalDefinition(id: string) {
  return defineFlow({
    id,
    visibility: 'public',
    schematic: {
      schema_version: '1',
      id,
      title: `${id} test flow`,
      purpose: `${id} test purpose`,
      status: 'active',
      version: '0.1.0',
      starts_at: 'compose-step',
      initial_contracts: [],
      contract_aliases: [],
      entry: {
        signals: { include: [id], exclude: [] },
        intent_prefixes: [id],
      },
      entry_modes: [
        {
          name: 'default',
          depth: 'standard',
          description: 'Default test mode.',
        },
      ],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
        rationale: 'Only the plan stage is needed for this compiler test.',
      },
      stages: [{ id: 'plan-stage', title: 'Plan', canonical: 'plan' }],
      items: [
        {
          id: 'compose-step',
          stage: 'plan',
          title: 'Compose test report',
          block: 'plan',
          input: {},
          output: 'plan.strategy@v1',
          evidence_requirements: ['ordered steps'],
          execution: { kind: 'compose' },
          protocol: `${id}-compose@v1`,
          writes: { report_path: 'reports/compose.json' },
          check: { required: ['ok'] },
          routes: { continue: '@complete' },
        },
      ],
    },
    runtimeSurface: {
      primaryResult: {
        schemaName: `${id}.result@v1`,
        path: 'reports/result.json',
        label: 'Result',
      },
      progress: {
        steps: [
          {
            stepId: 'compose-step',
            taskTitle: 'Compose test report',
            activeText: 'Composing test report',
          },
        ],
      },
    },
  });
}

function minimalFacts(): FlowFact[] {
  return [
    {
      kind: 'flow',
      flowId: 'fact-test',
      title: 'Fact test flow',
      purpose: 'Fact test purpose.',
      status: 'active',
      version: '0.1.0',
      visibility: 'public',
      startsAt: 'compose-step',
      stagePathPolicy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
        rationale: 'Only the plan stage is needed for this fact validation test.',
      },
    },
    {
      kind: 'path',
      flowId: 'fact-test',
      pathKind: 'schematic',
      path: 'src/flows/fact-test/schematic.json',
    },
    {
      kind: 'entry',
      flowId: 'fact-test',
      include: ['fact-test'],
      exclude: [],
      intentPrefixes: ['fact-test'],
    },
    {
      kind: 'mode',
      flowId: 'fact-test',
      name: 'default',
      depth: 'standard',
      description: 'Default fact test mode.',
    },
    { kind: 'stage', flowId: 'fact-test', stageId: 'plan-stage', canonical: 'plan', title: 'Plan' },
    {
      kind: 'step',
      flowId: 'fact-test',
      stepId: 'compose-step',
      title: 'Compose fact report',
      stage: 'plan',
      block: 'plan',
      output: 'plan.strategy@v1',
      evidenceRequirements: ['ordered steps'],
      execution: { kind: 'compose' },
      protocol: 'fact-test-compose@v1',
      writes: { report_path: 'reports/fact-test/result.json' },
      check: { required: ['ok'] },
    },
    {
      kind: 'route',
      flowId: 'fact-test',
      fromStepId: 'compose-step',
      outcome: 'continue',
      to: '@complete',
    },
    {
      kind: 'progress',
      flowId: 'fact-test',
      stepId: 'compose-step',
      taskTitle: 'Compose fact report',
      activeText: 'Composing fact report',
    },
    {
      kind: 'primary-result',
      flowId: 'fact-test',
      schemaName: 'plan.strategy@v1',
      path: 'reports/fact-test/result.json',
      label: 'Fact test result',
    },
  ];
}

function expectFactErrors(facts: readonly FlowFact[]) {
  const result = validateFlowFacts(facts);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected invalid facts');
  return result.errors;
}

describe('FlowDefinition compiler', () => {
  it('projects default package fields and runtime support from entry modes', () => {
    const definition = minimalDefinition('definition-test');
    const pkg = compileFlowDefinition(definition);

    expect(pkg).toMatchObject({
      id: 'definition-test',
      visibility: 'public',
      paths: { schematic: 'src/flows/definition-test/schematic.json' },
      relayReports: [],
      writers: { compose: [], close: [], verification: [], checkpoint: [] },
      runtimeSurface: {
        supportedEntryModes: [{ entryModeName: 'default', depth: 'standard' }],
      },
    });
  });

  it('fails when definition id and schematic id drift', () => {
    const definition = minimalDefinition('definition-id');
    expect(() =>
      defineFlow({
        ...definition,
        id: 'outer-id',
        schematic: { ...definition.schematic, id: 'inner-id' },
      }),
    ).toThrow(/does not match schematic id/);
  });

  it('fails closed on duplicate flow ids, report schemas, and writer result schemas', () => {
    const first = minimalDefinition('duplicate-a');
    const second = minimalDefinition('duplicate-b');
    const writer: ComposeBuilder = { resultSchemaName: 'shared.writer@v1', build: () => ({}) };

    expect(() => compileFlowDefinitions([first, first])).toThrow(/duplicate flow definition id/);
    expect(() =>
      compileFlowDefinitions([
        { ...first, reportSchemas: [{ schemaName: 'shared.report@v1', schema }] },
        { ...second, reportSchemas: [{ schemaName: 'shared.report@v1', schema }] },
      ]),
    ).toThrow(/duplicate report schema/);
    expect(() =>
      compileFlowDefinitions([
        { ...first, writers: { compose: [writer] } },
        { ...second, writers: { compose: [{ ...writer }] } },
      ]),
    ).toThrow(/duplicate writer result schema/);
  });

  it('fails closed when progress points outside the schematic', () => {
    const definition = minimalDefinition('bad-progress');

    expect(() =>
      compileFlowDefinition({
        ...definition,
        runtimeSurface: {
          ...definition.runtimeSurface,
          progress: {
            steps: [
              {
                stepId: 'missing-step',
                taskTitle: 'Missing',
                activeText: 'Missing',
              },
            ],
          },
        },
      }),
    ).toThrow(/is not a schematic item/);
  });

  it('fails closed when flow facts point at missing or foreign authoring surfaces', () => {
    expect(
      expectFactErrors([
        ...minimalFacts(),
        {
          kind: 'progress',
          flowId: 'other-flow',
          stepId: 'compose-step',
          taskTitle: 'Wrong flow',
          activeText: 'Wrong flow',
        },
      ]),
    ).toContainEqual({
      kind: 'mixed-flow-fact',
      expectedFlowId: 'fact-test',
      actualFlowId: 'other-flow',
    });

    expect(
      expectFactErrors([
        ...minimalFacts(),
        {
          kind: 'route',
          flowId: 'fact-test',
          fromStepId: 'missing-step',
          outcome: 'continue',
          to: '@complete',
        },
      ]),
    ).toContainEqual({ kind: 'unknown-route-source', flowId: 'fact-test', stepId: 'missing-step' });

    expect(
      expectFactErrors([
        ...minimalFacts(),
        {
          kind: 'input-key',
          flowId: 'fact-test',
          stepId: 'missing-step',
          key: 'brief',
          schemaName: 'flow.brief@v1',
        },
      ]),
    ).toContainEqual({ kind: 'unknown-input-step', flowId: 'fact-test', stepId: 'missing-step' });

    expect(
      expectFactErrors([
        ...minimalFacts(),
        {
          kind: 'path',
          flowId: 'fact-test',
          pathKind: 'schematic',
          path: 'src/flows/fact-test/other-schematic.json',
        },
      ]),
    ).toContainEqual({ kind: 'duplicate-path', flowId: 'fact-test', pathKind: 'schematic' });
  });

  it('keeps every built-in definition in parity with package and generated manifest surfaces', () => {
    expect(flowDefinitions.map((definition) => definition.id)).toEqual(
      flowPackages.map((pkg) => pkg.id),
    );
    for (const definition of flowDefinitions) {
      assertDefinitionPackageParity(definition.id);
    }
  });

  it('preserves per-flow mode and command ownership expectations', () => {
    expect(packageFor('review').runtimeSurface?.supportedEntryModes).toEqual([
      { entryModeName: 'default', depth: 'standard' },
    ]);
    expect(packageFor('build').runtimeSurface?.supportedEntryModes).toEqual([
      { entryModeName: 'default', depth: 'standard' },
      { entryModeName: 'lite', depth: 'lite' },
      { entryModeName: 'deep', depth: 'deep' },
      { entryModeName: 'autonomous', depth: 'autonomous' },
    ]);
    expect(packageFor('explore').runtimeSurface?.supportedEntryModes).toEqual([
      { entryModeName: 'default', depth: 'standard' },
      { entryModeName: 'lite', depth: 'lite' },
      { entryModeName: 'deep', depth: 'deep' },
      { entryModeName: 'tournament', depth: 'tournament' },
      { entryModeName: 'autonomous', depth: 'autonomous' },
    ]);
    expect(packageFor('pursue').runtimeSurface?.supportedEntryModes).toEqual([
      { entryModeName: 'default', depth: 'standard' },
      { entryModeName: 'autonomous', depth: 'autonomous' },
    ]);
    expect(packageFor('pursue').paths.command).toBeUndefined();
    expect(packageFor('fix').runtimeSurface?.progress?.steps).toHaveLength(14);
    expect(packageFor('build').engineFlags).toEqual({
      bindsExecutionDepthToRelaySelection: true,
    });
  });
});
