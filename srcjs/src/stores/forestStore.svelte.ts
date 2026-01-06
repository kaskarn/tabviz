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
} from "$types";
import { niceDomain, DOMAIN_PADDING } from "$lib/scale-utils";
import { THEME_PRESETS, type ThemeName } from "$lib/theme-presets";
import { getColumnDisplayText } from "$lib/formatters";
import { AUTO_WIDTH } from "$lib/rendering-constants";

// Svelte 5 runes-based store
export function createForestStore() {
  // Core state
  let spec = $state<WebSpec | null>(null);
  let width = $state(800);
  let height = $state(400);

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

  // Layout mode state
  let widthMode = $state<'natural' | 'fill'>('natural');
  let heightPreset = $state<'small' | 'medium' | 'large' | 'full' | 'container'>('full');

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

  // Padding for axis labels at edges (prevents label clipping)
  // 30px provides enough space for 4-char labels like "0.20"
  const AXIS_LABEL_PADDING = 30;

  // Derived: x-scale
  const xScale = $derived.by(() => {
    if (!spec) return scaleLinear().domain([0, 1]).range([0, 100]);

    const rows = spec.data.rows;
    const axisConfig = spec.theme.axis;

    // Check if explicit range is provided in theme
    const hasExplicitMin = axisConfig?.rangeMin != null;
    const hasExplicitMax = axisConfig?.rangeMax != null;

    let domain: [number, number];

    if (hasExplicitMin && hasExplicitMax) {
      // Use fully explicit range
      domain = [axisConfig.rangeMin!, axisConfig.rangeMax!];
    } else {
      // Calculate domain from data (filter out null/undefined/NaN from header/spacer rows)
      const allValues = rows
        .flatMap((r) => [r.lower, r.upper])
        .filter((v): v is number => v != null && !Number.isNaN(v) && Number.isFinite(v));

      if (allValues.length === 0) {
        domain = spec.data.scale === "log" ? [0.1, 10] : [0, 1];
      } else {
        const [minVal, maxVal] = [Math.min(...allValues), Math.max(...allValues)];
        const range = maxVal - minVal || 1;

        domain = [
          hasExplicitMin ? axisConfig.rangeMin! : minVal - range * DOMAIN_PADDING,
          hasExplicitMax ? axisConfig.rangeMax! : maxVal + range * DOMAIN_PADDING,
        ];
      }
    }

    // Use log scale for log data
    const isLog = spec.data.scale === "log";
    // Use override if set, otherwise calculate default (25% of width, min 200px)
    const forestWidth = spec.data.includeForest
      ? (plotWidthOverride ?? Math.max(width * 0.25, 200))
      : 0;

    // Apply consistent nice domain rounding (shared with SVG generator)
    const nicedDomain = niceDomain(domain, isLog);

    // Add padding to range so edge labels don't get clipped
    const rangeStart = AXIS_LABEL_PADDING;
    const rangeEnd = Math.max(forestWidth - AXIS_LABEL_PADDING, rangeStart + 50);

    if (isLog) {
      // Ensure domain is positive for log scale
      const safeDomain: [number, number] = [
        Math.max(nicedDomain[0], 0.01),
        Math.max(nicedDomain[1], 0.02),
      ];
      return scaleLog().domain(safeDomain).range([rangeStart, rangeEnd]);
    }

    return scaleLinear().domain(nicedDomain).range([rangeStart, rangeEnd]);
  });

  // Helper to flatten group children (no position filtering - children inherit from parent)
  function flattenGroupChildren(columns: ColumnDef[]): ColumnSpec[] {
    const result: ColumnSpec[] = [];
    for (const col of columns) {
      if (col.isGroup) {
        result.push(...flattenGroupChildren(col.columns));
      } else {
        result.push(col);
      }
    }
    return result;
  }

  // Helper to flatten column groups into flat ColumnSpec array
  function flattenColumns(columns: ColumnDef[], position: "left" | "right"): ColumnSpec[] {
    const result: ColumnSpec[] = [];
    for (const col of columns) {
      if (col.position !== position) continue;
      if (col.isGroup) {
        // Group children inherit position from parent - don't filter them
        result.push(...flattenGroupChildren(col.columns));
      } else {
        result.push(col);
      }
    }
    return result;
  }

  // Derived: flattened columns by position
  const leftColumns = $derived.by((): ColumnSpec[] => {
    if (!spec) return [];
    return flattenColumns(spec.columns, "left");
  });

  const rightColumns = $derived.by((): ColumnSpec[] => {
    if (!spec) return [];
    return flattenColumns(spec.columns, "right");
  });

  // Derived: raw column definitions by position (for headers)
  const leftColumnDefs = $derived.by((): ColumnDef[] => {
    if (!spec) return [];
    return spec.columns.filter((c) => c.position === "left");
  });

  const rightColumnDefs = $derived.by((): ColumnDef[] => {
    if (!spec) return [];
    return spec.columns.filter((c) => c.position === "right");
  });

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
        totalWidth: width,
        totalHeight: height,
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
    const axisGap = spec.theme.spacing.axisGap ?? 12; // Gap between table and axis
    const axisHeight = 32 + axisGap; // Axis content (32px) + configurable gap
    const includeForest = spec.data.includeForest;
    // Use override if set, otherwise calculate default (25% of width, min 200px)
    const forestWidth = includeForest
      ? (plotWidthOverride ?? Math.max(width * 0.25, 200))
      : 0;
    const tableWidth = width - forestWidth - (includeForest ? spec.theme.spacing.columnGap : 0);

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

    return {
      totalWidth: width,
      totalHeight: Math.max(height, plotHeight + headerHeight + axisHeight + spec.theme.spacing.padding * 2),
      tableWidth,
      forestWidth,
      headerHeight,
      rowHeight,
      plotHeight,
      axisHeight,
      nullValue: spec.data.nullValue,
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

    // Calculate sum of all column widths
    let totalColumnWidth = 0;
    const allColumns = [...leftColumns, ...rightColumns];
    for (const col of allColumns) {
      // Use computed width if available, otherwise spec width, otherwise default
      const w = columnWidths[col.id]
        ?? (typeof col.width === 'number' ? col.width : null)
        ?? DEFAULT_COLUMN_WIDTH;
      totalColumnWidth += w;
    }

    // Add label column (always present on left)
    totalColumnWidth += LABEL_COLUMN_WIDTH;

    // Add forest plot width if included
    const forestWidth = spec.data.includeForest
      ? (plotWidthOverride ?? DEFAULT_FOREST_WIDTH)
      : 0;

    // Add gaps and padding
    const columnGap = spec.data.includeForest ? spec.theme.spacing.columnGap : 0;
    const padding = spec.theme.spacing.padding * 2;

    return totalColumnWidth + forestWidth + columnGap + padding;
  });

  // Actions
  function setSpec(newSpec: WebSpec) {
    spec = newSpec;
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

    // Convert rem to px (assume 16px base, common browser default)
    if (typeof fontSize === 'string' && fontSize.endsWith('rem')) {
      const remValue = parseFloat(fontSize);
      fontSize = `${remValue * 16}px`;
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

    // Font strings for headers (bold) and data cells (normal)
    const headerFont = `600 ${fontSize} ${fontFamily}`;
    const dataFont = `${fontSize} ${fontFamily}`;

    // Process columns recursively
    function processColumn(col: ColumnSpec | ColumnGroup) {
      if (col.isGroup) {
        for (const child of col.columns) {
          processColumn(child);
        }
        return;
      }

      // Only process columns with width="auto" or null (both trigger auto-sizing)
      if (col.width !== "auto" && col.width !== null) return;

      let maxWidth = 0;

      // Measure header text with bold font (headers use font-weight: 600)
      if (col.header) {
        ctx!.font = headerFont;
        maxWidth = Math.max(maxWidth, ctx!.measureText(col.header).width);
      }

      // Measure all data cell values with normal font
      ctx!.font = dataFont;
      for (const row of spec!.data.rows) {
        // Skip header/spacer rows that don't have real data
        if (row.style?.type === "header" || row.style?.type === "spacer") {
          continue;
        }

        // Use getColumnDisplayText to get the actual rendered text for this column type
        const text = getColumnDisplayText(row, col);
        if (text) {
          maxWidth = Math.max(maxWidth, ctx!.measureText(text).width);
        }
      }

      // Apply computed width with padding and constraints
      // Use type-specific minimum for visual columns, else default minimum
      const typeMin = AUTO_WIDTH.VISUAL_MIN[col.type] ?? AUTO_WIDTH.MIN;
      const computedWidth = Math.min(AUTO_WIDTH.MAX, Math.max(typeMin, Math.ceil(maxWidth + AUTO_WIDTH.PADDING)));
      columnWidths[col.id] = computedWidth;
    }

    for (const colDef of spec.columns) {
      processColumn(colDef);
    }
  }

  function setDimensions(w: number, h: number) {
    width = w;
    height = h;
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

  function toggleForestView() {
    if (!spec) return;
    spec = {
      ...spec,
      data: { ...spec.data, includeForest: !spec.data.includeForest },
    };
  }

  // Layout mode controls
  function setWidthMode(mode: 'natural' | 'fill') {
    widthMode = mode;
  }

  function toggleWidthMode() {
    widthMode = widthMode === 'natural' ? 'fill' : 'natural';
  }

  function setHeightPreset(preset: 'small' | 'medium' | 'large' | 'full' | 'container') {
    heightPreset = preset;
  }

  function toggleHeightPreset() {
    const presets = ['small', 'medium', 'large', 'full', 'container'] as const;
    const currentIndex = presets.indexOf(heightPreset);
    heightPreset = presets[(currentIndex + 1) % presets.length];
  }

  // Reset all user-modified state to defaults
  function resetState() {
    selectedRowIds = new Set();
    collapsedGroups = new Set();
    sortConfig = null;
    filterConfig = null;
    columnWidths = {};
    plotWidthOverride = null;
    widthMode = 'natural';
    heightPreset = 'full';
    hoveredRowId = null;
    tooltipRowId = null;
    tooltipPosition = null;
    // Note: spec theme is not reset here - use setSpec to fully reset
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
      return width;
    },
    get height() {
      return height;
    },
    get visibleRows() {
      return visibleRows;
    },
    get xScale() {
      return xScale;
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
    get leftColumns() {
      return leftColumns;
    },
    get rightColumns() {
      return rightColumns;
    },
    get leftColumnDefs() {
      return leftColumnDefs;
    },
    get rightColumnDefs() {
      return rightColumnDefs;
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
    get widthMode() {
      return widthMode;
    },
    get heightPreset() {
      return heightPreset;
    },
    get naturalContentWidth() {
      return naturalContentWidth;
    },
    getRowDepth,
    getColumnWidth,
    getPlotWidth,

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
    toggleForestView,
    setWidthMode,
    toggleWidthMode,
    setHeightPreset,
    toggleHeightPreset,
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
