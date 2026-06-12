/**
 * Shared rendering constants for forest plots
 *
 * Algorithmic constants (SVG path math, layout estimation, text
 * measurement) — consumed directly by the Svelte renderer and the
 * pure svg-generator. Stay as TS exports; never cross the CSS boundary.
 * (The old CSS-shaped partition — two opacity custom properties emitted
 * by a generator helper — was deleted in the 2026-06 dead-code pass:
 * nothing consumed the vars.)
 */

// ============================================================================
// Group Header Opacity
// ============================================================================

/** Opacity for group header row backgrounds (uses primary color) */
export const GROUP_HEADER_OPACITY = 0.05; // 5%

// ============================================================================
// Interactive State Opacity (web renderer only - SVG is static)
// ============================================================================

/** Opacity for hovered rows */
export const ROW_HOVER_OPACITY = 0.12; // 12%

// `GROUP_HEADER_HOVER_OPACITY` removed in Phase 0c-C6 (orphan; no
// consumers in CSS or TS).

// ============================================================================
// Text Measurement Constants
// ============================================================================

export const TEXT_MEASUREMENT = {
  /** Buffer for Canvas vs CSS text rendering differences */
  RENDERING_BUFFER: 4,
  /** INTERIM (2026-06-12): composed cell types (interval/events) render
   *  as span trees whose width exceeds their plain string by separator/
   *  spacing chrome — string measurement (canvas or estimator) cannot
   *  see it. This buffer covers the observed delta until per-type
   *  composed-width behaviors land (the structural fix; see
   *  hero-width-repro's header). */
  COMPOSED_TEXT_BUFFER: 18,

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

/**
 * Inline-bar (col_bar) geometry. Mirrors CellBar.svelte's CSS contract so
 * the SVG export renders the same shape as the live widget. Decoupled from
 * theme.plot.pointSize (which is forest-marker geometry, not bar styling).
 */
export const BAR = {
  /** Track + fill height in px (CSS: .bar-track height: 8px) */
  HEIGHT: 8,
  /** Track corner radius (CSS: border-radius: 2px) */
  RADIUS: 2,
  /** Label font size multiplier vs body (CSS small-label size ≈ 0.75rem) */
  LABEL_SCALE: 0.75,
  /** Minimum label cell width (CSS: .bar-label min-width: 32px) */
  LABEL_MIN_WIDTH: 32,
  /** Gap between bar track and label (CSS: .cell-bar gap: 6px) */
  GAP: 6,
  /** Track fill opacity (subtle band behind the bar) */
  TRACK_OPACITY: 1,
} as const;

/**
 * Sparkline (col_sparkline) geometry. Mirrors CellSparkline.svelte.
 */
export const SPARKLINE = {
  /** Stroke width for line and area variants */
  STROKE_WIDTH: 1.5,
  /** Inner padding so stroke isn't clipped at edges */
  PADDING: 2,
  /** Area fill opacity */
  AREA_OPACITY: 0.3,
  /** Bar variant fill opacity */
  BAR_OPACITY: 0.8,
  /** End-dot radius for line variant */
  DOT_RADIUS: 2,
  /** Catmull-Rom curve tension (matches d3 curveCatmullRom.alpha(0.5)) */
  CURVE_ALPHA: 0.5,
} as const;

// ============================================================================
// Layout Constants
// ============================================================================

export const LAYOUT = {
  /** Default width for label column (Study names) */
  DEFAULT_LABEL_WIDTH: 200,

  /** Default width for data columns */
  DEFAULT_COLUMN_WIDTH: 100,

  // NOTE: the old `AXIS_HEIGHT: 32` constant was removed — the reserved axis
  // band is now computed dynamically by `computeAxisHeight()` (table-metrics.ts);
  // a static 32 silently broke when users raised font sizes.

  /** Height reserved for axis label text below axis */
  AXIS_LABEL_HEIGHT: 32,

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

  /** Point to pixel conversion factor (1pt = 1/72 inch, at 96dpi = 96/72 ≈ 1.333px) */
  PT_TO_PX: 96 / 72,

  /**
   * Baseline adjustment factor for vertical text centering.
   * @deprecated Use dominant-baseline="central" in SVG instead for proper centering.
   * Kept for backwards compatibility with legacy positioning code.
   */
  TEXT_BASELINE_ADJUSTMENT: 0.35,

  /** Average character width as ratio of font size (for rough text width estimation) */
  AVG_CHAR_WIDTH_RATIO: 0.55,
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

  // Note: AXIS_LABEL_PADDING (30px) was removed in v0.4.1 - use VIZ_MARGIN (12px) from axis-utils.ts instead
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
 * Width calculation is performed by both the web view (tabvizStore.svelte.ts)
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
    progress: 100, // ~60px track + ~32px label + 6px gap + padding (matches CellProgress CSS)
    stars: 84, // 5 stars at ~12px each + 32px padding
    range: 84, // visual element + 32px padding
    badge: 74, // minimum for short badges + pill padding
    // Glyph columns: minimums chosen to fit the typical small/base size
    // rendering. Auto-width calculation also reads the per-row geometry via
    // glyphNaturalWidth() so columns expand to fit larger data — the
    // minimum is just the floor when content doesn't push past it.
    pictogram: 84, // ~5 base-size glyphs (5 × 14px + gaps + padding)
    icon: 60, // single base-size glyph + padding
    ring: 84, // base-size donut (24px) + label + padding
    // Viz columns (full visualization with axis) need larger minimums
    forest: 200, // forest plot with axis
    viz_bar: 150, // bar chart with axis
    viz_boxplot: 150, // boxplot with axis
    viz_violin: 150, // violin plot with axis
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
// Multi-Effect Rendering Constants
// ============================================================================

/**
 * Constants for rendering multiple effects per row (e.g., comparing treatments).
 * Used by both RowInterval.svelte and svg-generator.ts.
 */
export const EFFECT = {
  /** Vertical spacing between multiple effects on the same row (pixels) */
  SPACING: 6,
} as const;

// ============================================================================
// Cell glyph geometry — single source of truth
// ============================================================================

/**
 * Per-size pixel geometry for the glyph-style cell columns (pictogram, ring,
 * stars, icon). This is THE source of truth: the width-estimate behaviors
 * (`width-behaviors.ts`), the content-height behaviors (`height-behaviors.ts`),
 * the SVG cell renderers (`{pictogram,ring,stars,icon}-renderer.ts`), and the
 * absolute-px CSS in the matching Svelte components all read these numbers.
 * Before this table they were copied — and had begun to drift (the stars gap
 * disagreed between the px paths and the DOM).
 *
 * Two coordinate systems coexist deliberately:
 *  - Absolute px (`pictogram.glyphPx`, `ring.diameter`, `stars.glyphPx`,
 *    `icon.px`) — what the SVG renderer draws and the width budget reserves,
 *    and what the DOM uses where it sizes in px.
 *  - `icon.fontScale` — body-font multiples used by the DOM (CSS `rem`) and the
 *    content-height behavior, because the icon glyph is a font character that
 *    must scale with the table's font. The DOM keeps its CSS-var hook
 *    (the text-size custom properties) and mirrors these multiples; height-behaviors imports
 *    them directly.
 */
export const CELL_GEOMETRY = {
  /** Pictogram registry-glyph box + inter-glyph track gap (px). */
  pictogram: {
    glyphPx: { sm: 10, base: 14, lg: 20 },
    gap: 1,
  },
  /** Ring donut outer diameter (px). */
  ring: {
    diameter: { sm: 18, base: 24, lg: 32 },
  },
  /** Star glyph box + inter-star gap (px). */
  stars: {
    glyphPx: 12,
    gap: 2,
  },
  /** Icon glyph: absolute px (SVG/width budget) + body-font multiple (DOM/height). */
  icon: {
    px: { sm: 12, base: 14, lg: 16, xl: 26 },
    fontScale: { sm: 0.75, base: 0.875, lg: 1, xl: 1.6 },
  },
} as const;

// ============================================================================
// Aspect ladder — shared tuning constants
// ============================================================================

/**
 * Tuning constants for the aspect-ratio reshape ("aspect ladder"). The DOM path
 * (`stores/slices/layout-zoom.svelte.ts`) and the static-export path
 * (`export/svg-generator.ts::generateSVGForAspectTarget`) run the same algorithm
 * and MUST agree pixel-for-pixel, so they read these from one place rather than
 * duplicating literals kept in sync by hand. This is the constants surface only;
 * the algorithm itself is intentionally NOT consolidated here (that is the
 * separate aspect-ladder compartmentalization work).
 */
export const ASPECT = {
  /** Forest flex absorption cap: forest width clamps to [natural/CAP, natural×CAP]. */
  FLEX_CAP: 2,
  /** Lower bound on the non-forest column scale so columns can't collapse to zero. */
  NON_FOREST_SCALE_FLOOR: 0.25,
  /** Fraction of a positive height-delta routed to chrome (the rest grows rows). */
  CHROME_SHARE: 0.35,
  /** Lower bound on chromeScale once the row-height floor has saturated. */
  CHROME_SCALE_FLOOR: 0.4,
  /**
   * Minimum legible data-row height when shrinking:
   * `max(FLOOR, round(bodyFontSize × LINE_FACTOR) + PAD)`.
   */
  MIN_ROW_HEIGHT: { FLOOR: 14, LINE_FACTOR: 1.4, PAD: 4 },
  /** Height-anchored layout-width hard cap = natural width × this (DOM path only). */
  MAX_LAYOUT_WIDTH_MULT: 8,
} as const;

// ============================================================================
// Axis Rendering Constants
// ============================================================================

export const AXIS = {
  /** Threshold for adjusting tick label alignment at plot edges (pixels) */
  EDGE_THRESHOLD: 35,

  /** Minimum spacing between tick labels to prevent overlap (pixels) */
  MIN_TICK_SPACING: 50,
} as const;

// ============================================================================
// Badge Variant Colors
// ============================================================================

/**
 * Semantic color variants for badge columns.
 * Used in SVG export where CSS variables aren't available.
 * Svelte components use the badge CSS variables with these as fallbacks.
 */
export const BADGE_VARIANTS = {
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
  info: "#2563eb",
} as const;

/**
 * Calculate vertical offset for each effect (centered around yPosition).
 * When multiple effects are shown on the same row, they are vertically
 * stacked with EFFECT.SPACING pixels between them, centered on the row.
 *
 * @param index - The effect index (0-based)
 * @param total - Total number of effects
 * @returns Vertical offset in pixels from the row center
 */
export function getEffectYOffset(index: number, total: number): number {
  if (total <= 1) return 0;
  const totalHeight = (total - 1) * EFFECT.SPACING;
  return -totalHeight / 2 + index * EFFECT.SPACING;
}

