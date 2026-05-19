#!/usr/bin/env node
import { resolve } from 'node:path';
import { runSync } from './shared/process.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function main() {
  const result = runSync('git', ['ls-files', 'evals'], { cwd: REPO_ROOT });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.error || 'git ls-files failed');
  }
  const trackedResults = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('/results/'));

  if (trackedResults.length > 0) {
    throw new Error(`raw eval result files are tracked:\n${trackedResults.join('\n')}`);
  }

  process.stdout.write('Eval result hygiene OK\n');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`eval result hygiene check failed: ${message}\n`);
  process.exit(1);
}
