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

  // Derived: x-scale
  const xScale = $derived.by(() => {
    if (!spec) return scaleLinear().domain([0, 1]).range([0, 100]);

    const rows = spec.data.rows;
    const axisConfig = spec.theme.axis;
    const padding = 0.15;

    // Check if explicit range is provided in theme
    const hasExplicitMin = axisConfig?.rangeMin != null;
    const hasExplicitMax = axisConfig?.rangeMax != null;

    let domain: [number, number];

    if (hasExplicitMin && hasExplicitMax) {
      // Use fully explicit range
      domain = [axisConfig.rangeMin!, axisConfig.rangeMax!];
    } else {
      // Calculate domain from data
      const allValues = rows.flatMap((r) => [r.lower, r.upper]);
      const [minVal, maxVal] = [Math.min(...allValues), Math.max(...allValues)];
      const range = maxVal - minVal;

      domain = [
        hasExplicitMin ? axisConfig.rangeMin! : minVal - range * padding,
        hasExplicitMax ? axisConfig.rangeMax! : maxVal + range * padding,
      ];
    }

    // Use log scale for log data
    const isLog = spec.data.scale === "log";
    // Use override if set, otherwise calculate default (25% of width, min 200px)
    const forestWidth = spec.data.includeForest
      ? (plotWidthOverride ?? Math.max(width * 0.25, 200))
      : 0;

    if (isLog) {
      // Ensure domain is positive for log scale
      const safeDomain: [number, number] = [
        Math.max(domain[0], 0.01),
        Math.max(domain[1], 0.02),
      ];
      return scaleLog().domain(safeDomain).range([0, forestWidth]).nice();
    }

    return scaleLinear().domain(domain).range([0, forestWidth]).nice();
  });

  // Helper to flatten column groups into flat ColumnSpec array
  function flattenColumns(columns: ColumnDef[], position: "left" | "right"): ColumnSpec[] {
    const result: ColumnSpec[] = [];
    for (const col of columns) {
      if (col.position !== position) continue;
      if (col.isGroup) {
        result.push(...flattenColumns(col.columns, position));
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

    // 4. Recursive function to output a group and its descendants
    function outputGroup(groupId: string | null) {
      if (groupId) {
        const group = groupMap.get(groupId);
        if (!group) return;

        // Skip if any ancestor is collapsed
        if (isAncestorCollapsed(groupId)) return;

        const isCollapsed = collapsedGroups.has(group.id);
        const rowCount = rowsByGroup.get(groupId)?.length ?? 0;

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
      };
    }

    const rowHeight = spec.theme.spacing.rowHeight;
    const headerHeight = spec.theme.spacing.headerHeight;
    const axisHeight = 32; // Space for bottom axis
    const includeForest = spec.data.includeForest;
    // Use override if set, otherwise calculate default (25% of width, min 200px)
    const forestWidth = includeForest
      ? (plotWidthOverride ?? Math.max(width * 0.25, 200))
      : 0;
    const tableWidth = width - forestWidth - (includeForest ? spec.theme.spacing.columnGap : 0);

    const hasOverall = !!spec.data.overall;

    // Plot height: displayRows already accounts for collapsed groups and cascade
    const displayRowCount = displayRows.length;
    const plotHeight =
      displayRowCount * rowHeight +
      (hasOverall ? rowHeight * 1.5 : 0);

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
    };
  });

  // Actions
  function setSpec(newSpec: WebSpec) {
    spec = newSpec;
    // Initialize collapsed state from spec
    collapsedGroups = new Set(
      newSpec.data.groups.filter((g) => g.collapsed).map((g) => g.id)
    );
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
