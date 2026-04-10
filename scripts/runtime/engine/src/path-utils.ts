import { resolve } from "node:path";

const SAFE_PATH_SEGMENT =
  "[A-Za-z0-9](?:[A-Za-z0-9_-]|\\.(?=[A-Za-z0-9_-]))*";

export const SAFE_RELATIVE_PATH_PATTERN = new RegExp(
  `^(?:${SAFE_PATH_SEGMENT})(?:/(?:${SAFE_PATH_SEGMENT}))*$`,
);

export function isSafeRelativePath(value: string): boolean {
  return SAFE_RELATIVE_PATH_PATTERN.test(value);
}

export function assertSafeRelativePath(
  value: string,
  label = "path",
): string {
  if (!isSafeRelativePath(value)) {
    throw new Error(`${label} must be a safe run-relative path: ${value}`);
  }

  return value;
}

export function resolveRunRelativePath(
  runRoot: string,
  relativePath: string,
): string {
  return resolve(runRoot, assertSafeRelativePath(relativePath));
}
