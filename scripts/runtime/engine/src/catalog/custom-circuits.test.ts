import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadMergedCatalog,
  materializeCustomCommandSurfaces,
  materializeCustomCommandSurface,
  publishDraft,
  readOverlayManifest,
  resolveCircuitHomePaths,
  validateDraft,
} from "./custom-circuits.js";

function writeWorkflow(
  root: string,
  slug: string,
  options?: {
    description?: string;
    exclude?: string[];
    include?: string[];
    usage?: string;
  },
): void {
  const description = options?.description ?? `${slug} description.`;
  const include = options?.include ?? ["feature"];
  const exclude = options?.exclude ?? [];
  const usageLine = options?.usage ? `    usage: ${options.usage}\n` : "";
  const skillDir = resolve(root, slug);

  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    resolve(skillDir, "SKILL.md"),
    [
      "---",
      `name: ${slug}`,
      `description: "${description}"`,
      "---",
      "",
      `# ${slug}`,
      "",
    ].join("\n"),
    "utf-8",
  );
  writeFileSync(
    resolve(skillDir, "circuit.yaml"),
    [
      'schema_version: "2"',
      "circuit:",
      `  id: ${slug}`,
      '  version: "2026-04-11"',
      `  purpose: "${description}"`,
      "  entry:",
      usageLine.trimEnd(),
      "    signals:",
      `      include: [${include.join(", ")}]`,
      `      exclude: [${exclude.join(", ")}]`,
      "  entry_modes:",
      "    default:",
      "      start_at: frame",
      '      description: "Default"',
      "  steps:",
      "    - id: frame",
      '      title: "Frame"',
      "      executor: orchestrator",
      "      kind: synthesis",
      "      reads: [user.task]",
      "      writes:",
      "        artifact:",
      "          path: artifacts/brief.md",
      "          schema: brief@v1",
      "      gate:",
      "        kind: schema_sections",
      "        source: artifacts/brief.md",
      "        required: [Objective]",
      "      routes:",
      '        pass: "@complete"',
      "",
    ].filter(Boolean).join("\n"),
    "utf-8",
  );
}

function makePluginRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "circuit-custom-plugin-"));
  mkdirSync(resolve(root, ".claude-plugin"), { recursive: true });
  mkdirSync(resolve(root, "commands"), { recursive: true });
  mkdirSync(resolve(root, "skills"), { recursive: true });

  writeWorkflow(resolve(root, "skills"), "build");
  writeWorkflow(resolve(root, "skills"), "run", {
    include: ["any_task"],
    usage: "<task>",
  });
  writeFileSync(resolve(root, ".claude-plugin", "public-commands.txt"), "build\nrun\n", "utf-8");
  writeFileSync(resolve(root, "commands", "build.md"), "# build\n", "utf-8");
  writeFileSync(resolve(root, "commands", "run.md"), "# run\n", "utf-8");

  return root;
}

describe("custom circuit catalog", () => {
  it("merges shipped and user-global catalogs with origin metadata", () => {
    const pluginRoot = makePluginRoot();
    const homeDir = mkdtempSync(resolve(tmpdir(), "circuit-custom-home-"));
    const { skillsRoot } = resolveCircuitHomePaths(homeDir);

    writeWorkflow(skillsRoot, "research", {
      description: "Research custom workflow.",
      include: ["research", "deep_dive"],
      exclude: ["bug"],
    });

    const catalog = loadMergedCatalog({
      homeDir,
      skillsDir: resolve(pluginRoot, "skills"),
    });

    expect(catalog.map((entry) => `${entry.origin}:${entry.slug}`)).toEqual([
      "shipped:build",
      "user_global:research",
      "shipped:run",
    ]);

    const research = catalog.find((entry) => entry.slug === "research");
    expect(research).toMatchObject({
      manifestPath: resolve(skillsRoot, "research", "circuit.yaml"),
      origin: "user_global",
      skillMdPath: resolve(skillsRoot, "research", "SKILL.md"),
    });
  });

  it("rejects custom slug collisions against shipped commands and reserved aliases", () => {
    const pluginRoot = makePluginRoot();
    const homeDir = mkdtempSync(resolve(tmpdir(), "circuit-custom-home-"));
    const { skillsRoot } = resolveCircuitHomePaths(homeDir);

    writeWorkflow(skillsRoot, "build");
    expect(() =>
      loadMergedCatalog({
        homeDir,
        skillsDir: resolve(pluginRoot, "skills"),
      }),
    ).toThrow('custom circuit slug "build" is reserved');

    rmSync(skillsRoot, { force: true, recursive: true });
    writeWorkflow(resolveCircuitHomePaths(homeDir).skillsRoot, "fix");
    expect(() =>
      loadMergedCatalog({
        homeDir,
        skillsDir: resolve(pluginRoot, "skills"),
      }),
    ).toThrow('custom circuit slug "fix" is reserved');
  });
});

describe("materializeCustomCommandSurface", () => {
  it("writes overlay-managed command shims and prunes stale ones", () => {
    const pluginRoot = makePluginRoot();
    const homeDir = mkdtempSync(resolve(tmpdir(), "circuit-custom-home-"));
    const { skillsRoot } = resolveCircuitHomePaths(homeDir);

    writeWorkflow(skillsRoot, "research", {
      description: "Research custom workflow. More detail.",
      include: ["research", "deep_dive"],
      exclude: ["bug"],
    });

    const firstResult = materializeCustomCommandSurface({
      homeDir,
      pluginRoot,
    });

    expect(readFileSync(resolve(pluginRoot, ".claude-plugin", "public-commands.txt"), "utf-8")).toBe(
      "build\nresearch\nrun\n",
    );
    const customShimPath = resolve(pluginRoot, "commands", "research.md");
    const customShim = readFileSync(customShimPath, "utf-8");
    expect(customShim).toContain("overlay-managed from the user-global custom circuit catalog");
    expect(customShim).toContain(resolve(skillsRoot, "research", "SKILL.md"));
    expect(customShim).toContain(resolve(skillsRoot, "research", "circuit.yaml"));

    const overlay = readOverlayManifest(homeDir);
    expect(overlay?.circuits.map((entry) => entry.slug)).toEqual(["research"]);
    expect(firstResult.writtenFiles).toContain(customShimPath);

    rmSync(resolve(skillsRoot, "research"), { force: true, recursive: true });
    writeWorkflow(skillsRoot, "investigate", {
      description: "Investigate custom workflow.",
      include: ["deep_dive", "investigation"],
    });
    const secondResult = materializeCustomCommandSurface({
      homeDir,
      pluginRoot,
    });

    expect(readFileSync(resolve(pluginRoot, ".claude-plugin", "public-commands.txt"), "utf-8")).toBe(
      "build\ninvestigate\nrun\n",
    );
    expect(secondResult.removedFiles).toContain(customShimPath);
    expect(() => readFileSync(customShimPath, "utf-8")).toThrow();
    expect(readFileSync(resolve(pluginRoot, "commands", "investigate.md"), "utf-8")).toContain(
      resolve(skillsRoot, "investigate", "SKILL.md"),
    );
  });

  it("can materialize both the active plugin root and the marketplace clone", () => {
    const pluginRoot = makePluginRoot();
    const marketplaceRoot = makePluginRoot();
    const homeDir = mkdtempSync(resolve(tmpdir(), "circuit-custom-home-"));
    const { skillsRoot } = resolveCircuitHomePaths(homeDir);

    writeWorkflow(skillsRoot, "research", {
      description: "Research custom workflow.",
      include: ["research"],
    });

    const originalMarketplaceEnv = process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR;
    process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR = marketplaceRoot;

    try {
      const result = materializeCustomCommandSurfaces({
        homeDir,
        includeMarketplace: true,
        pluginRoot,
      });

      expect(result.results.map((entry) => entry.pluginRoot).sort()).toEqual(
        [marketplaceRoot, pluginRoot].sort(),
      );
      expect(readFileSync(resolve(pluginRoot, ".claude-plugin", "public-commands.txt"), "utf-8")).toBe(
        "build\nresearch\nrun\n",
      );
      expect(readFileSync(resolve(marketplaceRoot, ".claude-plugin", "public-commands.txt"), "utf-8")).toBe(
        "build\nresearch\nrun\n",
      );
    } finally {
      if (originalMarketplaceEnv == null) {
        delete process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR;
      } else {
        process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR = originalMarketplaceEnv;
      }
    }
  });
});

describe("draft helpers", () => {
  it("validates a draft through the runtime helper", () => {
    const pluginRoot = makePluginRoot();
    const homeDir = mkdtempSync(resolve(tmpdir(), "circuit-custom-home-"));
    const { draftsRoot } = resolveCircuitHomePaths(homeDir);

    writeWorkflow(draftsRoot, "research", {
      description: "Research draft workflow.",
      include: ["research"],
    });

    const result = validateDraft({
      homeDir,
      pluginRoot,
      projectRoot: pluginRoot,
      slug: "research",
    });

    expect(result.slug).toBe("research");
    expect(result.draftRoot).toBe(resolve(draftsRoot, "research"));
    expect(result.activeRunPath.endsWith("artifacts/active-run.md")).toBe(true);
    expect(result.runRoot).toContain("circuit-create-");
    expect(() => readFileSync(resolve(result.runRoot, "state.json"), "utf-8")).toThrow();
  });

  it("publishes a draft and removes the draft copy", () => {
    const pluginRoot = makePluginRoot();
    const marketplaceRoot = makePluginRoot();
    const homeDir = mkdtempSync(resolve(tmpdir(), "circuit-custom-home-"));
    const { draftsRoot } = resolveCircuitHomePaths(homeDir);

    writeWorkflow(draftsRoot, "research", {
      description: "Research draft workflow.",
      include: ["research"],
    });

    const originalMarketplaceEnv = process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR;
    process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR = marketplaceRoot;

    try {
      const result = publishDraft({
        homeDir,
        includeMarketplace: true,
        pluginRoot,
        slug: "research",
      });

      expect(result.slug).toBe("research");
      expect(result.publishedSkillRoot).toBe(resolve(homeDir, ".claude", "circuit", "skills", "research"));
      expect(() => readFileSync(resolve(draftsRoot, "research", "SKILL.md"), "utf-8")).toThrow();
      expect(readFileSync(resolve(result.publishedSkillRoot, "SKILL.md"), "utf-8")).toContain(
        "Research draft workflow.",
      );
      expect(readFileSync(resolve(pluginRoot, ".claude-plugin", "public-commands.txt"), "utf-8")).toBe(
        "build\nresearch\nrun\n",
      );
      expect(readFileSync(resolve(marketplaceRoot, ".claude-plugin", "public-commands.txt"), "utf-8")).toBe(
        "build\nresearch\nrun\n",
      );
    } finally {
      if (originalMarketplaceEnv == null) {
        delete process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR;
      } else {
        process.env.CLAUDE_PLUGIN_MARKETPLACE_DIR = originalMarketplaceEnv;
      }
    }
  });
});
