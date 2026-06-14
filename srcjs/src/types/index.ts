// Core types for tabviz
// Generic table + interval visualization

// ============================================================================
// Data Types
// ============================================================================

export interface RowStyle {
  type?: "data" | "header" | "summary" | "spacer";
  // `bold` doubles as a styling primitive (from row_bold_col) AND as the
  // "bold" semantic token applied by the painter. Both pathways set the
  // flag; the renderer applies theme.row.bold when set.
  bold?: boolean;
  italic?: boolean;
  color?: string | null;
  bg?: string | null;
  indent?: number;
  icon?: string | null;
  badge?: string | null;
  // Semantic styling tokens. Painter applies one at a time; data columns
  // can flip multiple. Precedence (loud → quiet):
  // fill > accent > emphasis > bold > muted.
  emphasis?: boolean;   // Bold + primary fg + primary marker
  muted?: boolean;      // Lighter color
  accent?: boolean;     // Bold + accent color
  fill?: boolean;       // Bold + pastel accent-derived row tint
}

export type MarkerShape = "square" | "circle" | "diamond" | "triangle";

export interface MarkerStyle {
  color?: string;
  shape?: MarkerShape;
  opacity?: number;
  size?: number;
}

// Per-cell styling (subset of RowStyle applicable to individual cells)
export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string | null;
  bg?: string | null;
  badge?: string | null;
  icon?: string | null;
  // Semantic styling — same five tokens as RowStyle. Precedence:
  // fill > accent > emphasis > bold > muted.
  emphasis?: boolean;
  muted?: boolean;
  accent?: boolean;
  fill?: boolean;
  // Per-cell hover tooltip text (overrides the default value-as-title)
  tooltip?: string | null;
}

/**
 * Style-mapping values per ColumnSpec. Each entry can be:
 *   - a bare string (legacy field-reference; back-compat with today's
 *     `bold = "highlight_col"` shape)
 *   - a tagged union from `$schema/styling::StyleMappingValue`
 *     (`{ kind: "theme" | "static" | "field" | "condition", ... }`)
 *     — the canonical shape that supports condition references and
 *     explicit static / theme modes.
 *
 * Renderers call `normalizeStyle(value)` from `$schema/styling` at
 * the read site; downstream code switches on `kind` without
 * re-handling the legacy string form.
 */
export interface StyleMapping {
  bold?:     import("../schema/styling").StyleOverride<boolean>;
  italic?:   import("../schema/styling").StyleOverride<boolean>;
  color?:    import("../schema/styling").StyleOverride<string>;
  bg?:       import("../schema/styling").StyleOverride<string>;
  badge?:    import("../schema/styling").StyleOverride<string>;
  icon?:     import("../schema/styling").StyleOverride<string>;
  // Semantic styling mappings
  emphasis?: import("../schema/styling").StyleOverride<boolean>;
  muted?:    import("../schema/styling").StyleOverride<boolean>;
  accent?:   import("../schema/styling").StyleOverride<boolean>;
}

export interface Row {
  id: string;
  label: string;
  groupId?: string | null;
  metadata: Record<string, unknown>;  // ALL data lives here
  style?: RowStyle;
  // Marker styling (color, shape, opacity, size) - for per-row marker customization
  markerStyle?: MarkerStyle;
  // Per-cell styles keyed by column field name
  cellStyles?: Record<string, CellStyle>;
  // Forest plot primary effect values (when not using custom field names)
  point?: number;
  lower?: number;
  upper?: number;
  /** Details/disclosure panel content (markdown) for this row. When set, the
   *  row gets a disclosure toggle and owns a full-width child panel region.
   *  Extracted from the `details`-mapped data column at serialization. Empty /
   *  undefined → no panel. See docs/dev/region-tree.md + row-types.md §6. */
  details?: string;
}

export interface Group {
  id: string;
  label: string;
  collapsed: boolean;
  parentId?: string | null;
  depth: number;
}

/**
 * Per-group summary diamond — only rendered when the spec has a forest
 * column. See `docs/dev/spec-fields-reference.md` for the forest /
 * general / chrome classification.
 *
 * @kind forest
 */
export interface GroupSummary {
  groupId: string;
  point: number;
  lower: number;
  upper: number;
  metadata: Record<string, unknown>;
}

/**
 * Whole-table summary diamond.
 *
 * @kind forest
 */
export interface OverallSummary {
  point: number;
  lower: number;
  upper: number;
  metadata: Record<string, unknown>;
}

/**
 * Inline effect (point + interval) for forest + interval columns. The
 * `pointCol` / `lowerCol` / `upperCol` triple is the forest-plot
 * vocabulary; reusing this type outside a forest / interval context
 * would carry misleading naming.
 *
 * @kind forest
 */
export interface EffectSpec {
  id: string;
  pointCol: string;
  lowerCol: string;
  upperCol: string;
  label?: string | null;
  color?: string | null;
  shape?: MarkerShape | null;
  opacity?: number | null;
}

/**
 * The data block of a {@link WebSpec}. `rows` + `groups` + `groupCol` are
 * general; `summaries`, `overall`, and `weightCol` are forest-only — they
 * encode meta-analytic summary diamonds and are ignored when no `forest`
 * column is present.
 *
 * See `docs/dev/spec-fields-reference.md` for the field-by-field
 * classification.
 */
export interface WebData {
  rows: Row[];
  groups: Group[];
  /** @kind forest — per-group summary diamonds. */
  summaries: GroupSummary[];
  /** @kind forest — whole-table summary diamond. */
  overall?: OverallSummary | null;
  groupCol?: string | null;
  /** @kind forest — sample-size weight column for summary diamond width. */
  weightCol?: string | null;
}

// ============================================================================
// Column Types
// ============================================================================

export interface NumericColumnOptions {
  decimals?: number;  // Number of decimal places (default: 2)
  digits?: number;    // Significant figures (takes precedence over decimals)
  thousandsSep?: string | false;  // Thousands separator (default: "," for integers, false for decimals)
  abbreviate?: boolean | number;  // Abbreviate large numbers (true or sigfig count: 1.1M, 5.3K)
  prefix?: string;    // Text prepended to formatted value (e.g., "$")
  suffix?: string;    // Text appended to formatted value (e.g., "%")
}

export interface IntervalColumnOptions {
  decimals?: number;  // Decimal places for point/CI (default: 2)
  digits?: number;    // Significant figures. Cannot use with decimals.
  thousandsSep?: string | false;  // Thousands separator (default: false)
  abbreviate?: boolean;            // Shorten large numbers (default: false)
  separator?: string; // Separator between point and CI (default: " ")
  sep?: string;       // @deprecated Use `separator`
  point?: string;     // Override field for point estimate
  lower?: string;     // Override field for lower bound
  upper?: string;     // Override field for upper bound
  impreciseThreshold?: number | null;  // When upper/lower ratio > threshold, show "—"
  /** Display variant — declared in INTERVAL_SCHEMA.variants and consumed
   *  by interval-renderer.ts. One of "traditional" | "bracket_muted" |
   *  "plus_minus" | "stacked". Defaults to "traditional". */
  variant?: "traditional" | "bracket_muted" | "plus_minus" | "stacked";
  /** Compile-pass output (schema/variant-compile.ts). Renderers read
   *  primitive recipe fields from here instead of branching on `variant`
   *  directly. Populated at spec ingest; do not author by hand. */
  __resolved?: Record<string, unknown>;
}

export interface PercentColumnOptions {
  decimals?: number;  // Decimal places (default: 1). Cannot use with digits.
  digits?: number;    // Significant figures. Cannot use with decimals.
  multiply?: boolean; // Multiply by 100 if value is proportion (default: true)
  symbol?: boolean;   // Show % symbol (default: true)
}

export interface EventsColumnOptions {
  eventsField: string;  // Column name for event count
  nField: string;       // Column name for total N
  separator?: string;   // Separator between events and N (default: "/")
  showPct?: boolean;    // Show percentage after (default: false)
  thousandsSep?: string | false;  // Thousands separator (default: ",")
  abbreviate?: boolean | number;  // Abbreviate large numbers (true or sigfig count: 1.1K, 5.3M)
}

export interface BarColumnOptions {
  maxValue?: number | null;
  showLabel?: boolean;
  color?: string | null;
  scale?: "linear" | "log" | "sqrt";
}

export interface PvalueColumnOptions {
  stars?: boolean;
  /** Color channel for significance stars (only applies when stars=true).
   *  "accent" (default) follows the theme's accent/rubrication ramp;
   *  "ink2" reads the raw rubrication anchor chain (--tv-ink2);
   *  "negative" routes through status-negative (explicit bad-news
   *  semantics — NOT the default; significance is not inherently bad);
   *  "none" inherits the cell text color. */
  starsColor?: "accent" | "ink2" | "negative" | "none";
  /** Paint a soft status-positive PILL on significant values (p < the first
   *  threshold) — the rgc table-craft signature. "none" (default) = plain. */
  significantStyle?: "none" | "pill";
  thresholds?: [number, number, number]; // e.g., [0.05, 0.01, 0.001]
  format?: "scientific" | "decimal" | "auto";
  digits?: number; // Number of significant figures (default: 2)
  expThreshold?: number; // Values below this use exponential notation (default: 0.001)
  abbrevThreshold?: number | null; // Values below this display as "<threshold" (default: null = off)
}

export interface SparklineColumnOptions {
  type?: "line" | "bar" | "area";
  height?: number;
  color?: string | null;
}

// New column types

export interface IconColumnOptions {
  mapping?: Record<string, string>;  // Value-to-icon mapping
  size?: "sm" | "base" | "lg" | "xl";
  color?: string;
}

export interface BadgeColumnOptions {
  variants?: Record<string, "default" | "success" | "warning" | "error" | "info" | "muted">;
  // colors: Record<value, color> for categorical mapping, OR
  //         string[] for threshold-bucketed numeric scale (paired with thresholds).
  colors?: Record<string, string> | string[];
  size?: "sm" | "base";
  shape?: "pill" | "circle" | "square";
  outline?: boolean;
  thresholds?: number[];  // numeric breakpoints; pairs with colors[] above
}

export interface StarsColumnOptions {
  // Wire keys are maxGlyphs/halfGlyphs (R `max_glyphs`/`half_glyphs`; JS
  // `colStars(maxStars=)` is author-sugar mapped to maxGlyphs at authoring
  // time). The DOM + this type previously read maxStars/halfStars — names
  // the wire never carries, so a configured cap/half-fill was inert in the
  // widget while the export honored it (DOM↔export bug, 2026-06-14).
  maxGlyphs?: number;
  color?: string;  // Filled star color
  emptyColor?: string;  // Empty star color
  halfGlyphs?: boolean;
  domain?: [number, number] | null;  // Remap raw values from [lo, hi] → [0, maxGlyphs]
  size?: "sm" | "base" | "lg";       // Star glyph size
}

/**
 * Pictogram column: render N copies of a glyph (count or rating) per row.
 *
 * Two modes, distinguished by maxGlyphs:
 *  - count mode  (maxGlyphs == null): render `value` glyphs, all filled.
 *  - rating mode (maxGlyphs set):     render maxGlyphs glyphs, first
 *                                     `value` filled, rest in emptyColor.
 *
 * `glyph` is either a single string (registry name OR literal unicode) or
 * a value→glyph map (with `glyphField` naming the row-level selector field).
 */
export interface PictogramColumnOptions {
  glyph: string | Record<string, string>;
  glyphField?: string | null;
  maxGlyphs?: number | null;
  domain?: [number, number] | null;  // Remap raw value → [0, maxGlyphs] (rating mode)
  halfGlyphs?: boolean;              // Allow 0.5 fills on the boundary glyph
  color?: string | null;             // Filled color; null → var(--tv-accent)
  emptyColor?: string | null;        // Ghost color; null → var(--tv-text-subtle)
  size?: "sm" | "base" | "lg";
  layout?: "row" | "stack";
  valueLabel?: false | true | "leading" | "trailing";
  labelFormat?: "integer" | "decimal" | null;
  labelDecimals?: number;
}

/**
 * Ring (donut) column: render a small circular gauge per row with a
 * centered numeric label. Color can shift at threshold breakpoints
 * (e.g. green safe / amber watch / red danger).
 */
export interface RingColumnOptions {
  minValue?: number;             // input range start (default 0)
  maxValue?: number;             // input range end (default 1)
  color?: string | string[] | null;  // single color OR vector paired with thresholds
  thresholds?: number[] | null;  // breakpoints in raw input units
  trackColor?: string | null;    // unfilled ring color; null → var(--tv-text-subtle)
  size?: "sm" | "base" | "lg";
  showLabel?: boolean;
  labelFormat?: "percent" | "decimal" | "integer";
  labelDecimals?: number;
}

export interface ImgColumnOptions {
  height?: number;
  maxWidth?: number;
  fallback?: string;
  shape?: "square" | "circle" | "rounded";
}

export interface ReferenceColumnOptions {
  hrefField?: string;  // Field containing URL
  maxChars?: number;
  showIcon?: boolean;
}

export interface RangeColumnOptions {
  minField: string;
  maxField: string;
  separator?: string;
  decimals?: number | null;  // null for auto
  digits?: number;            // Significant figures
  thousandsSep?: string | false;
  abbreviate?: boolean;
}

/**
 * Options for `type: "forest"` columns. Every field is forest-only.
 *
 * @kind forest
 */
export interface ForestColumnOptions {
  point?: string | null;       // Column name for point estimate (inline single effect)
  lower?: string | null;       // Column name for lower bound (inline single effect)
  upper?: string | null;       // Column name for upper bound (inline single effect)
  effects?: EffectSpec[] | null;  // Inline effects for multi-effect display
  scale: "linear" | "log";
  nullValue: number;           // Reference line value (0 for linear, 1 for log)
  axisLabel: string;
  axisRange?: [number, number] | null;  // Explicit axis limits [min, max]
  axisTicks?: number[] | null;          // Explicit tick positions
  axisGridlines?: boolean;              // Show gridlines
  showAxis: boolean;
  width?: number | null;       // Width in pixels (null for auto from the multi-flex distribution)
  annotations?: Annotation[] | null;    // Reference lines and other annotations
  sharedAxis?: boolean | null; // In split forests: share axis across splits (null = inherit from split-level)
}

// ============================================================================
// Viz Column Types (focal visualization columns with axes)
// ============================================================================
//
// The viz column family (viz_bar / viz_boxplot / viz_violin) shares the
// axis machinery (`scale` / `axisRange` / `axisTicks` / `axisGridlines` /
// `axisLabel` / `showAxis`) with `ForestColumnOptions`, but the two
// families are independent — `@kind viz` means "applies when the column
// type is one of viz_bar / viz_boxplot / viz_violin," not "applies when a
// forest column is also present." Renderer dispatches on
// `ColumnSpec.type`.

/** @kind viz — shared axis machinery for viz_bar / viz_boxplot / viz_violin. */
export interface VizColumnOptionsBase {
  scale?: "linear" | "log";
  nullValue?: number;
  axisRange?: [number, number] | null;
  axisTicks?: number[] | null;
  axisGridlines?: boolean;
  axisLabel?: string;
  showAxis?: boolean;
}

/** Effect definition for viz_bar */
export interface VizBarEffect {
  value: string;              // Column name for the bar value
  label?: string | null;      // Legend label
  color?: string | null;      // Bar color
  opacity?: number | null;    // Bar opacity (0-1)
}

/** Options for viz_bar column */
export interface VizBarColumnOptions extends VizColumnOptionsBase {
  type: "bar";
  effects: VizBarEffect[];
  annotations?: Annotation[] | null;
}

/** Effect definition for viz_boxplot - supports both array data and pre-computed stats */
export interface VizBoxplotEffect {
  data?: string | null;       // Column name for array data (raw values)
  min?: string | null;        // Column name for pre-computed min
  q1?: string | null;         // Column name for pre-computed Q1
  median?: string | null;     // Column name for pre-computed median
  q3?: string | null;         // Column name for pre-computed Q3
  max?: string | null;        // Column name for pre-computed max
  outliers?: string | null;   // Column name for outlier array
  label?: string | null;      // Legend label
  color?: string | null;      // Box fill color
  opacity?: number | null;    // Box fill opacity (0-1)
  fillOpacity?: number | null;// @deprecated Use `opacity`. Kept for one release for backward compat.
}

/** Options for viz_boxplot column */
export interface VizBoxplotColumnOptions extends VizColumnOptionsBase {
  type: "boxplot";
  effects: VizBoxplotEffect[];
  annotations?: Annotation[] | null;
  showOutliers?: boolean;
}

/** Effect definition for viz_violin */
export interface VizViolinEffect {
  data: string;               // Column name for array data (required)
  label?: string | null;      // Legend label
  color?: string | null;      // Fill color
  opacity?: number | null;    // Fill opacity (0-1)
  fillOpacity?: number | null;// @deprecated Use `opacity`. Kept for one release for backward compat.
}

/** Options for viz_violin column */
export interface VizViolinColumnOptions extends VizColumnOptionsBase {
  type: "violin";
  effects: VizViolinEffect[];
  annotations?: Annotation[] | null;
  bandwidth?: number | null;  // KDE bandwidth (null = Silverman's rule)
  showMedian?: boolean;       // Show median line
  showQuartiles?: boolean;    // Show Q1/Q3 lines
}

/** Computed boxplot statistics */
export interface BoxplotStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
}

/** KDE result for violin plots */
export interface KDEResult {
  x: number[];
  y: number[];
}

export interface HeatmapColumnOptions {
  palette?: string[];
  minValue?: number | null;
  maxValue?: number | null;
  decimals?: number;
  showValue?: boolean;
  scale?: "linear" | "log" | "sqrt";
}

export interface ProgressColumnOptions {
  maxValue?: number;
  color?: string | null;
  showLabel?: boolean;
  scale?: "linear" | "log" | "sqrt";
}

export interface TextColumnOptions {
  maxChars?: number | null;
}

export interface ColumnOptions {
  numeric?: NumericColumnOptions & { prefix?: string | null; suffix?: string | null };
  percent?: PercentColumnOptions;
  events?: EventsColumnOptions;
  bar?: BarColumnOptions;
  pvalue?: PvalueColumnOptions;
  sparkline?: SparklineColumnOptions;
  interval?: IntervalColumnOptions;
  icon?: IconColumnOptions;
  badge?: BadgeColumnOptions;
  stars?: StarsColumnOptions;
  pictogram?: PictogramColumnOptions;
  ring?: RingColumnOptions;
  img?: ImgColumnOptions;
  reference?: ReferenceColumnOptions;
  range?: RangeColumnOptions;
  forest?: ForestColumnOptions;
  heatmap?: HeatmapColumnOptions;
  progress?: ProgressColumnOptions;
  text?: TextColumnOptions;
  date?: { format?: string };
  // New viz column types
  vizBar?: VizBarColumnOptions;
  vizBoxplot?: VizBoxplotColumnOptions;
  vizViolin?: VizViolinColumnOptions;
  naText?: string;  // Custom text for NA/missing values
}

export type ColumnType =
  | "text" | "numeric" | "interval" | "bar" | "pvalue" | "sparkline"
  | "icon" | "badge" | "stars" | "pictogram" | "ring" | "img" | "reference" | "range" | "forest"
  | "heatmap" | "progress" | "viz_bar" | "viz_boxplot" | "viz_violin" | "custom";

export interface ColumnSpec {
  id: string;
  header: string;
  field: string;
  type: ColumnType;
  width?: number | "auto" | null;  // "auto" for content-based width calculation
  align: "left" | "center" | "right";
  headerAlign?: "left" | "center" | "right" | null;  // Header alignment (defaults to align if not specified)
  showHeader?: boolean;  // undefined = auto (show iff header is non-empty)
  /**
   * Multi-line wrap for cell + header text. Encodes the *number of extra
   * lines* allowed beyond the first (so total lines ≤ wrap + 1).
   * - `false` / `0`: no wrap, single line, ellipsis on overflow (default).
   * - `true` / `1`: up to 2 lines.
   * - `n`: up to `n + 1` lines, content beyond is clipped.
   */
  wrap?: boolean | number;
  sortable: boolean;
  /**
   * Flex weight + aspect participation for the multi-flex width distribution.
   *  - `number` N — explicit flex weight: this column gets share ∝ N × natural
   *    (overriding the schema's per-type default weight); N > 0 also absorbs
   *    aspect-reshape width, N = 0 pins it to natural.
   *  - `true` — schema-default weight + absorbs aspect width.
   *  - `false` — schema-default weight, does NOT absorb aspect width.
   *  - unset — defaults via type: forest / viz_bar / viz_boxplot / viz_violin
   *    => true, everything else => false.
   * See `lib/layout/flex-weights.ts` + docs/dev/multi-flex-columns.md.
   */
  flex?: boolean | number;
  options?: ColumnOptions;
  isGroup: false;
  // Style mapping: column names containing per-cell style values
  styleMapping?: StyleMapping;
}

export interface ColumnGroup {
  id: string;
  header: string;
  isGroup: true;
  columns: ColumnDef[];
}

export type ColumnDef = ColumnSpec | ColumnGroup;

// ============================================================================
// Theme Types
// ============================================================================

export interface ColorPalette {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  border: string;
  rowBg: string;      // Even row background
  altBg: string;      // Odd row background (stripe/banding)
  headerBg: string;   // Column-header row background (cascades from rowBg)
  cellForeground: string;  // Data-cell text color (cascades from foreground)
  headerForeground: string;  // Column-header text (cascades from cellForeground → foreground)
  /** CI whisker stroke color. Marker fill is driven by `shapes.effectColors`. */
  intervalLine: string;
  summaryFill: string;
  summaryBorder: string;
  /**
   * Author-curated 8-color palette surfaced in the settings panel's
   * "Theme" tab on every color picker. Always serialized (the R side
   * derives a sensible default when not set), so length is 8 in
   * practice; typed as `string[]` for forward-compat.
   */
  swatches: string[];
}

export interface Typography {
  fontFamily: string;
  fontSizeSm: string;
  fontSizeBase: string;
  fontSizeLg: string;
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightBold: number;
  lineHeight: number;
  headerFontScale: number;  // Scale factor for header cell font size (default: 1.05)
}

export interface Spacing {
  rowHeight: number;
  headerHeight: number;
  padding: number;  // Padding around forest plot SVG (default 12px)
  containerPadding: number;  // Left/right padding for outer container (default 0)
  cellPaddingX: number;
  cellPaddingY: number;
  axisGap: number;  // Gap between table and x-axis (default ~12px)
  // Column-group headers (multi-column header spans) — left/right padding.
  columnGroupPadding: number;
  // Row-group header indentation (applies per nesting depth in addition to
  // the theme's natural level indentation).
  rowGroupPadding: number;
  // Vertical gap between the plot region and the footer band (caption +
  // footnote). Added in v0.21.x.
  footerGap?: number;
  // Gap between title and subtitle bands when both are present. Mirrors
  // the live widget's PlotHeader CSS (margin+border+padding). Added in
  // v0.21.x.
  titleSubtitleGap?: number;
  // Vertical gap between the title/subtitle block and the table top.
  // Lets authors loosen or tighten the visual separation between
  // header copy and the data wall without touching paddings.
  headerGap?: number;
  // Trailing buffer below the last visible band in SVG export. Added in
  // v0.21.x.
  bottomMargin?: number;
  /** Per-nesting-level indent for row-group headers. Source value;
   *  R-side resolution (utils-theme-resolve.R:487-488) inherits this
   *  into `theme.rowGroup.indentPerLevel` when the latter is unset,
   *  and the renderer reads from `rowGroup.indentPerLevel`. This
   *  field exists for serializer parity; consumers should prefer
   *  `theme.rowGroup.indentPerLevel`. */
  indentPerLevel?: number;
  /** @deprecated Alias for columnGroupPadding. Emitted by the R serializer
   *  for back-compat; reads here should migrate to columnGroupPadding. */
  groupPadding: number;
}

export interface Shapes {
  pointSize: number;
  summaryHeight: number;
  lineWidth: number;
  // borderRadius removed in v0.25.0 — was emitted but no consumer
  // Border widths (pixels) — added in v0.19
  rowBorderWidth?: number;        // Data-row separator (default 1)
  headerBorderWidth?: number;     // Column-header underlines (default 2)
  rowGroupBorderWidth?: number;   // Row-group header bottom when GroupHeaderStyles level toggle is on (default 1)
  tickMarkLength?: number;        // Length of tick marks on viz axes (default 4)
  // Multi-effect defaults (colors for forest markers, bars, boxplots, violins)
  effectColors?: string[] | null;  // null = use built-in fallback colors
  markerShapes?: MarkerShape[] | null;  // Shapes for each effect (cycles if more effects than shapes)
}

export interface AxisConfig {
  // Explicit overrides (when set, bypass auto-calculation)
  rangeMin: number | null;
  rangeMax: number | null;
  tickCount: number | null;
  tickValues: number[] | null;
  gridlines: boolean;
  gridlineStyle: "solid" | "dashed" | "dotted";
  // Auto-scaling parameters
  ciClipFactor: number;               // CIs beyond this × estimate range are clipped with arrows (default: 2.0)
  includeNull: boolean;               // Always include null in axis range (default: true)
  symmetric: boolean | null;          // null = auto, true/false = force (default: null)
  nullTick: boolean;                  // Always show tick at null value (default: true)
  markerMargin: boolean;              // Add half-marker-width at edges (default: true)
}

export type BandingMode = "none" | "row" | "group";

/**
 * Normalized banding value as serialized from R. `level` is an explicit 1-based
 * group depth when the user passed `"group-n"`, or `null` for bare `"group"`
 * (which means "deepest available at render time"). `"none"` and `"row"`
 * always have `level: null`.
 */
export interface BandingSpec {
  mode: BandingMode;
  level: number | null;
}

export interface LayoutConfig {
  plotWidth: number | "auto";
  containerBorder: boolean;
  containerBorderRadius: number;
  banding: BandingSpec;
}

/**
 * Visual bundle for one semantic token (emphasis / muted / accent).
 * Every field is nullable — `null` means "inherit / no override," letting a
 * bundle opt into just the properties it needs. Populated from R's
 * `SemanticBundle` S7 class via `serialize_semantic_bundle()`.
 */
export interface SemanticBundle {
  fg: string | null;
  bg: string | null;
  border: string | null;
  markerFill: string | null;
  /** Stroke companion to `markerFill` — drives forest-plot whiskers and
   *  marker outlines so an accent-recolored marker doesn't sit on a
   *  structurally-colored line. */
  markerStroke: string | null;
  fontWeight: number | null;
  fontStyle: "normal" | "italic" | null;
}

/**
 * Per-token bundle map. Keys match the boolean flags on `RowStyle` /
 * `CellStyle` — `row.style.fill === true` ⇒ look up `theme.row.fill`.
 *
 * On v2 wire shapes the bundles live at `theme.row.{token}` (see RowCluster
 * in R/classes-theme.R). The dedicated `theme.semantics` block was a v1
 * carry-over that's no longer emitted.
 */
export type SemanticToken =
  | "emphasis" | "muted" | "accent"
  | "bold" | "fill";

export type Semantics = Record<SemanticToken, SemanticBundle>;

/**
 * Tier-2 named token colors. theme.semantic.fill drives the default bg of
 * the fill RowSemantic bundle; defaults to an accent-derived pastel tint
 * at R-side resolve time.
 */
export interface SemanticInputs {
  fill: string;
}

export interface GroupHeaderStyles {
  level1FontSize: string;
  level1FontWeight: number;
  level1Italic: boolean;
  level1Background: string | null;
  level1BorderBottom: boolean;
  level2FontSize: string;
  level2FontWeight: number;
  level2Italic: boolean;
  level2Background: string | null;
  level2BorderBottom: boolean;
  level3FontSize: string;
  level3FontWeight: number;
  level3Italic: boolean;
  level3Background: string | null;
  level3BorderBottom: boolean;
  indentPerLevel: number;
}

/** Resolved theme — the wire shape R emits on every spec.theme. */
import type { WebTheme } from "./theme-resolved";
export type { WebTheme };

// ============================================================================
// Interaction Types
// ============================================================================

/**
 * SPARSE explicit-author tier of the interaction chain (interactivity-UX
 * arc P1). Wrappers emit ONLY the flags the author explicitly set; absent
 * flags resolve through theme opinion → global tier → baked defaults in
 * `lib/interaction-resolve.ts::resolveInteraction`. Consumers must read the
 * RESOLVED surface (store `interaction` getter / `resolveInteraction(spec)`),
 * never these raw fields.
 */
export interface InteractionSpec {
  showFilters?: boolean;
  showLegend?: boolean;
  enableSort?: boolean;
  enableCollapse?: boolean;
  enableSelect?: boolean;
  enableHover?: boolean;
  enableResize?: boolean;
  enableExport?: boolean;
  enableReorderRows?: boolean;      // Drag rows within a group; drag row-groups among siblings
  enableReorderColumns?: boolean;   // Drag columns within a column-group; drag column-groups among siblings
  enableEdit?: boolean;             // Double-click to edit cells / labels / forest numerics
  enableThemeEdit?: boolean;        // Settings cog + panel (author freeze: FALSE hides the cog on published dashboards)
  enableFilters?: boolean;          // Render per-column filter popovers (supersedes showFilters)
  // Forest/viz x-axis domain zoom (Ctrl/Cmd+wheel, drag pan, dblclick reset).
  // Default FALSE (interactivity-UX arc P0, conservative-everywhere): domain
  // zoom is an analysis affordance, and even modifier-gated it has no
  // affordance a document reader can discover — authors opt in.
  enableAxisZoom?: boolean;
  // The arrange tool (P2): a toolbar mode that reveals every resize seam
  // (row-kind edges + spacing gaps) with visible handles + px readouts.
  // Default FALSE (conservative-everywhere) — authors opt in.
  enableArrange?: boolean;
  showGroupCounts?: boolean;        // Show "(n)" next to row-group labels (default: false)
  tooltipFields?: string[] | null;  // Column names to show in hover tooltip (opt-in)
  // Available themes for switching. Two shapes accepted:
  //   * Flat:        Record<string, WebTheme>
  //   * Categorized: Record<string, Record<string, WebTheme>>
  // Categorized form makes each top-level key a tab label in the
  // in-widget switcher dropdown. null disables the switcher.
  enableThemes?: Record<string, WebTheme> | Record<string, Record<string, WebTheme>> | null;
}

export interface LayoutSpec {
  plotWidth: number | "auto";
}

// ============================================================================
// Plot Labels (titles, subtitles, captions, footnotes)
// ============================================================================

export interface PlotLabels {
  title?: string | null;
  subtitle?: string | null;
  caption?: string | null;
  footnote?: string | null;
  /** Short stamp label (e.g. "TABLE 2") rendered as the caption CHIP on
   *  the shell when effects.caption_style === "chip" (B17, wire-audit
   *  1c). Distinct from `caption`, which is prose below the plot. */
  tag?: string | null;
}

// ============================================================================
// Main Spec (what R sends to JS)
// ============================================================================

/** A single page's row-index window (0-based, inclusive) into the rendered
 *  display rows. Computed R-side at serialize time so the viewer and the
 *  PDF export agree on where pages start and end. */
export interface PageRange {
  startIdx: number;
  endIdx: number;
}

/** Pagination config sent from R. Breakpoints (`pages`) are precomputed
 *  R-side in `compute_page_breaks()` so the viewer never re-derives them. */
export interface PaginationConfig {
  rows: number;
  breakOn: "split" | "group" | "none";
  keepGroups: boolean;
  orphanMin: number;
  repeatHeader: boolean;
  repeatLegend: boolean;
  repeatTitle: boolean;
  footnotesOn: "last" | "every";
  /** `"x_of_y"`, `"x"`, or `false` to hide. Functions on the R side are
   *  resolved to `"x_of_y"` for the wire (R handles function-form labels
   *  at PDF render time). */
  pageLabel: "x_of_y" | "x" | false;
  pages: PageRange[];
  nPages: number;
}

/** A full-width annotation/note row inserted after a target data row. Free
 *  markdown content, always visible (no disclosure). Reuses the details panel
 *  render path. Authored R-side via `add_note()`. */
export interface NoteSpec {
  /** Id of the data row this note is placed after. */
  after: string;
  /** Markdown content. */
  content: string;
}

/**
 * Interactive figure-layout state — the FIGURE-STATE persistence tier
 * (interactivity-UX arc P1; docs/dev/interactivity-ux-plan.md).
 *
 * Carries the layout adjustments a user found interactively (column width
 * pins, column reorder, row-kind height pins) as part of the spec wire, so
 * they round-trip: Shiny apps can re-attach them across data refreshes and
 * any wrapper language can persist them. The store hydrates this block
 * UNDER surviving session state (a live user edit always wins over an
 * incoming block) and the same shapes are emitted back out through the
 * Shiny event fields (`column_widths`, `column_order`, `row_kind_heights`).
 *
 * Hidden columns are deliberately NOT here — they already ride the wire on
 * `initialState.hiddenColumns` and the `hidden_columns` event field.
 */
export interface FigureLayoutState {
  /** Column width pins (column id → px). Treated as user-resized: they
   *  survive re-measure, theme and density changes. */
  columnWidths?: Record<string, number>;
  /** Column reorder overrides — same shape the store keeps. Unknown ids
   *  are inert (dropped at apply time; new columns append in spec order). */
  columnOrder?: { topLevel?: string[] | null; byGroup?: Record<string, string[]> };
  /** Per-row-kind absolute height pins in px — layer 5 of the row-kind
   *  height cascade (overrides density/theme/constructor ratios). */
  rowKindHeights?: Partial<Record<
    "data" | "group_header" | "spacer" | "summary" | "header" | "panel",
    number
  >>;
}

export interface WebSpec {
  /** Wire-format version. Validated on ingest by `$spec/validateSpecVersion`.
   *  Pre-release: emitted as "1.0"; policy informal. Post-publish: minor bumps
   *  are strictly additive (older readers ignore unknown fields); major bumps
   *  require migration handlers. See `docs/dev/frontend-split-spec.md` §3.4. */
  version: string;
  data: WebData;
  /** Annotation/note rows (full-width prose inserted after specific rows). */
  notes?: NoteSpec[];
  columns: ColumnDef[];
  /**
   * Row-label column. Carries the leftmost "primary" column (sticky-left,
   * drag-handle host, row-tooltip target) as a named wire slot, separate
   * from `columns`. When set, the store materializes the effective list
   * as `[labelColumn, ...columns]`. When unset, the store falls back to
   * looking for a column with `id === "label"` at `columns[0]` for
   * backward-compat with wires emitted by older R / TS constructors.
   * `null` / undefined = no label column (the leftmost user column
   * gets primary treatment).
   *
   * R-side: `WebSpec@label_column`. TS-side: `tabviz({ label, ... })`
   * sets this field. The id is conventionally `"label"` to keep op-log
   * / cell-edit routing stable.
   */
  labelColumn?: ColumnDef | null;
  extraColumns?: ColumnDef[];
  availableFields?: AvailableField[];
  theme: WebTheme;
  /** Per-spec row-kind height ratios — layer 4 of the row-kind height
   *  cascade (Stage 1 §33). Values are RATIOS relative to the density
   *  `rowHeight`, not absolute px (per Q-P5.2 closure). Keyed by `RowKind`.
   *
   *  Example: `{ data: 1.0, summary: 1.25 }` makes summary rows 25%
   *  taller than data rows.
   *
   *  R-side: emitted by `forest_plot(data, row_heights = list(...))`.
   *  The constructor layer wins over theme defaults (layer 3) but loses
   *  to the interactive pin (layer 5). */
  rowHeights?: Partial<Record<
    "data" | "group_header" | "spacer" | "summary" | "header" | "panel",
    number
  >>;
  interaction: InteractionSpec;
  /** @kind forest — `plotWidth` is the forest column's pixel width;
   *  ignored when no forest column is present. */
  layout: LayoutSpec;
  labels?: PlotLabels;
  watermark?: string;
  /** Watermark text color (CSS color). Cascades from `colors.foreground` when undefined. */
  watermarkColor?: string;
  /** Watermark fill-opacity, 0–1. Default 0.07 if undefined. */
  watermarkOpacity?: number;
  /** Optional pagination config — see `paginate_spec()` on the R side.
   *  Undefined means no pagination (single-page output). */
  paginate?: PaginationConfig;
  /** Initial interactive state set R-side (sort / filters / hidden
   *  columns) and applied once on widget mount. The R-side serializer
   *  (`R/utils-serialize.R::serialize_initial_state`) writes this; the
   *  htmlwidgets binding consumes it in
   *  `srcjs/src/htmlwidgets/index.svelte.ts::renderValue` to seed the store. */
  initialState?: {
    sort?: { column: string; direction: "asc" | "desc" | "none" };
    filters?: Array<{ field: string; operator: string; value: unknown }>;
    hiddenColumns?: string[];
    /** Row ids whose details panel is expanded at mount. Also the set the
     *  static (V8/SVG) export renders panels for. Default: none (collapsed). */
    expandedRows?: string[];
  };
  /**
   * Widget-level banks — footnotes, axes, legends. User-authored
   * entries here flow through the wire; schema behaviors contribute
   * additional entries at runtime via `computeEffectiveBanks(spec)`.
   * Derived entries are tagged with `producer: column.id` for
   * auto-cleanup on column removal. See `$schema/banks.ts` for the
   * entry shapes + dispatcher.
   */
  banks?: import("../schema/banks").WidgetBanks;
  /** Target aspect ratio (`width / height`) for static export and the
   *  widget's interactive control. `null` / undefined means render at
   *  natural; a positive number triggers Mode-3 relayout via the lever
   *  ladder. Set R-side via `set_aspect_ratio()` (fluent / proxy) and,
   *  later, by an in-widget aspect-ratio slider. */
  targetAspect?: number | null;
  /** Anchor rule for ratio-only target-dim resolution (Phase 7C):
   *   - "width": target_w = natural_w, target_h = natural_w / ratio
   *   - "height": target_h = natural_h, target_w = natural_h * ratio
   *   - "auto": pick whichever preserves natural's *limiting* dim
   *  Default "width" (preserves v0.30 behaviour). */
  targetAspectAnchor?: "width" | "height" | "auto";
  /** Verbatim deparse of the user's original `tabviz(...)` call, captured
   *  R-side. Shown as the baseline line in the "View source" panel above
   *  the recorded fluent operations. Undefined for fluent-api-only specs. */
  originalCall?: string;
  /** Interactive figure-layout state (column width pins / reorder /
   *  row-kind height pins) — see {@link FigureLayoutState}. Hydrated
   *  UNDER surviving session state on every setSpec. */
  figureLayout?: FigureLayoutState;
  /** GLOBAL tier of the interaction-defaults chain (interactivity-UX arc
   *  P1): wrapper-environment defaults (e.g. R
   *  `options(tabviz.interaction_defaults=)`) serialized as a sparse flag
   *  map. Sits UNDER theme opinions and explicit `interaction` settings —
   *  see `lib/interaction-resolve.ts`. Keys snake_case or camelCase. */
  interactionDefaults?: Partial<Record<string, boolean>>;
}

// ============================================================================
// Interactive column picker types
// ============================================================================

export type FieldCategory =
  | "numeric"
  | "integer"
  | "string"
  | "logical"
  | "date"
  | "array-numeric"
  | "other";

export interface AvailableField {
  field: string;
  label: string;
  category: FieldCategory;
}

export interface SlotSpec {
  key: string;                 // e.g. "point", "lower", "upper", "events", "n"
  label: string;               // human-readable slot label
  accepts: FieldCategory[];    // categories allowed in this slot
  required: boolean;
  // Optional naming patterns to use when auto-pairing siblings off the primary slot
  autoPair?: { suffixes: string[] };
  /** Wire-shape override. When the wire key for this slot differs from
   *  the human-readable `key` (e.g. Events: slot `events` writes to
   *  `options.custom.eventsField`), set `wireKey` to the actual on-wire
   *  property name. Without this, the column editor reads/writes the
   *  slot's `key` directly, which produces a wire-shape mismatch and a
   *  silently-broken column. */
  wireKey?: string;
}

export type VisualCategory = "text" | "numeric" | "interval" | "viz" | "icon";

export interface VisualTypeDef {
  type: ColumnType;
  label: string;
  description: string;
  category: VisualCategory;
  slots: SlotSpec[];
  // Dynamic-cardinality viz types (viz_bar, multi-effect forest/violin/boxplot)
  // are authored-only for now — authors ship them via `extra_columns`.
  authorOnly?: boolean;
}

// ============================================================================
// Annotation Types (future)
// ============================================================================

export interface ReferenceLine {
  type: "reference_line";
  id: string;
  x: number;
  label?: string;
  style: "solid" | "dashed" | "dotted";
  color?: string;
  width?: number;
  opacity?: number;
}

export interface CustomAnnotation {
  type: "custom";
  id: string;
  rowId: string;
  shape: "circle" | "square" | "triangle" | "star";
  position: "before" | "after" | "overlay";
  color: string;
  size: number;
}

export type Annotation = ReferenceLine | CustomAnnotation;

// ============================================================================
// Computed Layout
// ============================================================================

export interface ComputedLayout {
  totalWidth: number;
  totalHeight: number;
  /** Multi-flex: per-column resolved width (id → px), from the weighted
   *  distribution (docs/dev/multi-flex-columns.md). The single source of
   *  truth for column widths — forest is just a high-weight plot column,
   *  no longer a special scalar. */
  flexWidths?: Record<string, number>;
  /** Lever 2C: scale factor applied to headerHeight + axisHeight so
   *  chrome can absorb / shed height when an aspect target is pinned.
   *  1 by default; > 1 grows chrome (taller aspects); < 1 shrinks it
   *  (floored at 0.4 so axis labels stay readable). The values on
   *  `headerHeight` / `axisHeight` below are already pre-multiplied. */
  chromeScale?: number;
  /** Lever-ladder intent: the exact width / height the aspect target
   *  asked for. Non-null only when `targetAspect` is pinned. Export
   *  dimensions route through these so downloads match the requested
   *  aspect bit-exactly, bypassing any DOM-measurement lag. */
  aspectTargetWidth?: number | null;
  aspectTargetHeight?: number | null;
  /** Phase 7E hardening: pre-mutation natural aspect (canvas /
   *  natural-height-estimate). Used by the in-widget aspect slider
   *  as a stable reference so the slider position <-> ratio mapping
   *  doesn't drift when targetAspect mutates the layout. */
  naturalAspect?: number;
  headerHeight: number;
  rowHeight: number;
  plotHeight: number;
  axisHeight: number;
  /** Font-derived portion of axisHeight (axisHeight = axisGap +
   *  axisRegionHeight when an axis column is present). Exposed so
   *  the export path can back out an axisGap value that produces
   *  the right post-ladder axisHeight when the renderer recomputes
   *  axisRegionHeight from the theme. */
  axisRegionHeight?: number;
  nullValue: number;
  summaryYPosition: number;
  showOverallSummary: boolean;
  // Cumulative Y positions for each row (accounts for variable heights like spacers)
  rowPositions: number[];
  // Heights for each row (spacers are half-height)
  rowHeights: number[];
  /** Per-row marker-center Y. Differs from rowPositions[i] + rowHeights[i]/2
   *  only when row i is "padded-after" (last data row before a top-level
   *  group_header): the track is inflated by rowGroupPadding but the marker
   *  centers on the data portion, not the padded total. */
  rowMarkerCenters: number[];
}

// ============================================================================
// Display Row Types (for rendering)
// ============================================================================

export interface GroupHeaderRow {
  type: "group_header";
  group: Group;
  rowCount: number;
  depth: number;
}

export interface DataRow {
  type: "data";
  row: Row;
  depth: number;
}

/** A full-width details/disclosure panel owned by a data row. Emitted by the
 *  region-tree flatten only when its owner row is expanded. Free content
 *  (markdown), content-driven height — not column-aligned. */
export interface PanelRow {
  type: "panel";
  /** The data row this panel belongs to. */
  rowId: string;
  /** Markdown content. */
  content: string;
  depth: number;
}

export type DisplayRow = GroupHeaderRow | DataRow | PanelRow;

// ============================================================================
// Store State
// ============================================================================

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

// Legacy `FilterConfig` removed in Phase 0a-PR7 (spec S4 + D3).
// The multi-column ColumnFilter shape below is the only filter type.

// Multi-column filter state (keyed by column field).
export type FilterOperator =
  | "contains"
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "between"
  | "in"
  | "empty"
  | "notEmpty";

export type ColumnKind = "text" | "numeric" | "categorical";

export interface ColumnFilter {
  field: string;
  kind: ColumnKind;
  operator: FilterOperator;
  value: unknown; // string | number | [number, number] | unknown[]
}

export type FiltersState = Record<string, ColumnFilter>;

// Row-order overrides (drag-and-drop). Scope key is the groupId, or "__root__" for
// rows/groups with no parent.
export interface RowOrderOverrides {
  byGroup: Record<string, string[]>;           // scopeKey -> rowId[]
  groupOrderByParent: Record<string, string[]>; // parentKey -> groupId[]
}

// Column-order overrides (drag-and-drop). topLevel covers the mixed top-level
// siblings (standalone leaf columns + column groups); byGroup reorders the
// children inside a named column group.
export interface ColumnOrderOverrides {
  topLevel: string[] | null;
  byGroup: Record<string, string[]>;
}

// Sparse cell edits (session-only).
export type EditValue = string | number | null;
export interface CellEdits {
  cells: Record<string, Record<string, EditValue>>; // rowId -> field -> value (primary-column field doubles as the row label)
  groups: Record<string, string>;                   // groupId -> new header text
}

// Transient UI state for drag gestures.
export type DragKind = "row" | "row_group" | "column" | "column_group";
export interface DragState {
  kind: DragKind;
  id: string;
  scopeKey: string;               // groupId/columnGroupId or "__root__"
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  indicatorIndex: number | null;  // drop index within scope; null when invalid
  threshold: number;              // px to distinguish drag from click
  active: boolean;                // true once threshold crossed
}

// Transient UI state for inline editing.
export interface EditTarget {
  rowId: string;
  // "__forest__:<colId>" = est/lo/hi popover; else column field (including the primary column).
  field: string;
  x?: number;                     // popover anchor (forest only)
  y?: number;
  // When set, the editor targets a column group's header text instead of a
  // row cell. `rowId` and `field` are unused (pass empty strings).
  groupId?: string;
  // When set, the editor targets a plot-level label (title/subtitle/caption/
  // footnote) instead of a cell or group header. `rowId`/`field` are unused.
  labelField?: "title" | "subtitle" | "caption" | "footnote";
}

// ============================================================================
// Container Fit & Zoom Types
// ============================================================================

/**
 * Persisted zoom state for localStorage.
 * - zoom: User's desired zoom level (0.5-2.0)
 * - autoFit: If true, shrink content to fit container (never enlarge)
 * - maxWidth/maxHeight: Optional container constraints
 */
export interface ZoomState {
  zoom: number;
  autoFit: boolean;
  maxWidth: number | null;
  maxHeight: number | null;
  /** Viewer accessibility contrast preference. Persisted so a low-vision
   *  viewer doesn't re-assert it on every reload (the regression: zoom
   *  persisted but the a11y choice didn't). */
  contrastOverride?: "auto" | "more";
  version: number;
}

// Per-column pan/zoom override for a viz column's x-axis. Session-only;
// reset via double-click or the axis reset affordance. Domain is stored
// directly so it can be fed to d3 scales, tick generators, and the export
// PrecomputedLayout without extra math.
export interface AxisZoom {
  domain: [number, number];
}

// ============================================================================
// Split Forest Types
// ============================================================================

export interface NavTreeNode {
  label: string;
  key: string;
  children: NavTreeNode[] | null;
}

/**
 * Subset of WebSpec fields that legitimately differ between subviews:
 * data (filtered rows + filtered groups/summaries) and labels (combined
 * title with subview label). Everything else is hoisted into `base`.
 */
export type SplitSubviewOverride = Pick<WebSpec, "data" | "labels">;

export interface SplitForestPayload {
  /** Wire-format version. See WebSpec.version for the policy. */
  version: string;
  /** Discriminator — R-side `serialize_split_table()` always emits
   *  `"split_table"` (the R function that produces the data is
   *  `split_table()` in `R/web_spec.R`). The TS type name
   *  `SplitForestPayload` retains the forest-plot heritage for now
   *  (renaming would touch every consumer); the wire value matches R.
   *  Validated at runtime by `createSplitTabviz`. */
  type: "split_table";
  splitVars: string[];
  navTree: NavTreeNode[];
  /**
   * Shared base spec: theme, columns, interaction, etc. -- everything
   * that is identical across every subview by construction (`split_table`'s
   * `create_subset_spec` inherits these from the base spec). The R-side
   * serializer emits this block once instead of N times.
   */
  base?: Omit<WebSpec, "data" | "labels">;
  /**
   * Per-subview overrides. With `base` present these are partial and the
   * frontend reconstitutes a full WebSpec via `{...base, ...override}`.
   * Older payloads (no `base`) carried full WebSpecs here -- that path
   * still works for backward compatibility on the wire.
   */
  specs: Record<string, WebSpec | SplitSubviewOverride>;
  sharedAxis: boolean;
  sharedColumnWidths?: boolean;
  axisRange: { min: number; max: number } | null;
}

// ============================================================================
// Shiny outbound envelope (JS → R wire contract)
// ============================================================================

/**
 * Provenance tag for outbound Shiny inputs. Every widget-driven mutation
 * carries `"user"`; mutations dispatched from R via the proxy channel
 * carry `"proxy"`. Dashboards filter their own writes with this — e.g.,
 * `req(input$tbl_sort$source == "user")`.
 *
 * See docs/dev/source-tagging.md for the full contract and rationale.
 */
export type SourceTag = "user" | "proxy";

/**
 * Uniform envelope wrapping every value the widget pushes to Shiny via
 * `Shiny.setInputValue`. The envelope shape is part of the JS → R wire
 * contract and is consumed by R-side readers
 * `tabviz::tabviz_state()` / `tabviz::tabviz_state_envelope()`.
 *
 * Fields:
 *   - `value`: the actual payload (typed per emitter; bundle shape for `_state`)
 *   - `source`: provenance tag; see `SourceTag`
 *   - `ts`: epoch milliseconds at emission; lets observers detect stale events
 *
 * Use `shinyEnvelope()` from `$lib/shiny-envelope` to construct one.
 * See docs/dev/source-tagging.md for the full contract.
 */
export interface ShinyEnvelope<T = unknown> {
  value: T;
  source: SourceTag;
  ts: number;
}

// ============================================================================
// HTMLWidgets Integration
// ============================================================================

declare global {
  interface Window {
    HTMLWidgets: {
      widget: (binding: HTMLWidgetsBinding) => void;
    };
    Shiny?: {
      setInputValue: (name: string, value: unknown, opts?: { priority?: string }) => void;
      addCustomMessageHandler: (type: string, handler: (msg: unknown) => void) => void;
    };
    /** Dev hook: exposes the export helpers for puppeteer / playwright
     *  integration tests. Lives behind the `expose-dev-hook` mechanism in
     *  $htmlwidgets/glue; tests should treat presence as best-effort
     *  (production builds may strip this in a future minor). */
    // Function shapes are deliberately loose here — dev hooks are runtime-only
    // and external puppeteer scripts call through with arbitrary args. The
    // canonical signatures live in `$export` (exportToSVG, exportToPNG).
    __tabvizExports?: Record<string, (...args: never[]) => unknown>;
    /** Dev hook: registry of widget stores indexed by element id. Used by
     *  puppeteer scripts to inspect widget state without going through
     *  Shiny. Same caveat as `__tabvizExports`. */
    __tabvizStoreRegistry?: Map<string, unknown>;
  }
}

export interface HTMLWidgetsBinding {
  name: string;
  type: string;
  factory: (el: HTMLElement, width: number, height: number) => WidgetInstance;
}

export interface WidgetInstance {
  renderValue: (x: unknown) => void;
  resize: (width: number, height: number) => void;
}

// v2 theme wire shape — the source-of-truth mirror of
// R/utils-serialize-resolved.R::serialize_theme. The current `WebTheme`
// (above) still carries the v1 shape with v2 fields tacked on as optional;
// migration to `WebTheme` is tracked under Phase 0c-C5 / Phase 1.x.
// See `./theme-resolved.ts` for the full v2 type tree.
export type {
  AccentRoles,
  StatusColors,
  SlotRole,
  TextRole,
  TextRoles,
  SpacingTokens,
  HeaderCluster,
  HeaderVariant,
  RowGroupCluster,
  RowGroupTier,
  RowCluster,
  RowState,
  RowSemantic,
  FirstColumnVariant,
  PlotScaffold,
  Layout,
  Banding,
  WebFont,
} from "./theme-resolved";
