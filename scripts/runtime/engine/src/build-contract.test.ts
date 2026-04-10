import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { loadJsonSchema, REPO_ROOT, validate } from "./schema.js";

function loadBuildManifest(): Record<string, any> {
  return parseYaml(
    readFileSync(join(REPO_ROOT, "skills/build/circuit.yaml"), "utf-8"),
  ) as Record<string, any>;
}

describe("build contract", () => {
  it("keeps the Build manifest schema-valid after phase-specific path realignment", () => {
    const manifestSchema = loadJsonSchema("schemas/circuit-manifest.schema.json");
    const manifest = loadBuildManifest();

    expect(validate(manifestSchema, manifest)).toEqual([]);
  });

  it("keeps frame as a checkpoint step", () => {
    const manifest = loadBuildManifest();
    const frame = manifest.circuit.steps.find((step: any) => step.id === "frame");

    expect(frame.kind).toBe("checkpoint");
  });

  it("uses phase-specific act and review job paths", () => {
    const manifest = loadBuildManifest();
    const act = manifest.circuit.steps.find((step: any) => step.id === "act");
    const review = manifest.circuit.steps.find((step: any) => step.id === "review");

    expect(act.writes.request).toBe(
      "phases/implement/jobs/{step_id}-{attempt}.request.json",
    );
    expect(act.writes.receipt).toBe(
      "phases/implement/jobs/{step_id}-{attempt}.receipt.json",
    );
    expect(act.writes.result).toBe(
      "phases/implement/jobs/{step_id}-{attempt}.result.json",
    );

    expect(review.writes.request).toBe(
      "phases/review/jobs/{step_id}-{attempt}.request.json",
    );
    expect(review.writes.receipt).toBe(
      "phases/review/jobs/{step_id}-{attempt}.receipt.json",
    );
    expect(review.writes.result).toBe(
      "phases/review/jobs/{step_id}-{attempt}.result.json",
    );
  });

  it("routes verify to review and close to @complete", () => {
    const manifest = loadBuildManifest();
    const verify = manifest.circuit.steps.find((step: any) => step.id === "verify");
    const close = manifest.circuit.steps.find((step: any) => step.id === "close");

    expect(verify.routes.pass).toBe("review");
    expect(close.routes.pass).toBe("@complete");
  });
});
