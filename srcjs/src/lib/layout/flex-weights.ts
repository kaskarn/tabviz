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
import type { ColumnWidthSpec } from "./flex-distribute";

/** Default flex weight for column types whose schema doesn't declare one. */
export const DEFAULT_FLEX_WEIGHT = 1;

/** A column's flex weight: an explicit numeric `flex` overrides the schema's
 *  per-type default. (Boolean `flex` governs only aspect participation — see
 *  `columnFlexesForAspect` — not the weight.) Clamped to ≥ 0. */
export function flexWeightForColumn(col: ColumnSpec): number {
  if (typeof col.flex === "number") return Math.max(0, col.flex);
  return findSchemaForColumn(col)?.flexWeight ?? DEFAULT_FLEX_WEIGHT;
}

/** Whether a column absorbs aspect-reshape width: explicit `flex: true`, or a
 *  positive numeric weight. (`false`, `0`, and unset all → no.) Centralizes the
 *  aspect-ladder predicate so both backends agree. */
export function columnFlexesForAspect(col: ColumnSpec): boolean {
  if (typeof col.flex === "number") return col.flex > 0;
  return col.flex === true;
}

/** Designed natural width (px) for a plot column with no content width, or null. */
export function vizNaturalWidthForColumn(col: ColumnSpec): number | null {
  return findSchemaForColumn(col)?.naturalWidthPx ?? null;
}

/**
 * Build a {@link ColumnWidthSpec} for the flex engine from a column + the
 * CONTEXT-sourced inputs. SINGLE source for the spec SHAPE and the natural
 * resolution ORDER (explicit → measured → schema viz natural → caller fallback),
 * shared by the three parity-critical `resolveFlexWidths` call sites — the DOM
 * (layout-zoom) and the export (svg-generator main + aspect). They differ only
 * in HOW they source `explicit`/`measured`/`fallback`/`cap` (live store vs wire,
 * container target vs grow-to-natural) — that stays per-caller — so this locks
 * the shared structure against drift without conflating the legitimately
 * different contexts. (D32: there was never a second flex *implementation* — one
 * engine, three callers; this removes the only real duplication.)
 */
export function toColumnWidthSpec(
  col: ColumnSpec,
  opts: { explicit: number | null; measured: number | undefined; fallback: number; cap?: number },
): ColumnWidthSpec {
  return {
    id: col.id,
    naturalWidth: opts.explicit ?? opts.measured ?? vizNaturalWidthForColumn(col) ?? opts.fallback,
    flexWeight: flexWeightForColumn(col),
    explicitWidth: opts.explicit,
    minWidth: opts.measured ?? undefined,
    cap: opts.cap,
  };
}
