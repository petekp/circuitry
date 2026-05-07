import type { BlockCatalog, Schematic } from './types';

export async function listFlows(): Promise<string[]> {
  const r = await fetch('/api/flows');
  if (!r.ok) throw new Error('failed to list flows');
  const data = await r.json();
  return data.flows ?? [];
}

export async function loadSchematic(id: string): Promise<Schematic> {
  const r = await fetch(`/api/flows/${id}/schematic`);
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error ?? `failed to load schematic ${id}`);
  }
  return r.json();
}

export async function saveSchematic(
  id: string,
  schematic: Schematic,
): Promise<{ ok: boolean; errors?: unknown[] }> {
  const r = await fetch(`/api/flows/${id}/schematic`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schematic),
  });
  return r.json();
}

export async function loadBlocks(): Promise<BlockCatalog> {
  const r = await fetch('/api/blocks');
  if (!r.ok) throw new Error('failed to load block catalog');
  return r.json();
}
