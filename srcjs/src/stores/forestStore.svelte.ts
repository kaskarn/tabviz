import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from "d3-scale";
import type {
  WebSpec,
  Row,
  Group,
  ColumnSpec,
  ColumnDef,
  ColumnGroup,
  RowOrderOverrides,
  ColumnOrderOverrides,
  DragState,
  ComputedLayout,
  DisplayRow,
  GroupHeaderRow,
  DataRow,
  ZoomState,
  BandingSpec,
} from "$types";
import {
  computeBandIndexes,
  maxGroupDepth as computeMaxGroupDepth,
  parseBandingString,
} from "$lib/banding";
import { niceDomain } from "$lib/scale-utils";
import { VIZ_MARGIN } from "$lib/axis-utils";
import { THEME_PRESETS, type ThemeName } from "$lib/theme-presets";
import { getColumnDisplayText } from "$lib/formatters";
import { glyphNaturalWidth } from "$lib/width-utils";
import { AUTO_WIDTH, SPACING, GROUP_HEADER, TEXT_MEASUREMENT, BADGE, LAYOUT } from "$lib/rendering-constants";
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
import { resolveShowHeader } from "$lib/column-types";
import { ops, renderColumnBuilder, type OpRecord } from "$lib/op-recorder";
import { createSourceSlice, type SourceTag } from "$stores/slices/source.svelte";
import { createCellsSlice } from "$stores/slices/cells.svelte";
import { createThemeSlice } from "$stores/slices/theme.svelte";
import { createAxisSlice } from "$stores/slices/axis.svelte";
import { createSortFilterSlice } from "$stores/slices/sort-filter.svelte";
import { createRowsGroupsSlice } from "$stores/slices/rows-groups.svelte";
import { createSemanticsSlice } from "$stores/slices/semantics.svelte";
import { createDragSlice } from "$stores/slices/drag.svelte";
import { createHistorySlice } from "$stores/slices/history.svelte";
import { createEventEmitter, type EventEmitter } from "$stores/slices/events";
import type { TabvizEvents } from "$spec/events";

/**
 * Set of ids the frontend store reserves for its own use — a user column
 * with any of these would collide with scope-detection and insert-anchor
 * semantics in surprising ways. Kept in sync with R's `RESERVED_COLUMN_IDS`
 * (see `R/classes-components.R`). Module-scoped + exported so unit tests
 * and the `mintUniqueColumnId` method can share the same set.
 */
export const RESERVED_COLUMN_IDS = new Set<string>(["__root__", "__start__"]);

/**
 * Pure helper: given a base id and a set of already-taken ids, return a
 * unique id by appending `_2`, `_3`, … to the base when needed. Extracted
 * from `mintUniqueColumnId` so the resolution logic can be unit-tested
 * without having to stand up a full `$state`-backed store (bun + Svelte 5
 * runes don't play nicely outside `.svelte` components).
 */
export function mintUniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

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

  // ── Cell + label edits ──────────────────────────────────────────────────
  // Phase 0c-C1 PR1. Owns `cellEdits`, `labelEdits`, `wrapLineCounts`, and
  // `editingTarget`. Reads `allColumns` + `spec` via closure deps (forward
  // references — resolved at call time, not slice-construction time);
  // pushes ops via `appendOp` and source-tags via `markSource`. Both
  // `allColumns` and `appendOp` are declared further down in this file;
  // wrapping them in arrow-fn closures sidesteps the temporal-dead-zone.
  const cells = createCellsSlice({
    getAllColumns: () => allColumns,
    getSpec: () => spec,
    appendOp: (record) => appendOp(record),
    markSource,
  });

  // ── Theme management ────────────────────────────────────────────────────
  // Phase 0c-C1 PR2. Owns `themeEdits`, `themeOverrides`, `baseThemeName`,
  // `initialTheme`, `initialWatermark`. Calls `clearAutoWidthsKeepingUserResizes`
  // + `measureAutoColumns` (still in main factory pending the columns slice)
  // via forward-closure deps; same `setSpec`-mutates-spec pattern as cells.
  const theme = createThemeSlice({
    getSpec: () => spec,
    setSpec: (next) => { spec = next; },
    clearAutoWidthsKeepingUserResizes: () => clearAutoWidthsKeepingUserResizes(),
    measureAutoColumns: () => measureAutoColumns(),
    appendOp: (record) => appendOp(record),
  });

  // ── Axis (cross-slice $derived spike) ────────────────────────────────────
  // Phase 0c-C1 PR3. Owns `axisZooms` and the global `axisComputation` +
  // `xScale` $derived blocks. Reads `forestColumns` (columns / main) and
  // `layout.forestWidth` (layout-zoom / main) via forward-closure getters.
  // This is the first slice whose $derived chains cross slice boundaries —
  // see slices/axis.svelte.ts for the open-question rationale. Visual
  // battery + R tests confirm the reactivity edge propagates correctly
  // through the dep-call sites.
  const axis = createAxisSlice({
    getSpec: () => spec,
    getForestColumns: () => forestColumns,
    getLayoutForestWidth: () => layout.forestWidth,
    markSource,
  });

  // ── Sort + filter ────────────────────────────────────────────────────────
  // Phase 0c-C1 PR4. Owns sortConfig, filters, filterPopoverTarget, and the
  // `visibleRows` $derived. `visibleRows` reads `styleEdits` (semantics —
  // still in main) via forward closure, exercising the same cross-slice
  // $derived pattern axis validated.
  // ── Semantics (paint tool + per-row / per-cell semantic overrides) ──────
  // Phase 0c-C1 PR6. Constructed before sort-filter so its `styleEdits`
  // getter is in scope for the dep closure (sort-filter's `visibleRows`
  // $derived merges paint overrides BEFORE filter/sort).
  const semantics = createSemanticsSlice({
    getSpec: () => spec,
    appendOp: (record) => appendOp(record),
    markSource,
  });

  // ── Drag micro-slice ────────────────────────────────────────────────────
  // Phase 0c-C1 PR7. Tiny — bounded drag state + 4 actions, no deps.
  // Columns drag (column-header reorder) and rows-groups drag (row /
  // group reorder) both call into this slice; extracting it as its own
  // module gives the two consumers a single source of truth.
  const drag = createDragSlice();

  const sortFilter = createSortFilterSlice({
    getSpec: () => spec,
    getAllColumns: () => allColumns,
    getStyleEdits: () => semantics.styleEdits,
    appendOp: (record) => appendOp(record),
    markSource,
  });

  // ── Rows + groups ────────────────────────────────────────────────────────
  // Phase 0c-C1 PR5. Owns collapsedGroups, rowOrderOverrides, hover/tooltip
  // pointers, and the big fullDisplayRows + tooltipRow + maxGroupDepth +
  // groupMap + groupDepthMap derived blocks. Reads visibleRows from the
  // sort-filter slice (first slice-to-slice $derived chain).
  const rowsGroups = createRowsGroupsSlice({
    getSpec: () => spec,
    getAllColumns: () => allColumns,
    getVisibleRows: () => sortFilter.visibleRows,
    getDisplayRows: () => displayRows,
    getCellEdits: () => cells.cellEdits,
    appendOp: (record) => appendOp(record),
    markSource,
  });

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

  // Runtime banding override from the settings panel. Null = follow theme.
  let bandingOverride = $state<BandingSpec | null>(null);
  // Runtime override for the BABA/ABAB starting phase. Null = use the default
  // for the current mode (BABA for group, ABAB for row).
  let bandingStartsWithBandOverride = $state<boolean | null>(null);
  // Settings panel visibility (gear button + slide-in)
  let settingsOpen = $state<boolean>(false);

  // Pagination state (only meaningful when spec.paginate is set):
  //   currentPage   — 1-based; clamped to [1, totalPages] in setSpec/changes.
  //   continuousMode — when true, viewer renders all pages stacked with
  //                    page-break rules instead of one page at a time.
  let currentPage = $state<number>(1);
  let continuousMode = $state<boolean>(false);

  // ── Theme customizations ────────────────────────────────────────────────
  // themeEdits / themeOverrides / baseThemeName / initialTheme /
  // initialWatermark live on the theme slice (Phase 0c-C1 PR2). Read via
  // `theme.X` accessors below; mutate via the slice methods exposed
  // on the public API.

  // User-modified view state (session-only; feeds exportSpec for WYSIWYG).
  // rowOrderOverrides moved to rows-groups slice in Phase 0c-C1 PR5.
  let columnOrderOverrides = $state<ColumnOrderOverrides>({ topLevel: null, byGroup: {} });
  // cellEdits / labelEdits / wrapLineCounts / editingTarget all live on
  // the cells slice (Phase 0c-C1 PR1). Read via `cells.cellEdits` etc.;
  // mutate via the slice methods exposed below on the public API. The
  // slice is constructed below `spec` declaration so its dependency
  // closures can resolve everything they need at call time.
  // opLog + appendOp now live on the history micro-slice (Phase 0c-C1 PR8).
  // Local alias so existing call sites keep working.
  const appendOp = history.appendOp;

  // styleEdits + paintTool + paintHoverCellField live on the semantics
  // slice (Phase 0c-C1 PR6). Read via `semantics.X` accessors; mutate
  // via the slice methods exposed on the public API.

  // User-added columns (runtime insertions via the interactive column editor).
  // `afterId` identifies the sibling column that the new column is inserted after
  // ("__start__" for position 0). Stored separately from spec.columns so
  // clearColumnEdits() and exportSpec see the same source of truth.
  type InsertedColumn = { afterId: string; def: ColumnSpec };
  let userInsertedColumns = $state<InsertedColumn[]>([]);
  // User-hidden columns (by id). Hide is reversible via ResetButton.
  let hiddenColumnIds = $state<Set<string>>(new Set());
  // User-overridden column specs keyed by id (used by Configure…).
  // When present, takes precedence over the original spec.columns entry.
  let columnSpecOverrides = $state<Record<string, ColumnSpec>>({});

  // Transient UI state for DnD / edit / filter overlays.
  // `editingTarget` moved to the cells slice in 0c-C1 PR1.
  // `filterPopoverTarget` moved to the sort-filter slice in 0c-C1 PR4.
  // `dragState` moved to the drag micro-slice in 0c-C1 PR7.

  // Tooltip state moved to rows-groups slice (Phase 0c-C1 PR5).

  // Column width state (for resize)
  let columnWidths = $state<Record<string, number>>({});
  // Track columns whose width was set manually by the user (via resize drag).
  // Auto-measurement (doMeasurement) skips these so user resizes survive
  // re-measurement triggered by screenshot-mode toggling.
  let userResizedIds = $state<Set<string>>(new Set());

  // Plot width override (for resizing the forest plot area)
  let plotWidthOverride = $state<number | null>(null);

  // Target aspect ratio. `null` = render at natural; any positive number
  // triggers an aspect-ladder relayout (forest absorption + non-forest
  // column scale + height ladder; see the doc-comment header at the
  // start of the `layout` derivation). Mirrors `WebSpec.targetAspect`
  // and is seeded from
  // it in `setSpec()`. The settings-panel slider writes it; "View source"
  // emits `set_aspect_ratio(N)` (or `NULL` when cleared).
  let targetAspect = $state<number | null>(null);

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

  // Helper to flatten all columns into flat ColumnSpec array
  function flattenAllColumns(columns: ColumnDef[]): ColumnSpec[] {
    const result: ColumnSpec[] = [];
    for (const col of columns) {
      if (col.isGroup) {
        result.push(...flattenAllColumns(col.columns));
      } else {
        result.push(col);
      }
    }
    return result;
  }

  // Helper: apply columnOrderOverrides to a ColumnDef[] (top-level or a group's children).
  // New/missing ids are tolerated: unknown ids in the override are dropped; previously-unknown
  // columns are appended in their original order.
  function applyColumnOrder(defs: ColumnDef[], order: string[] | null | undefined): ColumnDef[] {
    if (!order || order.length === 0) return defs;
    const byId = new Map<string, ColumnDef>();
    for (const d of defs) byId.set(d.id, d);
    const result: ColumnDef[] = [];
    const seen = new Set<string>();
    for (const id of order) {
      const d = byId.get(id);
      if (d) { result.push(d); seen.add(id); }
    }
    for (const d of defs) if (!seen.has(d.id)) result.push(d);
    return result;
  }

  // Apply the user's runtime column edits to a ColumnDef list:
  //   1. replace specs the user Configure'd
  //   2. drop anything the user Hide'd
  //   3. insert user-added columns after their anchor id
  // Applied at every level so hides/inserts inside column groups still work.
  // `isRoot` lets us honor "__start__" as the top-of-table anchor only once.
  function applyColumnEdits(defs: ColumnDef[], isRoot: boolean): ColumnDef[] {
    const swappedOrHidden: ColumnDef[] = [];
    for (const def of defs) {
      if (hiddenColumnIds.has(def.id)) continue;
      if (!def.isGroup) {
        const override = columnSpecOverrides[def.id];
        if (override) {
          swappedOrHidden.push(override);
          continue;
        }
      }
      swappedOrHidden.push(def);
    }

    const out: ColumnDef[] = [];
    if (isRoot) {
      for (const ins of userInsertedColumns) {
        if (ins.afterId === "__start__") out.push(ins.def as ColumnDef);
      }
    }
    for (const def of swappedOrHidden) {
      out.push(def);
      for (const ins of userInsertedColumns) {
        if (ins.afterId === def.id) out.push(ins.def as ColumnDef);
      }
    }
    return out;
  }

  // Derived: column definitions reflecting user reorder overrides + edits.
  //
  // Flow: apply edits *first* (hide, configure, insert) so the merged list
  // contains user-inserted columns at their default `afterId` positions,
  // THEN apply the reorder override on top. This way the override can
  // rearrange inserted columns just like author-defined ones — the old
  // "reorder first, then splice inserts" path left inserted columns
  // pinned to their original anchor because the override knew nothing
  // about them.
  const effectiveColumnDefs = $derived.by((): ColumnDef[] => {
    if (!spec) return [];
    const merged = applyColumnEdits(spec.columns, true);
    const topOrdered = applyColumnOrder(merged, columnOrderOverrides.topLevel);
    return topOrdered.map((def) => {
      if (def.isGroup) {
        const mergedChildren = applyColumnEdits(def.columns, false);
        const reorderedChildren = applyColumnOrder(
          mergedChildren,
          columnOrderOverrides.byGroup[def.id],
        );
        return { ...def, columns: reorderedChildren };
      }
      return def;
    });
  });

  // Derived: all columns in order (flattened, reflects reorder overrides)
  const allColumns = $derived.by((): ColumnSpec[] => {
    if (!spec) return [];
    return flattenAllColumns(effectiveColumnDefs);
  });

  // Derived: ID of the leftmost visible column — the "primary" column. This
  // column is sticky-left, serves as the row-drag surface, and renders row
  // indentation / group-header chrome / badges. The role is positional: any
  // column can become primary by being reordered to the front.
  const primaryColumnId = $derived.by((): string | null => {
    return allColumns[0]?.id ?? null;
  });

  // Derived: all column definitions in order (for headers, reflects reorder overrides)
  const allColumnDefs = $derived.by((): ColumnDef[] => {
    return effectiveColumnDefs;
  });

  // Derived: indices of forest columns (for SVG overlay positioning)
  // Returns array of { index, column } for each forest column
  const forestColumns = $derived.by((): { index: number; column: ColumnSpec }[] => {
    if (!spec) return [];
    const result: { index: number; column: ColumnSpec }[] = [];
    const cols = allColumns;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].type === "forest") {
        result.push({ index: i, column: cols[i] });
      }
    }
    return result;
  });

  // Derived: check if any explicit forest columns exist
  const hasExplicitForestColumns = $derived(forestColumns.length > 0);

  // Derived: all viz columns (forest, viz_bar, viz_boxplot, viz_violin)
  // These all require SVG overlays
  const vizColumns = $derived.by((): { index: number; column: ColumnSpec }[] => {
    if (!spec) return [];
    const result: { index: number; column: ColumnSpec }[] = [];
    const cols = allColumns;
    const vizTypes = ["forest", "viz_bar", "viz_boxplot", "viz_violin"];
    for (let i = 0; i < cols.length; i++) {
      if (vizTypes.includes(cols[i].type)) {
        result.push({ index: i, column: cols[i] });
      }
    }
    return result;
  });

  // Derived: check if any viz columns exist (need SVG overlays)
  const hasVizColumns = $derived(vizColumns.length > 0);

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

  // Pagination derived. Pages come precomputed from R (`spec.paginate.pages`,
  // 0-based startIdx/endIdx into spec.data.rows) so the viewer never has to
  // re-derive breakpoints — that keeps the static PDF export and the live
  // HTML viewer in lockstep.
  const totalPages = $derived(spec?.paginate?.nPages ?? 0);
  const isPaginated = $derived(totalPages > 0 && !continuousMode);

  // The data-row IDs that fall inside the current page window. Empty set
  // when no pagination is active. Recomputed on currentPage / spec change.
  const currentPageRowIds = $derived.by((): Set<string> => {
    if (!spec?.paginate || continuousMode) return new Set();
    const page = spec.paginate.pages[currentPage - 1];
    if (!page) return new Set();
    const ids = new Set<string>();
    const rows = spec.data.rows;
    for (let i = page.startIdx; i <= page.endIdx && i < rows.length; i++) {
      ids.add(rows[i].id);
    }
    return ids;
  });

  // The slice of fullDisplayRows visible in the current page. Group headers
  // are included whenever at least one descendant data row belongs to the
  // page (so a parent header still fronts its child group on pages where
  // only the child has rows).
  const paginatedRows = $derived.by((): DisplayRow[] => {
    if (!isPaginated) return fullDisplayRows;
    const rowIds = currentPageRowIds;
    if (rowIds.size === 0) return [];

    const include = new Array(fullDisplayRows.length).fill(false);
    for (let i = 0; i < fullDisplayRows.length; i++) {
      const dr = fullDisplayRows[i];
      if (dr.type === "data" && rowIds.has(dr.row.id)) include[i] = true;
    }
    // A group_header is included iff at least one descendant displayRow
    // (until a sibling/ancestor group_header at depth <= myDepth) is in.
    for (let i = 0; i < fullDisplayRows.length; i++) {
      const dr = fullDisplayRows[i];
      if (dr.type !== "group_header") continue;
      const myDepth = dr.depth;
      for (let j = i + 1; j < fullDisplayRows.length; j++) {
        const dj = fullDisplayRows[j];
        if (dj.type === "group_header" && dj.depth <= myDepth) break;
        if (include[j]) {
          include[i] = true;
          break;
        }
      }
    }
    const out: DisplayRow[] = [];
    for (let i = 0; i < fullDisplayRows.length; i++) {
      if (include[i]) out.push(fullDisplayRows[i]);
    }
    return out;
  });

  // The canonical "rows currently on screen" list. When pagination is
  // active and the user is not in continuous mode, this is the page slice
  // (with its group headers); otherwise it's the full displayRows. All
  // downstream consumers (layout, render loops, drag-drop) use this so the
  // grid, axis row, and overlays all line up with the visible rows.
  const displayRows = $derived(isPaginated ? paginatedRows : fullDisplayRows);

  function setCurrentPage(p: number) {
    if (totalPages === 0) {
      currentPage = 1;
      return;
    }
    currentPage = Math.max(1, Math.min(totalPages, Math.floor(p)));
  }

  function nextPage() {
    if (currentPage < totalPages) currentPage += 1;
  }

  function prevPage() {
    if (currentPage > 1) currentPage -= 1;
  }

  function setContinuousMode(v: boolean) {
    continuousMode = v;
  }

  // Maximum group depth moved to the rows-groups slice (Phase 0c-C1 PR5).
  const maxGroupDepth = $derived(rowsGroups.maxGroupDepth);

  // Derived: the banding spec actually in effect. Runtime override (from the
  // settings panel) wins over whatever the theme declares. The theme value is
  // a BandingSpec object (from R serialization); we pass through defensively
  // if the shape is missing.
  const effectiveBanding = $derived.by((): BandingSpec => {
    if (bandingOverride) return bandingOverride;
    const themeBanding = spec?.theme?.layout?.banding;
    if (themeBanding && typeof themeBanding === "object" && "mode" in themeBanding) {
      return themeBanding as BandingSpec;
    }
    return { mode: "group", level: null };
  });

  // Derived: whether the banding pattern starts with a band (BABA) or blank
  // (ABAB). Defaults: group → BABA, row → ABAB. User can flip via the
  // settings panel; `bandingStartsWithBandOverride` holds that flip.
  const bandingStartsWithBand = $derived.by((): boolean => {
    if (bandingStartsWithBandOverride !== null) return bandingStartsWithBandOverride;
    return effectiveBanding.mode === "group";
  });

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
    // A fresh spec supersedes any prior interactive column edits.
    clearColumnEdits();
    // Also reset every per-column-id map that would otherwise leak across
    // specs. `columnWidths` is cleared by `measureAutoColumns` below, but
    // `axisZooms` and `userResizedIds` had no reset path and could hand a
    // new spec a zoom / "user-resized" flag from the previous one when an
    // id happened to match.
    axis.reset();
    userResizedIds = new Set();
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
    // Pagination resets to page 1 with each spec swap (split-by navigation
    // flows through setSpec, and "the same page index across different data"
    // would point at unrelated rows). Continuous-mode toggle is preserved as
    // a viewing preference.
    currentPage = 1;
    // Theme reset target + baseThemeName + edit tracking: the theme slice
    // owns initialTheme / initialWatermark too, so a single captureInitial
    // call handles all five fields. Settings panel's "View source" feature
    // emits `web_theme_<baseThemeName>() |> ...` off the same baseThemeName
    // the slice records here.
    theme.captureInitial(newSpec);

    // Seed the aspect-ratio target from the spec (set R-side by
    // `set_aspect_ratio()` or by the `target_aspect` field). null/undefined
    // means "render at natural"; the slider sits at the natural detent.
    const rawTarget = newSpec.targetAspect;
    targetAspect = (typeof rawTarget === "number" && rawTarget > 0)
      ? rawTarget
      : null;

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
    measureAutoColumns();
  }

  // Helper to measure columns with width="auto" and set their computed widths
  function measureAutoColumns() {
    if (!spec || typeof document === 'undefined') return;

    // Get font from theme
    const fontFamily = spec.theme.text.body.family;
    let fontSize = spec.theme.text.body.size;

    // Convert rem/em to px using actual document root font size
    // (don't assume 16px - user may have accessibility settings or custom base)
    if (typeof fontSize === 'string' && (fontSize.endsWith('rem') || fontSize.endsWith('em'))) {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const relValue = parseFloat(fontSize);
      fontSize = `${relValue * rootFontSize}px`;
    }

    // Single measurement pass — interaction chrome lives in absolute overlays,
    // so it doesn't consume flow width. Same widths on screen and in export.
    doMeasurement(fontSize, fontFamily, columnWidths);

    // Then wait for fonts to load and re-measure for accuracy
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        doMeasurement(fontSize as string, fontFamily, columnWidths, true);
      });
    }
  }

  // Perform the actual column width measurement.
  // `target` is the widths dict to write into. Only one dict is used now
  // (`columnWidths`), since interaction chrome renders in absolute overlays
  // and therefore doesn't affect flow-width measurement.
  function doMeasurement(
    fontSize: string,
    fontFamily: string,
    target: Record<string, number>,
    isFontLoaded = false,
  ) {
    if (!spec) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Header cells use scaled font size (1.05, default 1.05)
    // Parse the font size and scale it for headers
    const headerFontScale = 1.05;
    let headerFontSize = fontSize;
    if (typeof fontSize === 'string') {
      const match = fontSize.match(/^([\d.]+)(px|rem|em)$/);
      if (match) {
        const value = parseFloat(match[1]) * headerFontScale;
        headerFontSize = `${value}${match[2]}`;
      }
    }

    // Font strings for headers (bold, scaled size) and data cells (normal)
    // Use actual theme fontWeightBold (varies by theme: 600 or 700)
    const fontWeightBold = 600;
    const headerFont = `${fontWeightBold} ${headerFontSize} ${fontFamily}`;
    const dataFont = `${fontSize} ${fontFamily}`;

    // Padding values from theme (not hardcoded magic numbers)
    // cellPaddingX is applied to both left and right of each cell
    const cellPadding = (spec.theme.spacing.cellPaddingX ?? 10) * 2;
    // groupPadding is applied to both left and right of column group headers
    const groupPadding = (spec.theme.spacing.groupPadding ?? 8) * 2;

    // Interaction chrome (sort chevron, filter funnel, drag grip) renders in
    // absolute-positioned hover overlays that do not consume flow width, so
    // measurement only accounts for header text and data content.
    // Persistent active-state indicators (sort chevron on a sorted column,
    // filter dot on a filtered column) DO sit in flow, but only on columns
    // that are actively queried — a blanket budget would over-size every
    // column for an indicator that only appears on 0-1 of them.
    void isFontLoaded;

    // ========================================================================
    // COLUMN WIDTH MEASUREMENT
    // ========================================================================
    //
    // Width calculation follows this flow:
    // 1. Measure leaf columns (bottom-up): header text + cell content + padding
    // 2. Adjust for column groups: if group header is wider than children, expand children
    // 3. Store computed widths in columnWidths state
    //
    // Width types:
    // - width="auto" or width=null: auto-sized based on content
    // - width=<number>: explicit pixel width (but may be expanded for group headers)
    //
    // The computed width stored in columnWidths is always used by the grid,
    // even for explicit-width columns that were expanded for group headers.
    // ========================================================================

    /**
     * Get all leaf columns under a column definition.
     * For groups, recursively collects all descendant leaf columns.
     * For leaf columns, returns the column itself.
     */
    function getLeafColumns(col: ColumnSpec | ColumnGroup): ColumnSpec[] {
      if (col.isGroup) {
        return col.columns.flatMap(getLeafColumns);
      }
      return [col];
    }

    /**
     * Get the effective width of a column for calculations.
     * Priority: computed width > explicit width > default minimum
     */
    function getEffectiveWidth(col: ColumnSpec): number {
      if (target[col.id] !== undefined) {
        return target[col.id];
      }
      if (typeof col.width === 'number') {
        return col.width;
      }
      return AUTO_WIDTH.MIN;
    }

    /**
     * Measure a leaf column's content and compute its width.
     * Only processes auto-width columns (width="auto" or null).
     * Explicit-width columns keep their specified width unless expanded for group headers.
     */
    function measureLeafColumn(col: ColumnSpec) {
      // Respect manual resizes — skip columns the user has resized themselves.
      if (userResizedIds.has(col.id)) return;

      // Fixed-width columns keep their pixel width, but when the user has
      // explicitly shown a header (show_header = TRUE), we still need to
      // guarantee the header fits — otherwise the label truncates with an
      // ellipsis (a surprise when you've opted into showing it). Measure
      // header text and bump the column's width up to fit.
      if (typeof col.width === 'number') {
        if (resolveShowHeader(col.showHeader, col.header) && col.header) {
          ctx!.font = headerFont;
          // Viz columns pad header text by VIZ_MARGIN per side (plot-header
          // CSS rule), not the standard cell padding — account for that so
          // the measured width matches actual render.
          const isViz = col.type === "forest" || col.type === "viz_bar" ||
                        col.type === "viz_boxplot" || col.type === "viz_violin";
          const pad = isViz ? VIZ_MARGIN * 2 : cellPadding;
          const headerWidth = Math.ceil(
            ctx!.measureText(col.header).width + pad + TEXT_MEASUREMENT.RENDERING_BUFFER,
          );
          if (headerWidth > col.width) {
            target[col.id] = Math.min(AUTO_WIDTH.MAX, headerWidth);
          }
        }
        return;
      }

      // Only auto-size columns with width="auto", null, or undefined (omitted)
      // Use != null to match both null and undefined (R's NULL may serialize as omitted property)
      if (col.width != null && col.width !== "auto") return;

      let maxWidth = 0;

      // Measure header text with bold font
      if (col.header) {
        ctx!.font = headerFont;
        maxWidth = Math.max(maxWidth, ctx!.measureText(col.header).width);
      }

      // Measure all data cell values with normal font
      ctx!.font = dataFont;
      for (const row of spec!.data.rows) {
        if (row.style?.type === "header" || row.style?.type === "spacer") {
          continue;
        }
        const text = getColumnDisplayText(row, col);
        if (text) {
          maxWidth = Math.max(maxWidth, ctx!.measureText(text).width);
        }
      }

      // Glyph-column natural geometry (pictogram/icon/ring/stars):
      // getColumnDisplayText() returns "" for these so the row loop above
      // measures only the header. Layer in the rendered-pixel width here
      // so columns auto-size to fit their actual data.
      maxWidth = Math.max(maxWidth, glyphNaturalWidth(col, spec!.data.rows));

      // Apply padding (from theme) and constraints.
      const typeMin = AUTO_WIDTH.VISUAL_MIN[col.type] ?? AUTO_WIDTH.MIN;
      const computedWidth = Math.min(
        AUTO_WIDTH.MAX,
        Math.max(typeMin, Math.ceil(maxWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER)),
      );
      target[col.id] = computedWidth;
    }

    /**
     * Process columns recursively (bottom-up).
     * 1. For groups: process children first, then check if group header needs more width
     * 2. For leaves: measure content and set width
     *
     * Group header width check:
     * - Measures group header text + padding
     * - Compares to sum of all leaf column widths under this group
     * - If header is wider, distributes extra width evenly to ALL children
     *   (including explicit-width columns, to ensure header fits)
     */
    function processColumn(col: ColumnSpec | ColumnGroup) {
      if (col.isGroup) {
        // Process children first (bottom-up)
        for (const child of col.columns) {
          processColumn(child);
        }

        // Check if group header needs more width than children provide
        if (col.header) {
          ctx!.font = headerFont;
          // Group header needs: text width + its own padding (from theme) + rendering buffer.
          const groupHeaderWidth = ctx!.measureText(col.header).width + groupPadding + TEXT_MEASUREMENT.RENDERING_BUFFER;

          const leafCols = getLeafColumns(col);
          const childrenTotalWidth = leafCols.reduce((sum, leaf) => sum + getEffectiveWidth(leaf), 0);

          // If group header needs more width, distribute extra to children that
          // haven't been resized by the user. User-resized columns keep their width.
          const resizable = leafCols.filter((l) => !userResizedIds.has(l.id));
          if (groupHeaderWidth > childrenTotalWidth && resizable.length > 0) {
            const extraPerChild = Math.ceil((groupHeaderWidth - childrenTotalWidth) / resizable.length);
            for (const leaf of resizable) {
              target[leaf.id] = getEffectiveWidth(leaf) + extraPerChild;
            }
          }
        }
        return;
      }

      // Leaf column: measure it
      measureLeafColumn(col);
    }

    // Process all top-level column definitions
    for (const colDef of spec.columns) {
      processColumn(colDef);
    }

    // Measure the primary (leftmost) column's extra chrome — indentation,
    // badges, and group-header rendering all live in the primary cell.
    // We take the MAX of the regular leaf measurement and these enhancements.
    const primaryCol = allColumns[0];
    if (primaryCol && !userResizedIds.has(primaryCol.id)) {
      let maxLabelWidth = 0;
      // No row-drag-handle budget — dragging happens via pointerdown on the
      // whole primary cell, not a visible grip icon.
      const rowGripBudget = 0;

      // Build group depth map for calculating row indentation
      const groupDepths = new Map<string, number>();
      for (const group of spec.data.groups) {
        groupDepths.set(group.id, group.depth);
      }

      // Helper to get row depth (group depth + 1 for data rows)
      const getRowDepth = (groupId: string | null | undefined): number => {
        if (!groupId) return 0;
        const groupDepth = groupDepths.get(groupId) ?? 0;
        return groupDepth + 1;
      };

      // Measure primary-column header with bold font
      if (primaryCol.header) {
        ctx!.font = headerFont;
        maxLabelWidth = Math.max(maxLabelWidth, ctx!.measureText(primaryCol.header).width);
      }

      // Measure all row labels with normal font (accounting for group depth, indent, and badges)
      ctx!.font = dataFont;
      const baseFontSize = parseFloat(fontSize);
      for (const row of spec.data.rows) {
        if (row.label) {
          // Total indent = group-based depth + row-level indent
          const depth = getRowDepth(row.groupId);
          const rowIndent = row.style?.indent ?? 0;
          const totalIndent = depth + rowIndent;
          const indentWidth = totalIndent * SPACING.INDENT_PER_LEVEL;
          let rowWidth = ctx!.measureText(row.label).width + indentWidth + rowGripBudget;

          // Account for badge width if present (uses shared BADGE constants)
          if (row.style?.badge) {
            const badgeText = String(row.style.badge);
            const badgeFontSize = baseFontSize * BADGE.FONT_SCALE;
            ctx!.font = `${badgeFontSize}px ${fontFamily}`;
            const badgeTextWidth = ctx!.measureText(badgeText).width;
            const badgeWidth = badgeTextWidth + BADGE.PADDING * 2;
            rowWidth += BADGE.GAP + badgeWidth;
            ctx!.font = dataFont; // restore font
          }

          maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
        }
      }

      // ========================================================================
      // MEASURE ROW GROUP HEADERS
      // ========================================================================
      // Group headers in the label column include multiple elements:
      // [indent][chevron][gap][label][gap][count][internal-padding]
      // See GROUP_HEADER constants in rendering-constants.ts
      // ========================================================================

      // Helper to count all descendant rows (matching display logic in displayRows)
      // This includes direct rows AND rows in nested subgroups
      function countAllDescendantRowsForGroup(groupId: string): number {
        let count = 0;
        // Direct rows in this group
        for (const row of spec!.data.rows) {
          if (row.groupId === groupId) count++;
        }
        // Rows in child groups (recursively)
        for (const g of spec!.data.groups) {
          if (g.parentId === groupId) {
            count += countAllDescendantRowsForGroup(g.id);
          }
        }
        return count;
      }

      // Only include the count width when group counts will actually be rendered.
      const showGroupCounts = !!spec.interaction.showGroupCounts;
      ctx!.font = headerFont;
      for (const group of spec.data.groups) {
        if (group.label) {
          const indentWidth = group.depth * SPACING.INDENT_PER_LEVEL;
          const labelWidth = ctx!.measureText(group.label).width;

          // Row count "(n)" is optional — budget 0 when hidden.
          let countWidth = 0;
          if (showGroupCounts) {
            const rowCount = countAllDescendantRowsForGroup(group.id);
            const countText = `(${rowCount})`;
            const countFontSize = baseFontSize * 0.75; // font-size-sm
            ctx!.font = `${countFontSize}px ${fontFamily}`;
            countWidth = ctx!.measureText(countText).width + GROUP_HEADER.GAP;
            ctx!.font = headerFont;
          }

          // Total: all components from GroupHeader.svelte layout
          const totalWidth = indentWidth
            + rowGripBudget
            + GROUP_HEADER.CHEVRON_WIDTH
            + GROUP_HEADER.GAP
            + labelWidth
            + countWidth
            + GROUP_HEADER.SAFETY_MARGIN;

          maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        }
      }

      // Apply padding (from theme) and constraints (primary column has higher max).
      // Take the MAX with any regular-column measurement — the primary column
      // is measured like a normal leaf first, then widened here if its row-chrome
      // (indent/badges/group chevron) demands more space.
      const computedLabelWidth = Math.min(
        AUTO_WIDTH.LABEL_MAX,
        Math.max(AUTO_WIDTH.MIN, Math.ceil(maxLabelWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER)),
      );
      target[primaryCol.id] = Math.max(target[primaryCol.id] ?? 0, computedLabelWidth);
    }

    // ========================================================================
    // WRAP LINE COUNT MEASUREMENT (v0.22)
    // ========================================================================
    //
    // Once column widths are finalized, count how many lines each
    // wrap-enabled cell will render at — both author-supplied `\n`
    // breaks AND canvas-measured wrap of long strings within the cell's
    // content area. Per-row max contributes to the layout's
    // rowHeights[i] so grid-template-rows reserves the right space.
    //
    // Schema:
    //   col.wrap = false / 0 → cap at 1 line  (no wrap, ellipsis)
    //   col.wrap = true / 1  → cap at 2 lines (1 extra)
    //   col.wrap = n         → cap at n+1 lines
    {
      const wrapEnabledCols = allColumns.filter(c => {
        const w = c.wrap;
        return typeof w === "number" ? w > 0 : !!w;
      });
      const lineCaps = new Map<string, number>();
      for (const c of wrapEnabledCols) {
        const w = c.wrap as boolean | number;
        const cap = typeof w === "number" ? w + 1 : (w ? 2 : 1);
        lineCaps.set(c.id, cap);
      }

      const counts: Record<string, number> = {};
      if (wrapEnabledCols.length > 0) {
        ctx.font = dataFont;
        for (const row of spec.data.rows) {
          let maxLines = 1;
          for (const col of wrapEnabledCols) {
            const colWidth = target[col.id] ?? AUTO_WIDTH.MIN;
            const contentWidth = Math.max(1, colWidth - cellPadding);
            const raw = (row.metadata as Record<string, unknown>)[col.field];
            const text = raw == null ? "" : String(raw);
            if (text === "") continue;
            // Split on author-supplied \n first; each segment may wrap.
            const segments = text.split(/\r?\n/);
            let cellLines = 0;
            for (const seg of segments) {
              if (seg.length === 0) {
                cellLines += 1;
                continue;
              }
              const w = ctx.measureText(seg).width;
              cellLines += Math.max(1, Math.ceil(w / contentWidth));
            }
            const cap = lineCaps.get(col.id) ?? 1;
            const capped = Math.min(cellLines, cap);
            if (capped > maxLines) maxLines = capped;
          }
          if (maxLines > 1) counts[row.id] = maxLines;
        }
      }
      // Only mutate state when the measurement actually changed — Svelte
      // 5 runes assign-equal still triggers downstream $derived; cheap to
      // skip a no-op write.
      const prev = cells.wrapLineCounts;
      let changed = false;
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(counts);
      if (prevKeys.length !== nextKeys.length) changed = true;
      else {
        for (const k of nextKeys) if (prev[k] !== counts[k]) { changed = true; break; }
      }
      if (changed) cells.setWrapLineCounts(counts);
    }
  }

  function setDimensions(w: number, h: number) {
    // Set initial dimensions (used as fallback before ResizeObserver fires)
    initialWidth = w;
    initialHeight = h;
  }

  // setSelectedRows + paintRowWithActiveToken + paintCellWithActiveToken
  // live on the semantics slice (Phase 0c-C1 PR6).

  // toggleGroup lives on the rows-groups slice (Phase 0c-C1 PR5).

  // Settings panel visibility
  function openSettings() {
    settingsOpen = true;
  }
  function closeSettings() {
    settingsOpen = false;
  }
  function toggleSettings() {
    settingsOpen = !settingsOpen;
  }

  /**
   * Set the runtime banding override. Accepts either the user-facing string
   * form ("none" / "row" / "group" / "group-n"), a parsed BandingSpec, or
   * null to clear the override (falls back to the theme value).
   */
  function setBandingOverride(value: string | BandingSpec | null) {
    if (value == null) {
      bandingOverride = null;
    } else if (typeof value === "string") {
      bandingOverride = parseBandingString(value);
    } else {
      bandingOverride = value;
    }
    markSource("banding");
  }

  /**
   * Override the BABA/ABAB starting phase. Pass `null` to revert to the
   * mode default (BABA for group, ABAB for row).
   */
  function setBandingStartsWithBand(value: boolean | null) {
    bandingStartsWithBandOverride = value;
    markSource("banding");
  }

  // Sort + filter methods live on the sort-filter slice (Phase 0c-C1 PR4).
  // Public-API passthrough below.

  // =========================================================================
  // DnD scope helpers and actions
  // =========================================================================

  // Find scope key for a column id: parent column-group id, or "__root__" if top-level.
  function findColumnScope(id: string): string | null {
    if (!spec) return null;
    for (const def of effectiveColumnDefs) {
      if (def.id === id) return "__root__";
      if (def.isGroup) {
        for (const child of def.columns) {
          if (child.id === id) return def.id;
        }
      }
    }
    return null;
  }

  function siblingsForColumnScope(scopeKey: string): ColumnDef[] {
    if (scopeKey === "__root__") return effectiveColumnDefs;
    const group = effectiveColumnDefs.find((d) => d.isGroup && d.id === scopeKey) as ColumnGroup | undefined;
    return group ? group.columns : [];
  }

  // beginDrag / updateDrag / endDrag / cancelDrag live on the drag
  // micro-slice (Phase 0c-C1 PR7).

  // Move a column (leaf or group) to `newIndex` within its scope.
  // For leaves, scope = parent column-group id or "__root__"; for groups, scope = "__root__".
  function moveColumnItem(itemId: string, newIndex: number) {
    const scope = findColumnScope(itemId) ?? (effectiveColumnDefs.some((d) => d.id === itemId) ? "__root__" : null);
    if (!scope) return;
    const siblings = siblingsForColumnScope(scope);
    const order = siblings.map((d) => d.id);
    const fromIdx = order.indexOf(itemId);
    if (fromIdx === -1) return;

    order.splice(fromIdx, 1);
    const targetIdx = newIndex > fromIdx ? newIndex - 1 : newIndex;
    const clamped = Math.max(0, Math.min(order.length, targetIdx));
    order.splice(clamped, 0, itemId);

    if (scope === "__root__") {
      columnOrderOverrides = { ...columnOrderOverrides, topLevel: order };
    } else {
      columnOrderOverrides = {
        ...columnOrderOverrides,
        byGroup: { ...columnOrderOverrides.byGroup, [scope]: order },
      };
    }
    // Record with the 1-based new index (matches R's semantics).
    appendOp(ops.moveColumn(itemId, newIndex + 1));
    markSource("column_order");
  }

  // Row-scope helpers (findRowGroupScope / siblingsForRow*) +
  // moveRowItem / moveRowGroupItem / clearRowReorder live on the
  // rows-groups slice (Phase 0c-C1 PR5).

  function clearColumnReorder() {
    columnOrderOverrides = { topLevel: null, byGroup: {} };
  }

  // =========================================================================
  // Interactive column add / remove / configure
  // =========================================================================

  // Pick an id that isn't already taken anywhere in the effective tree.
  function mintUniqueColumnId(base: string): string {
    // Collect every id currently "in use" — not just the visible spec, but
    // also hidden columns, configured overrides, and orphan entries still
    // sitting in the per-id state maps. Without this, hiding a column and
    // then re-adding one with the same base name would silently overwrite
    // the hidden column's width / axis zoom / override.
    const taken = new Set<string>(RESERVED_COLUMN_IDS);
    const walk = (defs: ColumnDef[]) => {
      for (const d of defs) {
        taken.add(d.id);
        if (d.isGroup) walk(d.columns);
      }
    };
    if (spec) walk(spec.columns);
    walk(userInsertedColumns.map((i) => i.def) as ColumnDef[]);
    for (const id of hiddenColumnIds) taken.add(id);
    for (const id of Object.keys(columnSpecOverrides)) taken.add(id);
    for (const id of Object.keys(columnWidths)) taken.add(id);
    for (const id of Object.keys(axis.axisZooms)) taken.add(id);
    for (const id of userResizedIds) taken.add(id);

    return mintUniqueId(base, taken);
  }

  // Insert a new column after `afterId`. Pass "__start__" to insert at position 0.
  function insertColumn(def: ColumnSpec, afterId: string) {
    const id = mintUniqueColumnId(def.id || def.field);
    userInsertedColumns = [...userInsertedColumns, { afterId, def: { ...def, id } }];
    const after = afterId === "__start__" ? "__start__" : afterId;
    appendOp(ops.addColumn(renderColumnBuilder(def), after));
    markSource("column_order");
  }

  // Hide a column (reversible via clearColumnEdits).
  function hideColumn(id: string) {
    if (hiddenColumnIds.has(id)) return;
    const next = new Set(hiddenColumnIds);
    next.add(id);
    hiddenColumnIds = next;
    appendOp(ops.removeColumn(id));
    markSource("hidden_columns");
    markSource("column_order");
  }

  // Replace an existing column's spec. Works for both author-defined and
  // user-inserted columns (the latter are updated in place in userInsertedColumns).
  function updateColumn(id: string, newSpec: ColumnSpec) {
    const insertedIdx = userInsertedColumns.findIndex((c) => c.def.id === id);
    if (insertedIdx >= 0) {
      const next = userInsertedColumns.slice();
      next[insertedIdx] = { ...next[insertedIdx], def: { ...newSpec, id } };
      userInsertedColumns = next;
    } else {
      columnSpecOverrides = { ...columnSpecOverrides, [id]: { ...newSpec, id } };
    }
    // For the log we emit a thin summary: header + type. Full config would
    // be noisy — users follow up with the configure popover, which emits
    // targeted set_*() calls as we deepen coverage.
    const patch: Record<string, unknown> = {};
    if (newSpec.header !== undefined) patch.header = newSpec.header;
    if (newSpec.type !== undefined) patch.type = newSpec.type;
    appendOp(ops.updateColumn(id, patch));
  }

  /**
   * Apply a partial patch to a column. Reads the current spec from the
   * effective column defs, merges the patch (top-level fields replace;
   * `options` deep-merges), and persists via {@link updateColumn}.
   *
   * Replaces the imperative merge logic that previously lived in
   * `proxyMethods.updateColumn` (spec S11). Other callers can use this
   * for "modify these fields, keep the rest" semantics without having
   * to re-construct a full ColumnSpec.
   */
  function updateColumnPatch(
    id: string,
    patch: {
      header?: ColumnSpec["header"];
      align?: ColumnSpec["align"];
      headerAlign?: ColumnSpec["headerAlign"];
      wrap?: ColumnSpec["wrap"];
      sortable?: ColumnSpec["sortable"];
      width?: ColumnSpec["width"];
      type?: ColumnSpec["type"];
      field?: ColumnSpec["field"];
      options?: Record<string, unknown>;
    },
  ) {
    const current = allColumns.find((c) => c.id === id);
    if (!current) return;
    const next: ColumnSpec = { ...current };
    if (patch.header !== undefined)      next.header = patch.header;
    if (patch.align !== undefined)       next.align = patch.align;
    if (patch.headerAlign !== undefined) next.headerAlign = patch.headerAlign;
    if (patch.wrap !== undefined)        next.wrap = patch.wrap;
    if (patch.sortable !== undefined)    next.sortable = patch.sortable;
    if (patch.width !== undefined)       next.width = patch.width;
    if (patch.type !== undefined)        next.type = patch.type;
    if (patch.field !== undefined)       next.field = patch.field;
    if (patch.options !== undefined)     next.options = { ...(next.options ?? {}), ...patch.options };
    updateColumn(id, next);
  }

  // Drop all user-driven add/hide/configure edits.
  function clearColumnEdits() {
    userInsertedColumns = [];
    hiddenColumnIds = new Set();
    columnSpecOverrides = {};
  }

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

  function setColumnWidth(columnId: string, width: number) {
    const w = Math.max(40, width); // min 40px
    columnWidths[columnId] = w;
    // Mark as user-resized so future measurement passes don't overwrite it.
    if (!userResizedIds.has(columnId)) {
      const next = new Set(userResizedIds);
      next.add(columnId);
      userResizedIds = next;
    }
    appendOp(ops.resizeColumn(columnId, w));
    markSource("column_widths");
  }

  /**
   * Live-preview a column width during drag without recording it to the op
   * log. Callers should still call `setColumnWidth()` on pointerup to commit
   * the final settled value — that's the one that ends up in the "View source"
   * history. Added to keep dragging a single resize handle from emitting
   * dozens of `resize_column()` records per pixel moved.
   */
  function previewColumnWidth(columnId: string, width: number) {
    const w = Math.max(40, width);
    columnWidths[columnId] = w;
    if (!userResizedIds.has(columnId)) {
      const next = new Set(userResizedIds);
      next.add(columnId);
      userResizedIds = next;
    }
  }

  function getColumnWidth(columnId: string): number | undefined {
    return columnWidths[columnId];
  }

  function setPlotWidth(newWidth: number | null) {
    plotWidthOverride = newWidth === null ? null : Math.max(100, newWidth); // min 100px
    markSource("plot_width");
  }

  function getPlotWidth(): number | null {
    return plotWidthOverride;
  }

  // -- Aspect-ratio target ----------------------------------------------------
  // Setter pushes a record onto the op log so "View source" can emit
  // `set_aspect_ratio(N)` (or `set_aspect_ratio(NULL)` when cleared). The
  // layout derived above reads `targetAspect` directly and walks the lever
  // ladder; mutations here automatically propagate through the reactive
  // graph.
  // Hard bounds on a settable aspect ratio. Below TARGET_ASPECT_MIN /
  // above TARGET_ASPECT_MAX, the lever ladder produces visually broken
  // layouts (rows clipped to floor + degenerate widths) and at extreme
  // values the layout grows past sane DOM sizes (millions of pixels).
  // 0.1 to 10 covers any sensible aspect from 1:10 (mobile-ish portrait)
  // to 10:1 (a banner) and rejects nonsense input from the slider /
  // proxy / fluent API alike.
  const TARGET_ASPECT_MIN = 0.1;
  const TARGET_ASPECT_MAX = 10;
  function setTargetAspect(ratio: number | null): void {
    if (ratio != null && !Number.isFinite(ratio)) return;
    if (ratio != null && ratio <= 0) return;
    const clamped = ratio == null
      ? null
      : Math.max(TARGET_ASPECT_MIN, Math.min(TARGET_ASPECT_MAX, ratio));
    if (targetAspect === clamped) return;
    targetAspect = clamped;
    appendOp(ops.setAspectRatio(clamped));
  }

  function getTargetAspect(): number | null {
    return targetAspect;
  }

  // Set the anchor mode for the aspect ladder's target-dim resolution
  // ("width" preserves natural-w, "height" preserves natural-h, "auto"
  // picks at runtime). Mutates the *spec* (so the layout-derived getter
  // picks it up reactively) plus appends an op so "View source" emits
  // the matching set_aspect_ratio() call. No-op when the anchor doesn't
  // change (avoids spurious op log entries when the slider is dragged).
  function setTargetAspectAnchor(anchor: "width" | "height" | "auto"): void {
    if (!spec) return;
    const current = spec.targetAspectAnchor ?? "width";
    if (current === anchor) return;
    spec = { ...spec, targetAspectAnchor: anchor };
    // Re-emit the active aspect with the new anchor so source code reflects it.
    if (targetAspect != null) {
      appendOp(ops.setAspectRatio(targetAspect, anchor));
    }
  }

  // -- Per-column axis pan/zoom ------------------------------------------------
  // Methods live on the axis slice (Phase 0c-C1 PR3); public-API passthrough below.

  /**
   * Deep clone a WebTheme. Uses JSON round-trip (not structuredClone) because
   * the theme objects we receive here are sometimes Svelte $state proxies,
   * whose internal slots trip structuredClone's DataCloneError path. Themes
   * are strictly JSON-safe (strings / numbers / booleans / nested objects /
   * nulls — no Maps, Sets, Dates, functions), so the round-trip is lossless.
   */
  // Theme management methods moved to the theme slice (Phase 0c-C1 PR2).
  // `clearAutoWidthsKeepingUserResizes` stays here for now — it touches
  // columns-owned state (columnWidths + userResizedIds) and migrates to
  // the columns slice in a later PR. The theme slice calls it via dep.

  /**
   * Drop cached auto-widths so measureAutoColumns can recompute them, but
   * keep user-resized entries intact. Without this, density/theme/font
   * edits would clear `columnWidths` for user-resized columns too — and
   * since measureAutoColumns explicitly skips those (`userResizedIds`
   * gate), the column ends up with no recorded width and collapses.
   * Hit by bugs (1) + (4): "manually-resized viz column collapses on
   * density change."
   */
  function clearAutoWidthsKeepingUserResizes() {
    if (userResizedIds.size === 0) {
      columnWidths = {};
      return;
    }
    const next: Record<string, number> = {};
    for (const id of userResizedIds) {
      const w = columnWidths[id];
      if (typeof w === "number") next[id] = w;
    }
    columnWidths = next;
  }

  // `setSemanticField` removed in Phase 0b (orphan; no callers). The
  // setThemeField path covers the same edits via a generic path-based
  // API.

  /**
   * Set the table watermark. Empty string clears the watermark (matches the
   * `tabviz(watermark = NULL)` semantic). This is a spec-level field, not a
   * theme edit — it doesn't go through themeEdits and isn't exported by
   * View source today.
   */
  function setWatermark(value: string) {
    if (!spec) return;
    spec = { ...spec, watermark: value };
    // Empty string means "clear" in the R API — emit NULL so the recorded
    // line reads `set_watermark(NULL)` rather than `set_watermark("")`.
    const text = value === "" ? null : value;
    appendOp(ops.setWatermark(text));
  }

  /**
   * Live-preview the watermark text while typing; no op-log emission. UI
   * callers wired to `<input oninput={...}>` use this; `setWatermark` fires
   * on blur/Enter to emit one record per finished edit.
   */
  function previewWatermark(value: string) {
    if (!spec) return;
    spec = { ...spec, watermark: value };
  }

  /** Set or clear the watermark text color. Non-recorded preview: same
   *  pattern as color-picker on theme fields. */
  function setWatermarkColor(value: string | null) {
    if (!spec) return;
    spec = { ...spec, watermarkColor: value ?? undefined };
  }

  /** Set the watermark fill opacity (0–1). Non-recorded for now — opacity
   *  changes fire on each slider tick and recording each would be noisy;
   *  this mirrors how we handle theme NumberField edits. */
  function setWatermarkOpacity(value: number) {
    if (!spec) return;
    const clamped = Math.max(0, Math.min(1, value));
    spec = { ...spec, watermarkOpacity: clamped };
  }

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
    columnOrderOverrides = { topLevel: null, byGroup: {} };
    userInsertedColumns = [];
    hiddenColumnIds = new Set();
    columnSpecOverrides = {};
    cells.reset();
    semantics.reset();
    history.reset();

    // ── Widths / zoom / sizing ───────────────────────────────────────────
    columnWidths = {};
    userResizedIds = new Set();
    plotWidthOverride = null;
    zoom = 1.0;
    autoFit = true;
    maxWidth = null;
    maxHeight = null;
    axis.reset();

    // ── Theme customizations (in-panel edits / banding overrides) ────────
    // theme.reset() wipes themeEdits + themeOverrides without touching the
    // initial-* snapshot (so resetThemeEdits below still has its target).
    theme.reset();
    bandingOverride = null;
    bandingStartsWithBandOverride = null;

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
    measureAutoColumns();
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
      return (
        userInsertedColumns.length > 0 ||
        hiddenColumnIds.size > 0 ||
        Object.keys(columnSpecOverrides).length > 0
      );
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
    getColumnWidth,
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
    setCurrentPage,
    nextPage,
    prevPage,
    setContinuousMode,
    setDimensions,
    setSelectedRows: semantics.setSelectedRows,
    toggleGroup: rowsGroups.toggleGroup,
    openSettings,
    closeSettings,
    toggleSettings,
    setBandingOverride,
    setBandingStartsWithBand,
    // Theme methods passthrough — own state lives on the theme slice.
    setThemeField: theme.setThemeField,
    setThemeFieldDerived: theme.setThemeFieldDerived,
    isOverridden: theme.isOverridden,
    clearOverride: theme.clearOverride,
    previewThemeField: theme.previewThemeField,
    setWatermark,
    previewWatermark,
    setWatermarkColor,
    setWatermarkOpacity,
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
    // DnD
    findColumnScope,
    siblingsForColumnScope,
    // Row-scope DnD helpers + row reorder methods on the rows-groups slice.
    findRowGroupScope: rowsGroups.findRowGroupScope,
    siblingsForRowScope: rowsGroups.siblingsForRowScope,
    siblingsForRowGroupScope: rowsGroups.siblingsForRowGroupScope,
    // Drag micro-slice passthrough.
    beginDrag: drag.beginDrag,
    updateDrag: drag.updateDrag,
    endDrag: drag.endDrag,
    cancelDrag: drag.cancelDrag,
    moveColumnItem,
    moveRowItem: rowsGroups.moveRowItem,
    moveRowGroupItem: rowsGroups.moveRowGroupItem,
    clearRowReorder: rowsGroups.clearRowReorder,
    clearColumnReorder,
    // Interactive column edits
    insertColumn,
    hideColumn,
    updateColumn,
    updateColumnPatch,
    clearColumnEdits,
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
    setColumnWidth,
    previewColumnWidth,
    setPlotWidth,
    setTargetAspect,
    setTargetAspectAnchor,
    getTargetAspect,
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

