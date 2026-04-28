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
  AxisConfig,
  Annotation,
} from "$types";
import { niceDomain, DOMAIN_PADDING, getEffectValue, normalizeValue } from "./scale-utils";
import { computeAxis, generateTicks, VIZ_MARGIN, type AxisComputation } from "./axis-utils";
import { computeArrowDimensions, renderArrowPath } from "./arrow-utils";
import { isVizType, resolveShowHeader } from "./column-compat";
import { resolveMarkerStyle } from "./marker-styling";
import { computeBandIndexes } from "./banding";
import { resolveSemanticBundle } from "./semantic-styling";
import { GLYPH_REGISTRY, resolveGlyph } from "./glyph-registry";
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
  truncateString,
} from "./formatters";
import { estimateTextWidth, measureTextWidthCanvas } from "./width-utils";

/**
 * Measure text width - uses canvas when available (browser), falls back to estimation (V8/Node).
 * This gives accurate measurements in browser while still working in DOM-free environments.
 */
function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number = 400
): number {
  // Try canvas measurement first (only works in browser)
  // Canvas now includes font-weight for accurate bold text measurement
  const canvasWidth = measureTextWidthCanvas(text, `${fontSize}px`, fontFamily, fontWeight);
  if (canvasWidth !== null) {
    return canvasWidth;
  }
  // Fall back to character-class estimation (V8/Node)
  // Apply weight multiplier since estimation doesn't account for bold
  const weightMultiplier = 1 + Math.max(0, (fontWeight - 400) / 100) * 0.02;
  return estimateTextWidth(text, fontSize) * weightMultiplier;
}
import {
  computeBoxplotStats,
  computeKDE,
  normalizeKDE,
  kdeToViolinPath,
} from "./viz-utils";

import {
  parseFontSize,
  textRegionHeight,
  computeAxisLayout,
} from "./typography-layout";

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
  const fontSize = parseFontSize(spec.theme.text.body.size);
  // Header cells: use the explicit theme.header.text.size when it's been
  // pinned distinct from body.size; otherwise apply the historical 5%
  // scale-up (matches the .header-cell CSS calc-fallback in ForestPlot).
  const headerExplicit = spec.theme.header?.text?.size;
  const bodySizeStr = spec.theme.text.body.size;
  const headerFontSize = (headerExplicit && headerExplicit !== bodySizeStr)
    ? Math.round(parseFontSize(headerExplicit) * 100) / 100
    : Math.round(fontSize * 1.05 * 100) / 100;
  // Header font weight is theme-controlled via theme.header.text.weight
  // (defaults to 600). estimateTextWidth() doesn't account for weight, so
  // bolder text renders wider than the estimate. Fudge per CSS-weight
  // rough-empirical (regular → bold ≈ +8%):
  //   400 → 1.00, 500 → 1.02, 600 → 1.05, 700 → 1.08, 800+ → 1.10.
  // Themes that set normal-weight headers (400) get no fudge.
  const headerWeight = (spec.theme.header?.text as { weight?: number } | undefined)?.weight ?? 600;
  const headerWeightFudge = headerWeight <= 400 ? 1.00
    : headerWeight <= 500 ? 1.02
    : headerWeight <= 600 ? 1.05
    : headerWeight <= 700 ? 1.08
    : 1.10;
  const rows = spec.data.rows;

  // Padding values from theme (not hardcoded magic numbers)
  const cellPadding = (spec.theme.spacing.cellPaddingX ?? 10) * 2;
  const groupPadding = (spec.theme.spacing.groupPadding ?? 8) * 2;

  // ========================================================================
  // PHASE 1: Measure leaf column content
  // ========================================================================
  for (const col of columns) {
    // Viz columns (forest, viz_bar, viz_boxplot, viz_violin) with width="auto"
    // are intentionally omitted here so the downstream renderer falls through
    // to `layout.forestWidth` (the expand-to-fill value). A natural-min
    // autoWidth would cap the plot to ~200px even when the caller asked for a
    // 1600px canvas, producing a narrow plot with empty space to the right.
    // User-resized widths still arrive via `options.columnWidths` (see
    // computeLayout).
    if (
      (col.type === "forest" ||
        col.type === "viz_bar" ||
        col.type === "viz_boxplot" ||
        col.type === "viz_violin") &&
      (col.width === "auto" || col.width == null)
    ) {
      continue;
    }

    // Fixed-width columns keep their width, but if the header is explicitly
    // shown and wouldn't fit, grow the column to match (keeps SVG export in
    // sync with the web view's header-fit measurement).
    if (col.width !== "auto" && col.width !== null && col.width !== undefined) {
      if (
        typeof col.width === "number" &&
        col.header &&
        resolveShowHeader(col.showHeader, col.header)
      ) {
        const pad = isVizType(col.type) ? VIZ_MARGIN * 2 : cellPadding;
        const headerWidth = Math.ceil(
          estimateTextWidth(col.header, headerFontSize) * headerWeightFudge +
            pad + TEXT_MEASUREMENT.RENDERING_BUFFER,
        );
        if (headerWidth > col.width) {
          widths.set(col.id, Math.min(AUTO_WIDTH.MAX, headerWidth));
        }
      }
      continue;
    }

    let maxWidth = 0;

    // Measure header text with header font size + theme-driven weight fudge.
    if (col.header) {
      maxWidth = Math.max(
        maxWidth,
        estimateTextWidth(col.header, headerFontSize) * headerWeightFudge,
      );
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
  expandColumnGroupWidths(spec.columns, widths, headerFontSize, headerWeightFudge, groupPadding, TEXT_MEASUREMENT.RENDERING_BUFFER);

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
  weightFudge: number,
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
        // Group header needs: text width (× weight fudge for bold rendering)
        // + its own padding (from theme) + rendering buffer.
        const groupHeaderWidth =
          estimateTextWidth(col.header, fontSize) * weightFudge +
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
  const fontSize = parseFontSize(spec.theme.text.body.size);
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

  // Measure primary column header
  if (primaryHeader) {
    maxWidth = Math.max(maxWidth, estimateTextWidth(primaryHeader, fontSize));
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
  const showGroupCounts = !!spec.interaction?.showGroupCounts;
  for (const group of groups) {
    if (group.label) {
      const indentWidth = group.depth * SPACING.INDENT_PER_LEVEL;
      const labelWidth = estimateTextWidth(group.label, fontSize);

      // Count "(N)" suffix is optional — budget 0 when hidden.
      let countWidth = 0;
      if (showGroupCounts) {
        const rowCount = countGroupDescendantRows(group.id, groups, spec.data.rows);
        const countText = `(${rowCount})`;
        const countFontSize = fontSize * 0.75; // matches theme.text.label.size
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
}

function computeLayout(spec: WebSpec, options: ExportOptions, nullValue: number = 0): InternalLayout {
  const theme = spec.theme;
  const rowHeight = theme.spacing.rowHeight;
  const padding = theme.spacing.padding;

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
  // (× headerFontScale × line-height) needs — matches forestStore.layout.
  const headerDepth = hasGroups ? 2 : 1;
  const headerLineHeight = 1.5;
  const headerScale = 1.05;
  const headerFontPx = parseFontSize(theme.text.body.size) * headerScale;
  const minHeaderRow = Math.ceil(headerFontPx * headerLineHeight) + 6;
  const effectiveHeaderHeight = Math.max(theme.spacing.headerHeight, minHeaderRow * headerDepth);
  const actualRowHeight = effectiveHeaderHeight / headerDepth;
  // If no leaf column's header renders AND no column groups exist, the whole
  // header band collapses — mirrors ForestPlot.svelte's anyHeaderVisible.
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
  const titleHeight = hasTitle ? textRegionHeight(theme.text.subtitle.size, lineHeight) : 0;
  const subtitleHeight = hasSubtitle ? textRegionHeight(theme.text.body.size, lineHeight) : 0;
  // Title↔subtitle gap is themable via spacing.title_subtitle_gap (default
  // 13 to mirror the live widget's PlotHeader CSS chain margin+border+
  // padding = 6+1+6).
  const titleSubtitleGap = (hasTitle && hasSubtitle) ? (theme.spacing.titleSubtitleGap ?? 13) : 0;
  const headerTextHeight = titleHeight + titleSubtitleGap + subtitleHeight + (hasTitle || hasSubtitle ? padding : 0);

  const captionHeight = hasCaption ? textRegionHeight(theme.text.label.size, lineHeight) : 0;
  const footnoteHeight = hasFootnote ? textRegionHeight(theme.text.label.size, lineHeight) : 0;
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
  // columns. Mirrors forestStore's measurement so SVG export grows the
  // same row tracks the live widget grows. Uses estimateTextWidth (the
  // same heuristic auto-width uses) so widths are self-consistent here.
  const wrapEnabledCols = allColumns.filter(c => {
    const w = (c as { wrap?: boolean | number }).wrap;
    return typeof w === "number" ? w > 0 : !!w;
  });
  const wrapLineCounts: Record<string, number> = {};
  if (wrapEnabledCols.length > 0) {
    const dataFontSize = parseFontSize(theme.text.body.size);
    const cellPadding = (theme.spacing.cellPaddingX ?? 10) * 2;
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
  const rowGroupPadding = theme.spacing.rowGroupPadding ?? 0;
  const dataLineHeightPx = Math.ceil(parseFontSize(theme.text.body.size) * (1.5));
  // rowPaddedAfter[i]: data row i directly precedes a top-level
  // group_header. Walk forward once to mark each affected data row;
  // its track will be inflated by rowGroupPadding (cell content stays
  // anchored at the original visible-band Y). Mirrors forestStore.
  const rowPaddedAfter: boolean[] = new Array(displayRows.length).fill(false);
  for (let i = 0; i < displayRows.length; i++) {
    const dr = displayRows[i];
    if (dr.type !== "group_header" || dr.depth !== 0) continue;
    for (let j = i - 1; j >= 0; j--) {
      const prev = displayRows[j];
      if (prev.type === "data" && prev.row.style?.type !== "spacer") {
        rowPaddedAfter[j] = true;
        break;
      }
    }
  }
  let rowsHeight = 0;
  const rowPositions: number[] = [];
  const rowHeights: number[] = [];
  for (let i = 0; i < displayRows.length; i++) {
    const dr = displayRows[i];
    const isSpacerRow = dr.type === "data" && dr.row.style?.type === "spacer";
    let h: number;
    if (isSpacerRow) h = rowHeight / 2;
    else if (dr.type === "group_header") h = rowHeight;
    else if (dr.type === "data") {
      const lines = wrapLineCounts[dr.row.id] ?? 1;
      h = lines > 1 ? Math.max(rowHeight, dataLineHeightPx * lines + 6) : rowHeight;
    } else h = rowHeight;
    if (rowPaddedAfter[i]) h += rowGroupPadding;
    rowPositions.push(rowsHeight);
    rowHeights.push(h);
    rowsHeight += h;
  }
  // plotHeight includes overall summary area (for total height calculations)
  const plotHeight = rowsHeight + (hasOverall ? rowHeight * RENDERING.OVERALL_ROW_HEIGHT_MULTIPLIER : 0);

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
  // Check for any flex-viz column (forest or viz_*) that consumes
  // `layout.forestWidth` as its expand-to-fill width when width="auto".
  const hasForestColumns = allColumns.some(
    c => c.type === "forest" ||
         ((c.type === "viz_bar" || c.type === "viz_boxplot" || c.type === "viz_violin") &&
          (c.width === "auto" || c.width == null)),
  );
  const includeForest = hasForestColumns;

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
    const availableForForest = baseWidth - totalTableWidth - padding * 2;
    forestWidth = Math.max(availableForForest, LAYOUT.MIN_FOREST_WIDTH);
  }

  // Total width: expand if content needs more space than requested width
  const neededWidth = padding * 2 + totalTableWidth + forestWidth;
  const totalWidth = Math.max(options.width ?? baseWidth, neededWidth);

  // If totalWidth is larger than neededWidth and forest width wasn't explicitly set,
  // expand forest to fill the remaining space (prevents gap on right side)
  if (includeForest && totalWidth > neededWidth &&
      typeof options.forestWidth !== "number" && typeof spec.layout.plotWidth !== "number") {
    forestWidth = totalWidth - totalTableWidth - padding * 2;
  }


  // Total height: include full axis area only when a column actually renders
  // an x-axis strip (forest or any viz_* column). Plain tabular tables have
  // no bottom axis, so reserving ~76px of axis height caused truncation.
  const axisGap = theme.spacing.axisGap ?? 12;
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
    { fontSizeSm: theme.text.label.size, lineHeight: 1.5 },
    someColumnHasAxisLabel,
    theme.plot.tickMarkLength,
  );
  const webAxisHeight = hasAxisColumn ? axisGap + axisLayout.axisRegionHeight : 0;
  // Include the themed footer gap when there's a footer to render — the
  // gap sits between the plot/axis area and the caption/footnote text. If
  // we leave it out, totalHeight was smaller than footerY + text, so the
  // last row (or the footer) got truncated in specs with no viz column
  // (where `webAxisHeight === 0` meant less buffer space to absorb the
  // mismatch).
  const footerGap = (spec.labels?.caption || spec.labels?.footnote)
    ? (theme.spacing.footerGap ?? 8)
    : 0;
  // Bottom margin: themable via spacing.bottom_margin (default 16 to
  // mirror the prior LAYOUT.BOTTOM_MARGIN constant).
  const bottomMargin = theme.spacing.bottomMargin ?? LAYOUT.BOTTOM_MARGIN;
  const totalHeight = headerTextHeight + padding +
    headerHeight + plotHeight +
    webAxisHeight +
    footerGap +
    footerTextHeight +
    bottomMargin;

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
    // Title baseline = top of region + (titleHeight × 0.8) to drop under the
    // ascender. Replaces the old `+ TITLE_HEIGHT - 4` magic that assumed
    // the constant 28px region.
    titleY: padding + Math.round(titleHeight * 0.8),
    subtitleY: padding + titleHeight + titleSubtitleGap + Math.round(subtitleHeight * 0.8),
    mainY: headerTextHeight + padding,
    // Footer Y: Match web view's layout (axisHeight + 8px footer padding-top)
    // Footer Y: axis region + themed footer gap (spacing.footer_gap).
    // footerY = caption baseline. Live widget renders the caption with
    // padding-top = footerGap from the axis end (the visible TOP of the
    // caption text sits at footerGap below the border). To match in SVG
    // we need the BASELINE = footerGap + captionAscent (drop from text
    // top to baseline ≈ 0.85 × fontSize). Without the +captionAscent,
    // SVG and live disagreed by ~10px and the footer text overlapped
    // the axis region in the export.
    footerY: headerTextHeight + padding + headerHeight + plotHeight + webAxisHeight
           + (theme.spacing.footerGap ?? 8)
           + Math.round(parseFontSize(theme.text.label.size) * 0.85),
    axisGap,
    rowsHeight,
    autoWidths,
    labelWidth,
    rowPositions,
    rowHeights,
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

/** Calculate text X position and anchor based on alignment */
function getTextPosition(
  x: number,
  width: number,
  align: "left" | "center" | "right" | undefined
): { textX: number; anchor: string } {
  return getTextPositionPadded(x, width, align, SPACING.TEXT_PADDING);
}

/** Same as getTextPosition but with a caller-supplied horizontal padding. */
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
    pointSize: spec.theme.plot.pointSize,
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
    const fontSize = parseFontSize(theme.text.subtitle.size);
    const titleFamily = theme.text.title?.family ?? theme.text.body.family;
    const titleFg = theme.text.title?.fg ?? theme.content.primary;
    lines.push(`<text x="${padding}" y="${layout.titleY}"
      font-family="${titleFamily}"
      font-size="${fontSize}px"
      font-weight="${600}"
      fill="${titleFg}">${escapeXml(spec.labels.title)}</text>`);
  }

  if (spec.labels?.subtitle) {
    const fontSize = parseFontSize(theme.text.body.size);
    lines.push(`<text x="${padding}" y="${layout.subtitleY}"
      font-family="${theme.text.body.family}"
      font-size="${fontSize}px"
      font-weight="${400}"
      fill="${theme.content.secondary}">${escapeXml(spec.labels.subtitle)}</text>`);
  }

  // Thin separator line between title and subtitle (only when both exist)
  // Web CSS has 6px padding-top on subtitle after the border, so position separator
  // to leave 6px gap between it and the subtitle text top
  if (spec.labels?.title && spec.labels?.subtitle) {
    const subtitleFontSize = parseFontSize(theme.text.body.size);
    const subtitleAscent = subtitleFontSize * 0.75; // Approximate ascent (text top from baseline)
    const separatorY = layout.subtitleY - subtitleAscent - 6; // 6px gap like web CSS padding-top
    lines.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
      y1="${separatorY}" y2="${separatorY}"
      stroke="${theme.divider.subtle}" stroke-width="1" opacity="0.3"/>`);
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
    // Border sits `footer_gap` above the text baseline — footerY already
    // includes the themed gap.
    const gap = theme.spacing.footerGap ?? 8;
    const borderY = layout.footerY - gap;
    lines.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
      y1="${borderY}" y2="${borderY}"
      stroke="${theme.divider.subtle}" stroke-width="1"/>`);
  }

  if (spec.labels?.caption) {
    const fontSize = parseFontSize(theme.text.label.size);
    lines.push(`<text x="${padding}" y="${y}"
      font-family="${theme.text.body.family}"
      font-size="${fontSize}px"
      font-weight="${400}"
      fill="${theme.content.secondary}">${escapeXml(spec.labels.caption)}</text>`);
    // Advance Y by the caption's actual line height — derived from
    // typography rather than the hardcoded 16px constant.
    y += textRegionHeight(theme.text.label.size, 1.5);
  }

  if (spec.labels?.footnote) {
    const fontSize = parseFontSize(theme.text.label.size);
    lines.push(`<text x="${padding}" y="${y}"
      font-family="${theme.text.body.family}"
      font-size="${fontSize}px"
      font-weight="${400}"
      font-style="italic"
      fill="${theme.content.muted}">${escapeXml(spec.labels.footnote)}</text>`);
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
  theme: WebTheme,
  renderBackground: boolean = true,
): string {
  const lines: string[] = [];

  // Get level-based styling (depth is 0-indexed, level is 1-indexed)
  const level = depth + 1;
  const tier = level === 1 ? theme.rowGroup.L1
             : level === 2 ? theme.rowGroup.L2
             : theme.rowGroup.L3;

  const fontSize = parseFontSize(tier.text?.size ?? theme.text.body.size);
  const fontWeight = tier.text?.weight ?? (level === 1 ? 600 : level === 2 ? 500 : 400);
  const italic = tier.text?.italic ?? false;
  let background: string | null = tier.bg ?? null;
  const borderBottom = tier.borderBottom ?? false;

  // Compute background from primary if not explicitly set
  if (!background) {
    const primary = theme.accent.default;
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
  const indent = depth * (theme.rowGroup.indentPerLevel ?? SPACING.INDENT_PER_LEVEL);

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
      stroke="${theme.divider.subtle}" stroke-width="1" opacity="0.5"/>`);
  }

  // Group header text (label)
  const fontStyle = italic ? ' font-style="italic"' : '';
  const labelX = x + SPACING.TEXT_PADDING + indent;
  lines.push(`<text class="cell-text" x="${labelX}" y="${textY}"
    font-family="${theme.text.body.family}"
    font-size="${fontSize}px"
    font-weight="${fontWeight}"${fontStyle}
    fill="${theme.content.primary}">${escapeXml(label)}</text>`);

  // Row count (e.g., "(15)") - smaller muted text after label
  // Web CSS: font-weight: normal, color: muted, font-size: 0.75rem
  if (rowCount > 0) {
    // Use smart measurement: canvas in browser, estimation in V8/Node
    // measureTextWidth handles font-weight adjustment internally
    const labelWidth = measureTextWidth(label, fontSize, theme.text.body.family, fontWeight);
    const countX = labelX + labelWidth + 6; // 6px gap (matches web's flex gap)
    const countFontSize = parseFontSize(theme.text.label.size ?? "0.75rem");
    lines.push(`<text class="cell-text" x="${countX}" y="${textY}"
      font-family="${theme.text.body.family}"
      font-size="${countFontSize}px"
      font-weight="${400}"
      fill="${theme.content.muted}">(${rowCount})</text>`);
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
    const maxStars = Math.max(1, Math.min(20, col.options?.stars?.maxStars ?? 5));
    const domain = col.options?.stars?.domain;
    let raw = val;
    if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[1] > domain[0]) {
      const clamped = Math.max(domain[0], Math.min(domain[1], raw));
      raw = ((clamped - domain[0]) / (domain[1] - domain[0])) * maxStars;
    }
    const rating = Math.max(0, Math.min(maxStars, raw));
    const filled = Math.floor(rating);
    const empty = maxStars - filled;
    return "★".repeat(filled) + "☆".repeat(empty);
  }
  if (col.type === "ring") {
    // Donut + optional label. Use "MM" as a wide stand-in for the donut
    // diameter (~24px ≈ 2 chars at body font), plus the label text.
    const val = row.metadata[col.field];
    if (typeof val !== "number" || !Number.isFinite(val)) return "";
    const opts = col.options?.ring;
    const showLabel = opts?.showLabel ?? true;
    const labelFormat = opts?.labelFormat ?? "percent";
    const labelDecimals = opts?.labelDecimals ?? 0;
    const min = opts?.minValue ?? 0;
    const max = opts?.maxValue ?? 1;
    const f = max > min ? (val - min) / (max - min) : 0;
    const lbl = !showLabel ? "" :
      labelFormat === "percent" ? (f * 100).toFixed(labelDecimals) + "%" :
      labelFormat === "integer" ? String(Math.round(val)) :
      val.toFixed(labelDecimals);
    return "MM" + (lbl ? " " + lbl : "");
  }
  if (col.type === "pictogram") {
    // Width-estimation placeholder. Rating mode caps at max_glyphs;
    // count mode uses round(value). The actual draw happens in the
    // rendering branch below. We use "MM" per glyph (~14-16px wide at
    // body font-size) to approximate the rendered glyph+gap width since
    // unicode "●" measures much narrower than a 14px square SVG glyph.
    const val = row.metadata[col.field];
    if (typeof val !== "number" || !Number.isFinite(val)) return "";
    const maxG = col.options?.pictogram?.maxGlyphs ?? null;
    const layout = col.options?.pictogram?.layout ?? "row";
    const labelOn = !!col.options?.pictogram?.valueLabel;
    if (layout === "stack") return labelOn ? "MM " + val.toFixed(0) : "MM";
    const n = maxG ?? Math.min(Math.max(0, Math.round(val)), 20);
    const glyphs = "MM".repeat(n);
    return labelOn ? glyphs + "  " + val.toFixed(1) : glyphs;
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
  const str = val !== undefined && val !== null ? String(val) : (col.options?.naText ?? "");
  if (col.type === "text") {
    return truncateString(str, col.options?.text?.maxChars);
  }
  return str;
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
  xScale: (value: number) => number,
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

  const baseSize = theme.plot.pointSize;
  const lineWidth = theme.plot.lineWidth;
  const defaultLineColor = theme.series?.[0]?.stroke ?? theme.accent.default;

  // Check if this is a summary row (should render diamond)
  const isSummaryRow = row.style?.type === 'summary';
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
    color: string;
    shape: MarkerShape;
    opacity: number;
  } {
    const isPrimary = idx === 0;
    const markerStyle = row.markerStyle;

    // Theme effect defaults for multi-effect plots
    const themeEffectColors = theme.series.map(s => s.fill);
    // Per-series marker shapes ride on the SlotBundle (theme.series[i].shape).
    // Null/undefined → fall through to the 4-shape rotation.
    const defaultShapes: MarkerShape[] = ["square", "circle", "diamond", "triangle"];

    // Resolve Layer 1+2 (per-effect literal or palette cycle) into a base color.
    // Summary rows use `colors.summaryFill` as their base so the diamond honors
    // its dedicated palette slot; non-summary rows follow the effect-color
    // cascade. Layers 3+4 (bundle.markerFill / row.markerStyle.color) still
    // layer on top via resolveMarkerStyle below.
    let baseColor: string;
    if (effect.color) {
      baseColor = effect.color;
    } else if (isSummaryRow && isPrimary) {
      baseColor = theme.series?.[0]?.fill ?? theme.accent.default;
    } else if (themeEffectColors && themeEffectColors.length > 0) {
      baseColor = themeEffectColors[idx % themeEffectColors.length];
    } else {
      baseColor = theme.accent.default ?? "#2563eb";
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
    // 4. Default shapes: square, circle, diamond, triangle (cycling)
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

  // Helper to render marker shape
  function renderMarker(cx: number, effectY: number, size: number, style: { fill: string; stroke: string | null; strokeWidth: number; shape: MarkerShape; opacity: number }): string {
    const { fill, stroke, strokeWidth, shape, opacity } = style;
    const opacityAttr = opacity < 1 ? ` fill-opacity="${opacity}"` : "";
    const strokeAttr = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : "";

    switch (shape) {
      case "circle":
        return `<circle cx="${cx}" cy="${effectY}" r="${size}" fill="${fill}"${opacityAttr}${strokeAttr}/>`;
      case "diamond": {
        const pts = [
          `${cx},${effectY - size}`,
          `${cx + size},${effectY}`,
          `${cx},${effectY + size}`,
          `${cx - size},${effectY}`
        ].join(' ');
        return `<polygon points="${pts}" fill="${fill}"${opacityAttr}${strokeAttr}/>`;
      }
      case "triangle": {
        const pts = [
          `${cx},${effectY - size}`,
          `${cx + size},${effectY + size}`,
          `${cx - size},${effectY + size}`
        ].join(' ');
        return `<polygon points="${pts}" fill="${fill}"${opacityAttr}${strokeAttr}/>`;
      }
      default: // square
        return `<rect x="${cx - size}" y="${effectY - size}" width="${size * 2}" height="${size * 2}" fill="${fill}"${opacityAttr}${strokeAttr}/>`;
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
            fill="${style.fill}"${opacityAttr} stroke="${theme.series?.[0]?.stroke ?? theme.accent.default}" stroke-width="1"/>
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

  return `<polygon points="${points}"
    fill="${theme.series?.[0]?.fill ?? theme.accent.default}"
    stroke="${theme.series?.[0]?.stroke ?? theme.accent.default}"
    stroke-width="1"/>`;
}

// ============================================================================
// Viz Column Renderers (viz_bar, viz_boxplot, viz_violin)
// ============================================================================

/**
 * Render reference-line annotations for a viz column.
 * Mirrors the inline rendering in ForestPlot.svelte for non-forest viz overlays.
 * `forest_annotation()` (CustomAnnotation) is forest-specific and skipped here.
 */
function renderVizAnnotations(
  annotations: Annotation[] | null | undefined,
  xScale: Scale,
  vizX: number,
  plotY: number,
  rowsHeight: number,
): string {
  if (!annotations || annotations.length === 0) return "";
  const parts: string[] = [];
  for (const ann of annotations) {
    if (ann.type !== "reference_line") continue;
    const x = vizX + xScale(ann.x);
    const stroke = ann.color ?? "#94a3b8";
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
    const strokeAttr = ms.stroke ? ` stroke="${ms.stroke}" stroke-width="${ms.strokeWidth}"` : "";

    parts.push(`<rect
      x="${barXStart}" y="${barY}"
      width="${Math.max(1, barW)}" height="${barHeight}"
      fill="${ms.fill}" fill-opacity="${opacity}"${strokeAttr} rx="2"
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
  const defaultColors = theme.series.map(s => s.fill) ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
  const lineColor = theme.content.primary ?? "#1a1a1a";
  const themeLineWidth = theme.plot.lineWidth ?? 1.5;
  const outlierR = (theme.plot.pointSize ?? 6) * 0.4;

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

    // Whisker lines
    // Left whisker
    parts.push(`<line
      x1="${vizX + xScale(stats.min)}" x2="${vizX + xScale(stats.q1)}"
      y1="${boxCenterY}" y2="${boxCenterY}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`);
    // Left whisker cap
    parts.push(`<line
      x1="${vizX + xScale(stats.min)}" x2="${vizX + xScale(stats.min)}"
      y1="${boxCenterY - boxHeight / 4}" y2="${boxCenterY + boxHeight / 4}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`);

    // Right whisker
    parts.push(`<line
      x1="${vizX + xScale(stats.q3)}" x2="${vizX + xScale(stats.max)}"
      y1="${boxCenterY}" y2="${boxCenterY}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`);
    // Right whisker cap
    parts.push(`<line
      x1="${vizX + xScale(stats.max)}" x2="${vizX + xScale(stats.max)}"
      y1="${boxCenterY - boxHeight / 4}" y2="${boxCenterY + boxHeight / 4}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`);

    // Box (Q1 to Q3)
    const boxW = Math.max(2, xScale(stats.q3) - xScale(stats.q1));
    parts.push(`<rect
      x="${vizX + xScale(stats.q1)}" y="${boxY}"
      width="${boxW}" height="${boxHeight}"
      fill="${ms.fill}" fill-opacity="${opacity}"
      stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`);

    // Median line
    parts.push(`<line
      x1="${vizX + xScale(stats.median)}" x2="${vizX + xScale(stats.median)}"
      y1="${boxY}" y2="${boxY + boxHeight}"
      stroke="${strokeColor}" stroke-width="${Math.max(2, strokeWidth)}"/>`);

    // Outliers — point size and stroke width scale with the theme's
    // shapes.pointSize / lineWidth so outliers match forest-plot markers.
    if (options.showOutliers !== false && stats.outliers.length > 0) {
      for (const outlier of stats.outliers) {
        parts.push(`<circle
          cx="${vizX + xScale(outlier)}" cy="${boxCenterY}"
          r="${outlierR}"
          fill="none" stroke="${ms.fill}" stroke-width="${themeLineWidth}"/>`);
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
  const defaultColors = theme.series.map(s => s.fill) ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
  const lineColor = theme.content.primary ?? "#1a1a1a";
  const themeLineWidth = theme.plot.lineWidth ?? 1.5;
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
      fill="${ms.fill}" fill-opacity="${opacity}"
      stroke="${violinStroke}" stroke-width="${violinStrokeW}"/>`);

    // Median line
    if (options.showMedian !== false && quartiles) {
      const medianX = vizX + xScale(quartiles.median);
      parts.push(`<line
        x1="${medianX}" x2="${medianX}"
        y1="${violinCenterY - maxWidth * 0.6}" y2="${violinCenterY + maxWidth * 0.6}"
        stroke="${lineColor}" stroke-width="${medianStrokeW}"/>`);
    }

    // Quartile lines
    if (options.showQuartiles && quartiles) {
      const q1X = vizX + xScale(quartiles.q1);
      const q3X = vizX + xScale(quartiles.q3);
      parts.push(`<line
        x1="${q1X}" x2="${q1X}"
        y1="${violinCenterY - maxWidth * 0.4}" y2="${violinCenterY + maxWidth * 0.4}"
        stroke="${lineColor}" stroke-width="${quartileStrokeW}" stroke-dasharray="2,2"/>`);
      parts.push(`<line
        x1="${q3X}" x2="${q3X}"
        y1="${violinCenterY - maxWidth * 0.4}" y2="${violinCenterY + maxWidth * 0.4}"
        stroke="${lineColor}" stroke-width="${quartileStrokeW}" stroke-dasharray="2,2"/>`);
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
  vizWidth: number,
  domainOverride?: [number, number] | null
): Scale {
  const isLog = options.scale === "log";
  const padding = VIZ_MARGIN;

  // Pan/zoom override from browser wins outright — we want bit-identical
  // parity with what the user sees in the viewport.
  if (domainOverride) {
    if (isLog) {
      return createLogScale([Math.max(0.01, domainOverride[0]), domainOverride[1]], [padding, vizWidth - padding]);
    }
    return createLinearScale([domainOverride[0], domainOverride[1]], [padding, vizWidth - padding]);
  }

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
  vizWidth: number,
  domainOverride?: [number, number] | null
): Scale {
  const isLog = options.scale === "log";
  const padding = VIZ_MARGIN;

  if (domainOverride) {
    if (isLog) {
      return createLogScale([Math.max(0.01, domainOverride[0]), domainOverride[1]], [padding, vizWidth - padding]);
    }
    return createLinearScale([domainOverride[0], domainOverride[1]], [padding, vizWidth - padding]);
  }

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
  vizWidth: number,
  domainOverride?: [number, number] | null
): Scale {
  const isLog = options.scale === "log";
  const padding = VIZ_MARGIN;

  if (domainOverride) {
    if (isLog) {
      return createLogScale([Math.max(0.01, domainOverride[0]), domainOverride[1]], [padding, vizWidth - padding]);
    }
    return createLinearScale([domainOverride[0], domainOverride[1]], [padding, vizWidth - padding]);
  }

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
  nullValue: number | undefined,
  isLog: boolean = false
): string {
  const lines: string[] = [];
  const fontSize = parseFontSize(theme.text.label.size);
  const axisGeom = computeAxisLayout(
    { fontSizeSm: theme.text.label.size, lineHeight: 1.5 },
    !!axisLabel,
    theme.plot.tickMarkLength,
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
    y1="0" y2="0" stroke="${theme.plot?.axisLine ?? theme.divider.strong ?? theme.divider.subtle}" stroke-width="1"/>`);

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

    lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="${axisGeom.tickMarkLength}" stroke="${theme.plot?.tickMark ?? theme.divider.subtle}" stroke-width="1"/>`);
    lines.push(`<text x="${x + xOffset}" y="${axisGeom.tickLabelY}"
      text-anchor="${textAnchor}"
      font-family="${theme.text.body.family}"
      font-size="${fontSize}px"
      font-weight="${400}"
      fill="${theme.plot?.tickLabel?.fg ?? theme.content.primary}">${label}</text>`);
  }

  // Axis label
  if (axisLabel) {
    lines.push(`<text x="${vizX + vizWidth / 2}" y="${axisGeom.axisLabelY}"
      text-anchor="middle"
      font-family="${theme.text.body.family}"
      font-size="${fontSize}px"
      font-weight="${500}"
      fill="${theme.plot?.axisLabel?.fg ?? theme.content.primary}">${escapeXml(axisLabel)}</text>`);
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
  const fontSize = parseFontSize(theme.text.label.size);
  const axisGeom = computeAxisLayout(
    { fontSizeSm: theme.text.label.size, lineHeight: 1.5 },
    !!axisLabel,
    theme.plot.tickMarkLength,
  );

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
    y1="0" y2="0" stroke="${theme.plot?.axisLine ?? theme.divider.strong ?? theme.divider.subtle}" stroke-width="1"/>`);

  // Gridlines (behind ticks) — mirrors EffectAxis.svelte; opt-in via
  // theme.axis.gridlines, styled per theme.axis.gridlineStyle.
  if (theme.axis.gridlines && layout.plotHeight > 0) {
    const style = theme.axis.gridlineStyle ?? "dotted";
    const dashArray = style === "dashed" ? "4,4" : style === "dotted" ? "2,2" : "none";
    const dashAttr = dashArray === "none" ? "" : ` stroke-dasharray="${dashArray}"`;
    for (const tick of ticks) {
      const x = forestX + xScale(tick);
      lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="${-layout.plotHeight}"
        stroke="${theme.divider.subtle}" stroke-width="1"${dashAttr} opacity="0.5"/>`);
    }
  }

  // Ticks and labels
  for (const tick of ticks) {
    const tickX = xScale(tick);
    const x = forestX + tickX;
    const textAnchor = getTextAnchor(tickX);
    const xOffset = getTextXOffset(tickX);

    lines.push(`<line x1="${x}" x2="${x}" y1="0" y2="${axisGeom.tickMarkLength}"
      stroke="${theme.plot?.tickMark ?? theme.divider.subtle}" stroke-width="1"/>`);
    lines.push(`<text x="${x + xOffset}" y="${axisGeom.tickLabelY + 2}" text-anchor="${textAnchor}"
      font-family="${theme.plot?.tickLabel?.family ?? theme.text.tick?.family ?? theme.text.body.family}"
      font-size="${fontSize}px"
      font-weight="${theme.plot?.tickLabel?.weight ?? theme.text.tick?.weight ?? 400}"
      font-style="${(theme.plot?.tickLabel?.italic ?? theme.text.tick?.italic) ? "italic" : "normal"}"
      fill="${theme.plot?.tickLabel?.fg ?? theme.content.secondary}">${formatTick(tick)}</text>`);
  }

  // Axis label
  if (axisLabel) {
    lines.push(`<text x="${forestX + forestWidth / 2}" y="${axisGeom.axisLabelY}"
      text-anchor="middle"
      font-family="${theme.plot?.axisLabel?.family ?? theme.text.label?.family ?? theme.text.body.family}"
      font-size="${fontSize}px"
      font-weight="${theme.plot?.axisLabel?.weight ?? theme.text.label?.weight ?? 500}"
      font-style="${(theme.plot?.axisLabel?.italic ?? theme.text.label?.italic) ? "italic" : "normal"}"
      fill="${theme.plot?.axisLabel?.fg ?? theme.content.secondary}">${escapeXml(axisLabel)}</text>`);
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
  showLabelHeader: boolean = true
): string {
  const lines: string[] = [];
  const baseFontSize = parseFontSize(theme.text.body.size);
  // Header cells: prefer explicit theme.header.text.size when pinned
  // distinct from body.size, else 5% scale-up (matches .header-cell CSS).
  const headerExplicit = theme.header?.text?.size;
  const bodySizeStr = theme.text.body.size;
  const fontSize = (headerExplicit && headerExplicit !== bodySizeStr)
    ? Math.round(parseFontSize(headerExplicit) * 100) / 100
    : Math.round(baseFontSize * 1.05 * 100) / 100;
  const fontFamily = theme.header?.text?.family ?? theme.text.body.family;
  // All header cells use bold weight to match web view CSS.
  const fontWeight = theme.header?.text?.weight ?? 600;
  const boldWeight = 600;
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
      lines.push(`<text class="cell-text" x="${currentX + SPACING.TEXT_PADDING}" y="${getTextY(y, headerHeight)}"
        font-family="${fontFamily}"
        font-size="${fontSize}px"
        font-weight="${fontWeight}"
        fill="${(theme.variants?.headerStyle === "bold" ? theme.header.bold.fg : theme.header.light.fg)}">${escapeXml(labelHeader)}</text>`);
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
        lines.push(`<text class="cell-text" x="${textX}" y="${getTextY(y, row1Height)}"
          font-family="${fontFamily}"
          font-size="${fontSize}px"
          font-weight="${boldWeight}"
          text-anchor="middle"
          fill="${(theme.variants?.headerStyle === "bold" ? theme.header.bold.fg : theme.header.light.fg)}">${escapeXml(col.header)}</text>`);
        groupBorders.push({ x1: currentX, x2: currentX + groupWidth });
        currentX += groupWidth;
      } else {
        const width = getColWidth(col);
        const headerAlign = col.headerAlign ?? col.align;
        if (resolveShowHeader(col.showHeader, col.header)) {
          const pad = isVizType(col.type) ? VIZ_MARGIN : SPACING.TEXT_PADDING;
          const { textX, anchor } = getTextPositionPadded(currentX, width, headerAlign, pad);
          const truncatedHeader = truncateText(col.header, width, fontSize, pad);
          lines.push(`<text class="cell-text" x="${textX}" y="${getTextY(y, headerHeight)}"
            font-family="${fontFamily}"
            font-size="${fontSize}px"
            font-weight="${fontWeight}"
            text-anchor="${anchor}"
            fill="${(theme.variants?.headerStyle === "bold" ? theme.header.bold.fg : theme.header.light.fg)}">${escapeXml(truncatedHeader)}</text>`);
        }
        currentX += width;
      }
    }

    // Draw borders under groups (matches web view: .group-row { border-bottom: 1px solid var(--tv-border) })
    for (const border of groupBorders) {
      lines.push(`<line x1="${border.x1}" x2="${border.x2}"
        y1="${y + row1Height}" y2="${y + row1Height}"
        stroke="${theme.divider.subtle}" stroke-width="1"/>`);
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
              const pad = isVizType(sub.type) ? VIZ_MARGIN : SPACING.TEXT_PADDING;
              const { textX, anchor } = getTextPositionPadded(currentX, width, headerAlign, pad);
              lines.push(`<text class="cell-text" x="${textX}" y="${getTextY(y + row1Height, row2Height)}"
                font-family="${fontFamily}"
                font-size="${fontSize}px"
                font-weight="${fontWeight}"
                text-anchor="${anchor}"
                fill="${(theme.variants?.headerStyle === "bold" ? theme.header.bold.fg : theme.header.light.fg)}">${escapeXml(sub.header)}</text>`);
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
      lines.push(`<text class="cell-text" x="${currentX + SPACING.TEXT_PADDING}" y="${getTextY(y, headerHeight)}"
        font-family="${fontFamily}"
        font-size="${fontSize}px"
        font-weight="${fontWeight}"
        fill="${(theme.variants?.headerStyle === "bold" ? theme.header.bold.fg : theme.header.light.fg)}">${escapeXml(labelHeader)}</text>`);
    }
    currentX += labelWidth;

    for (const col of leafColumns) {
      const width = getColWidth(col);
      const headerAlign = col.headerAlign ?? col.align;
      if (resolveShowHeader(col.showHeader, col.header)) {
        // Viz columns pad by VIZ_MARGIN so the header aligns with the plot
        // region's left/right edges (where the axis begins).
        const pad = isVizType(col.type) ? VIZ_MARGIN : SPACING.TEXT_PADDING;
        const { textX, anchor } = getTextPositionPadded(currentX, width, headerAlign, pad);
        const truncatedHeader = truncateText(col.header, width, fontSize, pad);

        lines.push(`<text class="cell-text" x="${textX}" y="${getTextY(y, headerHeight)}"
          font-family="${fontFamily}"
          font-size="${fontSize}px"
          font-weight="${fontWeight}"
          text-anchor="${anchor}"
          fill="${(theme.variants?.headerStyle === "bold" ? theme.header.bold.fg : theme.header.light.fg)}">${escapeXml(truncatedHeader)}</text>`);
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
  barMaxValues: Map<string, number>,
  autoWidths: Map<string, number>,
  getColWidth: (col: ColumnSpec) => number,
  columnPositions: number[],
  allRows: Row[] = []
): string {
  const lines: string[] = [];
  const fontSize = parseFontSize(theme.text.body.size);
  // Use row center for text positioning - dominant-baseline:central handles vertical alignment
  const textY = y + rowHeight / 2;

  // Render label. Semantic bundles (theme.semantics.{emphasis|muted|accent})
  // drive fg / font_weight / font_style when the row carries the matching
  // flag; the bundle's per-field `null` leaves that property at the theme
  // default, so a partial bundle (e.g. just bg on emphasis) won't clobber
  // unrelated styling.
  const indent = depth * SPACING.INDENT_PER_LEVEL + (row.style?.indent ?? 0) * SPACING.INDENT_PER_LEVEL;
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
    textColor = (theme.cell.fg ?? theme.content.primary);
  }

  // Don't truncate labels - they're the primary row identifier and the width
  // was already computed to fit them (either by browser measurement or SVG estimation)
  lines.push(`<text class="cell-text" x="${x + SPACING.TEXT_PADDING + indent}" y="${textY}"
    font-family="${theme.text.body.family}"
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
    const labelTextWidth = measureTextWidth(row.label, fontSize, theme.text.body.family, fontWeight);
    const badgeX = x + SPACING.TEXT_PADDING + indent + labelTextWidth + BADGE.GAP;
    const badgeTextWidth = measureTextWidth(badgeText, badgeFontSize, theme.text.body.family, 600);
    const badgeWidth = badgeTextWidth + BADGE.PADDING * 2;
    const badgeY = y + (rowHeight - badgeHeight) / 2;

    lines.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}"
      rx="3" fill="${theme.accent.default}" opacity="0.15"/>`);
    lines.push(`<text class="cell-text" x="${badgeX + badgeWidth / 2}" y="${badgeY + badgeHeight / 2}"
      text-anchor="middle"
      font-family="${theme.text.body.family}"
      font-size="${badgeFontSize}px"
      font-weight="${600}"
      fill="${theme.accent.default}">${escapeXml(badgeText)}</text>`);
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
      const barScale = col.options?.bar?.scale ?? "linear";
      // Per-cell + per-row semantic paint cascade (parity with the live
      // CellBar component): cell-paint markerFill > row-paint markerFill
      // > brand. Tokens without markerFill (bold, fill) fall through.
      const barCellBundle = resolveSemanticBundle(row.cellStyles?.[col.field], theme);
      const barRowBundle = resolveSemanticBundle(row.style, theme);
      const barColor = col.options?.bar?.color
        ?? barCellBundle?.markerFill
        ?? barRowBundle?.markerFill
        ?? (theme.inputs as { brand?: string } | undefined)?.brand
        ?? theme.accent.default;
      const barHeight = theme.plot.pointSize * 2;
      const textWidth = 50;
      const barAreaWidth = width - SPACING.TEXT_PADDING * 2 - textWidth;
      const barWidth = normalizeValue(barValue, 0, maxValue, barScale) * barAreaWidth;

      // Respect row styling for bar value text
      const rowStyle = row.style;
      const barFontWeight = (rowStyle?.bold || rowStyle?.emphasis)
        ? 600
        : 400;

      lines.push(`<rect x="${currentX + SPACING.TEXT_PADDING}" y="${y + rowHeight / 2 - barHeight / 2}"
        width="${Math.max(0, barWidth)}" height="${barHeight}"
        fill="${barColor}" opacity="0.7" rx="2"/>`);
      lines.push(`<text class="cell-text" x="${currentX + width - SPACING.TEXT_PADDING}" y="${textY}"
        font-family="${theme.text.body.family}"
        font-size="${fontSize}px"
        font-weight="${barFontWeight}"
        text-anchor="end"
        fill="${theme.content.primary}">${formatNumber(barValue)}</text>`);
    } else if (col.type === "sparkline" && Array.isArray(row.metadata[col.field])) {
      // Render sparkline
      const raw = row.metadata[col.field] as number[] | number[][];
      const data: number[] = Array.isArray(raw[0]) ? (raw[0] as number[]) : (raw as number[]);
      const sparkHeight = col.options?.sparkline?.height ?? 16;
      const sparkCellBundle = resolveSemanticBundle(row.cellStyles?.[col.field], theme);
      const sparkRowBundle = resolveSemanticBundle(row.style, theme);
      const sparkColor = col.options?.sparkline?.color
        ?? sparkCellBundle?.markerFill
        ?? sparkRowBundle?.markerFill
        ?? (theme.inputs as { brand?: string } | undefined)?.brand
        ?? theme.accent.default;
      const sparkPadding = SPACING.TEXT_PADDING * 2;
      const path = renderSparklinePath(data, currentX + SPACING.TEXT_PADDING, y + rowHeight / 2 - sparkHeight / 2, width - sparkPadding, sparkHeight);
      lines.push(`<path d="${path}" fill="none" stroke="${sparkColor}" stroke-width="1.5"/>`);
    } else if (col.type === "badge") {
      // Render badge cell. Now supports shape (pill/circle/square),
      // outline mode, and threshold-driven color scale (numeric values).
      const badgeValue = row.metadata[col.field];
      if (badgeValue !== undefined && badgeValue !== null) {
        const badgeText = String(badgeValue);
        const badgeFontSize = fontSize * BADGE.FONT_SCALE;
        const badgeHeight = badgeFontSize + BADGE.PADDING * 2;

        const opts = col.options?.badge;
        const variants = opts?.variants;
        const customColors = opts?.colors;
        const thresholds = opts?.thresholds;
        const shape = opts?.shape ?? "pill";
        const outline = opts?.outline ?? false;
        let badgeColor = theme.accent.default;

        // Threshold path (numeric value bucketed into colors[]).
        if (Array.isArray(thresholds) && thresholds.length > 0 && typeof badgeValue === "number") {
          const stops: string[] = (() => {
            if (Array.isArray(customColors) && customColors.length === thresholds.length + 1) {
              return customColors;
            }
            if (thresholds.length === 1) return [theme.accent.default, theme.status?.negative ?? theme.accent.default];
            if (thresholds.length === 2) return [
              theme.status?.positive ?? theme.accent.default,
              theme.status?.warning ?? theme.accent.default,
              theme.status?.negative ?? theme.accent.default,
            ];
            return [theme.accent.default];
          })();
          let idx = 0;
          for (const t of thresholds) { if (badgeValue >= t) idx++; else break; }
          badgeColor = stops[Math.min(idx, stops.length - 1)] ?? theme.accent.default;
        } else if (customColors && !Array.isArray(customColors) && badgeText in customColors) {
          badgeColor = (customColors as Record<string, string>)[badgeText];
        } else if (variants && badgeText in variants) {
          const variant = variants[badgeText] as keyof typeof BADGE_VARIANTS | "default" | "muted";
          const variantColors: Record<string, string> = {
            default: theme.accent.default,
            ...BADGE_VARIANTS,
            muted: theme.content.muted,
          };
          badgeColor = variantColors[variant] ?? theme.accent.default;
        }

        const badgeTextWidth = measureTextWidth(badgeText, badgeFontSize, theme.text.body.family, 600);
        // Circle and square shapes are 1:1 aspect — use badgeHeight as
        // the controlling dimension so a "1" and a "12" render the same
        // diameter (matches the editorial-badge mockups).
        const aspectShape = shape === "circle" || shape === "square";
        const badgeWidth = aspectShape
          ? Math.max(badgeHeight, badgeTextWidth + BADGE.PADDING)
          : badgeTextWidth + BADGE.PADDING * 2;
        const radius = shape === "square" ? 3
                     : shape === "circle" ? badgeHeight / 2
                     : badgeHeight / 2;  // pill
        const badgeX = col.align === "right"
          ? currentX + width - SPACING.TEXT_PADDING - badgeWidth
          : col.align === "center"
            ? currentX + (width - badgeWidth) / 2
            : currentX + SPACING.TEXT_PADDING;
        const badgeY = y + (rowHeight - badgeHeight) / 2;

        if (outline) {
          lines.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}"
            rx="${radius}" fill="none" stroke="${badgeColor}" stroke-width="1.5"/>`);
        } else {
          lines.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}"
            rx="${radius}" fill="${badgeColor}" opacity="0.15"/>`);
        }
        lines.push(`<text class="cell-text" x="${badgeX + badgeWidth / 2}" y="${badgeY + badgeHeight / 2}"
          text-anchor="middle"
          font-family="${theme.text.body.family}"
          font-size="${badgeFontSize}px"
          font-weight="${600}"
          fill="${badgeColor}">${escapeXml(badgeText)}</text>`);
      }
    } else if (col.type === "stars") {
      // Render star rating
      const val = row.metadata[col.field];
      if (typeof val === "number") {
        const maxStars = Math.max(1, Math.min(20, col.options?.stars?.maxStars ?? 5));
        const starColor = col.options?.stars?.color ?? "#f59e0b";
        const emptyColor = col.options?.stars?.emptyColor ?? "#d1d5db";
        const domain = col.options?.stars?.domain;
        let raw = val;
        if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[1] > domain[0]) {
          const clamped = Math.max(domain[0], Math.min(domain[1], raw));
          raw = ((clamped - domain[0]) / (domain[1] - domain[0])) * maxStars;
        }
        const rating = Math.max(0, Math.min(maxStars, raw));
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
    } else if (col.type === "pictogram") {
      // Render pictogram: registry SVG paths or unicode chars, count or
      // rating mode (mirrors CellPictogram.svelte).
      const val = row.metadata[col.field];
      if (typeof val === "number" && Number.isFinite(val)) {
        const opts = col.options?.pictogram;
        if (opts) {
          const maxGlyphs = opts.maxGlyphs ?? null;
          const halfGlyphs = opts.halfGlyphs ?? false;
          const domain = opts.domain ?? null;
          const layout = opts.layout ?? "row";
          const size = opts.size ?? "base";
          // Resolve theme colors to literal values: nested <svg> elements
          // in rsvg's pipeline don't inherit CSS vars from the outer document,
          // so var(--tv-accent) renders as transparent. Pull theme literals
          // when no explicit color is set.
          const filledColor = opts.color ?? theme.accent.default;
          const emptyColor = opts.emptyColor ?? theme.content.muted;

          // Resolve glyph: single string or value-keyed map (glyph_field).
          let glyphSpec: string | null = null;
          if (typeof opts.glyph === "string") {
            glyphSpec = opts.glyph;
          } else if (opts.glyph && typeof opts.glyph === "object" && opts.glyphField) {
            const sel = row.metadata[opts.glyphField];
            if (sel != null) {
              const map = opts.glyph as Record<string, string>;
              glyphSpec = map[String(sel)] ?? null;
            }
          }
          const resolved = resolveGlyph(glyphSpec);
          if (!resolved) {
            // No glyph spec — skip rendering this cell.
            continue;
          }

          // Domain remap (rating mode only).
          let raw = val;
          if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) &&
              domain[1] > domain[0] && maxGlyphs != null) {
            const clamped = Math.max(domain[0], Math.min(domain[1], raw));
            raw = ((clamped - domain[0]) / (domain[1] - domain[0])) * maxGlyphs;
          }
          const rating = Math.max(0, raw);

          // Build slot list.
          type Slot = { state: "full" | "half" | "empty" };
          const slots: Slot[] = [];
          if (maxGlyphs == null) {
            const n = Math.min(Math.floor(rating + (halfGlyphs ? 0.5 : 0)), 999);
            for (let i = 0; i < n; i++) slots.push({ state: "full" });
          } else {
            for (let i = 1; i <= maxGlyphs; i++) {
              if (i <= rating) slots.push({ state: "full" });
              else if (halfGlyphs && i - 0.5 <= rating) slots.push({ state: "half" });
              else slots.push({ state: "empty" });
            }
          }

          const glyphPx = size === "sm" ? 10 : size === "lg" ? 20 : 14;
          const gap = 1;
          const valueLabel = opts.valueLabel ?? false;
          const labelPos = valueLabel === true ? "trailing"
            : valueLabel === "leading" ? "leading"
              : valueLabel === "trailing" ? "trailing"
                : null;
          const labelText = labelPos
            ? (opts.labelFormat === "integer"
                ? String(Math.round(val))
                : val.toFixed(opts.labelDecimals ?? 1))
            : "";
          const labelFontPx = size === "sm" ? 9 : size === "lg" ? 12 : 11;
          // Approximate label width for layout calc — not perfect but close
          // enough for centering at this size.
          const labelW = labelText ? labelText.length * (labelFontPx * 0.55) + 4 : 0;

          // Layout dimensions.
          const isStack = layout === "stack";
          const trackW = isStack ? glyphPx : slots.length * glyphPx + Math.max(0, slots.length - 1) * gap;
          const trackH = isStack ? slots.length * glyphPx : glyphPx;
          const totalW = trackW + labelW;
          const totalH = Math.max(trackH, labelFontPx);

          let originX = col.align === "right"
            ? currentX + width - SPACING.TEXT_PADDING - totalW
            : col.align === "center"
              ? currentX + (width - totalW) / 2
              : currentX + SPACING.TEXT_PADDING;
          const originY = y + (rowHeight - totalH) / 2;

          // Leading label.
          if (labelPos === "leading") {
            lines.push(
              `<text x="${originX}" y="${originY + totalH / 2}" ` +
              `font-size="${labelFontPx}" fill="var(--tv-cell-fg, var(--tv-fg))" ` +
              `dominant-baseline="middle" text-anchor="start">${labelText}</text>`
            );
            originX += labelW;
          }

          // Glyphs.
          for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const sx = isStack ? originX : originX + i * (glyphPx + gap);
            const sy = isStack ? originY + (slots.length - 1 - i) * glyphPx : originY;
            if (resolved.kind === "registry") {
              const def = resolved.def;
              if (slot.state === "full") {
                lines.push(
                  `<svg x="${sx}" y="${sy}" width="${glyphPx}" height="${glyphPx}" viewBox="${def.viewBox}">` +
                  `<path d="${def.path}" fill="${filledColor}" stroke="none"/></svg>`
                );
              } else if (slot.state === "half") {
                lines.push(
                  `<svg x="${sx}" y="${sy}" width="${glyphPx}" height="${glyphPx}" viewBox="${def.viewBox}">` +
                  `<path d="${def.path}" fill="${filledColor}" stroke="none"/>` +
                  `<rect x="12" y="0" width="12" height="24" fill="${emptyColor}" opacity="0.7"/></svg>`
                );
              } else {
                lines.push(
                  `<svg x="${sx}" y="${sy}" width="${glyphPx}" height="${glyphPx}" viewBox="${def.viewBox}">` +
                  `<path d="${def.path}" fill="none" stroke="${emptyColor}" stroke-width="1.5"/></svg>`
                );
              }
            } else {
              // Literal char fallback — render as <text>.
              const color = slot.state === "empty" ? emptyColor : filledColor;
              lines.push(
                `<text x="${sx + glyphPx / 2}" y="${sy + glyphPx * 0.85}" ` +
                `font-size="${glyphPx}" fill="${color}" text-anchor="middle">${resolved.char}</text>`
              );
            }
          }

          // Trailing label.
          if (labelPos === "trailing") {
            const lx = isStack ? originX + glyphPx + 4 : originX + trackW + 4;
            lines.push(
              `<text x="${lx}" y="${originY + totalH / 2}" ` +
              `font-size="${labelFontPx}" fill="var(--tv-cell-fg, var(--tv-fg))" ` +
              `dominant-baseline="middle" text-anchor="start">${labelText}</text>`
            );
          }

          // Mark the silenced GLYPH_REGISTRY import as "used" — the inline
          // path above goes through resolveGlyph which references it.
          void GLYPH_REGISTRY;
        }
      }
    } else if (col.type === "ring") {
      // Render donut gauge: track ring + filled arc + centered numeric
      // label (mirrors CellRing.svelte). Theme colors resolved literally
      // since nested <svg> elements don't inherit CSS vars in rsvg.
      const val = row.metadata[col.field];
      if (typeof val === "number" && Number.isFinite(val)) {
        const opts = col.options?.ring;
        if (opts) {
          const minV = opts.minValue ?? 0;
          const maxV = opts.maxValue ?? 1;
          const size = opts.size ?? "base";
          const showLabel = opts.showLabel ?? true;
          const labelFormat = opts.labelFormat ?? "percent";
          const labelDecimals = opts.labelDecimals ?? 0;
          const trackColor = opts.trackColor ?? theme.content.muted;

          // Pick filled color from threshold scale or single value.
          let filledColor: string = theme.accent.default;
          const thresholds = opts.thresholds ?? null;
          const colorOpt = opts.color ?? null;
          if (!thresholds || thresholds.length === 0) {
            if (typeof colorOpt === "string") filledColor = colorOpt;
            else if (Array.isArray(colorOpt) && colorOpt.length === 1) filledColor = colorOpt[0];
          } else {
            const stops = (() => {
              if (Array.isArray(colorOpt) && colorOpt.length === thresholds.length + 1) return colorOpt;
              if (thresholds.length === 1) return [theme.accent.default, theme.status?.negative ?? theme.accent.default];
              if (thresholds.length === 2) return [
                theme.status?.positive ?? theme.accent.default,
                theme.status?.warning ?? theme.accent.default,
                theme.status?.negative ?? theme.accent.default,
              ];
              return [theme.accent.default];
            })();
            let idx = 0;
            for (const t of thresholds) { if (val >= t) idx++; else break; }
            filledColor = stops[Math.min(idx, stops.length - 1)] ?? theme.accent.default;
          }

          const fraction = maxV > minV
            ? Math.max(0, Math.min(1, (val - minV) / (maxV - minV)))
            : 0;

          // Geometry — match CellRing.svelte
          const diameter = size === "sm" ? 18 : size === "lg" ? 32 : 24;
          const stroke = Math.max(2, Math.round(diameter * 0.22));
          const radius = (diameter - stroke) / 2;
          const cxr = diameter / 2;
          const cyr = diameter / 2;
          const circumference = 2 * Math.PI * radius;
          const dashLen = circumference * fraction;
          const dashGap = circumference - dashLen;

          // Label text
          const labelText = labelFormat === "percent"
            ? (fraction * 100).toFixed(labelDecimals) + "%"
            : labelFormat === "integer"
              ? String(Math.round(val))
              : val.toFixed(labelDecimals);
          const labelFontPx = size === "sm" ? 9 : size === "lg" ? 12 : 11;
          const labelW = showLabel ? labelText.length * (labelFontPx * 0.55) + 4 : 0;

          const totalW = diameter + (showLabel ? labelW + 4 : 0);
          let originX = col.align === "right"
            ? currentX + width - SPACING.TEXT_PADDING - totalW
            : col.align === "center"
              ? currentX + (width - totalW) / 2
              : currentX + SPACING.TEXT_PADDING;
          const originY = y + (rowHeight - diameter) / 2;

          // Track ring
          lines.push(
            `<circle cx="${originX + cxr}" cy="${originY + cyr}" r="${radius}" ` +
            `fill="none" stroke="${trackColor}" stroke-width="${stroke}" opacity="0.35"/>`
          );
          // Fill arc (rotate -90 for 12 o'clock start)
          if (dashLen > 0) {
            lines.push(
              `<circle cx="${originX + cxr}" cy="${originY + cyr}" r="${radius}" ` +
              `fill="none" stroke="${filledColor}" stroke-width="${stroke}" ` +
              `stroke-dasharray="${dashLen} ${dashGap}" stroke-linecap="round" ` +
              `transform="rotate(-90 ${originX + cxr} ${originY + cyr})"/>`
            );
          }
          // Trailing label
          if (showLabel) {
            lines.push(
              `<text x="${originX + diameter + 4}" y="${originY + diameter / 2}" ` +
              `font-size="${labelFontPx}" fill="${theme.content.primary}" ` +
              `dominant-baseline="middle" text-anchor="start">${labelText}</text>`
            );
          }
        }
      }
    } else if (col.type === "heatmap") {
      // Render heatmap cell with colored background
      const hmValue = row.metadata[col.field] as number;
      if (hmValue !== undefined && hmValue !== null && !Number.isNaN(hmValue)) {
        const hmOpts = col.options?.heatmap;
        // Default palette derives light → dark from the theme's brand
        // color (matches the live CellHeatmap component). Falls back to
        // the historical blue palette when neither brand nor brand_deep
        // are present (v1 themes).
        const themeInputs = theme.inputs as { brand?: string; brandDeep?: string } | undefined;
        const themeSurfaceBase = (theme.surface as { base?: string } | undefined)?.base ?? "#ffffff";
        const hmBrand = themeInputs?.brand;
        const hmBrandDeep = themeInputs?.brandDeep ?? hmBrand;
        const defaultPalette: string[] = (hmBrand && hmBrandDeep)
          ? [(() => {
              const ah = hmBrand.replace("#","");
              const bh = themeSurfaceBase.replace("#","");
              const t = 0.92;
              const ar=parseInt(ah.substring(0,2),16),ag=parseInt(ah.substring(2,4),16),ab=parseInt(ah.substring(4,6),16);
              const br=parseInt(bh.substring(0,2),16),bg=parseInt(bh.substring(2,4),16),bb=parseInt(bh.substring(4,6),16);
              const r=Math.round(ar*(1-t)+br*t), g=Math.round(ag*(1-t)+bg*t), b=Math.round(ab*(1-t)+bb*t);
              return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
            })(), hmBrandDeep]
          : ["#f7fbff", "#08306b"];
        const palette = hmOpts?.palette ?? defaultPalette;
        const hmDecimals = hmOpts?.decimals ?? 2;
        const showValue = hmOpts?.showValue ?? true;
        const hmScale = hmOpts?.scale ?? "linear";

        // Compute min/max from all rows if not specified
        let hmMin = hmOpts?.minValue;
        let hmMax = hmOpts?.maxValue;
        if (hmMin == null || hmMax == null) {
          const allVals = allRows
            .map(r => r.metadata[col.field] as number)
            .filter(v => v != null && !Number.isNaN(v));
          if (hmMin == null) hmMin = allVals.length > 0 ? Math.min(...allVals) : 0;
          if (hmMax == null) hmMax = allVals.length > 0 ? Math.max(...allVals) : 1;
        }

        // Normalize to [0, 1]
        const normalized = (hmMax as number) === (hmMin as number)
          ? 0.5
          : normalizeValue(hmValue, hmMin as number, hmMax as number, hmScale);

        // Interpolate color
        const parseHex = (hex: string) => {
          const h = hex.replace("#", "");
          return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
        };
        const stops = palette.length - 1;
        const segment = Math.min(Math.floor(normalized * stops), stops - 1);
        const t = normalized * stops - segment;
        const c1 = parseHex(palette[segment]);
        const c2 = parseHex(palette[segment + 1]);
        const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
        const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
        const bgColor = `rgb(${r},${g},${b})`;
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const textColor = luminance > 0.5 ? theme.content.primary : "#ffffff";

        // Background rect
        lines.push(`<rect x="${currentX + 2}" y="${y + 2}" width="${width - 4}" height="${rowHeight - 4}"
          fill="${bgColor}" rx="2"/>`);

        if (showValue) {
          lines.push(`<text class="cell-text" x="${currentX + width / 2}" y="${textY}"
            font-family="${theme.text.body.family}"
            font-size="${fontSize * 0.9}px"
            font-weight="${400}"
            text-anchor="middle"
            fill="${textColor}">${hmValue.toFixed(hmDecimals)}</text>`);
        }
      }
    } else if (col.type === "progress") {
      // Render progress bar
      const progValue = row.metadata[col.field] as number;
      if (progValue !== undefined && progValue !== null && !Number.isNaN(progValue)) {
        const progOpts = col.options?.progress;
        const progMax = progOpts?.maxValue ?? 100;
        const progCellBundle = resolveSemanticBundle(row.cellStyles?.[col.field], theme);
        const progRowBundle = resolveSemanticBundle(row.style, theme);
        const progColor = progOpts?.color
          ?? progCellBundle?.markerFill
          ?? progRowBundle?.markerFill
          ?? (theme.inputs as { brand?: string } | undefined)?.brand
          ?? theme.accent.default;
        const progShowLabel = progOpts?.showLabel ?? true;
        const progScale = progOpts?.scale ?? "linear";
        // Label shows raw percent-of-max (scale-independent), bar width uses the transform
        const pct = Math.min(100, Math.max(0, (progValue / progMax) * 100));
        const ratio = normalizeValue(progValue, 0, progMax, progScale);

        const barHeight = 10;
        const barY = y + (rowHeight - barHeight) / 2;
        const labelWidth = progShowLabel ? 40 : 0;
        const barAreaWidth = width - SPACING.TEXT_PADDING * 2 - labelWidth;
        const barWidth = ratio * barAreaWidth;

        // Track
        lines.push(`<rect x="${currentX + SPACING.TEXT_PADDING}" y="${barY}" width="${barAreaWidth}" height="${barHeight}"
          fill="${theme.divider.subtle}" opacity="0.5" rx="5"/>`);
        // Fill
        lines.push(`<rect x="${currentX + SPACING.TEXT_PADDING}" y="${barY}" width="${Math.max(0, barWidth)}" height="${barHeight}"
          fill="${progColor}" rx="5"/>`);

        if (progShowLabel) {
          lines.push(`<text class="cell-text" x="${currentX + width - SPACING.TEXT_PADDING}" y="${textY}"
            font-family="${theme.text.body.family}"
            font-size="${fontSize * 0.9}px"
            font-weight="${400}"
            text-anchor="end"
            fill="${theme.content.primary}">${Math.round(pct)}%</text>`);
        }
      }
    } else {
      // Default text rendering with cell styling
      // Priority: per-cell style > row-level style > default
      const cellStyle = row.cellStyles?.[col.field];
      const rowStyle = row.style;

      // Semantic bundle resolved from row/cell flags — single source of truth
      // for fg / fontWeight / fontStyle when a semantic class applies. Mirrors
      // the interactive path (ForestPlot.svelte .data-cell.row-has-semantic).
      const cellSemBundle =
        resolveSemanticBundle(cellStyle, theme) ??
        resolveSemanticBundle(rowStyle, theme);

      // Font weight: explicit cell/row bold > bundle > default
      let cellFontWeight = 400;
      if (cellStyle?.bold || rowStyle?.bold) {
        cellFontWeight = 600;
      } else if (cellSemBundle?.fontWeight != null) {
        cellFontWeight = cellSemBundle.fontWeight;
      }

      // Font style: explicit italic > bundle > default
      let cellFontStyle = "normal";
      if (cellStyle?.italic || rowStyle?.italic) {
        cellFontStyle = "italic";
      } else if (cellSemBundle?.fontStyle != null) {
        cellFontStyle = cellSemBundle.fontStyle;
      }

      // Color: explicit cell/row color > bundle fg > cellForeground > foreground
      let cellColor = (theme.cell.fg ?? theme.content.primary);
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
        const cellPadding = (theme.spacing.cellPaddingX ?? 10) * 2;
        const contentWidth = Math.max(1, width - cellPadding);
        const wrappedLines = wrapTextIntoLines(value, contentWidth, fontSize, cap);
        const lineHeight = 1.5;
        const lineHeightPx = Math.ceil(fontSize * lineHeight);
        const blockHeight = lineHeightPx * wrappedLines.length;
        // Center the multi-line block within the row, then position each
        // line at its baseline (~ 0.8 of fontSize down from line top).
        const blockTop = y + (rowHeight - blockHeight) / 2;
        for (let li = 0; li < wrappedLines.length; li++) {
          const lineY = blockTop + li * lineHeightPx + Math.round(fontSize * 0.8);
          lines.push(`<text class="cell-text" x="${textX}" y="${lineY}"
            font-family="${theme.text.body.family}"
            font-size="${fontSize}px"
            font-weight="${cellFontWeight}"
            font-style="${cellFontStyle}"
            text-anchor="${anchor}"
            fill="${cellColor}">${escapeXml(wrappedLines[li])}</text>`);
        }
      } else {
        lines.push(`<text class="cell-text" x="${textX}" y="${textY}"
          font-family="${theme.text.body.family}"
          font-size="${fontSize}px"
          font-weight="${cellFontWeight}"
          font-style="${cellFontStyle}"
          text-anchor="${anchor}"
          fill="${cellColor}">${escapeXml(value)}</text>`);
      }
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
  labelY?: number
): string {
  const dashArray = style === "dashed" ? "6,4" : style === "dotted" ? "2,2" : "";
  const dashAttr = dashArray ? ` stroke-dasharray="${dashArray}"` : "";
  let svg = `<line x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"
    stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}"${dashAttr}/>`;

  if (label) {
    const labelColor = theme.content.secondary;
    const ty = labelY ?? y1 - 4;
    svg += `<text x="${x}" y="${ty}" text-anchor="middle"
      font-family="${theme.text.body.family}"
      font-size="${theme.text.label.size}"
      font-weight="${500}"
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
    // Viz column widths: check autoWidths first, then col.width, then layout default
    if (col.type === "viz_bar" || col.type === "viz_boxplot" || col.type === "viz_violin") {
      const precomputed = autoWidths.get(col.id);
      if (precomputed !== undefined) return precomputed;
      if (typeof col.width === "number") return col.width;
      return layout.forestWidth;
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
  const bgColor = options.backgroundColor ?? theme.surface.base;
  parts.push(`<rect width="100%" height="100%" fill="${bgColor}"/>`);

  // Container border (if enabled in theme)
  // Web CSS: border: var(--tv-container-border, none); border-radius: var(--tv-container-border-radius, 8px);
  if (theme.layout.containerBorder !== false) {
    const borderRadius = theme.layout.containerBorderRadius ?? 8;
    parts.push(`<rect x="0.5" y="0.5"
      width="${layout.totalWidth - 1}" height="${layout.totalHeight - 1}"
      fill="none" stroke="${theme.divider.subtle}" stroke-width="1"
      rx="${borderRadius}" ry="${borderRadius}"/>`);
  }

  // Header (title, subtitle)
  parts.push(renderHeader(spec, layout, theme));

  // Top table border - frames column headers (symmetric with header bottom border)
  const headerBorderW = 2;
  const headerVariantRule = theme.variants?.headerStyle === "bold"
    ? (theme.header?.bold?.rule ?? theme.divider.strong ?? theme.divider.subtle)
    : (theme.header?.light?.rule ?? theme.divider.strong ?? theme.divider.subtle);
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
    const headerBg = (theme.variants?.headerStyle === "bold" ? theme.header.bold.bg : theme.header.light.bg);
    if (headerBg && headerBg !== theme.surface.base) {
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
      showLabelHeader
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
  const { rowPositions, rowHeights } = layout;

  const plotY = layout.mainY + layout.headerHeight;

  // Pre-compute per-row band indices honoring the BandingSpec grammar. This
  // is the single source of truth for banding — the row-background pass
  // below and the group-header renderer both consult it.
  const bandIndexes = computeBandIndexes(
    displayRows,
    theme.layout.banding,
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
        parts.push(`<rect x="${padding}" y="${y}"
          width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
          fill="${theme.content.muted}" fill-opacity="0.1"/>`);
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
        const bgColor = theme.row.alt.bg;
        if (bgColor !== theme.surface.base) {
          parts.push(`<rect x="${padding}" y="${y}"
            width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
            fill="${bgColor}"/>`);
        }
      }
      // Semantic bundle border (drawn as a bottom-edge line). Mirrors the
      // interactive path (ForestPlot.svelte applies `border-bottom: 1px solid
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
        const bgColor = theme.row.alt.bg;
        if (bgColor !== theme.surface.base) {
          parts.push(`<rect x="${padding}" y="${y}"
            width="${layout.totalWidth - padding * 2}" height="${rowHeight}"
            fill="${bgColor}"/>`);
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
      const wmFill = spec.watermarkColor ?? theme.content.primary;
      const wmOpacity = spec.watermarkOpacity ?? 0.07;
      parts.push(
        `<text x="${cx}" y="${cy}" ` +
        `transform="rotate(${angleDeg.toFixed(2)} ${cx} ${cy})" ` +
        `text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="${theme.text.body.family}" ` +
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
      theme.content.muted,
      theme
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
          ann.color ?? theme.accent.default,
          theme,
          ann.label,
          ann.width ?? 1,
          ann.opacity ?? 0.6,
          annotationLabelBaseY + labelYOffset
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
            const annY = plotY + rowPositions[i] + rowHeights[i] / 2;
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
      parts.push(renderVizAnnotations(opts.annotations, xScale, vizX, plotY, layout.rowsHeight));
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
      parts.push(`</g>`);

      // Render axis if showAxis is enabled
      if (opts.showAxis !== false) {
        parts.push(`<g transform="translate(0, ${plotY + layout.rowsHeight + layout.axisGap})">`);
        parts.push(renderVizAxis(xScale, layout, theme, opts.axisLabel, vizX, vizWidth, opts.nullValue, opts.scale === "log"));
        parts.push("</g>");
      }
    } else if (vizColInfo.type === "viz_boxplot") {
      const opts = col.options?.vizBoxplot as VizBoxplotColumnOptions | undefined;
      if (!opts) continue;

      // Compute shared scale for all rows
      const xScale = computeVizBoxplotScale(allDataRows, opts, vizWidth, override);

      parts.push(`<g clip-path="url(#${clipId})">`);
      // Reference-line annotations (drawn behind boxes)
      parts.push(renderVizAnnotations(opts.annotations, xScale, vizX, plotY, layout.rowsHeight));
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
      parts.push(`</g>`);

      // Render axis if showAxis is enabled
      if (opts.showAxis !== false) {
        parts.push(`<g transform="translate(0, ${plotY + layout.rowsHeight + layout.axisGap})">`);
        parts.push(renderVizAxis(xScale, layout, theme, opts.axisLabel, vizX, vizWidth, opts.nullValue, opts.scale === "log"));
        parts.push("</g>");
      }
    } else if (vizColInfo.type === "viz_violin") {
      const opts = col.options?.vizViolin as VizViolinColumnOptions | undefined;
      if (!opts) continue;

      // Compute shared scale for all rows
      const xScale = computeVizViolinScale(allDataRows, opts, vizWidth, override);

      parts.push(`<g clip-path="url(#${clipId})">`);
      // Reference-line annotations (drawn behind violins)
      parts.push(renderVizAnnotations(opts.annotations, xScale, vizX, plotY, layout.rowsHeight));
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
      parts.push(`</g>`);

      // Render axis if showAxis is enabled
      if (opts.showAxis !== false) {
        parts.push(`<g transform="translate(0, ${plotY + layout.rowsHeight + layout.axisGap})">`);
        parts.push(renderVizAxis(xScale, layout, theme, opts.axisLabel, vizX, vizWidth, opts.nullValue, opts.scale === "log"));
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
        // v0.24.1+: when this row is padded-after (last data row of a
        // top-level group), the track is rowHeight + rowGroupPadding
        // tall but content stays anchored at the original visible band
        // (mirrors `align-items: center; padding-bottom` in the live
        // CSS). Pass the visible-band height so text Y-centerline
        // doesn't drift into the empty separator strip.
        const trailingPad = layout.rowPaddedAfter[i]
          ? (theme.spacing.rowGroupPadding ?? 0)
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
          barMaxValues,
          autoWidths,
          getColWidth,
          columnPositions,
          allDataRows
        ));
      }
    }

    // Row borders — widths come from theme.shapes.{rowBorderWidth,
    // headerBorderWidth, rowGroupBorderWidth}.
    const rowBorderW = theme.row.borderWidth ?? 1;
    const headerBorderW = 2;
    const groupBorderW = 1;
    if (displayRow.type === "data") {
      const row = displayRow.row;
      const isSummaryRow = row.style?.type === "summary";
      const isSpacerRow = row.style?.type === "spacer";

      // Summary rows get a header-weight top border
      if (isSummaryRow && headerBorderW > 0) {
        parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
          y1="${y}" y2="${y}"
          stroke="${theme.divider.subtle}" stroke-width="${headerBorderW}"/>`);
      }

      // Bottom border (skip for spacer rows and zero-width themes)
      if (!isSpacerRow && rowBorderW > 0) {
        parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
          y1="${y + rowHeight}" y2="${y + rowHeight}"
          stroke="${theme.divider.subtle}" stroke-width="${rowBorderW}"/>`);
      }
    } else if (groupBorderW > 0) {
      // Group headers get a bottom border at the group-weight (not row-weight)
      // so row-group borders can be independently tuned.
      parts.push(`<line x1="${padding}" x2="${layout.totalWidth - padding}"
        y1="${y + rowHeight}" y2="${y + rowHeight}"
        stroke="${theme.divider.subtle}" stroke-width="${groupBorderW}"/>`);
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
