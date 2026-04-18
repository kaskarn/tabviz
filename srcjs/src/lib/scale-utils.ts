/**
 * Shared scale utilities for forest plots
 *
 * These functions are used by both the web-native Svelte renderer
 * and the pure-data SVG generator to ensure consistent axis scaling.
 */

/** Extended Wilkinson Q sequence for "nice" tick values */
export const NICE_Q = [1, 5, 2, 2.5, 4, 3];

// Extended nice values for log scale - covers typical forest plot ranges
// Includes very small values (early phase trials) and large values (rare events)
const NICE_LOG_VALUES = [
  0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5,
  0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 7,
  8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500, 750, 1000,
];

/**
 * Round a domain to "nice" round numbers (similar to D3's scale.nice())
 * This makes axis ticks fall on round values like 0.5, 1, 2, 5, 10, etc.
 *
 * Uses the Extended Wilkinson algorithm approach for linear scales,
 * and predefined nice values for log scales (common in forest plots).
 *
 * @param domain - The [min, max] domain to round
 * @param isLog - Whether this is for a log scale
 * @returns A new domain with nice round bounds
 */
export function niceDomain(
  domain: [number, number],
  isLog: boolean
): [number, number] {
  if (isLog) {
    return niceLogDomain(domain);
  }
  return niceLinearDomain(domain);
}

/**
 * Compute nice bounds for log scale using predefined nice values
 */
function niceLogDomain(domain: [number, number]): [number, number] {
  // Handle edge cases
  if (domain[0] <= 0 || domain[1] <= 0) {
    return [0.1, 10]; // Fallback for invalid log domain
  }
  if (domain[0] >= domain[1]) {
    return domain;
  }

  // Find nice min (largest nice value <= domain min)
  let niceMin = NICE_LOG_VALUES[0];
  for (const val of NICE_LOG_VALUES) {
    if (val <= domain[0]) {
      niceMin = val;
    } else {
      break;
    }
  }

  // Handle values smaller than our nice list
  if (domain[0] < NICE_LOG_VALUES[0]) {
    // Extend using powers of 10
    const magnitude = Math.pow(10, Math.floor(Math.log10(domain[0])));
    niceMin = magnitude;
  }

  // Find nice max (smallest nice value >= domain max)
  let niceMax = NICE_LOG_VALUES[NICE_LOG_VALUES.length - 1];
  for (let i = NICE_LOG_VALUES.length - 1; i >= 0; i--) {
    if (NICE_LOG_VALUES[i] >= domain[1]) {
      niceMax = NICE_LOG_VALUES[i];
    } else {
      break;
    }
  }

  // Handle values larger than our nice list
  if (domain[1] > NICE_LOG_VALUES[NICE_LOG_VALUES.length - 1]) {
    // Extend using powers of 10
    const magnitude = Math.pow(10, Math.ceil(Math.log10(domain[1])));
    niceMax = magnitude;
  }

  return [niceMin, niceMax];
}

/**
 * Compute nice bounds for linear scale using Extended Wilkinson approach
 */
function niceLinearDomain(domain: [number, number]): [number, number] {
  const span = domain[1] - domain[0];

  // Handle edge cases
  if (span === 0) {
    return domain;
  }
  if (span < 0) {
    return [domain[1], domain[0]]; // Swap if inverted
  }

  // Find a nice step size using Q sequence
  const magnitude = Math.pow(10, Math.floor(Math.log10(span)));
  let bestStep = magnitude;
  let bestScore = Infinity;

  // Try each Q value at current and adjacent magnitudes
  for (const q of NICE_Q) {
    for (const scale of [0.1, 1, 10]) {
      const step = q * magnitude * scale;
      if (step <= 0) continue;

      const candidateMin = Math.floor(domain[0] / step) * step;
      const candidateMax = Math.ceil(domain[1] / step) * step;
      const candidateSpan = candidateMax - candidateMin;

      // Score: prefer steps that don't expand the domain too much
      const expansion = candidateSpan / span - 1;
      if (expansion >= 0 && expansion < bestScore) {
        bestScore = expansion;
        bestStep = step;
      }
    }
  }

  const niceMin = Math.floor(domain[0] / bestStep) * bestStep;
  const niceMax = Math.ceil(domain[1] / bestStep) * bestStep;

  // Round to fix floating point precision issues
  return [
    Math.round(niceMin * 1e10) / 1e10,
    Math.round(niceMax * 1e10) / 1e10,
  ];
}

/** Domain padding constant - how much extra space to add beyond data range */
export const DOMAIN_PADDING = 0.08;

/** Scale type used by bar / progress / heatmap cells to map values into [0, 1] */
export type NormalizeScale = "linear" | "log" | "sqrt";

/**
 * Normalize a numeric value to a clamped [0, 1] ratio given a [lo, hi] domain
 * and a scale type. Mirrors the logic shared between Svelte cells and the
 * SVG exporter so they can't drift.
 *
 * - linear: (v - lo) / (hi - lo)
 * - log:    log(v) normalized over log(hi) - log(lo); non-positive values
 *           collapse to 0 (log undefined), lo <= 0 is clamped to a tiny
 *           positive value so log(lo) is defined.
 * - sqrt:   sqrt(max(0, v - lo)) normalized over sqrt(hi - lo).
 *
 * If hi <= lo, returns 0 (degenerate range).
 * If value is not finite, returns 0.
 */
export function normalizeValue(
  value: number | null | undefined,
  lo: number,
  hi: number,
  scale: NormalizeScale = "linear"
): number {
  if (value == null || !Number.isFinite(value)) return 0;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return 0;

  if (scale === "log") {
    const safeLo = lo > 0 ? lo : 1e-12;
    if (value <= 0) return 0;
    const num = Math.log(value) - Math.log(safeLo);
    const den = Math.log(hi) - Math.log(safeLo);
    if (den <= 0) return 0;
    return clamp01(num / den);
  }

  if (scale === "sqrt") {
    const shifted = Math.max(0, value - lo);
    const span = hi - lo;
    if (span <= 0) return 0;
    return clamp01(Math.sqrt(shifted) / Math.sqrt(span));
  }

  return clamp01((value - lo) / (hi - lo));
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Get a numeric value from a row, checking metadata first then primary fields.
 *
 * For additional effects, values are stored in row.metadata keyed by column name.
 * For the primary effect, values are in row.point/lower/upper.
 *
 * @param metadata - The row's metadata object
 * @param primaryValue - The primary field value (row.point, row.lower, or row.upper)
 * @param colName - The column name to look up
 * @param primaryFieldName - The name of the primary field ("point", "lower", or "upper")
 * @param isLog - Whether this is a log scale (filters out non-positive values)
 * @returns The numeric value or null if not found/invalid
 */
export function getEffectValue(
  metadata: Record<string, unknown>,
  primaryValue: number | null | undefined,
  colName: string,
  primaryFieldName: "point" | "lower" | "upper",
  isLog: boolean = false
): number | null {
  // Check metadata first (for additional effects)
  if (metadata && colName in metadata) {
    const val = metadata[colName];
    if (typeof val === "number" && Number.isFinite(val) && (!isLog || val > 0)) {
      return val;
    }
  }

  // Fall back to primary field only if colName matches the field name
  // This ensures we don't accidentally use primary values for different effects
  if (colName === primaryFieldName && primaryValue != null && Number.isFinite(primaryValue)) {
    if (!isLog || primaryValue > 0) {
      return primaryValue;
    }
  }

  return null;
}
