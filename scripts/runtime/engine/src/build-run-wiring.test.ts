import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./schema.js";

function read(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf-8");
}

describe("build/run wiring", () => {
  it("keeps Build on semantic wrapper commands and removes manual dashboard updates", () => {
    const buildSkill = read("skills/build/SKILL.md");

    expect(buildSkill).toContain('scripts/relay/circuit-engine.sh" bootstrap');
    expect(buildSkill).toContain("request-checkpoint");
    expect(buildSkill).toContain("resolve-checkpoint");
    expect(buildSkill).toContain("complete-synthesis");
    expect(buildSkill).toContain("dispatch-step");
    expect(buildSkill).toContain("reconcile-dispatch");
    expect(buildSkill).toContain("resume");

    expect(buildSkill).not.toContain("Update `active-run.md`");
    expect(buildSkill).not.toContain("Write initial `${RUN_ROOT}/artifacts/active-run.md`");
    expect(buildSkill).not.toContain("## Deep Rigor: Seam Proof");
    expect(buildSkill).not.toContain("Skipped at Lite rigor.");
    expect(buildSkill).not.toContain("transfer to Explore within the same run");
  });

  it("uses Build-only semantic bootstrap in run while keeping legacy bootstrap for other workflows", () => {
    const runSkill = read("skills/run/SKILL.md");

    expect(runSkill).toContain("For Build only, map rigor to the Build entry mode and call semantic bootstrap");
    expect(runSkill).toContain('scripts/relay/circuit-engine.sh" bootstrap');
    expect(runSkill).toContain("For non-Build workflows, keep the current legacy bootstrap path");
    expect(runSkill).toContain("stop and restart via Explore");

    expect(runSkill).not.toContain("I'll plan and implement. Quick self-verify.");
    expect(runSkill).not.toContain("I'll research first, prove the seam, then build with independent review.");
  });
});
