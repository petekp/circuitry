export type CircuitDefinitionSchemaVersion = "3-experimental";
export type RuntimeManifestSchemaVersion = "2";

export type DefinitionId = string;
export type ArtifactId = string;
export type PhaseId = string;
export type WorkUnitTemplateId = string;
export type WorkUnitIdTemplate = string;
export type PolicyProfileId = string;
export type PromptTemplateId = string;
export type ContractId = string;
export type SafeDefinitionPath = string;
export type SafeRuntimeRelativePath = string;

export type EnforcementClass =
  | "runtime_enforced"
  | "resolver_enforced"
  | "adapter_enforced"
  | "receipt_audited"
  | "prompt_guidance"
  | "prose_only";

export type WorkPurpose =
  | "scan"
  | "research"
  | "code"
  | "review"
  | "audit"
  | "decision"
  | "synthesis"
  | "checkpoint";

export type WorkConsequence = "low" | "medium" | "high" | "critical";
export type WorkContextWidth = "local" | "repo" | "broad" | "external";
export type MutationPolicy =
  | "read_only"
  | "diagnose_only"
  | "safe_edit"
  | "refactor"
  | "migration";
export type IndependencePolicy =
  | "self"
  | "fresh_context"
  | "adversarial"
  | "ensemble";
export type LatencyPreference = "fast" | "balanced" | "thorough";

export interface PortableWorkIntent {
  readonly purpose: WorkPurpose;
  readonly consequence: WorkConsequence;
  readonly context: WorkContextWidth;
  readonly mutation: MutationPolicy;
  readonly independence?: IndependencePolicy;
  readonly latency?: LatencyPreference;
}

export type DomainSkillPolicy =
  | { readonly kind: "none" }
  | { readonly kind: "select_up_to"; readonly max: number }
  | { readonly kind: "project_config_only"; readonly max?: number };

export interface SkillPolicy {
  readonly max?: number;
  readonly required?: readonly string[];
  readonly suggested?: readonly string[];
  readonly domain?: DomainSkillPolicy;
  readonly forbidden?: readonly string[];
  readonly missingOptional?: "omit_with_warning" | "escalate";
  readonly enforcement: EnforcementClass;
}

export interface PromptPolicy {
  readonly template: PromptTemplateId;
  readonly headerContract?: ContractId;
  readonly includeArtifacts?: readonly ArtifactId[];
  readonly outputContract?: ContractId;
  readonly enforcement: EnforcementClass;
}

export interface ComputePolicy {
  readonly defaultProfile: PolicyProfileId;
  readonly floorProfile: PolicyProfileId;
  readonly allowedProfiles: readonly PolicyProfileId[];
  readonly allowEnsemble?: boolean;
  readonly enforcement: EnforcementClass;
}

export interface BudgetPolicy {
  readonly maxAttempts?: number;
  readonly maxParallel?: number;
  readonly maxRounds?: number;
  readonly maxChildDispatches?: number;
  readonly maxBatches?: number;
  readonly maxPremiumDispatches?: number;
  readonly timeoutSeconds?: number;
  readonly onCapExceeded?: "checkpoint" | "defer" | "escalate" | "clamp";
  readonly enforcement: EnforcementClass;
}

export interface SafetyPolicy {
  readonly mutation: MutationPolicy;
  readonly allowedPaths?: readonly SafeRuntimeRelativePath[];
  readonly requireFreshContext?: boolean;
  readonly independentFrom?: readonly WorkUnitTemplateId[];
  readonly checkpointOn?: readonly string[];
  readonly enforcement: EnforcementClass;
}

export interface WorkUnitOutputs {
  readonly artifact?: ArtifactId;
  readonly report?: SafeRuntimeRelativePath;
  readonly result?: SafeRuntimeRelativePath;
}

export interface WorkUnitTemplate {
  readonly id: WorkUnitTemplateId;
  readonly idTemplate?: WorkUnitIdTemplate;
  readonly role: "implementer" | "reviewer" | "researcher" | "orchestrator";
  readonly intent: PortableWorkIntent;
  readonly outputs: WorkUnitOutputs;
  readonly skills?: SkillPolicy;
  readonly prompt?: PromptPolicy;
  readonly compute?: ComputePolicy;
  readonly budget?: BudgetPolicy;
  readonly safety?: SafetyPolicy;
  readonly outputContract?: ContractId;
  readonly receiptContract?: ContractId;
  readonly proseAnchor?: SafeDefinitionPath;
}

export type WorkCompletionPolicy =
  | { readonly kind: "all" }
  | { readonly kind: "any" }
  | { readonly kind: "quorum"; readonly minimum: number };

export interface RuntimeCardinalitySource {
  readonly source:
    | "definition_values"
    | "sweep_type_categories"
    | "artifact_table_rows"
    | "plan_batches"
    | "queue_batches"
    | "runtime_evidence";
  readonly values?: readonly string[];
  readonly max?: number;
  readonly enforcement: EnforcementClass;
}

export interface SingleWorkPattern {
  readonly pattern: "single";
  readonly unit: WorkUnitTemplate;
}

export interface StaticFanoutWorkPattern {
  readonly pattern: "static_fanout";
  readonly units: readonly WorkUnitTemplate[];
  readonly completion: WorkCompletionPolicy;
  readonly budget?: BudgetPolicy;
}

export interface ParameterizedFanoutWorkPattern {
  readonly pattern: "parameterized_fanout";
  readonly unitTemplate: WorkUnitTemplate;
  readonly cardinality: RuntimeCardinalitySource;
  readonly completion: WorkCompletionPolicy;
  readonly budget?: BudgetPolicy;
}

export interface WorkersAdapterWorkPattern {
  readonly pattern: "workers_adapter";
  readonly parentUnit: WorkUnitTemplate;
  readonly adapter: "workers";
  readonly childCardinality: RuntimeCardinalitySource;
  readonly parentReadableOutputs: readonly SafeRuntimeRelativePath[];
  readonly ownsInnerLoop: true;
  readonly budget?: BudgetPolicy;
}

export interface ReviewAuditWorkPattern {
  readonly pattern: "review_audit";
  readonly unit: WorkUnitTemplate;
  readonly diagnoseOnly: true;
  readonly freshContext: true;
  readonly enforcement: EnforcementClass;
}

export interface TournamentRoundTemplate {
  readonly id: DefinitionId;
  readonly units: readonly WorkUnitTemplate[];
  readonly completion: WorkCompletionPolicy;
  readonly maxParallel?: number;
}

export interface TournamentWorkPattern {
  readonly pattern: "tournament";
  readonly rounds: readonly TournamentRoundTemplate[];
  readonly convergence: WorkUnitTemplate;
  readonly preMortem?: WorkUnitTemplate;
  readonly checkpointAfterConvergence?: DefinitionId;
  readonly budget: BudgetPolicy & {
    readonly maxRounds: number;
    readonly maxChildDispatches: number;
  };
}

export type WorkPattern =
  | SingleWorkPattern
  | StaticFanoutWorkPattern
  | ParameterizedFanoutWorkPattern
  | WorkersAdapterWorkPattern
  | ReviewAuditWorkPattern
  | TournamentWorkPattern;

export interface ArtifactDefinition {
  readonly path: SafeRuntimeRelativePath;
  readonly schema?: ContractId;
  readonly public?: boolean;
  readonly optionalInModes?: readonly DefinitionId[];
}

export interface GateDefinition {
  readonly kind:
    | "schema_sections"
    | "all_outputs_present"
    | "checkpoint_selection"
    | "result_verdict"
    | "semantic_review";
  readonly source?: ArtifactId;
  readonly pass?: readonly string[];
  readonly requiredSections?: readonly string[];
  readonly enforcement: EnforcementClass;
}

export interface PhaseDefinition {
  readonly id: PhaseId;
  readonly title: string;
  readonly purpose: string;
  readonly kind: "synthesis" | "checkpoint" | "dispatch";
  readonly reads?: readonly ArtifactId[];
  readonly writes?: readonly ArtifactId[];
  readonly work?: WorkPattern;
  readonly gate?: GateDefinition;
  readonly routes: Readonly<Record<string, PhaseId | "@complete" | "@stop" | "@escalate" | "@handoff">>;
}

export type ModePhaseBehavior =
  | "run"
  | "skip"
  | "inline"
  | "defer"
  | "require_confirmation"
  | "auto_continue";

export interface ModePhaseOverride {
  readonly behavior: ModePhaseBehavior;
  readonly workPattern?: WorkPattern["pattern"];
  readonly evidenceFloor?: "high_confidence_only" | "prove_before_act" | "standard";
  readonly checkpointPolicy?: "ask" | "auto_continue" | "hold_for_tradeoff";
  readonly stopAfter?: BudgetPolicy;
  readonly enforcement: EnforcementClass;
  readonly note?: string;
}

export interface ModeDefinition {
  readonly rigor: "Lite" | "Standard" | "Deep" | "Tournament" | "Autonomous";
  readonly startsAt: PhaseId;
  readonly default?: boolean;
  readonly description?: string;
  readonly phaseOverrides?: Readonly<Record<PhaseId, ModePhaseOverride>>;
  readonly budget?: BudgetPolicy;
}

export interface CircuitEntryDefinition {
  readonly usage?: string;
  readonly signals: {
    readonly include: readonly string[];
    readonly exclude?: readonly string[];
  };
}

export interface CircuitDefinition {
  readonly schemaVersion: CircuitDefinitionSchemaVersion;
  readonly circuit: {
    readonly id: DefinitionId;
    readonly version: string;
    readonly purpose: string;
    readonly entry: CircuitEntryDefinition;
    readonly artifacts: Readonly<Record<ArtifactId, ArtifactDefinition>>;
    readonly modes: Readonly<Record<DefinitionId, ModeDefinition>>;
    readonly phases: readonly PhaseDefinition[];
  };
}

export interface RuntimeManifestCompileTarget {
  readonly schemaVersion: RuntimeManifestSchemaVersion;
  readonly path: SafeRuntimeRelativePath;
  readonly sourceDefinitionPath: SafeDefinitionPath;
}

export interface WorkPolicyIndexEntry {
  readonly phaseId: PhaseId;
  readonly workPattern: WorkPattern["pattern"];
  readonly staticTemplates: readonly WorkUnitTemplate[];
  readonly runtimeCardinality?: RuntimeCardinalitySource;
  readonly policyProfile?: PolicyProfileId;
  readonly enforcement: EnforcementClass;
}

export interface WorkPolicyIndex {
  readonly schemaVersion: "1";
  readonly sourceDefinitionPath: SafeDefinitionPath;
  readonly entries: readonly WorkPolicyIndexEntry[];
}

export interface DefinitionCompileOutput {
  readonly runtimeManifest: RuntimeManifestCompileTarget;
  readonly workPolicyIndex: WorkPolicyIndex;
  readonly humanSummaryPath: SafeRuntimeRelativePath;
}

export interface ResolvedWorkUnitReceipt {
  readonly unitId: string;
  readonly templateId: WorkUnitTemplateId;
  readonly phaseId: PhaseId;
  readonly pattern: WorkPattern["pattern"];
  readonly actualInputs: Readonly<Record<string, unknown>>;
}

export interface PolicyResolutionReceipt {
  readonly workUnit: ResolvedWorkUnitReceipt;
  readonly skills?: {
    readonly requested: readonly string[];
    readonly included: readonly string[];
    readonly omittedOptional: readonly string[];
  };
  readonly compute?: {
    readonly intent: PortableWorkIntent;
    readonly logicalProfile: PolicyProfileId;
    readonly adapter?: string;
    readonly providerModel?: string;
    readonly providerEffort?: string;
    readonly bindingSource?: string;
  };
  readonly budget?: {
    readonly decision: "allowed" | "clamped" | "blocked_floor";
    readonly reason?: string;
  };
  readonly warnings?: readonly string[];
}
