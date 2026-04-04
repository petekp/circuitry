/**
 * Shared catalog types. This is the single contract between extractor,
 * generator, and validator. No other module may define its own catalog shape.
 */

export interface CircuitEntry {
  kind: "circuit";
  id: string;
  dir: string;
  version: string;
  purpose: string;
  entryCommand: string | undefined;
  expertCommand: string;
  entryModes: string[];
  skillName: string;
  skillDescription: string;
}

export interface UtilityEntry {
  kind: "utility";
  id: string;
  dir: string;
  skillName: string;
  skillDescription: string;
}

export type CatalogEntry = CircuitEntry | UtilityEntry;
export type Catalog = CatalogEntry[];

export interface GenerateTarget {
  filePath: string;
  blockName: string;
  render: (catalog: Catalog) => string;
}

export interface GenerateResult {
  patchedFiles: string[];
}
