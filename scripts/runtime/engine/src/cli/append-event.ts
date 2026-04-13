#!/usr/bin/env node
/**
 * CLI entry point for append-event.
 *
 * Usage:
 *   node append-event.js <run-root> <event-type> \
 *     [--payload '{"key":"value"}'] [--step-id <id>] [--attempt <n>]
 *
 * Exits 0 on success, 1 on validation failure.
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  loadEventSchema,
  buildEvent,
  validateEvent,
  appendEvent,
} from "../append-event.js";
import { unknownOption } from "./unknown-option.js";

function main(): number {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    process.stderr.write(
      "Usage: append-event <run-root> <event-type> [--payload '{}'] [--step-id <id>] [--attempt <n>]\n",
    );
    return 1;
  }

  const runRoot = resolve(args[0]);
  const eventType = args[1];

  // Parse optional flags
  let payload: object = {};
  let stepId: string | undefined;
  let attempt: number | undefined;

  for (let i = 2; i < args.length; i++) {
    switch (args[i]) {
      case "--payload":
        i++;
        try {
          payload = JSON.parse(args[i]);
        } catch {
          process.stderr.write(`Error: invalid JSON payload: ${args[i]}\n`);
          return 1;
        }
        break;
      case "--step-id":
        i++;
        stepId = args[i];
        break;
      case "--attempt":
        i++;
        attempt = parseInt(args[i], 10);
        if (Number.isNaN(attempt)) {
          process.stderr.write(`Error: invalid attempt number: ${args[i]}\n`);
          return 1;
        }
        break;
      default:
        process.stderr.write(`Error: ${unknownOption(args[i], ["--payload", "--step-id", "--attempt"])}\n`);
        return 1;
    }
  }

  if (!existsSync(runRoot)) {
    process.stderr.write(`Error: run root does not exist: ${runRoot}\n`);
    return 1;
  }

  const schema = loadEventSchema();
  const event = buildEvent(runRoot, eventType, payload, stepId, attempt);

  const errors = validateEvent(event, schema);
  if (errors.length > 0) {
    process.stderr.write("Validation errors:\n");
    for (const err of errors) {
      process.stderr.write(`  - ${err}\n`);
    }
    return 1;
  }

  appendEvent(runRoot, event);
  return 0;
}

process.exit(main());
