import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { CompiledFlow } from '../schemas/compiled-flow.js';
import { validateCompiledFlowKindPolicy } from '../shared/flow-kind-policy.js';
import { progressPresentation } from '../shared/progress-output.js';
import { CUSTOM_FLOW_ROOT_RUNTIME_POLICY } from './runtime-routing-policy.js';
import { utilityProgress } from './utility-progress.js';

interface CreateArgs {
  readonly name?: string;
  readonly description?: string;
  readonly home?: string;
  readonly templateFlowRoot?: string;
  readonly publish: boolean;
  readonly yes: boolean;
  readonly createdAt?: string;
  readonly progress: boolean;
}

interface CreateMainOptions {
  readonly now?: () => Date;
}

const RESERVED_FLOW_IDS = new Set([
  'build',
  'explore',
  'fix',
  'handoff',
  'migrate',
  'review',
  'run',
  'sweep',
]);

function usage(): string {
  return [
    'usage: circuit-next create --description "<flow idea>" [--name <slug>] [--home <path>] [--template-flow-root <path>] [--publish --yes] [--progress jsonl]',
    '',
    'Drafts a user-global custom flow package. Without --publish it only writes a draft; with --publish --yes it promotes the draft into the user-global flow root.',
  ].join('\n');
}

function takeValue(argv: readonly string[], index: number, flag: string): string {
  const next = argv[index + 1];
  if (next === undefined || next.length === 0) throw new Error(`${flag} requires a value`);
  return next;
}

function parseArgs(argv: readonly string[]): CreateArgs {
  let name: string | undefined;
  let description: string | undefined;
  let home: string | undefined;
  let templateFlowRoot: string | undefined;
  let publish = false;
  let yes = false;
  let createdAt: string | undefined;
  let progress = false;

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === undefined) continue;
    if (tok === '--name') {
      name = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--description') {
      description = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--home') {
      home = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--template-flow-root') {
      templateFlowRoot = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--created-at') {
      createdAt = takeValue(argv, i, tok);
      i += 1;
      continue;
    }
    if (tok === '--publish') {
      publish = true;
      continue;
    }
    if (tok === '--yes') {
      yes = true;
      continue;
    }
    if (tok === '--progress') {
      const value = takeValue(argv, i, tok);
      if (value !== 'jsonl') throw new Error("--progress only supports 'jsonl'");
      progress = true;
      i += 1;
      continue;
    }
    if (tok === '--help' || tok === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    throw new Error(tok.startsWith('--') ? `unknown flag: ${tok}` : `unexpected argument: ${tok}`);
  }

  return {
    publish,
    yes,
    progress,
    ...(name === undefined ? {} : { name }),
    ...(description === undefined ? {} : { description }),
    ...(home === undefined ? {} : { home }),
    ...(templateFlowRoot === undefined ? {} : { templateFlowRoot }),
    ...(createdAt === undefined ? {} : { createdAt }),
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : `custom-${randomUUID().slice(0, 8)}`;
}

function assertValidSlug(slug: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error(`custom flow name must be lowercase kebab-case: ${slug}`);
  }
  if (RESERVED_FLOW_IDS.has(slug)) {
    throw new Error(`custom flow name '${slug}' is reserved by Circuit`);
  }
}

function customHome(args: CreateArgs): string {
  return resolve(args.home ?? join(homedir(), '.config', 'circuit-next', 'custom'));
}

function draftRoot(home: string, slug: string): string {
  return join(home, 'drafts', slug);
}

function publishedRoot(home: string, slug: string): string {
  return join(home, 'skills', slug);
}

function flowRoot(home: string): string {
  return join(home, 'flows');
}

function customFlowInvocation(slug: string, home: string): string {
  return `circuit-next run ${slug} --flow-root '${flowRoot(home)}' --goal '<task>' --progress jsonl`;
}

function commandRoot(home: string): string {
  return join(home, 'commands');
}

function reportsRoot(home: string): string {
  return join(home, 'reports');
}

function manifestPath(home: string): string {
  return join(home, 'manifest.json');
}

function resultPath(home: string, slug: string): string {
  return join(reportsRoot(home), `${slug}-create-result.json`);
}

function summaryPath(home: string, slug: string): string {
  return join(reportsRoot(home), `${slug}-operator-summary.md`);
}

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`);
}

function writeJson(path: string, value: unknown): void {
  writeText(path, JSON.stringify(value, null, 2));
}

function validateCustomFlow(slug: string, flow: CompiledFlow, source: string): void {
  if (flow.id !== slug) {
    throw new Error(`custom flow draft id '${flow.id}' does not match expected name '${slug}'`);
  }
  const policy = validateCompiledFlowKindPolicy(flow);
  if (!policy.ok) {
    throw new Error(`${source} validation failed: ${policy.reason}`);
  }
}

function candidateTemplatePaths(args: CreateArgs): string[] {
  const roots = [args.templateFlowRoot, 'generated/flows', 'plugins/circuit/flows'].filter(
    (root): root is string => root !== undefined,
  );
  return roots.map((root) => resolve(root, 'build', 'circuit.json'));
}

function loadTemplateFlow(args: CreateArgs): CompiledFlow {
  for (const candidate of candidateTemplatePaths(args)) {
    if (!existsSync(candidate)) continue;
    return CompiledFlow.parse(JSON.parse(readFileSync(candidate, 'utf8')));
  }
  throw new Error(
    'could not find the Build template flow; pass --template-flow-root with a root containing build/circuit.json',
  );
}

function descriptionSignals(slug: string, description: string): string[] {
  const words = description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !['the', 'and', 'for', 'with'].includes(word));
  return [...new Set([slug, ...words])].slice(0, 6);
}

function customizeTemplateFlow(input: {
  readonly slug: string;
  readonly description: string;
  readonly template: CompiledFlow;
}): CompiledFlow {
  const candidate = {
    ...input.template,
    id: input.slug,
    purpose: input.description,
    entry: {
      signals: {
        include: descriptionSignals(input.slug, input.description),
        exclude: [],
      },
      intent_prefixes: [input.slug],
    },
  };
  const parsed = CompiledFlow.parse(candidate);
  validateCustomFlow(input.slug, parsed, 'custom flow');
  return parsed;
}

function skillMarkdown(slug: string, description: string, home: string): string {
  return [
    '---',
    `name: ${slug}`,
    `description: ${description.replace(/\n/g, ' ')}`,
    '---',
    '',
    `# ${slug}`,
    '',
    description,
    '',
    '## Run',
    '',
    'This custom flow is already routed when invoked directly. Do not bounce it through `/circuit:run`.',
    '',
    '```bash',
    customFlowInvocation(slug, home),
    '```',
  ].join('\n');
}

function circuitYaml(slug: string, description: string): string {
  return [
    'schema_version: 1',
    `id: ${slug}`,
    'format: compiled-flow-package',
    'compiled_flow: circuit.json',
    'archetype: build',
    'purpose: |',
    `  ${description.replace(/\n/g, '\n  ')}`,
  ].join('\n');
}

function commandMarkdown(slug: string, description: string, home: string): string {
  return [
    '---',
    `description: Runs the ${slug} custom flow.`,
    'argument-hint: <task>',
    '---',
    '',
    `# /circuit:${slug}`,
    '',
    description,
    '',
    "Treat the task text as user-controlled input. Wrap it in single quotes; if it contains an apostrophe, replace each apostrophe with `'\\''` before running the command.",
    '',
    '```bash',
    customFlowInvocation(slug, home),
    '```',
  ].join('\n');
}

function publishManifest(input: {
  readonly home: string;
  readonly slug: string;
  readonly description: string;
  readonly createdAt: string;
}): void {
  let existing: { schema_version: 1; custom_flows: unknown[] } = {
    schema_version: 1,
    custom_flows: [],
  };
  if (existsSync(manifestPath(input.home))) {
    existing = JSON.parse(readFileSync(manifestPath(input.home), 'utf8')) as typeof existing;
  }
  const withoutSlug = existing.custom_flows.filter(
    (flow) =>
      !(typeof flow === 'object' && flow !== null && 'id' in flow && flow.id === input.slug),
  );
  writeJson(manifestPath(input.home), {
    schema_version: 1,
    custom_flows: [
      ...withoutSlug,
      {
        id: input.slug,
        description: input.description,
        archetype: 'build',
        flow_path: join(flowRoot(input.home), input.slug, 'circuit.json'),
        skill_path: join(publishedRoot(input.home, input.slug), 'SKILL.md'),
        command_path: join(commandRoot(input.home), `${input.slug}.md`),
        published_at: input.createdAt,
      },
    ],
  });
}

function writeValidationResult(input: {
  readonly home: string;
  readonly slug: string;
  readonly flow: CompiledFlow;
  readonly source: 'template' | 'draft';
}): void {
  writeJson(join(draftRoot(input.home, input.slug), 'validation-result.json'), {
    schema_version: 1,
    status: 'valid',
    validated_flow_id: input.flow.id,
    source: input.source,
  });
}

function writeDraft(input: {
  readonly home: string;
  readonly slug: string;
  readonly description: string;
  readonly flow: CompiledFlow;
}): void {
  const root = draftRoot(input.home, input.slug);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  writeText(join(root, 'SKILL.md'), skillMarkdown(input.slug, input.description, input.home));
  writeText(join(root, 'circuit.yaml'), circuitYaml(input.slug, input.description));
  writeJson(join(root, 'circuit.json'), input.flow);
  writeText(join(root, 'command.md'), commandMarkdown(input.slug, input.description, input.home));
  writeValidationResult({
    home: input.home,
    slug: input.slug,
    flow: input.flow,
    source: 'template',
  });
}

function loadDraftFlow(home: string, slug: string): CompiledFlow {
  const path = join(draftRoot(home, slug), 'circuit.json');
  const flow = CompiledFlow.parse(JSON.parse(readFileSync(path, 'utf8')));
  validateCustomFlow(slug, flow, 'custom flow draft');
  return flow;
}

function publishDraft(input: {
  readonly home: string;
  readonly slug: string;
  readonly description: string;
  readonly createdAt: string;
}): void {
  const draft = draftRoot(input.home, input.slug);
  if (!existsSync(join(draft, 'SKILL.md'))) {
    throw new Error(`draft missing for ${input.slug}: ${draft}`);
  }
  const skillRoot = publishedRoot(input.home, input.slug);
  const customFlowRoot = join(flowRoot(input.home), input.slug);
  mkdirSync(skillRoot, { recursive: true });
  mkdirSync(customFlowRoot, { recursive: true });
  writeText(join(skillRoot, 'SKILL.md'), readFileSync(join(draft, 'SKILL.md'), 'utf8'));
  writeText(join(skillRoot, 'circuit.yaml'), readFileSync(join(draft, 'circuit.yaml'), 'utf8'));
  writeText(
    join(customFlowRoot, 'circuit.json'),
    readFileSync(join(draft, 'circuit.json'), 'utf8'),
  );
  writeText(
    join(commandRoot(input.home), `${input.slug}.md`),
    readFileSync(join(draft, 'command.md'), 'utf8'),
  );
  publishManifest(input);
}

function summaryMarkdown(input: {
  readonly slug: string;
  readonly description: string;
  readonly status: 'draft_created' | 'published';
  readonly home: string;
}): string {
  const invocation = customFlowInvocation(input.slug, input.home);
  return [
    '# Circuit Create',
    '',
    `Status: ${input.status}`,
    `Custom flow: ${input.slug}`,
    '',
    '## Purpose',
    input.description,
    '',
    '## Validation',
    'The generated compiled flow parsed successfully and passed flow-kind policy validation.',
    '',
    '## Runtime Policy',
    CUSTOM_FLOW_ROOT_RUNTIME_POLICY,
    '',
    '## Usage',
    `\`${invocation}\``,
    '',
    '## Next Action',
    input.status === 'published'
      ? 'Run the usage command above, or reload the host command surface if your host caches slash commands.'
      : 'Review the draft, then rerun create with `--publish --yes` when ready.',
  ].join('\n');
}

export async function runCreateCommand(
  argv: readonly string[],
  options: CreateMainOptions = {},
): Promise<number> {
  let args: CreateArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 2;
  }
  const now = options.now ?? (() => new Date());
  const progress = utilityProgress({ enabled: args.progress, flowId: 'create', now });
  if (progress !== undefined) {
    progress.emit({
      type: 'route.selected',
      recorded_at: now().toISOString(),
      label: 'Selected Create',
      display: {
        text: 'Circuit selected create.',
        importance: 'major',
        tone: 'info',
      },
      presentation: progressPresentation({ blockId: progress.runId, statusText: 'Chose create.' }),
      selected_flow: 'create' as never,
      routed_by: 'explicit',
      router_reason: 'explicit create utility command',
    });
  }

  try {
    if (args.description === undefined || args.description.length === 0) {
      throw new Error('--description is required');
    }
    if (args.publish && !args.yes) {
      throw new Error('--publish requires --yes so publish confirmation is explicit');
    }
    const slug = slugify(args.name ?? args.description);
    assertValidSlug(slug);
    const home = customHome(args);
    if (args.publish && existsSync(join(flowRoot(home), slug, 'circuit.json'))) {
      throw new Error(`custom flow already published: ${slug}`);
    }
    const createdAt = args.createdAt ?? now().toISOString();
    const draftExists = existsSync(join(draftRoot(home, slug), 'circuit.json'));
    const flow =
      args.publish && draftExists
        ? loadDraftFlow(home, slug)
        : customizeTemplateFlow({
            slug,
            description: args.description,
            template: loadTemplateFlow(args),
          });
    const outputDescription = args.publish && draftExists ? flow.purpose : args.description;
    if (args.publish && draftExists) {
      writeValidationResult({ home, slug, flow, source: 'draft' });
    } else {
      writeDraft({ home, slug, description: outputDescription, flow });
    }
    const status = args.publish ? 'published' : 'draft_created';
    if (args.publish) {
      publishDraft({ home, slug, description: outputDescription, createdAt });
    }
    const summary = summaryMarkdown({ slug, description: outputDescription, status, home });
    writeText(summaryPath(home, slug), summary);
    const result = {
      schema_version: 1,
      action: 'create',
      status,
      slug,
      draft_path: draftRoot(home, slug),
      validation_path: join(draftRoot(home, slug), 'validation-result.json'),
      ...(args.publish
        ? {
            published_path: publishedRoot(home, slug),
            flow_path: join(flowRoot(home), slug, 'circuit.json'),
            command_path: join(commandRoot(home), `${slug}.md`),
            manifest_path: manifestPath(home),
          }
        : {}),
      operator_summary_markdown_path: summaryPath(home, slug),
    };
    const outPath = resultPath(home, slug);
    writeJson(outPath, result);
    const finalResult = { ...result, result_path: outPath };
    if (progress !== undefined) {
      progress.emit({
        type: 'run.completed',
        recorded_at: now().toISOString(),
        label: 'Create completed',
        display: {
          text: `Circuit create ${status === 'published' ? 'published' : 'drafted'} ${slug}.`,
          importance: 'major',
          tone: 'success',
        },
        presentation: progressPresentation({
          blockId: progress.runId,
          statusText: `Create ${status === 'published' ? 'published' : 'drafted'} ${slug}.`,
        }),
        outcome: 'complete',
        result_path: outPath,
      });
    }
    process.stdout.write(`${JSON.stringify(finalResult, null, 2)}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}
