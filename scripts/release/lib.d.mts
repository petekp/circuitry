import type { z } from 'zod';

export const projectRoot: string;

export function readText(relPath: string): string;
export function readJson<T = unknown>(relPath: string): T;
export function readYaml<T = unknown>(relPath: string): T;

export function loadYamlWithSchema<T extends z.ZodTypeAny>(relPath: string, schema: T): z.infer<T>;
export function loadJsonWithSchema<T extends z.ZodTypeAny>(relPath: string, schema: T): z.infer<T>;

export function pathExists(relPath: string): boolean;
export function listFiles(relDir: string, predicate?: (entry: string) => boolean): string[];
export function listMarkdownBasenames(relDir: string): string[];
export function fileIsPresent(relPath: string): boolean;

export function stableJson(value: unknown): string;
export function formatWithBiome(relPath: string, content: string): string;
export function writeOrCheck(relPath: string, content: string, check: boolean): void;
export function formatMarkdown(content: string): string;
export function runBiomeFormat(relPath: string): void;

// Dist-loader helpers used by the smaller release scripts that still consume
// them. New TypeScript scripts should import directly from src/* via
// `import type` and dynamic-import dist/*.js with a typed cast instead.
export function loadReleaseSchemas(): Promise<unknown>;
export function loadReleaseChecks(): Promise<unknown>;
export function loadCurrentCatalog(): Promise<unknown>;
export function loadRouter(): Promise<unknown>;
export function loadConnectorSchemas(): Promise<unknown>;
