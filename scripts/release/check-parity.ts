#!/usr/bin/env node

import {
  loadJsonWithSchema,
  loadReleaseChecks,
  loadReleaseSchemas,
  loadYamlWithSchema,
} from './shared.ts';

async function main() {
  const schemas = await loadReleaseSchemas();
  const checks = await loadReleaseChecks();
  const original = loadYamlWithSchema(
    'docs/release/parity/original-circuit.yaml',
    schemas.OriginalCapabilitySnapshot,
  );
  const current = loadJsonWithSchema(
    'generated/release/current-capabilities.json',
    schemas.CurrentCapabilitySnapshot,
  );
  const exceptions = loadYamlWithSchema(
    'docs/release/parity/exceptions.yaml',
    schemas.ParityExceptionLedger,
  );
  const result = checks.compareParity({ original, current, exceptions });
  for (const warning of result.warnings) console.warn(`tracked: ${warning}`);
  if (result.issues.length > 0) {
    for (const issue of result.issues) console.error(`error: ${issue}`);
    process.exit(1);
  }
  console.log('✓ parity gaps are tracked');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
