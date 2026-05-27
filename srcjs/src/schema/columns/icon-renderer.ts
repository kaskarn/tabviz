// Icon cell SVG renderer (schema-sprint Phase 4b.2).
//
// Mirrors svg-generator.ts:3856-3903. Single-glyph cell — applies
// `options.icon.mapping[value]` when present, otherwise renders the
// value verbatim (the typical case is a unicode/emoji glyph stored
// directly in the data column).
//
// Output is a single <text> element at origin (0,0); the caller in
// svg-generator.ts wraps it with translate based on column align and
// row Y. The renderer emits text-anchor="start" because positioning
// happens externally; horizontal alignment is the caller's job.
//
// Color cascade: explicit options.color → cell-bundle markerFill →
// row-bundle markerFill → theme.inputs.primary → theme.accent.default.
//
// Size: sm (12px) / base (14px) / lg (16px) / xl (26px).

import type { ColumnOptions, WebTheme } from "../../types";
import type { CellFormatter, RenderSvg } from "../render-types";
import { registerRenderers } from "../extend";
import { resolveSemanticBundle } from "../../lib/semantic-styling";
import { escapeXml } from "../../lib/svg-text-utils";

interface IconOptions {
  mapping?: Record<string, string>;
  color?: string;
  size?: "sm" | "base" | "lg" | "xl";
}

const SIZE_PX: Record<"sm" | "base" | "lg" | "xl", number> = {
  sm: 12, base: 14, lg: 16, xl: 26,
};

function resolveIconColor(
  iconOpts: IconOptions | undefined,
  cellStyle: Parameters<typeof resolveSemanticBundle>[0],
  rowStyle: Parameters<typeof resolveSemanticBundle>[0],
  theme: WebTheme,
): string {
  const cellBundle = resolveSemanticBundle(cellStyle, theme);
  const rowBundle = resolveSemanticBundle(rowStyle, theme);
  return iconOpts?.color
    ?? cellBundle?.markerFill
    ?? rowBundle?.markerFill
    ?? theme.inputs?.primary
    ?? theme.accent.default;
}

function resolveIconText(
  value: unknown,
  iconOpts: IconOptions | undefined,
  naText: string | null,
): string {
  if (value === undefined || value === null || value === "") return naText ?? "";
  const sv = String(value);
  const mapping = iconOpts?.mapping ?? {};
  return sv in mapping ? String(mapping[sv]) : sv;
}

const iconSvgRenderer: CellFormatter = (value, options, ctx): RenderSvg => {
  const iconOpts = (options as ColumnOptions | undefined)?.icon as IconOptions | undefined;
  const naText = ctx?.naText ?? null;
  const iconText = resolveIconText(value, iconOpts, naText);
  if (!iconText) {
    return { kind: "svg", markup: "", width: 0, height: 0 };
  }
  const theme = ctx?.theme as WebTheme | null | undefined;
  if (!theme) {
    return { kind: "svg", markup: escapeXml(iconText), width: 0, height: 0 };
  }
  const sizeKey = iconOpts?.size ?? "base";
  const px = SIZE_PX[sizeKey];
  const color = resolveIconColor(iconOpts, ctx?.cellStyle, undefined, theme);

  // Position the text so its baseline is in the middle; renderer emits
  // at origin (0,0) and the schema-dispatch wrapper translates to the
  // correct cell location.
  const markup =
    `<text x="0" y="${px / 2}" ` +
    `font-family="${theme.text.body.family}" ` +
    `font-size="${px}px" fill="${color}" ` +
    `dominant-baseline="middle" text-anchor="start">${escapeXml(iconText)}</text>`;
  return { kind: "svg", markup, width: px, height: px };
};

/** Idempotent re-register helper. */
export function registerIconRenderer(): void {
  registerRenderers("icon", { svg: iconSvgRenderer });
}

// Side-effect: register on first import.
registerIconRenderer();

// Export internals for testing.
export const __testing = { resolveIconColor, resolveIconText, SIZE_PX };
