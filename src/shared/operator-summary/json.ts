// Schema-loose JSON projection helpers.
//
// The operator-summary writer reads many flow-shaped JSON reports without
// asserting on their schema (the typed schemas live next to each flow). These
// helpers degrade gracefully when a field is missing or wrong-typed: undefined,
// empty array, or empty object — never an exception.

import { existsSync, readFileSync } from 'node:fs';

import { resolveRunRelative } from '../run-relative-path.js';

export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readJsonIfPresent(runFolder: string, relPath: string): JsonObject | undefined {
  const path = resolveRunRelative(runFolder, relPath);
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return isObject(parsed) ? parsed : undefined;
}

export function stringField(report: JsonObject | undefined, key: string): string | undefined {
  const value = report?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function numberField(report: JsonObject | undefined, key: string): number | undefined {
  const value = report?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function arrayField(report: JsonObject | undefined, key: string): unknown[] {
  const value = report?.[key];
  return Array.isArray(value) ? value : [];
}

export function stringArrayField(report: JsonObject | undefined, key: string): string[] {
  return arrayField(report, key).filter((item): item is string => typeof item === 'string');
}

export function objectField(report: JsonObject | undefined, key: string): JsonObject | undefined {
  const value = report?.[key];
  return isObject(value) ? value : undefined;
}

// Resolve an evidence_links entry by report_id and read its JSON content.
// Returns undefined when the entry is missing, the path is malformed, or the
// file does not exist. Both the writer (for the HTML projector context) and
// the Explore projector use this — keep one definition.
export function evidenceReportById(
  runFolder: string,
  flowReport: JsonObject | undefined,
  reportId: string,
): JsonObject | undefined {
  for (const item of arrayField(flowReport, 'evidence_links')) {
    if (!isObject(item)) continue;
    if (stringField(item, 'report_id') !== reportId) continue;
    const path = stringField(item, 'path');
    if (path === undefined) return undefined;
    try {
      return readJsonIfPresent(runFolder, path);
    } catch {
      // Malformed evidence_links[].path (traversal, absolute, symlink-cross)
      // throws inside resolveRunRelative. Degrade to undefined so callers
      // can fall back gracefully without aborting the run close.
      return undefined;
    }
  }
  return undefined;
}
