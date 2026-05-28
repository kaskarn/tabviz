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
//   - getUserResizedIds     — columns slice (gate for aspectNonForestScale)
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
import { TEXT_MEASUREMENT } from "$lib/rendering-constants";

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
  setZoom: (value: number) => void;
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setAutoFit: (value: boolean) => void;
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

  let zoom = $state<number>(1.0);
  let autoFit = $state<boolean>(true);
  let maxWidth = $state<number | null>(null);
  let maxHeight = $state<number | null>(null);
  let showZoomControls = $state<boolean>(true);

  // ── Effective canvas dims (prefer ResizeObserver over initial) ─────────

  const effectiveWidth = $derived(containerWidth > 0 ? containerWidth : initialWidth);
  const effectiveHeight = $derived(containerHeight > 0 ? containerHeight : initialHeight);

  // ── Layout (the big lever ladder) ──────────────────────────────────────

  const layout = $derived.by((): ComputedLayout => {
    const spec = deps.getSpec();
    if (!spec) {
      return {
        totalWidth: effectiveWidth,
        totalHeight: effectiveHeight,
        tableWidth: 300,
        forestWidth: 400,
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

    const naturalRowHeight = spec.theme.spacing.rowHeight;
    let rowHeight = naturalRowHeight;
    const lineHeight = 1.5;
    const headerFontSize = parseFontSize(spec.theme.text.body.size);
    const headerScale = 1.05;
    const minHeaderRowHeight = Math.ceil(headerFontSize * headerScale * lineHeight) + 6;
    const headerDepthForLayout = anyForestColumnGroups(spec.columns) ? 2 : 1;
    const headerHeight = Math.max(
      spec.theme.spacing.headerHeight,
      minHeaderRowHeight * headerDepthForLayout,
    );
    const axisGap = spec.theme.spacing.axisGap ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP;
    const someColumnHasAxisLabel = forestColumns.some(
      (fc) => !!fc.column.options?.forest?.axisLabel,
    );
    const axisGeom = computeAxisLayout(
      { fontSizeSm: spec.theme.text.label.size, lineHeight: 1.5 },
      someColumnHasAxisLabel,
      spec.theme.plot.tickMarkLength,
    );
    const axisHeight = axisGap + axisGeom.axisRegionHeight;
    const hasForest = forestColumns.length > 0;
    const themePlotWidth = spec.theme.layout?.plotWidth;
    let forestWidth = hasForest
      ? (plotWidthOverride
        ?? (typeof themePlotWidth === "number" ? themePlotWidth : Math.max(effectiveWidth * 0.25, 200)))
      : 0;

    // ── Aspect ladder ───────────────────────────────────────────────────
    //
    // When `targetAspect` is pinned, reshape the layout to hit
    // `width / height == targetAspect`. The full algorithm header (anchor
    // model, three width stages, height ladder) lives in the diary +
    // svg-generator counterpart — see those for the design rationale.
    // Mirrors the static-export math in svg-generator.ts so the live
    // widget and the downloaded SVG agree pixel-for-pixel.
    let aspectNonForestScale = 1;
    let chromeScale = 1;
    let aspectTargetWidth: number | null = null;
    let aspectTargetHeight: number | null = null;
    let layoutWidth = effectiveWidth;
    if (targetAspect != null) {
      const FLEX_CAP = 2;
      const naturalForestWidth = forestWidth;
      const hasOverallForBudget = !!spec.data.overall;
      const effectiveRowSlots =
        displayRows.length + (hasOverallForBudget ? 1.5 : 0);
      const approxRowsHeight = effectiveRowSlots * naturalRowHeight;
      const approxChromeHeight =
        headerHeight + axisHeight + spec.theme.spacing.padding * 2;
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
        const MAX_LAYOUT_WIDTH = approxNaturalWidth * 8;
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

      // Stage 1 — forest absorption (cap-clamped flex)
      const widthDelta = targetWidth - approxNaturalWidth;
      let widthAbsorbedByFlex = 0;
      if (hasForest && Math.abs(widthDelta) > 0.5) {
        const proposedFlex = naturalForestWidth + widthDelta;
        const cappedFlex = Math.max(
          naturalForestWidth / FLEX_CAP,
          Math.min(naturalForestWidth * FLEX_CAP, proposedFlex),
        );
        forestWidth = Math.max(0, cappedFlex);
        widthAbsorbedByFlex = cappedFlex - naturalForestWidth;
      }

      // Stage 2 — non-forest column scale. Denominator is the actual sum
      // of measured non-flex column widths (NOT approxNaturalWidth -
      // naturalForestWidth — the latter folds in chrome which makes the
      // scale factor too small).
      const widthResidual = widthDelta - widthAbsorbedByFlex;
      if (Math.abs(widthResidual) > 0.5) {
        let naturalNonForestSum = 0;
        for (const c of allColumns) {
          if (c.type === "forest") continue;
          const w = columnWidths[c.id]
            ?? (typeof c.width === "number" ? c.width : 0);
          naturalNonForestSum += w;
        }
        if (naturalNonForestSum > 0) {
          aspectNonForestScale = Math.max(
            0.25,
            (naturalNonForestSum + widthResidual) / naturalNonForestSum,
          );
        }
      }

      // Height ladder (direction-aware). Mirrors
      // generateSVGForAspectTarget in svg-generator.ts.
      const heightDelta = targetHeight - approxNaturalHeight;
      const bodyFontSize = parseFontSize(spec.theme.text.body.size);
      const MIN_ROW_HEIGHT = Math.max(14, Math.round(bodyFontSize * 1.4) + 4);
      const naturalChromeHeight = approxChromeHeight;
      const naturalPlotHeight = approxRowsHeight;
      // chromeScale denominator is the scalable subset of natural chrome
      // (headerHeight + axisHeight; padding × 2 stays unscaled).
      const scalableChromeHeight = headerHeight + axisHeight;

      if (heightDelta > 0 && naturalPlotHeight > 0) {
        const CHROME_SHARE = 0.35;
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
              0.4,
              (scalableChromeHeight + residualHeight) / scalableChromeHeight,
            );
          }
        }
      }
    }
    // Apply chromeScale to the natural chrome heights.
    const scaledHeaderHeight = headerHeight * chromeScale;
    const scaledAxisHeight = axisHeight * chromeScale;

    const tableWidth = layoutWidth - forestWidth;
    const hasOverall = !!spec.data.overall;

    // Per-row heights. Group-header rows pick up rowGroupPadding (themed
    // bottom margin on the LAST data row of the previous top-level group,
    // anchored via the rowPaddedAfter derived in the main store). Spacer
    // rows stay half-height. Wrap-enabled cells inflate height to fit
    // line counts up to the column's `wrap` cap.
    const rowGroupPadding = spec.theme.spacing.rowGroupPadding ?? 0;
    const dataLineHeightPx = Math.ceil(parseFontSize(spec.theme.text.body.size) * lineHeight);
    const rowHeights: number[] = [];

    // rowPaddedAfter computed inline here (slim, scoped to layout): flag
    // each data row that precedes a top-level group_header so the layout
    // can inflate its track for rowGroupPadding.
    const rowPaddedAfterLocal = new Array<boolean>(displayRows.length).fill(false);
    for (let i = 0; i < displayRows.length; i++) {
      const dr = displayRows[i];
      if (dr.type !== "group_header" || dr.depth !== 0) continue;
      for (let j = i - 1; j >= 0; j--) {
        const prev = displayRows[j];
        if (prev.type === "data" && prev.row.style?.type !== "spacer") {
          rowPaddedAfterLocal[j] = true;
          break;
        }
      }
    }

    for (let i = 0; i < displayRows.length; i++) {
      const displayRow = displayRows[i];
      let h: number;
      if (displayRow.type === "data" && displayRow.row.style?.type === "spacer") {
        h = rowHeight / 2;
      } else if (displayRow.type === "group_header") {
        h = rowHeight;
      } else if (displayRow.type === "data") {
        const lines = wrapLineCounts[displayRow.row.id] ?? 1;
        h = lines > 1 ? Math.max(rowHeight, dataLineHeightPx * lines + 6) : rowHeight;
      } else {
        h = rowHeight;
      }
      if (rowPaddedAfterLocal[i]) h += rowGroupPadding;
      rowHeights.push(h);
    }

    const rowPositions: number[] = [];
    let cumulativeY = 0;
    for (const h of rowHeights) {
      rowPositions.push(cumulativeY);
      cumulativeY += h;
    }

    // Marker-center Y per row. For a "padded-after" row we add
    // rowGroupPadding to the track height (so the next group_header sits
    // below empty space, not flush). The marker itself must still center
    // on the *data* portion of the row, not the inflated total — otherwise
    // forest dots / bars / boxes / violins drift downward as the user
    // bumps rowGroupPadding up. Single source so every renderer agrees.
    const rowMarkerCenters: number[] = [];
    for (let i = 0; i < rowHeights.length; i++) {
      const trailingPad = rowPaddedAfterLocal[i] ? rowGroupPadding : 0;
      rowMarkerCenters.push(rowPositions[i] + (rowHeights[i] - trailingPad) / 2);
    }

    const plotHeight = cumulativeY + (hasOverall ? rowHeight * 1.5 : 0);

    const firstForest = forestColumns[0]?.column;
    const forestOptions = firstForest?.options?.forest;
    const scale = forestOptions?.scale ?? "linear";
    const nullValue = forestOptions?.nullValue ?? (scale === "log" ? 1 : 0);

    // Stable natural aspect — pre-mutation reference for the slider.
    const stableNaturalRowsHeight = displayRows.length * naturalRowHeight;
    const stableNaturalChromeHeight =
      headerHeight + axisHeight + spec.theme.spacing.padding * 2;
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
      totalHeight: Math.max(effectiveHeight, plotHeight + scaledHeaderHeight + scaledAxisHeight + spec.theme.spacing.padding * 2),
      tableWidth,
      forestWidth,
      aspectNonForestScale,
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
    const userResizedIds = deps.getUserResizedIds();

    const aspectScale = layout.aspectNonForestScale ?? 1;
    let totalColumnWidth = 0;
    for (const col of allColumns) {
      if (col.type === "forest") continue;
      const userResized = userResizedIds.has(col.id);
      const base = (columnWidths[col.id]
        ?? (typeof col.width === "number" ? col.width : null)
        ?? DEFAULT_COLUMN_WIDTH);
      const scaled = (userResized || Math.abs(aspectScale - 1) < 1e-6)
        ? base : base * aspectScale;
      totalColumnWidth += scaled;
    }
    const forestWidth = layout.forestWidth;
    const padding = spec.theme.spacing.padding * 2;
    return totalColumnWidth + forestWidth + padding;
  });

  // ── Fit + actualScale ──────────────────────────────────────────────────

  const fitScale = $derived.by((): number => {
    if (containerWidth <= 0 || scalableNaturalWidth <= 0) return 1;
    const contentWidth = scalableNaturalWidth * zoom;
    return contentWidth > containerWidth
      ? containerWidth / contentWidth
      : 1;
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

    setDimensions, setContainerDimensions, setScalableNaturalDimensions,
    setContainerElementId,
    setPlotWidth, getPlotWidth,
    setZoom, resetZoom, zoomIn, zoomOut, setAutoFit, fitToWidth,
    setMaxWidth, setMaxHeight, setShowZoomControls,
    reset,
  };
}
