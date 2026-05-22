/**
 * Shared-product computation for `split_by` widgets.
 *
 * When a SplitForest is rendered in "shared axis" or "shared column widths"
 * mode, every subset uses the same axis range / column widths so the
 * subsets line up visually when stacked or compared side by side. Computing
 * these shared products requires looking at the *union* of subset data —
 * something a single subset can't see on its own.
 *
 * Until now this lived in R (`R/split_table.R:145-339`). Per the TS-first
 * vision (CLAUDE.md), R should produce the same wire shape a JS author
 * would. JS authors had no equivalent path. This module is that path.
 *
 * The R wrapper now delegates here via `ts_call` (see `R/v8-bridge.R`); the
 * functions are also exposed from `srcjs/src/authoring/` so JS authors can
 * pre-compute and stamp values into SplitForest payloads directly.
 *
 * Both functions are *pure* — no DOM, no Canvas, no globals — so they work
 * uniformly under V8 (R-side SVG export), in the browser, and in tests.
 */

import { niceDomain } from "./scale-utils";
import { rankTopK, measureExact, DEFAULT_TOP_K, type FontKey } from "./width-measure";
import { estimateTextWidth } from "./width-utils";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/**
 * Minimum spec shape the shared-product computers consume from each subset.
 * Intentionally narrow: anything richer (full WebSpec) is accepted via
 * structural compatibility, but only these fields are read.
 */
export interface SubsetSpec {
  data: {
    rows: Array<{
      metadata: Record<string, unknown>;
      style?: { type?: string } | null;
    }>;
  };
  columns: Array<{
    id: string;
    type: string;
    field?: string | null;
    header?: string | null;
    width?: number | "auto" | null;
    options?: Record<string, unknown>;
  }>;
  theme?: {
    axis?: {
      ciClipFactor?: number | null;
      rangeMin?: number | null;
      rangeMax?: number | null;
      tickValues?: number[] | null;
    } | null;
    text?: {
      body?: { family?: string; size?: string };
    } | null;
  };
}

export interface SharedAxisArgs {
  subsets: SubsetSpec[];
}

export interface SharedAxisResult {
  rangeMin: number;
  rangeMax: number;
}

export interface SharedWidthsArgs {
  subsets: SubsetSpec[];
  /** Font family for measurement. Defaults to a generic system stack. */
  fontFamily?: string;
  /** Font size in px. Defaults to 14. */
  fontSizePx?: number;
}

export interface SharedWidthsResult {
  /** Column id → pixel width. Only columns whose `width` was "auto" or unset
   *  are included; explicit-width columns are skipped. */
  widths: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────
// Shared axis
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute a single axis range that fits every subset's effect data.
 *
 * Ports the R-side logic in `R/split_table.R:145-306`:
 *   1. Collect effect values (point / lower / upper) from each subset's
 *      forest column — both inline single-effect mode and multi-effect mode.
 *   2. Snap the point-estimate range to nice numbers via `niceDomain`.
 *   3. Compute clip boundaries from the CI clip factor.
 *   4. Include CI bounds that fit within the clip; extend to the clip
 *      boundary when CIs are clipped (so arrowheads remain visible).
 *   5. Snap the final range to nice numbers.
 *
 * Returns the {rangeMin, rangeMax} pair the caller should stamp into each
 * subset's theme.axis. If explicit min/max already live on the first
 * subset's axis config, they win (this function never overrides explicit
 * values — the caller is responsible for respecting them, but the inputs
 * here represent the data-driven path).
 */
export function computeSharedAxis(args: SharedAxisArgs): SharedAxisResult {
  const { subsets } = args;
  if (subsets.length === 0) return { rangeMin: 0, rangeMax: 1 };

  // Identify the forest column on the first subset (the others should
  // share the same column structure).
  const forestCol = subsets[0].columns.find((c) => c.type === "forest");
  const forestOpts = (forestCol?.options?.forest ?? {}) as {
    point?: string;
    lower?: string;
    upper?: string;
    effects?: Array<{ pointCol?: string; lowerCol?: string; upperCol?: string }>;
    scale?: string;
    nullValue?: number;
  };

  const isLog = forestOpts.scale === "log";
  const nullValue = forestOpts.nullValue ?? (isLog ? 1 : 0);
  const ciClipFactor = subsets[0].theme?.axis?.ciClipFactor ?? 3.0;

  // Collect effect values across all subsets.
  const allPoint: number[] = [];
  const allLower: number[] = [];
  const allUpper: number[] = [];

  const collectFrom = (
    fieldP?: string,
    fieldL?: string,
    fieldU?: string,
  ): void => {
    for (const s of subsets) {
      for (const row of s.data.rows) {
        const md = row.metadata;
        if (fieldP && md[fieldP] != null) {
          const v = Number(md[fieldP]);
          if (Number.isFinite(v)) allPoint.push(v);
        }
        if (fieldL && md[fieldL] != null) {
          const v = Number(md[fieldL]);
          if (Number.isFinite(v)) allLower.push(v);
        }
        if (fieldU && md[fieldU] != null) {
          const v = Number(md[fieldU]);
          if (Number.isFinite(v)) allUpper.push(v);
        }
      }
    }
  };

  // Single-effect mode (forest.point / .lower / .upper).
  collectFrom(forestOpts.point, forestOpts.lower, forestOpts.upper);
  // Multi-effect mode (forest.effects[].pointCol / .lowerCol / .upperCol).
  if (Array.isArray(forestOpts.effects)) {
    for (const eff of forestOpts.effects) {
      collectFrom(eff?.pointCol, eff?.lowerCol, eff?.upperCol);
    }
  }

  // Log-scale: positive values only.
  let pts = isLog ? allPoint.filter((v) => v > 0) : allPoint;
  let los = isLog ? allLower.filter((v) => v > 0) : allLower;
  let his = isLog ? allUpper.filter((v) => v > 0) : allUpper;

  // Degenerate case: no data at all. Synthesize a ±1 / ÷2×2 span around
  // null_value so niceDomain doesn't choke.
  if (pts.length === 0 && los.length === 0 && his.length === 0) {
    pts = isLog ? [nullValue / 2, nullValue * 2] : [nullValue - 1, nullValue + 1];
  }

  // Estimate range from point + null_value.
  let rawMinEst = Math.min(...pts, nullValue);
  let rawMaxEst = Math.max(...pts, nullValue);

  // Zero-span case: spread it out so niceDomain has something to work with.
  if (rawMaxEst - rawMinEst === 0) {
    if (isLog) {
      rawMinEst = rawMinEst / 2;
      rawMaxEst = rawMaxEst * 2;
    } else {
      const spread = Math.max(1, Math.abs(rawMinEst) * 0.1);
      rawMinEst -= spread;
      rawMaxEst += spread;
    }
  }

  // First snap.
  const [minEst, maxEst] = niceDomain([rawMinEst, rawMaxEst], isLog);

  // Clip boundaries.
  let lowerClip: number;
  let upperClip: number;
  if (isLog) {
    lowerClip = minEst / ciClipFactor;
    upperClip = maxEst * ciClipFactor;
  } else {
    const span = maxEst - minEst;
    lowerClip = minEst - span * ciClipFactor;
    upperClip = maxEst + span * ciClipFactor;
  }

  const hasClippedLower = los.some((v) => v < lowerClip);
  const hasClippedUpper = his.some((v) => v > upperClip);

  const validLower = los.filter((v) => v >= lowerClip);
  const validUpper = his.filter((v) => v <= upperClip);

  const dataMin = Math.min(
    ...validLower,
    minEst,
    ...(hasClippedLower ? [lowerClip] : []),
  );
  const dataMax = Math.max(
    ...validUpper,
    maxEst,
    ...(hasClippedUpper ? [upperClip] : []),
  );

  // Final snap.
  const [rangeMin, rangeMax] = niceDomain([dataMin, dataMax], isLog);
  return { rangeMin, rangeMax };
}

// ─────────────────────────────────────────────────────────────────────────
// Shared column widths
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute a shared width per "auto"-width column across every subset's data.
 *
 * Uses the rank+top-K strategy (see `width-measure.ts`): score every cell
 * across the union with `estimateTextWidth`, exact-measure the K winners
 * (Canvas in browser, estimator fallback in V8), take the max. The output
 * is a `{columnId: px}` map the caller stamps into each subset's column
 * config so the widget's per-subset `measureAutoColumns` short-circuits
 * (numeric width is a hard pin).
 *
 * Skips columns with an explicit numeric width (already pinned) and the
 * viz/forest types (auto-sized from the plot, not text content).
 */
export function computeSharedWidths(args: SharedWidthsArgs): SharedWidthsResult {
  const { subsets } = args;
  if (subsets.length === 0) return { widths: {} };

  const fontFamily =
    args.fontFamily
    ?? subsets[0].theme?.text?.body?.family
    ?? "Inter, system-ui, sans-serif";
  const fontSizePx = args.fontSizePx ?? 14;
  // Both header and body share the same family; only the weight differs.
  const dataFont: FontKey = { family: fontFamily, weight: 400 };
  const headerFont: FontKey = { family: fontFamily, weight: 600 };

  // Skip these column types — they auto-size from plot geometry, not text.
  const SKIP_TYPES = new Set(["viz_bar", "viz_boxplot", "viz_violin", "forest"]);

  // ~8px per-character + 24px padding budget. Matches the R baseline so the
  // floor here is no looser than the previous behavior; the actual width
  // comes from rank+top-K exact measurement and will typically be tighter.
  const CHAR_FLOOR = 40;
  const HARD_CEIL = 480;

  const result: Record<string, number> = {};
  const baseColumns = subsets[0].columns;

  for (const col of baseColumns) {
    // Skip explicit numeric width (hard pin).
    if (typeof col.width === "number" && Number.isFinite(col.width)) continue;
    if (SKIP_TYPES.has(col.type)) continue;
    if (!col.field) continue;

    // Pool: every cell's stringified value for this column across all subsets,
    // plus the header.
    const candidates: string[] = [];
    if (col.header) candidates.push(col.header);
    for (const s of subsets) {
      const sameCol = s.columns.find((c) => c.id === col.id);
      if (!sameCol || !sameCol.field) continue;
      for (const row of s.data.rows) {
        if (row.style?.type === "header" || row.style?.type === "spacer") continue;
        const v = row.metadata[sameCol.field];
        if (v == null) continue;
        candidates.push(String(v));
      }
    }
    if (candidates.length === 0) continue;

    // Rank by estimator, exact-measure top-K with header font (bolder; an
    // upper bound on either weight at this size).
    const winners = rankTopK(candidates, fontSizePx, headerFont.weight, DEFAULT_TOP_K);
    let maxPx = 0;
    for (const text of winners) {
      const exact = measureExact(text, headerFont, fontSizePx);
      const w = exact ?? estimateTextWidth(text, fontSizePx, headerFont.weight);
      if (w > maxPx) maxPx = w;
    }
    // Also exact-measure the same winners under data font, take the larger
    // — covers headers that render bold but data values that render at
    // weight 400 (the inverse case is much rarer).
    for (const text of winners) {
      const exact = measureExact(text, dataFont, fontSizePx);
      const w = exact ?? estimateTextWidth(text, fontSizePx, dataFont.weight);
      if (w > maxPx) maxPx = w;
    }

    // Add cell-padding buffer + rendering safety margin (24px matches the R
    // shared-widths baseline; live measureAutoColumns uses a similar
    // padding sum, so subset widths line up under either measurement path).
    const computed = Math.ceil(maxPx + 24);
    result[col.id] = Math.max(CHAR_FLOOR, Math.min(HARD_CEIL, computed));
  }

  return { widths: result };
}
