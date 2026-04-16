/**
 * Node.js version guard. Runs at CLI entry to fail loudly when the host
 * runtime is older than the supported minimum, instead of failing deeper
 * inside the engine with a hard-to-trace syntax or API error.
 */

export type NodeVersionCheck =
  | { ok: true }
  | { ok: false; message: string };

export function checkNodeMajor(
  versionString: string,
  minMajor: number,
): NodeVersionCheck {
  const major = parseInt(versionString.split(".")[0], 10);
  if (Number.isNaN(major) || major < minMajor) {
    return {
      message: `Node ${minMajor}+ required, found Node ${versionString}. Upgrade via nvm or your package manager and retry.`,
      ok: false,
    };
  }
  return { ok: true };
}
