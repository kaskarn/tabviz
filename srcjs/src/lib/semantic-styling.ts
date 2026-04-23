/**
 * Semantic-bundle resolution.
 *
 * Every consumer of semantic classes (live widget, static SVG export, marker
 * cascade) routes through this module so there's exactly one place where
 * "which flag is active" turns into "which visual bundle applies." Flags
 * stay as plain booleans on `RowStyle` / `CellStyle`; this is where they
 * get translated into the `SemanticBundle` the renderer actually paints.
 *
 * Precedence when multiple flags are set: `accent > emphasis > muted`.
 * This matches the historical rendering path in `svg-generator.ts` (accent
 * overrode emphasis overrode muted for text color). The three tokens are
 * categories, not severity ratings — the order is conventional, not
 * semantic.
 */
import type { RowStyle, CellStyle, SemanticBundle, Semantics, WebTheme } from "$types";

/** A plain all-null bundle — handy when code needs a non-null sentinel. */
export const EMPTY_BUNDLE: SemanticBundle = {
  fg: null,
  bg: null,
  border: null,
  markerFill: null,
  fontWeight: null,
  fontStyle: null,
};

/** True if at least one field in the bundle is non-null. */
export function bundleIsActive(b: SemanticBundle | null | undefined): boolean {
  if (!b) return false;
  return (
    b.fg != null ||
    b.bg != null ||
    b.border != null ||
    b.markerFill != null ||
    b.fontWeight != null ||
    b.fontStyle != null
  );
}

/**
 * Which semantic token (if any) applies to this style, respecting precedence.
 * Exported so the marker cascade can know *which* bundle to reach for without
 * re-deriving precedence.
 */
export function activeSemanticToken(
  style: RowStyle | CellStyle | undefined | null,
): keyof Semantics | null {
  if (!style) return null;
  if (style.accent) return "accent";
  if (style.emphasis) return "emphasis";
  if (style.muted) return "muted";
  return null;
}

/**
 * Resolve the visual bundle for a row or cell style. Returns `null` when no
 * semantic flag is set (so consumers can short-circuit) — not an empty
 * bundle, to keep "no-op" distinct from "all-inherit."
 */
export function resolveSemanticBundle(
  style: RowStyle | CellStyle | undefined | null,
  theme: WebTheme | undefined | null,
): SemanticBundle | null {
  if (!theme?.semantics) return null;
  const token = activeSemanticToken(style);
  if (!token) return null;
  return theme.semantics[token];
}
