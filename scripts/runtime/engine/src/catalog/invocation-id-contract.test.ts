import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type CodeFence = {
  body: string;
  info: string;
  startLine: number;
};

function collectCodeFences(markdown: string): CodeFence[] {
  const fences: CodeFence[] = [];
  const lines = markdown.split("\n");

  let insideFence = false;
  let currentInfo = "";
  let currentStartLine = 0;
  let currentBodyLines: string[] = [];

  lines.forEach((line, index) => {
    if (!insideFence) {
      const openFence = line.match(/^```([^\s`]*)\s*$/);
      if (!openFence) {
        return;
      }

      insideFence = true;
      currentInfo = openFence[1] ?? "";
      currentStartLine = index + 1;
      currentBodyLines = [];
      return;
    }

    if (line === "```") {
      fences.push({
        body: currentBodyLines.join("\n"),
        info: currentInfo,
        startLine: currentStartLine,
      });
      insideFence = false;
      currentInfo = "";
      currentStartLine = 0;
      currentBodyLines = [];
      return;
    }

    currentBodyLines.push(line);
  });

  return fences;
}

describe("invocation-id bootstrap contract", () => {
  it("requires every skill bootstrap snippet to thread the invocation id", () => {
    const repoRoot = resolve(
      fileURLToPath(new URL(".", import.meta.url)),
      "../../../../..",
    );
    const skillsRoot = resolve(repoRoot, "skills");
    const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(skillDirs.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    let bootstrapBlockCount = 0;

    for (const skillDir of skillDirs) {
      const skillPath = resolve(skillsRoot, skillDir, "SKILL.md");
      const skillMarkdown = readFileSync(skillPath, "utf-8");
      const fences = collectCodeFences(skillMarkdown);

      for (const fence of fences) {
        const isBashOrPlainFence = fence.info === "" || fence.info === "bash";
        if (!isBashOrPlainFence || !fence.body.includes("circuit-engine bootstrap")) {
          continue;
        }

        bootstrapBlockCount += 1;
        if (!fence.body.includes("--invocation-id")) {
          offenders.push(`${skillPath}:${fence.startLine}`);
        }
      }
    }

    expect(bootstrapBlockCount).toBeGreaterThan(0);
    expect(
      offenders,
      `Expected every skill bootstrap code fence to include --invocation-id. Missing in:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
