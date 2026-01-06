/**
 * Shared formatting functions for forest plot column rendering.
 * Used by both web (ForestPlot.svelte) and SVG (svg-generator.ts) renderers.
 */

import type { ColumnOptions, Row } from "../types";

// ============================================================================
// Helper Functions
// ============================================================================

/** Add thousands separator to a number string */
export function addThousandsSep(numStr: string, separator: string): string {
  const parts = numStr.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return parts.join(".");
}

/** Abbreviate large numbers: 1234567 -> "1.2M", 5300 -> "5.3K" */
export function abbreviateNumber(value: number, sigfigs: number = 2): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 1e9) {
    return sign + (absValue / 1e9).toPrecision(sigfigs) + "B";
  }
  if (absValue >= 1e6) {
    return sign + (absValue / 1e6).toPrecision(sigfigs) + "M";
  }
  if (absValue >= 1e3) {
    return sign + (absValue / 1e3).toPrecision(sigfigs) + "K";
  }
  return value.toPrecision(sigfigs);
}

/** Unicode superscript character mapping */
const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "-": "⁻", "+": "⁺",
};

/** Convert string to Unicode superscript */
function toSuperscript(str: string): string {
  return str.split("").map(c => SUPERSCRIPT_MAP[c] ?? c).join("");
}

// ============================================================================
// Column Formatters
// ============================================================================

/** Format number for display - respects column options */
export function formatNumber(value: number | undefined | null, options?: ColumnOptions): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return options?.naText ?? "";
  }

  // Percent formatting
  if (options?.percent) {
    const { decimals = 1, multiply = false, symbol = true } = options.percent;
    const displayValue = multiply ? value * 100 : value;
    const formatted = displayValue.toFixed(decimals);
    return symbol ? `${formatted}%` : formatted;
  }

  // Handle abbreviation for large numbers
  const abbreviate = options?.numeric?.abbreviate;
  if (abbreviate && Math.abs(value) >= 1000) {
    const sigfigs = typeof abbreviate === "number" ? abbreviate : 2;
    return abbreviateNumber(value, sigfigs);
  }

  // Use significant figures if digits specified
  const digits = options?.numeric?.digits;
  if (digits !== undefined && digits !== null) {
    const formatted = value.toPrecision(digits);
    const thousandsSep = options?.numeric?.thousandsSep;
    if (thousandsSep && typeof thousandsSep === "string") {
      return addThousandsSep(formatted, thousandsSep);
    }
    return formatted;
  }

  // Numeric formatting with decimals and thousands separator
  const decimals = options?.numeric?.decimals;
  const thousandsSep = options?.numeric?.thousandsSep;
  let formatted: string;

  if (decimals !== undefined) {
    formatted = value.toFixed(decimals);
  } else if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 0.0001) {
    // Default behavior: integers show no decimals, others show 2
    formatted = Math.round(value).toString();
  } else {
    formatted = value.toFixed(2);
  }

  // Apply thousands separator if specified
  if (thousandsSep && typeof thousandsSep === "string") {
    formatted = addThousandsSep(formatted, thousandsSep);
  }

  return formatted;
}

/** Format events column (events/n) */
export function formatEvents(row: Row, options: ColumnOptions): string {
  const { eventsField, nField, separator = "/", showPct = false, thousandsSep, abbreviate } = options.events!;
  const events = row.metadata[eventsField];
  const n = row.metadata[nField];

  if (events === undefined || events === null || n === undefined || n === null) {
    return options.naText ?? "";
  }

  const eventsNum = Number(events);
  const nNum = Number(n);
  let eventsStr: string;
  let nStr: string;

  // Handle abbreviation for large numbers
  if (abbreviate && (eventsNum >= 1000 || nNum >= 1000)) {
    const sigfigs = typeof abbreviate === "number" ? abbreviate : 2;
    eventsStr = eventsNum >= 1000 ? abbreviateNumber(eventsNum, sigfigs) : String(eventsNum);
    nStr = nNum >= 1000 ? abbreviateNumber(nNum, sigfigs) : String(nNum);
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
  if (point === undefined || point === null || Number.isNaN(point)) return "";

  const decimals = options?.interval?.decimals ?? 2;
  const sep = options?.interval?.sep ?? " ";
  const impreciseThreshold = options?.interval?.impreciseThreshold;

  if (lower === undefined || lower === null || upper === undefined || upper === null ||
      Number.isNaN(lower) || Number.isNaN(upper)) {
    return point.toFixed(decimals);
  }

  // Check for imprecise estimate (CI ratio exceeds threshold)
  if (impreciseThreshold != null && lower > 0 && upper / lower > impreciseThreshold) {
    return "—";
  }

  return `${point.toFixed(decimals)}${sep}(${lower.toFixed(decimals)}, ${upper.toFixed(decimals)})`;
}

/** Format p-value for display with Unicode superscript notation */
export function formatPvalue(value: number | undefined | null, options?: ColumnOptions): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
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

  // Use scientific notation with Unicode superscript for small values
  if (format === "scientific" || (format === "auto" && value < expThreshold)) {
    const exp = Math.floor(Math.log10(value));
    const mantissa = value / Math.pow(10, exp);
    const mantissaStr = mantissa.toPrecision(digits);
    return `${mantissaStr}×10${toSuperscript(exp.toString())}${starStr}`;
  }

  // Decimal format with appropriate precision based on magnitude
  let formatted: string;
  if (value >= 0.1) formatted = value.toFixed(digits);
  else if (value >= 0.01) formatted = value.toFixed(digits + 1);
  else formatted = value.toFixed(digits + 2);

  return `${formatted}${starStr}`;
}

// ============================================================================
// Display Text Extraction (for width measurement)
// ============================================================================

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

    // Visual column types - these render SVG/visual elements, not text
    // Return empty string so auto-sizing uses header width + visual element min-width
    case "sparkline":
    case "icon":
    case "badge":
    case "stars":
    case "img":
    case "range":
      return "";

    // Bar columns have labels that need measuring (unless showLabel=false)
    case "bar": {
      if (options?.bar?.showLabel === false) return "";
      const barValue = row.metadata[field] as number;
      if (barValue === undefined || barValue === null) return "";
      // Match CellBar.svelte label formatting
      if (barValue >= 100) return barValue.toFixed(0);
      if (barValue >= 10) return barValue.toFixed(1);
      return barValue.toFixed(2);
    }

    case "text":
    default:
      return String(row.metadata[field] ?? "");
  }
}
