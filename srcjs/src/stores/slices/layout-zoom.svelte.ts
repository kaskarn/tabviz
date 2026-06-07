// Layout-zoom slice — the long pole of the C1 decomposition.
//
// Owns every piece of "how big is the rendered widget, and where does each
// row / column / band live within it" — the canvas-side counterpart to the
// data/columns/rows-groups slices' "what data are we rendering" story.
//
// State (own):
//   - initialWidth / initialHeight     — htmlwidget seed dims
//   - containerWidth / containerHeight — ResizeObserver inputs
//   - scalableNaturalWidth / scalableNaturalHeight — natural content dims
//   - containerElementId               — anchor for localStorage zoom state
//   - plotWidthOverride                — runtime forest column resize
//   - zoom / autoFit / maxWidth / maxHeight / showZoomControls
//
// Derived (own):
//   - effectiveWidth / effectiveHeight — ResizeObserver-or-initial fallback
//   - layout                           — the giant lever-ladder $derived
//   - naturalContentWidth              — column-width aggregate for fit
//   - fitScale / minZoomFloor / actualScale / isClamped
//
// Methods (own):
//   - setDimensions / setContainerDimensions / setScalableNaturalDimensions /
//     setContainerElementId
//   - setPlotWidth / getPlotWidth
//   - setZoom / resetZoom / zoomIn / zoomOut / setAutoFit / fitToWidth
//   - setMaxWidth / setMaxHeight / setShowZoomControls
//   - persistZoomState / loadZoomState (internal; localStorage)
//   - reset (for resetState; restores defaults but NOT localStorage)
//
// Cross-slice reads via getter deps:
//   - getSpec               — heaviest dep; theme.spacing.*, theme.text.body,
//                             data.rows / .groups / .overall, paginate, columns
//   - getAllColumns         — columns slice
//   - getForestColumns      — columns slice (forest-specific)
//   - getColumnWidths       — columns slice (auto-measured + user-resized)
//   - getUserResizedIds     — columns slice (gate for honoring manual resizes)
//   - getDisplayRows        — data slice (pagination cut of fullDisplayRows)
//   - getTargetAspect       — data slice (pinned aspect for the lever ladder)
//   - getWrapLineCounts     — cells slice (per-row wrap-line cap for rowHeights)
//   - markSource            — source-tag plumbing
//
// Phase 0c-C1 PR11 (final slice).

import type {
  ColumnDef,
  ColumnSpec,
  ComputedLayout,
  DisplayRow,
  WebSpec,
  ZoomState,
} from "$types";
import { computeAxisLayout, parseFontSize } from "$lib/typography-layout";
import { computeRowLayout, computeHeaderHeight, computeAxisHeight, computeScalableChromeHeight, DEFAULT_AXIS_GAP, LINE_HEIGHT, type ScalableChromeInput } from "$lib/layout/table-metrics";
import { computeContentHeights } from "$lib/width-utils";
import { ASPECT } from "$lib/rendering-constants";
import { resolveFlexWidths, type ColumnWidthSpec } from "$lib/layout/flex-distribute";
import { flexWeightForColumn, vizNaturalWidthForColumn } from "$lib/layout/flex-weights";
import {
  getCssVars, readVarPx, readBodySize, readLabelSize,
} from "$lib/theme/consumer-bridge";
import type { RowKind } from "$lib/layout/row-kind";

/**
 * Merge measured row heights (real DOM offsetHeight per row) over predicted
 * (estimator) content heights. Measured wins when present — the browser knows
 * the true rendered height; the estimate is the first-paint floor before the
 * ResizeObserver reports. Pure; returns a fresh map.
 */
function mergeMeasuredHeights(
  predicted: Record<string, number>,
  measured: Record<string, number> | null,
): Record<string, number> {
  if (!measured) return predicted;
  const out: Record<string, number> = { ...predicted };
  for (const id in measured) {
    const m = measured[id];
    if (m > 0) out[id] = Math.max(out[id] ?? 0, m);
  }
  return out;
}

/**
 * Grow-merge a measurement report into the committed heights map (B2 fix,
 * 2026-06-05). PURE + exported for the bun unit test.
 *
 * THE INVARIANT (sizing-model §6c): committed heights are CONTENT heights.
 * The measure loop reports only rows whose content truly overflows its
 * pinned grid track, so settled rows are absent from each report —
 * replacing the map would drop their committed heights and oscillate.
 * Per-key Math.max keeps the "rows only grow" design. Returns `prev`
 * unchanged (same reference) when nothing grew, so the caller's
 * reassignment guard settles the commit loop.
 */
export function growMergeHeights(
  prev: Record<string, number> | null,
  report: Record<string, number>,
): Record<string, number> | null {
  const base = prev ?? {};
  let changed = false;
  const merged: Record<string, number> = { ...base };
  for (const [k, v] of Object.entries(report)) {
    if ((merged[k] ?? 0) < v) {
      merged[k] = v;
      changed = true;
    }
  }
  return changed ? merged : prev;
}

/** Shallow value-equality for measured-height maps (within 0.5px), so the
 *  ResizeObserver→commit loop doesn't churn on sub-pixel jitter. */
function sameHeightMap(
  a: Record<string, number> | null,
  b: Record<string, number> | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!(k in b) || Math.abs(a[k] - b[k]) > 0.5) return false;
  }
  return true;
}

/** True if any top-level column in the spec is a ColumnGroup. Pushes the
 *  header strip to a 2-row layout, which changes the min header-row height. */
function anyForestColumnGroups(columns: ColumnDef[] | undefined): boolean {
  if (!columns) return false;
  return columns.some((c) => c.isGroup);
}

export interface LayoutZoomSliceDeps {
  getSpec: () => WebSpec | null;
  getAllColumns: () => readonly ColumnSpec[];
  getForestColumns: () => readonly { index: number; column: ColumnSpec }[];
  getColumnWidths: () => Record<string, number>;
  getUserResizedIds: () => ReadonlySet<string>;
  getDisplayRows: () => readonly DisplayRow[];
  getTargetAspect: () => number | null;
  getWrapLineCounts: () => Record<string, number>;
  markSource: (field: string) => void;
}

export interface LayoutZoomSlice {
  readonly initialWidth: number;
  readonly initialHeight: number;
  readonly containerWidth: number;
  readonly containerHeight: number;
  readonly scalableNaturalWidth: number;
  readonly scalableNaturalHeight: number;
  readonly containerElementId: string | null;
  readonly plotWidthOverride: number | null;
  readonly zoom: number;
  readonly autoFit: boolean;
  readonly contrastOverride: "auto" | "more";
  readonly maxWidth: number | null;
  readonly maxHeight: number | null;
  readonly showZoomControls: boolean;

  readonly effectiveWidth: number;
  readonly effectiveHeight: number;
  readonly layout: ComputedLayout;
  readonly naturalContentWidth: number;
  readonly fitScale: number;
  readonly minZoomFloor: number;
  readonly actualScale: number;
  readonly isClamped: boolean;

  setDimensions: (w: number, h: number) => void;
  setContainerDimensions: (w: number, h: number) => void;
  setScalableNaturalDimensions: (w: number, h: number) => void;
  setContainerElementId: (id: string | null) => void;
  setPlotWidth: (newWidth: number | null) => void;
  getPlotWidth: () => number | null;
  /** Commit measured per-row content heights (rowId → px) from the DOM. */
  setMeasuredRowHeights: (heights: Record<string, number> | null) => void;
  /** Per-row-kind height overrides (the pin layer). */
  readonly rowKindHeights: Partial<Record<RowKind, number>>;
  /** Pin a row kind's base height (`null` clears it back to the density default). */
  setRowKindHeight: (kind: RowKind, height: number | null) => void;
  /** Clear all per-row-kind height pins. */
  resetRowKindHeights: () => void;
  setZoom: (value: number) => void;
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setAutoFit: (value: boolean) => void;
  setContrastOverride: (value: "auto" | "more") => void;
  fitToWidth: () => void;
  setMaxWidth: (value: number | null) => void;
  setMaxHeight: (value: number | null) => void;
  setShowZoomControls: (show: boolean) => void;

  /** resetState calls this to wipe runtime zoom/sizing back to defaults. */
  reset: () => void;
}

export function createLayoutZoomSlice(deps: LayoutZoomSliceDeps): LayoutZoomSlice {
  let initialWidth = $state<number>(800);
  let initialHeight = $state<number>(400);
  let containerWidth = $state<number>(0);
  let containerHeight = $state<number>(0);
  let scalableNaturalWidth = $state<number>(0);
  let scalableNaturalHeight = $state<number>(0);
  let containerElementId = $state<string | null>(null);
  let plotWidthOverride = $state<number | null>(null);
  // Measured per-row content heights (rowId → real rendered px) reported by the
  // DOM ResizeObserver. `$state.raw` — replaced wholesale, never deep-mutated.
  // Supersedes the estimator in the layout derivation (measure-then-commit).
  let measuredRowHeights = $state.raw<Record<string, number> | null>(null);

  // Per-row-kind height overrides (the cascade's last arrow + the interactive
  // pin target). `$state.raw` — replaced wholesale. Survives density/factor
  // re-resolution (it's an override layer on top of the density-derived base).
  let rowKindHeights = $state.raw<Partial<Record<RowKind, number>>>({});

  let zoom = $state<number>(1.0);
  let autoFit = $state<boolean>(true);
  // Viewer accessibility override (round-2 a11y B2): "auto" honors the
  // OS prefers-contrast/forced-colors signal; "more" forces high-contrast.
  // A VIEWER preference — overlays mode=high-contrast at paint time without
  // mutating the theme artifact (theme.inputs.mode is the AUTHOR's choice).
  let contrastOverride = $state<"auto" | "more">("auto");
  let maxWidth = $state<number | null>(null);
  let maxHeight = $state<number | null>(null);
  let showZoomControls = $state<boolean>(true);

  // ── Effective canvas dims (prefer ResizeObserver over initial) ─────────

  // NOTE (spacing rework, 2026-06-05): the shell band + paper mat consume
  // horizontal room the flex budget does NOT subtract — deliberately.
  // Subtracting it here was tried and REGRESSED comfortable-width renders:
  // when budget < naturals the flex distribution squeezes TEXT columns
  // (ellipsis-clipping CI parens) instead of the forest column. Columns
  // keep sizing to the container; fitScale (below) accounts for the shell
  // band and scales the whole figure down, which clips nothing. The
  // proper narrow-container fix is squeeze-the-viz-column-first in
  // resolveFlexWidths — on the post-review board.
  const effectiveWidth = $derived(containerWidth > 0 ? containerWidth : initialWidth);
  const effectiveHeight = $derived(containerHeight > 0 ? containerHeight : initialHeight);

  // ── Layout (the big lever ladder) ──────────────────────────────────────

  const layout = $derived.by((): ComputedLayout => {
    const spec = deps.getSpec();
    if (!spec) {
      return {
        totalWidth: effectiveWidth,
        totalHeight: effectiveHeight,
        headerHeight: 36,
        rowHeight: 28,
        plotHeight: 300,
        axisHeight: 32,
        nullValue: 0,
        summaryYPosition: 0,
        showOverallSummary: false,
        rowPositions: [],
        rowHeights: [],
        rowMarkerCenters: [],
      };
    }

    const forestColumns = deps.getForestColumns();
    const allColumns = deps.getAllColumns();
    const columnWidths = deps.getColumnWidths();
    const userResizedIds = deps.getUserResizedIds();
    const displayRows = deps.getDisplayRows();
    const wrapLineCounts = deps.getWrapLineCounts();
    const targetAspect = deps.getTargetAspect();

    const cssVars = getCssVars(spec.theme);
    const naturalRowHeight = readVarPx(cssVars, "--tv-spacing-row-height", 34);
    let rowHeight = naturalRowHeight;
    const lineHeight = LINE_HEIGHT;
    const headerFontSize = parseFontSize(readBodySize(cssVars));
    const headerDepthForLayout = anyForestColumnGroups(spec.columns) ? 2 : 1;
    const headerHeight = computeHeaderHeight({
      bodyFontPx: headerFontSize,
      themeHeaderHeight: readVarPx(cssVars, "--tv-spacing-header-height", 34),
      headerDepth: headerDepthForLayout,
    });
    const axisGap = readVarPx(cssVars, "--tv-spacing-axis-gap", DEFAULT_AXIS_GAP);
    // Axis band is reserved only when a column actually renders an x-axis
    // strip (forest or any viz_*). Converged with the SVG backend (2026-06):
    // previously the DOM reserved axis height unconditionally, over-tall for
    // plain tables.
    const hasAxisColumn = allColumns.some(
      (c) => c.type === "forest" || c.type === "viz_bar" || c.type === "viz_boxplot" || c.type === "viz_violin",
    );
    const someColumnHasAxisLabel = allColumns.some((c) => {
      if (c.type === "forest") return !!c.options?.forest?.axisLabel;
      if (c.type === "viz_bar") return !!c.options?.vizBar?.axisLabel;
      if (c.type === "viz_boxplot") return !!c.options?.vizBoxplot?.axisLabel;
      if (c.type === "viz_violin") return !!c.options?.vizViolin?.axisLabel;
      return false;
    });
    const axisGeom = computeAxisLayout(
      { fontSizeSm: readLabelSize(cssVars), lineHeight: 1.5 },
      someColumnHasAxisLabel,
      readVarPx(cssVars, "--tv-plot-tick-mark-length", 5),
    );
    const axisHeight = computeAxisHeight(hasAxisColumn, axisGap, axisGeom.axisRegionHeight);
    const hasForest = forestColumns.length > 0;
    const themePlotWidth = spec.theme.layout?.plotWidth;
    // Column widths now come from the multi-flex distribution below
    // (resolveFlexWidths); forest is just a high-weight column. A pinned plot
    // width (plotWidthOverride / theme.layout.plotWidth) pins the forest column
    // in that distribution. See docs/dev/multi-flex-columns.md.
    const pinnedForestWidth =
      plotWidthOverride ?? (typeof themePlotWidth === "number" ? themePlotWidth : null);

    // ── Aspect ladder ───────────────────────────────────────────────────
    //
    // When `targetAspect` is pinned, reshape the layout to hit
    // `width / height == targetAspect`. The full algorithm header (anchor
    // model, three width stages, height ladder) lives in the diary +
    // svg-generator counterpart — see those for the design rationale.
    // Mirrors the static-export math in svg-generator.ts so the live
    // widget and the downloaded SVG agree pixel-for-pixel.
    let chromeScale = 1;
    let aspectTargetWidth: number | null = null;
    let aspectTargetHeight: number | null = null;
    let layoutWidth = effectiveWidth;
    if (targetAspect != null) {
      const hasOverallForBudget = !!spec.data.overall;
      const effectiveRowSlots =
        displayRows.length + (hasOverallForBudget ? 1.5 : 0);
      const approxRowsHeight = effectiveRowSlots * naturalRowHeight;
      // Shell padding is figure-internal air (spacing rework) so it
      // belongs in the aspect the user pins; containerPadding is page
      // gutter and deliberately stays out.
      const approxChromeHeight =
        headerHeight + axisHeight + readVarPx(cssVars, "--tv-spacing-padding", 8) * 2 +
        readVarPx(cssVars, "--tv-shell-padding", 0) * 2;
      const approxNaturalHeight = approxRowsHeight + approxChromeHeight;
      const approxNaturalWidth = effectiveWidth;
      const naturalAspect = approxNaturalWidth > 0 && approxNaturalHeight > 0
        ? approxNaturalWidth / approxNaturalHeight
        : 1;

      const rawAnchor = spec.targetAspectAnchor ?? "width";
      const resolvedAnchor: "width" | "height" =
        rawAnchor === "auto"
          ? (targetAspect >= naturalAspect ? "height" : "width")
          : rawAnchor;
      let targetWidth: number;
      let targetHeight: number;
      if (resolvedAnchor === "height") {
        // Hard cap: layoutWidth never exceeds 8× canvas. TARGET_ASPECT_MAX
        // = 10 keeps `targetAspect` finite; 8× canvas is the practical
        // visible / scrollable cap.
        const MAX_LAYOUT_WIDTH = approxNaturalWidth * ASPECT.MAX_LAYOUT_WIDTH_MULT;
        targetHeight = approxNaturalHeight;
        targetWidth = Math.min(approxNaturalHeight * targetAspect, MAX_LAYOUT_WIDTH);
        if (targetWidth > approxNaturalWidth) {
          layoutWidth = targetWidth;
        }
      } else {
        targetWidth = approxNaturalWidth;
        targetHeight = targetWidth / targetAspect;
      }
      aspectTargetWidth = targetWidth;
      aspectTargetHeight = targetHeight;
      // Width: the multi-flex distribution below absorbs the width delta into
      // the flex columns (cap-bounded when aspect-pinned). Height ladder follows.

      // Height ladder (direction-aware). Mirrors
      // generateSVGForAspectTarget in svg-generator.ts.
      const heightDelta = targetHeight - approxNaturalHeight;
      const bodyFontSize = parseFontSize(readBodySize(cssVars));
      const MIN_ROW_HEIGHT = Math.max(
        ASPECT.MIN_ROW_HEIGHT.FLOOR,
        Math.round(bodyFontSize * ASPECT.MIN_ROW_HEIGHT.LINE_FACTOR) + ASPECT.MIN_ROW_HEIGHT.PAD,
      );
      const naturalChromeHeight = approxChromeHeight;
      const naturalPlotHeight = approxRowsHeight;
      // chromeScale denominator: the scalable subset of natural chrome.
      // Converged with the SVG backend (2026-06) — was a crude
      // `headerHeight + axisHeight` proxy that under-allocated chrome for
      // specs with title/subtitle/footer/multiple groups.
      const topLevelGroupCount = displayRows.filter(
        (r) => r.type === "group_header" && r.depth === 0,
      ).length;
      const scalableChromeHeight = computeScalableChromeHeight({
        spacing: spec.theme.spacing as unknown as ScalableChromeInput["spacing"],
        hasAxis: axisHeight > 0,
        hasTitle: !!spec.labels?.title,
        hasSubtitle: !!spec.labels?.subtitle,
        hasFooter: !!(spec.labels?.caption || spec.labels?.footnote),
        topLevelGroupCount,
      });

      if (heightDelta > 0 && naturalPlotHeight > 0) {
        const CHROME_SHARE = ASPECT.CHROME_SHARE;
        const chromeDelta = heightDelta * CHROME_SHARE;
        const rowDelta = heightDelta - chromeDelta;
        if (scalableChromeHeight > 0)
          chromeScale = (scalableChromeHeight + chromeDelta) / scalableChromeHeight;
        rowHeight = naturalRowHeight + rowDelta / effectiveRowSlots;
      } else if (heightDelta < 0 && naturalPlotHeight > 0) {
        const targetPlotHeight = Math.max(0, targetHeight - naturalChromeHeight);
        const proposedRowHeight =
          (targetPlotHeight / naturalPlotHeight) * naturalRowHeight;
        if (proposedRowHeight >= MIN_ROW_HEIGHT) {
          rowHeight = proposedRowHeight;
        } else {
          rowHeight = MIN_ROW_HEIGHT;
          const flooredPlotHeight = MIN_ROW_HEIGHT * effectiveRowSlots;
          const residualHeight =
            targetHeight - (naturalChromeHeight + flooredPlotHeight);
          if (scalableChromeHeight > 0) {
            chromeScale = Math.max(
              ASPECT.CHROME_SCALE_FLOOR,
              (scalableChromeHeight + residualHeight) / scalableChromeHeight,
            );
          }
        }
      }
    }
    // Apply chromeScale to the natural chrome heights.
    const scaledHeaderHeight = headerHeight * chromeScale;
    const scaledAxisHeight = axisHeight * chromeScale;

    // ── Multi-flex width distribution ───────────────────────────────────
    // Distribute the content area across all columns by weight × natural. At
    // natural this fills the container; with a pinned targetAspect it distributes
    // into the (possibly grown) layoutWidth, cap-bounded. Forest is a high-weight
    // column; pinned/user-resized columns are immovable. (docs/dev/multi-flex-columns.md)
    const FLEX_DEFAULT_COL_WIDTH = 100;
    const flexCap = targetAspect != null ? ASPECT.FLEX_CAP : undefined;
    const flexSpecs: ColumnWidthSpec[] = allColumns.map((c) => {
      const measured = columnWidths[c.id];
      const userResized = userResizedIds.has(c.id);
      const forestPin =
        c.type === "forest" ? (pinnedForestWidth ?? c.options?.forest?.width ?? null) : null;
      const explicit =
        forestPin ??
        (userResized && typeof measured === "number" ? measured
          : typeof c.width === "number" ? c.width : null);
      const natural =
        explicit ?? measured ?? vizNaturalWidthForColumn(c) ?? FLEX_DEFAULT_COL_WIDTH;
      return {
        id: c.id,
        naturalWidth: natural,
        flexWeight: flexWeightForColumn(c),
        explicitWidth: explicit,
        minWidth: measured ?? undefined,
        cap: flexCap,
      };
    });
    const flexWidths = resolveFlexWidths(
      flexSpecs,
      Math.max(0, layoutWidth - readVarPx(cssVars, "--tv-spacing-padding", 8) * 2),
    ).widths;
    const hasOverall = !!spec.data.overall;

    // Per-row heights. Group-header rows pick up rowGroupPadding (themed
    // bottom margin on the LAST data row of the previous top-level group,
    // anchored via the rowPaddedAfter derived in the main store). Spacer
    // rows stay half-height. Wrap-enabled cells inflate height to fit
    // line counts up to the column's `wrap` cap.
    const rowGroupPadding = readVarPx(cssVars, "--tv-spacing-row-group-padding", 0);
    const dataLineHeightPx = Math.ceil(parseFontSize(readBodySize(cssVars)) * lineHeight);

    // Per-row intrinsic content height (predicted estimator path). Measured
    // overrides from the DOM are layered on top via getMeasuredRowHeights().
    const predictedContent = computeContentHeights(allColumns, spec.data.rows, {
      rowHeight,
      lineHeight,
      fontSize: parseFontSize(readBodySize(cssVars)),
    });
    const contentHeights = mergeMeasuredHeights(predictedContent, measuredRowHeights);

    // Per-row vertical layout via the shared (DOM/SVG) metrics helper.
    // Phase 5 row-kind height cascade:
    //   layer 3 (themeKinds) — pulled from spec.theme.row_kinds when present
    //     (v4 substrate field; not yet emitted by the v3 resolver). Currently
    //     undefined; populated once the new resolver lands.
    //   layer 4 (constructorRowHeights) — from spec.rowHeights (v4 field).
    //   layer 5 (rowKindHeights pins) — interactive pin slice state, unchanged.
    const { rowHeights, rowPositions, rowMarkerCenters, rowsHeight: cumulativeY } = computeRowLayout({
      displayRows,
      wrapLineCounts,
      rowHeight,
      rowGroupPadding,
      dataLineHeightPx,
      contentHeights,
      rowKindHeights,
      constructorRowHeights: spec.rowHeights,
    });

    const plotHeight = cumulativeY + (hasOverall ? rowHeight * 1.5 : 0);

    const firstForest = forestColumns[0]?.column;
    const forestOptions = firstForest?.options?.forest;
    const scale = forestOptions?.scale ?? "linear";
    const nullValue = forestOptions?.nullValue ?? (scale === "log" ? 1 : 0);

    // Stable natural aspect — pre-mutation reference for the slider.
    // Includes shell padding for the same reason as approxChromeHeight.
    const stableNaturalRowsHeight = displayRows.length * naturalRowHeight;
    const stableNaturalChromeHeight =
      headerHeight + axisHeight + readVarPx(cssVars, "--tv-spacing-padding", 8) * 2 +
      readVarPx(cssVars, "--tv-shell-padding", 0) * 2;
    const stableNaturalHeight = stableNaturalRowsHeight + stableNaturalChromeHeight;
    const stableNaturalAspect = stableNaturalHeight > 0
      ? effectiveWidth / stableNaturalHeight
      : 1;

    // userResizedIds is consulted upstream in svg-generator; layout itself
    // doesn't gate on it, but reading it keeps the dependency edge live
    // for downstream consumers that read user-resized state via `layout`.
    void userResizedIds;

    return {
      totalWidth: layoutWidth,
      totalHeight: Math.max(effectiveHeight, plotHeight + scaledHeaderHeight + scaledAxisHeight + readVarPx(cssVars, "--tv-spacing-padding", 8) * 2),
      flexWidths,
      chromeScale,
      aspectTargetWidth,
      aspectTargetHeight,
      naturalAspect: stableNaturalAspect,
      headerHeight: scaledHeaderHeight,
      rowHeight,
      plotHeight,
      axisHeight: scaledAxisHeight,
      axisRegionHeight: axisGeom.axisRegionHeight,
      nullValue,
      summaryYPosition: plotHeight - rowHeight,
      showOverallSummary: hasOverall,
      rowPositions,
      rowHeights,
      rowMarkerCenters,
    };
  });

  // ── Natural content width (column-width aggregate for fit math) ────────

  const naturalContentWidth = $derived.by((): number => {
    const spec = deps.getSpec();
    if (!spec) return 800;
    const DEFAULT_COLUMN_WIDTH = 100;
    const allColumns = deps.getAllColumns();
    const columnWidths = deps.getColumnWidths();
    const cssVars = getCssVars(spec.theme);

    // The intrinsic ("wants") width = Σ per-column naturals + padding (forest is
    // a column here, via its designed natural). The fit math scales down when the
    // container is narrower than this; when wider, the multi-flex distribution
    // grows columns to fill instead.
    let total = 0;
    for (const col of allColumns) {
      const natural = (typeof col.width === "number" ? col.width : null)
        ?? columnWidths[col.id]
        ?? vizNaturalWidthForColumn(col)
        ?? DEFAULT_COLUMN_WIDTH;
      total += natural;
    }
    return total + readVarPx(cssVars, "--tv-spacing-padding", 8) * 2;
  });

  // ── Fit + actualScale ──────────────────────────────────────────────────

  const fitScale = $derived.by((): number => {
    if (containerWidth <= 0 || scalableNaturalWidth <= 0) return 1;
    const contentWidth = scalableNaturalWidth * zoom;
    // The scalable must fit INSIDE the shell band (paper pad is already
    // part of the measured scalable width; shell pad is not).
    const spec = deps.getSpec();
    const shellPadW = spec
      ? 2 * readVarPx(getCssVars(spec.theme), "--tv-shell-padding", 0)
      : 0;
    const avail = Math.max(100, containerWidth - shellPadW);
    return contentWidth > avail ? avail / contentWidth : 1;
  });

  const minZoomFloor = $derived(
    deps.getTargetAspect() != null ? (autoFit ? 0.05 : 0.5) : 0.5,
  );
  const actualScale = $derived(
    autoFit
      ? Math.max(minZoomFloor, zoom * fitScale)
      : Math.max(minZoomFloor, Math.min(2.0, zoom)),
  );
  const isClamped = $derived(autoFit && fitScale < 1);

  // ── Actions ────────────────────────────────────────────────────────────

  function setDimensions(w: number, h: number) {
    initialWidth = w;
    initialHeight = h;
  }

  function setContainerDimensions(w: number, h: number) {
    containerWidth = w;
    containerHeight = h;
  }

  function setScalableNaturalDimensions(w: number, h: number) {
    scalableNaturalWidth = w;
    scalableNaturalHeight = h;
  }

  function setContainerElementId(id: string | null) {
    containerElementId = id;
    if (id) loadZoomState();
  }

  function setPlotWidth(newWidth: number | null) {
    plotWidthOverride = newWidth === null ? null : Math.max(100, newWidth);
    deps.markSource("plot_width");
  }

  function getPlotWidth(): number | null {
    return plotWidthOverride;
  }

  // Commit measured row heights from the DOM measure loop.
  //
  // GROW-MERGE, not replace (B2 fix, 2026-06-05): the measure side now
  // reports only rows whose content truly overflows its pinned track, so
  // a settled (grown-to-fit) row is ABSENT from each new report. Replacing
  // the map would drop its committed height → shrink → overflow → re-grow
  // oscillation. Merging with per-key Math.max keeps the documented
  // "rows only grow" invariant and settles in one pass. `null` still
  // clears everything (resetState path).
  function setMeasuredRowHeights(heights: Record<string, number> | null): void {
    if (heights === null) {
      if (measuredRowHeights !== null) measuredRowHeights = null;
      return;
    }
    const merged = growMergeHeights(measuredRowHeights, heights);
    if (merged === measuredRowHeights) return;
    measuredRowHeights = merged;
  }

  function setRowKindHeight(kind: RowKind, height: number | null): void {
    const next = { ...rowKindHeights };
    if (height == null) delete next[kind];
    else next[kind] = Math.max(1, Math.round(height));
    rowKindHeights = next;
    deps.markSource("row_kind_heights");
  }

  function resetRowKindHeights(): void {
    if (Object.keys(rowKindHeights).length === 0) return;
    rowKindHeights = {};
    deps.markSource("row_kind_heights");
  }

  function setZoom(value: number) {
    zoom = Math.max(0.5, Math.min(2.0, value));
    persistZoomState();
    deps.markSource("zoom");
  }

  function resetZoom() {
    zoom = 1.0;
    persistZoomState();
    deps.markSource("zoom");
  }

  function zoomIn()  { setZoom(zoom * 1.1); }
  function zoomOut() { setZoom(zoom / 1.1); }

  function setAutoFit(value: boolean) {
    autoFit = value;
    persistZoomState();
    deps.markSource("zoom");
  }

  function setContrastOverride(value: "auto" | "more") {
    contrastOverride = value;
    deps.markSource("zoom");
  }

  function fitToWidth() {
    if (!containerWidth || !scalableNaturalWidth) return;
    // ResizeObserver returns the content box (excludes padding).
    zoom = Math.min(2.0, Math.max(0.5, containerWidth / scalableNaturalWidth));
    persistZoomState();
    deps.markSource("zoom");
  }

  function setMaxWidth(value: number | null) {
    maxWidth = value;
    persistZoomState();
    deps.markSource("zoom");
  }

  function setMaxHeight(value: number | null) {
    maxHeight = value;
    persistZoomState();
    deps.markSource("zoom");
  }

  function setShowZoomControls(show: boolean) {
    showZoomControls = show;
    deps.markSource("zoom");
  }

  // ── localStorage persistence ───────────────────────────────────────────

  function getStorageKey(): string | null {
    if (!containerElementId) return null;
    return `tabviz_zoom_${containerElementId}`;
  }

  function persistZoomState() {
    const key = getStorageKey();
    if (!key) return;
    try {
      const state: ZoomState = {
        zoom, autoFit, maxWidth, maxHeight, version: 2,
      };
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // localStorage unavailable or full — silently ignore.
    }
  }

  function loadZoomState() {
    const key = getStorageKey();
    if (!key) return;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const state = JSON.parse(stored) as ZoomState;
        if (state.version === 2) {
          zoom = state.zoom ?? 1.0;
          autoFit = state.autoFit ?? true;
          maxWidth = state.maxWidth ?? null;
          maxHeight = state.maxHeight ?? null;
        }
        // Version 1 (old format) is silently ignored — users get defaults.
      }
    } catch {
      // Invalid stored state — silently ignore.
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  function reset() {
    plotWidthOverride = null;
    measuredRowHeights = null;
    rowKindHeights = {};
    zoom = 1.0;
    autoFit = true;
    maxWidth = null;
    maxHeight = null;
  }

  return {
    get initialWidth()          { return initialWidth; },
    get initialHeight()         { return initialHeight; },
    get containerWidth()        { return containerWidth; },
    get containerHeight()       { return containerHeight; },
    get scalableNaturalWidth()  { return scalableNaturalWidth; },
    get scalableNaturalHeight() { return scalableNaturalHeight; },
    get containerElementId()    { return containerElementId; },
    get plotWidthOverride()     { return plotWidthOverride; },
    get zoom()                  { return zoom; },
    get autoFit()               { return autoFit; },
    get contrastOverride()      { return contrastOverride; },
    get maxWidth()              { return maxWidth; },
    get maxHeight()             { return maxHeight; },
    get showZoomControls()      { return showZoomControls; },

    get effectiveWidth()        { return effectiveWidth; },
    get effectiveHeight()       { return effectiveHeight; },
    get layout()                { return layout; },
    get naturalContentWidth()   { return naturalContentWidth; },
    get fitScale()              { return fitScale; },
    get minZoomFloor()          { return minZoomFloor; },
    get actualScale()           { return actualScale; },
    get isClamped()             { return isClamped; },
    get rowKindHeights()        { return rowKindHeights; },

    setDimensions, setContainerDimensions, setScalableNaturalDimensions,
    setContainerElementId,
    setPlotWidth, getPlotWidth,
    setMeasuredRowHeights,
    setRowKindHeight, resetRowKindHeights,
    setZoom, resetZoom, zoomIn, zoomOut, setAutoFit, setContrastOverride, fitToWidth,
    setMaxWidth, setMaxHeight, setShowZoomControls,
    reset,
  };
}
