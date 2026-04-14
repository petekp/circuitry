import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./schema.js";

const TEXT_FILE_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".mjs",
  [".p", "y"].join(""),
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const ARCHIVE_PATH_PREFIXES = [".claude/history/"] as const;
const ACTIVE_MIGRATION_CONTROL_PLANE_PREFIXES = [".claude/migration/"] as const;
const GENERATED_SOURCE_PREFIXES = [
  "commands/",
  "scripts/runtime/engine/dist/",
  "scripts/runtime/bin/",
  "scripts/runtime/generated/",
] as const;
const NON_SOURCE_PATH_PREFIXES = [
  ".circuit/",
  ".git/",
  ".relay/",
  "node_modules/",
] as const;

const BANNED_RESIDUE_RATCHETS = [
  {
    label: "legacy invalidation event",
    needle: ["step", "re", "opened"].join("_"),
  },
  {
    label: "legacy predecessor command",
    needle: ["re", "open-step"].join(""),
  },
  {
    label: "ambient codex adapter",
    needle: ["codex", "ambient"].join("-"),
  },
  {
    label: "legacy current-run mirror",
    needle: [".circuit", "current-run"].join("/"),
  },
] as const;

const STATE_AUTHORITY_SCAN_PREFIXES = ["hooks/", "scripts/"] as const;
const STATE_AUTHORITY_ALLOWED_TEST_HELPERS = [
  "scripts/runtime/engine/src/outer-engine-test-utils.ts",
] as const;
const STATE_AUTHORITY_READ_PATTERNS = [
  {
    label: "Node-style direct state snapshot read",
    regex: /readFileSync\([\s\S]{0,200}["'`]state\.json["'`]/m,
  },
  {
    label: "open() state snapshot read",
    regex: /open\([\s\S]{0,200}["'`]state\.json["'`]/m,
  },
  {
    label: "Path.read_text() state snapshot read",
    regex: /Path\([\s\S]{0,200}["'`]state\.json["'`][\s\S]{0,120}\.read_text\(/m,
  },
] as const;

function matchesAnyPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix));
}

function isTextFile(path: string): boolean {
  return TEXT_FILE_EXTENSIONS.has(extname(path));
}

function shouldSkipTraversal(path: string): boolean {
  return matchesAnyPrefix(path, NON_SOURCE_PATH_PREFIXES);
}

function shouldSkipResidueScan(path: string): boolean {
  if (!isTextFile(path)) {
    return true;
  }

  return (
    matchesAnyPrefix(path, ARCHIVE_PATH_PREFIXES)
    || matchesAnyPrefix(path, ACTIVE_MIGRATION_CONTROL_PLANE_PREFIXES)
    || matchesAnyPrefix(path, GENERATED_SOURCE_PREFIXES)
    || shouldSkipTraversal(path)
    || path === "CIRCUITS.md"
  );
}

function isStateAuthorityTestFixture(path: string): boolean {
  return (
    path.includes(".test.")
    || path.includes(".integration.test.")
    || path.endsWith(".spec.ts")
    || STATE_AUTHORITY_ALLOWED_TEST_HELPERS.some((allowedPath) => allowedPath === path)
  );
}

function shouldScanForStateAuthority(path: string): boolean {
  if (!isTextFile(path)) {
    return false;
  }

  if (!matchesAnyPrefix(path, STATE_AUTHORITY_SCAN_PREFIXES)) {
    return false;
  }

  if (
    matchesAnyPrefix(path, GENERATED_SOURCE_PREFIXES)
    || shouldSkipTraversal(path)
    || isStateAuthorityTestFixture(path)
  ) {
    return false;
  }

  return true;
}

function listRepoFiles(relativeDir = ""): string[] {
  const absoluteDir = resolve(REPO_ROOT, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const relativePath = relativeDir ? join(relativeDir, entry.name) : entry.name;
    const normalizedPath = relativePath.replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (!shouldSkipTraversal(`${normalizedPath}/`)) {
        results.push(...listRepoFiles(normalizedPath));
      }
      continue;
    }

    results.push(normalizedPath);
  }

  return results;
}

function firstLineForMatch(content: string, match: RegExpMatchArray): number {
  const index = match.index ?? 0;
  return content.slice(0, index).split("\n").length;
}

describe("architecture ratchets", () => {
  it("keeps removed architecture vocabulary out of live non-generated surfaces", () => {
    const findings: string[] = [];

    for (const path of listRepoFiles()) {
      if (shouldSkipResidueScan(path)) {
        continue;
      }

      const content = readFileSync(resolve(REPO_ROOT, path), "utf-8");

      for (const ratchet of BANNED_RESIDUE_RATCHETS) {
        if (content.includes(ratchet.needle)) {
          findings.push(`${ratchet.label}: ${path}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });

  it("rejects non-test runtime or maintainer tools that read state.json as canonical input", () => {
    const findings: string[] = [];

    for (const path of listRepoFiles()) {
      if (!shouldScanForStateAuthority(path)) {
        continue;
      }

      const content = readFileSync(resolve(REPO_ROOT, path), "utf-8");

      for (const pattern of STATE_AUTHORITY_READ_PATTERNS) {
        const match = content.match(pattern.regex);
        if (!match) {
          continue;
        }

        findings.push(
          `${pattern.label}: ${path}:${firstLineForMatch(content, match)}`,
        );
      }
    }

    expect(findings).toEqual([]);
  });
});
