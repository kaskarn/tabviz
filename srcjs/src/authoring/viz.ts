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
  ...common
}: VizForestArgs): ColumnSpec {
  if (!point && !effects) {
    throw new Error("vizForest: must specify `point`/`lower`/`upper` or `effects`");
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
  // Field is the point column when single-effect, or a synthetic id when multi-effect.
  const field = point ?? `_forest_${effects?.[0]?.id ?? "multi"}`;
  return baseColumn(field, "forest", { forest }, common);
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
  axisGridlines = false, axisLabel = "", showAxis = true, annotations,
  barWidth, barGap, orientation = "horizontal",
  ...common
}: VizBarArgs): ColumnSpec {
  const opts: VizBarColumnOptions = {
    type: "bar",
    effects,
    scale, nullValue, axisRange, axisTicks, axisGridlines, axisLabel, showAxis,
    annotations: annotations ?? null,
    barWidth, barGap, orientation,
  };
  const field = `_viz_bar_${effects[0]?.value ?? "x"}`;
  return baseColumn(field, "viz_bar", { vizBar: opts }, common);
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
  axisGridlines = false, axisLabel = "", showAxis = true, annotations,
  showOutliers = true, whiskerType = "iqr", boxWidth,
  ...common
}: VizBoxplotArgs): ColumnSpec {
  const opts: VizBoxplotColumnOptions = {
    type: "boxplot",
    effects,
    scale, nullValue, axisRange, axisTicks, axisGridlines, axisLabel, showAxis,
    annotations: annotations ?? null,
    showOutliers, whiskerType, boxWidth,
  };
  const field = `_viz_boxplot_${effects[0]?.data ?? effects[0]?.median ?? "x"}`;
  return baseColumn(field, "viz_boxplot", { vizBoxplot: opts }, common);
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
  axisGridlines = false, axisLabel = "", showAxis = true, annotations,
  bandwidth = null, showMedian = true, showQuartiles = false, maxWidth,
  ...common
}: VizViolinArgs): ColumnSpec {
  const opts: VizViolinColumnOptions = {
    type: "violin",
    effects,
    scale, nullValue, axisRange, axisTicks, axisGridlines, axisLabel, showAxis,
    annotations: annotations ?? null,
    bandwidth, showMedian, showQuartiles, maxWidth,
  };
  const field = `_viz_violin_${effects[0]?.data ?? "x"}`;
  return baseColumn(field, "viz_violin", { vizViolin: opts }, common);
}
