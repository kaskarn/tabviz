import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from "d3-scale";
import type {
  WebSpec,
  Row,
  Group,
  ColumnSpec,
  ColumnDef,
  ColumnGroup,
  SortConfig,
  FilterConfig,
  FiltersState,
  ColumnFilter,
  ColumnKind,
  FilterOperator,
  RowOrderOverrides,
  ColumnOrderOverrides,
  CellEdits,
  EditValue,
  DragState,
  EditTarget,
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
import { computeAxis, type AxisComputation, VIZ_MARGIN } from "$lib/axis-utils";
import { THEME_PRESETS, type ThemeName } from "$lib/theme-presets";
import { getColumnDisplayText } from "$lib/formatters";
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
import { resolveShowHeader } from "$lib/column-compat";
import { ops, renderColumnBuilder, type OpRecord } from "$lib/op-recorder";

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

  // Initial dimensions (from htmlwidgets/splitStore, used as fallback before ResizeObserver fires)
  let initialWidth = $state(800);
  let initialHeight = $state(400);

  // Interaction state
  // Selection state. With the unified paint-as-selection model, the
  // "selected" rows ARE the rows currently painted with the active token.
  // We compute the live set from styleEdits + paintTool via the
  // selectedRowIds getter below; no separate state to keep in sync.
  let collapsedGroups = $state<Set<string>>(new Set());
  let sortConfig = $state<SortConfig | null>(null);
  let filterConfig = $state<FilterConfig | null>(null);
  let filters = $state<FiltersState>({});
  let hoveredRowId = $state<string | null>(null);

  // Runtime banding override from the settings panel. Null = follow theme.
  let bandingOverride = $state<BandingSpec | null>(null);
  // Runtime override for the BABA/ABAB starting phase. Null = use the default
  // for the current mode (BABA for group, ABAB for row).
  let bandingStartsWithBandOverride = $state<boolean | null>(null);
  // Settings panel visibility (gear button + slide-in)
  let settingsOpen = $state<boolean>(false);

  // ── Theme customizations ────────────────────────────────────────────────
  // In-panel edits to the active theme, tracked per section. The live
  // spec.theme is mutated in lockstep so the widget re-renders immediately;
  // this map is the source of truth for "what did the user change" (used by
  // the "View source" feature to emit an R `set_*()` chain).
  //
  // We also track the preset the chain starts from so resets can restore a
  // clean baseline and the emitted R code knows which `web_theme_*()` to
  // start with.
  let themeEdits = $state<Record<string, Record<string, unknown>>>({});
  let baseThemeName = $state<string>("default");

  // Per-path override tracking: which theme paths has the user explicitly
  // touched? Stored as joined-path strings (e.g. "row.base.bg",
  // "series.0.fill"). Drives the "overridden" dot + reset icon on the
  // Theme tab and tells the Brand multi-write which paths to leave alone.
  // Distinct from `themeEdits` — that one groups by section for source-gen;
  // this is a flat set used by panel UI logic.
  let themeOverrides = $state<Set<string>>(new Set());

  // Snapshot of the theme to restore to on resetState. Updated whenever a
  // new "clean" theme becomes active (setSpec, setTheme preset swap,
  // setThemeObject custom theme). This is NOT just `THEME_PRESETS[name]` —
  // if R supplied a pre-customized theme (`web_theme_modern() |> set_spacing(...)`),
  // those customizations live in `spec.theme` but not in the raw preset, and
  // resetting to the raw preset would silently drop them. Stored as a deep
  // clone so in-panel edits mutating `spec.theme` don't leak in here.
  let initialTheme = $state<WebSpec["theme"] | null>(null);

  // Snapshot of the incoming spec's watermark so reset can restore what the
  // caller originally supplied (possibly empty / undefined). Undefined means
  // "no spec has been set yet"; an empty string is a legitimate value.
  let initialWatermark = $state<string | undefined>(undefined);

  // User-modified view state (session-only; feeds exportSpec for WYSIWYG)
  let rowOrderOverrides = $state<RowOrderOverrides>({ byGroup: {}, groupOrderByParent: {} });
  let columnOrderOverrides = $state<ColumnOrderOverrides>({ topLevel: null, byGroup: {} });
  let cellEdits = $state<CellEdits>({ cells: {}, groups: {} });
  // Per-row max wrapped line count across all wrap-enabled cells. Computed
  // by `measureAutoColumns()` using canvas text measurement against the
  // FINAL column widths. Zero/missing entries fall back to single-line
  // (rowHeights[i] = spacing.rowHeight). Layout derives rowHeights[i] for
  // wrapped rows from this map.
  let wrapLineCounts = $state<Record<string, number>>({});
  // Append-only log of recorded fluent-R operations (see contract above).
  let opLog = $state<OpRecord[]>([]);

  // Plot-level label overrides (title / subtitle / caption / footnote). Keys
  // match EditTarget.labelField. `null` means "cleared to empty" — the export
  // path collapses these to `null` on spec.labels so R code round-trips cleanly.
  let labelEdits = $state<{
    title?: string | null;
    subtitle?: string | null;
    caption?: string | null;
    footnote?: string | null;
  }>({});

  // Semantic-flag overrides, set via the paint tool. Structure mirrors
  // cellEdits: per-row for row-scoped paint, per-cell for cell-scoped paint.
  // Each entry only records the token whose value differs from the baseline
  // spec style — missing tokens mean "inherit the R-supplied value".
  // Five semantic tokens recognized: muted, bold, emphasis, accent, fill
  // (precedence loud → quiet: fill > accent > emphasis > bold > muted).
  type SemanticToken =
    | "emphasis" | "muted" | "accent"
    | "bold" | "fill";
  type SemanticFlags = Partial<Record<SemanticToken, boolean>>;
  let styleEdits = $state<{
    rows: Record<string, SemanticFlags>;
    cells: Record<string, Record<string, SemanticFlags>>;
  }>({ rows: {}, cells: {} });

  // Transient paint-tool state. When non-null the widget is in "paint mode":
  // the cursor switches to a brush, row/cell pointerdown toggles the matching
  // flag. Cleared on Escape, on Clear-paint, or by re-clicking the active
  // token chip.
  // Paint tool — ALWAYS set. Click-to-select unified with click-to-paint:
  // every click on a paintable row/cell applies the active token. Default
  // is `accent + row` so a fresh widget behaves visually like the
  // historical click-to-select (selected-row tint = accent.muted), now
  // implemented as token application instead of a separate selection
  // concept. enableSelect=FALSE on the spec hides the toolbar picker and
  // disables the click-to-paint path; the painter is otherwise always-on.
  let paintTool = $state<{ token: SemanticToken; scope: "row" | "cell" }>(
    { token: "accent", scope: "row" },
  );

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

  // Transient UI state for DnD / edit / filter overlays
  let dragState = $state<DragState | null>(null);
  let editingTarget = $state<EditTarget | null>(null);
  let filterPopoverTarget = $state<{ field: string; header: string; anchorX: number; anchorY: number } | null>(null);

  // Tooltip state
  let tooltipRowId = $state<string | null>(null);
  let tooltipPosition = $state<{ x: number; y: number } | null>(null);

  // Column width state (for resize)
  let columnWidths = $state<Record<string, number>>({});
  // Track columns whose width was set manually by the user (via resize drag).
  // Auto-measurement (doMeasurement) skips these so user resizes survive
  // re-measurement triggered by screenshot-mode toggling.
  let userResizedIds = $state<Set<string>>(new Set());

  // Plot width override (for resizing the forest plot area)
  let plotWidthOverride = $state<number | null>(null);

  // Per-column pan/zoom overrides keyed by column id. Only viz columns
  // (forest, viz_bar, viz_boxplot, viz_violin) consult this map. Session-only.
  let axisZooms = $state<Record<string, { domain: [number, number] }>>({});

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

  // Derived: visible rows (all rows after filter/sort, but NOT collapsed filtering)
  // Collapsed filtering is handled by displayRows for proper group header display
  const visibleRows = $derived.by(() => {
    if (!spec) return [];

    // Apply any paint-tool overrides to each row BEFORE filter/sort so the
    // merged style/cellStyles follow the row through the pipeline. Edits are
    // sparse (only rows the user touched), so non-painted rows pass through
    // unchanged and avoid the spread cost.
    let rows: Row[] = spec.data.rows.map((r) => {
      const rowOv = styleEdits.rows[r.id];
      const cellOv = styleEdits.cells[r.id];
      if (!rowOv && !cellOv) return r;
      const mergedStyle = rowOv ? { ...(r.style ?? {}), ...rowOv } : r.style;
      let mergedCells = r.cellStyles;
      if (cellOv) {
        mergedCells = { ...(r.cellStyles ?? {}) };
        for (const [field, flags] of Object.entries(cellOv)) {
          mergedCells[field] = { ...(mergedCells[field] ?? {}), ...flags };
        }
      }
      return { ...r, style: mergedStyle, cellStyles: mergedCells };
    });

    // Legacy single-filter (Shiny proxy backward-compat)
    if (filterConfig) {
      rows = applyFilter(rows, filterConfig);
    }

    // New multi-column filter state (per-header popovers)
    if (Object.keys(filters).length > 0) {
      rows = applyFilters(rows, filters);
    }

    // Apply sort within group boundaries so grouped tables don't lose structure
    if (sortConfig) {
      // Resolve the ColumnSpec for the sort key — multi-field column types
      // (forest / interval / events / viz_boxplot / viz_violin) need
      // type-aware value extraction. Lookup matches by id first, then field,
      // so the column-header click can pass either.
      const sortCol = spec?.columns
        ? findColumnByKey(spec.columns, sortConfig.column)
        : undefined;
      rows = applySortWithinGroups(rows, sortConfig, sortCol);
    }

    return rows;
  });

  // Derived: axis computation (axis limits, plot region, ticks)
  // Uses the new modular axis calculation from axis-utils.ts
  // NOTE: This computes a global axis based on first forest column for backwards compat.
  // In practice, each forest column may have its own axis (handled in ForestPlot.svelte)
  const axisComputation = $derived.by((): AxisComputation => {
    if (!spec) {
      return {
        axisLimits: [0, 1],
        plotRegion: [0, 1],
        ticks: [0, 0.5, 1],
      };
    }

    // Check if we have any forest columns
    const firstForest = forestColumns[0]?.column;
    const hasForest = forestColumns.length > 0;

    // Use override if set, otherwise calculate default (25% of width, min 200px)
    // Forest column width precedence (v0.25.0): runtime drag override
    // > theme.layout.plotWidth (numeric) > auto (25% of width, min 200).
    // Honouring the theme value lets the Layout settings field actually
    // drive the live render — historically only SVG export read it.
    const themePlotWidth = spec.theme.layout?.plotWidth;
    const forestWidth = hasForest
      ? (plotWidthOverride
        ?? (typeof themePlotWidth === "number" ? themePlotWidth : Math.max(effectiveWidth * 0.25, 200)))
      : 0;

    // Get scale and nullValue from first forest column options
    const forestOptions = firstForest?.options?.forest;
    const scale = forestOptions?.scale ?? "linear";
    const nullValue = forestOptions?.nullValue ?? (scale === "log" ? 1 : 0);

    // Get inline effects from first forest column (if any)
    const effects = forestOptions?.effects ?? [];

    // Get primary effect column names from forest options (for col_forest inline definition)
    const pointCol = forestOptions?.point ?? null;
    const lowerCol = forestOptions?.lower ?? null;
    const upperCol = forestOptions?.upper ?? null;

    // Merge forest column axis overrides into theme config
    // This allows col_forest(axis_range=, axis_ticks=) to override theme defaults
    const axisConfig = { ...spec.theme.axis };
    if (forestOptions?.axisRange && Array.isArray(forestOptions.axisRange) && forestOptions.axisRange.length === 2) {
      axisConfig.rangeMin = forestOptions.axisRange[0];
      axisConfig.rangeMax = forestOptions.axisRange[1];
    }
    if (forestOptions?.axisTicks && Array.isArray(forestOptions.axisTicks)) {
      axisConfig.tickValues = forestOptions.axisTicks;
    }

    // Honor first forest column's pan/zoom override for the global scale.
    // Per-column viz components consult axisZooms directly for their own axes.
    const firstForestId = firstForest?.id;
    const domainOverride = firstForestId ? axisZooms[firstForestId]?.domain ?? null : null;

    return computeAxis({
      rows: spec.data.rows,
      config: axisConfig,
      scale,
      nullValue,
      forestWidth,
      pointSize: spec.theme.plot.pointSize,
      effects,
      pointCol,
      lowerCol,
      upperCol,
      domainOverride,
    });
  });

  // Derived: x-scale (creates D3 scale from plot region)
  // NOTE: This is a global scale for backwards compat. Each forest column may have its own scale.
  const xScale = $derived.by(() => {
    if (!spec) return scaleLinear().domain([0, 1]).range([0, 100]);

    // Get scale type from first forest column
    const firstForest = forestColumns[0]?.column;
    const forestOptions = firstForest?.options?.forest;
    const isLog = (forestOptions?.scale ?? "linear") === "log";
    const { plotRegion } = axisComputation;

    // Use override if set, otherwise calculate default (25% of width, min 200px)
    const hasForest = forestColumns.length > 0;
    // Forest column width precedence (v0.25.0): runtime drag override
    // > theme.layout.plotWidth (numeric) > auto (25% of width, min 200).
    // Honouring the theme value lets the Layout settings field actually
    // drive the live render — historically only SVG export read it.
    const themePlotWidth = spec.theme.layout?.plotWidth;
    const forestWidth = hasForest
      ? (plotWidthOverride
        ?? (typeof themePlotWidth === "number" ? themePlotWidth : Math.max(effectiveWidth * 0.25, 200)))
      : 0;

    // Add padding to range so edge labels don't get clipped
    const rangeStart = VIZ_MARGIN;
    const rangeEnd = Math.max(forestWidth - VIZ_MARGIN, rangeStart + 50);

    if (isLog) {
      // Ensure domain is positive for log scale
      const safeDomain: [number, number] = [
        Math.max(plotRegion[0], 0.01),
        Math.max(plotRegion[1], 0.02),
      ];
      return scaleLog().domain(safeDomain).range([rangeStart, rangeEnd]);
    }

    return scaleLinear().domain(plotRegion).range([rangeStart, rangeEnd]);
  });

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

  // Derived: group lookup map
  const groupMap = $derived.by((): Map<string, Group> => {
    const map = new Map<string, Group>();
    if (!spec) return map;
    for (const group of spec.data.groups) {
      map.set(group.id, group);
    }
    return map;
  });

  // Derived: group depth lookup map
  const groupDepthMap = $derived.by((): Map<string, number> => {
    const map = new Map<string, number>();
    if (!spec) return map;
    for (const group of spec.data.groups) {
      map.set(group.id, group.depth);
    }
    return map;
  });

  // Function to get row depth based on group
  // Data rows are one level deeper than their group header
  function getRowDepth(groupId: string | null | undefined): number {
    if (!groupId) return 0;
    const groupDepth = groupDepthMap.get(groupId) ?? 0;
    return groupDepth + 1;
  }

  // Helper: check if any ancestor group is collapsed (for cascading collapse)
  function isAncestorCollapsed(groupId: string | null | undefined): boolean {
    if (!groupId) return false;
    let current: string | null | undefined = groupId;
    while (current) {
      const group = groupMap.get(current);
      if (!group) break;
      // Check parent (not self) for collapse
      if (group.parentId && collapsedGroups.has(group.parentId)) {
        return true;
      }
      current = group.parentId;
    }
    return false;
  }

  // Derived: display rows (interleaves group headers with data rows)
  // Groups rows by groupId, shows ancestor headers, outputs in hierarchical order
  const displayRows = $derived.by((): DisplayRow[] => {
    if (!spec) return [];

    const result: DisplayRow[] = [];

    // 1. Group rows by groupId, then apply any per-group reorder override.
    //    Row-reorder overrides take precedence over sort within their scope.
    const rowsByGroup = new Map<string | null, Row[]>();
    for (const row of visibleRows) {
      const key = row.groupId ?? null;
      if (!rowsByGroup.has(key)) rowsByGroup.set(key, []);
      rowsByGroup.get(key)!.push(row);
    }
    for (const [key, bucket] of rowsByGroup) {
      const scopeKey = key ?? "__root__";
      const override = rowOrderOverrides.byGroup[scopeKey];
      if (!override) continue;
      const idx: Record<string, number> = {};
      override.forEach((id, i) => (idx[id] = i));
      bucket.sort((a, b) => {
        const ai = idx[a.id] ?? Number.POSITIVE_INFINITY;
        const bi = idx[b.id] ?? Number.POSITIVE_INFINITY;
        return ai - bi;
      });
    }

    // 2. Collect all groups that need headers (data groups + their ancestors)
    const groupsWithHeaders = new Set<string>();
    for (const groupId of rowsByGroup.keys()) {
      if (!groupId) continue;
      // Walk up ancestor chain to include parent groups
      let current: string | null | undefined = groupId;
      while (current) {
        groupsWithHeaders.add(current);
        current = groupMap.get(current)?.parentId;
      }
    }

    // 3. Helper to get child groups of a parent (applying any reorder override)
    function getChildGroups(parentId: string | null): Group[] {
      const matches = spec!.data.groups
        .filter(g => (g.parentId ?? null) === parentId && groupsWithHeaders.has(g.id));
      const parentKey = parentId ?? "__root__";
      const order = rowOrderOverrides.groupOrderByParent[parentKey];
      if (!order) return matches;
      const idx: Record<string, number> = {};
      order.forEach((id, i) => (idx[id] = i));
      return [...matches].sort((a, b) => {
        const ai = idx[a.id] ?? Number.POSITIVE_INFINITY;
        const bi = idx[b.id] ?? Number.POSITIVE_INFINITY;
        return ai - bi;
      });
    }

    // 3b. Helper to count all rows (direct + all descendants) for a group
    function countAllDescendantRows(groupId: string): number {
      // Direct rows in this group
      let count = rowsByGroup.get(groupId)?.length ?? 0;
      // Add rows from all child groups recursively
      for (const childGroup of getChildGroups(groupId)) {
        count += countAllDescendantRows(childGroup.id);
      }
      return count;
    }

    // 4. Recursive function to output a group and its descendants
    function outputGroup(groupId: string | null) {
      if (groupId) {
        const group = groupMap.get(groupId);
        if (!group) return;

        // Skip if any ancestor is collapsed
        if (isAncestorCollapsed(groupId)) return;

        const isCollapsed = collapsedGroups.has(group.id);
        // Count all descendant rows (direct + nested subgroups)
        const rowCount = countAllDescendantRows(groupId);

        result.push({
          type: "group_header",
          group: { ...group, collapsed: isCollapsed },
          rowCount,
          depth: group.depth,
        });

        // If collapsed, don't output children
        if (isCollapsed) return;
      }

      // Output child groups (maintaining hierarchy)
      for (const childGroup of getChildGroups(groupId)) {
        outputGroup(childGroup.id);
      }

      // Output direct data rows for this group
      const directRows = rowsByGroup.get(groupId) ?? [];
      for (const row of directRows) {
        result.push({
          type: "data",
          row,
          depth: getRowDepth(row.groupId),
        });
      }
    }

    // Start from root (groups with no parent)
    outputGroup(null);

    return result;
  });

  // Derived: maximum group depth (1-based; 0 when there are no groups).
  const maxGroupDepth = $derived.by((): number => {
    return computeMaxGroupDepth(spec?.data.groups);
  });

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

    const rowHeight = spec.theme.spacing.rowHeight;
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
    const forestWidth = hasForest
      ? (plotWidthOverride
        ?? (typeof themePlotWidth === "number" ? themePlotWidth : Math.max(effectiveWidth * 0.25, 200)))
      : 0;
    const tableWidth = effectiveWidth - forestWidth;

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
        const lines = wrapLineCounts[displayRow.row.id] ?? 1;
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

    return {
      totalWidth: effectiveWidth,
      totalHeight: Math.max(effectiveHeight, plotHeight + headerHeight + axisHeight + spec.theme.spacing.padding * 2),
      tableWidth,
      forestWidth,
      headerHeight,
      rowHeight,
      plotHeight,
      axisHeight,
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

    // Calculate sum of all column widths (excluding forest columns which have separate width).
    // The primary (leftmost) column is part of allColumns — no separate label-column slot.
    let totalColumnWidth = 0;
    for (const col of allColumns) {
      // Skip forest columns - they have their own width calculation
      if (col.type === "forest") continue;
      // Use computed width if available, otherwise spec width, otherwise default
      const w = columnWidths[col.id]
        ?? (typeof col.width === 'number' ? col.width : null)
        ?? DEFAULT_COLUMN_WIDTH;
      totalColumnWidth += w;
    }

    // Use layout.forestWidth for consistent WYSIWYG export
    // This ensures SVG total width matches what user sees on screen
    const forestWidth = layout.forestWidth;

    // Add padding
    const padding = spec.theme.spacing.padding * 2;

    return totalColumnWidth + forestWidth + padding;
  });

  // Derived: fit scale - how much we'd need to shrink to fit container
  // Only applies when autoFit is true; value < 1 means content is being clamped
  const fitScale = $derived.by((): number => {
    // Don't scale until we have measurements
    if (containerWidth <= 0 || scalableNaturalWidth <= 0) return 1;

    // Calculate scaled content width
    // Note: padding is handled by container CSS, not in this calculation.
    // containerWidth from ResizeObserver is the content box (excludes padding).
    // scalableNaturalWidth is the natural width of the scalable content.
    const contentWidth = scalableNaturalWidth * zoom;

    // Only shrink if content exceeds container (never enlarge)
    return contentWidth > containerWidth
      ? containerWidth / contentWidth
      : 1;
  });

  // Derived: actual rendered scale = zoom × fitScale (when autoFit) or just zoom
  const actualScale = $derived(
    autoFit ? Math.max(0.5, zoom * fitScale) : Math.max(0.5, Math.min(2.0, zoom))
  );

  // Derived: is auto-fit currently clamping the zoom?
  const isClamped = $derived(autoFit && fitScale < 1);

  // Actions
  function setSpec(newSpec: WebSpec) {
    // Create a new object reference to ensure derived values recompute properly
    // when switching between specs (e.g., in split forest navigation)
    spec = { ...newSpec };
    // Initialize collapsed state from spec
    collapsedGroups = new Set(
      newSpec.data.groups.filter((g) => g.collapsed).map((g) => g.id)
    );
    // A fresh spec supersedes any prior interactive column edits.
    clearColumnEdits();
    // Also reset every per-column-id map that would otherwise leak across
    // specs. `columnWidths` is cleared by `measureAutoColumns` below, but
    // `axisZooms` and `userResizedIds` had no reset path and could hand a
    // new spec a zoom / "user-resized" flag from the previous one when an
    // id happened to match.
    axisZooms = {};
    userResizedIds = new Set();
    wrapLineCounts = {};
    // Reset the op log too — a new spec is a new "session" as far as
    // recording fluent R calls is concerned.
    opLog = [];
    // Reset theme-edit tracking to the incoming theme's name; the settings
    // panel's "View source" feature emits `web_theme_<baseThemeName>() |> ...`.
    baseThemeName = newSpec.theme?.name ?? "default";
    themeEdits = {};

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

    // Snapshot the post-coercion theme as the reset target. See cloneTheme()
    // for why this is a JSON round-trip rather than structuredClone.
    initialTheme = cloneTheme(spec.theme);
    // Snapshot the incoming watermark (may be undefined / empty) so reset
    // restores whatever the R caller passed in, not a hardcoded default.
    initialWatermark = spec.watermark ?? "";

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
      const prev = wrapLineCounts;
      let changed = false;
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(counts);
      if (prevKeys.length !== nextKeys.length) changed = true;
      else {
        for (const k of nextKeys) if (prev[k] !== counts[k]) { changed = true; break; }
      }
      if (changed) wrapLineCounts = counts;
    }
  }

  function setDimensions(w: number, h: number) {
    // Set initial dimensions (used as fallback before ResizeObserver fires)
    initialWidth = w;
    initialHeight = h;
  }

  // selectRow / setSelectedRows are now thin wrappers over the painter:
  // "selecting" a row IS painting it with the currently-active token.
  // The visible "selected" set is whatever rows have the active token
  // painted on them (see selectedRowIds getter below). Keeping these
  // function names so R-side proxies (e.g. setSelectedRows from the
  // shiny proxy) still work without renaming.
  function selectRow(id: string) {
    paintRowWithActiveToken(id);
  }

  function setSelectedRows(ids: string[]) {
    // Replace = clear all rows currently painted with the active token,
    // then paint the given list. Mirrors the historical
    // setSelectedRows(['a','b','c']) semantics: those rows become "the
    // selection." Other tokens on those rows are preserved.
    const active = paintTool.token;
    const target = new Set(ids);
    // Clear active token from rows not in `ids`
    for (const rowId of Object.keys(styleEdits.rows)) {
      const flags = styleEdits.rows[rowId];
      if (flags?.[active] && !target.has(rowId)) {
        setRowSemantic(rowId, active, false);
      }
    }
    // Paint active token onto rows in `ids` that aren't yet painted.
    for (const rowId of ids) {
      if (!styleEdits.rows[rowId]?.[active]) {
        setRowSemantic(rowId, active, true);
      }
    }
  }

  // Click handler core: paint with replace-if-different / toggle-if-same.
  // - Row already has the active token → unpaint (toggle off).
  // - Row has a different token → clear the other, set the active.
  // - Row has nothing → set the active.
  // Cell scope routed through the same logic via paintCellWithActiveToken.
  function paintRowWithActiveToken(rowId: string) {
    const active = paintTool.token;
    const flags = styleEdits.rows[rowId] ?? {};
    if (flags[active]) {
      // Toggle off
      setRowSemantic(rowId, active, false);
      return;
    }
    // Replace: clear any other token currently set, then apply active.
    const allTokens: SemanticToken[] =
      ["emphasis", "muted", "accent", "bold", "fill"];
    for (const t of allTokens) {
      if (t !== active && flags[t]) setRowSemantic(rowId, t, false);
    }
    setRowSemantic(rowId, active, true);
  }
  function paintCellWithActiveToken(rowId: string, field: string) {
    const active = paintTool.token;
    const flags = styleEdits.cells[rowId]?.[field] ?? {};
    if (flags[active]) {
      setCellSemantic(rowId, field, active, false);
      return;
    }
    const allTokens: SemanticToken[] =
      ["emphasis", "muted", "accent", "bold", "fill"];
    for (const t of allTokens) {
      if (t !== active && flags[t]) setCellSemantic(rowId, field, t, false);
    }
    setCellSemantic(rowId, field, active, true);
  }

  function toggleGroup(id: string, collapsed?: boolean) {
    const newCollapsed = new Set(collapsedGroups);
    const shouldCollapse = collapsed ?? !newCollapsed.has(id);

    if (shouldCollapse) {
      newCollapsed.add(id);
    } else {
      newCollapsed.delete(id);
    }

    collapsedGroups = newCollapsed;
  }

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
      return;
    }
    if (typeof value === "string") {
      bandingOverride = parseBandingString(value);
      return;
    }
    bandingOverride = value;
  }

  /**
   * Override the BABA/ABAB starting phase. Pass `null` to revert to the
   * mode default (BABA for group, ABAB for row).
   */
  function setBandingStartsWithBand(value: boolean | null) {
    bandingStartsWithBandOverride = value;
  }

  function sortBy(column: string, direction: "asc" | "desc" | "none") {
    sortConfig = direction === "none" ? null : { column, direction };
    if (direction !== "none") {
      appendOp(ops.sortRows(column, direction));
    }
  }

  // Cycle sort state for a column: none → asc → desc → none
  function toggleSort(column: string) {
    if (!sortConfig || sortConfig.column !== column) {
      sortConfig = { column, direction: "asc" };
      appendOp(ops.sortRows(column, "asc"));
    } else if (sortConfig.direction === "asc") {
      sortConfig = { column, direction: "desc" };
      appendOp(ops.sortRows(column, "desc"));
    } else {
      sortConfig = null;
      // Cycling back to "no sort" is the natural inverse of `sort_rows(...)`.
      // Emit `clear_filters()`-style reset via a dedicated verb? For now we
      // omit — the recorder's append-only model already contains the prior
      // sort, and there's no `sort_rows(..., direction = "none")` form in
      // the R API yet. Author can clear by re-clicking or by editing.
    }
  }

  function setFilter(filter: FilterConfig | null) {
    filterConfig = filter;
    if (filter) {
      appendOp(ops.setFilter(filter.field, filter.operator, filter.value));
    }
  }

  // Multi-column filter API (per-header popovers)
  function setColumnFilter(field: string, filter: ColumnFilter | null) {
    if (filter === null) {
      const { [field]: _removed, ...rest } = filters;
      filters = rest;
      // A per-column clear is a no-op when the column wasn't filtered to
      // begin with; the recorder treats it as "remove this one filter"
      // which the R side expresses as `filter_rows(col, op = "none", …)`.
      // For now we record nothing on clear — the "View source" panel
      // already reflects the absence.
    } else {
      filters = { ...filters, [field]: filter };
      appendOp(ops.setFilter(field, filter.operator, filter.value));
    }
  }

  function clearAllFilters() {
    const hadFilters = Object.keys(filters).length > 0 || filterConfig !== null;
    filters = {};
    filterConfig = null;
    if (hadFilters) appendOp(ops.clearFilters());
  }

  function getColumnFilter(field: string): ColumnFilter | null {
    return filters[field] ?? null;
  }

  // Detect filter UI kind for a column: numeric range / categorical checklist / text contains.
  function detectColumnKind(field: string): ColumnKind {
    if (!spec) return "text";
    const col = allColumns.find((c) => c.field === field);
    const numericTypes: ColumnSpec["type"][] = [
      "numeric", "bar", "pvalue", "heatmap", "progress", "range",
    ];
    if (col && numericTypes.includes(col.type)) return "numeric";

    // Sample non-null values
    const sample: unknown[] = [];
    for (const row of spec.data.rows) {
      const v = readField(row, field);
      if (v !== undefined && v !== null) sample.push(v);
      if (sample.length >= 200) break;
    }
    if (sample.length === 0) return "text";
    const allNum = sample.every((v) => typeof v === "number");
    if (allNum) return "numeric";

    const distinct = new Set(sample.map((v) => String(v)));
    const rowsN = spec.data.rows.length || sample.length;
    const maxCat = Math.max(20, Math.floor(rowsN / 5));
    if (distinct.size <= maxCat) return "categorical";
    return "text";
  }

  function getColumnValues(field: string): unknown[] {
    if (!spec) return [];
    const seen = new Set<string>();
    const out: unknown[] = [];
    for (const row of spec.data.rows) {
      const v = readField(row, field);
      if (v === undefined || v === null || v === "") continue;
      const key = String(v);
      if (!seen.has(key)) { seen.add(key); out.push(v); }
    }
    out.sort((a, b) => {
      if (typeof a === "number" && typeof b === "number") return a - b;
      return String(a).localeCompare(String(b));
    });
    return out;
  }

  function getColumnNumericRange(field: string): [number, number] | null {
    if (!spec) return null;
    let lo = Infinity;
    let hi = -Infinity;
    let any = false;
    for (const row of spec.data.rows) {
      const v = readField(row, field);
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        any = true;
      }
    }
    return any ? [lo, hi] : null;
  }

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

  function beginDrag(partial: Omit<DragState, "threshold" | "active" | "indicatorIndex" | "currentX" | "currentY">) {
    dragState = {
      ...partial,
      currentX: partial.startX,
      currentY: partial.startY,
      threshold: 4,
      active: false,
      indicatorIndex: null,
    };
  }

  function updateDrag(clientX: number, clientY: number, indicatorIndex: number | null) {
    if (!dragState) return;
    const dx = clientX - dragState.startX;
    const dy = clientY - dragState.startY;
    const active = dragState.active || Math.hypot(dx, dy) > dragState.threshold;
    dragState = { ...dragState, currentX: clientX, currentY: clientY, active, indicatorIndex };
  }

  function endDrag(commit: (state: DragState) => void) {
    if (!dragState) return;
    if (dragState.active && dragState.indicatorIndex != null) commit(dragState);
    dragState = null;
  }

  function cancelDrag() {
    dragState = null;
  }

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
  }

  // Find the group id of a row-group, given the group id itself.
  // Returns parent id or "__root__".
  function findRowGroupScope(groupId: string): string {
    if (!spec) return "__root__";
    const g = spec.data.groups.find((x) => x.id === groupId);
    return g?.parentId ?? "__root__";
  }

  // Ordered sibling ids for a row-scope (row's groupId) in the current display.
  function siblingsForRowScope(scopeKey: string): string[] {
    if (!spec) return [];
    const result: string[] = [];
    for (const dr of displayRows) {
      if (dr.type === "data") {
        const gid = dr.row.groupId ?? "__root__";
        if (gid === scopeKey) result.push(dr.row.id);
      }
    }
    return result;
  }

  function siblingsForRowGroupScope(parentKey: string): string[] {
    if (!spec) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const dr of displayRows) {
      if (dr.type === "group_header") {
        const parent = dr.group.parentId ?? "__root__";
        if (parent === parentKey && !seen.has(dr.group.id)) {
          seen.add(dr.group.id);
          result.push(dr.group.id);
        }
      }
    }
    return result;
  }

  function moveRowItem(rowId: string, newIndex: number) {
    if (!spec) return;
    const row = spec.data.rows.find((r) => r.id === rowId);
    if (!row) return;
    const scope = row.groupId ?? "__root__";
    const currentOrder = rowOrderOverrides.byGroup[scope] ?? siblingsForRowScope(scope);
    const order = currentOrder.includes(rowId) ? [...currentOrder] : [...siblingsForRowScope(scope)];
    const fromIdx = order.indexOf(rowId);
    if (fromIdx === -1) return;
    order.splice(fromIdx, 1);
    const targetIdx = newIndex > fromIdx ? newIndex - 1 : newIndex;
    const clamped = Math.max(0, Math.min(order.length, targetIdx));
    order.splice(clamped, 0, rowId);
    rowOrderOverrides = {
      ...rowOrderOverrides,
      byGroup: { ...rowOrderOverrides.byGroup, [scope]: order },
    };
    appendOp(ops.moveRow(rowId, newIndex + 1));
  }

  function moveRowGroupItem(groupId: string, newIndex: number) {
    if (!spec) return;
    const parentKey = findRowGroupScope(groupId);
    const existing = rowOrderOverrides.groupOrderByParent[parentKey] ?? siblingsForRowGroupScope(parentKey);
    const order = [...existing];
    const fromIdx = order.indexOf(groupId);
    if (fromIdx === -1) return;
    order.splice(fromIdx, 1);
    const targetIdx = newIndex > fromIdx ? newIndex - 1 : newIndex;
    const clamped = Math.max(0, Math.min(order.length, targetIdx));
    order.splice(clamped, 0, groupId);
    rowOrderOverrides = {
      ...rowOrderOverrides,
      groupOrderByParent: { ...rowOrderOverrides.groupOrderByParent, [parentKey]: order },
    };
  }

  function clearRowReorder(groupId?: string) {
    if (groupId) {
      const { [groupId]: _omit, ...rest } = rowOrderOverrides.byGroup;
      rowOrderOverrides = { ...rowOrderOverrides, byGroup: rest };
    } else {
      rowOrderOverrides = { byGroup: {}, groupOrderByParent: {} };
    }
  }

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
    for (const id of Object.keys(axisZooms)) taken.add(id);
    for (const id of userResizedIds) taken.add(id);

    return mintUniqueId(base, taken);
  }

  // Insert a new column after `afterId`. Pass "__start__" to insert at position 0.
  function insertColumn(def: ColumnSpec, afterId: string) {
    const id = mintUniqueColumnId(def.id || def.field);
    userInsertedColumns = [...userInsertedColumns, { afterId, def: { ...def, id } }];
    const after = afterId === "__start__" ? "__start__" : afterId;
    appendOp(ops.addColumn(renderColumnBuilder(def), after));
  }

  // Hide a column (reversible via clearColumnEdits).
  function hideColumn(id: string) {
    if (hiddenColumnIds.has(id)) return;
    const next = new Set(hiddenColumnIds);
    next.add(id);
    hiddenColumnIds = next;
    appendOp(ops.removeColumn(id));
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

  // Drop all user-driven add/hide/configure edits.
  function clearColumnEdits() {
    userInsertedColumns = [];
    hiddenColumnIds = new Set();
    columnSpecOverrides = {};
  }

  // =========================================================================
  // Edit actions
  // =========================================================================

  function startEdit(target: EditTarget) {
    editingTarget = target;
  }

  function endEdit() {
    editingTarget = null;
  }

  function setCellValue(rowId: string, field: string, value: EditValue) {
    const current = cellEdits.cells[rowId] ?? {};
    cellEdits = {
      ...cellEdits,
      cells: { ...cellEdits.cells, [rowId]: { ...current, [field]: value } },
    };
    appendOp(ops.setCell(rowId, field, value));
  }

  function clearCellEdit(rowId: string, field: string) {
    const current = cellEdits.cells[rowId];
    if (!current) return;
    const { [field]: _omit, ...rest } = current;
    const cells = Object.keys(rest).length
      ? { ...cellEdits.cells, [rowId]: rest }
      : (() => { const { [rowId]: _r, ...rm } = cellEdits.cells; return rm; })();
    cellEdits = { ...cellEdits, cells };
  }

  function setRowLabel(rowId: string, label: string) {
    // The "row label" is the primary column's cell — resolving at call time
    // means reordering columns doesn't migrate prior label edits.
    const field = allColumns[0]?.field;
    if (!field) return;
    // Inline the cellEdits update so we can emit a `set_row_label()` record
    // (more semantic than the `set_cell()` that setCellValue would push).
    const current = cellEdits.cells[rowId] ?? {};
    cellEdits = {
      ...cellEdits,
      cells: { ...cellEdits.cells, [rowId]: { ...current, [field]: label } },
    };
    appendOp(ops.setRowLabel(rowId, label));
  }

  function setGroupHeader(groupId: string, text: string) {
    cellEdits = { ...cellEdits, groups: { ...cellEdits.groups, [groupId]: text } };
  }

  function setForestCellValues(
    rowId: string,
    forestColId: string,
    est: EditValue,
    lo: EditValue,
    hi: EditValue,
  ) {
    if (!spec) return;
    const col = allColumns.find((c) => c.id === forestColId);
    const forestOpts = col?.options?.forest;
    // Primary field names come from the column's forest options when set,
    // otherwise fall back to conventional metadata keys ("est","lo","hi").
    const pointField = forestOpts?.point ?? "est";
    const lowerField = forestOpts?.lower ?? "lo";
    const upperField = forestOpts?.upper ?? "hi";
    const current = cellEdits.cells[rowId] ?? {};
    cellEdits = {
      ...cellEdits,
      cells: {
        ...cellEdits.cells,
        [rowId]: { ...current, [pointField]: est, [lowerField]: lo, [upperField]: hi },
      },
    };
  }

  function getDisplayValue(row: Row, field: string): unknown {
    const edited = cellEdits.cells[row.id]?.[field];
    return edited !== undefined ? edited : row.metadata[field];
  }

  function getLabel(row: Row): string {
    const field = allColumns[0]?.field;
    const edited = field ? cellEdits.cells[row.id]?.[field] : undefined;
    return edited !== undefined && edited !== null ? String(edited) : row.label;
  }

  function clearAllEdits() {
    cellEdits = { cells: {}, groups: {} };
    labelEdits = {};
    styleEdits = { rows: {}, cells: {} };
    paintTool = { token: "accent", scope: "row" };
  }

  // Plot-level labels (title / subtitle / caption / footnote). Live session
  // state sits in `labelEdits`; the exporter merges into `spec.labels` so
  // "View source" reproduces the edit.
  function setLabel(
    field: "title" | "subtitle" | "caption" | "footnote",
    value: string | null,
  ) {
    const next = value == null || value === "" ? null : value;
    labelEdits = { ...labelEdits, [field]: next };
    appendOp(ops.setLabelSlot(field, next));
  }

  /**
   * Live-preview a title/subtitle/caption/footnote edit without recording.
   * Callers wired to `<input oninput={...}>` should use this while the user
   * types, then call `setLabel()` on blur/Enter to commit one op-log entry
   * per finished edit.
   */
  function previewLabel(
    field: "title" | "subtitle" | "caption" | "footnote",
    value: string | null,
  ) {
    const next = value == null || value === "" ? null : value;
    labelEdits = { ...labelEdits, [field]: next };
  }

  function clearLabelEdit(
    field: "title" | "subtitle" | "caption" | "footnote",
  ) {
    if (!(field in labelEdits)) return;
    const { [field]: _omit, ...rest } = labelEdits;
    labelEdits = rest;
  }

  function getPlotLabel(
    field: "title" | "subtitle" | "caption" | "footnote",
  ): string | null {
    if (field in labelEdits) {
      const v = labelEdits[field];
      return v == null ? null : v;
    }
    return spec?.labels?.[field] ?? null;
  }

  // ── Paint tool ───────────────────────────────────────────────────────
  //
  // The paint tool is an authoring mode that lets the user stamp one of the
  // three semantic flags (emphasis / muted / accent) onto rows or cells
  // by clicking them. Behavior mirrors a toggle: clicking with `emphasis`
  // active flips the row's emphasis flag. Painted state is merged into the
  // display layer and exportSpec so save_plot() and the R session both see
  // the edits. Re-selecting the active token chip or pressing Escape
  // exits paint mode.

  // The painter is always-on. setPaintTool just changes which token / scope
  // future clicks will apply. Paint commits accumulate in styleEdits.
  function setPaintTool(tool: { token: SemanticToken; scope: "row" | "cell" }) {
    paintTool = tool;
    // Clear any stale paint-hover marker so a token/scope switch doesn't
    // leave the previous cell highlighted in preview.
    paintHoverCellField = null;
  }

  // Paint-mode hover state. Tracks "rowId:field" of the cell under the
  // cursor while in cell-scope paint mode; null otherwise. Lives on the
  // store rather than as a ForestPlot-local $state because Svelte 5's
  // compiler doesn't propagate component-local $state into helper
  // functions defined in the same script — accessing it via store.* is
  // guaranteed to read through a working getter.
  let paintHoverCellField = $state<string | null>(null);
  function setPaintHoverCellField(value: string | null) {
    paintHoverCellField = value;
  }

  /** Toggle or set a semantic flag on a row. Call from the paint pointerdown
   *  handler on a row element, or programmatically from R-authored flows. */
  function setRowSemantic(rowId: string, token: SemanticToken, on: boolean) {
    const current = styleEdits.rows[rowId] ?? {};
    const next: SemanticFlags = { ...current, [token]: on };
    // Collapse back to "inherit" when the flag would match the spec default
    // (keeps exportSpec free of no-op noise).
    const specRow = spec?.data.rows.find((r) => r.id === rowId);
    const baseline = !!specRow?.style?.[token];
    if (on === baseline) {
      delete next[token];
    }
    const rows = Object.keys(next).length
      ? { ...styleEdits.rows, [rowId]: next }
      : (() => { const { [rowId]: _r, ...rest } = styleEdits.rows; return rest; })();
    styleEdits = { ...styleEdits, rows };
    // Turning a token ON records the paint; turning OFF records clearing
    // (paint_row(..., NULL)). The fluent R verb mirrors this toggle.
    appendOp(ops.paintRow(rowId, on ? token : null));
  }

  function setCellSemantic(
    rowId: string,
    field: string,
    token: SemanticToken,
    on: boolean,
  ) {
    const rowMap = styleEdits.cells[rowId] ?? {};
    const currentCell = rowMap[field] ?? {};
    const nextCell: SemanticFlags = { ...currentCell, [token]: on };
    // Collapse identity edits the same way as row-scoped paint.
    const specCell = spec?.data.rows.find((r) => r.id === rowId)?.cellStyles?.[field];
    const baseline = !!specCell?.[token];
    if (on === baseline) {
      delete nextCell[token];
    }
    const nextRowMap = Object.keys(nextCell).length
      ? { ...rowMap, [field]: nextCell }
      : (() => { const { [field]: _f, ...rest } = rowMap; return rest; })();
    const cells = Object.keys(nextRowMap).length
      ? { ...styleEdits.cells, [rowId]: nextRowMap }
      : (() => { const { [rowId]: _r, ...rest } = styleEdits.cells; return rest; })();
    styleEdits = { ...styleEdits, cells };
    appendOp(ops.paintCell(rowId, field, on ? token : null));
  }

  /** Resolved row semantic flags (spec baseline + paint overrides). */
  function getRowSemantic(row: Row, token: SemanticToken): boolean {
    const override = styleEdits.rows[row.id]?.[token];
    if (override !== undefined) return override;
    return !!row.style?.[token];
  }

  /** Resolved cell semantic flags (spec baseline + paint overrides). */
  function getCellSemantic(row: Row, field: string, token: SemanticToken): boolean {
    const override = styleEdits.cells[row.id]?.[field]?.[token];
    if (override !== undefined) return override;
    return !!row.cellStyles?.[field]?.[token];
  }

  function clearAllPaint() {
    styleEdits = { rows: {}, cells: {} };
    paintTool = { token: "accent", scope: "row" };
  }

  function hasPaintEdits(): boolean {
    return (
      Object.keys(styleEdits.rows).length > 0 ||
      Object.keys(styleEdits.cells).length > 0
    );
  }

  // Filter-popover plumbing (rendered at widget root so it's not clipped or
  // transform-scaled by the interactive content's zoom wrapper).
  function openFilterPopover(field: string, header: string, triggerEl: HTMLElement | null) {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    filterPopoverTarget = {
      field,
      header,
      anchorX: r.left,
      anchorY: r.bottom,
    };
  }

  function closeFilterPopover() {
    filterPopoverTarget = null;
  }

  function setHovered(id: string | null) {
    hoveredRowId = id;
  }

  function setTooltip(rowId: string | null, position: { x: number; y: number } | null) {
    tooltipRowId = rowId;
    tooltipPosition = position;
  }

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
  }

  function getPlotWidth(): number | null {
    return plotWidthOverride;
  }

  // -- Per-column axis pan/zoom ------------------------------------------------
  // Writes replace the whole map object so Svelte's $state detects the change.
  function setAxisZoom(columnId: string, domain: [number, number]) {
    // Guard against degenerate / inverted domains that would break d3 scales.
    if (!Number.isFinite(domain[0]) || !Number.isFinite(domain[1])) return;
    if (domain[0] >= domain[1]) return;
    axisZooms = { ...axisZooms, [columnId]: { domain: [domain[0], domain[1]] } };
  }

  function resetAxisZoom(columnId: string) {
    if (!(columnId in axisZooms)) return;
    const next = { ...axisZooms };
    delete next[columnId];
    axisZooms = next;
  }

  function getAxisZoom(columnId: string): { domain: [number, number] } | null {
    return axisZooms[columnId] ?? null;
  }

  // Returns the effective domain for a column: user override if present,
  // otherwise the supplied default.
  function getEffectiveDomain(columnId: string, defaultDomain: [number, number]): [number, number] {
    return axisZooms[columnId]?.domain ?? defaultDomain;
  }

  /**
   * Deep clone a WebTheme. Uses JSON round-trip (not structuredClone) because
   * the theme objects we receive here are sometimes Svelte $state proxies,
   * whose internal slots trip structuredClone's DataCloneError path. Themes
   * are strictly JSON-safe (strings / numbers / booleans / nested objects /
   * nulls — no Maps, Sets, Dates, functions), so the round-trip is lossless.
   */
  function cloneTheme(t: WebSpec["theme"]): WebSpec["theme"] {
    return JSON.parse(JSON.stringify(t));
  }

  function setTheme(themeName: ThemeName) {
    const newTheme = THEME_PRESETS[themeName];
    if (!spec || !newTheme) return;
    // Deep-clone so subsequent in-panel edits don't mutate the shared preset
    // object (THEME_PRESETS is a module-level singleton).
    const cleanTheme = cloneTheme(newTheme);
    spec = { ...spec, theme: cleanTheme };
    baseThemeName = themeName;
    themeEdits = {};
    // Refresh the reset target — a preset swap supersedes whatever was there.
    initialTheme = cloneTheme(cleanTheme);
    // Fonts / sizes / padding likely differ from the previous theme, so
    // every auto-width measurement is stale. Invalidate and re-run, but
    // preserve user-resized entries (measureAutoColumns skips those).
    clearAutoWidthsKeepingUserResizes();
    measureAutoColumns();
    appendOp(ops.setTheme(themeName));
  }

  // Swap in a WebTheme object (for `enable_themes = list(...)` custom themes)
  // without disturbing any interactive column/row edits. Callers used to go
  // through setSpec({...spec, theme}) for this, which cleared the edits map.
  function setThemeObject(theme: WebSpec["theme"]) {
    if (!spec) return;
    const cleanTheme = cloneTheme(theme);
    spec = { ...spec, theme: cleanTheme };
    baseThemeName = theme?.name ?? "default";
    themeEdits = {};
    initialTheme = cloneTheme(cleanTheme);
    clearAutoWidthsKeepingUserResizes();
    measureAutoColumns();
  }

  /** Sections whose edits change text metrics or cell geometry; changing any
   *  field in these invalidates cached auto-widths. Banding/colors/axis are
   *  paint-only and don't affect widths, so they stay out of this list. */
  const WIDTH_AFFECTING_SECTIONS = new Set(["typography", "spacing", "shapes"]);

  /** Within `spacing`, only x-axis padding fields actually change column
   *  widths. rowHeight / headerHeight / footerGap / titleSubtitleGap /
   *  headerGap / bottomMargin / axisGap / indentPerLevel are vertical or
   *  geometry-only — remeasuring on those fires off needless work mid-
   *  drag and was the source of the "row-resize transiently collapses
   *  columns" symptom. */
  const SPACING_WIDTH_FIELDS = new Set([
    "cellPaddingX",
    "padding",
    "containerPadding",
    "columnGroupPadding",
    "groupPadding",
    "rowGroupPadding",
  ]);
  function spacingFieldAffectsWidth(field: string | undefined): boolean {
    return field == null ? true : SPACING_WIDTH_FIELDS.has(field);
  }

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

  /**
   * Live-preview a single theme field during a drag without recording
   * the edit or invalidating column widths. Mirrors the
   * previewColumnWidth / setColumnWidth pattern: the resize handle
   * pumps `previewThemeField()` per pointermove so the layout reflows
   * without spamming the op log or remeasuring columns each frame, then
   * commits once via `setThemeField()` on pointerup. Width-affecting
   * sections (spacing, typography, shapes) only re-measure on commit.
   */
  function previewThemeField(section: string, field: string, value: unknown) {
    if (!spec || !spec.theme) return;
    const theme = spec.theme as Record<string, unknown>;
    const current = theme[section];
    if (!current || typeof current !== "object") return;
    (current as Record<string, unknown>)[field] = value;
  }

  /** Apply a single in-panel theme edit. Mutates spec.theme so the widget
   *  re-renders, and records the change so it can be exported as R code. */
  /**
   * Set a theme field at a deep path. Path is a list of strings (object
   * keys) and/or numbers (list indices). Returns nothing; mutates spec
   * with a fresh `theme` reference at every level so Svelte 5 fine-grained
   * reactivity invalidates downstream `$derived` / `@const` reads.
   *
   * Backward-compat: the old (section, field, value) call form works too
   * via overload — internally constructs a 2-step path.
   */
  // Internal: walk the theme tree and replace the leaf at `path` with
  // `value`. Used by both setThemeField (records as user edit) and
  // setThemeFieldDerived (does not). Both produce a fresh reference at
  // every level so Svelte 5 fine-grained reactivity invalidates the
  // downstream reads.
  function writeThemePath(path: (string | number)[], value: unknown) {
    if (!spec || !spec.theme || path.length === 0) return;
    const updateAt = (obj: unknown, p: (string | number)[]): unknown => {
      const key = p[0];
      if (p.length === 1) {
        if (Array.isArray(obj)) {
          const next = [...obj];
          next[key as number] = value;
          return next;
        }
        return { ...(obj as Record<string, unknown>), [key as string]: value };
      }
      if (Array.isArray(obj)) {
        const next = [...obj];
        next[key as number] = updateAt(obj[key as number], p.slice(1));
        return next;
      }
      const cur = (obj as Record<string, unknown>)?.[key as string];
      return { ...(obj as Record<string, unknown>), [key as string]: updateAt(cur, p.slice(1)) };
    };
    spec = { ...spec, theme: updateAt(spec.theme, path) as Spec["theme"] };
  }

  function pathKey(path: (string | number)[]): string {
    return path.map(String).join(".");
  }

  function setThemeField(...args: unknown[]) {
    if (!spec || !spec.theme) return;
    let path: (string | number)[];
    let value: unknown;
    if (args.length === 3 && typeof args[0] === "string" && typeof args[1] === "string") {
      path = [args[0] as string, args[1] as string];
      value = args[2];
    } else if (args.length === 2 && Array.isArray(args[0])) {
      path = args[0] as (string | number)[];
      value = args[1];
    } else {
      return;
    }
    if (path.length === 0) return;

    writeThemePath(path, value);

    // Mark this path as a user-set override.
    themeOverrides = new Set(themeOverrides);
    themeOverrides.add(pathKey(path));

    // Track for source-gen. Group by top-level path step.
    const section = String(path[0]);
    const nextEdits = { ...themeEdits };
    if (path.length === 2 && typeof path[1] === "string") {
      nextEdits[section] = { ...(nextEdits[section] ?? {}), [path[1] as string]: value };
    } else {
      // Deep edit — store under a nested-path key.
      const subKey = path.slice(1).map(String).join(".");
      nextEdits[section] = { ...(nextEdits[section] ?? {}), [subKey]: value };
    }
    themeEdits = nextEdits;

    if (WIDTH_AFFECTING_SECTIONS.has(section)) {
      // Within `spacing`, narrow the gate to only x-axis padding fields.
      // rowHeight / headerHeight / titleSubtitleGap / headerGap /
      // bottomMargin / axisGap / indentPerLevel are vertical-only and
      // don't change column widths; remeasuring on those during a drag
      // commit was the source of the "row-resize transiently collapses
      // a column" artifact.
      const field = path.length >= 2 && typeof path[1] === "string"
        ? (path[1] as string)
        : undefined;
      if (section !== "spacing" || spacingFieldAffectsWidth(field)) {
        clearAutoWidthsKeepingUserResizes();
        measureAutoColumns();
      }
    }
  }

  /**
   * Write a derived value at `path` without flagging it as a user-set
   * override. Used by panel multi-write helpers (Brand mirrors to
   * series[0].fill, brandDeep, header.bold.bg, …) so the downstream
   * paths stay "auto" and a future Brand re-write can update them again.
   * If you call this on a path that the user has explicitly set
   * (isOverridden), it's a no-op — user overrides win.
   */
  function setThemeFieldDerived(path: (string | number)[], value: unknown) {
    if (!spec || !spec.theme || path.length === 0) return;
    if (themeOverrides.has(pathKey(path))) return;
    writeThemePath(path, value);
  }

  function isOverridden(path: (string | number)[]): boolean {
    return themeOverrides.has(pathKey(path));
  }

  function clearOverride(path: (string | number)[]) {
    if (!themeOverrides.has(pathKey(path))) return;
    const next = new Set(themeOverrides);
    next.delete(pathKey(path));
    themeOverrides = next;
  }

  /**
   * Apply an edit to one field of one row-level semantic bundle
   * (e.g. `theme.row.emphasis.bg`). v2 stores semantics as nested
   * RowSemantic bundles inside the row cluster.
   */
  function setSemanticField(
    token: "emphasis" | "muted" | "accent",
    field: string,
    value: unknown,
  ) {
    if (!spec || !spec.theme?.row) return;

    const prevRow = spec.theme.row as Record<string, unknown> & {
      [k in "emphasis" | "muted" | "accent"]: Record<string, unknown>;
    };
    const prevBundle = prevRow[token] ?? {};
    spec = {
      ...spec,
      theme: {
        ...spec.theme,
        row: {
          ...prevRow,
          [token]: { ...prevBundle, [field]: value },
        },
      },
    };

    const nextEdits = { ...themeEdits };
    const prevSection = (nextEdits.row ?? {}) as Record<string, Record<string, unknown>>;
    nextEdits.row = {
      ...prevSection,
      [token]: { ...(prevSection[token] ?? {}), [field]: value },
    };
    themeEdits = nextEdits;
  }

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

  /**
   * Wipe all in-panel edits and restore the clean theme + watermark. Uses
   * `initialTheme` (the snapshot of what the R caller supplied) rather than
   * `THEME_PRESETS[baseThemeName]` — the latter would silently drop any
   * pre-customization the caller baked into the theme via
   * `web_theme_*() |> set_spacing(...)`. Also called from the Settings
   * panel's Reset button, which is why this path needs to be as faithful
   * as the full resetState().
   */
  function resetThemeEdits() {
    if (!spec) return;
    if (initialTheme) {
      spec = { ...spec, theme: cloneTheme(initialTheme) };
    }
    if (initialWatermark !== undefined) {
      spec = { ...spec, watermark: initialWatermark };
    }
    themeEdits = {};
  }

  // ============================================================================
  // Zoom & Auto-fit Controls
  // ============================================================================

  function setZoom(value: number) {
    zoom = Math.max(0.5, Math.min(2.0, value));
    persistZoomState();
  }

  function resetZoom() {
    zoom = 1.0;
    persistZoomState();
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
  }

  function fitToWidth() {
    if (!containerWidth || !scalableNaturalWidth) return;
    // Set zoom so content width matches container width
    // Note: containerWidth from ResizeObserver is already the content box (excludes padding)
    zoom = Math.min(2.0, Math.max(0.5, containerWidth / scalableNaturalWidth));
    persistZoomState();
  }

  function setMaxWidth(value: number | null) {
    maxWidth = value;
    persistZoomState();
  }

  function setMaxHeight(value: number | null) {
    maxHeight = value;
    persistZoomState();
  }

  function setShowZoomControls(show: boolean) {
    showZoomControls = show;
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
    // styleEdits). clearAllPaint() handles that.
    clearAllPaint();
    collapsedGroups = new Set();
    sortConfig = null;
    filterConfig = null;
    filters = {};

    // ── Row & column reorder / inserts / hides / cell edits ──────────────
    rowOrderOverrides = { byGroup: {}, groupOrderByParent: {} };
    columnOrderOverrides = { topLevel: null, byGroup: {} };
    userInsertedColumns = [];
    hiddenColumnIds = new Set();
    columnSpecOverrides = {};
    cellEdits = { cells: {}, groups: {} };
    labelEdits = {};
    styleEdits = { rows: {}, cells: {} };
    paintTool = { token: "accent", scope: "row" };
    opLog = [];

    // ── Widths / zoom / sizing ───────────────────────────────────────────
    columnWidths = {};
    userResizedIds = new Set();
    plotWidthOverride = null;
    zoom = 1.0;
    autoFit = true;
    maxWidth = null;
    maxHeight = null;
    axisZooms = {};

    // ── Theme customizations (in-panel edits / banding overrides) ────────
    themeEdits = {};
    bandingOverride = null;
    bandingStartsWithBandOverride = null;

    // ── Transient UI overlays ────────────────────────────────────────────
    hoveredRowId = null;
    tooltipRowId = null;
    tooltipPosition = null;
    dragState = null;
    editingTarget = null;
    filterPopoverTarget = null;

    // ── Restore theme from the initial snapshot ──────────────────────────
    // initialTheme is the "clean" theme as of the last spec/preset/custom
    // swap. This is NOT just THEME_PRESETS[baseThemeName]: if R supplied a
    // pre-customized theme (`web_theme_modern() |> set_spacing(...)`), that
    // customization lives on spec.theme but not on the raw preset, so
    // resetting to the preset would silently drop it and change font size /
    // vertical spacing. The snapshot preserves the caller-supplied shape.
    if (spec && initialTheme) {
      spec = { ...spec, theme: cloneTheme(initialTheme) };
    }
    // ── Restore the initial watermark ────────────────────────────────────
    if (spec && initialWatermark !== undefined) {
      spec = { ...spec, watermark: initialWatermark };
    }

    // ── Re-measure auto-width columns ─────────────────────────────────────
    // Without this, columnWidths stays empty and the renderer falls through
    // to DEFAULT_COLUMN_WIDTH, producing the "subtle layout shift" + SVG
    // export artifacts.
    measureAutoColumns();
  }

  // Derived: tooltip row. Merges cell edits so the tooltip reflects the
  // user's in-session changes (including the primary column, which doubles
  // as the row label).
  const tooltipRow = $derived.by((): Row | null => {
    if (!tooltipRowId || !spec) return null;
    const base = spec.data.rows.find((r) => r.id === tooltipRowId);
    if (!base) return null;
    const edited = cellEdits.cells[base.id];
    if (!edited) return base;
    const primaryField = allColumns[0]?.field;
    const newLabel = primaryField && edited[primaryField] != null ? String(edited[primaryField]) : base.label;
    return { ...base, label: newLabel, metadata: { ...base.metadata, ...edited } };
  });

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
        const editedMeta = cellEdits.cells[base.id];
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
      collapsed: collapsedGroups.has(g.id) || g.collapsed,
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
      const override = rowOrderOverrides.groupOrderByParent[parentKey];
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
    const mergedLabels = Object.keys(labelEdits).length
      ? { ...(spec.labels ?? {}), ...labelEdits }
      : spec.labels;

    return {
      ...spec,
      columns: effectiveColumnDefs,
      data: {
        ...spec.data,
        rows: orderedRows,
        groups: groupsOut,
      },
      labels: mergedLabels,
    };
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
      // Derived: rows currently painted with the active token.
      const active = paintTool.token;
      const ids = new Set<string>();
      for (const rowId of Object.keys(styleEdits.rows)) {
        if (styleEdits.rows[rowId]?.[active]) ids.add(rowId);
      }
      return ids;
    },
    get collapsedGroups() {
      return collapsedGroups;
    },
    get hoveredRowId() {
      return hoveredRowId;
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
      return themeEdits;
    },
    get baseThemeName() {
      return baseThemeName;
    },
    get hasThemeEdits() {
      for (const key of Object.keys(themeEdits)) {
        if (Object.keys(themeEdits[key] ?? {}).length > 0) return true;
      }
      // Watermark is a spec-level field (not a theme edit), but from the
      // user's POV it lives alongside banding in the Basics tab — so the
      // Reset button should notice changes to it and become active.
      if (initialWatermark !== undefined && (spec?.watermark ?? "") !== initialWatermark) {
        return true;
      }
      return false;
    },
    get tooltipRow() {
      return tooltipRow;
    },
    get tooltipPosition() {
      return tooltipPosition;
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
    get sortConfig() {
      return sortConfig;
    },
    get filterConfig() {
      return filterConfig;
    },
    get filters() {
      return filters;
    },
    get rowOrderOverrides() {
      return rowOrderOverrides;
    },
    get columnOrderOverrides() {
      return columnOrderOverrides;
    },
    get cellEdits() {
      return cellEdits;
    },
    get dragState() {
      return dragState;
    },
    get editingTarget() {
      return editingTarget;
    },
    get filterPopoverTarget() {
      return filterPopoverTarget;
    },
    get exportSpec() {
      return exportSpec;
    },
    getRowDepth,
    getColumnWidth,
    getPlotWidth,
    // Per-column pan/zoom
    get axisZooms() {
      return axisZooms;
    },
    setAxisZoom,
    resetAxisZoom,
    getAxisZoom,
    getEffectiveDomain,

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

      // The primary column is the leftmost entry in allColumns — no separate label slot.
      let currentX = 0;

      // Process all columns in order (forest columns are inline)
      for (const col of allColumns) {
        columnOrder.push(col.id);
        columnPositions[col.id] = currentX;

        let colWidth: number;
        if (col.type === "forest") {
          // Forest columns: check DOM width first, then col.width, then options, then layout default
          colWidth = widths[col.id]
            ?? (typeof col.width === "number" ? col.width : null)
            ?? col.options?.forest?.width
            ?? layout.forestWidth;
        } else {
          colWidth = widths[col.id] ?? (typeof col.width === "number" ? col.width : 100);
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
        const override = axisZooms[col.id]?.domain;
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
        const override = axisZooms[vc.column.id]?.domain;
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

        // Overall dimensions
        width: naturalContentWidth * zoom,
        height: (scalableNaturalHeight || 400) * zoom,
        naturalWidth: currentX,
        naturalHeight: totalRowsHeight + layout.headerHeight + layout.axisHeight,

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
    setDimensions,
    selectRow,
    setSelectedRows,
    toggleGroup,
    openSettings,
    closeSettings,
    toggleSettings,
    setBandingOverride,
    setBandingStartsWithBand,
    setThemeField,
    setThemeFieldDerived,
    isOverridden,
    clearOverride,
    previewThemeField,
    setSemanticField,
    setWatermark,
    previewWatermark,
    setWatermarkColor,
    setWatermarkOpacity,
    resetThemeEdits,
    sortBy,
    toggleSort,
    setFilter,
    setColumnFilter,
    clearAllFilters,
    getColumnFilter,
    detectColumnKind,
    getColumnValues,
    getColumnNumericRange,
    // DnD
    findColumnScope,
    siblingsForColumnScope,
    findRowGroupScope,
    siblingsForRowScope,
    siblingsForRowGroupScope,
    beginDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    moveColumnItem,
    moveRowItem,
    moveRowGroupItem,
    clearRowReorder,
    clearColumnReorder,
    // Interactive column edits
    insertColumn,
    hideColumn,
    updateColumn,
    clearColumnEdits,
    // Edit
    startEdit,
    endEdit,
    setCellValue,
    clearCellEdit,
    setRowLabel,
    setGroupHeader,
    setForestCellValues,
    getDisplayValue,
    getLabel,
    setLabel,
    previewLabel,
    clearLabelEdit,
    getPlotLabel,
    // Paint tool
    setPaintTool,
    setPaintHoverCellField,
    paintRowWithActiveToken,
    paintCellWithActiveToken,
    setRowSemantic,
    setCellSemantic,
    getRowSemantic,
    getCellSemantic,
    clearAllPaint,
    get paintTool() { return paintTool; },
    get paintHoverCellField() { return paintHoverCellField; },
    get styleEdits() { return styleEdits; },
    get hasPaintEdits() { return hasPaintEdits(); },
    clearAllEdits,
    // Filter popover
    openFilterPopover,
    closeFilterPopover,
    setHovered,
    setTooltip,
    setColumnWidth,
    previewColumnWidth,
    setPlotWidth,
    setTheme,
    setThemeObject,
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
    // Op recorder
    get opLog() { return opLog; },
    clearOpLog: () => { opLog = []; },
    // Append a pre-built record (used by the split wrapper to log
    // SplitForest-level ops like set_shared_column_widths on the active
    // sub-plot's log). Internal store mutations go through the same
    // `appendOp` helper so consecutive duplicates get dropped in one
    // place.
    recordOp: (r: OpRecord) => appendOp(r),
  };

  /**
   * Append an op to the log unless it's a byte-for-byte duplicate of the
   * most recent entry. Filters out the common accidental doubles (drag-end
   * firing twice, double-clicks, value-didn't-actually-change cases) while
   * still recording every distinct action — genuine backtracking like
   * resize A → resize B → resize A stays in the log.
   */
  function appendOp(record: OpRecord): void {
    const prev = opLog[opLog.length - 1];
    if (prev && prev.rCall === record.rCall) return;
    opLog = [...opLog, record];
  }
}

export type ForestStore = ReturnType<typeof createForestStore>;

// Apply all column filters (AND across columns).
function applyFilters(rows: Row[], state: FiltersState): Row[] {
  const filterList = Object.values(state);
  if (filterList.length === 0) return rows;
  return rows.filter((row) => filterList.every((f) => matchColumnFilter(row, f)));
}

function readField(row: Row, field: string): unknown {
  return row.metadata[field] ?? (row as unknown as Record<string, unknown>)[field];
}

function matchColumnFilter(row: Row, f: ColumnFilter): boolean {
  const value = readField(row, f.field);
  switch (f.operator) {
    case "contains":
      if (value == null) return false;
      return String(value).toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "eq":
      return value === f.value;
    case "neq":
      return value !== f.value;
    case "gt":
      return typeof value === "number" && typeof f.value === "number" && value > f.value;
    case "lt":
      return typeof value === "number" && typeof f.value === "number" && value < f.value;
    case "gte":
      return typeof value === "number" && typeof f.value === "number" && value >= f.value;
    case "lte":
      return typeof value === "number" && typeof f.value === "number" && value <= f.value;
    case "between": {
      if (typeof value !== "number") return false;
      const range = f.value as [number | null, number | null] | null | undefined;
      if (!range) return true;
      const [lo, hi] = range;
      if (lo != null && value < lo) return false;
      if (hi != null && value > hi) return false;
      return true;
    }
    case "in": {
      const arr = f.value as unknown[] | null | undefined;
      if (!arr || arr.length === 0) return true;
      return arr.includes(value);
    }
    case "empty":
      return value == null || value === "";
    case "notEmpty":
      return !(value == null || value === "");
    default:
      return true;
  }
}

// Helper functions
function applyFilter(rows: Row[], config: FilterConfig): Row[] {
  return rows.filter((row) => {
    const value = row.metadata[config.field] ?? (row as unknown as Record<string, unknown>)[config.field];

    switch (config.operator) {
      case "eq":
        return value === config.value;
      case "neq":
        return value !== config.value;
      case "gt":
        return typeof value === "number" && value > (config.value as number);
      case "lt":
        return typeof value === "number" && value < (config.value as number);
      case "contains":
        return (
          typeof value === "string" &&
          value.toLowerCase().includes((config.value as string).toLowerCase())
        );
      default:
        return true;
    }
  });
}

/**
 * Walk `spec.columns` (including ColumnGroup descendants) and return the
 * first ColumnSpec whose `id` or `field` matches `key`. Used by the sort
 * path to resolve the clicked column back to its type + options, which
 * drives value extraction for multi-field column types.
 */
function findColumnByKey(
  defs: (ColumnSpec | ColumnGroup)[],
  key: string,
): ColumnSpec | undefined {
  for (const d of defs) {
    if ("isGroup" in d && (d as unknown as ColumnGroup).isGroup) {
      const grp = d as unknown as ColumnGroup;
      const hit = findColumnByKey(grp.columns as unknown as (ColumnSpec | ColumnGroup)[], key);
      if (hit) return hit;
      continue;
    }
    const spec = d as ColumnSpec;
    if (spec.id === key || spec.field === key) return spec;
  }
  return undefined;
}

// Numeric median of a possibly-sparse array. Used as the sort key for
// boxplot / violin columns where the "value" is a distribution rather than
// a single scalar. Ignores NaN / non-finite entries.
function median(xs: readonly number[]): number | undefined {
  const clean = xs.filter((v) => typeof v === "number" && Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (clean.length === 0) return undefined;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
}

/**
 * Extract the scalar value used to sort a row by a given column. Handles
 * the multi-field column types whose `.field` is synthetic and doesn't
 * index `row.metadata` directly:
 *
 *   - `forest`: first declared point field (inline `point` or the first
 *     effect's `pointCol`).
 *   - `interval`: `options.interval.point`.
 *   - `custom` with events options: the `eventsField`.
 *   - `viz_bar`: first effect's `value`.
 *   - `viz_boxplot`: first effect's `median` (stats mode) or the median
 *     of its `data` array (array mode).
 *   - `viz_violin`: median of the first effect's `data` array.
 *
 * Falls back to `row.metadata[col.field]` for the scalar column types.
 * Returning `undefined` lets `compareForSort` push the row to the end.
 */
function sortValueFor(col: ColumnSpec | undefined, row: Row, key: string): unknown {
  const meta = row.metadata as Record<string, unknown>;
  const bare = () => meta[key] ?? (row as unknown as Record<string, unknown>)[key];
  if (!col) return bare();

  const opts = col.options as Record<string, unknown> | undefined;
  const forestOpts = (opts?.forest ?? null) as {
    point?: string;
    effects?: Array<{ pointCol?: string }>;
  } | null;
  const intervalOpts = (opts?.interval ?? null) as { point?: string } | null;
  const eventsOpts = (opts?.events ?? null) as { eventsField?: string } | null;
  const barEffects = (opts?.vizBar as { effects?: Array<{ value?: string }> } | undefined)?.effects;
  const boxEffects = (opts?.vizBoxplot as {
    effects?: Array<{ median?: string | null; data?: string | null }>;
  } | undefined)?.effects;
  const violinEffects = (opts?.vizViolin as {
    effects?: Array<{ data?: string }>;
  } | undefined)?.effects;

  switch (col.type) {
    case "forest": {
      const f = forestOpts?.point ?? forestOpts?.effects?.[0]?.pointCol;
      return f ? meta[f] : bare();
    }
    case "interval": {
      const f = intervalOpts?.point;
      return f ? meta[f] : bare();
    }
    case "custom": {
      const f = eventsOpts?.eventsField;
      return f ? meta[f] : bare();
    }
    case "viz_bar": {
      const f = barEffects?.[0]?.value;
      return f ? meta[f] : bare();
    }
    case "viz_boxplot": {
      const eff = boxEffects?.[0];
      if (!eff) return bare();
      if (eff.median) return meta[eff.median];
      if (eff.data) {
        const arr = meta[eff.data];
        if (Array.isArray(arr)) return median(arr as number[]);
      }
      return undefined;
    }
    case "viz_violin": {
      const f = violinEffects?.[0]?.data;
      if (!f) return bare();
      const arr = meta[f];
      if (Array.isArray(arr)) return median(arr as number[]);
      return undefined;
    }
    default:
      return bare();
  }
}

function compareForSort(aVal: unknown, bVal: unknown, desc: boolean): number {
  // Push undefined to the end regardless of direction.
  const aMissing = aVal == null || (typeof aVal === "number" && !Number.isFinite(aVal));
  const bMissing = bVal == null || (typeof bVal === "number" && !Number.isFinite(bVal));
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  let comparison = 0;
  if (typeof aVal === "number" && typeof bVal === "number") comparison = aVal - bVal;
  else if (typeof aVal === "string" && typeof bVal === "string") comparison = aVal.localeCompare(bVal);
  return desc ? -comparison : comparison;
}

function applySort(rows: Row[], config: SortConfig, col: ColumnSpec | undefined): Row[] {
  const sorted = [...rows];
  const { column, direction } = config;
  sorted.sort((a, b) =>
    compareForSort(
      sortValueFor(col, a, column),
      sortValueFor(col, b, column),
      direction === "desc",
    ),
  );
  return sorted;
}

// Sort rows within each group bucket so grouping structure is preserved.
// Rows with the same groupId stay contiguous and retain their relative group order.
function applySortWithinGroups(rows: Row[], config: SortConfig, col: ColumnSpec | undefined): Row[] {
  const buckets = new Map<string, { positions: number[]; rows: Row[] }>();
  const bucketOrder: string[] = [];
  rows.forEach((row, idx) => {
    const key = row.groupId ?? "__root__";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { positions: [], rows: [] };
      buckets.set(key, bucket);
      bucketOrder.push(key);
    }
    bucket.positions.push(idx);
    bucket.rows.push(row);
  });

  const result: Row[] = new Array(rows.length);
  for (const key of bucketOrder) {
    const { positions, rows: bucketRows } = buckets.get(key)!;
    const sortedBucket = applySort(bucketRows, config, col);
    positions.forEach((pos, i) => {
      result[pos] = sortedBucket[i];
    });
  }
  return result;
}
