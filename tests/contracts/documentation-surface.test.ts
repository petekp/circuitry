import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');
const INVENTORY_PATH = 'docs/documentation-surface-inventory.md';

function readRepoFile(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

function markdownFilesUnder(path: string): string[] {
  const abs = resolve(REPO_ROOT, path);
  if (!existsSync(abs)) return [];
  const stat = statSync(abs);
  if (stat.isFile()) return path.endsWith('.md') ? [path] : [];

  return readdirSync(abs).flatMap((entry) => {
    const child = join(abs, entry);
    const rel = relative(REPO_ROOT, child);
    const childStat = statSync(child);
    if (childStat.isDirectory()) return markdownFilesUnder(rel);
    return rel.endsWith('.md') ? [rel] : [];
  });
}

function isExcludedHistoricalPath(path: string): boolean {
  return (
    path === INVENTORY_PATH ||
    path.startsWith('docs/internal/archive/') ||
    path.startsWith('docs/release/proofs/runs/') ||
    path.startsWith('docs/ideas/') ||
    path.startsWith('docs/learnings/')
  );
}

function isFlowCommandSource(path: string): boolean {
  return /^src\/flows\/[^/]+\/command\.md$/.test(path);
}

describe('documentation surface', () => {
  it('documents the approved active how-to sources and the consolidation inventory', () => {
    const docsMap = readRepoFile('docs/README.md');
    const inventory = readRepoFile(INVENTORY_PATH);

    expect(existsSync(resolve(REPO_ROOT, 'CLAUDE.md'))).toBe(false);
    expect(docsMap).toContain('## Approved Active How-To Locations');
    for (const link of [
      '[AGENTS.md](../AGENTS.md)',
      '[docs/agent-setup.md](agent-setup.md)',
      '[docs/first-run.md](first-run.md)',
      '[docs/operator-guide.md](operator-guide.md)',
      '[docs/configuration.md](configuration.md)',
      '[docs/flows/authoring-model.md](flows/authoring-model.md)',
      '[docs/generated-surfaces.md](generated-surfaces.md)',
      '[src/commands/README.md](../src/commands/README.md)',
      '[docs/release/proofs/README.md](release/proofs/README.md)',
      '[docs/host-trial-checklist.md](host-trial-checklist.md)',
    ]) {
      expect(docsMap).toContain(link);
    }
    expect(docsMap).toContain(INVENTORY_PATH);

    for (const decision of [
      '| Agent operating rules | `AGENTS.md` | Merge duplicate |',
      '| Flow authoring | `docs/flows/authoring-model.md` | Keep and expand |',
      '| Generated ownership | `docs/generated-surfaces.md` | Keep generated |',
      '| Retired Claude guide | `CLAUDE.md` | Remove |',
      '| Generated host mirrors | `plugins/claude/**`, `plugins/codex/**` | Generated |',
    ]) {
      expect(inventory).toContain(decision);
    }
  });

  it('keeps the host-ready flow-authoring playbook centralized', () => {
    const authoring = readRepoFile('docs/flows/authoring-model.md');

    for (const required of [
      'This is the flow-authoring playbook.',
      '### 2. Decide command ownership',
      '`paths.command`',
      '`plugins/claude/commands/<id>.md`',
      '`plugins/codex/commands/<id>.md`',
      '`plugins/codex/skills/<id>/SKILL.md`',
      'npm run sync:codex-plugin-cache',
      'npm run check-release-infra',
      'npm run check-flow-drift',
      'npm run verify',
    ]) {
      expect(authoring).toContain(required);
    }

    for (const pointerFile of [
      'AGENTS.md',
      'docs/architecture/declarative-flow-architecture.md',
      'docs/literate-guide.md',
      'src/commands/README.md',
      'docs/flows/pursue.md',
    ]) {
      expect(readRepoFile(pointerFile), pointerFile).toContain('docs/flows/authoring-model.md');
    }

    expect(readRepoFile('AGENTS.md')).not.toContain('Create `src/flows/<id>/` with `data.ts`');
    expect(readRepoFile('docs/architecture/declarative-flow-architecture.md')).not.toContain(
      '`plugins/codex/skills/**`',
    );
    expect(readRepoFile('src/commands/README.md')).not.toContain(
      'Claude Code commands: `plugins/claude/commands/<id>.md`',
    );
  });

  it('keeps approved active docs on the cutover path', () => {
    const activeCutoverDocs = [
      'README.md',
      'AGENTS.md',
      'UBIQUITOUS_LANGUAGE.md',
      'docs/README.md',
      'docs/agent-setup.md',
      'docs/architecture/declarative-flow-architecture.md',
      'docs/flows/authoring-model.md',
      'docs/flows/blocks.md',
      'docs/flows/explore-tournament.md',
      'docs/flows/pursue.md',
      'docs/literate-guide.md',
      'docs/operator-guide.md',
      'docs/generated-surfaces.md',
      'docs/script-inventory.md',
      'docs/release/public-announcement-demo-plan.md',
      'src/commands/README.md',
      'src/commands/create.md',
      'src/commands/run.md',
    ];
    const cutoverBackslide = /\b(?:legacy|compatibility|shim|back[- ]?compat)\b/i;

    const offenders = activeCutoverDocs
      .map((path) => ({ path, matches: readRepoFile(path).match(cutoverBackslide) }))
      .filter(({ matches }) => matches !== null)
      .map(({ path, matches }) => `${path}: ${matches?.[0]}`);

    expect(offenders).toEqual([]);
  });

  it('keeps active how-to markers inside approved locations', () => {
    const approved = new Set([
      'README.md',
      'AGENTS.md',
      'docs/README.md',
      'docs/agent-setup.md',
      'docs/first-run.md',
      'docs/operator-guide.md',
      'docs/configuration.md',
      'docs/flows/authoring-model.md',
      'docs/flows/blocks.md',
      'docs/generated-surfaces.md',
      'docs/host-trial-checklist.md',
      'docs/release/proofs/README.md',
      'docs/specs/narration-display-profiles.md',
      'docs/contracts/host-rendering.md',
      'src/commands/README.md',
      'src/commands/create.md',
      'src/commands/handoff.md',
      'src/commands/run.md',
    ]);

    const howToMarker =
      /(^# .*?(?:Runbook|Playbook|Checklist)|^## Adding A Flow|^## Adding a flow|^## Copy-Paste Prompt|Release QA checklist|source map for Circuit command surfaces|Do not hand-edit generated host output)/im;
    const files = [
      'README.md',
      'AGENTS.md',
      ...markdownFilesUnder('docs'),
      ...markdownFilesUnder('src/commands'),
      ...markdownFilesUnder('src/flows'),
    ].filter((path) => !isExcludedHistoricalPath(path));

    const offenders = files
      .filter((path) => howToMarker.test(readRepoFile(path)))
      .filter((path) => !approved.has(path))
      .filter((path) => !isFlowCommandSource(path));

    expect(offenders).toEqual([]);
  });
});
