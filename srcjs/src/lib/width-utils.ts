/**
 * Width calculation utilities for column auto-sizing.
 *
 * This module provides shared utilities for calculating column widths in forest plots.
 * It is used by both the web view (tabvizStore.svelte.ts) and SVG generator (svg-generator.ts)
 * to ensure visual consistency between renderers.
 *
 * === KEY FUNCTIONS ===
 *
 * - estimateTextWidth(): Character-class text width approximation (for SVG/non-browser)
 * - measureTextWidthCanvas(): Accurate canvas-based measurement (browser only)
 * - computeContentHeights(): Per-row intrinsic content height (estimator path)
 * - glyphNaturalWidth()/glyphNaturalHeight(): icon/pictogram natural sizing
 * - flattenColumns(): Utility to get leaf columns from nested groups
 *
 * === TEXT WIDTH ESTIMATION ===
 *
 * The estimateTextWidth() function uses character-class width multipliers:
 * - Very narrow: superscripts (×0.3)
 * - Narrow: i, l, 1, punctuation, space (×0.35)
 * - Math operators: ×, − (×0.5)
 * - Wide: m, w, M, W, @, % (×0.85)
 * - Digits: 0-9 (×0.6, tabular width)
 * - Normal: everything else (×0.55)
 *
 * === USAGE ===
 *
 * The tabvizStore uses canvas measurement when available (more accurate),
 * while the SVG generator uses estimateTextWidth() since it runs in a
 * DOM-free environment (R's V8 engine).
 *
 * Phase 0c-C8 audit (2026-05): the dual path is genuinely necessary, not
 * overkill. The estimation fallback is exercised on every V8 export
 * (R's PDF/PNG render pipeline runs without a DOM), so it's a hot path,
 * not a degraded backup. Kept as-is with hybrid try-canvas-then-estimate
 * at the call sites in svg-generator.ts.
 *
 * See rendering-constants.ts for detailed documentation of the width
 * calculation algorithm and constants.
 */

import type { ColumnSpec, Row } from "../types";
import { dispatchForColumn } from "../schema/dispatch";

// ============================================================================
// Text Width Measurement
// ============================================================================

/**
 * Estimate text width using character-based approximation.
 * Used when canvas measurement is not available (e.g., SVG generation).
 *
 * The character-class constants are tuned for **regular weight (400)**
 * rendering. When `weight` is bolder, a multiplicative correction is
 * applied: `1 + max(0, (weight - 400) / 100) × 0.035`. The same correction
 * is used by `measureTextWidth()` so the canvas-vs-fallback paths agree.
 * Calibrated against canvas measurement for Inter/system-ui at weight 600
 * — the older 0.02 coefficient under-budgeted by ~3% and triggered
 * sporadic header ellipsis.
 *
 * Per-CSS-weight examples:
 *   400 → ×1.000, 500 → ×1.035, 600 → ×1.070, 700 → ×1.105, 800 → ×1.140.
 */
/** Monospace detection on a resolved font-family string. The estimator's
 *  character-class model is tuned for PROPORTIONAL faces; mono faces
 *  (terminal/synthwave themes) under-measured ~12% — enough to eat the
 *  first column's padding and render labels flush against the next
 *  column (maintainer catch, 2026-06-11). */
export function isMonospaceFamily(family: string | undefined | null): boolean {
  return !!family && /mono|courier|consolas|menlo/i.test(family);
}

/** Fixed advance for mono faces, as a fraction of fontSize. Space Mono /
 *  Courier-class faces sit at ~0.60em; 0.62 carries a small safety pad. */
const MONO_ADVANCE = 0.62;

export function estimateTextWidth(
  text: string,
  fontSize: number,
  weight: number = 400,
  family?: string,
): number {
  if (isMonospaceFamily(family)) {
    const weightMultiplier = 1 + Math.max(0, (weight - 400) / 100) * 0.035;
    return [...text].length * fontSize * MONO_ADVANCE * weightMultiplier;
  }
  // Character width categories (proportions of fontSize):
  // Very narrow: superscript/subscript characters (0.15) - rendered at ~50% size and narrower
  // Narrow: i, l, I, 1, punctuation, space (0.35)
  // Math operators: ×, − (0.4) - typically narrower than digits in sans-serif fonts
  // Normal lowercase: a-z except i,l,m,w (0.55)
  // Digits: 0-9 tabular (0.6)
  // Uppercase: A-Z except I,M,W (0.68) - capitals are wider than lowercase
  // Wide: m, w, M, W, @, % (0.85)
  const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻";
  const NARROW = "ilI1.,;:|!()[]{}' -";
  const WIDE = "mwMW@%";
  const UPPERCASE = "ABCDEFGHJKLNOPQRSTUVXYZ"; // excluding I, M, W (handled separately)

  let width = 0;
  for (const char of text) {
    if (SUPERSCRIPTS.includes(char)) {
      width += fontSize * 0.15;
    } else if (NARROW.includes(char)) {
      width += fontSize * 0.35;
    } else if ("×−".includes(char)) {
      width += fontSize * 0.4;
    } else if (WIDE.includes(char)) {
      width += fontSize * 0.85;
    } else if (char >= "0" && char <= "9") {
      width += fontSize * 0.6;
    } else if (UPPERCASE.includes(char)) {
      // Uppercase letters are wider than lowercase
      width += fontSize * 0.68;
    } else {
      // Lowercase and other characters
      width += fontSize * 0.55;
    }
  }
  // Weight correction. The base scan is tuned for regular (400); bolder
  // weights render slightly wider per glyph at the same fontSize.
  const weightMultiplier = 1 + Math.max(0, (weight - 400) / 100) * 0.035;
  return width * weightMultiplier;
}

/**
 * Measure text width using canvas when available (browser), falling
 * back to character-class estimation in V8/Node. Single entry point
 * for renderers that need a consistent measurement across runtime
 * targets.
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number = 400,
): number {
  const canvasWidth = measureTextWidthCanvas(text, `${fontSize}px`, fontFamily, fontWeight);
  if (canvasWidth !== null) return canvasWidth;
  return estimateTextWidth(text, fontSize, fontWeight, fontFamily);
}

/**
 * Measure text width using canvas (browser only).
 * Returns null if canvas is not available.
 */
export function measureTextWidthCanvas(
  text: string,
  fontSize: string,
  fontFamily: string,
  fontWeight: number = 400
): number | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Canvas font syntax: "[font-weight] [font-size] [font-family]"
  ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
  return ctx.measureText(text).width;
}

// ============================================================================
// Glyph-column natural width
// ============================================================================

/**
 * Compute the rendered-geometry width of a glyph-based column for a given
 * dataset. Glyph columns (`pictogram`, `icon`, `ring`, `stars`) render
 * fixed-pixel artwork that `getColumnDisplayText()` can't measure as text —
 * without this helper they fall back to header-only auto-width and end up
 * cramped or clipped.
 *
 * Returns 0 for non-glyph types so callers can `max()` it into their
 * existing measurement loop without a type check.
 *
 * Geometry mirrors the live cell components verbatim:
 *   - pictogram: `CellPictogram.svelte` (size-sm/base/lg → 10/14/20px,
 *     gap 1px, slots = stacked ? 1 : min(20, max(rowValue) | maxGlyphs)).
 *   - stars:     `svg-generator.ts:3181-3183` (12px star, 2px gap).
 *   - icon:      `CellIcon.svelte` (sm/base/lg/xl → 12/14/16/26px).
 *   - ring:      `CellRing.svelte` (sm/base/lg → 18/24/32px diameter,
 *                + 4px gap + label).
 */
export function glyphNaturalWidth(col: ColumnSpec, rows: Row[]): number {
  const fn = dispatchForColumn(col, "naturalWidth");
  if (!fn) return 0;
  return fn(col, rows);
}

/**
 * Compute the intrinsic rendered HEIGHT a single row needs for a column's
 * visual content — the vertical mirror of {@link glyphNaturalWidth}. Stacked
 * pictograms, tall icons (xl), rings, and explicit sparkline / img heights all
 * report here. Per-row (not whole-dataset) because height is row-local.
 *
 * Returns 0 for columns with no intrinsic tall content (text/numeric/badge/bar
 * are single-line), so callers `Math.max` it into the row-height budget without
 * a type check. Text wrapping is handled separately via wrapLineCounts.
 */
export function glyphNaturalHeight(
  col: ColumnSpec,
  row: Row,
  ctx: { rowHeight: number; lineHeight: number; fontSize: number },
): number {
  const fn = dispatchForColumn(col, "naturalHeight");
  if (!fn) return 0;
  return fn(col, row, ctx);
}

/**
 * Build the per-row content-height map consumed by `computeRowLayout`:
 * `rowId → max over columns of glyphNaturalHeight(col, row)`. The predicted
 * (estimator) content height shared by both backends — the browser may later
 * supersede individual entries with measured heights. Only rows whose tallest
 * content exceeds 0 are included (sparse map; absent → no extra height).
 *
 * Cheap: dispatch returns undefined for the common single-line columns, so the
 * inner loop is a no-op for plain tables.
 */
export function computeContentHeights(
  columns: readonly ColumnSpec[],
  rows: readonly Row[],
  ctx: { rowHeight: number; lineHeight: number; fontSize: number },
): Record<string, number> {
  const out: Record<string, number> = {};
  // Columns with no naturalHeight behavior never contribute — resolve the
  // dispatchable set once so per-row work skips the dead columns.
  const heightCols = columns.filter((c) => dispatchForColumn(c, "naturalHeight"));
  if (heightCols.length === 0) return out;
  for (const row of rows) {
    let h = 0;
    for (const col of heightCols) h = Math.max(h, glyphNaturalHeight(col, row, ctx));
    if (h > 0) out[row.id] = h;
  }
  return out;
}

/**
 * Flatten nested column groups to get leaf columns only.
 */
export function flattenColumns(
  columns: (ColumnSpec | { isGroup: true; columns: ColumnSpec[] })[],
  position?: "left" | "right"
): ColumnSpec[] {
  const result: ColumnSpec[] = [];

  for (const col of columns) {
    if ("isGroup" in col && col.isGroup) {
      result.push(...flattenColumns(col.columns, position));
    } else {
      const spec = col as ColumnSpec;
      if (!position || (spec as any).position === position) {
        result.push(spec);
      }
    }
  }

  return result;
}
