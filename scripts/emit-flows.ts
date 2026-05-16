// Build-time emit + CI drift check for compiled flow JSON files.
//
// Reads the active schematics declared by each flow package and
// compiles each to a CompileResult via
// src/flows/compile-schematic-to-flow.ts (consumed here through
// dist/), then writes canonical JSON files under generated/flows/<id>/.
// Public flows also mirror to the Claude Code package under
// plugins/claude/skills/<id>/ and Codex host output under
// plugins/circuit/flows/<id>/. Internal flows stay under generated/flows
// and are not installed into host-visible plugin surfaces.
//
// File layout:
//   - kind:'single'   → generated/flows/<id>/circuit.json
//                       (entry_modes carries the full schematic list)
//   - kind:'per-mode' → group compiled flows by graph identity
//                       (everything except entry_modes). The largest
//                       group goes to circuit.json with merged
//                       entry_modes; remaining modes get one file each
//                       at generated/flows/<id>/<mode-name>.json.
//                       The CLI loader prefers <mode>.json when an entry
//                       mode is requested and falls back to circuit.json.
//
// Modes:
//   node scripts/emit-flows.ts            → emit (write to disk)
//   node scripts/emit-flows.ts --check    → drift check (no write;
//                                               exit 1 if any output differs
//                                               from the committed file)
//
// Drift check pipeline mirrors emit exactly: compile → JSON.stringify(2) →
// biome format → compare bytes against committed file. Anything that makes
// emit output differ from committed bytes makes the check fail.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type * as CatalogModule from '../src/flows/catalog.js';
import type * as CompilerModule from '../src/flows/compile-schematic-to-flow.js';
import type * as FlowSchematicModule from '../src/schemas/flow-schematic.js';

type CompileResult = CompilerModule.CompileResult;
type CompiledFlow = Extract<CompileResult, { kind: 'single' }>['flow'];
type SchematicEntry = {
  id: string;
  visibility: 'public' | 'internal';
  schematicPath: string;
  commandSourcePath: string | undefined;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// SCHEMATICS is loaded from src/flows/catalog.ts (compiled to dist/)
// so adding a flow doesn't require touching this script. The compiled
// catalog is read once at startup and snapshotted into the constant
// below for the rest of the script.
async function loadSchematicsFromCatalog(): Promise<SchematicEntry[]> {
  const catalogPath = resolve(projectRoot, 'dist/flows/catalog.js');
  try {
    const mod = (await import(catalogPath)) as typeof CatalogModule;
    return mod.flowPackages.map((pkg) => ({
      id: pkg.id,
      visibility: pkg.visibility ?? 'public',
      schematicPath: pkg.paths.schematic,
      commandSourcePath: pkg.paths.command,
    }));
  } catch (err) {
    console.error(
      `\nCould not import flow catalog from dist/. Run \`npm run build\` first, then re-run this script.\n${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

const SCHEMATICS = await loadSchematicsFromCatalog();
const CLAUDE_PLUGIN_ROOT_REL = 'plugins/claude';
const CODEX_PLUGIN_ROOT_REL = 'plugins/circuit';
const SOURCE_COMMAND_ROOT_REL = 'src/commands';
const GENERATED_SURFACE_MAP_REL = 'docs/generated-surfaces.md';
const CLAUDE_PLUGIN_WRAPPER_COMMAND = 'node "${CLAUDE_PLUGIN_ROOT}/scripts/circuit-next.mjs"';
const CODEX_PLUGIN_WRAPPER_COMMAND = "node '<plugin root>/scripts/circuit-next.mjs'";
const HOST_DIRECT_COMMANDS = ['create', 'handoff', 'run'];
const ROOT_CLAUDE_MARKETPLACE_REL = '.claude-plugin/marketplace.json';
const LEGACY_ROOT_HOST_SURFACES = ['commands', 'hooks'];
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

// Slash command source files either live next to their flow under
// src/flows/<id>/command.md or, for direct/router commands, under
// src/commands/<id>.md. Host packages receive generated command copies.
function stripMarkdownComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->\s*/g, '');
}

function renderClaudeHostCommand(sourceContent: string): string {
  return renderClaudePresentationInstructions(
    renderClaudePresentationInvocations(
      stripMarkdownComments(sourceContent)
        .replaceAll('./bin/circuit-next', CLAUDE_PLUGIN_WRAPPER_COMMAND)
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
          /Use the Bash tool to execute the constructed command\. `node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/circuit-next\.mjs"`\n\s+is the .*?`dist\/cli\/circuit\.js`\./gs,
          [
            'Use the Bash tool to execute the constructed command. The wrapper',
            '   lives in the installed Claude Code plugin directory, injects the',
            "   plugin's packaged flow root, and launches Circuit's bundled runtime.",
          ].join('\n'),
        ),
    ),
  );
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

function renderCodexHostCommand(sourceContent: string): string {
  return stripMarkdownComments(sourceContent)
    .replaceAll('./bin/circuit-next', CODEX_PLUGIN_WRAPPER_COMMAND)
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
      /Use the Bash tool to execute the constructed command\. `node '<plugin root>\/scripts\/circuit-next\.mjs'`\n\s+is the .*?`dist\/cli\/circuit\.js`\./gs,
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
    .replace(/\bslash-command\b/g, 'host-command')
    .replace(/\bslash command\b/gi, 'host command')
    .trimStart();
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

function renderCodexHostSkill(command: string, sourceContent: string): string {
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

function copyMarkdownFile(
  sourceRel: string,
  destRel: string,
  label: string,
  transform: (content: string) => string = (content) => content,
): void {
  const sourceAbs = resolve(projectRoot, sourceRel);
  const destAbs = resolve(projectRoot, destRel);
  const sourceContent = transform(readFileSync(sourceAbs, 'utf8'));
  mkdirSync(dirname(destAbs), { recursive: true });
  writeFileSync(destAbs, sourceContent);
  console.log(`emitted ${destRel} (${label})`);
}

function checkMarkdownMirror(
  sourceRel: string,
  destRel: string,
  label: string,
  transform: (content: string) => string = (content) => content,
): boolean {
  const sourceAbs = resolve(projectRoot, sourceRel);
  const destAbs = resolve(projectRoot, destRel);
  let sourceContent: string;
  try {
    sourceContent = transform(readFileSync(sourceAbs, 'utf8'));
  } catch (_err) {
    console.error(`✗ ${sourceRel} is missing on disk but ${label} references it.`);
    return true;
  }
  let destContent: string;
  try {
    destContent = readFileSync(destAbs, 'utf8');
  } catch (_err) {
    console.error(
      `✗ ${destRel} is missing on disk; run \`npm run emit-flows\` to regenerate, then commit.`,
    );
    return true;
  }
  if (sourceContent === destContent) {
    console.log(`✓ ${destRel} is in sync with ${sourceRel}`);
    return false;
  }
  console.error(`✗ ${destRel} drifted from ${sourceRel}; run \`npm run emit-flows\`.`);
  return true;
}

function emitCommandFile(entry: SchematicEntry): void {
  if (entry.visibility !== 'public') return;
  if (entry.commandSourcePath === undefined) return;
  copyMarkdownFile(
    entry.commandSourcePath,
    `${CLAUDE_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
    `claude-code host command from ${entry.commandSourcePath}`,
    renderClaudeHostCommand,
  );
  copyMarkdownFile(
    entry.commandSourcePath,
    `${CODEX_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
    `codex host command from ${entry.commandSourcePath}`,
    renderCodexHostCommand,
  );
  copyMarkdownFile(
    entry.commandSourcePath,
    `${CODEX_PLUGIN_ROOT_REL}/skills/${entry.id}/SKILL.md`,
    `codex host skill from ${entry.commandSourcePath}`,
    (content) => renderCodexHostSkill(entry.id, content),
  );
}

function emitHostDirectCommands(): void {
  for (const command of HOST_DIRECT_COMMANDS) {
    copyMarkdownFile(
      `${SOURCE_COMMAND_ROOT_REL}/${command}.md`,
      `${CLAUDE_PLUGIN_ROOT_REL}/commands/${command}.md`,
      `claude-code host ${command} command`,
      renderClaudeHostCommand,
    );
    copyMarkdownFile(
      `${SOURCE_COMMAND_ROOT_REL}/${command}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/commands/${command}.md`,
      `codex host ${command} command`,
      renderCodexHostCommand,
    );
    copyMarkdownFile(
      `${SOURCE_COMMAND_ROOT_REL}/${command}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/skills/${command}/SKILL.md`,
      `codex host ${command} skill`,
      (content) => renderCodexHostSkill(command, content),
    );
  }
}

function checkCommandFile(entry: SchematicEntry): boolean {
  if (entry.visibility !== 'public') return false;
  if (entry.commandSourcePath === undefined) return false;
  const claudeDrifted = checkMarkdownMirror(
    entry.commandSourcePath,
    `${CLAUDE_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
    `${entry.id} claude-code host command`,
    renderClaudeHostCommand,
  );
  const codexDrifted = checkMarkdownMirror(
    entry.commandSourcePath,
    `${CODEX_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
    `${entry.id} codex host command`,
    renderCodexHostCommand,
  );
  const codexSkillDrifted = checkMarkdownMirror(
    entry.commandSourcePath,
    `${CODEX_PLUGIN_ROOT_REL}/skills/${entry.id}/SKILL.md`,
    `${entry.id} codex host skill`,
    (content) => renderCodexHostSkill(entry.id, content),
  );
  return claudeDrifted || codexDrifted || codexSkillDrifted;
}

function checkHostDirectCommands(): boolean {
  return HOST_DIRECT_COMMANDS.some((command) => {
    const claudeDrifted = checkMarkdownMirror(
      `${SOURCE_COMMAND_ROOT_REL}/${command}.md`,
      `${CLAUDE_PLUGIN_ROOT_REL}/commands/${command}.md`,
      `claude-code host ${command} command`,
      renderClaudeHostCommand,
    );
    const commandDrifted = checkMarkdownMirror(
      `${SOURCE_COMMAND_ROOT_REL}/${command}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/commands/${command}.md`,
      `codex host ${command} command`,
      renderCodexHostCommand,
    );
    const skillDrifted = checkMarkdownMirror(
      `${SOURCE_COMMAND_ROOT_REL}/${command}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/skills/${command}/SKILL.md`,
      `codex host ${command} skill`,
      (content) => renderCodexHostSkill(command, content),
    );
    return claudeDrifted || commandDrifted || skillDrifted;
  });
}

function markdownList(items: string[]): string {
  if (items.length === 0) return 'none';
  return items.map((item) => `\`${item}\``).join('<br>');
}

function markdownTableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function renderSurfaceInventory(): string {
  const rows = [
    [
      'Flow-owned commands',
      '`src/flows/<id>/command.md`',
      '`scripts/emit-flows.ts`',
      'source yes; outputs no',
      '`plugins/claude/commands/<id>.md`<br>`plugins/circuit/commands/<id>.md`<br>`plugins/circuit/skills/<id>/SKILL.md`',
      '`node scripts/emit-flows.ts --check`',
      'Only public flows with `paths.command` emit these surfaces. Generated headers are omitted to preserve host command and skill parsing.',
    ],
    [
      'Direct command sources',
      '`src/commands/<id>.md`',
      '`scripts/emit-flows.ts` mirrors to host plugin surfaces',
      'source yes; outputs no',
      '`plugins/claude/commands/<id>.md`<br>`plugins/circuit/commands/<id>.md`<br>`plugins/circuit/skills/<id>/SKILL.md`',
      '`node scripts/emit-flows.ts --check`',
      'Covers router/direct commands such as run, create, and handoff.',
    ],
    [
      'Generated flow manifests',
      '`src/flows/<id>/schematic.json` plus flow package metadata',
      '`npm run build && node scripts/emit-flows.ts`',
      'no',
      '`generated/flows/<id>/*.json`',
      '`node scripts/emit-flows.ts --check`',
      'Canonical compiled-flow outputs. JSON cannot carry generated headers without changing host parsing.',
    ],
    [
      'Claude plugin flow mirrors',
      '`generated/flows/<id>/*.json`',
      '`scripts/emit-flows.ts`',
      'no',
      '`plugins/claude/skills/<id>/*.json`',
      '`node scripts/emit-flows.ts --check`',
      'Public flows only. Internal flow mirrors are stale and fail drift checks.',
    ],
    [
      'Codex plugin flow mirrors',
      '`generated/flows/<id>/*.json`',
      '`scripts/emit-flows.ts`',
      'no',
      '`plugins/circuit/flows/<id>/*.json`',
      '`node scripts/emit-flows.ts --check`',
      'Public flows only. Internal flow mirrors are stale and fail drift checks.',
    ],
    [
      'Codex plugin command mirrors',
      'flow-owned command sources or direct command sources',
      '`scripts/emit-flows.ts`',
      'no',
      '`plugins/circuit/commands/<id>.md`',
      '`node scripts/emit-flows.ts --check`',
      'Generated headers are omitted to preserve host command parsing and byte-for-byte mirror checks.',
    ],
    [
      'Codex plugin skill surfaces',
      'flow-owned command sources or direct command sources',
      '`scripts/emit-flows.ts`',
      'no',
      '`plugins/circuit/skills/<id>/SKILL.md`',
      '`node scripts/emit-flows.ts --check`',
      'Skill metadata is generated from script-owned metadata plus command source body.',
    ],
    [
      'Command ownership note',
      '`src/commands/README.md`',
      'none',
      'yes',
      '`src/commands/README.md`',
      'normal docs review',
      'Documents direct command source ownership; host command files are generated mirrors.',
    ],
  ];
  return [
    '## Surface Inventory',
    '',
    markdownTableRow([
      'Surface',
      'Source of truth',
      'Generator',
      'Human-editable',
      'Expected destinations',
      'Validation / drift check',
      'Notes',
    ]),
    markdownTableRow(['---', '---', '---', '---', '---', '---', '---']),
    ...rows.map((row) => markdownTableRow(row)),
    '',
  ].join('\n');
}

function commandSurfacesForEntry(entry: SchematicEntry): string[] {
  if (entry.visibility !== 'public') return [];
  if (entry.commandSourcePath !== undefined) {
    return [
      `${CLAUDE_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/skills/${entry.id}/SKILL.md`,
    ];
  }
  if (HOST_DIRECT_COMMANDS.includes(entry.id)) {
    return [
      `${CLAUDE_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/skills/${entry.id}/SKILL.md`,
    ];
  }
  return [];
}

function commandSourceForEntry(entry: SchematicEntry): string {
  if (entry.visibility !== 'public') return 'none';
  if (entry.commandSourcePath !== undefined) return `\`${entry.commandSourcePath}\``;
  if (HOST_DIRECT_COMMANDS.includes(entry.id))
    return `\`${SOURCE_COMMAND_ROOT_REL}/${entry.id}.md\``;
  return 'none';
}

function editRuleForEntry(entry: SchematicEntry): string {
  if (entry.commandSourcePath !== undefined) {
    return 'Edit the flow package source; run `npm run emit-flows`.';
  }
  if (HOST_DIRECT_COMMANDS.includes(entry.id)) {
    return 'Edit the direct command source; run `npm run emit-flows`.';
  }
  if (entry.visibility === 'internal') {
    return 'Edit the flow package; host mirrors must not exist.';
  }
  return 'Edit the flow package; run `npm run emit-flows`.';
}

async function renderGeneratedSurfaceMap(): Promise<string> {
  const flowRows: string[] = [];
  for (const entry of SCHEMATICS) {
    const result = await compileOneSchematic(entry.schematicPath);
    const plan = planSchematicFiles(entry.id, result);
    const compiledOutputs = plan.map((p) => p.outRel);
    const hostMirrors =
      entry.visibility === 'public'
        ? [
            ...claudeHostPlan(plan).map((p) => p.outRel),
            ...codexHostPlan(plan).map((p) => p.outRel),
          ]
        : [];
    flowRows.push(
      markdownTableRow([
        `\`${entry.id}\``,
        `\`${entry.visibility}\``,
        `\`${entry.schematicPath}\``,
        markdownList(compiledOutputs),
        entry.visibility === 'public' ? markdownList(hostMirrors) : 'none; internal flow',
        commandSourceForEntry(entry),
        markdownList(commandSurfacesForEntry(entry)),
        editRuleForEntry(entry),
      ]),
    );
  }

  const commandRows = HOST_DIRECT_COMMANDS.map((command) =>
    markdownTableRow([
      `\`${command}\``,
      `\`${SOURCE_COMMAND_ROOT_REL}/${command}.md\``,
      markdownList([
        `${CLAUDE_PLUGIN_ROOT_REL}/commands/${command}.md`,
        `${CODEX_PLUGIN_ROOT_REL}/commands/${command}.md`,
        `${CODEX_PLUGIN_ROOT_REL}/skills/${command}/SKILL.md`,
      ]),
      'Edit the direct command source; run `npm run emit-flows`.',
    ]),
  );

  return `${[
    '# Generated Surface Source Map',
    '',
    '<!-- This file is generated by scripts/emit-flows.ts. Do not edit by hand. -->',
    '',
    'This is the source map for Circuit command surfaces, compiled flow outputs, host mirrors, and edit rules.',
    '',
    '## Edit Rules',
    '',
    '- Flow package schematics are authored in `src/flows/<id>/schematic.json`.',
    '- Flow-owned commands are authored in `src/flows/<id>/command.md`.',
    '- Direct commands are authored in `src/commands/<id>.md`.',
    '- Canonical compiled manifests under `generated/flows/**` are generated outputs.',
    '- Host mirrors under `plugins/claude/skills/**`, `plugins/claude/commands/**`, `plugins/circuit/flows/**`, `plugins/circuit/commands/**`, and `plugins/circuit/skills/**` are generated outputs.',
    '- Internal flows emit only under `generated/flows/**`; host mirrors for internal flows are stale and fail the drift check.',
    '- After editing an authored source, run `npm run build && npm run emit-flows`, then verify.',
    '',
    renderSurfaceInventory(),
    '## Flow Outputs',
    '',
    markdownTableRow([
      'Flow',
      'Visibility',
      'Schematic source',
      'Generated compiled outputs',
      'Host flow mirrors',
      'Command source',
      'Command surfaces',
      'Edit rule',
    ]),
    markdownTableRow(['---', '---', '---', '---', '---', '---', '---', '---']),
    ...flowRows,
    '',
    '## Direct Commands',
    '',
    'Direct commands are source files under `src/commands/`. Some also correspond to routable flows that do not own `paths.command`.',
    '',
    markdownTableRow(['Command', 'Command source', 'Host mirrors', 'Edit rule']),
    markdownTableRow(['---', '---', '---', '---']),
    ...commandRows,
    '',
    '## Drift Check',
    '',
    '`node scripts/emit-flows.ts --check` verifies this file, generated manifests, command mirrors, host flow mirrors, stale per-mode siblings, stale internal host mirrors, and stale Codex skill directories.',
    '',
  ].join('\n')}\n`;
}

async function emitGeneratedSurfaceMap(): Promise<void> {
  const outAbs = resolve(projectRoot, GENERATED_SURFACE_MAP_REL);
  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, await renderGeneratedSurfaceMap());
  console.log(`emitted ${GENERATED_SURFACE_MAP_REL}`);
}

async function checkGeneratedSurfaceMap(): Promise<boolean> {
  const expected = await renderGeneratedSurfaceMap();
  let actual: string;
  try {
    actual = readFileSync(resolve(projectRoot, GENERATED_SURFACE_MAP_REL), 'utf8');
  } catch (_err) {
    console.error(
      `✗ ${GENERATED_SURFACE_MAP_REL} is missing on disk. Run \`npm run emit-flows\` to regenerate, then commit.`,
    );
    return true;
  }
  if (actual === expected) {
    console.log(`✓ ${GENERATED_SURFACE_MAP_REL} is in sync with scripts/emit-flows.ts`);
    return false;
  }
  console.error(
    `✗ ${GENERATED_SURFACE_MAP_REL} drifted from scripts/emit-flows.ts. Run \`npm run emit-flows\`.`,
  );
  return true;
}

function expectedCodexSkillIds(): Set<string> {
  return new Set([
    ...SCHEMATICS.filter(
      (entry) => entry.visibility === 'public' && entry.commandSourcePath !== undefined,
    ).map((entry) => entry.id),
    ...HOST_DIRECT_COMMANDS,
  ]);
}

function findStaleCodexSkillDirs(expected: Set<string>): string[] {
  const skillsRoot = resolve(projectRoot, `${CODEX_PLUGIN_ROOT_REL}/skills`);
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !expected.has(entry.name))
    .map((entry) => `${CODEX_PLUGIN_ROOT_REL}/skills/${entry.name}`);
}

async function loadCompilerModule(): Promise<typeof CompilerModule> {
  // dist/flows/compile-schematic-to-flow.js is produced by `npm run
  // build`. The emit script depends on a fresh dist/, so callers should
  // run `npm run build` first (the verify pipeline does this in order).
  const distPath = resolve(projectRoot, 'dist/flows/compile-schematic-to-flow.js');
  try {
    return (await import(distPath)) as typeof CompilerModule;
  } catch (err) {
    console.error(
      `\nCould not import compiler from dist/. Run \`npm run build\` first, then re-run this script.\n${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

async function loadSchematicSchemaModule(): Promise<typeof FlowSchematicModule> {
  const distPath = resolve(projectRoot, 'dist/schemas/flow-schematic.js');
  return (await import(distPath)) as typeof FlowSchematicModule;
}

async function compileOneSchematic(schematicPath: string): Promise<CompileResult> {
  const [{ compileSchematicToCompiledFlow }, { FlowSchematic }] = await Promise.all([
    loadCompilerModule(),
    loadSchematicSchemaModule(),
  ]);
  const raw = JSON.parse(readFileSync(resolve(projectRoot, schematicPath), 'utf8'));
  const schematic = FlowSchematic.parse(raw);
  return compileSchematicToCompiledFlow(schematic);
}

function stringifyCompiledFlow(flow: CompiledFlow): string {
  return `${JSON.stringify(flow, null, 2)}\n`;
}

function biomeFormatInPlace(absolutePath: string): void {
  execFileSync('npx', ['biome', 'format', '--write', absolutePath], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}

// Stable structural identity for grouping per-mode flows. Two compiled
// flows belong to the same group when their stringified form (with
// entry_modes stripped) is byte-identical. JSON.stringify is deterministic
// for our object construction order.
function graphIdentityHash(flow: CompiledFlow): string {
  const { entry_modes: _entryModes, ...rest } = flow;
  return JSON.stringify(rest);
}

type SchematicFilePlan = {
  outRel: string;
  flow: CompiledFlow;
};

// Decide the per-schematic file plan: what to write, where, and with which
// entry_modes payload. Exposed so the emit and check paths share the
// same logic.
function planSchematicFiles(id: string, result: CompileResult): SchematicFilePlan[] {
  if (result.kind === 'single') {
    return [
      {
        outRel: `generated/flows/${id}/circuit.json`,
        flow: result.flow,
      },
    ];
  }
  // per-mode
  const groups = new Map<string, { modes: string[]; flow: CompiledFlow }>();
  for (const [modeName, flow] of result.flows) {
    const hash = graphIdentityHash(flow);
    const existing = groups.get(hash);
    if (existing === undefined) {
      groups.set(hash, { modes: [modeName], flow });
    } else {
      existing.modes.push(modeName);
    }
  }
  // Sort by group size descending, then by first mode name for deterministic
  // tie-breaking.
  const ordered = [...groups.values()].sort((a, b) => {
    if (b.modes.length !== a.modes.length) return b.modes.length - a.modes.length;
    const aFirst = a.modes[0] ?? '';
    const bFirst = b.modes[0] ?? '';
    return aFirst.localeCompare(bFirst);
  });
  const plan: SchematicFilePlan[] = [];
  // Largest group → circuit.json, with entry_modes spanning all modes in
  // that group. Read each mode's compiled entry_modes[0] from the original
  // result so per-mode depth/description survive.
  const main = ordered[0];
  if (main === undefined) return plan;
  const mainEntryModes = main.modes.map((m) => {
    const flow = result.flows.get(m);
    if (flow === undefined) {
      throw new Error(`compiler returned no flow for mode '${m}' in '${id}'`);
    }
    const firstEntryMode = flow.entry_modes[0];
    if (firstEntryMode === undefined) {
      throw new Error(`compiled flow for mode '${m}' in '${id}' has no entry_modes`);
    }
    return firstEntryMode;
  });
  plan.push({
    outRel: `generated/flows/${id}/circuit.json`,
    flow: { ...main.flow, entry_modes: mainEntryModes },
  });
  // Remaining groups → one file per mode in those groups, with single-mode
  // entry_modes (already shaped that way by the compiler).
  for (let i = 1; i < ordered.length; i++) {
    const group = ordered[i];
    if (group === undefined) continue;
    for (const modeName of group.modes) {
      const flow = result.flows.get(modeName);
      if (flow === undefined) {
        throw new Error(`compiler returned no flow for mode '${modeName}' in '${id}'`);
      }
      plan.push({
        outRel: `generated/flows/${id}/${modeName}.json`,
        flow,
      });
    }
  }
  return plan;
}

function claudeHostRel(canonicalRel: string): string {
  return canonicalRel.replace(/^generated\/flows\//, `${CLAUDE_PLUGIN_ROOT_REL}/skills/`);
}

function claudeHostPlan(plan: SchematicFilePlan[]): SchematicFilePlan[] {
  return plan.map((p) => ({ ...p, outRel: claudeHostRel(p.outRel) }));
}

function codexHostRel(canonicalRel: string): string {
  return canonicalRel.replace(/^generated\/flows\//, `${CODEX_PLUGIN_ROOT_REL}/flows/`);
}

function codexHostPlan(plan: SchematicFilePlan[]): SchematicFilePlan[] {
  return plan.map((p) => ({ ...p, outRel: codexHostRel(p.outRel) }));
}

// Returns the set of unexpected `*.json` files in a generated flow directory:
// anything on disk under `<rootRel>/<id>/` that ends in `.json`
// but isn't in the emit plan. These are stale per-mode siblings from a
// renamed/collapsed entry mode.
function findStaleSiblings(id: string, plan: SchematicFilePlan[], rootRel: string): string[] {
  const skillDirAbs = resolve(projectRoot, `${rootRel}/${id}`);
  if (!existsSync(skillDirAbs)) return [];
  const expected = new Set(plan.map((p) => basename(p.outRel)));
  return readdirSync(skillDirAbs)
    .filter((name) => name.endsWith('.json') && !expected.has(name))
    .map((name) => `${rootRel}/${id}/${name}`);
}

function internalHostMirrorDirs(entry: SchematicEntry): string[] {
  if (entry.visibility !== 'internal') return [];
  return [
    `${CLAUDE_PLUGIN_ROOT_REL}/skills/${entry.id}`,
    `${CODEX_PLUGIN_ROOT_REL}/flows/${entry.id}`,
  ];
}

function findExistingInternalHostMirrorDirs(entry: SchematicEntry): string[] {
  return internalHostMirrorDirs(entry).filter((rel) => existsSync(resolve(projectRoot, rel)));
}

function findLegacyRootHostSurfaces(): string[] {
  const surfaces = LEGACY_ROOT_HOST_SURFACES.filter((rel) => existsSync(resolve(projectRoot, rel)));
  const rootClaudePluginRel = '.claude-plugin';
  const rootClaudePluginAbs = resolve(projectRoot, rootClaudePluginRel);
  if (!existsSync(rootClaudePluginAbs)) return surfaces;

  for (const entry of readdirSync(rootClaudePluginAbs)) {
    const rel = `${rootClaudePluginRel}/${entry}`;
    if (rel !== ROOT_CLAUDE_MARKETPLACE_REL) {
      surfaces.push(rel);
    }
  }
  return surfaces;
}

async function emitMode(): Promise<void> {
  const expectedSkills = expectedCodexSkillIds();
  for (const entry of SCHEMATICS) {
    const result = await compileOneSchematic(entry.schematicPath);
    const plan = planSchematicFiles(entry.id, result);
    for (const { outRel, flow } of plan) {
      const outAbs = resolve(projectRoot, outRel);
      mkdirSync(dirname(outAbs), { recursive: true });
      writeFileSync(outAbs, stringifyCompiledFlow(flow));
      biomeFormatInPlace(outAbs);
      console.log(`emitted ${outRel}`);
      if (entry.visibility !== 'public') continue;
      const hostRel = claudeHostRel(outRel);
      const hostAbs = resolve(projectRoot, hostRel);
      mkdirSync(dirname(hostAbs), { recursive: true });
      writeFileSync(hostAbs, readFileSync(outAbs, 'utf8'));
      console.log(`emitted ${hostRel} (claude-code host output)`);
      const codexRel = codexHostRel(outRel);
      const codexAbs = resolve(projectRoot, codexRel);
      mkdirSync(dirname(codexAbs), { recursive: true });
      writeFileSync(codexAbs, readFileSync(outAbs, 'utf8'));
      console.log(`emitted ${codexRel} (codex host output)`);
    }
    // Stale `<mode>.json` siblings would otherwise survive emit and silently
    // drive runtime behavior via the CLI loader. Treat them as stale outputs
    // of this build step and remove them.
    for (const stale of [
      ...findStaleSiblings(entry.id, plan, 'generated/flows'),
      ...(entry.visibility === 'public'
        ? [
            ...findStaleSiblings(
              entry.id,
              claudeHostPlan(plan),
              `${CLAUDE_PLUGIN_ROOT_REL}/skills`,
            ),
            ...findStaleSiblings(entry.id, codexHostPlan(plan), `${CODEX_PLUGIN_ROOT_REL}/flows`),
          ]
        : []),
    ]) {
      unlinkSync(resolve(projectRoot, stale));
      console.log(`removed stale ${stale}`);
    }
    for (const staleDir of findExistingInternalHostMirrorDirs(entry)) {
      rmSync(resolve(projectRoot, staleDir), { recursive: true, force: true });
      console.log(`removed internal host mirror ${staleDir}`);
    }
    emitCommandFile(entry);
  }
  emitHostDirectCommands();
  await emitGeneratedSurfaceMap();
  for (const stale of findStaleCodexSkillDirs(expectedSkills)) {
    rmSync(resolve(projectRoot, stale), { recursive: true, force: true });
    console.log(`removed stale ${stale}`);
  }
  for (const stale of findLegacyRootHostSurfaces()) {
    rmSync(resolve(projectRoot, stale), { recursive: true, force: true });
    console.log(`removed legacy root host surface ${stale}`);
  }
}

async function checkMode(): Promise<void> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'flow-drift-'));
  let drifted = false;
  const expectedSkills = expectedCodexSkillIds();
  try {
    for (const entry of SCHEMATICS) {
      const result = await compileOneSchematic(entry.schematicPath);
      const plan = planSchematicFiles(entry.id, result);
      for (const { outRel, flow } of plan) {
        const tmpFile = join(tmpDir, outRel.replace(/[/]/g, '_'));
        writeFileSync(tmpFile, stringifyCompiledFlow(flow));
        biomeFormatInPlace(tmpFile);
        const compiledBytes = readFileSync(tmpFile, 'utf8');
        const committedAbs = resolve(projectRoot, outRel);
        let committedBytes: string;
        try {
          committedBytes = readFileSync(committedAbs, 'utf8');
        } catch (_err) {
          console.error(
            `✗ ${outRel} is missing on disk but the schematic compiles to it. Run \`npm run emit-flows\` to regenerate, then commit.`,
          );
          drifted = true;
          continue;
        }
        if (compiledBytes === committedBytes) {
          console.log(`✓ ${outRel} is in sync with ${entry.schematicPath}`);
        } else {
          console.error(`✗ ${outRel} drifted from compiled output of ${entry.schematicPath}`);
          console.error('  Run `npm run emit-flows` to regenerate, then commit the diff.');
          drifted = true;
        }
        if (entry.visibility === 'public') {
          const hostRel = claudeHostRel(outRel);
          let hostBytes: string;
          try {
            hostBytes = readFileSync(resolve(projectRoot, hostRel), 'utf8');
          } catch (_err) {
            console.error(
              `✗ ${hostRel} is missing on disk but the claude-code host compiles to it. Run \`npm run emit-flows\` to regenerate, then commit.`,
            );
            drifted = true;
            continue;
          }
          if (compiledBytes === hostBytes) {
            console.log(`✓ ${hostRel} mirrors ${outRel}`);
          } else {
            console.error(`✗ ${hostRel} drifted from canonical ${outRel}`);
            console.error('  Run `npm run emit-flows` to regenerate, then commit the diff.');
            drifted = true;
          }
          const codexRel = codexHostRel(outRel);
          let codexBytes: string;
          try {
            codexBytes = readFileSync(resolve(projectRoot, codexRel), 'utf8');
          } catch (_err) {
            console.error(
              `✗ ${codexRel} is missing on disk but the codex host compiles to it. Run \`npm run emit-flows\` to regenerate, then commit.`,
            );
            drifted = true;
            continue;
          }
          if (compiledBytes === codexBytes) {
            console.log(`✓ ${codexRel} mirrors ${outRel}`);
          } else {
            console.error(`✗ ${codexRel} drifted from canonical ${outRel}`);
            console.error('  Run `npm run emit-flows` to regenerate, then commit the diff.');
            drifted = true;
          }
        }
      }
      // Stale `<mode>.json` siblings in this skill dir would silently drive
      // runtime behavior via the CLI loader, while the byte-by-byte check
      // above only ranges over files in the current emit plan.
      const stale = [
        ...findStaleSiblings(entry.id, plan, 'generated/flows'),
        ...(entry.visibility === 'public'
          ? [
              ...findStaleSiblings(
                entry.id,
                claudeHostPlan(plan),
                `${CLAUDE_PLUGIN_ROOT_REL}/skills`,
              ),
              ...findStaleSiblings(entry.id, codexHostPlan(plan), `${CODEX_PLUGIN_ROOT_REL}/flows`),
            ]
          : []),
      ];
      for (const rel of stale) {
        console.error(
          `✗ ${rel} is not in the emit plan for ${entry.schematicPath}. Run \`npm run emit-flows\` to clean up stale siblings, then commit the deletion.`,
        );
        drifted = true;
      }
      for (const rel of findExistingInternalHostMirrorDirs(entry)) {
        console.error(
          `✗ ${rel} is a stale host mirror for internal flow '${entry.id}'. Run \`npm run emit-flows\` to remove it, then commit the deletion.`,
        );
        drifted = true;
      }
      if (checkCommandFile(entry)) {
        drifted = true;
      }
    }
    if (checkHostDirectCommands()) {
      drifted = true;
    }
    if (await checkGeneratedSurfaceMap()) {
      drifted = true;
    }
    for (const stale of findStaleCodexSkillDirs(expectedSkills)) {
      console.error(
        `✗ ${stale} is not an expected Codex skill. Run \`npm run emit-flows\` to clean up stale skills, then commit the deletion.`,
      );
      drifted = true;
    }
    for (const stale of findLegacyRootHostSurfaces()) {
      console.error(
        `✗ ${stale} is a legacy root host surface. Run \`npm run emit-flows\` to remove it, then commit the deletion.`,
      );
      drifted = true;
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  if (drifted) process.exit(1);
}

const isCheck = process.argv.includes('--check');
if (isCheck) {
  await checkMode();
} else {
  await emitMode();
}
