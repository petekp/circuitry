#!/usr/bin/env node

import { resolve } from "node:path";

import { unknownOption } from "./unknown-option.js";

import {
  loadMergedCatalog,
  loadShippedCatalog,
  loadUserGlobalCatalog,
  materializeCustomCommandSurfaces,
  publishDraft,
  validateDraft,
} from "../catalog/custom-circuits.js";
import { REPO_ROOT } from "../schema.js";

type Scope = "merged" | "shipped" | "user_global";

interface ParsedArgs {
  command: "catalog" | "materialize" | "publish-draft" | "validate-draft";
  entryMode?: string;
  goal?: string;
  homeDir?: string;
  includeMarketplace: boolean;
  pluginRoot?: string;
  projectRoot?: string;
  scope: Scope;
  slug?: string;
}

function usage(): string {
  return [
    "Usage:",
    "  custom-circuits catalog [--scope merged|shipped|user_global] [--home <path>]",
    "  custom-circuits materialize [--plugin-root <path>] [--home <path>] [--include-marketplace]",
    "  custom-circuits validate-draft --slug <slug> [--plugin-root <path>] [--home <path>] [--project-root <path>] [--entry-mode <mode>] [--goal <text>]",
    "  custom-circuits publish-draft --slug <slug> [--plugin-root <path>] [--home <path>] [--include-marketplace]",
    "",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (!["catalog", "materialize", "publish-draft", "validate-draft"].includes(command ?? "")) {
    throw new Error(usage());
  }

  let entryMode: string | undefined;
  let goal: string | undefined;
  let homeDir: string | undefined;
  let includeMarketplace = false;
  let pluginRoot: string | undefined;
  let projectRoot: string | undefined;
  let scope: Scope = "merged";
  let slug: string | undefined;

  for (let index = 0; index < rest.length; index++) {
    const value = rest[index];

    switch (value) {
      case "--entry-mode":
        entryMode = requireValue("--entry-mode", rest[index + 1]);
        index++;
        break;
      case "--goal":
        goal = requireValue("--goal", rest[index + 1]);
        index++;
        break;
      case "--home":
        homeDir = resolve(requireValue("--home", rest[index + 1]));
        index++;
        break;
      case "--plugin-root":
        pluginRoot = resolve(requireValue("--plugin-root", rest[index + 1]));
        index++;
        break;
      case "--include-marketplace":
        includeMarketplace = true;
        break;
      case "--project-root":
        projectRoot = resolve(requireValue("--project-root", rest[index + 1]));
        index++;
        break;
      case "--scope": {
        const candidate = requireValue("--scope", rest[index + 1]) as Scope;
        if (!["merged", "shipped", "user_global"].includes(candidate)) {
          throw new Error(`custom-circuits: invalid --scope ${candidate}`);
        }
        scope = candidate;
        index++;
        break;
      }
      case "--slug":
        slug = requireValue("--slug", rest[index + 1]);
        index++;
        break;
      default:
        throw new Error(unknownOption(value, ["--entry-mode", "--goal", "--home", "--plugin-root", "--include-marketplace", "--project-root", "--scope", "--slug"]));
    }
  }

  return {
    command: command as ParsedArgs["command"],
    entryMode,
    goal,
    homeDir,
    includeMarketplace,
    pluginRoot,
    projectRoot,
    scope,
    slug,
  };
}

function requireValue(flag: string, value?: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`custom-circuits: missing value for ${flag}`);
  }

  return value;
}

function main(): number {
  try {
    const args = parseArgs(process.argv.slice(2));
    const skillsDir = resolve(args.pluginRoot ?? REPO_ROOT, "skills");

    if (args.command === "catalog") {
      const catalog = args.scope === "shipped"
        ? loadShippedCatalog(skillsDir)
        : args.scope === "user_global"
        ? loadUserGlobalCatalog(args.homeDir)
        : loadMergedCatalog({
          homeDir: args.homeDir,
          skillsDir,
        });

      process.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`);
      return 0;
    }

    if (args.command === "validate-draft") {
      if (!args.slug) {
        throw new Error("custom-circuits: --slug is required for validate-draft");
      }

      const result = validateDraft({
        entryMode: args.entryMode,
        goal: args.goal,
        homeDir: args.homeDir ?? process.env.HOME ?? "",
        pluginRoot: resolve(args.pluginRoot ?? REPO_ROOT),
        projectRoot: resolve(args.projectRoot ?? process.cwd()),
        slug: args.slug,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    if (args.command === "publish-draft") {
      if (!args.slug) {
        throw new Error("custom-circuits: --slug is required for publish-draft");
      }

      const result = publishDraft({
        homeDir: args.homeDir ?? process.env.HOME ?? "",
        includeMarketplace: args.includeMarketplace,
        pluginRoot: resolve(args.pluginRoot ?? REPO_ROOT),
        slug: args.slug,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    const result = materializeCustomCommandSurfaces({
      homeDir: args.homeDir ?? process.env.HOME ?? "",
      includeMarketplace: args.includeMarketplace,
      pluginRoot: resolve(args.pluginRoot ?? REPO_ROOT),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

process.exit(main());
