// Flex-weight policy accessors.
//
// The flex weights + designed plot naturals live ON the column schema
// (`ColumnSchema.flexWeight` / `.naturalWidthPx`) — the single per-type source of
// truth — read here via `findSchemaForColumn` (the same pattern lib/width-utils
// uses for schema-driven measurement). The pure resolver + engine live in
// flex-distribute.ts (schema-free, bun-testable); this thin module is the bridge
// that reads the policy off the schema. See docs/dev/multi-flex-columns.md.

import { findSchemaForColumn } from "../../schema/dispatch";
import type { ColumnSpec } from "../../types";

/** Default flex weight for column types whose schema doesn't declare one. */
export const DEFAULT_FLEX_WEIGHT = 1;

/** A column's flex weight, read from its schema (default 1). */
export function flexWeightForColumn(col: ColumnSpec): number {
  return findSchemaForColumn(col)?.flexWeight ?? DEFAULT_FLEX_WEIGHT;
}

/** Designed natural width (px) for a plot column with no content width, or null. */
export function vizNaturalWidthForColumn(col: ColumnSpec): number | null {
  return findSchemaForColumn(col)?.naturalWidthPx ?? null;
}
