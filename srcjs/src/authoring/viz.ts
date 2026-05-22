/**
 * Visualization-column builders — TS mirror of R's `viz_forest()`,
 * `viz_bar()`, `viz_boxplot()`, `viz_violin()`, the `effect_*()` helpers,
 * and `refline()`.
 *
 * Forest plots use `vizForest({ point, lower, upper })` for the common
 * single-effect case; pass `effects` for multi-effect overlays. `vizBar` /
 * `vizBoxplot` / `vizViolin` take an `effects: [...]` array of
 * `effectBar` / `effectBoxplot` / `effectViolin` objects.
 */

import type {
  ColumnSpec, EffectSpec, ReferenceLine, Annotation,
  ForestColumnOptions, VizBarColumnOptions, VizBoxplotColumnOptions, VizViolinColumnOptions,
  VizBarEffect, VizBoxplotEffect, VizViolinEffect,
  MarkerShape,
} from "../types";
import { baseColumn, type CommonColumnArgs } from "./columns";

// ────────────────────────────────────────────────────────────────────
// Effect constructors
// ────────────────────────────────────────────────────────────────────

let _effectSeq = 0;
const nextEffectId = (prefix: string) => `${prefix}_${++_effectSeq}`;

export interface EffectForestArgs {
  point: string;
  lower: string;
  upper: string;
  id?: string;
  label?: string;
  color?: string;
  shape?: MarkerShape;
  opacity?: number;
}

export function effectForest(args: EffectForestArgs): EffectSpec {
  return {
    id: args.id ?? nextEffectId("forest"),
    pointCol: args.point,
    lowerCol: args.lower,
    upperCol: args.upper,
    label: args.label ?? null,
    color: args.color ?? null,
    shape: args.shape ?? null,
    opacity: args.opacity ?? null,
  };
}

export interface EffectBarArgs {
  value: string;
  label?: string;
  color?: string;
  opacity?: number;
}

export const effectBar = (args: EffectBarArgs): VizBarEffect => ({
  value: args.value,
  label: args.label ?? null,
  color: args.color ?? null,
  opacity: args.opacity ?? null,
});

export interface EffectBoxplotArgs {
  data?: string;
  min?: string;
  q1?: string;
  median?: string;
  q3?: string;
  max?: string;
  outliers?: string;
  label?: string;
  color?: string;
  opacity?: number;
}

export const effectBoxplot = (args: EffectBoxplotArgs): VizBoxplotEffect => ({
  data: args.data ?? null,
  min: args.min ?? null,
  q1: args.q1 ?? null,
  median: args.median ?? null,
  q3: args.q3 ?? null,
  max: args.max ?? null,
  outliers: args.outliers ?? null,
  label: args.label ?? null,
  color: args.color ?? null,
  opacity: args.opacity ?? null,
});

export interface EffectViolinArgs {
  data: string;
  label?: string;
  color?: string;
  opacity?: number;
}

export const effectViolin = (args: EffectViolinArgs): VizViolinEffect => ({
  data: args.data,
  label: args.label ?? null,
  color: args.color ?? null,
  opacity: args.opacity ?? 0.5,
});

// ────────────────────────────────────────────────────────────────────
// Annotation: reference line
// ────────────────────────────────────────────────────────────────────

let _reflineSeq = 0;

export interface ReflineArgs {
  /** Position on the x-axis. */
  x: number;
  /** Optional label rendered above the line. */
  label?: string;
  /** Line style. Default "dashed". */
  style?: "solid" | "dashed" | "dotted";
  color?: string;
  width?: number;
  opacity?: number;
  id?: string;
}

export function refline(args: ReflineArgs): ReferenceLine {
  return {
    type: "reference_line",
    id: args.id ?? `refline_${++_reflineSeq}`,
    x: args.x,
    label: args.label,
    style: args.style ?? "dashed",
    color: args.color,
    width: args.width,
    opacity: args.opacity,
  };
}

// ────────────────────────────────────────────────────────────────────
// viz_forest
// ────────────────────────────────────────────────────────────────────

export interface VizForestArgs extends CommonColumnArgs {
  /** Single-effect: column name for point estimate. */
  point?: string;
  /** Single-effect: column name for lower bound. */
  lower?: string;
  /** Single-effect: column name for upper bound. */
  upper?: string;
  /** Multi-effect: array of EffectSpec from `effectForest({...})`. */
  effects?: EffectSpec[];
  scale?: "linear" | "log";
  /** Reference-line value. Default: 0 for linear, 1 for log. */
  nullValue?: number;
  axisLabel?: string;
  axisRange?: [number, number] | null;
  axisTicks?: number[] | null;
  axisGridlines?: boolean;
  showAxis?: boolean;
  annotations?: Annotation[];
  sharedAxis?: boolean | null;
}

export function vizForest({
  point, lower, upper, effects,
  scale = "linear",
  nullValue,
  axisLabel = "Effect",
  axisRange = null,
  axisTicks = null,
  axisGridlines = false,
  showAxis = true,
  annotations,
  sharedAxis = null,
  headerAlign = "center",
  sortable = false,
  ...rest
}: VizForestArgs): ColumnSpec {
  const hasInline = point != null && lower != null && upper != null;
  const hasEffects = effects != null && effects.length > 0;
  if (hasInline && hasEffects) {
    throw new Error(
      "vizForest: cannot specify both inline `point`/`lower`/`upper` and `effects`",
    );
  }
  if (!hasInline && !hasEffects) {
    throw new Error(
      "vizForest: provide `point`/`lower`/`upper` or `effects: [...]`",
    );
  }
  if (scale === "log") {
    const nv = nullValue ?? 1;
    if (!(nv > 0)) {
      throw new Error(`vizForest: nullValue must be positive on log scale; got ${nv}`);
    }
    if (axisRange && axisRange[0] <= 0) {
      throw new Error(`vizForest: axisRange lower bound must be positive on log scale; got ${axisRange[0]}`);
    }
  }
  if (axisRange && !(axisRange[0] < axisRange[1])) {
    throw new Error(`vizForest: axisRange must be strictly increasing; got [${axisRange[0]}, ${axisRange[1]}]`);
  }

  const forest: ForestColumnOptions = {
    point: point ?? null,
    lower: lower ?? null,
    upper: upper ?? null,
    effects: effects ?? null,
    scale,
    nullValue: nullValue ?? (scale === "log" ? 1 : 0),
    axisLabel,
    axisRange,
    axisTicks,
    axisGridlines,
    showAxis,
    annotations: annotations ?? null,
    sharedAxis,
  };

  // Synthetic field — mirrors R::viz_forest. The wire `field` is always
  // `_forest_<point-col>` (single-effect) or `_forest_<first-effect.point>`
  // (multi-effect); the original point column lives in `options.forest.point`
  // for the renderer.
  const pointCol = hasInline ? point! : effects![0].pointCol;
  const field = `_forest_${pointCol}`;

  // Header fallback — single multi-effect with a `label` resolves to that
  // label; otherwise empty. Empty fallback also suppresses `showHeader` so
  // the column doesn't reserve a blank strip above the axis.
  let resolvedHeader = rest.header;
  let resolvedShowHeader = rest.showHeader;
  if (resolvedHeader == null) {
    if (hasEffects && effects!.length === 1 && effects![0].label) {
      resolvedHeader = effects![0].label;
    } else {
      resolvedHeader = "";
      if (resolvedShowHeader == null) resolvedShowHeader = false;
    }
  }

  return baseColumn(field, "forest", { forest }, {
    ...rest,
    header: resolvedHeader,
    showHeader: resolvedShowHeader,
    headerAlign,
    sortable,
  });
}

// ────────────────────────────────────────────────────────────────────
// viz_bar / viz_boxplot / viz_violin
// ────────────────────────────────────────────────────────────────────

interface VizColumnCommon extends CommonColumnArgs {
  scale?: "linear" | "log";
  nullValue?: number;
  axisRange?: [number, number] | null;
  axisTicks?: number[] | null;
  axisGridlines?: boolean;
  axisLabel?: string;
  showAxis?: boolean;
  annotations?: Annotation[];
}

export interface VizBarArgs extends VizColumnCommon {
  effects: VizBarEffect[];
  barWidth?: number;
  barGap?: number;
  orientation?: "horizontal" | "vertical";
}

export function vizBar({
  effects,
  scale = "linear", nullValue, axisRange = null, axisTicks = null,
  axisGridlines = false, axisLabel = "Value", showAxis = true, annotations,
  barWidth, barGap, orientation = "horizontal",
  headerAlign = "center", sortable = false,
  ...rest
}: VizBarArgs): ColumnSpec {
  if (!effects?.length) throw new Error("vizBar: requires at least one effect");
  const opts: VizBarColumnOptions = {
    type: "bar",
    effects,
    scale, nullValue, axisRange, axisTicks, axisGridlines, axisLabel, showAxis,
    annotations: prependNullRefline(annotations, nullValue),
    barWidth, barGap, orientation,
  };
  const first = effects[0];
  const field = `_viz_bar_${first.value ?? "x"}`;
  const header = rest.header ?? (first.label || first.value || "");
  return baseColumn(field, "viz_bar", { vizBar: opts }, {
    ...rest, header, headerAlign, sortable,
  });
}

export interface VizBoxplotArgs extends VizColumnCommon {
  effects: VizBoxplotEffect[];
  showOutliers?: boolean;
  whiskerType?: "iqr" | "minmax";
  boxWidth?: number;
}

export function vizBoxplot({
  effects,
  scale = "linear", nullValue, axisRange = null, axisTicks = null,
  axisGridlines = false, axisLabel = "Value", showAxis = true, annotations,
  showOutliers = true, whiskerType = "iqr", boxWidth,
  headerAlign = "center", sortable = false,
  ...rest
}: VizBoxplotArgs): ColumnSpec {
  if (!effects?.length) throw new Error("vizBoxplot: requires at least one effect");
  const opts: VizBoxplotColumnOptions = {
    type: "boxplot",
    effects,
    scale, nullValue, axisRange, axisTicks, axisGridlines, axisLabel, showAxis,
    annotations: prependNullRefline(annotations, nullValue),
    showOutliers, whiskerType, boxWidth,
  };
  const first = effects[0];
  const fieldRoot = first.data ?? first.median ?? "x";
  const field = `_viz_boxplot_${fieldRoot}`;
  const header = rest.header ?? (first.label || fieldRoot || "");
  return baseColumn(field, "viz_boxplot", { vizBoxplot: opts }, {
    ...rest, header, headerAlign, sortable,
  });
}

export interface VizViolinArgs extends VizColumnCommon {
  effects: VizViolinEffect[];
  bandwidth?: number | null;
  showMedian?: boolean;
  showQuartiles?: boolean;
  maxWidth?: number;
}

export function vizViolin({
  effects,
  scale = "linear", nullValue, axisRange = null, axisTicks = null,
  axisGridlines = false, axisLabel = "Value", showAxis = true, annotations,
  bandwidth = null, showMedian = true, showQuartiles = false, maxWidth,
  headerAlign = "center", sortable = false,
  ...rest
}: VizViolinArgs): ColumnSpec {
  if (!effects?.length) throw new Error("vizViolin: requires at least one effect");
  const opts: VizViolinColumnOptions = {
    type: "violin",
    effects,
    scale, nullValue, axisRange, axisTicks, axisGridlines, axisLabel, showAxis,
    annotations: prependNullRefline(annotations, nullValue),
    bandwidth, showMedian, showQuartiles, maxWidth,
  };
  const first = effects[0];
  const field = `_viz_violin_${first.data ?? "x"}`;
  const header = rest.header ?? (first.label || first.data || "");
  return baseColumn(field, "viz_violin", { vizViolin: opts }, {
    ...rest, header, headerAlign, sortable,
  });
}

/**
 * Mirror of R's `prepare_viz_annotations`: when `nullValue` is provided,
 * prepend a synthetic dashed reference line so viz_bar/boxplot/violin gain
 * an implicit "zero line" without the caller needing to thread a refline.
 */
function prependNullRefline(
  annotations: Annotation[] | undefined,
  nullValue: number | undefined,
): Annotation[] | null {
  const list = annotations ? [...annotations] : [];
  if (nullValue != null) {
    list.unshift({
      type: "reference_line",
      id: `refline_${nullValue}`,
      x: nullValue,
      label: null,
      style: "dashed",
      color: null,
      width: 1,
      opacity: 0.6,
    } as Annotation);
  }
  return list.length ? list : null;
}
