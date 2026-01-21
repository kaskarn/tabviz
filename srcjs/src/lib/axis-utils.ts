/**
 * Axis computation utilities for forest plots
 *
 * This module provides clean, separated functions for:
 * - computeAxisLimits: Determines where the axis line starts/ends (clipping bounds)
 * - computePlotRegion: Adds margin for marker rendering
 * - generateTicks: Places tick marks within axis limits
 *
 * Key design principle: Clipping boundaries are the AXIS LIMITS, not the plot region.
 * This ensures predictable behavior where marker margins don't shift clipping.
 */

import type { Row, AxisConfig, EffectSpec } from "../types";
import { niceDomain, getEffectValue, NICE_Q } from "./scale-utils";

// Viz column margin (pixels) - space from cell edges for all viz content (axis line, ticks, markers)
// This creates visual separation between adjacent viz columns
export const VIZ_MARGIN = 12;

export interface AxisComputation {
  /** Axis limits - where the axis line starts/ends, also used for clipping */
  axisLimits: [number, number];
  /** Plot region - includes marker margin for rendering */
  plotRegion: [number, number];
  /** Tick positions within axis limits */
  ticks: number[];
}

export interface AxisComputeOptions {
  rows: Row[];
  config: AxisConfig;
  scale: "linear" | "log";
  nullValue: number;
  forestWidth: number;
  pointSize: number;
  effects?: EffectSpec[];  // Additional effects to include in axis calculation
  // Primary effect column names (from col_forest inline definition)
  pointCol?: string | null;
  lowerCol?: string | null;
  upperCol?: string | null;
}

/**
 * Main entry point: compute all axis-related values
 */
export function computeAxis(options: AxisComputeOptions): AxisComputation {
  const { rows, config, scale, nullValue, forestWidth, pointSize, effects = [], pointCol, lowerCol, upperCol } = options;

  // Step 1: Compute axis limits (this is also the clipping boundary)
  const axisLimits = computeAxisLimits(rows, config, scale, nullValue, effects, pointCol, lowerCol, upperCol);

  // Step 2: Compute plot region (axis limits + marker margin)
  const plotRegion = computePlotRegion(
    axisLimits,
    config,
    scale,
    forestWidth,
    pointSize
  );

  // Step 3: Generate ticks within axis limits
  const ticks = generateTicks(axisLimits, config, scale, nullValue);

  return { axisLimits, plotRegion, ticks };
}

/**
 * Compute axis limits from data and configuration
 *
 * Algorithm:
 * 1. If explicit range_min AND range_max provided -> use them directly
 * 2. Extract point estimates (never CI bounds for base range)
 * 3. Include null value if include_null=true
 * 4. Calculate estimate span (with intelligent zero-span handling)
 * 5. Extend for CIs within ci_clip_factor x estimate_span
 * 6. Apply symmetry if symmetric=true
 * 7. Snap to nice numbers for clean ticks
 */
export function computeAxisLimits(
  rows: Row[],
  config: AxisConfig,
  scale: "linear" | "log",
  nullValue: number,
  effects: EffectSpec[] = [],
  pointCol?: string | null,
  lowerCol?: string | null,
  upperCol?: string | null
): [number, number] {
  // Priority 1: Explicit limits override everything
  const hasExplicitMin = config.rangeMin != null;
  const hasExplicitMax = config.rangeMax != null;

  if (hasExplicitMin && hasExplicitMax) {
    return [config.rangeMin!, config.rangeMax!];
  }

  // Step 2: Collect point estimates from primary effect AND all additional effects
  const pointEstimates: number[] = [];
  const isLog = scale === "log";

  // Determine primary column name - use passed column name or fall back to "point"
  const primaryPointColName = pointCol || "point";

  for (const row of rows) {
    // Primary effect - use the actual column name from forest options
    const primaryPoint = getEffectValue(row.metadata, undefined, primaryPointColName, "point", isLog);
    if (primaryPoint != null) {
      pointEstimates.push(primaryPoint);
    }
    // Additional effects
    for (const effect of effects) {
      const val = getEffectValue(row.metadata, undefined, effect.pointCol, "point", isLog);
      if (val != null) {
        pointEstimates.push(val);
      }
    }
  }

  if (pointEstimates.length === 0) {
    // Fallback when no valid estimates
    return scale === "log" ? [0.1, 10] : [-1, 1];
  }

  let rawMinEst = Math.min(...pointEstimates);
  let rawMaxEst = Math.max(...pointEstimates);

  // Step 3: Include null value if configured (default: true)
  const includeNull = config.includeNull ?? true;
  if (includeNull) {
    rawMinEst = Math.min(rawMinEst, nullValue);
    rawMaxEst = Math.max(rawMaxEst, nullValue);
  }

  // Save core estimate range for symmetric calculation
  const coreMin = rawMinEst;
  const coreMax = rawMaxEst;

  // Step 4: Handle zero/small span edge case
  let estimateSpan: number;
  if (isLog) {
    const safeMin = Math.max(rawMinEst, 0.001);
    const safeMax = Math.max(rawMaxEst, 0.001);
    estimateSpan = Math.log(safeMax) - Math.log(safeMin);
  } else {
    estimateSpan = rawMaxEst - rawMinEst;
  }

  if (estimateSpan === 0 || !Number.isFinite(estimateSpan)) {
    // All estimates identical - create reasonable spread
    const estimate = pointEstimates[0];
    if (isLog) {
      return niceDomain([estimate / 2, estimate * 2], true);
    } else {
      const spread = Math.max(1, Math.abs(estimate) * 0.1);
      return niceDomain([estimate - spread, estimate + spread], false);
    }
  }

  // Step 5: Snap estimate range to nice numbers BEFORE calculating clip boundaries
  // This ensures clip boundaries align with the final axis limits
  const [niceMinEst, niceMaxEst] = niceDomain([rawMinEst, rawMaxEst], isLog);

  // Step 6: Calculate clip boundaries from nice-rounded estimate range
  //
  // ci_clip_factor semantics:
  // - For LOG scale: direct ratio multiplier
  //   ci_clip_factor=3 means CIs can extend up to 3x beyond estimate bounds
  //   Lower limit = niceMinEst / ci_clip_factor
  //   Upper limit = niceMaxEst * ci_clip_factor
  //
  // - For LINEAR scale: span multiplier
  //   ci_clip_factor=2 means CIs can extend up to 2x the estimate span
  //   Lower limit = niceMinEst - span * ci_clip_factor
  //   Upper limit = niceMaxEst + span * ci_clip_factor
  //
  const ciClipFactor = config.ciClipFactor ?? 2.0;

  // Use nice-rounded values for clip boundary calculation
  let minEst = niceMinEst;
  let maxEst = niceMaxEst;

  // Collect CI bounds from primary effect AND all additional effects
  const lowerBounds: number[] = [];
  const upperBounds: number[] = [];

  // Determine primary column names - use passed column names or fall back to defaults
  const primaryLowerColName = lowerCol || "lower";
  const primaryUpperColName = upperCol || "upper";

  for (const row of rows) {
    // Primary effect - use the actual column names from forest options
    const primaryLower = getEffectValue(row.metadata, undefined, primaryLowerColName, "lower", isLog);
    if (primaryLower != null) {
      lowerBounds.push(primaryLower);
    }
    const primaryUpper = getEffectValue(row.metadata, undefined, primaryUpperColName, "upper", isLog);
    if (primaryUpper != null) {
      upperBounds.push(primaryUpper);
    }
    // Additional effects
    for (const effect of effects) {
      const lower = getEffectValue(row.metadata, undefined, effect.lowerCol, "lower", isLog);
      if (lower != null) {
        lowerBounds.push(lower);
      }
      const upper = getEffectValue(row.metadata, undefined, effect.upperCol, "upper", isLog);
      if (upper != null) {
        upperBounds.push(upper);
      }
    }
  }

  // Compute clip boundaries
  let lowerClipBound: number;
  let upperClipBound: number;

  if (isLog) {
    // Log scale: ci_clip_factor is a direct ratio multiplier
    // e.g., ci_clip_factor=3 means allow 3x beyond estimates
    lowerClipBound = minEst / ciClipFactor;
    upperClipBound = maxEst * ciClipFactor;
  } else {
    // Linear scale: ci_clip_factor is a span multiplier
    const span = maxEst - minEst;
    lowerClipBound = minEst - span * ciClipFactor;
    upperClipBound = maxEst + span * ciClipFactor;
  }

  // Track whether any CIs are clipped
  let hasClippedLower = false;
  let hasClippedUpper = false;

  for (const lb of lowerBounds) {
    if (lb >= lowerClipBound) {
      minEst = Math.min(minEst, lb);
    } else {
      hasClippedLower = true;
    }
  }
  for (const ub of upperBounds) {
    if (ub <= upperClipBound) {
      maxEst = Math.max(maxEst, ub);
    } else {
      hasClippedUpper = true;
    }
  }

  // If any CI is clipped, extend axis to clip boundary for arrow visibility
  if (hasClippedLower) {
    minEst = Math.min(minEst, lowerClipBound);
  }
  if (hasClippedUpper) {
    maxEst = Math.max(maxEst, upperClipBound);
  }

  // Step 8: Apply symmetry if explicitly requested
  const symmetric = config.symmetric === true;
  if (symmetric && !hasExplicitMin && !hasExplicitMax) {
    if (scale === "log") {
      // Log scale: geometric symmetry around null
      const logNull = Math.log(nullValue);
      const maxLogDist = Math.max(
        Math.abs(Math.log(Math.max(coreMin, 0.001)) - logNull),
        Math.abs(Math.log(coreMax) - logNull)
      );
      minEst = Math.exp(logNull - maxLogDist);
      maxEst = Math.exp(logNull + maxLogDist);
    } else {
      // Linear scale: arithmetic symmetry
      const maxDist = Math.max(
        Math.abs(coreMin - nullValue),
        Math.abs(coreMax - nullValue)
      );
      minEst = nullValue - maxDist;
      maxEst = nullValue + maxDist;
    }
  }

  // Step 9: Apply explicit single-sided overrides if provided
  let finalMin = hasExplicitMin ? config.rangeMin! : minEst;
  let finalMax = hasExplicitMax ? config.rangeMax! : maxEst;

  // Step 10: Final snap to nice numbers (minimal effect since we started from nice values)
  return niceDomain([finalMin, finalMax], scale === "log");
}

/**
 * Compute plot region by adding marker margin to axis limits
 *
 * The plot region extends slightly beyond axis limits so that
 * markers at the edges don't get clipped visually.
 */
export function computePlotRegion(
  axisLimits: [number, number],
  config: AxisConfig,
  scale: "linear" | "log",
  forestWidth: number,
  pointSize: number
): [number, number] {
  const plotMargin = config.markerMargin ?? true;

  if (!plotMargin || forestWidth <= 0) {
    return axisLimits;
  }

  const pixelRange = forestWidth - 2 * VIZ_MARGIN;
  if (pixelRange <= 0) {
    return axisLimits;
  }

  if (scale === "log") {
    // For log scale, work in log space
    // The pixel-to-domain ratio is based on log range, not linear range
    const logMin = Math.log(Math.max(axisLimits[0], 0.001));
    const logMax = Math.log(Math.max(axisLimits[1], 0.001));
    const logRange = logMax - logMin;

    // Convert half-marker-width from pixels to log units
    const marginInLogUnits = (pointSize / 2) * (logRange / pixelRange);

    // Expand symmetrically in log space (which is multiplicative in linear space)
    // Cap expansion to avoid extreme values
    const cappedMargin = Math.min(marginInLogUnits, 0.5);  // Cap at ~1.65x expansion
    return [
      Math.exp(logMin - cappedMargin),
      Math.exp(logMax + cappedMargin),
    ];
  }

  // Linear scale: additive margin
  const domainRange = axisLimits[1] - axisLimits[0];
  const marginInDomainUnits = (pointSize / 2) * (domainRange / pixelRange);

  return [
    axisLimits[0] - marginInDomainUnits,
    axisLimits[1] + marginInDomainUnits,
  ];
}

/**
 * Generate tick positions within axis limits
 *
 * Priority:
 * 1. Explicit tickValues (filtered to axis bounds)
 * 2. Auto-generate using Extended Wilkinson algorithm
 * 3. Ensure null tick is included if configured
 */
export function generateTicks(
  axisLimits: [number, number],
  config: AxisConfig,
  scale: "linear" | "log",
  nullValue: number
): number[] {
  const [min, max] = axisLimits;
  const nullInRange = nullValue >= min && nullValue <= max;
  const shouldIncludeNullTick = (config.nullTick ?? true) && nullInRange;

  // Priority 1: Explicit tick values
  if (config.tickValues && config.tickValues.length > 0) {
    let ticks = config.tickValues.filter((t) => t >= min && t <= max);

    // Ensure null tick if configured
    if (shouldIncludeNullTick && !ticks.includes(nullValue)) {
      ticks = [...ticks, nullValue].sort((a, b) => a - b);
    }

    return ticks;
  }

  // Priority 2: Auto-generate ticks
  const targetCount = config.tickCount ?? 5;
  let ticks =
    scale === "log"
      ? computeLogTicks(axisLimits, targetCount)
      : computeLinearTicks(axisLimits, targetCount);

  // Priority 3: Ensure null tick
  if (shouldIncludeNullTick && !ticks.includes(nullValue)) {
    ticks = [...ticks, nullValue].sort((a, b) => a - b);
  }

  return ticks;
}

/**
 * Compute linear scale ticks using Extended Wilkinson algorithm
 */
function computeLinearTicks(
  axisLimits: [number, number],
  targetCount: number
): number[] {
  const [min, max] = axisLimits;
  const range = max - min;

  if (range === 0) {
    return [min];
  }

  // Find step size that gives ~targetCount ticks
  const rawStep = range / Math.max(targetCount - 1, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));

  // Find best step from Q sequence
  let bestStep = magnitude;
  let bestScore = Infinity;

  for (const q of NICE_Q) {
    const step = q * magnitude;
    const count = Math.floor(range / step) + 1;
    const score = Math.abs(count - targetCount);
    if (score < bestScore) {
      bestScore = score;
      bestStep = step;
    }

    // Also try q * magnitude / 10 for finer steps
    const fineStep = (q * magnitude) / 10;
    if (fineStep > 0) {
      const fineCount = Math.floor(range / fineStep) + 1;
      const fineScore = Math.abs(fineCount - targetCount);
      if (fineScore < bestScore) {
        bestScore = fineScore;
        bestStep = fineStep;
      }
    }
  }

  // Generate ticks
  const start = Math.ceil(min / bestStep) * bestStep;
  const ticks: number[] = [];

  for (let tick = start; tick <= max + bestStep * 0.001; tick += bestStep) {
    // Round to fix floating point precision
    const rounded = Math.round(tick * 1e10) / 1e10;
    if (rounded >= min && rounded <= max) {
      ticks.push(rounded);
    }
  }

  // Ensure at least 2 ticks
  if (ticks.length < 2) {
    if (!ticks.includes(min)) ticks.unshift(min);
    if (!ticks.includes(max)) ticks.push(max);
  }

  return ticks;
}

/**
 * Compute log scale ticks
 *
 * Uses predefined nice values common in forest plots (0.5, 1, 2, etc.)
 */
function computeLogTicks(
  axisLimits: [number, number],
  targetCount: number
): number[] {
  const [min, max] = axisLimits;

  // Nice values for log scale (common in forest plots)
  const niceLogValues = [
    0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
    1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20,
    25, 30, 40, 50, 75, 100, 150, 200, 500, 1000,
  ];

  // Filter to values within range
  const inRange = niceLogValues.filter((v) => v >= min && v <= max);

  if (inRange.length <= targetCount) {
    return inRange;
  }

  // Subsample to get approximately targetCount ticks
  // Prioritize 1 (null for ratios), then powers of 10, then 0.5, 2, 5
  const priority = [1, 0.1, 10, 100, 0.5, 2, 5, 0.2, 0.25, 1.5, 3, 4, 20, 50];

  const selected: number[] = [];
  for (const p of priority) {
    if (inRange.includes(p) && selected.length < targetCount) {
      selected.push(p);
    }
  }

  // Fill remaining slots with evenly spaced values
  if (selected.length < targetCount) {
    const remaining = inRange.filter((v) => !selected.includes(v));
    const step = Math.max(1, Math.floor(remaining.length / (targetCount - selected.length)));
    for (let i = 0; i < remaining.length && selected.length < targetCount; i += step) {
      selected.push(remaining[i]);
    }
  }

  return selected.sort((a, b) => a - b);
}

/**
 * Check if a CI bound is clipped (extends beyond axis limits)
 */
export function isClipped(
  value: number,
  axisLimits: [number, number]
): "left" | "right" | null {
  if (value < axisLimits[0]) return "left";
  if (value > axisLimits[1]) return "right";
  return null;
}

/**
 * Clamp a value to axis limits
 */
export function clampToAxis(value: number, axisLimits: [number, number]): number {
  return Math.max(axisLimits[0], Math.min(axisLimits[1], value));
}
