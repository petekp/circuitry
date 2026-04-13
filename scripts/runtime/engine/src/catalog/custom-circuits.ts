import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { bootstrapRun } from "../bootstrap.js";
import { extract } from "./extract.js";
import { renderCommandShim } from "./prompt-surface-contracts.js";
import { renderPublicCommandsFile } from "./public-surface.js";
import { sha256Text } from "./surface-fs.js";
import { firstSentence } from "./surface-text.js";
import type { Catalog, WorkflowEntry } from "./types.js";

const RESERVED_ALIAS_SLUGS = [
  "cleanup",
  "decide",
  "develop",
  "fix",
  "overnight",
];

export interface CircuitHomePaths {
  circuitHome: string;
  draftsRoot: string;
  overlayDir: string;
  overlayManifestPath: string;
  skillsRoot: string;
}

export interface OverlayGeneratedFile {
  executable: boolean;
  path: string;
  sha256: string;
}

export interface OverlayManifestCircuit {
  commandFile: OverlayGeneratedFile;
  manifestPath: string;
  origin: "user_global";
  skillMdPath: string;
  slug: string;
}

export interface OverlayManifest {
  circuits: OverlayManifestCircuit[];
  publicCommandsFile: OverlayGeneratedFile;
  schema_version: "1";
}

export interface MaterializeCustomCommandSurfaceOptions {
  homeDir: string;
  pluginRoot: string;
}

export interface MaterializeCustomCommandSurfaceResult {
  pluginRoot: string;
  overlayManifestPath: string;
  publicCommandsPath: string;
  removedFiles: string[];
  writtenFiles: string[];
}

export interface MaterializeCustomCommandSurfacesResult {
  results: MaterializeCustomCommandSurfaceResult[];
}

export interface ValidateDraftOptions {
  entryMode?: string;
  goal?: string;
  homeDir: string;
  pluginRoot: string;
  projectRoot: string;
  slug: string;
}

export interface ValidateDraftResult {
  activeRunPath: string;
  draftRoot: string;
  runRoot: string;
  slug: string;
}

export interface PublishDraftOptions {
  homeDir: string;
  includeMarketplace?: boolean;
  pluginRoot: string;
  slug: string;
}

export interface PublishDraftResult extends MaterializeCustomCommandSurfacesResult {
  draftRoot: string;
  publishedSkillRoot: string;
  slug: string;
}

function resolveHomeDir(homeDir?: string): string {
  const resolved = homeDir ?? process.env.HOME ?? "";
  if (!resolved) {
    throw new Error("circuit: HOME is required to resolve the user-global custom circuit catalog");
  }

  return resolve(resolved);
}

function sortCatalog<T extends { slug: string }>(catalog: T[]): T[] {
  return [...catalog].sort((left, right) => left.slug.localeCompare(right.slug));
}

function writeTextFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

export function resolveCircuitHomePaths(homeDir?: string): CircuitHomePaths {
  const resolvedHomeDir = resolveHomeDir(homeDir);
  const circuitHome = process.env.CIRCUIT_HOME
    ? resolve(process.env.CIRCUIT_HOME)
    : resolve(resolvedHomeDir, ".claude", "circuit");

  return {
    circuitHome,
    draftsRoot: resolve(circuitHome, "drafts"),
    overlayDir: resolve(circuitHome, "overlay"),
    overlayManifestPath: resolve(circuitHome, "overlay", "manifest.json"),
    skillsRoot: resolve(circuitHome, "skills"),
  };
}

export function resolveDraftRoot(homeDir: string, slug: string): string {
  return resolve(resolveCircuitHomePaths(homeDir).draftsRoot, slug);
}

export function resolvePublishedSkillRoot(homeDir: string, slug: string): string {
  return resolve(resolveCircuitHomePaths(homeDir).skillsRoot, slug);
}

export function resolveMarketplacePluginRoot(homeDir?: string): string {
  const resolvedHomeDir = resolveHomeDir(homeDir);
  const marketplaceRoot = process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR
    ? resolve(process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR)
    : resolve(resolvedHomeDir, ".claude", "plugins", "marketplaces", "petekp");

  return marketplaceRoot;
}

export function listMaterializationPluginRoots(options: {
  homeDir?: string;
  includeMarketplace?: boolean;
  pluginRoot: string;
}): string[] {
  const roots = [resolve(options.pluginRoot)];

  if (options.includeMarketplace) {
    const marketplaceRoot = resolveMarketplacePluginRoot(options.homeDir);
    if (existsSync(marketplaceRoot) && !roots.includes(marketplaceRoot)) {
      roots.push(marketplaceRoot);
    }
  }

  return roots;
}

export function loadShippedCatalog(skillsDir: string): Catalog {
  return extract(skillsDir, { origin: "shipped" });
}

export function loadUserGlobalCatalog(homeDir?: string): WorkflowEntry[] {
  const { skillsRoot } = resolveCircuitHomePaths(homeDir);
  if (!existsSync(skillsRoot)) {
    return [];
  }

  const catalog = extract(skillsRoot, { origin: "user_global" });
  const invalidEntry = catalog.find((entry) => entry.kind !== "workflow");
  if (invalidEntry) {
    throw new Error(
      `circuit: user-global custom circuit "${invalidEntry.slug}" must be a workflow with circuit.yaml`,
    );
  }

  return sortCatalog(catalog as WorkflowEntry[]);
}

export function getReservedCustomCircuitSlugs(shippedCatalog: Catalog): Set<string> {
  return new Set([
    ...RESERVED_ALIAS_SLUGS,
    ...shippedCatalog.map((entry) => entry.slug),
  ]);
}

export function assertValidCustomCircuitSlugs(
  shippedCatalog: Catalog,
  customCatalog: WorkflowEntry[],
): void {
  const reservedSlugs = getReservedCustomCircuitSlugs(shippedCatalog);
  const seenCustomSlugs = new Set<string>();

  for (const entry of customCatalog) {
    if (reservedSlugs.has(entry.slug)) {
      throw new Error(`circuit: custom circuit slug "${entry.slug}" is reserved`);
    }

    if (seenCustomSlugs.has(entry.slug)) {
      throw new Error(`circuit: duplicate custom circuit slug "${entry.slug}"`);
    }

    seenCustomSlugs.add(entry.slug);
  }
}

export function loadMergedCatalog(options: {
  homeDir?: string;
  skillsDir: string;
}): Catalog {
  const shippedCatalog = loadShippedCatalog(options.skillsDir);
  const customCatalog = loadUserGlobalCatalog(options.homeDir);

  assertValidCustomCircuitSlugs(shippedCatalog, customCatalog);

  return sortCatalog([...shippedCatalog, ...customCatalog]);
}

export function readOverlayManifest(homeDir?: string): OverlayManifest | null {
  const { overlayManifestPath } = resolveCircuitHomePaths(homeDir);
  if (!existsSync(overlayManifestPath)) {
    return null;
  }

  return JSON.parse(readFileSync(overlayManifestPath, "utf-8")) as OverlayManifest;
}

function buildOverlayManifest(
  customCatalog: WorkflowEntry[],
  publicCommandsContent: string,
): OverlayManifest {
  return {
    circuits: customCatalog.map((entry) => {
      const commandContent = renderCommandShim(entry);
      return {
        commandFile: {
          executable: false,
          path: `commands/${entry.slug}.md`,
          sha256: sha256Text(commandContent),
        },
        manifestPath: entry.manifestPath,
        origin: "user_global",
        skillMdPath: entry.skillMdPath,
        slug: entry.slug,
      };
    }),
    publicCommandsFile: {
      executable: false,
      path: ".claude-plugin/public-commands.txt",
      sha256: sha256Text(publicCommandsContent),
    },
    schema_version: "1",
  };
}

export function materializeCustomCommandSurface(
  options: MaterializeCustomCommandSurfaceOptions,
): MaterializeCustomCommandSurfaceResult {
  const pluginRoot = resolve(options.pluginRoot);
  const { overlayManifestPath } = resolveCircuitHomePaths(options.homeDir);
  const shippedCatalog = loadShippedCatalog(resolve(pluginRoot, "skills"));
  const customCatalog = loadUserGlobalCatalog(options.homeDir);

  assertValidCustomCircuitSlugs(shippedCatalog, customCatalog);

  const previousOverlay = readOverlayManifest(options.homeDir);
  const writtenFiles: string[] = [];
  const removedFiles: string[] = [];

  const publicCommandsPath = resolve(pluginRoot, ".claude-plugin", "public-commands.txt");
  const mergedCatalog = sortCatalog([...shippedCatalog, ...customCatalog]);
  const publicCommandsContent = renderPublicCommandsFile(mergedCatalog);
  writeTextFile(publicCommandsPath, publicCommandsContent);
  writtenFiles.push(publicCommandsPath);

  const desiredCustomShims = new Map<string, string>();
  for (const entry of customCatalog) {
    desiredCustomShims.set(
      resolve(pluginRoot, "commands", `${entry.slug}.md`),
      renderCommandShim(entry),
    );
  }

  for (const [commandPath, content] of desiredCustomShims.entries()) {
    writeTextFile(commandPath, content);
    writtenFiles.push(commandPath);
  }

  const staleShimPaths = new Set(
    (previousOverlay?.circuits ?? []).map((entry) => resolve(pluginRoot, entry.commandFile.path)),
  );

  for (const commandPath of staleShimPaths) {
    if (desiredCustomShims.has(commandPath)) {
      continue;
    }

    rmSync(commandPath, { force: true });
    removedFiles.push(commandPath);
  }

  if (customCatalog.length === 0) {
    rmSync(overlayManifestPath, { force: true });
    return {
      pluginRoot,
      overlayManifestPath,
      publicCommandsPath,
      removedFiles: removedFiles.sort(),
      writtenFiles: writtenFiles.sort(),
    };
  }

  const overlay = buildOverlayManifest(customCatalog, publicCommandsContent);
  writeTextFile(overlayManifestPath, `${JSON.stringify(overlay, null, 2)}\n`);

  return {
    pluginRoot,
    overlayManifestPath,
    publicCommandsPath,
    removedFiles: removedFiles.sort(),
    writtenFiles: [...writtenFiles, overlayManifestPath].sort(),
  };
}

export function materializeCustomCommandSurfaces(options: {
  homeDir?: string;
  includeMarketplace?: boolean;
  pluginRoot: string;
}): MaterializeCustomCommandSurfacesResult {
  return {
    results: listMaterializationPluginRoots(options).map((pluginRoot) =>
      materializeCustomCommandSurface({
        homeDir: options.homeDir ?? process.env.HOME ?? "",
        pluginRoot,
      })
    ),
  };
}

export function validateDraft(options: ValidateDraftOptions): ValidateDraftResult {
  const draftRoot = resolveDraftRoot(options.homeDir, options.slug);
  const manifestPath = resolve(draftRoot, "circuit.yaml");
  const runRoot = mkdtempSync(resolve(tmpdir(), "circuit-create-"));

  try {
    const result = bootstrapRun({
      entryMode: options.entryMode ?? "default",
      goal: options.goal ?? `Validate ${options.slug} draft circuit`,
      manifestPath,
      projectRoot: options.projectRoot,
      runRoot,
    });

    const requiredPaths = [
      resolve(runRoot, "circuit.manifest.yaml"),
      resolve(runRoot, "events.ndjson"),
      resolve(runRoot, "state.json"),
      resolve(runRoot, "artifacts", "active-run.md"),
    ];

    for (const path of requiredPaths) {
      if (!existsSync(path)) {
        throw new Error(`draft validation missing expected artifact: ${path}`);
      }
    }

    return {
      activeRunPath: result.activeRunPath,
      draftRoot,
      runRoot,
      slug: options.slug,
    };
  } finally {
    rmSync(runRoot, { force: true, recursive: true });
  }
}

export function publishDraft(options: PublishDraftOptions): PublishDraftResult {
  const draftRoot = resolveDraftRoot(options.homeDir, options.slug);
  const publishedSkillRoot = resolvePublishedSkillRoot(options.homeDir, options.slug);
  const files = ["circuit.yaml", "SKILL.md"] as const;

  mkdirSync(publishedSkillRoot, { recursive: true });

  for (const file of files) {
    const source = resolve(draftRoot, file);
    if (!existsSync(source)) {
      throw new Error(`draft file not found: ${source}`);
    }

    copyFileSync(source, resolve(publishedSkillRoot, file));
  }

  rmSync(draftRoot, { force: true, recursive: true });

  const materialized = materializeCustomCommandSurfaces({
    homeDir: options.homeDir,
    includeMarketplace: options.includeMarketplace,
    pluginRoot: options.pluginRoot,
  });

  return {
    ...materialized,
    draftRoot,
    publishedSkillRoot,
    slug: options.slug,
  };
}

export function renderRunCustomCircuitContext(homeDir?: string): string | null {
  const customCatalog = loadUserGlobalCatalog(homeDir);
  if (customCatalog.length === 0) {
    return null;
  }

  const lines = [
    "# Circuit Custom Routing Overlay",
    "User-global custom circuits are available in `~/.claude/circuit/skills/`.",
    "For `/circuit:run`, built-in explicit intent hints remain authoritative.",
    "Otherwise compare the strongest built-in route with the strongest custom-circuit match from the catalog below.",
    "Choose a custom circuit only when it is clearly stronger than the best built-in candidate.",
    "Built-ins win ties.",
    "When dispatching to a custom circuit, briefly state which include signals matched.",
    "If the best built-in and custom candidates are too close to distinguish, ask one sharp routing question.",
    "",
    "## Available Custom Circuits",
    ...customCatalog.map((entry) => {
      const include = entry.signals.include.length > 0 ? entry.signals.include.join(", ") : "none";
      const exclude = entry.signals.exclude.length > 0 ? entry.signals.exclude.join(", ") : "none";
      return `- \`/circuit:${entry.slug}\` — ${firstSentence(entry.skillDescription)} | include: ${include} | exclude: ${exclude}`;
    }),
  ];

  return `${lines.join("\n")}\n`;
}
