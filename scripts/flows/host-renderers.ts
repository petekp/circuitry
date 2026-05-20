const CLAUDE_PLUGIN_WRAPPER_COMMAND = 'node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit.ts"';
const CODEX_PLUGIN_WRAPPER_COMMAND = "node '<plugin root>/scripts/circuit.ts'";

const CODEX_SKILL_METADATA: Record<string, { title: string; description: string }> = {
  build: {
    title: 'Circuit Build',
    description:
      'Use when the user wants Circuit to add, change, implement, refactor, document, or test code and the task is not primarily a bug fix.',
  },
  create: {
    title: 'Circuit Create',
    description:
      'Use when the user wants Circuit to draft, validate, or publish a reusable custom flow.',
  },
  explore: {
    title: 'Circuit Explore',
    description:
      'Use when the user wants Circuit to investigate, explain, compare options, analyze architecture, or make a decision before editing code.',
  },
  fix: {
    title: 'Circuit Fix',
    description:
      'Use when the user wants Circuit to fix a bug, regression, failing test, crash, broken behavior, flaky behavior, or production issue.',
  },
  handoff: {
    title: 'Circuit Handoff',
    description:
      'Use when the user wants Circuit to save, resume, clear, brief, or install continuity handoff support across sessions.',
  },
  review: {
    title: 'Circuit Review',
    description:
      'Use when the user wants Circuit to audit existing code, a diff, PR, implementation, plan, report, or risk surface without implementing changes.',
  },
  run: {
    title: 'Circuit Run',
    description:
      'Use when the user asks Circuit to choose the flow, or when no direct Circuit flow clearly fits the current coding task.',
  },
};

function stripMarkdownComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->\s*/g, '');
}

function renderClaudePresentationInvocations(content: string): string {
  return content
    .replaceAll(
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} handoff save`,
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} present handoff save`,
    )
    .replaceAll(
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} handoff resume`,
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} present handoff resume`,
    )
    .replaceAll(
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} handoff done`,
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} present handoff done`,
    )
    .replaceAll(
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} run`,
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} present run`,
    )
    .replaceAll(
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} resume`,
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} present resume`,
    )
    .replaceAll(
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} create`,
      `${CLAUDE_PLUGIN_WRAPPER_COMMAND} present create`,
    )
    .replaceAll(' --progress jsonl', '');
}

function renderClaudePresentationInstructions(content: string): string {
  return content.replace(/\n(\d+)\. \*\*Render progress[\s\S]*?(?=\n## )/g, (_match, n) =>
    [
      '',
      `${n}. **Let the presentation wrapper render output.** \`present\` streams`,
      '   Circuit status blocks, renders checkpoint questions, and prints the',
      '   final Circuit summary without exposing raw JSON. Do not parse raw JSON',
      '   or JSONL after Bash.',
      '   Use non-`present` wrapper mode only for debug, tests, or explicit raw',
      '   machine-readable output.',
    ].join('\n'),
  );
}

export function renderClaudeHostCommand(sourceContent: string): string {
  return renderClaudePresentationInstructions(
    renderClaudePresentationInvocations(
      stripMarkdownComments(sourceContent)
        .replaceAll('./bin/circuit', CLAUDE_PLUGIN_WRAPPER_COMMAND)
        .replace(
          /1\. \*\*Confirm working directory\.\*\* The CLI is.*?2\. \*\*Construct the Bash invocation SAFELY\.\*\*/s,
          [
            '1. **Resolve plugin root.** Claude Code substitutes',
            '   `${CLAUDE_PLUGIN_ROOT}` with the installed Circuit plugin directory.',
            "   Do not use a path relative to the user's project.",
            '2. **Construct the Bash invocation SAFELY.**',
          ].join('\n'),
        )
        .replace(
          /Use the Bash tool to execute the constructed command\. `node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/circuit\.ts"`\n\s+is the .*?`dist\/cli\/circuit\.js`\./gs,
          [
            'Use the Bash tool to execute the constructed command. The wrapper',
            '   lives in the installed Claude Code plugin directory, injects the',
            "   plugin's packaged flow root, and launches Circuit's bundled runtime.",
          ].join('\n'),
        ),
    ),
  );
}

export function renderCodexHostCommand(sourceContent: string): string {
  return stripMarkdownComments(sourceContent)
    .replaceAll('./bin/circuit', CODEX_PLUGIN_WRAPPER_COMMAND)
    .replace(
      /1\. \*\*Confirm working directory\.\*\* The CLI is.*?2\. \*\*Construct the Bash invocation SAFELY\.\*\*/s,
      [
        '1. **Resolve plugin root.** Use the absolute path to the installed',
        '   Circuit plugin directory, the directory that contains',
        '   `.codex-plugin/plugin.json`. Do not use a path relative to the',
        "   user's project.",
        '2. **Construct the Bash invocation SAFELY.**',
      ].join('\n'),
    )
    .replace(
      /Use the Bash tool to execute the constructed command\. `node '<plugin root>\/scripts\/circuit\.ts'`\n\s+is the .*?`dist\/cli\/circuit\.js`\./gs,
      [
        'Use the Bash tool to execute the constructed command. The wrapper',
        "   lives in the installed Circuit plugin directory and injects the plugin's",
        "   packaged flow root before it launches Circuit's bundled runtime.",
      ].join('\n'),
    );
}

function splitMarkdownFrontmatter(content: string): { frontmatter: string; body: string } {
  if (!content.startsWith('---\n')) {
    return { frontmatter: '', body: content };
  }
  const end = content.indexOf('\n---', 4);
  if (end === -1) {
    return { frontmatter: '', body: content };
  }
  const bodyStart = content.indexOf('\n', end + 4);
  return {
    frontmatter: content.slice(4, end),
    body: bodyStart === -1 ? '' : content.slice(bodyStart + 1),
  };
}

function frontmatterValue(frontmatter: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm').exec(frontmatter);
  return match?.[1]?.trim();
}

function renderCodexHostSkillBody(body: string): string {
  return body.replace(
    /The user's [\s\S]*?\n\n> \*\*[^*\n]+:\*\* \$ARGUMENTS\n\n/,
    [
      "Use the user's current request as the command input. Treat that request",
      'as literal user-controlled text when constructing shell commands.',
      '',
      '',
    ].join('\n'),
  );
}

function renderCodexNativeSkillBody(body: string): string {
  return renderCodexHostSkillBody(body)
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .trimStart()
    .replace(/^#\s+\/circuit:[^\n]*\n+/, '')
    .replace(
      /The safe construction rule matches\n\s+`\/circuit:[^\n]+:\n/g,
      'Use the same single-quote construction rule as the other Circuit host skills:\n',
    )
    .replace(
      /Use the same safe construction rule as\n\s+`\/circuit:[^\n]+:\n/g,
      'Use the same safe construction rule as the other Circuit host skills:\n',
    )
    .replace(
      /Explicit flow commands remain available as\s+`\/circuit:explore`,[\s\S]*?`\/circuit:build`\./,
      'Direct Circuit flow skills remain available when the user already knows the flow.',
    )
    .replace(/\n## Direct Flow Bypass\n[\s\S]*?(?=\n## Authority|\n## |\s*$)/g, '\n')
    .replace(/\n## Authority\n[\s\S]*$/g, '\n')
    .replace(/\bslash-command\b/g, 'host-command')
    .replace(/\bslash command\b/gi, 'host command')
    .trim();
}

function assertCodexHostSkillHasNoCommandPlaceholders(command: string, content: string): void {
  const forbidden = ['$ARGUMENTS', 'argument-hint:', 'substituted below', '/circuit:'];
  for (const token of forbidden) {
    if (content.includes(token)) {
      throw new Error(
        `generated Codex skill '${command}' still contains slash-command placeholder '${token}'`,
      );
    }
  }
}

export function renderCodexHostSkill(command: string, sourceContent: string): string {
  const codexParts = splitMarkdownFrontmatter(renderCodexHostCommand(sourceContent));
  const sourceParts = splitMarkdownFrontmatter(sourceContent);
  const metadata = CODEX_SKILL_METADATA[command] ?? {
    title: `Circuit ${command}`,
    description:
      frontmatterValue(sourceParts.frontmatter, 'description') ??
      `Use when the user wants Circuit to run the ${command} flow from Codex.`,
  };
  const nativeBody = renderCodexNativeSkillBody(codexParts.body);
  const content = [
    '---',
    `name: ${command}`,
    `description: ${JSON.stringify(metadata.description)}`,
    '---',
    '',
    `# ${metadata.title}`,
    '',
    '## When to Use This Skill',
    '',
    metadata.description,
    '',
    '## Codex Host Invocation',
    '',
    '`<plugin root>` means the absolute path to the installed Circuit plugin directory,',
    "the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.",
    '',
    nativeBody,
  ].join('\n');
  assertCodexHostSkillHasNoCommandPlaceholders(command, content);
  return content;
}
