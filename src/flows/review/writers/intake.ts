// Review intake compose writer.
//
// Emits the requested review scope plus the local working-tree evidence the
// reviewer needs to audit current changes. The CLI supplies projectRoot from
// its cwd, so Codex/Claude/generic-shell hosts all collect the same evidence
// before the reviewer relay is called.

import { spawnSync } from 'node:child_process';
import { closeSync, lstatSync, openSync, readSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import {
  type ReviewEvidence,
  type ReviewEvidenceText,
  type ReviewEvidenceWarning,
  ReviewIntake,
  type ReviewUntrackedContentPolicy,
  type ReviewUntrackedFileEvidence,
} from '../reports.js';

const MAX_DIFF_CHARS = 120_000;
const MAX_UNTRACKED_FILES = 20;
const MAX_UNTRACKED_FILE_CHARS = 20_000;
const MAX_GIT_BUFFER_BYTES = 10 * 1024 * 1024;
const MAX_DIFF_BUFFER_BYTES = Math.max(MAX_DIFF_CHARS * 4, 1024 * 1024);
const MAX_UNTRACKED_FILE_BYTES = MAX_UNTRACKED_FILE_CHARS + 1;

type GitResult =
  | { ok: true; stdout: string; truncated_by_buffer: boolean }
  | {
      ok: false;
      reason: string;
    };

function truncateText(text: string, maxChars: number): ReviewEvidenceText {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}\n[truncated ${text.length - maxChars} characters]`,
    truncated: true,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function outputToString(output: string | Buffer | Uint8Array | null | undefined): string {
  if (output === null || output === undefined) return '';
  if (typeof output === 'string') return output;
  return Buffer.from(output).toString('utf8');
}

function runGit(
  projectRoot: string,
  args: readonly string[],
  options: { readonly maxBufferBytes?: number; readonly allowPartialStdout?: boolean } = {},
): GitResult {
  const result = spawnSync('git', [...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: options.maxBufferBytes ?? MAX_GIT_BUFFER_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = outputToString(result.stdout);
  const stderr = outputToString(result.stderr).trim();

  if (result.error !== undefined) {
    if (options.allowPartialStdout === true && stdout.length > 0) {
      return { ok: true, stdout, truncated_by_buffer: true };
    }
    return { ok: false, reason: `git ${args.join(' ')} failed: ${result.error.message}` };
  }

  if (result.status !== 0) {
    const reason = stderr.length > 0 ? stderr : `exited with status ${result.status ?? 'unknown'}`;
    return { ok: false, reason: `git ${args.join(' ')} failed: ${reason}` };
  }

  return { ok: true, stdout, truncated_by_buffer: false };
}

function runGitDiff(projectRoot: string, args: readonly string[]): ReviewEvidenceText {
  const result = runGit(projectRoot, args, {
    maxBufferBytes: MAX_DIFF_BUFFER_BYTES,
    allowPartialStdout: true,
  });
  if (!result.ok) return truncateText(result.reason, MAX_DIFF_CHARS);
  if (!result.truncated_by_buffer) return truncateText(result.stdout, MAX_DIFF_CHARS);
  const truncated = truncateText(result.stdout, MAX_DIFF_CHARS);
  return {
    text: `${truncated.text}\n[truncated because git output exceeded ${MAX_DIFF_BUFFER_BYTES} bytes before completion]`,
    truncated: true,
  };
}

function insideProject(projectRoot: string, path: string): boolean {
  const rel = relative(projectRoot, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function readUntrackedFile(
  projectRoot: string,
  path: string,
  contentPolicy: ReviewUntrackedContentPolicy,
): ReviewUntrackedFileEvidence {
  const abs = resolve(projectRoot, path);
  if (!insideProject(projectRoot, abs)) {
    return { path, byte_length: 0, skipped_reason: 'path resolves outside project root' };
  }
  let stat: ReturnType<typeof lstatSync>;
  try {
    stat = lstatSync(abs);
  } catch (err) {
    return { path, byte_length: 0, skipped_reason: `failed to inspect file: ${errorMessage(err)}` };
  }
  if (stat.isSymbolicLink()) {
    return { path, byte_length: stat.size, skipped_reason: 'symbolic link skipped' };
  }
  if (!stat.isFile()) {
    return { path, byte_length: stat.size, skipped_reason: 'not a regular file' };
  }
  if (contentPolicy === 'metadata-only') {
    return { path, byte_length: stat.size };
  }

  let fd: number | undefined;
  try {
    const byteLimit = Math.min(stat.size, MAX_UNTRACKED_FILE_BYTES);
    fd = openSync(abs, 'r');
    const bytes = Buffer.alloc(byteLimit);
    const bytesRead = readSync(fd, bytes, 0, byteLimit, 0);
    const sample = bytes.subarray(0, bytesRead);
    if (sample.includes(0)) {
      return { path, byte_length: stat.size, skipped_reason: 'binary file skipped' };
    }
    const content = truncateText(sample.toString('utf8'), MAX_UNTRACKED_FILE_CHARS);
    return {
      path,
      byte_length: stat.size,
      content:
        stat.size > bytesRead && !content.truncated ? { ...content, truncated: true } : content,
    };
  } catch (err) {
    return {
      path,
      byte_length: stat.size,
      skipped_reason: `failed to read file: ${errorMessage(err)}`,
    };
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // The evidence entry above is still useful even if closing a skipped
        // file descriptor fails after the read attempt.
      }
    }
  }
}

function collectUntrackedFiles(
  projectRoot: string,
  contentPolicy: ReviewUntrackedContentPolicy,
): {
  readonly count: number;
  readonly truncated: boolean;
  readonly files: ReviewUntrackedFileEvidence[];
} {
  const listed = runGit(projectRoot, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (!listed.ok) return { count: 0, truncated: false, files: [] };
  const paths = listed.stdout.split('\0').filter((path) => path.length > 0);
  return {
    count: paths.length,
    truncated: paths.length > MAX_UNTRACKED_FILES,
    files: paths
      .slice(0, MAX_UNTRACKED_FILES)
      .map((path) => readUntrackedFile(projectRoot, path, contentPolicy)),
  };
}

function collectReviewEvidence(
  projectRoot: string | undefined,
  options: { readonly includeUntrackedFileContent?: boolean } = {},
): ReviewEvidence {
  if (projectRoot === undefined) {
    return {
      kind: 'unavailable',
      reason: 'CompiledFlowInvocation.projectRoot was not provided',
    };
  }

  const status = runGit(projectRoot, ['status', '--short']);
  if (!status.ok) return { kind: 'unavailable', reason: status.reason };
  const staged = runGitDiff(projectRoot, ['diff', '--cached', '--no-ext-diff', '--']);
  const unstaged = runGitDiff(projectRoot, ['diff', '--no-ext-diff', '--']);
  const diffStat = runGit(projectRoot, ['diff', '--stat', '--cached', '--no-ext-diff']);
  const untrackedContentPolicy: ReviewUntrackedContentPolicy =
    options.includeUntrackedFileContent === true ? 'include-content' : 'metadata-only';
  const untracked = collectUntrackedFiles(projectRoot, untrackedContentPolicy);

  return {
    kind: 'git-working-tree',
    project_root: projectRoot,
    status_short: status.stdout,
    staged_diff: staged,
    unstaged_diff: unstaged,
    diff_stat: diffStat.ok ? diffStat.stdout : diffStat.reason,
    untracked_file_count: untracked.count,
    untracked_files_truncated: untracked.truncated,
    untracked_content_policy: untrackedContentPolicy,
    untracked_files: untracked.files,
  };
}

function gitCommandFailed(text: string): boolean {
  return /^git\s+.+\s+failed:/.test(text);
}

function evidenceWarnings(evidence: ReviewEvidence): ReviewEvidenceWarning[] {
  if (evidence.kind === 'unavailable') {
    return [
      {
        kind: 'evidence_unavailable',
        message: evidence.reason,
      },
    ];
  }

  const warnings: ReviewEvidenceWarning[] = [];
  if (
    evidence.staged_diff.text.length === 0 &&
    evidence.unstaged_diff.text.length === 0 &&
    !gitCommandFailed(evidence.staged_diff.text) &&
    !gitCommandFailed(evidence.unstaged_diff.text)
  ) {
    warnings.push({
      kind: 'scope_empty',
      message:
        'review scoped to uncommitted changes only; HEAD~1 differences not examined. No staged or unstaged diff was present, so committed changes were not part of this review.',
    });
  }
  if (evidence.staged_diff.truncated) {
    warnings.push({
      kind: 'diff_truncated',
      message: 'staged diff was truncated before relay',
    });
  }
  if (evidence.unstaged_diff.truncated) {
    warnings.push({
      kind: 'diff_truncated',
      message: 'unstaged diff was truncated before relay',
    });
  }
  if (gitCommandFailed(evidence.staged_diff.text)) {
    warnings.push({
      kind: 'git_command_failed',
      message: evidence.staged_diff.text,
    });
  }
  if (gitCommandFailed(evidence.unstaged_diff.text)) {
    warnings.push({
      kind: 'git_command_failed',
      message: evidence.unstaged_diff.text,
    });
  }
  if (gitCommandFailed(evidence.diff_stat)) {
    warnings.push({
      kind: 'git_command_failed',
      message: evidence.diff_stat,
    });
  }
  if (evidence.untracked_files_truncated) {
    warnings.push({
      kind: 'untracked_files_truncated',
      message: `untracked file evidence was limited to ${MAX_UNTRACKED_FILES} files`,
    });
  }
  if (evidence.untracked_content_policy === 'metadata-only' && evidence.untracked_file_count > 0) {
    warnings.push({
      kind: 'untracked_file_content_omitted',
      message:
        'untracked file contents were not included; pass --include-untracked-content only when those files are safe to relay',
    });
  }
  for (const file of evidence.untracked_files) {
    if (file.skipped_reason !== undefined) {
      warnings.push({
        kind: 'untracked_file_skipped',
        path: file.path,
        message: file.skipped_reason,
      });
    }
  }
  return warnings;
}

export const reviewIntakeComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'review.intake@v1',
  build(context: ComposeBuildContext): unknown {
    const evidence = collectReviewEvidence(
      context.projectRoot,
      context.evidencePolicy?.includeUntrackedFileContent === true
        ? { includeUntrackedFileContent: true }
        : {},
    );
    return ReviewIntake.parse({
      scope: context.goal,
      evidence,
      evidence_warnings: evidenceWarnings(evidence),
    });
  },
};
