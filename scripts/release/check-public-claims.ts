#!/usr/bin/env node

import {
  loadJsonWithSchema,
  loadReleaseChecks,
  loadReleaseSchemas,
  loadYamlWithSchema,
  pathExists,
} from './shared.ts';

async function main() {
  const schemas = await loadReleaseSchemas();
  const checks = await loadReleaseChecks();
  const claims = loadYamlWithSchema(
    'docs/release/claims/public-claims.yaml',
    schemas.PublicClaimLedger,
  );
  const current = loadJsonWithSchema(
    'generated/release/current-capabilities.json',
    schemas.CurrentCapabilitySnapshot,
  );
  const proofs = loadYamlWithSchema('docs/release/proofs/index.yaml', schemas.ProofScenarioIndex);
  const exceptions = loadYamlWithSchema(
    'docs/release/parity/exceptions.yaml',
    schemas.ParityExceptionLedger,
  );
  const result = checks.validatePublicClaims({
    claims,
    current,
    proofs,
    exceptions,
    pathExists,
  });
  for (const warning of result.warnings) console.warn(`tracked: ${warning}`);
  if (result.issues.length > 0) {
    for (const issue of result.issues) console.error(`error: ${issue}`);
    process.exit(1);
  }
  console.log('✓ public claims are backed or tracked');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
