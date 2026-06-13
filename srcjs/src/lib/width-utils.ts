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
 * estimateTextWidth() sums REAL per-glyph advance widths from
 * `font-metrics.generated.ts` (measured offline from Georgia/Helvetica by
 * scripts/measure-font-metrics.mjs), choosing the serif/sans/mono table by
 * family and interpolating per glyph across the weight axis. This replaced
 * the former hand-tuned character-class multipliers — magic numbers that
 * accreted via local nudges with no ground truth and over-budgeted ~7%
 * (the WYSIWYG D8 gap). Regenerate the table when the measurement method
 * or the canonical faces change; never hand-edit the constants.
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
import {
  PROP_FONTS, MONO_ADVANCE_BY_FONT, FALLBACK, FONT_METRIC_WEIGHTS,
  type PropAdvances,
} from "./font-metrics.generated";

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

/** Extract the PRIMARY family name from a CSS font-family string —
 *  `"'Lora', Georgia, serif"` → `Lora`. The primary is what loads and
 *  renders when available (and what systemfonts measures R-side); we key
 *  the per-font metric tables on it. Exported so the roster-sync gate
 *  (`font-roster-sync.runes.ts`) keys preset fonts the SAME way the
 *  estimator does. */
export function primaryFamily(family: string | undefined | null): string {
  if (!family) return "";
  const first = family.split(",")[0]!.trim();
  return first.replace(/^["']|["']$/g, "");
}

/** Whether the family resolves to serif vs sans for the class fallback
 *  (used only when the primary font isn't in the measured roster).
 *  "sans-serif" contains "serif", so check sans first. */
function isSerifFamily(family: string | undefined | null): boolean {
  const f = (family ?? "").toLowerCase();
  if (f.includes("sans")) return false;
  return f.includes("serif") || /\b(georgia|times|garamond|cambria|spectral|lora|libre|book antiqua|palatino|cinzel|crimson)\b/.test(f);
}

/**
 * Estimate text width from REAL measured advance widths — no canvas
 * needed (the V8/export path). Replaces the former hand-tuned character-
 * class multipliers, the magic mono advance, and the magic weight
 * coefficient (the WYSIWYG D8 work, 2026-06-13). Advances are measured by
 * `scripts/measure-font-metrics.mjs` → `font-metrics.generated.ts` from
 * the actual webfonts every preset ships (at anchor weights 400/700),
 * plus Georgia/Helvetica/Courier offline fallbacks for unknown families.
 *
 * Resolution: primary family → its per-font table (interpolating per glyph
 * across the continuous weight axis) or fixed mono advance; unknown family
 * → the serif/sans/mono class fallback. Residual vs a real canvas is
 * kerning only (~1–2%, which a class model could never reach).
 */
export function estimateTextWidth(
  text: string,
  fontSize: number,
  weight: number = 400,
  family?: string,
): number {
  const name = primaryFamily(family);

  // Monospace: one fixed, weight-independent advance per face (true mono
  // bold has the same advance). Known face → measured; else class fallback.
  const monoAdv = MONO_ADVANCE_BY_FONT[name] ?? (isMonospaceFamily(family) ? FALLBACK.monoAdvance : null);
  if (monoAdv != null) {
    return [...text].length * fontSize * monoAdv;
  }

  // Proportional: per-font table if measured, else the serif/sans fallback.
  // The lowercase-mean default (for exotic glyphs absent from the table)
  // follows the face's class.
  const serif = isSerifFamily(family);
  const tbl: PropAdvances = PROP_FONTS[name] ?? PROP_FONTS[serif ? FALLBACK.serif : FALLBACK.sans];
  const def = serif ? FALLBACK.serifDefault : FALLBACK.sansDefault;

  // Per-glyph weight interpolation: t=0 at 400, 1 at 700; clamp the
  // extrapolation to weights ~100–1000 so an absurd value can't run away.
  const t = Math.max(-1, Math.min(2,
    (weight - FONT_METRIC_WEIGHTS.lo) / (FONT_METRIC_WEIGHTS.hi - FONT_METRIC_WEIGHTS.lo)));

  let width = 0;
  for (const char of text) {
    const a = tbl.w400[char] ?? def.w400;
    const b = tbl.w700[char] ?? def.w700;
    width += fontSize * (a + (b - a) * t);
  }
  return width;
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
      if (!position || (spec as { position?: string }).position === position) {
        result.push(spec);
      }
    }
  }

  return result;
}
