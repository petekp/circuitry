import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { parse as parseYaml, stringify as yamlStringify } from "yaml";

import { REPO_ROOT } from "./schema.js";

export function makeTempProject(slug = "test-run") {
  const root = mkdtempSync(join(tmpdir(), "circuit-outer-engine-"));
  const projectRoot = join(root, "project");
  const runRoot = join(projectRoot, ".circuit", "circuit-runs", slug);

  mkdirSync(join(projectRoot, ".circuit", "circuit-runs"), { recursive: true });

  return {
    projectRoot,
    root,
    runRoot,
    slug,
  };
}

export function loadBuildManifest(): Record<string, any> {
  return parseYaml(
    readFileSync(join(REPO_ROOT, "skills/build/circuit.yaml"), "utf-8"),
  ) as Record<string, any>;
}

export function writeManifestFile(
  path: string,
  manifest: Record<string, unknown>,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yamlStringify(manifest), "utf-8");
}

export function writeRunFile(
  runRoot: string,
  relativePath: string,
  contents: string,
): void {
  const fullPath = join(runRoot, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents, "utf-8");
}

export function writeRunJson(
  runRoot: string,
  relativePath: string,
  value: unknown,
): void {
  writeRunFile(runRoot, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function readEvents(runRoot: string): Array<Record<string, any>> {
  const content = readFileSync(join(runRoot, "events.ndjson"), "utf-8");
  return content
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, any>);
}

export function readState(runRoot: string): Record<string, any> {
  return JSON.parse(readFileSync(join(runRoot, "state.json"), "utf-8")) as Record<string, any>;
}

export function readActiveRun(runRoot: string): string {
  return readFileSync(join(runRoot, "artifacts", "active-run.md"), "utf-8");
}
