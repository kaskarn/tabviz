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

/** Inter-bar gap (px) when a viz_bar row stacks multiple effects. */
const VIZ_BAR_GAP_PX = 2;

export interface VizBarLayout {
  /** Full band height the bars share (`rowHeight × BAR_HEIGHT_RATIO`). */
  totalBarHeight: number;
  /** Per-bar height after splitting the band across effects (floored at 4px). */
  barHeight: number;
  /** Gap between stacked bars (0 for a single effect). */
  barGap: number;
}

/**
 * Per-row bar layout. Both renderers computed this identically inline
 * (incl. the magic `2`px gap and the `Math.max(4, …)` floor).
 */
export function vizBarLayout(rowHeight: number, numEffects: number): VizBarLayout {
  const totalBarHeight = rowHeight * VIZ.BAR_HEIGHT_RATIO;
  const barGap = numEffects > 1 ? VIZ_BAR_GAP_PX : 0;
  const barHeight = Math.max(4, (totalBarHeight - barGap * (numEffects - 1)) / numEffects);
  return { totalBarHeight, barHeight, barGap };
}
