/**
 * Shared rendering constants for forest plots
 *
 * These constants are used by both the web-native Svelte renderer
 * and the pure-data SVG generator to ensure visual consistency.
 *
 * IMPORTANT: When changing any of these values, both renderers will
 * automatically use the new values. For CSS-based values in Svelte,
 * these are injected as CSS custom properties.
 */

// ============================================================================
// Row Background Opacity
// ============================================================================

/** Opacity for alternating (odd) row backgrounds */
export const ROW_ODD_OPACITY = 0.06; // 6%

/** Opacity for group header row backgrounds (uses primary color) */
export const GROUP_HEADER_OPACITY = 0.05; // 5%

/** Base opacity for depth-based row backgrounds (multiplied by depth) */
export const DEPTH_BASE_OPACITY = 0.04; // 4% per depth level

/**
 * Get opacity for a row at a given depth
 * depth 0 = 0%, depth 1 = 8%, depth 2 = 12%, depth 3 = 16%, depth 4+ = 20%
 */
export function getDepthOpacity(depth: number): number {
  if (depth <= 0) return 0;
  return DEPTH_BASE_OPACITY + depth * DEPTH_BASE_OPACITY;
}

// ============================================================================
// Interactive State Opacity (web renderer only - SVG is static)
// ============================================================================

/** Opacity for hovered rows */
export const ROW_HOVER_OPACITY = 0.12; // 12%

/** Opacity for selected rows */
export const ROW_SELECTED_OPACITY = 0.16; // 16%

/** Opacity for selected + hovered rows */
export const ROW_SELECTED_HOVER_OPACITY = 0.22; // 22%

/** Opacity for group header hover state */
export const GROUP_HEADER_HOVER_OPACITY = 0.15; // 15%

// ============================================================================
// Text Measurement Constants
// ============================================================================

export const TEXT_MEASUREMENT = {
  /** Buffer for Canvas vs CSS text rendering differences */
  RENDERING_BUFFER: 4,

  /** Default axis gap fallback (should match theme.spacing.axisGap default) */
  DEFAULT_AXIS_GAP: 12,
} as const;

// ============================================================================
// Badge Constants (for label column width measurement)
// ============================================================================

export const BADGE = {
  /** Font size multiplier relative to base font */
  FONT_SCALE: 0.8,

  /** Horizontal padding inside badge pill (one side) */
  PADDING: 4,

  /** Gap between label text and badge */
  GAP: 6,
} as const;

// ============================================================================
// Layout Constants
// ============================================================================

export const LAYOUT = {
  /** Default width for label column (Study names) */
  DEFAULT_LABEL_WIDTH: 200,

  /** Default width for data columns */
  DEFAULT_COLUMN_WIDTH: 100,

  /** Height reserved for x-axis line and ticks */
  AXIS_HEIGHT: 32,

  /** Height reserved for axis label text below axis */
  AXIS_LABEL_HEIGHT: 20,

  /** Bottom margin buffer */
  BOTTOM_MARGIN: 16,

  /** Minimum width for forest plot area */
  MIN_FOREST_WIDTH: 200,

  /** Default total width when not specified */
  DEFAULT_WIDTH: 800,

  /** Gap between table sections and forest plot */
  COLUMN_GAP: 16,
} as const;

// ============================================================================
// Typography Constants
// ============================================================================

export const TYPOGRAPHY = {
  /** Height for title text area */
  TITLE_HEIGHT: 28,

  /** Height for subtitle text area */
  SUBTITLE_HEIGHT: 20,

  /** Height for caption text area */
  CAPTION_HEIGHT: 16,

  /** Height for footnote text area */
  FOOTNOTE_HEIGHT: 14,

  /** Default font size fallback (px) */
  DEFAULT_FONT_SIZE: 14,

  /** Base rem size for font calculations */
  REM_BASE: 16,

  /** Baseline adjustment factor for vertical text centering */
  TEXT_BASELINE_ADJUSTMENT: 1 / 3,
} as const;

// ============================================================================
// Spacing Constants
// ============================================================================

export const SPACING = {
  /** Indentation per hierarchy level */
  INDENT_PER_LEVEL: 12,

  /** Padding inside cells */
  TEXT_PADDING: 10,

  /** Whisker half-height for confidence intervals */
  WHISKER_HALF_HEIGHT: 4,

  /** Default tick count for axis */
  DEFAULT_TICK_COUNT: 5,

  /** Padding at edges of axis to prevent label clipping */
  AXIS_LABEL_PADDING: 30,
} as const;

// ============================================================================
// Rendering Constants
// ============================================================================

export const RENDERING = {
  /** Height multiplier for header when column groups exist (more compact two-tier headers) */
  GROUP_HEADER_HEIGHT_MULTIPLIER: 1.3,

  /** Height multiplier for overall summary row */
  OVERALL_ROW_HEIGHT_MULTIPLIER: 1.5,
} as const;

// ============================================================================
// Auto Width Constants
// ============================================================================

/**
 * Column width calculation constants.
 *
 * === WIDTH CALCULATION OVERVIEW ===
 *
 * Width calculation is performed by both the web view (forestStore.svelte.ts)
 * and the SVG generator (svg-generator.ts). Both use theme-based padding values
 * and follow the same algorithm to ensure visual consistency.
 *
 * === CALCULATION FLOW ===
 *
 * 1. LEAF COLUMN MEASUREMENT
 *    For each column with width="auto" or null:
 *    - Measure header text width (using headerFontScale from theme)
 *    - Measure all cell content widths (using display text, not raw value)
 *    - Take maximum width
 *    - Add padding: (theme.spacing.cellPaddingX × 2) + RENDERING_BUFFER
 *    - Clamp to [MIN, MAX] (or type-specific VISUAL_MIN)
 *
 * 2. COLUMN GROUP EXPANSION
 *    For each column group (columns grouped under a shared header):
 *    - Measure group header text + (theme.spacing.groupPadding × 2) + RENDERING_BUFFER
 *    - Sum widths of all leaf columns under this group
 *    - If group header is wider than children sum:
 *      - Distribute extra width evenly to ALL children
 *      - This may override explicit-width columns to fit the header
 *
 * 3. LABEL COLUMN MEASUREMENT
 *    The label column (study names) has special handling:
 *    - Measure label header text
 *    - Measure each row's label + indentation
 *    - Measure badges (if present): label + gap + badge text + badge padding
 *    - Measure group headers: indent + chevron + gap + label + gap + count + internal padding
 *    - Add padding: (theme.spacing.cellPaddingX × 2) + RENDERING_BUFFER
 *    - Clamp to [MIN, LABEL_MAX]
 *
 * === TEXT MEASUREMENT ===
 *
 * - Web view: Uses Canvas.measureText() for accurate measurement
 * - SVG generator: Uses estimateTextWidth() character-class approximation
 *
 * The web view performs two measurement passes:
 * 1. Immediate measurement (may be inaccurate if fonts not loaded)
 * 2. After document.fonts.ready (accurate with custom fonts)
 *
 * === PADDING VALUES ===
 *
 * Padding is now theme-based (not a magic number):
 * - Cell padding: theme.spacing.cellPaddingX × 2 (default: 10px × 2 = 20px)
 * - Group header padding: theme.spacing.groupPadding × 2 (default: 8px × 2 = 16px)
 * - RENDERING_BUFFER: 4px (covers Canvas vs CSS text rendering differences)
 *
 * The PADDING constant below is only used for VISUAL_MIN fallback calculations.
 */
export const AUTO_WIDTH = {
  /** Legacy padding constant - only used for VISUAL_MIN defaults. Actual padding comes from theme. */
  PADDING: 32,

  /** Minimum width for auto-sized columns */
  MIN: 60,

  /** Maximum width for auto-sized data columns */
  MAX: 600,

  /** Maximum width for auto-sized label column */
  LABEL_MAX: 400,

  /** Minimum widths for visual column types (element width + cell padding) */
  VISUAL_MIN: {
    sparkline: 92, // 60px SVG + 32px padding
    bar: 100, // ~60px track + ~32px label + padding
    stars: 84, // 5 stars at ~12px each + 32px padding
    range: 84, // visual element + 32px padding
    badge: 74, // minimum for short badges + pill padding
  } as Record<string, number>,
} as const;

// ============================================================================
// Group Header Constants (for label column measurement)
// ============================================================================

/**
 * Constants for measuring row group headers in the label column.
 * These match the GroupHeader.svelte component layout.
 *
 * GroupHeader layout: [indent][chevron][gap][label][gap][count][internal-padding]
 */
export const GROUP_HEADER = {
  /** Width of the expand/collapse chevron SVG icon */
  CHEVRON_WIDTH: 12,

  /** Gap between elements (chevron-label, label-count) */
  GAP: 6,

  /** Safety margin for group header width calculation (accounts for rendering variance) */
  SAFETY_MARGIN: 8,
} as const;

// ============================================================================
// Column Group Header Constants
// ============================================================================

/**
 * Constants for column group header cells.
 * These match the .column-group-header CSS in ForestPlot.svelte.
 *
 * Column group headers span multiple child columns and have their own padding.
 */
export const COLUMN_GROUP = {
  /** Horizontal padding for column group header cells (--wf-group-padding default) */
  PADDING: 16, // 8px left + 8px right
} as const;

// ============================================================================
// CSS Custom Property Generation (for Svelte components)
// ============================================================================

/**
 * Generate CSS custom properties for rendering constants
 * Used by ForestPlot.svelte to inject consistent values
 */
export function generateCSSVariables(): string {
  return `
    --wf-row-odd-opacity: ${ROW_ODD_OPACITY};
    --wf-group-header-opacity: ${GROUP_HEADER_OPACITY};
    --wf-row-hover-opacity: ${ROW_HOVER_OPACITY};
    --wf-row-selected-opacity: ${ROW_SELECTED_OPACITY};
    --wf-depth-base-opacity: ${DEPTH_BASE_OPACITY};
  `.trim();
}
