import { z } from 'zod';
import { ChangeKind } from './change-kind.js';
import { FanoutJoinPolicy } from './check.js';
import { Depth } from './depth.js';
import {
  FlowBlockCatalog,
  type FlowBlockCatalog as FlowBlockCatalogValue,
  FlowBlockId,
  type FlowBlockId as FlowBlockIdValue,
  type FlowBlock as FlowBlockValue,
  FlowContractRef,
  type FlowContractRef as FlowContractRefValue,
  FlowRoute,
  type FlowRoute as FlowRouteValue,
} from './flow-blocks.js';
import {
  acceptedSchematicExecutionKindsForBlock,
  acceptedSchematicStagesForBlock,
} from './flow-schematic-policy.js';
import { CompiledFlowId, ProtocolId, StageId, StepId } from './ids.js';
import { RunRelativePath } from './scalars.js';
import { SelectionOverride } from './selection-policy.js';
import { SkillSlotArray } from './skill.js';
import {
  CanonicalStage,
  type CanonicalStage as CanonicalStageValue,
  SpinePolicy,
} from './stage.js';
import {
  CheckpointPolicy,
  CompiledFlowRef,
  FanoutBranches,
  FanoutConcurrency,
  FanoutFailurePolicy,
  RelayRole,
} from './step.js';

export const FlowSchematicStatus = z.enum(['candidate', 'active', 'deprecated']);
export type FlowSchematicStatus = z.infer<typeof FlowSchematicStatus>;

export const StepRouteTerminalTarget = z.enum(['@complete', '@stop', '@handoff', '@escalate']);
export type StepRouteTerminalTarget = z.infer<typeof StepRouteTerminalTarget>;

export const StepRouteTarget = z.union([StepId, StepRouteTerminalTarget]);
export type StepRouteTarget = z.infer<typeof StepRouteTarget>;

export const SchematicRouteModeOverrides = z
  .record(Depth, StepRouteTarget)
  .refine((overrides) => Object.keys(overrides).length > 0, {
    message: 'route override must declare at least one depth',
  });
export type SchematicRouteModeOverrides = z.infer<typeof SchematicRouteModeOverrides>;

export const SchematicContractAlias = z
  .object({
    generic: FlowContractRef,
    actual: FlowContractRef,
  })
  .strict();
export type SchematicContractAlias = z.infer<typeof SchematicContractAlias>;

export const SchematicEvidenceRequirement = z.string().min(1);
export type SchematicEvidenceRequirement = z.infer<typeof SchematicEvidenceRequirement>;

export const SchematicEvidenceRequirements = z
  .array(SchematicEvidenceRequirement)
  .min(1)
  .superRefine((requirements, ctx) => {
    const seen = new Set<string>();
    for (const [index, requirement] of requirements.entries()) {
      if (seen.has(requirement)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: `duplicate evidence requirement: ${requirement}`,
        });
      }
      seen.add(requirement);
    }
  });
export type SchematicEvidenceRequirements = z.infer<typeof SchematicEvidenceRequirements>;

export const StepExecutionKind = z.enum([
  'compose',
  'relay',
  'verification',
  'checkpoint',
  'sub-run',
  'fanout',
]);
export type StepExecutionKind = z.infer<typeof StepExecutionKind>;

const ComposeStepExecution = z.object({ kind: z.literal('compose') }).strict();
const VerificationStepExecution = z.object({ kind: z.literal('verification') }).strict();
const CheckpointStepExecution = z.object({ kind: z.literal('checkpoint') }).strict();
const FanoutStepExecution = z.object({ kind: z.literal('fanout') }).strict();
const RelayStepExecution = z
  .object({
    kind: z.literal('relay'),
    role: RelayRole,
  })
  .strict();
const SubRunStepExecution = z
  .object({
    kind: z.literal('sub-run'),
    flow_ref: CompiledFlowRef,
    goal: z.string().min(1),
    depth: Depth,
  })
  .strict();

export const StepExecution = z.discriminatedUnion('kind', [
  ComposeStepExecution,
  RelayStepExecution,
  VerificationStepExecution,
  CheckpointStepExecution,
  SubRunStepExecution,
  FanoutStepExecution,
]);
export type StepExecution = z.infer<typeof StepExecution>;

// Per-item write paths. Conditional on execution.kind:
//   compose | verification           → report_path required (single-report write)
//   relay                           → request_path, receipt_path, result_path required;
//                                        report_path optional (worker-emitted typed report)
//   checkpoint                         → checkpoint_request_path, checkpoint_response_path required;
//                                        report_path optional (for checkpoints that write a report)
//   sub-run                            → result_path required (child run's result.json copied
//                                        into parent's writes.result slot — RunResult shape)
// Cross-field shape is enforced at the SchematicStep superRefine where
// execution.kind is in scope.
export const StepWrites = z
  .object({
    report_path: RunRelativePath.optional(),
    request_path: RunRelativePath.optional(),
    receipt_path: RunRelativePath.optional(),
    result_path: RunRelativePath.optional(),
    branches_dir_path: RunRelativePath.optional(),
    checkpoint_request_path: RunRelativePath.optional(),
    checkpoint_response_path: RunRelativePath.optional(),
  })
  .strict();
export type StepWrites = z.infer<typeof StepWrites>;

export const SchematicFanout = z
  .object({
    branches: FanoutBranches,
    concurrency: FanoutConcurrency.optional(),
    on_child_failure: FanoutFailurePolicy.optional(),
    join: FanoutJoinPolicy,
  })
  .strict();
export type SchematicFanout = z.infer<typeof SchematicFanout>;

// Per-item check metadata. Conditional on execution.kind:
//   compose | verification           → required: SchemaSectionsCheck.required
//   checkpoint                         → allow: CheckpointSelectionCheck.allow
//   relay | sub-run | fanout          → pass: ResultVerdictCheck.pass / Fanout admit list
// Cross-field shape is enforced at the SchematicStep superRefine.
export const StepCheck = z
  .object({
    required: z.array(z.string().min(1)).min(1).optional(),
    allow: z.array(z.string().min(1)).min(1).optional(),
    pass: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();
export type StepCheck = z.infer<typeof StepCheck>;

export const SchematicStep = z
  .object({
    id: StepId,
    block: FlowBlockId,
    title: z.string().min(1),
    stage: CanonicalStage,
    input: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), FlowContractRef).default({}),
    output: FlowContractRef,
    evidence_requirements: SchematicEvidenceRequirements,
    execution: StepExecution,
    selection: SelectionOverride.optional(),
    skill_slots: SkillSlotArray.default([]),
    routes: z.record(z.string(), StepRouteTarget).refine((routes) => {
      return Object.keys(routes).length > 0;
    }, 'schematic item must declare at least one route'),
    route_overrides: z.record(z.string(), SchematicRouteModeOverrides).default({}),
    // The fields below are required by the schematic → CompiledFlow compiler. They
    // are optional at parse time so existing candidate schematics remain
    // parseable while the active schematics (build/explore/review) are
    // populated incrementally. The compiler enforces presence and
    // (kind, check, writes) shape.
    protocol: ProtocolId.optional(),
    writes: StepWrites.optional(),
    check: StepCheck.optional(),
    checkpoint_policy: CheckpointPolicy.optional(),
    fanout: SchematicFanout.optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const seenRoutes = new Set<string>();
    for (const route of Object.keys(item.routes)) {
      if (!FlowRoute.safeParse(route).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['routes', route],
          message: `unknown schematic route outcome: ${route}`,
        });
      }
      if (seenRoutes.has(route)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['routes', route],
          message: `duplicate route outcome: ${route}`,
        });
      }
      seenRoutes.add(route);
    }
    for (const route of Object.keys(item.route_overrides)) {
      if (!FlowRoute.safeParse(route).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['route_overrides', route],
          message: `unknown schematic route outcome: ${route}`,
        });
      }
      if (!Object.hasOwn(item.routes, route)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['route_overrides', route],
          message: `route override must target a declared route outcome: ${route}`,
        });
      }
    }
    validateExecutionShape(item, ctx);
  });
export type SchematicStep = z.infer<typeof SchematicStep>;

// Cross-field check for the optional executor metadata. When `writes` or
// `check` is supplied, its shape must match `execution.kind`. When
// `checkpoint_policy` is supplied, `execution.kind` must be 'checkpoint'.
// Absence is allowed (these fields are populated per-schematic over time and
// the compiler raises a separate "missing" diagnostic).
function validateExecutionShape(
  item: {
    execution: StepExecution;
    writes?: StepWrites | undefined;
    check?: StepCheck | undefined;
    checkpoint_policy?: CheckpointPolicy | undefined;
    fanout?: SchematicFanout | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const kind = item.execution.kind;

  if (item.writes !== undefined) {
    const w = item.writes;
    const has = (key: keyof StepWrites) => w[key] !== undefined;
    const expectReport = () => {
      if (!has('report_path')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['writes', 'report_path'],
          message: `${kind} execution requires writes.report_path`,
        });
      }
    };
    const expectRelaySlots = () => {
      for (const key of ['request_path', 'receipt_path', 'result_path'] as const) {
        if (!has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['writes', key],
            message: `relay execution requires writes.${key}`,
          });
        }
      }
    };
    const expectCheckpointSlots = () => {
      for (const key of ['checkpoint_request_path', 'checkpoint_response_path'] as const) {
        if (!has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['writes', key],
            message: `checkpoint execution requires writes.${key}`,
          });
        }
      }
    };
    const expectSubRunSlots = () => {
      if (!has('result_path')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['writes', 'result_path'],
          message: 'sub-run execution requires writes.result_path',
        });
      }
    };
    const forbid = (key: keyof StepWrites, allowedKinds: string) => {
      if (has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['writes', key],
          message: `writes.${key} is only allowed for ${allowedKinds} execution`,
        });
      }
    };
    switch (kind) {
      case 'compose':
      case 'verification':
        expectReport();
        forbid('request_path', 'relay');
        forbid('receipt_path', 'relay');
        forbid('result_path', 'relay|sub-run');
        forbid('branches_dir_path', 'fanout');
        forbid('checkpoint_request_path', 'checkpoint');
        forbid('checkpoint_response_path', 'checkpoint');
        break;
      case 'relay':
        expectRelaySlots();
        forbid('branches_dir_path', 'fanout');
        forbid('checkpoint_request_path', 'checkpoint');
        forbid('checkpoint_response_path', 'checkpoint');
        break;
      case 'checkpoint':
        expectCheckpointSlots();
        forbid('request_path', 'relay');
        forbid('receipt_path', 'relay');
        forbid('result_path', 'relay|sub-run');
        forbid('branches_dir_path', 'fanout');
        break;
      case 'sub-run':
        expectSubRunSlots();
        forbid('report_path', 'compose|verification');
        forbid('request_path', 'relay');
        forbid('receipt_path', 'relay');
        forbid('branches_dir_path', 'fanout');
        forbid('checkpoint_request_path', 'checkpoint');
        forbid('checkpoint_response_path', 'checkpoint');
        break;
      case 'fanout':
        expectReport();
        if (!has('branches_dir_path')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['writes', 'branches_dir_path'],
            message: 'fanout execution requires writes.branches_dir_path',
          });
        }
        forbid('request_path', 'relay');
        forbid('receipt_path', 'relay');
        forbid('result_path', 'relay|sub-run');
        forbid('checkpoint_request_path', 'checkpoint');
        forbid('checkpoint_response_path', 'checkpoint');
        break;
    }
  }

  if (item.check !== undefined) {
    const g = item.check;
    const expectField = (field: 'required' | 'allow' | 'pass', forKinds: string) => {
      if (g[field] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['check', field],
          message: `${forKinds} execution requires check.${field}`,
        });
      }
    };
    const forbidField = (field: 'required' | 'allow' | 'pass', allowedKinds: string) => {
      if (g[field] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['check', field],
          message: `check.${field} is only allowed for ${allowedKinds} execution`,
        });
      }
    };
    switch (kind) {
      case 'compose':
      case 'verification':
        expectField('required', `${kind}`);
        forbidField('allow', 'checkpoint');
        forbidField('pass', 'relay|sub-run');
        break;
      case 'checkpoint':
        expectField('allow', 'checkpoint');
        forbidField('required', 'compose|verification');
        forbidField('pass', 'relay|sub-run');
        break;
      case 'relay':
      case 'sub-run':
        expectField('pass', `${kind}`);
        forbidField('required', 'compose|verification');
        forbidField('allow', 'checkpoint');
        break;
      case 'fanout':
        expectField('pass', 'fanout');
        forbidField('required', 'compose|verification');
        forbidField('allow', 'checkpoint');
        break;
    }
  }

  if (item.checkpoint_policy !== undefined && kind !== 'checkpoint') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkpoint_policy'],
      message: 'checkpoint_policy is only allowed for checkpoint execution',
    });
  }
  if (kind === 'fanout' && item.fanout === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fanout'],
      message: 'fanout execution requires fanout metadata',
    });
  }
  if (item.fanout !== undefined && kind !== 'fanout') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fanout'],
      message: 'fanout metadata is only allowed for fanout execution',
    });
  }
}

// Schematic-level entry mode. Each emitted CompiledFlow inherits these as
// CompiledFlow.entry_modes[i] with start_at = schematic.starts_at.
export const FlowEntryMode = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    depth: Depth,
    description: z.string().min(1),
    default_change_kind: ChangeKind.optional(),
  })
  .strict();
export type FlowEntryMode = z.infer<typeof FlowEntryMode>;

// Per-canonical-stage metadata. Lets a schematic map its canonical stages
// to author-friendly stage ids and titles ("Synthesize" for explore's
// canonical=act stage, "Independent Audit" for review's canonical=analyze).
export const SchematicStage = z
  .object({
    canonical: CanonicalStage,
    id: StageId,
    title: z.string().min(1),
  })
  .strict();
export type SchematicStage = z.infer<typeof SchematicStage>;

// Schematic-level entry classification — matches CompiledFlow.entry shape so the
// compiler can pass it through directly.
export const FlowSchematicEntry = z
  .object({
    signals: z
      .object({
        include: z.array(z.string()).default([]),
        exclude: z.array(z.string()).default([]),
      })
      .strict(),
    intent_prefixes: z.array(z.string()).default([]),
  })
  .strict();
export type FlowSchematicEntry = z.infer<typeof FlowSchematicEntry>;

export const FlowSchematic = z
  .object({
    schema_version: z.literal('1'),
    id: CompiledFlowId,
    title: z.string().min(1),
    purpose: z.string().min(1),
    status: FlowSchematicStatus,
    starts_at: StepId,
    initial_contracts: z.array(FlowContractRef).default([]),
    contract_aliases: z.array(SchematicContractAlias).default([]),
    items: z.array(SchematicStep).min(1),
    // Compiler-required metadata. Optional at parse time so candidate schematics
    // (and schematics still being upgraded) keep parsing. The compiler enforces
    // presence and consistency at emit time.
    version: z.string().min(1).optional(),
    entry: FlowSchematicEntry.optional(),
    entry_modes: z.array(FlowEntryMode).min(1).optional(),
    stage_path_policy: SpinePolicy.optional(),
    stages: z.array(SchematicStage).optional(),
    default_selection: SelectionOverride.optional(),
  })
  .strict()
  .superRefine((schematic, ctx) => {
    const itemIds = new Map<string, number>();
    for (const [index, item] of schematic.items.entries()) {
      const prior = itemIds.get(item.id);
      if (prior !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'id'],
          message: `duplicate schematic item id: ${item.id} also appears at index ${prior}`,
        });
      }
      itemIds.set(item.id, index);
    }

    if (!itemIds.has(schematic.starts_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['starts_at'],
        message: `starts_at references unknown item id: ${schematic.starts_at}`,
      });
    }

    for (const [index, item] of schematic.items.entries()) {
      for (const [route, target] of Object.entries(item.routes)) {
        if (StepRouteTerminalTarget.safeParse(target).success) continue;
        if (!itemIds.has(target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', index, 'routes', route],
            message: `route target references unknown schematic item id: ${target}`,
          });
        }
      }
      for (const [route, overrides] of Object.entries(item.route_overrides)) {
        for (const [depth, target] of Object.entries(overrides)) {
          if (StepRouteTerminalTarget.safeParse(target).success) continue;
          if (!itemIds.has(target)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['items', index, 'route_overrides', route, depth],
              message: `route override target references unknown schematic item id: ${target}`,
            });
          }
        }
      }
    }

    const aliases = new Set<string>();
    for (const [index, alias] of schematic.contract_aliases.entries()) {
      const key = `${alias.generic}\0${alias.actual}`;
      if (aliases.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['contract_aliases', index],
          message: `duplicate contract alias: ${alias.generic} -> ${alias.actual}`,
        });
      }
      aliases.add(key);
    }

    if (schematic.entry_modes !== undefined) {
      const seenNames = new Set<string>();
      for (const [index, mode] of schematic.entry_modes.entries()) {
        if (seenNames.has(mode.name)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['entry_modes', index, 'name'],
            message: `duplicate entry mode name: ${mode.name}`,
          });
        }
        seenNames.add(mode.name);
      }
    }

    if (schematic.stages !== undefined) {
      const seenCanonicals = new Set<CanonicalStageValue>();
      const seenIds = new Set<string>();
      for (const [index, stage] of schematic.stages.entries()) {
        if (seenCanonicals.has(stage.canonical)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['stages', index, 'canonical'],
            message: `duplicate canonical stage mapping: ${stage.canonical}`,
          });
        }
        seenCanonicals.add(stage.canonical);
        if (seenIds.has(stage.id as unknown as string)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['stages', index, 'id'],
            message: `duplicate stage id: ${stage.id}`,
          });
        }
        seenIds.add(stage.id as unknown as string);
      }
      // Every canonical stage touched by any item must have a stages entry.
      const itemCanonicals = new Set<CanonicalStageValue>(
        schematic.items.map((item) => item.stage),
      );
      for (const canonical of itemCanonicals) {
        if (!seenCanonicals.has(canonical)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['stages'],
            message: `stages is missing an entry for canonical stage '${canonical}' which is used by at least one item`,
          });
        }
      }
      // The reverse is valid: a schematic may declare canonical stage
      // metadata even when a mode leaves that stage empty. The compiler
      // records the omission reason in stage_path_policy.
    }

    if (
      schematic.stage_path_policy !== undefined &&
      schematic.stage_path_policy.mode === 'partial'
    ) {
      const seenOmits = new Set<CanonicalStageValue>();
      for (const [index, omitted] of schematic.stage_path_policy.omits.entries()) {
        if (seenOmits.has(omitted)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['stage_path_policy', 'omits', index],
            message: `duplicate omitted stage: ${omitted}`,
          });
        }
        seenOmits.add(omitted);
      }
      // omits must be disjoint from stages.canonical when both are present.
      if (schematic.stages !== undefined) {
        const declared = new Set(schematic.stages.map((stage) => stage.canonical));
        for (const omitted of seenOmits) {
          if (declared.has(omitted)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['stage_path_policy', 'omits'],
              message: `canonical stage '${omitted}' is both declared in stages and listed in stage_path_policy.omits`,
            });
          }
        }
      }
      // omits must not include a stage that any item uses.
      const itemCanonicals = new Set<CanonicalStageValue>(
        schematic.items.map((item) => item.stage),
      );
      for (const omitted of seenOmits) {
        if (itemCanonicals.has(omitted)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['stage_path_policy', 'omits'],
            message: `canonical stage '${omitted}' is omitted but used by at least one item`,
          });
        }
      }
    }
  });
export type FlowSchematic = z.infer<typeof FlowSchematic>;

export type FlowSchematicCatalogCompatibilityIssue = {
  item_id?: string;
  message: string;
};

function contractIsCompatible(
  expected: FlowContractRefValue,
  actual: FlowContractRefValue,
  aliases: readonly SchematicContractAlias[],
): boolean {
  if (expected === actual) return true;
  return aliases.some((alias) => alias.generic === expected && alias.actual === actual);
}

function blockAcceptedInputSets(
  block: FlowBlockValue,
): readonly (readonly FlowContractRefValue[])[] {
  return [block.input_contracts, ...block.alternative_input_contracts];
}

function schematicStepSatisfiesInputSet(
  item: SchematicStep,
  expectedContracts: readonly FlowContractRefValue[],
  aliases: readonly SchematicContractAlias[],
): boolean {
  const actualContracts = Object.values(item.input);
  return expectedContracts.every((expected) =>
    actualContracts.some((actual) => contractIsCompatible(expected, actual, aliases)),
  );
}

function formatContractSet(contracts: readonly FlowContractRefValue[]): string {
  return `[${contracts.join(', ')}]`;
}

function isTerminalTarget(target: StepRouteTarget): target is StepRouteTerminalTarget {
  return StepRouteTerminalTarget.safeParse(target).success;
}

function schematicStepRouteTargets(item: SchematicStep): StepRouteTarget[] {
  return [
    ...Object.values(item.routes),
    ...Object.values(item.route_overrides).flatMap((overrides) => Object.values(overrides)),
  ];
}

function schematicStepRouteOutcomes(item: SchematicStep): string[] {
  return [...new Set([...Object.keys(item.routes), ...Object.keys(item.route_overrides)])];
}

function intersectContracts(
  left: ReadonlySet<FlowContractRefValue>,
  right: ReadonlySet<FlowContractRefValue>,
): Set<FlowContractRefValue> {
  const intersection = new Set<FlowContractRefValue>();
  for (const value of left) {
    if (right.has(value)) intersection.add(value);
  }
  return intersection;
}

function contractSetsEqual(
  left: ReadonlySet<FlowContractRefValue>,
  right: ReadonlySet<FlowContractRefValue>,
): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function collectRouteAwareAvailability(
  schematic: FlowSchematic,
): Map<string, Set<FlowContractRefValue>> {
  const itemById = new Map(schematic.items.map((item) => [item.id as unknown as string, item]));
  const availableAt = new Map<string, Set<FlowContractRefValue>>();
  const worklist: string[] = [schematic.starts_at];
  availableAt.set(schematic.starts_at, new Set(schematic.initial_contracts));

  while (worklist.length > 0) {
    const itemId = worklist.shift();
    if (itemId === undefined) continue;
    const item = itemById.get(itemId);
    const current = availableAt.get(itemId);
    if (item === undefined || current === undefined) continue;

    const afterItem = new Set(current);
    afterItem.add(item.output);

    for (const target of schematicStepRouteTargets(item)) {
      if (isTerminalTarget(target)) continue;
      const prior = availableAt.get(target);
      if (prior === undefined) {
        availableAt.set(target, new Set(afterItem));
        worklist.push(target);
        continue;
      }
      const narrowed = intersectContracts(prior, afterItem);
      if (!contractSetsEqual(prior, narrowed)) {
        availableAt.set(target, narrowed);
        worklist.push(target);
      }
    }
  }

  return availableAt;
}

export function validateFlowSchematicCatalogCompatibility(
  schematic: FlowSchematic,
  catalog: FlowBlockCatalogValue,
): FlowSchematicCatalogCompatibilityIssue[] {
  const parsedCatalog = FlowBlockCatalog.safeParse(catalog);
  if (!parsedCatalog.success) {
    return [{ message: `block catalog failed to parse: ${parsedCatalog.error.message}` }];
  }

  const blockById = new Map(parsedCatalog.data.blocks.map((p) => [p.id, p]));
  const issues: FlowSchematicCatalogCompatibilityIssue[] = [];

  for (const item of schematic.items) {
    const block = blockById.get(item.block as FlowBlockIdValue);
    if (block === undefined) {
      issues.push({
        item_id: item.id,
        message: `unknown block id: ${item.block}`,
      });
      continue;
    }

    for (const route of schematicStepRouteOutcomes(item) as FlowRouteValue[]) {
      if (!block.allowed_routes.includes(route)) {
        issues.push({
          item_id: item.id,
          message: `route "${route}" is not allowed by block "${item.block}"`,
        });
      }
    }

    const acceptedInputSets = blockAcceptedInputSets(block);
    if (
      !acceptedInputSets.some((expectedContracts) =>
        schematicStepSatisfiesInputSet(item, expectedContracts, schematic.contract_aliases),
      )
    ) {
      issues.push({
        item_id: item.id,
        message: `inputs do not satisfy block "${item.block}"; expected one of ${acceptedInputSets
          .map(formatContractSet)
          .join(' or ')}`,
      });
    }

    if (!contractIsCompatible(block.output_contract, item.output, schematic.contract_aliases)) {
      issues.push({
        item_id: item.id,
        message: `output "${item.output}" is not compatible with block output "${block.output_contract}"`,
      });
    }

    for (const requirement of block.produces_evidence) {
      if (!item.evidence_requirements.includes(requirement)) {
        issues.push({
          item_id: item.id,
          message: `evidence requirement "${requirement}" from block "${item.block}" is not declared by schematic item`,
        });
      }
    }

    const executionKinds = acceptedSchematicExecutionKindsForBlock(block);
    if (!executionKinds.includes(item.execution.kind)) {
      issues.push({
        item_id: item.id,
        message: `execution kind "${item.execution.kind}" is not compatible with block "${item.block}"; expected one of ${executionKinds.join(', ')}`,
      });
    }

    const stages = acceptedSchematicStagesForBlock(block);
    if (!stages.includes(item.stage)) {
      issues.push({
        item_id: item.id,
        message: `stage "${item.stage}" is not compatible with block "${item.block}"; expected one of ${stages.join(', ')}`,
      });
    }
  }

  const availableAt = collectRouteAwareAvailability(schematic);
  for (const item of schematic.items) {
    const availableContracts = availableAt.get(item.id);
    if (availableContracts === undefined) {
      issues.push({
        item_id: item.id,
        message: 'schematic item is unreachable from starts_at',
      });
      continue;
    }
    for (const [name, contract] of Object.entries(item.input)) {
      if (!availableContracts.has(contract)) {
        issues.push({
          item_id: item.id,
          message: `input "${name}" references unavailable contract "${contract}" on at least one reachable route`,
        });
      }
    }
  }

  return issues;
}
