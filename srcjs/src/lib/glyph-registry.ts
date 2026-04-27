/**
 * Shared glyph registry for column types that render small inline SVG marks
 * (col_pictogram primarily; col_icon may adopt later).
 *
 * Each glyph is a single SVG `<path>` data string plus a viewBox. Renderers
 * decide whether to fill or stroke the path based on state:
 *   filled  → <path d=... fill="currentColor" stroke="none">
 *   empty   → <path d=... fill="none" stroke="currentColor" stroke-width="1.5">
 *
 * Glyph paths are hand-curated for tabviz. Designed to read at ~12-20px
 * and degrade gracefully when stroked vs filled. Keep the set small and
 * curated — dumping in 200 icons defeats the "small CRAN-friendly bundle"
 * goal. If a glyph doesn't appear here, callers can pass a literal unicode
 * char (resolveGlyph below).
 */

export interface GlyphDef {
  /** SVG path data. */
  path: string;
  /** SVG viewBox string. All registry glyphs use "0 0 24 24". */
  viewBox: string;
}

export const GLYPH_REGISTRY: Readonly<Record<string, GlyphDef>> = {
  person: {
    path: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-7 11v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2",
    viewBox: "0 0 24 24",
  },
  skull: {
    path: "M12 2a8 8 0 0 0-8 8v5h2v3h2v2h8v-2h2v-3h2v-5a8 8 0 0 0-8-8zm-3 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
    viewBox: "0 0 24 24",
  },
  dot: {
    path: "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
    viewBox: "0 0 24 24",
  },
  coin: {
    path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10z",
    viewBox: "0 0 24 24",
  },
  heart: {
    path: "M12 21s-7-4.5-9.5-9C.5 7 4 3 8 3c2 0 3 1 4 2 1-1 2-2 4-2 4 0 7.5 4 5.5 9-2.5 4.5-9.5 9-9.5 9z",
    viewBox: "0 0 24 24",
  },
  leaf: {
    path: "M5 19c5 1 13-3 14-12 0-1-1-2-2-2-9 1-13 9-12 14z",
    viewBox: "0 0 24 24",
  },
  mountain: {
    path: "M3 21l6-12 5 8 3-5 4 9z",
    viewBox: "0 0 24 24",
  },
  flame: {
    path: "M12 2c0 4-3 4-3 8a3 3 0 0 0 6 0c0-1-.5-2-1-3 1 1 4 4 4 7a6 6 0 1 1-12 0c0-5 6-7 6-12z",
    viewBox: "0 0 24 24",
  },
  flag: {
    path: "M5 3v18M5 4l7 1 7-2v10l-7 2-7-1",
    viewBox: "0 0 24 24",
  },
  square: {
    path: "M4 4h16v16H4z",
    viewBox: "0 0 24 24",
  },
  triangle: {
    path: "M12 3l10 17H2z",
    viewBox: "0 0 24 24",
  },
  star: {
    path: "M12 2l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z",
    viewBox: "0 0 24 24",
  },
  sun: {
    path: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
    viewBox: "0 0 24 24",
  },
  droplet: {
    path: "M12 2c-4 6-7 9-7 13a7 7 0 0 0 14 0c0-4-3-7-7-13z",
    viewBox: "0 0 24 24",
  },
  hexagon: {
    path: "M12 2l9 5v10l-9 5-9-5V7z",
    viewBox: "0 0 24 24",
  },
};

/**
 * Stable list of registry names. Mirrored on the R side
 * (`R/glyph-registry.R::glyph_registry_names()`) for `assert_choice`
 * validation. If you add a glyph, update both files.
 */
export const GLYPH_NAMES: readonly string[] = Object.keys(GLYPH_REGISTRY);

/**
 * Resolve a `glyph` spec string to either a registry hit (SVG path) or
 * a literal character to render with the surrounding font.
 *
 * The spec is treated as a registry name first; on miss it's treated as
 * a literal unicode/emoji string. Empty/whitespace input returns null.
 */
export type ResolvedGlyph =
  | { kind: "registry"; name: string; def: GlyphDef }
  | { kind: "literal"; char: string }
  | null;

export function resolveGlyph(spec: string | null | undefined): ResolvedGlyph {
  if (spec == null) return null;
  const trimmed = spec.trim();
  if (trimmed === "") return null;
  const hit = GLYPH_REGISTRY[trimmed];
  if (hit) return { kind: "registry", name: trimmed, def: hit };
  return { kind: "literal", char: trimmed };
}
