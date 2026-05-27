// Sparkline cell SVG renderer (schema-sprint Phase 4b.7).
//
// Mirrors svg-generator.ts:3379-3431 plus the shared layout helpers in
// lib/sparkline-utils.ts. Three variants:
//
//   line  (default)  catmull-rom curve + end-dot
//   area              filled area under the curve + curve on top
//   bar               per-sample bars from the value down to baseline
//
// The renderer reads ctx.cellWidth for the layout box; height comes
// from options.sparkline.height (default 16). Output is a self-
// contained RenderSvg at origin (0,0); caller in svg-generator.ts
// positions horizontally based on column align.

import type { ColumnOptions, WebTheme } from "../../types";
import type { CellFormatter, RenderSvg } from "../render-types";
import { registerRenderers } from "../extend";
import { resolveSemanticBundle } from "../../lib/semantic-styling";
import { computeSparklinePoints, catmullRomPath } from "../../lib/sparkline-utils";
import { SPARKLINE, SPACING } from "../../lib/rendering-constants";

interface SparklineOptions {
  type?: "line" | "area" | "bar";
  height?: number;
  color?: string;
}

function resolveSparkColor(
  opts: SparklineOptions | undefined,
  cellStyle: Parameters<typeof resolveSemanticBundle>[0],
  rowStyle: Parameters<typeof resolveSemanticBundle>[0],
  theme: WebTheme,
): string {
  const cellBundle = resolveSemanticBundle(cellStyle, theme);
  const rowBundle = resolveSemanticBundle(rowStyle, theme);
  return opts?.color
    ?? cellBundle?.markerFill
    ?? rowBundle?.markerFill
    ?? (theme.inputs as { primary?: string } | undefined)?.primary
    ?? theme.accent.default;
}

function buildBarMarkup(points: [number, number][], sparkH: number, x: number, y: number, w: number, color: string): string {
  const innerH = Math.max(0, sparkH - SPARKLINE.PADDING * 2);
  const baselineY = y + SPARKLINE.PADDING + innerH;
  const barW = points.length > 1
    ? Math.max(1, (w - SPARKLINE.PADDING * 2) / points.length - 1)
    : Math.max(1, w * 0.5);
  return points.map(([px, py]) => {
    const h = Math.max(0, baselineY - py);
    return (
      `<rect x="${(px - barW / 2).toFixed(2)}" y="${py.toFixed(2)}" ` +
      `width="${barW.toFixed(2)}" height="${h.toFixed(2)}" ` +
      `fill="${color}" opacity="${SPARKLINE.BAR_OPACITY}"/>`
    );
  }).join("");
  void x;
}

function buildAreaMarkup(points: [number, number][], sparkH: number, _x: number, y: number, color: string): string {
  const linePathD = catmullRomPath(points);
  const innerH = Math.max(0, sparkH - SPARKLINE.PADDING * 2);
  const baselineY = y + SPARKLINE.PADDING + innerH;
  const last = points[points.length - 1];
  const first = points[0];
  const areaPathD = `${linePathD}L${last[0].toFixed(2)},${baselineY.toFixed(2)}L${first[0].toFixed(2)},${baselineY.toFixed(2)}Z`;
  return (
    `<path d="${areaPathD}" fill="${color}" opacity="${SPARKLINE.AREA_OPACITY}"/>` +
    `<path d="${linePathD}" fill="none" stroke="${color}" stroke-width="${SPARKLINE.STROKE_WIDTH}"/>`
  );
}

function buildLineMarkup(points: [number, number][], color: string): string {
  const pathD = catmullRomPath(points);
  const last = points[points.length - 1];
  return (
    `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${SPARKLINE.STROKE_WIDTH}"/>` +
    `<circle cx="${last[0].toFixed(2)}" cy="${last[1].toFixed(2)}" ` +
    `r="${SPARKLINE.DOT_RADIUS}" fill="${color}"/>`
  );
}

const sparklineSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
  if (!Array.isArray(value)) {
    return { kind: "svg", markup: "", width: 0, height: 0 };
  }
  // Accept either number[] or [number[]] (single-series); flatten the
  // outer-wrap case the same way the legacy branch did.
  const data: number[] = Array.isArray(value[0]) ? (value[0] as number[]) : (value as number[]);
  const theme = ctx?.theme as WebTheme | null | undefined;
  if (!theme) return { kind: "svg", markup: "", width: 0, height: 0 };

  const opts = (options as ColumnOptions | undefined)?.sparkline as SparklineOptions | undefined;
  const type = opts?.type ?? "line";
  const height = opts?.height ?? 16;
  const color = resolveSparkColor(opts, ctx?.cellStyle, undefined, theme);

  // Layout box. The legacy branch deducts a left+right pad from cell
  // width; mirror that here. The renderer emits at (0,0) so the box
  // starts at x=0; SPACING.TEXT_PADDING is reserved on each side.
  const cellWidth = ctx?.cellWidth ?? 100;
  const padX = SPACING.TEXT_PADDING;
  const innerW = Math.max(0, cellWidth - padX * 2);
  const points = computeSparklinePoints(data, padX, 0, innerW, height);

  if (points.length === 0) {
    return { kind: "svg", markup: "", width: cellWidth, height };
  }

  let markup: string;
  if (type === "bar") {
    markup = buildBarMarkup(points, height, padX, 0, innerW, color);
  } else if (type === "area") {
    markup = buildAreaMarkup(points, height, padX, 0, color);
  } else {
    markup = buildLineMarkup(points, color);
  }
  return { kind: "svg", markup, width: cellWidth, height };
};

/** Idempotent re-register helper. */
export function registerSparklineRenderer(): void {
  registerRenderers("sparkline", { svg: sparklineSvgRenderer });
}

registerSparklineRenderer();

export const __testing = { resolveSparkColor, buildBarMarkup, buildAreaMarkup, buildLineMarkup };
