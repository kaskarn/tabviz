// Bar cell renderer (schema-sprint Phase 4c.1).
//
// - dom: returns a RenderComponent mounting the existing
//   `CellBar.svelte`. The component owns the live (browser) DOM
//   for bar cells; the schema dispatch just forwards props +
//   ctx.columnSummary so the renderer doesn't iterate visible rows.
//
// - svg: mirrors svg-generator.ts:3345-3401. Track pill + filled
//   bar + optional value label, with the bar fill width scaled
//   against ctx.columnSummary.max when options.bar.maxValue is
//   absent.
//
// Color cascade: explicit options.bar.color > cell-bundle markerFill
// > row-bundle markerFill > theme.inputs.primary > theme.accent.default.
// Mirrors the legacy CellBar / svg-generator branch.

import type { ColumnOptions, WebTheme } from "../../types";
import type { RenderComponent, RenderSvg, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { registerCellComponent } from "../../components/render-component-registry";
import CellBar from "../../components/table/CellBar.svelte";
import { resolveSemanticBundle } from "../../lib/semantic-styling";
import { parseFontSize } from "../../lib/typography-layout";
import { normalizeValue } from "../../lib/scale-utils";
import { BAR, SPACING } from "../../lib/rendering-constants";

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
    ?? (theme.inputs as { primary?: string } | undefined)?.primary
    ?? theme.accent.default;
}

function formatBarLabel(value: number): string {
  // Mirrors CellBar.svelte's formattedValue().
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

const barDomRenderer: CellFormatter = (value, options, ctx): RenderComponent => {
  const opts = (options as ColumnOptions | undefined)?.bar as BarOptions | undefined;
  // Resolve maxValue: explicit pin > ctx.columnSummary.max > legacy 100 fallback.
  const maxValue = opts?.maxValue ?? ctx?.columnSummary?.max ?? 100;
  return {
    kind: "component",
    name: "CellBar",
    props: {
      value: value as number,
      maxValue,
      options: opts,
      naText: ctx?.naText ?? undefined,
      colorOverride: ctx?.colorOverride ?? null,
    },
  };
};

const barSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { kind: "svg", markup: "", width: 0, height: 0 };
  }
  const theme = ctx?.theme as WebTheme | null | undefined;
  if (!theme) return { kind: "svg", markup: "", width: 0, height: 0 };

  const opts = (options as ColumnOptions | undefined)?.bar as BarOptions | undefined;
  const maxValue = opts?.maxValue ?? ctx?.columnSummary?.max ?? 100;
  const scale = opts?.scale ?? "linear";
  const showLabel = opts?.showLabel ?? true;
  const color = resolveBarColor(opts, ctx?.cellStyle, undefined, theme);
  const trackColor = theme.divider.subtle ?? "#e2e8f0";

  const fontSize = parseFontSize(theme.text.body.size);
  const labelFontSize = fontSize * BAR.LABEL_SCALE;
  const labelReserved = showLabel ? BAR.GAP + BAR.LABEL_MIN_WIDTH : 0;
  const cellWidth = ctx?.cellWidth ?? 100;
  const barAreaWidth = Math.max(0, cellWidth - SPACING.TEXT_PADDING * 2 - labelReserved);
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
    const totalWidth = cellWidth - SPACING.TEXT_PADDING * 2;
    pieces.push(
      `<text class="cell-text" dominant-baseline="central" ` +
      `x="${totalWidth}" y="${rowH / 2}" ` +
      `font-family="${theme.text.body.family}" ` +
      `font-size="${labelFontSize}px" font-weight="400" ` +
      `text-anchor="end" fill="${theme.content.primary}">${labelText}</text>`,
    );
  }
  return { kind: "svg", markup: pieces.join(""), width: cellWidth - SPACING.TEXT_PADDING * 2, height: rowH };
};

/** Idempotent re-register helper. */
export function registerBarRenderer(): void {
  registerCellComponent("CellBar", CellBar as never);
  registerRenderers("bar", { dom: barDomRenderer, svg: barSvgRenderer });
}

registerBarRenderer();

export const __testing = { resolveBarColor, formatBarLabel };
