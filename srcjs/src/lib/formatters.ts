/**
 * Shared formatting functions for forest plot column rendering.
 * Used by both web (TabvizPlot.svelte) and SVG (svg-generator.ts) renderers.
 *
 * Formatters are pure functions of (value, options). They're called per-cell
 * at render time, so each one is wrapped in a memoization layer keyed by the
 * stable ColumnOptions object identity + the formatted value(s). The cache
 * lives in a WeakMap so it GCs when a spec is replaced (new options objects).
 */

import type { ColumnOptions, Row } from "../types";
import { recipeFor } from "../schema/columns/interval-renderer";

// ============================================================================
// Memoization
// ============================================================================
// WeakMap<ColumnOptions, Map<valueKey, formattedString>>. ColumnOptions is
// stable per-column for the lifetime of a spec; values within a column have
// low cardinality in practice (mostly numerics that repeat). Cache size is
// bounded by (#columns × unique-values-per-column) and GC's when the spec
// changes — no manual eviction needed at typical scales (5k rows × ~10 cols).
//
// The `_noOpts` cache handles the (rare) call with no options.
type ValueCache<R = string> = Map<unknown, R>;
const _noOptsCacheNumber: ValueCache = new Map();
const _noOptsCachePvalue: ValueCache = new Map();
const _formatNumberCache: WeakMap<ColumnOptions, ValueCache> = new WeakMap();
const _formatPvalueCache: WeakMap<ColumnOptions, ValueCache> = new WeakMap();
const _formatIntervalCache: WeakMap<ColumnOptions, ValueCache> = new WeakMap();
const _formatEventsCache: WeakMap<ColumnOptions, ValueCache> = new WeakMap();
const _abbreviateNumberCache: ValueCache<string> = new Map();

function _getOrCreate(
  cache: WeakMap<ColumnOptions, ValueCache>,
  options: ColumnOptions
): ValueCache {
  let m = cache.get(options);
  if (!m) {
    m = new Map();
    cache.set(options, m);
  }
  return m;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Add thousands separator to a number string */
export function addThousandsSep(numStr: string, separator: string): string {
  const parts = numStr.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return parts.join(".");
}

/**
 * Truncate a string to at most maxChars visible characters, replacing the tail
 * with an ellipsis when shortening. Returns str unchanged when it already fits
 * or when maxChars is nullish / non-positive.
 */
export function truncateString(
  str: string,
  maxChars: number | null | undefined
): string {
  if (str == null) return "";
  if (maxChars == null || !Number.isFinite(maxChars) || maxChars <= 0) return str;
  // Count by CODE POINT (matches estimateTextWidth's [...text]) so an astral
  // char (emoji / CJK-ext) isn't split mid-surrogate into a broken "\ufffd".
  const cps = [...str];
  if (cps.length <= maxChars) return str;
  if (maxChars === 1) return "\u2026";
  return cps.slice(0, maxChars - 1).join("") + "\u2026";
}

/**
 * Abbreviate large numbers with at most 1 decimal place.
 * Examples: 11111111 -> "11.1M", 5300 -> "5.3K", 1000 -> "1K"
 * Throws error for values >= 1e12 (trillions not supported).
 */
export function abbreviateNumber(value: number): string {
  const hit = _abbreviateNumberCache.get(value);
  if (hit !== undefined) return hit;
  const result = _abbreviateNumberImpl(value);
  _abbreviateNumberCache.set(value, result);
  return result;
}

function _abbreviateNumberImpl(value: number): string {
  // Non-finite guard (defense in depth — the primary caller pre-filters, but
  // this is exported and reachable directly): ±Inf/NaN must not fall through
  // to `Math.round(NaN)` → the "NaN" string (the non-finite poison class).
  if (!Number.isFinite(value)) return "";

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  // Suffix ladder K/M/B/T. Trillion caps the ladder: a value ≥ 1e15 renders as
  // e.g. "1000T" rather than THROWING — abbreviating user data must never crash
  // the render (a market-cap / national-budget cell easily exceeds 1e12).
  if (absValue >= 1e12) {
    return sign + formatAbbreviated(absValue / 1e12) + "T";
  }
  if (absValue >= 1e9) {
    return sign + formatAbbreviated(absValue / 1e9) + "B";
  }
  if (absValue >= 1e6) {
    return sign + formatAbbreviated(absValue / 1e6) + "M";
  }
  if (absValue >= 1e3) {
    return sign + formatAbbreviated(absValue / 1e3) + "K";
  }
  // Values under 1000 are returned as-is (rounded to integer)
  return sign + Math.round(absValue).toString();
}

/** Format abbreviated value with at most 1 decimal, no trailing zeros */
function formatAbbreviated(value: number): string {
  // Round to 1 decimal place
  const rounded = Math.round(value * 10) / 10;
  // If it's a whole number, return without decimal
  if (rounded === Math.floor(rounded)) {
    return rounded.toFixed(0);
  }
  return rounded.toFixed(1);
}

/** Unicode superscript character mapping */
const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "-": "⁻", "+": "⁺",
};

/** Convert string to Unicode superscript */
export function toSuperscript(str: string): string {
  return str.split("").map(c => SUPERSCRIPT_MAP[c] ?? c).join("");
}

// ============================================================================
// Column Formatters
// ============================================================================

/** Clamp a decimal-places count to the `toFixed`-legal [0, 100] range. A
 *  spec/wire value outside it (or non-finite) makes `toFixed` THROW a
 *  RangeError, crashing the whole render — defensively bound it here. */
function safeFixedDigits(d: number | null | undefined, fallback = 0): number {
  if (d == null || !Number.isFinite(d)) return fallback;
  return Math.min(100, Math.max(0, Math.trunc(d)));
}

/** Clamp a significant-figures count to the `toPrecision`-legal [1, 100]
 *  range (same RangeError hazard as {@link safeFixedDigits}). */
function safePrecisionDigits(d: number | null | undefined, fallback = 6): number {
  if (d == null || !Number.isFinite(d)) return fallback;
  return Math.min(100, Math.max(1, Math.trunc(d)));
}

/** Format number for display - respects column options */
export function formatNumber(value: number | undefined | null, options?: ColumnOptions): string {
  const cache = options ? _getOrCreate(_formatNumberCache, options) : _noOptsCacheNumber;
  const hit = cache.get(value);
  if (hit !== undefined) return hit as string;
  const result = _formatNumberImpl(value, options);
  cache.set(value, result);
  return result;
}

function _formatNumberImpl(value: number | undefined | null, options?: ColumnOptions): string {
  // Non-finite guard: undefined/null/NaN AND ±Infinity all render as naText.
  // (Was Number.isNaN only — Infinity slipped through to .toFixed() → the raw
  // "Infinity" string in a cell. !Number.isFinite folds both in, matching the
  // truncateString guard above.)
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return options?.naText ?? "";
  }

  // Percent formatting
  if (options?.percent) {
    const { decimals, digits, multiply = true, symbol = true } = options.percent;
    const displayValue = multiply ? value * 100 : value;
    // Use significant figures if digits is specified, otherwise use decimals
    const formatted = digits != null
      ? displayValue.toPrecision(safePrecisionDigits(digits))
      : displayValue.toFixed(safeFixedDigits(decimals, 1));
    return symbol ? `${formatted}%` : formatted;
  }

  // Compute the numeric body (no prefix/suffix yet) so prefix/suffix
  // application is uniform across all three formatting paths:
  // abbreviate, digits, and decimals+thousands_sep. Fixes the
  // `col_currency(abbreviate = TRUE)` case where the abbreviated
  // branch used to early-return, dropping the `$` prefix.
  const abbreviate = options?.numeric?.abbreviate;
  const digits = options?.numeric?.digits;
  const decimals = options?.numeric?.decimals;
  // `true` coerces to the conventional comma: the guard below requires a
  // string, so a boolean silently no-op'd (R2 versatility L8 — a natural
  // user guess that did nothing).
  // The declared wire type is string|false, but R serializes TRUE as a
  // boolean true — widen for the runtime reality.
  const rawSep = options?.numeric?.thousandsSep as string | boolean | undefined;
  const thousandsSep = rawSep === true ? "," : rawSep;
  let formatted: string;

  if (abbreviate && Math.abs(value) >= 1000) {
    formatted = abbreviateNumber(value);
  } else if (digits !== undefined && digits !== null) {
    formatted = value.toPrecision(safePrecisionDigits(digits));
    if (thousandsSep && typeof thousandsSep === "string") {
      formatted = addThousandsSep(formatted, thousandsSep);
    }
  } else {
    if (decimals !== undefined) {
      formatted = value.toFixed(safeFixedDigits(decimals));
    } else if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 0.0001) {
      // Default behavior: integers show no decimals, others show 2
      formatted = Math.round(value).toString();
    } else {
      formatted = value.toFixed(2);
    }
    if (thousandsSep && typeof thousandsSep === "string") {
      formatted = addThousandsSep(formatted, thousandsSep);
    }
  }

  // Normalize negative zero AFTER formatting: (-0.001).toFixed(2)
  // preserves the sign and rendered "-0.00" (R2 versatility M6).
  // Post-format is exact at any decimals/digits setting.
  if (/^-0(?:\.0+)?$/.test(formatted)) formatted = formatted.slice(1);

  // Apply prefix/suffix (e.g., for currency: "$100" or "100EUR").
  // The sign hoists OUTSIDE the prefix: "$-45,000.50" violated the
  // universal accounting convention; "-$45,000.50" is correct (R2
  // versatility M5).
  const prefix = options?.numeric?.prefix;
  const suffix = options?.numeric?.suffix;
  if (prefix) {
    formatted = formatted.startsWith("-")
      ? "-" + prefix + formatted.slice(1)
      : prefix + formatted;
  }
  if (suffix) formatted = formatted + suffix;

  return formatted;
}

/** Format events column (events/n) */
export function formatEvents(row: Row, options: ColumnOptions): string {
  const { eventsField, nField } = options.events!;
  const events = row.metadata[eventsField];
  const n = row.metadata[nField];
  // Cache key: pair of extracted values; we don't depend on row identity.
  const cache = _getOrCreate(_formatEventsCache, options);
  const key = `${events as unknown as string}|${n as unknown as string}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit as string;
  const result = _formatEventsImpl(events, n, options);
  cache.set(key, result);
  return result;
}

function _formatEventsImpl(
  events: unknown,
  n: unknown,
  options: ColumnOptions
): string {
  const { separator = "/", showPct = false, thousandsSep, abbreviate } = options.events!;

  if (events === undefined || events === null || n === undefined || n === null) {
    return options.naText ?? "";
  }

  const eventsNum = Number(events);
  const nNum = Number(n);
  // Non-finite guard (the poison class): a non-numeric or ±Inf/NaN value coerces
  // to NaN/Infinity and would leak the literal "NaN"/"Infinity" string into the
  // cell (the undefined/null guard above misses it). Mirror formatNumber →
  // naText. Fixed 2026-07-21 (the events twin of the formatters non-finite sweep).
  if (!Number.isFinite(eventsNum) || !Number.isFinite(nNum)) {
    return options.naText ?? "";
  }
  let eventsStr: string;
  let nStr: string;

  // Handle abbreviation for large numbers
  if (abbreviate && (eventsNum >= 1000 || nNum >= 1000)) {
    eventsStr = eventsNum >= 1000 ? abbreviateNumber(eventsNum) : String(eventsNum);
    nStr = nNum >= 1000 ? abbreviateNumber(nNum) : String(nNum);
  } else {
    eventsStr = String(eventsNum);
    nStr = String(nNum);
    // Apply thousands separator if specified (only when not abbreviating)
    if (thousandsSep && typeof thousandsSep === "string") {
      eventsStr = addThousandsSep(eventsStr, thousandsSep);
      nStr = addThousandsSep(nStr, thousandsSep);
    }
  }

  let result = `${eventsStr}${separator}${nStr}`;

  if (showPct && nNum > 0) {
    const pct = ((eventsNum / nNum) * 100).toFixed(1);
    result += ` (${pct}%)`;
  }

  return result;
}

/** Format interval for display */
export function formatInterval(
  point?: number,
  lower?: number,
  upper?: number,
  options?: ColumnOptions
): string {
  if (options) {
    const cache = _getOrCreate(_formatIntervalCache, options);
    const key = `${point}|${lower}|${upper}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit as string;
    const result = _formatIntervalImpl(point, lower, upper, options);
    cache.set(key, result);
    return result;
  }
  return _formatIntervalImpl(point, lower, upper, options);
}

function _formatIntervalImpl(
  point?: number,
  lower?: number,
  upper?: number,
  options?: ColumnOptions
): string {
  if (point === undefined || point === null || !Number.isFinite(point)) {
    return options?.naText ?? "";
  }

  const i = options?.interval;
  const sep = i?.separator ?? i?.sep ?? " ";
  const impreciseThreshold = i?.impreciseThreshold;

  // Synthesize numeric ColumnOptions so we can route every value through
  // formatNumber and get digits / abbreviate / thousandsSep support for free.
  const numOpts: ColumnOptions = {
    numeric: {
      decimals: i?.decimals,
      digits: i?.digits,
      thousandsSep: i?.thousandsSep,
      abbreviate: i?.abbreviate,
    },
  };

  const fmt = (v: number) => formatNumber(v, numOpts);

  // A non-finite bound (NaN or ±Infinity) is not a usable interval edge →
  // fall back to point-only, exactly like a missing bound.
  if (lower === undefined || lower === null || upper === undefined || upper === null ||
      !Number.isFinite(lower) || !Number.isFinite(upper)) {
    return fmt(point);
  }

  // Check for imprecise estimate (CI ratio exceeds threshold)
  if (impreciseThreshold != null && lower > 0 && upper / lower > impreciseThreshold) {
    return "—";
  }

  // Mirror the cell renderer's VARIANT recipe so the measured string matches
  // what actually paints (user feedback 2026-06-08: the old hardcoded
  // `(lo, hi)` over-sized the `plus_minus` (renders half-width ±δ) and
  // `stacked` (renders TWO lines) variants). For column/stacked layout the
  // column width is the WIDER of the two lines, not their concatenation.
  const recipe = recipeFor(i);
  const boundsBody = recipe.boundsContent === "half_width"
    ? fmt((upper - lower) / 2)
    : `${fmt(lower)}${recipe.boundsSeparator}${fmt(upper)}`;
  const boundsStr = `${recipe.boundsDelimiter[0]}${recipe.boundsPrefix}${boundsBody}${recipe.boundsDelimiter[1]}`;
  // NB: `boundsMuted` renders the bounds at MINOR size (~0.85x); this string is
  // measured at full size, so a muted variant slightly OVER-estimates its
  // column width — a safe direction (never clips). Discounting the bounds
  // sub-width would need a split measure; not worth it for the small delta.
  const pointStr = fmt(point);
  if (recipe.boundsLayout === "column") {
    // Two stacked lines → width = the longer single line.
    return pointStr.length >= boundsStr.length ? pointStr : boundsStr;
  }
  return `${pointStr}${sep}${boundsStr}`;
}

/** Format p-value for display with Unicode superscript notation */
export function formatPvalue(value: number | undefined | null, options?: ColumnOptions): string {
  const cache = options ? _getOrCreate(_formatPvalueCache, options) : _noOptsCachePvalue;
  const hit = cache.get(value);
  if (hit !== undefined) return hit as string;
  const result = _formatPvalueImpl(value, options);
  cache.set(value, result);
  return result;
}

function _formatPvalueImpl(value: number | undefined | null, options?: ColumnOptions): string {
  // Non-finite guard: undefined/null/NaN AND ±Infinity all render as naText.
  // (Was Number.isNaN only — Infinity slipped through to .toFixed() → the raw
  // "Infinity" string in a cell. !Number.isFinite folds both in, matching the
  // truncateString guard above.)
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return options?.naText ?? "";
  }

  const pvalOpts = options?.pvalue;
  const digits = pvalOpts?.digits ?? 2;
  const expThreshold = pvalOpts?.expThreshold ?? 0.001;
  const abbrevThreshold = pvalOpts?.abbrevThreshold ?? null;
  const format = pvalOpts?.format ?? "auto";
  const showStars = pvalOpts?.stars ?? false;
  const thresholds = pvalOpts?.thresholds ?? [0.05, 0.01, 0.001];

  // Compute stars
  let starStr = "";
  if (showStars) {
    if (value < thresholds[2]) starStr = "***";
    else if (value < thresholds[1]) starStr = "**";
    else if (value < thresholds[0]) starStr = "*";
  }

  // Abbreviation threshold: show "<threshold" notation if enabled and value is below
  if (abbrevThreshold !== null && value < abbrevThreshold) {
    return `<${abbrevThreshold}${starStr}`;
  }

  // p-values live in (0, 1]. A 0 (underflow) renders as the "<expThreshold"
  // floor; a negative is invalid. Guard BEFORE the scientific branch, whose
  // log10(value) would NaN-poison the output ("NaN×10⁻ᴵⁿᶠⁱⁿⁱᵗʸ") otherwise.
  if (value <= 0) {
    return value < 0 ? (options?.naText ?? "") : `<${expThreshold}${starStr}`;
  }

  // Use scientific notation with Unicode superscript for small values
  if (format === "scientific" || (format === "auto" && value < expThreshold)) {
    const exp = Math.floor(Math.log10(value));
    const mantissa = value / Math.pow(10, exp);
    const mantissaStr = mantissa.toPrecision(safePrecisionDigits(digits));
    return `${mantissaStr}×10${toSuperscript(exp.toString())}${starStr}`;
  }

  // Decimal format with appropriate precision based on magnitude
  let formatted: string;
  if (value >= 0.1) formatted = value.toFixed(safeFixedDigits(digits));
  else if (value >= 0.01) formatted = value.toFixed(safeFixedDigits(digits + 1));
  else formatted = value.toFixed(safeFixedDigits(digits + 2));

  return `${formatted}${starStr}`;
}

// ============================================================================
// Display Text Extraction (for width measurement)
// ============================================================================

/**
 * Magnitude-adaptive label for inline-bar (col_bar) values: ≥100 → integer,
 * ≥10 → one decimal, else two. ONE source shared by the DOM cell
 * (CellBar.svelte) and the SVG export (bar-svg-renderer.ts) so the label can't
 * drift between widget and download.
 */
export function formatBarValue(value: number | undefined | null): string {
  // Non-finite folds into the empty case (defense in depth — callers filter the
  // bar domain, but this is the shared DOM+export source): NaN/±Inf would else
  // reach `.toFixed()` → the literal "NaN"/"Infinity" label string.
  if (value == null || !Number.isFinite(value)) return "";
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/**
 * Get the display text for a column cell, used for width measurement.
 * This must match exactly what's rendered in the cell.
 */
export function getColumnDisplayText(
  row: Row,
  col: { type: string; field: string; options?: ColumnOptions }
): string {
  const { type, field, options } = col;

  switch (type) {
    case "interval": {
      // Get interval values from custom fields or default row properties
      const point = options?.interval?.point
        ? (row.metadata[options.interval.point] as number)
        : row.point;
      const lower = options?.interval?.lower
        ? (row.metadata[options.interval.lower] as number)
        : row.lower;
      const upper = options?.interval?.upper
        ? (row.metadata[options.interval.upper] as number)
        : row.upper;
      return formatInterval(point, lower, upper, options);
    }

    case "custom":
      // Events columns are marked as "custom" with events options
      if (options?.events) {
        return formatEvents(row, options);
      }
      return String(row.metadata[field] ?? "");

    case "pvalue":
      return formatPvalue(row.metadata[field] as number, options);

    case "numeric":
      return formatNumber(row.metadata[field] as number, options);

    case "percent":
      return formatNumber(row.metadata[field] as number, options);

    case "heatmap": {
      const hmValue = row.metadata[field] as number;
      if (hmValue == null || !Number.isFinite(hmValue)) return "";
      const hmDecimals = options?.heatmap?.decimals ?? 2;
      return hmValue.toFixed(safeFixedDigits(hmDecimals));
    }

    case "progress": {
      const progValue = row.metadata[field] as number;
      if (progValue === undefined || progValue === null) return "";
      const progMax = options?.progress?.maxValue ?? 100;
      return `${Math.round(Math.min(100, Math.max(0, (progValue / progMax) * 100)))}%`;
    }

    // Visual column types - these render SVG/visual elements, not text
    // Return empty string so auto-sizing uses header width + visual element min-width
    case "sparkline":
    case "icon":
    case "stars":
    case "img":
    case "range":
      return "";

    // Badge columns contain text that needs measuring (plus padding for pill shape)
    case "badge": {
      const badgeValue = row.metadata[field];
      if (badgeValue === undefined || badgeValue === null) return "";
      // Add padding chars to account for badge pill padding
      return `  ${String(badgeValue)}  `;
    }

    // Bar columns have labels that need measuring (unless showLabel=false)
    case "bar": {
      if (options?.bar?.showLabel === false) return "";
      const barValue = row.metadata[field] as number;
      if (barValue === undefined || barValue === null) return "";
      // ONE source for the bar label (was a re-inlined copy of the ladder).
      return formatBarValue(barValue);
    }

    case "text": {
      const raw = String(row.metadata[field] ?? "");
      return truncateString(raw, options?.text?.maxChars);
    }

    default:
      return String(row.metadata[field] ?? "");
  }
}
