import {
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync,
} from "node:fs";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

export interface HandoffLocationOptions {
  handoffHome?: string;
  homeDir?: string;
  projectRoot: string;
}

export interface CurrentRunResolution {
  activeRunPath: string | null;
  mode: "file" | "symlink" | null;
  pointerPath: string;
  pointerTarget: string | null;
  runRoot: string | null;
}

export interface HandoffInspection {
  baseCommit: string | null;
  baseCommitIsAncestorOfHead: boolean | null;
  branch: string | null;
  branchMatchesCurrent: boolean | null;
  exists: boolean;
  path: string;
  valid: boolean;
  warnings: string[];
  writtenAt: string | null;
  writtenAtMs: number | null;
}

export interface ContinuityInspection {
  activeRunPath: string | null;
  activeRunSource: "fallback" | "pointer" | null;
  handoff: HandoffInspection;
  hasHandoff: boolean;
  handoffPath: string;
  pointer: CurrentRunResolution;
  projectRoot: string;
  runRoot: string | null;
  slugSource: string;
}

interface GitContext {
  currentBranch: string | null;
}

function normalizeProjectPath(projectRoot: string): string {
  return projectRoot.replace(/\\/g, "/");
}

export function projectSlug(projectRoot: string): string {
  return normalizeProjectPath(projectRoot)
    .replace(/\//g, "-")
    .replace(/[:<>"|?*]/g, "");
}

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

function handoffRootDir(options: HandoffLocationOptions): { base: string; rootDir: string } {
  return {
    base: options.handoffHome || options.homeDir || "",
    rootDir: options.handoffHome ? ".circuit-projects" : ".claude/projects",
  };
}

export function resolveHandoffPath(options: HandoffLocationOptions): string {
  const { base, rootDir } = handoffRootDir(options);
  return resolve(base, rootDir, projectSlug(resolveProjectRoot(options.projectRoot)), "handoff.md");
}

export function hasValidHandoff(handoffPath: string): boolean {
  if (!existsSync(handoffPath)) {
    return false;
  }

  const firstLine = readFileSync(handoffPath, "utf-8").split(/\r?\n/, 1)[0] ?? "";
  return firstLine === "# Handoff";
}

function readGitContext(projectRoot: string): GitContext {
  const branchResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: projectRoot,
    encoding: "utf-8",
  });

  return {
    currentBranch: branchResult.status === 0 ? branchResult.stdout.trim() || null : null,
  };
}

function readHeaderValue(contents: string, key: string): string | null {
  const match = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(contents);
  return match?.[1]?.trim() || null;
}

function parseWrittenAt(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isAncestorCommit(projectRoot: string, commit: string | null): boolean | null {
  if (!commit) {
    return null;
  }

  const result = spawnSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
    cwd: projectRoot,
    encoding: "utf-8",
  });

  if (result.status === 0) {
    return true;
  }

  if (result.status === 1) {
    return false;
  }

  return null;
}

function inspectHandoff(options: HandoffLocationOptions): HandoffInspection {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const path = resolveHandoffPath({
    handoffHome: options.handoffHome,
    homeDir: options.homeDir,
    projectRoot,
  });

  if (!existsSync(path)) {
    return {
      baseCommit: null,
      baseCommitIsAncestorOfHead: null,
      branch: null,
      branchMatchesCurrent: null,
      exists: false,
      path,
      valid: false,
      warnings: [],
      writtenAt: null,
      writtenAtMs: null,
    };
  }

  const contents = readFileSync(path, "utf-8");
  const firstLine = contents.split(/\r?\n/, 1)[0] ?? "";
  const valid = firstLine === "# Handoff";
  const writtenAt = readHeaderValue(contents, "WRITTEN");
  const writtenAtMs = parseWrittenAt(writtenAt);
  const branch = readHeaderValue(contents, "BRANCH");
  const baseCommit = readHeaderValue(contents, "BASE_COMMIT");
  const gitContext = readGitContext(projectRoot);
  const branchMatchesCurrent = valid && branch && gitContext.currentBranch
    ? branch === gitContext.currentBranch
    : null;
  const baseCommitIsAncestorOfHead = valid ? isAncestorCommit(projectRoot, baseCommit) : null;
  const warnings: string[] = [];

  if (!valid) {
    warnings.push("Saved handoff exists but does not start with `# Handoff`.");
  }

  if (valid && branch && branchMatchesCurrent === false) {
    warnings.push(`Saved handoff was written on branch ${branch}; current branch differs.`);
  }

  if (valid && baseCommit && baseCommitIsAncestorOfHead === false) {
    warnings.push(`Saved handoff base commit ${baseCommit} is not an ancestor of HEAD.`);
  }

  return {
    baseCommit,
    baseCommitIsAncestorOfHead,
    branch,
    branchMatchesCurrent,
    exists: true,
    path,
    valid,
    warnings,
    writtenAt,
    writtenAtMs,
  };
}

export function resolveCurrentRun(projectRoot: string): CurrentRunResolution {
  const pointerPath = join(projectRoot, ".circuit", "current-run");
  const circuitRunsDir = join(projectRoot, ".circuit", "circuit-runs");

  if (!existsSync(pointerPath)) {
    return {
      activeRunPath: null,
      mode: null,
      pointerPath,
      pointerTarget: null,
      runRoot: null,
    };
  }

  let runRoot: string | null = null;
  let pointerTarget: string | null = null;
  let mode: "file" | "symlink" | null = null;

  const stat = lstatSync(pointerPath);
  if (stat.isSymbolicLink()) {
    mode = "symlink";
    pointerTarget = readlinkSync(pointerPath);
    runRoot = pointerTarget.startsWith("/")
      ? pointerTarget
      : resolve(projectRoot, ".circuit", pointerTarget);
  } else {
    mode = "file";
    const slug = readFileSync(pointerPath, "utf-8").trim();
    pointerTarget = slug;
    runRoot = slug ? resolve(circuitRunsDir, slug) : null;
  }

  const activeRunPath = runRoot ? join(runRoot, "artifacts", "active-run.md") : null;
  return {
    activeRunPath: activeRunPath && existsSync(activeRunPath) ? activeRunPath : null,
    mode,
    pointerPath,
    pointerTarget,
    runRoot,
  };
}

function walkActiveRuns(rootDir: string): string[] {
  if (!existsSync(rootDir)) {
    return [];
  }

  const files: string[] = [];
  for (const name of readdirSync(rootDir)) {
    const fullPath = join(rootDir, name);
    const stat = lstatSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkActiveRuns(fullPath));
      continue;
    }
    if (name === "active-run.md") {
      files.push(fullPath);
    }
  }
  return files;
}

export function findLatestActiveRun(projectRoot: string): string | null {
  const circuitRunsDir = join(projectRoot, ".circuit", "circuit-runs");
  let newestPath: string | null = null;
  let newestMtime = -1;

  for (const candidate of walkActiveRuns(circuitRunsDir)) {
    const mtime = statSync(candidate).mtimeMs;
    if (mtime > newestMtime) {
      newestMtime = mtime;
      newestPath = candidate;
    }
  }

  return newestPath;
}

export function inspectContinuity(options: HandoffLocationOptions): ContinuityInspection {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const handoff = inspectHandoff({
    handoffHome: options.handoffHome,
    homeDir: options.homeDir,
    projectRoot,
  });
  const pointer = resolveCurrentRun(projectRoot);

  if (pointer.activeRunPath) {
    return {
      activeRunPath: pointer.activeRunPath,
      activeRunSource: "pointer",
      handoff,
      hasHandoff: handoff.valid,
      handoffPath: handoff.path,
      pointer,
      projectRoot,
      runRoot: pointer.runRoot,
      slugSource: projectRoot,
    };
  }

  const fallbackActiveRun = findLatestActiveRun(projectRoot);
  return {
    activeRunPath: fallbackActiveRun,
    activeRunSource: fallbackActiveRun ? "fallback" : null,
    handoff,
    hasHandoff: handoff.valid,
    handoffPath: handoff.path,
    pointer,
    projectRoot,
    runRoot: fallbackActiveRun ? dirname(dirname(fallbackActiveRun)) : null,
    slugSource: projectRoot,
  };
}
