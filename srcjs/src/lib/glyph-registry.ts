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

  // ---- LOTR easter-egg glyphs (dwarven / elvish / hobbit) ------------
  // Bespoke shapes for the lotr theme presets. Hand-rolled to read at
  // small sizes and fall back gracefully under stroke-only rendering.

  // Dwarven set — absolute-coord paths for reliable rendering at small sizes
  pickaxe: {
    path: "M4 20L14 10M5 5L21 11L15 15Z",
    viewBox: "0 0 24 24",
  },
  anvil: {
    path: "M3 8H21V12H3ZM10 12H14V18H10ZM4 18H20L18 22H6Z",
    viewBox: "0 0 24 24",
  },
  gem: {
    path: "M8 3H16L21 10L12 22L3 10ZM3 10H21M8 3L12 10L16 3",
    viewBox: "0 0 24 24",
  },
  ale_mug: {
    path: "M5 8H15V20H5ZM15 11H19V16H15ZM5 8L8 5L11 8L14 5L15 8",
    viewBox: "0 0 24 24",
  },
  rune: {
    path: "M7 3V21M7 5L15 3M7 12L15 10",
    viewBox: "0 0 24 24",
  },

  // Elvish set
  crescent: {
    path: "M16 4a8 8 0 1 0 0 16 6 6 0 1 1 0-16z",
    viewBox: "0 0 24 24",
  },
  harp: {
    path: "M5 3h14L12 22zM9 3l1 18M13 3l-1 18M17 3l-3 18",
    viewBox: "0 0 24 24",
  },
  tree: {
    path: "M12 2L4 18h16zM10 18v4h4v-4z",
    viewBox: "0 0 24 24",
  },
  bow: {
    path: "M5 4q12 8 0 16M3 12h18M17 8l4 4-4 4",
    viewBox: "0 0 24 24",
  },
  swan: {
    path: "M3 18q3-6 11-4q5 1 7 4zM18 14q2-7-3-9",
    viewBox: "0 0 24 24",
  },

  // Hobbit set
  pipe: {
    path: "M2 17H14V20H2ZM14 17V8H22V20H14Z",
    viewBox: "0 0 24 24",
  },
  mushroom: {
    path: "M 2 13 A 10 9 0 0 1 22 13 L 2 13 Z M 10 13 L 10 22 L 14 22 L 14 13 Z",
    viewBox: "0 0 24 24",
  },
  footprint: {
    path: "M6 16Q4 8 9 6Q15 5 18 9Q20 14 18 19Q15 22 11 21Q7 20 6 16Z",
    viewBox: "0 0 24 24",
  },
  jar: {
    path: "M7 3H17V6H7ZM5 6H19V22H5ZM7 13H17M7 18H17",
    viewBox: "0 0 24 24",
  },
  pie: {
    path: "M12 12V4A8 8 0 1 1 4 12Z",
    viewBox: "0 0 24 24",
  },

  // LOTR universals
  ring: {
    path: "M12 4A8 8 0 1 0 12 20A8 8 0 1 0 12 4ZM12 9A3 3 0 1 1 12 15A3 3 0 1 1 12 9Z",
    viewBox: "0 0 24 24",
  },
  eye: {
    path: "M2 12Q12 4 22 12Q12 20 2 12ZM9 12A3 3 0 1 0 15 12A3 3 0 1 0 9 12Z",
    viewBox: "0 0 24 24",
  },
  sword: {
    path: "M11 2L13 2L13 16L11 16ZM6 16L18 16L18 18L6 18ZM11 18L13 18L13 22L11 22Z",
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
