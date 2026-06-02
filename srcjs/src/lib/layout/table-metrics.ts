/**
 * table-metrics — shared, pure layout computation for the DOM and V8/SVG
 * backends.
 *
 * The two backends (`layout-zoom.svelte.ts` $derived block; `computeLayout` in
 * svg-generator.ts) historically hand-mirrored the same formulas — the exact
 * duplication the sizing harness was built to police. This module is the single
 * home for the runtime-agnostic parts: per-row heights / positions / marker
 * centers, the rowPaddedAfter flagging, and the header-height formula. Each
 * backend calls these, then layers on its runtime-specific pieces (canvas vs.
 * estimator column measurement, $derived reactivity, aspect ladder, chrome Y
 * offsets).
 *
 * Pure: no Svelte runes, no DOM, no module state. Safe in V8.
 *
 * See docs/dev/sizing-model.md §6b (verification harness gates this) and the
 * DOM/SVG divergence notes there.
 */

import { resolveRowKind } from "./row-kind";

/**
 * Minimal structural row shape for layout — a superset of `ClassifiableRow`
 * adding `depth` and the `row.id` the wrap-count map keys on. Compatible with
 * both `$types` `DisplayRow` and svg-generator's local DisplayRow (whose
 * group-header variant omits `group`), so one helper serves both backends.
 */
export type LayoutRow =
  | { type: "group_header"; depth?: number }
  | { type: "panel"; depth?: number; rowId: string; content?: string }
  | { type: "data"; depth?: number; row: { id: string; style?: { type?: string } | null } };

/** Content-height map key for a details panel (distinct from its owner row's id,
 *  which keys the data row). Shared by the layout pass + the DOM measure-commit. */
export function panelContentKey(rowId: string): string {
  return `panel:${rowId}`;
}

/** Inputs to the per-row vertical layout (heights / positions / markers). */
export interface RowLayoutInput {
  displayRows: readonly LayoutRow[];
  /** Per-row id → wrapped line count (>1 inflates the row). */
  wrapLineCounts: Record<string, number>;
  /** Base row height (post-aspect-ladder rowHeight, or the natural value). */
  rowHeight: number;
  /** Themed trailing pad on the last data row before a top-level group. */
  rowGroupPadding: number;
  /** Single wrapped-line height: `ceil(parseFontSize(body.size) * 1.5)`. */
  dataLineHeightPx: number;
  /** Optional per-row intrinsic content height (px) — the max over the row's
   *  columns of each cell's `naturalHeight` (stacked pictograms, tall icons,
   *  multi-effect forest, sparkline/img). Computed by the caller (it needs
   *  schema dispatch + theme); `Math.max`-ed in alongside wrap height so a row
   *  grows to fit its tallest content. Absent/0 → no effect. Browser may
   *  supply MEASURED heights here; V8/export supplies estimated ones. */
  contentHeights?: Record<string, number>;
}

export interface RowLayout {
  rowHeights: number[];
  rowPositions: number[];
  rowMarkerCenters: number[];
  /** Per-row: true if it's the last data row before a top-level group_header
   *  (its track is inflated by rowGroupPadding; marker excludes the pad). */
  rowPaddedAfter: boolean[];
  /** Sum of all row heights (the rows-area height, excl. overall summary). */
  rowsHeight: number;
}

/**
 * Flag each data row that directly precedes a top-level (`depth === 0`)
 * group_header — its track gets the trailing `rowGroupPadding`. Spacer rows
 * are skipped as the "previous data row". Mirrors the inline computation that
 * lived in both backends.
 */
export function computeRowPaddedAfter(
  displayRows: readonly LayoutRow[],
): boolean[] {
  const flags = new Array<boolean>(displayRows.length).fill(false);
  for (let i = 0; i < displayRows.length; i++) {
    const dr = displayRows[i];
    if (dr.type !== "group_header" || dr.depth !== 0) continue;
    for (let j = i - 1; j >= 0; j--) {
      const prev = displayRows[j];
      if (prev.type === "data" && resolveRowKind(prev) !== "spacer") {
        flags[j] = true;
        break;
      }
    }
  }
  return flags;
}

/**
 * Compute per-row heights, cumulative Y positions, and marker-center Ys.
 *
 * Height rules (verbatim from both backends):
 *   - spacer:        rowHeight / 2
 *   - group_header:  rowHeight
 *   - data (wrap>1): max(rowHeight, dataLineHeightPx * lines + 6)
 *   - data (else):   rowHeight
 *   - data: also max-ed with contentHeights[id] (tall visual cells)
 *   - +rowGroupPadding on rowPaddedAfter rows.
 *
 * Marker center excludes the trailing pad so markers stay centered on the data
 * portion, not the inflated track (the 2026-05-25 regression this guards).
 */
export function computeRowLayout(input: RowLayoutInput): RowLayout {
  const { displayRows, wrapLineCounts, rowHeight, rowGroupPadding, dataLineHeightPx } = input;
  const contentHeights = input.contentHeights ?? {};
  const rowPaddedAfter = computeRowPaddedAfter(displayRows);

  const rowHeights: number[] = [];
  for (let i = 0; i < displayRows.length; i++) {
    const dr = displayRows[i];
    let h: number;
    if (resolveRowKind(dr) === "spacer") {
      h = rowHeight / 2;
    } else if (dr.type === "group_header") {
      h = rowHeight;
    } else if (dr.type === "data") {
      const lines = wrapLineCounts[dr.row.id] ?? 1;
      const wrapH = lines > 1 ? Math.max(rowHeight, dataLineHeightPx * lines + 6) : rowHeight;
      // Grow to the tallest of: base/wrap height and the row's intrinsic
      // visual content height (stacked pictograms, tall icons, multi-effect
      // forest, sparkline/img).
      h = Math.max(wrapH, contentHeights[dr.row.id] ?? 0);
    } else if (dr.type === "panel") {
      // Details panel: content-driven. The DOM measure-commit supplies the real
      // rendered height (keyed panelContentKey); until then a markdown line-count
      // estimate is the floor (matters for first paint + the SVG estimator).
      const measured = contentHeights[panelContentKey(dr.rowId)] ?? 0;
      const estLines = dr.content ? dr.content.split("\n").length : 1;
      const estimate = dataLineHeightPx * estLines + 6 * 2; // +vertical padding
      h = Math.max(rowHeight, estimate, measured);
    } else {
      h = rowHeight;
    }
    if (rowPaddedAfter[i]) h += rowGroupPadding;
    rowHeights.push(h);
  }

  const rowPositions: number[] = [];
  let cumulativeY = 0;
  for (const h of rowHeights) {
    rowPositions.push(cumulativeY);
    cumulativeY += h;
  }

  const rowMarkerCenters: number[] = [];
  for (let i = 0; i < rowHeights.length; i++) {
    const trailingPad = rowPaddedAfter[i] ? rowGroupPadding : 0;
    rowMarkerCenters.push(rowPositions[i] + (rowHeights[i] - trailingPad) / 2);
  }

  return { rowHeights, rowPositions, rowMarkerCenters, rowPaddedAfter, rowsHeight: cumulativeY };
}

/** Inputs to the header-band height formula. */
export interface HeaderHeightInput {
  /** Body font size in px (already parsed). */
  bodyFontPx: number;
  /** Themed minimum header height (`theme.spacing.headerHeight`). */
  themeHeaderHeight: number;
  /** 2 when column groups produce a two-tier header strip, else 1. */
  headerDepth: number;
}

/** Header-font scale-up applied to the body size for header rows (matches the
 *  `.header-cell` CSS and the SVG header font). */
export const HEADER_FONT_SCALE = 1.05;
/** Line-height used across header / wrapped-row vertical math. */
export const LINE_HEIGHT = 1.5;
/** Breathing room added to a header row over its single-line text height.
 *  (The magic `+6` documented in sizing-model.md §1.2 — named here.) */
export const HEADER_ROW_PADDING = 6;

/**
 * Header-band height: `max(themeHeaderHeight, minRow * headerDepth)` where
 * `minRow = ceil(bodyFontPx * 1.05 * 1.5) + 6`. Verbatim from both backends.
 * Caller gates header visibility (an all-headers-hidden table collapses the
 * band to 0) since that predicate differs slightly per backend.
 */
export function computeHeaderHeight(input: HeaderHeightInput): number {
  const minRow = Math.ceil(input.bodyFontPx * HEADER_FONT_SCALE * LINE_HEIGHT) + HEADER_ROW_PADDING;
  return Math.max(input.themeHeaderHeight, minRow * input.headerDepth);
}

/** Default axis gap when the theme leaves `spacing.axisGap` unset. */
export const DEFAULT_AXIS_GAP = 12;

/** Inputs to the aspect ladder's scalable-chrome denominator. */
export interface ScalableChromeInput {
  /** Themed vertical spacing tokens (read directly; missing → documented default). */
  spacing: {
    headerGap?: number;
    headerHeight?: number;
    axisGap?: number;
    footerGap?: number;
    bottomMargin?: number;
    titleSubtitleGap?: number;
    rowGroupPadding?: number;
  };
  hasAxis: boolean;
  hasTitle: boolean;
  hasSubtitle: boolean;
  hasFooter: boolean;
  /** Count of top-level (depth 0) group headers (each contributes rowGroupPadding). */
  topLevelGroupCount: number;
}

/** Defaults for the chrome tokens (mirror the SVG backend's fallbacks). */
const CHROME_DEFAULTS = {
  headerGap: 12,
  axisGap: DEFAULT_AXIS_GAP,
  footerGap: 8,
  bottomMargin: 16,
  titleSubtitleGap: 13,
} as const;

/**
 * Scalable-chrome denominator for the aspect-ratio height ladder — the subset
 * of vertical chrome that scales when an aspect target stretches/shrinks the
 * table (header gap/height, axis gap, footer gap, bottom margin, the
 * title↔subtitle gap, and per-top-level-group padding). Each term is gated on
 * whether that chrome actually renders for the spec.
 *
 * **Convergence (2026-06):** the DOM backend previously used a crude
 * `headerHeight + axisHeight` proxy here, under-allocating chrome for specs with
 * title/subtitle/footer/multiple groups (so its aspect ladder over-scaled rows).
 * Both backends now use this precise sum.
 */
export function computeScalableChromeHeight(input: ScalableChromeInput): number {
  const { spacing: sp, hasAxis, hasTitle, hasSubtitle, hasFooter, topLevelGroupCount } = input;
  return (
    (sp.headerGap ?? CHROME_DEFAULTS.headerGap) +
    (sp.headerHeight ?? 0) +
    (hasAxis ? (sp.axisGap ?? CHROME_DEFAULTS.axisGap) : 0) +
    (hasFooter ? (sp.footerGap ?? CHROME_DEFAULTS.footerGap) : 0) +
    (sp.bottomMargin ?? CHROME_DEFAULTS.bottomMargin) +
    (hasTitle && hasSubtitle ? (sp.titleSubtitleGap ?? CHROME_DEFAULTS.titleSubtitleGap) : 0) +
    topLevelGroupCount * (sp.rowGroupPadding ?? 0)
  );
}

/**
 * Axis-band height. `hasAxisColumn ? axisGap + axisRegionHeight : 0`.
 *
 * **Convergence (2026-06):** the band is reserved only when a column actually
 * renders an x-axis strip (forest or any viz_*). The DOM backend previously
 * gated on "any forest column exists", over-reserving ~axis height for plain
 * tables / non-forest-but-viz layouts; both backends now use this precise gate.
 * `axisRegionHeight` is the font-derived portion the caller computes via
 * `computeAxisLayout` (kept caller-side; it needs typography helpers).
 */
export function computeAxisHeight(
  hasAxisColumn: boolean,
  axisGap: number,
  axisRegionHeight: number,
): number {
  return hasAxisColumn ? axisGap + axisRegionHeight : 0;
}
