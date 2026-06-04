// Progress bar SVG renderer (schema-sprint Phase 4b.6).
//
// Mirrors svg-generator.ts:3979-4019. Track + filled bar + optional
// percent label. Output occupies the full cell width (the renderer
// reads ctx.cellWidth and emits geometry sized to fit).
//
// Color cascade: explicit options.color > cell-bundle markerFill >
// row-bundle markerFill > theme.inputs.primary > theme.accent.default.

import type { ColumnOptions, WebTheme } from "../../types";
import type { CellFormatter, RenderSvg } from "../render-types";
import { registerRenderers } from "../extend";
import { normalizeValue } from "../../lib/scale-utils";
import { resolveSemanticBundle } from "../../lib/semantic-styling";
import { parseFontSize } from "../../lib/typography-layout";
import { SPACING } from "../../lib/rendering-constants";
import {
  getCssVars, readVarPx,
  readAccentDefault, readDividerSubtle, readContentPrimary,
  readBodyFamily, readBodySize,
} from "../../lib/theme/consumer-bridge";

interface ProgressOptions {
  maxValue?: number;
  color?: string;
  showLabel?: boolean;
  scale?: "linear" | "log" | "sqrt";
}

const PROGRESS_BAR_HEIGHT = 10;
const PROGRESS_LABEL_WIDTH = 40;
const PROGRESS_BAR_RADIUS = 5;

function resolveProgressColor(
  opts: ProgressOptions | undefined,
  cellStyle: Parameters<typeof resolveSemanticBundle>[0],
  rowStyle: Parameters<typeof resolveSemanticBundle>[0],
  theme: WebTheme,
): string {
  const cellBundle = resolveSemanticBundle(cellStyle, theme);
  const rowBundle = resolveSemanticBundle(rowStyle, theme);
  return opts?.color
    ?? cellBundle?.markerFill
    ?? rowBundle?.markerFill
    // V3→V4: was `theme.inputs.primary ?? theme.accent.default`.
    ?? readAccentDefault(getCssVars(theme));
}

const progressSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { kind: "svg", markup: "", width: 0, height: 0 };
  }
  const opts = (options as ColumnOptions | undefined)?.progress as ProgressOptions | undefined;
  const theme = ctx?.theme as WebTheme | null | undefined;
  if (!theme) return { kind: "svg", markup: "", width: 0, height: 0 };

  const maxValue = opts?.maxValue ?? 100;
  const showLabel = opts?.showLabel ?? true;
  const scale = opts?.scale ?? "linear";
  const color = resolveProgressColor(opts, ctx?.cellStyle, undefined, theme);
  const pct = Math.min(100, Math.max(0, (value / maxValue) * 100));
  const ratio = normalizeValue(value, 0, maxValue, scale);

  // Cell width budget: caller supplies ctx.cellWidth (the column width).
  // Bar area = cell width minus left+right padding minus label reservation.
  const cssVars = getCssVars(theme);
  const cellWidth = ctx?.cellWidth ?? 100;
  const cellPadX = readVarPx(cssVars, "--tv-spacing-cell-padding-x", SPACING.TEXT_PADDING);
  const labelReserved = showLabel ? PROGRESS_LABEL_WIDTH : 0;
  const barAreaWidth = Math.max(0, cellWidth - cellPadX * 2 - labelReserved);
  const barWidth = Math.max(0, ratio * barAreaWidth);
  const totalWidth = cellWidth - cellPadX * 2;
  const fontSize = parseFontSize(readBodySize(cssVars));
  const labelFontSize = fontSize * 0.9;
  const height = Math.max(PROGRESS_BAR_HEIGHT, showLabel ? labelFontSize : PROGRESS_BAR_HEIGHT);

  const pieces: string[] = [];
  // Track
  pieces.push(
    `<rect x="0" y="${(height - PROGRESS_BAR_HEIGHT) / 2}" width="${barAreaWidth}" height="${PROGRESS_BAR_HEIGHT}" ` +
    `fill="${readDividerSubtle(cssVars)}" opacity="0.5" rx="${PROGRESS_BAR_RADIUS}"/>`,
  );
  // Fill
  pieces.push(
    `<rect x="0" y="${(height - PROGRESS_BAR_HEIGHT) / 2}" width="${barWidth}" height="${PROGRESS_BAR_HEIGHT}" ` +
    `fill="${color}" rx="${PROGRESS_BAR_RADIUS}"/>`,
  );
  if (showLabel) {
    pieces.push(
      `<text class="cell-text" dominant-baseline="central" ` +
      `x="${totalWidth}" y="${height / 2}" ` +
      `font-family="${readBodyFamily(cssVars)}" ` +
      `font-size="${labelFontSize}px" font-weight="400" ` +
      `text-anchor="end" fill="${readContentPrimary(cssVars)}">${Math.round(pct)}%</text>`,
    );
  }
  return { kind: "svg", markup: pieces.join(""), width: totalWidth, height };
};

/** Idempotent re-register helper. */
export function registerProgressRenderer(): void {
  registerRenderers("progress", { svg: progressSvgRenderer });
}

registerProgressRenderer();

export const __testing = { resolveProgressColor, PROGRESS_BAR_HEIGHT, PROGRESS_LABEL_WIDTH, PROGRESS_BAR_RADIUS };
