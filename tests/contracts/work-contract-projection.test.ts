import { describe, expect, it } from 'vitest';

import { flowDefinitions } from '../../src/flows/catalog.js';
import { compileSchematicToCompiledFlow } from '../../src/flows/compile-schematic-to-flow.js';
import { schematicForFlowDefinition } from '../../src/flows/flow-definition.js';
import type { CompiledFlow } from '../../src/index.js';
import {
  WorkContractProjectionV0,
  projectWorkContractProjectionV0,
} from '../../src/shared/work-contract-projection.js';

function compiledBuiltInFlows(): readonly CompiledFlow[] {
  const flows: CompiledFlow[] = [];
  for (const definition of flowDefinitions) {
    const compiled = compileSchematicToCompiledFlow(schematicForFlowDefinition(definition));
    if (compiled.kind === 'single') {
      flows.push(compiled.flow);
      continue;
    }
    flows.push(...compiled.flows.values());
  }
  return flows;
}

function buildProjection(flow: CompiledFlow) {
  return projectWorkContractProjectionV0({ flow });
}

function walkKeys(value: unknown, visit: (key: string) => void): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) walkKeys(item, visit);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key);
    walkKeys(child, visit);
  }
}

describe('WorkContractProjectionV0', () => {
  it('projects every built-in compiled flow into the three authority buckets', () => {
    for (const flow of compiledBuiltInFlows()) {
      const projection = buildProjection(flow);
      expect(WorkContractProjectionV0.safeParse(projection).success, flow.id).toBe(true);
      expect(projection.work_contract.flow.id).toBe(flow.id);
      expect(projection.work_contract.topology.stages).toHaveLength(flow.stages.length);
      expect(projection.work_contract.blocks).toHaveLength(flow.steps.length);
      expect(projection.work_contract.proof.reports.length).toBeGreaterThan(0);
      expect(projection.guidance_seed.selection_hints).toBeDefined();
      expect(projection.rejected_authority).toBeDefined();
    }
  });

  it('keeps old execution-choice fields out of work_contract authority', () => {
    for (const flow of compiledBuiltInFlows()) {
      const projection = buildProjection(flow);
      const forbidden = new Set([
        'selection',
        'default_selection',
        'connector',
        'safe_autonomous_choice',
        'auto_resolution',
      ]);
      const offenders: string[] = [];
      walkKeys(projection.work_contract, (key) => {
        if (forbidden.has(key)) offenders.push(key);
      });
      expect(offenders, flow.id).toEqual([]);
    }
  });

  it('classifies relay connectors, selections, and concrete skill choices as guidance seed', () => {
    const [flow] = compiledBuiltInFlows();
    if (flow === undefined) throw new Error('expected at least one compiled flow');
    const mutated = {
      ...flow,
      default_selection: {
        effort: 'high',
        skills: { mode: 'replace', skills: ['adversarial-review'] },
        invocation_options: {},
      },
      stages: flow.stages.map((stage, index) =>
        index === 0
          ? {
              ...stage,
              selection: { effort: 'medium', skills: { mode: 'inherit' }, invocation_options: {} },
            }
          : stage,
      ),
      steps: flow.steps.map((step, index) =>
        index === 0
          ? {
              ...step,
              selection: { effort: 'low', skills: { mode: 'inherit' }, invocation_options: {} },
              ...(step.kind === 'relay' ? { connector: 'codex' } : {}),
            }
          : step,
      ),
    } as unknown as CompiledFlow;

    const projection = buildProjection(mutated);

    expect(projection.guidance_seed.selection_hints.map((ref) => ref.ref)).toEqual(
      expect.arrayContaining([
        'compiled-flow/default_selection',
        `compiled-flow/stages/${mutated.stages[0]?.id}/selection`,
        `compiled-flow/steps/${mutated.steps[0]?.id}/selection`,
      ]),
    );
    expect(JSON.stringify(projection.work_contract)).not.toContain('adversarial-review');
  });

  it('classifies skill slots as contract capability slots', () => {
    const [flow] = compiledBuiltInFlows();
    if (flow === undefined) throw new Error('expected at least one compiled flow');
    const firstStep = flow.steps[0];
    if (firstStep === undefined) throw new Error('expected at least one step');
    const mutated = {
      ...flow,
      steps: [
        {
          ...firstStep,
          skill_slots: [
            {
              id: 'review-assistant',
              description: 'Optional local skill for reviewing relay output.',
            },
          ],
        },
        ...flow.steps.slice(1),
      ],
    } as unknown as CompiledFlow;

    const projection = buildProjection(mutated);

    expect(projection.work_contract.authority.skill_slots).toEqual([
      {
        step_id: firstStep.id,
        slot_id: 'review-assistant',
        description: 'Optional local skill for reviewing relay output.',
      },
    ]);
  });

  it('puts current hidden checkpoint authority into rejected_authority', () => {
    const rejected = compiledBuiltInFlows()
      .flatMap((flow) => buildProjection(flow).rejected_authority)
      .map((violation) => violation.field);

    expect(rejected).toContain('safe_autonomous_choice');
  });

  it('requires checkpoint choices to name static ids or a dynamic source', () => {
    const projection = compiledBuiltInFlows()
      .map(buildProjection)
      .find((candidate) => {
        return candidate.work_contract.authority.checkpoints.length > 0;
      });
    if (projection === undefined) throw new Error('expected at least one checkpoint');

    const checkpoint = projection.work_contract.authority.checkpoints[0];
    if (checkpoint === undefined) throw new Error('expected at least one checkpoint');

    expect(
      WorkContractProjectionV0.safeParse({
        ...projection,
        work_contract: {
          ...projection.work_contract,
          authority: {
            ...projection.work_contract.authority,
            checkpoints: [{ ...checkpoint, choices: { kind: 'static' } }],
          },
        },
      }).success,
    ).toBe(false);

    expect(
      WorkContractProjectionV0.safeParse({
        ...projection,
        work_contract: {
          ...projection.work_contract,
          authority: {
            ...projection.work_contract.authority,
            checkpoints: [{ ...checkpoint, choices: { kind: 'dynamic' } }],
          },
        },
      }).success,
    ).toBe(false);
  });

  it('projects acceptance criteria as proof inputs, not close authority', () => {
    const projections = compiledBuiltInFlows().map(buildProjection);
    const acceptanceInputs = projections.flatMap(
      (projection) => projection.work_contract.proof.acceptance_criteria,
    );

    expect(acceptanceInputs.length).toBeGreaterThan(0);
    expect(acceptanceInputs.every((input) => input.kind === 'acceptance_criteria_input')).toBe(
      true,
    );
  });

  it('binds non-normal routes to typed recovery meaning', () => {
    for (const flow of compiledBuiltInFlows()) {
      const projection = buildProjection(flow);
      for (const route of projection.work_contract.recovery) {
        expect(route.route_id).toBeTruthy();
        expect(route.kind).toBeTruthy();
        expect(route.allowed_failure_causes.length).toBeGreaterThan(0);
      }
    }
  });

  it('fails when a compiled flow field has no projection bucket', () => {
    const [flow] = compiledBuiltInFlows();
    if (flow === undefined) throw new Error('expected at least one compiled flow');
    const firstStep = flow.steps[0];
    if (firstStep === undefined) throw new Error('expected at least one step');
    const mutated = {
      ...flow,
      steps: [{ ...firstStep, mystery_authority: true }, ...flow.steps.slice(1)],
    } as unknown as CompiledFlow;

    expect(() => buildProjection(mutated)).toThrow(/unclassified step fields/);
  });
});
