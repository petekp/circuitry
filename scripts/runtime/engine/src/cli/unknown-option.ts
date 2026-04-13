/**
 * Format a consistent "unknown option" error that lists valid alternatives.
 * Every CLI arg parser should use this in its default/fallback branch.
 */
export function unknownOption(value: string, valid: string[]): string {
  return `Unknown option: ${value} (valid: ${valid.join(", ")})`;
}
