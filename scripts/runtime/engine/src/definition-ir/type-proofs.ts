import type {
  CircuitDefinition,
  EnforcementClass,
  ModePhaseBehavior,
  PolicyResolutionReceipt,
  PortableWorkIntent,
  ResolvedWorkUnitReceipt,
  RuntimeManifestCompileTarget,
  WorkPattern,
  WorkPolicyIndex,
} from "./types.js";

type AssertAssignable<Actual extends Expected, Expected> = [Actual, Expected];
type AssertExact<Actual, Expected> =
  [Actual] extends [Expected]
    ? [Expected] extends [Actual]
      ? true
      : never
    : never;

export type WorkPatternKindsAreConstrained = AssertExact<
  WorkPattern["pattern"],
  | "single"
  | "static_fanout"
  | "parameterized_fanout"
  | "workers_adapter"
  | "review_audit"
  | "tournament"
>;

export type EnforcementClassesAreExplicit = AssertExact<
  EnforcementClass,
  | "runtime_enforced"
  | "resolver_enforced"
  | "adapter_enforced"
  | "receipt_audited"
  | "prompt_guidance"
  | "prose_only"
>;

export type ModeBehaviorsAreWorkflowLocal = AssertExact<
  ModePhaseBehavior,
  | "run"
  | "skip"
  | "inline"
  | "defer"
  | "require_confirmation"
  | "auto_continue"
>;

export type CompileOutputKeepsRuntimeManifestAtV2 = AssertAssignable<
  RuntimeManifestCompileTarget,
  {
    readonly schemaVersion: "2";
    readonly path: string;
    readonly sourceDefinitionPath: string;
  }
>;

export type PolicyIndexIsSeparateFromRuntimeManifest = AssertAssignable<
  WorkPolicyIndex,
  {
    readonly schemaVersion: "1";
    readonly sourceDefinitionPath: string;
    readonly entries: readonly unknown[];
  }
>;

export type ReceiptsCarryResolvedDynamicUnits = AssertAssignable<
  PolicyResolutionReceipt,
  {
    readonly workUnit: ResolvedWorkUnitReceipt;
    readonly warnings?: readonly string[];
  }
>;

export const SWEEP_DEFINITION_PROOF = {
  schemaVersion: "3-experimental",
  circuit: {
    id: "sweep",
    version: "2026-04-17",
    purpose: "Systematic codebase sweeps with evidence-gated action.",
    entry: {
      signals: {
        include: ["dead_code", "stale_docs", "cleanup", "quality", "coverage", "overnight"],
        exclude: ["feature", "architecture_decision", "migration"],
      },
    },
    artifacts: {
      brief: {
        path: "artifacts/brief.md",
        schema: "brief-sweep@v1",
        public: true,
      },
      analysis: {
        path: "artifacts/analysis.md",
        schema: "analysis-sweep@v1",
        public: true,
      },
      queue: {
        path: "artifacts/queue.md",
        schema: "queue@v1",
        public: true,
      },
      review: {
        path: "artifacts/review.md",
        schema: "review@v1",
        public: true,
      },
      deferred: {
        path: "artifacts/deferred.md",
        schema: "deferred@v1",
        public: true,
      },
      result: {
        path: "artifacts/result.md",
        schema: "result@v1",
        public: true,
      },
    },
    modes: {
      lite: {
        rigor: "Lite",
        startsAt: "frame",
        phaseOverrides: {
          survey: {
            behavior: "inline",
            evidenceFloor: "high_confidence_only",
            enforcement: "prompt_guidance",
          },
        },
      },
      default: {
        rigor: "Standard",
        startsAt: "frame",
        default: true,
      },
      deep: {
        rigor: "Deep",
        startsAt: "frame",
        phaseOverrides: {
          execute: {
            behavior: "require_confirmation",
            evidenceFloor: "prove_before_act",
            enforcement: "prompt_guidance",
          },
        },
      },
      autonomous: {
        rigor: "Autonomous",
        startsAt: "frame",
        phaseOverrides: {
          execute: {
            behavior: "run",
            stopAfter: {
              maxBatches: 3,
              enforcement: "adapter_enforced",
            },
            enforcement: "adapter_enforced",
          },
        },
      },
    },
    phases: [
      {
        id: "frame",
        title: "Frame",
        purpose: "Define the sweep objective, risk boundaries, and verification commands.",
        kind: "checkpoint",
        writes: ["brief"],
        gate: {
          kind: "schema_sections",
          source: "brief",
          requiredSections: ["Objective", "Sweep Type", "Build Command", "Test Command"],
          enforcement: "runtime_enforced",
        },
        routes: {
          continue: "survey",
        },
      },
      {
        id: "survey",
        title: "Survey",
        purpose: "Find sweep candidates by category.",
        kind: "dispatch",
        reads: ["brief"],
        writes: ["analysis"],
        work: {
          pattern: "parameterized_fanout",
          unitTemplate: {
            id: "survey-category",
            idTemplate: "survey.{category}",
            role: "researcher",
            intent: {
              purpose: "scan",
              consequence: "medium",
              context: "repo",
              mutation: "read_only",
              latency: "balanced",
            },
            outputs: {
              report: "phases/survey-{category}/reports/{category}-findings.md",
            },
            compute: {
              defaultProfile: "scan-fast",
              floorProfile: "scan-fast",
              allowedProfiles: ["scan-fast", "research-standard", "research-high"],
              enforcement: "resolver_enforced",
            },
            receiptContract: "work-unit-instance@v1",
          },
          cardinality: {
            source: "sweep_type_categories",
            max: 5,
            enforcement: "resolver_enforced",
          },
          completion: {
            kind: "all",
          },
        },
        gate: {
          kind: "result_verdict",
          pass: ["outputs_ready"],
          enforcement: "runtime_enforced",
        },
        routes: {
          pass: "triage",
        },
      },
      {
        id: "execute",
        title: "Batch Execute",
        purpose: "Execute approved low-risk batches through the workers adapter.",
        kind: "dispatch",
        reads: ["queue", "brief"],
        writes: ["review"],
        work: {
          pattern: "workers_adapter",
          adapter: "workers",
          ownsInnerLoop: true,
          childCardinality: {
            source: "queue_batches",
            max: 3,
            enforcement: "adapter_enforced",
          },
          parentReadableOutputs: [
            "jobs/{step_id}-{attempt}.request.json",
            "jobs/{step_id}-{attempt}.receipt.json",
            "jobs/{step_id}-{attempt}.result.json",
            "reports/report-converge.md",
          ],
          parentUnit: {
            id: "execute-batches",
            role: "implementer",
            intent: {
              purpose: "code",
              consequence: "medium",
              context: "repo",
              mutation: "safe_edit",
            },
            outputs: {
              result: "jobs/{step_id}-{attempt}.result.json",
            },
            compute: {
              defaultProfile: "code-standard",
              floorProfile: "code-fast",
              allowedProfiles: ["code-fast", "code-standard", "code-high"],
              enforcement: "resolver_enforced",
            },
            receiptContract: "workers-loop-instance@v1",
          },
        },
        gate: {
          kind: "result_verdict",
          pass: ["complete_and_hardened", "partial"],
          enforcement: "runtime_enforced",
        },
        routes: {
          pass: "verify",
        },
      },
    ],
  },
} as const satisfies CircuitDefinition;

export const PROVIDER_MODEL_LEAK_PROOF = {
  purpose: "review",
  consequence: "critical",
  context: "repo",
  mutation: "read_only",
  // @ts-expect-error provider model IDs belong in config/adapters, not portable intent.
  model: "gpt-5.4",
} as const satisfies PortableWorkIntent;
