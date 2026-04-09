import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { posix as posixPath, resolve } from "node:path";

import type { SurfaceManifest } from "./types.js";
import {
  SURFACE_MANIFEST_PATH,
  type InstalledSurfaceMode,
  listInstalledSurfaceRoots,
  listInstalledSurfaceSeedPaths,
  shouldIgnoreInstalledPath,
} from "./surface-roots.js";

export interface VerificationResult {
  errors: string[];
  ok: boolean;
}

export interface VerifyInstalledSurfaceOptions {
  mode: InstalledSurfaceMode;
  pluginRoot: string;
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

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function isExecutable(filePath: string): boolean {
  return (statSync(filePath).mode & 0o111) !== 0;
}

function collectActualFiles(
  pluginRoot: string,
  mode: InstalledSurfaceMode,
  errors: string[],
): string[] {
  const actualFiles: string[] = [];

  for (const relativePath of listInstalledSurfaceSeedPaths(mode)) {
    const absolutePath = resolve(pluginRoot, relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(
        mode === "installed"
          ? `missing shipped root ${relativePath}`
          : `missing shipped path ${relativePath}`,
      );
      continue;
    }

    walkInstalledFiles(absolutePath, relativePath, actualFiles);
  }

  return actualFiles.sort();
}

function loadManifest(pluginRoot: string, errors: string[]): SurfaceManifest | null {
  const manifestPath = resolve(pluginRoot, SURFACE_MANIFEST_PATH);
  if (!existsSync(manifestPath)) {
    errors.push(`missing shipped manifest ${SURFACE_MANIFEST_PATH}`);
    return null;
  }

  let manifest: SurfaceManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as SurfaceManifest;
  } catch (error) {
    errors.push(
      `invalid shipped manifest ${SURFACE_MANIFEST_PATH}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }

  if (manifest.schema_version !== "1") {
    errors.push(`unexpected manifest schema_version: ${JSON.stringify(manifest.schema_version)}`);
  }
  let invalidShape = false;

  if (
    typeof manifest.plugin?.name !== "string"
    || typeof manifest.plugin?.version !== "string"
  ) {
    errors.push("manifest plugin metadata is incomplete");
    invalidShape = true;
  }
  if (
    !Array.isArray(manifest.entries)
    || !Array.isArray(manifest.public_commands)
    || !Array.isArray(manifest.files)
  ) {
    errors.push("manifest arrays are missing");
    invalidShape = true;
  }

  if (invalidShape) {
    return null;
  }

  return manifest;
}

function verifyInstalledTopLevel(
  pluginRoot: string,
  mode: InstalledSurfaceMode,
  errors: string[],
): void {
  if (mode !== "installed") {
    return;
  }

  const actualTopLevel = readdirSync(pluginRoot).sort();
  const expectedTopLevel = [...listInstalledSurfaceRoots()].sort();
  if (JSON.stringify(actualTopLevel) !== JSON.stringify(expectedTopLevel)) {
    errors.push(
      `installed top-level surface drift:\nexpected ${expectedTopLevel.join(", ")}\nactual   ${actualTopLevel.join(", ")}`,
    );
  }
}

function verifyManifestStructure(manifest: SurfaceManifest, errors: string[]): void {
  const publicEntries = manifest.entries
    .filter((entry) => entry.public === true)
    .map((entry) => entry.slug)
    .sort();
  const publicCommands = [...manifest.public_commands].sort();

  if (JSON.stringify(publicEntries) !== JSON.stringify(publicCommands)) {
    errors.push("manifest public_commands do not match public entry inventory");
  }

  for (const entry of manifest.entries) {
    if (entry.kind === "adapter") {
      if (entry.public !== false) {
        errors.push(`adapter ${entry.slug} must be non-public`);
      }
      if ("publicCommand" in entry && entry.publicCommand !== undefined) {
        errors.push(`adapter ${entry.slug} must not define publicCommand`);
      }
      continue;
    }

    const publicCommand = entry.publicCommand;
    if (!publicCommand) {
      errors.push(`${entry.kind} ${entry.slug} is missing publicCommand`);
      continue;
    }

    const expectedSlash = `/circuit:${entry.slug}`;
    if (publicCommand.slash !== expectedSlash) {
      errors.push(`${entry.kind} ${entry.slug} has non-derived slash ${publicCommand.slash}`);
    }

    if (
      publicCommand.shimPath !== `commands/${entry.slug}.md`
      && !publicCommand.shimPath.endsWith(`/${entry.slug}.md`)
    ) {
      errors.push(`${entry.kind} ${entry.slug} has unexpected shim path ${publicCommand.shimPath}`);
    }
  }
}

function verifyManifestFiles(
  pluginRoot: string,
  manifest: SurfaceManifest,
  mode: InstalledSurfaceMode,
  errors: string[],
): void {
  const actualFiles = collectActualFiles(pluginRoot, mode, errors);
  const expectedFileMap = new Map(manifest.files.map((file) => [file.path, file]));
  const expectedFiles = [...expectedFileMap.keys(), SURFACE_MANIFEST_PATH].sort();

  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    errors.push(
      `installed file inventory drift:\nexpected ${expectedFiles.join(", ")}\nactual   ${actualFiles.join(", ")}`,
    );
  }

  for (const [relativePath, file] of expectedFileMap.entries()) {
    const absolutePath = resolve(pluginRoot, relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(`missing shipped file ${relativePath}`);
      continue;
    }

    if (file.sha256 !== sha256(absolutePath)) {
      errors.push(`sha256 mismatch for ${relativePath}`);
    }
    if (Boolean(file.executable) !== isExecutable(absolutePath)) {
      errors.push(`executable-bit mismatch for ${relativePath}`);
    }
  }
}

export function verifyInstalledSurface(
  options: VerifyInstalledSurfaceOptions,
): VerificationResult {
  const errors: string[] = [];
  const manifest = loadManifest(options.pluginRoot, errors);

  if (manifest) {
    verifyInstalledTopLevel(options.pluginRoot, options.mode, errors);
    verifyManifestStructure(manifest, errors);
    verifyManifestFiles(options.pluginRoot, manifest, options.mode, errors);
  }

  return {
    errors,
    ok: errors.length === 0,
  };
}
