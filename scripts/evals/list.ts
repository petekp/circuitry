#!/usr/bin/env node
import { resolve } from 'node:path';
import { readJson } from './shared/json.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const REGISTRY_PATH = resolve(REPO_ROOT, 'evals/registry.json');

type EvalRegistryEntry = {
  id: string;
  claim_level: string;
  claim_eligible?: boolean;
  flow: string;
  primary_metric: string;
};
type EvalRegistry = {
  evals: EvalRegistryEntry[];
  [key: string]: unknown;
};

function parseArgs(argv: readonly string[]): { json: boolean; claimGrade: boolean } {
  return {
    json: argv.includes('--json'),
    claimGrade: argv.includes('--claim-grade'),
  };
}

const args = parseArgs(process.argv.slice(2));
const registry = readJson<EvalRegistry>(REGISTRY_PATH);
const entries = args.claimGrade
  ? registry.evals.filter((entry) => entry.claim_level === 'claim-grade')
  : registry.evals;

if (args.json) {
  process.stdout.write(`${JSON.stringify({ ...registry, evals: entries }, null, 2)}\n`);
} else {
  for (const entry of entries) {
    const claim = entry.claim_eligible ? 'claim eligible' : 'not claim eligible';
    process.stdout.write(
      `${entry.id}: ${entry.claim_level}, flow=${entry.flow}, primary=${entry.primary_metric}, ${claim}\n`,
    );
  }
}
