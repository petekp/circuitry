/**
 * Owns shipped-file inventory collection: file walking, hashing, executability, and plugin metadata.
 * It does not assemble manifest entries or decide which docs blocks get generated.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { posix as posixPath, resolve } from "node:path";

import { getPublicEntries, renderCommandShim, renderPublicCommandsFile } from "./public-surface.js";
import {
  SURFACE_MANIFEST_PATH,
  listInstalledSurfaceSeedPaths,
  shouldIgnoreInstalledPath,
} from "./surface-roots.js";
import type { Catalog, SurfaceManifestFile } from "./types.js";

interface GeneratedInventoryProjection {
  content: string;
  executable: boolean;
}

function walkInstalledFiles(
  absolutePath: string,
  relativePath: string,
  files: string[],
): void {
  const stat = lstatSync(absolutePath);
  if (stat.isDirectory()) {
    if (shouldIgnoreInstalledPath(relativePath)) {
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

  for (const relativePath of listInstalledSurfaceSeedPaths("repo")) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    walkInstalledFiles(absolutePath, relativePath, files);
  }

  return files.sort();
}

function sha256Content(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function isExecutableFile(filePath: string): boolean {
  return (statSync(filePath).mode & 0o111) !== 0;
}

function buildGeneratedInventoryProjections(
  catalog: Catalog,
): Map<string, GeneratedInventoryProjection> {
  const projections = new Map<string, GeneratedInventoryProjection>();

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

export function getPluginMetadata(repoRoot: string): { name: string; version: string } {
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

export function getInstalledFileInventory(repoRoot: string, catalog: Catalog): SurfaceManifestFile[] {
  const projections = buildGeneratedInventoryProjections(catalog);
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
      sha256: sha256File(absolutePath),
    });
  }

  return inventory.sort((left, right) => left.path.localeCompare(right.path));
}
