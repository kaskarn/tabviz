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
} from "$types";
import { niceDomain } from "$lib/scale-utils";
import { computeAxis, type AxisComputation, VIZ_MARGIN } from "$lib/axis-utils";
import { THEME_PRESETS, type ThemeName } from "$lib/theme-presets";
import { getColumnDisplayText } from "$lib/formatters";
import { AUTO_WIDTH, SPACING, GROUP_HEADER, TEXT_MEASUREMENT, BADGE, LAYOUT } from "$lib/rendering-constants";

// Svelte 5 runes-based store
export function createForestStore() {
  // Core state
  let spec = $state<WebSpec | null>(null);

  // Initial dimensions (from htmlwidgets/splitStore, used as fallback before ResizeObserver fires)
  let initialWidth = $state(800);
  let initialHeight = $state(400);

  // Interaction state
  let selectedRowIds = $state<Set<string>>(new Set());
  let collapsedGroups = $state<Set<string>>(new Set());
  let sortConfig = $state<SortConfig | null>(null);
  let filterConfig = $state<FilterConfig | null>(null);
  let filters = $state<FiltersState>({});
  let hoveredRowId = $state<string | null>(null);

  // User-modified view state (session-only; feeds exportSpec for WYSIWYG)
  let rowOrderOverrides = $state<RowOrderOverrides>({ byGroup: {}, groupOrderByParent: {} });
  let columnOrderOverrides = $state<ColumnOrderOverrides>({ topLevel: null, byGroup: {} });
  let cellEdits = $state<CellEdits>({ cells: {}, labels: {} });

  // Transient UI state for DnD / edit / filter overlays
  let dragState = $state<DragState | null>(null);
  let editingTarget = $state<EditTarget | null>(null);
  let filterPopoverTarget = $state<{ field: string; header: string; anchorX: number; anchorY: number } | null>(null);

  // Edit mode — OFF by default (clean read-only view, tight column widths). When ON,
  // interaction chrome (drag handles, sort/filter icons, edit triggers) becomes visible
  // and auto-width columns expand to accommodate the icons. Export always uses the
  // tight (edit-mode-off) widths, so the exported SVG/PNG matches the clean view.
  let editMode = $state<boolean>(false);

  // Tight column widths — computed as if editMode were off. Used by the export path
  // so downloads always produce the clean, icon-free layout regardless of edit mode.
  let columnWidthsCompact = $state<Record<string, number>>({});

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

    let rows = [...spec.data.rows];

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
      rows = applySortWithinGroups(rows, sortConfig);
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
    const forestWidth = hasForest
      ? (plotWidthOverride ?? Math.max(effectiveWidth * 0.25, 200))
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

    return computeAxis({
      rows: spec.data.rows,
      config: axisConfig,
      scale,
      nullValue,
      forestWidth,
      pointSize: spec.theme.shapes.pointSize,
      effects,
      pointCol,
      lowerCol,
      upperCol,
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
    const forestWidth = hasForest
      ? (plotWidthOverride ?? Math.max(effectiveWidth * 0.25, 200))
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

  // Derived: column definitions reflecting user reorder overrides.
  // Applied recursively: top-level sibling order, then each column-group's child order.
  const effectiveColumnDefs = $derived.by((): ColumnDef[] => {
    if (!spec) return [];
    const topOrdered = applyColumnOrder(spec.columns, columnOrderOverrides.topLevel);
    return topOrdered.map((def) => {
      if (def.isGroup) {
        const childOrder = columnOrderOverrides.byGroup[def.id];
        const reorderedChildren = applyColumnOrder(def.columns, childOrder);
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
    const headerHeight = spec.theme.spacing.headerHeight;
    const axisGap = spec.theme.spacing.axisGap ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP; // Gap between table and axis
    // Axis height: gap + axis line/ticks + axis label text
    // This ensures the axis label is not truncated at the bottom
    const axisHeight = axisGap + LAYOUT.AXIS_HEIGHT + LAYOUT.AXIS_LABEL_HEIGHT; // ~76px total
    const hasForest = forestColumns.length > 0;
    // Use override if set, otherwise calculate default (25% of width, min 200px)
    const forestWidth = hasForest
      ? (plotWidthOverride ?? Math.max(effectiveWidth * 0.25, 200))
      : 0;
    const tableWidth = effectiveWidth - forestWidth;

    const hasOverall = !!spec.data.overall;

    // Calculate actual heights for each row (spacers are half-height)
    const rowHeights: number[] = [];
    for (const displayRow of displayRows) {
      if (displayRow.type === "data" && displayRow.row.style?.type === "spacer") {
        rowHeights.push(rowHeight / 2);
      } else {
        rowHeights.push(rowHeight);
      }
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
    const LABEL_COLUMN_WIDTH = 150;

    // Calculate sum of all column widths (excluding forest columns which have separate width)
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

    // Add label column (always present)
    totalColumnWidth += columnWidths["__label__"] ?? LABEL_COLUMN_WIDTH;

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
    // Measure auto-width columns
    measureAutoColumns();
  }

  // Helper to measure columns with width="auto" and set their computed widths
  function measureAutoColumns() {
    if (!spec || typeof document === 'undefined') return;

    // Get font from theme
    const fontFamily = spec.theme.typography.fontFamily;
    let fontSize = spec.theme.typography.fontSizeBase;

    // Convert rem/em to px using actual document root font size
    // (don't assume 16px - user may have accessibility settings or custom base)
    if (typeof fontSize === 'string' && (fontSize.endsWith('rem') || fontSize.endsWith('em'))) {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const relValue = parseFloat(fontSize);
      fontSize = `${relValue * rootFontSize}px`;
    }

    // Two passes: interactive widths (respect editMode) + compact widths (always editMode=off).
    // Compact widths feed the export path so downloads are always tight regardless of mode.
    doMeasurement(fontSize, fontFamily, columnWidths, editMode);
    doMeasurement(fontSize, fontFamily, columnWidthsCompact, false);

    // Then wait for fonts to load and re-measure for accuracy
    // This ensures custom/web fonts are properly measured
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        doMeasurement(fontSize as string, fontFamily, columnWidths, editMode, true);
        doMeasurement(fontSize as string, fontFamily, columnWidthsCompact, false, true);
      });
    }
  }

  // Perform the actual column width measurement.
  // `target` is the widths dict to write into; `iconsVisible` controls whether
  // interaction-icon budget is included. Keeps `columnWidths` (interactive, respects
  // edit mode) and `columnWidthsCompact` (always icons-off, used by export) in sync.
  function doMeasurement(
    fontSize: string,
    fontFamily: string,
    target: Record<string, number>,
    iconsVisibleArg: boolean,
    isFontLoaded = false,
  ) {
    if (!spec) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Header cells use scaled font size (theme.typography.headerFontScale, default 1.05)
    // Parse the font size and scale it for headers
    const headerFontScale = spec.theme.typography.headerFontScale ?? 1.05;
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
    const fontWeightBold = spec.theme.typography.fontWeightBold ?? 600;
    const headerFont = `${fontWeightBold} ${headerFontSize} ${fontFamily}`;
    const dataFont = `${fontSize} ${fontFamily}`;

    // Padding values from theme (not hardcoded magic numbers)
    // cellPaddingX is applied to both left and right of each cell
    const cellPadding = (spec.theme.spacing.cellPaddingX ?? 10) * 2;
    // groupPadding is applied to both left and right of column group headers
    const groupPadding = (spec.theme.spacing.groupPadding ?? 8) * 2;

    // ------------------------------------------------------------------
    // Interaction-chrome width budget
    // ------------------------------------------------------------------
    // Sort chevron, filter funnel, and drag handle all live INSIDE the header
    // cell at render time and compete with the header text for horizontal space.
    // When the user enables one of these features we bake its px contribution
    // into the auto-width measurement so:
    //   - browser view: header text + icons fits without clipping
    //   - SVG/PNG export: same column widths (they live in columnWidths); the
    //     exported file has extra slack that simply appears as whitespace on
    //     the right, preserving WYSIWYG column alignment with the interactive view.
    // Icons are hidden in screenshotMode; widths stay the same (harmless slack).
    //
    // Rough pixel costs (SortIndicator/funnel/grip each have a small margin).
    // Icons are only rendered when edit mode is on (and the corresponding flag is set).
    const I = spec.interaction;
    const SORT_PX = 14;              // chevron (10) + left margin (4)
    const FUNNEL_PX = 20;            // funnel button (18) + left margin (2)
    const COL_GRIP_PX = 16;          // column drag handle (14) + right margin (2)
    const GROUP_GRIP_PX = 16;        // group-header drag handle
    const filtersOn = !!(I.enableFilters || I.showFilters);
    const iconsVisible = iconsVisibleArg;
    function leafIconBudget(col: ColumnSpec): number {
      if (!iconsVisible) return 0;
      let px = 0;
      if (I.enableSort && col.sortable && col.type !== "forest") px += SORT_PX;
      if (filtersOn && col.type !== "forest"
          && col.type !== "viz_bar" && col.type !== "viz_boxplot" && col.type !== "viz_violin") {
        px += FUNNEL_PX;
      }
      if (I.enableReorderColumns) px += COL_GRIP_PX;
      return px;
    }
    function groupIconBudget(): number {
      if (!iconsVisible) return 0;
      return I.enableReorderColumns ? GROUP_GRIP_PX : 0;
    }

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
      // Skip columns with explicit numeric width - they use that width directly
      // (but may be expanded later if a group header needs more space)
      if (typeof col.width === 'number') return;

      // Only auto-size columns with width="auto", null, or undefined (omitted)
      // Use != null to match both null and undefined (R's NULL may serialize as omitted property)
      if (col.width != null && col.width !== "auto") return;

      // Respect manual resizes — skip columns the user has resized themselves.
      if (userResizedIds.has(col.id)) return;

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

      // Apply padding (from theme), interaction-icon budget, and constraints.
      // Icons sit alongside the header text in the same cell, so they count against
      // the cell's content width rather than against data-row content widths.
      const iconBudget = leafIconBudget(col);
      const typeMin = AUTO_WIDTH.VISUAL_MIN[col.type] ?? AUTO_WIDTH.MIN;
      const computedWidth = Math.min(
        AUTO_WIDTH.MAX,
        Math.max(typeMin, Math.ceil(maxWidth + iconBudget + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER)),
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
          // Group header needs: text width + its own padding (from theme) + rendering buffer
          // + a drag-handle budget when enableReorderColumns is on (handle sits alongside label).
          const groupHeaderWidth = ctx!.measureText(col.header).width + groupIconBudget() + groupPadding + TEXT_MEASUREMENT.RENDERING_BUFFER;

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

    // Measure label column width
    if (spec.data.labelCol && !userResizedIds.has("__label__")) {
      let maxLabelWidth = 0;
      // Row-drag-handle budget: when row reorder is on, a grip icon is rendered
      // inside every data-row label cell and group-header label.
      const ROW_GRIP_PX = 18; // 14px handle + 4px right margin
      const rowGripBudget = (iconsVisible && I.enableReorderRows) ? ROW_GRIP_PX : 0;

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

      // Measure label header with bold font
      if (spec.data.labelHeader) {
        ctx!.font = headerFont;
        maxLabelWidth = Math.max(maxLabelWidth, ctx!.measureText(spec.data.labelHeader).width);
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

      ctx!.font = headerFont;
      for (const group of spec.data.groups) {
        if (group.label) {
          const indentWidth = group.depth * SPACING.INDENT_PER_LEVEL;
          const labelWidth = ctx!.measureText(group.label).width;

          // Row count (e.g., "(3)") includes all descendants, matching display
          const rowCount = countAllDescendantRowsForGroup(group.id);
          const countText = `(${rowCount})`;
          const countFontSize = baseFontSize * 0.75; // font-size-sm
          ctx!.font = `${countFontSize}px ${fontFamily}`;
          const countWidth = ctx!.measureText(countText).width;
          ctx!.font = headerFont;

          // Total: all components from GroupHeader.svelte layout
          // (plus a row-drag-handle budget when row-group reorder is on)
          const totalWidth = indentWidth
            + rowGripBudget
            + GROUP_HEADER.CHEVRON_WIDTH
            + GROUP_HEADER.GAP
            + labelWidth
            + GROUP_HEADER.GAP
            + countWidth
            + GROUP_HEADER.SAFETY_MARGIN;

          maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        }
      }

      // Apply padding (from theme) and constraints (label column has higher max)
      const computedLabelWidth = Math.min(AUTO_WIDTH.LABEL_MAX, Math.max(AUTO_WIDTH.MIN, Math.ceil(maxLabelWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER)));
      target["__label__"] = computedLabelWidth;
    }
  }

  function setDimensions(w: number, h: number) {
    // Set initial dimensions (used as fallback before ResizeObserver fires)
    initialWidth = w;
    initialHeight = h;
  }

  function selectRow(id: string) {
    const newSelection = new Set(selectedRowIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    selectedRowIds = newSelection;
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

  function sortBy(column: string, direction: "asc" | "desc" | "none") {
    sortConfig = direction === "none" ? null : { column, direction };
  }

  // Cycle sort state for a column: none → asc → desc → none
  function toggleSort(column: string) {
    if (!sortConfig || sortConfig.column !== column) {
      sortConfig = { column, direction: "asc" };
    } else if (sortConfig.direction === "asc") {
      sortConfig = { column, direction: "desc" };
    } else {
      sortConfig = null;
    }
  }

  function setFilter(filter: FilterConfig | null) {
    filterConfig = filter;
  }

  // Multi-column filter API (per-header popovers)
  function setColumnFilter(field: string, filter: ColumnFilter | null) {
    if (filter === null) {
      const { [field]: _removed, ...rest } = filters;
      filters = rest;
    } else {
      filters = { ...filters, [field]: filter };
    }
  }

  function clearAllFilters() {
    filters = {};
    filterConfig = null;
  }

  function getColumnFilter(field: string): ColumnFilter | null {
    return filters[field] ?? null;
  }

  // Detect filter UI kind for a column: numeric range / categorical checklist / text contains.
  function detectColumnKind(field: string): ColumnKind {
    if (!spec) return "text";
    const col = allColumns.find((c) => c.field === field);
    const numericTypes: ColumnSpec["type"][] = [
      "numeric", "percent", "events", "bar", "pvalue", "heatmap", "progress", "range",
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
    cellEdits = { ...cellEdits, labels: { ...cellEdits.labels, [rowId]: label } };
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
    return cellEdits.labels[row.id] ?? row.label;
  }

  function clearAllEdits() {
    cellEdits = { cells: {}, labels: {} };
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

  // Edit mode toggle. Off = clean read-only view (no icons, tight widths).
  // On = interaction chrome visible, auto-width columns expanded to fit icons.
  // Re-measures the interactive width dictionary; the compact (export) widths
  // are untouched so downloads always use the clean layout.
  function setEditMode(v: boolean) {
    if (editMode === v) return;
    editMode = v;
    measureAutoColumns();
  }
  function toggleEditMode() { setEditMode(!editMode); }

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
    // Propagate to compact widths so export honors user resizes too.
    columnWidthsCompact[columnId] = w;
    // Mark as user-resized so edit-mode re-measurement doesn't overwrite it.
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

  function setTheme(themeName: ThemeName) {
    const newTheme = THEME_PRESETS[themeName];
    if (!spec || !newTheme) return;
    spec = { ...spec, theme: newTheme };
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

  // Reset all user-modified state to defaults
  function resetState() {
    selectedRowIds = new Set();
    collapsedGroups = new Set();
    sortConfig = null;
    filterConfig = null;
    columnWidths = {};
    columnWidthsCompact = {};
    userResizedIds = new Set();
    plotWidthOverride = null;
    zoom = 1.0;
    autoFit = true;
    maxWidth = null;
    maxHeight = null;
    hoveredRowId = null;
    tooltipRowId = null;
    tooltipPosition = null;
    // Note: spec theme is not reset here - use setSpec to fully reset
    // Note: showZoomControls is not reset - it's a UI preference
  }

  // Derived: tooltip row
  const tooltipRow = $derived.by((): Row | null => {
    if (!tooltipRowId || !spec) return null;
    return spec.data.rows.find((r) => r.id === tooltipRowId) ?? null;
  });

  // Derived: exportSpec — WYSIWYG spec reflecting the user's current view state.
  // Both the interactive renderer and the SVG/PNG export consume this (via different paths),
  // keeping them in lock-step by construction. See the interactivity plan for details.
  const exportSpec = $derived.by((): WebSpec | null => {
    if (!spec) return null;

    // 1. Flatten displayRows to an ordered Row[]. This already reflects:
    //    filter + sort + collapse-driven omission + (future) row-reorder.
    //    Group headers are skipped — they're reconstructed from `groups` on export.
    const orderedRows: Row[] = [];
    for (const dr of displayRows) {
      if (dr.type === "data") {
        const base = dr.row;
        const editedMeta = cellEdits.cells[base.id];
        const editedLabel = cellEdits.labels[base.id];
        if (editedMeta || editedLabel !== undefined) {
          orderedRows.push({
            ...base,
            label: editedLabel ?? base.label,
            metadata: editedMeta ? { ...base.metadata, ...editedMeta } : base.metadata,
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

    return {
      ...spec,
      columns: effectiveColumnDefs,
      data: {
        ...spec.data,
        rows: orderedRows,
        groups: groupsOut,
      },
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
      return selectedRowIds;
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
    get editMode() {
      return editMode;
    },
    get columnWidthsCompact() {
      return columnWidthsCompact;
    },
    get exportSpec() {
      return exportSpec;
    },
    getRowDepth,
    getColumnWidth,
    getPlotWidth,

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

      // Export always uses the compact (edit-mode-off) widths so downloads look
      // identical to the clean view, regardless of whether the user is currently
      // in edit mode. User-resized columns are already mirrored into compact widths
      // by setColumnWidth(), so they're honored here too.
      const widths = columnWidthsCompact;

      // Start after label column
      const labelWidth = widths["__label__"] ?? 150;
      columnWidthsOut["__label__"] = labelWidth;
      let currentX = labelWidth;

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

        // Use global axis computation for now (TODO: per-column axis computation)
        forestColumnsData.push({
          columnId: col.id,
          xPosition: columnPositions[col.id],
          width: fcWidth,
          xDomain: domain,
          clipBounds: axisComputation.axisLimits,
          ticks: axisComputation.ticks,
          scale: fcScale,
          nullValue: fcNullValue,
          axisLabel: forestOpts?.axisLabel ?? "Effect",
        });
      }

      // Calculate row heights and positions
      const rowHeights: number[] = [];
      const rowPositions: number[] = [];
      let totalRowsHeight = 0;

      for (const displayRow of displayRows) {
        const h = (displayRow.type === "data" && displayRow.row.style?.type === "spacer")
          ? layout.rowHeight / 2
          : layout.rowHeight;
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
    toggleGroup,
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
    // Edit
    startEdit,
    endEdit,
    setCellValue,
    clearCellEdit,
    setRowLabel,
    setForestCellValues,
    getDisplayValue,
    getLabel,
    clearAllEdits,
    // Filter popover + edit mode
    openFilterPopover,
    closeFilterPopover,
    setEditMode,
    toggleEditMode,
    setHovered,
    setTooltip,
    setColumnWidth,
    setPlotWidth,
    setTheme,
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
  };
}

export type ForestStore = ReturnType<typeof createForestStore>;

// Apply all column filters (AND across columns).
function applyFilters(rows: Row[], state: FiltersState): Row[] {
  const filterList = Object.values(state);
  if (filterList.length === 0) return rows;
  return rows.filter((row) => filterList.every((f) => matchColumnFilter(row, f)));
}

function readField(row: Row, field: string): unknown {
  return row.metadata[field] ?? (row as Record<string, unknown>)[field];
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
    const value = row.metadata[config.field] ?? (row as Record<string, unknown>)[config.field];

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

function applySort(rows: Row[], config: SortConfig): Row[] {
  const sorted = [...rows];
  const { column, direction } = config;

  sorted.sort((a, b) => {
    const aVal = a.metadata[column] ?? (a as Record<string, unknown>)[column];
    const bVal = b.metadata[column] ?? (b as Record<string, unknown>)[column];

    let comparison = 0;
    if (typeof aVal === "number" && typeof bVal === "number") {
      comparison = aVal - bVal;
    } else if (typeof aVal === "string" && typeof bVal === "string") {
      comparison = aVal.localeCompare(bVal);
    }

    return direction === "desc" ? -comparison : comparison;
  });

  return sorted;
}

// Sort rows within each group bucket so grouping structure is preserved.
// Rows with the same groupId stay contiguous and retain their relative group order.
function applySortWithinGroups(rows: Row[], config: SortConfig): Row[] {
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
    const sortedBucket = applySort(bucketRows, config);
    positions.forEach((pos, i) => {
      result[pos] = sortedBucket[i];
    });
  }
  return result;
}
