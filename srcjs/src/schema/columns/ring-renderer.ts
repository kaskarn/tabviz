// Ring cell SVG renderer (schema-sprint Phase 4b.4).
//
// The canonical SVG path for ring cells (svg-generator delegates here via
// schema dispatch). Donut gauge: track ring + filled arc + optional trailing
// label. Theme colors resolved to literals (nested <svg> elements don't
// inherit CSS vars in rsvg).
//
// Output is a single <g>-ish blob (track circle, optional fill arc,
// optional label) at origin (0,0); caller wraps + positions.

import type { ColumnOptions, WebTheme } from "../../types";
import type { CellFormatter, RenderSvg } from "../render-types";
import { registerRenderers } from "../extend";
import { resolveSemanticBundle } from "../../lib/semantic-styling";
import { escapeAttr } from "../../lib/svg-text-utils";
import { buildThresholdStops } from "../../lib/color-resolution";
import { CELL_GEOMETRY, TYPOGRAPHY } from "../../lib/rendering-constants";
import {
  getCssVars, readAccentDefault, readContentMuted, readContentPrimary,
} from "../../lib/theme/consumer-bridge";

interface RingOptions {
  minValue?: number;
  maxValue?: number;
  size?: "sm" | "base" | "lg";
  showLabel?: boolean;
  labelFormat?: "percent" | "integer" | "decimal";
  labelDecimals?: number;
  trackColor?: string;
  thresholds?: number[];
  color?: string | string[];
}

const DIAMETER = CELL_GEOMETRY.ring.diameter;

function resolveFilledColor(
  value: number,
  opts: RingOptions,
  theme: WebTheme,
  cellStyle: Parameters<typeof resolveSemanticBundle>[0],
  rowStyle: Parameters<typeof resolveSemanticBundle>[0],
): string {
  // V3→V4: was `inputs.secondary ?? inputs.primary ?? theme.accent.default`.
  const glyphDefault = readAccentDefault(getCssVars(theme));
  const cellBundle = resolveSemanticBundle(cellStyle, theme);
  const rowBundle = resolveSemanticBundle(rowStyle, theme);
  const override = cellBundle?.markerFill ?? rowBundle?.markerFill ?? null;
  let filledColor: string = override ?? glyphDefault;

  const thresholds = opts.thresholds ?? null;
  const colorOpt = opts.color ?? null;
  if (!thresholds || thresholds.length === 0) {
    if (typeof colorOpt === "string") filledColor = colorOpt;
    else if (Array.isArray(colorOpt) && colorOpt.length === 1) filledColor = colorOpt[0];
    return filledColor;
  }
  const stops = buildThresholdStops(
    thresholds, Array.isArray(colorOpt) ? colorOpt : undefined, theme, glyphDefault,
  );
  let idx = 0;
  for (const t of thresholds) { if (value >= t) idx++; else break; }
  return stops[Math.min(idx, stops.length - 1)] ?? glyphDefault;
}

function formatLabel(
  value: number,
  fraction: number,
  format: "percent" | "integer" | "decimal",
  decimals: number,
): string {
  if (format === "percent") return (fraction * 100).toFixed(decimals) + "%";
  if (format === "integer") return String(Math.round(value));
  return value.toFixed(decimals);
}

const ringSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { kind: "svg", markup: "", width: 0, height: 0 };
  }
  const opts = (options as ColumnOptions | undefined)?.ring as RingOptions | undefined;
  if (!opts) return { kind: "svg", markup: "", width: 0, height: 0 };
  const theme = ctx?.theme as WebTheme | null | undefined;
  if (!theme) return { kind: "svg", markup: "", width: 0, height: 0 };

  const size = opts.size ?? "base";
  const minV = opts.minValue ?? 0;
  const maxV = opts.maxValue ?? 1;
  const showLabel = opts.showLabel ?? true;
  const labelFormat = opts.labelFormat ?? "percent";
  const labelDecimals = opts.labelDecimals ?? 0;
  const cssVars = getCssVars(theme);
  // XSS egress wall (user opts.trackColor / resolved cellStyle color → SVG
  // stroke attr); see bar. No-op on legitimate colors.
  const trackColor = escapeAttr(opts.trackColor ?? readContentMuted(cssVars));
  const filledColor = escapeAttr(resolveFilledColor(value, opts, theme, ctx?.cellStyle, undefined));
  const fraction = maxV > minV ? Math.max(0, Math.min(1, (value - minV) / (maxV - minV))) : 0;

  const diameter = DIAMETER[size];
  const stroke = Math.max(2, Math.round(diameter * 0.22));
  const radius = (diameter - stroke) / 2;
  const cx = diameter / 2;
  const cy = diameter / 2;
  const circumference = 2 * Math.PI * radius;
  const dashLen = circumference * fraction;
  const dashGap = circumference - dashLen;

  const labelFontPx = CELL_GEOMETRY.labelFontPx[size];
  const labelText = formatLabel(value, fraction, labelFormat, labelDecimals);
  const labelW = showLabel ? labelText.length * (labelFontPx * TYPOGRAPHY.AVG_CHAR_WIDTH_RATIO) + 4 : 0;
  const totalW = diameter + (showLabel ? labelW + 4 : 0);

  const pieces: string[] = [];
  pieces.push(
    `<circle cx="${cx}" cy="${cy}" r="${radius}" ` +
    `fill="none" stroke="${trackColor}" stroke-width="${stroke}" opacity="0.35"/>`,
  );
  if (dashLen > 0) {
    pieces.push(
      `<circle cx="${cx}" cy="${cy}" r="${radius}" ` +
      `fill="none" stroke="${filledColor}" stroke-width="${stroke}" ` +
      `stroke-dasharray="${dashLen} ${dashGap}" stroke-linecap="round" ` +
      `transform="rotate(-90 ${cx} ${cy})"/>`,
    );
  }
  if (showLabel) {
    pieces.push(
      `<text x="${diameter + 4}" y="${diameter / 2}" ` +
      `font-size="${labelFontPx}" fill="${readContentPrimary(cssVars)}" ` +
      `dominant-baseline="middle" text-anchor="start">${labelText}</text>`,
    );
  }
  return { kind: "svg", markup: pieces.join(""), width: totalW, height: diameter };
};

/** Idempotent re-register helper. */
export function registerRingRenderer(): void {
  registerRenderers("ring", { svg: ringSvgRenderer });
}

registerRingRenderer();

export const __testing = { resolveFilledColor, formatLabel, DIAMETER };
