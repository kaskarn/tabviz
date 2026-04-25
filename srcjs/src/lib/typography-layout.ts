/**
 * Typography-aware layout helpers shared between the live forest widget
 * (forestStore + ForestPlot.svelte) and the SVG export (svg-generator.ts).
 *
 * Both paths used to depend on hardcoded `LAYOUT.AXIS_HEIGHT (32)`,
 * `LAYOUT.AXIS_LABEL_HEIGHT (32)`, and `TYPOGRAPHY.{TITLE,SUBTITLE,…}_HEIGHT`
 * constants tuned for one font profile. When users raised font sizes the
 * SVG truncated; when they shrunk fonts the SVG over-reserved.
 *
 * These helpers derive every reserved-text-region from the theme's
 * `fontSize × lineHeight` so the math is correct for any font profile
 * AND identical between the live widget's layout engine and the SVG
 * exporter.
 */

import { TYPOGRAPHY } from "./rendering-constants";

/**
 * Parse a CSS font-size string ("0.875rem", "14px", "10pt") to pixels.
 * Falls back to TYPOGRAPHY.DEFAULT_FONT_SIZE for unrecognized units.
 */
export function parseFontSize(size: string): number {
  let value: number;
  if (size.endsWith("rem")) {
    value = parseFloat(size) * TYPOGRAPHY.REM_BASE;
  } else if (size.endsWith("px")) {
    value = parseFloat(size);
  } else if (size.endsWith("pt")) {
    value = parseFloat(size) * TYPOGRAPHY.PT_TO_PX;
  } else {
    value = TYPOGRAPHY.DEFAULT_FONT_SIZE;
  }
  return Math.round(value * 100) / 100;
}

/**
 * Height a single line of text claims given font size + line height.
 * `ceil(fontSize * lineHeight)` matches what the browser reserves.
 */
export function textRegionHeight(fontSizeStr: string, lineHeight: number): number {
  return Math.ceil(parseFontSize(fontSizeStr) * lineHeight);
}

/**
 * Compute the axis layout from typography. Returns the precise pixel
 * positions for the tick mark, tick label baseline, axis label baseline,
 * and total axis region height (= what the layout engine reserves below
 * the rows).
 *
 * Geometry (relative to the axis line at y=0):
 *   y=0..tickMarkLength : tick mark
 *   y=tickLabelY        : tick label baseline (below tick marks)
 *   y=axisLabelY        : axis label baseline (0 when no axis label)
 *   y=axisRegionHeight  : end of axis region
 *
 * For the default font profile (fontSizeSm = 0.75rem = 12px, line-height
 * 1.5) tickLabelY=14 and axisLabelY=28 — matches the prior hardcoded
 * values exactly; only the over-reserved trailing buffer shrinks.
 */
export function computeAxisLayout(
  typography: { fontSizeSm: string; lineHeight: number },
  hasAxisLabel: boolean,
): {
  tickMarkLength: number;
  tickLabelY: number;
  axisLabelY: number;
  axisRegionHeight: number;
} {
  const tickFontSize = parseFontSize(typography.fontSizeSm);
  const axisLabelFontSize = parseFontSize(typography.fontSizeSm);
  const tickMarkLength = 4;
  const tickLabelY = tickMarkLength + Math.round(tickFontSize * 0.85);
  const axisLabelY = hasAxisLabel
    ? tickLabelY + Math.round(axisLabelFontSize * 1.2)
    : 0;
  const lastBaseline = hasAxisLabel ? axisLabelY : tickLabelY;
  const axisRegionHeight = lastBaseline + Math.round(tickFontSize * 0.4) + 2;
  return { tickMarkLength, tickLabelY, axisLabelY, axisRegionHeight };
}
