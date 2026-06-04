/**
 * Pure-data SVG generator for forest plots
 *
 * This module generates complete SVG strings from WebSpec data without any DOM access.
 * It can be used both in the browser and in Node.js/V8 environments.
 *
 * === SIZE NOTE (Phase 0c-C9 audit, 2026-05) ===
 *
 * This file is 5,300+ lines because it houses every per-column-type render
 * function (renderInterval, renderDiamond, renderVizBar, renderVizBoxplot,
 * renderVizViolin) plus the structural ones (header, footer, group-header,
 * unified column-headers, unified table-row) plus a parallel layout pass
 * (generateSVGForAspectTarget). The per-column-type functions DO split out
 * cleanly along their own boundaries — each takes spec/row/options + layout
 * + theme and returns SVG strings.
 *
 * BUT: every render function shares helpers that live in this same file
 * (applyVerticalCellAlign, resolveMarkerStyle and other style-resolution
 * helpers, the layout pre-processors, etc.). Splitting per-column-type
 * would require pulling those helpers into a separate shared module too,
 * or creating circular-import risk. Estimated ~1 week of work.
 *
 * Per the spec's stopping rule, the size justification stays here: this
 * file remains > 700 lines because the natural decomposition requires
 * its own follow-on PR (left as a future item, not blocking).
 */

import type {
  WebSpec,
  WebTheme,
  Row,
  ColumnSpec,
  ColumnDef,
  ComputedLayout,
  EffectSpec,
  MarkerShape,
  VizBarColumnOptions,
  VizBoxplotColumnOptions,
  VizViolinColumnOptions,
  BoxplotStats,
  KDEResult,
  AxisConfig,
  Annotation,
} from "$types";
import { getEffectValue } from "$lib/scale-utils";
import { computeAxis, generateTicks, VIZ_MARGIN } from "$lib/axis-utils";
import { forestScaleRange, safeLogDomain } from "$lib/layout/forest-scale";
import { computeArrowDimensions, renderArrowPath } from "$lib/arrow-utils";
import { isVizType, resolveShowHeader } from "$lib/column-types";
import { resolveMarkerStyle } from "$lib/marker-styling";
import { computeBandIndexes } from "$lib/banding";
import { resolveRowKind, rowKindProps, type RowKind } from "$lib/layout/row-kind";
import { computeRowLayout, computeHeaderHeight, computeAxisHeight, computeScalableChromeHeight, panelContentKey, DEFAULT_AXIS_GAP, LINE_HEIGHT } from "$lib/layout/table-metrics";
import { markdownToPlainText } from "$lib/markdown";
import { computeAspectLadder, minRowHeightFor } from "$lib/layout/aspect-ladder";
import { resolveFlexWidths, type ColumnWidthSpec } from "$lib/layout/flex-distribute";
import { flexWeightForColumn, vizNaturalWidthForColumn, columnFlexesForAspect } from "$lib/layout/flex-weights";
import { resolveSemanticBundle, semanticMarkOpacity } from "$lib/semantic-styling";
import { activeHeaderVariant } from "$lib/header-variant";
import {
  getCssVars, readVar, readVarPx,
  readTypeFamily, readTypeSize, readTypeWeight,
  readContentPrimary, readContentSecondary, readContentMuted,
  readDividerSubtle, readDividerStrong,
  readAccentDefault, readSurfaceBg, readRowAltBg,
  readBodyFamily, readBodySize, readLabelSize, readCellSize,
} from "$lib/theme/consumer-bridge";
import { parseFontSize as parseFontSizeUtil } from "$lib/typography-layout";
import { renderCell as schemaRenderCell } from "../schema/dispatch";
import { renderNodeToSvg, type StyleResolver } from "../schema/render-svg";
import { compileVariants } from "../schema/variant-compile";
import { computeEffectiveBanks } from "../schema/banks";
import { resolveStyleMapping } from "$lib/style-mapping-resolve";
import {
  LAYOUT,
  SPACING,
  RENDERING,
  AUTO_WIDTH,
  GROUP_HEADER,
  TEXT_MEASUREMENT,
  BADGE,
  getEffectYOffset,
  AXIS,
  ASPECT,
} from "$lib/rendering-constants";
import {
  formatNumber,
  getColumnDisplayText,
  truncateString,
} from "$lib/formatters";
import { estimateTextWidth, measureTextWidth, glyphNaturalWidth, computeContentHeights } from "$lib/width-utils";
import { escapeXml } from "$lib/svg-text-utils";
import {
  computeVizBarDomain,
  computeVizBoxplotDomain,
  computeVizViolinDomain,
} from "$lib/viz-domain-utils";

import {
  computeBoxplotStats,
  computeKDE,
  normalizeKDE,
} from "$lib/viz-utils";

import {
  parseFontSize,
  textRegionHeight,
  computeAxisLayout,
} from "$lib/typography-layout";

/**
 * Word-wrap text into lines that fit within `contentWidth`. Honours
 * author-supplied `\n` first, then breaks long segments greedily on word
 * boundaries (falls back to char-by-char only when a single word
 * overflows). Caps at `maxLines` — extra content beyond the cap is
 * dropped (live widget shows clipped overflow at the row edge).
 */
function wrapTextIntoLines(
  text: string,
  contentWidth: number,
  fontSize: number,
  maxLines: number,
): string[] {
  if (!text || maxLines <= 0) return [];
  const out: string[] = [];
  const segments = text.split(/\r?\n/);
  for (const seg of segments) {
    if (out.length >= maxLines) break;
    if (seg.length === 0) { out.push(""); continue; }
    if (estimateTextWidth(seg, fontSize) <= contentWidth) {
      out.push(seg);
      continue;
    }
    const words = seg.split(/\s+/);
    let line = "";
    for (const word of words) {
      if (out.length >= maxLines) break;
      const trial = line ? `${line} ${word}` : word;
      if (estimateTextWidth(trial, fontSize) <= contentWidth) {
        line = trial;
      } else if (line) {
        out.push(line);
        line = word;
      } else {
        // Single word longer than contentWidth — break at chars.
        let chunk = "";
        for (const ch of word) {
          if (out.length >= maxLines) break;
          const next = chunk + ch;
          if (estimateTextWidth(next, fontSize) <= contentWidth) {
            chunk = next;
          } else {
            if (chunk) out.push(chunk);
            chunk = ch;
          }
        }
        line = chunk;
      }
    }
    if (line && out.length < maxLines) out.push(line);
  }
  return out.slice(0, maxLines);
}

// Details-panel SVG geometry (mirrors the DOM `.tabviz-details-panel` CSS).
const PANEL_PAD_X = 12;
const PANEL_PAD_TOP = 8;
const PANEL_PAD_BOTTOM = 10;
const PANEL_MAX_LINES = 200;

/** Panel inner text width for a given canvas/table width. The panel spans the
 *  full table width; text insets by `padding` (table) + `PANEL_PAD_X` each side.
 *  Shared by the height pre-pass and the renderer so the wrapped line count —
 *  and therefore the row track height — agree (V8 has no DOM to measure). */
function panelInnerWidth(canvasWidth: number, padding: number): number {
  return Math.max(40, canvasWidth - padding * 2 - PANEL_PAD_X * 2);
}

/** Wrap a panel's markdown (as plain text) to its inner width. */
function wrapPanelLines(content: string, innerWidth: number, fontSize: number): string[] {
  return wrapTextIntoLines(markdownToPlainText(content), innerWidth, fontSize, PANEL_MAX_LINES);
}

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
 * Pre-computed layout data for a single non-forest viz column
 * (viz_bar, viz_boxplot, viz_violin). Carries the zoomed-domain override
 * for WYSIWYG export parity; clipBounds equals xDomain in this sprint.
 */
export interface VizColumnLayout {
  columnId: string;
  xDomain: [number, number];
  clipBounds: [number, number];
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

  // Non-forest viz columns with pan/zoom overrides (empty when none zoomed)
  vizColumns?: VizColumnLayout[];

  // Row layout
  rowHeights: number[];
  rowPositions: number[];
  /** Per-row marker-center Y (relative to rowsHeight origin). Differs
   *  from `rowPositions[i] + rowHeights[i] / 2` only for "padded-after"
   *  rows: their track is inflated by rowGroupPadding, but the marker
   *  centers on the data portion of the band, not the padded total. */
  rowMarkerCenters: number[];
  totalRowsHeight: number;
  /** True at index i when displayRows[i] is the LAST data row of a
   *  top-level group followed immediately by another top-level
   *  group_header — drives the rowGroupPadding "after only" render
   *  (track inflated, content rendered at original visible band). */
  rowPaddedAfter: boolean[];

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

  // Mode 3 (aspect-changed) — driven by R-side `save_plot()` lever ladder.
  // Both must be set to trigger; flexCap defaults to 2 ([0.5×, 2×]).
  // - targetWidth absorbed by flex columns first (capped at flexCap×natural);
  //   remainder is delivered via the existing at-least-width path so non-
  //   flex auto-width columns size as usual.
  // - targetHeight scales theme.spacing.rowHeight proportionally so the
  //   layout *calculates* a new height rather than clipping. Non-row
  //   chrome (header / axis / footer) stays at natural.
  targetWidth?: number;
  targetHeight?: number;
  flexCap?: number;
  /** Phase 7D: when true, the height ladder kicks off with an auto-wrap
   *  loop that bumps `wrap` on text/label columns to absorb tall-aspect
   *  height delta with content rather than whitespace. Caller sees the
   *  bumped column ids on `globalThis.lastAutoWrapResult` (R reads via
   *  V8::v8()$get). */
  autoWrap?: boolean;

  // NEW: Complete pre-computed layout from browser (WYSIWYG path)
  precomputedLayout?: PrecomputedLayout;

  // LEGACY: Individual fields for backwards compatibility / R-side export
  // Pre-computed column widths from web view (keyed by column ID)
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
  const cssVarsLocal = getCssVars(spec.theme);
  const bodySizeStr = readBodySize(cssVarsLocal);
  const fontSize = parseFontSize(readTypeSize(cssVarsLocal, "body", bodySizeStr));
  // Header cells: use the explicit theme.header.text.size when it's been
  // pinned distinct from body.size; otherwise apply the historical 5%
  // scale-up (matches the .header-cell CSS calc-fallback in TabvizPlot).
  const headerExplicit = spec.theme.header?.text?.size;
  const headerFontSize = (headerExplicit && headerExplicit !== bodySizeStr)
    ? Math.round(parseFontSize(headerExplicit) * 100) / 100
    : Math.round(fontSize * 1.05 * 100) / 100;
  // Header font weight is theme-controlled via theme.header.text.weight
  // (defaults to 600). Passed through to estimateTextWidth() so the
  // width estimate reflects the actual weight that will render.
  const headerWeight = (spec.theme.header?.text as { weight?: number } | undefined)?.weight ?? 600;
  const rows = spec.data.rows;

  // Padding values from theme (not hardcoded magic numbers). v4 cssVars when
  // available; v3 fallback otherwise.
  const cssVars = getCssVars(spec.theme);
  const cellPadding = readVarPx(cssVars, "--tv-spacing-cell-padding-x", 10) * 2;
  const groupPadding = readVarPx(cssVars, "--tv-spacing-column-group-padding", 8) * 2;

  // ========================================================================
  // PHASE 1: Measure leaf column content
  // ========================================================================
  for (const col of columns) {
    // Plot columns (forest, viz_bar, viz_boxplot, viz_violin) with width="auto"
    // are intentionally omitted here so the downstream renderer falls through
    // to their multi-flex distributed width (`layout.flexWidths`, the
    // expand-to-fill value). A natural-min autoWidth would cap the plot to
    // ~200px even when the caller asked for a 1600px canvas, producing a
    // narrow plot with empty space to the right. User-resized widths still
    // arrive via `options.columnWidths` (see computeLayout).
    if (
      (col.type === "forest" ||
        col.type === "viz_bar" ||
        col.type === "viz_boxplot" ||
        col.type === "viz_violin") &&
      (col.width === "auto" || col.width == null)
    ) {
      continue;
    }

    // Explicit numeric width is a hard pin — respect the author's intent.
    // Earlier behaviour silently auto-grew the column past `col.width` when
    // the header text wouldn't fit at that size, treating `width = N` as a
    // floor rather than a pin (GH #6). That broke WYSIWYG between the spec
    // and the SVG export, and made it impossible to author a deliberately
    // narrow column with a long header. The new contract: `width = N`
    // means exactly N pixels; headers that don't fit clip (or wrap, if
    // `wrap = TRUE` is set on the column). `width = "auto"` / `NULL` /
    // `NA` continue to fall through to the measurement loop below.
    if (col.width !== "auto" && col.width !== null && col.width !== undefined) {
      continue;
    }

    let maxWidth = 0;

    // Measure header text at the actual header weight.
    if (col.header) {
      maxWidth = Math.max(
        maxWidth,
        estimateTextWidth(col.header, headerFontSize, headerWeight),
      );
    }

    // Measure all data cell values using proper display text
    for (const row of rows) {
      if (!rowKindProps(resolveRowKind({ type: "data", row })).measuresWidth) {
        continue;
      }
      const text = getColumnDisplayText(row, col);
      if (text) {
        maxWidth = Math.max(maxWidth, estimateTextWidth(text, fontSize));
      }
    }

    // Glyph-column natural geometry: pictogram, icon, ring, stars all
    // render fixed-pixel artwork that getColumnDisplayText() can't
    // measure as text, so without this their auto-width was just the
    // header text and they ended up cramped. Returns 0 for non-glyph
    // types.
    maxWidth = Math.max(maxWidth, glyphNaturalWidth(col, rows));

    // Apply padding (from theme) and constraints
    // Use type-specific minimum for visual columns, else default minimum
    const typeMin = AUTO_WIDTH.VISUAL_MIN[col.type] ?? AUTO_WIDTH.MIN;
    const computedWidth = Math.ceil(maxWidth + cellPadding + TEXT_MEASUREMENT.RENDERING_BUFFER);
    widths.set(col.id, Math.min(AUTO_WIDTH.MAX, Math.max(typeMin, computedWidth)));
  }

  // ========================================================================
  // PHASE 2: Check column groups and expand children if needed
  // ========================================================================
  // This matches the web view's doMeasurement() logic in tabvizStore.svelte.ts
  // Column group headers also use scaled font size (they inherit .header-cell)
  expandColumnGroupWidths(spec.columns, widths, headerFontSize, headerWeight, groupPadding, TEXT_MEASUREMENT.RENDERING_BUFFER);

  return widths;
}

/**
 * Process column groups recursively and expand children if group header needs more space.
 * This matches the web view's processColumn() logic in tabvizStore.svelte.ts.
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
  weight: number,
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
        // Group header needs: weight-aware estimate + theme group padding
        // + rendering buffer.
        const groupHeaderWidth =
          estimateTextWidth(col.header, fontSize, weight) +
          groupPadding + renderingBuffer;

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
 * Calculate primary (leftmost) column width based on actual label content.
 */
function calculateSvgLabelWidth(spec: WebSpec, primaryHeader: string | null | undefined): number {
  const cssVarsLocal = getCssVars(spec.theme);
  const bodySizeStr = readBodySize(cssVarsLocal);
  const fontSize = parseFontSize(readTypeSize(cssVarsLocal, "body", bodySizeStr));
  // Canonical indent token: the renderer indents by
  // theme.rowGroup.indentPerLevel, NOT the legacy SPACING.INDENT_PER_LEVEL (12).
  // Budget label width with the same value so it doesn't under-size at depth.
  // v4 reads --tv-spacing-indent-per-level (kept in sync with rowGroup.indentPerLevel).
  const indentPx = readVarPx(cssVarsLocal, "--tv-spacing-indent-per-level", SPACING.INDENT_PER_LEVEL);
  // Header in the primary (label) column is rendered bold at the same scaled
  // header font size as `calculateSvgAutoWidths`. Mirror that scaling here so
  // a long primary header doesn't squeeze the label column and trigger
  // ellipsis in the live header.
  const headerExplicit = spec.theme.header?.text?.size;
  const headerFontSize = (headerExplicit && headerExplicit !== bodySizeStr)
    ? Math.round(parseFontSize(headerExplicit) * 100) / 100
    : Math.round(fontSize * 1.05 * 100) / 100;
  const headerWeight = (spec.theme.header?.text as { weight?: number } | undefined)?.weight ?? 600;
  // Use theme-based padding (not hardcoded magic numbers)
  const cssVars = getCssVars(spec.theme);
  const cellPadding = readVarPx(cssVars, "--tv-spacing-cell-padding-x", 10) * 2;
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

  // Measure primary column header at scaled header fontSize+weight
  if (primaryHeader) {
    maxWidth = Math.max(maxWidth, estimateTextWidth(primaryHeader, headerFontSize, headerWeight));
  }

  // Measure all labels (including group depth, row indent, and badges)
  for (const row of spec.data.rows) {
    if (row.label) {
      // Total indent = group-based depth + row-level indent
      const depth = getRowDepth(row.groupId);
      const rowIndent = row.style?.indent ?? 0;
      const totalIndent = depth + rowIndent;
      const indentWidth = totalIndent * indentPx;
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
  // This must match the web view measurement in tabvizStore.svelte.ts
  // ========================================================================
  const showGroupCounts = !!spec.interaction?.showGroupCounts;
  for (const group of groups) {
    if (group.label) {
      const indentWidth = group.depth * indentPx;
      const labelWidth = estimateTextWidth(group.label, fontSize);

      // Count "(N)" suffix is optional — budget 0 when hidden.
      let countWidth = 0;
      if (showGroupCounts) {
        const rowCount = countGroupDescendantRows(group.id, groups, spec.data.rows);
        const countText = `(${rowCount})`;
        const countFontSize = fontSize * 0.75; // matches readLabelSize(cssVars)
        countWidth = estimateTextWidth(countText, countFontSize) + GROUP_HEADER.GAP;
      }

      const totalWidth = indentWidth
        + GROUP_HEADER.CHEVRON_WIDTH
        + GROUP_HEADER.GAP
        + labelWidth
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
  axisGap: number;                  // Gap between plot rows and axis
  rowsHeight: number;               // Height of display rows only (excludes overall summary)
  autoWidths: Map<string, number>;  // Add auto-widths to layout
  labelWidth: number;               // Calculated label column width
  rowMarkerCenters: number[];       // Per-row marker-center Y (skips trailing rowGroupPadding)
  rowPaddedAfter: boolean[];        // Per-row flag: gets bottom row-group padding
}

function computeLayout(spec: WebSpec, options: ExportOptions, nullValue: number = 0): InternalLayout {
  const theme = spec.theme;
  // Layout arithmetic reads spacing tokens via v4 cssVars (with v3 fallback).
  // Computed once at function entry; all spacing reads below use the resolved
  // numbers. When theme.authoringInputs is unavailable, cssVars is empty and
  // every readVarPx call falls back to theme.spacing.* — identical behavior.
  const cssVars = getCssVars(theme);
  const rowHeight = readVarPx(cssVars, "--tv-spacing-row-height", 34);
  const padding = readVarPx(cssVars, "--tv-spacing-padding", 8);

  // Ensure columns is an array (guard against R serialization issues)
  const columns = Array.isArray(spec.columns) ? spec.columns : [];

  // Check if we have column groups (need taller header)
  // Must check ALL columns including unified columns (without position)
  const leftColumnDefs = getColumnDefs(columns, "left");
  const rightColumnDefs = getColumnDefs(columns, "right");
  const hasGroups = hasColumnGroups(leftColumnDefs) || hasColumnGroups(rightColumnDefs) || hasColumnGroups(columns);

  // Header height calculation must match web view behavior:
  // .header-cell uses 0 vertical padding now (cellPaddingY deprecated in
  // v0.21.x), so the header track height = headerHeight/depth exactly.
  // Auto-grow when the theme value is smaller than what the current font
  // (× headerFontScale × line-height) needs — matches tabvizStore.layout.
  const headerDepth = hasGroups ? 2 : 1;
  const effectiveHeaderHeight = computeHeaderHeight({
    bodyFontPx: parseFontSize(readBodySize(cssVars)),
    themeHeaderHeight: readVarPx(cssVars, "--tv-spacing-header-height", 34),
    headerDepth,
  });
  const actualRowHeight = effectiveHeaderHeight / headerDepth;
  // If no leaf column's header renders AND no column groups exist, the whole
  // header band collapses — mirrors TabvizPlot.svelte's anyHeaderVisible.
  const allLeafCols = flattenAllColumns(columns);
  const anyHeaderVisible = hasGroups ||
    allLeafCols.some(c => resolveShowHeader(c.showHeader, c.header));
  const headerHeight = anyHeaderVisible ? actualRowHeight * headerDepth : 0;

  // Text heights for header/footer
  const hasTitle = !!spec.labels?.title;
  const hasSubtitle = !!spec.labels?.subtitle;
  const hasCaption = !!spec.labels?.caption;
  const hasFootnote = !!spec.labels?.footnote;

  // Text region heights derived from the theme's typography (font size +
  // line height). Pre-v0.21.x these used hardcoded TYPOGRAPHY.*_HEIGHT
  // constants tuned for the default font profile, which truncated the
  // title (or padded too much) when users picked larger / smaller fonts.
  const lineHeight = 1.5;
  const titleHeight = hasTitle ? textRegionHeight(readTypeSize(cssVars, "subtitle", "16.8px"), lineHeight) : 0;
  const subtitleHeight = hasSubtitle ? textRegionHeight(readBodySize(cssVars), lineHeight) : 0;
  // Title↔subtitle gap is themable via spacing.title_subtitle_gap (default
  // 13 to mirror the live widget's PlotHeader CSS chain margin+border+
  // padding = 6+1+6).
  const titleSubtitleGap = (hasTitle && hasSubtitle) ? readVarPx(cssVars, "--tv-spacing-title-subtitle-gap", 13) : 0;
  const headerTextHeight = titleHeight + titleSubtitleGap + subtitleHeight + (hasTitle || hasSubtitle ? padding : 0);

  const captionHeight = hasCaption ? textRegionHeight(readLabelSize(cssVars), lineHeight) : 0;
  const footnoteHeight = hasFootnote ? textRegionHeight(readLabelSize(cssVars), lineHeight) : 0;
  // Pre-spacing above the caption is already supplied by `footerGap`;
  // adding `padding` here too double-counted the air between axis end
  // and caption text. Remove and let footerGap own that gap exclusively.
  const footerTextHeight = captionHeight + footnoteHeight;

  // Compute display rows (includes group headers)
  const displayRows = buildDisplayRows(spec);
  const hasOverall = !!spec.data.overall;

  // Calculate auto-widths for columns
  // Support both legacy (left/right position) and new unified (no position) column models
  const leftColumns = flattenColumns(columns, "left");
  const rightColumns = flattenColumns(columns, "right");

  // The primary column is the first leaf and takes the "label" slot in the SVG
  // layout. Exclude it from the unifiedColumns list so it isn't rendered twice.
  const primaryCol = getPrimaryColumn(columns);
  const primaryHeader = primaryCol?.header ?? "Study";
  const unifiedColumns = flattenAllColumns(columns).filter(c =>
    (c as { position?: string }).position === undefined && c.id !== primaryCol?.id
  );

  // allColumns includes both legacy positioned columns and unified columns
  const allColumns = [...leftColumns, ...rightColumns, ...unifiedColumns];

  // Use pre-computed widths from web view if provided, otherwise calculate
  let autoWidths: Map<string, number>;
  let labelWidth: number;

  if (options.columnWidths) {
    // Use pre-computed widths from web view
    autoWidths = new Map<string, number>();
    const primaryId = primaryCol?.id;
    for (const [id, width] of Object.entries(options.columnWidths)) {
      if (id !== primaryId) {
        autoWidths.set(id, width);
      }
    }
    labelWidth = (primaryId ? options.columnWidths[primaryId] : undefined)
      ?? calculateSvgLabelWidth(spec, primaryHeader);
  } else {
    // Calculate widths from scratch (R-side export path)
    autoWidths = calculateSvgAutoWidths(spec, allColumns);
    labelWidth = calculateSvgLabelWidth(spec, primaryHeader);
  }

  // Wrap line counts: per-row max number of lines across wrap-enabled
  // columns. Mirrors tabvizStore's measurement so SVG export grows the
  // same row tracks the live widget grows. Uses estimateTextWidth (the
  // same heuristic auto-width uses) so widths are self-consistent here.
  const wrapEnabledCols = allColumns.filter(c => {
    const w = (c as { wrap?: boolean | number }).wrap;
    return typeof w === "number" ? w > 0 : !!w;
  });
  const wrapLineCounts: Record<string, number> = {};
  if (wrapEnabledCols.length > 0) {
    const dataFontSize = parseFontSize(readBodySize(cssVars));
    const cellPadding = readVarPx(cssVars, "--tv-spacing-cell-padding-x", 10) * 2;
    for (const row of spec.data.rows) {
      let maxLines = 1;
      for (const col of wrapEnabledCols) {
        const colWidth = (col.id === primaryCol?.id)
          ? labelWidth
          : (autoWidths.get(col.id) ?? getEffectiveWidth(col, autoWidths));
        const contentWidth = Math.max(1, colWidth - cellPadding);
        const raw = (row.metadata as Record<string, unknown>)[col.field];
        const text = raw == null ? "" : String(raw);
        if (text === "") continue;
        const segments = text.split(/\r?\n/);
        let cellLines = 0;
        for (const seg of segments) {
          if (seg.length === 0) { cellLines += 1; continue; }
          const w = estimateTextWidth(seg, dataFontSize);
          cellLines += Math.max(1, Math.ceil(w / contentWidth));
        }
        const wrapVal = (col as { wrap?: boolean | number }).wrap as boolean | number;
        const cap = typeof wrapVal === "number" ? wrapVal + 1 : (wrapVal ? 2 : 1);
        const capped = Math.min(cellLines, cap);
        if (capped > maxLines) maxLines = capped;
      }
      if (maxLines > 1) wrapLineCounts[row.id] = maxLines;
    }
  }

  // Calculate rows height and per-row positions (display rows only, not including overall summary).
  // Group-header rows take the themed `rowGroupPadding` (mirrors the
  // symmetric CSS padding in the live widget) so the forest/axis Y
  // positions line up with the visible row edges in the export.
  const rowGroupPadding = readVarPx(cssVars, "--tv-spacing-row-group-padding", 0);
  const dataLineHeightPx = Math.ceil(parseFontSize(readBodySize(cssVars)) * LINE_HEIGHT);
  // Per-row intrinsic content height (stacked pictograms, tall icons,
  // multi-effect forest, sparkline/img) — estimator path for V8/export.
  const contentHeights = computeContentHeights(allColumns, spec.data.rows, {
    rowHeight,
    lineHeight: LINE_HEIGHT,
    fontSize: parseFontSize(readBodySize(cssVars)),
  });
  // Details panels are content-driven; V8 has no DOM to measure, so size each
  // from its wrapped plain-text line count. Wrap width = the canvas width
  // (options.width when set — the usual export case — else a default), derived
  // identically in the renderer so heights + rendered text agree.
  {
    const panelCanvasW = options.width ?? LAYOUT.DEFAULT_WIDTH;
    const panelInner = panelInnerWidth(panelCanvasW, padding);
    const panelFontPx = parseFontSize(readBodySize(cssVars));
    for (const dr of displayRows) {
      if (dr.type !== "panel") continue;
      const lines = wrapPanelLines(dr.content, panelInner, panelFontPx);
      contentHeights[panelContentKey(dr.rowId)] =
        lines.length * dataLineHeightPx + PANEL_PAD_TOP + PANEL_PAD_BOTTOM;
    }
  }
  // Per-row vertical layout via the shared (DOM/SVG) metrics helper.
  // Phase 5 row-kind height cascade:
  //   layer 4 (constructorRowHeights) — from spec.rowHeights (v4 field; ratios).
  //   layers 3 + 5 not plumbed through the SVG path yet (browser-side pins
  //   live in the layout-zoom slice; SVG export doesn't currently consume
  //   them — that's a step 6 concern).
  const { rowHeights, rowPositions, rowMarkerCenters, rowPaddedAfter, rowsHeight } =
    computeRowLayout({
      displayRows,
      wrapLineCounts,
      rowHeight,
      rowGroupPadding,
      dataLineHeightPx,
      contentHeights,
      constructorRowHeights: spec.rowHeights,
    });
  // plotHeight includes overall summary area (for total height calculations)
  const plotHeight = rowsHeight + (hasOverall ? rowHeight * RENDERING.OVERALL_ROW_HEIGHT_MULTIPLIER : 0);

  // Per-column natural ("wants") width for canvas sizing. A flex/plot column
  // (forest + viz_* default `flex: true`) has no content width, so it uses its
  // schema-designed natural (naturalWidthPx); others use explicit/measured. The
  // weighted distribution below grows columns from these to fill totalWidth.
  const isFlexColumn = (c: ColumnSpec): boolean =>
    columnFlexesForAspect(c) && (c.width === "auto" || c.width == null);
  const hasFlexColumns = allColumns.some(isFlexColumn);

  const colNaturalWidth = (c: ColumnSpec): number => {
    const provided = options.columnWidths?.[c.id];
    const explicit =
      typeof provided === "number" ? provided : typeof c.width === "number" ? c.width : null;
    return explicit ?? autoWidths.get(c.id) ?? vizNaturalWidthForColumn(c) ?? getEffectiveWidth(c, autoWidths);
  };
  const naturalSum = allColumns.reduce((sum, c) => sum + colNaturalWidth(c), 0);

  // Total width: at least the intrinsic content width (label + Σ naturals +
  // padding). A spec with a flex/plot column defaults to DEFAULT_WIDTH so the
  // plot gets room; a plain table shrinks to its content. `options.width` is an
  // explicit at-least floor (v0.30 contract).
  const neededWidth = padding * 2 + labelWidth + naturalSum;
  const widthFloor = hasFlexColumns
    ? (options.width ?? LAYOUT.DEFAULT_WIDTH)
    : (options.width ?? neededWidth);
  const totalWidth = Math.max(widthFloor, neededWidth);

  // Per-column width distribution — the single source of truth for column
  // widths (forest is just a high-weight plot column, no privileged scalar).
  // Distributes the non-label content area across every column by effective
  // weight (flexWeight × natural); pinned columns immovable. See
  // docs/dev/multi-flex-columns.md.
  const flexColSpecs: ColumnWidthSpec[] = allColumns.map((c) => {
    // Pin web-view-provided widths (the live widget already distributed; export
    // renders them faithfully) and authored numeric widths. A plot column is
    // pinned the same way as any other — via its column `width`. Only the
    // R-from-scratch path (no provided widths) actually flexes.
    const provided = options.columnWidths?.[c.id];
    const explicit =
      typeof provided === "number" ? provided : typeof c.width === "number" ? c.width : null;
    const measured = autoWidths.get(c.id);
    const natural = explicit ?? measured ?? vizNaturalWidthForColumn(c) ?? getEffectiveWidth(c, autoWidths);
    return {
      id: c.id,
      naturalWidth: natural,
      flexWeight: flexWeightForColumn(c),
      explicitWidth: explicit,
      minWidth: measured ?? undefined,
    };
  });
  // Target = the non-label content area (the primary/label column is positioned
  // separately via labelWidth and excluded from allColumns).
  const flexWidths = resolveFlexWidths(
    flexColSpecs,
    Math.max(0, totalWidth - padding * 2 - labelWidth),
  ).widths;


  // Total height: include full axis area only when a column actually renders
  // an x-axis strip (forest or any viz_* column). Plain tabular tables have
  // no bottom axis, so reserving ~76px of axis height caused truncation.
  const axisGap = readVarPx(cssVars, "--tv-spacing-axis-gap", DEFAULT_AXIS_GAP);
  const hasAxisColumn = allColumns.some(
    c => c.type === "forest" || c.type === "viz_bar" || c.type === "viz_boxplot" || c.type === "viz_violin",
  );
  // Axis layout is now derived from typography (was hardcoded 32 + 32 = 64
  // px regardless of font profile). Detect whether an axis label is set
  // on at least one of the present axis-bearing columns — used both to
  // pick the right region height here and to position the axis label
  // text in renderForestAxis.
  const someColumnHasAxisLabel = allColumns.some(c => {
    if (c.type === "forest") return !!c.options?.forest?.axisLabel;
    if (c.type === "viz_bar") return !!c.options?.vizBar?.axisLabel;
    if (c.type === "viz_boxplot") return !!c.options?.vizBoxplot?.axisLabel;
    if (c.type === "viz_violin") return !!c.options?.vizViolin?.axisLabel;
    return false;
  });
  const axisLayout = computeAxisLayout(
    { fontSizeSm: readLabelSize(cssVars), lineHeight: 1.5 },
    someColumnHasAxisLabel,
    readVarPx(cssVars, "--tv-plot-tick-mark-length", 5),
  );
  const webAxisHeight = computeAxisHeight(hasAxisColumn, axisGap, axisLayout.axisRegionHeight);
  // Include the themed footer gap when there's a footer to render — the
  // gap sits between the plot/axis area and the caption/footnote text. If
  // we leave it out, totalHeight was smaller than footerY + text, so the
  // last row (or the footer) got truncated in specs with no viz column
  // (where `webAxisHeight === 0` meant less buffer space to absorb the
  // mismatch).
  const footerGap = (spec.labels?.caption || spec.labels?.footnote)
    ? readVarPx(cssVars, "--tv-spacing-footer-gap", 8)
    : 0;
  // Bottom margin: themable via spacing.bottom_margin (default 16 to
  // mirror the prior LAYOUT.BOTTOM_MARGIN constant).
  const bottomMargin = readVarPx(cssVars, "--tv-spacing-bottom-margin", LAYOUT.BOTTOM_MARGIN);
  const headerGap = readVarPx(cssVars, "--tv-spacing-header-gap", 12);
  const totalHeight = headerTextHeight + padding +
    headerGap +
    headerHeight + plotHeight +
    webAxisHeight +
    footerGap +
    footerTextHeight +
    bottomMargin;

  return {
    totalWidth,
    totalHeight: options.height ?? totalHeight,
    flexWidths,
    headerHeight,
    rowHeight,
    plotHeight,
    // The real reserved axis band (0 for pure tables). Was previously the
    // stale LAYOUT.AXIS_HEIGHT constant (always 32) — a latent bug that also
    // made the aspect ladder's `naturalLayout.axisHeight > 0` always true.
    axisHeight: webAxisHeight,
    nullValue,
    summaryYPosition: plotHeight - rowHeight,
    showOverallSummary: hasOverall,
    headerTextHeight,
    footerTextHeight,
    // Title baseline = top of region + (titleHeight × 0.8) to drop under the
    // ascender. Replaces the old `+ TITLE_HEIGHT - 4` magic that assumed
    // the constant 28px region.
    titleY: padding + Math.round(titleHeight * 0.8),
    subtitleY: padding + titleHeight + titleSubtitleGap + Math.round(subtitleHeight * 0.8),
    // Header → first row gap. Live widget applies it as `padding-bottom`
    // on the header element via `--tv-header-gap` (PlotHeader.svelte:130);
    // SVG has no header element so we fold the gap into mainY. Default 12
    // matches the live CSS-var fallback in TabvizPlot.svelte.
    mainY: headerTextHeight + padding + headerGap,
    // Footer Y: Match web view's layout (axisHeight + 8px footer padding-top)
    // Footer Y: axis region + themed footer gap (spacing.footer_gap).
    // footerY = caption baseline. Live widget renders the caption with
    // padding-top = footerGap from the axis end (the visible TOP of the
    // caption text sits at footerGap below the border). To match in SVG
    // we need the BASELINE = footerGap + captionAscent (drop from text
    // top to baseline ≈ 0.85 × fontSize). Without the +captionAscent,
    // SVG and live disagreed by ~10px and the footer text overlapped
    // the axis region in the export.
    footerY: headerTextHeight + padding + headerGap
           + headerHeight + plotHeight + webAxisHeight
           + readVarPx(cssVars, "--tv-spacing-footer-gap", 8)
           + Math.round(parseFontSize(readLabelSize(cssVars)) * 0.85),
    axisGap,
    rowsHeight,
    autoWidths,
    labelWidth,
    rowPositions,
    rowHeights,
    rowMarkerCenters,
    rowPaddedAfter,
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

interface PanelDisplayRow {
  type: "panel";
  rowId: string;
  content: string;
  depth: number;
}

type DisplayRow = GroupHeaderDisplayRow | DataDisplayRow | PanelDisplayRow;

/**
 * Build display rows with group headers interleaved
 * This mimics the Svelte store's displayRows logic for consistent rendering
 */
function buildDisplayRows(spec: WebSpec): DisplayRow[] {
  const rows = spec.data.rows;
  const groups = Array.isArray(spec.data.groups) ? spec.data.groups : [];

  // Details panels: static export renders the expanded set from initialState
  // (decision: honor initialState; collapsed by default). A row gets a panel
  // unit right after it when it has details content AND is in expandedRows.
  const expanded = new Set(spec.initialState?.expandedRows ?? []);
  // Note rows attach after their target row and are ALWAYS rendered.
  const notesByRow = new Map<string, string[]>();
  for (const n of spec.notes ?? []) {
    if (!n.content || n.content.trim() === "") continue;
    if (!notesByRow.has(n.after)) notesByRow.set(n.after, []);
    notesByRow.get(n.after)!.push(n.content);
  }
  /** The panel + note units that follow a data row, in order. */
  const followers = (row: Row, depth: number): DisplayRow[] => {
    const out: DisplayRow[] = [];
    if (typeof row.details === "string" && row.details.trim() !== "" && expanded.has(row.id)) {
      out.push({ type: "panel", rowId: row.id, content: row.details, depth });
    }
    for (const content of notesByRow.get(row.id) ?? []) {
      out.push({ type: "panel", rowId: row.id, content, depth });
    }
    return out;
  };

  // If no groups, return flat data rows (+ any expanded panels).
  if (groups.length === 0) {
    const out: DisplayRow[] = [];
    for (const row of rows) {
      out.push({ type: "data", row, depth: 0 });
      out.push(...followers(row, 0));
    }
    return out;
  }

  // Build group lookup maps
  const groupMap = new Map<string, { id: string; label: string; depth: number; parentId?: string | null }>();
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
      current = groupMap.get(current)?.parentId ?? undefined;
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

    // Output direct data rows for this group (+ expanded panels + notes)
    const directRows = rowsByGroup.get(groupId) ?? [];
    for (const row of directRows) {
      const depth = getRowDepth(row.groupId);
      result.push({ type: "data", row, depth });
      result.push(...followers(row, depth));
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
  return columns.filter((c) => (c as any).position === position);
}

/**
 * The primary column is the first leaf in the column list. It acts as the
 * row identifier and occupies the leftmost slot in the SVG layout.
 */
function getPrimaryColumn(columns: ColumnDef[]): ColumnSpec | null {
  return flattenAllColumns(columns)[0] ?? null;
}

/** Check if any column definitions contain groups */
function hasColumnGroups(columnDefs: ColumnDef[]): boolean {
  return columnDefs.some((c) => c.isGroup);
}

/** Parse font size from CSS string (e.g., "0.875rem" -> 14, "9pt" -> 12) */
// parseFontSize, textRegionHeight, computeAxisLayout were extracted to
// `$lib/typography-layout.ts` so the live widget's layout engine and
// the SVG exporter share the same derivations from theme typography.

/** Calculate text X position and anchor with a caller-supplied horizontal padding. */
function getTextPositionPadded(
  x: number,
  width: number,
  align: "left" | "center" | "right" | undefined,
  pad: number
): { textX: number; anchor: string } {
  if (align === "right") {
    return { textX: x + width - pad, anchor: "end" };
  }
  if (align === "center") {
    return { textX: x + width / 2, anchor: "middle" };
  }
  return { textX: x + pad, anchor: "start" };
}

// escapeXml + measureTextWidth moved to $lib/svg-text-utils.ts and
// $lib/width-utils.ts so the new per-schema SVG renderers can reuse
// them without depending on this module.

/**
 * Truncate text to fit within a given width (approximate).
 * Uses character-class width estimation matching estimateTextWidth().
 * The optional `weight` parameter feeds the weight correction inside
 * estimateTextWidth so bold-rendered headers don't get spuriously
 * truncated when their bold render exceeds the regular-weight estimate.
 */
function truncateText(
  text: string,
  maxWidth: number,
  fontSize: number,
  padding: number = 0,
  weight: number = 400,
): string {
  const availableWidth = maxWidth - padding * 2;

  // Check if full text fits using weight-aware estimation
  const fullWidth = estimateTextWidth(text, fontSize, weight);
  if (fullWidth <= availableWidth) {
    return text;
  }

  // Binary search for the longest substring that fits (including ellipsis).
  const ellipsis = "…";
  // Ellipsis width also scales with weight (the rendered "…" is bolder
  // when the surrounding text is bold). Coefficient matches estimateTextWidth.
  const ellipsisMultiplier = 1 + Math.max(0, (weight - 400) / 100) * 0.035;
  const ellipsisWidth = fontSize * 0.55 * ellipsisMultiplier;

  let left = 0;
  let right = text.length;

  while (left < right) {
    const mid = Math.ceil((left + right) / 2);
    const truncated = text.slice(0, mid);
    const truncatedWidth = estimateTextWidth(truncated, fontSize, weight) + ellipsisWidth;

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

// Note: formatNumber + axis-tick helpers are imported from ./formatters.
// formatEvents / formatInterval / formatPvalue moved to per-schema
// renderers under src/schema/columns/*-renderer.ts (Phase 4a-c).

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

  scale.domain = (): [number, number] => domain;
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

  scale.domain = (): [number, number] => [d0, d1];
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
  // Range insets by VIZ_MARGIN on each side, matching web rendering. Shared with
  // the DOM via forest-scale.ts so the two backends can't drift.
  const range = forestScaleRange(forestWidth);
  const buildScale = (domain: [number, number]) =>
    isLog ? createLogScale(safeLogDomain(domain), range) : createLinearScale(domain, range);

  // If a pre-computed domain is provided (shared-axis split export), use it directly.
  if (options?.xDomain) {
    const clipBounds = options.clipBounds ?? options.xDomain;
    return {
      scale: buildScale(options.xDomain),
      clipBounds,
      ticks: generateTicks(clipBounds, spec.theme.axis, forestSettings.scale, forestSettings.nullValue),
    };
  }

  // Otherwise resolve this column's axis from its own data via the shared
  // computeAxis() (axis-utils.ts) — the same call the DOM per-context resolver uses.
  const { plotRegion, axisLimits, ticks } = computeAxis({
    rows: spec.data.rows,
    config: spec.theme.axis,
    scale: forestSettings.scale,
    nullValue: forestSettings.nullValue,
    forestWidth,
    pointSize: readVarPx(getCssVars(spec.theme), "--tv-plot-point-size", 6),
    effects: forestSettings.effects,
    pointCol: forestSettings.pointCol,
    lowerCol: forestSettings.lowerCol,
    upperCol: forestSettings.upperCol,
  });

  return { scale: buildScale(plotRegion), clipBounds: axisLimits, ticks };
}

// ============================================================================
// SVG Renderers
// ============================================================================

function renderHeader(
  spec: WebSpec,
  layout: InternalLayout,
  theme: WebTheme,
  cssVars: Record<string, string> = {},
): string {
  const lines: string[] = [];
  const padding = readVarPx(cssVars, "--tv-spacing-padding", 8);
  const subtitleFg = readContentSecondary(cssVars);
  const separatorStroke = readDividerSubtle(cssVars);

  if (spec.labels?.title) {
    const fontSize = parseFontSize(readTypeSize(cssVars, "title", readTypeSize(cssVars, "subtitle", "16.8px")));
    const titleFamily = readTypeFamily(cssVars, "title",
      readTypeFamily(cssVars, "title", readBodyFamily(cssVars)));
    const titleWeight = readTypeWeight(cssVars, "title", 600);
    const titleFg = readVar(cssVars, "--tv-text-title-fg", readContentPrimary(cssVars));
    lines.push(`<text x="${padding}" y="${layout.titleY}"
      font-family="${titleFamily}"
      font-size="${fontSize}px"
      font-weight="${titleWeight}"
      fill="${titleFg}">${escapeXml(spec.labels.title)}</text>`);
  }

  if (spec.labels?.subtitle) {
    const fontSize = parseFontSize(readTypeSize(cssVars, "subtitle", readBodySize(cssVars)));
    const subtitleFamily = readTypeFamily(cssVars, "subtitle", readBodyFamily(cssVars));
    const subtitleWeight = readTypeWeight(cssVars, "subtitle", 400);
    lines.push(`<text x="${padding}" y="${layout.subtitleY}"
      font-family="${subtitleFamily}"
      font-size="${fontSize}px"
      font-weight="${subtitleWeight}"
      fill="${subtitleFg}">${escapeXml(spec.labels.subtitle)}</text>`);
  }

  // Thin separator line between title and subtitle (only when both exist)
  // Web CSS has 6px padding-top on subtitle after the border, so position separator
  // to leave 6px gap between it and the subtitle text top
  if (spec.labels?.title && spec.labels?.subtitle) {
    const subtitleFontSize = parseFontSize(readTypeSize(cssVars, "subtitle", readBodySize(cssVars)));
    const subtitleAscent = subtitleFontSize * 0.75; // Approximate ascent (text top from baseline)
    const separatorY = layout.subtitleY - subtitleAscent - 6; // 6px gap like web CSS padding-top
    lines.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
      y1="${separatorY}" y2="${separatorY}"
      stroke="${separatorStroke}" stroke-width="1" opacity="0.3"/>`);
  }

  return lines.join("\n");
}

function renderFooter(
  spec: WebSpec,
  layout: InternalLayout,
  theme: WebTheme,
  cssVars: Record<string, string> = {},
): string {
  const lines: string[] = [];
  const padding = readVarPx(cssVars, "--tv-spacing-padding", 8);
  let y = layout.footerY;
  const borderStroke = readDividerSubtle(cssVars);
  const captionFg = readContentSecondary(cssVars);
  const footnoteFg = readVar(cssVars, "--tv-text-footnote-fg", readContentMuted(cssVars));

  // Draw footer border (1px) when caption or footnote exists, matching web view's PlotFooter border-top
  const hasFooter = !!spec.labels?.caption || !!spec.labels?.footnote;
  if (hasFooter) {
    // Border sits `footer_gap` above the text baseline — footerY already
    // includes the themed gap.
    const gap = readVarPx(cssVars, "--tv-spacing-footer-gap", 8);
    const borderY = layout.footerY - gap;
    lines.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
      y1="${borderY}" y2="${borderY}"
      stroke="${borderStroke}" stroke-width="1"/>`);
  }

  if (spec.labels?.caption) {
    const fontSize = parseFontSize(readLabelSize(cssVars));
    lines.push(`<text x="${padding}" y="${y}"
      font-family="${readBodyFamily(cssVars)}"
      font-size="${fontSize}px"
      font-weight="${400}"
      fill="${captionFg}">${escapeXml(spec.labels.caption)}</text>`);
    // Advance Y by the caption's actual line height — derived from
    // typography rather than the hardcoded 16px constant.
    y += textRegionHeight(readLabelSize(cssVars), 1.5);
  }

  if (spec.labels?.footnote) {
    const fontSize = parseFontSize(readLabelSize(cssVars));
    lines.push(`<text x="${padding}" y="${y}"
      font-family="${readBodyFamily(cssVars)}"
      font-size="${fontSize}px"
      font-weight="${400}"
      font-style="italic"
      fill="${footnoteFg}">${escapeXml(spec.labels.footnote)}</text>`);
  }

  return lines.join("\n");
}

/** Render a details/disclosure panel: a full-width tinted band with the panel's
 *  markdown rendered as wrapped plain text (SVG `<text>`; HTML markdown doesn't
 *  translate to SVG, so we strip to plain text — see markdownToPlainText). The
 *  wrap width matches the height pre-pass (panelInnerWidth) so lines fit the
 *  computed row track. */
function renderDetailsPanel(
  content: string,
  padding: number,
  y: number,
  rowHeight: number,
  canvasWidth: number,
  theme: WebTheme,
  cssVars: Record<string, string>,
): string {
  const fontPx = parseFontSize(readBodySize(cssVars));
  const lineH = Math.ceil(fontPx * LINE_HEIGHT);
  const lines = wrapPanelLines(content, panelInnerWidth(canvasWidth, padding), fontPx);
  const surfaceBase = readSurfaceBg(cssVars);
  const bg = readRowAltBg(cssVars) ?? surfaceBase;
  const fg = readContentPrimary(cssVars);
  const dividerSubtle = readDividerSubtle(cssVars);
  const family = readBodyFamily(cssVars);
  const out: string[] = [];
  out.push(`<rect x="0" y="${y}" width="${canvasWidth}" height="${rowHeight}" fill="${bg}" />`);
  out.push(`<line x1="0" y1="${y + rowHeight}" x2="${canvasWidth}" y2="${y + rowHeight}" stroke="${dividerSubtle}" stroke-width="1" />`);
  let ty = y + PANEL_PAD_TOP + fontPx;
  for (const line of lines) {
    if (line !== "") {
      out.push(`<text x="${padding + PANEL_PAD_X}" y="${ty}" font-family="${family}" font-size="${fontPx}px" fill="${fg}">${escapeXml(line)}</text>`);
    }
    ty += lineH;
  }
  return out.join("\n");
}

function renderGroupHeader(
  label: string,
  depth: number,
  rowCount: number,
  x: number,
  y: number,
  rowHeight: number,
  totalWidth: number,
  theme: WebTheme,
  renderBackground: boolean = true,
  cssVars: Record<string, string> = {},
): string {
  const lines: string[] = [];

  // Group-header colors (v4 cssVars → v3 fallback).
  const labelFg = readContentPrimary(cssVars);
  const countFg = readContentMuted(cssVars);
  const borderStroke = readDividerSubtle(cssVars);

  // Get level-based styling (depth is 0-indexed, level is 1-indexed)
  const level = depth + 1;
  const tier = level === 1 ? theme.rowGroup.L1
             : level === 2 ? theme.rowGroup.L2
             : theme.rowGroup.L3;

  const fontSize = parseFontSize(tier.text?.size ?? readBodySize(cssVars));
  const fontWeight = tier.text?.weight ?? (level === 1 ? 600 : level === 2 ? 500 : 400);
  const italic = tier.text?.italic ?? false;
  let background: string | null = tier.bg ?? null;
  const borderBottom = tier.borderBottom ?? false;

  // Fallback when the resolver didn't populate rowGroup.LN.bg: tint
  // from accent (V4: brand routes through accent; identity-secondary
  // cascade dropped per CLAUDE.md V4 vocabulary).
  if (!background) {
    const tint = readAccentDefault(cssVars);
    const opacity = level === 1 ? 0.15 : level === 2 ? 0.10 : 0.06;
    const hex = tint.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    background = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Use row center - dominant-baseline:central handles vertical alignment
  const textY = y + rowHeight / 2;
  const indent = depth * readVarPx(cssVars, "--tv-spacing-indent-per-level", SPACING.INDENT_PER_LEVEL);

  // Group header background. When the caller passes renderBackground=false,
  // banding's row-paint pass is already filling this row at the group's
  // depth — paint nothing so the band cycle owns the bg (avoids the
  // double-paint redundancy where L1.bg stacks on top of the banded color).
  // Users who want a custom L1 bar with banding also active should switch
  // banding mode (e.g. "row" or "none") so the bar isn't subsumed.
  const explicitTierBg = tier.bg ?? null;
  if (renderBackground) {
    lines.push(`<rect x="${x}" y="${y}"
      width="${totalWidth}" height="${rowHeight}"
      fill="${explicitTierBg ?? background}"/>`);
  }

  // Border bottom if enabled
  if (borderBottom) {
    lines.push(`<line x1="${x}" x2="${x + totalWidth}" y1="${y + rowHeight}" y2="${y + rowHeight}"
      stroke="${borderStroke}" stroke-width="1" opacity="0.5"/>`);
  }

  // Group header text (label)
  const fontStyle = italic ? ' font-style="italic"' : '';
  const cellPadX = readVarPx(cssVars, "--tv-spacing-cell-padding-x", 10);
  const labelX = x + cellPadX + indent;
  lines.push(`<text class="cell-text" dominant-baseline="central" x="${labelX}" y="${textY}"
    font-family="${readBodyFamily(cssVars)}"
    font-size="${fontSize}px"
    font-weight="${fontWeight}"${fontStyle}
    fill="${labelFg}">${escapeXml(label)}</text>`);

  // Row count (e.g., "(15)") - smaller muted text after label
  // Web CSS: font-weight: normal, color: muted, font-size: 0.75rem
  if (rowCount > 0) {
    // Use smart measurement: canvas in browser, estimation in V8/Node
    // measureTextWidth handles font-weight adjustment internally
    const labelWidth = measureTextWidth(label, fontSize, readBodyFamily(cssVars), fontWeight);
    const countX = labelX + labelWidth + 6; // 6px gap (matches web's flex gap)
    const countFontSize = parseFontSize(readLabelSize(cssVars) ?? "0.75rem");
    lines.push(`<text class="cell-text" dominant-baseline="central" x="${countX}" y="${textY}"
      font-family="${readBodyFamily(cssVars)}"
      font-size="${countFontSize}px"
      font-weight="${400}"
      fill="${countFg}">(${rowCount})</text>`);
  }

  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────────────
// Theme-aware StyleResolver for the schema's RenderNode → SVG path.
//
// Schema cell renderers emit `RenderNode` trees with theme-relative
// style tokens (font: "base" | "display" | …, size: "major" |
// "minor", color: "primary" | "muted" | "accent", …). `renderNodeToSvg`
// expects literal CSS / px values; this factory closes over the
// active theme to resolve tokens to literals.
//
// `cellStyle` (per-row bold / italic / color overrides) is applied
// at the outer `<g>` wrapper around each cell, so the resolver only
// has to handle theme tokens — text nodes that omit `style` inherit
// the outer `<g>`'s `fill` / `font-weight` / `font-style` naturally.
//
// Future Phase 7e+ work: per-cell semantic bundle resolution
// (emphasis / accent / muted from row flags) should also flow into
// here. Today the SVG-export path's legacy text branch handles that
// via resolveSemanticBundle — the schema-dispatched path will need
// the same logic as more cells migrate.
function makeThemeResolver(theme: WebTheme, cssVars: Record<string, string> = {}): StyleResolver {
  const fontFamily: Record<string, string> = {
    base:    readBodyFamily(cssVars),
    display: readTypeFamily(cssVars, "title", readBodyFamily(cssVars)),
    number:  readBodyFamily(cssVars),  // theme-controlled tabular handled via figures
    mono:    "ui-monospace, SFMono-Regular, monospace",
  };
  const fontSize: Record<string, number> = {
    major: parseFontSizeUtil(readBodySize(cssVars)  ?? "1rem"),
    base:  parseFontSizeUtil(readCellSize(cssVars)  ?? "0.875rem"),
    minor: parseFontSizeUtil(readLabelSize(cssVars) ?? "0.75rem"),
  };
  const color: Record<string, string> = {
    primary:   readContentPrimary(cssVars),
    secondary: readContentSecondary(cssVars),
    muted:     readContentMuted(cssVars),
    accent:    readAccentDefault(cssVars),
  };
  const bg: Record<string, string> = {
    base:   "transparent",
    muted:  readDividerSubtle(cssVars),
    // TODO(v3→v4): `accent.tintSubtle` (accent at low alpha) has no
    // dedicated manifest entry yet — add an accent-subtle token.
    accent: theme.accent.tintSubtle,
  };
  const weight: Record<string, number> = {
    normal: 400, medium: 500, semibold: 600, bold: 700,
  };
  return {
    font:   (v) => fontFamily[v as string] ?? String(v),
    size:   (v) => typeof v === "number" ? v : (fontSize[v as string] ?? 12),
    color:  (v) => color[v as string] ?? String(v),
    bg:     (v) => bg[v as string] ?? String(v),
    weight: (v) => typeof v === "number" ? v : (weight[v as string] ?? v),
  };
}

/**
 * Per-column { min, max } over the spec's row set, keyed by column id.
 * Consumed by the schema dispatch (ctx.columnSummary) so bar / heatmap
 * renderers don't iterate rows themselves. Skips columns whose type
 * doesn't need summary input.
 */
function computeColumnSummaries(
  rows: Row[],
  columns: ColumnSpec[],
): Map<string, { min: number; max: number }> {
  const out = new Map<string, { min: number; max: number }>();
  for (const col of columns) {
    if (col.type !== "bar" && col.type !== "heatmap") continue;
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      const v = row.metadata[col.field];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    out.set(col.id, {
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
    });
  }
  return out;
}

/**
 * Cell-text fallback used by the SVG-export catch-all branch. The
 * schema dispatch in the render loop produces SVG markup for every
 * concrete schema currently in the registry (Phase 4a-c); this helper
 * fires only for un-registered schemas (e.g. third-party additions
 * without an svg renderer) or wire-shape edge cases. Keep it minimal:
 * stringify the field value with a single text-type truncation.
 */
function getCellValue(row: Row, col: ColumnSpec): string {
  const val = row.metadata[col.field];
  const str = val !== undefined && val !== null ? String(val) : (col.options?.naText ?? "");
  if (col.type === "text") {
    return truncateString(str, col.options?.text?.maxChars);
  }
  return str;
}

function renderInterval(
  row: Row,
  yPosition: number,
  xScale: (value: number) => number,
  theme: WebTheme,
  nullValue: number,
  effects: EffectSpec[] = [],
  weightCol?: string | null,
  forestX: number = 0,
  forestWidth: number = Infinity,
  clipBounds?: [number, number],
  isLog: boolean = false,
  cssVars: Record<string, string> = {},
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
    const point = (!isLog || (row.point != null && row.point > 0)) ? (row.point ?? null) : null;
    const lower = (!isLog || (row.lower != null && row.lower > 0)) ? (row.lower ?? null) : null;
    const upper = (!isLog || (row.upper != null && row.upper > 0)) ? (row.upper ?? null) : null;
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

  const baseSize = readVarPx(cssVars, "--tv-plot-point-size", 6);
  const lineWidth = readVarPx(cssVars, "--tv-plot-line-width", 1.5);
  const accentDefault = readAccentDefault(cssVars);
  const defaultLineColor = theme.series?.[0]?.stroke ?? accentDefault;

  // Check if this is a summary row (should render diamond). summaryMarker is
  // the RowKind property owning this decision.
  const isSummaryRow = rowKindProps(resolveRowKind({ type: "data", row })).summaryMarker;
  const diamondHeight = 10;
  const halfDiamondHeight = diamondHeight / 2;

  // Helper to get point size for an effect
  function getPointSize(isPrimary: boolean): number {
    // Row-level marker size (only applies to primary effect). Treated as a
    // raw weight-like value and normalized the same way as legacy weight —
    // keeps markers bounded even when users map a column with large values.
    if (isPrimary && row.markerStyle?.size != null) {
      const scale = 0.5 + Math.sqrt(row.markerStyle.size / 100) * 1.5;
      return Math.min(Math.max(baseSize * scale, 3), baseSize * 2.5);
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
    fill: string;
    stroke: string | null;
    strokeWidth: number;
    shape: MarkerShape;
    opacity: number;
  } {
    const isPrimary = idx === 0;
    const markerStyle = row.markerStyle;

    // Theme effect defaults for multi-effect plots
    const themeEffectColors = theme.series.map(s => s.fill);
    // Per-series marker shapes ride on the SlotRole (theme.series[i].shape).
    // Null/undefined → fall through to the 4-shape rotation.
    const defaultShapes: MarkerShape[] = ["circle", "square", "diamond", "triangle"];

    // Resolve Layer 1+2 (per-effect literal or palette cycle) into a base color.
    // Summary rows use `colors.summaryFill` as their base so the diamond honors
    // its dedicated palette slot; non-summary rows follow the effect-color
    // cascade. Layers 3+4 (bundle.markerFill / row.markerStyle.color) still
    // layer on top via resolveMarkerStyle below.
    let baseColor: string;
    if (effect.color) {
      baseColor = effect.color;
    } else if (isSummaryRow && isPrimary) {
      baseColor = theme.series?.[0]?.fill ?? accentDefault;
    } else if (themeEffectColors && themeEffectColors.length > 0) {
      baseColor = themeEffectColors[idx % themeEffectColors.length];
    } else {
      baseColor = accentDefault ?? "#2563eb";
    }

    // Apply Layers 3+4 via the shared cascade resolver
    const ms = resolveMarkerStyle(
      baseColor,
      markerStyle?.color ?? null,
      row.style,
      validEffects.length,
      theme,
    );

    // Shape priority:
    // 1. Primary effect: row.markerStyle.shape (if set)
    // 2. effect.shape (if set)
    // 3. theme.series[idx].shape (if set; per-slot author override)
    // 4. defaultShapes[idx % 4] (the 4-shape rotation)
    // 4. Default shapes: circle, square, diamond, triangle (cycling)
    let shape: MarkerShape;
    const themeSlotShape = (theme.series?.[idx] as { shape?: MarkerShape | null } | undefined)?.shape ?? null;
    if (isPrimary && markerStyle?.shape) {
      shape = markerStyle.shape;
    } else if (effect.shape) {
      shape = effect.shape;
    } else if (themeSlotShape) {
      shape = themeSlotShape;
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

    return { fill: ms.fill, stroke: ms.stroke, strokeWidth: ms.strokeWidth, shape, opacity };
  }

  // Helper to render marker shape. `mutedOp` (when present) layers a
  // `muted`-token reduction on top of any author-set marker opacity:
  // fill scales by `mutedOp.fill`, stroke gets `stroke-opacity =
  // mutedOp.stroke`. Symmetric with the muted-text treatment so the
  // semantic feels coherent across content types.
  function renderMarker(
    cx: number, effectY: number, size: number,
    style: { fill: string; stroke: string | null; strokeWidth: number; shape: MarkerShape; opacity: number },
    mutedOp?: { fill: number; stroke: number } | null,
  ): string {
    const { fill, stroke, strokeWidth, shape, opacity } = style;
    const fillOpacity = mutedOp ? opacity * mutedOp.fill : opacity;
    const fillOpacityAttr = fillOpacity < 1 ? ` fill-opacity="${fillOpacity}"` : "";
    const strokeOpacityAttr = mutedOp && mutedOp.stroke < 1
      ? ` stroke-opacity="${mutedOp.stroke}"` : "";
    const strokeAttr = stroke
      ? ` stroke="${stroke}" stroke-width="${strokeWidth}"${strokeOpacityAttr}`
      : "";

    switch (shape) {
      case "circle":
        return `<circle cx="${cx}" cy="${effectY}" r="${size}" fill="${fill}"${fillOpacityAttr}${strokeAttr}/>`;
      case "diamond": {
        const pts = [
          `${cx},${effectY - size}`,
          `${cx + size},${effectY}`,
          `${cx},${effectY + size}`,
          `${cx - size},${effectY}`
        ].join(' ');
        return `<polygon points="${pts}" fill="${fill}"${fillOpacityAttr}${strokeAttr}/>`;
      }
      case "triangle": {
        const pts = [
          `${cx},${effectY - size}`,
          `${cx + size},${effectY + size}`,
          `${cx - size},${effectY + size}`
        ].join(' ');
        return `<polygon points="${pts}" fill="${fill}"${fillOpacityAttr}${strokeAttr}/>`;
      }
      default: // square
        return `<rect x="${cx - size}" y="${effectY - size}" width="${size * 2}" height="${size * 2}" fill="${fill}"${fillOpacityAttr}${strokeAttr}/>`;
    }
  }

  // Render each effect
  const parts: string[] = [];
  // Semantic stroke companion: when row.style is accent/emphasis/muted,
  // use bundle.markerStroke for the whisker/CI line so a recolored marker
  // doesn't sit on series[0].stroke. Mirrors the live RowInterval path.
  const rowSemBundle = resolveSemanticBundle(row.style, theme);
  const semanticLineColor = rowSemBundle?.markerStroke ?? null;
  // Muted-token mark opacity: layered onto each marker / summary
  // diamond / line below. Symmetric with the muted-text reduction.
  const mutedOp = semanticMarkOpacity(row.style);
  const mutedLineOpacityAttr = mutedOp ? ` stroke-opacity="${mutedOp.stroke}"` : "";

  validEffects.forEach((effect, idx) => {
    const effectY = yPosition + getEffectYOffset(idx, validEffects.length);
    const x1 = xScale(effect.lower!);
    const x2 = xScale(effect.upper!);
    const cx = xScale(effect.point!);
    const style = getEffectStyle(effect, idx);
    const pointSize = getPointSize(idx === 0);
    const lineColor = semanticLineColor ?? defaultLineColor;

    if (isSummaryRow) {
      // Summary row: render diamond shape spanning lower to upper.
      // Note: Summary diamonds are intentionally NOT clipped - they represent
      // the overall effect size and typically shouldn't extend beyond axis limits.
      // If clipping is needed in the future, clamp x1/x2 to clipBounds.
      const summaryFillOp = mutedOp ? style.opacity * mutedOp.fill : style.opacity;
      const opacityAttr = summaryFillOp < 1 ? ` fill-opacity="${summaryFillOp}"` : "";
      const diamondPoints = [
        `${x1},${effectY}`,
        `${cx},${effectY - halfDiamondHeight}`,
        `${x2},${effectY}`,
        `${cx},${effectY + halfDiamondHeight}`
      ].join(' ');
      parts.push(`
        <g class="interval effect-${idx} summary">
          <polygon points="${diamondPoints}"
            fill="${style.fill}"${opacityAttr} stroke="${theme.series?.[0]?.stroke ?? accentDefault}" stroke-width="1"${mutedLineOpacityAttr}/>
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
        const arrowFill = mutedOp ? arrowConfig.opacity * mutedOp.fill : arrowConfig.opacity;
        const arrowOpacity = arrowFill < 1 ? ` fill-opacity="${arrowFill}"` : "";
        leftEnd = `<path d="${renderArrowPath("left", leftArrowX, effectY, arrowConfig)}" fill="${arrowConfig.color}"${arrowOpacity}/>`;
      } else {
        // Normal whisker (use scaled whisker height matching arrow)
        leftEnd = `<line x1="${clampedX1}" x2="${clampedX1}" y1="${effectY - arrowHalfHeight}" y2="${effectY + arrowHalfHeight}" stroke="${lineColor}" stroke-width="${lineWidth}"${mutedLineOpacityAttr}/>`;
      }

      // Build right end: whisker or arrow
      let rightEnd = "";
      if (clippedRight) {
        // Arrow pointing right with scaled dimensions (include opacity from theme)
        const arrowFill = mutedOp ? arrowConfig.opacity * mutedOp.fill : arrowConfig.opacity;
        const arrowOpacity = arrowFill < 1 ? ` fill-opacity="${arrowFill}"` : "";
        rightEnd = `<path d="${renderArrowPath("right", rightArrowX, effectY, arrowConfig)}" fill="${arrowConfig.color}"${arrowOpacity}/>`;
      } else {
        // Normal whisker
        rightEnd = `<line x1="${clampedX2}" x2="${clampedX2}" y1="${effectY - arrowHalfHeight}" y2="${effectY + arrowHalfHeight}" stroke="${lineColor}" stroke-width="${lineWidth}"${mutedLineOpacityAttr}/>`;
      }

      // Clamp point estimate to visible range so markers don't render outside
      // forest area when explicit axis limits exclude the point estimate
      const clampedCx = clipBounds
        ? xScale(Math.max(clipBounds[0], Math.min(clipBounds[1], effect.point!)))
        : Math.max(minX, Math.min(maxX, cx));

      parts.push(`
        <g class="interval effect-${idx}">
          <line x1="${clampedX1}" x2="${clampedX2}" y1="${effectY}" y2="${effectY}"
            stroke="${lineColor}" stroke-width="${lineWidth}"${mutedLineOpacityAttr}/>
          ${leftEnd}
          ${rightEnd}
          ${renderMarker(clampedCx, effectY, pointSize, style, mutedOp)}
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
  theme: WebTheme,
  cssVars: Record<string, string> = {},
): string {
  const diamondHeight = 10;
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

  const accentDefault = readAccentDefault(cssVars);
  return `<polygon points="${points}"
    fill="${theme.series?.[0]?.fill ?? accentDefault}"
    stroke="${theme.series?.[0]?.stroke ?? accentDefault}"
    stroke-width="1"/>`;
}

// ============================================================================
// Viz Column Renderers (viz_bar, viz_boxplot, viz_violin)
// ============================================================================

/**
 * Render reference-line annotations for a viz column.
 * Mirrors the inline rendering in TabvizPlot.svelte for non-forest viz overlays.
 * `forest_annotation()` (CustomAnnotation) is forest-specific and skipped here.
 */
function renderVizAnnotations(
  annotations: Annotation[] | null | undefined,
  xScale: Scale,
  vizX: number,
  cssVars: Record<string, string>,
  plotY: number,
  rowsHeight: number,
  theme: WebTheme,
): string {
  if (!annotations || annotations.length === 0) return "";
  const parts: string[] = [];
  // Reference lines are structural scaffolding (null effect / baseline),
  // so they default to divider.strong (secondary-tinted) — same as the
  // forest plot's null line. Frees accent for actual layered emphasis.
  const refDefault = readDividerStrong(cssVars);
  for (const ann of annotations) {
    if (ann.type !== "reference_line") continue;
    const x = vizX + xScale(ann.x);
    const stroke = ann.color ?? refDefault;
    const strokeWidth = ann.width ?? 1;
    const opacity = ann.opacity ?? 0.6;
    const dash = ann.style === "dashed" ? "4,4" : ann.style === "dotted" ? "2,2" : "";
    parts.push(
      `<line x1="${x}" x2="${x}" y1="${plotY}" y2="${plotY + rowsHeight}" ` +
      `stroke="${stroke}" stroke-width="${strokeWidth}" stroke-opacity="${opacity}" ` +
      `stroke-dasharray="${dash}"/>`
    );
  }
  return parts.join("");
}

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
  const defaultColors = theme.series.map(s => s.fill) ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

  effects.forEach((effect, idx) => {
    const value = row.metadata[effect.value] as number | undefined;
    if (value == null || Number.isNaN(value)) return;

    const barY = yCenter - totalBarHeight / 2 + idx * (barHeight + barGap);
    const barXStart = vizX + xScale(Math.min(0, value));
    const barW = Math.abs(xScale(value) - xScale(0));
    // Marker styling cascade: per-row literal > row semantic class > per-effect literal > palette
    const baseColor = effect.color ?? defaultColors[idx % defaultColors.length];
    const ms = resolveMarkerStyle(baseColor, row.markerStyle?.color ?? null, row.style, numEffects, theme);
    const rowOpacity = row.markerStyle?.opacity ?? null;
    const opacity = rowOpacity !== null ? rowOpacity : (effect.opacity ?? 0.85);
    const mutedOp = semanticMarkOpacity(row.style);
    const fillOp = mutedOp ? opacity * mutedOp.fill : opacity;
    const strokeOpAttr = mutedOp && mutedOp.stroke < 1 ? ` stroke-opacity="${mutedOp.stroke}"` : "";
    const strokeAttr = ms.stroke
      ? ` stroke="${ms.stroke}" stroke-width="${ms.strokeWidth}"${strokeOpAttr}` : "";

    parts.push(`<rect
      x="${barXStart}" y="${barY}"
      width="${Math.max(1, barW)}" height="${barHeight}"
      fill="${ms.fill}" fill-opacity="${fillOp}"${strokeAttr} rx="2"
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
  theme: WebTheme,
  cssVars: Record<string, string> = {},
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
  const defaultColors = theme.series.map(s => s.fill) ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
  const lineColor = readContentPrimary(cssVars) ?? "#1a1a1a";
  const themeLineWidth = readVarPx(cssVars, "--tv-plot-line-width", 1.5);
  const outlierR = readVarPx(cssVars, "--tv-plot-point-size", 6) * 0.4;

  effects.forEach((effect, idx) => {
    const stats = effectStats[idx];
    if (!stats) return;

    const boxY = yCenter - totalHeight / 2 + idx * (boxHeight + boxGap);
    const boxCenterY = boxY + boxHeight / 2;
    // Marker styling cascade
    const baseColor = effect.color ?? defaultColors[idx % defaultColors.length];
    const ms = resolveMarkerStyle(baseColor, row.markerStyle?.color ?? null, row.style, numEffects, theme);
    const rowOpacity = row.markerStyle?.opacity ?? null;
    const opacity = rowOpacity !== null ? rowOpacity : (effect.opacity ?? effect.fillOpacity ?? 0.7);
    const strokeColor = ms.stroke ?? lineColor;
    // Theme's shapes.lineWidth drives the whisker/box outlines by default.
    // Per-effect stroke overrides via ms.stroke still win, as before.
    const strokeWidth = ms.stroke ? ms.strokeWidth : themeLineWidth;
    const mutedOp = semanticMarkOpacity(row.style);
    const fillOp = mutedOp ? opacity * mutedOp.fill : opacity;
    const strokeOp = mutedOp ? mutedOp.stroke : 1;
    const strokeOpAttr = strokeOp < 1 ? ` stroke-opacity="${strokeOp}"` : "";

    // Whisker lines
    // Left whisker
    parts.push(`<line
      x1="${vizX + xScale(stats.min)}" x2="${vizX + xScale(stats.q1)}"
      y1="${boxCenterY}" y2="${boxCenterY}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeOpAttr}/>`);
    // Left whisker cap
    parts.push(`<line
      x1="${vizX + xScale(stats.min)}" x2="${vizX + xScale(stats.min)}"
      y1="${boxCenterY - boxHeight / 4}" y2="${boxCenterY + boxHeight / 4}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeOpAttr}/>`);

    // Right whisker
    parts.push(`<line
      x1="${vizX + xScale(stats.q3)}" x2="${vizX + xScale(stats.max)}"
      y1="${boxCenterY}" y2="${boxCenterY}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeOpAttr}/>`);
    // Right whisker cap
    parts.push(`<line
      x1="${vizX + xScale(stats.max)}" x2="${vizX + xScale(stats.max)}"
      y1="${boxCenterY - boxHeight / 4}" y2="${boxCenterY + boxHeight / 4}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeOpAttr}/>`);

    // Box (Q1 to Q3)
    const boxW = Math.max(2, xScale(stats.q3) - xScale(stats.q1));
    parts.push(`<rect
      x="${vizX + xScale(stats.q1)}" y="${boxY}"
      width="${boxW}" height="${boxHeight}"
      fill="${ms.fill}" fill-opacity="${fillOp}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeOpAttr}/>`);

    // Median line
    parts.push(`<line
      x1="${vizX + xScale(stats.median)}" x2="${vizX + xScale(stats.median)}"
      y1="${boxY}" y2="${boxY + boxHeight}"
      stroke="${strokeColor}" stroke-width="${Math.max(2, strokeWidth)}"${strokeOpAttr}/>`);

    // Outliers — point size and stroke width scale with the theme's
    // shapes.pointSize / lineWidth so outliers match forest-plot markers.
    if (options.showOutliers !== false && stats.outliers.length > 0) {
      for (const outlier of stats.outliers) {
        parts.push(`<circle
          cx="${vizX + xScale(outlier)}" cy="${boxCenterY}"
          r="${outlierR}"
          fill="none" stroke="${ms.fill}" stroke-width="${themeLineWidth}"${strokeOpAttr}/>`);
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
  theme: WebTheme,
  cssVars: Record<string, string> = {},
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
  const defaultColors = theme.series.map(s => s.fill) ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
  const lineColor = readContentPrimary(cssVars) ?? "#1a1a1a";
  const themeLineWidth = readVarPx(cssVars, "--tv-plot-line-width", 1.5);
  // Violin outline reads thinner than a forest-plot stroke by convention;
  // scale from theme so bumping shapes.lineWidth still thickens the violin.
  const violinStrokeDefault = themeLineWidth * 0.33;
  const medianStrokeW = Math.max(1, themeLineWidth * 1.3);
  const quartileStrokeW = Math.max(0.5, themeLineWidth * 0.67);

  effects.forEach((effect, idx) => {
    const kde = effectKDEs[idx];
    const quartiles = effectQuartiles[idx];
    if (!kde || kde.x.length < 2) return;

    const violinCenterY = yCenter - totalHeight / 2 + violinHeight / 2 + idx * (violinHeight + violinGap);
    // Marker styling cascade
    const baseColor = effect.color ?? defaultColors[idx % defaultColors.length];
    const ms = resolveMarkerStyle(baseColor, row.markerStyle?.color ?? null, row.style, numEffects, theme);
    const rowOpacity = row.markerStyle?.opacity ?? null;
    const opacity = rowOpacity !== null ? rowOpacity : (effect.opacity ?? effect.fillOpacity ?? 0.5);
    const violinStroke = ms.stroke ?? lineColor;
    const violinStrokeW = ms.stroke ? ms.strokeWidth : violinStrokeDefault;
    const mutedOp = semanticMarkOpacity(row.style);
    const fillOp = mutedOp ? opacity * mutedOp.fill : opacity;
    const strokeOpAttr = mutedOp && mutedOp.stroke < 1 ? ` stroke-opacity="${mutedOp.stroke}"` : "";

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
      fill="${ms.fill}" fill-opacity="${fillOp}"
      stroke="${violinStroke}" stroke-width="${violinStrokeW}"${strokeOpAttr}/>`);

    // Median line
    if (options.showMedian !== false && quartiles) {
      const medianX = vizX + xScale(quartiles.median);
      parts.push(`<line
        x1="${medianX}" x2="${medianX}"
        y1="${violinCenterY - maxWidth * 0.6}" y2="${violinCenterY + maxWidth * 0.6}"
        stroke="${lineColor}" stroke-width="${medianStrokeW}"${strokeOpAttr}/>`);
    }

    // Quartile lines
    if (options.showQuartiles && quartiles) {
      const q1X = vizX + xScale(quartiles.q1);
      const q3X = vizX + xScale(quartiles.q3);
      parts.push(`<line
        x1="${q1X}" x2="${q1X}"
        y1="${violinCenterY - maxWidth * 0.4}" y2="${violinCenterY + maxWidth * 0.4}"
        stroke="${lineColor}" stroke-width="${quartileStrokeW}" stroke-dasharray="2,2"${strokeOpAttr}/>`);
      parts.push(`<line
        x1="${q3X}" x2="${q3X}"
        y1="${violinCenterY - maxWidth * 0.4}" y2="${violinCenterY + maxWidth * 0.4}"
        stroke="${lineColor}" stroke-width="${quartileStrokeW}" stroke-dasharray="2,2"${strokeOpAttr}/>`);
    }
  });

  return parts.join("\n");
}

/**
 * Compute shared scale for a viz_bar column across all rows.
 */
// viz_* scale helpers wrap the shared domain computation
// (`$lib/viz-domain-utils`) — used by both the browser (TabvizPlot)
// and export (here) paths so domain math is identical by construction
// (schema-sprint Phase 4d).
function vizScaleFromDomain(
  domain: { min: number; max: number },
  vizWidth: number,
  isLog: boolean,
  domainOverride?: [number, number] | null,
): Scale {
  // Shared inset range + log clamp (forest-scale.ts) — same constants as the
  // forest scale + the DOM viz path, so the three can't drift.
  const range = forestScaleRange(vizWidth);
  // Pan/zoom override from browser wins outright — bit-identical parity
  // with what the user sees in the viewport.
  const [lo, hi] = domainOverride ?? [domain.min, domain.max];
  return isLog
    ? createLogScale(safeLogDomain([lo, hi]), range)
    : createLinearScale([lo, hi], range);
}

function computeVizBarScale(
  rows: Row[],
  options: VizBarColumnOptions,
  vizWidth: number,
  domainOverride?: [number, number] | null,
): Scale {
  const domain = computeVizBarDomain(rows, options);
  return vizScaleFromDomain(domain, vizWidth, options.scale === "log", domainOverride);
}

function computeVizBoxplotScale(
  rows: Row[],
  options: VizBoxplotColumnOptions,
  vizWidth: number,
  domainOverride?: [number, number] | null,
): Scale {
  const domain = computeVizBoxplotDomain(rows, options);
  return vizScaleFromDomain(domain, vizWidth, options.scale === "log", domainOverride);
}

function computeVizViolinScale(
  rows: Row[],
  options: VizViolinColumnOptions,
  vizWidth: number,
  domainOverride?: [number, number] | null,
): Scale {
  const domain = computeVizViolinDomain(rows, options);
  return vizScaleFromDomain(domain, vizWidth, options.scale === "log", domainOverride);
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
  nullValue: number | undefined,
  isLog: boolean = false,
  cssVars: Record<string, string> = {},
): string {
  const lines: string[] = [];
  const fontSize = parseFontSize(readLabelSize(cssVars));
  const axisGeom = computeAxisLayout(
    { fontSizeSm: readLabelSize(cssVars), lineHeight: 1.5 },
    !!axisLabel,
    readVarPx(cssVars, "--tv-plot-tick-mark-length", 5),
  );

  // Plot scaffold colors (v4 cssVars → v3 fallback chain).
  const axisLineColor = readVar(
    cssVars,
    "--tv-plot-axis-line",
    theme.plot?.axisLine ?? readDividerStrong(cssVars),
  );
  const tickMarkColor = readVar(
    cssVars,
    "--tv-plot-tick-mark",
    theme.plot?.tickMark ?? readDividerSubtle(cssVars),
  );
  const tickLabelFg = readVar(
    cssVars,
    "--tv-text-muted",
    theme.plot?.tickLabel?.fg ?? readContentSecondary(cssVars),
  );
  const axisLabelFg = readVar(
    cssVars,
    "--tv-text-muted",
    theme.plot?.axisLabel?.fg ?? readContentSecondary(cssVars),
  );

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
    y1="0" y2="0" stroke="${axisLineColor}" stroke-width="1"/>`);

  // Generate "nice" ticks sized to the column width, then filter to keep
  // label spacing above the minimum pixel threshold.
  const domain = xScale.domain();
  const minSpacing = AXIS.MIN_TICK_SPACING;
  const targetCount = Math.max(2, Math.min(6, Math.floor(vizWidth / minSpacing)));
  const vizAxisConfig: AxisConfig = {
    rangeMin: null,
    rangeMax: null,
    tickCount: targetCount,
    tickValues: null,
    gridlines: false,
    gridlineStyle: "solid",
    ciClipFactor: 2.0,
    includeNull: false,
    symmetric: null,
    nullTick: false,
    markerMargin: false,
  };
  const rawTicks = generateTicks(
    [domain[0], domain[1]],
    vizAxisConfig,
    isLog ? "log" : "linear",
    nullValue ?? domain[0],
  );
  const ticks: number[] = [];
  let lastX = -Infinity;
  for (const t of rawTicks) {
    const tx = xScale(t);
    if (tx - lastX >= minSpacing) {
      ticks.push(t);
      lastX = tx;
    }
  }
  // Fallbacks for degenerate domains where generateTicks returned <2 values:
  // always emit at least the domain endpoints so the axis isn't unlabeled.
  if (ticks.length < 2) {
    ticks.length = 0;
    if (rawTicks.length >= 2) {
      ticks.push(rawTicks[0], rawTicks[rawTicks.length - 1]);
    } else if (domain[0] !== domain[1]) {
      ticks.push(domain[0], domain[1]);
    } else {
      ticks.push(domain[0]);
    }
  }

  // Tick marks and labels
  for (const tick of ticks) {
    const tickX = xScale(tick);
    const x = vizX + tickX;
    const textAnchor = getTextAnchor(tickX);
    const xOffset = getTextXOffset(tickX);
    const label = formatNumber(tick);

    lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="${axisGeom.tickMarkLength}" stroke="${tickMarkColor}" stroke-width="1"/>`);
    lines.push(`<text x="${x + xOffset}" y="${axisGeom.tickLabelY}"
      text-anchor="${textAnchor}"
      font-family="${readBodyFamily(cssVars)}"
      font-size="${fontSize}px"
      font-weight="${400}"
      fill="${tickLabelFg}">${label}</text>`);
  }

  // Axis label
  if (axisLabel) {
    lines.push(`<text x="${vizX + vizWidth / 2}" y="${axisGeom.axisLabelY}"
      text-anchor="middle"
      font-family="${readBodyFamily(cssVars)}"
      font-size="${fontSize}px"
      font-weight="${500}"
      fill="${axisLabelFg}">${escapeXml(axisLabel)}</text>`);
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
  baseTicks?: number[],
  cssVars: Record<string, string> = {},
): string {
  const lines: string[] = [];
  const tickCount = typeof theme.axis.tickCount === "number"
    ? theme.axis.tickCount
    : SPACING.DEFAULT_TICK_COUNT;

  const ticks = filterAxisTicks(xScale, tickCount, theme, nullValue, forestWidth, baseTicks);
  const fontSize = parseFontSize(readLabelSize(cssVars));
  const axisGeom = computeAxisLayout(
    { fontSizeSm: readLabelSize(cssVars), lineHeight: 1.5 },
    !!axisLabel,
    readVarPx(cssVars, "--tv-plot-tick-mark-length", 5),
  );

  // Plot scaffold colors (v4 cssVars → v3 fallback chain).
  const axisLineColor = readVar(
    cssVars,
    "--tv-plot-axis-line",
    theme.plot?.axisLine ?? readDividerStrong(cssVars),
  );
  const tickMarkColor = readVar(
    cssVars,
    "--tv-plot-tick-mark",
    theme.plot?.tickMark ?? readDividerSubtle(cssVars),
  );
  const tickLabelFg = readVar(
    cssVars,
    "--tv-text-muted",
    theme.plot?.tickLabel?.fg ?? readContentSecondary(cssVars),
  );
  const axisLabelFg = readVar(
    cssVars,
    "--tv-text-muted",
    theme.plot?.axisLabel?.fg ?? readContentSecondary(cssVars),
  );
  const gridlineColor = readVar(cssVars, "--tv-border-subtle", readDividerSubtle(cssVars));

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
    y1="0" y2="0" stroke="${axisLineColor}" stroke-width="1"/>`);

  // Gridlines (behind ticks) — mirrors EffectAxis.svelte; opt-in via
  // theme.axis.gridlines, styled per theme.axis.gridlineStyle.
  if (theme.axis.gridlines && layout.plotHeight > 0) {
    const style = theme.axis.gridlineStyle ?? "dotted";
    const dashArray = style === "dashed" ? "4,4" : style === "dotted" ? "2,2" : "none";
    const dashAttr = dashArray === "none" ? "" : ` stroke-dasharray="${dashArray}"`;
    for (const tick of ticks) {
      const x = forestX + xScale(tick);
      lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="${-layout.plotHeight}"
        stroke="${gridlineColor}" stroke-width="1"${dashAttr} opacity="0.5"/>`);
    }
  }

  // Ticks and labels
  for (const tick of ticks) {
    const tickX = xScale(tick);
    const x = forestX + tickX;
    const textAnchor = getTextAnchor(tickX);
    const xOffset = getTextXOffset(tickX);

    lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="${axisGeom.tickMarkLength}"
      stroke="${tickMarkColor}" stroke-width="1"/>`);
    lines.push(`<text x="${x + xOffset}" y="${axisGeom.tickLabelY + 2}" text-anchor="${textAnchor}"
      font-family="${theme.plot?.tickLabel?.family ?? readTypeFamily(cssVars, "tick", readBodyFamily(cssVars))}"
      font-size="${fontSize}px"
      font-weight="${theme.plot?.tickLabel?.weight ?? readTypeWeight(cssVars, "tick", 400)}"
      font-style="${(theme.plot?.tickLabel?.italic ?? theme.text.tick?.italic) ? "italic" : "normal"}"
      fill="${tickLabelFg}">${formatTick(tick)}</text>`);
  }

  // Axis label
  if (axisLabel) {
    lines.push(`<text x="${forestX + forestWidth / 2}" y="${axisGeom.axisLabelY}"
      text-anchor="middle"
      font-family="${theme.plot?.axisLabel?.family ?? readTypeFamily(cssVars, "label", readBodyFamily(cssVars))}"
      font-size="${fontSize}px"
      font-weight="${theme.plot?.axisLabel?.weight ?? readTypeWeight(cssVars, "label", 500)}"
      font-style="${(theme.plot?.axisLabel?.italic ?? theme.text.label?.italic) ? "italic" : "normal"}"
      fill="${axisLabelFg}">${escapeXml(axisLabel)}</text>`);
  }

  // Position axis at: mainY + headerHeight + rowsHeight + axisGap
  // This matches web view which positions axis at rowsAreaHeight + axisGap
  // (rowsHeight excludes overall summary, just like web's rowsAreaHeight)
  return `<g transform="translate(0, ${layout.mainY + layout.headerHeight + layout.rowsHeight + layout.axisGap})">${lines.join("\n")}</g>`;
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
  getColWidth: (col: ColumnSpec) => number,
  showLabelHeader: boolean = true,
  cssVars: Record<string, string> = {},
): string {
  const lines: string[] = [];
  const baseFontSize = parseFontSize(readBodySize(cssVars));
  // Header cells: prefer explicit theme.header.text.size when pinned
  // distinct from body.size, else 5% scale-up (matches .header-cell CSS).
  const headerExplicit = theme.header?.text?.size;
  const bodySizeStr = readBodySize(cssVars);
  const fontSize = (headerExplicit && headerExplicit !== bodySizeStr)
    ? Math.round(parseFontSize(headerExplicit) * 100) / 100
    : Math.round(baseFontSize * 1.05 * 100) / 100;
  const fontFamily = theme.header?.text?.family ?? readBodyFamily(cssVars);
  // All header cells use bold weight to match web view CSS.
  const fontWeight = theme.header?.text?.weight ?? 600;
  const boldWeight = 600;
  const cellPadX = readVarPx(cssVars, "--tv-spacing-cell-padding-x", 10);
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
    if (showLabelHeader) {
      lines.push(`<text class="cell-text" dominant-baseline="central" x="${currentX + cellPadX}" y="${getTextY(y, headerHeight)}"
        font-family="${fontFamily}"
        font-size="${fontSize}px"
        font-weight="${fontWeight}"
        fill="${(activeHeaderVariant(theme).fg)}">${escapeXml(labelHeader)}</text>`);
    }
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
        lines.push(`<text class="cell-text" dominant-baseline="central" x="${textX}" y="${getTextY(y, row1Height)}"
          font-family="${fontFamily}"
          font-size="${fontSize}px"
          font-weight="${boldWeight}"
          text-anchor="middle"
          fill="${(activeHeaderVariant(theme).fg)}">${escapeXml(col.header)}</text>`);
        groupBorders.push({ x1: currentX, x2: currentX + groupWidth });
        currentX += groupWidth;
      } else {
        const width = getColWidth(col);
        const headerAlign = col.headerAlign ?? col.align;
        if (resolveShowHeader(col.showHeader, col.header)) {
          const pad = isVizType(col.type) ? VIZ_MARGIN : cellPadX;
          const { textX, anchor } = getTextPositionPadded(currentX, width, headerAlign, pad);
          const truncatedHeader = truncateText(col.header, width, fontSize, pad, fontWeight);
          lines.push(`<text class="cell-text" dominant-baseline="central" x="${textX}" y="${getTextY(y, headerHeight)}"
            font-family="${fontFamily}"
            font-size="${fontSize}px"
            font-weight="${fontWeight}"
            text-anchor="${anchor}"
            fill="${(activeHeaderVariant(theme).fg)}">${escapeXml(truncatedHeader)}</text>`);
        }
        currentX += width;
      }
    }

    // Draw borders under groups (matches web view: .group-row { border-bottom: 1px solid var(--tv-border) })
    const groupBorderStroke = readDividerSubtle(cssVars);
    for (const border of groupBorders) {
      lines.push(`<line x1="${border.x1}" x2="${border.x2}"
        y1="${y + row1Height}" y2="${y + row1Height}"
        stroke="${groupBorderStroke}" stroke-width="1"/>`);
    }

    // Row 2: Sub-column headers
    currentX = x + labelWidth;
    for (const col of columnDefs) {
      if (col.isGroup) {
        for (const subCol of col.columns) {
          if (!subCol.isGroup) {
            const sub = subCol as ColumnSpec;
            const width = getColWidth(sub);
            const headerAlign = sub.headerAlign ?? sub.align;
            if (resolveShowHeader(sub.showHeader, sub.header)) {
              const pad = isVizType(sub.type) ? VIZ_MARGIN : cellPadX;
              const { textX, anchor } = getTextPositionPadded(currentX, width, headerAlign, pad);
              lines.push(`<text class="cell-text" dominant-baseline="central" x="${textX}" y="${getTextY(y + row1Height, row2Height)}"
                font-family="${fontFamily}"
                font-size="${fontSize}px"
                font-weight="${fontWeight}"
                text-anchor="${anchor}"
                fill="${(activeHeaderVariant(theme).fg)}">${escapeXml(sub.header)}</text>`);
            }
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

    if (showLabelHeader) {
      lines.push(`<text class="cell-text" dominant-baseline="central" x="${currentX + cellPadX}" y="${getTextY(y, headerHeight)}"
        font-family="${fontFamily}"
        font-size="${fontSize}px"
        font-weight="${fontWeight}"
        fill="${(activeHeaderVariant(theme).fg)}">${escapeXml(labelHeader)}</text>`);
    }
    currentX += labelWidth;

    for (const col of leafColumns) {
      const width = getColWidth(col);
      const headerAlign = col.headerAlign ?? col.align;
      if (resolveShowHeader(col.showHeader, col.header)) {
        // Viz columns pad by VIZ_MARGIN so the header aligns with the plot
        // region's left/right edges (where the axis begins).
        const pad = isVizType(col.type) ? VIZ_MARGIN : cellPadX;
        const { textX, anchor } = getTextPositionPadded(currentX, width, headerAlign, pad);
        const truncatedHeader = truncateText(col.header, width, fontSize, pad, fontWeight);

        lines.push(`<text class="cell-text" dominant-baseline="central" x="${textX}" y="${getTextY(y, headerHeight)}"
          font-family="${fontFamily}"
          font-size="${fontSize}px"
          font-weight="${fontWeight}"
          text-anchor="${anchor}"
          fill="${(activeHeaderVariant(theme).fg)}">${escapeXml(truncatedHeader)}</text>`);
      }
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
  autoWidths: Map<string, number>,
  getColWidth: (col: ColumnSpec) => number,
  columnPositions: number[],
  allRows: Row[] = [],
  columnSummaries: Map<string, { min: number; max: number }> = new Map(),
  rowIdToIndex: Map<string, number> = new Map(),
  banks: import("../schema/banks").EffectiveBanks | null = null,
  cssVars: Record<string, string> = {},
): string {
  const lines: string[] = [];
  const fontSize = parseFontSize(readTypeSize(cssVars, "cell", readBodySize(cssVars)));
  const cellFamily = readTypeFamily(cssVars, "cell", readBodyFamily(cssVars));
  const cellPadX = readVarPx(cssVars, "--tv-spacing-cell-padding-x", 10);
  // Use row center for text positioning - dominant-baseline:central handles vertical alignment
  const textY = y + rowHeight / 2;

  // Default cell foreground. The row.style.color + semantic-bundle fg
  // paths win over the default per-site below.
  const cellFgDefault: string = readVar(cssVars, "--tv-cell-fg", readContentPrimary(cssVars))
    ?? readContentPrimary(cssVars);

  // Render label. Semantic bundles (theme.semantics.{emphasis|muted|accent})
  // drive fg / font_weight / font_style when the row carries the matching
  // flag; the bundle's per-field `null` leaves that property at the theme
  // default, so a partial bundle (e.g. just bg on emphasis) won't clobber
  // unrelated styling.
  const indentPerLevel = theme.rowGroup?.indentPerLevel ?? SPACING.INDENT_PER_LEVEL;
  const indent = depth * indentPerLevel + (row.style?.indent ?? 0) * indentPerLevel;
  const semBundle = resolveSemanticBundle(row.style, theme);
  const fontWeight =
    semBundle?.fontWeight ??
    ((row.style?.bold ?? false) ? 600 : 400);
  const fontStyle =
    semBundle?.fontStyle ??
    (row.style?.italic ? "italic" : "normal");
  let textColor: string;
  if (row.style?.color) {
    textColor = row.style.color;
  } else if (semBundle?.fg) {
    textColor = semBundle.fg;
  } else {
    textColor = cellFgDefault;
  }

  // Don't truncate labels - they're the primary row identifier and the width
  // was already computed to fit them (either by browser measurement or SVG estimation)
  lines.push(`<text class="cell-text" dominant-baseline="central" x="${x + cellPadX + indent}" y="${textY}"
    font-family="${readBodyFamily(cssVars)}"
    font-size="${fontSize}px"
    font-weight="${fontWeight}"
    font-style="${fontStyle}"
    fill="${textColor}">${escapeXml(row.label)}</text>`);

  // Badge (if present)
  if (row.style?.badge) {
    const badgeText = String(row.style.badge);
    const badgeFontSize = fontSize * BADGE.FONT_SCALE;
    const badgeHeight = badgeFontSize + BADGE.PADDING * 2;
    // Use smart measurement for accurate label width
    const labelTextWidth = measureTextWidth(row.label, fontSize, readBodyFamily(cssVars), fontWeight);
    const badgeX = x + cellPadX + indent + labelTextWidth + BADGE.GAP;
    const badgeTextWidth = measureTextWidth(badgeText, badgeFontSize, readBodyFamily(cssVars), 600);
    const badgeWidth = badgeTextWidth + BADGE.PADDING * 2;
    const badgeY = y + (rowHeight - badgeHeight) / 2;

    const accentColor = readAccentDefault(cssVars);
    lines.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}"
      rx="3" fill="${accentColor}" opacity="0.15"/>`);
    lines.push(`<text class="cell-text" dominant-baseline="central" x="${badgeX + badgeWidth / 2}" y="${badgeY + badgeHeight / 2}"
      text-anchor="middle"
      font-family="${readBodyFamily(cssVars)}"
      font-size="${badgeFontSize}px"
      font-weight="${600}"
      fill="${accentColor}">${escapeXml(badgeText)}</text>`);
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
    const { textX, anchor } = getTextPositionPadded(currentX, width, col.align, cellPadX);

    // ────────────────────────────────────────────────────────────────
    // Schema dispatch (Phase 7e.4b). Cells whose schema registers an
    // `svg` renderer produce a RenderNode tree, run through
    // `applyTheme(tree, nodeRules)` for tag overlays, then serialize
    // to SVG markup. Visual cells (bar, sparkline, …) keep their
    // inline branches below because they're not text composition;
    // they don't register an svg renderer so the dispatch returns
    // null and we fall through.
    {
      const cellSch = row.cellStyles?.[col.field];
      const rowSch  = row.style;
      const rowIndex = rowIdToIndex.get(row.id);
      // styleMapping resolution (Phase 5): per-cell conditions / field
      // references / static overrides. Pre-computed cellStyles win; the
      // resolver only fires when the column has a styleMapping and the
      // row has no explicit cellStyles entry. Mirrors TabvizPlot's
      // getCellStyleBase precedence.
      const mappedStyle = !cellSch && col.styleMapping
        ? resolveStyleMapping(row, rowIndex, col, banks)
        : undefined;
      const tree = schemaRenderCell(
        col,
        row.metadata[col.field],
        {
          cellWidth:  width,
          rowHeight,
          row:        row.metadata,
          target:     "svg",
          cellStyle:  cellSch ?? mappedStyle ?? rowSch,
          naText:     col.options?.naText ?? null,
          theme,
          columnSummary: columnSummaries.get(col.id) ?? null,
          rowIndex,
          banks,
        },
        theme.nodeRules,
        "svg",
      );
      if (tree) {
        const resolver = makeThemeResolver(theme, cssVars);
        // Apply the same cellStyle precedence the legacy text branch
        // does (bold / italic / color → semantic bundle → theme
        // default). Wrap the tree's markup in a <g> with these
        // attrs; text nodes that don't carry their own fill / weight
        // inherit from this <g>.
        const cellStyle = cellSch ?? rowSch ?? undefined;
        const cellSemBundle =
          resolveSemanticBundle(cellSch, theme) ??
          resolveSemanticBundle(rowSch,  theme);
        let cellFontWeight = 400;
        if (cellStyle?.bold) cellFontWeight = 600;
        else if (cellSemBundle?.fontWeight != null) cellFontWeight = cellSemBundle.fontWeight;
        let cellFontStyle = "normal";
        if (cellStyle?.italic) cellFontStyle = "italic";
        else if (cellSemBundle?.fontStyle != null) cellFontStyle = cellSemBundle.fontStyle;
        let cellColor: string = cellFgDefault;
        if (cellStyle?.color)         cellColor = cellStyle.color;
        else if (cellSemBundle?.fg)   cellColor = cellSemBundle.fg;

        const out = renderNodeToSvg(tree, resolver);
        const originX = anchor === "end" ? textX - out.width
                      : anchor === "middle" ? textX - out.width / 2
                      : textX;
        // Vertical anchor: text dominant-baseline is "central" in
        // the legacy branch (text emits at textY); for the tree
        // path, renderNodeToSvg places content with `0,0` at the
        // top-left, so shift up so the visual center aligns with
        // textY (rough approximation: subtract half the tree height).
        const originY = textY - out.height / 2;
        lines.push(
          `<g font-family="${readBodyFamily(cssVars)}" font-size="${fontSize}px" ` +
          `font-weight="${cellFontWeight}" font-style="${cellFontStyle}" fill="${cellColor}" ` +
          `transform="translate(${originX} ${originY})">${out.markup}</g>`,
        );
        continue;
      }
    }

    // Catch-all text fallback. Schema renderers cover every concrete
    // type currently in the registry (Phase 4a-c); this path fires only
    // for un-registered schemas (e.g. third-party additions without an
    // svg renderer) and computes its text via the trimmed `getCellValue`
    // below. Uses cellStyle / rowStyle precedence to mirror the live
    // .data-cell semantic styling.
    const cellStyle = row.cellStyles?.[col.field];
    const rowStyle = row.style;

    const cellSemBundle =
      resolveSemanticBundle(cellStyle, theme) ??
      resolveSemanticBundle(rowStyle, theme);

    let cellFontWeight = 400;
    if (cellStyle?.bold || rowStyle?.bold) {
      cellFontWeight = 600;
    } else if (cellSemBundle?.fontWeight != null) {
      cellFontWeight = cellSemBundle.fontWeight;
    }

    let cellFontStyle = "normal";
    if (cellStyle?.italic || rowStyle?.italic) {
      cellFontStyle = "italic";
    } else if (cellSemBundle?.fontStyle != null) {
      cellFontStyle = cellSemBundle.fontStyle;
    }

    let cellColor = cellFgDefault;
    if (cellStyle?.color) {
      cellColor = cellStyle.color;
    } else if (rowStyle?.color) {
      cellColor = rowStyle.color;
    } else if (cellSemBundle?.fg != null) {
      cellColor = cellSemBundle.fg;
    }

    const wrapVal = (col as { wrap?: boolean | number }).wrap;
    const wrapEnabled = typeof wrapVal === "number" ? wrapVal > 0 : !!wrapVal;
    if (wrapEnabled) {
      const cap = typeof wrapVal === "number" ? (wrapVal as number) + 1 : 2;
      const cellPadding = readVarPx(cssVars, "--tv-spacing-cell-padding-x", 10) * 2;
      const contentWidth = Math.max(1, width - cellPadding);
      const wrappedLines = wrapTextIntoLines(value, contentWidth, fontSize, cap);
      const lineHeight = 1.5;
      const lineHeightPx = Math.ceil(fontSize * lineHeight);
      const blockHeight = lineHeightPx * wrappedLines.length;
      const blockTop = y + (rowHeight - blockHeight) / 2;
      for (let li = 0; li < wrappedLines.length; li++) {
        const lineY = blockTop + li * lineHeightPx + Math.round(fontSize * 0.8);
        lines.push(`<text class="cell-text" dominant-baseline="central" x="${textX}" y="${lineY}"
          font-family="${readBodyFamily(cssVars)}"
          font-size="${fontSize}px"
          font-weight="${cellFontWeight}"
          font-style="${cellFontStyle}"
          text-anchor="${anchor}"
          fill="${cellColor}">${escapeXml(wrappedLines[li])}</text>`);
      }
    } else {
      lines.push(`<text class="cell-text" dominant-baseline="central" x="${textX}" y="${textY}"
        font-family="${readBodyFamily(cssVars)}"
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

// Compute vertical stagger offsets for refline labels whose x positions would
// collide. For each label, pick the lowest tier whose occupied labels are all
// at least MIN_LABEL_SPACING away in x — handles 3+ adjacent collisions.
function computeRefLineLabelOffsets(
  annotations: Array<{ id: string; x: number; label?: string }>,
  xScale: (v: number) => number
): Record<string, number> {
  const MIN_LABEL_SPACING = 120;
  const STAGGER_OFFSET = 16;
  const labeled = annotations
    .filter((a) => !!a.label)
    .map((a) => ({ id: a.id, x: xScale(a.x) }))
    .sort((a, b) => a.x - b.x);
  const offsets: Record<string, number> = {};
  const tiers: number[][] = []; // tiers[i] = array of x positions already placed on tier i
  for (const current of labeled) {
    let placed = false;
    for (let tier = 0; tier < tiers.length; tier++) {
      if (tiers[tier].every((x) => Math.abs(current.x - x) >= MIN_LABEL_SPACING)) {
        tiers[tier].push(current.x);
        offsets[current.id] = tier * STAGGER_OFFSET;
        placed = true;
        break;
      }
    }
    if (!placed) {
      tiers.push([current.x]);
      offsets[current.id] = (tiers.length - 1) * STAGGER_OFFSET;
    }
  }
  return offsets;
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
  opacity: number = 0.6,
  labelY?: number,
  cssVars: Record<string, string> = {},
): string {
  const dashArray = style === "dashed" ? "6,4" : style === "dotted" ? "2,2" : "";
  const dashAttr = dashArray ? ` stroke-dasharray="${dashArray}"` : "";
  let svg = `<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"
    stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}"${dashAttr}/>`;

  if (label) {
    const labelColor = readContentSecondary(cssVars);
    const ty = labelY ?? y1 - 4;
    svg += `<text x="${x}" y="${ty}" text-anchor="middle"
      font-family="${readBodyFamily(cssVars)}"
      font-size="${readLabelSize(cssVars)}"
      font-weight="${500}"
      fill="${labelColor}">${escapeXml(label)}</text>`;
  }

  return svg;
}

// ============================================================================
// Border helpers — Phase 11 layout × type border model
// ============================================================================

import type { BorderSpec } from "$types/theme-resolved";

/**
 * Emit one SVG line obeying a BorderSpec. `single` → one stroke;
 * `double` → two parallel hairlines with a `thickness`-sized gap
 * centered on the requested line. Returns an empty string when
 * `thickness <= 0` (the caller can append unconditionally).
 */
function borderLineSvg(
  x1: number, y1: number, x2: number, y2: number, spec: BorderSpec,
): string {
  if (!spec || spec.thickness <= 0) return "";
  if (spec.style === "double") {
    // Render as two hairlines offset perpendicular to the line. The
    // current emitters only need horizontal + vertical lines, so we
    // branch on orientation.
    const horizontal = y1 === y2;
    const gap = Math.max(1, spec.thickness);
    const off = (gap + 1) / 2;
    if (horizontal) {
      return [
        `<line x1="${x1}" x2="${x2}" y1="${y1 - off}" y2="${y2 - off}" stroke="${spec.color}" stroke-width="1"/>`,
        `<line x1="${x1}" x2="${x2}" y1="${y1 + off}" y2="${y2 + off}" stroke="${spec.color}" stroke-width="1"/>`,
      ].join("");
    }
    return [
      `<line x1="${x1 - off}" x2="${x2 - off}" y1="${y1}" y2="${y2}" stroke="${spec.color}" stroke-width="1"/>`,
      `<line x1="${x1 + off}" x2="${x2 + off}" y1="${y1}" y2="${y2}" stroke="${spec.color}" stroke-width="1"/>`,
    ].join("");
  }
  return `<line x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" stroke="${spec.color}" stroke-width="${spec.thickness}"/>`;
}

/** Are horizontal row dividers drawn under the current layout? */
function layoutHasHorizontal(layout: string): boolean {
  return layout === "horizontal" || layout === "grid";
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
  if (!theme.surface || typeof theme.surface !== "object") {
    throw new SVGGeneratorError("Invalid spec: missing or invalid 'theme.surface'");
  }
  if (!theme.text || typeof theme.text !== "object") {
    throw new SVGGeneratorError("Invalid spec: missing or invalid 'theme.text'");
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
 * Compute the natural dimensions of a spec without rendering.
 *
 * Calls `computeLayout()` with empty options so width / height are derived
 * purely from the spec's column widths, row count, theme spacing, and chrome
 * (header, footer, axis). Cheap-ish (no SVG string emission) and useful for:
 *
 *   - the public `tabviz_natural_dimensions(spec)` R helper
 *   - the lever-ladder code that needs to know natural dimensions before
 *     deciding how to absorb an aspect change
 *   - test assertions that pin the natural shape of fixture specs
 *
 * Returns logical px (matching what `generateSVG()` would emit at default
 * options).
 */
/**
 * Materialize the effective column list: prepend `labelColumn` to
 * `columns` when set. Non-destructive (returns a new spec object).
 * Lets the rest of the export pipeline read `spec.columns` uniformly
 * without per-callsite labelColumn awareness.
 */
function normalizeLabelColumn(spec: WebSpec): WebSpec {
  if (!spec.labelColumn) return spec;
  return {
    ...spec,
    columns: [spec.labelColumn, ...spec.columns],
    labelColumn: null,
  };
}

export function computeNaturalDimensions(spec: WebSpec): {
  width: number;
  height: number;
  aspect: number;
} {
  spec = normalizeLabelColumn(spec);
  validateSpec(spec);
  const layout = computeLayout(spec, {});
  return {
    width:  layout.totalWidth,
    height: layout.totalHeight,
    aspect: layout.totalWidth / layout.totalHeight,
  };
}

// ============================================================================
// Layout Metrics — sizing-verification harness (docs/dev/sizing-model.md §6b)
// ============================================================================
//
// Flat serializable snapshot of the real SVG/V8 layout path: per-row
// height/top/marker-center/kind, per-column resolved width, chrome dims, and
// an echo of the spacing tokens that drove the layout (so a snapshot also
// records WHICH token value was consumed — catches dead-token / density-not-
// applied regressions, not just geometry drift). Consumed by
// layout-metrics.test.ts (snapshot gate) and, later, the debug-shapes view.

export interface RowMetric {
  index: number;
  kind: RowKind;
  /** Group-nesting depth (drives group-header indent + tier). */
  depth: number;
  /** Per-row authored indent level (row.style.indent), distinct from `depth`.
   *  Total label indent = (depth + indent) × indentPerLevel. */
  indent: number;
  height: number;
  top: number;
  markerCenter: number;
}

export interface ColMetric {
  id: string;
  type: string;
  width: number;
  /** Absolute left X of the column's cell box (px from svg origin). */
  x: number;
}

export interface LayoutMetrics {
  totalWidth: number;
  totalHeight: number;
  headerHeight: number;
  axisHeight: number;
  labelWidth: number;
  plotHeight: number;
  rowsHeight: number;
  /** Absolute Y of the top of the column-header band (svg origin). The
   *  data-rows area starts at mainY + headerHeight; a row's absolute top is
   *  mainY + headerHeight + row.top. */
  mainY: number;
  spacing: {
    rowHeight: number;
    headerHeight: number;
    cellPaddingX: number;
    cellPaddingY: number;
    rowGroupPadding: number;
    indentPerLevel: number;
    padding: number;
    axisGap: number;
  };
  rows: RowMetric[];
  columns: ColMetric[];
}


/** Compute the SVG/V8-path layout metrics for a spec. Pure; no rendering. */
export function computeLayoutMetrics(
  spec: WebSpec,
  options: ExportOptions = {},
): LayoutMetrics {
  spec = normalizeLabelColumn(spec);
  spec = compileVariants(spec);
  validateSpec(spec);

  const theme = spec.theme;
  const cssVars = getCssVars(theme);
  const padding = readVarPx(cssVars, "--tv-spacing-padding", 8);
  const forestSettings = getForestColumnSettings(spec);
  const layout = computeLayout(spec, options, forestSettings.nullValue);

  const columnsArr = Array.isArray(spec.columns) ? spec.columns : [];
  const primaryCol = getPrimaryColumn(columnsArr);
  const allColumns = flattenAllColumns(columnsArr).filter(
    (c) => c.id !== primaryCol?.id,
  );

  // Mirror generateSVG's getColWidth: multi-flex distribution first, then the
  // legacy precedence (autoWidths → explicit → forest/viz/default).
  const colWidth = (col: ColumnSpec): number => {
    const flexed = layout.flexWidths?.[col.id];
    if (typeof flexed === "number") return flexed;
    const pre = layout.autoWidths.get(col.id);
    if (pre !== undefined) return pre;
    if (typeof col.width === "number") return col.width;
    if (col.type === "forest") return col.options?.forest?.width ?? vizNaturalWidthForColumn(col) ?? LAYOUT.DEFAULT_COLUMN_WIDTH;
    return vizNaturalWidthForColumn(col) ?? LAYOUT.DEFAULT_COLUMN_WIDTH;
  };

  // Column X positions: label slot first at `padding`, then data columns in
  // order. Mirrors generateSVG's columnPositions (currentX = padding +
  // labelWidth, then accumulate getColWidth) so debug-shapes boxes land on
  // the real cell origins.
  const columns: ColMetric[] = [];
  let cursorX = padding;
  if (primaryCol) {
    columns.push({ id: primaryCol.id, type: primaryCol.type, width: layout.labelWidth, x: cursorX });
    cursorX += layout.labelWidth;
  }
  for (const col of allColumns) {
    const w = colWidth(col);
    columns.push({ id: col.id, type: col.type, width: w, x: cursorX });
    cursorX += w;
  }

  const displayRows = buildDisplayRows(spec);
  const rows: RowMetric[] = displayRows.map((dr, i) => ({
    index: i,
    kind: resolveRowKind(dr),
    depth: dr.depth ?? 0,
    indent: (dr.type === "data" ? dr.row.style?.indent : undefined) ?? 0,
    height: layout.rowHeights[i] ?? layout.rowHeight,
    top: layout.rowPositions[i] ?? 0,
    markerCenter: layout.rowMarkerCenters[i] ?? 0,
  }));

  return {
    totalWidth: layout.totalWidth,
    totalHeight: layout.totalHeight,
    headerHeight: layout.headerHeight,
    axisHeight: layout.axisHeight,
    labelWidth: layout.labelWidth,
    plotHeight: layout.plotHeight,
    rowsHeight: layout.rowsHeight,
    mainY: layout.mainY,
    spacing: {
      rowHeight:       readVarPx(cssVars, "--tv-spacing-row-height", 34),
      headerHeight:    readVarPx(cssVars, "--tv-spacing-header-height", 34),
      cellPaddingX:    readVarPx(cssVars, "--tv-spacing-cell-padding-x", 10),
      cellPaddingY:    readVarPx(cssVars, "--tv-spacing-cell-padding-y", 0),
      rowGroupPadding: readVarPx(cssVars, "--tv-spacing-row-group-padding", 0),
      indentPerLevel:  readVarPx(cssVars, "--tv-spacing-indent-per-level", SPACING.INDENT_PER_LEVEL),
      padding,
      axisGap:         readVarPx(cssVars, "--tv-spacing-axis-gap", 12),
    },
    rows,
    columns,
  };
}

/**
 * Mode 3 lever ladder (Phase 7A — direction-aware, width-first).
 *
 * For an aspect-changed render, the layout is recalculated to hit the
 * target dims by walking explicit levers — never by SVG-stretching the
 * output. Levers run in priority order so the user's intent
 * ("preserve readability" implicit when going wide; "use vertical
 * space for content" implicit when going tall) is honoured.
 *
 * **Width ladder (always, both directions):**
 *   1A. Flex columns absorb cap-clamped at `[naturalFlex/flexCap, naturalFlex*flexCap]`.
 *   1B. Non-flex auto-width columns proportionally scale to absorb the residual.
 *       (Replaces v0.30's at-least-width-fallback piggyback, which
 *       incorrectly let forest grow past the cap when the inner
 *       generateSVG re-applied the at-least-width logic.)
 *
 * **Height ladder (direction-aware):**
 *   - When `targetHeight > naturalHeight` (taller): split delta between
 *     vertical chrome spacing tokens (`headerGap` / `axisGap` /
 *     `footerGap` / `headerHeight`) and `rowHeight`. Spacing absorbs a
 *     small share so the table doesn't look top-heavy at extreme
 *     ratios. (Phase 7D will introduce auto-wrap as Lever 2B before
 *     these.)
 *   - When `targetHeight < naturalHeight` (shorter): shrink `rowHeight`
 *     first, **floored at `MIN_ROW_HEIGHT` = `1.4 × body_font_size + 4`**
 *     for legibility. If the floor saturates and the aspect can't be
 *     met, the remainder is silently approximate — Phase 7B's
 *     diagnostic will surface this in a follow-up.
 *
 * Live widget mirror: `tabvizStore.svelte.ts`'s layout-derived getter
 * runs the same ladder so slider drag and `save_plot()` agree on
 * shape.
 */
function generateSVGForAspectTarget(
  spec: WebSpec,
  options: ExportOptions,
): string {
  const targetWidth = options.targetWidth as number;
  const targetHeight = options.targetHeight as number;
  const flexCap = Math.max(1, options.flexCap ?? ASPECT.FLEX_CAP);

  // ----- Natural baseline -----
  const naturalLayout = computeLayout(spec, {});
  const allColumns = flattenAllColumns(spec.columns);
  const autoWidths = calculateSvgAutoWidths(spec, allColumns);

  // Classify columns. A column is "flex" iff it opts in via `flex: true`
  // AND has no explicit numeric width. Non-flex auto-width columns
  // (`flex !== true && width is auto/null`) participate in Lever 1B.
  // Pinned columns (numeric width) are immutable.
  const isFlex = (c: ColumnSpec): boolean =>
    columnFlexesForAspect(c) && (c.width === "auto" || c.width == null);
  const isNonFlexAuto = (c: ColumnSpec): boolean =>
    !isFlex(c) && (c.width === "auto" || c.width == null);
  const nonFlexAutoCols = allColumns.filter(isNonFlexAuto);
  // Natural width of the flex region = sum of every flex column's distributed
  // natural width (forest is just one high-weight flex column among them).
  const naturalForestWidth = allColumns
    .filter(isFlex)
    .reduce((s, c) => s + (naturalLayout.flexWidths?.[c.id] ?? 0), 0);
  // Sum of natural auto-widths across non-flex auto cols. Used by Lever
  // 1B to scale them proportionally.
  const naturalNonFlexSum = nonFlexAutoCols.reduce(
    (s, c) => s + (autoWidths.get(c.id) ?? 0),
    0,
  );

  // Width + height ladder math runs through the shared computeAspectLadder()
  // below (after the auto-wrap loop, which feeds it heightDeltaConsumed). The
  // classification + sums above (naturalForestWidth, naturalNonFlexSum) are its
  // inputs; the apply step below consumes its outputs.

  // ----- Height ladder inputs (direction-aware) -----
  const naturalRowHeight = spec.theme.spacing?.rowHeight ?? 32;
  const naturalPlotHeight = naturalLayout.plotHeight;
  const naturalChromeHeight = naturalLayout.totalHeight - naturalPlotHeight;
  // chromeScale's denominator is the *scalable* subset of natural
  // chrome (the spec.theme.spacing values the apply step below
  // actually scales, weighted by which ones contribute to this
  // spec's totalHeight), NOT `naturalChromeHeight`. The latter
  // also includes fixed, font-derived bits (axisRegionHeight,
  // header/footer text-height) and `padding` (deliberately not
  // scaled — keeps width unchanged at Phase 7C). Using the full
  // chrome as denominator under-delivered: `chromeScale ×
  // scalableSubset + fixedSubset` came out short of
  // `naturalChromeHeight + chromeDelta`. Mirror keys exactly with
  // the apply step at the bottom of this function — and gate each
  // key on whether the corresponding chrome contributor is
  // actually rendered for this spec (no footer → no footerGap, no
  // title+subtitle pair → no titleSubtitleGap, etc.).
  const sp = spec.theme.spacing as unknown as Record<string, number | undefined>;
  // Apply step (below) scales these same keys; mirror them exactly.
  const VERTICAL_KEYS = ["headerGap", "axisGap", "footerGap", "headerHeight",
                         "rowGroupPadding", "bottomMargin", "titleSubtitleGap"];
  const hasTitle = !!spec.labels?.title;
  const hasSubtitle = !!spec.labels?.subtitle;
  const hasFooter = !!(spec.labels?.caption || spec.labels?.footnote);
  const hasAxis = naturalLayout.axisHeight > 0;
  const groupHeaderCount = buildDisplayRows(spec).filter(
    r => r.type === "group_header" && (r as { depth?: number }).depth === 0,
  ).length;
  const scalableChromeHeight = computeScalableChromeHeight({
    spacing: sp,
    hasAxis,
    hasTitle,
    hasSubtitle,
    hasFooter,
    topLevelGroupCount: groupHeaderCount,
  });
  const heightDelta = targetHeight - naturalLayout.totalHeight;
  // MIN_ROW_HEIGHT keeps text readable when shrinking. 1.4 × font + 4
  // matches the line-height + 4 px breathing pattern used in
  // computeAxisLayout / measureWrap. Falls back to 14 px floor.
  const bodyFontSize = parseFontSize(readBodySize(getCssVars(spec.theme)));
  const MIN_ROW_HEIGHT = minRowHeightFor(bodyFontSize);

  // Phase 7D: auto-wrap loop. When the target is taller than natural,
  // try to absorb the height delta by bumping `wrap` on eligible
  // text/label columns instead of growing rowHeight + chrome. Each
  // iteration bumps wrap by 1 across all eligible columns and
  // re-measures via `computeLayout`; loop stops when achieved height
  // reaches target, the wrap cap (5) saturates, or the iteration cap
  // (3) is hit. Overshoots are rolled back one step.
  //
  // Only fires when:
  //   - `options.autoWrap === true` (opt-in via save_plot(auto_wrap=TRUE))
  //   - `heightDelta > naturalLayout.totalHeight * 0.15` (>= 15 %
  //     headroom, otherwise the wrap dance isn't worth the layout passes)
  //   - At least one eligible column exists
  //
  // When auto-wrap consumes the delta, the chrome / rowHeight scales
  // stay at 1.0 — the height ladder hands off to wrap entirely.
  let autoWrapBumpedCols: Array<{ id: string; wrap: number }> = [];
  let autoWrapConsumedDelta = false;
  if (options.autoWrap === true && heightDelta > naturalLayout.totalHeight * 0.15) {
    const WRAP_CAP = 5;
    const ITER_CAP = 3;
    // Eligibility: text/label columns with wrap < WRAP_CAP. Author wrap
    // values are respected as a floor — we only bump UP from whatever
    // value is set. (A future refinement: distinguish "explicitly pinned"
    // via a sentinel default — see plan, Phase 7D notes.)
    const wrapValue = (c: ColumnSpec): number => {
      const w = c.wrap as unknown;
      if (typeof w === "number") return w;
      if (w === true) return 1;
      return 0;
    };
    const eligible = allColumns
      .filter(c => c.type === "text")
      .filter(c => wrapValue(c) < WRAP_CAP);

    if (eligible.length > 0) {
      // Working clone for the loop. We re-clone after the loop to
      // preserve the natural baseline for the height-ladder math below
      // (in case auto-wrap doesn't fully consume the delta and we need
      // to fall through to chrome / rowHeight scaling).
      const wrapClone: WebSpec = (typeof structuredClone === "function"
        ? structuredClone(spec)
        : JSON.parse(JSON.stringify(spec))) as WebSpec;
      const wrapMap = new Map(eligible.map(c => [c.id, wrapValue(c)]));
      let prevHeight = naturalLayout.totalHeight;

      for (let iter = 0; iter < ITER_CAP; iter++) {
        // Bump every eligible column by 1.
        let anyBumped = false;
        for (const id of wrapMap.keys()) {
          const cur = wrapMap.get(id)!;
          if (cur < WRAP_CAP) {
            wrapMap.set(id, cur + 1);
            anyBumped = true;
          }
        }
        if (!anyBumped) break;

        // Apply to clone + re-measure.
        for (const col of flattenAllColumns(wrapClone.columns)) {
          if (wrapMap.has(col.id)) col.wrap = wrapMap.get(col.id)!;
        }
        const testLayout = computeLayout(wrapClone, {});
        const achieved = testLayout.totalHeight;

        // Early exit: bumping wrap had no effect on layout height.
        // Content is short enough that the wrap allowance doesn't
        // trigger any actual line wrapping — bumping further is
        // pointless. Roll back the last bump (it was a no-op) and exit.
        if (achieved <= prevHeight + 0.5) {
          for (const id of wrapMap.keys()) {
            wrapMap.set(id, Math.max(0, wrapMap.get(id)! - 1));
          }
          break;
        }

        if (achieved >= targetHeight) {
          // Hit or overshot. If overshot significantly, roll back one step.
          const overshoot = achieved - targetHeight;
          const undershoot = targetHeight - prevHeight;
          if (overshoot > undershoot && iter > 0) {
            // Previous step was closer — restore it.
            for (const id of wrapMap.keys()) {
              wrapMap.set(id, Math.max(0, wrapMap.get(id)! - 1));
            }
          }
          autoWrapConsumedDelta = true;
          break;
        }
        prevHeight = achieved;
      }

      // Record bumps that exceed the author's original wrap value.
      autoWrapBumpedCols = Array.from(wrapMap.entries())
        .filter(([id, w]) => {
          const orig = eligible.find(c => c.id === id);
          return orig != null && w > wrapValue(orig);
        })
        .map(([id, wrap]) => ({ id, wrap }));
    }
  }

  // Shared width + height ladder. naturalFlexWidth = the forest plot region
  // (export's canonical flex region); heightDeltaConsumed hands off to the
  // auto-wrap loop above when it absorbed the delta.
  const ladder = computeAspectLadder({
    targetWidth,
    targetHeight,
    naturalWidth: naturalLayout.totalWidth,
    naturalHeight: naturalLayout.totalHeight,
    naturalFlexWidth: naturalForestWidth,
    naturalNonFlexAutoSum: naturalNonFlexSum,
    scalableChromeHeight,
    naturalPlotHeight,
    naturalChromeHeight,
    naturalRowHeight,
    flexCap,
    minRowHeight: MIN_ROW_HEIGHT,
    heightDeltaConsumed: autoWrapConsumedDelta,
  });
  // Height ladder outputs (width comes from the multi-flex distribution below).
  const rowHeightScale = ladder.rowHeightScale;
  const chromeScale = ladder.chromeScale;

  // ----- Apply: spec clone -----
  const adjustedSpec: WebSpec = (typeof structuredClone === "function"
    ? structuredClone(spec)
    : JSON.parse(JSON.stringify(spec))) as WebSpec;

  // Width: distribute the aspect target across all (non-primary) columns by
  // weight × natural, cap-bounded (cap === flexCap; 1 = flex disabled), then pin
  // each column's width so the inner render reproduces it exactly. Replaces the
  // old single-forest absorption + non-flex scale; matches the DOM aspect path.
  // (docs/dev/multi-flex-columns.md)
  const aspectPadding = readVarPx(getCssVars(spec.theme), "--tv-spacing-padding", 16);
  const aspectPrimaryId = getPrimaryColumn(spec.columns)?.id;
  const aspectFlexSpecs: ColumnWidthSpec[] = allColumns
    .filter((c) => c.id !== aspectPrimaryId)
    .map((c) => {
      const explicit = typeof c.width === "number" ? c.width : null;
      const measured = autoWidths.get(c.id);
      const natural = explicit ?? measured ?? vizNaturalWidthForColumn(c) ?? getEffectiveWidth(c, autoWidths);
      return {
        id: c.id,
        naturalWidth: natural,
        flexWeight: flexWeightForColumn(c),
        explicitWidth: explicit,
        minWidth: measured ?? undefined,
        cap: flexCap,
      };
    });
  const aspectWidths = resolveFlexWidths(
    aspectFlexSpecs,
    Math.max(0, targetWidth - aspectPadding * 2 - naturalLayout.labelWidth),
  ).widths;
  for (const col of flattenAllColumns(adjustedSpec.columns)) {
    const w = aspectWidths[col.id];
    if (typeof w === "number") col.width = w;
  }

  // 7D: write bumped wrap values onto eligible columns. Renderer
  // grows row heights to accommodate; layout naturally lands closer
  // to targetHeight without scaling chrome / rowHeight.
  if (autoWrapBumpedCols.length > 0) {
    const bumpMap = new Map(autoWrapBumpedCols.map(b => [b.id, b.wrap]));
    for (const col of flattenAllColumns(adjustedSpec.columns)) {
      if (bumpMap.has(col.id)) col.wrap = bumpMap.get(col.id)!;
    }
  }

  // 2A + 2C: scale theme spacing tokens. Vertical chrome scales by
  // chromeScale; rowHeight by rowHeightScale.
  if (adjustedSpec.theme?.spacing) {
    const sp = adjustedSpec.theme.spacing as unknown as Record<string, number | undefined>;
    sp.rowHeight = (sp.rowHeight ?? 32) * rowHeightScale;
    if (Math.abs(chromeScale - 1) > 1e-6) {
      // Vertical chrome contributors. headerGap / axisGap / footerGap /
      // headerHeight are the user-visible bands; padding is sliced
      // top and bottom too but is also a horizontal contributor —
      // leaving it alone keeps width unchanged (Phase 7C). The same
      // key list is the chromeScale denominator above
      // (`scalableChromeHeight`), so what we scale here matches what
      // the math budgets — no under-delivery from "scale solves for
      // 155 px but only 72 px is mutable" anymore.
      for (const k of VERTICAL_KEYS) {
        if (typeof sp[k] === "number") sp[k] = (sp[k] as number) * chromeScale;
      }
    }
  }

  // 7D: stash auto-wrap result on globalThis so R-side can retrieve it
  // and emit a cli_inform listing the bumped columns. Cleared on every
  // call so consecutive renders don't show stale info.
  (globalThis as { lastAutoWrapResult?: unknown }).lastAutoWrapResult =
    autoWrapBumpedCols;

  // ----- Render at exact target width -----
  // We've sized every column explicitly; the standard at-least-width
  // path won't kick in (totalTableWidth + flex == targetWidth by
  // construction, modulo Lever 1B's < targetWidth saturation, which is
  // intentional). Pass width=targetWidth so the SVG root reports it.
  const innerOptions: ExportOptions = {
    ...options,
    targetWidth: undefined,
    targetHeight: undefined,
    flexCap: undefined,
    autoWrap: undefined,
    width: targetWidth,
    height: undefined,
  };
  return generateSVG(adjustedSpec, innerOptions);
}

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
  // Normalize the labelColumn slot into the columns array so all
  // downstream layout / drawing reads from a single uniform shape.
  spec = normalizeLabelColumn(spec);
  // Variant compile pass — populates options.<bucket>.__resolved on
  // variant-bearing columns so renderers read primitives instead of
  // branching on the variant id. The browser path runs this inside
  // setSpec; the SVG export path mirrors here so V8 stays equivalent.
  // Pure + idempotent.
  spec = compileVariants(spec);
  // Validate input
  validateSpec(spec);

  // Mode 3 (aspect-changed) lever ladder. R-side passes targetWidth +
  // targetHeight + flexCap; we precompute natural dims, scale rowHeight
  // for the height delta, and rewrite options.width to the cap-clamped
  // flex absorption value. The recursive call then runs the standard
  // layout path on the adjusted spec, so width / height fall out of the
  // layout calculation rather than being SVG-stretched.
  if (
    typeof options.targetWidth === "number" &&
    typeof options.targetHeight === "number"
  ) {
    return generateSVGForAspectTarget(spec, options);
  }

  const theme = spec.theme;
  const cssVars = getCssVars(theme);
  const padding = readVarPx(cssVars, "--tv-spacing-padding", 8);

  // Ensure columns is an array (guard against R serialization issues)
  const columns = Array.isArray(spec.columns) ? spec.columns : [];

  // Get all columns in unified order, excluding the primary column — it is
  // rendered in the prepended "label" slot by the SVG pipeline.
  const primaryColFull = getPrimaryColumn(columns);
  const allColumns = flattenAllColumns(columns).filter(c => c.id !== primaryColFull?.id);

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

  // Helper to get column width. Multi-flex (B-wire-2): every non-primary column's
  // width comes from the weighted distribution (layout.flexWidths) — forest/viz
  // included (forest is just a high-weight column, no longer a special scalar).
  // The legacy per-type fallbacks remain for any column missing from the map.
  const getColWidth = (col: ColumnSpec): number => {
    const flexed = layout.flexWidths?.[col.id];
    if (typeof flexed === "number") return flexed;
    const precomputed = autoWidths.get(col.id);
    if (precomputed !== undefined) return precomputed;
    if (typeof col.width === "number") return col.width;
    if (col.type === "forest") return col.options?.forest?.width ?? vizNaturalWidthForColumn(col) ?? LAYOUT.DEFAULT_COLUMN_WIDTH;
    return vizNaturalWidthForColumn(col) ?? LAYOUT.DEFAULT_COLUMN_WIDTH;
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
</style>`);

  // Background
  const surfaceBgResolved = readSurfaceBg(cssVars);
  const bgColor = options.backgroundColor ?? surfaceBgResolved;
  parts.push(`<rect width="100%" height="100%" fill="${bgColor}" data-tv-token="surface-bg"/>`);

  // Container border (if enabled in theme)
  // Web CSS: border: var(--tv-container-border, none); border-radius: var(--tv-container-border-radius, 8px);
  if (theme.layout.containerBorder !== false) {
    const borderRadius = theme.layout.containerBorderRadius ?? 8;
    const containerBorderStroke = readDividerSubtle(cssVars);
    parts.push(`<rect x="0.5" y="0.5"
      width="${layout.totalWidth - 1}" height="${layout.totalHeight - 1}"
      fill="none" stroke="${containerBorderStroke}" stroke-width="1"
      rx="${borderRadius}" ry="${borderRadius}"/>`);
  }

  // Header (title, subtitle)
  parts.push(renderHeader(spec, layout, theme, cssVars));

  // Top table border - frames column headers (symmetric with header bottom border)
  const headerBorderW = 2;
  const headerVariantRule = activeHeaderVariant(theme).rule
    ?? readDividerStrong(cssVars)
    ?? readDividerSubtle(cssVars);
  if (headerBorderW > 0) {
    parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
      y1="${layout.mainY}" y2="${layout.mainY}"
      stroke="${headerVariantRule}" stroke-width="${headerBorderW}"/>`);
  }

  // Column headers - unified layout. When no column has a visible header and
  // no groups exist, layout.headerHeight collapses to 0 — skip the entire
  // header band (cells + bottom border) to avoid drawing a zero-height strip.
  const headerY = layout.mainY;
  if (layout.headerHeight > 0) {
    // Paint the header-row background band first so subsequent cells can
    // draw text on top. Uses colors.headerBg (which cascades from rowBg in
    // set_colors so existing themes render identically).
    const headerBg = activeHeaderVariant(theme).bg;
    if (headerBg && headerBg !== surfaceBgResolved) {
      parts.push(`<rect x="${padding}" y="${headerY}"
        width="${layout.totalWidth - padding * 2}" height="${layout.headerHeight}"
        fill="${headerBg}"/>`);
    }
    // Exclude the primary column from columnDefs — it's rendered via labelHeader
    const headerColumnDefs = primaryColFull
      ? columns.filter(c => c.isGroup || (c as ColumnSpec).id !== primaryColFull.id)
      : columns;
    const showLabelHeader = primaryColFull
      ? resolveShowHeader(primaryColFull.showHeader, primaryColFull.header)
      : true;
    parts.push(renderUnifiedColumnHeaders(
      headerColumnDefs,
      allColumns,
      padding,
      headerY,
      layout.headerHeight,
      theme,
      primaryColFull?.header ?? "Study",
      layout.labelWidth,
      autoWidths,
      getColWidth,
      showLabelHeader,
      cssVars,
    ));

    // Header border — tied to 2 (default 2)
    if (headerBorderW > 0) {
      parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
        y1="${headerY + layout.headerHeight}" y2="${headerY + layout.headerHeight}"
        stroke="${headerVariantRule}" stroke-width="${headerBorderW}"/>`);
    }
  }

  // Build display rows
  const displayRows = buildDisplayRows(spec);

  // Row positions and heights are pre-computed in the layout pass
  const { rowPositions, rowHeights, rowMarkerCenters } = layout;

  const plotY = layout.mainY + layout.headerHeight;

  // Pre-compute per-row band indices honoring the BandingSpec grammar. This
  // is the single source of truth for banding — the row-background pass
  // below and the group-header renderer both consult it.
  const bandIndexes = computeBandIndexes(
    displayRows,
    theme.layout.banding ?? { mode: "none", level: null },
    spec.data.groups,
  );

  // Render row backgrounds FIRST - before forest intervals
  // This ensures forest markers aren't covered by background rectangles
  displayRows.forEach((displayRow, i) => {
    const y = plotY + rowPositions[i];
    const rowHeight = rowHeights[i];
    const bandIdx = bandIndexes[i];

    if (displayRow.type === "data") {
      const row = displayRow.row;

      // 1. Explicit row background (style.bg) - highest priority
      // Paint the bg (first winner wins), then fall through so a border
      // from the semantic bundle can still be drawn afterward.
      const semBundle = resolveSemanticBundle(row.style, theme);
      if (row.style?.bg) {
        parts.push(`<rect x="${padding}" y="${y}"
          width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
          fill="${row.style.bg}"/>`);
      } else if (row.style?.type === "header") {
        // Header-type rows get a subtle muted background
        const headerRowFill = readContentMuted(cssVars);
        parts.push(`<rect x="${padding}" y="${y}"
          width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
          fill="${headerRowFill}" fill-opacity="0.1"/>`);
      } else if (semBundle?.bg) {
        // Semantic bundle background — semantic classes can request a
        // row bg via theme.semantics.<token>.bg. Rendered BEFORE the
        // banding pass so a semantically-backed row reads as distinct from
        // its neighbors regardless of odd/even.
        parts.push(`<rect x="${padding}" y="${y}"
          width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
          fill="${semBundle.bg}"/>`);
      } else if (bandIdx === 1) {
        // Alternating row banding (only paint the "odd" band — even rows
        // inherit the container background, matching the web widget).
        // Phase 6: row-alt-bg + surface-bg both via cssVars.
        const bgColor = readRowAltBg(cssVars);
        const surfaceBg = readSurfaceBg(cssVars);
        if (bgColor !== surfaceBg) {
          parts.push(`<rect x="${padding}" y="${y}"
            width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
            fill="${bgColor}" data-tv-token="row-alt-bg"/>`);
        }
      }
      // Semantic bundle border (drawn as a bottom-edge line). Mirrors the
      // interactive path (TabvizPlot.svelte applies `border-bottom: 1px solid
      // ${bundle.border}` via CSS var). Drawn after the bg so it sits on top.
      if (semBundle?.border) {
        parts.push(`<line x1="${padding}" x2="${padding + layout.totalWidth - padding * 2}"
          y1="${y + rowHeight}" y2="${y + rowHeight}"
          stroke="${semBundle.border}" stroke-width="1"/>`);
      }
    } else {
      // Group header row — paint the band bg when this header is part of a
      // band. The header's own primary-tint bg is suppressed in the render
      // step below (via renderBackground=false). v0.24.1+: the
      // rowGroupPadding strip lives on the PREVIOUS data row's track now,
      // so the group_header row is just rowHeight tall and paints
      // edge-to-edge here.
      if (bandIdx === 1) {
        // Phase 6: row-alt-bg + surface-bg both via cssVars.
        const bgColor = readRowAltBg(cssVars);
        const surfaceBg = readSurfaceBg(cssVars);
        if (bgColor !== surfaceBg) {
          parts.push(`<rect x="${padding}" y="${y}"
            width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
            fill="${bgColor}" data-tv-token="row-alt-bg"/>`);
        }
      }
    }
  });

  // Optional watermark — drawn after row backgrounds so the band fills cover
  // the table area first, but before all cell/marker content so it sits behind
  // the foreground. Centered on the rows region; angle follows the rows-region
  // diagonal so the text adapts to the table's aspect ratio. Theme-aware.
  if (spec.watermark) {
    const wmW = layout.totalWidth - padding * 2;
    const wmH = layout.plotHeight;
    if (wmW > 0 && wmH > 0) {
      const cx = padding + wmW / 2;
      const cy = plotY + wmH / 2;
      const angleDeg = Math.atan2(wmH, wmW) * 180 / Math.PI;
      const diag = Math.sqrt(wmW * wmW + wmH * wmH);
      // Approx character width factor for a bold sans-serif at fontSize=1.
      // Scale font so the rendered text spans ~70% of the diagonal, then clamp.
      const charFactor = 0.55;
      const targetWidth = diag * 0.7;
      const rawSize = targetWidth / Math.max(1, spec.watermark.length * charFactor);
      const fontSize = Math.max(20, Math.min(200, rawSize));
      // Honor spec-level watermarkColor / watermarkOpacity (v0.20.1+); fall
      // back to foreground @ 0.07 for specs authored before those fields
      // existed.
      const wmFill = spec.watermarkColor ?? readContentPrimary(cssVars);
      const wmOpacity = spec.watermarkOpacity ?? 0.07;
      parts.push(
        `<text x="${cx}" y="${cy}" ` +
        `transform="rotate(${angleDeg.toFixed(2)} ${cx} ${cy})" ` +
        `text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="${readBodyFamily(cssVars)}" ` +
        `font-size="${fontSize.toFixed(1)}" font-weight="700" ` +
        `fill="${wmFill}" fill-opacity="${wmOpacity}" ` +
        `style="pointer-events:none; user-select:none">${escapeXml(spec.watermark)}</text>`
      );
    }
  }

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

    // If forest column specifies custom columns but no effects, create a default effect.
    // Null cols fall back to the primary field name so getEffectValue uses row.point/lower/upper.
    if (fcEffects.length === 0 && (fcPointCol || fcLowerCol || fcUpperCol)) {
      fcEffects = [{
        id: "default",
        pointCol: fcPointCol ?? "point",
        lowerCol: fcLowerCol ?? "lower",
        upperCol: fcUpperCol ?? "upper",
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

    // Reference line (null value) - stops at rowsHeight (not plotHeight) to match web view
    const nullX = forestX + xScale(fcNullValue);
    parts.push(renderReferenceLine(
      nullX,
      plotY,
      plotY + layout.rowsHeight,
      "dashed",
      readContentMuted(cssVars),
      theme,
      undefined,
      1,
      0.6,
      undefined,
      cssVars,
    ));

    // Custom annotations for this forest column (column-level only)
    const annotations = forestOpts?.annotations ?? [];
    // Labels render below the axis label row to avoid collision with column
    // headers above and axis tick labels below.
    const annotationLabelBaseY = plotY + layout.rowsHeight + layout.axisGap + 56;
    const labelStaggerOffsets = computeRefLineLabelOffsets(
      annotations.filter((a): a is typeof a & { type: "reference_line" } => a.type === "reference_line"),
      xScale
    );
    for (const ann of annotations) {
      if (ann.type === "reference_line") {
        const annX = forestX + xScale(ann.x);
        const labelYOffset = labelStaggerOffsets[ann.id] ?? 0;
        // Reflines stop at rowsHeight (not plotHeight) to match web view
        parts.push(renderReferenceLine(
          annX,
          plotY,
          plotY + layout.rowsHeight,
          ann.style,
          // Reference lines are structural scaffolding — default to
          // divider.strong (secondary-tinted) to match other plot lines
          // and free accent for actual layered emphasis.
          ann.color ?? readDividerStrong(cssVars),
          theme,
          ann.label,
          ann.width ?? 1,
          ann.opacity ?? 0.6,
          annotationLabelBaseY + labelYOffset,
          cssVars,
        ));
      }
    }

    // Custom annotations (forest_annotation()): per-row glyphs
    const customAnns = annotations.filter(
      (a): a is Extract<Annotation, { type: "custom" }> => a.type === "custom"
    );
    if (customAnns.length > 0) {
      const pointCol = forestOpts?.point ?? forestOpts?.effects?.[0]?.pointCol ?? null;
      if (pointCol) {
        for (const ann of customAnns) {
          displayRows.forEach((displayRow, i) => {
            if (displayRow.type !== "data") return;
            const r = displayRow.row;
            if (!(r.label === ann.rowId || r.id === ann.rowId)) return;
            const ptVal = r.metadata[pointCol];
            if (typeof ptVal !== "number" || Number.isNaN(ptVal)) return;
            const annY = plotY + (rowMarkerCenters[i] ?? rowPositions[i] + rowHeights[i] / 2);
            const markerX = forestX + xScale(ptVal);
            const offset = ann.position === "before" ? -14 : ann.position === "after" ? 14 : 0;
            const aX = markerX + offset;
            const sz = 5 * (ann.size ?? 1);
            if (ann.shape === "circle") {
              parts.push(`<circle cx="${aX}" cy="${annY}" r="${sz}" fill="${ann.color}" stroke="white" stroke-width="0.5"/>`);
            } else if (ann.shape === "square") {
              parts.push(`<rect x="${aX - sz}" y="${annY - sz}" width="${2*sz}" height="${2*sz}" fill="${ann.color}" stroke="white" stroke-width="0.5"/>`);
            } else if (ann.shape === "triangle") {
              parts.push(`<polygon points="${aX},${annY - sz} ${aX - sz},${annY + sz} ${aX + sz},${annY + sz}" fill="${ann.color}" stroke="white" stroke-width="0.5"/>`);
            } else if (ann.shape === "star") {
              const pts: string[] = [];
              for (let k = 0; k < 10; k++) {
                const rr = k % 2 === 0 ? sz * 1.2 : sz * 0.5;
                const a = Math.PI / 2 + k * Math.PI / 5;
                pts.push(`${aX + rr * Math.cos(a)},${annY - rr * Math.sin(a)}`);
              }
              parts.push(`<polygon points="${pts.join(" ")}" fill="${ann.color}" stroke="white" stroke-width="0.5"/>`);
            }
          });
        }
      }
    }

    // Row intervals
    displayRows.forEach((displayRow, i) => {
      if (displayRow.type === "data") {
        const yPos = plotY + (rowMarkerCenters[i] ?? rowPositions[i] + rowHeights[i] / 2);
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
          isLog,
          cssVars,
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
        theme,
        cssVars,
      ));
    }

    // Axis
    parts.push(renderForestAxis(xScale, layout, theme, fcAxisLabel, forestX, forestWidth, fcNullValue, baseTicks, cssVars));
  }

  // Render viz columns (viz_bar, viz_boxplot, viz_violin)
  const allDataRows = spec.data.rows;
  // Lookup table of per-column pan/zoom overrides from the browser. Present
  // only for columns the user actively zoomed/panned; others fall back to
  // data-driven domains.
  const vizOverrides = new Map<string, [number, number]>();
  if (options.precomputedLayout?.vizColumns) {
    for (const vc of options.precomputedLayout.vizColumns) {
      vizOverrides.set(vc.columnId, vc.xDomain);
    }
  }
  for (const vizColInfo of vizColumns) {
    const col = vizColInfo.column;
    const vizX = columnPositions[vizColInfo.index];
    const vizWidth = getColWidth(col);
    const override = vizOverrides.get(col.id) ?? null;
    // Per-column clipPath ensures marks zoomed outside the visible range don't
    // bleed into neighbouring cells. Y bounds match the plot row band (no axis).
    const clipId = `viz-clip-${col.id}`;
    const clipRectX = vizX + VIZ_MARGIN;
    const clipRectW = Math.max(vizWidth - 2 * VIZ_MARGIN, 0);
    parts.push(`<defs><clipPath id="${clipId}"><rect x="${clipRectX}" y="${plotY}" width="${clipRectW}" height="${layout.rowsHeight}"/></clipPath></defs>`);

    if (vizColInfo.type === "viz_bar") {
      const opts = col.options?.vizBar as VizBarColumnOptions | undefined;
      if (!opts) continue;

      // Compute shared scale for all rows
      const xScale = computeVizBarScale(allDataRows, opts, vizWidth, override);

      parts.push(`<g clip-path="url(#${clipId})">`);
      // Reference-line annotations (drawn behind bars)
      parts.push(renderVizAnnotations(opts.annotations, xScale, vizX, cssVars, plotY, layout.rowsHeight, theme));
      // Render bars for each data row
      displayRows.forEach((displayRow, i) => {
        if (displayRow.type === "data") {
          const yPos = plotY + (rowMarkerCenters[i] ?? rowPositions[i] + rowHeights[i] / 2);
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
      parts.push(`</g>`);

      // Render axis if showAxis is enabled
      if (opts.showAxis !== false) {
        parts.push(`<g transform="translate(0, ${plotY + layout.rowsHeight + layout.axisGap})">`);
        parts.push(renderVizAxis(xScale, layout, theme, opts.axisLabel, vizX, vizWidth, opts.nullValue, opts.scale === "log", cssVars));
        parts.push("</g>");
      }
    } else if (vizColInfo.type === "viz_boxplot") {
      const opts = col.options?.vizBoxplot as VizBoxplotColumnOptions | undefined;
      if (!opts) continue;

      // Compute shared scale for all rows
      const xScale = computeVizBoxplotScale(allDataRows, opts, vizWidth, override);

      parts.push(`<g clip-path="url(#${clipId})">`);
      // Reference-line annotations (drawn behind boxes)
      parts.push(renderVizAnnotations(opts.annotations, xScale, vizX, cssVars, plotY, layout.rowsHeight, theme));
      // Render boxplots for each data row
      displayRows.forEach((displayRow, i) => {
        if (displayRow.type === "data") {
          const yPos = plotY + (rowMarkerCenters[i] ?? rowPositions[i] + rowHeights[i] / 2);
          const rowH = rowHeights[i];
          parts.push(renderVizBoxplot(
            displayRow.row,
            yPos,
            rowH,
            vizX,
            vizWidth,
            opts,
            xScale,
            theme,
            cssVars,
          ));
        }
      });
      parts.push(`</g>`);

      // Render axis if showAxis is enabled
      if (opts.showAxis !== false) {
        parts.push(`<g transform="translate(0, ${plotY + layout.rowsHeight + layout.axisGap})">`);
        parts.push(renderVizAxis(xScale, layout, theme, opts.axisLabel, vizX, vizWidth, opts.nullValue, opts.scale === "log", cssVars));
        parts.push("</g>");
      }
    } else if (vizColInfo.type === "viz_violin") {
      const opts = col.options?.vizViolin as VizViolinColumnOptions | undefined;
      if (!opts) continue;

      // Compute shared scale for all rows
      const xScale = computeVizViolinScale(allDataRows, opts, vizWidth, override);

      parts.push(`<g clip-path="url(#${clipId})">`);
      // Reference-line annotations (drawn behind violins)
      parts.push(renderVizAnnotations(opts.annotations, xScale, vizX, cssVars, plotY, layout.rowsHeight, theme));
      // Render violins for each data row
      displayRows.forEach((displayRow, i) => {
        if (displayRow.type === "data") {
          const yPos = plotY + (rowMarkerCenters[i] ?? rowPositions[i] + rowHeights[i] / 2);
          const rowH = rowHeights[i];
          parts.push(renderVizViolin(
            displayRow.row,
            yPos,
            rowH,
            vizX,
            vizWidth,
            opts,
            xScale,
            theme,
            cssVars,
          ));
        }
      });
      parts.push(`</g>`);

      // Render axis if showAxis is enabled
      if (opts.showAxis !== false) {
        parts.push(`<g transform="translate(0, ${plotY + layout.rowsHeight + layout.axisGap})">`);
        parts.push(renderVizAxis(xScale, layout, theme, opts.axisLabel, vizX, vizWidth, opts.nullValue, opts.scale === "log", cssVars));
        parts.push("</g>");
      }
    }
  }

  // Table rows - unified column rendering
  const rowsY = layout.mainY + layout.headerHeight;

  // Per-column { min, max } summary consumed by schema-driven bar /
  // heatmap renderers via ctx.columnSummary. Computed once over the
  // full data so the scale is stable across pages.
  const columnSummaries = computeColumnSummaries(allDataRows, allColumns);

  // Phase 5: row-id → canonical index map + effective banks. Used by
  // the schema dispatch to resolve styleMapping conditions and feed
  // ctx.banks / ctx.rowIndex to renderers. Computed once per export.
  const rowIdToIndex = new Map<string, number>();
  for (let ri = 0; ri < allDataRows.length; ri++) rowIdToIndex.set(allDataRows[ri].id, ri);
  const effectiveBanks = computeEffectiveBanks(spec);

  displayRows.forEach((displayRow, i) => {
    const y = rowsY + rowPositions[i];
    const rowHeight = rowHeights[i];

    if (displayRow.type === "group_header") {
      // Render group header. Pass rowCount=0 when the spec has group counts off,
      // so renderGroupHeader's `if (rowCount > 0)` gate skips the "(n)" text.
      // When this header is part of a band (bandIndexes[i] != null), skip the
      // primary-tint bg so the band color reads as continuous with its rows.
      const showCounts = !!spec.interaction?.showGroupCounts;
      const renderBg = bandIndexes[i] == null;
      parts.push(renderGroupHeader(
        displayRow.label,
        displayRow.depth,
        showCounts ? displayRow.rowCount : 0,
        padding,
        y,
        rowHeight,
        layout.totalWidth - padding * 2,
        theme,
        renderBg,
        cssVars,
      ));
    } else if (displayRow.type === "panel") {
      // Render the details/disclosure panel (full-width markdown-as-text band).
      parts.push(renderDetailsPanel(
        displayRow.content,
        padding,
        y,
        rowHeight,
        layout.totalWidth,
        theme,
        cssVars,
      ));
    } else {
      // Render data row
      const row = displayRow.row;
      const depth = displayRow.depth;
      const isSpacerRow = resolveRowKind(displayRow) === "spacer";

      // Note: Row banding is rendered earlier (before forest intervals) to avoid covering markers

      // Skip content rendering for spacer rows (they're invisible in web view)
      if (isSpacerRow) {
        // Spacer rows don't render content - just occupy space
        // The row height is already half-height from earlier calculation
      } else {
        // v0.24.1+: when this row is padded-after (last data row of a
        // top-level group), the track is rowHeight + rowGroupPadding
        // tall but content stays anchored at the original visible band
        // (mirrors `align-items: center; padding-bottom` in the live
        // CSS). Pass the visible-band height so text Y-centerline
        // doesn't drift into the empty separator strip.
        const trailingPad = layout.rowPaddedAfter[i]
          ? readVarPx(cssVars, "--tv-spacing-row-group-padding", 0)
          : 0;
        const contentHeight = rowHeight - trailingPad;
        // Render unified row (label + all columns in order)
        parts.push(renderUnifiedTableRow(
          row,
          allColumns,
          padding,
          y,
          contentHeight,
          theme,
          layout.labelWidth,
          depth,
          autoWidths,
          getColWidth,
          columnPositions,
          allDataRows,
          columnSummaries,
          rowIdToIndex,
          effectiveBanks,
          cssVars,
        ));
      }
    }

    // Row borders — Phase 11 borders model. Horizontal row dividers
    // only fire when `theme.borders.layout` includes them. Major borders
    // (summary top, group-header bottom) ignore `layout` since they
    // demarcate structure rather than data-row stride.
    const borders = theme.borders;
    const drawRowDividers = layoutHasHorizontal(borders.layout);
    const x1 = padding;
    const x2 = layout.totalWidth - padding;
    if (displayRow.type === "data") {
      const row = displayRow.row;
      const kind = resolveRowKind(displayRow);
      const isSummaryRow = rowKindProps(kind).summaryMarker;
      const isSpacerRow = kind === "spacer";
      if (isSummaryRow) {
        parts.push(borderLineSvg(x1, y, x2, y, borders.major));
      }
      if (!isSpacerRow && drawRowDividers) {
        parts.push(borderLineSvg(x1, y + rowHeight, x2, y + rowHeight, borders.minor));
      }
    } else {
      parts.push(borderLineSvg(x1, y + rowHeight, x2, y + rowHeight, borders.major));
    }
  });

  // Table outer edge — `borders.table` always paints when layout !=
  // "none" and thickness > 0. The rect spans from the header top to the
  // last row bottom; horizontal sides paint twice for "double" style.
  if (theme.borders.layout !== "none" && theme.borders.table.thickness > 0) {
    const t = theme.borders.table;
    const topY = layout.mainY;
    const botY = rowsY + layout.rowsHeight;
    const leftX = padding;
    const rightX = layout.totalWidth - padding;
    parts.push(borderLineSvg(leftX, topY, rightX, topY, t));
    parts.push(borderLineSvg(leftX, botY, rightX, botY, t));
    parts.push(borderLineSvg(leftX, topY, leftX, botY, t));
    parts.push(borderLineSvg(rightX, topY, rightX, botY, t));
  }

  // Footer (caption, footnote)
  parts.push(renderFooter(spec, layout, theme, cssVars));

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
