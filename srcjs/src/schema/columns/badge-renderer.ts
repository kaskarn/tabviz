// Badge cell SVG renderer (schema-sprint Phase 4b).
//
// Mirrors svg-generator.ts's legacy per-type branch for `col.type ===
// "badge"` and the auxiliary entry in `getCellValue`. Emits a single
// `RenderSvg` node containing the badge geometry at origin (0,0); the
// caller in svg-generator.ts wraps it in a positioning <g> based on
// the column's align / row Y. Width and height are intrinsic.
//
// Color resolution cascade (most-specific → most-general):
//
//   thresholds (numeric value bucketed)
//   options.colors (record keyed by string value)
//   options.variants (record mapping value → status variant id)
//   row/cell semantic markerFill (paint-tool override)
//   theme.inputs.secondary  (badge identity default)
//   theme.inputs.primary   (mono themes)
//   theme.accent.default   (last-ditch fallback)
//
// Shapes:
//
//   pill    rounded full-height ends (radius = height / 2)
//   circle  1:1 aspect, radius = height / 2 — for single-digit / icon
//   square  1:1 aspect, slight corner radius (3px)
//
// Outline mode: stroke at full color + transparent fill (vs solid fill
// at 0.15 opacity).
//
// The DOM-side renderer continues to mount the existing CellBadge.svelte
// component; this file only registers the `svg` slot.

import type { ColumnOptions, WebTheme } from "../../types";
import type { CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { BADGE, BADGE_VARIANTS } from "../../lib/rendering-constants";
import { parseFontSize } from "../../lib/typography-layout";
import { measureTextWidth } from "../../lib/width-utils";
import { resolveSemanticBundle } from "../../lib/semantic-styling";
import { escapeXml } from "../../lib/svg-text-utils";
import {
  getCssVars, readAccentDefault, readContentMuted,
  readBodyFamily, readBodySize,
} from "../../lib/theme/consumer-bridge";

interface BadgeOptions {
  variants?: Record<string, string>;
  colors?: Record<string, string> | string[];
  thresholds?: number[];
  shape?: "pill" | "circle" | "square";
  outline?: boolean;
}

interface BadgeGeometry {
  width: number;
  height: number;
  radius: number;
  fontSize: number;
}

function resolveBadgeColor(
  text: string,
  value: unknown,
  opts: BadgeOptions | undefined,
  theme: WebTheme,
  cellStyle: Parameters<typeof resolveSemanticBundle>[0],
  rowStyle: Parameters<typeof resolveSemanticBundle>[0],
): string {
  const cssVars = getCssVars(theme);
  // V3→V4: was `inputs?.secondary ?? inputs?.primary ?? theme.accent.default`.
  // Decorative/secondary dropped in V4; brand is the identity default.
  const glyphDefault = readAccentDefault(cssVars);

  const cellBundle = resolveSemanticBundle(cellStyle, theme);
  const rowBundle = resolveSemanticBundle(rowStyle, theme);
  const paintOverride = cellBundle?.markerFill ?? rowBundle?.markerFill ?? null;
  let color: string = paintOverride ?? glyphDefault;

  const thresholds = opts?.thresholds;
  const customColors = opts?.colors;
  const variants = opts?.variants;

  if (Array.isArray(thresholds) && thresholds.length > 0 && typeof value === "number") {
    const stops: string[] = (() => {
      if (Array.isArray(customColors) && customColors.length === thresholds.length + 1) {
        return customColors;
      }
      if (thresholds.length === 1) return [glyphDefault, theme.status?.negative ?? glyphDefault];
      if (thresholds.length === 2) return [
        theme.status?.positive ?? glyphDefault,
        theme.status?.warning ?? glyphDefault,
        theme.status?.negative ?? glyphDefault,
      ];
      return [glyphDefault];
    })();
    let idx = 0;
    for (const t of thresholds) { if (value >= t) idx++; else break; }
    color = stops[Math.min(idx, stops.length - 1)] ?? glyphDefault;
  } else if (customColors && !Array.isArray(customColors) && text in customColors) {
    color = (customColors as Record<string, string>)[text];
  } else if (variants && text in variants) {
    const variant = variants[text] as keyof typeof BADGE_VARIANTS | "default" | "muted";
    // Route through theme.status so a themed status color reaches the SVG
    // export — the DOM badge reads --tv-status-* (which alias theme.status),
    // so spreading the hardcoded BADGE_VARIANTS hex here drifted exports from
    // the live widget. BADGE_VARIANTS stays as the per-color fallback.
    const variantColors: Record<string, string> = {
      default: readAccentDefault(cssVars),
      success: theme.status?.positive ?? BADGE_VARIANTS.success,
      warning: theme.status?.warning ?? BADGE_VARIANTS.warning,
      error: theme.status?.negative ?? BADGE_VARIANTS.error,
      info: theme.status?.info ?? BADGE_VARIANTS.info,
      muted: readContentMuted(cssVars),
    };
    color = variantColors[variant] ?? glyphDefault;
  }
  return color;
}

function computeBadgeGeometry(
  text: string,
  shape: "pill" | "circle" | "square",
  theme: WebTheme,
): BadgeGeometry {
  const cssVars = getCssVars(theme);
  const baseFontSize = parseFontSize(readBodySize(cssVars));
  const fontSize = baseFontSize * BADGE.FONT_SCALE;
  const height = fontSize + BADGE.PADDING_Y * 2;
  const textWidth = measureTextWidth(text, fontSize, readBodyFamily(cssVars), 600);
  // Circle / square shapes are 1:1 aspect — use height as the
  // controlling dimension so "1" and "12" render the same diameter.
  const aspectShape = shape === "circle" || shape === "square";
  const width = aspectShape
    ? Math.max(height, textWidth + BADGE.PADDING_X)
    : textWidth + BADGE.PADDING_X * 2;
  const radius = shape === "square"
    ? 3
    : shape === "circle"
      ? height / 2
      : height / 2;  // pill
  return { width, height, radius, fontSize };
}

function buildBadgeMarkup(
  text: string,
  color: string,
  outline: boolean,
  geom: BadgeGeometry,
  theme: WebTheme,
): string {
  const cssVars = getCssVars(theme);
  const { width, height, radius, fontSize } = geom;
  // Escape color into the attribute: badge.colors is a user/theme-supplied map
  // reaching fill=/stroke= raw. `text` was already escaped; `color` is its
  // egress twin (defense in depth — the column_defaults ingress also gates it).
  const safeColor = escapeXml(color);
  const shapeAttrs = outline
    ? `fill="none" stroke="${safeColor}" stroke-width="1.5"`
    : `fill="${safeColor}" opacity="0.15"`;
  const rect = `<rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ${shapeAttrs}/>`;
  const label =
    `<text class="cell-text" dominant-baseline="central" ` +
    `x="${width / 2}" y="${height / 2}" text-anchor="middle" ` +
    `font-family="${readBodyFamily(cssVars)}" font-size="${fontSize}px" ` +
    `font-weight="600" fill="${safeColor}">${escapeXml(text)}</text>`;
  return rect + label;
}

const badgeSvgRenderer: CellFormatter = (value, options, ctx) => {
  const naText = ctx?.naText ?? null;
  if (value === undefined || value === null) {
    // Empty cell — emit a zero-dimension SVG so layout doesn't reserve
    // space for a non-existent badge. The legacy branch did the same
    // (the outer `if (badgeValue !== undefined && badgeValue !== null)`
    // skipped the entire badge emit).
    return { kind: "svg", markup: naText ? escapeXml(naText) : "", width: 0, height: 0 };
  }
  const theme = ctx?.theme as WebTheme | null | undefined;
  if (!theme) {
    // No theme passed — emit just the text (graceful fallback so unit
    // tests that omit theme still get visible output).
    return { kind: "svg", markup: escapeXml(String(value)), width: 0, height: 0 };
  }

  const opts = (options as ColumnOptions | undefined)?.badge as BadgeOptions | undefined;
  const text = String(value);
  const shape = opts?.shape ?? "pill";
  const outline = opts?.outline ?? false;
  const color = resolveBadgeColor(text, value, opts, theme, ctx?.cellStyle, undefined);
  const geom = computeBadgeGeometry(text, shape, theme);
  const markup = buildBadgeMarkup(text, color, outline, geom, theme);
  return { kind: "svg", markup, width: geom.width, height: geom.height };
};

/** Idempotent re-register helper. */
export function registerBadgeRenderer(): void {
  registerRenderers("badge", { svg: badgeSvgRenderer });
}

// Side-effect: register on first import.
registerBadgeRenderer();

// Export internals for testing.
export const __testing = {
  resolveBadgeColor,
  computeBadgeGeometry,
  buildBadgeMarkup,
};
