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

/** Default watermark fill-opacity when `spec.watermarkOpacity` is unset.
 *  ONE source for the DOM renderer (Watermark.svelte), the SVG export
 *  (svg-generator), AND the settings panel slider's displayed start value —
 *  the panel was showing 0.08 while both renderers used 0.07, so opening
 *  Labels misrepresented the rendered value (drift, 2026-06-13). */
export const DEFAULT_WATERMARK_OPACITY = 0.07;

// ============================================================================
// Text Measurement Constants
// ============================================================================

export const TEXT_MEASUREMENT = {
  /** Buffer for Canvas vs CSS text rendering differences */
  RENDERING_BUFFER: 4,
  // The interim COMPOSED_TEXT_BUFFER fudge (2026-06-16) was RETIRED: composed
  // cells (interval / variant layouts / custom) now measure their ACTUAL
  // render tree via `measureComposedColumnWidth` — the structural fix the
  // buffer's comment promised. See `schema/measure-composed.ts`.
  /** Per-SPAN side-bearing added when measuring a composed cell's DOM layout.
   *  Each leaf of a composed tree is an independent inline box the browser
   *  rounds up and can't kern across its neighbors, so the multi-span sum runs
   *  ~1px/span wider than a single continuous run. Scales with span count (not
   *  string length), so it's a per-leaf constant — unlike the retired flat
   *  COMPOSED_TEXT_BUFFER. DOM-only: the SVG export draws at fractional x. */
  COMPOSED_SPAN_BEARING: 1.5,

  /** Default axis gap fallback (should match theme.spacing.axisGap default) */
  DEFAULT_AXIS_GAP: 12,
} as const;

// ============================================================================
// Badge Constants (for label column width measurement)
// ============================================================================

/** Heatmap VALUE-text contrast colors. Theme-INDEPENDENT by design: the
 *  text overlays a DATA-DRIVEN cell color (the palette), so contrast is
 *  chosen against that cell, not the theme — a near-black on light cells,
 *  near-white on dark. ONE source for the DOM + SVG export. (The SVG used
 *  the theme's `readContentPrimary` for the dark text, which is LIGHT in a
 *  dark theme → unreadable light-on-light heatmap text in exports —
 *  cell-parity review, 2026-06-14.) */
export const HEATMAP_TEXT = {
  DARK: "#1a1a1a",
  LIGHT: "#ffffff",
} as const;

export const BADGE = {
  /** Font size multiplier relative to base font. Mirrors CellBadge.svelte
   *  `.badge-base { font-size: 0.77em }` — the live DOM reference. */
  FONT_SCALE: 0.77,

  /** `size: "sm"` multiplier. Mirrors CellBadge.svelte `.badge-sm
   *  { font-size: 0.7em }` — the export used to ignore `size` entirely so a
   *  small badge rendered base-sized in static output (DOM↔export divergence). */
  FONT_SCALE_SM: 0.7,

  /** Horizontal padding inside the badge pill, ONE side. Mirrors
   *  CellBadge.svelte `.badge-pill { padding: 0 10px }`. Drives pill WIDTH +
   *  the column-width estimator (both DOM + SVG). Was conflated with the
   *  vertical pad at 4 (badge cells under-sized + the export pill narrower
   *  than the DOM); split 2026-06-14 so width tracks the real CSS. */
  PADDING_X: 10,

  /** Vertical padding inside the badge pill, ONE side — drives pill HEIGHT
   *  (height = fontSize + 2·PADDING_Y). Distinct from PADDING_X: the DOM pill
   *  has 0 CSS vertical padding (height is the line-box), and ~4px reproduces
   *  that line-box height in the export's font-box model. */
  PADDING_Y: 4,

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
  // NOTE: label FONT SIZE is the `label` type-role (readLabelSize), not a
  // constant — see feedback_type_roles_not_multipliers. LABEL_SCALE removed.
  /** Minimum label cell width (CSS: .bar-label min-width: 32px) */
  LABEL_MIN_WIDTH: 32,
  /** Gap between bar track and label (CSS: .cell-bar gap: 6px) */
  GAP: 6,
  /** Track fill opacity (subtle band behind the bar) */
  TRACK_OPACITY: 1,
} as const;

/**
 * Progress-bar (col_progress) geometry. Mirrors CellProgress.svelte's CSS so
 * the SVG export renders the same shape as the live widget. Was module-local
 * consts in progress-renderer.ts that drifted from the DOM (label width 40 vs
 * 32, label font 0.9 vs 0.75, track --tv-cell-border vs the DOM's --tv-border);
 * centralized + reconciled to the DOM reference 2026-06-14.
 */
export const PROGRESS = {
  /** Track + fill height (CSS: .progress-track height: 10px) */
  BAR_HEIGHT: 10,
  /** Track corner radius (CSS: border-radius: 5px) */
  BAR_RADIUS: 5,
  /** Label reservation FLOOR (CSS: .progress-label min-width: 32px). The
   *  renderer reserves max(this, measured label width) so a wide label
   *  ("100%", or a larger label-size theme) doesn't overrun the bar — the DOM
   *  flex row grows the label past this min the same way. A fixed reservation
   *  was the latent overlap. */
  LABEL_MIN_WIDTH: 32,
  /** Track fill opacity over the border color (CSS: color-mix(border 50%, transparent)) */
  TRACK_OPACITY: 0.5,
  // NOTE: the label FONT SIZE is NOT a constant here — it's the `label`
  // type-role (`--tv-text-label-size`, the DOM's `var(--tv-text-label-size)`).
  // The renderer reads readLabelSize() so a theme can move it; a magic 0.75/0.9
  // multiplier was the very divergence this reconcile removed.
} as const;

/**
 * Sparkline (col_sparkline) geometry. Mirrors CellSparkline.svelte.
 */
export const SPARKLINE = {
  /** Default chart height (px) when the column sets none. ONE source for
   *  the DOM (CellSparkline) + the SVG export — they disagreed (20 vs 16),
   *  so unset sparklines rendered a different height in widget vs export. */
  DEFAULT_HEIGHT: 20,
  /** Fallback chart width (px) before the DOM cell measures its column;
   *  the live sparkline fills the column (like the export), this is only
   *  the pre-measure default. */
  DEFAULT_WIDTH: 60,
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

  /** Background-tint opacity per nesting level (1-based: L1/L2/L3+) for the SVG
   *  export's group-header band. Indexed by `level-1`, clamped to the last. */
  LEVEL_TINT_OPACITY: [0.15, 0.10, 0.06],
} as const;

/**
 * Forest/viz legend strip geometry (SVG export). Positioning constants for the
 * single-row legend drawn in the axis band — names over bare literals; the
 * `*_ASCENT_RATIO` values are font-box metrics (text top / baseline offsets),
 * NOT type sizes, so they stay multipliers.
 */
export const LEGEND = {
  /** Glyph swatch box (px). */
  GLYPH_PX: 9,
  /** Left inset from the band padding (px). */
  START_OFFSET: 4,
  /** Gap after the glyph, before its label (px). */
  GLYPH_LABEL_GAP: 5,
  /** Gap after a label, before the next entry (px). */
  ENTRY_GAP: 16,
  /** Label-size ascent ratio for the band's vertical midpoint. */
  BAND_ASCENT_RATIO: 0.85,
  /** Baseline nudge for the text + glyph vertical centering (× fontSize). */
  TEXT_ASCENT_RATIO: 0.35,
  GLYPH_ASCENT_RATIO: 0.3,
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
  /** Glyph-cell label font px, scaled by glyph size — shared by the ring +
   *  pictogram renderers (was duplicated in each). NOTE: a label drawn at the
   *  `label` type-role × glyph-size factor would be more themeable than these
   *  fixed px (see feedback_type_roles_not_multipliers) — a future refinement. */
  labelFontPx: { sm: 9, base: 11, lg: 12 },
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
 * Fallback series palette for viz_bar/boxplot/violin when the theme carries no
 * resolved series fills. ONE source — was duplicated inline at three call sites
 * in svg-generator.ts.
 */
export const VIZ_DEFAULT_SERIES_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
] as const;

/**
 * viz_bar / viz_boxplot / viz_violin mark geometry. Each value is HARD-MIRRORED
 * between the DOM component (components/viz/Viz*.svelte) and the SVG export
 * (svg-generator.ts) — they were duplicated literals in both. One source now;
 * the wysiwyg gate guards the DOM↔export equality.
 */
export const VIZ = {
  /** Mark block height as a fraction of the row height. */
  BAR_HEIGHT_RATIO: 0.7,
  BOXPLOT_HEIGHT_RATIO: 0.7,
  VIOLIN_HEIGHT_RATIO: 0.8,
  /** Default per-effect fill opacity (when the effect pins none). */
  BAR_OPACITY: 0.85,
  BOXPLOT_OPACITY: 0.7,
  VIOLIN_OPACITY: 0.5,
  /** Violin outline / quartile stroke as a fraction of theme.plot.lineWidth. */
  VIOLIN_STROKE_RATIO: 0.33,
  VIOLIN_QUARTILE_STROKE_RATIO: 0.67,
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

