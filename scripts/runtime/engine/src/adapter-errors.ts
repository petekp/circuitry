/**
 * Classify adapter start/exit failures so dispatch surfaces a remediation
 * hint instead of a bare errno or exit code.
 *
 * - missing-tool: spawn hit ENOENT -- the configured command binary was not
 *   found on PATH.
 * - permission: spawn hit EACCES/EPERM -- the binary exists but is not
 *   executable by the current user.
 * - resource: spawn hit ENOBUFS -- typically a prompt-file too large for
 *   the configured dispatch maxBuffer.
 * - bad-config: the adapter started and then exited non-zero; the worker
 *   ran but its arguments or config produced a failure.
 * - unknown: errno we have no hint for; keep the raw message.
 */

export type AdapterErrorClass =
  | "missing-tool"
  | "permission"
  | "resource"
  | "bad-config"
  | "unknown";

export interface AdapterErrorClassification {
  errorClass: AdapterErrorClass;
  hint: string | null;
}

function configPointer(resolvedFrom: string | null | undefined): string {
  return resolvedFrom ? ` (resolved from ${resolvedFrom})` : "";
}

export function classifyAdapterStartError(
  adapter: string,
  errnoCode: string | undefined,
  resolvedFrom?: string | null,
): AdapterErrorClassification {
  switch (errnoCode) {
    case "ENOENT":
      return {
        errorClass: "missing-tool",
        hint: `hint (missing-tool): the configured command for adapter "${adapter}" was not found on PATH. Verify dispatch.adapters.${adapter}.command${configPointer(resolvedFrom)}.`,
      };
    case "EACCES":
    case "EPERM":
      return {
        errorClass: "permission",
        hint: `hint (permission): cannot execute the configured command for adapter "${adapter}". Ensure the binary is executable (chmod +x) and owner permissions allow it${configPointer(resolvedFrom)}.`,
      };
    case "ENOBUFS":
      return {
        errorClass: "resource",
        hint: `hint (resource): adapter "${adapter}" spawn ran out of buffer (ENOBUFS). Reduce the prompt size or raise dispatch maxBuffer.`,
      };
    default:
      return { errorClass: "unknown", hint: null };
  }
}

export function classifyAdapterExitError(
  adapter: string,
  resolvedFrom?: string | null,
): AdapterErrorClassification {
  return {
    errorClass: "bad-config",
    hint: `hint (bad-config): adapter "${adapter}" started but exited non-zero. Inspect the stderr above, then check the configured command and arguments${configPointer(resolvedFrom)}.`,
  };
}
