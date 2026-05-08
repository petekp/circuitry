export type PublishTarget = 'check' | 'local' | 'release' | 'bump';

export type CommandInvocation = {
  id: string;
  argv: string[];
  cwd?: string;
  env?: Record<string, string>;
};

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type PublishReport = {
  schema_version: number;
  target: PublishTarget;
  dry_run: boolean;
  status: 'passed' | 'published' | 'failed';
  repo_root: string;
  git: {
    branch: string;
    upstream: string;
    head: string;
    origin_main: string;
    dirty_files: string[];
  };
  versions: {
    source: string;
    claude: string;
    codex: string;
    claude_marketplace?: string;
    expected?: string;
  };
  commands: Array<{
    id: string;
    argv: string[];
    skipped?: boolean;
    exit_code?: number;
  }>;
  outputs: Record<string, unknown>;
  warnings: string[];
  errors: string[];
};

export type PublishArgs = {
  target: PublishTarget;
  yes: boolean;
  dryRun: boolean;
  json: boolean;
  skipVerify: boolean;
  allowDirty: boolean;
  allowUnsafe: boolean;
  writeGenerated: boolean;
  version?: string;
  codexSource?: string;
  codexMarketplace?: string;
  help?: boolean;
};

export function parseArgs(argv: string[]): PublishArgs;
export function isRemoteCodexSource(source: string | undefined): boolean;
export function defaultRunner(invocation: CommandInvocation): CommandResult;
export function runPublish(
  argv?: string[],
  options?: {
    repoRoot?: string;
    runner?: (invocation: CommandInvocation) => CommandResult;
  },
): PublishReport;
