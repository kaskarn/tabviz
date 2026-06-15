// Heatmap SVG renderer — the V8-safe half of heatmap-renderer.ts (area
// C, 2026-06-11; see bar-svg-renderer.ts for the boot-split story —
// heatmap had the same silent text-fallback in headless export).

import type { ColumnOptions, WebTheme } from "../../types";
import type { RenderSvg, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import {
  getCssVars, readAccentDefault, readSurfaceBg,
  readBodyFamily, readLabelSize, readVarPx,
} from "../../lib/theme/consumer-bridge";
import { normalizeValue } from "../../lib/scale-utils";
import { parseFontSize } from "../../lib/typography-layout";
import { HEATMAP_TEXT, SPACING } from "../../lib/rendering-constants";

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

export const heatmapSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
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
  // Theme-INDEPENDENT contrast against the data-driven cell color (was
  // readContentPrimary — LIGHT in a dark theme → unreadable light-on-light
  // text in exports; cell-parity review #3, 2026-06-14).
  const textColor = luminance > 0.5 ? HEATMAP_TEXT.DARK : HEATMAP_TEXT.LIGHT;

  // Value text draws at the `label` type-role — the SAME token the DOM reads
  // (CellHeatmap.svelte `var(--tv-text-label-size)`). Role, not a `* 0.9`.
  const labelFontSize = parseFontSize(readLabelSize(cssVars));
  const cellWidth = ctx?.cellWidth ?? 100;
  const rowH = ctx?.rowHeight ?? 24;

  const pieces: string[] = [];
  // Fill the cell CONTENT box, matching the DOM `.cell-heatmap` (width/
  // height:100% INSIDE the padded grid-cell). The caller already translates the
  // cell group by cellPadX (left-padded text origin), so the rect starts at
  // x=0 and only needs to inset its RIGHT edge by 2·padX — the old flat
  // `width=cellWidth-4` over-drew ~cellPadX past the content box (measured DOM
  // 76px wide vs SVG ~92, the dominant heatmap divergence).
  const padX = readVarPx(cssVars, "--tv-spacing-cell-padding-x", SPACING.TEXT_PADDING);
  const padY = readVarPx(cssVars, "--tv-spacing-cell-padding-y", 2);
  const contentW = Math.max(0, cellWidth - padX * 2);
  // Corner radius from the geometry `radius-sm` slot (settings "Corners").
  const rx = readVarPx(cssVars, "--tv-radius-sm", 2);
  pieces.push(
    `<rect x="0" y="${padY}" width="${contentW}" height="${Math.max(0, rowH - padY * 2)}" ` +
    `fill="${bgColor}" rx="${rx}"/>`,
  );
  if (showValue) {
    pieces.push(
      `<text class="cell-text" dominant-baseline="central" ` +
      `x="${contentW / 2}" y="${rowH / 2}" ` +
      `font-family="${readBodyFamily(cssVars)}" ` +
      `font-size="${labelFontSize}px" font-weight="400" ` +
      `text-anchor="middle" fill="${textColor}">${value.toFixed(decimals)}</text>`,
    );
  }
  return { kind: "svg", markup: pieces.join(""), width: cellWidth, height: rowH };
};


/** Register the svg half only (V8 boot). Idempotent. */
export function registerHeatmapSvgRenderer(): void {
  registerRenderers("heatmap", { svg: heatmapSvgRenderer });
}

registerHeatmapSvgRenderer();

export const __svgTesting = { parseHex, defaultPalette, interpolatePalette };
