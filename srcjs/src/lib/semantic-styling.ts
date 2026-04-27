/**
 * Semantic-bundle resolution.
 *
 * Every consumer of semantic classes (live widget, static SVG export,
 * marker cascade) routes through this module so there's exactly one place
 * where "which flag is active" turns into "which visual bundle applies."
 * Flags stay as plain booleans on `RowStyle` / `CellStyle`; this is where
 * they get translated into the `SemanticBundle` the renderer actually
 * paints.
 *
 * Five tokens are recognized:
 *   muted, bold, emphasis, accent, fill
 * Precedence (loud → quiet) when multiple flags are set:
 *   fill > accent > emphasis > bold > muted.
 * "Loud" means "more visually intense"; this is what we keep when several
 * data columns flip flags on the same row, since the most-visible
 * treatment is what the user is asking for.
 *
 * Wire shape: bundles live at `theme.row.{token}` (RowCluster on the
 * v2 R-side). The dedicated `theme.semantics` block was a v1 carry-over
 * that's no longer emitted; this resolver now reads the v2 path.
 */
import type {
  RowStyle, CellStyle, SemanticBundle, SemanticToken, WebTheme,
} from "$types";

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
): SemanticToken | null {
  if (!style) return null;
  if (style.fill) return "fill";
  if (style.accent) return "accent";
  if (style.emphasis) return "emphasis";
  if (style.bold) return "bold";
  if (style.muted) return "muted";
  return null;
}

/**
 * Resolve the visual bundle for a row or cell style. Returns `null` when no
 * semantic flag is set (so consumers can short-circuit) — not an empty
 * bundle, to keep "no-op" distinct from "all-inherit."
 *
 * Reads `theme.row.{token}` (the v2 path). The historical v1 path read
 * `theme.semantics[token]` which v2 themes don't emit — that's why the
 * painter appeared to do nothing visually before this fix.
 */
export function resolveSemanticBundle(
  style: RowStyle | CellStyle | undefined | null,
  theme: WebTheme | undefined | null,
): SemanticBundle | null {
  const row = (theme as unknown as { row?: Record<string, SemanticBundle> } | undefined | null)?.row;
  if (!row) return null;
  const token = activeSemanticToken(style);
  if (!token) return null;
  return row[token] ?? null;
}
