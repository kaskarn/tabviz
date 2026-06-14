// Shared cell color-resolution cascades.
//
// Every glyph cell renderer (bar / progress / sparkline / icon / pictogram /
// badge / ring) resolves its mark color through the SAME precedence chain.
// These were copy-pasted byte-for-byte into each `*-renderer.ts`; centralizing
// them here keeps the cascade single-sourced (one place to evolve the V4 brand
// routing, one place the DOM↔export parity depends on).

import type { WebTheme } from "../types";
import { resolveSemanticBundle } from "./semantic-styling";
import { getCssVars, readAccentDefault } from "./theme/consumer-bridge";

type StyleArg = Parameters<typeof resolveSemanticBundle>[0];

/**
 * The marker-fill cascade shared by bar/progress/sparkline/icon/pictogram:
 *   explicit option color > cell paint markerFill > row paint markerFill >
 *   theme accent default.
 * (V3→V4: the old `theme.inputs.primary ?? theme.accent.default` tail collapsed
 *  to the brand-derived accent default.)
 */
export function resolveMarkerColor(
  colorOpt: string | undefined,
  cellStyle: StyleArg,
  rowStyle: StyleArg,
  theme: WebTheme,
): string {
  return colorOpt
    ?? resolveSemanticBundle(cellStyle, theme)?.markerFill
    ?? resolveSemanticBundle(rowStyle, theme)?.markerFill
    ?? readAccentDefault(getCssVars(theme));
}

/**
 * Build the threshold→color `stops[]` array for value-bucketed glyphs
 * (badge, ring): explicit `customColors` when it's exactly one longer than the
 * thresholds, otherwise a status-derived ramp (1 threshold → default/negative;
 * 2 → positive/warning/negative), falling back to `glyphDefault`.
 */
export function buildThresholdStops(
  thresholds: number[],
  customColors: string[] | undefined,
  theme: WebTheme,
  glyphDefault: string,
): string[] {
  if (Array.isArray(customColors) && customColors.length === thresholds.length + 1) {
    return customColors;
  }
  if (thresholds.length === 1) return [glyphDefault, theme.status?.negative ?? glyphDefault];
  if (thresholds.length === 2) {
    return [
      theme.status?.positive ?? glyphDefault,
      theme.status?.warning ?? glyphDefault,
      theme.status?.negative ?? glyphDefault,
    ];
  }
  return [glyphDefault];
}
