import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from "d3-scale";
import type {
  WebSpec,
  Row,
  Group,
  ColumnDef,
  RowOrderOverrides,
  DragState,
  DisplayRow,
  GroupHeaderRow,
  DataRow,
} from "$types";
import {
  computeBandIndexes,
  maxGroupDepth as computeMaxGroupDepth,
} from "$lib/banding";
import { niceDomain } from "$lib/scale-utils";
import { THEME_PRESETS, type ThemeName } from "$lib/theme-presets";
import { TEXT_MEASUREMENT } from "$lib/rendering-constants";
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
import { createLayoutZoomSlice } from "$stores/slices/layout-zoom.svelte";

// Re-exports preserved for the existing public surface (tests import these
// from tabvizStore.svelte; the canonical home is now the columns slice).
export const RESERVED_COLUMN_IDS = _RESERVED_COLUMN_IDS;
export const mintUniqueId = _mintUniqueId;
import { createEventEmitter, type EventEmitter } from "$stores/slices/events";
import type { TabvizEvents } from "$spec/events";
import { compileVariants } from "../schema/variant-compile";

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
export function createTabvizStore() {
  // Core state. `$state.raw` skips the deep-proxy wrap — `spec` is always
  // replaced wholesale via `setSpec({ ...prev, ...patch })` (see audit notes
  // in CLAUDE.md; every write site is REPLACE, never in-place). The render
  // hot path reads `spec.data.rows[i].metadata[field]` thousands of times
  // per render; without `.raw`, every property access is a proxy trap.
  let spec = $state.raw<WebSpec | null>(null);

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
    getLayoutForestWidth: () => layoutZoom.layout.forestWidth,
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
  // groupMap + groupDepthMap derived blocks. Reads visibleIndices + rowAt
  // from the sort-filter slice (first slice-to-slice $derived chain) and
  // displayRows from the data slice (the next link in the same chain).
  const rowsGroups = createRowsGroupsSlice({
    getSpec: () => spec,
    getAllColumns: () => columns.allColumns,
    getVisibleIndices: () => sortFilter.visibleIndices,
    getRowAt: (i: number) => sortFilter.rowAt(i),
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

  // ── Layout + zoom (the final slice) ──────────────────────────────────────
  // Phase 0c-C1 PR11. Owns the entire "where does each pixel land on the
  // canvas" story — the giant `layout` $derived (the lever ladder), the
  // zoom / autoFit / max-dim state + actions, container + scalable
  // dimensions, naturalContentWidth / fitScale / actualScale / isClamped,
  // plot-width override, localStorage zoom persistence, and the initial
  // dimension fallback. Reads heavily across the dep graph: spec (theme +
  // data), columns (allColumns / forestColumns / columnWidths /
  // userResizedIds), data (displayRows / targetAspect), cells
  // (wrapLineCounts). All via forward-closure getters.
  const layoutZoom = createLayoutZoomSlice({
    getSpec:           () => spec,
    getAllColumns:     () => columns.allColumns,
    getForestColumns:  () => columns.forestColumns,
    getColumnWidths:   () => columns.columnWidths,
    getUserResizedIds: () => columns.userResizedIds,
    getDisplayRows:    () => data.displayRows,
    getTargetAspect:   () => data.targetAspect,
    getWrapLineCounts: () => cells.wrapLineCounts,
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

  // initialWidth / initialHeight live on the layout-zoom slice (Phase 0c-C1
  // PR11) along with every other canvas-sizing dimension.

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

  // plotWidthOverride / zoom / autoFit / maxWidth / maxHeight /
  // showZoomControls + container + scalable dimensions +
  // containerElementId + the effectiveWidth/Height derived all live on
  // the layout-zoom slice (Phase 0c-C1 PR11). Aliases declared further
  // below keep existing references in this file unchanged.

  // axisZooms lives on the axis slice (Phase 0c-C1 PR3). Read via
  // `axis.axisZooms`; mutate via `axis.setAxisZoom` / `axis.resetAxisZoom`.

  // Layout-zoom slice aliases — keep flat names so existing reads in this
  // file stay unchanged.
  const initialWidth = $derived(layoutZoom.initialWidth);
  const initialHeight = $derived(layoutZoom.initialHeight);
  const plotWidthOverride = $derived(layoutZoom.plotWidthOverride);
  const zoom = $derived(layoutZoom.zoom);
  const autoFit = $derived(layoutZoom.autoFit);
  const maxWidth = $derived(layoutZoom.maxWidth);
  const maxHeight = $derived(layoutZoom.maxHeight);
  const showZoomControls = $derived(layoutZoom.showZoomControls);
  const containerWidth = $derived(layoutZoom.containerWidth);
  const containerHeight = $derived(layoutZoom.containerHeight);
  const scalableNaturalWidth = $derived(layoutZoom.scalableNaturalWidth);
  const scalableNaturalHeight = $derived(layoutZoom.scalableNaturalHeight);
  const effectiveWidth = $derived(layoutZoom.effectiveWidth);
  const effectiveHeight = $derived(layoutZoom.effectiveHeight);
  const layout = $derived(layoutZoom.layout);
  const naturalContentWidth = $derived(layoutZoom.naturalContentWidth);
  const fitScale = $derived(layoutZoom.fitScale);
  const actualScale = $derived(layoutZoom.actualScale);
  const isClamped = $derived(layoutZoom.isClamped);

  // `visibleIndices` $derived lives on the sort-filter slice (schema-sprint
  // Phase 1). Local alias keeps existing call sites unchanged. Consumers
  // that need full Rows call `sortFilter.rowAt(i)` (lazy overlay merge).
  const visibleIndices = $derived(sortFilter.visibleIndices);

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


  // Actions
  function setSpec(newSpec: WebSpec) {
    // Variant compile pass — populates options.<bucket>.__resolved on
    // every variant-bearing column so renderers read primitive options
    // instead of branching on the variant id (schema-sprint Phase 3).
    // Pure + idempotent; safe to run on every setSpec.
    const compiledSpec = compileVariants(newSpec);
    // Create a new object reference to ensure derived values recompute properly
    // when switching between specs (e.g., in split forest navigation)
    spec = { ...compiledSpec };
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

  // setDimensions lives on the layout-zoom slice (Phase 0c-C1 PR11).

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

  // setPlotWidth / getPlotWidth + the entire zoom action surface (setZoom /
  // resetZoom / zoomIn / zoomOut / setAutoFit / fitToWidth / setMaxWidth /
  // setMaxHeight / setShowZoomControls) + container/scalable setters +
  // setContainerElementId + the localStorage persist/load helpers all live
  // on the layout-zoom slice (Phase 0c-C1 PR11). Public-API passthrough on
  // the return block below.

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
    // Layout-zoom slice owns plotWidthOverride + zoom + autoFit + maxWidth +
    // maxHeight; reset() restores all five to defaults. showZoomControls is
    // a user preference and stays untouched.
    layoutZoom.reset();
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

    // Derived — visible row IDs in display order. The Shiny wire shape
    // (`visible_rows`) is the array of original row ids; we resolve via
    // the canonical rows on the spec, never re-allocating Row objects.
    $effect(() => {
      const rows = spec?.data.rows;
      if (!rows) { events.emit("visibleRows", []); return; }
      events.emit("visibleRows", visibleIndices.map((i) => rows[i].id));
    });

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
    get visibleIndices() {
      return visibleIndices;
    },
    rowAt: (i: number) => sortFilter.rowAt(i),
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
    getPlotWidth: layoutZoom.getPlotWidth,
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
      // `gridTemplateColumns` and `effectiveVizWidth()` in TabvizPlot.
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
    setDimensions: layoutZoom.setDimensions,
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
    setPlotWidth: layoutZoom.setPlotWidth,
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
    // Zoom & auto-fit actions — layout-zoom slice passthrough.
    setZoom: layoutZoom.setZoom,
    resetZoom: layoutZoom.resetZoom,
    zoomIn: layoutZoom.zoomIn,
    zoomOut: layoutZoom.zoomOut,
    setAutoFit: layoutZoom.setAutoFit,
    fitToWidth: layoutZoom.fitToWidth,
    setMaxWidth: layoutZoom.setMaxWidth,
    setMaxHeight: layoutZoom.setMaxHeight,
    setShowZoomControls: layoutZoom.setShowZoomControls,
    setContainerDimensions: layoutZoom.setContainerDimensions,
    setScalableNaturalDimensions: layoutZoom.setScalableNaturalDimensions,
    setContainerElementId: layoutZoom.setContainerElementId,
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

export type TabvizStore = ReturnType<typeof createTabvizStore>;

