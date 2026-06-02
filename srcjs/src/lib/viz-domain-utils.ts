// Pure domain-computation helpers shared between the live (TabvizPlot)
// and export (svg-generator) viz_* code paths. Browser and V8 both call
// the same functions, so domain math is identical by construction
// (schema-sprint Phase 4d).
//
// Returns `{ min, max }` for a viz column over a set of rows. The
// caller multiplies through to a d3 scale of its choice (linear / log).
// Empty data falls back to `[0, 100]`; explicit axisRange values pin
// their respective ends.

import type { Row, VizBarColumnOptions, VizBoxplotColumnOptions, VizViolinColumnOptions } from "../types";
import { computeBoxplotStats } from "./viz-utils";

export interface VizDomain {
  min: number;
  max: number;
}

/** viz_bar: max-of-effect-values across rows; `Math.min(0, …)` baseline. */
export function computeVizBarDomain(
  rows: readonly Row[],
  options: VizBarColumnOptions,
): VizDomain {
  const min = options.axisRange?.[0];
  const max = options.axisRange?.[1];
  if (min != null && max != null) return { min, max };

  const values: number[] = [];
  for (const row of rows) {
    for (const effect of options.effects) {
      const val = row.metadata[effect.value];
      if (typeof val === "number" && Number.isFinite(val)) values.push(val);
    }
  }
  if (values.length === 0) {
    return { min: min ?? 0, max: max ?? 100 };
  }
  return {
    min: min ?? Math.min(0, ...values),
    max: max ?? Math.max(...values) * 1.1,
  };
}

/** viz_boxplot: min/max of stats per effect (array-data mode) or
 *  per-row min/max (pre-computed-stats mode); 5% pad each side. */
export function computeVizBoxplotDomain(
  rows: readonly Row[],
  options: VizBoxplotColumnOptions,
): VizDomain {
  const min = options.axisRange?.[0];
  const max = options.axisRange?.[1];
  if (min != null && max != null) return { min, max };

  const values: number[] = [];
  for (const row of rows) {
    for (const effect of options.effects) {
      if (effect.data) {
        const data = row.metadata[effect.data] as number[] | undefined;
        if (data && Array.isArray(data)) {
          const stats = computeBoxplotStats(data);
          values.push(stats.min, stats.max);
          if (options.showOutliers !== false) values.push(...stats.outliers);
        }
      } else if (effect.min && effect.max) {
        const lo = row.metadata[effect.min];
        const hi = row.metadata[effect.max];
        if (typeof lo === "number" && Number.isFinite(lo)) values.push(lo);
        if (typeof hi === "number" && Number.isFinite(hi)) values.push(hi);
      }
    }
  }
  if (values.length === 0) {
    return { min: min ?? 0, max: max ?? 100 };
  }
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = dataMax - dataMin;
  return {
    min: min ?? dataMin - range * 0.05,
    max: max ?? dataMax + range * 0.05,
  };
}

/** viz_violin: full distribution min/max + 10% pad for KDE tails. */
export function computeVizViolinDomain(
  rows: readonly Row[],
  options: VizViolinColumnOptions,
): VizDomain {
  const axisMin = options.axisRange?.[0];
  const axisMax = options.axisRange?.[1];
  if (axisMin != null && axisMax != null) return { min: axisMin, max: axisMax };

  const values: number[] = [];
  for (const row of rows) {
    for (const effect of options.effects) {
      const data = row.metadata[effect.data] as number[] | undefined;
      if (data && Array.isArray(data)) {
        values.push(...data.filter((v) => v != null && !Number.isNaN(v)));
      }
    }
  }
  if (values.length === 0) {
    return { min: axisMin ?? 0, max: axisMax ?? 100 };
  }
  // 10% padding on the *data* extent, then axisRange pins win if present.
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = dataMax - dataMin;
  return {
    min: axisMin ?? dataMin - range * 0.1,
    max: axisMax ?? dataMax + range * 0.1,
  };
}
