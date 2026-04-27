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
  // can flip multiple. Precedence (loud → quiet): fill > highlight >
  // accent > emphasis > bold > muted.
  emphasis?: boolean;   // Bold + primary fg + primary marker
  muted?: boolean;      // Lighter color
  accent?: boolean;     // Bold + accent color
  highlight?: boolean;  // Bold + pale highlighter bg (theme.semantic.highlight)
  fill?: boolean;       // Bold + strong row fill (theme.semantic.fill)
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
  // Semantic styling — same six tokens as RowStyle. Precedence:
  // fill > highlight > accent > emphasis > bold > muted.
  emphasis?: boolean;
  muted?: boolean;
  accent?: boolean;
  highlight?: boolean;
  fill?: boolean;
  // Per-cell hover tooltip text (overrides the default value-as-title)
  tooltip?: string | null;
}

// Maps style properties to column names containing values
export interface StyleMapping {
  bold?: string;
  italic?: string;
  color?: string;
  bg?: string;
  badge?: string;
  icon?: string;
  // Semantic styling mappings
  emphasis?: string;
  muted?: string;
  accent?: string;
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
}

export interface Group {
  id: string;
  label: string;
  collapsed: boolean;
  parentId?: string | null;
  depth: number;
}

export interface GroupSummary {
  groupId: string;
  point: number;
  lower: number;
  upper: number;
  metadata: Record<string, unknown>;
}

export interface OverallSummary {
  point: number;
  lower: number;
  upper: number;
  metadata: Record<string, unknown>;
}

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

export interface WebData {
  rows: Row[];
  groups: Group[];
  summaries: GroupSummary[];
  overall?: OverallSummary | null;
  groupCol?: string | null;
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
  size?: "sm" | "base" | "lg";
  color?: string;
}

export interface BadgeColumnOptions {
  variants?: Record<string, "default" | "success" | "warning" | "error" | "info" | "muted">;
  colors?: Record<string, string>;  // Custom hex colors override variants
  size?: "sm" | "base";
}

export interface StarsColumnOptions {
  maxStars?: number;
  color?: string;  // Filled star color
  emptyColor?: string;  // Empty star color
  halfStars?: boolean;
  domain?: [number, number] | null;  // Remap raw values from [lo, hi] → [0, maxStars]
  size?: "sm" | "base" | "lg";       // Star glyph size
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
  showBar?: boolean;
}

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
  width?: number | null;       // Width in pixels (null for auto from layout.forestWidth)
  annotations?: Annotation[] | null;    // Reference lines and other annotations
  sharedAxis?: boolean | null; // In split forests: share axis across splits (null = inherit from split-level)
}

// ============================================================================
// Viz Column Types (focal visualization columns with axes)
// ============================================================================

/** Base interface for all viz column types */
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
  barWidth?: number;          // Width of each bar in pixels
  barGap?: number;            // Gap between grouped bars
  orientation?: "horizontal" | "vertical";
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
  whiskerType?: "iqr" | "minmax";  // IQR-based (1.5×IQR) or min/max whiskers
  boxWidth?: number;          // Width of the box in pixels
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
  maxWidth?: number;          // Max width of violin in pixels
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
  | "icon" | "badge" | "stars" | "img" | "reference" | "range" | "forest"
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
  | "bold" | "highlight" | "fill";

export type Semantics = Record<SemanticToken, SemanticBundle>;

/**
 * Tier-2 named token colors. theme.semantic.highlight + .fill drive the
 * default bg of the highlight + fill RowSemantic bundles; defaults to
 * accent-derived values at R-side resolve time.
 */
export interface SemanticInputs {
  highlight: string;
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

export interface WebTheme {
  name: string;
  colors: ColorPalette;
  typography: Typography;
  spacing: Spacing;
  shapes: Shapes;
  axis: AxisConfig;
  layout: LayoutConfig;
  groupHeaders: GroupHeaderStyles;
  semantics: Semantics;
}

// ============================================================================
// Interaction Types
// ============================================================================

export interface InteractionSpec {
  showFilters: boolean;
  showLegend: boolean;
  enableSort: boolean;
  enableCollapse: boolean;
  enableSelect: boolean;
  enableHover: boolean;
  enableResize: boolean;
  enableExport?: boolean;
  enableReorderRows?: boolean;      // Drag rows within a group; drag row-groups among siblings
  enableReorderColumns?: boolean;   // Drag columns within a column-group; drag column-groups among siblings
  enableEdit?: boolean;             // Double-click to edit cells / labels / forest numerics
  enableFilters?: boolean;          // Render per-column filter popovers (supersedes showFilters)
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
}

// ============================================================================
// Main Spec (what R sends to JS)
// ============================================================================

export interface WebSpec {
  data: WebData;
  columns: ColumnDef[];
  extraColumns?: ColumnDef[];
  availableFields?: AvailableField[];
  theme: WebTheme;
  interaction: InteractionSpec;
  layout: LayoutSpec;
  labels?: PlotLabels;
  watermark?: string;
  /** Watermark text color (CSS color). Cascades from `colors.foreground` when undefined. */
  watermarkColor?: string;
  /** Watermark fill-opacity, 0–1. Default 0.07 if undefined. */
  watermarkOpacity?: number;
  /** Verbatim deparse of the user's original `tabviz(...)` call, captured
   *  R-side. Shown as the baseline line in the "View source" panel above
   *  the recorded fluent operations. Undefined for fluent-api-only specs. */
  originalCall?: string;
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
  tableWidth: number;
  forestWidth: number;
  headerHeight: number;
  rowHeight: number;
  plotHeight: number;
  axisHeight: number;
  nullValue: number;
  summaryYPosition: number;
  showOverallSummary: boolean;
  // Cumulative Y positions for each row (accounts for variable heights like spacers)
  rowPositions: number[];
  // Heights for each row (spacers are half-height)
  rowHeights: number[];
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

export type DisplayRow = GroupHeaderRow | DataRow;

// ============================================================================
// Store State
// ============================================================================

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

export interface FilterConfig {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "contains";
  value: unknown;
}

// Multi-column filter state (keyed by column field).
// Replaces FilterConfig for multi-filter UX; FilterConfig kept for Shiny proxy compat.
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

export interface SplitForestPayload {
  type: "split_forest";
  splitVars: string[];
  navTree: NavTreeNode[];
  specs: Record<string, WebSpec>;
  sharedAxis: boolean;
  sharedColumnWidths?: boolean;
  axisRange: { min: number; max: number } | null;
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
