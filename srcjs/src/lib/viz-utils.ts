/**
 * Statistical utilities for viz column types (boxplot, violin)
 */

import type { BoxplotStats, KDEResult } from "$types";

/**
 * Compute quartiles and summary statistics for boxplot
 * Uses linear interpolation method (same as R's quantile type 7)
 */
export function computeQuartiles(values: number[]): Omit<BoxplotStats, "outliers"> {
  if (!values || values.length === 0) {
    return { min: NaN, q1: NaN, median: NaN, q3: NaN, max: NaN };
  }

  // Filter out NaN/null values and sort
  const sorted = values
    .filter((v) => v != null && !Number.isNaN(v))
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return { min: NaN, q1: NaN, median: NaN, q3: NaN, max: NaN };
  }

  const n = sorted.length;

  // Helper for linear interpolation quantile (type 7 in R)
  const quantile = (p: number): number => {
    if (n === 1) return sorted[0];
    const h = (n - 1) * p;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  };

  return {
    min: sorted[0],
    q1: quantile(0.25),
    median: quantile(0.5),
    q3: quantile(0.75),
    max: sorted[n - 1],
  };
}

/**
 * Compute outliers using IQR method (1.5 * IQR beyond Q1/Q3)
 */
export function computeOutliers(
  values: number[],
  q1: number,
  q3: number
): number[] {
  if (!values || values.length === 0 || Number.isNaN(q1) || Number.isNaN(q3)) {
    return [];
  }

  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  return values.filter(
    (v) =>
      v != null && !Number.isNaN(v) && (v < lowerFence || v > upperFence)
  );
}

/**
 * Compute full boxplot statistics from raw values
 */
export function computeBoxplotStats(values: number[]): BoxplotStats {
  const quartiles = computeQuartiles(values);
  const outliers = computeOutliers(values, quartiles.q1, quartiles.q3);

  return {
    ...quartiles,
    outliers,
  };
}

/**
 * Silverman's rule of thumb for KDE bandwidth selection
 * h = 0.9 * min(σ, IQR/1.34) * n^(-1/5)
 */
export function silvermanBandwidth(values: number[]): number {
  if (!values || values.length < 2) return 1;

  const sorted = values
    .filter((v) => v != null && !Number.isNaN(v))
    .sort((a, b) => a - b);

  if (sorted.length < 2) return 1;

  const n = sorted.length;

  // Standard deviation
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);

  // IQR
  const q1Idx = Math.floor((n - 1) * 0.25);
  const q3Idx = Math.floor((n - 1) * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];
  const iqr = q3 - q1;

  // Silverman's rule
  const spread = Math.min(std, iqr / 1.34);
  const bandwidth = 0.9 * spread * Math.pow(n, -0.2);

  return Math.max(bandwidth, 0.001); // Avoid zero bandwidth
}

/**
 * Gaussian kernel function
 */
function gaussianKernel(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Compute Kernel Density Estimation (KDE) for violin plots
 * Returns density values at evenly spaced points across the data range
 *
 * @param values - Raw data values
 * @param bandwidth - KDE bandwidth (null = use Silverman's rule)
 * @param nPoints - Number of evaluation points (default 128)
 */
export function computeKDE(
  values: number[],
  bandwidth?: number | null,
  nPoints = 128
): KDEResult {
  if (!values || values.length === 0) {
    return { x: [], y: [] };
  }

  // Filter valid values
  const data = values.filter((v) => v != null && !Number.isNaN(v));

  if (data.length === 0) {
    return { x: [], y: [] };
  }

  // Use provided bandwidth or compute using Silverman's rule
  const h = bandwidth ?? silvermanBandwidth(data);

  // Determine range with padding (extend by 3 bandwidths on each side)
  const min = Math.min(...data);
  const max = Math.max(...data);
  const padding = 3 * h;
  const rangeMin = min - padding;
  const rangeMax = max + padding;

  // Generate evaluation points
  const step = (rangeMax - rangeMin) / (nPoints - 1);
  const x: number[] = [];
  const y: number[] = [];

  for (let i = 0; i < nPoints; i++) {
    const xi = rangeMin + i * step;
    x.push(xi);

    // Compute density at this point
    let density = 0;
    for (const d of data) {
      density += gaussianKernel((xi - d) / h);
    }
    density /= data.length * h;
    y.push(density);
  }

  return { x, y };
}

/**
 * Normalize KDE density values to a maximum width
 * Useful for rendering violins at a consistent scale
 */
export function normalizeKDE(kde: KDEResult, maxWidth: number): KDEResult {
  if (kde.y.length === 0) return kde;

  const maxDensity = Math.max(...kde.y);
  if (maxDensity === 0) return kde;

  const normalizedY = kde.y.map((v) => (v / maxDensity) * maxWidth);

  return {
    x: kde.x,
    y: normalizedY,
  };
}

/**
 * Convert KDE result to SVG path for violin plot (mirrored)
 * Creates a path that goes down the right side and up the left side
 */
export function kdeToViolinPath(
  kde: KDEResult,
  xScale: (value: number) => number,
  yCenter: number,
  maxWidth: number
): string {
  if (kde.x.length < 2) return "";

  // Normalize densities to max width
  const normalized = normalizeKDE(kde, maxWidth / 2);

  // Build path: right side (top to bottom), then left side (bottom to top)
  const points: string[] = [];

  // Right side (positive y offset from center)
  for (let i = 0; i < normalized.x.length; i++) {
    const x = xScale(normalized.x[i]);
    const y = yCenter + normalized.y[i];
    points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }

  // Left side (negative y offset, reversed order)
  for (let i = normalized.x.length - 1; i >= 0; i--) {
    const x = xScale(normalized.x[i]);
    const y = yCenter - normalized.y[i];
    points.push(`L ${x} ${y}`);
  }

  points.push("Z"); // Close path

  return points.join(" ");
}
