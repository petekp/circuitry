import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { formatWithBiome, stableJson } from '../shared/format.ts';
import {
  type YamlEditorSchemaTarget,
  loadYamlEditorSchemaTargets,
} from './yaml-schema-registry.ts';

const projectRoot = resolve(new URL('../..', import.meta.url).pathname);

function generatedSchemaFor(target: YamlEditorSchemaTarget): Record<string, unknown> {
  const converted = z.toJSONSchema(target.schema, {
    target: 'draft-07',
    io: 'input',
    reused: 'inline',
    cycles: 'ref',
  });
  if (typeof converted !== 'object' || converted === null || Array.isArray(converted)) {
    throw new Error(`JSON Schema conversion for ${target.name} returned a non-object value`);
  }

  const { $schema, ...body } = converted as Record<string, unknown>;
  return {
    $schema: typeof $schema === 'string' ? $schema : 'http://json-schema.org/draft-07/schema#',
    $id: target.id,
    title: target.title,
    description: target.description,
    ...body,
  };
}

function writeOrCheck(relPath: string, content: string, check: boolean): void {
  const abs = resolve(projectRoot, relPath);
  if (check) {
    if (!existsSync(abs)) {
      throw new Error(`${relPath} is missing; run npm run emit-yaml-schemas`);
    }
    const current = readFileSync(abs, 'utf8');
    if (current !== content) {
      throw new Error(`${relPath} drifted; run npm run emit-yaml-schemas`);
    }
    console.log(`✓ ${relPath} is in sync`);
    return;
  }

  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  console.log(`emitted ${relPath}`);
}

export async function emitYamlSchemas(options: { readonly check?: boolean } = {}): Promise<void> {
  const check = options.check === true;
  for (const target of await loadYamlEditorSchemaTargets()) {
    writeOrCheck(
      target.schemaPath,
      formatWithBiome(target.schemaPath, stableJson(generatedSchemaFor(target)), projectRoot),
      check,
    );
  }
}

await emitYamlSchemas({ check: process.argv.includes('--check') });
