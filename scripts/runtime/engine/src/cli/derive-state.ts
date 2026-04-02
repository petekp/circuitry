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
  loadStateSchema,
  loadManifest,
  loadEvents,
  deriveState,
  validateState,
  writeState,
} from "../derive-state.js";

function main(): number {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    process.stderr.write(
      "Usage: derive-state <run-root>\n",
    );
    return 1;
  }

  const runRoot = resolve(args[0]);

  if (!existsSync(runRoot)) {
    process.stderr.write(`Error: run root does not exist: ${runRoot}\n`);
    return 1;
  }

  let manifest: object;
  try {
    manifest = loadManifest(runRoot);
  } catch (e) {
    process.stderr.write(
      `Error: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    return 1;
  }

  const events = loadEvents(runRoot);
  const state = deriveState(
    manifest as Record<string, unknown>,
    events,
  );

  const schema = loadStateSchema();
  const errors = validateState(state, schema);
  if (errors.length > 0) {
    process.stderr.write("State validation errors:\n");
    for (const err of errors) {
      process.stderr.write(`  - ${err}\n`);
    }
    return 1;
  }

  writeState(runRoot, state);
  return 0;
}

process.exit(main());
