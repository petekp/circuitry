#!/usr/bin/env node
/**
 * CLI entry point for catalog-compiler.
 *
 * Usage:
 *   node catalog-compiler.js generate    # Patch marker blocks in target files
 *   node catalog-compiler.js catalog     # Emit catalog JSON to stdout
 *
 * Exits 0 on success, 1 on error.
 */

import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extract } from "../catalog/extract.js";
import { generate } from "../catalog/generate.js";
import type { Catalog, CatalogEntry, CircuitEntry, GenerateTarget } from "../catalog/types.js";

const MODULE_DIR =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

function findRepoRoot(): string {
  let dir = MODULE_DIR;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "skills"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(MODULE_DIR, "..", "..", "..", "..");
}

function isCircuit(entry: CatalogEntry): entry is CircuitEntry {
  return entry.kind === "circuit";
}

function renderCircuitTable(catalog: Catalog): string {
  const circuits = catalog.filter(isCircuit);
  const header = "| Circuit | Invoke | Best For |";
  const sep = "|---------|--------|----------|";
  const rows = circuits.map((c) => {
    const invoke = c.entryCommand
      ? `\`${c.entryCommand} <task>\``
      : `\`${c.expertCommand}\``;
    return `| ${c.id.charAt(0).toUpperCase() + c.id.slice(1)} | ${invoke} | ${c.purpose} |`;
  });
  return [header, sep, ...rows].join("\n");
}

function renderEntryModes(catalog: Catalog): string {
  const circuits = catalog.filter(isCircuit);
  const sections = circuits.map((c) => {
    const heading = `### ${c.id.charAt(0).toUpperCase() + c.id.slice(1)}`;
    const modes = c.entryModes.map((m) => `- ${m}`).join("\n");
    return [heading, "", modes].join("\n");
  });
  return sections.join("\n\n");
}

function getTargets(repoRoot: string): GenerateTarget[] {
  return [
    {
      filePath: resolve(repoRoot, "CIRCUITS.md"),
      blockName: "CIRCUIT_TABLE",
      render: renderCircuitTable,
    },
    {
      filePath: resolve(repoRoot, "CIRCUITS.md"),
      blockName: "ENTRY_MODES",
      render: renderEntryModes,
    },
  ];
}

function main(): number {
  const subcommand = process.argv[2];

  if (!subcommand || !["generate", "catalog"].includes(subcommand)) {
    process.stderr.write("Usage: catalog-compiler <generate|catalog>\n");
    return 1;
  }

  const repoRoot = findRepoRoot();
  const skillsDir = resolve(repoRoot, "skills");

  if (!existsSync(skillsDir)) {
    process.stderr.write(`Error: skills directory not found at ${skillsDir}\n`);
    return 1;
  }

  try {
    const catalog = extract(skillsDir);

    if (subcommand === "catalog") {
      process.stdout.write(JSON.stringify(catalog, null, 2) + "\n");
      return 0;
    }

    // generate
    const targets = getTargets(repoRoot);
    const result = generate(catalog, targets);

    for (const file of result.patchedFiles) {
      process.stdout.write(`patched: ${file}\n`);
    }

    if (result.patchedFiles.length === 0) {
      process.stdout.write("all blocks up to date\n");
    }

    return 0;
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

process.exit(main());
