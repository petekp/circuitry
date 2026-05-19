import { describe, expect, it } from 'vitest';

import {
  renderClaudeHostCommand,
  renderCodexHostCommand,
  renderCodexHostSkill,
} from '../../scripts/flows/host-renderers.ts';

const commandSource = `---
description: Use when the user wants Circuit to run a sample flow.
---

# /circuit:sample

<!-- generated-only note -->

The user's request is passed as the command input.

> **Argument:** $ARGUMENTS

## Instructions

1. **Confirm working directory.** The CLI is project-relative in source commands.
2. **Construct the Bash invocation SAFELY.**

\`\`\`bash
./bin/circuit run --goal 'sample' --progress jsonl
\`\`\`

Use the Bash tool to execute the constructed command. \`node "\${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts"\`
   is the installed wrapper for \`dist/cli/circuit.js\`.

3. **Render progress** from stderr and parse final JSON from stdout.

## Authority

- \`src/cli/circuit.ts\`
`;

describe('emit-flows host renderers', () => {
  it('renders Claude host commands through the presentation wrapper without comments', () => {
    const rendered = renderClaudeHostCommand(commandSource);

    expect(rendered).not.toContain('generated-only note');
    expect(rendered).toContain('Resolve plugin root');
    expect(rendered).toContain(
      'node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts" present run --goal',
    );
    expect(rendered).not.toContain('--progress jsonl');
    expect(rendered).toContain('Let the presentation wrapper render output');
  });

  it('renders Codex host commands with plugin-root wording and JSONL progress intact', () => {
    const rendered = renderCodexHostCommand(commandSource);

    expect(rendered).not.toContain('generated-only note');
    expect(rendered).toContain('Resolve plugin root');
    expect(rendered).toContain("node '<plugin root>/scripts/circuit.ts' run --goal");
    expect(rendered).toContain('--progress jsonl');
  });

  it('renders Codex skills without slash-command placeholders', () => {
    const rendered = renderCodexHostSkill('sample', commandSource);

    expect(rendered).toContain('name: sample');
    expect(rendered).toContain(
      'description: "Use when the user wants Circuit to run a sample flow."',
    );
    expect(rendered).toContain("Use the user's current request as the command input.");
    expect(rendered).not.toContain('$ARGUMENTS');
    expect(rendered).not.toContain('/circuit:');
    expect(rendered).not.toContain('slash command');
  });
});
