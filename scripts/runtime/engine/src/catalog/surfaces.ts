import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { posix as posixPath, resolve } from "node:path";

import type {
  AdapterEntry,
  BlockGenerateTarget,
  Catalog,
  CircuitIR,
  FileGenerateTarget,
  GenerateTarget,
  PublicCommandProjection,
  SurfaceManifest,
  SurfaceManifestEntry,
  SurfaceManifestFile,
  UtilityEntry,
  WorkflowEntry,
} from "./types.js";

export const INSTALLED_SURFACE_ROOTS = [
  ".claude-plugin",
  "commands",
  "hooks",
  "schemas",
  "scripts",
  "skills",
  "circuit.config.example.yaml",
] as const;

export const REPO_ONLY_SURFACE_ROOTS = [
  "README.md",
  "ARCHITECTURE.md",
  "CIRCUITS.md",
  "CUSTOM-CIRCUITS.md",
  "docs",
  "assets",
] as const;

export const SURFACE_MANIFEST_PATH = "scripts/runtime/generated/surface-manifest.json";

interface GeneratedProjection {
  content: string;
  executable: boolean;
}

function shouldIgnoreInstalledPath(relativePath: string): boolean {
  return relativePath.split("/").includes(".vite");
}

export function isWorkflow(entry: CircuitIR): entry is WorkflowEntry {
  return entry.kind === "workflow";
}

export function isUtility(entry: CircuitIR): entry is UtilityEntry {
  return entry.kind === "utility";
}

export function isAdapter(entry: CircuitIR): entry is AdapterEntry {
  return entry.kind === "adapter";
}

export function isPublicEntry(entry: CircuitIR): entry is WorkflowEntry | UtilityEntry {
  return entry.kind === "workflow" || entry.kind === "utility";
}

export function getPublicEntries(catalog: Catalog): Array<WorkflowEntry | UtilityEntry> {
  return catalog.filter(isPublicEntry).sort((left, right) => left.slug.localeCompare(right.slug));
}

export function getPublicCommandIds(catalog: Catalog): string[] {
  return getPublicEntries(catalog).map((entry) => entry.slug);
}

export function getSlashCommand(entry: CircuitIR): string {
  return `/circuit:${entry.slug}`;
}

export function getPublicCommandInvocation(entry: WorkflowEntry | UtilityEntry): string {
  if (entry.kind === "workflow" && entry.entryUsage) {
    return `${getSlashCommand(entry)} ${entry.entryUsage}`;
  }

  return getSlashCommand(entry);
}

export function firstSentence(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^.*?[.!?](?=\s|$)/);
  return (match?.[0] ?? normalized).trim();
}

function stripTerminalPunctuation(text: string): string {
  return text.replace(/[.!?]+$/, "").trim();
}

function escapeYamlDoubleQuotedString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function titleCaseSlug(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function getPublicCommandProjection(
  entry: WorkflowEntry | UtilityEntry,
): PublicCommandProjection {
  return {
    description: firstSentence(entry.skillDescription),
    invocation: getPublicCommandInvocation(entry),
    shimPath: posixPath.join("commands", `${entry.slug}.md`),
    slash: getSlashCommand(entry),
  };
}

export function renderCircuitTable(catalog: Catalog): string {
  const workflows = catalog.filter(isWorkflow).sort((left, right) => left.slug.localeCompare(right.slug));
  const header = "| Circuit | Invoke | Best For |";
  const separator = "|---------|--------|----------|";
  const rows = workflows.map((workflow) => {
    return `| ${titleCaseSlug(workflow.slug)} | \`${getPublicCommandInvocation(workflow)}\` | ${workflow.purpose} |`;
  });

  return [header, separator, ...rows].join("\n");
}

export function renderEntryModes(catalog: Catalog): string {
  const workflows = catalog.filter(isWorkflow).sort((left, right) => left.slug.localeCompare(right.slug));
  return workflows
    .map((workflow) => {
      const heading = `### ${titleCaseSlug(workflow.slug)}`;
      const modes = workflow.entryModes.map((mode) => `- ${mode}`).join("\n");
      return [heading, "", modes].join("\n");
    })
    .join("\n\n");
}

export function renderUtilityTable(catalog: Catalog): string {
  const utilities = catalog.filter(isUtility).sort((left, right) => left.slug.localeCompare(right.slug));
  const header = "| Utility | Invoke | Best For |";
  const separator = "|---------|--------|----------|";
  const rows = utilities.map((utility) => {
    const description = stripTerminalPunctuation(firstSentence(utility.skillDescription));
    return `| ${titleCaseSlug(utility.slug)} | \`${getPublicCommandInvocation(utility)}\` | ${description} |`;
  });

  return [header, separator, ...rows].join("\n");
}

export function renderPublicCommandsFile(catalog: Catalog): string {
  return `${getPublicCommandIds(catalog).join("\n")}\n`;
}

export function renderCommandShim(entry: WorkflowEntry | UtilityEntry): string {
  const description = firstSentence(entry.skillDescription);
  return [
    "---",
    `description: "${escapeYamlDoubleQuotedString(description)}"`,
    "---",
    "",
    `Use the circuit:${entry.slug} skill to handle this request.`,
    "",
  ].join("\n");
}

function getBlockTargets(repoRoot: string): BlockGenerateTarget[] {
  return [
    {
      blockName: "CIRCUIT_TABLE",
      filePath: resolve(repoRoot, "CIRCUITS.md"),
      render: renderCircuitTable,
    },
    {
      blockName: "UTILITY_TABLE",
      filePath: resolve(repoRoot, "CIRCUITS.md"),
      render: renderUtilityTable,
    },
    {
      blockName: "ENTRY_MODES",
      filePath: resolve(repoRoot, "CIRCUITS.md"),
      render: renderEntryModes,
    },
  ];
}

function buildGeneratedProjectionMap(
  repoRoot: string,
  catalog: Catalog,
): Map<string, GeneratedProjection> {
  const projections = new Map<string, GeneratedProjection>();

  projections.set(".claude-plugin/public-commands.txt", {
    content: renderPublicCommandsFile(catalog),
    executable: false,
  });

  for (const entry of getPublicEntries(catalog)) {
    projections.set(posixPath.join("commands", `${entry.slug}.md`), {
      content: renderCommandShim(entry),
      executable: false,
    });
  }

  return projections;
}

function walkInstalledFiles(
  absolutePath: string,
  relativePath: string,
  files: string[],
): void {
  const stat = lstatSync(absolutePath);
  if (stat.isDirectory()) {
    if (relativePath.split("/").includes(".vite")) {
      return;
    }
    for (const child of readdirSync(absolutePath).sort()) {
      walkInstalledFiles(
        resolve(absolutePath, child),
        posixPath.join(relativePath, child),
        files,
      );
    }
    return;
  }

  if (stat.isFile()) {
    files.push(relativePath);
  }
}

function listInstalledFiles(repoRoot: string): string[] {
  const files: string[] = [];

  for (const root of INSTALLED_SURFACE_ROOTS) {
    const absolutePath = resolve(repoRoot, root);
    if (!existsSync(absolutePath)) {
      continue;
    }

    walkInstalledFiles(absolutePath, root, files);
  }

  return files.sort();
}

function sha256Content(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function isExecutableFile(filePath: string): boolean {
  return (statSync(filePath).mode & 0o111) !== 0;
}

function getPluginMetadata(repoRoot: string): { name: string; version: string } {
  const pluginJsonPath = resolve(repoRoot, ".claude-plugin", "plugin.json");
  const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8")) as Record<string, unknown>;
  const name = pluginJson.name;
  const version = pluginJson.version;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error(`catalog-compiler: ${pluginJsonPath} -- plugin.name must be a non-empty string`);
  }
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error(`catalog-compiler: ${pluginJsonPath} -- plugin.version must be a non-empty string`);
  }

  return { name, version };
}

function getManifestEntries(catalog: Catalog): SurfaceManifestEntry[] {
  return [...catalog]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((entry) => {
      if (!isPublicEntry(entry)) {
        return {
          kind: entry.kind,
          public: false,
          slug: entry.slug,
        };
      }

      return {
        kind: entry.kind,
        public: true,
        publicCommand: getPublicCommandProjection(entry),
        slug: entry.slug,
      };
    });
}

function getInstalledFileInventory(repoRoot: string, catalog: Catalog): SurfaceManifestFile[] {
  const projections = buildGeneratedProjectionMap(repoRoot, catalog);
  const files = new Set(listInstalledFiles(repoRoot));
  for (const relativePath of projections.keys()) {
    files.add(relativePath);
  }
  const inventory: SurfaceManifestFile[] = [];

  for (const relativePath of [...files].sort()) {
    if (relativePath === SURFACE_MANIFEST_PATH || shouldIgnoreInstalledPath(relativePath)) {
      continue;
    }

    const generated = projections.get(relativePath);
    if (generated) {
      inventory.push({
        executable: generated.executable,
        path: relativePath,
        sha256: sha256Content(generated.content),
      });
      continue;
    }

    const absolutePath = resolve(repoRoot, relativePath);
    inventory.push({
      executable: isExecutableFile(absolutePath),
      path: relativePath,
      sha256: createHash("sha256").update(readFileSync(absolutePath)).digest("hex"),
    });
  }

  return inventory.sort((left, right) => left.path.localeCompare(right.path));
}

function buildSurfaceManifest(repoRoot: string, catalog: Catalog): SurfaceManifest {
  return {
    entries: getManifestEntries(catalog),
    files: getInstalledFileInventory(repoRoot, catalog),
    plugin: getPluginMetadata(repoRoot),
    public_commands: getPublicCommandIds(catalog),
    schema_version: "1",
  };
}

export function renderSurfaceManifest(repoRoot: string, catalog: Catalog): string {
  return `${JSON.stringify(buildSurfaceManifest(repoRoot, catalog), null, 2)}\n`;
}

function getFileTargets(repoRoot: string, catalog: Catalog): FileGenerateTarget[] {
  const commandTargets: FileGenerateTarget[] = getPublicEntries(catalog).map((entry) => ({
    filePath: resolve(repoRoot, "commands", `${entry.slug}.md`),
    render: () => renderCommandShim(entry),
  }));

  return [
    {
      filePath: resolve(repoRoot, ".claude-plugin", "public-commands.txt"),
      render: renderPublicCommandsFile,
    },
    ...commandTargets,
    {
      filePath: resolve(repoRoot, SURFACE_MANIFEST_PATH),
      render: (entries) => renderSurfaceManifest(repoRoot, entries),
    },
  ];
}

export function getGenerateTargets(repoRoot: string, catalog: Catalog): GenerateTarget[] {
  return [...getBlockTargets(repoRoot), ...getFileTargets(repoRoot, catalog)];
}

export function pruneStaleCommandShims(repoRoot: string, catalog: Catalog): string[] {
  const commandsDir = resolve(repoRoot, "commands");
  if (!existsSync(commandsDir)) {
    return [];
  }

  const expected = new Set(getPublicCommandIds(catalog).map((slug) => `${slug}.md`));
  const removed: string[] = [];

  for (const name of readdirSync(commandsDir).sort()) {
    if (!name.endsWith(".md")) {
      continue;
    }
    if (expected.has(name)) {
      continue;
    }

    removed.push(resolve(commandsDir, name));
  }

  return removed;
}
