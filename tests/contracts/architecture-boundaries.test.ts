import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('architecture boundary ratchets', () => {
  it('keeps connector sharing limited to subprocess lifecycle mechanics', () => {
    const lifecycle = read('src/connectors/subprocess.ts');

    expect(lifecycle).toContain('runConnectorSubprocess');
    expect(existsSync('src/connectors/shared.ts')).toBe(false);
    expect(existsSync('src/shared/connector-helpers.ts')).toBe(false);
    expect(lifecycle).not.toContain('../schemas/');
    expect(lifecycle).not.toContain('connector-helpers');

    for (const path of [
      'src/connectors/claude-code.ts',
      'src/connectors/codex.ts',
      'src/connectors/custom.ts',
    ]) {
      const source = read(path);
      expect(source, `${path} should use the shared subprocess lifecycle helper`).toContain(
        'runConnectorSubprocess',
      );
      expect(source, `${path} should not own detached spawn lifecycle code`).not.toMatch(
        /\bspawn\(/,
      );
    }
  });

  it('derives runtime trace domain types from the schema source of truth', () => {
    const traceDomain = read('src/runtime/domain/trace.ts');

    expect(traceDomain).toContain('../../schemas/trace-entry.js');
    expect(traceDomain).toContain('z.input<typeof TraceEntrySchema>');
    expect(traceDomain).not.toContain('export interface TraceEntryInput');
    expect(traceDomain).not.toContain("readonly kind: 'run.bootstrapped'");
  });

  it('keeps verification command execution behind the shared proof-plan boundary', () => {
    const executor = read('src/runtime/executors/verification.ts');

    expect(executor).toContain('runProofPlanCommand');
    expect(executor).not.toContain('spawnSync');
    expect(executor).not.toContain('resolveProjectRelativeCwd');
    expect(executor).not.toContain('packageScriptInvocation');
  });
});
