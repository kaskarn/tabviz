// Runtime behavior dispatcher for the schema system.
//
// `dispatch(schemaKey, name)` returns a callable that:
//   - walks the inheritance chain leaf → root
//   - calls the most-specific (leaf-most) schema that defines the behavior
//   - injects a `parents` proxy so the leaf can delegate up:
//       parents["numeric"](value, opts, ctx)
//     and each ancestor likewise gets its own `parents` of its own
//     ancestors. Composition is recursive and lazy.
//
// `dispatchForColumn(col, name)` is the convenience entry point: it
// resolves the right concrete schema for a ColumnSpec (type +
// bucket-disambiguation) and forwards.
//
// Returns `undefined` when no schema in the chain implements the
// behavior, letting call sites apply their default fallback.

import type { ColumnSpec } from "../types";
import type { ColumnSchema } from "./types";
import type {
  SchemaBehaviors,
  RenderContext,
  RenderNode,
  ParentRenderers,
} from "./render-types";
import { getSchema, getBehaviors, getRenderer, allSchemaKeys, type RenderTarget } from "./extend";
import { resolveSchema } from "./resolve";
import { applyTheme, type NodeRules } from "./theme-finalize";

// ────────────────────────────────────────────────────────────────────
// Schema lookup from a ColumnSpec
// ────────────────────────────────────────────────────────────────────
//
// Same algorithm banks.ts uses internally: filter by wire `type`, then
// disambiguate by `bucket`-in-options. Moved here so callers outside
// banks can reuse it.

export function findSchemaForColumn(col: ColumnSpec): ColumnSchema | undefined {
  const opts = col.options as Record<string, unknown> | undefined;
  const candidates: ColumnSchema[] = [];
  for (const key of allSchemaKeys()) {
    const s = getSchema(key);
    if (!s || s.abstract) continue;
    if (s.type !== col.type) continue;
    candidates.push(s);
  }
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const bucketed = candidates.filter((s) => s.bucket && opts && s.bucket in opts);
  if (bucketed.length === 1) return bucketed[0];
  return candidates[0];
}

// ────────────────────────────────────────────────────────────────────
// Behavior dispatcher
// ────────────────────────────────────────────────────────────────────

/**
 * Strip the trailing `parents` argument from a behavior function's
 * signature. The dispatcher injects parents automatically; callers
 * pass only the leading args.
 */
type StripLast<F> = F extends (...args: [...infer A, infer _Last]) => infer R
  ? (...args: A) => R
  : never;

/**
 * `unknown[] → unknown` shape we use internally to call schema
 * behaviors without committing to a specific arity at the type level.
 * Public `dispatch` narrows back to the right signature via `StripLast`.
 */
type AnyBehaviorFn = (...args: unknown[]) => unknown;

export function dispatch<K extends keyof SchemaBehaviors>(
  schemaKey: string,
  behaviorName: K,
): StripLast<NonNullable<SchemaBehaviors[K]>> | undefined {
  const schema = getSchema(schemaKey);
  if (!schema) return undefined;

  // base-first → leaf-last
  const chain = resolveSchema(schema);

  // Find the leaf-most schema in the chain that defines this behavior.
  let leafIdx = -1;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (getBehaviors(chain[i].key)?.[behaviorName] != null) {
      leafIdx = i;
      break;
    }
  }
  if (leafIdx === -1) return undefined;

  // Recursively build a callable at index `idx`:
  //  - look up the raw fn on chain[idx]
  //  - assemble its `parents` map from all strictly older ancestors
  //    that also define this behavior, each with its own `parents`
  const buildAt = (idx: number): AnyBehaviorFn => {
    const raw = getBehaviors(chain[idx].key)?.[behaviorName] as
      | AnyBehaviorFn
      | undefined;
    if (!raw) {
      throw new Error(
        `dispatch: chain[${idx}] (${chain[idx].key}) lost its ${String(behaviorName)} behavior between lookup and build`,
      );
    }
    const parents: Record<string, AnyBehaviorFn> = {};
    for (let i = 0; i < idx; i++) {
      if (getBehaviors(chain[i].key)?.[behaviorName] != null) {
        parents[chain[i].key] = buildAt(i);
      }
    }
    return (...args: unknown[]) => raw(...args, parents);
  };

  return buildAt(leafIdx) as StripLast<NonNullable<SchemaBehaviors[K]>>;
}

/**
 * Convenience: resolve the schema for a ColumnSpec and dispatch on it.
 */
export function dispatchForColumn<K extends keyof SchemaBehaviors>(
  col: ColumnSpec,
  behaviorName: K,
): StripLast<NonNullable<SchemaBehaviors[K]>> | undefined {
  const schema = findSchemaForColumn(col);
  if (!schema) return undefined;
  return dispatch(schema.key, behaviorName);
}

// ────────────────────────────────────────────────────────────────────
// Renderer dispatcher
// ────────────────────────────────────────────────────────────────────
//
// CellFormatters live in their own registry (extend.ts `renderers`)
// separate from SchemaBehaviors — they predate the behaviors slot
// and have the same `(value, opts, ctx, parents) → RenderNode`
// shape used by the original render contract. The dispatcher pattern
// is identical to `dispatch()` above: walk the inheritance chain
// leaf → root, pick the most-specific definition, inject a parents
// proxy of all strictly older ancestors that also defined a renderer.

/**
 * Returns the CellFormatter for a schema's renderer on the given
 * runtime target (`"dom"` for browser, `"svg"` for V8/export). Walks
 * the inheritance chain leaf → root, picks the most-specific
 * registered renderer for that target, injects a `parents` proxy
 * of all strictly older ancestors that ALSO registered a renderer
 * on the same target.
 *
 * Returns `undefined` when no schema in the chain registered one —
 * caller falls back to its legacy per-type cell path.
 */
export function dispatchRenderer(
  schemaKey: string,
  target: RenderTarget = "dom",
): ((value: unknown, options: ColumnSpec["options"], ctx: RenderContext) => RenderNode) | undefined {
  const schema = getSchema(schemaKey);
  if (!schema) return undefined;
  const chain = resolveSchema(schema);

  let leafIdx = -1;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (getRenderer(chain[i].key, target) != null) {
      leafIdx = i;
      break;
    }
  }
  if (leafIdx === -1) return undefined;

  // Returns a 3-arg (value, options, ctx) callable. The 4-arg
  // `CellFormatter` shape lives inside `raw`; we wrap with the
  // ancestor's own `parents` to expose the no-parents-arg surface.
  type BoundRenderer = ParentRenderers[string];
  const buildAt = (idx: number): BoundRenderer => {
    const raw = getRenderer(chain[idx].key, target);
    if (!raw) {
      throw new Error(
        `dispatchRenderer: chain[${idx}] (${chain[idx].key}) lost its renderer between lookup and build`,
      );
    }
    const parents: ParentRenderers = {};
    for (let i = 0; i < idx; i++) {
      if (getRenderer(chain[i].key, target) != null) {
        parents[chain[i].key] = buildAt(i);
      }
    }
    return (value, options, ctx) => raw(value, options, ctx, parents);
  };

  return buildAt(leafIdx);
}

/**
 * High-level entry point: resolve a column's renderer, call it,
 * and apply theme finalization (`applyTheme`) so tagged nodes get
 * their NodeRules overlays / wrap / hidden / transforms.
 *
 * Returns `null` when no schema in the column's chain registered a
 * renderer — caller (TabvizPlot / svg-generator) should fall back
 * to its legacy cell path. As schemas get migrated in Phase 7e,
 * this null return becomes rarer until the legacy paths can be
 * deleted entirely.
 */
export function renderCell(
  col: ColumnSpec,
  value: unknown,
  ctx: RenderContext,
  nodeRules?: NodeRules,
  target: RenderTarget = "dom",
): RenderNode | null {
  const schema = findSchemaForColumn(col);
  if (!schema) return null;
  const fn = dispatchRenderer(schema.key, target);
  if (!fn) return null;
  const tree = fn(value, col.options, ctx);
  // Always run applyTheme so DEFAULT_NODE_RULES (interval-range, etc.)
  // apply even when the active theme doesn't set its own rules. Pass
  // `nodeRules` so theme overrides merge on top.
  return applyTheme(tree, nodeRules);
}

// ────────────────────────────────────────────────────────────────────
// Text extraction
// ────────────────────────────────────────────────────────────────────
//
// SVG-export and width-measurement paths want the plain-text value of
// a cell, not a RenderNode tree. `extractText(node)` walks the tree
// and concatenates every `RenderText.value` it finds, in
// document-order. Groups stitch children together; other node kinds
// (svg, image, spacer, component) contribute nothing.
//
// Use case: svg-generator.ts's `getCellValue` historically had a
// switch over `col.type` that returned the formatted string per
// type. That switch duplicates the schema's renderer dispatch.
// Replace it with: dispatchRenderer for the svg target → extract
// text. The single-text-node trees that `text` / `numeric` / `events`
// / `pvalue` schemas produce flatten back to the same strings the
// legacy switch returned; multi-fragment trees (interval) get
// concatenated naturally ("0.85" + " " + "(0.72, 0.99)").

export function extractText(node: RenderNode | null): string {
  if (!node) return "";
  switch (node.kind) {
    case "text":      return node.value;
    case "group":     return node.children.map(extractText).join("");
    case "spacer":    return "";
    case "svg":       return "";
    case "image":     return node.alt ?? "";
    case "component": return "";
  }
}

/**
 * Convenience: dispatch a column's renderer (svg target by default)
 * and extract the plain text. Returns `null` if no schema renderer
 * is registered — callers fall back to their legacy formatter.
 */
export function getCellText(
  col: ColumnSpec,
  value: unknown,
  ctx: RenderContext,
  target: RenderTarget = "svg",
): string | null {
  const schema = findSchemaForColumn(col);
  if (!schema) return null;
  const fn = dispatchRenderer(schema.key, target);
  if (!fn) return null;
  return extractText(fn(value, col.options, ctx));
}
