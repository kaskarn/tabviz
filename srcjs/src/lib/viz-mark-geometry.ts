/**
 * Shared viz-column (viz_bar / viz_boxplot / viz_violin) geometry — pure math
 * used by BOTH the DOM (`components/viz/*`) and the SVG export
 * (`svg-generator.ts`), so the bar/box layout can't drift. Part of the D37 fork
 * unification (step 5); see docs/dev/d37-forest-mark-unification.md. V8-safe.
 *
 * This module owns the per-ROW LAYOUT arithmetic (band heights, the inter-bar
 * gap). The per-ELEMENT emission (the actual <rect>/<line> markup vs Svelte
 * elements) stays in each renderer — only the numbers are shared.
 */
import { VIZ } from "./rendering-constants";

/** Gap (px) between stacked viz bands when a row carries multiple effects.
 *  Shared by viz_bar / viz_boxplot / viz_violin. */
const VIZ_BAND_GAP_PX = 2;

/** Per-effect floor heights — a band never collapses below these. */
export const VIZ_BAND_MIN = { bar: 4, boxplot: 8, violin: 10 } as const;

export interface VizBand {
  /** Full band height the effects share (`rowHeight × heightRatio`). */
  totalHeight: number;
  /** Per-effect height after splitting the band, floored at `minBandHeight`. */
  bandHeight: number;
  /** Gap between stacked effects (0 for a single effect). */
  gap: number;
}

/**
 * The viz band-split layout, identical across viz_bar / viz_boxplot / viz_violin
 * (only the height ratio + per-effect floor differ). All six call sites
 * (3 types × DOM/export) computed this inline; now one source, one magic gap.
 */
export function vizBand(
  rowHeight: number,
  heightRatio: number,
  numEffects: number,
  minBandHeight: number,
): VizBand {
  const totalHeight = rowHeight * heightRatio;
  const gap = numEffects > 1 ? VIZ_BAND_GAP_PX : 0;
  const bandHeight = Math.max(minBandHeight, (totalHeight - gap * (numEffects - 1)) / numEffects);
  return { totalHeight, bandHeight, gap };
}

export interface VizBarLayout {
  totalBarHeight: number;
  barHeight: number;
  barGap: number;
}

/** viz_bar band layout (BAR_HEIGHT_RATIO, 4px floor) — a named wrapper over
 *  {@link vizBand} keeping the bar callers' field names. */
export function vizBarLayout(rowHeight: number, numEffects: number): VizBarLayout {
  const { totalHeight, bandHeight, gap } = vizBand(rowHeight, VIZ.BAR_HEIGHT_RATIO, numEffects, VIZ_BAND_MIN.bar);
  return { totalBarHeight: totalHeight, barHeight: bandHeight, barGap: gap };
}
