/**
 * Width calculation utilities for column auto-sizing.
 *
 * This module provides shared utilities for calculating column widths in forest plots.
 * It is used by both the web view (forestStore.svelte.ts) and SVG generator (svg-generator.ts)
 * to ensure visual consistency between renderers.
 *
 * === KEY FUNCTIONS ===
 *
 * - estimateTextWidth(): Character-class text width approximation (for SVG/non-browser)
 * - measureTextWidthCanvas(): Accurate canvas-based measurement (browser only)
 * - calculateColumnAutoWidth(): Measures a single column's content
 * - calculateAllAutoWidths(): Measures all auto-width columns
 * - calculateLabelColumnWidth(): Measures label column including badges and group headers
 * - flattenColumns(): Utility to get leaf columns from nested groups
 * - getEffectiveColumnWidth(): Get computed or explicit column width
 *
 * === TEXT WIDTH ESTIMATION ===
 *
 * The estimateTextWidth() function uses character-class width multipliers:
 * - Very narrow: superscripts (×0.3)
 * - Narrow: i, l, 1, punctuation, space (×0.35)
 * - Math operators: ×, − (×0.5)
 * - Wide: m, w, M, W, @, % (×0.85)
 * - Digits: 0-9 (×0.6, tabular width)
 * - Normal: everything else (×0.55)
 *
 * === USAGE ===
 *
 * The forestStore uses canvas measurement when available (more accurate),
 * while the SVG generator uses estimateTextWidth() since it runs in a
 * DOM-free environment (R's V8 engine).
 *
 * See rendering-constants.ts for detailed documentation of the width
 * calculation algorithm and constants.
 */

import type { ColumnSpec, Row, ColumnOptions, Group } from "../types";
import { getColumnDisplayText } from "./formatters";
import { AUTO_WIDTH, SPACING, GROUP_HEADER, TEXT_MEASUREMENT, BADGE } from "./rendering-constants";

// ============================================================================
// Text Width Measurement
// ============================================================================

/**
 * Estimate text width using character-based approximation.
 * Used when canvas measurement is not available (e.g., SVG generation).
 *
 * This uses font-specific average character widths rather than a single multiplier.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  // Character width categories (proportions of fontSize):
  // Very narrow: superscript/subscript characters (0.3)
  // Narrow: i, l, I, 1, punctuation, space (0.35)
  // Math operators: ×, − (0.5)
  // Normal lowercase: a-z except i,l,m,w (0.55)
  // Digits: 0-9 tabular (0.6)
  // Uppercase: A-Z except I,M,W (0.68) - capitals are wider than lowercase
  // Wide: m, w, M, W, @, % (0.85)
  const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻";
  const NARROW = "ilI1.,;:|!()[]{}' -";
  const WIDE = "mwMW@%";
  const UPPERCASE = "ABCDEFGHJKLNOPQRSTUVXYZ"; // excluding I, M, W (handled separately)

  let width = 0;
  for (const char of text) {
    if (SUPERSCRIPTS.includes(char)) {
      width += fontSize * 0.3;
    } else if (NARROW.includes(char)) {
      width += fontSize * 0.35;
    } else if ("×−".includes(char)) {
      width += fontSize * 0.5;
    } else if (WIDE.includes(char)) {
      width += fontSize * 0.85;
    } else if (char >= "0" && char <= "9") {
      width += fontSize * 0.6;
    } else if (UPPERCASE.includes(char)) {
      // Uppercase letters are wider than lowercase
      width += fontSize * 0.68;
    } else {
      // Lowercase and other characters
      width += fontSize * 0.55;
    }
  }
  return width;
}

/**
 * Measure text width using canvas (browser only).
 * Returns null if canvas is not available.
 */
export function measureTextWidthCanvas(
  text: string,
  fontSize: string,
  fontFamily: string,
  fontWeight: number = 400
): number | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Canvas font syntax: "[font-weight] [font-size] [font-family]"
  ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
  return ctx.measureText(text).width;
}

// ============================================================================
// Column Width Calculation
// ============================================================================

export interface AutoWidthOptions {
  fontSize: string;      // e.g., "14px"
  fontFamily: string;    // e.g., "Inter, system-ui, sans-serif"
  useCanvas?: boolean;   // Whether to use canvas measurement (browser only)
  cellPadding?: number;  // Horizontal cell padding (both sides) - defaults to 20 (10px * 2)
}

/**
 * Calculate the auto-width for a single column based on header and all data values.
 */
export function calculateColumnAutoWidth(
  col: ColumnSpec,
  rows: Row[],
  options: AutoWidthOptions
): number {
  const { fontSize, fontFamily, useCanvas = true, cellPadding = 20 } = options;

  // Parse font size to number (assumes px units)
  const fontSizeNum = parseFloat(fontSize) || 14;

  // Measure function - uses canvas if available, falls back to estimation
  const measureText = (text: string): number => {
    if (useCanvas) {
      const canvasWidth = measureTextWidthCanvas(text, fontSize, fontFamily);
      if (canvasWidth !== null) return canvasWidth;
    }
    return estimateTextWidth(text, fontSizeNum);
  };

  let maxWidth = 0;

  // Measure header text
  if (col.header) {
    maxWidth = Math.max(maxWidth, measureText(col.header));
  }

  // Measure all data cell values
  for (const row of rows) {
    // Skip header/spacer rows that don't have real data
    if (row.style?.type === "header" || row.style?.type === "spacer") {
      continue;
    }

    const text = getColumnDisplayText(row, col);
    if (text) {
      maxWidth = Math.max(maxWidth, measureText(text));
    }
  }

  // Apply padding and constraints
  // Use type-specific minimum for visual columns, else default minimum
  const typeMin = AUTO_WIDTH.VISUAL_MIN[col.type] ?? AUTO_WIDTH.MIN;
  const computedWidth = Math.ceil(maxWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER);
  return Math.min(AUTO_WIDTH.MAX, Math.max(typeMin, computedWidth));
}

/**
 * Calculate auto-widths for all columns that need it.
 * Returns a map of column ID to computed width.
 */
export function calculateAllAutoWidths(
  columns: ColumnSpec[],
  rows: Row[],
  options: AutoWidthOptions
): Map<string, number> {
  const widths = new Map<string, number>();

  for (const col of columns) {
    // Only process columns with width="auto" or null (both trigger auto-sizing)
    if (col.width !== "auto" && col.width !== null && col.width !== undefined) {
      continue;
    }

    const width = calculateColumnAutoWidth(col, rows, options);
    widths.set(col.id, width);
  }

  return widths;
}

/**
 * Calculate the width for the label column based on actual label content.
 *
 * This function measures:
 * 1. Label header text
 * 2. All row labels (with indentation and badges)
 * 3. Row group headers (with chevron, gap, count, and internal padding)
 *
 * The width calculation accounts for the complete visual layout of:
 * - Data rows: [indent][label][badge]
 * - Group headers: [indent][chevron][gap][label][gap][count][internal-padding]
 *
 * @param rows - All data rows
 * @param labelHeader - Header text for the label column
 * @param options - Font and measurement options
 * @param groups - Optional array of row groups (for measuring group header width)
 */
export function calculateLabelColumnWidth(
  rows: Row[],
  labelHeader: string | null | undefined,
  options: AutoWidthOptions,
  groups: Group[] = []
): number {
  const { fontSize, fontFamily, useCanvas = true, cellPadding = 20 } = options;
  const fontSizeNum = parseFloat(fontSize) || 14;

  const measureText = (text: string): number => {
    if (useCanvas) {
      const canvasWidth = measureTextWidthCanvas(text, fontSize, fontFamily);
      if (canvasWidth !== null) return canvasWidth;
    }
    return estimateTextWidth(text, fontSizeNum);
  };

  let maxWidth = 0;

  // Measure header
  if (labelHeader) {
    maxWidth = Math.max(maxWidth, measureText(labelHeader));
  }

  // ========================================================================
  // MEASURE DATA ROW LABELS
  // ========================================================================
  // Data row layout: [indent][label][badge]
  for (const row of rows) {
    if (row.label) {
      // Account for potential indentation
      const indent = row.style?.indent ?? 0;
      const indentWidth = indent * SPACING.INDENT_PER_LEVEL;
      let rowWidth = measureText(row.label) + indentWidth;

      // Account for badge width if present
      if (row.style?.badge) {
        const badgeText = String(row.style.badge);
        const badgeFontSize = fontSizeNum * BADGE.FONT_SCALE;
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
  // Group header layout: [indent][chevron][gap][label][gap][count][internal-padding]
  // See GROUP_HEADER constants in rendering-constants.ts

  // Helper to count all descendant rows (matching display logic)
  // This includes direct rows AND rows in nested subgroups
  function countAllDescendantRows(groupId: string): number {
    let count = 0;
    // Direct rows in this group
    for (const row of rows) {
      if (row.groupId === groupId) count++;
    }
    // Rows in child groups (recursively)
    for (const g of groups) {
      if (g.parentId === groupId) {
        count += countAllDescendantRows(g.id);
      }
    }
    return count;
  }

  for (const group of groups) {
    if (group.label) {
      const indentWidth = group.depth * SPACING.INDENT_PER_LEVEL;
      const labelWidth = measureText(group.label);

      // Count all descendant rows for the "(N)" suffix, matching display
      const rowCount = countAllDescendantRows(group.id);
      const countText = `(${rowCount})`;
      const countFontSize = fontSizeNum * 0.75; // matches theme.typography.fontSizeSm
      const countWidth = estimateTextWidth(countText, countFontSize);

      // Total width: all components from GroupHeader.svelte layout
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

  // Apply padding and constraints (label column has higher max)
  const computedWidth = Math.ceil(maxWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER);
  return Math.min(AUTO_WIDTH.LABEL_MAX, Math.max(AUTO_WIDTH.MIN, computedWidth));
}

/**
 * Flatten nested column groups to get leaf columns only.
 */
export function flattenColumns(
  columns: (ColumnSpec | { isGroup: true; columns: ColumnSpec[] })[],
  position?: "left" | "right"
): ColumnSpec[] {
  const result: ColumnSpec[] = [];

  for (const col of columns) {
    if ("isGroup" in col && col.isGroup) {
      result.push(...flattenColumns(col.columns, position));
    } else {
      const spec = col as ColumnSpec;
      if (!position || spec.position === position) {
        result.push(spec);
      }
    }
  }

  return result;
}

/**
 * Get the effective width for a column, using computed auto-width if available.
 */
export function getEffectiveColumnWidth(
  col: ColumnSpec,
  autoWidths: Map<string, number>,
  defaultWidth: number = 100
): number {
  // First check if we have a computed auto-width
  const autoWidth = autoWidths.get(col.id);
  if (autoWidth !== undefined) {
    return autoWidth;
  }

  // Then check if the column has an explicit width
  if (typeof col.width === "number") {
    return col.width;
  }

  // Fall back to default
  return defaultWidth;
}
