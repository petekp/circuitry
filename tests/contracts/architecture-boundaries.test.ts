import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('architecture boundary ratchets', () => {
  it('keeps connector sharing limited to subprocess lifecycle mechanics', () => {
    const lifecycle = read('src/connectors/subprocess.ts');
    const connectorBarrel = read('src/connectors/shared.ts');

    expect(lifecycle).toContain('runConnectorSubprocess');
    expect(existsSync('src/shared/connector-helpers.ts')).toBe(false);
    expect(lifecycle).not.toContain('../schemas/');
    expect(lifecycle).not.toContain('connector-helpers');
    expect(connectorBarrel).not.toContain('connector-helpers');
    expect(connectorBarrel).not.toContain('selectedModelForProvider');

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

  it('keeps verification command execution behind the shared proof-plan boundary', () => {
    const executor = read('src/runtime/executors/verification.ts');

    expect(executor).toContain('runProofPlanCommand');
    expect(executor).not.toContain('spawnSync');
    expect(executor).not.toContain('resolveProjectRelativeCwd');
    expect(executor).not.toContain('packageScriptInvocation');
  });
});
