// Variant compile pass — schema-sprint Phase 3.
//
// Variants are an editor surface, not a runtime channel. The wire
// carries `column.options.<bucket>.variant` as the author's choice
// (preserved for round-trip and editor segmented-control state). At
// spec ingest this pass walks every column, resolves the matching
// `VariantSpec.resolved` block from the schema, and writes the
// primitive options onto `column.options.<bucket>.__resolved`.
//
// Renderers read only from `__resolved` (with a runtime fallback that
// re-derives from the variant id if the compile pass was skipped —
// e.g. test fixtures, direct render). They never branch on `variant`
// directly. This resolves the long-standing tension between variants
// (per-column author choice, segmented control) and tag+nodeRule
// (theme-wide, declarative) — both can target the same structural
// roles without competing.
//
// Properties:
//
// - Pure: returns a new WebSpec with new column/option object
//   references; never mutates inputs. Columns without a registered
//   variant (no `options.<bucket>.variant` key, or schema declares no
//   variants[]) pass through with identity-stable object refs.
// - Idempotent: re-running on an already-compiled spec yields an
//   equivalent spec (the `__resolved` block is the same recipe).
// - Recursive: walks ColumnGroup descendants.

import type { WebSpec, ColumnSpec, ColumnGroup, ColumnDef } from "../types";
import type { ColumnSchema } from "./types";
import { findSchemaForColumn } from "./dispatch";

/**
 * Resolve the variant id active on a column to its `resolved` recipe
 * from the schema's `variants[]`. Returns `null` when the schema
 * declares no variants, or when neither the active variant id nor the
 * first declared variant carries a `resolved` block.
 *
 * Variant fallback order:
 *   1. The id active in `options.<bucket>.variant`
 *   2. The first variant declared on the schema (the convention default)
 *   3. `null` (renderer falls back to its own hardcoded defaults)
 */
export function resolveVariant(
  schema: ColumnSchema,
  variantId: string | undefined,
): Record<string, unknown> | null {
  const variants = schema.variants;
  if (!variants || variants.length === 0) return null;
  if (variantId) {
    const hit = variants.find((v) => v.id === variantId);
    if (hit?.resolved) return hit.resolved;
  }
  // Fall back to the first declared variant.
  return variants[0]?.resolved ?? null;
}

function compileColumn(col: ColumnSpec): ColumnSpec {
  const schema = findSchemaForColumn(col);
  if (!schema) return col;
  if (!schema.variants || schema.variants.length === 0) return col;
  const bucket = schema.bucket;
  if (!bucket) return col;

  const opts = (col.options ?? {}) as Record<string, unknown>;
  const bucketOpts = (opts[bucket] ?? {}) as Record<string, unknown>;
  const variantId = bucketOpts.variant as string | undefined;
  const resolved = resolveVariant(schema, variantId);
  if (!resolved) return col;

  // Idempotency: if `__resolved` already matches the recipe (shallow
  // equality), reuse the existing object refs. This keeps spec
  // round-trips identity-stable and avoids needless re-derivation.
  const existing = bucketOpts.__resolved as Record<string, unknown> | undefined;
  if (existing && shallowEqual(existing, resolved)) return col;

  return {
    ...col,
    options: {
      ...opts,
      [bucket]: { ...bucketOpts, __resolved: resolved },
    } as ColumnSpec["options"],
  };
}

function walkDefs(defs: ColumnDef[]): ColumnDef[] {
  let mutated = false;
  const out: ColumnDef[] = defs.map((d) => {
    if ((d as ColumnGroup).isGroup) {
      const grp = d as ColumnGroup;
      const nextChildren = walkDefs(grp.columns);
      if (nextChildren === grp.columns) return d;
      mutated = true;
      return { ...grp, columns: nextChildren };
    }
    const nextCol = compileColumn(d as ColumnSpec);
    if (nextCol !== d) mutated = true;
    return nextCol;
  });
  return mutated ? out : defs;
}

/**
 * Walk every column in `spec.columns`, compile its variant to primitive
 * options under `__resolved`. Returns a new WebSpec when anything was
 * touched; otherwise returns the input spec by reference (identity
 * stable). Group descendants recurse.
 */
export function compileVariants(spec: WebSpec): WebSpec {
  const cols = spec.columns;
  if (!cols || cols.length === 0) return spec;
  const next = walkDefs(cols as ColumnDef[]);
  if (next === cols) return spec;
  return { ...spec, columns: next as WebSpec["columns"] };
}

function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}
