// Flex-weight policy (Tier 1) + the column→width resolver.
//
// The distribution ENGINE (flex-distribute.ts) is policy-free. This module holds
// the POLICY: the type→weight table, the designed natural widths for plot
// columns, and `resolveFlexWidths()` which maps columns to FlexItems with the
// "B" effective weight (`typeFlex × natural`) and calls the engine. See
// docs/dev/multi-flex-columns.md.
//
// Values here are STARTERS to tune from usage, not pre-baked truth
// (see [[feedback_dont_pre_bake_defaults]]). Centralized so the whole policy
// lives in one discoverable place.

import { distributeFlexWidths, type FlexDistribution } from "./flex-distribute";

/** Base flex weight by column type. Higher = absorbs more width. Unlisted → 1. */
export const FLEX_WEIGHTS: Record<string, number> = {
  // Plots want width the most.
  forest: 8,
  viz_bar: 6,
  viz_boxplot: 6,
  viz_violin: 6,
  // Compact viz still benefit from width, less so.
  sparkline: 3,
  bar: 3,
  progress: 3,
  heatmap: 3,
  // Fixed-ish glyph/badge content barely benefits — penalized.
  pvalue: 0.3,
  ring: 0.3,
  stars: 0.3,
  icon: 0.3,
  badge: 0.3,
  // (text / label / numeric / interval / range / date / n / currency / percent
  //  / pictogram → DEFAULT_FLEX_WEIGHT)
};

export const DEFAULT_FLEX_WEIGHT = 1;

/**
 * Designed natural widths (px) for plot columns that have NO content-natural
 * width (forest/viz fill whatever space they're given). The proportional base
 * rule needs a meaningful natural for these. Tunable; a starting baseline.
 *
 * ⚠️ As viz layouts grow intrinsic text (value labels beside bars, in-plot
 * annotations), these must fold that content in — viz-layout-specific. Keep the
 * caller's natural-width source pluggable (see docs/dev/multi-flex-columns.md).
 */
export const VIZ_NATURAL_WIDTH: Record<string, number> = {
  forest: 240,
  viz_bar: 200,
  viz_boxplot: 200,
  viz_violin: 200,
  sparkline: 80,
};

export function flexWeightForType(type: string): number {
  return FLEX_WEIGHTS[type] ?? DEFAULT_FLEX_WEIGHT;
}

/** Designed plot-column natural width, or null for content-measured columns. */
export function vizNaturalWidth(type: string): number | null {
  return VIZ_NATURAL_WIDTH[type] ?? null;
}

export interface ColumnWidthSpec {
  id: string;
  type: string;
  /** Content-natural (measured) width, or the designed viz natural for plots. */
  naturalWidth: number;
  /** Explicit numeric width pins the column (immovable, weight 0). */
  explicitWidth?: number | null;
  /** Content floor below which the column can't shrink. Default 0. */
  minWidth?: number;
  /** Aspect flex cap: bounds the column to [natural/cap, natural×cap]. Default none. */
  cap?: number;
}

/**
 * Resolve per-column widths by distributing `targetTotal` with the proportional
 * base rule (effective weight = `typeFlex × natural`; pinned columns immovable;
 * shrink floored at content min; optional aspect cap as bounds).
 */
export function resolveFlexWidths(
  columns: ColumnWidthSpec[],
  targetTotal: number,
): FlexDistribution {
  const items = columns.map((c) => {
    const pinned = typeof c.explicitWidth === "number";
    const natural = pinned ? (c.explicitWidth as number) : c.naturalWidth;
    const weight = pinned ? 0 : flexWeightForType(c.type) * natural;
    const min = pinned ? natural : c.minWidth ?? 0;
    let max = pinned ? natural : Number.POSITIVE_INFINITY;
    if (!pinned && typeof c.cap === "number" && c.cap > 1) {
      // Aspect cap → symmetric bounds around natural.
      max = natural * c.cap;
      const capMin = natural / c.cap;
      // content floor still wins if larger.
      return { id: c.id, natural, weight, min: Math.max(min, capMin), max };
    }
    return { id: c.id, natural, weight, min, max };
  });
  return distributeFlexWidths(items, targetTotal);
}
