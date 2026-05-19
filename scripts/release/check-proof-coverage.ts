#!/usr/bin/env node

import { loadReleaseChecks, loadReleaseSchemas, loadYamlWithSchema, pathExists } from './shared.ts';

async function main() {
  const schemas = await loadReleaseSchemas();
  const checks = await loadReleaseChecks();
  const proofs = loadYamlWithSchema('docs/release/proofs/index.yaml', schemas.ProofScenarioIndex);
  const exceptions = loadYamlWithSchema(
    'docs/release/parity/exceptions.yaml',
    schemas.ParityExceptionLedger,
  );
  const result = checks.validateProofCoverage({ proofs, exceptions, pathExists });
  for (const warning of result.warnings) console.warn(`tracked: ${warning}`);
  if (result.issues.length > 0) {
    for (const issue of result.issues) console.error(`error: ${issue}`);
    process.exit(1);
  }
  console.log('✓ proof coverage is declared and tracked');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
