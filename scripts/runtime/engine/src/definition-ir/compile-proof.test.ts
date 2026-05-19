import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { loadJsonSchema, REPO_ROOT, validate } from "../schema.js";
import {
  compileDefinitionProof,
  parseDefinitionFixture,
  renderSweepWorkPolicySummary,
} from "./compile-proof.js";

const SWEEP_V3_SOURCE_PATH = "docs/sweep-v3-definition-fixture.yaml";
const SWEEP_V3_SUMMARY_PATH = "docs/sweep-v3-work-policy-summary.md";
const SWEEP_V2_MANIFEST_PATH = "skills/sweep/circuit.yaml";

function readRepoFile(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf-8");
}

function loadSweepFixture() {
  return parseDefinitionFixture(
    readRepoFile(SWEEP_V3_SOURCE_PATH),
    SWEEP_V3_SOURCE_PATH,
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function outerContract(manifest: Record<string, unknown>) {
  const circuit = asRecord(manifest.circuit);
  const steps = circuit.steps as Record<string, unknown>[];

  return {
    entry: circuit.entry,
    entry_modes: circuit.entry_modes,
    steps: steps.map((step) => ({
      budgets: step.budgets,
      checkpoint: step.checkpoint,
      executor: step.executor,
      gate: step.gate,
      id: step.id,
      kind: step.kind,
      protocol: step.protocol,
      reads: step.reads,
      routes: step.routes,
      title: step.title,
      writes: step.writes,
    })),
  };
}

function cloneFixtureDefinition(): Record<string, unknown> {
  return structuredClone(loadSweepFixture().definition);
}

describe("definition-ir compile proof", () => {
  it("projects the Sweep v3 fixture to the current v2 outer manifest contract", () => {
    const output = compileDefinitionProof(loadSweepFixture());
    const currentV2 = parseYaml(readRepoFile(SWEEP_V2_MANIFEST_PATH)) as Record<
      string,
      unknown
    >;

    const manifestSchema = loadJsonSchema("schemas/circuit-manifest.schema.json");
    expect(validate(manifestSchema, output.runtimeManifest)).toEqual([]);
    expect(outerContract(output.runtimeManifest)).toEqual(outerContract(currentV2));
  });

  it("keeps dynamic Sweep work units out of runtime topology and in the policy index", () => {
    const output = compileDefinitionProof(loadSweepFixture());
    const steps = asRecord(output.runtimeManifest.circuit).steps as Record<
      string,
      unknown
    >[];

    expect(steps.map((step) => step.id)).toEqual([
      "frame",
      "survey",
      "triage",
      "execute",
      "verify",
      "deferred",
      "close",
    ]);
    expect(JSON.stringify(output.runtimeManifest)).not.toContain("survey-category");
    expect(JSON.stringify(output.runtimeManifest)).not.toContain("prove-item");
    expect(JSON.stringify(output.runtimeManifest)).not.toContain("execute-batches");

    expect(
      output.workPolicyIndex.entries.map((entry) => ({
        enforcement: entry.enforcement,
        phaseId: entry.phaseId,
        source: entry.runtimeCardinality?.source,
        templateIds: entry.staticTemplates.map((template) => template.id),
        workPattern: entry.workPattern,
      })),
    ).toEqual([
      {
        enforcement: "resolver_enforced",
        phaseId: "survey",
        source: "sweep_type_categories",
        templateIds: ["survey-category"],
        workPattern: "parameterized_fanout",
      },
      {
        enforcement: "receipt_audited",
        phaseId: "triage",
        source: "artifact_table_rows",
        templateIds: ["prove-item"],
        workPattern: "parameterized_fanout",
      },
      {
        enforcement: "adapter_enforced",
        phaseId: "execute",
        source: "queue_batches",
        templateIds: ["execute-batches"],
        workPattern: "workers_adapter",
      },
      {
        enforcement: "resolver_enforced",
        phaseId: "verify",
        source: undefined,
        templateIds: ["sweep-independent-audit"],
        workPattern: "review_audit",
      },
    ]);

    const [survey, triage, execute, verify] = output.workPolicyIndex.entries;
    expect(survey.runtimeCardinality).toMatchObject({
      enforcement: "resolver_enforced",
      max: 5,
      source: "sweep_type_categories",
    });
    expect(survey.staticTemplates[0]).toMatchObject({
      compute: { floorProfile: "scan-fast" },
      idTemplate: "survey.{category}",
      intent: { mutation: "read_only" },
      receiptContract: "work-unit-instance@v1",
    });
    expect(triage.staticTemplates[0]).toMatchObject({
      idTemplate: "prove.{item_id}",
      intent: { independence: "fresh_context", mutation: "read_only" },
    });
    expect(execute.staticTemplates[0]).toMatchObject({
      budget: { maxAttempts: 3 },
      intent: { mutation: "safe_edit" },
      receiptContract: "workers-loop-instance@v1",
    });
    expect(verify.staticTemplates[0]).toMatchObject({
      budget: { maxAttempts: 2 },
      intent: { mutation: "diagnose_only" },
    });
  });

  it("rejects provider-specific definition leaks and missing enforcement classes", () => {
    const providerLeak = cloneFixtureDefinition();
    const circuit = asRecord(providerLeak.circuit);
    const survey = (circuit.phases as Record<string, unknown>[])[1];
    const unitTemplate = asRecord(asRecord(survey.work).unit_template);
    asRecord(unitTemplate.intent).model = "gpt-5.4";

    expect(() =>
      compileDefinitionProof({
        definition: providerLeak,
        sourceDefinitionPath: SWEEP_V3_SOURCE_PATH,
      }),
    ).toThrow(/provider-specific field.*model/);

    const missingEnforcement = cloneFixtureDefinition();
    const missingCircuit = asRecord(missingEnforcement.circuit);
    const missingSurvey = (missingCircuit.phases as Record<string, unknown>[])[1];
    delete asRecord(asRecord(missingSurvey.work).cardinality).enforcement;

    expect(() =>
      compileDefinitionProof({
        definition: missingEnforcement,
        sourceDefinitionPath: SWEEP_V3_SOURCE_PATH,
      }),
    ).toThrow(/survey.*cardinality\.enforcement/);
  });

  it("generates the stable Sweep work-policy summary", () => {
    const output = compileDefinitionProof(loadSweepFixture());

    expect(renderSweepWorkPolicySummary(output).trim()).toBe(
      readRepoFile(SWEEP_V3_SUMMARY_PATH).trim(),
    );
  });
});
