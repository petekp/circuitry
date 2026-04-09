import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./schema.js";

function read(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf-8");
}

describe("release integrity", () => {
  it("does not ship a public workers shim", () => {
    expect(existsSync(resolve(REPO_ROOT, "commands/workers.md"))).toBe(false);
  });

  it("keeps workers out of public command inventories and user-facing docs", () => {
    expect(read(".claude-plugin/public-commands.txt")).not.toContain("workers");
    expect(read("README.md")).not.toContain("/circuit:workers");
    expect(read("CIRCUITS.md")).not.toContain("/circuit:workers");
    expect(read("CUSTOM-CIRCUITS.md")).not.toContain("/circuit:workers");
  });

  it("describes workers as an internal adapter", () => {
    const workers = read("skills/workers/SKILL.md");

    expect(workers).toContain("internal adapter");
    expect(workers).not.toContain("adapter utility");
    expect(workers).not.toContain("command -v codex");
  });

  it("removes the old step/converger dispatch contract from shipped docs", () => {
    const files = [
      "README.md",
      "ARCHITECTURE.md",
      "CIRCUITS.md",
      "CUSTOM-CIRCUITS.md",
      "docs/workflow-matrix.md",
      "skills/build/SKILL.md",
      "skills/explore/SKILL.md",
      "skills/migrate/SKILL.md",
      "skills/repair/SKILL.md",
      "skills/review/SKILL.md",
      "skills/run/SKILL.md",
      "skills/sweep/SKILL.md",
      "skills/workers/SKILL.md",
    ];

    for (const file of files) {
      const content = read(file);
      expect(content, file).not.toContain("--step");
      expect(content, file).not.toContain("PARENT_STEP");
      expect(content, file).not.toContain("--role converger");
      expect(content, file).not.toContain("roles.converger");
    }
  });
});
