// Glyph derivation for schemas. The editor uses these helpers to
// surface visual cues (column-type badge, slot-type indicator) without
// each call site re-deriving the mapping.
//
// Two derivations:
//
// 1. `schemaGlyph(schema)` — returns the schema's declared glyph, or
//    walks the inheritance chain to find one. Lets concrete schemas
//    inherit glyphs from abstract parents if they don't declare their
//    own (rare, but a useful fallback).
//
// 2. `slotGlyphFor(accepts)` — picks the most-specific FieldCategory
//    glyph from a slot's `accepts: FieldCategory[]`. Used to render
//    the slot's data-type expectation next to the field picker.

import type { FieldCategory } from "../types";
import type { GlyphToken } from "../lib/ui-glyphs";
import type { ColumnSchema, SchemaRegistry } from "./types";

/**
 * Map each FieldCategory to its glyph token. Categories share a glyph
 * with their type-cousin where it makes sense — `numeric` and `integer`
 * use distinct glyphs because the integer indicator (`#̄`) is visually
 * disambiguated from generic numeric (`#`).
 */
const FIELD_CATEGORY_GLYPH: Record<FieldCategory, GlyphToken | undefined> = {
  numeric:         "field.numeric",
  integer:         "field.integer",
  string:          "field.string",
  logical:         "field.logical",
  date:            "field.date",
  "array-numeric": "field.array",
  other:           undefined,
};

/**
 * Resolve a column schema's glyph, walking the inheritance chain if
 * the schema doesn't declare one of its own. Returns undefined only if
 * no schema in the chain has a glyph.
 */
export function schemaGlyph(
  schema: ColumnSchema,
  registry: SchemaRegistry,
): GlyphToken | undefined {
  if (schema.glyph) return schema.glyph;
  const parents = schema.inherits
    ? Array.isArray(schema.inherits) ? schema.inherits : [schema.inherits]
    : [];
  for (const p of parents) {
    const parent = registry[p];
    if (!parent) continue;
    const g = schemaGlyph(parent, registry);
    if (g) return g;
  }
  return undefined;
}

/**
 * Pick a glyph that represents what a slot accepts. When a slot
 * accepts multiple categories, the first category with a glyph wins
 * (schemas declare accept lists in priority order). Returns undefined
 * if no accepted category has a glyph (e.g. `other`-only slots).
 */
export function slotGlyphFor(accepts: FieldCategory[]): GlyphToken | undefined {
  for (const cat of accepts) {
    const g = FIELD_CATEGORY_GLYPH[cat];
    if (g) return g;
  }
  return undefined;
}

export { FIELD_CATEGORY_GLYPH };
