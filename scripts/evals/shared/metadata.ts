import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { isoForPath, safeSegment } from './json.ts';
import { commandOutput } from './process.ts';

export function repoMetadata(repoRoot: string): {
  repo_commit: string;
  dirty_worktree: boolean;
  git_status_short: string;
} {
  const gitStatus = commandOutput('git', ['status', '--short'], '', { cwd: repoRoot });
  return {
    repo_commit: commandOutput('git', ['rev-parse', 'HEAD'], 'unavailable', { cwd: repoRoot }),
    dirty_worktree: gitStatus.trim().length > 0,
    git_status_short: gitStatus,
  };
}

export function createResultRoot(outDir: string, label: string): string {
  const resultRoot = resolve(outDir, `${isoForPath()}-${safeSegment(label)}`);
  mkdirSync(resultRoot, { recursive: true });
  return resultRoot;
}
