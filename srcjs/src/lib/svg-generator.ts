/**
 * Pure-data SVG generator for forest plots
 *
 * This module generates complete SVG strings from WebSpec data without any DOM access.
 * It can be used both in the browser and in Node.js/V8 environments.
 */

import type {
  WebSpec,
  WebTheme,
  Row,
  ColumnSpec,
  ColumnDef,
  ColumnOptions,
  ComputedLayout,
  EffectSpec,
  MarkerShape,
} from "$types";
import { niceDomain, DOMAIN_PADDING } from "./scale-utils";
import {
  LAYOUT,
  TYPOGRAPHY,
  SPACING,
  RENDERING,
  AUTO_WIDTH,
  GROUP_HEADER,
  COLUMN_GROUP,
  TEXT_MEASUREMENT,
  BADGE,
  ROW_ODD_OPACITY,
  GROUP_HEADER_OPACITY,
  getDepthOpacity,
} from "./rendering-constants";
import {
  formatNumber,
  formatEvents,
  formatInterval,
  formatPvalue,
  getColumnDisplayText,
} from "./formatters";
import { estimateTextWidth } from "./width-utils";

// ============================================================================
// Export Options
// ============================================================================

export interface ExportOptions {
  width?: number;
  height?: number;
  scale?: number;
  backgroundColor?: string;
  // Pre-computed column widths from web view (keyed by column ID, including "__label__")
  columnWidths?: Record<string, number>;
  // Pre-computed forest/plot width from web view
  forestWidth?: number;
  // Pre-computed x-axis domain from web view (ensures matching scale)
  xDomain?: [number, number];
}

// ============================================================================
// Auto Width Calculation for SVG Export
// ============================================================================

/**
 * Calculate auto-widths for columns that have width="auto" or null.
 * Uses text estimation since canvas measurement is not available in SVG context.
 *
 * This function now handles column groups the same way as the web view:
 * 1. First measure leaf columns based on content
 * 2. Then check if column groups need more width than their children provide
 * 3. If so, distribute extra width evenly to all children
 */
function calculateSvgAutoWidths(
  spec: WebSpec,
  columns: ColumnSpec[]
): Map<string, number> {
  const widths = new Map<string, number>();
  const fontSize = parseFontSize(spec.theme.typography.fontSizeBase);
  // Header cells use scaled font size (theme.typography.headerFontScale, default 1.05)
  const headerFontScale = spec.theme.typography.headerFontScale ?? 1.05;
  const headerFontSize = fontSize * headerFontScale;
  const rows = spec.data.rows;

  // Padding values from theme (not hardcoded magic numbers)
  const cellPadding = (spec.theme.spacing.cellPaddingX ?? 10) * 2;
  const groupPadding = (spec.theme.spacing.groupPadding ?? 8) * 2;

  // ========================================================================
  // PHASE 1: Measure leaf column content
  // ========================================================================
  for (const col of columns) {
    // Only process columns with width="auto" or null
    if (col.width !== "auto" && col.width !== null && col.width !== undefined) {
      continue;
    }

    let maxWidth = 0;

    // Measure header text with header font size
    if (col.header) {
      maxWidth = Math.max(maxWidth, estimateTextWidth(col.header, headerFontSize));
    }

    // Measure all data cell values using proper display text
    for (const row of rows) {
      if (row.style?.type === "header" || row.style?.type === "spacer") {
        continue;
      }
      const text = getColumnDisplayText(row, col);
      if (text) {
        maxWidth = Math.max(maxWidth, estimateTextWidth(text, fontSize));
      }
    }

    // Apply padding (from theme) and constraints
    // Use type-specific minimum for visual columns, else default minimum
    const typeMin = AUTO_WIDTH.VISUAL_MIN[col.type] ?? AUTO_WIDTH.MIN;
    const computedWidth = Math.ceil(maxWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER);
    widths.set(col.id, Math.min(AUTO_WIDTH.MAX, Math.max(typeMin, computedWidth)));
  }

  // ========================================================================
  // PHASE 2: Check column groups and expand children if needed
  // ========================================================================
  // This matches the web view's doMeasurement() logic in forestStore.svelte.ts
  // Column group headers also use scaled font size (they inherit .header-cell)
  expandColumnGroupWidths(spec.columns, widths, headerFontSize, groupPadding, TEXT_MEASUREMENT.RENDERING_BUFFER);

  return widths;
}

/**
 * Process column groups recursively and expand children if group header needs more space.
 * This matches the web view's processColumn() logic in forestStore.svelte.ts.
 *
 * @param columnDefs - Top-level column definitions (may include groups)
 * @param widths - Map to store computed widths (modified in place)
 * @param fontSize - Font size in pixels for text measurement
 * @param groupPadding - Padding for group headers (from theme)
 * @param renderingBuffer - Small buffer for text estimation imprecision
 */
function expandColumnGroupWidths(
  columnDefs: ColumnDef[],
  widths: Map<string, number>,
  fontSize: number,
  groupPadding: number,
  renderingBuffer: number
): void {
  /**
   * Get all leaf columns under a column definition.
   * For groups, recursively collects all descendant leaf columns.
   * For leaf columns, returns the column itself.
   */
  function getLeafColumns(col: ColumnDef): ColumnSpec[] {
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
    const computed = widths.get(col.id);
    if (computed !== undefined) {
      return computed;
    }
    if (typeof col.width === "number") {
      return col.width;
    }
    return AUTO_WIDTH.MIN;
  }

  /**
   * Process a column definition recursively (bottom-up).
   * For groups: process children first, then check if group header needs more width.
   * For leaves: already measured in phase 1.
   */
  function processColumn(col: ColumnDef): void {
    if (col.isGroup) {
      // Process children first (bottom-up)
      for (const child of col.columns) {
        processColumn(child);
      }

      // Check if group header needs more width than children provide
      if (col.header) {
        // Group header needs: text width + its own padding (from theme) + rendering buffer
        const groupHeaderWidth = estimateTextWidth(col.header, fontSize) + groupPadding + renderingBuffer;

        const leafCols = getLeafColumns(col);
        const childrenTotalWidth = leafCols.reduce((sum, leaf) => sum + getEffectiveWidth(leaf), 0);

        // If group header needs more width, distribute extra to ALL children
        // (including explicit-width columns - we override to ensure header fits)
        if (groupHeaderWidth > childrenTotalWidth && leafCols.length > 0) {
          const extraPerChild = Math.ceil((groupHeaderWidth - childrenTotalWidth) / leafCols.length);
          for (const leaf of leafCols) {
            widths.set(leaf.id, getEffectiveWidth(leaf) + extraPerChild);
          }
        }
      }
    }
    // Leaf columns are already measured in phase 1
  }

  // Process all top-level column definitions
  for (const colDef of columnDefs) {
    processColumn(colDef);
  }
}

/**
 * Calculate label column width based on actual label content.
 */
function calculateSvgLabelWidth(spec: WebSpec): number {
  const fontSize = parseFontSize(spec.theme.typography.fontSizeBase);
  // Use theme-based padding (not hardcoded magic numbers)
  const cellPadding = (spec.theme.spacing.cellPaddingX ?? 10) * 2;
  let maxWidth = 0;

  // Build group depth map for calculating row indentation
  const groupDepths = new Map<string, number>();
  const groups = Array.isArray(spec.data.groups) ? spec.data.groups : [];
  for (const group of groups) {
    groupDepths.set(group.id, group.depth);
  }

  // Helper to get row depth (group depth + 1 for data rows)
  const getRowDepth = (groupId: string | null | undefined): number => {
    if (!groupId) return 0;
    const groupDepth = groupDepths.get(groupId) ?? 0;
    return groupDepth + 1;
  };

  // Measure label header
  if (spec.data.labelHeader) {
    maxWidth = Math.max(maxWidth, estimateTextWidth(spec.data.labelHeader, fontSize));
  }

  // Measure all labels (including group depth, row indent, and badges)
  for (const row of spec.data.rows) {
    if (row.label) {
      // Total indent = group-based depth + row-level indent
      const depth = getRowDepth(row.groupId);
      const rowIndent = row.style?.indent ?? 0;
      const totalIndent = depth + rowIndent;
      const indentWidth = totalIndent * SPACING.INDENT_PER_LEVEL;
      let rowWidth = estimateTextWidth(row.label, fontSize) + indentWidth;

      // Account for badge width if present
      if (row.style?.badge) {
        const badgeText = String(row.style.badge);
        const badgeFontSize = fontSize * BADGE.FONT_SCALE;
        const badgeTextWidth = estimateTextWidth(badgeText, badgeFontSize);
        const badgeWidth = badgeTextWidth + BADGE.PADDING * 2;
        rowWidth += BADGE.GAP + badgeWidth;
      }

      maxWidth = Math.max(maxWidth, rowWidth);
    }
  }

  // ========================================================================
  // MEASURE ROW GROUP HEADERS
  // ========================================================================
  // Group headers in the label column include multiple elements:
  // [indent][chevron][gap][label][gap][count][internal-padding]
  // See GROUP_HEADER constants in rendering-constants.ts
  // This must match the web view measurement in forestStore.svelte.ts
  // ========================================================================
  for (const group of groups) {
    if (group.label) {
      const indentWidth = group.depth * SPACING.INDENT_PER_LEVEL;
      const labelWidth = estimateTextWidth(group.label, fontSize);

      // Count all descendant rows for the "(N)" suffix, matching display
      const rowCount = countAllDescendantRows(group.id);
      const countText = `(${rowCount})`;
      const countFontSize = fontSize * 0.75; // matches theme.typography.fontSizeSm
      const countWidth = estimateTextWidth(countText, countFontSize);

      // Total width: all components from GroupHeader.svelte layout
      // [indent] + [chevron] + [gap] + [label] + [gap] + [count] + [safety margin]
      const totalWidth = indentWidth
        + GROUP_HEADER.CHEVRON_WIDTH
        + GROUP_HEADER.GAP
        + labelWidth
        + GROUP_HEADER.GAP
        + countWidth
        + GROUP_HEADER.SAFETY_MARGIN;

      maxWidth = Math.max(maxWidth, totalWidth);
    }
  }

  const computedWidth = Math.ceil(maxWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER);
  return Math.min(AUTO_WIDTH.LABEL_MAX, Math.max(AUTO_WIDTH.MIN, computedWidth));
}

/**
 * Get effective column width, using calculated auto-width if available.
 */
function getEffectiveWidth(col: ColumnSpec, autoWidths: Map<string, number>): number {
  const autoWidth = autoWidths.get(col.id);
  if (autoWidth !== undefined) {
    return autoWidth;
  }
  if (typeof col.width === "number") {
    return col.width;
  }
  return LAYOUT.DEFAULT_COLUMN_WIDTH;
}

// ============================================================================
// Layout Computation
// ============================================================================

interface InternalLayout extends ComputedLayout {
  headerTextHeight: number;
  footerTextHeight: number;
  titleY: number;
  subtitleY: number;
  mainY: number;
  footerY: number;
  autoWidths: Map<string, number>;  // Add auto-widths to layout
  labelWidth: number;               // Calculated label column width
}

function computeLayout(spec: WebSpec, options: ExportOptions): InternalLayout {
  const theme = spec.theme;
  const rowHeight = theme.spacing.rowHeight;
  const padding = theme.spacing.padding;

  // Ensure columns is an array (guard against R serialization issues)
  const columns = Array.isArray(spec.columns) ? spec.columns : [];

  // Check if we have column groups (need taller header)
  const leftColumnDefs = getColumnDefs(columns, "left");
  const rightColumnDefs = getColumnDefs(columns, "right");
  const hasGroups = hasColumnGroups(leftColumnDefs) || hasColumnGroups(rightColumnDefs);

  // Header height: taller when we have column groups (two-tier headers)
  const headerHeight = hasGroups
    ? theme.spacing.headerHeight * RENDERING.GROUP_HEADER_HEIGHT_MULTIPLIER
    : theme.spacing.headerHeight;

  // Text heights for header/footer
  const hasTitle = !!spec.labels?.title;
  const hasSubtitle = !!spec.labels?.subtitle;
  const hasCaption = !!spec.labels?.caption;
  const hasFootnote = !!spec.labels?.footnote;

  const titleHeight = hasTitle ? TYPOGRAPHY.TITLE_HEIGHT : 0;
  const subtitleHeight = hasSubtitle ? TYPOGRAPHY.SUBTITLE_HEIGHT : 0;
  const headerTextHeight = titleHeight + subtitleHeight + (hasTitle || hasSubtitle ? padding : 0);

  const captionHeight = hasCaption ? TYPOGRAPHY.CAPTION_HEIGHT : 0;
  const footnoteHeight = hasFootnote ? TYPOGRAPHY.FOOTNOTE_HEIGHT : 0;
  const footerTextHeight = captionHeight + footnoteHeight + (hasCaption || hasFootnote ? padding : 0);

  // Compute display rows (includes group headers)
  const displayRows = buildDisplayRows(spec);
  const hasOverall = !!spec.data.overall;

  // Calculate plot height accounting for spacer rows (half height)
  let plotHeight = 0;
  for (const dr of displayRows) {
    const isSpacerRow = dr.type === "data" && dr.row.style?.type === "spacer";
    plotHeight += isSpacerRow ? rowHeight / 2 : rowHeight;
  }
  if (hasOverall) {
    plotHeight += rowHeight * RENDERING.OVERALL_ROW_HEIGHT_MULTIPLIER;
  }

  // Calculate auto-widths for columns
  const leftColumns = flattenColumns(columns, "left");
  const rightColumns = flattenColumns(columns, "right");
  const allColumns = [...leftColumns, ...rightColumns];

  // Use pre-computed widths from web view if provided, otherwise calculate
  let autoWidths: Map<string, number>;
  let labelWidth: number;

  if (options.columnWidths) {
    // Use pre-computed widths from web view
    autoWidths = new Map<string, number>();
    for (const [id, width] of Object.entries(options.columnWidths)) {
      if (id !== "__label__") {
        autoWidths.set(id, width);
      }
    }
    labelWidth = options.columnWidths["__label__"] ?? calculateSvgLabelWidth(spec);
  } else {
    // Calculate widths from scratch (R-side export path)
    autoWidths = calculateSvgAutoWidths(spec, allColumns);
    labelWidth = calculateSvgLabelWidth(spec);
  }

  // Calculate table widths using effective widths
  const leftTableWidth = labelWidth +
    leftColumns.reduce((sum, c) => sum + getEffectiveWidth(c, autoWidths), 0);
  const rightTableWidth =
    rightColumns.reduce((sum, c) => sum + getEffectiveWidth(c, autoWidths), 0);

  // Forest width calculation - "tables first" approach
  const baseWidth = options.width ?? LAYOUT.DEFAULT_WIDTH;
  const includeForest = spec.data.includeForest;
  const totalTableWidth = leftTableWidth + rightTableWidth;

  // Calculate forest width based on remaining space after tables, or explicit layout settings
  let forestWidth: number;
  if (!includeForest) {
    forestWidth = 0;
  } else if (typeof options.forestWidth === "number") {
    // Use pre-computed forest width from web view
    forestWidth = options.forestWidth;
  } else if (typeof spec.layout.plotWidth === "number") {
    forestWidth = spec.layout.plotWidth;
  } else {
    // Auto: use remaining space after tables, with minimum
    const availableForForest = baseWidth - totalTableWidth - LAYOUT.COLUMN_GAP * 2 - padding * 2;
    forestWidth = Math.max(availableForForest, LAYOUT.MIN_FOREST_WIDTH);
  }

  // Total width: expand if content needs more space than requested width
  const neededWidth = padding * 2 + totalTableWidth + forestWidth + LAYOUT.COLUMN_GAP * 2;
  const totalWidth = Math.max(options.width ?? baseWidth, neededWidth);

  // Total height: include axis label height and bottom margin
  const totalHeight = headerTextHeight + padding +
    headerHeight + plotHeight +
    LAYOUT.AXIS_HEIGHT + LAYOUT.AXIS_LABEL_HEIGHT +
    footerTextHeight +
    LAYOUT.BOTTOM_MARGIN;

  return {
    totalWidth,
    totalHeight: options.height ?? totalHeight,
    tableWidth: leftTableWidth + rightTableWidth,
    forestWidth,
    headerHeight,
    rowHeight,
    plotHeight,
    axisHeight: LAYOUT.AXIS_HEIGHT,
    nullValue: spec.data.nullValue,
    summaryYPosition: plotHeight - rowHeight,
    showOverallSummary: hasOverall,
    headerTextHeight,
    footerTextHeight,
    titleY: padding + TYPOGRAPHY.TITLE_HEIGHT - 8, // Baseline adjustment
    subtitleY: padding + titleHeight + TYPOGRAPHY.SUBTITLE_HEIGHT - 4,
    mainY: headerTextHeight + padding,
    footerY: headerTextHeight + padding + headerHeight + plotHeight + LAYOUT.AXIS_HEIGHT + LAYOUT.AXIS_LABEL_HEIGHT + padding,
    autoWidths,
    labelWidth,
  };
}

// ============================================================================
// Display Row Types (for interleaving group headers with data rows)
// ============================================================================

interface GroupHeaderDisplayRow {
  type: "group_header";
  groupId: string;
  label: string;
  depth: number;
  rowCount: number;
}

interface DataDisplayRow {
  type: "data";
  row: Row;
  depth: number;
}

type DisplayRow = GroupHeaderDisplayRow | DataDisplayRow;

/**
 * Build display rows with group headers interleaved
 * This mimics the Svelte store's displayRows logic for consistent rendering
 */
function buildDisplayRows(spec: WebSpec): DisplayRow[] {
  const rows = spec.data.rows;
  const groups = Array.isArray(spec.data.groups) ? spec.data.groups : [];

  // If no groups, return flat data rows
  if (groups.length === 0) {
    return rows.map(row => ({ type: "data" as const, row, depth: 0 }));
  }

  // Build group lookup maps
  const groupMap = new Map<string, { id: string; label: string; depth: number; parentId?: string }>();
  for (const group of groups) {
    groupMap.set(group.id, group);
  }

  // Group rows by groupId
  const rowsByGroup = new Map<string | null, Row[]>();
  for (const row of rows) {
    const key = row.groupId ?? null;
    if (!rowsByGroup.has(key)) rowsByGroup.set(key, []);
    rowsByGroup.get(key)!.push(row);
  }

  // Collect all groups that need headers
  const groupsWithHeaders = new Set<string>();
  for (const groupId of rowsByGroup.keys()) {
    if (!groupId) continue;
    let current: string | undefined = groupId;
    while (current) {
      groupsWithHeaders.add(current);
      current = groupMap.get(current)?.parentId;
    }
  }

  // Get child groups of a parent
  function getChildGroups(parentId: string | null): typeof groups {
    return groups.filter(g => (g.parentId ?? null) === parentId && groupsWithHeaders.has(g.id));
  }

  // Get row depth based on group
  function getRowDepth(groupId: string | null | undefined): number {
    if (!groupId) return 0;
    const group = groupMap.get(groupId);
    return group ? group.depth + 1 : 0;
  }

  // Count all rows (direct + all descendants) for a group
  function countAllDescendantRows(groupId: string): number {
    let count = rowsByGroup.get(groupId)?.length ?? 0;
    for (const childGroup of getChildGroups(groupId)) {
      count += countAllDescendantRows(childGroup.id);
    }
    return count;
  }

  const result: DisplayRow[] = [];

  // Recursive function to output a group and its descendants
  function outputGroup(groupId: string | null) {
    if (groupId) {
      const group = groupMap.get(groupId);
      if (!group) return;

      // Count all descendant rows (direct + nested subgroups)
      const rowCount = countAllDescendantRows(groupId);
      result.push({
        type: "group_header",
        groupId: group.id,
        label: group.label,
        depth: group.depth,
        rowCount,
      });
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
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Flatten group children (no position filtering - children inherit from parent) */
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

/** Get column definitions (preserving groups) filtered by position */
function getColumnDefs(columns: ColumnDef[], position: "left" | "right"): ColumnDef[] {
  return columns.filter((c) => c.position === position);
}

/** Check if any column definitions contain groups */
function hasColumnGroups(columnDefs: ColumnDef[]): boolean {
  return columnDefs.some((c) => c.isGroup);
}

/** Parse font size from CSS string (e.g., "0.875rem" -> 14) */
function parseFontSize(size: string): number {
  if (size.endsWith("rem")) {
    return parseFloat(size) * TYPOGRAPHY.REM_BASE;
  }
  if (size.endsWith("px")) {
    return parseFloat(size);
  }
  return TYPOGRAPHY.DEFAULT_FONT_SIZE;
}

/** Calculate text X position and anchor based on alignment */
function getTextPosition(
  x: number,
  width: number,
  align: "left" | "center" | "right" | undefined
): { textX: number; anchor: string } {
  if (align === "right") {
    return { textX: x + width - SPACING.TEXT_PADDING, anchor: "end" };
  }
  if (align === "center") {
    return { textX: x + width / 2, anchor: "middle" };
  }
  return { textX: x + SPACING.TEXT_PADDING, anchor: "start" };
}

/** Escape XML special characters */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Truncate text to fit within a given width (approximate)
 * Uses character-class width estimation matching estimateTextWidth()
 */
function truncateText(text: string, maxWidth: number, fontSize: number, padding: number = 0): string {
  const availableWidth = maxWidth - padding * 2;

  // Check if full text fits using accurate estimation
  const fullWidth = estimateTextWidth(text, fontSize);
  if (fullWidth <= availableWidth) {
    return text;
  }

  // Binary search for the longest substring that fits (including ellipsis)
  const ellipsis = "…";
  const ellipsisWidth = fontSize * 0.55; // Ellipsis is roughly average width

  let left = 0;
  let right = text.length;

  while (left < right) {
    const mid = Math.ceil((left + right) / 2);
    const truncated = text.slice(0, mid);
    const truncatedWidth = estimateTextWidth(truncated, fontSize) + ellipsisWidth;

    if (truncatedWidth <= availableWidth) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  // Return truncated text with ellipsis
  if (left === 0) {
    return ellipsis; // Nothing fits, just show ellipsis
  }
  return text.slice(0, left) + ellipsis;
}

// Note: formatNumber, formatEvents, formatInterval, formatPvalue are imported from ./formatters

/** Format tick value for axis */
function formatTick(value: number): string {
  if (Math.abs(value) < 0.01) return "0";
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

// ============================================================================
// Scale Functions
// ============================================================================

interface Scale {
  (value: number): number;
  domain: () => [number, number];
  range: () => [number, number];
  ticks: (count: number) => number[];
}

function createLinearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const ratio = (r1 - r0) / (d1 - d0);

  const scale = (value: number): number => {
    return r0 + (value - d0) * ratio;
  };

  scale.domain = () => domain;
  scale.range = () => range;
  scale.ticks = (count: number): number[] => {
    const step = (d1 - d0) / (count - 1);
    const ticks: number[] = [];
    for (let i = 0; i < count; i++) {
      ticks.push(d0 + step * i);
    }
    return ticks;
  };

  return scale;
}

function createLogScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain.map(d => Math.max(d, 0.001));
  const [r0, r1] = range;
  const logD0 = Math.log10(d0);
  const logD1 = Math.log10(d1);
  const ratio = (r1 - r0) / (logD1 - logD0);

  const scale = (value: number): number => {
    const logValue = Math.log10(Math.max(value, 0.001));
    return r0 + (logValue - logD0) * ratio;
  };

  scale.domain = () => [d0, d1];
  scale.range = () => range;
  scale.ticks = (count: number): number[] => {
    // Generate log-spaced ticks at nice values (powers of 10 and 2x, 5x multiples)
    const ticks: number[] = [];
    const minPow = Math.floor(Math.log10(d0));
    const maxPow = Math.ceil(Math.log10(d1));

    for (let pow = minPow; pow <= maxPow; pow++) {
      const base = Math.pow(10, pow);
      for (const mult of [1, 2, 5]) {
        const val = base * mult;
        if (val >= d0 && val <= d1) {
          ticks.push(val);
        }
      }
    }
    return ticks.length > 0 ? ticks : [d0, d1];
  };

  return scale;
}

/**
 * Compute x-scale for forest plot using the new auto-scaling algorithm:
 * 1. Core range from point estimates (not CI bounds)
 * 2. Include null value if configured
 * 3. Add padding as fraction of estimate range
 * 4. Apply symmetry around null if configured
 * 5. Account for marker margin at edges
 *
 * If options.xDomain is provided, uses that domain directly (for matching web view).
 */
function computeXScale(spec: WebSpec, forestWidth: number, options?: ExportOptions): Scale {
  const isLog = spec.data.scale === "log";

  // If pre-computed domain is provided, use it directly
  if (options?.xDomain) {
    const domain = options.xDomain;
    if (isLog) {
      return createLogScale(
        [Math.max(domain[0], 0.01), Math.max(domain[1], 0.02)],
        [0, forestWidth]
      );
    }
    return createLinearScale(domain, [0, forestWidth]);
  }

  const rows = spec.data.rows;
  const axisConfig = spec.theme.axis;
  const nullValue = spec.data.nullValue;

  // Extract axis config with defaults
  const padding = axisConfig?.padding ?? 0.15;
  const includeNull = axisConfig?.includeNull ?? true;
  const symmetric = axisConfig?.symmetric;  // null = auto
  const markerMargin = axisConfig?.markerMargin ?? true;
  const ciTruncationThreshold = axisConfig?.ciTruncationThreshold ?? 3.0;

  // Guard against R serialization returning {} instead of null for missing values
  const hasExplicitMin = typeof axisConfig?.rangeMin === "number";
  const hasExplicitMax = typeof axisConfig?.rangeMax === "number";

  let domain: [number, number];

  if (hasExplicitMin && hasExplicitMax) {
    domain = [axisConfig.rangeMin!, axisConfig.rangeMax!];
  } else {
    // Step 1: Collect point estimates (not CI bounds)
    const pointEstimates = rows
      .map((r) => r.point)
      .filter((v): v is number => v != null && !Number.isNaN(v) && Number.isFinite(v));

    if (pointEstimates.length === 0) {
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

      // Step 5: Apply symmetry around null if explicitly requested
      // symmetric = true: force symmetry (user must opt-in)
      // symmetric = false/null: no symmetry (default)
      const shouldBeSymmetric = symmetric === true;

      if (shouldBeSymmetric && !hasExplicitMin && !hasExplicitMax) {
        if (isLog) {
          // Log scale: geometric symmetry around null
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

  // Apply nice rounding to domain (matches D3's .nice() behavior)
  const nicedDomain = niceDomain(domain, isLog);

  // Step 5: Account for marker margin at edges
  // Match web view by using effective pixel range (forestWidth minus axis label padding)
  const axisLabelPadding = SPACING.AXIS_LABEL_PADDING;
  const effectivePixelRange = forestWidth - 2 * axisLabelPadding;

  let finalDomain = nicedDomain;
  if (markerMargin && effectivePixelRange > 0) {
    const pointSize = spec.theme.shapes.pointSize;
    // Convert pixel margin to domain units (using effective range, matching web view)
    const domainRange = nicedDomain[1] - nicedDomain[0];
    const marginInDomainUnits = (pointSize / 2) * (domainRange / effectivePixelRange);

    if (isLog) {
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

  // Apply axis label padding to range (matching web view forestStore)
  const rangeStart = axisLabelPadding;
  const rangeEnd = Math.max(forestWidth - axisLabelPadding, rangeStart + 50);

  if (isLog) {
    return createLogScale(
      [Math.max(finalDomain[0], 0.01), Math.max(finalDomain[1], 0.02)],
      [rangeStart, rangeEnd]
    );
  }

  return createLinearScale(finalDomain, [rangeStart, rangeEnd]);
}

// ============================================================================
// SVG Renderers
// ============================================================================

function renderHeader(spec: WebSpec, layout: InternalLayout, theme: WebTheme): string {
  const lines: string[] = [];
  const padding = theme.spacing.padding;

  if (spec.labels?.title) {
    const fontSize = parseFontSize(theme.typography.fontSizeLg);
    lines.push(`<text x="${padding}" y="${layout.titleY}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${theme.typography.fontWeightBold}"
      fill="${theme.colors.foreground}">${escapeXml(spec.labels.title)}</text>`);
  }

  if (spec.labels?.subtitle) {
    const fontSize = parseFontSize(theme.typography.fontSizeBase);
    lines.push(`<text x="${padding}" y="${layout.subtitleY}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      fill="${theme.colors.secondary}">${escapeXml(spec.labels.subtitle)}</text>`);
  }

  return lines.join("\n");
}

function renderFooter(spec: WebSpec, layout: InternalLayout, theme: WebTheme): string {
  const lines: string[] = [];
  const padding = theme.spacing.padding;
  let y = layout.footerY;

  if (spec.labels?.caption) {
    const fontSize = parseFontSize(theme.typography.fontSizeSm);
    lines.push(`<text x="${padding}" y="${y}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      fill="${theme.colors.secondary}">${escapeXml(spec.labels.caption)}</text>`);
    y += TYPOGRAPHY.CAPTION_HEIGHT;
  }

  if (spec.labels?.footnote) {
    const fontSize = parseFontSize(theme.typography.fontSizeSm);
    lines.push(`<text x="${padding}" y="${y}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-style="italic"
      fill="${theme.colors.muted}">${escapeXml(spec.labels.footnote)}</text>`);
  }

  return lines.join("\n");
}

/**
 * Render column headers with support for column groups (two-tier headers)
 */
function renderColumnHeaders(
  columnDefs: ColumnDef[],
  leafColumns: ColumnSpec[],
  x: number,
  y: number,
  headerHeight: number,
  theme: WebTheme,
  labelHeader?: string,
  labelWidth?: number,
  autoWidths?: Map<string, number>
): string {
  const lines: string[] = [];
  // Header cells use scaled font size (theme.typography.headerFontScale, default 1.05)
  const baseFontSize = parseFontSize(theme.typography.fontSizeBase);
  const headerFontScale = theme.typography.headerFontScale ?? 1.05;
  const fontSize = baseFontSize * headerFontScale;
  const fontWeight = theme.typography.fontWeightMedium;
  const boldWeight = theme.typography.fontWeightBold;
  const hasGroups = hasColumnGroups(columnDefs);
  const actualLabelWidth = labelWidth ?? LAYOUT.DEFAULT_LABEL_WIDTH;

  // Helper to get effective column width
  const getColWidth = (col: ColumnSpec): number => {
    if (autoWidths) {
      const autoWidth = autoWidths.get(col.id);
      if (autoWidth !== undefined) return autoWidth;
    }
    return typeof col.width === 'number' ? col.width : LAYOUT.DEFAULT_COLUMN_WIDTH;
  };

  // Helper to get column def width (for groups)
  const getDefWidth = (col: ColumnDef): number => {
    if (!col.isGroup) return getColWidth(col as ColumnSpec);
    return col.columns.reduce((sum, c) => sum + getDefWidth(c), 0);
  };

  // Helper to calculate text Y position for vertical centering
  const getTextY = (containerY: number, containerHeight: number) =>
    containerY + containerHeight / 2 + fontSize * TYPOGRAPHY.TEXT_BASELINE_ADJUSTMENT;

  if (hasGroups) {
    // Two-tier header: group headers on top, sub-column headers below
    const row1Height = headerHeight / 2;
    const row2Height = headerHeight / 2;
    let currentX = x;

    // Label column spans both rows
    if (labelHeader) {
      lines.push(`<text x="${currentX + SPACING.TEXT_PADDING}" y="${getTextY(y, headerHeight)}"
        font-family="${theme.typography.fontFamily}"
        font-size="${fontSize}px"
        font-weight="${fontWeight}"
        fill="${theme.colors.foreground}">${escapeXml(labelHeader)}</text>`);
      currentX += actualLabelWidth;
    }

    // Row 1: Group headers and non-grouped column headers
    // Track positions of column groups to draw borders only under them
    const groupBorders: Array<{ x1: number; x2: number }> = [];

    for (const col of columnDefs) {
      if (col.isGroup) {
        // Group header spans its children
        const groupWidth = getDefWidth(col);
        const textX = currentX + groupWidth / 2;
        lines.push(`<text x="${textX}" y="${getTextY(y, row1Height)}"
          font-family="${theme.typography.fontFamily}"
          font-size="${fontSize}px"
          font-weight="${boldWeight}"
          text-anchor="middle"
          fill="${theme.colors.foreground}">${escapeXml(col.header)}</text>`);
        // Track this column group for border drawing
        groupBorders.push({ x1: currentX, x2: currentX + groupWidth });
        currentX += groupWidth;
      } else {
        // Non-grouped column spans both rows
        const width = getColWidth(col);
        const headerAlign = col.headerAlign ?? col.align;
        const { textX, anchor } = getTextPosition(currentX, width, headerAlign);
        const truncatedHeader = truncateText(col.header, width, fontSize, SPACING.TEXT_PADDING);
        lines.push(`<text x="${textX}" y="${getTextY(y, headerHeight)}"
          font-family="${theme.typography.fontFamily}"
          font-size="${fontSize}px"
          font-weight="${fontWeight}"
          text-anchor="${anchor}"
          fill="${theme.colors.foreground}">${escapeXml(truncatedHeader)}</text>`);
        currentX += width;
      }
    }

    // Draw borders only under actual column groups (not under spanning columns)
    for (const border of groupBorders) {
      lines.push(`<line x1="${border.x1}" x2="${border.x2}"
        y1="${y + row1Height}" y2="${y + row1Height}"
        stroke="${theme.colors.border}" stroke-width="1" opacity="0.5"/>`);
    }

    // Row 2: Sub-column headers (under groups)
    currentX = x + (labelHeader ? actualLabelWidth : 0);
    for (const col of columnDefs) {
      if (col.isGroup) {
        // Render sub-column headers
        for (const subCol of col.columns) {
          if (!subCol.isGroup) {
            const width = getColWidth(subCol as ColumnSpec);
            const headerAlign = subCol.headerAlign ?? subCol.align;
            const { textX, anchor } = getTextPosition(currentX, width, headerAlign);
            lines.push(`<text x="${textX}" y="${getTextY(y + row1Height, row2Height)}"
              font-family="${theme.typography.fontFamily}"
              font-size="${fontSize}px"
              font-weight="${fontWeight}"
              text-anchor="${anchor}"
              fill="${theme.colors.foreground}">${escapeXml(subCol.header)}</text>`);
            currentX += width;
          }
        }
      } else {
        // Skip non-grouped columns (already rendered spanning both rows)
        const width = getColWidth(col);
        currentX += width;
      }
    }
  } else {
    // Single-row header (no groups)
    let currentX = x;

    if (labelHeader) {
      lines.push(`<text x="${currentX + SPACING.TEXT_PADDING}" y="${getTextY(y, headerHeight)}"
        font-family="${theme.typography.fontFamily}"
        font-size="${fontSize}px"
        font-weight="${fontWeight}"
        fill="${theme.colors.foreground}">${escapeXml(labelHeader)}</text>`);
      currentX += actualLabelWidth;
    }

    for (const col of leafColumns) {
      const width = getColWidth(col);
      // Use headerAlign if specified, otherwise fall back to align
      const headerAlign = col.headerAlign ?? col.align;
      const { textX, anchor } = getTextPosition(currentX, width, headerAlign);
      const truncatedHeader = truncateText(col.header, width, fontSize, SPACING.TEXT_PADDING);

      lines.push(`<text x="${textX}" y="${getTextY(y, headerHeight)}"
        font-family="${theme.typography.fontFamily}"
        font-size="${fontSize}px"
        font-weight="${fontWeight}"
        text-anchor="${anchor}"
        fill="${theme.colors.foreground}">${escapeXml(truncatedHeader)}</text>`);
      currentX += width;
    }
  }

  return lines.join("\n");
}

function renderGroupHeader(
  label: string,
  depth: number,
  x: number,
  y: number,
  rowHeight: number,
  totalWidth: number,
  theme: WebTheme
): string {
  const lines: string[] = [];

  // Get level-based styling (depth is 0-indexed, level is 1-indexed)
  const level = depth + 1;
  const gh = theme.groupHeaders;

  let fontSize: number;
  let fontWeight: number;
  let italic: boolean;
  let background: string | null;
  let borderBottom: boolean;

  if (level === 1) {
    fontSize = parseFontSize(gh?.level1FontSize ?? theme.typography.fontSizeBase);
    fontWeight = gh?.level1FontWeight ?? theme.typography.fontWeightBold;
    italic = gh?.level1Italic ?? false;
    background = gh?.level1Background ?? null;
    borderBottom = gh?.level1BorderBottom ?? false;
  } else if (level === 2) {
    fontSize = parseFontSize(gh?.level2FontSize ?? theme.typography.fontSizeBase);
    fontWeight = gh?.level2FontWeight ?? theme.typography.fontWeightMedium;
    italic = gh?.level2Italic ?? true;
    background = gh?.level2Background ?? null;
    borderBottom = gh?.level2BorderBottom ?? false;
  } else {
    fontSize = parseFontSize(gh?.level3FontSize ?? theme.typography.fontSizeBase);
    fontWeight = gh?.level3FontWeight ?? theme.typography.fontWeightNormal;
    italic = gh?.level3Italic ?? false;
    background = gh?.level3Background ?? null;
    borderBottom = gh?.level3BorderBottom ?? false;
  }

  // Compute background from primary if not explicitly set
  if (!background) {
    const primary = theme.colors.primary;
    const opacity = level === 1 ? 0.15 : level === 2 ? 0.10 : 0.06;
    // Parse hex and create rgba
    const hex = primary.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    background = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const textY = y + rowHeight / 2 + fontSize * TYPOGRAPHY.TEXT_BASELINE_ADJUSTMENT;
  const indent = depth * (gh?.indentPerLevel ?? SPACING.INDENT_PER_LEVEL);

  // Group header background
  lines.push(`<rect x="${x}" y="${y}"
    width="${totalWidth}" height="${rowHeight}"
    fill="${background}"/>`);

  // Border bottom if enabled
  if (borderBottom) {
    lines.push(`<line x1="${x}" x2="${x + totalWidth}" y1="${y + rowHeight}" y2="${y + rowHeight}"
      stroke="${theme.colors.border}" stroke-width="1" opacity="0.5"/>`);
  }

  // Group header text
  const fontStyle = italic ? ' font-style="italic"' : '';
  lines.push(`<text x="${x + SPACING.TEXT_PADDING + indent}" y="${textY}"
    font-family="${theme.typography.fontFamily}"
    font-size="${fontSize}px"
    font-weight="${fontWeight}"${fontStyle}
    fill="${theme.colors.foreground}">${escapeXml(label)}</text>`);

  return lines.join("\n");
}

/** Compute max values for bar columns from all rows */
function computeBarMaxValues(rows: Row[], columns: ColumnSpec[]): Map<string, number> {
  const maxValues = new Map<string, number>();
  for (const col of columns) {
    if (col.type === "bar") {
      let max = 0;
      for (const row of rows) {
        const val = row.metadata[col.field];
        if (typeof val === "number" && val > max) {
          max = val;
        }
      }
      maxValues.set(col.field, max > 0 ? max : 1); // Avoid division by zero
    }
  }
  return maxValues;
}

function renderTableRow(
  row: Row,
  columns: ColumnSpec[],
  x: number,
  y: number,
  rowHeight: number,
  theme: WebTheme,
  includeLabel: boolean,
  labelWidth: number = LAYOUT.DEFAULT_LABEL_WIDTH,
  depth: number = 0,
  barMaxValues?: Map<string, number>,
  autoWidths?: Map<string, number>
): string {
  const lines: string[] = [];
  const fontSize = parseFontSize(theme.typography.fontSizeBase);
  const textY = y + rowHeight / 2 + fontSize * TYPOGRAPHY.TEXT_BASELINE_ADJUSTMENT;
  let currentX = x;

  // Helper to get effective column width
  const getColWidth = (col: ColumnSpec): number => {
    if (autoWidths) {
      const autoWidth = autoWidths.get(col.id);
      if (autoWidth !== undefined) return autoWidth;
    }
    return typeof col.width === 'number' ? col.width : LAYOUT.DEFAULT_COLUMN_WIDTH;
  };

  // Label
  if (includeLabel) {
    // Use depth for indentation (overrides row.style.indent for grouped rows)
    const indent = depth * SPACING.INDENT_PER_LEVEL + (row.style?.indent ?? 0) * SPACING.INDENT_PER_LEVEL;
    // Emphasis and bold both apply bold font weight
    const fontWeight = (row.style?.bold || row.style?.emphasis) ? theme.typography.fontWeightBold : theme.typography.fontWeightNormal;
    const fontStyle = row.style?.italic ? "italic" : "normal";
    // Color priority: explicit color > emphasis > muted > accent > default
    let textColor = theme.colors.foreground;
    if (row.style?.color) {
      textColor = row.style.color;
    } else if (row.style?.muted) {
      textColor = theme.colors.muted;
    } else if (row.style?.accent) {
      textColor = theme.colors.accent;
    }

    // Truncate label if too long for column width
    const availableLabelWidth = labelWidth - indent - SPACING.TEXT_PADDING * 2;
    const truncatedLabel = truncateText(row.label, availableLabelWidth, fontSize, 0);

    lines.push(`<text x="${currentX + SPACING.TEXT_PADDING + indent}" y="${textY}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${fontWeight}"
      font-style="${fontStyle}"
      fill="${textColor}">${escapeXml(truncatedLabel)}</text>`);

    // Badge (if present)
    // Uses estimateTextWidth() for consistent width calculation with calculateSvgLabelWidth()
    if (row.style?.badge) {
      const badgeText = String(row.style.badge);
      const badgeFontSize = fontSize * BADGE.FONT_SCALE;
      const badgeHeight = badgeFontSize + BADGE.PADDING * 2;
      // Use estimateTextWidth for accurate positioning (matches width calculation)
      const labelTextWidth = estimateTextWidth(row.label, fontSize);
      const badgeX = currentX + SPACING.TEXT_PADDING + indent + labelTextWidth + BADGE.GAP;
      const badgeTextWidth = estimateTextWidth(badgeText, badgeFontSize);
      const badgeWidth = badgeTextWidth + BADGE.PADDING * 2;
      const badgeY = y + (rowHeight - badgeHeight) / 2;

      lines.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}"
        rx="3" fill="${theme.colors.primary}" opacity="0.15"/>`);
      lines.push(`<text x="${badgeX + badgeWidth / 2}" y="${badgeY + badgeHeight / 2 + badgeFontSize * 0.35}"
        text-anchor="middle"
        font-family="${theme.typography.fontFamily}"
        font-size="${badgeFontSize}px"
        font-weight="500"
        fill="${theme.colors.primary}">${escapeXml(badgeText)}</text>`);
    }

    currentX += labelWidth;
  }

  // Columns
  for (const col of columns) {
    const width = getColWidth(col);
    const value = getCellValue(row, col);
    const { textX, anchor } = getTextPosition(currentX, width, col.align);

    if (col.type === "bar" && typeof row.metadata[col.field] === "number") {
      // Render bar with value label (bar on left, number on right)
      const barValue = row.metadata[col.field] as number;
      const computedMax = barMaxValues?.get(col.field);
      const maxValue = col.options?.bar?.maxValue ?? computedMax ?? 100;
      const barColor = col.options?.bar?.color ?? theme.colors.primary;
      const barHeight = theme.shapes.pointSize * 2;

      // Reserve space for the text label on the right
      const textWidth = 50; // Space for the number
      const barAreaWidth = width - SPACING.TEXT_PADDING * 2 - textWidth;
      const barWidth = Math.min((barValue / maxValue) * barAreaWidth, barAreaWidth);

      // Draw bar
      lines.push(`<rect x="${currentX + SPACING.TEXT_PADDING}" y="${y + rowHeight / 2 - barHeight / 2}"
        width="${Math.max(0, barWidth)}" height="${barHeight}"
        fill="${barColor}" opacity="0.7" rx="2"/>`);

      // Draw value label to the right of the bar area
      const labelX = currentX + width - SPACING.TEXT_PADDING;
      lines.push(`<text x="${labelX}" y="${textY}"
        font-family="${theme.typography.fontFamily}"
        font-size="${fontSize}px"
        text-anchor="end"
        fill="${theme.colors.foreground}">${formatNumber(barValue)}</text>`);
    } else if (col.type === "sparkline" && Array.isArray(row.metadata[col.field])) {
      // Render sparkline
      // Handle nested arrays from R list columns: [[1,2,3]] -> [1,2,3]
      let data = row.metadata[col.field] as number[] | number[][];
      if (Array.isArray(data[0])) {
        data = data[0] as number[];
      }
      const sparkHeight = col.options?.sparkline?.height ?? 16;
      const sparkColor = col.options?.sparkline?.color ?? theme.colors.primary;
      const sparkPadding = SPACING.TEXT_PADDING * 2;
      const path = renderSparklinePath(data, currentX + SPACING.TEXT_PADDING, y + rowHeight / 2 - sparkHeight / 2, width - sparkPadding, sparkHeight);
      lines.push(`<path d="${path}" fill="none" stroke="${sparkColor}" stroke-width="1.5"/>`);
    } else {
      // Render text
      lines.push(`<text x="${textX}" y="${textY}"
        font-family="${theme.typography.fontFamily}"
        font-size="${fontSize}px"
        text-anchor="${anchor}"
        fill="${theme.colors.foreground}">${escapeXml(value)}</text>`);
    }

    currentX += width;
  }

  return lines.join("\n");
}

function getCellValue(row: Row, col: ColumnSpec): string {
  if (col.type === "interval") {
    // Support optional field overrides from column options
    const point = col.options?.interval?.point
      ? row.metadata[col.options.interval.point] as number
      : row.point;
    const lower = col.options?.interval?.lower
      ? row.metadata[col.options.interval.lower] as number
      : row.lower;
    const upper = col.options?.interval?.upper
      ? row.metadata[col.options.interval.upper] as number
      : row.upper;
    return formatInterval(point, lower, upper, col.options);
  }
  if (col.type === "numeric") {
    const val = row.metadata[col.field];
    return typeof val === "number" ? formatNumber(val, col.options) : (col.options?.naText ?? "");
  }
  if (col.type === "custom" && col.options?.events) {
    return formatEvents(row, col.options);
  }
  if (col.type === "pvalue") {
    const val = row.metadata[col.field];
    if (typeof val !== "number") return col.options?.naText ?? "";
    return formatPvalue(val, col.options);
  }
  // New column type fallbacks for SVG export
  if (col.type === "icon") {
    const val = row.metadata[col.field];
    if (val === undefined || val === null) return "";
    const strVal = String(val);
    const mapping = col.options?.icon?.mapping;
    if (mapping && strVal in mapping) return mapping[strVal];
    return strVal;
  }
  if (col.type === "badge") {
    const val = row.metadata[col.field];
    return val !== undefined && val !== null ? String(val) : "";
  }
  if (col.type === "stars") {
    const val = row.metadata[col.field];
    if (typeof val !== "number") return "";
    const maxStars = col.options?.stars?.maxStars ?? 5;
    const rating = Math.max(0, Math.min(maxStars, val));
    const filled = Math.floor(rating);
    const empty = maxStars - filled;
    return "★".repeat(filled) + "☆".repeat(empty);
  }
  if (col.type === "img") {
    // Images can't render in SVG text - show fallback
    const fallback = col.options?.img?.fallback ?? "[IMG]";
    return fallback;
  }
  if (col.type === "reference") {
    const val = row.metadata[col.field];
    if (val === undefined || val === null) return "";
    const str = String(val);
    const maxChars = col.options?.reference?.maxChars ?? 30;
    if (str.length <= maxChars) return str;
    return str.substring(0, maxChars) + "...";
  }
  if (col.type === "range") {
    const opts = col.options?.range;
    if (!opts) return "";
    const minVal = row.metadata[opts.minField];
    const maxVal = row.metadata[opts.maxField];
    const sep = opts.separator ?? " – ";
    const decimals = opts.decimals;

    const formatVal = (v: unknown): string => {
      if (typeof v !== "number") return "";
      if (decimals === null || decimals === undefined) {
        return Number.isInteger(v) ? String(v) : v.toFixed(1);
      }
      return v.toFixed(decimals);
    };

    if (minVal === null && maxVal === null) return "";
    if (minVal === null) return formatVal(maxVal);
    if (maxVal === null) return formatVal(minVal);
    return `${formatVal(minVal)}${sep}${formatVal(maxVal)}`;
  }
  const val = row.metadata[col.field];
  return val !== undefined && val !== null ? String(val) : (col.options?.naText ?? "");
}

function renderSparklinePath(data: number[], x: number, y: number, width: number, height: number): string {
  // Filter out NaN and non-finite values to prevent invalid SVG paths
  const validData = data.filter(v => Number.isFinite(v));
  if (validData.length === 0) return "";

  // Handle single value case (avoid division by zero in i / (length - 1))
  if (validData.length === 1) {
    const px = x + width / 2;
    const py = y + height / 2;
    return `M${px.toFixed(1)},${py.toFixed(1)}`;
  }

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;

  const points = validData.map((v, i) => {
    const px = x + (i / (validData.length - 1)) * width;
    const py = y + height - ((v - min) / range) * height;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });

  return `M${points.join("L")}`;
}

// Vertical spacing between multiple effects on same row
const EFFECT_SPACING = 6;

// Helper to get numeric value from row (primary or metadata)
function getEffectValue(row: Row, colName: string, fallback: number | null): number | null {
  // Check metadata first (for additional effects)
  const metaVal = row.metadata[colName];
  if (metaVal != null && typeof metaVal === "number" && !Number.isNaN(metaVal)) {
    return metaVal;
  }
  return fallback;
}

// Calculate vertical offset for each effect (centered around yPosition)
function getEffectYOffset(index: number, total: number): number {
  if (total <= 1) return 0;
  const totalHeight = (total - 1) * EFFECT_SPACING;
  return -totalHeight / 2 + index * EFFECT_SPACING;
}

function renderInterval(
  row: Row,
  yPosition: number,
  xScale: Scale,
  theme: WebTheme,
  nullValue: number,
  effects: EffectSpec[] = [],
  weightCol?: string | null,
  forestX: number = 0,
  forestWidth: number = Infinity
): string {
  // Build effective effects to render
  interface ResolvedEffect {
    point: number | null;
    lower: number | null;
    upper: number | null;
    color: string | null;
    shape: MarkerShape | null;
    opacity: number | null;
  }

  let effectsToRender: ResolvedEffect[];

  if (effects.length === 0) {
    // Default effect from primary columns
    effectsToRender = [{
      point: row.point,
      lower: row.lower,
      upper: row.upper,
      color: null,
      shape: null,
      opacity: null,
    }];
  } else {
    // Map effects with resolved values from metadata
    effectsToRender = effects.map(effect => ({
      point: getEffectValue(row, effect.pointCol, row.point),
      lower: getEffectValue(row, effect.lowerCol, row.lower),
      upper: getEffectValue(row, effect.upperCol, row.upper),
      color: effect.color ?? null,
      shape: effect.shape ?? null,
      opacity: effect.opacity ?? null,
    }));
  }

  // Filter to only valid effects
  const validEffects = effectsToRender.filter(e =>
    e.point != null && !Number.isNaN(e.point) &&
    e.lower != null && !Number.isNaN(e.lower) &&
    e.upper != null && !Number.isNaN(e.upper)
  );

  if (validEffects.length === 0) {
    return "";
  }

  const baseSize = theme.shapes.pointSize;
  const lineWidth = theme.shapes.lineWidth;
  const defaultLineColor = theme.colors.intervalLine;
  const whiskerHalf = SPACING.WHISKER_HALF_HEIGHT;

  // Check if this is a summary row (should render diamond)
  const isSummaryRow = row.style?.type === 'summary';
  const diamondHeight = theme.shapes.summaryHeight;
  const halfDiamondHeight = diamondHeight / 2;

  // Helper to get point size for an effect
  function getPointSize(isPrimary: boolean): number {
    // Check row-level marker size (only applies to primary effect)
    if (isPrimary && row.markerStyle?.size != null) {
      return baseSize * row.markerStyle.size;
    }
    // Legacy weight column support
    const weight = weightCol ? (row.metadata[weightCol] as number | undefined) : undefined;
    if (weight) {
      const scale = 0.5 + Math.sqrt(weight / 100) * 1.5;
      return Math.min(Math.max(baseSize * scale, 3), baseSize * 2.5);
    }
    return baseSize;
  }

  // Helper to get style for an effect
  function getEffectStyle(effect: ResolvedEffect, idx: number): {
    color: string;
    shape: MarkerShape;
    opacity: number;
  } {
    const isPrimary = idx === 0;
    const markerStyle = row.markerStyle;

    // Theme marker defaults for multi-effect plots
    const themeMarkerColors = theme.shapes.markerColors;
    const themeMarkerShapes = theme.shapes.markerShapes;
    const defaultShapes: MarkerShape[] = ["square", "circle", "diamond", "triangle"];

    // Color priority:
    // 1. Primary effect: row.markerStyle.color (if set)
    // 2. effect.color (if set)
    // 3. theme.shapes.markerColors[idx] (if defined)
    // 4. theme.colors.interval (fallback)
    let color: string;
    if (isPrimary && markerStyle?.color) {
      color = markerStyle.color;
    } else if (effect.color) {
      color = effect.color;
    } else if (themeMarkerColors && themeMarkerColors.length > 0) {
      color = themeMarkerColors[idx % themeMarkerColors.length];
    } else {
      color = theme.colors.interval ?? theme.colors.primary ?? "#2563eb";
    }

    // Shape priority:
    // 1. Primary effect: row.markerStyle.shape (if set)
    // 2. effect.shape (if set)
    // 3. theme.shapes.markerShapes[idx] (if defined)
    // 4. Default shapes: square, circle, diamond, triangle (cycling)
    let shape: MarkerShape;
    if (isPrimary && markerStyle?.shape) {
      shape = markerStyle.shape;
    } else if (effect.shape) {
      shape = effect.shape;
    } else if (themeMarkerShapes && themeMarkerShapes.length > 0) {
      shape = themeMarkerShapes[idx % themeMarkerShapes.length];
    } else {
      shape = defaultShapes[idx % defaultShapes.length];
    }

    // Opacity priority: row.markerStyle (primary) > effect > 1
    let opacity: number;
    if (isPrimary && markerStyle?.opacity != null) {
      opacity = markerStyle.opacity;
    } else if (effect.opacity != null) {
      opacity = effect.opacity;
    } else {
      opacity = 1;
    }

    return { color, shape, opacity };
  }

  // Helper to render marker shape
  function renderMarker(cx: number, effectY: number, size: number, style: { color: string; shape: MarkerShape; opacity: number }): string {
    const { color, shape, opacity } = style;
    const opacityAttr = opacity < 1 ? ` fill-opacity="${opacity}"` : "";

    switch (shape) {
      case "circle":
        return `<circle cx="${cx}" cy="${effectY}" r="${size}" fill="${color}"${opacityAttr}/>`;
      case "diamond": {
        const pts = [
          `${cx},${effectY - size}`,
          `${cx + size},${effectY}`,
          `${cx},${effectY + size}`,
          `${cx - size},${effectY}`
        ].join(' ');
        return `<polygon points="${pts}" fill="${color}"${opacityAttr}/>`;
      }
      case "triangle": {
        const pts = [
          `${cx},${effectY - size}`,
          `${cx + size},${effectY + size}`,
          `${cx - size},${effectY + size}`
        ].join(' ');
        return `<polygon points="${pts}" fill="${color}"${opacityAttr}/>`;
      }
      default: // square
        return `<rect x="${cx - size}" y="${effectY - size}" width="${size * 2}" height="${size * 2}" fill="${color}"${opacityAttr}/>`;
    }
  }

  // Render each effect
  const parts: string[] = [];
  validEffects.forEach((effect, idx) => {
    const effectY = yPosition + getEffectYOffset(idx, validEffects.length);
    const x1 = xScale(effect.lower!);
    const x2 = xScale(effect.upper!);
    const cx = xScale(effect.point!);
    const style = getEffectStyle(effect, idx);
    const pointSize = getPointSize(idx === 0);
    const lineColor = defaultLineColor;

    if (isSummaryRow) {
      // Summary row: render diamond shape spanning lower to upper
      const opacityAttr = style.opacity < 1 ? ` fill-opacity="${style.opacity}"` : "";
      const diamondPoints = [
        `${x1},${effectY}`,
        `${cx},${effectY - halfDiamondHeight}`,
        `${x2},${effectY}`,
        `${cx},${effectY + halfDiamondHeight}`
      ].join(' ');
      parts.push(`
        <g class="interval effect-${idx} summary">
          <polygon points="${diamondPoints}"
            fill="${style.color}"${opacityAttr} stroke="${theme.colors.summaryBorder}" stroke-width="1"/>
        </g>`);
    } else {
      // Regular row: CI line with whiskers and marker
      // Detect clipping (interval extends beyond axis range)
      // Use padded range to match web view (AXIS_LABEL_PADDING on each side)
      const axisLabelPadding = SPACING.AXIS_LABEL_PADDING;
      const minX = forestX + axisLabelPadding;
      const maxX = forestX + forestWidth - axisLabelPadding;
      const clippedLeft = x1 < minX;
      const clippedRight = x2 > maxX;
      const clampedX1 = Math.max(minX, Math.min(maxX, x1));
      const clampedX2 = Math.max(minX, Math.min(maxX, x2));

      // Build left end: whisker or arrow
      let leftEnd = "";
      if (clippedLeft) {
        // Arrow pointing left - tip at edge so line is hidden beneath
        leftEnd = `<path d="M ${minX} ${effectY} L ${minX + 6} ${effectY - 4} L ${minX + 6} ${effectY + 4} Z" fill="${lineColor}"/>`;
      } else {
        // Normal whisker
        leftEnd = `<line x1="${clampedX1}" x2="${clampedX1}" y1="${effectY - whiskerHalf}" y2="${effectY + whiskerHalf}" stroke="${lineColor}" stroke-width="${lineWidth}"/>`;
      }

      // Build right end: whisker or arrow
      let rightEnd = "";
      if (clippedRight) {
        // Arrow pointing right - tip at edge so line is hidden beneath
        rightEnd = `<path d="M ${maxX} ${effectY} L ${maxX - 6} ${effectY - 4} L ${maxX - 6} ${effectY + 4} Z" fill="${lineColor}"/>`;
      } else {
        // Normal whisker
        rightEnd = `<line x1="${clampedX2}" x2="${clampedX2}" y1="${effectY - whiskerHalf}" y2="${effectY + whiskerHalf}" stroke="${lineColor}" stroke-width="${lineWidth}"/>`;
      }

      parts.push(`
        <g class="interval effect-${idx}">
          <line x1="${clampedX1}" x2="${clampedX2}" y1="${effectY}" y2="${effectY}"
            stroke="${lineColor}" stroke-width="${lineWidth}"/>
          ${leftEnd}
          ${rightEnd}
          ${renderMarker(cx, effectY, pointSize, style)}
        </g>`);
    }
  });

  return parts.join("");
}

function renderDiamond(
  point: number,
  lower: number,
  upper: number,
  yPosition: number,
  xScale: Scale,
  forestX: number,
  forestWidth: number,
  theme: WebTheme
): string {
  const diamondHeight = theme.shapes.summaryHeight;
  const halfHeight = diamondHeight / 2;

  // Get scale range bounds for clamping
  const [rangeMin, rangeMax] = xScale.domain().map(d => xScale(d));
  const scaleRangeMin = Math.min(rangeMin, rangeMax);
  const scaleRangeMax = Math.max(rangeMin, rangeMax);

  // Compute scale positions and clamp to visible area
  const rawL = xScale(lower);
  const rawP = xScale(point);
  const rawU = xScale(upper);

  // Clamp to scale range, then add forestX offset
  const xL = forestX + Math.max(scaleRangeMin, Math.min(scaleRangeMax, rawL));
  const xP = forestX + Math.max(scaleRangeMin, Math.min(scaleRangeMax, rawP));
  const xU = forestX + Math.max(scaleRangeMin, Math.min(scaleRangeMax, rawU));

  const points = [
    `${xL},${yPosition}`,
    `${xP},${yPosition - halfHeight}`,
    `${xU},${yPosition}`,
    `${xP},${yPosition + halfHeight}`,
  ].join(" ");

  return `<polygon points="${points}"
    fill="${theme.colors.summaryFill}"
    stroke="${theme.colors.summaryBorder}"
    stroke-width="1"/>`;
}

function renderAxis(
  xScale: Scale,
  layout: InternalLayout,
  theme: WebTheme,
  axisLabel: string,
  forestX: number,
  nullValue: number = 1
): string {
  const lines: string[] = [];
  // Guard against R serialization returning {} instead of null
  const tickCount = typeof theme.axis.tickCount === "number"
    ? theme.axis.tickCount
    : SPACING.DEFAULT_TICK_COUNT;

  // Generate filtered ticks matching web view logic (EffectAxis.svelte)
  const ticks = filterAxisTicks(xScale, tickCount, theme, nullValue, layout.forestWidth);
  const fontSize = parseFontSize(theme.typography.fontSizeSm);

  // Edge threshold for text anchor adjustment (matches EffectAxis.svelte EDGE_THRESHOLD)
  const EDGE_THRESHOLD = 35;

  // Helper functions for edge label handling (matches EffectAxis.svelte)
  const getTextAnchor = (tickX: number): "start" | "middle" | "end" => {
    if (tickX < EDGE_THRESHOLD) return "start";
    if (tickX > layout.forestWidth - EDGE_THRESHOLD) return "end";
    return "middle";
  };

  const getTextXOffset = (tickX: number): number => {
    if (tickX < EDGE_THRESHOLD) return 2;
    if (tickX > layout.forestWidth - EDGE_THRESHOLD) return -2;
    return 0;
  };

  // Axis line
  lines.push(`<line x1="${forestX}" x2="${forestX + layout.forestWidth}"
    y1="0" y2="0" stroke="${theme.colors.border}" stroke-width="1"/>`);

  // Ticks and labels
  for (const tick of ticks) {
    const tickX = xScale(tick); // Position relative to forest plot
    const x = forestX + tickX;  // Absolute position in SVG
    const textAnchor = getTextAnchor(tickX);
    const xOffset = getTextXOffset(tickX);

    lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="4"
      stroke="${theme.colors.border}" stroke-width="1"/>`);
    lines.push(`<text x="${x + xOffset}" y="16" text-anchor="${textAnchor}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      fill="${theme.colors.secondary}">${formatTick(tick)}</text>`);
  }

  // Axis label
  if (axisLabel) {
    lines.push(`<text x="${forestX + layout.forestWidth / 2}" y="28"
      text-anchor="middle"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="500"
      fill="${theme.colors.secondary}">${escapeXml(axisLabel)}</text>`);
  }

  return `<g transform="translate(0, ${layout.mainY + layout.headerHeight + layout.plotHeight})">${lines.join("\n")}</g>`;
}

/**
 * Filter axis ticks to match web view behavior (EffectAxis.svelte).
 * - Uses minimum spacing to prevent overlap
 * - Filters symmetrically from null value outward
 * - Ensures null tick is included when in domain
 * - Guarantees at least 2 ticks
 */
function filterAxisTicks(
  xScale: Scale,
  tickCount: number,
  theme: WebTheme,
  nullValue: number,
  forestWidth: number
): number[] {
  // Use explicit tick values if provided
  if (Array.isArray(theme.axis.tickValues) && theme.axis.tickValues.length > 0) {
    const [domainMin, domainMax] = xScale.domain() as [number, number];
    let result = theme.axis.tickValues.filter((t: number) => t >= domainMin && t <= domainMax);
    // Ensure null tick is included if in domain
    const shouldIncludeNull = theme.axis.nullTick !== false;
    const nullInDomain = nullValue >= domainMin && nullValue <= domainMax;
    if (shouldIncludeNull && nullInDomain && !result.includes(nullValue)) {
      result = [...result, nullValue].sort((a, b) => a - b);
    }
    return result;
  }

  const [domainMin, domainMax] = xScale.domain() as [number, number];
  const shouldIncludeNull = theme.axis.nullTick !== false;
  const nullInDomain = nullValue >= domainMin && nullValue <= domainMax;

  const minSpacing = 50; // Minimum pixels between tick labels (matches web view)
  const maxTicks = Math.max(2, Math.floor(forestWidth / minSpacing));
  const effectiveTickCount = Math.min(tickCount, Math.min(7, maxTicks));

  const allTicks = xScale.ticks(effectiveTickCount);
  if (allTicks.length === 0) {
    if (shouldIncludeNull && nullInDomain) {
      return [nullValue];
    }
    return [];
  }

  // Filter ticks symmetrically from null value outward
  const nullX = xScale(nullValue);

  // Separate ticks into left and right of null
  const leftTicks = allTicks.filter((t: number) => t < nullValue).reverse(); // Process outward from null
  const rightTicks = allTicks.filter((t: number) => t > nullValue);
  const hasNullTickInAll = allTicks.some((t: number) => t === nullValue);

  // Filter left side (from null outward to left)
  const filteredLeft: number[] = [];
  let lastLeftX = nullX;
  for (const tick of leftTicks) {
    const x = xScale(tick);
    if (lastLeftX - x >= minSpacing) {
      filteredLeft.unshift(tick); // Prepend to maintain order
      lastLeftX = x;
    }
  }

  // Filter right side (from null outward to right)
  const filteredRight: number[] = [];
  let lastRightX = nullX;
  for (const tick of rightTicks) {
    const x = xScale(tick);
    if (x - lastRightX >= minSpacing) {
      filteredRight.push(tick);
      lastRightX = x;
    }
  }

  // Combine: left + null (if present or required) + right
  const result = [...filteredLeft];

  // Include null tick if: (1) it was in D3's ticks, OR (2) nullTick config requires it and it's in domain
  if (hasNullTickInAll || (shouldIncludeNull && nullInDomain)) {
    result.push(nullValue);
  }

  result.push(...filteredRight);

  // Guarantee at least 2 ticks
  if (result.length < 2) {
    const tickSet = new Set(result);
    if (!tickSet.has(domainMin)) {
      result.unshift(domainMin);
    }
    if (result.length < 2 && !tickSet.has(domainMax)) {
      result.push(domainMax);
    }
  }

  return result;
}

function renderReferenceLine(
  x: number,
  y1: number,
  y2: number,
  style: "solid" | "dashed" | "dotted",
  color: string,
  label?: string,
  width: number = 1,
  opacity: number = 0.6
): string {
  const dashArray = style === "dashed" ? "6,4" : style === "dotted" ? "2,2" : "none";
  let svg = `<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"
    stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-dasharray="${dashArray}"/>`;

  if (label) {
    svg += `<text x="${x}" y="${y1 - 4}" text-anchor="middle"
      font-size="10px" fill="${color}">${escapeXml(label)}</text>`;
  }

  return svg;
}

// ============================================================================
// Validation
// ============================================================================

class SVGGeneratorError extends Error {
  constructor(message: string) {
    super(`SVG Generator: ${message}`);
    this.name = "SVGGeneratorError";
  }
}

function validateSpec(spec: unknown): asserts spec is WebSpec {
  if (!spec || typeof spec !== "object") {
    throw new SVGGeneratorError("Invalid spec: expected an object");
  }

  const s = spec as Record<string, unknown>;

  // Validate required properties
  if (!s.data || typeof s.data !== "object") {
    throw new SVGGeneratorError("Invalid spec: missing or invalid 'data' property");
  }

  const data = s.data as Record<string, unknown>;
  if (!Array.isArray(data.rows)) {
    throw new SVGGeneratorError("Invalid spec: 'data.rows' must be an array");
  }

  if (!s.theme || typeof s.theme !== "object") {
    throw new SVGGeneratorError("Invalid spec: missing or invalid 'theme' property");
  }

  const theme = s.theme as Record<string, unknown>;
  if (!theme.colors || typeof theme.colors !== "object") {
    throw new SVGGeneratorError("Invalid spec: missing or invalid 'theme.colors'");
  }
  if (!theme.typography || typeof theme.typography !== "object") {
    throw new SVGGeneratorError("Invalid spec: missing or invalid 'theme.typography'");
  }
  if (!theme.spacing || typeof theme.spacing !== "object") {
    throw new SVGGeneratorError("Invalid spec: missing or invalid 'theme.spacing'");
  }
}

// ============================================================================
// Main Export Function
// ============================================================================

export function generateSVG(spec: WebSpec, options: ExportOptions = {}): string {
  // Validate input
  validateSpec(spec);

  const theme = spec.theme;
  const layout = computeLayout(spec, options);
  const padding = theme.spacing.padding;

  // Ensure columns is an array (guard against R serialization issues)
  const columns = Array.isArray(spec.columns) ? spec.columns : [];

  // Column setup - both flat (leaf) columns and column defs (with groups)
  const leftColumnDefs = getColumnDefs(columns, "left");
  const rightColumnDefs = getColumnDefs(columns, "right");
  const leftColumns = flattenColumns(columns, "left");
  const rightColumns = flattenColumns(columns, "right");

  // Calculate left table width using auto-widths from layout
  const leftTableWidth = layout.labelWidth +
    leftColumns.reduce((sum, c) => sum + getEffectiveWidth(c, layout.autoWidths), 0);

  // Forest position (with COLUMN_GAP padding on each side)
  const forestX = padding + leftTableWidth + LAYOUT.COLUMN_GAP;
  const xScale = computeXScale(spec, layout.forestWidth, options);

  // Right table position (after forest + gap)
  const rightTableX = forestX + layout.forestWidth + LAYOUT.COLUMN_GAP;

  // Build SVG
  const parts: string[] = [];

  // SVG opening
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
  width="${layout.totalWidth}" height="${layout.totalHeight}"
  viewBox="0 0 ${layout.totalWidth} ${layout.totalHeight}">`);

  // Background
  const bgColor = options.backgroundColor ?? theme.colors.background;
  parts.push(`<rect width="100%" height="100%" fill="${bgColor}"/>`);

  // Header (title, subtitle)
  parts.push(renderHeader(spec, layout, theme));

  // Table separator line (at top of table area, always present)
  parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
    y1="${layout.mainY}" y2="${layout.mainY}"
    stroke="${theme.colors.border}" stroke-width="2"/>`);


  // Column headers (supports column groups with two-tier rendering)
  const headerY = layout.mainY;
  parts.push(renderColumnHeaders(
    leftColumnDefs,
    leftColumns,
    padding,
    headerY,
    layout.headerHeight,
    theme,
    spec.data.labelHeader ?? "Study",
    layout.labelWidth,
    layout.autoWidths
  ));
  if (rightColumns.length > 0) {
    parts.push(renderColumnHeaders(
      rightColumnDefs,
      rightColumns,
      rightTableX,
      headerY,
      layout.headerHeight,
      theme,
      undefined,
      undefined,
      layout.autoWidths
    ));
  }

  // Header border (2px to match web view)
  parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
    y1="${headerY + layout.headerHeight}" y2="${headerY + layout.headerHeight}"
    stroke="${theme.colors.border}" stroke-width="2"/>`);

  // Build display rows (used for both forest intervals and table rendering)
  const displayRows = buildDisplayRows(spec);

  // Check if we have row groups (affects row background logic)
  const rowGroups = Array.isArray(spec.data.groups) ? spec.data.groups : [];
  const hasRowGroups = rowGroups.length > 0;

  // Pre-compute row positions and heights (accounting for spacer rows)
  // This is used for both forest intervals and table row rendering
  const rowPositions: number[] = [];
  const rowHeights: number[] = [];
  let accumulatedY = 0;
  for (const dr of displayRows) {
    const isSpacerRow = dr.type === "data" && dr.row.style?.type === "spacer";
    const height = isSpacerRow ? layout.rowHeight / 2 : layout.rowHeight;
    rowPositions.push(accumulatedY);
    rowHeights.push(height);
    accumulatedY += height;
  }

  // Forest plot area
  if (spec.data.includeForest && layout.forestWidth > 0) {
    const plotY = layout.mainY + layout.headerHeight;

    // Reference line (null value)
    const nullX = forestX + xScale(spec.data.nullValue);
    parts.push(renderReferenceLine(
      nullX,
      plotY,
      plotY + layout.plotHeight,
      "dashed",
      theme.colors.muted
    ));

    // Custom annotations (guard against non-array annotations from R serialization)
    const annotations = Array.isArray(spec.annotations) ? spec.annotations : [];
    for (const ann of annotations) {
      if (ann.type === "reference_line") {
        const annX = forestX + xScale(ann.x);
        parts.push(renderReferenceLine(
          annX,
          plotY,
          plotY + layout.plotHeight,
          ann.style,
          ann.color ?? theme.colors.accent,
          ann.label,
          ann.width ?? 1,
          ann.opacity ?? 0.6
        ));
      }
    }

    // Row intervals (only render for data rows, skip group headers)
    displayRows.forEach((displayRow, i) => {
      if (displayRow.type === "data") {
        const yPos = plotY + rowPositions[i] + rowHeights[i] / 2;
        parts.push(renderInterval(displayRow.row, yPos, (v) => forestX + xScale(v), theme, spec.data.nullValue, spec.data.effects, spec.data.weightCol, forestX, layout.forestWidth));
      }
    });

    // Overall summary diamond (with validation)
    if (spec.data.overall && layout.showOverallSummary &&
        typeof spec.data.overall.point === 'number' && !Number.isNaN(spec.data.overall.point) &&
        typeof spec.data.overall.lower === 'number' && !Number.isNaN(spec.data.overall.lower) &&
        typeof spec.data.overall.upper === 'number' && !Number.isNaN(spec.data.overall.upper)) {
      const diamondY = plotY + layout.summaryYPosition;
      parts.push(renderDiamond(
        spec.data.overall.point,
        spec.data.overall.lower,
        spec.data.overall.upper,
        diamondY,
        xScale,
        forestX,
        layout.forestWidth,
        theme
      ));
    }

    // Axis
    parts.push(renderAxis(xScale, layout, theme, spec.data.axisLabel, forestX, spec.data.nullValue));
  }

  // Table rows (uses display rows to interleave group headers with data)
  // rowPositions and rowHeights are already computed above
  const rowsY = layout.mainY + layout.headerHeight;

  // Compute bar max values from all data rows for proper scaling
  const allDataRows = spec.data.rows;
  const leftBarMaxValues = computeBarMaxValues(allDataRows, leftColumns);
  const rightBarMaxValues = computeBarMaxValues(allDataRows, rightColumns);

  displayRows.forEach((displayRow, i) => {
    const y = rowsY + rowPositions[i];
    const rowHeight = rowHeights[i];

    if (displayRow.type === "group_header") {
      // Render group header
      parts.push(renderGroupHeader(
        displayRow.label,
        displayRow.depth,
        padding,
        y,
        rowHeight,
        layout.totalWidth - padding * 2,
        theme
      ));
    } else {
      // Render data row
      const row = displayRow.row;
      const depth = displayRow.depth;
      const isSpacerRow = row.style?.type === "spacer";

      // Row background - depth-based when groups exist, alternating when no groups
      // Matches web view logic in getRowClasses():
      //   - With groups: use depth-based opacity (depth > 0 only)
      //   - Without groups: use alternating odd row opacity
      // Skip background for spacer rows
      if (!isSpacerRow) {
        const depthOpacity = getDepthOpacity(depth);
        // Only apply alternating background when there are no groups
        const oddOpacity = (!hasRowGroups && i % 2 === 1) ? ROW_ODD_OPACITY : 0;
        const bgOpacity = Math.max(depthOpacity, oddOpacity);

        if (bgOpacity > 0) {
          parts.push(`<rect x="${padding}" y="${y}"
            width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
            fill="${theme.colors.muted}" opacity="${bgOpacity}"/>`);
        }
      }

      // Left table
      parts.push(renderTableRow(row, leftColumns, padding, y, rowHeight, theme, true, layout.labelWidth, depth, leftBarMaxValues, layout.autoWidths));

      // Right table
      if (rightColumns.length > 0) {
        parts.push(renderTableRow(row, rightColumns, rightTableX, y, rowHeight, theme, false, 0, depth, rightBarMaxValues, layout.autoWidths));
      }
    }

    // Row borders
    if (displayRow.type === "data") {
      const row = displayRow.row;
      const isSummaryRow = row.style?.type === "summary";
      const isSpacerRow = row.style?.type === "spacer";

      // Summary rows get a 2px top border
      if (isSummaryRow) {
        parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
          y1="${y}" y2="${y}"
          stroke="${theme.colors.border}" stroke-width="2"/>`);
      }

      // Bottom border (skip for spacer rows)
      if (!isSpacerRow) {
        parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
          y1="${y + rowHeight}" y2="${y + rowHeight}"
          stroke="${theme.colors.border}" stroke-width="1"/>`);
      }
    } else {
      // Group headers get a bottom border
      parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
        y1="${y + rowHeight}" y2="${y + rowHeight}"
        stroke="${theme.colors.border}" stroke-width="1"/>`);
    }
  });

  // Footer (caption, footnote)
  parts.push(renderFooter(spec, layout, theme));

  // Close SVG
  parts.push("</svg>");

  return parts.join("\n");
}

// ============================================================================
// PNG Export Helper (browser only)
// ============================================================================

export async function svgToBlob(svgString: string, scale: number = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to get canvas context"));
        return;
      }

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create PNG blob"));
          }
        },
        "image/png",
        1.0
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG image"));
    };

    img.src = url;
  });
}
