import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export function resolveProjectRoot(cwd: string): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf-8",
  });

  if (result.status === 0) {
    const gitRoot = result.stdout.trim();
    if (gitRoot) {
      return gitRoot;
    }
  }

  return resolve(cwd);
}
