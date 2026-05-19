import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type {
  BudgetPolicy,
  ComputePolicy,
  DomainSkillPolicy,
  EnforcementClass,
  MutationPolicy,
  PortableWorkIntent,
  PromptPolicy,
  RuntimeCardinalitySource,
  SafetyPolicy,
  SkillPolicy,
  WorkPolicyIndex,
  WorkPolicyIndexEntry,
  WorkUnitTemplate,
} from "./types.js";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface ParsedDefinitionFixture {
  definition: Record<string, unknown>;
  sourceDefinitionPath: string;
}

export interface DefinitionProofCompileOutput {
  humanSummary: string;
  runtimeManifest: Record<string, unknown>;
  workPolicyIndex: WorkPolicyIndex;
}

const ENFORCEMENT_CLASSES = [
  "runtime_enforced",
  "resolver_enforced",
  "adapter_enforced",
  "receipt_audited",
  "prompt_guidance",
  "prose_only",
] as const;

const WORK_PATTERN_KINDS = [
  "single",
  "static_fanout",
  "parameterized_fanout",
  "workers_adapter",
  "review_audit",
  "tournament",
] as const;

const WORK_PURPOSES = [
  "scan",
  "research",
  "code",
  "review",
  "audit",
  "decision",
  "synthesis",
  "checkpoint",
] as const;

const WORK_CONSEQUENCES = ["low", "medium", "high", "critical"] as const;
const WORK_CONTEXTS = ["local", "repo", "broad", "external"] as const;
const MUTATION_POLICIES = [
  "read_only",
  "diagnose_only",
  "safe_edit",
  "refactor",
  "migration",
] as const;
const INDEPENDENCE_POLICIES = [
  "self",
  "fresh_context",
  "adversarial",
  "ensemble",
] as const;
const LATENCY_PREFERENCES = ["fast", "balanced", "thorough"] as const;
const ROLES = ["implementer", "reviewer", "researcher", "orchestrator"] as const;
const CARDINALITY_SOURCES = [
  "definition_values",
  "sweep_type_categories",
  "artifact_table_rows",
  "plan_batches",
  "queue_batches",
  "runtime_evidence",
] as const;
const COMPLETION_KINDS = ["all", "any", "quorum"] as const;
const ON_CAP_EXCEEDED = ["checkpoint", "defer", "escalate", "clamp"] as const;
const PROVIDER_SPECIFIC_FIELDS = new Set([
  "model",
  "model_id",
  "provider",
  "provider_effort",
  "provider_model",
]);

export function parseDefinitionFixture(
  yamlText: string,
  sourceDefinitionPath: string,
): ParsedDefinitionFixture {
  const parsed = parseYaml(yamlText) as unknown;
  return {
    definition: asRecord(parsed, sourceDefinitionPath),
    sourceDefinitionPath,
  };
}

export function compileDefinitionProof(
  fixture: ParsedDefinitionFixture,
): DefinitionProofCompileOutput {
  assertNoProviderSpecificFields(fixture.definition, fixture.sourceDefinitionPath);
  requireStringValue(
    getStringFromPath(
      fixture.definition.schema_version,
      `${fixture.sourceDefinitionPath}.schema_version`,
    ),
    "3-experimental",
    `${fixture.sourceDefinitionPath}.schema_version`,
  );

  const runtimeManifest = projectRuntimeManifest(fixture.definition);
  const workPolicyIndex = buildWorkPolicyIndex(
    fixture.definition,
    fixture.sourceDefinitionPath,
  );
  const output = {
    humanSummary: "",
    runtimeManifest,
    workPolicyIndex,
  };

  return {
    ...output,
    humanSummary: renderSweepWorkPolicySummary(output),
  };
}

export function stringifyRuntimeManifest(manifest: Record<string, unknown>): string {
  return stringifyYaml(manifest);
}

export function stringifyWorkPolicyIndex(index: WorkPolicyIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

function projectRuntimeManifest(definition: Record<string, unknown>): Record<string, unknown> {
  const circuit = getRecord(definition, "circuit", "definition");
  const phases = getRecordArray(circuit, "phases", "definition.circuit");

  return {
    schema_version: "2",
    circuit: {
      id: getString(circuit, "id", "definition.circuit"),
      version: getString(circuit, "version", "definition.circuit"),
      purpose: getString(circuit, "purpose", "definition.circuit"),
      entry: projectRuntimeEntry(circuit),
      entry_modes: projectRuntimeEntryModes(circuit),
      steps: phases.map((phase) => projectRuntimeStep(circuit, phase)),
    },
  };
}

function projectRuntimeEntry(circuit: Record<string, unknown>): Record<string, unknown> {
  const entry = getRecord(circuit, "entry", "definition.circuit");
  const signals = getRecord(entry, "signals", "definition.circuit.entry");
  const projectedSignals: Record<string, unknown> = {
    include: getStringArray(signals, "include", "definition.circuit.entry.signals"),
    exclude: getOptionalStringArray(signals, "exclude") ?? [],
  };
  const projected: Record<string, unknown> = {
    signals: projectedSignals,
  };
  const usage = getOptionalString(entry, "usage");

  if (usage) {
    projected.usage = usage;
  }

  return projected;
}

function projectRuntimeEntryModes(circuit: Record<string, unknown>): Record<string, unknown> {
  const modes = getRecord(circuit, "modes", "definition.circuit");
  const projected: Record<string, unknown> = {};

  for (const [modeId, rawMode] of Object.entries(modes)) {
    const mode = asRecord(rawMode, `definition.circuit.modes.${modeId}`);
    const entryMode: Record<string, unknown> = {
      start_at: getString(mode, "starts_at", `definition.circuit.modes.${modeId}`),
      rigor: getString(mode, "rigor", `definition.circuit.modes.${modeId}`),
    };
    const description = getOptionalString(mode, "description");
    if (description) {
      entryMode.description = description;
    }

    assertModePhaseOverridesHaveEnforcement(mode, modeId);
    projected[modeId] = entryMode;
  }

  return projected;
}

function projectRuntimeStep(
  circuit: Record<string, unknown>,
  phase: Record<string, unknown>,
): Record<string, unknown> {
  const circuitId = getString(circuit, "id", "definition.circuit");
  const artifacts = getRecord(circuit, "artifacts", "definition.circuit");
  const id = getString(phase, "id", "definition.circuit.phases[]");
  const kind = oneOf(
    getString(phase, "kind", `phase ${id}`),
    ["synthesis", "checkpoint", "dispatch"] as const,
    `phase ${id}.kind`,
  );
  const step: Record<string, unknown> = {
    id,
    title: getString(phase, "title", `phase ${id}`),
    executor: kind === "dispatch" ? "worker" : "orchestrator",
    kind,
    protocol: `${circuitId}-${id}@v1`,
    reads: getStringArray(phase, "reads", `phase ${id}`).map((readRef) =>
      projectRuntimeReadRef(readRef, artifacts, `phase ${id}.reads`),
    ),
    writes: projectRuntimeWrites(phase, artifacts),
    gate: projectRuntimeGate(phase, artifacts),
    routes: getRecord(phase, "routes", `phase ${id}`),
  };

  const checkpoint = projectRuntimeCheckpoint(phase);
  if (checkpoint) {
    step.checkpoint = checkpoint;
  }

  const budgets = projectRuntimeBudgets(phase);
  if (budgets) {
    step.budgets = budgets;
  }

  return step;
}

function projectRuntimeReadRef(
  readRef: string,
  artifacts: Record<string, unknown>,
  path: string,
): string {
  if (readRef.startsWith("optional:")) {
    return `optional:${projectRuntimeReadRef(readRef.slice("optional:".length), artifacts, path)}`;
  }

  if (readRef === "user_task") {
    return "user.task";
  }
  if (readRef === "repo_snapshot") {
    return "repo.snapshot";
  }
  if (readRef.startsWith("artifacts/")) {
    return readRef;
  }

  return getArtifactPath(artifacts, readRef, path);
}

function projectRuntimeWrites(
  phase: Record<string, unknown>,
  artifacts: Record<string, unknown>,
): Record<string, unknown> {
  const id = getString(phase, "id", "definition.circuit.phases[]");
  const kind = getString(phase, "kind", `phase ${id}`);
  const writeIds = getStringArray(phase, "writes", `phase ${id}`);
  const writes: Record<string, unknown> = {};

  if (writeIds.length > 0) {
    writes.artifact = projectArtifactWrite(artifacts, writeIds[0], `phase ${id}.writes`);
  }

  if (kind === "checkpoint") {
    writes.request = checkpointRequestPath();
    writes.response = checkpointResponsePath();
  }

  if (kind === "dispatch") {
    writes.request = jobRequestPath();
    writes.receipt = jobReceiptPath();
    writes.result = jobResultPath();
  }

  return writes;
}

function projectRuntimeGate(
  phase: Record<string, unknown>,
  artifacts: Record<string, unknown>,
): Record<string, unknown> {
  const id = getString(phase, "id", "definition.circuit.phases[]");
  const kind = getString(phase, "kind", `phase ${id}`);
  const gate = getRecord(phase, "gate", `phase ${id}`);
  readEnforcement(gate, `phase ${id}.gate.enforcement`);

  if (kind === "checkpoint") {
    const checkpoint = getRecord(phase, "checkpoint", `phase ${id}`);
    return {
      kind: "checkpoint_selection",
      source: checkpointResponsePath(),
      allow: getStringArray(checkpoint, "options", `phase ${id}.checkpoint`),
    };
  }

  const gateKind = getString(gate, "kind", `phase ${id}.gate`);
  if (gateKind === "result_verdict") {
    return {
      kind: "result_verdict",
      source: jobResultPath(),
      pass: getStringArray(gate, "pass", `phase ${id}.gate`),
    };
  }

  if (gateKind === "schema_sections") {
    return {
      kind: "schema_sections",
      source: getArtifactPath(
        artifacts,
        getString(gate, "source", `phase ${id}.gate`),
        `phase ${id}.gate.source`,
      ),
      required: getStringArray(gate, "required_sections", `phase ${id}.gate`),
    };
  }

  throw new Error(`definition-ir: unsupported gate kind at phase ${id}.gate.kind`);
}

function projectRuntimeCheckpoint(
  phase: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const id = getString(phase, "id", "definition.circuit.phases[]");
  if (getString(phase, "kind", `phase ${id}`) !== "checkpoint") {
    return undefined;
  }

  const checkpoint = getRecord(phase, "checkpoint", `phase ${id}`);
  const projected: Record<string, unknown> = {
    kind: getString(checkpoint, "kind", `phase ${id}.checkpoint`),
    options: getStringArray(checkpoint, "options", `phase ${id}.checkpoint`),
  };

  const materializeArtifact = checkpoint.materialize_artifact;
  if (typeof materializeArtifact === "boolean") {
    projected.materialize_artifact = materializeArtifact;
  }

  const askPolicy = maybeRecord(checkpoint.ask_policy);
  if (askPolicy) {
    readEnforcement(askPolicy, `phase ${id}.checkpoint.ask_policy.enforcement`);
  }

  return projected;
}

function projectRuntimeBudgets(
  phase: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const id = getString(phase, "id", "definition.circuit.phases[]");
  const work = maybeRecord(phase.work);
  if (!work || getString(work, "pattern", `phase ${id}.work`) !== "workers_adapter") {
    return undefined;
  }

  const parentUnit = getRecord(work, "parent_unit", `phase ${id}.work`);
  const budget = maybeRecord(parentUnit.budget);
  if (!budget) {
    return undefined;
  }

  const projected: Record<string, unknown> = {};
  const maxAttempts = getOptionalInteger(budget, "max_attempts");
  const timeoutSeconds = getOptionalInteger(budget, "timeout_seconds");
  if (maxAttempts != null) {
    projected.max_attempts = maxAttempts;
  }
  if (timeoutSeconds != null) {
    projected.timeout_seconds = timeoutSeconds;
  }

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function buildWorkPolicyIndex(
  definition: Record<string, unknown>,
  sourceDefinitionPath: string,
): WorkPolicyIndex {
  const circuit = getRecord(definition, "circuit", "definition");
  const phases = getRecordArray(circuit, "phases", "definition.circuit");
  const entries: WorkPolicyIndexEntry[] = [];

  for (const phase of phases) {
    const id = getString(phase, "id", "definition.circuit.phases[]");
    const work = maybeRecord(phase.work);
    if (!work) {
      continue;
    }

    entries.push(buildWorkPolicyIndexEntry(id, work));
  }

  return {
    schemaVersion: "1",
    sourceDefinitionPath,
    entries,
  };
}

function buildWorkPolicyIndexEntry(
  phaseId: string,
  work: Record<string, unknown>,
): WorkPolicyIndexEntry {
  const pattern = oneOf(
    getString(work, "pattern", `phase ${phaseId}.work`),
    WORK_PATTERN_KINDS,
    `phase ${phaseId}.work.pattern`,
  );

  if (pattern === "parameterized_fanout") {
    const unit = toWorkUnitTemplate(
      getRecord(work, "unit_template", `phase ${phaseId}.work`),
      `phase ${phaseId}.work.unit_template`,
    );
    const cardinality = toRuntimeCardinality(
      getRecord(work, "cardinality", `phase ${phaseId}.work`),
      `phase ${phaseId}.work.cardinality`,
    );
    readCompletionPolicy(work, phaseId);

    return {
      phaseId,
      workPattern: pattern,
      staticTemplates: [unit],
      runtimeCardinality: cardinality,
      policyProfile: unit.compute?.defaultProfile,
      enforcement: cardinality.enforcement,
    };
  }

  if (pattern === "workers_adapter") {
    requireStringValue(
      getString(work, "adapter", `phase ${phaseId}.work`),
      "workers",
      `phase ${phaseId}.work.adapter`,
    );
    const unit = toWorkUnitTemplate(
      getRecord(work, "parent_unit", `phase ${phaseId}.work`),
      `phase ${phaseId}.work.parent_unit`,
    );
    const cardinality = toRuntimeCardinality(
      getRecord(work, "child_cardinality", `phase ${phaseId}.work`),
      `phase ${phaseId}.work.child_cardinality`,
    );

    return {
      phaseId,
      workPattern: pattern,
      staticTemplates: [unit],
      runtimeCardinality: cardinality,
      policyProfile: unit.compute?.defaultProfile,
      enforcement: cardinality.enforcement,
    };
  }

  if (pattern === "review_audit") {
    requireBooleanValue(work.diagnose_only, true, `phase ${phaseId}.work.diagnose_only`);
    requireBooleanValue(work.fresh_context, true, `phase ${phaseId}.work.fresh_context`);
    const unit = toWorkUnitTemplate(
      getRecord(work, "unit", `phase ${phaseId}.work`),
      `phase ${phaseId}.work.unit`,
    );

    return {
      phaseId,
      workPattern: pattern,
      staticTemplates: [unit],
      policyProfile: unit.compute?.defaultProfile,
      enforcement: readEnforcement(work, `phase ${phaseId}.work.enforcement`),
    };
  }

  throw new Error(`definition-ir: unsupported work pattern at phase ${phaseId}.work.pattern`);
}

function toWorkUnitTemplate(
  unit: Record<string, unknown>,
  path: string,
): WorkUnitTemplate {
  const template: WorkUnitTemplate = {
    id: getString(unit, "id", path),
    role: oneOf(getString(unit, "role", path), ROLES, `${path}.role`),
    intent: toPortableWorkIntent(getRecord(unit, "intent", path), `${path}.intent`),
    outputs: toWorkUnitOutputs(getRecord(unit, "outputs", path), `${path}.outputs`),
    ...optionalTemplateFields(unit, path),
  };

  return template;
}

function optionalTemplateFields(
  unit: Record<string, unknown>,
  path: string,
): Partial<Mutable<Omit<WorkUnitTemplate, "id" | "role" | "intent" | "outputs">>> {
  const fields: Partial<
    Mutable<Omit<WorkUnitTemplate, "id" | "role" | "intent" | "outputs">>
  > = {};
  const idTemplate = getOptionalString(unit, "id_template");
  const skills = maybeRecord(unit.skills);
  const prompt = maybeRecord(unit.prompt);
  const compute = maybeRecord(unit.compute);
  const budget = maybeRecord(unit.budget);
  const safety = maybeRecord(unit.safety);
  const outputContract = getOptionalString(unit, "output_contract");
  const receiptContract = getOptionalString(unit, "receipt_contract");
  const proseAnchor = getOptionalString(unit, "prose_anchor");

  if (idTemplate) {
    fields.idTemplate = idTemplate;
  }
  if (skills) {
    fields.skills = toSkillPolicy(skills, `${path}.skills`);
  }
  if (prompt) {
    fields.prompt = toPromptPolicy(prompt, `${path}.prompt`);
  }
  if (compute) {
    fields.compute = toComputePolicy(compute, `${path}.compute`);
  }
  if (budget) {
    fields.budget = toBudgetPolicy(budget, `${path}.budget`);
  }
  if (safety) {
    fields.safety = toSafetyPolicy(safety, `${path}.safety`);
  }
  if (outputContract) {
    fields.outputContract = outputContract;
  }
  if (receiptContract) {
    fields.receiptContract = receiptContract;
  }
  if (proseAnchor) {
    fields.proseAnchor = proseAnchor;
  }

  return fields;
}

function toPortableWorkIntent(
  intent: Record<string, unknown>,
  path: string,
): PortableWorkIntent {
  const projected: PortableWorkIntent = {
    purpose: oneOf(getString(intent, "purpose", path), WORK_PURPOSES, `${path}.purpose`),
    consequence: oneOf(
      getString(intent, "consequence", path),
      WORK_CONSEQUENCES,
      `${path}.consequence`,
    ),
    context: oneOf(getString(intent, "context", path), WORK_CONTEXTS, `${path}.context`),
    mutation: oneOf(
      getString(intent, "mutation", path),
      MUTATION_POLICIES,
      `${path}.mutation`,
    ),
    ...optionalIntentFields(intent, path),
  };

  return projected;
}

function optionalIntentFields(
  intent: Record<string, unknown>,
  path: string,
): Partial<Mutable<PortableWorkIntent>> {
  const fields: Partial<Mutable<PortableWorkIntent>> = {};
  const independence = getOptionalString(intent, "independence");
  const latency = getOptionalString(intent, "latency");

  if (independence) {
    fields.independence = oneOf(
      independence,
      INDEPENDENCE_POLICIES,
      `${path}.independence`,
    );
  }
  if (latency) {
    fields.latency = oneOf(latency, LATENCY_PREFERENCES, `${path}.latency`);
  }

  return fields;
}

function toWorkUnitOutputs(
  outputs: Record<string, unknown>,
  path: string,
): WorkUnitTemplate["outputs"] {
  const projected: Mutable<WorkUnitTemplate["outputs"]> = {};
  const artifact = getOptionalString(outputs, "artifact");
  const report = getOptionalString(outputs, "report");
  const result = getOptionalString(outputs, "result");

  if (artifact) {
    projected.artifact = artifact;
  }
  if (report) {
    projected.report = report;
  }
  if (result) {
    projected.result = result;
  }

  if (Object.keys(projected).length === 0) {
    throw new Error(`definition-ir: ${path} must declare at least one output`);
  }

  return projected;
}

function toSkillPolicy(skills: Record<string, unknown>, path: string): SkillPolicy {
  const policy: SkillPolicy = {
    ...optionalSkillPolicyFields(skills, path),
    enforcement: readEnforcement(skills, `${path}.enforcement`),
  };

  return policy;
}

function optionalSkillPolicyFields(
  skills: Record<string, unknown>,
  path: string,
): Partial<Mutable<Omit<SkillPolicy, "enforcement">>> {
  const fields: Partial<Mutable<Omit<SkillPolicy, "enforcement">>> = {};
  const max = getOptionalInteger(skills, "max");
  const required = getOptionalStringArray(skills, "required");
  const suggested = getOptionalStringArray(skills, "suggested");
  const forbidden = getOptionalStringArray(skills, "forbidden");
  const missingOptional = getOptionalString(skills, "missing_optional");
  const domain = maybeRecord(skills.domain);

  if (max != null) {
    fields.max = max;
  }
  if (required) {
    fields.required = required;
  }
  if (suggested) {
    fields.suggested = suggested;
  }
  if (forbidden) {
    fields.forbidden = forbidden;
  }
  if (missingOptional) {
    fields.missingOptional = oneOf(
      missingOptional,
      ["omit_with_warning", "escalate"] as const,
      `${path}.missing_optional`,
    );
  }
  if (domain) {
    fields.domain = toDomainSkillPolicy(domain, `${path}.domain`);
  }

  return fields;
}

function toDomainSkillPolicy(domain: Record<string, unknown>, path: string): DomainSkillPolicy {
  const kind = oneOf(
    getString(domain, "kind", path),
    ["none", "select_up_to", "project_config_only"] as const,
    `${path}.kind`,
  );

  if (kind === "none") {
    return { kind };
  }

  const max = getOptionalInteger(domain, "max");
  if (kind === "select_up_to") {
    if (max == null) {
      throw new Error(`definition-ir: ${path}.max is required for select_up_to`);
    }
    return { kind, max };
  }

  return max == null ? { kind } : { kind, max };
}

function toPromptPolicy(prompt: Record<string, unknown>, path: string): PromptPolicy {
  const policy: PromptPolicy = {
    template: getString(prompt, "template", path),
    enforcement: readEnforcement(prompt, `${path}.enforcement`),
    ...optionalPromptPolicyFields(prompt),
  };

  return policy;
}

function optionalPromptPolicyFields(prompt: Record<string, unknown>): Omit<
  Mutable<PromptPolicy>,
  "template" | "enforcement"
> {
  const fields: Omit<Mutable<PromptPolicy>, "template" | "enforcement"> = {};
  const headerContract = getOptionalString(prompt, "header_contract");
  const includeArtifacts = getOptionalStringArray(prompt, "include_artifacts");
  const outputContract = getOptionalString(prompt, "output_contract");

  if (headerContract) {
    fields.headerContract = headerContract;
  }
  if (includeArtifacts) {
    fields.includeArtifacts = includeArtifacts;
  }
  if (outputContract) {
    fields.outputContract = outputContract;
  }

  return fields;
}

function toComputePolicy(compute: Record<string, unknown>, path: string): ComputePolicy {
  return {
    defaultProfile: getString(compute, "default_profile", path),
    floorProfile: getString(compute, "floor_profile", path),
    allowedProfiles: getStringArray(compute, "allowed_profiles", path),
    allowEnsemble: getOptionalBoolean(compute, "allow_ensemble"),
    enforcement: readEnforcement(compute, `${path}.enforcement`),
  };
}

function toBudgetPolicy(budget: Record<string, unknown>, path: string): BudgetPolicy {
  const policy: BudgetPolicy = {
    ...optionalBudgetFields(budget, path),
    enforcement: readEnforcement(budget, `${path}.enforcement`),
  };

  return policy;
}

function optionalBudgetFields(
  budget: Record<string, unknown>,
  path: string,
): Partial<Mutable<Omit<BudgetPolicy, "enforcement">>> {
  const fields: Partial<Mutable<Omit<BudgetPolicy, "enforcement">>> = {};
  const integerFields = [
    ["max_attempts", "maxAttempts"],
    ["max_parallel", "maxParallel"],
    ["max_rounds", "maxRounds"],
    ["max_child_dispatches", "maxChildDispatches"],
    ["max_batches", "maxBatches"],
    ["max_premium_dispatches", "maxPremiumDispatches"],
    ["timeout_seconds", "timeoutSeconds"],
  ] as const;
  const onCapExceeded = getOptionalString(budget, "on_cap_exceeded");

  for (const [sourceKey, targetKey] of integerFields) {
    const value = getOptionalInteger(budget, sourceKey);
    if (value != null) {
      fields[targetKey] = value;
    }
  }

  if (onCapExceeded) {
    fields.onCapExceeded = oneOf(onCapExceeded, ON_CAP_EXCEEDED, `${path}.on_cap_exceeded`);
  }

  return fields;
}

function toSafetyPolicy(safety: Record<string, unknown>, path: string): SafetyPolicy {
  const policy: SafetyPolicy = {
    mutation: oneOf(
      getString(safety, "mutation", path),
      MUTATION_POLICIES,
      `${path}.mutation`,
    ) as MutationPolicy,
    enforcement: readEnforcement(safety, `${path}.enforcement`),
    ...optionalSafetyFields(safety),
  };

  return policy;
}

function optionalSafetyFields(safety: Record<string, unknown>): Omit<
  Mutable<SafetyPolicy>,
  "mutation" | "enforcement"
> {
  const fields: Omit<Mutable<SafetyPolicy>, "mutation" | "enforcement"> = {};
  const allowedPaths = getOptionalStringArray(safety, "allowed_paths");
  const requireFreshContext = getOptionalBoolean(safety, "require_fresh_context");
  const independentFrom = getOptionalStringArray(safety, "independent_from");
  const checkpointOn = getOptionalStringArray(safety, "checkpoint_on");

  if (allowedPaths) {
    fields.allowedPaths = allowedPaths;
  }
  if (requireFreshContext != null) {
    fields.requireFreshContext = requireFreshContext;
  }
  if (independentFrom) {
    fields.independentFrom = independentFrom;
  }
  if (checkpointOn) {
    fields.checkpointOn = checkpointOn;
  }

  return fields;
}

function toRuntimeCardinality(
  cardinality: Record<string, unknown>,
  path: string,
): RuntimeCardinalitySource {
  const source = oneOf(
    getString(cardinality, "source", path),
    CARDINALITY_SOURCES,
    `${path}.source`,
  );
  const projected: Mutable<RuntimeCardinalitySource> = {
    source,
    enforcement: readEnforcement(cardinality, `${path}.enforcement`),
  };
  const values = getOptionalStringArray(cardinality, "values");
  const max = getOptionalInteger(cardinality, "max");

  if (values) {
    projected.values = values;
  }
  if (max != null) {
    projected.max = max;
  }

  return projected;
}

function readCompletionPolicy(work: Record<string, unknown>, phaseId: string): void {
  const rawCompletion = work.completion;
  const path = `phase ${phaseId}.work.completion`;
  if (typeof rawCompletion === "string") {
    oneOf(rawCompletion, COMPLETION_KINDS, path);
    return;
  }

  const completion = asRecord(rawCompletion, path);
  oneOf(getString(completion, "kind", path), COMPLETION_KINDS, `${path}.kind`);
}

function assertModePhaseOverridesHaveEnforcement(
  mode: Record<string, unknown>,
  modeId: string,
): void {
  const phaseOverrides = maybeRecord(mode.phase_overrides);
  if (!phaseOverrides) {
    return;
  }

  for (const [phaseId, rawOverride] of Object.entries(phaseOverrides)) {
    const override = asRecord(rawOverride, `mode ${modeId}.phase_overrides.${phaseId}`);
    readEnforcement(
      override,
      `mode ${modeId}.phase_overrides.${phaseId}.enforcement`,
    );
    const stopAfter = maybeRecord(override.stop_after);
    if (stopAfter) {
      readEnforcement(
        stopAfter,
        `mode ${modeId}.phase_overrides.${phaseId}.stop_after.enforcement`,
      );
    }
  }
}

function readEnforcement(
  record: Record<string, unknown>,
  path: string,
): EnforcementClass {
  return oneOf(
    getStringFromPath(record.enforcement, path),
    ENFORCEMENT_CLASSES,
    path,
  );
}

function projectArtifactWrite(
  artifacts: Record<string, unknown>,
  artifactId: string,
  path: string,
): Record<string, unknown> {
  const artifact = getRecordValue(artifacts, artifactId, `${path}.${artifactId}`);
  const write: Record<string, unknown> = {
    path: getString(artifact, "path", `${path}.${artifactId}`),
  };
  const schema = getOptionalString(artifact, "schema");

  if (schema) {
    write.schema = schema;
  }

  return write;
}

function getArtifactPath(
  artifacts: Record<string, unknown>,
  artifactId: string,
  path: string,
): string {
  return getString(
    getRecordValue(artifacts, artifactId, `${path}.${artifactId}`),
    "path",
    `${path}.${artifactId}`,
  );
}

function checkpointRequestPath(): string {
  return "checkpoints/{step_id}-{attempt}.request.json";
}

function checkpointResponsePath(): string {
  return "checkpoints/{step_id}-{attempt}.response.json";
}

function jobRequestPath(): string {
  return "jobs/{step_id}-{attempt}.request.json";
}

function jobReceiptPath(): string {
  return "jobs/{step_id}-{attempt}.receipt.json";
}

function jobResultPath(): string {
  return "jobs/{step_id}-{attempt}.result.json";
}

export function renderSweepWorkPolicySummary(
  output: Pick<DefinitionProofCompileOutput, "runtimeManifest" | "workPolicyIndex">,
): string {
  const circuit = asRecord(output.runtimeManifest.circuit, "runtimeManifest.circuit");
  const steps = circuit.steps as Record<string, unknown>[];
  const graph = steps.map((step) => step.id).join(" -> ");
  const profileLines = collectAllowedProfiles(output.workPolicyIndex)
    .map((profile) => `- \`${profile}\``)
    .join("\n");
  const projectionRows = steps
    .map((step) => `| ${step.id} | ${step.id} | ${projectionLabel(step)} |`)
    .join("\n");

  return [
    "# Sweep V3 Work Policy Summary",
    "",
    "Status: generated-view target, hand-authored for the proof slice  ",
    `Source fixture: \`${output.workPolicyIndex.sourceDefinitionPath}\``,
    "",
    "## Purpose",
    "",
    "This is the human review view the v3 compiler should eventually generate from a",
    "Sweep definition. If this view is not easier to review than the current",
    "`circuit.yaml` plus hidden `SKILL.md` policy, the work-pattern direction should",
    "pause.",
    "",
    "## Outer Runtime Graph",
    "",
    "The first proof keeps the current v2 outer graph:",
    "",
    "```text",
    graph,
    "```",
    "",
    "Dynamic child work remains receipt-visible first. The runtime core should not",
    "need to understand survey categories, PROVE rows, or queue batches in the first",
    "v3 slice.",
    "",
    "## Dynamic Work",
    "",
    "| Pattern | Parent Phase | Instances | Mutation | Profile Floor | Cap / Completion | Enforcement |",
    "|---------|--------------|-----------|----------|---------------|------------------|-------------|",
    ...output.workPolicyIndex.entries.map(renderDynamicWorkRow),
    "",
    "## Mode Differences",
    "",
    "| Mode | Difference |",
    "|------|------------|",
    "| Lite | Survey is inline/high-confidence only; triage should only pass high-confidence low-risk work. |",
    "| Standard | Category fanout survey, PROVE as needed, sequential batches, independent audit during Verify. |",
    "| Deep | Stronger PROVE expectation; confirm every batch; prefer deferral over risky removal. |",
    "| Autonomous | Auto-approve by confidence x risk table, max 3 execute batches, include injection check, log decisions to deferred output. |",
    "",
    "## Safety Review",
    "",
    "| Phase | Mutates Source? | Guardrail |",
    "|-------|-----------------|-----------|",
    "| survey | No | Category workers are read-only scans. |",
    "| triage | No | PROVE workers audit evidence only. |",
    "| execute | Yes | Uses `workers` adapter; checkpoint/pause guidance on public APIs, FFI, published packages, destructive cleanup. |",
    "| verify | No | Diagnose-only audit in a fresh context; Autonomous adds injection check. |",
    "",
    "## Policy Boundaries",
    "",
    "Provider model IDs do not appear in the fixture. The definition uses logical",
    "profiles:",
    "",
    profileLines,
    "",
    "Local config/adapters bind those profile names to concrete providers, models,",
    "effort flags, and commands.",
    "",
    "## Prose-Owned Judgment",
    "",
    "These remain owned by `skills/sweep/SKILL.md`:",
    "",
    "- how to classify confidence and risk",
    "- how to decide whether a PROVE item is confirmed or KEEP",
    "- how to batch items by blast radius",
    "- how to interpret ambiguous injection findings",
    "- how to prioritize deferred follow-up items",
    "",
    "The fixture structures the machine-significant controls around that judgment:",
    "fanout shape, mutation policy, prompt/template intent, skill budget, logical",
    "compute floors, batch caps, and receipt expectations.",
    "",
    "## Projection Check",
    "",
    "The proof succeeds only if a compiler can project the fixture to the current v2",
    "manifest shape without runtime-core changes:",
    "",
    "| V3 Phase | Current v2 Step | Projection |",
    "|----------|-----------------|------------|",
    projectionRows,
    "",
    "The `work-policy.index.json` projection should carry work patterns and policy",
    "templates. It should not change canonical runtime events.",
    "",
  ].join("\n");
}

function renderDynamicWorkRow(entry: WorkPolicyIndexEntry): string {
  const template = entry.staticTemplates[0];
  if (!template) {
    throw new Error(`definition-ir: policy entry ${entry.phaseId} has no template`);
  }

  return `| \`${template.id}\` | ${entry.phaseId} | ${dynamicInstancesText(entry)} | ${template.intent.mutation} | \`${template.compute?.floorProfile ?? ""}\` | ${dynamicCapText(entry)} | ${dynamicEnforcementText(entry)} |`;
}

function dynamicInstancesText(entry: WorkPolicyIndexEntry): string {
  const templateId = entry.staticTemplates[0]?.id;
  if (templateId === "survey-category") {
    return "selected categories from sweep type";
  }
  if (templateId === "prove-item") {
    return "`queue.md` rows marked PROVE";
  }
  if (templateId === "execute-batches") {
    return "queue batch assignments";
  }
  if (templateId === "sweep-independent-audit") {
    return "one fresh-context audit";
  }

  return entry.runtimeCardinality?.source ?? "static";
}

function dynamicCapText(entry: WorkPolicyIndexEntry): string {
  const template = entry.staticTemplates[0];
  if (template?.id === "execute-batches") {
    return `sequential workers loop, max ${template.budget?.maxAttempts ?? ""} attempts`;
  }
  if (template?.id === "sweep-independent-audit") {
    return `all complete, max ${template.budget?.maxAttempts ?? ""} attempts later`;
  }

  const max = entry.runtimeCardinality?.max;
  return max == null ? "all complete" : `max ${max}, all complete`;
}

function dynamicEnforcementText(entry: WorkPolicyIndexEntry): string {
  const templateId = entry.staticTemplates[0]?.id;
  if (templateId === "survey-category") {
    return "resolver + receipt";
  }
  if (templateId === "prove-item") {
    return "receipt audited first";
  }
  if (templateId === "execute-batches") {
    return "adapter + runtime gate";
  }
  if (templateId === "sweep-independent-audit") {
    return "resolver + runtime gate";
  }

  return entry.enforcement;
}

function collectAllowedProfiles(output: WorkPolicyIndex): string[] {
  const profiles: string[] = [];

  for (const entry of output.entries) {
    for (const template of entry.staticTemplates) {
      for (const profile of template.compute?.allowedProfiles ?? []) {
        if (!profiles.includes(profile)) {
          profiles.push(profile);
        }
      }
    }
  }

  return profiles;
}

function projectionLabel(step: Record<string, unknown>): string {
  const kind = step.kind;
  if (kind === "checkpoint") {
    return "checkpoint step";
  }
  if (kind === "dispatch") {
    return "dispatch step";
  }
  return "synthesis step";
}

function assertNoProviderSpecificFields(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProviderSpecificFields(item, `${path}[${index}]`));
    return;
  }

  const record = maybeRecord(value);
  if (!record) {
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    const childPath = `${path}.${key}`;
    if (PROVIDER_SPECIFIC_FIELDS.has(key)) {
      throw new Error(`definition-ir: provider-specific field at ${childPath}`);
    }
    assertNoProviderSpecificFields(child, childPath);
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`definition-ir: ${path} must be a mapping`);
  }

  return value as Record<string, unknown>;
}

function maybeRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function getRecord(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> {
  return asRecord(record[key], `${path}.${key}`);
}

function getRecordValue(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> {
  return asRecord(record[key], path);
}

function getRecordArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown>[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`definition-ir: ${path}.${key} must be an array`);
  }

  return value.map((item, index) => asRecord(item, `${path}.${key}[${index}]`));
}

function getString(record: Record<string, unknown>, key: string, path: string): string {
  return getStringFromPath(record[key], `${path}.${key}`);
}

function getStringFromPath(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`definition-ir: ${path} must be a non-empty string`);
  }

  return value;
}

function getOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`definition-ir: ${key} must be a non-empty string when present`);
  }

  return value;
}

function getStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`definition-ir: ${path}.${key} must be a string array`);
  }

  return [...value] as string[];
}

function getOptionalStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = record[key];
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`definition-ir: ${key} must be a string array when present`);
  }

  return [...value] as string[];
}

function getOptionalInteger(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  if (value == null) {
    return undefined;
  }
  if (!Number.isInteger(value)) {
    throw new Error(`definition-ir: ${key} must be an integer when present`);
  }

  return value as number;
}

function getOptionalBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = record[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`definition-ir: ${key} must be boolean when present`);
  }

  return value;
}

function requireStringValue(actual: string, expected: string, path: string): void {
  if (actual !== expected) {
    throw new Error(`definition-ir: ${path} must be ${expected}`);
  }
}

function requireBooleanValue(actual: unknown, expected: boolean, path: string): void {
  if (actual !== expected) {
    throw new Error(`definition-ir: ${path} must be ${String(expected)}`);
  }
}

function oneOf<const T extends readonly string[]>(
  value: string,
  allowed: T,
  path: string,
): T[number] {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(
      `definition-ir: ${path} must be one of ${allowed.join(", ")}`,
    );
  }

  return value as T[number];
}
