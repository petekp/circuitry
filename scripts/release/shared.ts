import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import YAML from 'yaml';
import type { z } from 'zod';

export const projectRoot = resolve(new URL('../..', import.meta.url).pathname);

export function readText(relPath: string): string {
  return readFileSync(resolve(projectRoot, relPath), 'utf8');
}

// biome-ignore lint/suspicious/noExplicitAny: caller can provide a schema-specific generic.
export function readJson<T = any>(relPath: string): T {
  return JSON.parse(readText(relPath)) as T;
}

// biome-ignore lint/suspicious/noExplicitAny: caller can provide a schema-specific generic.
export function readYaml<T = any>(relPath: string): T {
  return YAML.parse(readText(relPath)) as T;
}

export function loadYamlWithSchema<T extends z.ZodTypeAny>(relPath: string, schema: T): z.infer<T> {
  return schema.parse(readYaml(relPath));
}

export function loadJsonWithSchema<T extends z.ZodTypeAny>(relPath: string, schema: T): z.infer<T> {
  return schema.parse(readJson(relPath));
}

export function pathExists(relPath: string): boolean {
  return existsSync(resolve(projectRoot, relPath));
}

export function listFiles(
  relDir: string,
  predicate: (entry: string) => boolean = () => true,
): string[] {
  const abs = resolve(projectRoot, relDir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((entry) => predicate(entry))
    .sort()
    .map((entry) => `${relDir}/${entry}`);
}

export function listMarkdownBasenames(relDir: string): string[] {
  return listFiles(relDir, (entry) => entry.endsWith('.md')).map((file) =>
    file.slice(file.lastIndexOf('/') + 1, -'.md'.length),
  );
}

export function fileIsPresent(relPath: string): boolean {
  try {
    return statSync(resolve(projectRoot, relPath)).isFile();
  } catch {
    return false;
  }
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function formatWithBiome(relPath: string, content: string): string {
  return execFileSync('npx', ['biome', 'format', '--stdin-file-path', relPath], {
    cwd: projectRoot,
    input: content,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function writeOrCheck(relPath: string, content: string, check: boolean): void {
  const abs = resolve(projectRoot, relPath);
  if (check) {
    if (!existsSync(abs)) {
      throw new Error(`${relPath} is missing; run the matching emit command`);
    }
    const current = readFileSync(abs, 'utf8');
    if (current !== content) {
      throw new Error(`${relPath} drifted; run the matching emit command`);
    }
    console.log(`✓ ${relPath} is in sync`);
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  console.log(`emitted ${relPath}`);
}

export function formatMarkdown(content: string): string {
  return `${content.replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

// biome-ignore lint/suspicious/noExplicitAny: dynamically imports built release schema module.
export async function loadReleaseSchemas(): Promise<any> {
  return import(resolve(projectRoot, 'dist/release/schemas.js'));
}

// biome-ignore lint/suspicious/noExplicitAny: dynamically imports built release checks module.
export async function loadReleaseChecks(): Promise<any> {
  return import(resolve(projectRoot, 'dist/release/checks.js'));
}

// biome-ignore lint/suspicious/noExplicitAny: dynamically imports built catalog module.
export async function loadCurrentCatalog(): Promise<any> {
  return import(resolve(projectRoot, 'dist/flows/catalog.js'));
}

// biome-ignore lint/suspicious/noExplicitAny: dynamically imports built router module.
export async function loadRouter(): Promise<any> {
  return import(resolve(projectRoot, 'dist/flows/router.js'));
}

// biome-ignore lint/suspicious/noExplicitAny: dynamically imports built connector schemas module.
export async function loadConnectorSchemas(): Promise<any> {
  return import(resolve(projectRoot, 'dist/schemas/connector.js'));
}

export function runBiomeFormat(relPath: string): void {
  execFileSync('npx', ['biome', 'format', '--write', resolve(projectRoot, relPath)], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}
