/**
 * Width calculation utilities for column auto-sizing.
 * Used by both web (forestStore) and SVG (svg-generator) renderers.
 */

import type { ColumnSpec, Row, ColumnOptions } from "../types";
import { getColumnDisplayText } from "./formatters";
import { AUTO_WIDTH } from "./rendering-constants";

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
  // More accurate character width estimation
  // Narrow chars: i, l, 1, ., ,, :, ;, |, !, (, ), [, ], {, }, space
  // Wide chars: m, w, M, W, @, %
  // Normal chars: everything else
  let width = 0;
  for (const char of text) {
    if ("il1.,;:|!()[]{}' ".includes(char)) {
      width += fontSize * 0.35;
    } else if ("mwMW@%".includes(char)) {
      width += fontSize * 0.85;
    } else if (char >= "0" && char <= "9") {
      // Tabular numbers have consistent width
      width += fontSize * 0.6;
    } else {
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
  fontFamily: string
): number | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.font = `${fontSize} ${fontFamily}`;
  return ctx.measureText(text).width;
}

// ============================================================================
// Column Width Calculation
// ============================================================================

export interface AutoWidthOptions {
  fontSize: string;      // e.g., "14px"
  fontFamily: string;    // e.g., "Inter, system-ui, sans-serif"
  useCanvas?: boolean;   // Whether to use canvas measurement (browser only)
}

/**
 * Calculate the auto-width for a single column based on header and all data values.
 */
export function calculateColumnAutoWidth(
  col: ColumnSpec,
  rows: Row[],
  options: AutoWidthOptions
): number {
  const { fontSize, fontFamily, useCanvas = true } = options;

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
  const computedWidth = Math.ceil(maxWidth + AUTO_WIDTH.PADDING);
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
 */
export function calculateLabelColumnWidth(
  rows: Row[],
  labelHeader: string | null | undefined,
  options: AutoWidthOptions
): number {
  const { fontSize, fontFamily, useCanvas = true } = options;
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

  // Measure all labels (accounting for indentation)
  for (const row of rows) {
    if (row.label) {
      // Account for potential indentation (roughly 16px per indent level)
      const indent = row.style?.indent ?? 0;
      const indentWidth = indent * 16;
      maxWidth = Math.max(maxWidth, measureText(row.label) + indentWidth);
    }
  }

  // Apply padding and constraints (label column has higher max)
  const computedWidth = Math.ceil(maxWidth + AUTO_WIDTH.PADDING);
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
