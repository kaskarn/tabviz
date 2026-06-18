/**
 * Column-builder authoring API — TS mirror of `R/classes-components.R::col_*`.
 *
 * Every builder is a thin pure function that constructs a wire-shape
 * `ColumnSpec`. Argument names and defaults match the R helpers; argument
 * order is `field` (positional) → type-specific args (named) → shared
 * styling args (named).
 *
 * R-side counterpart: `R/classes-components.R`. Parity is documented in
 * `docs/dev/r-ts-parity-notes.md` and pinned by tests in `columns.test.ts`.
 */

import type { ColumnSpec, ColumnGroup, ColumnDef } from "../types";
import type {
  NumericColumnOptions, IntervalColumnOptions, PercentColumnOptions,
  EventsColumnOptions, BarColumnOptions, PvalueColumnOptions,
  SparklineColumnOptions, IconColumnOptions, BadgeColumnOptions,
  PictogramColumnOptions, RingColumnOptions,
  ImgColumnOptions, ReferenceColumnOptions, RangeColumnOptions,
  HeatmapColumnOptions, ProgressColumnOptions, TextColumnOptions,
} from "../types";

// ────────────────────────────────────────────────────────────────────
// Shared argument types
// ────────────────────────────────────────────────────────────────────

/** Per-cell style mapping: column name supplying the style value. */
type StyleArg = string | null;

/**
 * Arguments common to every column builder. Mirrors `web_col()`'s shared
 * signature. Style mappings live under `style.*` to avoid name collisions
 * with type-specific args like `color` (bar fill) or `icon` (icon glyph).
 */
export interface CommonColumnArgs {
  /** Override the auto-generated id (default `<type>_<field>`). */
  id?: string;
  /** Header text. Defaults to the field name verbatim. */
  header?: string;
  /** Column width (px). `null` / `"auto"` lets the renderer measure. */
  width?: number | "auto" | null;
  /** "left" | "center" | "right". Defaults to "left". */
  align?: "left" | "center" | "right";
  /** Header alignment override (defaults to `align`). */
  headerAlign?: "left" | "center" | "right" | null;
  /** Show header band. `undefined` = auto (show iff header non-empty). */
  showHeader?: boolean;
  /** Multi-line wrap. `false`/`0` = no wrap; `true`/`1` = 2 lines; `n` = n+1 lines. */
  wrap?: boolean | number;
  /** Sortable column. Default `true`. */
  sortable?: boolean;
  /**
   * Flex weight + aspect participation. A `number` sets this column's explicit
   * flex weight (share of distributed width ∝ weight × natural, overriding the
   * type default); `true`/`false` keep the schema-default weight and toggle
   * aspect-width absorption. Default `true` for `forest`/`viz_*`, `false` else.
   */
  flex?: boolean | number;
  /**
   * Per-cell style mappings — each value is a column name whose row values
   * drive that style attribute (e.g. `style.bold = "is_significant"`).
   */
  style?: {
    bold?: StyleArg;
    italic?: StyleArg;
    color?: StyleArg;
    bg?: StyleArg;
    badge?: StyleArg;
    icon?: StyleArg;
    emphasis?: StyleArg;
    muted?: StyleArg;
    accent?: StyleArg;
  };
}

// ────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────

const VIZ_TYPES = new Set(["forest", "viz_bar", "viz_boxplot", "viz_violin"]);

/** Compute the default id for a column — mirrors R's `default_column_id`. */
function defaultColumnId(type: string, field: string): string {
  if (!field) return type;
  const syntheticPrefix = `_${type}_`;
  if (field.startsWith(syntheticPrefix)) field = field.slice(syntheticPrefix.length);
  return `${type}_${field}`;
}

/**
 * Build a wire-shape ColumnSpec from type + field + options + shared styling
 * args. Centralizes the boilerplate every `col_*` helper would otherwise
 * repeat. Mirrors R's `web_col()`.
 */
function baseColumn(
  field: string,
  type: ColumnSpec["type"],
  options: ColumnSpec["options"],
  args: CommonColumnArgs = {},
): ColumnSpec {
  const styleMapping: ColumnSpec["styleMapping"] = {};
  const s = args.style;
  if (s) {
    if (s.bold     != null) styleMapping.bold     = s.bold;
    if (s.italic   != null) styleMapping.italic   = s.italic;
    if (s.color    != null) styleMapping.color    = s.color;
    if (s.bg       != null) styleMapping.bg       = s.bg;
    if (s.badge    != null) styleMapping.badge    = s.badge;
    if (s.icon     != null) styleMapping.icon     = s.icon;
    if (s.emphasis != null) styleMapping.emphasis = s.emphasis;
    if (s.muted    != null) styleMapping.muted    = s.muted;
    if (s.accent   != null) styleMapping.accent   = s.accent;
  }

  return {
    id: args.id ?? defaultColumnId(type, field),
    header: args.header ?? field,
    field,
    type,
    width: args.width ?? "auto",
    align: args.align ?? "left",
    headerAlign: args.headerAlign ?? null,
    showHeader: args.showHeader,
    wrap: args.wrap ?? false,
    sortable: args.sortable ?? true,
    flex: args.flex ?? VIZ_TYPES.has(type),
    options,
    isGroup: false,
    styleMapping: Object.keys(styleMapping).length > 0 ? styleMapping : undefined,
  };
}

// ────────────────────────────────────────────────────────────────────
// Text-family columns
// ────────────────────────────────────────────────────────────────────

export interface ColTextArgs extends CommonColumnArgs {
  field: string;
  maxChars?: number | null;
  naText?: string | null;
}

export function colText({ field, maxChars, naText, ...common }: ColTextArgs): ColumnSpec {
  const text: TextColumnOptions = {};
  if (maxChars != null) text.maxChars = maxChars;
  const options = (maxChars != null || naText != null)
    ? { text, ...(naText != null ? { naText } : {}) }
    : {};
  return baseColumn(field, "text", options, common);
}

/** Convenience over `colText` — prettifies the default header via `field` → Title Case. */
export function colLabel({ field, maxChars, naText, ...common }: ColTextArgs): ColumnSpec {
  const header = common.header ?? prettifyFieldName(field);
  return colText({ field, maxChars, naText, ...common, header });
}

export interface ColDateArgs extends CommonColumnArgs {
  field: string;
  /** strftime-style format string. Default `"%Y-%m-%d"`. */
  format?: string;
  naText?: string | null;
}

/**
 * Date column. Mirrors `R::col_date()`. The renderer reformats
 * `Date`/`POSIXct` values using `options.date.format`; pre-formatted
 * strings pass through unchanged.
 */
export function colDate({ field, format = "%Y-%m-%d", naText, ...common }: ColDateArgs): ColumnSpec {
  const options: Record<string, unknown> = { date: { format } };
  if (naText != null) options.naText = naText;
  return baseColumn(field, "text", options, common);
}

function prettifyFieldName(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ────────────────────────────────────────────────────────────────────
// Numeric-family columns
// ────────────────────────────────────────────────────────────────────

export interface ColNumericArgs extends CommonColumnArgs {
  field: string;
  decimals?: number;
  digits?: number;
  thousandsSep?: string | false;
  abbreviate?: boolean | number;
  prefix?: string;
  suffix?: string;
  naText?: string | null;
}

export function colNumeric({
  field, decimals, digits, thousandsSep = false, abbreviate = false,
  prefix, suffix, naText, ...common
}: ColNumericArgs): ColumnSpec {
  // Mutual exclusivity via a true sentinel (both EXPLICITLY given → throw),
  // mirroring R's `missing(decimals)` — the old `decimals !== 2` value-check
  // silently dropped an explicit `decimals: 2` when `digits` was also passed
  // (and treated a real `decimals: 2` as "unset"). The default 2 is applied
  // in the body, not the signature, so "explicit 2" stays distinguishable.
  if (decimals != null && digits != null) {
    throw new Error("colNumeric: cannot specify both `decimals` and `digits`");
  }
  const numeric: NumericColumnOptions & { prefix?: string | null; suffix?: string | null } = {
    decimals: digits != null ? undefined : (decimals ?? 2),
    digits,
    thousandsSep,
    abbreviate,
    prefix,
    suffix,
  };
  const options = { numeric, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "numeric", options, common);
}

export interface ColNArgs extends CommonColumnArgs {
  field: string;
  decimals?: number;
  digits?: number;
  thousandsSep?: string | false;
  abbreviate?: boolean | number;
  naText?: string | null;
}

/** Sample size / integer count column. Default thousands_sep "," + decimals 0. */
export function colN({
  field, decimals, digits, thousandsSep = ",", abbreviate = false, naText, ...common
}: ColNArgs): ColumnSpec {
  const header = common.header ?? "N";
  return colNumeric({
    field,
    // digits/decimals are mutually exclusive — send digits alone when given,
    // else colN's integer-count default of 0 (never both, so the guard above
    // can't false-trip on colN's own default).
    ...(digits != null ? { digits } : { decimals: decimals ?? 0 }),
    thousandsSep, abbreviate, naText, ...common, header,
  });
}

export interface ColCurrencyArgs extends CommonColumnArgs {
  field: string;
  decimals?: number;
  /** Significant figures (alternative to `decimals`) — mirrors R `col_currency(digits = )`. */
  digits?: number;
  /** Currency symbol. Defaults to "$" — mirrors R `col_currency(symbol = "$")`. */
  symbol?: string;
  thousandsSep?: string | false;
  abbreviate?: boolean | number;
  /** Symbol placement. Defaults to "prefix" — mirrors R `col_currency(position = "prefix")`. */
  position?: "prefix" | "suffix";
  naText?: string | null;
}

export function colCurrency({
  field, decimals = 2, digits, symbol = "$", thousandsSep = ",", abbreviate = false,
  position = "prefix", naText, ...common
}: ColCurrencyArgs): ColumnSpec {
  return colNumeric({
    field,
    // digits and decimals are mutually exclusive — pass digits alone when
    // given (R `col_currency(digits=)` parity), else the decimals default.
    ...(digits != null ? { digits } : { decimals }),
    thousandsSep, abbreviate,
    prefix: position === "prefix" ? symbol : undefined,
    suffix: position === "suffix" ? symbol : undefined,
    naText, ...common,
  });
}

// ────────────────────────────────────────────────────────────────────
// Interval / range / pvalue
// ────────────────────────────────────────────────────────────────────

export interface ColIntervalArgs extends CommonColumnArgs {
  point: string;
  lower: string;
  upper: string;
  decimals?: number;
  digits?: number;
  thousandsSep?: string | false;
  abbreviate?: boolean;
  separator?: string;
  impreciseThreshold?: number | null;
  /** Display variant — see IntervalColumnOptions.variant. */
  variant?: IntervalColumnOptions["variant"];
  // Bounds primitives (D30) — fine-tune within a variant; each overrides the
  // variant's resolved value when set. See IntervalColumnOptions.
  boundsLayout?: IntervalColumnOptions["boundsLayout"];
  boundsContent?: IntervalColumnOptions["boundsContent"];
  boundsOpen?: string;
  boundsClose?: string;
  boundsSeparator?: string;
  boundsPrefix?: string;
  boundsMuted?: boolean;
  naText?: string | null;
}

export function colInterval({
  point, lower, upper,
  decimals = 2, digits, thousandsSep = false, abbreviate = false,
  separator = " ", impreciseThreshold, variant,
  boundsLayout, boundsContent, boundsOpen, boundsClose,
  boundsSeparator, boundsPrefix, boundsMuted, naText,
  ...common
}: ColIntervalArgs): ColumnSpec {
  const interval: IntervalColumnOptions = {
    decimals: digits == null ? decimals : undefined,
    digits,
    thousandsSep,
    abbreviate,
    separator,
    point,
    lower,
    upper,
    impreciseThreshold,
    ...(variant != null ? { variant } : {}),
    // Only emit set primitives — absent ⇒ the variant fills them.
    ...(boundsLayout    != null ? { boundsLayout } : {}),
    ...(boundsContent   != null ? { boundsContent } : {}),
    ...(boundsOpen      != null ? { boundsOpen } : {}),
    ...(boundsClose     != null ? { boundsClose } : {}),
    ...(boundsSeparator != null ? { boundsSeparator } : {}),
    ...(boundsPrefix    != null ? { boundsPrefix } : {}),
    ...(boundsMuted     != null ? { boundsMuted } : {}),
  };
  const options = { interval, ...(naText != null ? { naText } : {}) };
  // Synthetic field name (`_interval_<point>`) so multiple interval columns
  // sharing the same point estimate get distinct fields/ids. Mirrors R's
  // `col_interval` and `default_column_id`'s synthetic-prefix strip.
  // R default header is "95% CI"; mirror unless the caller overrides.
  return baseColumn(
    `_interval_${point}`,
    "interval",
    options,
    { header: "95% CI", ...common },
  );
}

export interface ColPvalueArgs extends CommonColumnArgs {
  field: string;
  stars?: boolean;
  /** Stars color channel (only applies when stars=true). Default "accent". */
  starsColor?: "accent" | "ink2" | "negative" | "none";
  /** Paint a soft positive PILL on significant values. Default "none". */
  significantStyle?: "none" | "pill";
  thresholds?: [number, number, number];
  format?: "scientific" | "decimal" | "auto";
  digits?: number;
  expThreshold?: number;
  abbrevThreshold?: number | null;
  naText?: string | null;
}

export function colPvalue({
  field, stars = false, starsColor = "accent", significantStyle = "none",
  thresholds = [0.05, 0.01, 0.001],
  format = "auto", digits = 2, expThreshold = 0.001, abbrevThreshold = null,
  naText, ...common
}: ColPvalueArgs): ColumnSpec {
  const pvalue: PvalueColumnOptions = {
    stars, starsColor, significantStyle, thresholds, format, digits, expThreshold, abbrevThreshold,
  };
  const options = { pvalue, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "pvalue", options, {
    header: common.header ?? "P-value",
    ...common,
  });
}

export interface ColRangeArgs extends CommonColumnArgs {
  /** Field name for the lower bound. Mirrors R `col_range(low = ...)`. */
  low: string;
  /** Field name for the upper bound. Mirrors R `col_range(high = ...)`. */
  high: string;
  separator?: string;
  decimals?: number | null;
  digits?: number;
  thousandsSep?: string | false;
  abbreviate?: boolean;
  naText?: string | null;
}

export function colRange({
  low, high, separator = " - ",
  decimals = null, digits, thousandsSep = false, abbreviate = false,
  naText, ...common
}: ColRangeArgs): ColumnSpec {
  const range: RangeColumnOptions = {
    minField: low, maxField: high, separator, decimals, digits,
    thousandsSep, abbreviate,
  };
  const options = { range, ...(naText != null ? { naText } : {}) };
  // Synthetic field name `_range_<low>_<high>` mirrors R's `col_range()`
  // — keeps multiple range columns distinguishable when sharing one
  // bound across different pairings.
  // Default header is "Range" (matches R default).
  return baseColumn(
    `_range_${low}_${high}`,
    "range",
    options,
    { header: "Range", align: "right", ...common },
  );
}

export interface ColEventsArgs extends CommonColumnArgs {
  events: string;
  n: string;
  separator?: string;
  showPct?: boolean;
  thousandsSep?: string | false;
  abbreviate?: boolean | number;
  naText?: string | null;
}

export function colEvents({
  events, n, separator = "/", showPct = false, thousandsSep = ",", abbreviate = false,
  naText, ...common
}: ColEventsArgs): ColumnSpec {
  const eventsOpt: EventsColumnOptions = {
    eventsField: events, nField: n, separator, showPct, thousandsSep, abbreviate,
  };
  const options = { events: eventsOpt, ...(naText != null ? { naText } : {}) };
  // Synthetic field name `_events_<events>_<n>` for parity with R's
  // `col_events()` — keeps multiple events columns distinguishable when
  // sharing the same `events` field across different denominators.
  return baseColumn(`_events_${events}_${n}`, "custom", options, {
    header: common.header ?? "Events",
    ...common,
  });
}

// ────────────────────────────────────────────────────────────────────
// Bar / sparkline / heatmap / progress
// ────────────────────────────────────────────────────────────────────

export interface ColBarArgs extends CommonColumnArgs {
  field: string;
  maxValue?: number | null;
  showLabel?: boolean;
  color?: string | null;
  scale?: "linear" | "log" | "sqrt";
  naText?: string | null;
}

export function colBar({
  field, maxValue = null, showLabel = true, color = null, scale = "linear", naText, ...common
}: ColBarArgs): ColumnSpec {
  const bar: BarColumnOptions = { maxValue, showLabel, color, scale };
  const options = { bar, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "bar", options, common);
}

export interface ColSparklineArgs extends CommonColumnArgs {
  field: string;
  type?: "line" | "bar" | "area";
  height?: number;
  color?: string | null;
  naText?: string | null;
}

export function colSparkline({
  field, type = "line", height = 20, color = null, naText, ...common
}: ColSparklineArgs): ColumnSpec {
  const sparkline: SparklineColumnOptions = { type, height, color };
  const options = { sparkline, ...(naText != null ? { naText } : {}) };
  // R col_sparkline defaults header to "Trend" (literal, not field-derived);
  // mirror for parity.
  return baseColumn(field, "sparkline", options, { header: "Trend", ...common });
}

export interface ColHeatmapArgs extends CommonColumnArgs {
  field: string;
  palette?: string[];
  minValue?: number | null;
  maxValue?: number | null;
  decimals?: number;
  showValue?: boolean;
  scale?: "linear" | "log" | "sqrt";
  naText?: string | null;
}

export function colHeatmap({
  field, palette, minValue = null, maxValue = null, decimals = 2, showValue = true,
  scale = "linear", naText, ...common
}: ColHeatmapArgs): ColumnSpec {
  const heatmap: HeatmapColumnOptions = { palette, minValue, maxValue, decimals, showValue, scale };
  const options = { heatmap, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "heatmap", options, common);
}

export interface ColProgressArgs extends CommonColumnArgs {
  field: string;
  maxValue?: number;
  color?: string | null;
  showLabel?: boolean;
  scale?: "linear" | "log" | "sqrt";
  naText?: string | null;
}

export function colProgress({
  field, maxValue = 100, color = null, showLabel = true, scale = "linear", naText, ...common
}: ColProgressArgs): ColumnSpec {
  const progress: ProgressColumnOptions = { maxValue, color, showLabel, scale };
  const options = { progress, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "progress", options, common);
}

// ────────────────────────────────────────────────────────────────────
// Categorical & pictographic
// ────────────────────────────────────────────────────────────────────

export interface ColBadgeArgs extends CommonColumnArgs {
  field: string;
  variants?: Record<string, "default" | "success" | "warning" | "error" | "info" | "muted">;
  colors?: Record<string, string> | string[];
  size?: "sm" | "base";
  shape?: "pill" | "circle" | "square";
  outline?: boolean;
  thresholds?: number[];
  naText?: string | null;
}

export function colBadge({
  field, variants, colors, size = "base", shape = "pill", outline = false, thresholds,
  naText, ...common
}: ColBadgeArgs): ColumnSpec {
  const badge: BadgeColumnOptions = { variants, colors, size, shape, outline, thresholds };
  const options = { badge, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "badge", options, common);
}

export interface ColIconArgs extends CommonColumnArgs {
  field: string;
  mapping?: Record<string, string>;
  size?: "sm" | "base" | "lg" | "xl";
  color?: string;
  naText?: string | null;
}

export function colIcon({
  field, mapping, size = "base", color, naText, ...common
}: ColIconArgs): ColumnSpec {
  const icon: IconColumnOptions = { mapping, size, color };
  const options = { icon, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "icon", options, common);
}

export interface ColStarsArgs extends CommonColumnArgs {
  field: string;
  maxStars?: number;
  color?: string;
  emptyColor?: string;
  halfStars?: boolean;
  domain?: [number, number] | null;
  size?: "sm" | "base" | "lg";
  naText?: string | null;
}

/**
 * Stars column. Implemented as a `pictogram` column with `glyph = "star"`
 * for byte-equal wire parity with R-side `col_stars()` (which is itself a
 * thin wrapper over `col_pictogram(glyph = "star")`). The renderer
 * special-cases the star glyph regardless of whether the type label is
 * `"stars"` or `"pictogram"`.
 */
export function colStars({
  field, maxStars = 5, color, emptyColor, halfStars = false, domain = null,
  size = "base", naText, ...common
}: ColStarsArgs): ColumnSpec {
  return colPictogram({
    field,
    glyph: "star",
    maxGlyphs: maxStars,
    halfGlyphs: halfStars,
    domain,
    color: color ?? null,
    emptyColor: emptyColor ?? null,
    size,
    naText,
    ...common,
  });
}

export interface ColPictogramArgs extends CommonColumnArgs {
  field: string;
  glyph?: string | Record<string, string>;
  glyphField?: string | null;
  maxGlyphs?: number | null;
  domain?: [number, number] | null;
  halfGlyphs?: boolean;
  color?: string | null;
  emptyColor?: string | null;
  size?: "sm" | "base" | "lg";
  layout?: "row" | "stack";
  valueLabel?: false | true | "leading" | "trailing";
  labelFormat?: "integer" | "decimal" | null;
  labelDecimals?: number;
  naText?: string | null;
}

export function colPictogram({
  field, glyph = "person", glyphField = null, maxGlyphs = null, domain = null,
  halfGlyphs = false, color = null, emptyColor = null, size = "base",
  // labelDecimals default is 1 to match R col_pictogram/col_stars AND both
  // renderer fallbacks (CellPictogram / pictogram-svg-renderer ?? 1); this was
  // 0 — the lone outlier, so a TS-authored pictogram showed "4" where R showed
  // "4.0" (R↔TS default drift, 2026-06-14). colStars delegates here.
  layout = "row", valueLabel = false, labelFormat = null, labelDecimals = 1,
  naText, ...common
}: ColPictogramArgs): ColumnSpec {
  const pictogram: PictogramColumnOptions = {
    glyph, glyphField, maxGlyphs, domain, halfGlyphs, color, emptyColor,
    size, layout, valueLabel, labelFormat, labelDecimals,
  };
  const options = { pictogram, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "pictogram", options, common);
}

export interface ColRingArgs extends CommonColumnArgs {
  field: string;
  minValue?: number;
  maxValue?: number;
  color?: string | string[] | null;
  thresholds?: number[] | null;
  trackColor?: string | null;
  size?: "sm" | "base" | "lg";
  showLabel?: boolean;
  labelFormat?: "percent" | "decimal" | "integer";
  labelDecimals?: number;
  naText?: string | null;
}

export function colRing({
  field, minValue = 0, maxValue = 1, color = null, thresholds = null,
  trackColor = null, size = "base", showLabel = true,
  labelFormat = "percent", labelDecimals = 0, naText, ...common
}: ColRingArgs): ColumnSpec {
  const ring: RingColumnOptions = {
    minValue, maxValue, color, thresholds, trackColor, size, showLabel,
    labelFormat, labelDecimals,
  };
  const options = { ring, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "ring", options, common);
}

// ────────────────────────────────────────────────────────────────────
// Media / link
// ────────────────────────────────────────────────────────────────────

export interface ColImgArgs extends CommonColumnArgs {
  field: string;
  height?: number;
  maxWidth?: number;
  fallback?: string;
  shape?: "square" | "circle" | "rounded";
  naText?: string | null;
}

export function colImg({
  // R↔TS parity with R col_img: fallback default "[img]" (shown when an image
  // URL fails to load); `height` UNSET by default (R omits it → renderer's own
  // default; baking 40 here was a drift); `align` defaults to "center" (R injects
  // it unless the caller overrides).
  field, height, maxWidth, fallback = "[img]", shape = "square", naText, ...common
}: ColImgArgs): ColumnSpec {
  const img: ImgColumnOptions = { height, maxWidth, fallback, shape };
  const options = { img, ...(naText != null ? { naText } : {}) };
  return baseColumn(field, "img", options, { align: "center", ...common });
}

export interface ColReferenceArgs extends CommonColumnArgs {
  field: string;
  hrefField?: string;
  maxChars?: number;
  showIcon?: boolean;
  naText?: string | null;
}

export function colReference({
  field, hrefField, maxChars = 30, showIcon = true, naText, ...common
}: ColReferenceArgs): ColumnSpec {
  const reference: ReferenceColumnOptions = { hrefField, maxChars, showIcon };
  const options = { reference, ...(naText != null ? { naText } : {}) };
  // R `col_reference()` defaults header to "Reference" (not field-derived);
  // mirror for parity.
  return baseColumn(field, "reference", options, { header: "Reference", ...common });
}

export interface ColPercentArgs extends CommonColumnArgs {
  field: string;
  decimals?: number;
  digits?: number;
  multiply?: boolean;
  symbol?: boolean;
  naText?: string | null;
}

export function colPercent({
  field, decimals = 1, digits, multiply = true, symbol = true, naText, ...common
}: ColPercentArgs): ColumnSpec {
  if (digits != null && decimals !== 1) {
    throw new Error("colPercent: cannot specify both `decimals` and `digits`");
  }
  const percent: PercentColumnOptions = {
    decimals: digits == null ? decimals : undefined,
    digits, multiply, symbol,
  };
  const options = { percent, ...(naText != null ? { naText } : {}) };
  // Wire type is "numeric" (renderer dispatches `numeric` and `percent`
  // through the same `formatNumber` path; both R `col_percent()` and the
  // renderer expect "numeric" here for parity).
  return baseColumn(field, "numeric", options, common);
}

// ────────────────────────────────────────────────────────────────────
// Column grouping
// ────────────────────────────────────────────────────────────────────

export interface ColGroupArgs {
  /** Group id; auto-generated from header when omitted. */
  id?: string;
  /** Group header text (spans all child columns). */
  header: string;
  /** Child columns or nested groups. */
  children: ColumnDef[];
}

export function colGroup({ id, header, children }: ColGroupArgs): ColumnGroup {
  return {
    id: id ?? header.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    header,
    isGroup: true,
    columns: children,
  };
}

// Internal export — used by viz.ts and tabviz.ts.
export { baseColumn, defaultColumnId, VIZ_TYPES };
