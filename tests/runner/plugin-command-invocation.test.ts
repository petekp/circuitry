import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// These tests assert that the Claude Code plugin command bodies under
// `plugins/claude/commands/` are wired to the runtime rather than carrying placeholder
// "Not implemented yet" text AND that the runtime binding is
// demonstrated via an executable flow invocation in a fenced bash
// block (not merely a prose mention). Structural plugin-manifest +
// frontmatter requirements are covered by Check 23 +
// `tests/contracts/plugin-surface.test.ts`.
//
// Safe-construction: the unsafe `--goal "$ARGUMENTS"` double-quoted
// splice pattern is forbidden; a regression test rejects that exact
// pattern AND asserts that all fenced bash invocation examples use
// single-quoted --goal arguments. Tests extract fenced bash blocks and
// assert the invocation lives INSIDE a block (not merely in prose).
// Anti-pattern negative fixtures exercise prose-only mentions and
// classifier-pointer-only bodies so regressions cannot pass by keyword
// overlap. Manifest description consistency tracks the deterministic
// classifier truth.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const CLAUDE_COMMAND_ROOT = resolve(REPO_ROOT, 'plugins/claude/commands');
const EXPLORE_COMMAND_PATH = resolve(CLAUDE_COMMAND_ROOT, 'explore.md');
const RUN_COMMAND_PATH = resolve(CLAUDE_COMMAND_ROOT, 'run.md');
const REVIEW_COMMAND_PATH = resolve(CLAUDE_COMMAND_ROOT, 'review.md');
const BUILD_COMMAND_PATH = resolve(CLAUDE_COMMAND_ROOT, 'build.md');
const MANIFEST_PATH = resolve(REPO_ROOT, 'plugins/claude/.claude-plugin/plugin.json');
const CLAUDE_WRAPPER_PATTERN = String.raw`node "\$\{CLAUDE_PLUGIN_ROOT\}/scripts/circuit\.mjs"`;

// Extract fenced ```bash ... ``` blocks from a markdown body. Returns an
// array of block contents (without the fence markers). Multiple blocks per
// body are supported.
function extractBashBlocks(body: string): string[] {
  const regex = /```bash\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  for (const match of body.matchAll(regex)) {
    const block = match[1];
    if (block !== undefined) blocks.push(block);
  }
  return blocks;
}

// Does ANY fenced bash block in the body contain an executable flow
// invocation with the --goal flag? "Executable" means the flow appears
// as the CLI positional token after a supported Circuit launcher, AND the same line has
// `--goal `. Prose
// mentions, goal text, or negated ("do not run …") text DO NOT satisfy.
function hasExecutableCompiledFlowInvocation(body: string, flow: string): boolean {
  const blocks = extractBashBlocks(body);
  const flowPattern = flow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const binInvocation = new RegExp(`^\\s*\\.\\/bin\\/circuit run ${flowPattern}(?:\\s|$)`);
  const nodeInvocation = new RegExp(
    `^\\s*node dist\\/cli\\/circuit\\.js run ${flowPattern}(?:\\s|$)`,
  );
  const claudePluginInvocation = new RegExp(
    `^\\s*${CLAUDE_WRAPPER_PATTERN} present run ${flowPattern}(?:\\s|$)`,
  );
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      const hasCli =
        binInvocation.test(line) || nodeInvocation.test(line) || claudePluginInvocation.test(line);
      const hasGoal = /--goal\s+/.test(line);
      if (hasCli && hasGoal) return true;
    }
  }
  return false;
}

function hasExecutableExploreInvocation(body: string): boolean {
  return hasExecutableCompiledFlowInvocation(body, 'explore');
}

function hasExecutableReviewInvocation(body: string): boolean {
  return hasExecutableCompiledFlowInvocation(body, 'review');
}

function hasExecutableBuildInvocation(body: string): boolean {
  return hasExecutableCompiledFlowInvocation(body, 'build');
}

function hasExecutableRouterInvocation(body: string): boolean {
  const blocks = extractBashBlocks(body);
  const binInvocation = /^\s*\.\/bin\/circuit run --goal(?:\s|$)/;
  const nodeInvocation = /^\s*node dist\/cli\/circuit\.js run --goal(?:\s|$)/;
  const claudePluginInvocation = new RegExp(
    `^\\s*${CLAUDE_WRAPPER_PATTERN} present run --goal(?:\\s|$)`,
  );
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      if (
        binInvocation.test(line) ||
        nodeInvocation.test(line) ||
        claudePluginInvocation.test(line)
      ) {
        return true;
      }
    }
  }
  return false;
}

describe('plugin command invocation binding', () => {
  describe('real command bodies — positive assertions', () => {
    const exploreBody = readFileSync(EXPLORE_COMMAND_PATH, 'utf-8');
    const runBody = readFileSync(RUN_COMMAND_PATH, 'utf-8');
    const reviewBody = readFileSync(REVIEW_COMMAND_PATH, 'utf-8');
    const buildBody = readFileSync(BUILD_COMMAND_PATH, 'utf-8');

    it('plugins/claude/commands/explore.md has an executable explore invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableExploreInvocation(exploreBody)).toBe(true);
    });

    it('plugins/claude/commands/run.md has an executable classifier invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableRouterInvocation(runBody)).toBe(true);
    });

    it('plugins/claude/commands/review.md has an executable review invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableReviewInvocation(reviewBody)).toBe(true);
    });

    it('plugins/claude/commands/build.md has an executable build invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableBuildInvocation(buildBody)).toBe(true);
    });

    it('command bodies use the installed Claude plugin wrapper, not the repo-local launcher', () => {
      for (const body of [exploreBody, runBody, reviewBody, buildBody]) {
        expect(body).toContain('node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.mjs"');
        expect(body).not.toMatch(/\.\/bin\/circuit/);
        expect(body).not.toMatch(/npm run circuit:run/);
        expect(body).not.toMatch(/dist\/cli\/runtime-proof\.js/);
      }
    });
  });

  describe('HIGH 2 regression: --goal value is single-quoted (safe construction)', () => {
    const exploreBody = readFileSync(EXPLORE_COMMAND_PATH, 'utf-8');
    const runBody = readFileSync(RUN_COMMAND_PATH, 'utf-8');
    const reviewBody = readFileSync(REVIEW_COMMAND_PATH, 'utf-8');
    const buildBody = readFileSync(BUILD_COMMAND_PATH, 'utf-8');

    it('neither body contains the unsafe --goal "$ARGUMENTS" double-quoted splice', () => {
      // Double-quoting $ARGUMENTS expands $VAR, $(cmd), `cmd`, and \
      // sequences from user-controlled goal text — a shell-injection vector.
      // This literal pattern is forbidden.
      expect(exploreBody).not.toMatch(/--goal "\$ARGUMENTS"/);
      expect(runBody).not.toMatch(/--goal "\$ARGUMENTS"/);
      expect(reviewBody).not.toMatch(/--goal "\$ARGUMENTS"/);
      expect(buildBody).not.toMatch(/--goal "\$ARGUMENTS"/);
    });

    it('all fenced bash invocation blocks in plugins/claude/commands/explore.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(exploreBody).filter(
        (b) => /explore/.test(b) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        // --goal must be followed by a single-quoted argument; never
        // double-quoted (which would expand shell metacharacters).
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('all fenced bash invocation blocks in plugins/claude/commands/run.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(runBody).filter(
        (b) =>
          /(?:\.\/bin\/circuit|node dist\/cli\/circuit\.js|node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/circuit\.mjs")/.test(
            b,
          ) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('all fenced bash invocation blocks in plugins/claude/commands/review.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(reviewBody).filter(
        (b) => /review/.test(b) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('all fenced bash invocation blocks in plugins/claude/commands/build.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(buildBody).filter(
        (b) => /build/.test(b) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('all command bodies document the single-quote-with-escape rule for apostrophes', () => {
      // The safe construction documentation MUST mention the POSIX
      // single-quote escape sequence "'\''" so a future author does not
      // hand-reinvent an unsafe shape.
      expect(exploreBody).toMatch(/'\\''/);
      expect(runBody).toMatch(/'\\''/);
      expect(reviewBody).toMatch(/'\\''/);
      expect(buildBody).toMatch(/'\\''/);
    });
  });

  describe('MED 1 negative fixtures: prose-only / P2.8-only / negated bodies', () => {
    it('rejects a body that mentions the CLI only in prose (not a bash block)', () => {
      const proseOnly = `---
name: circuit:explore
description: stub
---

The CLI ./bin/circuit is documented somewhere else; this body does not invoke it.
`;
      expect(hasExecutableExploreInvocation(proseOnly)).toBe(false);
    });

    it('rejects a body that only carries a classifier pointer without an invocation block', () => {
      const p28Only = `---
name: circuit:run
description: stub
---

# /circuit:run

The router classifier chooses explore or review. See /circuit:explore for direct use.
`;
      expect(hasExecutableRouterInvocation(p28Only)).toBe(false);
    });

    it('rejects a body with a bash block that does not include an explore invocation', () => {
      const wrongBlock = `---
name: circuit:explore
description: stub
---

\`\`\`bash
echo "no invocation here"
\`\`\`
`;
      expect(hasExecutableExploreInvocation(wrongBlock)).toBe(false);
    });

    it('rejects review appearing only inside the goal text instead of as the flow token', () => {
      const wrongCompiledFlow = `---
name: circuit:review
description: stub
---

\`\`\`bash
./bin/circuit explore --goal 'review the latest change'
\`\`\`
`;
      expect(hasExecutableReviewInvocation(wrongCompiledFlow)).toBe(false);
    });

    it('accepts a body with a fenced bash block containing an explore invocation with --goal', () => {
      const goodBody = `---
name: circuit:explore
description: stub
---

\`\`\`bash
./bin/circuit run explore --goal 'find deprecated APIs'
\`\`\`
`;
      expect(hasExecutableExploreInvocation(goodBody)).toBe(true);
    });

    it('accepts a body using the compiled-JS path as the CLI identifier', () => {
      const compiledJsBody = `---
name: circuit:explore
description: stub
---

\`\`\`bash
node dist/cli/circuit.js run explore --goal 'find deprecated APIs'
\`\`\`
`;
      expect(hasExecutableExploreInvocation(compiledJsBody)).toBe(true);
    });
  });

  describe('manifest description consistency (MED 2 + ledger entry [6])', () => {
    const manifestBody = readFileSync(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestBody) as {
      name: string;
      description: string;
    };

    it('manifest name creates the public /circuit:* namespace', () => {
      expect(manifest.name).toBe('circuit');
    });

    it('manifest exposes /circuit:explore as a generated command', () => {
      expect(manifest.description).toMatch(/\/circuit:explore/);
    });

    it('manifest exposes /circuit:review as a generated command', () => {
      expect(manifest.description).toMatch(/\/circuit:review/);
    });

    it('manifest exposes /circuit:build as a generated command', () => {
      expect(manifest.description).toMatch(/\/circuit:build/);
    });
  });
});
