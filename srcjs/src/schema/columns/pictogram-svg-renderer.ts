// SVG renderer for the `pictogram` schema — V8-SAFE MODULE.
//
// Split out of pictogram-renderer.ts (adversarial review closure,
// 2026-06-05): the combined module imports CellPictogram.svelte for its
// DOM half, so it could only be booted from init-dom — which meant the
// SVG renderer NEVER REACHED THE V8 BUNDLE and every pictogram-family
// cell (incl. R's col_stars, which serialized as pictogram) exported as
// bare numbers. This module has no Svelte imports; `init.ts` boots it
// for both runtimes, and pictogram-renderer.ts (init-dom) layers the
// DOM half on top via registerRenderers' per-target merge.

import type { ColumnOptions, WebTheme } from "../../types";
import type { RenderSvg, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { getCssVars, readContentMuted } from "../../lib/theme/consumer-bridge";
import { resolveMarkerColor } from "../../lib/color-resolution";
import { resolveGlyph } from "../../lib/glyph-registry";
import { resolveSemanticBundle } from "../../lib/semantic-styling";
import { CELL_GEOMETRY, TYPOGRAPHY } from "../../lib/rendering-constants";

export interface PictogramOptions {
  glyph?: string | Record<string, string>;
  glyphField?: string;
  color?: string;
  emptyColor?: string;
  maxGlyphs?: number | null;
  halfGlyphs?: boolean;
  domain?: [number, number] | null;
  layout?: "row" | "stack" | "row_value_trail";
  size?: "sm" | "base" | "lg";
  valueLabel?: boolean | "leading" | "trailing";
  labelFormat?: "integer" | "decimal";
  labelDecimals?: number;
}

const GLYPH_PX = CELL_GEOMETRY.pictogram.glyphPx;
const GLYPH_GAP = CELL_GEOMETRY.pictogram.gap;

export function resolvePictoColors(
  opts: PictogramOptions,
  cellStyle: Parameters<typeof resolveSemanticBundle>[0],
  rowStyle: Parameters<typeof resolveSemanticBundle>[0],
  theme: WebTheme,
): { filled: string; empty: string } {
  // V3→V4: was `inputs.secondary ?? inputs.primary ?? theme.accent.default`.
  return {
    // Filled = the shared marker cascade (option > cell paint > row paint >
    // accent default). Empty = explicit emptyColor or the muted content role.
    filled: resolveMarkerColor(opts.color, cellStyle, rowStyle, theme),
    empty: opts.emptyColor ?? readContentMuted(getCssVars(theme)),
  };
}

export function resolveGlyphSpec(opts: PictogramOptions, meta: Record<string, unknown>): string | null {
  if (typeof opts.glyph === "string") return opts.glyph;
  if (opts.glyph && typeof opts.glyph === "object" && opts.glyphField) {
    const sel = meta[opts.glyphField];
    if (sel != null) {
      const map = opts.glyph as Record<string, string>;
      return map[String(sel)] ?? null;
    }
  }
  return null;
}

interface Slot { state: "full" | "half" | "empty" }

function buildSlots(rating: number, maxGlyphs: number | null, halfGlyphs: boolean): Slot[] {
  const slots: Slot[] = [];
  if (maxGlyphs == null) {
    const n = Math.min(Math.floor(rating + (halfGlyphs ? 0.5 : 0)), 999);
    for (let i = 0; i < n; i++) slots.push({ state: "full" });
    return slots;
  }
  for (let i = 1; i <= maxGlyphs; i++) {
    if (i <= rating) slots.push({ state: "full" });
    else if (halfGlyphs && i - 0.5 <= rating) slots.push({ state: "half" });
    else slots.push({ state: "empty" });
  }
  return slots;
}

function applyDomainRemap(value: number, domain: [number, number] | null | undefined, maxGlyphs: number | null): number {
  if (!domain || !Number.isFinite(domain[0]) || !Number.isFinite(domain[1]) || domain[1] <= domain[0] || maxGlyphs == null) {
    return Math.max(0, value);
  }
  const clamped = Math.max(domain[0], Math.min(domain[1], value));
  return Math.max(0, ((clamped - domain[0]) / (domain[1] - domain[0])) * maxGlyphs);
}

function buildLabelText(value: number, opts: PictogramOptions): string {
  if (opts.labelFormat === "integer") return String(Math.round(value));
  return value.toFixed(opts.labelDecimals ?? 1);
}

function renderGlyph(
  slot: Slot,
  resolved: ReturnType<typeof resolveGlyph>,
  sx: number,
  sy: number,
  glyphPx: number,
  filledColor: string,
  emptyColor: string,
  uniqueId: string,
): string {
  if (!resolved) return "";
  if (resolved.kind === "registry") {
    const def = resolved.def;
    if (slot.state === "full") {
      return (
        `<svg x="${sx}" y="${sy}" width="${glyphPx}" height="${glyphPx}" viewBox="${def.viewBox}">` +
        `<path d="${def.path}" fill="${filledColor}" stroke="none"/></svg>`
      );
    }
    if (slot.state === "half") {
      const vb = def.viewBox.split(/\s+/).map(Number);
      const halfW = vb[2] / 2;
      const clipId = `pic-half-${uniqueId}`;
      return (
        `<svg x="${sx}" y="${sy}" width="${glyphPx}" height="${glyphPx}" viewBox="${def.viewBox}">` +
        `<defs><clipPath id="${clipId}"><rect x="${vb[0]}" y="${vb[1]}" width="${halfW}" height="${vb[3]}"/></clipPath></defs>` +
        `<path d="${def.path}" fill="none" stroke="${emptyColor}" stroke-width="1.5"/>` +
        `<path d="${def.path}" fill="${filledColor}" stroke="none" clip-path="url(#${clipId})"/>` +
        `</svg>`
      );
    }
    return (
      `<svg x="${sx}" y="${sy}" width="${glyphPx}" height="${glyphPx}" viewBox="${def.viewBox}">` +
      `<path d="${def.path}" fill="none" stroke="${emptyColor}" stroke-width="1.5"/></svg>`
    );
  }
  // Literal char fallback.
  const color = slot.state === "empty" ? emptyColor : filledColor;
  return (
    `<text x="${sx + glyphPx / 2}" y="${sy + glyphPx * 0.85}" ` +
    `font-size="${glyphPx}" fill="${color}" text-anchor="middle">${resolved.char}</text>`
  );
}

export const pictogramSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { kind: "svg", markup: "", width: 0, height: 0 };
  }
  const opts = (options as ColumnOptions | undefined)?.pictogram as PictogramOptions | undefined;
  if (!opts) return { kind: "svg", markup: "", width: 0, height: 0 };
  const theme = ctx?.theme as WebTheme | null | undefined;
  if (!theme) return { kind: "svg", markup: "", width: 0, height: 0 };

  const meta = (ctx?.row ?? {}) as Record<string, unknown>;
  const glyphSpec = resolveGlyphSpec(opts, meta);
  const resolved = resolveGlyph(glyphSpec);
  if (!resolved) return { kind: "svg", markup: "", width: 0, height: 0 };

  const { filled: filledColor, empty: emptyColor } = resolvePictoColors(opts, ctx?.cellStyle, undefined, theme);

  const maxGlyphs = opts.maxGlyphs ?? null;
  const halfGlyphs = opts.halfGlyphs ?? false;
  const layout = opts.layout ?? "row";
  const size = opts.size ?? "base";
  const glyphPx = GLYPH_PX[size];
  const isStack = layout === "stack";

  const rating = applyDomainRemap(value, opts.domain ?? null, maxGlyphs);
  const slots = buildSlots(rating, maxGlyphs, halfGlyphs);

  const valueLabel = opts.valueLabel ?? false;
  const labelPos = valueLabel === true ? "trailing"
    : valueLabel === "leading" ? "leading"
      : valueLabel === "trailing" ? "trailing"
        : null;
  const labelFontPx = CELL_GEOMETRY.labelFontPx[size];
  const labelText = labelPos ? buildLabelText(value, opts) : "";
  const labelW = labelText ? labelText.length * (labelFontPx * TYPOGRAPHY.AVG_CHAR_WIDTH_RATIO) + 4 : 0;

  const trackW = isStack ? glyphPx : slots.length * glyphPx + Math.max(0, slots.length - 1) * GLYPH_GAP;
  const trackH = isStack ? slots.length * glyphPx : glyphPx;
  const totalW = trackW + labelW;
  const totalH = Math.max(trackH, labelFontPx);

  const pieces: string[] = [];
  let cursorX = 0;

  if (labelPos === "leading") {
    pieces.push(
      `<text x="${cursorX}" y="${totalH / 2}" ` +
      `font-size="${labelFontPx}" fill="var(--tv-text)" ` +
      `dominant-baseline="middle" text-anchor="start">${labelText}</text>`,
    );
    cursorX += labelW;
  }

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const sx = isStack ? cursorX : cursorX + i * (glyphPx + GLYPH_GAP);
    const sy = isStack ? (slots.length - 1 - i) * glyphPx : 0;
    // Unique clip-id per glyph: combine the column-derived index +
    // path hash so multiple half-glyph cells don't collide.
    const pathHash = resolved.kind === "registry" ? (resolved.def.path.length * 31) >>> 0 : 0;
    const uniqueId = `${i}-${pathHash}`;
    pieces.push(renderGlyph(slot, resolved, sx, sy, glyphPx, filledColor, emptyColor, uniqueId));
  }

  if (labelPos === "trailing") {
    const lx = isStack ? cursorX + glyphPx + 4 : cursorX + trackW + 4;
    pieces.push(
      `<text x="${lx}" y="${totalH / 2}" ` +
      `font-size="${labelFontPx}" fill="var(--tv-text)" ` +
      `dominant-baseline="middle" text-anchor="start">${labelText}</text>`,
    );
  }

  return { kind: "svg", markup: pieces.join(""), width: totalW, height: totalH };
};

/** Idempotent re-register helper. */
export function registerPictogramSvgRenderer(): void {
  registerRenderers("pictogram", { svg: pictogramSvgRenderer });
}

registerPictogramSvgRenderer();

export const __testing = {
  resolvePictoColors, resolveGlyphSpec, buildSlots, applyDomainRemap, buildLabelText,
  GLYPH_PX, GLYPH_GAP,
};
