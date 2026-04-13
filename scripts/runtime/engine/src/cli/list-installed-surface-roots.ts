#!/usr/bin/env node

import { listInstalledSurfaceRoots, listInstalledSurfaceSeedPaths } from "../catalog/surface-roots.js";
import { unknownOption } from "./unknown-option.js";

function main(): number {
  const args = process.argv.slice(2);
  const repoPaths = args.includes("--repo-paths");
  const unknownArgs = args.filter((arg) => arg !== "--repo-paths");

  if (unknownArgs.length > 0) {
    process.stderr.write(`${unknownOption(unknownArgs.join(", "), ["--repo-paths"])}\n`);
    return 1;
  }

  const values = repoPaths ? listInstalledSurfaceSeedPaths("repo") : listInstalledSurfaceRoots();
  process.stdout.write(`${values.join("\n")}\n`);
  return 0;
}

process.exit(main());
