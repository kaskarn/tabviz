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
import { AUTO_WIDTH, SPACING, GROUP_HEADER, COLUMN_GROUP } from "$lib/rendering-constants";

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

  // Derived: x-scale
  // Implements the new auto-scaling algorithm:
  // 1. Core range from point estimates (not CI bounds)
  // 2. Include null value if configured
  // 3. Add padding as fraction of estimate range
  // 4. Apply symmetry around null if configured
  // 5. Account for marker margin at edges
  const xScale = $derived.by(() => {
    if (!spec) return scaleLinear().domain([0, 1]).range([0, 100]);

    const rows = spec.data.rows;
    const axisConfig = spec.theme.axis;
    const isLog = spec.data.scale === "log";
    const nullValue = spec.data.nullValue;

    // Extract axis config with defaults
    const padding = axisConfig?.padding ?? 0.15;
    const includeNull = axisConfig?.includeNull ?? true;
    const symmetric = axisConfig?.symmetric;  // null = auto
    const markerMargin = axisConfig?.markerMargin ?? true;
    const ciTruncationThreshold = axisConfig?.ciTruncationThreshold ?? 3.0;

    // Check if explicit range is provided in theme
    const hasExplicitMin = axisConfig?.rangeMin != null;
    const hasExplicitMax = axisConfig?.rangeMax != null;

    let domain: [number, number];

    if (hasExplicitMin && hasExplicitMax) {
      // Use fully explicit range
      domain = [axisConfig.rangeMin!, axisConfig.rangeMax!];
    } else {
      // Step 1: Collect point estimates (not CI bounds)
      const pointEstimates = rows
        .map((r) => r.point)
        .filter((v): v is number => v != null && !Number.isNaN(v) && Number.isFinite(v));

      if (pointEstimates.length === 0) {
        // Fallback when no valid estimates
        domain = isLog ? [0.1, 10] : [0, 1];
      } else {
        let minEst = Math.min(...pointEstimates);
        let maxEst = Math.max(...pointEstimates);

        // Step 2: Include null value if configured
        if (includeNull) {
          minEst = Math.min(minEst, nullValue);
          maxEst = Math.max(maxEst, nullValue);
        }

        // Save core estimate range BEFORE CI extension (for symmetric calculation)
        const coreMin = minEst;
        const coreMax = maxEst;

        // Calculate estimate range for CI truncation threshold
        const estimateRange = maxEst - minEst || 1;
        const truncationLimit = estimateRange * ciTruncationThreshold;

        // Step 3: Extend range to include CI bounds within truncation threshold
        // This reduces how often CIs get truncated (shown with arrows)
        const lowerBounds = rows
          .map((r) => r.lower)
          .filter((v): v is number => v != null && !Number.isNaN(v) && Number.isFinite(v));
        const upperBounds = rows
          .map((r) => r.upper)
          .filter((v): v is number => v != null && !Number.isNaN(v) && Number.isFinite(v));

        // Include CI bounds that are within the truncation threshold
        for (const lb of lowerBounds) {
          if (minEst - lb <= truncationLimit) {
            minEst = Math.min(minEst, lb);
          }
        }
        for (const ub of upperBounds) {
          if (ub - maxEst <= truncationLimit) {
            maxEst = Math.max(maxEst, ub);
          }
        }

        // Step 4: Add padding as fraction of the range
        let domainMin = hasExplicitMin ? axisConfig.rangeMin! : minEst - estimateRange * padding;
        let domainMax = hasExplicitMax ? axisConfig.rangeMax! : maxEst + estimateRange * padding;

        // Step 4: Apply symmetry around null if explicitly requested
        // symmetric = true: force symmetry (user must opt-in)
        // symmetric = false/null: no symmetry (default)
        const shouldBeSymmetric = symmetric === true;

        if (shouldBeSymmetric && !hasExplicitMin && !hasExplicitMax) {
          if (isLog) {
            // Log scale: geometric symmetry around null (e.g., 0.5 and 2.0 are equidistant from 1)
            // Use CORE estimate range (not CI-extended) to avoid extreme expansion from outlier CIs
            const logNull = Math.log(nullValue);
            const maxLogDist = Math.max(
              Math.abs(Math.log(Math.max(coreMin, 0.001)) - logNull),
              Math.abs(Math.log(coreMax) - logNull)
            );
            domainMin = Math.exp(logNull - maxLogDist);
            domainMax = Math.exp(logNull + maxLogDist);
          } else {
            // Linear scale: arithmetic symmetry
            // Use CORE estimate range (not CI-extended) to avoid extreme expansion
            const maxDist = Math.max(
              Math.abs(coreMin - nullValue),
              Math.abs(coreMax - nullValue)
            );
            domainMin = nullValue - maxDist;
            domainMax = nullValue + maxDist;
          }
        }

        domain = [domainMin, domainMax];
      }
    }

    // Use override if set, otherwise calculate default (25% of width, min 200px)
    const forestWidth = spec.data.includeForest
      ? (plotWidthOverride ?? Math.max(width * 0.25, 200))
      : 0;

    // Apply consistent nice domain rounding (shared with SVG generator)
    const nicedDomain = niceDomain(domain, isLog);

    // Step 5: Account for marker margin at edges
    // Add half-marker-width in domain units so markers don't clip
    let finalDomain = nicedDomain;
    if (markerMargin && forestWidth > 0) {
      const pointSize = spec.theme.shapes.pointSize;
      // Convert pixel margin to domain units
      const domainRange = nicedDomain[1] - nicedDomain[0];
      const pixelRange = forestWidth - 2 * SPACING.AXIS_LABEL_PADDING;
      const marginInDomainUnits = (pointSize / 2) * (domainRange / pixelRange);

      if (isLog) {
        // For log scale, apply multiplicative margin
        const logMargin = marginInDomainUnits / nicedDomain[0];
        finalDomain = [
          nicedDomain[0] / (1 + logMargin),
          nicedDomain[1] * (1 + logMargin),
        ];
      } else {
        finalDomain = [
          nicedDomain[0] - marginInDomainUnits,
          nicedDomain[1] + marginInDomainUnits,
        ];
      }
    }

    // Add padding to range so edge labels don't get clipped
    const rangeStart = SPACING.AXIS_LABEL_PADDING;
    const rangeEnd = Math.max(forestWidth - SPACING.AXIS_LABEL_PADDING, rangeStart + 50);

    if (isLog) {
      // Ensure domain is positive for log scale
      const safeDomain: [number, number] = [
        Math.max(finalDomain[0], 0.01),
        Math.max(finalDomain[1], 0.02),
      ];
      return scaleLog().domain(safeDomain).range([rangeStart, rangeEnd]);
    }

    return scaleLinear().domain(finalDomain).range([rangeStart, rangeEnd]);
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
    const tableWidth = width - forestWidth;

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

    // Add padding
    const padding = spec.theme.spacing.padding * 2;

    return totalColumnWidth + forestWidth + padding;
  });

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
    // Small buffer for Canvas vs CSS text rendering differences (kerning, sub-pixel rounding)
    const RENDERING_BUFFER = 4;

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

      // Only auto-size columns with width="auto" or null
      if (col.width !== "auto" && col.width !== null) return;

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
      const computedWidth = Math.min(AUTO_WIDTH.MAX, Math.max(typeMin, Math.ceil(maxWidth + cellPadding + RENDERING_BUFFER)));
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
          const groupHeaderWidth = ctx!.measureText(col.header).width + groupPadding + RENDERING_BUFFER;

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
      const computedLabelWidth = Math.min(AUTO_WIDTH.LABEL_MAX, Math.max(AUTO_WIDTH.MIN, Math.ceil(maxLabelWidth + cellPadding + RENDERING_BUFFER)));
      columnWidths["__label__"] = computedLabelWidth;
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

    /**
     * Get current dimensions for export.
     * Returns column widths, forest width, x-axis domain, and total width to pass to SVG generator.
     */
    getExportDimensions() {
      // Get the current x-axis domain from xScale
      const domain = xScale.domain() as [number, number];
      return {
        width: naturalContentWidth,
        columnWidths: { ...columnWidths },
        forestWidth: layout.forestWidth,
        xDomain: domain,
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
