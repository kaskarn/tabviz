// Cell renderer for the `pictogram` schema.
//
// Visual-cell exemplar: the two runtimes target different DOM models,
// so the renderer pair diverges.
//
// - `dom`: returns a `RenderComponent` node pointing at
//   `CellPictogram.svelte`. The browser mounter looks the name up in
//   the cell-component registry and instantiates the component with
//   its existing prop surface — preserving scoped CSS, reactive
//   props, transitions. No SVG-markup-as-html step in the browser.
//
// - `svg`: produces a `RenderSvg` with the same geometry the legacy
//   svg-generator pictogram branch emitted. Rating vs. count mode,
//   half-glyph clip-path, stack vs. row layout, leading/trailing
//   label — all carried over verbatim. Schema-sprint Phase 4b.5.

import type { ColumnOptions, WebTheme } from "../../types";
import type { RenderComponent, RenderSvg, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { registerCellComponent } from "../../components/render-component-registry";
import CellPictogram from "../../components/table/CellPictogram.svelte";
import { resolveGlyph } from "../../lib/glyph-registry";
import { resolveSemanticBundle } from "../../lib/semantic-styling";

interface PictogramOptions {
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

const GLYPH_PX: Record<"sm" | "base" | "lg", number> = { sm: 10, base: 14, lg: 20 };
const LABEL_FONT_PX: Record<"sm" | "base" | "lg", number> = { sm: 9, base: 11, lg: 12 };
const GLYPH_GAP = 1;

const pictogramDomRenderer: CellFormatter = (value, options, ctx) => {
  // Multi-field read: glyphSelector comes from the configured
  // glyph_field, when the glyph option is a value→glyph map.
  const opts = options as { pictogram?: { glyphField?: string } } | undefined;
  const glyphField = opts?.pictogram?.glyphField;
  const meta = (ctx?.row ?? {}) as Record<string, unknown>;
  const glyphSelector = glyphField ? (meta[glyphField] as string | number | null | undefined) ?? null : null;

  const node: RenderComponent = {
    kind: "component",
    name: "CellPictogram",
    props: {
      value: value as number | string | null | undefined,
      options: (opts?.pictogram ?? {}),
      naText: ctx?.naText ?? undefined,
      cellStyle: ctx?.cellStyle,
      colorOverride: ctx?.colorOverride ?? null,
      glyphSelector,
    },
  };
  return node;
};

function resolvePictoColors(
  opts: PictogramOptions,
  cellStyle: Parameters<typeof resolveSemanticBundle>[0],
  rowStyle: Parameters<typeof resolveSemanticBundle>[0],
  theme: WebTheme,
): { filled: string; empty: string } {
  const glyphDefault = (theme.inputs as { secondary?: string; primary?: string } | undefined)?.secondary
    ?? (theme.inputs as { primary?: string } | undefined)?.primary
    ?? theme.accent.default;
  const cellBundle = resolveSemanticBundle(cellStyle, theme);
  const rowBundle = resolveSemanticBundle(rowStyle, theme);
  const override = cellBundle?.markerFill ?? rowBundle?.markerFill ?? null;
  return {
    filled: opts.color ?? override ?? glyphDefault,
    empty: opts.emptyColor ?? theme.content.muted,
  };
}

function resolveGlyphSpec(opts: PictogramOptions, meta: Record<string, unknown>): string | null {
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

const pictogramSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
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
  const labelFontPx = LABEL_FONT_PX[size];
  const labelText = labelPos ? buildLabelText(value, opts) : "";
  const labelW = labelText ? labelText.length * (labelFontPx * 0.55) + 4 : 0;

  const trackW = isStack ? glyphPx : slots.length * glyphPx + Math.max(0, slots.length - 1) * GLYPH_GAP;
  const trackH = isStack ? slots.length * glyphPx : glyphPx;
  const totalW = trackW + labelW;
  const totalH = Math.max(trackH, labelFontPx);

  const pieces: string[] = [];
  let cursorX = 0;

  if (labelPos === "leading") {
    pieces.push(
      `<text x="${cursorX}" y="${totalH / 2}" ` +
      `font-size="${labelFontPx}" fill="var(--tv-cell-fg, var(--tv-fg))" ` +
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
      `font-size="${labelFontPx}" fill="var(--tv-cell-fg, var(--tv-fg))" ` +
      `dominant-baseline="middle" text-anchor="start">${labelText}</text>`,
    );
  }

  return { kind: "svg", markup: pieces.join(""), width: totalW, height: totalH };
};

/** Idempotent re-register helper. */
export function registerPictogramRenderer(): void {
  // Register the cell component first so the dom renderer's
  // RenderComponent node resolves to a mountable target.
  registerCellComponent("CellPictogram", CellPictogram as never);

  registerRenderers("pictogram", {
    dom: pictogramDomRenderer,
    svg: pictogramSvgRenderer,
  });
}

// Side-effect: register on first import.
registerPictogramRenderer();

export const __testing = {
  resolvePictoColors, resolveGlyphSpec, buildSlots, applyDomainRemap, buildLabelText,
  GLYPH_PX, LABEL_FONT_PX, GLYPH_GAP,
};
