// Heatmap cell renderer (schema-sprint Phase 4c.2).
//
// - dom: mounts the existing CellHeatmap.svelte. Schema dispatch
//   forwards value, options, ctx.columnSummary (so the component
//   doesn't have to iterate visible rows) and theme.
//
// - svg: mirrors svg-generator.ts:3904-3978. Palette interpolation
//   (default: theme.inputs.primary → primaryDeep with white-blended
//   light end), linear/log/sqrt scale, luminance-based text color.
//   Reads ctx.columnSummary for min/max when not pinned in options.

import type { ColumnOptions, WebTheme } from "../../types";
import type { RenderComponent, RenderSvg, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { registerCellComponent } from "../../components/render-component-registry";
import CellHeatmap from "../../components/table/CellHeatmap.svelte";
import {
  getCssVars, readAccentDefault, readSurfaceBg,
  readContentPrimary, readBodyFamily, readBodySize,
} from "../../lib/theme/consumer-bridge";
import { normalizeValue } from "../../lib/scale-utils";
import { parseFontSize } from "../../lib/typography-layout";

interface HeatmapOptions {
  palette?: string[];
  decimals?: number;
  showValue?: boolean;
  scale?: "linear" | "log" | "sqrt";
  minValue?: number;
  maxValue?: number;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Build the theme-derived default palette (light surface → accent).
 *  V4: brand routes through accent for layered emphasis; identity-
 *  secondary cascade dropped. */
function defaultPalette(theme: WebTheme): string[] {
  const cv = getCssVars(theme);
  const accent = readAccentDefault(cv);
  const surfaceBase = readSurfaceBg(cv);
  // Blend accent 92% toward surface for the light end.
  const [ar, ag, ab] = parseHex(accent);
  const [br, bg, bb] = parseHex(surfaceBase);
  const t = 0.92;
  const r = Math.round(ar * (1 - t) + br * t);
  const g = Math.round(ag * (1 - t) + bg * t);
  const b = Math.round(ab * (1 - t) + bb * t);
  const lightHex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  return [lightHex, accent];
}

/** Interpolate a value in [0,1] across the palette stops. */
function interpolatePalette(palette: string[], normalized: number): { hex: string; rgb: [number, number, number] } {
  const stops = palette.length - 1;
  const segment = Math.min(Math.floor(normalized * stops), stops - 1);
  const t = normalized * stops - segment;
  const c1 = parseHex(palette[segment]);
  const c2 = parseHex(palette[segment + 1]);
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return { hex: `rgb(${r},${g},${b})`, rgb: [r, g, b] };
}

const heatmapDomRenderer: CellFormatter = (value, options, ctx): RenderComponent => {
  const opts = (options as ColumnOptions | undefined)?.heatmap as HeatmapOptions | undefined;
  const minValue = opts?.minValue ?? ctx?.columnSummary?.min ?? 0;
  const maxValue = opts?.maxValue ?? ctx?.columnSummary?.max ?? 1;
  return {
    kind: "component",
    name: "CellHeatmap",
    props: {
      value: value as number,
      options: opts,
      minValue,
      maxValue,
      naText: ctx?.naText ?? undefined,
      theme: ctx?.theme,
    },
  };
};

const heatmapSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { kind: "svg", markup: "", width: 0, height: 0 };
  }
  const theme = ctx?.theme as WebTheme | null | undefined;
  if (!theme) return { kind: "svg", markup: "", width: 0, height: 0 };

  const opts = (options as ColumnOptions | undefined)?.heatmap as HeatmapOptions | undefined;
  const palette = opts?.palette ?? defaultPalette(theme);
  const decimals = opts?.decimals ?? 2;
  const showValue = opts?.showValue ?? true;
  const scale = opts?.scale ?? "linear";
  const minValue = opts?.minValue ?? ctx?.columnSummary?.min ?? 0;
  const maxValue = opts?.maxValue ?? ctx?.columnSummary?.max ?? 1;

  const normalized = maxValue === minValue
    ? 0.5
    : normalizeValue(value, minValue, maxValue, scale);
  const { hex: bgColor, rgb } = interpolatePalette(palette, normalized);
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  const cssVars = getCssVars(theme);
  const textColor = luminance > 0.5 ? readContentPrimary(cssVars) : "#ffffff";

  const fontSize = parseFontSize(readBodySize(cssVars));
  const cellWidth = ctx?.cellWidth ?? 100;
  const rowH = ctx?.rowHeight ?? 24;

  const pieces: string[] = [];
  // Background rect with 2px inset on every side (mirrors legacy).
  pieces.push(
    `<rect x="2" y="2" width="${cellWidth - 4}" height="${rowH - 4}" ` +
    `fill="${bgColor}" rx="2"/>`,
  );
  if (showValue) {
    pieces.push(
      `<text class="cell-text" dominant-baseline="central" ` +
      `x="${cellWidth / 2}" y="${rowH / 2}" ` +
      `font-family="${readBodyFamily(cssVars)}" ` +
      `font-size="${fontSize * 0.9}px" font-weight="400" ` +
      `text-anchor="middle" fill="${textColor}">${value.toFixed(decimals)}</text>`,
    );
  }
  return { kind: "svg", markup: pieces.join(""), width: cellWidth, height: rowH };
};

/** Idempotent re-register helper. */
export function registerHeatmapRenderer(): void {
  registerCellComponent("CellHeatmap", CellHeatmap as never);
  registerRenderers("heatmap", { dom: heatmapDomRenderer, svg: heatmapSvgRenderer });
}

registerHeatmapRenderer();

export const __testing = { parseHex, defaultPalette, interpolatePalette };
