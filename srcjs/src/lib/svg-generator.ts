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
  ROW_ODD_OPACITY,
  GROUP_HEADER_OPACITY,
  getDepthOpacity,
} from "./rendering-constants";

// ============================================================================
// Export Options
// ============================================================================

export interface ExportOptions {
  width?: number;
  height?: number;
  scale?: number;
  backgroundColor?: string;
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
  const displayRowCount = displayRows.length;
  const hasOverall = !!spec.data.overall;

  const plotHeight = displayRowCount * rowHeight +
    (hasOverall ? rowHeight * RENDERING.OVERALL_ROW_HEIGHT_MULTIPLIER : 0);

  // Column widths - use the column definitions to compute total width
  const leftColumns = flattenColumns(columns, "left");
  const rightColumns = flattenColumns(columns, "right");

  const leftTableWidth = LAYOUT.DEFAULT_LABEL_WIDTH +
    leftColumns.reduce((sum, c) => sum + (typeof c.width === 'number' ? c.width : LAYOUT.DEFAULT_COLUMN_WIDTH), 0);
  const rightTableWidth =
    rightColumns.reduce((sum, c) => sum + (typeof c.width === 'number' ? c.width : LAYOUT.DEFAULT_COLUMN_WIDTH), 0);

  // Forest width calculation - "tables first" approach
  const baseWidth = options.width ?? LAYOUT.DEFAULT_WIDTH;
  const includeForest = spec.data.includeForest;
  const totalTableWidth = leftTableWidth + rightTableWidth;

  // Calculate forest width based on remaining space after tables, or explicit layout settings
  let forestWidth: number;
  if (!includeForest) {
    forestWidth = 0;
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

  const result: DisplayRow[] = [];

  // Recursive function to output a group and its descendants
  function outputGroup(groupId: string | null) {
    if (groupId) {
      const group = groupMap.get(groupId);
      if (!group) return;

      const rowCount = rowsByGroup.get(groupId)?.length ?? 0;
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

/** Get leaf columns from a single column def (for colspan calculation) */
function getLeafColumns(col: ColumnDef): ColumnSpec[] {
  if (!col.isGroup) return [col];
  const result: ColumnSpec[] = [];
  for (const sub of col.columns) {
    result.push(...getLeafColumns(sub));
  }
  return result;
}

/** Calculate total width for a column def (including children if group) */
function getColumnDefWidth(col: ColumnDef, defaultWidth: number): number {
  if (!col.isGroup) return typeof col.width === 'number' ? col.width : defaultWidth;
  return col.columns.reduce((sum, c) => sum + getColumnDefWidth(c, defaultWidth), 0);
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
 * Uses rough character width estimation for proportional fonts
 */
function truncateText(text: string, maxWidth: number, fontSize: number, padding: number = 0): string {
  const avgCharWidth = fontSize * 0.55; // Rough estimate
  const availableWidth = maxWidth - padding * 2;
  const maxChars = Math.floor(availableWidth / avgCharWidth);

  if (text.length <= maxChars) {
    return text;
  }
  // Truncate with ellipsis
  return text.slice(0, maxChars - 1) + "…";
}

/** Format number for display - respects column options */
function formatNumber(value: number | undefined | null, options?: ColumnOptions): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return options?.naText ?? "";
  }

  // Percent formatting
  if (options?.percent) {
    const { decimals = 1, multiply = false, symbol = true } = options.percent;
    const displayValue = multiply ? value * 100 : value;
    const formatted = displayValue.toFixed(decimals);
    return symbol ? `${formatted}%` : formatted;
  }

  // Numeric formatting with decimals
  const decimals = options?.numeric?.decimals;
  if (decimals !== undefined) {
    return value.toFixed(decimals);
  }

  // Default behavior: integers show no decimals, others show 2
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 0.0001) {
    return Math.round(value).toString();
  }
  return value.toFixed(2);
}

/** Format events column (events/n) */
function formatEvents(row: Row, options: ColumnOptions): string {
  const { eventsField, nField, separator = "/", showPct = false } = options.events!;
  const events = row.metadata[eventsField];
  const n = row.metadata[nField];

  if (events === undefined || events === null || n === undefined || n === null) {
    return options.naText ?? "";
  }

  const eventsNum = Number(events);
  const nNum = Number(n);
  let result = `${eventsNum}${separator}${nNum}`;

  if (showPct && nNum > 0) {
    const pct = ((eventsNum / nNum) * 100).toFixed(1);
    result += ` (${pct}%)`;
  }

  return result;
}

/** Format interval for display */
function formatInterval(point?: number, lower?: number, upper?: number): string {
  if (point === undefined || point === null || Number.isNaN(point)) return "";
  if (lower === undefined || lower === null || upper === undefined || upper === null ||
      Number.isNaN(lower) || Number.isNaN(upper)) {
    return formatNumber(point);
  }
  return `${point.toFixed(2)} (${lower.toFixed(2)}, ${upper.toFixed(2)})`;
}

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

function computeXScale(spec: WebSpec, forestWidth: number): Scale {
  const rows = spec.data.rows;
  const axisConfig = spec.theme.axis;
  const isLog = spec.data.scale === "log";

  // Guard against R serialization returning {} instead of null for missing values
  const hasExplicitMin = typeof axisConfig?.rangeMin === "number";
  const hasExplicitMax = typeof axisConfig?.rangeMax === "number";

  let domain: [number, number];

  if (hasExplicitMin && hasExplicitMax) {
    domain = [axisConfig.rangeMin!, axisConfig.rangeMax!];
  } else {
    const allValues = rows
      .flatMap((r) => [r.lower, r.upper])
      .filter((v) => v != null && !Number.isNaN(v) && Number.isFinite(v));

    if (allValues.length === 0) {
      domain = isLog ? [0.1, 10] : [0, 1];
    } else {
      const [minVal, maxVal] = [Math.min(...allValues), Math.max(...allValues)];
      const range = maxVal - minVal || 1;
      domain = [
        hasExplicitMin ? axisConfig.rangeMin! : minVal - range * DOMAIN_PADDING,
        hasExplicitMax ? axisConfig.rangeMax! : maxVal + range * DOMAIN_PADDING,
      ];
    }
  }

  // Apply nice rounding to domain (matches D3's .nice() behavior)
  const nicedDomain = niceDomain(domain, isLog);

  if (isLog) {
    return createLogScale(
      [Math.max(nicedDomain[0], 0.01), Math.max(nicedDomain[1], 0.02)],
      [0, forestWidth]
    );
  }

  return createLinearScale(nicedDomain, [0, forestWidth]);
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
  labelWidth?: number
): string {
  const lines: string[] = [];
  const fontSize = parseFontSize(theme.typography.fontSizeSm);
  const fontWeight = theme.typography.fontWeightMedium;
  const boldWeight = theme.typography.fontWeightBold;
  const hasGroups = hasColumnGroups(columnDefs);
  const defaultColWidth = LAYOUT.DEFAULT_COLUMN_WIDTH;
  const actualLabelWidth = labelWidth ?? LAYOUT.DEFAULT_LABEL_WIDTH;

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
      // Vertical divider for label column
      lines.push(`<line x1="${currentX + actualLabelWidth}" x2="${currentX + actualLabelWidth}"
        y1="${y}" y2="${y + headerHeight}"
        stroke="${theme.colors.border}" stroke-width="1" opacity="0.3"/>`);
      currentX += actualLabelWidth;
    }

    // Row 1: Group headers and non-grouped column headers
    for (const col of columnDefs) {
      if (col.isGroup) {
        // Group header spans its children
        const groupWidth = getColumnDefWidth(col, defaultColWidth);
        const textX = currentX + groupWidth / 2;
        lines.push(`<text x="${textX}" y="${getTextY(y, row1Height)}"
          font-family="${theme.typography.fontFamily}"
          font-size="${fontSize}px"
          font-weight="${boldWeight}"
          text-anchor="middle"
          fill="${theme.colors.foreground}">${escapeXml(col.header)}</text>`);
        // Border under group header
        lines.push(`<line x1="${currentX}" x2="${currentX + groupWidth}"
          y1="${y + row1Height}" y2="${y + row1Height}"
          stroke="${theme.colors.border}" stroke-width="1" opacity="0.5"/>`);
        currentX += groupWidth;
      } else {
        // Non-grouped column spans both rows
        const width = typeof col.width === 'number' ? col.width : defaultColWidth;
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

    // Row 2: Sub-column headers (under groups)
    currentX = x + (labelHeader ? actualLabelWidth : 0);
    for (const col of columnDefs) {
      if (col.isGroup) {
        // Render sub-column headers
        for (const subCol of col.columns) {
          if (!subCol.isGroup) {
            const width = typeof subCol.width === 'number' ? subCol.width : defaultColWidth;
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
        const width = typeof col.width === 'number' ? col.width : defaultColWidth;
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
      const width = typeof col.width === 'number' ? col.width : defaultColWidth;
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
  const fontSize = parseFontSize(theme.typography.fontSizeBase);
  const textY = y + rowHeight / 2 + fontSize * TYPOGRAPHY.TEXT_BASELINE_ADJUSTMENT;
  const indent = depth * SPACING.INDENT_PER_LEVEL;

  // Group header background - uses shared GROUP_HEADER_OPACITY constant
  lines.push(`<rect x="${x}" y="${y}"
    width="${totalWidth}" height="${rowHeight}"
    fill="${theme.colors.primary}" opacity="${GROUP_HEADER_OPACITY}"/>`);

  // Group header text (bold)
  lines.push(`<text x="${x + SPACING.TEXT_PADDING + indent}" y="${textY}"
    font-family="${theme.typography.fontFamily}"
    font-size="${fontSize}px"
    font-weight="${theme.typography.fontWeightBold}"
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
  barMaxValues?: Map<string, number>
): string {
  const lines: string[] = [];
  const fontSize = parseFontSize(theme.typography.fontSizeBase);
  const textY = y + rowHeight / 2 + fontSize * TYPOGRAPHY.TEXT_BASELINE_ADJUSTMENT;
  let currentX = x;

  // Label
  if (includeLabel) {
    // Use depth for indentation (overrides row.style.indent for grouped rows)
    const indent = depth * SPACING.INDENT_PER_LEVEL + (row.style?.indent ?? 0) * SPACING.INDENT_PER_LEVEL;
    const fontWeight = row.style?.bold ? theme.typography.fontWeightBold : theme.typography.fontWeightNormal;
    const fontStyle = row.style?.italic ? "italic" : "normal";

    // Truncate label if too long for column width
    const availableLabelWidth = labelWidth - indent - SPACING.TEXT_PADDING * 2;
    const truncatedLabel = truncateText(row.label, availableLabelWidth, fontSize, 0);

    lines.push(`<text x="${currentX + SPACING.TEXT_PADDING + indent}" y="${textY}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${fontWeight}"
      font-style="${fontStyle}"
      fill="${row.style?.color ?? theme.colors.foreground}">${escapeXml(truncatedLabel)}</text>`);

    // Badge (if present)
    if (row.style?.badge) {
      const badgeText = String(row.style.badge);
      const badgeFontSize = fontSize * 0.8;
      const badgePadding = 4;
      const badgeHeight = badgeFontSize + badgePadding * 2;
      // Estimate label text width (rough approximation)
      const labelTextWidth = row.label.length * fontSize * 0.55;
      const badgeX = currentX + SPACING.TEXT_PADDING + indent + labelTextWidth + 6;
      const badgeTextWidth = badgeText.length * badgeFontSize * 0.6;
      const badgeWidth = badgeTextWidth + badgePadding * 2;
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
    const width = typeof col.width === 'number' ? col.width : LAYOUT.DEFAULT_COLUMN_WIDTH;
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
    return formatInterval(row.point, row.lower, row.upper);
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
    const stars = col.options?.pvalue?.stars;
    const thresholds = col.options?.pvalue?.thresholds ?? [0.05, 0.01, 0.001];
    let starStr = "";
    if (stars) {
      if (val < thresholds[2]) starStr = "***";
      else if (val < thresholds[1]) starStr = "**";
      else if (val < thresholds[0]) starStr = "*";
    }
    return val < 0.001 ? `<0.001${starStr}` : `${val.toFixed(3)}${starStr}`;
  }
  const val = row.metadata[col.field];
  return val !== undefined && val !== null ? String(val) : (col.options?.naText ?? "");
}

function renderSparklinePath(data: number[], x: number, y: number, width: number, height: number): string {
  if (data.length === 0) return "";

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const px = x + (i / (data.length - 1)) * width;
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
  weightCol?: string | null
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

    // Color priority: row.markerStyle (primary) > effect > theme.colors.interval
    let color: string;
    if (isPrimary && markerStyle?.color) {
      color = markerStyle.color;
    } else if (effect.color) {
      color = effect.color;
    } else {
      color = theme.colors.interval ?? theme.colors.primary ?? "#2563eb";
    }

    // Shape priority: row.markerStyle (primary) > effect > default square
    let shape: MarkerShape;
    if (isPrimary && markerStyle?.shape) {
      shape = markerStyle.shape;
    } else if (effect.shape) {
      shape = effect.shape;
    } else {
      shape = "square";
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
      parts.push(`
        <g class="interval effect-${idx}">
          <line x1="${x1}" x2="${x2}" y1="${effectY}" y2="${effectY}"
            stroke="${lineColor}" stroke-width="${lineWidth}"/>
          <line x1="${x1}" x2="${x1}" y1="${effectY - whiskerHalf}" y2="${effectY + whiskerHalf}"
            stroke="${lineColor}" stroke-width="${lineWidth}"/>
          <line x1="${x2}" x2="${x2}" y1="${effectY - whiskerHalf}" y2="${effectY + whiskerHalf}"
            stroke="${lineColor}" stroke-width="${lineWidth}"/>
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

  // Compute raw scale positions (0 to forestWidth), then clamp to visible area
  const rawL = xScale(lower);
  const rawP = xScale(point);
  const rawU = xScale(upper);

  // Clamp to visible forest area (0 to forestWidth), then add forestX offset
  const xL = forestX + Math.max(0, Math.min(forestWidth, rawL));
  const xP = forestX + Math.max(0, Math.min(forestWidth, rawP));
  const xU = forestX + Math.max(0, Math.min(forestWidth, rawU));

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
  forestX: number
): string {
  const lines: string[] = [];
  // Guard against R serialization returning {} instead of null
  const tickCount = typeof theme.axis.tickCount === "number"
    ? theme.axis.tickCount
    : SPACING.DEFAULT_TICK_COUNT;
  const ticks = Array.isArray(theme.axis.tickValues) ? theme.axis.tickValues : xScale.ticks(tickCount);
  const fontSize = parseFontSize(theme.typography.fontSizeSm);

  // Axis line
  lines.push(`<line x1="${forestX}" x2="${forestX + layout.forestWidth}"
    y1="0" y2="0" stroke="${theme.colors.border}" stroke-width="1"/>`);

  // Ticks and labels
  for (const tick of ticks) {
    const x = forestX + xScale(tick);
    lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="4"
      stroke="${theme.colors.border}" stroke-width="1"/>`);
    lines.push(`<text x="${x}" y="16" text-anchor="middle"
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

function renderReferenceLine(
  x: number,
  y1: number,
  y2: number,
  style: "solid" | "dashed" | "dotted",
  color: string,
  label?: string
): string {
  const dashArray = style === "dashed" ? "6,4" : style === "dotted" ? "2,2" : "none";
  let svg = `<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"
    stroke="${color}" stroke-width="1" stroke-dasharray="${dashArray}"/>`;

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

  const leftTableWidth = LAYOUT.DEFAULT_LABEL_WIDTH +
    leftColumns.reduce((sum, c) => sum + (typeof c.width === 'number' ? c.width : LAYOUT.DEFAULT_COLUMN_WIDTH), 0);

  // Forest position
  const forestX = padding + leftTableWidth;
  const xScale = computeXScale(spec, layout.forestWidth);

  // Right table position
  const rightTableX = forestX + layout.forestWidth;

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
    LAYOUT.DEFAULT_LABEL_WIDTH
  ));
  if (rightColumns.length > 0) {
    parts.push(renderColumnHeaders(
      rightColumnDefs,
      rightColumns,
      rightTableX,
      headerY,
      layout.headerHeight,
      theme
    ));
  }

  // Header border
  parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
    y1="${headerY + layout.headerHeight}" y2="${headerY + layout.headerHeight}"
    stroke="${theme.colors.border}" stroke-width="1"/>`);

  // Build display rows (used for both forest intervals and table rendering)
  const displayRows = buildDisplayRows(spec);

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
          ann.label
        ));
      }
    }

    // Row intervals (only render for data rows, skip group headers)
    displayRows.forEach((displayRow, i) => {
      if (displayRow.type === "data") {
        const yPos = plotY + i * layout.rowHeight + layout.rowHeight / 2;
        parts.push(renderInterval(displayRow.row, yPos, (v) => forestX + xScale(v), theme, spec.data.nullValue, spec.data.effects, spec.data.weightCol));
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
    parts.push(renderAxis(xScale, layout, theme, spec.data.axisLabel, forestX));
  }

  // Table rows (uses display rows to interleave group headers with data)
  const rowsY = layout.mainY + layout.headerHeight;

  // Compute bar max values from all data rows for proper scaling
  const allDataRows = spec.data.rows;
  const leftBarMaxValues = computeBarMaxValues(allDataRows, leftColumns);
  const rightBarMaxValues = computeBarMaxValues(allDataRows, rightColumns);

  displayRows.forEach((displayRow, i) => {
    const y = rowsY + i * layout.rowHeight;

    if (displayRow.type === "group_header") {
      // Render group header
      parts.push(renderGroupHeader(
        displayRow.label,
        displayRow.depth,
        padding,
        y,
        layout.rowHeight,
        layout.totalWidth - padding * 2,
        theme
      ));
    } else {
      // Render data row
      const row = displayRow.row;
      const depth = displayRow.depth;

      // Row background - depth-based or alternating (uses shared constants)
      const depthOpacity = getDepthOpacity(depth);
      const oddOpacity = i % 2 === 1 ? ROW_ODD_OPACITY : 0;
      const bgOpacity = Math.max(depthOpacity, oddOpacity);

      if (bgOpacity > 0) {
        parts.push(`<rect x="${padding}" y="${y}"
          width="${layout.totalWidth - padding * 2}" height="${layout.rowHeight}"
          fill="${theme.colors.muted}" opacity="${bgOpacity}"/>`);
      }

      // Left table
      parts.push(renderTableRow(row, leftColumns, padding, y, layout.rowHeight, theme, true, LAYOUT.DEFAULT_LABEL_WIDTH, depth, leftBarMaxValues));

      // Right table
      if (rightColumns.length > 0) {
        parts.push(renderTableRow(row, rightColumns, rightTableX, y, layout.rowHeight, theme, false, 0, depth, rightBarMaxValues));
      }
    }

    // Row border
    parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
      y1="${y + layout.rowHeight}" y2="${y + layout.rowHeight}"
      stroke="${theme.colors.border}" stroke-width="1" opacity="0.5"/>`);
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
