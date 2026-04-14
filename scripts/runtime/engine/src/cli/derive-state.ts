#!/usr/bin/env node
/**
 * CLI entry point for derive-state.
 *
 * Usage:
 *   node derive-state.js <run-root>
 *
 * Reads circuit.manifest.yaml and events.ndjson, applies the state projection
 * rules, validates the result against the state schema, and writes state.json.
 *
 * Exits 0 on success, 1 on invalid state or missing inputs.
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  deriveValidatedStateFromRun,
} from "../derive-state.js";

function main(): number {
  const args = process.argv.slice(2);
  let json = false;
  let persist = true;
  const positionals: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--no-persist") {
      persist = false;
      continue;
    }
    if (arg.startsWith("--")) {
      process.stderr.write(`Error: unknown flag: ${arg}\n`);
      return 1;
    }

    positionals.push(arg);
  }

  if (positionals.length < 1) {
    process.stderr.write(
      "Usage: derive-state [--json] [--no-persist] <run-root>\n",
    );
    return 1;
  }

  const runRoot = resolve(positionals[0]);

  if (!existsSync(runRoot)) {
    process.stderr.write(`Error: run root does not exist: ${runRoot}\n`);
    return 1;
  }

  try {
    const state = deriveValidatedStateFromRun(runRoot, { persist });
    if (json) {
      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    }
  } catch (e) {
    process.stderr.write(
      `Error: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return 1;
  }
  return 0;
}

process.exit(main());
