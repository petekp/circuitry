import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const THIS_DIR =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = resolve(THIS_DIR, "../../../..");
const PACKAGE_JSON = resolve(REPO_ROOT, "scripts/runtime/engine/package.json");
const SYNC_SCRIPT = resolve(REPO_ROOT, "scripts/sync-to-cache.sh");

// catalog-compiler is itself loaded from an esbuild bundle at
// scripts/runtime/bin/catalog-compiler.js. If catalog-compiler runs before
// esbuild rebuilds, surface regeneration uses the PREVIOUS bundle and any
// TS source change to the compiler only takes effect on the NEXT ship.
describe("ship-ordering invariant: esbuild before catalog-compiler", () => {
  it("holds in engine/package.json prepare-ship", async () => {
    const raw = await readFile(PACKAGE_JSON, "utf-8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    const prepareShip = pkg.scripts?.["prepare-ship"] ?? "";

    const esbuildIndex = prepareShip.indexOf("esbuild.config.mjs");
    const catalogIndex = prepareShip.indexOf("catalog");

    expect(prepareShip).not.toBe("");
    expect(esbuildIndex).toBeGreaterThanOrEqual(0);
    expect(catalogIndex).toBeGreaterThanOrEqual(0);
    expect(esbuildIndex).toBeLessThan(catalogIndex);
  });

  it("holds in scripts/sync-to-cache.sh", async () => {
    const script = await readFile(SYNC_SCRIPT, "utf-8");

    const esbuildMarker = "Rebuilding runtime bundles";
    const catalogMarker = "Regenerating catalog-compiler surfaces";

    const esbuildIndex = script.indexOf(esbuildMarker);
    const catalogIndex = script.indexOf(catalogMarker);

    expect(esbuildIndex).toBeGreaterThanOrEqual(0);
    expect(catalogIndex).toBeGreaterThanOrEqual(0);
    expect(esbuildIndex).toBeLessThan(catalogIndex);
  });
});
