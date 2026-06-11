// Bar SVG renderer — the V8-safe half of bar-renderer.ts (area C,
// 2026-06-11). The dom half imports CellBar.svelte, which the V8 export
// boot cannot load; until this split, "bar" had NO svg renderer in
// headless export (the legacy svg-generator branch was removed at the
// Phase 4c migration) and bar cells exported as plain text. Registered
// from BOTH boots (init.ts directly; init-dom via bar-renderer.ts).

import type { ColumnOptions, WebTheme } from "../../types";
import type { RenderSvg, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { resolveSemanticBundle } from "../../lib/semantic-styling";
import { parseFontSize } from "../../lib/typography-layout";
import { normalizeValue } from "../../lib/scale-utils";
import { BAR, SPACING } from "../../lib/rendering-constants";
import {
  getCssVars, readVarPx,
  readAccentDefault, readDividerSubtle, readContentPrimary,
  readBodyFamily, readBodySize,
} from "../../lib/theme/consumer-bridge";

interface BarOptions {
  maxValue?: number;
  color?: string;
  showLabel?: boolean;
  scale?: "linear" | "log" | "sqrt";
}

function resolveBarColor(
  opts: BarOptions | undefined,
  cellStyle: Parameters<typeof resolveSemanticBundle>[0],
  rowStyle: Parameters<typeof resolveSemanticBundle>[0],
  theme: WebTheme,
): string {
  const cellBundle = resolveSemanticBundle(cellStyle, theme);
  const rowBundle = resolveSemanticBundle(rowStyle, theme);
  return opts?.color
    ?? cellBundle?.markerFill
    ?? rowBundle?.markerFill
    // V3→V4: was `theme.inputs.primary ?? theme.accent.default`. Brand is now
    // the identity default; v4 routes brand-derived color through accent.
    ?? readAccentDefault(getCssVars(theme));
}

function formatBarLabel(value: number): string {
  // Mirrors CellBar.svelte's formattedValue().
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export const barSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { kind: "svg", markup: "", width: 0, height: 0 };
  }
  const theme = ctx?.theme as WebTheme | null | undefined;
  if (!theme) return { kind: "svg", markup: "", width: 0, height: 0 };

  const opts = (options as ColumnOptions | undefined)?.bar as BarOptions | undefined;
  const maxValue = opts?.maxValue ?? ctx?.columnSummary?.max ?? 100;
  const scale = opts?.scale ?? "linear";
  const showLabel = opts?.showLabel ?? true;
  const cssVars = getCssVars(theme);
  const color = resolveBarColor(opts, ctx?.cellStyle, undefined, theme);
  const trackColor = readDividerSubtle(cssVars);

  const fontSize = parseFontSize(readBodySize(cssVars));
  const labelFontSize = fontSize * BAR.LABEL_SCALE;
  const labelReserved = showLabel ? BAR.GAP + BAR.LABEL_MIN_WIDTH : 0;
  const cellWidth = ctx?.cellWidth ?? 100;
  const cellPadX = readVarPx(cssVars, "--tv-spacing-cell-padding-x", SPACING.TEXT_PADDING);
  const barAreaWidth = Math.max(0, cellWidth - cellPadX * 2 - labelReserved);
  const fillRatio = normalizeValue(value, 0, maxValue, scale);
  const fillWidth = Math.max(0, fillRatio * barAreaWidth);
  const rowH = ctx?.rowHeight ?? BAR.HEIGHT;
  const barY = (rowH - BAR.HEIGHT) / 2;

  const pieces: string[] = [];
  // Track
  pieces.push(
    `<rect x="0" y="${barY}" width="${barAreaWidth}" height="${BAR.HEIGHT}" ` +
    `fill="${trackColor}" rx="${BAR.RADIUS}"/>`,
  );
  // Fill
  pieces.push(
    `<rect x="0" y="${barY}" width="${fillWidth}" height="${BAR.HEIGHT}" ` +
    `fill="${color}" rx="${BAR.RADIUS}"/>`,
  );
  if (showLabel) {
    const labelText = formatBarLabel(value);
    const totalWidth = cellWidth - cellPadX * 2;
    pieces.push(
      `<text class="cell-text" dominant-baseline="central" ` +
      `x="${totalWidth}" y="${rowH / 2}" ` +
      `font-family="${readBodyFamily(cssVars)}" ` +
      `font-size="${labelFontSize}px" font-weight="400" ` +
      `text-anchor="end" fill="${readContentPrimary(cssVars)}">${labelText}</text>`,
    );
  }
  return { kind: "svg", markup: pieces.join(""), width: cellWidth - cellPadX * 2, height: rowH };
};


/** Register the svg half only (V8 boot). Idempotent. */
export function registerBarSvgRenderer(): void {
  registerRenderers("bar", { svg: barSvgRenderer });
}

registerBarSvgRenderer();

export const __svgTesting = { resolveBarColor, formatBarLabel };
