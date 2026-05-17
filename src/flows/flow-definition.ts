import type { z } from 'zod';

import {
  FlowSchematic,
  type FlowSchematic as FlowSchematicValue,
} from '../schemas/flow-schematic.js';
import {
  buildCheckpointRegistry,
  buildCloseRegistry,
  buildComposeRegistry,
  buildCrossReportValidatorRegistry,
  buildReportSchemaRegistry,
  buildRuntimeSurfaceRegistry,
  buildSchemaHintMap,
  buildStructuralHintList,
  buildVerificationRegistry,
} from './catalog-derivations.js';
import type {
  CompiledFlowPackage,
  CompiledFlowPaths,
  CompiledFlowProgressStep,
  CompiledFlowRelayReport,
  CompiledFlowReportSchema,
  CompiledFlowRoutingMetadata,
  CompiledFlowRuntimeSurface,
  CompiledFlowVisibility,
} from './types.js';

type FlowDefinitionSchematicInput = z.input<typeof FlowSchematic>;

type FlowDefinitionPaths = Omit<CompiledFlowPaths, 'schematic'> & {
  readonly schematic?: string;
};

type FlowDefinitionWriters = Partial<CompiledFlowPackage['writers']>;

export interface FlowDefinitionRuntimeSurface {
  readonly supportedEntryModes?: CompiledFlowRuntimeSurface['supportedEntryModes'];
  readonly primaryResult?: CompiledFlowRuntimeSurface['primaryResult'];
  readonly progress?: CompiledFlowRuntimeSurface['progress'];
}

export interface FlowDefinitionInput {
  readonly id: string;
  readonly visibility: CompiledFlowVisibility;
  readonly schematic: FlowDefinitionSchematicInput;
  readonly paths?: FlowDefinitionPaths;
  readonly routing?: CompiledFlowRoutingMetadata;
  readonly relayReports?: readonly CompiledFlowRelayReport[];
  readonly reportSchemas?: readonly CompiledFlowReportSchema[];
  readonly writers?: FlowDefinitionWriters;
  readonly structuralHints?: CompiledFlowPackage['structuralHints'];
  readonly runtimeSurface?: FlowDefinitionRuntimeSurface;
  readonly engineFlags?: CompiledFlowPackage['engineFlags'];
}

export interface FlowDefinition
  extends Omit<FlowDefinitionInput, 'schematic' | 'paths' | 'runtimeSurface'> {
  readonly schematic: FlowSchematicValue;
  readonly paths: FlowDefinitionPaths;
  readonly runtimeSurface?: FlowDefinitionRuntimeSurface;
}

function defaultSchematicPath(flowId: string): string {
  return `src/flows/${flowId}/schematic.json`;
}

export function defineFlow(definition: FlowDefinitionInput): FlowDefinition {
  const schematic = FlowSchematic.parse(definition.schematic);
  if (definition.id !== schematic.id) {
    throw new Error(
      `flow definition id '${definition.id}' does not match schematic id '${schematic.id}'`,
    );
  }
  return {
    ...definition,
    paths: definition.paths ?? {},
    schematic,
  };
}

function compilePaths(definition: FlowDefinition): CompiledFlowPaths {
  const paths: CompiledFlowPaths = {
    schematic: definition.paths.schematic ?? defaultSchematicPath(definition.id),
  };
  if (definition.paths.command !== undefined) {
    return definition.paths.contract === undefined
      ? { ...paths, command: definition.paths.command }
      : { ...paths, command: definition.paths.command, contract: definition.paths.contract };
  }
  return definition.paths.contract === undefined
    ? paths
    : { ...paths, contract: definition.paths.contract };
}

function deriveSupportedEntryModes(
  definition: FlowDefinition,
): CompiledFlowRuntimeSurface['supportedEntryModes'] {
  const entryModes = definition.schematic.entry_modes;
  if (entryModes === undefined) {
    throw new Error(
      `flow definition '${definition.id}' cannot derive runtime support without schematic entry_modes`,
    );
  }
  return entryModes.map((mode) => ({ entryModeName: mode.name, depth: mode.depth }));
}

function validateProgressSurface(
  definition: FlowDefinition,
  progress: CompiledFlowRuntimeSurface['progress'],
): void {
  if (progress === undefined) return;
  const itemIds = new Set(definition.schematic.items.map((item) => item.id as unknown as string));
  const seen = new Set<string>();
  for (const [index, step] of progress.steps.entries()) {
    if (seen.has(step.stepId)) {
      throw new Error(
        `flow definition '${definition.id}' declares duplicate progress step '${step.stepId}'`,
      );
    }
    seen.add(step.stepId);
    if (!itemIds.has(step.stepId)) {
      throw new Error(
        `flow definition '${definition.id}' progress step '${step.stepId}' is not a schematic item`,
      );
    }
    if (step.taskTitle.length === 0 || step.activeText.length === 0) {
      throw new Error(
        `flow definition '${definition.id}' progress step ${index} must declare operator text`,
      );
    }
  }
}

function compileRuntimeSurface(definition: FlowDefinition): CompiledFlowRuntimeSurface | undefined {
  const runtimeSurface = definition.runtimeSurface;
  if (runtimeSurface === undefined) return undefined;
  validateProgressSurface(definition, runtimeSurface.progress);
  const out: CompiledFlowRuntimeSurface = {
    supportedEntryModes:
      runtimeSurface.supportedEntryModes ?? deriveSupportedEntryModes(definition),
  };
  return {
    ...out,
    ...(runtimeSurface.primaryResult === undefined
      ? {}
      : { primaryResult: runtimeSurface.primaryResult }),
    ...(runtimeSurface.progress === undefined ? {} : { progress: runtimeSurface.progress }),
  };
}

export function compileFlowDefinition(definition: FlowDefinition): CompiledFlowPackage {
  const runtimeSurface = compileRuntimeSurface(definition);
  return {
    id: definition.id,
    visibility: definition.visibility,
    paths: compilePaths(definition),
    ...(definition.routing === undefined ? {} : { routing: definition.routing }),
    relayReports: definition.relayReports ?? [],
    ...(definition.reportSchemas === undefined ? {} : { reportSchemas: definition.reportSchemas }),
    writers: {
      compose: definition.writers?.compose ?? [],
      close: definition.writers?.close ?? [],
      verification: definition.writers?.verification ?? [],
      checkpoint: definition.writers?.checkpoint ?? [],
    },
    ...(definition.structuralHints === undefined
      ? {}
      : { structuralHints: definition.structuralHints }),
    ...(runtimeSurface === undefined ? {} : { runtimeSurface }),
    ...(definition.engineFlags === undefined ? {} : { engineFlags: definition.engineFlags }),
  };
}

function validatePackageSet(packages: readonly CompiledFlowPackage[]): void {
  const ids = new Set<string>();
  const reportNames = new Map<string, string>();
  const writerNames = new Map<string, string>();
  for (const pkg of packages) {
    if (ids.has(pkg.id)) {
      throw new Error(`duplicate flow definition id '${pkg.id}'`);
    }
    ids.add(pkg.id);
    for (const report of [...pkg.relayReports, ...(pkg.reportSchemas ?? [])]) {
      const owner = reportNames.get(report.schemaName);
      if (owner !== undefined) {
        throw new Error(
          `duplicate report schema '${report.schemaName}' registered by '${owner}' and '${pkg.id}'`,
        );
      }
      reportNames.set(report.schemaName, pkg.id);
    }
    for (const [slot, builders] of Object.entries(pkg.writers)) {
      for (const builder of builders) {
        const owner = writerNames.get(builder.resultSchemaName);
        if (owner !== undefined) {
          throw new Error(
            `duplicate writer result schema '${builder.resultSchemaName}' registered by ${owner} and ${pkg.id}.${slot}`,
          );
        }
        writerNames.set(builder.resultSchemaName, `${pkg.id}.${slot}`);
      }
    }
  }
}

export function compileFlowDefinitions(
  definitions: readonly FlowDefinition[],
): readonly CompiledFlowPackage[] {
  const packages = definitions.map(compileFlowDefinition);
  validatePackageSet(packages);
  buildComposeRegistry(packages);
  buildCloseRegistry(packages);
  buildVerificationRegistry(packages);
  buildCheckpointRegistry(packages);
  buildReportSchemaRegistry(packages);
  buildSchemaHintMap(packages);
  buildStructuralHintList(packages);
  buildCrossReportValidatorRegistry(packages);
  buildRuntimeSurfaceRegistry(packages);
  return packages;
}

export function schematicForFlowDefinition(definition: FlowDefinition): FlowSchematicValue {
  return definition.schematic;
}

type FlowSchematicInput = FlowDefinitionInput['schematic'];
type SchematicStep = FlowSchematicInput['items'][number];
type SchematicEntry = NonNullable<FlowSchematicInput['entry']>;
type SchematicEntryMode = NonNullable<FlowSchematicInput['entry_modes']>[number];
type SchematicStage = NonNullable<FlowSchematicInput['stages']>[number];
type SchematicStagePathPolicy = NonNullable<FlowSchematicInput['stage_path_policy']>;
type SchematicContractAlias = NonNullable<FlowSchematicInput['contract_aliases']>[number];
type SchematicInput = SchematicStep['input'];
type SchematicRouteTarget = SchematicStep['routes'][string];
type SchematicRouteModeOverrides = NonNullable<SchematicStep['route_overrides']>[string];

export type FlowFact =
  | {
      readonly kind: 'flow';
      readonly flowId: string;
      readonly title: string;
      readonly purpose: string;
      readonly status: FlowSchematicInput['status'];
      readonly version: string;
      readonly visibility: CompiledFlowVisibility;
      readonly startsAt: string;
      readonly stagePathPolicy: SchematicStagePathPolicy;
    }
  | {
      readonly kind: 'path';
      readonly flowId: string;
      readonly pathKind: keyof CompiledFlowPaths;
      readonly path: string;
    }
  | {
      readonly kind: 'entry';
      readonly flowId: string;
      readonly include: readonly string[];
      readonly exclude: readonly string[];
      readonly intentPrefixes: readonly string[];
    }
  | {
      readonly kind: 'mode';
      readonly flowId: string;
      readonly name: string;
      readonly depth: SchematicEntryMode['depth'];
      readonly description: string;
      readonly defaultChangeKind?: SchematicEntryMode['default_change_kind'];
    }
  | {
      readonly kind: 'initial-contract';
      readonly flowId: string;
      readonly schemaName: string;
    }
  | {
      readonly kind: 'contract-alias';
      readonly flowId: string;
      readonly generic: string;
      readonly actual: string;
    }
  | {
      readonly kind: 'stage';
      readonly flowId: string;
      readonly stageId: string;
      readonly canonical: SchematicStage['canonical'];
      readonly title: string;
    }
  | {
      readonly kind: 'step';
      readonly flowId: string;
      readonly stepId: string;
      readonly title: string;
      readonly stage: SchematicStep['stage'];
      readonly block: SchematicStep['block'];
      readonly output: SchematicStep['output'];
      readonly evidenceRequirements: readonly string[];
      readonly execution: SchematicStep['execution'];
      readonly protocol: NonNullable<SchematicStep['protocol']>;
      readonly writes: NonNullable<SchematicStep['writes']>;
      readonly check: NonNullable<SchematicStep['check']>;
      readonly selection?: SchematicStep['selection'];
      readonly skillSlots?: SchematicStep['skill_slots'];
      readonly checkpointPolicy?: SchematicStep['checkpoint_policy'];
      readonly fanout?: SchematicStep['fanout'];
    }
  | {
      readonly kind: 'input-key';
      readonly flowId: string;
      readonly stepId: string;
      readonly key: string;
      readonly schemaName: string;
    }
  | {
      readonly kind: 'route';
      readonly flowId: string;
      readonly fromStepId: string;
      readonly outcome: string;
      readonly to: SchematicRouteTarget;
      readonly modeOverrides?: SchematicRouteModeOverrides;
    }
  | {
      readonly kind: 'registered-report';
      readonly flowId: string;
      readonly schemaName: string;
      readonly channel: 'relay' | 'report';
    }
  | {
      readonly kind: 'writer-binding';
      readonly flowId: string;
      readonly slot: keyof CompiledFlowPackage['writers'];
      readonly resultSchemaName: string;
    }
  | {
      readonly kind: 'structural-hint';
      readonly flowId: string;
      readonly hintId: string;
    }
  | {
      readonly kind: 'progress';
      readonly flowId: string;
      readonly stepId: string;
      readonly taskTitle: string;
      readonly activeText: string;
      readonly relayRole?: CompiledFlowProgressStep['relayRole'];
    }
  | {
      readonly kind: 'primary-result';
      readonly flowId: string;
      readonly schemaName: string;
      readonly path: string;
      readonly label: string;
    }
  | {
      readonly kind: 'engine-flag';
      readonly flowId: string;
      readonly flag: keyof NonNullable<CompiledFlowPackage['engineFlags']>;
      readonly value: boolean;
    };

export type FlowFactError =
  | { readonly kind: 'missing-flow' }
  | { readonly kind: 'duplicate-flow'; readonly flowId: string }
  | { readonly kind: 'missing-entry'; readonly flowId: string }
  | { readonly kind: 'missing-mode'; readonly flowId: string }
  | { readonly kind: 'missing-path'; readonly flowId: string; readonly pathKind: string }
  | {
      readonly kind: 'mixed-flow-fact';
      readonly expectedFlowId: string;
      readonly actualFlowId: string;
    }
  | { readonly kind: 'duplicate-path'; readonly flowId: string; readonly pathKind: string }
  | { readonly kind: 'duplicate-step'; readonly flowId: string; readonly stepId: string }
  | { readonly kind: 'duplicate-stage'; readonly flowId: string; readonly stageId: string }
  | {
      readonly kind: 'duplicate-route';
      readonly flowId: string;
      readonly stepId: string;
      readonly outcome: string;
    }
  | {
      readonly kind: 'duplicate-input-key';
      readonly flowId: string;
      readonly stepId: string;
      readonly key: string;
    }
  | { readonly kind: 'unknown-start-step'; readonly flowId: string; readonly stepId: string }
  | { readonly kind: 'unknown-route-source'; readonly flowId: string; readonly stepId: string }
  | {
      readonly kind: 'unknown-step-route';
      readonly flowId: string;
      readonly stepId: string;
      readonly target: string;
    }
  | { readonly kind: 'unknown-input-step'; readonly flowId: string; readonly stepId: string }
  | { readonly kind: 'unknown-progress-step'; readonly flowId: string; readonly stepId: string }
  | {
      readonly kind: 'missing-input-key';
      readonly flowId: string;
      readonly stepId: string;
      readonly key: string;
    }
  | { readonly kind: 'missing-progress'; readonly flowId: string; readonly stepId: string }
  | { readonly kind: 'missing-primary-result'; readonly flowId: string }
  | {
      readonly kind: 'semantic-drift';
      readonly flowId: string;
      readonly surface: string;
      readonly expected: readonly string[];
      readonly actual: readonly string[];
    };

export type Validation<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly E[] };

export interface ValidFlowFactModel {
  readonly flow: Extract<FlowFact, { readonly kind: 'flow' }>;
  readonly paths: readonly Extract<FlowFact, { readonly kind: 'path' }>[];
  readonly entry: Extract<FlowFact, { readonly kind: 'entry' }>;
  readonly modes: readonly Extract<FlowFact, { readonly kind: 'mode' }>[];
  readonly initialContracts: readonly Extract<FlowFact, { readonly kind: 'initial-contract' }>[];
  readonly contractAliases: readonly Extract<FlowFact, { readonly kind: 'contract-alias' }>[];
  readonly stages: readonly Extract<FlowFact, { readonly kind: 'stage' }>[];
  readonly steps: readonly Extract<FlowFact, { readonly kind: 'step' }>[];
  readonly inputKeys: readonly Extract<FlowFact, { readonly kind: 'input-key' }>[];
  readonly routes: readonly Extract<FlowFact, { readonly kind: 'route' }>[];
  readonly registeredReports: readonly Extract<FlowFact, { readonly kind: 'registered-report' }>[];
  readonly writerBindings: readonly Extract<FlowFact, { readonly kind: 'writer-binding' }>[];
  readonly structuralHints: readonly Extract<FlowFact, { readonly kind: 'structural-hint' }>[];
  readonly progress: readonly Extract<FlowFact, { readonly kind: 'progress' }>[];
  readonly primaryResult: Extract<FlowFact, { readonly kind: 'primary-result' }> | undefined;
  readonly engineFlags: readonly Extract<FlowFact, { readonly kind: 'engine-flag' }>[];
}

export interface DefineFlowFromFactsInput {
  readonly facts: readonly FlowFact[];
  readonly routing?: FlowDefinitionInput['routing'];
  readonly relayReports?: readonly CompiledFlowRelayReport[];
  readonly reportSchemas?: readonly CompiledFlowReportSchema[];
  readonly writers?: FlowDefinitionInput['writers'];
  readonly structuralHints?: FlowDefinitionInput['structuralHints'];
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function collect<F extends FlowFact['kind']>(
  facts: readonly FlowFact[],
  kind: F,
): readonly Extract<FlowFact, { readonly kind: F }>[] {
  return facts.filter(
    (fact): fact is Extract<FlowFact, { readonly kind: F }> => fact.kind === kind,
  );
}

export function validateFlowFacts(
  facts: readonly FlowFact[],
): Validation<ValidFlowFactModel, FlowFactError> {
  const errors: FlowFactError[] = [];
  const flows = collect(facts, 'flow');
  const flow = flows[0];
  if (flow === undefined) {
    errors.push({ kind: 'missing-flow' });
  }
  for (const flowId of duplicateValues(flows.map((fact) => fact.flowId))) {
    errors.push({ kind: 'duplicate-flow', flowId });
  }

  const flowId = flow?.flowId ?? '<missing>';
  const paths = collect(facts, 'path');
  const entries = collect(facts, 'entry');
  const entry = entries[0];
  const modes = collect(facts, 'mode');
  const initialContracts = collect(facts, 'initial-contract');
  const contractAliases = collect(facts, 'contract-alias');
  const stages = collect(facts, 'stage');
  const steps = collect(facts, 'step');
  const inputKeys = collect(facts, 'input-key');
  const routes = collect(facts, 'route');
  const registeredReports = collect(facts, 'registered-report');
  const writerBindings = collect(facts, 'writer-binding');
  const structuralHints = collect(facts, 'structural-hint');
  const progress = collect(facts, 'progress');
  const primaryResults = collect(facts, 'primary-result');
  const engineFlags = collect(facts, 'engine-flag');

  if (flow !== undefined) {
    for (const fact of facts) {
      if (fact.flowId !== flow.flowId) {
        errors.push({
          kind: 'mixed-flow-fact',
          expectedFlowId: flow.flowId,
          actualFlowId: fact.flowId,
        });
      }
    }
  }
  if (entry === undefined) errors.push({ kind: 'missing-entry', flowId });
  if (modes.length === 0) errors.push({ kind: 'missing-mode', flowId });
  if (!paths.some((path) => path.pathKind === 'schematic')) {
    errors.push({ kind: 'missing-path', flowId, pathKind: 'schematic' });
  }
  if (flow?.visibility === 'public' && primaryResults[0] === undefined) {
    errors.push({ kind: 'missing-primary-result', flowId });
  }

  for (const stepId of duplicateValues(steps.map((step) => step.stepId))) {
    errors.push({ kind: 'duplicate-step', flowId, stepId });
  }
  for (const pathKind of duplicateValues(paths.map((path) => path.pathKind))) {
    errors.push({ kind: 'duplicate-path', flowId, pathKind });
  }
  for (const stageId of duplicateValues(stages.map((stage) => stage.stageId))) {
    errors.push({ kind: 'duplicate-stage', flowId, stageId });
  }

  const stepIds = new Set(steps.map((step) => step.stepId));
  if (flow !== undefined && !stepIds.has(flow.startsAt)) {
    errors.push({ kind: 'unknown-start-step', flowId, stepId: flow.startsAt });
  }

  for (const route of routes) {
    if (!stepIds.has(route.fromStepId)) {
      errors.push({ kind: 'unknown-route-source', flowId, stepId: route.fromStepId });
    }
    const key = `${route.fromStepId}\0${route.outcome}`;
    const duplicates = routes.filter(
      (candidate) => `${candidate.fromStepId}\0${candidate.outcome}` === key && candidate !== route,
    );
    if (
      duplicates.length > 0 &&
      routes.indexOf(route) ===
        routes.findIndex((candidate) => `${candidate.fromStepId}\0${candidate.outcome}` === key)
    ) {
      errors.push({
        kind: 'duplicate-route',
        flowId,
        stepId: route.fromStepId,
        outcome: route.outcome,
      });
    }
    validateRouteTarget({ flowId, stepId: route.fromStepId, target: route.to, stepIds, errors });
    for (const target of Object.values(route.modeOverrides ?? {})) {
      validateRouteTarget({ flowId, stepId: route.fromStepId, target, stepIds, errors });
    }
  }

  const inputsByStep = new Map<string, Set<string>>();
  for (const inputKey of inputKeys) {
    if (!stepIds.has(inputKey.stepId)) {
      errors.push({ kind: 'unknown-input-step', flowId, stepId: inputKey.stepId });
    }
    const current = inputsByStep.get(inputKey.stepId) ?? new Set<string>();
    if (current.has(inputKey.key)) {
      errors.push({
        kind: 'duplicate-input-key',
        flowId,
        stepId: inputKey.stepId,
        key: inputKey.key,
      });
    }
    current.add(inputKey.key);
    inputsByStep.set(inputKey.stepId, current);
  }

  for (const step of steps) {
    const stepInputKeys = new Set(
      inputKeys
        .filter((inputKey) => inputKey.stepId === step.stepId)
        .map((inputKey) => inputKey.key),
    );
    for (const key of stepInputKeys) {
      if (key.length === 0) {
        errors.push({ kind: 'missing-input-key', flowId, stepId: step.stepId, key });
      }
    }
    if (flow?.visibility === 'public' && !progress.some((item) => item.stepId === step.stepId)) {
      errors.push({ kind: 'missing-progress', flowId, stepId: step.stepId });
    }
  }
  for (const progressStep of progress) {
    if (!stepIds.has(progressStep.stepId)) {
      errors.push({ kind: 'unknown-progress-step', flowId, stepId: progressStep.stepId });
    }
  }

  if (errors.length > 0 || flow === undefined || entry === undefined) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      flow,
      paths,
      entry,
      modes,
      initialContracts,
      contractAliases,
      stages,
      steps,
      inputKeys,
      routes,
      registeredReports,
      writerBindings,
      structuralHints,
      progress,
      primaryResult: primaryResults[0],
      engineFlags,
    },
  };
}

function validateRouteTarget(input: {
  readonly flowId: string;
  readonly stepId: string;
  readonly target: string;
  readonly stepIds: ReadonlySet<string>;
  readonly errors: FlowFactError[];
}): void {
  if (
    input.target === '@complete' ||
    input.target === '@stop' ||
    input.target === '@handoff' ||
    input.target === '@escalate'
  ) {
    return;
  }
  if (!input.stepIds.has(input.target)) {
    input.errors.push({
      kind: 'unknown-step-route',
      flowId: input.flowId,
      stepId: input.stepId,
      target: input.target,
    });
  }
}

export function projectSchematicFromFacts(model: ValidFlowFactModel): FlowSchematicInput {
  return {
    schema_version: '1',
    id: model.flow.flowId,
    title: model.flow.title,
    purpose: model.flow.purpose,
    status: model.flow.status,
    version: model.flow.version,
    starts_at: model.flow.startsAt,
    initial_contracts: model.initialContracts.map((contract) => contract.schemaName),
    contract_aliases: model.contractAliases.map(
      (alias): SchematicContractAlias => ({
        generic: alias.generic,
        actual: alias.actual,
      }),
    ),
    entry: projectEntry(model.entry),
    entry_modes: model.modes.map(projectEntryMode),
    stage_path_policy: model.flow.stagePathPolicy,
    stages: model.stages.map(
      (stage): SchematicStage => ({
        canonical: stage.canonical,
        id: stage.stageId,
        title: stage.title,
      }),
    ),
    items: model.steps.map((step) => projectStep(model, step)),
  };
}

function projectEntry(entry: Extract<FlowFact, { readonly kind: 'entry' }>): SchematicEntry {
  return {
    signals: {
      include: [...entry.include],
      exclude: [...entry.exclude],
    },
    intent_prefixes: [...entry.intentPrefixes],
  };
}

function projectEntryMode(mode: Extract<FlowFact, { readonly kind: 'mode' }>): SchematicEntryMode {
  return {
    name: mode.name,
    depth: mode.depth,
    description: mode.description,
    ...(mode.defaultChangeKind === undefined
      ? {}
      : { default_change_kind: mode.defaultChangeKind }),
  };
}

function projectStep(
  model: ValidFlowFactModel,
  step: Extract<FlowFact, { readonly kind: 'step' }>,
): SchematicStep {
  const routes = Object.fromEntries(
    model.routes
      .filter((route) => route.fromStepId === step.stepId)
      .map((route) => [route.outcome, route.to]),
  );
  const route_overrides: NonNullable<SchematicStep['route_overrides']> = {};
  for (const route of model.routes) {
    if (route.fromStepId !== step.stepId || route.modeOverrides === undefined) continue;
    route_overrides[route.outcome] = route.modeOverrides;
  }
  return {
    id: step.stepId,
    title: step.title,
    stage: step.stage,
    block: step.block,
    input: projectStepInput(model, step.stepId),
    output: step.output,
    evidence_requirements: [...step.evidenceRequirements],
    execution: step.execution,
    skill_slots: step.skillSlots ?? [],
    protocol: step.protocol,
    writes: step.writes,
    check: step.check,
    ...(step.selection === undefined ? {} : { selection: step.selection }),
    ...(step.checkpointPolicy === undefined ? {} : { checkpoint_policy: step.checkpointPolicy }),
    ...(step.fanout === undefined ? {} : { fanout: step.fanout }),
    routes,
    route_overrides,
  };
}

function projectStepInput(model: ValidFlowFactModel, stepId: string): SchematicInput {
  return Object.fromEntries(
    model.inputKeys
      .filter((inputKey) => inputKey.stepId === stepId)
      .map((inputKey) => [inputKey.key, inputKey.schemaName]),
  );
}

export function projectRuntimeSurfaceFromFacts(
  model: ValidFlowFactModel,
): CompiledFlowRuntimeSurface | undefined {
  if (model.primaryResult === undefined && model.progress.length === 0) return undefined;
  return {
    supportedEntryModes: model.modes.map((mode) => ({
      entryModeName: mode.name,
      depth: mode.depth,
    })),
    ...(model.primaryResult === undefined
      ? {}
      : {
          primaryResult: {
            schemaName: model.primaryResult.schemaName,
            path: model.primaryResult.path,
            label: model.primaryResult.label,
          },
        }),
    ...(model.progress.length === 0
      ? {}
      : {
          progress: {
            steps: model.progress.map((step) => ({
              stepId: step.stepId,
              taskTitle: step.taskTitle,
              activeText: step.activeText,
              ...(step.relayRole === undefined ? {} : { relayRole: step.relayRole }),
            })),
          },
        }),
  };
}

function projectPathsFromFacts(
  model: ValidFlowFactModel,
): NonNullable<FlowDefinitionInput['paths']> {
  return Object.fromEntries(model.paths.map((path) => [path.pathKind, path.path]));
}

function projectEngineFlagsFromFacts(
  model: ValidFlowFactModel,
): FlowDefinitionInput['engineFlags'] | undefined {
  if (model.engineFlags.length === 0) return undefined;
  const flags: { bindsExecutionDepthToRelaySelection?: boolean } = {};
  for (const fact of model.engineFlags) {
    flags[fact.flag] = fact.value;
  }
  return flags;
}

export function defineFlowFromFacts(input: DefineFlowFromFactsInput): FlowDefinition {
  const validation = validateFlowFacts(input.facts);
  if (!validation.ok) {
    throw new Error(`invalid flow facts: ${JSON.stringify(validation.errors, null, 2)}`);
  }
  const model = validation.value;
  const semanticErrors = validateSemanticBindings(model, input);
  if (semanticErrors.length > 0) {
    throw new Error(`flow fact semantic drift: ${JSON.stringify(semanticErrors, null, 2)}`);
  }
  const engineFlags = projectEngineFlagsFromFacts(model);
  const runtimeSurface = projectRuntimeSurfaceFromFacts(model);
  return defineFlow({
    id: model.flow.flowId,
    visibility: model.flow.visibility,
    paths: projectPathsFromFacts(model),
    schematic: projectSchematicFromFacts(model),
    ...(input.routing === undefined ? {} : { routing: input.routing }),
    relayReports: input.relayReports ?? [],
    reportSchemas: input.reportSchemas ?? [],
    writers: input.writers ?? {},
    ...(input.structuralHints === undefined ? {} : { structuralHints: input.structuralHints }),
    ...(runtimeSurface === undefined ? {} : { runtimeSurface }),
    ...(engineFlags === undefined ? {} : { engineFlags }),
  });
}

function validateSemanticBindings(
  model: ValidFlowFactModel,
  input: DefineFlowFromFactsInput,
): readonly FlowFactError[] {
  const errors: FlowFactError[] = [];
  compareSemanticSurface({
    model,
    errors,
    surface: 'relayReports',
    expected: model.registeredReports
      .filter((report) => report.channel === 'relay')
      .map((report) => report.schemaName),
    actual: (input.relayReports ?? []).map((report) => report.schemaName),
  });
  compareSemanticSurface({
    model,
    errors,
    surface: 'reportSchemas',
    expected: model.registeredReports
      .filter((report) => report.channel === 'report')
      .map((report) => report.schemaName),
    actual: (input.reportSchemas ?? []).map((report) => report.schemaName),
  });
  for (const slot of ['compose', 'close', 'verification', 'checkpoint'] as const) {
    compareSemanticSurface({
      model,
      errors,
      surface: `writers.${slot}`,
      expected: model.writerBindings
        .filter((binding) => binding.slot === slot)
        .map((binding) => binding.resultSchemaName),
      actual: (input.writers?.[slot] ?? []).map((writer) => writer.resultSchemaName),
    });
  }
  compareSemanticSurface({
    model,
    errors,
    surface: 'structuralHints',
    expected: model.structuralHints.map((hint) => hint.hintId),
    actual: (input.structuralHints ?? []).map((hint) => hint.id),
  });
  return errors;
}

function compareSemanticSurface(input: {
  readonly model: ValidFlowFactModel;
  readonly errors: FlowFactError[];
  readonly surface: string;
  readonly expected: readonly string[];
  readonly actual: readonly string[];
}): void {
  if (input.expected.join('\0') === input.actual.join('\0')) return;
  input.errors.push({
    kind: 'semantic-drift',
    flowId: input.model.flow.flowId,
    surface: input.surface,
    expected: input.expected,
    actual: input.actual,
  });
}
