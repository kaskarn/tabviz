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
  VizBarColumnOptions,
  VizBoxplotColumnOptions,
  VizViolinColumnOptions,
  BoxplotStats,
  KDEResult,
} from "$types";
import { niceDomain, DOMAIN_PADDING, getEffectValue } from "./scale-utils";
import { computeAxis, generateTicks, VIZ_MARGIN, type AxisComputation } from "./axis-utils";
import { computeArrowDimensions, renderArrowPath } from "./arrow-utils";
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
  GROUP_HEADER_OPACITY,
  EFFECT,
  getEffectYOffset,
  AXIS,
  BADGE_VARIANTS,
} from "./rendering-constants";
import {
  formatNumber,
  formatEvents,
  formatInterval,
  formatPvalue,
  getColumnDisplayText,
} from "./formatters";
import { estimateTextWidth } from "./width-utils";
import {
  computeBoxplotStats,
  computeKDE,
  normalizeKDE,
  kdeToViolinPath,
} from "./viz-utils";

// ============================================================================
// Export Options
// ============================================================================

/**
 * Pre-computed layout data for a single forest column
 */
export interface ForestColumnLayout {
  columnId: string;
  xPosition: number;
  width: number;
  xDomain: [number, number];
  clipBounds: [number, number];
  ticks: number[];
  scale: "linear" | "log";
  nullValue: number;
  axisLabel: string;
}

/**
 * Complete pre-computed layout from browser (WYSIWYG path)
 */
export interface PrecomputedLayout {
  // Column layout (unified order - no left/right split)
  columnOrder: string[];
  columnWidths: Record<string, number>;
  columnPositions: Record<string, number>;

  // Forest columns (may be multiple, inline with other columns)
  forestColumns: ForestColumnLayout[];

  // Row layout
  rowHeights: number[];
  rowPositions: number[];
  totalRowsHeight: number;

  // Header
  headerHeight: number;
  headerDepth: number;  // 1 or 2 for grouped headers

  // Overall dimensions
  naturalWidth: number;
  naturalHeight: number;
}

export interface ExportOptions {
  width?: number;
  height?: number;
  scale?: number;
  backgroundColor?: string;

  // NEW: Complete pre-computed layout from browser (WYSIWYG path)
  precomputedLayout?: PrecomputedLayout;

  // LEGACY: Individual fields for backwards compatibility / R-side export
  // Pre-computed column widths from web view (keyed by column ID, including "__label__")
  columnWidths?: Record<string, number>;
  // Pre-computed forest/plot width from web view
  forestWidth?: number;
  // Pre-computed x-axis domain from web view (ensures matching scale)
  xDomain?: [number, number];
  // Clip bounds for CI arrows
  clipBounds?: [number, number];
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
  // Round to 2 decimal places to avoid floating point precision issues
  const headerFontSize = Math.round(fontSize * headerFontScale * 100) / 100;
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
 * Count all descendant rows for a group (used in group header display: "Group (N)")
 */
function countGroupDescendantRows(
  groupId: string,
  groups: Array<{ id: string; parentId?: string | null }>,
  rows: Array<{ groupId?: string | null }>
): number {
  // Count direct rows in this group
  let count = rows.filter(r => r.groupId === groupId).length;

  // Find all child groups and count their descendants recursively
  const childGroups = groups.filter(g => g.parentId === groupId);
  for (const child of childGroups) {
    count += countGroupDescendantRows(child.id, groups, rows);
  }

  return count;
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
      const rowCount = countGroupDescendantRows(group.id, groups, spec.data.rows);
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

function computeLayout(spec: WebSpec, options: ExportOptions, nullValue: number = 0): InternalLayout {
  const theme = spec.theme;
  const rowHeight = theme.spacing.rowHeight;
  const padding = theme.spacing.padding;
  // Use theme's columnGap for spacing between columns (matches web view CSS grid column-gap)
  const columnGap = theme.spacing.columnGap ?? 8;

  // Ensure columns is an array (guard against R serialization issues)
  const columns = Array.isArray(spec.columns) ? spec.columns : [];

  // Check if we have column groups (need taller header)
  // Must check ALL columns including unified columns (without position)
  const leftColumnDefs = getColumnDefs(columns, "left");
  const rightColumnDefs = getColumnDefs(columns, "right");
  const hasGroups = hasColumnGroups(leftColumnDefs) || hasColumnGroups(rightColumnDefs) || hasColumnGroups(columns);

  // Header height calculation must match web view behavior:
  // Web CSS: min-height: var(--wf-header-row-height) + padding: var(--wf-cell-padding-y) top+bottom
  // For 2-tier headers (headerDepth=2), each row is:
  //   headerHeight/2 (min-height) + cellPaddingY*2 (top+bottom padding)
  const headerDepth = hasGroups ? 2 : 1;
  const cellPaddingY = theme.spacing.cellPaddingY ?? 4;
  const baseRowHeight = theme.spacing.headerHeight / headerDepth;
  // Add cell padding for multi-row headers (browser renders padding inside the min-height)
  const actualRowHeight = baseRowHeight + (hasGroups ? cellPaddingY * 2 : 0);
  const headerHeight = actualRowHeight * headerDepth;

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
  // Support both legacy (left/right position) and new unified (no position) column models
  const leftColumns = flattenColumns(columns, "left");
  const rightColumns = flattenColumns(columns, "right");
  const unifiedColumns = flattenAllColumns(columns).filter(c =>
    (c as { position?: string }).position === undefined
  );

  // allColumns includes both legacy positioned columns and unified columns
  const allColumns = [...leftColumns, ...rightColumns, ...unifiedColumns];

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
  // For legacy model: left and right tables around forest
  const leftTableWidth = labelWidth +
    leftColumns.reduce((sum, c) => sum + getEffectiveWidth(c, autoWidths), 0);
  const rightTableWidth =
    rightColumns.reduce((sum, c) => sum + getEffectiveWidth(c, autoWidths), 0);

  // For unified model: count non-forest columns width
  const unifiedNonForestWidth = unifiedColumns
    .filter(c => c.type !== "forest")
    .reduce((sum, c) => sum + getEffectiveWidth(c, autoWidths), 0);

  // Forest width calculation - "tables first" approach
  const baseWidth = options.width ?? LAYOUT.DEFAULT_WIDTH;
  // Check for forest columns (new API) OR legacy includeForest flag
  const hasForestColumns = allColumns.some(c => c.type === "forest");
  const includeForest = hasForestColumns || spec.data.includeForest;

  // Total table width includes legacy positioned columns AND unified non-forest columns
  const totalTableWidth = leftTableWidth + rightTableWidth + unifiedNonForestWidth;

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
    const availableForForest = baseWidth - totalTableWidth - columnGap * 2 - padding * 2;
    forestWidth = Math.max(availableForForest, LAYOUT.MIN_FOREST_WIDTH);
  }

  // Total width: expand if content needs more space than requested width
  const neededWidth = padding * 2 + totalTableWidth + forestWidth + columnGap * 2;
  const totalWidth = Math.max(options.width ?? baseWidth, neededWidth);

  // If totalWidth is larger than neededWidth and forest width wasn't explicitly set,
  // expand forest to fill the remaining space (prevents gap on right side)
  if (includeForest && totalWidth > neededWidth &&
      typeof options.forestWidth !== "number" && typeof spec.layout.plotWidth !== "number") {
    forestWidth = totalWidth - totalTableWidth - padding * 2 - columnGap * 2;
  }

  // Total height: include full axis area (ticks + labels + axis label + gap)
  const axisGap = theme.spacing.axisGap ?? 12;
  // Axis content: tick labels at y=16, axis label at y=28, plus text descenders ~4px = ~32px
  // Full axis area: axisGap (between plot and axis) + axis content + some breathing room
  const webAxisHeight = axisGap + LAYOUT.AXIS_HEIGHT + LAYOUT.AXIS_LABEL_HEIGHT; // ~76px total
  const totalHeight = headerTextHeight + padding +
    headerHeight + plotHeight +
    webAxisHeight +
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
    nullValue,
    summaryYPosition: plotHeight - rowHeight,
    showOverallSummary: hasOverall,
    headerTextHeight,
    footerTextHeight,
    titleY: padding + TYPOGRAPHY.TITLE_HEIGHT - 8, // Baseline adjustment
    subtitleY: padding + titleHeight + TYPOGRAPHY.SUBTITLE_HEIGHT - 4,
    mainY: headerTextHeight + padding,
    // Footer Y: Match web view's layout (axisHeight + 8px footer padding-top)
    footerY: headerTextHeight + padding + headerHeight + plotHeight + webAxisHeight + 8,
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

/**
 * Flatten all columns in order (unified model - no left/right filtering).
 * Forest columns appear inline with other columns.
 */
function flattenAllColumns(columns: ColumnDef[]): ColumnSpec[] {
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

/**
 * Legacy function - flatten columns by position (left/right).
 * Used for backwards compatibility with R-side export.
 */
function flattenColumns(columns: ColumnDef[], position?: "left" | "right"): ColumnSpec[] {
  // If no position specified, return all columns
  if (position === undefined) {
    return flattenAllColumns(columns);
  }

  const result: ColumnSpec[] = [];
  for (const col of columns) {
    if ((col as { position?: string }).position !== position) continue;
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
  let value: number;
  if (size.endsWith("rem")) {
    value = parseFloat(size) * TYPOGRAPHY.REM_BASE;
  } else if (size.endsWith("px")) {
    value = parseFloat(size);
  } else {
    value = TYPOGRAPHY.DEFAULT_FONT_SIZE;
  }
  // Round to 2 decimal places to avoid floating point precision issues
  return Math.round(value * 100) / 100;
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
 * Compute axis and x-scale for forest plot.
 *
 * Uses the shared computeAxis() from axis-utils.ts to ensure consistent
 * behavior between web view and SVG export.
 *
 * If options.xDomain is provided, uses that domain directly (for matching web view).
 * If options.clipBounds is provided, uses those for clipping detection.
 */
interface ScaleAndClip {
  scale: Scale;
  clipBounds: [number, number];
  ticks: number[];
}

function computeXScaleAndClip(spec: WebSpec, forestWidth: number, forestSettings: ForestColumnSettings, options?: ExportOptions): ScaleAndClip {
  const isLog = forestSettings.scale === "log";
  // Use VIZ_MARGIN (12px) to match web rendering - this is the margin from forest column edges
  const rangeStart = VIZ_MARGIN;
  const rangeEnd = Math.max(forestWidth - VIZ_MARGIN, rangeStart + 50);

  // If pre-computed domain is provided, use it directly
  if (options?.xDomain) {
    const domain = options.xDomain;
    const clipBounds = options.clipBounds ?? domain;
    // Generate ticks for pre-computed domain using axis-utils
    const ticks = generateTicks(
      clipBounds,
      spec.theme.axis,
      forestSettings.scale,
      forestSettings.nullValue
    );
    if (isLog) {
      return {
        scale: createLogScale(
          [Math.max(domain[0], 0.01), Math.max(domain[1], 0.02)],
          [rangeStart, rangeEnd]
        ),
        clipBounds,
        ticks,
      };
    }
    return {
      scale: createLinearScale(domain, [rangeStart, rangeEnd]),
      clipBounds,
      ticks,
    };
  }

  // Use shared axis computation from axis-utils.ts
  const axisResult = computeAxis({
    rows: spec.data.rows,
    config: spec.theme.axis,
    scale: forestSettings.scale,
    nullValue: forestSettings.nullValue,
    forestWidth,
    pointSize: spec.theme.shapes.pointSize,
    effects: forestSettings.effects,
    pointCol: forestSettings.pointCol,
    lowerCol: forestSettings.lowerCol,
    upperCol: forestSettings.upperCol,
  });

  const { plotRegion, axisLimits, ticks } = axisResult;

  if (isLog) {
    return {
      scale: createLogScale(
        [Math.max(plotRegion[0], 0.01), Math.max(plotRegion[1], 0.02)],
        [rangeStart, rangeEnd]
      ),
      clipBounds: axisLimits,
      ticks,
    };
  }

  return {
    scale: createLinearScale(plotRegion, [rangeStart, rangeEnd]),
    clipBounds: axisLimits,
    ticks,
  };
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
      font-weight="${theme.typography.fontWeightNormal}"
      fill="${theme.colors.secondary}">${escapeXml(spec.labels.subtitle)}</text>`);
  }

  return lines.join("\n");
}

function renderFooter(spec: WebSpec, layout: InternalLayout, theme: WebTheme): string {
  const lines: string[] = [];
  const padding = theme.spacing.padding;
  let y = layout.footerY;

  // Draw footer border (1px) when caption or footnote exists, matching web view's PlotFooter border-top
  const hasFooter = !!spec.labels?.caption || !!spec.labels?.footnote;
  if (hasFooter) {
    // Border is 8px above the text (footerY includes the 8px padding gap)
    const borderY = layout.footerY - 8;
    lines.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
      y1="${borderY}" y2="${borderY}"
      stroke="${theme.colors.border}" stroke-width="1"/>`);
  }

  if (spec.labels?.caption) {
    const fontSize = parseFontSize(theme.typography.fontSizeSm);
    lines.push(`<text x="${padding}" y="${y}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${theme.typography.fontWeightNormal}"
      fill="${theme.colors.secondary}">${escapeXml(spec.labels.caption)}</text>`);
    y += TYPOGRAPHY.CAPTION_HEIGHT;
  }

  if (spec.labels?.footnote) {
    const fontSize = parseFontSize(theme.typography.fontSizeSm);
    lines.push(`<text x="${padding}" y="${y}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${theme.typography.fontWeightNormal}"
      font-style="italic"
      fill="${theme.colors.muted}">${escapeXml(spec.labels.footnote)}</text>`);
  }

  return lines.join("\n");
}

function renderGroupHeader(
  label: string,
  depth: number,
  rowCount: number,
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

  // Use row center - dominant-baseline:central handles vertical alignment
  const textY = y + rowHeight / 2;
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

  // Group header text (label)
  const fontStyle = italic ? ' font-style="italic"' : '';
  const labelX = x + SPACING.TEXT_PADDING + indent;
  lines.push(`<text class="cell-text" x="${labelX}" y="${textY}"
    font-family="${theme.typography.fontFamily}"
    font-size="${fontSize}px"
    font-weight="${fontWeight}"${fontStyle}
    fill="${theme.colors.foreground}">${escapeXml(label)}</text>`);

  // Row count (e.g., "(15)") - smaller muted text after label
  // Web CSS: font-weight: normal, color: muted, font-size: 0.75rem
  if (rowCount > 0) {
    // Estimate label width for positioning count
    const avgCharWidth = fontSize * TYPOGRAPHY.AVG_CHAR_WIDTH_RATIO;
    const labelWidth = label.length * avgCharWidth;
    const countX = labelX + labelWidth + 6; // 6px gap
    const countFontSize = parseFontSize(theme.typography.fontSizeSm ?? "0.75rem");
    lines.push(`<text class="cell-text" x="${countX}" y="${textY}"
      font-family="${theme.typography.fontFamily}"
      font-size="${countFontSize}px"
      font-weight="${theme.typography.fontWeightNormal}"
      fill="${theme.colors.muted}">(${rowCount})</text>`);
  }

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

function renderInterval(
  row: Row,
  yPosition: number,
  xScale: Scale,
  theme: WebTheme,
  nullValue: number,
  effects: EffectSpec[] = [],
  weightCol?: string | null,
  forestX: number = 0,
  forestWidth: number = Infinity,
  clipBounds?: [number, number],
  isLog: boolean = false
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
    // For log scale, filter non-positive values
    const point = (!isLog || (row.point != null && row.point > 0)) ? row.point : null;
    const lower = (!isLog || (row.lower != null && row.lower > 0)) ? row.lower : null;
    const upper = (!isLog || (row.upper != null && row.upper > 0)) ? row.upper : null;
    effectsToRender = [{
      point,
      lower,
      upper,
      color: null,
      shape: null,
      opacity: null,
    }];
  } else {
    // Map effects with resolved values using shared utility
    // Pass isLog to filter out non-positive values for log scale
    effectsToRender = effects.map(effect => ({
      point: getEffectValue(row.metadata, row.point, effect.pointCol, "point", isLog),
      lower: getEffectValue(row.metadata, row.lower, effect.lowerCol, "lower", isLog),
      upper: getEffectValue(row.metadata, row.upper, effect.upperCol, "upper", isLog),
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

    // Theme effect defaults for multi-effect plots
    const themeEffectColors = theme.shapes.effectColors;
    const themeMarkerShapes = theme.shapes.markerShapes;
    const defaultShapes: MarkerShape[] = ["square", "circle", "diamond", "triangle"];

    // Color priority:
    // 1. Primary effect: row.markerStyle.color (if set)
    // 2. effect.color (if set)
    // 3. theme.shapes.effectColors[idx] (if defined)
    // 4. theme.colors.interval (fallback)
    let color: string;
    if (isPrimary && markerStyle?.color) {
      color = markerStyle.color;
    } else if (effect.color) {
      color = effect.color;
    } else if (themeEffectColors && themeEffectColors.length > 0) {
      color = themeEffectColors[idx % themeEffectColors.length];
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
      // Summary row: render diamond shape spanning lower to upper.
      // Note: Summary diamonds are intentionally NOT clipped - they represent
      // the overall effect size and typically shouldn't extend beyond axis limits.
      // If clipping is needed in the future, clamp x1/x2 to clipBounds.
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
      // Detect clipping using domain values (clipBounds) if available, else fallback to pixel positions
      // Use VIZ_MARGIN (12px) to match web rendering
      const minX = forestX + VIZ_MARGIN;
      const maxX = forestX + forestWidth - VIZ_MARGIN;

      // Use clipBounds for clipping detection (domain units), not pixel positions
      const clippedLeft = clipBounds ? effect.lower! < clipBounds[0] : x1 < minX;
      const clippedRight = clipBounds ? effect.upper! > clipBounds[1] : x2 > maxX;

      // Clamp values - use domain-based clamping if clipBounds available
      let clampedX1: number, clampedX2: number;
      if (clipBounds) {
        const clampedLower = Math.max(clipBounds[0], Math.min(clipBounds[1], effect.lower!));
        const clampedUpper = Math.max(clipBounds[0], Math.min(clipBounds[1], effect.upper!));
        clampedX1 = xScale(clampedLower);
        clampedX2 = xScale(clampedUpper);
      } else {
        clampedX1 = Math.max(minX, Math.min(maxX, x1));
        clampedX2 = Math.max(minX, Math.min(maxX, x2));
      }

      // Get scaled arrow dimensions based on theme
      const arrowConfig = computeArrowDimensions(theme);
      const arrowHalfHeight = arrowConfig.height / 2;

      // Arrow positions: use clipBounds-based positions when available (matching web view)
      // Note: xScale already includes forestX offset (wrapped at call site), so don't add it again
      const leftArrowX = clipBounds ? xScale(clipBounds[0]) : minX;
      const rightArrowX = clipBounds ? xScale(clipBounds[1]) : maxX;

      // Build left end: whisker or arrow.
      let leftEnd = "";
      if (clippedLeft) {
        // Arrow pointing left with scaled dimensions (include opacity from theme)
        const arrowOpacity = arrowConfig.opacity < 1 ? ` fill-opacity="${arrowConfig.opacity}"` : "";
        leftEnd = `<path d="${renderArrowPath("left", leftArrowX, effectY, arrowConfig)}" fill="${arrowConfig.color}"${arrowOpacity}/>`;
      } else {
        // Normal whisker (use scaled whisker height matching arrow)
        leftEnd = `<line x1="${clampedX1}" x2="${clampedX1}" y1="${effectY - arrowHalfHeight}" y2="${effectY + arrowHalfHeight}" stroke="${lineColor}" stroke-width="${lineWidth}"/>`;
      }

      // Build right end: whisker or arrow
      let rightEnd = "";
      if (clippedRight) {
        // Arrow pointing right with scaled dimensions (include opacity from theme)
        const arrowOpacity = arrowConfig.opacity < 1 ? ` fill-opacity="${arrowConfig.opacity}"` : "";
        rightEnd = `<path d="${renderArrowPath("right", rightArrowX, effectY, arrowConfig)}" fill="${arrowConfig.color}"${arrowOpacity}/>`;
      } else {
        // Normal whisker
        rightEnd = `<line x1="${clampedX2}" x2="${clampedX2}" y1="${effectY - arrowHalfHeight}" y2="${effectY + arrowHalfHeight}" stroke="${lineColor}" stroke-width="${lineWidth}"/>`;
      }

      // Clamp point estimate to visible range so markers don't render outside
      // forest area when explicit axis limits exclude the point estimate
      const clampedCx = clipBounds
        ? xScale(Math.max(clipBounds[0], Math.min(clipBounds[1], effect.point!)))
        : Math.max(minX, Math.min(maxX, cx));

      parts.push(`
        <g class="interval effect-${idx}">
          <line x1="${clampedX1}" x2="${clampedX2}" y1="${effectY}" y2="${effectY}"
            stroke="${lineColor}" stroke-width="${lineWidth}"/>
          ${leftEnd}
          ${rightEnd}
          ${renderMarker(clampedCx, effectY, pointSize, style)}
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

// ============================================================================
// Viz Column Renderers (viz_bar, viz_boxplot, viz_violin)
// ============================================================================

/**
 * Render a viz_bar column cell for a single row.
 * Matches VizBar.svelte rendering.
 */
function renderVizBar(
  row: Row,
  yCenter: number,
  rowHeight: number,
  vizX: number,
  vizWidth: number,
  options: VizBarColumnOptions,
  xScale: Scale,
  theme: WebTheme
): string {
  const parts: string[] = [];
  const effects = options.effects;
  const numEffects = effects.length;

  // Check if row has valid data
  const hasValidData = effects.some(e => {
    const val = row.metadata[e.value];
    return val != null && !Number.isNaN(val as number);
  });

  if (!hasValidData) return "";

  // Bar dimensions (matching VizBar.svelte)
  const totalBarHeight = rowHeight * 0.7;
  const barGap = numEffects > 1 ? 2 : 0;
  const adjustedBarHeight = (totalBarHeight - barGap * (numEffects - 1)) / numEffects;
  const barHeight = Math.max(4, adjustedBarHeight);

  // Default colors from theme
  const defaultColors = theme.shapes.effectColors ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

  effects.forEach((effect, idx) => {
    const value = row.metadata[effect.value] as number | undefined;
    if (value == null || Number.isNaN(value)) return;

    const barY = yCenter - totalBarHeight / 2 + idx * (barHeight + barGap);
    const barXStart = vizX + xScale(Math.min(0, value));
    const barW = Math.abs(xScale(value) - xScale(0));
    const color = effect.color ?? defaultColors[idx % defaultColors.length];
    const opacity = effect.opacity ?? 0.85;

    parts.push(`<rect
      x="${barXStart}" y="${barY}"
      width="${Math.max(1, barW)}" height="${barHeight}"
      fill="${color}" fill-opacity="${opacity}" rx="2"
      class="viz-bar-segment"/>`);
  });

  return parts.join("\n");
}

/**
 * Render a viz_boxplot column cell for a single row.
 * Matches VizBoxplot.svelte rendering.
 */
function renderVizBoxplot(
  row: Row,
  yCenter: number,
  rowHeight: number,
  vizX: number,
  vizWidth: number,
  options: VizBoxplotColumnOptions,
  xScale: Scale,
  theme: WebTheme
): string {
  const parts: string[] = [];
  const effects = options.effects;
  const numEffects = effects.length;

  // Compute stats for each effect
  const effectStats: (BoxplotStats | null)[] = effects.map(effect => {
    // Mode 1: Array data - compute stats
    if (effect.data) {
      const data = row.metadata[effect.data] as number[] | undefined;
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }
      return computeBoxplotStats(data);
    }

    // Mode 2: Pre-computed stats
    if (effect.min && effect.q1 && effect.median && effect.q3 && effect.max) {
      const min = row.metadata[effect.min] as number;
      const q1 = row.metadata[effect.q1] as number;
      const median = row.metadata[effect.median] as number;
      const q3 = row.metadata[effect.q3] as number;
      const max = row.metadata[effect.max] as number;

      if ([min, q1, median, q3, max].some(v => v == null || Number.isNaN(v))) {
        return null;
      }

      // Get outliers if specified
      let outliers: number[] = [];
      if (effect.outliers) {
        const outliersData = row.metadata[effect.outliers] as number[] | undefined;
        if (outliersData && Array.isArray(outliersData)) {
          outliers = outliersData;
        }
      }

      return { min, q1, median, q3, max, outliers };
    }

    return null;
  });

  // Check if we have valid data
  const hasValidData = effectStats.some(s => s !== null);
  if (!hasValidData) return "";

  // Box dimensions (matching VizBoxplot.svelte)
  const totalHeight = rowHeight * 0.7;
  const boxGap = numEffects > 1 ? 2 : 0;
  const boxHeight = Math.max(8, (totalHeight - (numEffects - 1) * boxGap) / numEffects);

  // Default colors
  const defaultColors = theme.shapes.effectColors ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
  const lineColor = theme.colors.foreground ?? "#1a1a1a";

  effects.forEach((effect, idx) => {
    const stats = effectStats[idx];
    if (!stats) return;

    const boxY = yCenter - totalHeight / 2 + idx * (boxHeight + boxGap);
    const boxCenterY = boxY + boxHeight / 2;
    const color = effect.color ?? defaultColors[idx % defaultColors.length];
    const opacity = effect.fillOpacity ?? 0.7;

    // Whisker lines
    // Left whisker
    parts.push(`<line
      x1="${vizX + xScale(stats.min)}" x2="${vizX + xScale(stats.q1)}"
      y1="${boxCenterY}" y2="${boxCenterY}"
      stroke="${lineColor}" stroke-width="1"/>`);
    // Left whisker cap
    parts.push(`<line
      x1="${vizX + xScale(stats.min)}" x2="${vizX + xScale(stats.min)}"
      y1="${boxCenterY - boxHeight / 4}" y2="${boxCenterY + boxHeight / 4}"
      stroke="${lineColor}" stroke-width="1"/>`);

    // Right whisker
    parts.push(`<line
      x1="${vizX + xScale(stats.q3)}" x2="${vizX + xScale(stats.max)}"
      y1="${boxCenterY}" y2="${boxCenterY}"
      stroke="${lineColor}" stroke-width="1"/>`);
    // Right whisker cap
    parts.push(`<line
      x1="${vizX + xScale(stats.max)}" x2="${vizX + xScale(stats.max)}"
      y1="${boxCenterY - boxHeight / 4}" y2="${boxCenterY + boxHeight / 4}"
      stroke="${lineColor}" stroke-width="1"/>`);

    // Box (Q1 to Q3)
    const boxW = Math.max(2, xScale(stats.q3) - xScale(stats.q1));
    parts.push(`<rect
      x="${vizX + xScale(stats.q1)}" y="${boxY}"
      width="${boxW}" height="${boxHeight}"
      fill="${color}" fill-opacity="${opacity}"
      stroke="${lineColor}" stroke-width="1"/>`);

    // Median line
    parts.push(`<line
      x1="${vizX + xScale(stats.median)}" x2="${vizX + xScale(stats.median)}"
      y1="${boxY}" y2="${boxY + boxHeight}"
      stroke="${lineColor}" stroke-width="2"/>`);

    // Outliers
    if (options.showOutliers !== false && stats.outliers.length > 0) {
      for (const outlier of stats.outliers) {
        parts.push(`<circle
          cx="${vizX + xScale(outlier)}" cy="${boxCenterY}"
          r="2.5"
          fill="none" stroke="${color}" stroke-width="1.5"/>`);
      }
    }
  });

  return parts.join("\n");
}

/**
 * Render a viz_violin column cell for a single row.
 * Matches VizViolin.svelte rendering.
 */
function renderVizViolin(
  row: Row,
  yCenter: number,
  rowHeight: number,
  vizX: number,
  vizWidth: number,
  options: VizViolinColumnOptions,
  xScale: Scale,
  theme: WebTheme
): string {
  const parts: string[] = [];
  const effects = options.effects;
  const numEffects = effects.length;

  // Compute KDE for each effect
  const effectKDEs: (KDEResult | null)[] = effects.map(effect => {
    const data = row.metadata[effect.data] as number[] | undefined;
    if (!data || !Array.isArray(data) || data.length < 2) {
      return null;
    }
    return computeKDE(data, options.bandwidth);
  });

  // Compute quartiles for median/quartile lines
  const effectQuartiles: ({ q1: number; median: number; q3: number } | null)[] = effects.map(effect => {
    const data = row.metadata[effect.data] as number[] | undefined;
    if (!data || !Array.isArray(data) || data.length < 2) {
      return null;
    }
    const sorted = data.filter(v => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const n = sorted.length;
    const quantile = (p: number): number => {
      if (n === 1) return sorted[0];
      const h = (n - 1) * p;
      const lo = Math.floor(h);
      const hi = Math.ceil(h);
      if (lo === hi) return sorted[lo];
      return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
    };
    return { q1: quantile(0.25), median: quantile(0.5), q3: quantile(0.75) };
  });

  // Check if we have valid data
  const hasValidData = effectKDEs.some(k => k !== null);
  if (!hasValidData) return "";

  // Violin dimensions (matching VizViolin.svelte)
  const totalHeight = rowHeight * 0.8;
  const violinGap = numEffects > 1 ? 2 : 0;
  const violinHeight = Math.max(10, (totalHeight - (numEffects - 1) * violinGap) / numEffects);
  const maxWidth = violinHeight / 2;

  // Default colors
  const defaultColors = theme.shapes.effectColors ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
  const lineColor = theme.colors.foreground ?? "#1a1a1a";

  effects.forEach((effect, idx) => {
    const kde = effectKDEs[idx];
    const quartiles = effectQuartiles[idx];
    if (!kde || kde.x.length < 2) return;

    const violinCenterY = yCenter - totalHeight / 2 + violinHeight / 2 + idx * (violinHeight + violinGap);
    const color = effect.color ?? defaultColors[idx % defaultColors.length];
    const opacity = effect.fillOpacity ?? 0.5;

    // Generate violin path
    const normalized = normalizeKDE(kde, maxWidth);
    const pathPoints: string[] = [];

    // Right side (above center)
    for (let i = 0; i < normalized.x.length; i++) {
      const x = vizX + xScale(normalized.x[i]);
      const y = violinCenterY - normalized.y[i];
      pathPoints.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }

    // Left side (below center, reversed)
    for (let i = normalized.x.length - 1; i >= 0; i--) {
      const x = vizX + xScale(normalized.x[i]);
      const y = violinCenterY + normalized.y[i];
      pathPoints.push(`L ${x} ${y}`);
    }
    pathPoints.push("Z");

    parts.push(`<path
      d="${pathPoints.join(" ")}"
      fill="${color}" fill-opacity="${opacity}"
      stroke="${lineColor}" stroke-width="0.5"/>`);

    // Median line
    if (options.showMedian !== false && quartiles) {
      const medianX = vizX + xScale(quartiles.median);
      parts.push(`<line
        x1="${medianX}" x2="${medianX}"
        y1="${violinCenterY - maxWidth * 0.6}" y2="${violinCenterY + maxWidth * 0.6}"
        stroke="${lineColor}" stroke-width="2"/>`);
    }

    // Quartile lines
    if (options.showQuartiles && quartiles) {
      const q1X = vizX + xScale(quartiles.q1);
      const q3X = vizX + xScale(quartiles.q3);
      parts.push(`<line
        x1="${q1X}" x2="${q1X}"
        y1="${violinCenterY - maxWidth * 0.4}" y2="${violinCenterY + maxWidth * 0.4}"
        stroke="${lineColor}" stroke-width="1" stroke-dasharray="2,2"/>`);
      parts.push(`<line
        x1="${q3X}" x2="${q3X}"
        y1="${violinCenterY - maxWidth * 0.4}" y2="${violinCenterY + maxWidth * 0.4}"
        stroke="${lineColor}" stroke-width="1" stroke-dasharray="2,2"/>`);
    }
  });

  return parts.join("\n");
}

/**
 * Compute shared scale for a viz_bar column across all rows.
 */
function computeVizBarScale(
  rows: Row[],
  options: VizBarColumnOptions,
  vizWidth: number
): Scale {
  const isLog = options.scale === "log";
  const padding = VIZ_MARGIN;

  let domainMin = options.axisRange?.[0];
  let domainMax = options.axisRange?.[1];

  if (domainMin == null || domainMax == null) {
    const allValues: number[] = [];
    for (const row of rows) {
      for (const effect of options.effects) {
        const val = row.metadata[effect.value] as number | undefined;
        if (val != null && !Number.isNaN(val)) {
          allValues.push(val);
        }
      }
    }
    if (allValues.length > 0) {
      domainMin = domainMin ?? Math.min(0, ...allValues);
      domainMax = domainMax ?? Math.max(...allValues) * 1.1;
    } else {
      domainMin = domainMin ?? 0;
      domainMax = domainMax ?? 100;
    }
  }

  if (isLog) {
    return createLogScale([Math.max(0.01, domainMin), domainMax], [padding, vizWidth - padding]);
  }
  return createLinearScale([domainMin, domainMax], [padding, vizWidth - padding]);
}

/**
 * Compute shared scale for a viz_boxplot column across all rows.
 */
function computeVizBoxplotScale(
  rows: Row[],
  options: VizBoxplotColumnOptions,
  vizWidth: number
): Scale {
  const isLog = options.scale === "log";
  const padding = VIZ_MARGIN;

  let domainMin = options.axisRange?.[0];
  let domainMax = options.axisRange?.[1];

  if (domainMin == null || domainMax == null) {
    const allValues: number[] = [];
    for (const row of rows) {
      for (const effect of options.effects) {
        // Array data mode
        if (effect.data) {
          const data = row.metadata[effect.data] as number[] | undefined;
          if (data && Array.isArray(data)) {
            const stats = computeBoxplotStats(data);
            allValues.push(stats.min, stats.max);
            if (options.showOutliers !== false) allValues.push(...stats.outliers);
          }
        }
        // Pre-computed stats mode
        else if (effect.min && effect.max) {
          const min = row.metadata[effect.min] as number;
          const max = row.metadata[effect.max] as number;
          if (min != null && !Number.isNaN(min)) allValues.push(min);
          if (max != null && !Number.isNaN(max)) allValues.push(max);
        }
      }
    }
    if (allValues.length > 0) {
      const dataMin = Math.min(...allValues);
      const dataMax = Math.max(...allValues);
      const range = dataMax - dataMin;
      domainMin = domainMin ?? dataMin - range * 0.05;
      domainMax = domainMax ?? dataMax + range * 0.05;
    } else {
      domainMin = domainMin ?? 0;
      domainMax = domainMax ?? 100;
    }
  }

  if (isLog) {
    return createLogScale([Math.max(0.01, domainMin), domainMax], [padding, vizWidth - padding]);
  }
  return createLinearScale([domainMin, domainMax], [padding, vizWidth - padding]);
}

/**
 * Compute shared scale for a viz_violin column across all rows.
 */
function computeVizViolinScale(
  rows: Row[],
  options: VizViolinColumnOptions,
  vizWidth: number
): Scale {
  const isLog = options.scale === "log";
  const padding = VIZ_MARGIN;

  let domainMin = options.axisRange?.[0];
  let domainMax = options.axisRange?.[1];

  if (domainMin == null || domainMax == null) {
    const allValues: number[] = [];
    for (const row of rows) {
      for (const effect of options.effects) {
        const data = row.metadata[effect.data] as number[] | undefined;
        if (data && Array.isArray(data)) {
          allValues.push(...data.filter(v => v != null && !Number.isNaN(v)));
        }
      }
    }
    if (allValues.length > 0) {
      domainMin = domainMin ?? Math.min(...allValues);
      domainMax = domainMax ?? Math.max(...allValues);
      // Add padding for KDE tails
      const range = (domainMax ?? 0) - (domainMin ?? 0);
      domainMin = (domainMin ?? 0) - range * 0.1;
      domainMax = (domainMax ?? 0) + range * 0.1;
    } else {
      domainMin = domainMin ?? 0;
      domainMax = domainMax ?? 100;
    }
  }

  if (isLog) {
    return createLogScale([Math.max(0.01, domainMin), domainMax], [padding, vizWidth - padding]);
  }
  return createLinearScale([domainMin, domainMax], [padding, vizWidth - padding]);
}

/**
 * Render axis for a viz column.
 */
function renderVizAxis(
  xScale: Scale,
  layout: InternalLayout,
  theme: WebTheme,
  axisLabel: string | undefined,
  vizX: number,
  vizWidth: number,
  nullValue: number | undefined
): string {
  const lines: string[] = [];
  const fontSize = parseFontSize(theme.typography.fontSizeSm);

  const EDGE_THRESHOLD = AXIS.EDGE_THRESHOLD;

  const getTextAnchor = (tickX: number): "start" | "middle" | "end" => {
    if (tickX < EDGE_THRESHOLD) return "start";
    if (tickX > vizWidth - EDGE_THRESHOLD) return "end";
    return "middle";
  };

  const getTextXOffset = (tickX: number): number => {
    if (tickX < EDGE_THRESHOLD) return 2;
    if (tickX > vizWidth - EDGE_THRESHOLD) return -2;
    return 0;
  };

  // Axis line
  lines.push(`<line x1="${vizX}" x2="${vizX + vizWidth}"
    y1="0" y2="0" stroke="${theme.colors.border}" stroke-width="1"/>`);

  // Generate ticks from scale domain
  const domain = xScale.domain();
  const tickCount = 5;
  const ticks: number[] = [];
  const range = domain[1] - domain[0];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(domain[0] + (range * i) / tickCount);
  }

  // Tick marks and labels
  for (const tick of ticks) {
    const tickX = xScale(tick);
    const x = vizX + tickX;
    const textAnchor = getTextAnchor(tickX);
    const xOffset = getTextXOffset(tickX);
    const label = formatNumber(tick);

    lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="4" stroke="${theme.colors.border}" stroke-width="1"/>`);
    lines.push(`<text x="${x + xOffset}" y="14"
      text-anchor="${textAnchor}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${theme.typography.fontWeightNormal}"
      fill="${theme.colors.foreground}">${label}</text>`);
  }

  // Axis label
  if (axisLabel) {
    lines.push(`<text x="${vizX + vizWidth / 2}" y="28"
      text-anchor="middle"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${theme.typography.fontWeightMedium}"
      fill="${theme.colors.foreground}">${escapeXml(axisLabel)}</text>`);
  }

  return lines.join("\n");
}

/**
 * Render axis for a forest column.
 * Supports multi-forest layout with independent axes per forest column.
 */
function renderForestAxis(
  xScale: Scale,
  layout: InternalLayout,
  theme: WebTheme,
  axisLabel: string,
  forestX: number,
  forestWidth: number,
  nullValue: number = 1,
  baseTicks?: number[]
): string {
  const lines: string[] = [];
  const tickCount = typeof theme.axis.tickCount === "number"
    ? theme.axis.tickCount
    : SPACING.DEFAULT_TICK_COUNT;

  const ticks = filterAxisTicks(xScale, tickCount, theme, nullValue, forestWidth, baseTicks);
  const fontSize = parseFontSize(theme.typography.fontSizeSm);

  const EDGE_THRESHOLD = AXIS.EDGE_THRESHOLD;

  const getTextAnchor = (tickX: number): "start" | "middle" | "end" => {
    if (tickX < EDGE_THRESHOLD) return "start";
    if (tickX > forestWidth - EDGE_THRESHOLD) return "end";
    return "middle";
  };

  const getTextXOffset = (tickX: number): number => {
    if (tickX < EDGE_THRESHOLD) return 2;
    if (tickX > forestWidth - EDGE_THRESHOLD) return -2;
    return 0;
  };

  // Axis line
  lines.push(`<line x1="${forestX}" x2="${forestX + forestWidth}"
    y1="0" y2="0" stroke="${theme.colors.border}" stroke-width="1"/>`);

  // Ticks and labels
  for (const tick of ticks) {
    const tickX = xScale(tick);
    const x = forestX + tickX;
    const textAnchor = getTextAnchor(tickX);
    const xOffset = getTextXOffset(tickX);

    lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="4"
      stroke="${theme.colors.border}" stroke-width="1"/>`);
    lines.push(`<text x="${x + xOffset}" y="16" text-anchor="${textAnchor}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${theme.typography.fontWeightNormal}"
      fill="${theme.colors.secondary}">${formatTick(tick)}</text>`);
  }

  // Axis label
  if (axisLabel) {
    lines.push(`<text x="${forestX + forestWidth / 2}" y="28"
      text-anchor="middle"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${theme.typography.fontWeightMedium}"
      fill="${theme.colors.secondary}">${escapeXml(axisLabel)}</text>`);
  }

  return `<g transform="translate(0, ${layout.mainY + layout.headerHeight + layout.plotHeight})">${lines.join("\n")}</g>`;
}

/**
 * Render column headers using unified column order.
 * Forest columns get their header rendered like other columns.
 */
function renderUnifiedColumnHeaders(
  columnDefs: ColumnDef[],
  leafColumns: ColumnSpec[],
  x: number,
  y: number,
  headerHeight: number,
  theme: WebTheme,
  labelHeader: string,
  labelWidth: number,
  autoWidths: Map<string, number>,
  getColWidth: (col: ColumnSpec) => number
): string {
  const lines: string[] = [];
  const baseFontSize = parseFontSize(theme.typography.fontSizeBase);
  const headerFontScale = theme.typography.headerFontScale ?? 1.05;
  // Round to 2 decimal places to avoid floating point precision issues
  const fontSize = Math.round(baseFontSize * headerFontScale * 100) / 100;
  // All header cells use bold weight to match web view CSS (.header-cell { font-weight: bold })
  const fontWeight = theme.typography.fontWeightBold;
  const boldWeight = theme.typography.fontWeightBold;
  const hasGroups = hasColumnGroups(columnDefs);

  // Use row center - dominant-baseline:central handles vertical alignment
  const getTextY = (containerY: number, containerHeight: number) =>
    containerY + containerHeight / 2;

  if (hasGroups) {
    // Two-tier header
    const row1Height = headerHeight / 2;
    const row2Height = headerHeight / 2;
    let currentX = x;

    // Label column spans both rows
    lines.push(`<text class="cell-text" x="${currentX + SPACING.TEXT_PADDING}" y="${getTextY(y, headerHeight)}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${fontWeight}"
      fill="${theme.colors.foreground}">${escapeXml(labelHeader)}</text>`);
    currentX += labelWidth;

    // Track group borders
    const groupBorders: Array<{ x1: number; x2: number }> = [];

    for (const col of columnDefs) {
      if (col.isGroup) {
        const groupWidth = col.columns.reduce((sum, c) => {
          if (c.isGroup) {
            return sum + c.columns.reduce((s, cc) => s + getColWidth(cc as ColumnSpec), 0);
          }
          return sum + getColWidth(c as ColumnSpec);
        }, 0);
        const textX = currentX + groupWidth / 2;
        lines.push(`<text class="cell-text" x="${textX}" y="${getTextY(y, row1Height)}"
          font-family="${theme.typography.fontFamily}"
          font-size="${fontSize}px"
          font-weight="${boldWeight}"
          text-anchor="middle"
          fill="${theme.colors.foreground}">${escapeXml(col.header)}</text>`);
        groupBorders.push({ x1: currentX, x2: currentX + groupWidth });
        currentX += groupWidth;
      } else {
        const width = getColWidth(col);
        const headerAlign = col.headerAlign ?? col.align;
        const { textX, anchor } = getTextPosition(currentX, width, headerAlign);
        const truncatedHeader = truncateText(col.header, width, fontSize, SPACING.TEXT_PADDING);
        lines.push(`<text class="cell-text" x="${textX}" y="${getTextY(y, headerHeight)}"
          font-family="${theme.typography.fontFamily}"
          font-size="${fontSize}px"
          font-weight="${fontWeight}"
          text-anchor="${anchor}"
          fill="${theme.colors.foreground}">${escapeXml(truncatedHeader)}</text>`);
        currentX += width;
      }
    }

    // Draw borders under groups (matches web view: .group-row { border-bottom: 1px solid var(--wf-border) })
    for (const border of groupBorders) {
      lines.push(`<line x1="${border.x1}" x2="${border.x2}"
        y1="${y + row1Height}" y2="${y + row1Height}"
        stroke="${theme.colors.border}" stroke-width="1"/>`);
    }

    // Row 2: Sub-column headers
    currentX = x + labelWidth;
    for (const col of columnDefs) {
      if (col.isGroup) {
        for (const subCol of col.columns) {
          if (!subCol.isGroup) {
            const width = getColWidth(subCol as ColumnSpec);
            const headerAlign = (subCol as ColumnSpec).headerAlign ?? (subCol as ColumnSpec).align;
            const { textX, anchor } = getTextPosition(currentX, width, headerAlign);
            lines.push(`<text class="cell-text" x="${textX}" y="${getTextY(y + row1Height, row2Height)}"
              font-family="${theme.typography.fontFamily}"
              font-size="${fontSize}px"
              font-weight="${fontWeight}"
              text-anchor="${anchor}"
              fill="${theme.colors.foreground}">${escapeXml(subCol.header)}</text>`);
            currentX += width;
          }
        }
      } else {
        currentX += getColWidth(col);
      }
    }
  } else {
    // Single-row header
    let currentX = x;

    lines.push(`<text class="cell-text" x="${currentX + SPACING.TEXT_PADDING}" y="${getTextY(y, headerHeight)}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${fontWeight}"
      fill="${theme.colors.foreground}">${escapeXml(labelHeader)}</text>`);
    currentX += labelWidth;

    for (const col of leafColumns) {
      const width = getColWidth(col);
      const headerAlign = col.headerAlign ?? col.align;
      const { textX, anchor } = getTextPosition(currentX, width, headerAlign);
      const truncatedHeader = truncateText(col.header, width, fontSize, SPACING.TEXT_PADDING);

      lines.push(`<text class="cell-text" x="${textX}" y="${getTextY(y, headerHeight)}"
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

/**
 * Render a table row using unified column order.
 * Renders label column + all data columns in order (forest columns are skipped as they're rendered separately).
 */
function renderUnifiedTableRow(
  row: Row,
  columns: ColumnSpec[],
  x: number,
  y: number,
  rowHeight: number,
  theme: WebTheme,
  labelWidth: number,
  depth: number,
  barMaxValues: Map<string, number>,
  autoWidths: Map<string, number>,
  getColWidth: (col: ColumnSpec) => number,
  columnPositions: number[]
): string {
  const lines: string[] = [];
  const fontSize = parseFontSize(theme.typography.fontSizeBase);
  // Use row center for text positioning - dominant-baseline:central handles vertical alignment
  const textY = y + rowHeight / 2;

  // Render label
  const indent = depth * SPACING.INDENT_PER_LEVEL + (row.style?.indent ?? 0) * SPACING.INDENT_PER_LEVEL;
  const fontWeight = (row.style?.bold || row.style?.emphasis) ? theme.typography.fontWeightBold : theme.typography.fontWeightNormal;
  const fontStyle = row.style?.italic ? "italic" : "normal";
  let textColor = theme.colors.foreground;
  if (row.style?.color) {
    textColor = row.style.color;
  } else if (row.style?.muted) {
    textColor = theme.colors.muted;
  } else if (row.style?.accent) {
    textColor = theme.colors.accent;
  }

  // Don't truncate labels - they're the primary row identifier and the width
  // was already computed to fit them (either by browser measurement or SVG estimation)
  lines.push(`<text class="cell-text" x="${x + SPACING.TEXT_PADDING + indent}" y="${textY}"
    font-family="${theme.typography.fontFamily}"
    font-size="${fontSize}px"
    font-weight="${fontWeight}"
    font-style="${fontStyle}"
    fill="${textColor}">${escapeXml(row.label)}</text>`);

  // Badge (if present)
  if (row.style?.badge) {
    const badgeText = String(row.style.badge);
    const badgeFontSize = fontSize * BADGE.FONT_SCALE;
    const badgeHeight = badgeFontSize + BADGE.PADDING * 2;
    const labelTextWidth = estimateTextWidth(row.label, fontSize);
    const badgeX = x + SPACING.TEXT_PADDING + indent + labelTextWidth + BADGE.GAP;
    const badgeTextWidth = estimateTextWidth(badgeText, badgeFontSize);
    const badgeWidth = badgeTextWidth + BADGE.PADDING * 2;
    const badgeY = y + (rowHeight - badgeHeight) / 2;

    lines.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}"
      rx="3" fill="${theme.colors.primary}" opacity="0.15"/>`);
    lines.push(`<text class="cell-text" x="${badgeX + badgeWidth / 2}" y="${badgeY + badgeHeight / 2}"
      text-anchor="middle"
      font-family="${theme.typography.fontFamily}"
      font-size="${badgeFontSize}px"
      font-weight="${theme.typography.fontWeightBold}"
      fill="${theme.colors.primary}">${escapeXml(badgeText)}</text>`);
  }

  // Render each column at its position
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const currentX = columnPositions[i];
    const width = getColWidth(col);

    // Skip forest and viz columns (rendered separately as SVG overlay)
    if (col.type === "forest" || col.type === "viz_bar" || col.type === "viz_boxplot" || col.type === "viz_violin") {
      continue;
    }

    const value = getCellValue(row, col);
    const { textX, anchor } = getTextPosition(currentX, width, col.align);

    if (col.type === "bar" && typeof row.metadata[col.field] === "number") {
      // Render bar
      const barValue = row.metadata[col.field] as number;
      const computedMax = barMaxValues.get(col.field);
      const maxValue = col.options?.bar?.maxValue ?? computedMax ?? 100;
      const barColor = col.options?.bar?.color ?? theme.colors.primary;
      const barHeight = theme.shapes.pointSize * 2;
      const textWidth = 50;
      const barAreaWidth = width - SPACING.TEXT_PADDING * 2 - textWidth;
      const barWidth = Math.min((barValue / maxValue) * barAreaWidth, barAreaWidth);

      // Respect row styling for bar value text
      const rowStyle = row.style;
      const barFontWeight = (rowStyle?.bold || rowStyle?.emphasis)
        ? theme.typography.fontWeightBold
        : theme.typography.fontWeightNormal;

      lines.push(`<rect x="${currentX + SPACING.TEXT_PADDING}" y="${y + rowHeight / 2 - barHeight / 2}"
        width="${Math.max(0, barWidth)}" height="${barHeight}"
        fill="${barColor}" opacity="0.7" rx="2"/>`);
      lines.push(`<text class="cell-text" x="${currentX + width - SPACING.TEXT_PADDING}" y="${textY}"
        font-family="${theme.typography.fontFamily}"
        font-size="${fontSize}px"
        font-weight="${barFontWeight}"
        text-anchor="end"
        fill="${theme.colors.foreground}">${formatNumber(barValue)}</text>`);
    } else if (col.type === "sparkline" && Array.isArray(row.metadata[col.field])) {
      // Render sparkline
      let data = row.metadata[col.field] as number[] | number[][];
      if (Array.isArray(data[0])) {
        data = data[0] as number[];
      }
      const sparkHeight = col.options?.sparkline?.height ?? 16;
      const sparkColor = col.options?.sparkline?.color ?? theme.colors.primary;
      const sparkPadding = SPACING.TEXT_PADDING * 2;
      const path = renderSparklinePath(data, currentX + SPACING.TEXT_PADDING, y + rowHeight / 2 - sparkHeight / 2, width - sparkPadding, sparkHeight);
      lines.push(`<path d="${path}" fill="none" stroke="${sparkColor}" stroke-width="1.5"/>`);
    } else if (col.type === "badge") {
      // Render badge cell
      const badgeValue = row.metadata[col.field];
      if (badgeValue !== undefined && badgeValue !== null) {
        const badgeText = String(badgeValue);
        const badgeFontSize = fontSize * 0.85;
        const badgeHeight = badgeFontSize + 8;

        const variants = col.options?.badge?.variants;
        const customColors = col.options?.badge?.colors;
        let badgeColor = theme.colors.primary;
        let badgeTextColor = theme.colors.primary;

        if (customColors && badgeText in customColors) {
          badgeColor = customColors[badgeText];
          badgeTextColor = customColors[badgeText];
        } else if (variants && badgeText in variants) {
          const variant = variants[badgeText] as keyof typeof BADGE_VARIANTS | "default" | "muted";
          const variantColors: Record<string, string> = {
            default: theme.colors.primary,
            ...BADGE_VARIANTS,
            muted: theme.colors.muted,
          };
          badgeColor = variantColors[variant] ?? theme.colors.primary;
          badgeTextColor = badgeColor;
        }

        const badgeTextWidth = estimateTextWidth(badgeText, badgeFontSize);
        const badgeWidth = badgeTextWidth + 12;
        const badgeX = col.align === "right"
          ? currentX + width - SPACING.TEXT_PADDING - badgeWidth
          : col.align === "center"
            ? currentX + (width - badgeWidth) / 2
            : currentX + SPACING.TEXT_PADDING;
        const badgeY = y + (rowHeight - badgeHeight) / 2;

        lines.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}"
          rx="${badgeHeight / 2}" fill="${badgeColor}" opacity="0.15"/>`);
        lines.push(`<text class="cell-text" x="${badgeX + badgeWidth / 2}" y="${badgeY + badgeHeight / 2}"
          text-anchor="middle"
          font-family="${theme.typography.fontFamily}"
          font-size="${badgeFontSize}px"
          font-weight="${theme.typography.fontWeightBold}"
          fill="${badgeTextColor}">${escapeXml(badgeText)}</text>`);
      }
    } else if (col.type === "stars") {
      // Render star rating
      const val = row.metadata[col.field];
      if (typeof val === "number") {
        const maxStars = col.options?.stars?.maxStars ?? 5;
        const starColor = col.options?.stars?.color ?? "#f59e0b";
        const emptyColor = col.options?.stars?.emptyColor ?? "#d1d5db";
        const rating = Math.max(0, Math.min(maxStars, val));
        const filled = Math.floor(rating);
        const hasHalf = col.options?.stars?.halfStars && (rating - filled) >= 0.5;

        const starSize = 12;
        const starGap = 2;
        const totalStarsWidth = maxStars * starSize + (maxStars - 1) * starGap;
        let starX = col.align === "right"
          ? currentX + width - SPACING.TEXT_PADDING - totalStarsWidth
          : col.align === "center"
            ? currentX + (width - totalStarsWidth) / 2
            : currentX + SPACING.TEXT_PADDING;
        const starY = y + (rowHeight - starSize) / 2;

        const starPath = (cx: number, cy: number, size: number) => {
          const r = size / 2;
          const innerR = r * 0.4;
          let d = "";
          for (let j = 0; j < 5; j++) {
            const outerAngle = (j * 72 - 90) * Math.PI / 180;
            const innerAngle = ((j * 72 + 36) - 90) * Math.PI / 180;
            const ox = cx + r * Math.cos(outerAngle);
            const oy = cy + r * Math.sin(outerAngle);
            const ix = cx + innerR * Math.cos(innerAngle);
            const iy = cy + innerR * Math.sin(innerAngle);
            d += (j === 0 ? `M${ox},${oy}` : `L${ox},${oy}`) + `L${ix},${iy}`;
          }
          return d + "Z";
        };

        for (let j = 0; j < maxStars; j++) {
          const cx = starX + starSize / 2;
          const cy = starY + starSize / 2;
          const isFilled = j < filled || (j === filled && hasHalf);
          const color = isFilled ? starColor : emptyColor;
          lines.push(`<path d="${starPath(cx, cy, starSize)}" fill="${color}"/>`);
          starX += starSize + starGap;
        }
      }
    } else {
      // Default text rendering with cell styling
      // Priority: per-cell style > row-level style > default
      const cellStyle = row.cellStyles?.[col.field];
      const rowStyle = row.style;

      // Font weight: cell > row > default
      let cellFontWeight = theme.typography.fontWeightNormal;
      if (cellStyle?.bold || cellStyle?.emphasis) {
        cellFontWeight = theme.typography.fontWeightBold;
      } else if (rowStyle?.bold || rowStyle?.emphasis) {
        cellFontWeight = theme.typography.fontWeightBold;
      }

      // Font style: cell > row > default
      let cellFontStyle = "normal";
      if (cellStyle?.italic) {
        cellFontStyle = "italic";
      } else if (rowStyle?.italic) {
        cellFontStyle = "italic";
      }

      // Color: cell > row > default
      let cellColor = theme.colors.foreground;
      if (cellStyle?.color) {
        cellColor = cellStyle.color;
      } else if (cellStyle?.muted) {
        cellColor = theme.colors.muted;
      } else if (cellStyle?.accent) {
        cellColor = theme.colors.accent;
      } else if (rowStyle?.color) {
        cellColor = rowStyle.color;
      } else if (rowStyle?.muted) {
        cellColor = theme.colors.muted;
      } else if (rowStyle?.accent) {
        cellColor = theme.colors.accent;
      }

      lines.push(`<text class="cell-text" x="${textX}" y="${textY}"
        font-family="${theme.typography.fontFamily}"
        font-size="${fontSize}px"
        font-weight="${cellFontWeight}"
        font-style="${cellFontStyle}"
        text-anchor="${anchor}"
        fill="${cellColor}">${escapeXml(value)}</text>`);
    }
  }

  return lines.join("\n");
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
  forestWidth: number,
  baseTicks?: number[]
): number[] {
  // Use explicit tick values if provided (highest priority)
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

  const minSpacing = AXIS.MIN_TICK_SPACING;
  const maxTicks = Math.max(2, Math.floor(forestWidth / minSpacing));
  const effectiveTickCount = Math.min(tickCount, Math.min(7, maxTicks));

  // Use baseTicks from axis-utils if provided, otherwise fall back to D3
  const allTicks = baseTicks && baseTicks.length > 0
    ? baseTicks.filter(t => t >= domainMin && t <= domainMax)
    : xScale.ticks(effectiveTickCount);
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

  // Include null tick if: (1) it was in base ticks, OR (2) nullTick config requires it and it's in domain
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
  theme: WebTheme,
  label?: string,
  width: number = 1,
  opacity: number = 0.6
): string {
  const dashArray = style === "dashed" ? "6,4" : style === "dotted" ? "2,2" : "none";
  let svg = `<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"
    stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-dasharray="${dashArray}"/>`;

  if (label) {
    // Web uses secondary color for annotation labels (ForestPlot.svelte:1161)
    const labelColor = theme.colors.secondary;
    svg += `<text x="${x}" y="${y1 - 4}" text-anchor="middle"
      font-family="${theme.typography.fontFamily}"
      font-size="${theme.typography.fontSizeSm}"
      font-weight="${theme.typography.fontWeightMedium}"
      fill="${labelColor}">${escapeXml(label)}</text>`;
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
// Forest Column Settings Extraction
// ============================================================================

interface ForestColumnSettings {
  scale: "linear" | "log";
  nullValue: number;
  effects: EffectSpec[];
  axisLabel: string;
  pointCol: string | null;
  lowerCol: string | null;
  upperCol: string | null;
}

/**
 * Extract forest column settings from first forest column.
 * Falls back to sensible defaults if no forest column exists.
 */
function getForestColumnSettings(spec: WebSpec): ForestColumnSettings {
  // Find first forest column
  const allColumns = flattenColumns(spec.columns, undefined);
  const forestColumn = allColumns.find(c => c.type === "forest");

  if (!forestColumn || !forestColumn.options?.forest) {
    // No forest column - return defaults
    return {
      scale: "linear",
      nullValue: 0,
      effects: [],
      axisLabel: "Effect",
      pointCol: null,
      lowerCol: null,
      upperCol: null,
    };
  }

  const opts = forestColumn.options.forest;
  const scale = (opts.scale as "linear" | "log") ?? "linear";

  return {
    scale,
    nullValue: opts.nullValue ?? (scale === "log" ? 1 : 0),
    effects: opts.effects ?? [],
    axisLabel: opts.axisLabel ?? "Effect",
    pointCol: opts.point ?? null,
    lowerCol: opts.lower ?? null,
    upperCol: opts.upper ?? null,
  };
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generate SVG for forest plot export.
 *
 * Supports two layout modes:
 * 1. **Unified layout (new)**: All columns in order, forest columns inline
 *    - Used when precomputedLayout is provided (browser WYSIWYG path)
 *    - Supports multiple forest columns with independent axes
 *
 * 2. **Legacy layout**: left columns | forest | right columns
 *    - Used when no precomputedLayout (R-side export path)
 *    - Single forest area between left/right tables
 */
export function generateSVG(spec: WebSpec, options: ExportOptions = {}): string {
  // Validate input
  validateSpec(spec);

  const theme = spec.theme;
  const padding = theme.spacing.padding;

  // Ensure columns is an array (guard against R serialization issues)
  const columns = Array.isArray(spec.columns) ? spec.columns : [];

  // Get all columns in unified order
  const allColumns = flattenAllColumns(columns);

  // Identify forest columns
  const forestColumnIndices: number[] = [];
  for (let i = 0; i < allColumns.length; i++) {
    if (allColumns[i].type === "forest") {
      forestColumnIndices.push(i);
    }
  }
  const hasForestColumns = forestColumnIndices.length > 0;

  // Identify viz columns (viz_bar, viz_boxplot, viz_violin)
  interface VizColumnInfo {
    index: number;
    type: "viz_bar" | "viz_boxplot" | "viz_violin";
    column: ColumnSpec;
  }
  const vizColumns: VizColumnInfo[] = [];
  for (let i = 0; i < allColumns.length; i++) {
    const col = allColumns[i];
    if (col.type === "viz_bar" || col.type === "viz_boxplot" || col.type === "viz_violin") {
      vizColumns.push({ index: i, type: col.type as VizColumnInfo["type"], column: col });
    }
  }

  // Extract settings from first forest column
  const forestSettings = getForestColumnSettings(spec);
  const layout = computeLayout(spec, options, forestSettings.nullValue);

  // Calculate auto-widths for columns
  const autoWidths = layout.autoWidths;

  // Helper to get column width
  const getColWidth = (col: ColumnSpec): number => {
    if (col.type === "forest") {
      // Forest column width: check autoWidths (from web view) first, then col.width, then options, then layout
      // autoWidths includes the resized width if user manually resized the forest column
      const precomputed = autoWidths.get(col.id);
      if (precomputed !== undefined) return precomputed;
      if (typeof col.width === "number") return col.width;
      return col.options?.forest?.width ?? layout.forestWidth;
    }
    // Viz column widths: check autoWidths first, then col.width, then options width, then layout default
    if (col.type === "viz_bar") {
      const precomputed = autoWidths.get(col.id);
      if (precomputed !== undefined) return precomputed;
      if (typeof col.width === "number") return col.width;
      return col.options?.vizBar?.width ?? layout.forestWidth;
    }
    if (col.type === "viz_boxplot") {
      const precomputed = autoWidths.get(col.id);
      if (precomputed !== undefined) return precomputed;
      if (typeof col.width === "number") return col.width;
      return col.options?.vizBoxplot?.width ?? layout.forestWidth;
    }
    if (col.type === "viz_violin") {
      const precomputed = autoWidths.get(col.id);
      if (precomputed !== undefined) return precomputed;
      if (typeof col.width === "number") return col.width;
      return col.options?.vizViolin?.width ?? layout.forestWidth;
    }
    const autoWidth = autoWidths.get(col.id);
    if (autoWidth !== undefined) return autoWidth;
    return typeof col.width === "number" ? col.width : LAYOUT.DEFAULT_COLUMN_WIDTH;
  };

  // Calculate column positions (unified order)
  const columnPositions: number[] = [];
  let currentX = padding + layout.labelWidth;
  for (const col of allColumns) {
    columnPositions.push(currentX);
    currentX += getColWidth(col);
  }

  // Build SVG
  const parts: string[] = [];

  // SVG opening
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
  width="${layout.totalWidth}" height="${layout.totalHeight}"
  viewBox="0 0 ${layout.totalWidth} ${layout.totalHeight}">
<style>
  text {
    font-variant-numeric: tabular-nums;
  }
  /* Use dominant-baseline for cell text to match CSS flex centering */
  .cell-text { dominant-baseline: central; }
</style>`);

  // Background
  const bgColor = options.backgroundColor ?? theme.colors.background;
  parts.push(`<rect width="100%" height="100%" fill="${bgColor}"/>`);

  // Container border (if enabled in theme)
  // Web CSS: border: var(--wf-container-border, none); border-radius: var(--wf-container-border-radius, 8px);
  if (theme.layout.containerBorder !== false) {
    const borderRadius = theme.layout.containerBorderRadius ?? 8;
    parts.push(`<rect x="0.5" y="0.5"
      width="${layout.totalWidth - 1}" height="${layout.totalHeight - 1}"
      fill="none" stroke="${theme.colors.border}" stroke-width="1"
      rx="${borderRadius}" ry="${borderRadius}"/>`);
  }

  // Header (title, subtitle)
  parts.push(renderHeader(spec, layout, theme));

  // Table separator line (only when title/subtitle area is present, matching web view's .has-header)
  const hasPlotHeader = !!spec.labels?.title || !!spec.labels?.subtitle;
  if (hasPlotHeader) {
    parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
      y1="${layout.mainY}" y2="${layout.mainY}"
      stroke="${theme.colors.border}" stroke-width="2"/>`);
  }

  // Column headers - unified layout
  const headerY = layout.mainY;
  parts.push(renderUnifiedColumnHeaders(
    columns,
    allColumns,
    padding,
    headerY,
    layout.headerHeight,
    theme,
    spec.data.labelHeader ?? "Study",
    layout.labelWidth,
    autoWidths,
    getColWidth
  ));

  // Header border (2px to match web view)
  parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
    y1="${headerY + layout.headerHeight}" y2="${headerY + layout.headerHeight}"
    stroke="${theme.colors.border}" stroke-width="2"/>`);

  // Build display rows
  const displayRows = buildDisplayRows(spec);

  // Pre-compute row positions and heights
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

  const plotY = layout.mainY + layout.headerHeight;

  // Render row backgrounds FIRST - before forest intervals
  // This ensures forest markers aren't covered by background rectangles
  displayRows.forEach((displayRow, i) => {
    if (displayRow.type === "data") {
      const row = displayRow.row;
      const y = plotY + rowPositions[i];
      const rowHeight = rowHeights[i];

      // 1. Explicit row background (style.bg) - highest priority
      if (row.style?.bg) {
        parts.push(`<rect x="${padding}" y="${y}"
          width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
          fill="${row.style.bg}"/>`);
      }
      // 2. Header-type rows get a subtle muted background
      // Web: background: color-mix(in srgb, var(--wf-muted) 10%, var(--wf-bg))
      else if (row.style?.type === "header") {
        // Approximate color-mix with 10% opacity on muted color
        parts.push(`<rect x="${padding}" y="${y}"
          width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
          fill="${theme.colors.muted}" fill-opacity="0.1"/>`);
      }
      // 3. Alternating row banding (if enabled)
      else if (theme.layout.banding) {
        // Styled rows (summary, spacer) are excluded from banding
        const isStyledRow = row.style?.type === "summary" ||
                           row.style?.type === "spacer";

        if (!isStyledRow) {
          const isOddRow = i % 2 === 1;
          const bgColor = isOddRow ? theme.colors.altBg : theme.colors.rowBg;
          // Only render if color differs from background
          if (bgColor !== theme.colors.background) {
            parts.push(`<rect x="${padding}" y="${y}"
              width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
              fill="${bgColor}"/>`);
          }
        }
      }
    }
  });

  // Render each forest column (may be multiple)
  for (const forestColIdx of forestColumnIndices) {
    const forestCol = allColumns[forestColIdx];
    const forestX = columnPositions[forestColIdx];
    const forestWidth = getColWidth(forestCol);
    const forestOpts = forestCol.options?.forest;

    // Get settings for this forest column
    const fcScale = forestOpts?.scale ?? "linear";
    const fcNullValue = forestOpts?.nullValue ?? (fcScale === "log" ? 1 : 0);
    const fcAxisLabel = forestOpts?.axisLabel ?? "Effect";
    const isLog = fcScale === "log";

    // Build effects array - if no explicit effects but forest column has point/lower/upper columns,
    // create a default effect that reads from those columns
    let fcEffects = forestOpts?.effects ?? [];
    const fcPointCol = forestOpts?.point ?? null;
    const fcLowerCol = forestOpts?.lower ?? null;
    const fcUpperCol = forestOpts?.upper ?? null;

    // If forest column specifies custom columns but no effects, create a default effect
    if (fcEffects.length === 0 && (fcPointCol || fcLowerCol || fcUpperCol)) {
      fcEffects = [{
        pointCol: fcPointCol,
        lowerCol: fcLowerCol,
        upperCol: fcUpperCol,
      }];
    }

    // Compute X scale for this forest column
    const fcSettings: ForestColumnSettings = {
      scale: fcScale,
      nullValue: fcNullValue,
      effects: fcEffects,
      axisLabel: fcAxisLabel,
      pointCol: forestOpts?.point ?? null,
      lowerCol: forestOpts?.lower ?? null,
      upperCol: forestOpts?.upper ?? null,
    };
    const { scale: xScale, clipBounds, ticks: baseTicks } = computeXScaleAndClip(spec, forestWidth, fcSettings, options);

    // Reference line (null value)
    const nullX = forestX + xScale(fcNullValue);
    parts.push(renderReferenceLine(
      nullX,
      plotY,
      plotY + layout.plotHeight,
      "dashed",
      theme.colors.muted,
      theme
    ));

    // Custom annotations for this forest column
    const annotations = forestOpts?.annotations ?? [];
    for (const ann of annotations) {
      if (ann.type === "reference_line") {
        const annX = forestX + xScale(ann.x);
        parts.push(renderReferenceLine(
          annX,
          plotY,
          plotY + layout.plotHeight,
          ann.style,
          ann.color ?? theme.colors.accent,
          theme,
          ann.label,
          ann.width ?? 1,
          ann.opacity ?? 0.6
        ));
      }
    }

    // Also check top-level annotations
    const topAnnotations = Array.isArray(spec.annotations) ? spec.annotations : [];
    for (const ann of topAnnotations) {
      if (ann.type === "reference_line") {
        const annX = forestX + xScale(ann.x);
        parts.push(renderReferenceLine(
          annX,
          plotY,
          plotY + layout.plotHeight,
          ann.style,
          ann.color ?? theme.colors.accent,
          theme,
          ann.label,
          ann.width ?? 1,
          ann.opacity ?? 0.6
        ));
      }
    }

    // Row intervals
    displayRows.forEach((displayRow, i) => {
      if (displayRow.type === "data") {
        const yPos = plotY + rowPositions[i] + rowHeights[i] / 2;
        parts.push(renderInterval(
          displayRow.row,
          yPos,
          (v) => forestX + xScale(v),
          theme,
          fcNullValue,
          fcEffects,
          spec.data.weightCol,
          forestX,
          forestWidth,
          clipBounds,
          isLog
        ));
      }
    });

    // Overall summary diamond
    if (spec.data.overall && layout.showOverallSummary &&
        typeof spec.data.overall.point === "number" && !Number.isNaN(spec.data.overall.point) &&
        typeof spec.data.overall.lower === "number" && !Number.isNaN(spec.data.overall.lower) &&
        typeof spec.data.overall.upper === "number" && !Number.isNaN(spec.data.overall.upper)) {
      const diamondY = plotY + layout.summaryYPosition;
      parts.push(renderDiamond(
        spec.data.overall.point,
        spec.data.overall.lower,
        spec.data.overall.upper,
        diamondY,
        xScale,
        forestX,
        forestWidth,
        theme
      ));
    }

    // Axis
    parts.push(renderForestAxis(xScale, layout, theme, fcAxisLabel, forestX, forestWidth, fcNullValue, baseTicks));
  }

  // Render viz columns (viz_bar, viz_boxplot, viz_violin)
  const allDataRows = spec.data.rows;
  for (const vizColInfo of vizColumns) {
    const col = vizColInfo.column;
    const vizX = columnPositions[vizColInfo.index];
    const vizWidth = getColWidth(col);

    if (vizColInfo.type === "viz_bar") {
      const opts = col.options?.vizBar as VizBarColumnOptions | undefined;
      if (!opts) continue;

      // Compute shared scale for all rows
      const xScale = computeVizBarScale(allDataRows, opts, vizWidth);

      // Render bars for each data row
      displayRows.forEach((displayRow, i) => {
        if (displayRow.type === "data") {
          const yPos = plotY + rowPositions[i] + rowHeights[i] / 2;
          const rowH = rowHeights[i];
          parts.push(renderVizBar(
            displayRow.row,
            yPos,
            rowH,
            vizX,
            vizWidth,
            opts,
            xScale,
            theme
          ));
        }
      });

      // Render axis if showAxis is enabled
      if (opts.showAxis !== false) {
        parts.push(`<g transform="translate(0, ${plotY + layout.plotHeight})">`);
        parts.push(renderVizAxis(xScale, layout, theme, opts.axisLabel, vizX, vizWidth, opts.nullValue));
        parts.push("</g>");
      }
    } else if (vizColInfo.type === "viz_boxplot") {
      const opts = col.options?.vizBoxplot as VizBoxplotColumnOptions | undefined;
      if (!opts) continue;

      // Compute shared scale for all rows
      const xScale = computeVizBoxplotScale(allDataRows, opts, vizWidth);

      // Render boxplots for each data row
      displayRows.forEach((displayRow, i) => {
        if (displayRow.type === "data") {
          const yPos = plotY + rowPositions[i] + rowHeights[i] / 2;
          const rowH = rowHeights[i];
          parts.push(renderVizBoxplot(
            displayRow.row,
            yPos,
            rowH,
            vizX,
            vizWidth,
            opts,
            xScale,
            theme
          ));
        }
      });

      // Render axis if showAxis is enabled
      if (opts.showAxis !== false) {
        parts.push(`<g transform="translate(0, ${plotY + layout.plotHeight})">`);
        parts.push(renderVizAxis(xScale, layout, theme, opts.axisLabel, vizX, vizWidth, opts.nullValue));
        parts.push("</g>");
      }
    } else if (vizColInfo.type === "viz_violin") {
      const opts = col.options?.vizViolin as VizViolinColumnOptions | undefined;
      if (!opts) continue;

      // Compute shared scale for all rows
      const xScale = computeVizViolinScale(allDataRows, opts, vizWidth);

      // Render violins for each data row
      displayRows.forEach((displayRow, i) => {
        if (displayRow.type === "data") {
          const yPos = plotY + rowPositions[i] + rowHeights[i] / 2;
          const rowH = rowHeights[i];
          parts.push(renderVizViolin(
            displayRow.row,
            yPos,
            rowH,
            vizX,
            vizWidth,
            opts,
            xScale,
            theme
          ));
        }
      });

      // Render axis if showAxis is enabled
      if (opts.showAxis !== false) {
        parts.push(`<g transform="translate(0, ${plotY + layout.plotHeight})">`);
        parts.push(renderVizAxis(xScale, layout, theme, opts.axisLabel, vizX, vizWidth, opts.nullValue));
        parts.push("</g>");
      }
    }
  }

  // Table rows - unified column rendering
  const rowsY = layout.mainY + layout.headerHeight;

  // Compute bar max values from all data rows for proper scaling
  const barMaxValues = computeBarMaxValues(allDataRows, allColumns);

  displayRows.forEach((displayRow, i) => {
    const y = rowsY + rowPositions[i];
    const rowHeight = rowHeights[i];

    if (displayRow.type === "group_header") {
      // Render group header
      parts.push(renderGroupHeader(
        displayRow.label,
        displayRow.depth,
        displayRow.rowCount,
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

      // Note: Row banding is rendered earlier (before forest intervals) to avoid covering markers

      // Skip content rendering for spacer rows (they're invisible in web view)
      if (isSpacerRow) {
        // Spacer rows don't render content - just occupy space
        // The row height is already half-height from earlier calculation
      } else {
        // Render unified row (label + all columns in order)
        parts.push(renderUnifiedTableRow(
          row,
          allColumns,
          padding,
          y,
          rowHeight,
          theme,
          layout.labelWidth,
          depth,
          barMaxValues,
          autoWidths,
          getColWidth,
          columnPositions
        ));
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
