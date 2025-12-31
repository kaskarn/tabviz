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
  ComputedLayout,
} from "$types";
import { niceDomain, DOMAIN_PADDING } from "./scale-utils";

// ============================================================================
// Constants
// ============================================================================

/** Layout constants */
const LAYOUT = {
  /** Default column width when not specified */
  DEFAULT_COLUMN_WIDTH: 80,
  /** Default label column width */
  DEFAULT_LABEL_WIDTH: 150,
  /** Height of the axis area (line + ticks) */
  AXIS_HEIGHT: 32,
  /** Height for axis label text below axis */
  AXIS_LABEL_HEIGHT: 20,
  /** Bottom margin buffer */
  BOTTOM_MARGIN: 16,
  /** Minimum forest plot width when auto-calculated */
  MIN_FOREST_WIDTH: 200,
  /** Default width when not specified */
  DEFAULT_WIDTH: 800,
  /** Gap between columns and forest plot */
  COLUMN_GAP: 16,
} as const;

/** Typography constants */
const TYPOGRAPHY = {
  /** Title height in pixels */
  TITLE_HEIGHT: 28,
  /** Subtitle height in pixels */
  SUBTITLE_HEIGHT: 20,
  /** Caption height in pixels */
  CAPTION_HEIGHT: 16,
  /** Footnote height in pixels */
  FOOTNOTE_HEIGHT: 14,
  /** Default font size fallback */
  DEFAULT_FONT_SIZE: 14,
  /** Base rem size for font calculations */
  REM_BASE: 16,
  /** Vertical text centering adjustment (fraction of font size) */
  TEXT_BASELINE_ADJUSTMENT: 1 / 3,
} as const;

/** Spacing constants */
const SPACING = {
  /** Text padding from edges */
  TEXT_PADDING: 10,
  /** Indent multiplier per level */
  INDENT_PER_LEVEL: 12,
  /** Whisker half-height */
  WHISKER_HALF_HEIGHT: 4,
  /** Default tick count for axis */
  DEFAULT_TICK_COUNT: 5,
} as const;

/** Rendering constants */
const RENDERING = {
  /** Multiplier for header height when column groups present */
  GROUP_HEADER_HEIGHT_MULTIPLIER: 1.5,
  /** Multiplier for overall summary row height */
  OVERALL_ROW_HEIGHT_MULTIPLIER: 1.5,
  /** Forest width as fraction of total when auto-calculated */
  AUTO_FOREST_WIDTH_FRACTION: 0.25,
} as const;

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
    leftColumns.reduce((sum, c) => sum + (c.width ?? LAYOUT.DEFAULT_COLUMN_WIDTH), 0);
  const rightTableWidth =
    rightColumns.reduce((sum, c) => sum + (c.width ?? LAYOUT.DEFAULT_COLUMN_WIDTH), 0);

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

  // Total width: expand if forest needs more space than available
  const neededWidth = padding * 2 + totalTableWidth + forestWidth + LAYOUT.COLUMN_GAP * 2;
  const totalWidth = options.width ?? Math.max(baseWidth, neededWidth);

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
  if (!col.isGroup) return col.width ?? defaultWidth;
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

/** Format number for display - integers show no decimals, others show 2 */
function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "";
  // If it's an integer (or very close to one), don't show decimals
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 0.0001) {
    return Math.round(value).toString();
  }
  return value.toFixed(2);
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
        const width = col.width ?? defaultColWidth;
        const { textX, anchor } = getTextPosition(currentX, width, col.align);
        lines.push(`<text x="${textX}" y="${getTextY(y, headerHeight)}"
          font-family="${theme.typography.fontFamily}"
          font-size="${fontSize}px"
          font-weight="${fontWeight}"
          text-anchor="${anchor}"
          fill="${theme.colors.foreground}">${escapeXml(col.header)}</text>`);
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
            const width = subCol.width ?? defaultColWidth;
            const { textX, anchor } = getTextPosition(currentX, width, subCol.align);
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
        currentX += col.width ?? defaultColWidth;
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
      const width = col.width ?? defaultColWidth;
      const { textX, anchor } = getTextPosition(currentX, width, col.align);

      lines.push(`<text x="${textX}" y="${getTextY(y, headerHeight)}"
        font-family="${theme.typography.fontFamily}"
        font-size="${fontSize}px"
        font-weight="${fontWeight}"
        text-anchor="${anchor}"
        fill="${theme.colors.foreground}">${escapeXml(col.header)}</text>`);
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

  // Group header background
  lines.push(`<rect x="${x}" y="${y}"
    width="${totalWidth}" height="${rowHeight}"
    fill="${theme.colors.muted}" opacity="0.15"/>`);

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

    lines.push(`<text x="${currentX + SPACING.TEXT_PADDING + indent}" y="${textY}"
      font-family="${theme.typography.fontFamily}"
      font-size="${fontSize}px"
      font-weight="${fontWeight}"
      font-style="${fontStyle}"
      fill="${row.style?.color ?? theme.colors.foreground}">${escapeXml(row.label)}</text>`);
    currentX += labelWidth;
  }

  // Columns
  for (const col of columns) {
    const width = col.width ?? LAYOUT.DEFAULT_COLUMN_WIDTH;
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
      const data = row.metadata[col.field] as number[];
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
    return typeof val === "number" ? formatNumber(val) : "";
  }
  if (col.type === "pvalue") {
    const val = row.metadata[col.field];
    if (typeof val !== "number") return "";
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
  return val !== undefined && val !== null ? String(val) : "";
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

function renderInterval(
  row: Row,
  yPosition: number,
  xScale: Scale,
  theme: WebTheme,
  nullValue: number
): string {
  // Skip rows without valid values
  if (row.point == null || Number.isNaN(row.point) ||
      row.lower == null || Number.isNaN(row.lower) ||
      row.upper == null || Number.isNaN(row.upper)) {
    return "";
  }

  const x1 = xScale(row.lower);
  const x2 = xScale(row.upper);
  const cx = xScale(row.point);

  const baseSize = theme.shapes.pointSize;
  const weight = row.metadata.weight as number | undefined;
  let pointSize = baseSize;
  if (weight) {
    const scale = 0.5 + Math.sqrt(weight / 100) * 1.5;
    pointSize = Math.min(Math.max(baseSize * scale, 3), baseSize * 2.5);
  }

  const pointColor = row.point > nullValue
    ? theme.colors.intervalPositive
    : row.point < nullValue
      ? theme.colors.intervalNegative
      : theme.colors.muted;

  const lineWidth = theme.shapes.lineWidth;
  const lineColor = theme.colors.intervalLine;

  const whiskerHalf = SPACING.WHISKER_HALF_HEIGHT;

  return `
    <g class="interval">
      <!-- CI line -->
      <line x1="${x1}" x2="${x2}" y1="${yPosition}" y2="${yPosition}"
        stroke="${lineColor}" stroke-width="${lineWidth}"/>
      <!-- Whiskers -->
      <line x1="${x1}" x2="${x1}" y1="${yPosition - whiskerHalf}" y2="${yPosition + whiskerHalf}"
        stroke="${lineColor}" stroke-width="${lineWidth}"/>
      <line x1="${x2}" x2="${x2}" y1="${yPosition - whiskerHalf}" y2="${yPosition + whiskerHalf}"
        stroke="${lineColor}" stroke-width="${lineWidth}"/>
      <!-- Point -->
      <rect x="${cx - pointSize}" y="${yPosition - pointSize}"
        width="${pointSize * 2}" height="${pointSize * 2}" fill="${pointColor}"/>
    </g>`;
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
    leftColumns.reduce((sum, c) => sum + (c.width ?? LAYOUT.DEFAULT_COLUMN_WIDTH), 0);

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
        parts.push(renderInterval(displayRow.row, yPos, (v) => forestX + xScale(v), theme, spec.data.nullValue));
      }
    });

    // Overall summary diamond
    if (spec.data.overall && layout.showOverallSummary) {
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

      // Row background (alternating for data rows)
      if (i % 2 === 1) {
        parts.push(`<rect x="${padding}" y="${y}"
          width="${layout.totalWidth - padding * 2}" height="${layout.rowHeight}"
          fill="${theme.colors.muted}" opacity="0.1"/>`);
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
