/**
 * Owns narrow manifest-vs-installed-filesystem verification.
 * It does not own raw filesystem traversal, hashing, or executable-bit detection primitives.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readOverlayManifest, type OverlayManifest } from "./custom-circuits.js";
import {
  collectSurfaceFiles,
  isExecutableFile,
  listTopLevelEntries,
  sha256File,
} from "./surface-fs.js";
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
  homeDir?: string;
  mode: InstalledSurfaceMode;
  pluginRoot: string;
}

function collectActualFiles(
  pluginRoot: string,
  mode: InstalledSurfaceMode,
  errors: string[],
): string[] {
  const result = collectSurfaceFiles({
    ignoreRelativePath: shouldIgnoreInstalledPath,
    rootDir: pluginRoot,
    seedPaths: listInstalledSurfaceSeedPaths(mode),
  });

  for (const relativePath of result.missingSeedPaths) {
    errors.push(
      mode === "installed"
        ? `missing shipped root ${relativePath}`
        : `missing shipped path ${relativePath}`,
    );
  }

  return result.files;
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

function loadOverlay(homeDir: string | undefined, errors: string[]): OverlayManifest | null {
  try {
    return readOverlayManifest(homeDir ?? process.env.HOME);
  } catch (error) {
    errors.push(
      `invalid custom overlay manifest: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

function verifyInstalledTopLevel(
  pluginRoot: string,
  mode: InstalledSurfaceMode,
  errors: string[],
): void {
  if (mode !== "installed") {
    return;
  }

  const actualTopLevel = listTopLevelEntries(pluginRoot);
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
  options: VerifyInstalledSurfaceOptions,
  errors: string[],
): void {
  const actualFiles = collectActualFiles(pluginRoot, options.mode, errors);
  const expectedFileMap = new Map(manifest.files.map((file) => [file.path, file]));
  const unexpectedFiles = actualFiles.filter((relativePath) =>
    relativePath !== SURFACE_MANIFEST_PATH && !expectedFileMap.has(relativePath)
  );
  const overlay = unexpectedFiles.length > 0
    ? loadOverlay(options.homeDir, errors)
    : null;
  const overlayFileMap = new Map(
    (overlay?.circuits ?? []).map((entry) => [entry.commandFile.path, entry.commandFile]),
  );
  const expectedFiles = [
    ...expectedFileMap.keys(),
    ...overlayFileMap.keys(),
    SURFACE_MANIFEST_PATH,
  ].sort();

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

    const expectedSha256 = overlay?.publicCommandsFile.path === relativePath
      ? overlay.publicCommandsFile.sha256
      : file.sha256;
    const expectedExecutable = overlay?.publicCommandsFile.path === relativePath
      ? overlay.publicCommandsFile.executable
      : file.executable;

    if (expectedSha256 !== sha256File(absolutePath)) {
      errors.push(`sha256 mismatch for ${relativePath}`);
    }
    if (Boolean(expectedExecutable) !== isExecutableFile(absolutePath)) {
      errors.push(`executable-bit mismatch for ${relativePath}`);
    }
  }

  for (const [relativePath, file] of overlayFileMap.entries()) {
    const absolutePath = resolve(pluginRoot, relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(`missing overlay-managed file ${relativePath}`);
      continue;
    }

    if (file.sha256 !== sha256File(absolutePath)) {
      errors.push(`sha256 mismatch for ${relativePath}`);
    }
    if (Boolean(file.executable) !== isExecutableFile(absolutePath)) {
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
    verifyManifestFiles(options.pluginRoot, manifest, options, errors);
  }

  return {
    errors,
    ok: errors.length === 0,
  };
}
