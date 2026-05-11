// Render a one-line JSON-shape skeleton from a Zod schema.
//
// Used by flow `relay-hints.ts` authors so the shape portion of a relay
// instruction is derived from the report's Zod schema rather than typed
// out by hand. Authors keep the task-specific guidance and the
// mechanical tail (no code fences, JSON.parse, validation) as authored
// prose — only the literal `{ "field": "<placeholder>", ... }` part is
// generated here.
//
// Field-level placeholders default to `<string>`, `<number>`, etc. An
// author can override the placeholder for any leaf field by calling
// `.describe('what the field carries')` on the Zod schema; the renderer
// renders that description as the placeholder text. Object and array
// shapes always recurse, so descriptions only matter on leaves.
//
// Limitations the renderer degrades on intentionally:
//   - ZodUnion (non-discriminated) renders each option separated by ` |
//     `. Authors usually want a more guided prose explanation for
//     unions, so this is a deliberately-bare default.
//   - ZodDiscriminatedUnion collapses to a single shape when every
//     branch is a ZodObject with the same key set; the discriminator
//     field becomes an enum-like placeholder. Heterogeneous-shape
//     unions fall back to `a | b | c`.
//   - ZodAny / ZodUnknown render as `<any>` / `<unknown>` placeholders
//     and rely on authored guidance.
//   - `.superRefine`-only invariants that the structural type can't
//     express (e.g. value-conditional minimums) stay in authored prose.
//   - ZodLazy / recursive schemas are guarded against infinite
//     recursion: a node visited again at deeper depth renders as
//     `<recursive>` rather than blowing the stack.

import type { ZodTypeAny } from 'zod';

interface ZodDef {
  readonly typeName: string;
  readonly description?: string;
  readonly [key: string]: unknown;
}

function defOf(node: ZodTypeAny): ZodDef {
  return (node as unknown as { readonly _def: ZodDef })._def;
}

// JSON-escape a string for inline use inside a double-quoted JSON-shape
// placeholder. The renderer emits inline JSON-ish prose, not strict JSON,
// but unescaped quotes/backslashes in a `.describe()` text or in an object
// key can break the visual shape (and confuse a worker that tries to
// JSON.parse the literal example). Reuse JSON.stringify and strip the
// surrounding quotes so the escape rules stay in lockstep with the
// language standard.
function escapeJsonInner(value: string): string {
  const serialized = JSON.stringify(value);
  return serialized.slice(1, serialized.length - 1);
}

function leafDescriptionOr(node: ZodTypeAny, fallback: string): string {
  const description = defOf(node).description;
  if (typeof description === 'string' && description.length > 0) {
    return `"<${escapeJsonInner(description)}>"`;
  }
  return fallback;
}

// Render-time recursion guard. The visited set captures Zod nodes already
// on the render stack so a `z.lazy(() => Node)` self-reference is detected
// at the second visit and short-circuited. The set is render-call-scoped,
// not module-global, so independent schemas don't share state.
const MAX_RECURSION_DEPTH = 32;

export function renderShapeSkeleton(schema: ZodTypeAny): string {
  return renderNode(schema, new Set(), 0);
}

function renderNode(node: ZodTypeAny, visited: Set<ZodTypeAny>, depth: number): string {
  if (visited.has(node) || depth > MAX_RECURSION_DEPTH) {
    return '<recursive>';
  }
  visited.add(node);
  try {
    return renderNodeInner(node, visited, depth + 1);
  } finally {
    visited.delete(node);
  }
}

function renderNodeInner(node: ZodTypeAny, visited: Set<ZodTypeAny>, depth: number): string {
  const def = defOf(node);
  switch (def.typeName) {
    case 'ZodObject': {
      const shapeFn = def.shape as () => Record<string, ZodTypeAny>;
      const shape =
        typeof shapeFn === 'function'
          ? shapeFn()
          : (def.shape as unknown as Record<string, ZodTypeAny>);
      const entries = Object.entries(shape).map(
        ([key, child]) => `"${escapeJsonInner(key)}": ${renderNode(child, visited, depth)}`,
      );
      return `{ ${entries.join(', ')} }`;
    }
    case 'ZodArray': {
      const inner = renderNode(def.type as ZodTypeAny, visited, depth);
      return `[${inner}]`;
    }
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
    case 'ZodReadonly':
    case 'ZodBranded':
    case 'ZodCatch':
      return renderNode(def.innerType as ZodTypeAny, visited, depth);
    case 'ZodEffects':
      return renderNode(def.schema as ZodTypeAny, visited, depth);
    case 'ZodPipeline':
      return renderNode(def.out as ZodTypeAny, visited, depth);
    case 'ZodLiteral': {
      const value = def.value;
      return typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value);
    }
    case 'ZodEnum': {
      const values = def.values as readonly string[];
      return `"<${values.map(escapeJsonInner).join('|')}>"`;
    }
    case 'ZodNativeEnum': {
      // A native enum's `.values` is the raw enum object. For a TS string
      // enum {A:'a',B:'b'} that's {A:'a',B:'b'}; for a numeric enum {A,B}
      // it's the bi-directional {0:'A',1:'B',A:0,B:1} reverse-mapped form.
      // Zod only accepts the *value side*, so filter to the accepted set
      // by dropping reverse-mapped keys (numeric values whose key is a
      // string name that also appears as a value's key).
      const raw = def.values as Record<string, string | number>;
      const isReverseMapped = Object.values(raw).some(
        (value) => typeof value === 'number' && Object.hasOwn(raw, String(value)),
      );
      const accepted = isReverseMapped
        ? Object.values(raw).filter((value): value is number => typeof value === 'number')
        : Object.values(raw);
      const rendered = accepted.map((value) =>
        typeof value === 'string' ? escapeJsonInner(value) : String(value),
      );
      return `"<${rendered.join('|')}>"`;
    }
    case 'ZodString':
      return leafDescriptionOr(node, '"<string>"');
    case 'ZodNumber':
      return leafDescriptionOr(node, '<number>');
    case 'ZodBigInt':
      return leafDescriptionOr(node, '<bigint>');
    case 'ZodBoolean':
      return leafDescriptionOr(node, '<true|false>');
    case 'ZodDate':
      return leafDescriptionOr(node, '"<iso-date>"');
    case 'ZodNull':
      return 'null';
    case 'ZodUndefined':
      return '<undefined>';
    case 'ZodAny':
      return leafDescriptionOr(node, '<any>');
    case 'ZodUnknown':
      return leafDescriptionOr(node, '<unknown>');
    case 'ZodNever':
      return '<never>';
    case 'ZodRecord':
      return `{ "<key>": ${renderNode(def.valueType as ZodTypeAny, visited, depth)} }`;
    case 'ZodMap':
      return `{ "<key>": ${renderNode(def.valueType as ZodTypeAny, visited, depth)} }`;
    case 'ZodTuple': {
      const items = (def.items as ZodTypeAny[]).map((item) => renderNode(item, visited, depth));
      const rest = def.rest as ZodTypeAny | undefined | null;
      if (rest !== undefined && rest !== null) {
        items.push(`...${renderNode(rest, visited, depth)}`);
      }
      return `[${items.join(', ')}]`;
    }
    case 'ZodDiscriminatedUnion': {
      const discriminator = def.discriminator as string;
      const options = def.options as ZodTypeAny[];
      const collapsed = collapseDiscriminatedUnion(discriminator, options, visited, depth);
      if (collapsed !== undefined) return collapsed;
      return options.map((opt) => renderNode(opt, visited, depth)).join(' | ');
    }
    case 'ZodUnion': {
      const options = def.options as ZodTypeAny[];
      return options.map((opt) => renderNode(opt, visited, depth)).join(' | ');
    }
    case 'ZodLazy': {
      const getter = def.getter as () => ZodTypeAny;
      return renderNode(getter(), visited, depth);
    }
    case 'ZodIntersection': {
      const left = renderNode(def.left as ZodTypeAny, visited, depth);
      const right = renderNode(def.right as ZodTypeAny, visited, depth);
      return `${left} & ${right}`;
    }
    default:
      return `<${def.typeName}>`;
  }
}

// Collapse a discriminated union of ZodObject branches into a single shape
// when every branch has the same key set. The discriminator field renders
// as an enum-style placeholder listing the literal values across branches;
// other fields render from the first branch (they're expected to match in
// shape, even if their value constraints differ). Returns undefined when
// branches diverge structurally, in which case the caller falls back to
// `a | b | c` rendering.
function collapseDiscriminatedUnion(
  discriminator: string,
  options: readonly ZodTypeAny[],
  visited: Set<ZodTypeAny>,
  depth: number,
): string | undefined {
  if (options.length === 0) return undefined;
  const objectShapes: Record<string, ZodTypeAny>[] = [];
  const discriminatorValues: unknown[] = [];
  for (const option of options) {
    const optDef = defOf(option);
    if (optDef.typeName !== 'ZodObject') return undefined;
    const shapeFn = optDef.shape as () => Record<string, ZodTypeAny>;
    const shape =
      typeof shapeFn === 'function'
        ? shapeFn()
        : (optDef.shape as unknown as Record<string, ZodTypeAny>);
    objectShapes.push(shape);
    const discriminatorNode = shape[discriminator];
    if (discriminatorNode === undefined) return undefined;
    const discriminatorDef = defOf(discriminatorNode);
    if (discriminatorDef.typeName !== 'ZodLiteral') return undefined;
    discriminatorValues.push(discriminatorDef.value);
  }
  const firstShape = objectShapes[0];
  if (firstShape === undefined) return undefined;
  const keyList = Object.keys(firstShape);
  const keyListSorted = keyList.slice().sort();
  for (const shape of objectShapes) {
    const shapeKeys = Object.keys(shape).slice().sort();
    if (shapeKeys.length !== keyListSorted.length) return undefined;
    for (let idx = 0; idx < shapeKeys.length; idx += 1) {
      if (shapeKeys[idx] !== keyListSorted[idx]) return undefined;
    }
  }
  const entries = keyList.map((key) => {
    if (key === discriminator) {
      const rendered = discriminatorValues.map((value) =>
        typeof value === 'string' ? escapeJsonInner(value) : String(value),
      );
      return `"${escapeJsonInner(key)}": "<${rendered.join('|')}>"`;
    }
    const child = firstShape[key];
    if (child === undefined) return `"${escapeJsonInner(key)}": <missing>`;
    return `"${escapeJsonInner(key)}": ${renderNode(child, visited, depth)}`;
  });
  return `{ ${entries.join(', ')} }`;
}
