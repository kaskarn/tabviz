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
import { escapeAttr } from "../../lib/svg-text-utils";
import { resolveSemanticBundle } from "../../lib/semantic-styling";
import { resolveMarkerColor } from "../../lib/color-resolution";
import { parseFontSize } from "../../lib/typography-layout";
import { measureTextWidth } from "../../lib/width-utils";
import { SPACING, PROGRESS } from "../../lib/rendering-constants";
import {
  getCssVars, readVarPx,
  readDividerStrong, readContentPrimary,
  readBodyFamily, readLabelSize,
} from "../../lib/theme/consumer-bridge";

interface ProgressOptions {
  maxValue?: number;
  color?: string;
  showLabel?: boolean;
  scale?: "linear" | "log" | "sqrt";
}

const PROGRESS_BAR_HEIGHT = PROGRESS.BAR_HEIGHT;
const PROGRESS_LABEL_MIN_WIDTH = PROGRESS.LABEL_MIN_WIDTH;
const PROGRESS_BAR_RADIUS = PROGRESS.BAR_RADIUS;

function resolveProgressColor(
  opts: ProgressOptions | undefined,
  cellStyle: Parameters<typeof resolveSemanticBundle>[0],
  rowStyle: Parameters<typeof resolveSemanticBundle>[0],
  theme: WebTheme,
): string {
  return resolveMarkerColor(opts?.color, cellStyle, rowStyle, theme);
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
  // XSS egress wall (user opts/cellStyle color → SVG fill attr); see bar.
  const color = escapeAttr(resolveProgressColor(opts, ctx?.cellStyle, undefined, theme));
  const pct = Math.min(100, Math.max(0, (value / maxValue) * 100));
  const ratio = normalizeValue(value, 0, maxValue, scale);

  // Cell width budget: caller supplies ctx.cellWidth (the column width).
  // Bar area = cell width minus left+right padding minus label reservation.
  const cssVars = getCssVars(theme);
  const cellWidth = ctx?.cellWidth ?? 100;
  const cellPadX = readVarPx(cssVars, "--tv-spacing-cell-padding-x", SPACING.TEXT_PADDING);
  // Label draws at the `label` type-role — the SAME token the DOM reads
  // (CellProgress.svelte `var(--tv-text-label-size)`). Role, not multiplier.
  const labelFontSize = parseFontSize(readLabelSize(cssVars));
  const labelText = `${Math.round(pct)}%`;
  // Reserve max(floor, MEASURED label width) — a wide label ("100%", or a
  // larger label-size theme) must not overrun the bar; the DOM flex row grows
  // the label past its min-width the same way. A fixed reservation was chancy.
  const labelReserved = showLabel
    ? Math.max(PROGRESS_LABEL_MIN_WIDTH, measureTextWidth(labelText, labelFontSize, readBodyFamily(cssVars), 400))
    : 0;
  const barAreaWidth = Math.max(0, cellWidth - cellPadX * 2 - labelReserved);
  const barWidth = Math.max(0, ratio * barAreaWidth);
  const totalWidth = cellWidth - cellPadX * 2;
  const height = Math.max(PROGRESS_BAR_HEIGHT, showLabel ? labelFontSize : PROGRESS_BAR_HEIGHT);
  // Track corner radius from the geometry `radius-md` slot (settings "Corners");
  // the progress bar is more rounded than the small cell chips → md, not sm.
  const rx = readVarPx(cssVars, "--tv-radius-md", PROGRESS_BAR_RADIUS);

  const pieces: string[] = [];
  // Track
  pieces.push(
    `<rect x="0" y="${(height - PROGRESS_BAR_HEIGHT) / 2}" width="${barAreaWidth}" height="${PROGRESS_BAR_HEIGHT}" ` +
    `fill="${readDividerStrong(cssVars)}" opacity="${PROGRESS.TRACK_OPACITY}" rx="${rx}"/>`,
  );
  // Fill
  pieces.push(
    `<rect x="0" y="${(height - PROGRESS_BAR_HEIGHT) / 2}" width="${barWidth}" height="${PROGRESS_BAR_HEIGHT}" ` +
    `fill="${color}" rx="${rx}"/>`,
  );
  if (showLabel) {
    pieces.push(
      `<text class="cell-text" dominant-baseline="central" ` +
      `x="${totalWidth}" y="${height / 2}" ` +
      `font-family="${readBodyFamily(cssVars)}" ` +
      `font-size="${labelFontSize}px" font-weight="400" ` +
      `text-anchor="end" fill="${readContentPrimary(cssVars)}">${labelText}</text>`,
    );
  }
  return { kind: "svg", markup: pieces.join(""), width: totalWidth, height };
};

/** Idempotent re-register helper. */
export function registerProgressRenderer(): void {
  registerRenderers("progress", { svg: progressSvgRenderer });
}

registerProgressRenderer();

export const __testing = { resolveProgressColor, PROGRESS_BAR_HEIGHT, PROGRESS_LABEL_MIN_WIDTH, PROGRESS_BAR_RADIUS };
