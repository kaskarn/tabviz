/**
 * Marker styling cascade for viz columns.
 *
 * Resolves a single (fill, stroke, strokeWidth) for a viz glyph (forest
 * marker, bar, box, violin) by walking a 4-layer precedence stack. Most
 * specific wins; NA / missing at a layer falls through to the next.
 *
 *   Layer 4: per-row literal `marker_color` (highest priority)
 *   Layer 3: per-row semantic class (`row_accent` / `row_emphasis` / `row_muted`)
 *            - single-effect viz: replaces fill with theme color
 *            - multi-effect viz : preserves per-effect fill, adds outline
 *   Layer 2: per-effect literal color (already resolved into effectColor)
 *   Layer 1: theme palette default       (already resolved into effectColor)
 *
 * Layers 1+2 are pre-resolved by the caller into `effectColor`.
 */

import type { WebTheme, RowStyle } from "$types";
import { resolveSemanticBundle } from "./semantic-styling";

export interface ResolvedMarkerStyle {
  fill: string;
  stroke: string | null;
  strokeWidth: number;
}

/**
 * Pull the marker-fill override for a row's active semantic class, if any.
 *
 * Previously reached directly into `theme.colors.{accent|foreground|muted}`
 * to derive the color — which conflated palette slots with semantic roles,
 * and ignored the fact that users might want a completely different color
 * (or none at all) for a semantic class. Now defers to the theme's
 * `SemanticBundle.markerFill` via the shared resolver, which returns `null`
 * when the active bundle opts out of the marker cascade.
 */
export function semanticColorFor(
  style: RowStyle | null | undefined,
  theme: WebTheme | undefined,
): string | null {
  if (!theme) return null;
  const bundle = resolveSemanticBundle(style, theme);
  return bundle?.markerFill ?? null;
}

/** Stroke companion to `semanticColorFor`. When the active semantic
 *  bundle pins `markerStroke`, callers can pair it with the fill so a
 *  recolored marker rides a coherent line (whiskers in forest plots,
 *  outlines around glyphs). Returns null when the bundle opts out. */
export function semanticStrokeFor(
  style: RowStyle | null | undefined,
  theme: WebTheme | undefined,
): string | null {
  if (!theme) return null;
  const bundle = resolveSemanticBundle(style, theme);
  return bundle?.markerStroke ?? null;
}

/**
 * Resolve marker styling for one glyph.
 *
 * @param effectColor   The fill that would be used absent any row override
 *                      (per-effect literal, or palette cycle — caller resolves).
 * @param rowMarkerColor Per-row literal color (`marker_color`); `null`/`undefined`
 *                      means "no override, fall through".
 * @param rowStyle      The row's RowStyle (for semantic class detection).
 * @param numEffects    Number of effects in this viz column. >1 triggers
 *                      multi-effect outline behavior; 1 uses fill replace.
 * @param theme         Active theme (for semantic→color mapping).
 */
export function resolveMarkerStyle(
  effectColor: string,
  rowMarkerColor: string | null | undefined,
  rowStyle: RowStyle | null | undefined,
  numEffects: number,
  theme: WebTheme | undefined,
): ResolvedMarkerStyle {
  // Layer 4: per-row literal wins everything
  if (rowMarkerColor) {
    return { fill: rowMarkerColor, stroke: null, strokeWidth: 0 };
  }

  // Layer 3: row semantic class
  const semantic = semanticColorFor(rowStyle, theme);
  if (semantic) {
    if (numEffects > 1) {
      // Augment: keep per-effect fill, add outline in semantic color
      return { fill: effectColor, stroke: semantic, strokeWidth: 1.5 };
    }
    // Single-effect: replace fill with semantic color
    return { fill: semantic, stroke: null, strokeWidth: 0 };
  }

  // Layers 1+2: defaults already resolved into effectColor
  return { fill: effectColor, stroke: null, strokeWidth: 0 };
}
