import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillId } from '../../src/schemas/ids.js';
import { createUserSkillRegistry } from '../../src/shared/user-skill-registry.js';

let root: string;
let agentsRoot: string;
let claudeRoot: string;

function writeSkill(base: string, id: string, body: string): void {
  const dir = join(base, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), body, 'utf8');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'circuit-next-user-skills-'));
  agentsRoot = join(root, '.agents', 'skills');
  claudeRoot = join(root, '.claude', 'skills');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('user skill registry', () => {
  it('discovers skills from agents and claude roots', () => {
    writeSkill(agentsRoot, 'tdd', 'Use tests first.');
    writeSkill(claudeRoot, 'react-doctor', 'Review React carefully.');

    const registry = createUserSkillRegistry({ roots: [agentsRoot, claudeRoot] });

    expect(
      registry
        .list()
        .map((skill) => skill.id as unknown as string)
        .sort(),
    ).toEqual(['react-doctor', 'tdd']);
  });

  it('prefers agents skills over claude skills on duplicate ids', () => {
    writeSkill(agentsRoot, 'tdd', 'Agents root wins.');
    writeSkill(claudeRoot, 'tdd', 'Claude root loses.');

    const registry = createUserSkillRegistry({ roots: [agentsRoot, claudeRoot] });
    const resolved = registry.resolve(SkillId.parse('tdd'));

    expect(resolved.body).toBe('Agents root wins.');
    expect(resolved.entry.root).toBe(agentsRoot);
  });

  it('ignores missing roots', () => {
    writeSkill(agentsRoot, 'tdd', 'Use tests first.');

    const registry = createUserSkillRegistry({
      roots: [agentsRoot, join(root, 'missing-skills')],
    });

    expect(registry.list().map((skill) => skill.id as unknown as string)).toEqual(['tdd']);
  });

  it('loads a skill body with no frontmatter', () => {
    writeSkill(agentsRoot, 'tdd', 'Use tests first.');

    const registry = createUserSkillRegistry({ roots: [agentsRoot] });
    const resolved = registry.resolve(SkillId.parse('tdd'));

    expect(resolved.body).toBe('Use tests first.');
    expect(resolved.entry.name).toBeUndefined();
  });

  it('parses optional frontmatter and ignores extra fields', () => {
    writeSkill(
      agentsRoot,
      'tdd',
      [
        '---',
        'name: Test Discipline',
        'description: Use tests first.',
        'trigger: when changing behavior',
        'extra: ignored',
        '---',
        'Follow red-green-refactor.',
      ].join('\n'),
    );

    const registry = createUserSkillRegistry({ roots: [agentsRoot] });
    const resolved = registry.resolve(SkillId.parse('tdd'));

    expect(resolved.entry.name).toBe('Test Discipline');
    expect(resolved.entry.description).toBe('Use tests first.');
    expect(resolved.entry.trigger).toBe('when changing behavior');
    expect(resolved.body).toBe('Follow red-green-refactor.');
  });

  it('fails clearly when a selected skill is missing', () => {
    const registry = createUserSkillRegistry({ roots: [agentsRoot, claudeRoot] });

    expect(() => registry.resolve(SkillId.parse('tdd'))).toThrow(
      /Circuit could not find skill 'tdd'[\s\S]*\.agents\/skills\/tdd\/SKILL\.md[\s\S]*\.claude\/skills\/tdd\/SKILL\.md/,
    );
  });

  it('fails clearly when selected skill frontmatter is invalid', () => {
    writeSkill(agentsRoot, 'tdd', ['---', 'name: 12', '---', 'Body'].join('\n'));
    const registry = createUserSkillRegistry({ roots: [agentsRoot] });

    expect(() => registry.resolve(SkillId.parse('tdd'))).toThrow(
      /skill frontmatter validation failed/,
    );
  });
});
