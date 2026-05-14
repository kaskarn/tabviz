import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from "d3-scale";
import type {
  WebSpec,
  Row,
  Group,
  ColumnDef,
  RowOrderOverrides,
  DragState,
  ComputedLayout,
  DisplayRow,
  GroupHeaderRow,
  DataRow,
  ZoomState,
} from "$types";
import {
  computeBandIndexes,
  maxGroupDepth as computeMaxGroupDepth,
} from "$lib/banding";
import { niceDomain } from "$lib/scale-utils";
import { THEME_PRESETS, type ThemeName } from "$lib/theme-presets";
import { LAYOUT, TEXT_MEASUREMENT } from "$lib/rendering-constants";
import { computeAxisLayout, parseFontSize } from "$lib/typography-layout";

/**
 * True if any top-level column in the spec is a ColumnGroup (which would
 * push the header strip to a 2-row layout). Used by the layout engine
 * to size the header band based on whether content requires depth=2.
 */
function anyForestColumnGroups(columns: ColumnDef[] | undefined): boolean {
  if (!columns) return false;
  return columns.some(c => c.isGroup);
}
import { ops, type OpRecord } from "$lib/op-recorder";
import { createSourceSlice, type SourceTag } from "$stores/slices/source.svelte";
import { createCellsSlice } from "$stores/slices/cells.svelte";
import { createThemeSlice } from "$stores/slices/theme.svelte";
import { createAxisSlice } from "$stores/slices/axis.svelte";
import { createSortFilterSlice } from "$stores/slices/sort-filter.svelte";
import { createRowsGroupsSlice } from "$stores/slices/rows-groups.svelte";
import { createSemanticsSlice } from "$stores/slices/semantics.svelte";
import { createDragSlice } from "$stores/slices/drag.svelte";
import { createHistorySlice } from "$stores/slices/history.svelte";
import {
  createColumnsSlice,
  RESERVED_COLUMN_IDS as _RESERVED_COLUMN_IDS,
  mintUniqueId as _mintUniqueId,
} from "$stores/slices/columns.svelte";
import { createDataSlice } from "$stores/slices/data.svelte";

// Re-exports preserved for the existing public surface (tests import these
// from forestStore.svelte; the canonical home is now the columns slice).
export const RESERVED_COLUMN_IDS = _RESERVED_COLUMN_IDS;
export const mintUniqueId = _mintUniqueId;
import { createEventEmitter, type EventEmitter } from "$stores/slices/events";
import type { TabvizEvents } from "$spec/events";

// ====================================================================
// Op recorder contract
//
// Every mutation below that changes user-visible NON-theme state must
// push exactly one OpRecord to `opLog` using the helpers in
// `$lib/op-recorder`. Theme-side edits are rendered separately as a
// live snapshot via `generateThemeSource()` — do NOT log them here.
//
// Backtracking is deliberate: if a user resizes a column to 120 then
// back to 150, we record both calls in order. The "View source" panel
// shows the literal history; don't collapse or dedupe.
//
// Ephemeral UI state (sort / filter / select / hover / scroll / zoom-
// pan) is never recorded.
// ====================================================================

// Svelte 5 runes-based store
export function createForestStore() {
  // Core state
  let spec = $state<WebSpec | null>(null);

  // ── Source tagging for outbound Shiny events ────────────────────────────
  // Extracted to $stores/slices/source.svelte.ts as the Q8 spike (idiom (c),
  // "method-only split"). See docs/dev/store-decomposition-idiom.md for the
  // decision record. Call sites use `source.markSource(field)` /
  // `source.withSource('proxy', () => ...)` instead of the previous closure-
  // local helpers. Behaviour identical.
  const source = createSourceSlice();
  const markSource = source.markSource;
  const withSource = source.withSource;

  // ── History (op log + appendOp + coalesce) ──────────────────────────────
  // Phase 0c-C1 PR8 (micro-slice). Constructed early so every mutation slice
  // can take `history.appendOp` as a dep without forward-closure tricks.
  const history = createHistorySlice();
  // Local alias matching the pre-slice name; keeps existing call sites unchanged.
  const appendOp = history.appendOp;

  // ── Cell + label edits ──────────────────────────────────────────────────
  // Phase 0c-C1 PR1. Owns `cellEdits`, `labelEdits`, `wrapLineCounts`, and
  // `editingTarget`. Reads `allColumns` + `spec` via closure deps (forward
  // references — resolved at call time, not slice-construction time);
  // pushes ops via `appendOp` and source-tags via `markSource`. The
  // `allColumns` getter resolves to `columns.allColumns`, declared a few
  // lines below; wrapping it in an arrow-fn closure sidesteps the TDZ.
  const cells = createCellsSlice({
    getAllColumns: () => columns.allColumns,
    getSpec: () => spec,
    appendOp,
    markSource,
  });

  // ── Columns ─────────────────────────────────────────────────────────────
  // Phase 0c-C1 PR9. Owns columnWidths + userResizedIds + userInsertedColumns
  // + hiddenColumnIds + columnSpecOverrides + columnOrderOverrides, the
  // entire effective-column-tree derivation, the auto-width measurement, and
  // the runtime add/hide/configure/resize/reorder methods. Reads/writes
  // cells.wrapLineCounts via forward-closure deps so doMeasurement can
  // publish wrapped-line counts where the cells slice owns them.
  const columns = createColumnsSlice({
    getSpec: () => spec,
    getAxisZooms: () => axis.axisZooms,
    getWrapLineCounts: () => cells.wrapLineCounts,
    setWrapLineCounts: cells.setWrapLineCounts,
    appendOp,
    markSource,
  });

  // ── Theme management ────────────────────────────────────────────────────
  // Phase 0c-C1 PR2. Owns `themeEdits`, `themeOverrides`, `baseThemeName`,
  // `initialTheme`, `initialWatermark`. Calls into the columns slice for
  // post-edit re-measurement (density / theme / font edits invalidate
  // auto-widths).
  const theme = createThemeSlice({
    getSpec: () => spec,
    setSpec: (next) => { spec = next; },
    clearAutoWidthsKeepingUserResizes: columns.clearAutoWidthsKeepingUserResizes,
    measureAutoColumns: columns.measureAutoColumns,
    appendOp,
  });

  // ── Axis (cross-slice $derived spike) ────────────────────────────────────
  // Phase 0c-C1 PR3. Owns `axisZooms` and the global `axisComputation` +
  // `xScale` $derived blocks. Reads `forestColumns` from the columns slice
  // and `layout.forestWidth` (layout-zoom / main) via forward-closure
  // getters.
  const axis = createAxisSlice({
    getSpec: () => spec,
    getForestColumns: () => columns.forestColumns,
    getLayoutForestWidth: () => layout.forestWidth,
    markSource,
  });

  // ── Semantics (paint tool + per-row / per-cell semantic overrides) ──────
  // Phase 0c-C1 PR6. Constructed before sort-filter so its `styleEdits`
  // getter is in scope for the dep closure (sort-filter's `visibleRows`
  // $derived merges paint overrides BEFORE filter/sort).
  const semantics = createSemanticsSlice({
    getSpec: () => spec,
    appendOp,
    markSource,
  });

  // ── Drag micro-slice ────────────────────────────────────────────────────
  // Phase 0c-C1 PR7. Tiny — bounded drag state + 4 actions, no deps.
  const drag = createDragSlice();

  // ── Sort + filter ────────────────────────────────────────────────────────
  // Phase 0c-C1 PR4. Owns sortConfig, filters, filterPopoverTarget, and the
  // `visibleRows` $derived. Reads `styleEdits` from the semantics slice and
  // `allColumns` from the columns slice via forward closure.
  const sortFilter = createSortFilterSlice({
    getSpec: () => spec,
    getAllColumns: () => columns.allColumns,
    getStyleEdits: () => semantics.styleEdits,
    appendOp,
    markSource,
  });

  // ── Rows + groups ────────────────────────────────────────────────────────
  // Phase 0c-C1 PR5. Owns collapsedGroups, rowOrderOverrides, hover/tooltip
  // pointers, and the big fullDisplayRows + tooltipRow + maxGroupDepth +
  // groupMap + groupDepthMap derived blocks. Reads visibleRows from the
  // sort-filter slice (first slice-to-slice $derived chain) and displayRows
  // from the data slice (the next link in the same chain).
  const rowsGroups = createRowsGroupsSlice({
    getSpec: () => spec,
    getAllColumns: () => columns.allColumns,
    getVisibleRows: () => sortFilter.visibleRows,
    getDisplayRows: () => data.displayRows,
    getCellEdits: () => cells.cellEdits,
    appendOp,
    markSource,
  });

  // ── Data (pagination + banding + settings + watermark + target aspect) ───
  // Phase 0c-C1 PR10. Owns the pagination cursor + derived (totalPages,
  // isPaginated, currentPageRowIds, paginatedRows, displayRows), runtime
  // banding overrides + their effective derived, the settings panel
  // visibility flag, the pinned aspect ratio, and the watermark mutation
  // methods. Reads fullDisplayRows from the rows-groups slice via forward
  // closure (slice-to-slice $derived chain — paginatedRows depends on
  // upstream fullDisplayRows reactively).
  const data = createDataSlice({
    getSpec: () => spec,
    setSpec: (next) => { spec = next; },
    getFullDisplayRows: () => rowsGroups.fullDisplayRows,
    appendOp,
    markSource,
  });

  // Aliases for the columns slice's derived blocks + state. Many
  // references throughout this file read these by their flat names;
  // keeping the aliases avoids a wholesale `columns.X` rewrite.
  const effectiveColumnDefs = $derived(columns.effectiveColumnDefs);
  const allColumns = $derived(columns.allColumns);
  const allColumnDefs = $derived(columns.allColumnDefs);
  const primaryColumnId = $derived(columns.primaryColumnId);
  const forestColumns = $derived(columns.forestColumns);
  const hasExplicitForestColumns = $derived(columns.hasExplicitForestColumns);
  const vizColumns = $derived(columns.vizColumns);
  const hasVizColumns = $derived(columns.hasVizColumns);
  const columnWidths = $derived(columns.columnWidths);
  const userResizedIds = $derived(columns.userResizedIds);
  const userInsertedColumns = $derived(columns.userInsertedColumns);
  const hiddenColumnIds = $derived(columns.hiddenColumnIds);
  const columnSpecOverrides = $derived(columns.columnSpecOverrides);
  const columnOrderOverrides = $derived(columns.columnOrderOverrides);

  // Aliases for the data slice's state + derived. Most layout / event /
  // exportSpec code reads these by their flat names.
  const currentPage = $derived(data.currentPage);
  const continuousMode = $derived(data.continuousMode);
  const totalPages = $derived(data.totalPages);
  const isPaginated = $derived(data.isPaginated);
  const paginatedRows = $derived(data.paginatedRows);
  const displayRows = $derived(data.displayRows);
  const bandingOverride = $derived(data.bandingOverride);
  const bandingStartsWithBandOverride = $derived(data.bandingStartsWithBandOverride);
  const effectiveBanding = $derived(data.effectiveBanding);
  const bandingStartsWithBand = $derived(data.bandingStartsWithBand);
  const settingsOpen = $derived(data.settingsOpen);
  const targetAspect = $derived(data.targetAspect);

  // Initial dimensions (from htmlwidgets/splitStore, used as fallback before ResizeObserver fires)
  let initialWidth = $state(800);
  let initialHeight = $state(400);

  // Interaction state
  // Selection state. With the unified paint-as-selection model, the
  // "selected" rows ARE the rows currently painted with the active token.
  // We compute the live set from styleEdits + paintTool via the
  // selectedRowIds getter below; no separate state to keep in sync.
  // collapsedGroups + hoveredRowId + tooltipRowId + tooltipPosition +
  // rowOrderOverrides live on the rows-groups slice (Phase 0c-C1 PR5).
  // sortConfig + filters + filterPopoverTarget live on the sort-filter
  // slice (Phase 0c-C1 PR4). Read via `rowsGroups.X` / `sortFilter.X`.

  // bandingOverride / bandingStartsWithBandOverride / settingsOpen /
  // currentPage / continuousMode / targetAspect all live on the data slice
  // (Phase 0c-C1 PR10). Aliases declared below keep existing references in
  // this file unchanged.

  // ── Theme customizations ────────────────────────────────────────────────
  // themeEdits / themeOverrides / baseThemeName / initialTheme /
  // initialWatermark live on the theme slice (Phase 0c-C1 PR2). Read via
  // `theme.X` accessors below; mutate via the slice methods exposed
  // on the public API.

  // columnOrderOverrides / userInsertedColumns / hiddenColumnIds /
  // columnSpecOverrides / columnWidths / userResizedIds all live on the
  // columns slice (Phase 0c-C1 PR9). Read via `columns.X` accessors;
  // mutate via the slice methods exposed below on the public API.

  // Transient UI state for DnD / edit / filter overlays.
  // `editingTarget` moved to the cells slice in 0c-C1 PR1.
  // `filterPopoverTarget` moved to the sort-filter slice in 0c-C1 PR4.
  // `dragState` moved to the drag micro-slice in 0c-C1 PR7.

  // Tooltip state moved to rows-groups slice (Phase 0c-C1 PR5).

  // Plot width override (for resizing the forest plot area)
  let plotWidthOverride = $state<number | null>(null);

  // targetAspect lives on the data slice (Phase 0c-C1 PR10); alias below.

  // axisZooms lives on the axis slice (Phase 0c-C1 PR3). Read via
  // `axis.axisZooms`; mutate via `axis.setAxisZoom` / `axis.resetAxisZoom`.

  // Zoom & sizing state
  let zoom = $state<number>(1.0);           // User's desired zoom (0.5-2.0)
  let autoFit = $state<boolean>(true);      // Shrink if content exceeds container
  let maxWidth = $state<number | null>(null);   // Optional container max-width
  let maxHeight = $state<number | null>(null);  // Optional container max-height
  let showZoomControls = $state<boolean>(true);

  // Container dimensions (set by ForestPlot component via ResizeObserver)
  let containerWidth = $state<number>(0);
  let containerHeight = $state<number>(0);
  let scalableNaturalWidth = $state<number>(0);
  let scalableNaturalHeight = $state<number>(0);
  let containerElementId = $state<string | null>(null);

  // Effective dimensions: prefer measured containerWidth, fall back to initial
  // This unifies the two dimension systems - layout always uses the effective value
  const effectiveWidth = $derived(containerWidth > 0 ? containerWidth : initialWidth);
  const effectiveHeight = $derived(containerHeight > 0 ? containerHeight : initialHeight);

  // `visibleRows` $derived lives on the sort-filter slice (Phase 0c-C1 PR4).
  // Local alias keeps existing call sites (displayRows, etc.) unchanged.
  const visibleRows = $derived(sortFilter.visibleRows);

  // `axisComputation` and `xScale` $derived blocks live on the axis slice
  // (Phase 0c-C1 PR3). Read here via `axis.axisComputation` / `axis.xScale`.
  // Local aliases keep the existing call sites in this file unchanged.
  const axisComputation = $derived(axis.axisComputation);
  const xScale = $derived(axis.xScale);

  // Column tree + edits / measurement / methods all live on the columns
  // slice (Phase 0c-C1 PR9). Aliases for the slice's derived blocks were
  // declared above next to the slice instantiation so existing references
  // in this file continue to read `allColumns` / `forestColumns` etc.
  // unchanged.

  // ============================================================================

  // Group lookup maps + fullDisplayRows + maxGroupDepth + tooltipRow live
  // on the rows-groups slice (Phase 0c-C1 PR5). Local aliases keep the
  // existing call sites in this file unchanged.
  const groupMap = $derived(rowsGroups.groupMap);
  const groupDepthMap = $derived(rowsGroups.groupDepthMap);

  // getRowDepth / isAncestorCollapsed helpers + the full fullDisplayRows
  // derived live inside the rows-groups slice (Phase 0c-C1 PR5). One-line
  // alias keeps consumers (paginatedRows, displayRows derived, etc.)
  // pointed at the slice.
  const fullDisplayRows = $derived<DisplayRow[]>(rowsGroups.fullDisplayRows);

  // Pagination derived (totalPages, isPaginated, currentPageRowIds,
  // paginatedRows, displayRows) + actions (setCurrentPage / nextPage /
  // prevPage / setContinuousMode) all live on the data slice (Phase 0c-C1
  // PR10). Aliases above keep this file's references unchanged.

  // Maximum group depth moved to the rows-groups slice (Phase 0c-C1 PR5).
  const maxGroupDepth = $derived(rowsGroups.maxGroupDepth);

  // effectiveBanding + bandingStartsWithBand derived live on the data slice
  // (Phase 0c-C1 PR10). Aliases above keep call sites unchanged.

  // Derived: per-display-row band index (0 | 1 | null). Null = no banding
  // class on that row. See computeBandIndexes() for semantics.
  const bandIndexes = $derived.by((): (0 | 1 | null)[] => {
    return computeBandIndexes(
      displayRows,
      effectiveBanding,
      spec?.data.groups,
      bandingStartsWithBand,
    );
  });

  // Derived: per-displayRow flag — true when the row is a non-spacer
  // data row that immediately precedes a top-level group_header.
  // Drives the `.row-padded-after` CSS class (the rowGroupPadding
  // separator lives as bottom padding on the previous row, not as
  // empty space inside the group_header track — keeps group_header
  // styling consistent and avoids the heading's bg tint bleeding into
  // the separator strip). Also drives the SVG track inflation and
  // anchors the rowGroupPadding drag handle.
  const rowPaddedAfter = $derived.by((): boolean[] => {
    const out: boolean[] = new Array(displayRows.length).fill(false);
    for (let i = 0; i < displayRows.length; i++) {
      const dr = displayRows[i];
      if (dr.type !== "group_header" || dr.depth !== 0) continue;
      // Walk back to the nearest non-spacer data row; that's the row
      // whose bottom owns the separator strip.
      for (let j = i - 1; j >= 0; j--) {
        const prev = displayRows[j];
        if (prev.type === "data" && prev.row.style?.type !== "spacer") {
          out[j] = true;
          break;
        }
      }
    }
    return out;
  });

  // Derived: computed layout
  const layout = $derived.by((): ComputedLayout => {
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
      };
    }

    // Natural rowHeight from the theme; the targetAspect lever ladder may
    // scale it below to absorb the height delta when an aspect target is
    // pinned. Width-side absorption happens via forestWidth further down.
    const naturalRowHeight = spec.theme.spacing.rowHeight;
    let rowHeight = naturalRowHeight;
    // Header height auto-grows when the configured value can't fit the
    // font's text region across the (possibly multi-tier) header. Several
    // shipped theme presets default to 24-30 px, which leaves zero
    // breathing room for default 14 px headers — and goes negative when
    // column groups split the band into two 12-15 px sub-tracks. The min
    // = (font height + 6 px breathing) × headerDepth ensures multi-tier
    // headers never visually clip regardless of the theme.
    const lineHeight = 1.5;
    const headerFontSize = parseFontSize(spec.theme.text.body.size);
    const headerScale = 1.05;
    const minHeaderRowHeight = Math.ceil(headerFontSize * headerScale * lineHeight) + 6;
    const headerDepthForLayout = anyForestColumnGroups(spec.columns) ? 2 : 1;
    const headerHeight = Math.max(
      spec.theme.spacing.headerHeight,
      minHeaderRowHeight * headerDepthForLayout,
    );
    const axisGap = spec.theme.spacing.axisGap ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP; // Gap between table and axis
    // Axis region size derived from typography. Replaces the old
    // `LAYOUT.AXIS_HEIGHT (32) + LAYOUT.AXIS_LABEL_HEIGHT (32) = 64`
    // hardcoded total — that was conservative for the default font and
    // over-reserved for everyone else. `someColumnHasAxisLabel` mirrors
    // svg-generator's same check so both paths agree on whether the
    // axis-label band is present.
    const someColumnHasAxisLabel = forestColumns.some(
      fc => !!fc.column.options?.forest?.axisLabel,
    );
    const axisGeom = computeAxisLayout(
      { fontSizeSm: spec.theme.text.label.size, lineHeight: 1.5 },
      someColumnHasAxisLabel,
      spec.theme.plot.tickMarkLength,
    );
    const axisHeight = axisGap + axisGeom.axisRegionHeight;
    const hasForest = forestColumns.length > 0;
    // Use override if set, otherwise calculate default (25% of width, min 200px)
    // Forest column width precedence (v0.25.0): runtime drag override
    // > theme.layout.plotWidth (numeric) > auto (25% of width, min 200).
    // Honouring the theme value lets the Layout settings field actually
    // drive the live render — historically only SVG export read it.
    const themePlotWidth = spec.theme.layout?.plotWidth;
    let forestWidth = hasForest
      ? (plotWidthOverride
        ?? (typeof themePlotWidth === "number" ? themePlotWidth : Math.max(effectiveWidth * 0.25, 200)))
      : 0;

    // ═══════════════════════════════════════════════════════════════════
    // Aspect ladder — reshape the layout to hit a target aspect ratio
    // ═══════════════════════════════════════════════════════════════════
    //
    // When `targetAspect` is pinned (via set_aspect_ratio() or the
    // in-widget slider), reshape the layout to hit `width / height ==
    // targetAspect`. Live-widget version mirrors the static-export math
    // in svg-generator.ts's `generateSVGForAspectTarget`; both sides MUST
    // stay in lock-step so the downloaded SVG matches the live view.
    //
    // Anchor model (anchor in {"width", "height", "auto"}):
    //   - "width":  preserve natural width, grow / shrink height
    //   - "height": preserve natural height, grow / shrink width — may
    //              expand `layoutWidth` past the canvas (see layoutWidth
    //              note below)
    //   - "auto":   pick the dim that yields the smaller delta from
    //              natural; falls through to "height" for wide targets
    //              and "width" for tall ones.
    //
    // Three width stages (only fire when targetAspect changes width):
    //   1. Forest absorption: when a forest column is present, it flexes
    //      to absorb width delta up to FLEX_CAP × natural (= 2× by
    //      default). Within the cap this is the only width change.
    //   2. Non-forest column scale: when stage 1 saturates (delta exceeds
    //      what flex can absorb), the residual width spreads across non-
    //      flex columns via `aspectNonForestScale`. Floored at 0.25 so
    //      narrow targets don't collapse columns to zero. Without this
    //      stage, slider drags past forest's cap would be inert.
    //   3. Layout overflow: when anchor="height" or "auto" wants a width
    //      greater than the canvas, `layoutWidth` lifts past the canvas
    //      cap (capped at 8× canvas for sanity). The container's existing
    //      auto-fit / scroll machinery handles the visual fit; the wire
    //      width matches the requested aspect exactly. anchor="width"
    //      paths never trigger this stage.
    //
    // Height ladder (direction-aware): when height delta is nonzero,
    //   - Taller targets: split delta into chrome share (CHROME_SHARE =
    //     0.35, applied to header + axis via `chromeScale`) and row
    //     share (applied to rowHeight). Padding stays unscaled to keep
    //     horizontal layout stable.
    //   - Shorter targets: shrink rowHeight first, floored at
    //     MIN_ROW_HEIGHT for legibility. When the floor saturates, chrome
    //     shrinks to absorb the residual (floored at 0.4 so axis labels
    //     stay readable).
    //
    // Tabular (no-forest) tables also get height handling. Stage 1 is a
    // no-op without a forest column, but stages 2-3 + the height ladder
    // still run.
    //
    // The variables below carry stage outputs into the rest of the
    // layout derivation; descriptive names track the algorithm above.

    // Stage 2 output — non-forest column scale factor. Default 1 (no
    // change). When stage 1 saturates, the residual width is spread
    // across non-flex columns via this multiplier so the slider keeps
    // producing visible change past the flex cap.
    let aspectNonForestScale = 1;
    let chromeScale = 1;
    let aspectTargetWidth: number | null = null;
    let aspectTargetHeight: number | null = null;
    let layoutWidth = effectiveWidth;
    if (targetAspect != null) {
      const FLEX_CAP = 2;
      const naturalForestWidth = forestWidth;
      // Effective row-slot count for the height budget: data rows
      // contribute 1 slot each (spacers are absorbed at half their
      // weight but with rowHeight ≥ MIN_ROW_HEIGHT they round close
      // enough), plus 1.5 slots for the overall-summary row when
      // present (mirrors the `hasOverall ? rowHeight * 1.5 : 0`
      // term in plotHeight below). Without this, the lever ladder
      // budgets for `displayRows.length` slots but the renderer
      // pours rowDelta into `length + 1.5` slots — overshooting
      // totalHeight by `overall * 1.5 / length` of the requested
      // height delta.
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

      // Resolve target dims from anchor. anchor="auto" picks "height"
      // for wide targets (where preserving natural-h grows w) and "width"
      // for tall targets (where preserving natural-w grows h). The
      // layout-overflow stage (3) handles target_w > canvas when needed.
      const rawAnchor = spec.targetAspectAnchor ?? "width";
      const resolvedAnchor: "width" | "height" =
        rawAnchor === "auto"
          ? (targetAspect >= naturalAspect ? "height" : "width")
          : rawAnchor;
      let targetWidth: number;
      let targetHeight: number;
      if (resolvedAnchor === "height") {
        // Anchor=height: preserve natural rowHeight by growing width.
        // Stage 3 fires when targetWidth > canvas — `layoutWidth` lifts
        // past the canvas cap so the grid renders at the requested width
        // and the container's auto-fit / scroll handles the visual fit.
        //
        // Hard cap: layoutWidth never exceeds 8× canvas. The TARGET_
        // ASPECT_MAX = 10 setter clamp keeps `targetAspect` finite, but
        // even ratio = 10 on a tall spec could blow up rendered DOM size;
        // 8× canvas is the practical visible / scrollable cap (auto-fit's
        // min-zoom 0.7 means anything past ~1.4× already overflows).
        const MAX_LAYOUT_WIDTH = approxNaturalWidth * 8;
        targetHeight = approxNaturalHeight;
        targetWidth = Math.min(approxNaturalHeight * targetAspect, MAX_LAYOUT_WIDTH);
        if (targetWidth > approxNaturalWidth) {
          layoutWidth = targetWidth;
        }
      } else {
        // Anchor width: canvas dictates; height falls out of the ratio.
        targetWidth = approxNaturalWidth;
        targetHeight = targetWidth / targetAspect;
      }
      aspectTargetWidth = targetWidth;
      aspectTargetHeight = targetHeight;

      // ── Stage 1 — Forest absorption (cap-clamped flex). ──────────
      // Forest column flexes to absorb width delta up to FLEX_CAP×
      // natural. Within the cap, it's the only width stage that fires.
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

      // ── Stage 2 — Non-forest column scale. ───────────────────────
      // When stage 1 saturates and there's residual width to absorb,
      // scale all non-flex columns proportionally. Without this stage,
      // slider drags past forest's 2× cap would be inert.
      //
      // Denominator nuance: the actual sum of measured non-flex column
      // widths, NOT `approxNaturalWidth - naturalForestWidth`. The
      // latter folds in chrome (padding), which makes the scale factor
      // too small — columns grow by less than the residual, leaving
      // "ghost width" claimed by `layoutWidth` but never allocated to
      // any rendered element. The downloaded SVG then has wrong w/h.
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

      // ── Height ladder (direction-aware). ─────────────────────────
      // Mirrors `generateSVGForAspectTarget` in svg-generator.ts so the
      // live widget and downloaded SVG agree pixel-for-pixel.
      //   - Taller targets: split heightDelta into chrome share
      //     (CHROME_SHARE = 0.35) and row share. Chrome scaling is
      //     applied via chromeScale to headerHeight + axisHeight below.
      //   - Shorter targets: shrink rowHeight first, floored at
      //     MIN_ROW_HEIGHT for legibility. When the floor saturates,
      //     chrome shrinks to absorb residual (floored at 0.4 so axis
      //     labels stay readable).
      // Padding (spec.theme.spacing.padding) is intentionally NOT
      // scaled — keeps horizontal layout stable. Tradeoff: a few px of
      // slop vs the exact target, far smaller than the systematic ~30%
      // shortfall this offsets.
      const heightDelta = targetHeight - approxNaturalHeight;
      const bodyFontSize = parseFontSize(spec.theme.text.body.size);
      const MIN_ROW_HEIGHT = Math.max(14, Math.round(bodyFontSize * 1.4) + 4);
      const naturalChromeHeight = approxChromeHeight;
      const naturalPlotHeight = approxRowsHeight;
      // chromeScale denominator is the *scalable* subset of natural
      // chrome — `headerHeight + axisHeight`, NOT
      // `naturalChromeHeight` (which also folds in `padding * 2`,
      // intentionally unscaled to keep width stable). Using the
      // full chrome as denominator under-delivered by
      // `padding * 2 * chromeDelta / naturalChromeHeight` (a few %
      // at extreme ratios). Mirrors the same fix in
      // svg-generator.ts so live + static stay in lock-step.
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
    // Apply chromeScale: scale chrome by the height ladder's output. The
    // unscaled `headerHeight` / `axisHeight` declared above stay the
    // natural baseline (used by stableNaturalChromeHeight below); the
    // scaled values are what every consumer sees via `layout`.
    const scaledHeaderHeight = headerHeight * chromeScale;
    const scaledAxisHeight = axisHeight * chromeScale;

    const tableWidth = layoutWidth - forestWidth;

    const hasOverall = !!spec.data.overall;

    // Calculate actual heights for each row. Group-header rows pick up the
    // themed `rowGroupPadding` (symmetric top/bottom via `.grid-cell.group-row`
    // CSS rule) so the overlay / axis Y positions land on the same row
    // edges the DOM actually renders. Spacer rows stay half-height.
    const rowGroupPadding = spec.theme.spacing.rowGroupPadding ?? 0;
    const dataLineHeightPx = Math.ceil(parseFontSize(spec.theme.text.body.size) * lineHeight);
    const rowHeights: number[] = [];
    // rowGroupPadding (v0.24.1+) lives as bottom margin on the LAST
    // data row of the previous top-level group, not as a top strip
    // inside the new group_header. Cleaner styling: group_header tracks
    // stay at rowHeight, and the heading's themed bg / borders don't
    // bleed into the separator. The data row's track inflates; the cell
    // uses padding-bottom to anchor content at the original visible
    // band (rowGroupPadding of empty space sits below it).
    for (let i = 0; i < displayRows.length; i++) {
      const displayRow = displayRows[i];
      let h: number;
      if (displayRow.type === "data" && displayRow.row.style?.type === "spacer") {
        h = rowHeight / 2;
      } else if (displayRow.type === "group_header") {
        h = rowHeight;
      } else if (displayRow.type === "data") {
        const lines = cells.wrapLineCounts[displayRow.row.id] ?? 1;
        h = lines > 1 ? Math.max(rowHeight, dataLineHeightPx * lines + 6) : rowHeight;
      } else {
        h = rowHeight;
      }
      if (rowPaddedAfter[i]) h += rowGroupPadding;
      rowHeights.push(h);
    }

    // Calculate cumulative Y positions for each row
    const rowPositions: number[] = [];
    let cumulativeY = 0;
    for (const h of rowHeights) {
      rowPositions.push(cumulativeY);
      cumulativeY += h;
    }

    // Plot height: sum of all row heights + space for overall summary
    const plotHeight = cumulativeY + (hasOverall ? rowHeight * 1.5 : 0);

    // Get nullValue from first forest column options
    const firstForest = forestColumns[0]?.column;
    const forestOptions = firstForest?.options?.forest;
    const scale = forestOptions?.scale ?? "linear";
    const nullValue = forestOptions?.nullValue ?? (scale === "log" ? 1 : 0);

    // Stable natural aspect — pre-mutation approximation. Used by the
    // in-widget slider as the *fixed* baseline so the slider's value ↔
    // ratio mapping doesn't drift as the aspect ladder reshapes the
    // layout. naturalRowHeight, displayRows.length, and the chrome
    // estimate are all pre-mutation values; effectiveWidth (canvas)
    // doesn't depend on targetAspect.
    const stableNaturalRowsHeight = displayRows.length * naturalRowHeight;
    const stableNaturalChromeHeight =
      headerHeight + axisHeight + spec.theme.spacing.padding * 2;
    const stableNaturalHeight = stableNaturalRowsHeight + stableNaturalChromeHeight;
    const stableNaturalAspect = stableNaturalHeight > 0
      ? effectiveWidth / stableNaturalHeight
      : 1;

    return {
      totalWidth: layoutWidth,
      totalHeight: Math.max(effectiveHeight, plotHeight + scaledHeaderHeight + scaledAxisHeight + spec.theme.spacing.padding * 2),
      tableWidth,
      forestWidth,
      // Stage 2 output — non-flex column scale factor. Multiply
      // measured column widths by this in the renderer's
      // gridTemplateColumns / getColWidth so wider aspect ratios stay
      // monotonic past the flex cap. 1 by default = no change.
      aspectNonForestScale,
      // Height-ladder output — chrome scale factor. Already pre-applied
      // to the headerHeight / axisHeight emitted below; exposed so the
      // export path can sanity-check parity.
      chromeScale,
      // Exact aspect-target dimensions when targetAspect is pinned.
      // getExportDimensions() routes through these so downloads honour
      // the requested aspect exactly.
      aspectTargetWidth,
      aspectTargetHeight,
      // Stable natural aspect — fixed reference point for the slider
      // regardless of current targetAspect.
      naturalAspect: stableNaturalAspect,
      headerHeight: scaledHeaderHeight,
      rowHeight,
      plotHeight,
      axisHeight: scaledAxisHeight,
      // Font-derived axisRegion size — exposed so the export path
      // can back out a spec axisGap value that recomputes to the
      // live `axisHeight` (= axisGap + axisRegionHeight) after the
      // renderer re-derives axisRegionHeight from the same theme.
      axisRegionHeight: axisGeom.axisRegionHeight,
      nullValue,
      summaryYPosition: plotHeight - rowHeight,
      showOverallSummary: hasOverall,
      rowPositions,
      rowHeights,
    };
  });

  // Derived: natural content width (intrinsic width based on column specs and current layout)
  // Used for fill mode scaling calculations and SVG export
  // NOTE: This now uses layout.forestWidth for WYSIWYG export accuracy
  const naturalContentWidth = $derived.by((): number => {
    if (!spec) return 800;

    const DEFAULT_COLUMN_WIDTH = 100;

    // Calculate sum of all column widths (excluding forest columns
    // which have separate width). Apply Stage-2 aspectNonForestScale
    // to non-flex columns unless the user has manually resized — keeps
    // this aggregate in sync with `gridTemplateColumns` and
    // `getExportDimensions` so the SVG export's at-least-width path
    // doesn't see a sub-content-width "natural" floor.
    const aspectScale = layout.aspectNonForestScale ?? 1;
    let totalColumnWidth = 0;
    for (const col of allColumns) {
      // Skip forest columns - they have their own width calculation
      if (col.type === "forest") continue;
      // Use computed width if available, otherwise spec width, otherwise default
      const userResized = userResizedIds.has(col.id);
      const base = (columnWidths[col.id]
        ?? (typeof col.width === 'number' ? col.width : null)
        ?? DEFAULT_COLUMN_WIDTH);
      const scaled = (userResized || Math.abs(aspectScale - 1) < 1e-6)
        ? base : base * aspectScale;
      totalColumnWidth += scaled;
    }

    // Use layout.forestWidth for consistent WYSIWYG export
    // This ensures SVG total width matches what user sees on screen
    const forestWidth = layout.forestWidth;

    // Add padding
    const padding = spec.theme.spacing.padding * 2;

    return totalColumnWidth + forestWidth + padding;
  });

  // Derived: fit scale — how much we'd need to shrink to fit the
  // container width. Vertical overflow always scrolls naturally;
  // applying heightFit when aspect was pinned (the prior behaviour)
  // made the slider feel awful — the whole widget CSS-scaled smaller
  // as the user dragged narrower, then snapped back when the slider
  // was released. Width-only fit + vertical scroll is the symmetric,
  // smooth model.
  const fitScale = $derived.by((): number => {
    if (containerWidth <= 0 || scalableNaturalWidth <= 0) return 1;
    const contentWidth = scalableNaturalWidth * zoom;
    return contentWidth > containerWidth
      ? containerWidth / contentWidth
      : 1;
  });

  // Derived: actual rendered scale = zoom × fitScale (when autoFit) or just zoom.
  //
  // When an aspect target is pinned AND auto-fit is on, drop the
  // min-zoom floor so content seamlessly resizes to fit the canvas —
  // that's the core promise of auto-fit. The user's "font size
  // relative to width decreases" intent is met by content shrinking;
  // shrinking below readability is the price of an aspect target the
  // canvas can't honour at native size, and is a deliberate user
  // choice. The hard floor of 0.05 prevents complete invisibility on
  // pathological extremes.
  //
  // Without aspect pin, the original 0.5 floor stays — protects
  // unintentional shrinkage under tight container constraints (e.g.
  // mobile RStudio viewer).
  const minZoomFloor = $derived(
    targetAspect != null ? (autoFit ? 0.05 : 0.5) : 0.5
  );
  const actualScale = $derived(
    autoFit ? Math.max(minZoomFloor, zoom * fitScale) : Math.max(minZoomFloor, Math.min(2.0, zoom))
  );

  // Derived: is auto-fit currently clamping the zoom?
  const isClamped = $derived(autoFit && fitScale < 1);

  // Actions
  function setSpec(newSpec: WebSpec) {
    // Create a new object reference to ensure derived values recompute properly
    // when switching between specs (e.g., in split forest navigation)
    spec = { ...newSpec };
    // rows-groups slice owns collapsedGroups / rowOrderOverrides / hover /
    // tooltip pointers. reset() wipes them; collapsed-by-default group ids
    // are seeded from the new spec below.
    rowsGroups.reset();
    for (const g of newSpec.data.groups) {
      if (g.collapsed) rowsGroups.toggleGroup(g.id, true);
    }
    // A fresh spec supersedes any prior interactive column edits. The
    // columns slice owns the full per-column-id state surface (widths,
    // user-resized flags, hides, inserts, configures, reorder); hydrate
    // wipes all of them in one call. axisZooms is owned by the axis slice
    // and reset separately.
    columns.hydrateForSpec();
    axis.reset();
    // Cell + label edits + editingTarget + wrapLineCounts all reset
    // via the cells slice.
    cells.reset();
    // UI-ephemeral state that's anchored to row / column ids in the
    // PREVIOUS spec — clear it so a split-by navigation (or any
    // setSpec swap) doesn't flash a tooltip pointing at a row that
    // no longer exists, or open a filter popover anchored to a
    // missing column.  hover / tooltip pointers cleared via
    // rowsGroups.reset() above.
    // sort-filter slice owns sortConfig / filters / filterPopoverTarget;
    // closing the popover and clearing stale filters anchored to columns
    // in the previous spec matches both the prior setSpec behavior (which
    // explicitly cleared `filterPopoverTarget`) and the resetState pattern.
    sortFilter.reset();
    drag.reset();
    // Reset the op log too — a new spec is a new "session" as far as
    // recording fluent R calls is concerned.
    history.reset();
    // Pagination cursor + targetAspect seeding live on the data slice;
    // hydrateForSpec resets currentPage to 1 and seeds targetAspect from
    // newSpec.targetAspect. Continuous-mode toggle stays as a viewer
    // preference.
    data.hydrateForSpec(newSpec);
    // Theme reset target + baseThemeName + edit tracking: the theme slice
    // owns initialTheme / initialWatermark too, so a single captureInitial
    // call handles all five fields. Settings panel's "View source" feature
    // emits `web_theme_<baseThemeName>() |> ...` off the same baseThemeName
    // the slice records here.
    theme.captureInitial(newSpec);

    // Coerce banding default to "row" when the data has no groups. The R
    // default is "group" (deepest-level alternation), but on group-less data
    // "group" silently falls back to row-level inside computeBandIndexes —
    // which left the settings panel showing "Group" as the active mode while
    // the actual rendering was row-level. Make the coercion explicit at init
    // so UI and rendering agree. Immutable update so we don't mutate the
    // caller's incoming spec object.
    if (spec.data.groups.length === 0) {
      const b = spec.theme?.layout?.banding;
      if (b && typeof b === "object" && b.mode === "group") {
        spec = {
          ...spec,
          theme: {
            ...spec.theme,
            layout: {
              ...spec.theme.layout,
              banding: { mode: "row", level: null },
            },
          },
        };
      }
    }

    // Snapshot the post-coercion theme as the reset target. captureInitial
    // (called again to refresh after the coercion above) deep-clones via
    // JSON round-trip — see theme slice's cloneTheme for why not
    // structuredClone. baseThemeName + edit-tracking reset is idempotent.
    theme.captureInitial(spec);

    // Measure auto-width columns
    columns.measureAutoColumns();
  }

  function setDimensions(w: number, h: number) {
    // Set initial dimensions (used as fallback before ResizeObserver fires)
    initialWidth = w;
    initialHeight = h;
  }

  // setSelectedRows + paintRowWithActiveToken + paintCellWithActiveToken
  // live on the semantics slice (Phase 0c-C1 PR6).

  // toggleGroup lives on the rows-groups slice (Phase 0c-C1 PR5).

  // Settings panel + banding override actions live on the data slice
  // (Phase 0c-C1 PR10). Passthrough on the return block below.

  // Sort + filter methods live on the sort-filter slice (Phase 0c-C1 PR4).
  // Public-API passthrough below.

  // =========================================================================
  // DnD scope helpers + interactive column actions
  // =========================================================================
  //
  // findColumnScope / siblingsForColumnScope / moveColumnItem /
  // clearColumnReorder / mintUniqueColumnId / insertColumn / hideColumn /
  // updateColumn / updateColumnPatch / clearColumnEdits / setColumnWidth /
  // previewColumnWidth / getColumnWidth all live on the columns slice
  // (Phase 0c-C1 PR9). Public-API passthrough on the return block below.
  //
  // Row-scope helpers (findRowGroupScope / siblingsForRow*) +
  // moveRowItem / moveRowGroupItem / clearRowReorder live on the
  // rows-groups slice (Phase 0c-C1 PR5).
  // beginDrag / updateDrag / endDrag / cancelDrag live on the drag
  // micro-slice (Phase 0c-C1 PR7).

  // =========================================================================
  // Edit actions
  // =========================================================================

  // Cell + label edit actions live on the `cells` slice (Phase 0c-C1 PR1).
  // Public API re-exports them via `cells.X` passthrough below.
  //
  // clearAllEdits + semantics methods all live on slices.
  // clearAllEdits is now the one-line orchestrator the cells / semantics
  // extraction always pointed at — the moment finally arrives.
  function clearAllEdits() {
    cells.reset();
    semantics.clearAllPaint();
  }

  // Paint-tool actions, setPaintTool, setPaintHoverCellField,
  // setRowSemantic / setCellSemantic, clearSemantic / clearCellSemantic,
  // getRowSemantic / getCellSemantic, clearAllPaint, hasPaintEdits — all
  // live on the semantics slice (Phase 0c-C1 PR6).

  // Filter-popover plumbing moved to the sort-filter slice (Phase 0c-C1 PR4).

  // setHovered + setTooltip live on the rows-groups slice (Phase 0c-C1 PR5).

  function setPlotWidth(newWidth: number | null) {
    plotWidthOverride = newWidth === null ? null : Math.max(100, newWidth); // min 100px
    markSource("plot_width");
  }

  function getPlotWidth(): number | null {
    return plotWidthOverride;
  }

  // Aspect-ratio target + setTargetAspectAnchor + setWatermark family all
  // live on the data slice (Phase 0c-C1 PR10). Public-API passthrough on
  // the return block below.

  // -- Per-column axis pan/zoom ------------------------------------------------
  // Methods live on the axis slice (Phase 0c-C1 PR3); public-API passthrough below.

  // Theme management methods moved to the theme slice (Phase 0c-C1 PR2).
  // `clearAutoWidthsKeepingUserResizes` (called by the theme slice via dep)
  // now lives on the columns slice (Phase 0c-C1 PR9).

  // `setSemanticField` removed in Phase 0b (orphan; no callers). The
  // setThemeField path covers the same edits via a generic path-based
  // API.

  // resetThemeEdits / captureThemeSnapshot / applyThemeSnapshot all live
  // on the theme slice (Phase 0c-C1 PR2). Public-API passthrough below.

  // ============================================================================
  // Zoom & Auto-fit Controls
  // ============================================================================

  function setZoom(value: number) {
    zoom = Math.max(0.5, Math.min(2.0, value));
    persistZoomState();
    markSource("zoom");
  }

  function resetZoom() {
    zoom = 1.0;
    persistZoomState();
    markSource("zoom");
  }

  function zoomIn() {
    setZoom(zoom * 1.1);
  }

  function zoomOut() {
    setZoom(zoom / 1.1);
  }

  function setAutoFit(value: boolean) {
    autoFit = value;
    persistZoomState();
    markSource("zoom");
  }

  function fitToWidth() {
    if (!containerWidth || !scalableNaturalWidth) return;
    // Set zoom so content width matches container width
    // Note: containerWidth from ResizeObserver is already the content box (excludes padding)
    zoom = Math.min(2.0, Math.max(0.5, containerWidth / scalableNaturalWidth));
    persistZoomState();
    markSource("zoom");
  }

  function setMaxWidth(value: number | null) {
    maxWidth = value;
    persistZoomState();
    markSource("zoom");
  }

  function setMaxHeight(value: number | null) {
    maxHeight = value;
    persistZoomState();
    markSource("zoom");
  }

  function setShowZoomControls(show: boolean) {
    showZoomControls = show;
    markSource("zoom");
  }

  // Container dimension setters (called by ForestPlot component)
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
    // Load persisted state when container ID is set
    if (id) {
      loadZoomState();
    }
  }

  // ============================================================================
  // Zoom State Persistence (localStorage)
  // ============================================================================

  function getStorageKey(): string | null {
    if (!containerElementId) return null;
    return `tabviz_zoom_${containerElementId}`;
  }

  function persistZoomState() {
    const key = getStorageKey();
    if (!key) return;

    try {
      const state: ZoomState = {
        zoom,
        autoFit,
        maxWidth,
        maxHeight,
        version: 2,  // New version for new schema
      };
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // localStorage unavailable or full - silently ignore
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
        // Note: version 1 (old format) is silently ignored - users get fresh defaults
      }
    } catch {
      // Invalid stored state - silently ignore
    }
  }

  /**
   * Reset all user-modified runtime state to the widget's initial defaults.
   *
   * Contract: after this runs, the widget should look and export IDENTICALLY
   * to a fresh mount on the same spec — no layout shift, no stale widths.
   *
   * Policy:
   *   - RESETS all user-runtime state: selection, collapse, sort/filter, row
   *     and column reorder, cell edits, inserted/hidden/overridden columns,
   *     column widths, zoom/sizing, axis zooms, theme edits, banding overrides,
   *     and transient UI overlays (drag/edit/filter popovers).
   *   - RESTORES spec.theme to the current preset (drops any in-panel edits).
   *   - RE-MEASURES auto-width columns. Crucial: clearing columnWidths alone
   *     makes the renderer fall through to DEFAULT_COLUMN_WIDTH (100), which
   *     subtly changes the layout vs. the fresh-mount state and contaminates
   *     SVG export (getExportDimensions reads columnWidths too).
   *   - KEEPS spec data, showZoomControls (a user preference), container
   *     dimensions (from ResizeObserver), and the settings panel's open
   *     state (reset may fire from inside the panel).
   */
  function resetState() {
    // ── User selection / collapse / sort / filter ────────────────────────
    // Selection IS painted-row state — clearing it means clearing all
    // paint applied via the active token (and any other tokens in
    // styleEdits). semantics.clearAllPaint() handles that.
    semantics.clearAllPaint();
    // rows-groups slice owns collapsedGroups / rowOrderOverrides /
    // hover / tooltip; reset() clears all four.
    rowsGroups.reset();
    sortFilter.reset();

    // ── Row & column reorder / inserts / hides / cell edits ──────────────
    // Columns slice owns the full per-column-id state surface (widths,
    // user-resized flags, hides, inserts, configures, reorder); reset()
    // wipes them all.
    columns.reset();
    cells.reset();
    semantics.reset();
    history.reset();

    // ── Widths / zoom / sizing ───────────────────────────────────────────
    plotWidthOverride = null;
    zoom = 1.0;
    autoFit = true;
    maxWidth = null;
    maxHeight = null;
    axis.reset();

    // ── Theme customizations (in-panel edits / banding overrides) ────────
    // theme.reset() wipes themeEdits + themeOverrides without touching the
    // initial-* snapshot (so resetThemeEdits below still has its target).
    // data.reset() clears the runtime banding overrides (pagination cursor
    // stays — matches pre-extraction behaviour).
    theme.reset();
    data.reset();

    // ── Transient UI overlays ────────────────────────────────────────────
    // hover + tooltip cleared via rowsGroups.reset(); popover via
    // sortFilter.reset(); drag via drag.reset() — all already called above.
    drag.reset();

    // ── Restore theme + watermark from the initial snapshot ──────────────
    // theme.resetThemeEdits restores both spec.theme and spec.watermark to
    // the caller-supplied values (NOT bare THEME_PRESETS[baseThemeName],
    // which would silently drop any pre-customization the caller baked in
    // via `web_theme_*() |> set_spacing(...)`).
    theme.resetThemeEdits();

    // ── Re-measure auto-width columns ─────────────────────────────────────
    // Without this, columnWidths stays empty and the renderer falls through
    // to DEFAULT_COLUMN_WIDTH, producing the "subtle layout shift" + SVG
    // export artifacts.
    columns.measureAutoColumns();
  }

  // tooltipRow lives on the rows-groups slice (Phase 0c-C1 PR5).
  const tooltipRow = $derived(rowsGroups.tooltipRow);

  // Derived: exportSpec — WYSIWYG spec reflecting the user's current view state.
  // Both the interactive renderer and the SVG/PNG export consume this (via different paths),
  // keeping them in lock-step by construction. See the interactivity plan for details.
  const exportSpec = $derived.by((): WebSpec | null => {
    if (!spec) return null;

    // 1. Flatten displayRows to an ordered Row[]. This already reflects:
    //    filter + sort + collapse-driven omission + (future) row-reorder.
    //    Group headers are skipped — they're reconstructed from `groups` on export.
    // displayRows already reflects paint-tool overrides (merged in
    // `visibleRows` upstream), so exportSpec's only job here is to apply
    // cell-value edits and flatten to an ordered array.
    const orderedRows: Row[] = [];
    const primaryField = allColumns[0]?.field;
    for (const dr of displayRows) {
      if (dr.type === "data") {
        const base = dr.row;
        const editedMeta = cells.cellEdits.cells[base.id];
        if (editedMeta) {
          const editedLabel = primaryField && editedMeta[primaryField] != null
            ? String(editedMeta[primaryField])
            : base.label;
          orderedRows.push({
            ...base,
            label: editedLabel,
            metadata: { ...base.metadata, ...editedMeta },
          });
        } else {
          orderedRows.push(base);
        }
      }
    }

    // 2. Sync group collapse state + apply group reorder overrides so export
    //    mirrors what's visible. Groups are reordered hierarchically by their
    //    parentId, using rowOrderOverrides.groupOrderByParent.
    const syncedGroups = spec.data.groups.map((g) => ({
      ...g,
      collapsed: rowsGroups.collapsedGroups.has(g.id) || g.collapsed,
    }));
    const groupsOut: typeof syncedGroups = [];
    const byParent = new Map<string, typeof syncedGroups>();
    for (const g of syncedGroups) {
      const p = g.parentId ?? "__root__";
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(g);
    }
    // Sort each parent bucket by groupOrderByParent override
    for (const [parentKey, bucket] of byParent) {
      const override = rowsGroups.rowOrderOverrides.groupOrderByParent[parentKey];
      if (!override) continue;
      const idx: Record<string, number> = {};
      override.forEach((id, i) => (idx[id] = i));
      bucket.sort((a, b) => {
        const ai = idx[a.id] ?? Number.POSITIVE_INFINITY;
        const bi = idx[b.id] ?? Number.POSITIVE_INFINITY;
        return ai - bi;
      });
    }
    // Walk hierarchy in reordered order, depth-first.
    function emitGroupsUnder(parentKey: string) {
      const children = byParent.get(parentKey);
      if (!children) return;
      for (const g of children) {
        groupsOut.push(g);
        emitGroupsUnder(g.id);
      }
    }
    emitGroupsUnder("__root__");
    // Safety net: any group not emitted (e.g. due to orphan parent) gets appended.
    const seen = new Set(groupsOut.map((g) => g.id));
    for (const g of syncedGroups) if (!seen.has(g.id)) groupsOut.push(g);

    // Merge any session-level label edits into spec.labels so "View source"
    // reproduces interactive title/subtitle/caption/footnote changes.
    const mergedLabels = Object.keys(cells.labelEdits).length
      ? { ...(spec.labels ?? {}), ...cells.labelEdits }
      : spec.labels;

    // When an aspect target is pinned, embed the live lever-laddered
    // chrome / row dimensions into the exported theme so the static
    // renderer (which recomputes layout from `theme.spacing.*`)
    // produces the same row heights, header band, and axis spacing
    // the user sees on screen. Without this, the SVG bounds match
    // the aspect target but inner content renders at the natural
    // unscaled rowHeight / headerHeight, leaving large blank space
    // (the "doesn't render WYSIWYG" symptom). `axisGap` is back-
    // computed so `axisGap + axisRegionHeight` lands on the live
    // post-ladder `axisHeight` after the renderer re-derives
    // axisRegionHeight from the (unchanged) theme typography.
    let themeForExport = spec.theme;
    if (
      targetAspect != null &&
      layout.aspectTargetHeight != null &&
      layout.rowHeight != null
    ) {
      const naturalAxisGap = spec.theme.spacing.axisGap
        ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP;
      const axisRegionH = layout.axisRegionHeight
        ?? Math.max(0, layout.axisHeight - naturalAxisGap);
      const exportedAxisGap = Math.max(0, layout.axisHeight - axisRegionH);
      themeForExport = {
        ...spec.theme,
        spacing: {
          ...spec.theme.spacing,
          rowHeight: layout.rowHeight,
          headerHeight: layout.headerHeight,
          axisGap: exportedAxisGap,
        },
      };
    }

    return {
      ...spec,
      columns: effectiveColumnDefs,
      data: {
        ...spec.data,
        rows: orderedRows,
        groups: groupsOut,
      },
      labels: mergedLabels,
      theme: themeForExport,
    };
  });

  // ──────────────────────────────────────────────────────────────────────
  // Typed event emitter (spec S3 — Phase 0a-PR5)
  // ──────────────────────────────────────────────────────────────────────
  // Per-dimension events fire reactively from $effect blocks whenever
  // the underlying state changes. Consumers subscribe via store.on(...);
  // the Shiny adapter forwards to setShinyInput, the future JS public
  // API surfaces .on() directly. See $spec/events.ts for the typed
  // payload contract and $stores/slices/events.ts for the emitter.
  const events: EventEmitter<TabvizEvents> = createEventEmitter<TabvizEvents>();
  $effect.root(() => {
    // Tier 1 — core interaction
    $effect(() => {
      // selectedRowIds is a $derived owned by the semantics slice; this
      // $effect re-fires whenever its inputs change. Array.from() pulls
      // out a stable per-tick array for the event payload.
      events.emit("selected", Array.from(semantics.selectedRowIds));
    });
    $effect(() => { events.emit("hover", rowsGroups.hoveredRowId); });
    $effect(() => { events.emit("sort", sortFilter.sortConfig as TabvizEvents["sort"]); });
    $effect(() => { events.emit("filters", sortFilter.filters); });
    $effect(() => { events.emit("rowStyles", semantics.styleEdits.rows); });
    $effect(() => { events.emit("cellStyles", semantics.styleEdits.cells); });
    $effect(() => { events.emit("paintTool", semantics.paintTool); });
    $effect(() => { events.emit("collapsedGroups", Array.from(rowsGroups.collapsedGroups)); });
    $effect(() => { events.emit("hiddenColumns", Array.from(hiddenColumnIds)); });
    $effect(() => { events.emit("columnOrder", allColumns.map((c) => c.id)); });
    $effect(() => { events.emit("columnWidths", { ...columnWidths }); });
    $effect(() => { events.emit("cellEdits", cells.cellEdits); });
    $effect(() => { events.emit("labelEdits", cells.labelEdits); });
    $effect(() => {
      events.emit("zoom", {
        zoom, autoFit, maxWidth, maxHeight, showZoomControls,
      } as unknown as TabvizEvents["zoom"]);
    });

    // Tier 2 — forest/plot-specific overrides
    $effect(() => { events.emit("axisZooms", axis.axisZooms as unknown as TabvizEvents["axisZooms"]); });
    $effect(() => {
      const mode = bandingOverride;
      const startsWithBand = bandingStartsWithBandOverride;
      events.emit(
        "banding",
        mode == null && startsWithBand == null
          ? null
          : { mode: mode as unknown as string | null, startsWithBand },
      );
    });
    $effect(() => { events.emit("plotWidth", plotWidthOverride); });

    // Derived — visibleRows IDs in display order
    $effect(() => { events.emit("visibleRows", visibleRows.map((r) => r.id)); });

    // Aggregate `change` — fires when any of the above does. The adapter
    // uses this to drive the debounced `_state` bundle without having to
    // touch every dependency individually.
    $effect(() => {
      // Touch every dimension so the effect re-fires when any changes.
      // Read-only `void` references — no work, just dependency tracking.
      void sortFilter.sortConfig;
      void sortFilter.filters;
      void semantics.styleEdits;
      void semantics.paintTool;
      void rowsGroups.collapsedGroups;
      void hiddenColumnIds;
      void allColumns;
      void columnWidths;
      void cells.cellEdits;
      void cells.labelEdits;
      void zoom;
      void autoFit;
      void maxWidth;
      void maxHeight;
      void showZoomControls;
      void axis.axisZooms;
      void bandingOverride;
      void bandingStartsWithBandOverride;
      void plotWidthOverride;
      events.emit("change", undefined);
    });
  });

  return {
    // Getters (reactive)
    get spec() {
      return spec;
    },
    get width() {
      return effectiveWidth;
    },
    get height() {
      return effectiveHeight;
    },
    get visibleRows() {
      return visibleRows;
    },
    get xScale() {
      return xScale;
    },
    get axisComputation() {
      return axisComputation;
    },
    get layout() {
      return layout;
    },
    get selectedRowIds() {
      // Derived on the semantics slice. The active token's painted-row set
      // IS the selection (paint-as-selection model).
      return semantics.selectedRowIds;
    },
    get collapsedGroups() {
      return rowsGroups.collapsedGroups;
    },
    get hoveredRowId() {
      return rowsGroups.hoveredRowId;
    },
    get allColumns() {
      return allColumns;
    },
    get allColumnDefs() {
      return allColumnDefs;
    },
    get primaryColumnId() {
      return primaryColumnId;
    },
    get availableFields() {
      return spec?.availableFields ?? [];
    },
    get extraColumns() {
      return spec?.extraColumns ?? [];
    },
    get hiddenColumnIds() {
      return hiddenColumnIds;
    },
    get hasColumnEdits() {
      return columns.hasColumnEdits;
    },
    get forestColumns() {
      return forestColumns;
    },
    get hasExplicitForestColumns() {
      return hasExplicitForestColumns;
    },
    get vizColumns() {
      return vizColumns;
    },
    get hasVizColumns() {
      return hasVizColumns;
    },
    get displayRows() {
      return displayRows;
    },
    get paginatedRows() {
      return paginatedRows;
    },
    get currentPage() {
      return currentPage;
    },
    get totalPages() {
      return totalPages;
    },
    get isPaginated() {
      return isPaginated;
    },
    get continuousMode() {
      return continuousMode;
    },
    get bandIndexes() {
      return bandIndexes;
    },
    get rowPaddedAfter() {
      return rowPaddedAfter;
    },
    get effectiveBanding() {
      return effectiveBanding;
    },
    get bandingOverride() {
      return bandingOverride;
    },
    get bandingStartsWithBand() {
      return bandingStartsWithBand;
    },
    get bandingStartsWithBandOverride() {
      return bandingStartsWithBandOverride;
    },
    get maxGroupDepth() {
      return maxGroupDepth;
    },
    get settingsOpen() {
      return settingsOpen;
    },
    get themeEdits() {
      return theme.themeEdits;
    },
    get baseThemeName() {
      return theme.baseThemeName;
    },
    get hasThemeEdits() {
      return theme.hasThemeEdits;
    },
    get tooltipRow() {
      return tooltipRow;
    },
    get tooltipPosition() {
      return rowsGroups.tooltipPosition;
    },
    get columnWidths() {
      return columnWidths;
    },
    // Zoom & auto-fit getters
    get zoom() {
      return zoom;
    },
    get autoFit() {
      return autoFit;
    },
    get actualScale() {
      return actualScale;
    },
    get isClamped() {
      return isClamped;
    },
    get maxWidth() {
      return maxWidth;
    },
    get maxHeight() {
      return maxHeight;
    },
    get showZoomControls() {
      return showZoomControls;
    },
    get naturalContentWidth() {
      return naturalContentWidth;
    },
    get naturalContentHeight() {
      return scalableNaturalHeight;
    },
    get sortConfig() {
      return sortFilter.sortConfig;
    },
    get filters() {
      return sortFilter.filters;
    },
    get rowOrderOverrides() {
      return rowsGroups.rowOrderOverrides;
    },
    get columnOrderOverrides() {
      return columnOrderOverrides;
    },
    get cellEdits() {
      return cells.cellEdits;
    },
    get dragState() {
      return drag.dragState;
    },
    get editingTarget() {
      return cells.editingTarget;
    },
    get filterPopoverTarget() {
      return sortFilter.filterPopoverTarget;
    },
    get exportSpec() {
      return exportSpec;
    },
    getColumnWidth: columns.getColumnWidth,
    getPlotWidth,
    // Per-column pan/zoom — owned by the axis slice.
    get axisZooms() {
      return axis.axisZooms;
    },
    setAxisZoom: axis.setAxisZoom,
    resetAxisZoom: axis.resetAxisZoom,
    getAxisZoom: axis.getAxisZoom,
    getEffectiveDomain: axis.getEffectiveDomain,

    /**
     * Get current dimensions for export.
     * Returns complete layout information for WYSIWYG SVG generation.
     *
     * Two export paths:
     * - Browser download: precomputedLayout is used for exact WYSIWYG match
     * - R save_plot(): Uses same algorithm but with text estimation (no DOM)
     */
    getExportDimensions() {
      // Get the current x-axis domain from xScale
      const domain = xScale.domain() as [number, number];

      // Build column order and positions sequentially
      const columnOrder: string[] = [];
      const columnPositions: Record<string, number> = {};
      const columnWidthsOut: Record<string, number> = {};

      // Widths are measured once (no dual pass) since interaction chrome lives
      // in absolute overlays that don't consume flow width.
      const widths = columnWidths;

      // Route widths through the aspect ladder so the downloaded SVG
      // matches what the user sees on screen when an aspect target is
      // pinned. Forest columns prefer `layout.forestWidth` (Stage 1
      // output) over the auto-measured header-min width unless the
      // user manually resized; non-forest columns multiply their
      // measured width by `layout.aspectNonForestScale` (Stage 2 output)
      // unless user-resized. Mirrors
      // `gridTemplateColumns` and `effectiveVizWidth()` in ForestPlot.
      const aspectScale = layout.aspectNonForestScale ?? 1;

      // The primary column is the leftmost entry in allColumns — no separate label slot.
      let currentX = 0;

      // Process all columns in order (forest columns are inline)
      for (const col of allColumns) {
        columnOrder.push(col.id);
        columnPositions[col.id] = currentX;

        const userResized = userResizedIds.has(col.id);
        let colWidth: number;
        if (col.type === "forest") {
          // Forest is structural: prefer explicit author width, then
          // user-resize override, then the lever-laddered layout
          // value, then the auto-measured fallback (a header-min that
          // wouldn't reflect the lever ladder otherwise).
          if (typeof col.width === "number") {
            colWidth = col.width;
          } else if (typeof col.options?.forest?.width === "number") {
            colWidth = col.options.forest.width;
          } else if (userResized && typeof widths[col.id] === "number") {
            colWidth = widths[col.id];
          } else {
            colWidth = layout.forestWidth;
          }
        } else {
          // Non-forest: measured / explicit width with aspect scale
          // applied unless the user pinned via drag-resize.
          const base = widths[col.id]
            ?? (typeof col.width === "number" ? col.width : 100);
          colWidth = (userResized || Math.abs(aspectScale - 1) < 1e-6)
            ? base
            : base * aspectScale;
        }
        columnWidthsOut[col.id] = colWidth;
        currentX += colWidth;
      }

      // Build forest column info with independent axis data
      const forestColumnsData: Array<{
        columnId: string;
        xPosition: number;
        width: number;
        xDomain: [number, number];
        clipBounds: [number, number];
        ticks: number[];
        scale: "linear" | "log";
        nullValue: number;
        axisLabel: string;
      }> = [];

      for (const fc of forestColumns) {
        const col = fc.column;
        const forestOpts = col.options?.forest;
        // Use the width we already computed for this column
        const fcWidth = columnWidthsOut[col.id] ?? layout.forestWidth;
        const fcScale = forestOpts?.scale ?? "linear";
        const fcNullValue = forestOpts?.nullValue ?? (fcScale === "log" ? 1 : 0);

        // Apply per-column pan/zoom override if present. Clip bounds track the
        // override so svg-generator's CI clipping + arrow logic matches view.
        const override = axis.axisZooms[col.id]?.domain;
        const fcDomain: [number, number] = override ?? domain;
        const fcClip: [number, number] = override ?? axisComputation.axisLimits;
        let fcTicks = axisComputation.ticks;
        if (override) {
          // Regenerate ticks against the overridden domain so axis labels reflect zoom.
          const tickScale = fcScale === "log"
            ? scaleLog().domain([Math.max(override[0], 1e-9), Math.max(override[1], 1e-9)])
            : scaleLinear().domain(override);
          fcTicks = tickScale.ticks(6);
        }
        forestColumnsData.push({
          columnId: col.id,
          xPosition: columnPositions[col.id],
          width: fcWidth,
          xDomain: fcDomain,
          clipBounds: fcClip,
          ticks: fcTicks,
          scale: fcScale,
          nullValue: fcNullValue,
          axisLabel: forestOpts?.axisLabel ?? "Effect",
        });
      }

      // Non-forest viz column zoom overrides for the export pipeline. Only
      // emit entries for columns the user has actually zoomed/panned — default
      // rendering in svg-generator.ts computes its own domain from the data.
      const vizColumnsData: Array<{ columnId: string; xDomain: [number, number]; clipBounds: [number, number] }> = [];
      for (const vc of vizColumns) {
        if (vc.column.type === "forest") continue;
        const override = axis.axisZooms[vc.column.id]?.domain;
        if (!override) continue;
        vizColumnsData.push({
          columnId: vc.column.id,
          xDomain: override,
          clipBounds: override,
        });
      }

      // Calculate row heights and positions
      const rowHeights: number[] = [];
      const rowPositions: number[] = [];
      let totalRowsHeight = 0;

      // Same group-header row-height accounting as `layout`: group-header
      // rows take the themed rowGroupPadding so this shape-for-export also
      // reflects the true DOM row heights.
      const rowGroupPaddingExport = spec?.theme?.spacing?.rowGroupPadding ?? 0;
      for (const displayRow of displayRows) {
        let h: number;
        if (displayRow.type === "data" && displayRow.row.style?.type === "spacer") h = layout.rowHeight / 2;
        else if (displayRow.type === "group_header") h = layout.rowHeight + rowGroupPaddingExport;
        else h = layout.rowHeight;
        rowPositions.push(totalRowsHeight);
        rowHeights.push(h);
        totalRowsHeight += h;
      }

      // Header depth (1 or 2 for column groups)
      const headerDepth = allColumnDefs.some(c => c.isGroup) ? 2 : 1;

      return {
        // Column layout (unified order)
        columnOrder,
        columnWidths: columnWidthsOut,
        columnPositions,

        // Forest columns (may be multiple)
        forestColumns: forestColumnsData,

        // Non-forest viz columns with user pan/zoom overrides
        vizColumns: vizColumnsData,

        // Row layout
        rowHeights,
        rowPositions,
        totalRowsHeight,

        // Header
        headerHeight: layout.headerHeight,
        headerDepth,

        // Overall dimensions. When an aspect target is pinned, route
        // through the lever ladder's `aspectTargetWidth` /
        // `aspectTargetHeight` so downloads honour the requested
        // aspect bit-exactly. ResizeObserver-measured
        // scalableNaturalHeight can lag the layout state for one
        // frame at slider end-points, and `naturalContentWidth` for
        // width — using the lever target sidesteps both. Falls back
        // to the natural-derived values when no aspect is pinned.
        width: (layout.aspectTargetWidth ?? naturalContentWidth) * zoom,
        height: (layout.aspectTargetHeight ?? scalableNaturalHeight ?? 400) * zoom,
        naturalWidth: layout.aspectTargetWidth ?? currentX,
        naturalHeight: layout.aspectTargetHeight
          ?? (totalRowsHeight + layout.headerHeight + layout.axisHeight),

        // Legacy fields for backwards compatibility
        // Use actual first forest column width (may be resized) for consistent layout
        forestWidth: (forestColumnsData[0]?.width ?? layout.forestWidth) * zoom,
        xDomain: domain,
        clipBounds: axisComputation.axisLimits,
        scale: zoom,
      };
    },

    // Actions
    setSpec,
    // Pagination — data slice passthrough.
    setCurrentPage: data.setCurrentPage,
    nextPage: data.nextPage,
    prevPage: data.prevPage,
    setContinuousMode: data.setContinuousMode,
    setDimensions,
    setSelectedRows: semantics.setSelectedRows,
    toggleGroup: rowsGroups.toggleGroup,
    // Settings + banding overrides — data slice passthrough.
    openSettings: data.openSettings,
    closeSettings: data.closeSettings,
    toggleSettings: data.toggleSettings,
    setBandingOverride: data.setBandingOverride,
    setBandingStartsWithBand: data.setBandingStartsWithBand,
    // Theme methods passthrough — own state lives on the theme slice.
    setThemeField: theme.setThemeField,
    setThemeFieldDerived: theme.setThemeFieldDerived,
    isOverridden: theme.isOverridden,
    clearOverride: theme.clearOverride,
    previewThemeField: theme.previewThemeField,
    // Watermark methods — data slice passthrough (mutates spec).
    setWatermark: data.setWatermark,
    previewWatermark: data.previewWatermark,
    setWatermarkColor: data.setWatermarkColor,
    setWatermarkOpacity: data.setWatermarkOpacity,
    resetThemeEdits: theme.resetThemeEdits,
    // Sort + filter — sort-filter slice passthrough.
    sortBy: sortFilter.sortBy,
    toggleSort: sortFilter.toggleSort,
    setColumnFilter: sortFilter.setColumnFilter,
    clearAllFilters: sortFilter.clearAllFilters,
    getColumnFilter: sortFilter.getColumnFilter,
    detectColumnKind: sortFilter.detectColumnKind,
    getColumnValues: sortFilter.getColumnValues,
    getColumnNumericRange: sortFilter.getColumnNumericRange,
    // DnD — column-scope helpers owned by the columns slice.
    findColumnScope: columns.findColumnScope,
    siblingsForColumnScope: columns.siblingsForColumnScope,
    // Row-scope DnD helpers + row reorder methods on the rows-groups slice.
    findRowGroupScope: rowsGroups.findRowGroupScope,
    siblingsForRowScope: rowsGroups.siblingsForRowScope,
    siblingsForRowGroupScope: rowsGroups.siblingsForRowGroupScope,
    // Drag micro-slice passthrough.
    beginDrag: drag.beginDrag,
    updateDrag: drag.updateDrag,
    endDrag: drag.endDrag,
    cancelDrag: drag.cancelDrag,
    moveColumnItem: columns.moveColumnItem,
    moveRowItem: rowsGroups.moveRowItem,
    moveRowGroupItem: rowsGroups.moveRowGroupItem,
    clearRowReorder: rowsGroups.clearRowReorder,
    clearColumnReorder: columns.clearColumnReorder,
    // Interactive column edits — columns slice passthrough.
    insertColumn: columns.insertColumn,
    hideColumn: columns.hideColumn,
    updateColumn: columns.updateColumn,
    updateColumnPatch: columns.updateColumnPatch,
    clearColumnEdits: columns.clearColumnEdits,
    // Edit — cell + label methods live on the cells slice (Phase 0c-C1 PR1).
    startEdit: cells.startEdit,
    endEdit: cells.endEdit,
    setCellValue: cells.setCellValue,
    clearCellEdit: cells.clearCellEdit,
    setRowLabel: cells.setRowLabel,
    setGroupHeader: cells.setGroupHeader,
    setForestCellValues: cells.setForestCellValues,
    getDisplayValue: cells.getDisplayValue,
    getLabel: cells.getLabel,
    setLabel: cells.setLabel,
    previewLabel: cells.previewLabel,
    getPlotLabel: cells.getPlotLabel,
    // Paint tool — owned by the semantics slice (Phase 0c-C1 PR6).
    setPaintTool: semantics.setPaintTool,
    setPaintHoverCellField: semantics.setPaintHoverCellField,
    paintRowWithActiveToken: semantics.paintRowWithActiveToken,
    paintCellWithActiveToken: semantics.paintCellWithActiveToken,
    setRowSemantic: semantics.setRowSemantic,
    setCellSemantic: semantics.setCellSemantic,
    clearSemantic: semantics.clearSemantic,
    clearCellSemantic: semantics.clearCellSemantic,
    getRowSemantic: semantics.getRowSemantic,
    getCellSemantic: semantics.getCellSemantic,
    clearAllPaint: semantics.clearAllPaint,
    get paintTool() { return semantics.paintTool; },
    get paintHoverCellField() { return semantics.paintHoverCellField; },
    get styleEdits() { return semantics.styleEdits; },
    get hasPaintEdits() { return semantics.hasPaintEdits(); },
    clearAllEdits,
    // Filter popover — sort-filter slice passthrough.
    openFilterPopover: sortFilter.openFilterPopover,
    closeFilterPopover: sortFilter.closeFilterPopover,
    setHovered: rowsGroups.setHovered,
    setTooltip: rowsGroups.setTooltip,
    setColumnWidth: columns.setColumnWidth,
    previewColumnWidth: columns.previewColumnWidth,
    setPlotWidth,
    // Aspect ratio — data slice passthrough.
    setTargetAspect: data.setTargetAspect,
    setTargetAspectAnchor: data.setTargetAspectAnchor,
    getTargetAspect: data.getTargetAspect,
    get targetAspect() { return targetAspect; },
    get targetAspectAnchor() { return spec?.targetAspectAnchor ?? "width"; },
    get userResizedIds() { return userResizedIds; },
    // Aspect-ladder diagnostic: surface zoom-related state so the
    // puppeteer probe can see what auto-fit is doing.
    get _aspectDiag() {
      return {
        scalableNaturalWidth,
        scalableNaturalHeight,
        containerWidth,
        containerHeight,
        zoom,
        autoFit,
        actualScale,
        fitScale,
        isClamped,
      };
    },
    setTheme: theme.setTheme,
    setThemeObject: theme.setThemeObject,
    captureThemeSnapshot: theme.captureThemeSnapshot,
    applyThemeSnapshot: theme.applyThemeSnapshot,
    // Zoom & auto-fit actions
    setZoom,
    resetZoom,
    zoomIn,
    zoomOut,
    setAutoFit,
    fitToWidth,
    setMaxWidth,
    setMaxHeight,
    setShowZoomControls,
    setContainerDimensions,
    setScalableNaturalDimensions,
    setContainerElementId,
    resetState,
    // Op recorder. `clearOpLog` removed in Phase 0b (orphan; no callers).
    get opLog() { return history.opLog; },
    // Plot-level label overrides (title/subtitle/caption/footnote)
    get labelEdits() { return cells.labelEdits; },
    // Forest-plot width override (null = follow auto layout)
    get plotWidthOverride() { return plotWidthOverride; },
    // Source tagging for outbound Shiny envelopes. getSource(field) returns
    // 'user' | 'proxy' depending on which path most-recently mutated the
    // field; defaults to 'user'. withSource() lets the proxy boundary mark
    // its dispatched mutations as 'proxy' so observers can disambiguate.
    getSource: source.getSource,
    withSource,
    // Typed event emitter (spec S3). Subscribe with store.on(event, cb).
    // The Shiny adapter consumes per-dimension events and `change`; future
    // JS API consumers use .on directly. See $spec/events.ts for events.
    on: events.on,
    // Append a pre-built record (used by the split wrapper to log
    // SplitForest-level ops like set_shared_column_widths on the active
    // sub-plot's log). Internal store mutations go through the same
    // `appendOp` helper so consecutive duplicates get dropped in one
    // place.
    recordOp: (r: OpRecord) => appendOp(r),
  };

  // appendOp lives on the history micro-slice (Phase 0c-C1 PR8). The
  // dedupe + coalesce rules + the kind allowlist all moved with it.
}

export type ForestStore = ReturnType<typeof createForestStore>;

