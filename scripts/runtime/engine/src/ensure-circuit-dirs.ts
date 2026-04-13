import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { resolveCircuitHomePaths } from "./catalog/custom-circuits.js";

export interface InitResult {
  ok: boolean;
  warnings: string[];
}

/**
 * User-global: ~/.claude/circuit/{drafts,skills,overlay}
 * Best-effort. Warnings on failure. Never throws.
 */
export function ensureCircuitHome(homeDir?: string): InitResult {
  const warnings: string[] = [];

  let paths: ReturnType<typeof resolveCircuitHomePaths>;
  try {
    paths = resolveCircuitHomePaths(homeDir);
  } catch (err: unknown) {
    return {
      ok: false,
      warnings: [`failed to resolve circuit home: ${(err as Error).message}`],
    };
  }

  for (const dir of [paths.circuitHome, paths.draftsRoot, paths.skillsRoot, paths.overlayDir]) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (err: unknown) {
      warnings.push(`failed to create ${dir}: ${(err as Error).message}`);
    }
  }

  return { ok: warnings.length === 0, warnings };
}

/**
 * Per-project: .circuit/, .circuit/control-plane/
 * Best-effort. Warnings on failure. Never throws.
 */
export function ensureProjectCircuitRoot(projectRoot: string): InitResult {
  const warnings: string[] = [];
  const dir = resolve(projectRoot, ".circuit", "control-plane");

  try {
    mkdirSync(dir, { recursive: true });
  } catch (err: unknown) {
    warnings.push(`failed to create ${dir}: ${(err as Error).message}`);
  }

  return { ok: warnings.length === 0, warnings };
}
