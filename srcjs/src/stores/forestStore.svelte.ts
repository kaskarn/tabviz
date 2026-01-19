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
  ComputedLayout,
  DisplayRow,
  GroupHeaderRow,
  DataRow,
  ZoomState,
} from "$types";
import { niceDomain } from "$lib/scale-utils";
import { computeAxis, type AxisComputation, AXIS_LABEL_PADDING } from "$lib/axis-utils";
import { THEME_PRESETS, type ThemeName } from "$lib/theme-presets";
import { getColumnDisplayText } from "$lib/formatters";
import { AUTO_WIDTH, SPACING, GROUP_HEADER, TEXT_MEASUREMENT } from "$lib/rendering-constants";

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
  let hoveredRowId = $state<string | null>(null);

  // Tooltip state
  let tooltipRowId = $state<string | null>(null);
  let tooltipPosition = $state<{ x: number; y: number } | null>(null);

  // Column width state (for resize)
  let columnWidths = $state<Record<string, number>>({});

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

    // Apply filter
    if (filterConfig) {
      rows = applyFilter(rows, filterConfig);
    }

    // Apply sort
    if (sortConfig) {
      rows = applySort(rows, sortConfig);
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
    const rangeStart = AXIS_LABEL_PADDING;
    const rangeEnd = Math.max(forestWidth - AXIS_LABEL_PADDING, rangeStart + 50);

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

  // Derived: all columns in order (flattened, no position filtering)
  const allColumns = $derived.by((): ColumnSpec[] => {
    if (!spec) return [];
    return flattenAllColumns(spec.columns);
  });

  // Derived: all column definitions in order (for headers)
  const allColumnDefs = $derived.by((): ColumnDef[] => {
    if (!spec) return [];
    return spec.columns;
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

    // 1. Group rows by groupId
    const rowsByGroup = new Map<string | null, Row[]>();
    for (const row of visibleRows) {
      const key = row.groupId ?? null;
      if (!rowsByGroup.has(key)) rowsByGroup.set(key, []);
      rowsByGroup.get(key)!.push(row);
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

    // 3. Helper to get child groups of a parent
    function getChildGroups(parentId: string | null): Group[] {
      return spec!.data.groups
        .filter(g => (g.parentId ?? null) === parentId && groupsWithHeaders.has(g.id));
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
    const axisHeight = 32 + axisGap; // Axis content (32px) + configurable gap
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

  // Derived: natural content width (intrinsic width based on column specs, not container)
  // Used for fill mode scaling calculations
  const naturalContentWidth = $derived.by((): number => {
    if (!spec) return 800;

    const DEFAULT_COLUMN_WIDTH = 100;
    const LABEL_COLUMN_WIDTH = 150;
    const DEFAULT_FOREST_WIDTH = 250;

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
    totalColumnWidth += LABEL_COLUMN_WIDTH;

    // Add forest plot width if we have forest columns
    const hasForest = forestColumns.length > 0;
    const forestWidth = hasForest
      ? (plotWidthOverride ?? DEFAULT_FOREST_WIDTH)
      : 0;

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

    // Do initial measurement immediately
    doMeasurement(fontSize, fontFamily);

    // Then wait for fonts to load and re-measure for accuracy
    // This ensures custom/web fonts are properly measured
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        doMeasurement(fontSize as string, fontFamily, true);
      });
    }
  }

  // Perform the actual column width measurement
  function doMeasurement(fontSize: string, fontFamily: string, isFontLoaded = false) {
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
      if (columnWidths[col.id] !== undefined) {
        return columnWidths[col.id];
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

      // Apply padding (from theme) and constraints
      const typeMin = AUTO_WIDTH.VISUAL_MIN[col.type] ?? AUTO_WIDTH.MIN;
      const computedWidth = Math.min(AUTO_WIDTH.MAX, Math.max(typeMin, Math.ceil(maxWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER)));
      columnWidths[col.id] = computedWidth;
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
          const groupHeaderWidth = ctx!.measureText(col.header).width + groupPadding + TEXT_MEASUREMENT.RENDERING_BUFFER;

          const leafCols = getLeafColumns(col);
          const childrenTotalWidth = leafCols.reduce((sum, leaf) => sum + getEffectiveWidth(leaf), 0);

          // If group header needs more width, distribute extra to ALL children
          // (including explicit-width columns - we override to ensure header fits)
          if (groupHeaderWidth > childrenTotalWidth && leafCols.length > 0) {
            const extraPerChild = Math.ceil((groupHeaderWidth - childrenTotalWidth) / leafCols.length);
            for (const leaf of leafCols) {
              columnWidths[leaf.id] = getEffectiveWidth(leaf) + extraPerChild;
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
    if (spec.data.labelCol) {
      let maxLabelWidth = 0;

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
          let rowWidth = ctx!.measureText(row.label).width + indentWidth;

          // Account for badge width if present
          if (row.style?.badge) {
            const badgeText = String(row.style.badge);
            const badgeFontSize = baseFontSize * 0.8;
            const badgePadding = 4;
            const badgeGap = 6; // gap between label and badge
            ctx!.font = `${badgeFontSize}px ${fontFamily}`;
            const badgeTextWidth = ctx!.measureText(badgeText).width;
            const badgeWidth = badgeTextWidth + badgePadding * 2;
            rowWidth += badgeGap + badgeWidth;
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
          const totalWidth = indentWidth
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
      columnWidths["__label__"] = computedLabelWidth;
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

  function setFilter(filter: FilterConfig | null) {
    filterConfig = filter;
  }

  function setHovered(id: string | null) {
    hoveredRowId = id;
  }

  function setTooltip(rowId: string | null, position: { x: number; y: number } | null) {
    tooltipRowId = rowId;
    tooltipPosition = position;
  }

  function setColumnWidth(columnId: string, width: number) {
    columnWidths[columnId] = Math.max(40, width); // min 40px
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

      // Start after label column
      const labelWidth = columnWidths["__label__"] ?? 150;
      columnWidthsOut["__label__"] = labelWidth;
      let currentX = labelWidth;

      // Process all columns in order (forest columns are inline)
      for (const col of allColumns) {
        columnOrder.push(col.id);
        columnPositions[col.id] = currentX;

        let colWidth: number;
        if (col.type === "forest") {
          // Forest columns use their configured width or fall back to layout.forestWidth
          colWidth = col.options?.forest?.width ?? layout.forestWidth;
        } else {
          colWidth = columnWidths[col.id] ?? (typeof col.width === "number" ? col.width : 100);
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
        const fcWidth = forestOpts?.width ?? layout.forestWidth;
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
        naturalHeight: totalRowsHeight + layout.headerHeight + 52, // +52 for axis

        // Legacy fields for backwards compatibility
        forestWidth: layout.forestWidth * zoom,
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
    setFilter,
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
