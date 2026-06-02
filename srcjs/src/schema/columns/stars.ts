// `stars` — concrete column schema for star ratings. Thin alias over
// PICTOGRAM with the glyph pinned to "star" and a rating-friendly
// `maxGlyphs` default.
//
// Wire `type` is "stars" — matches what the editor's column-types
// picker emits (`lib/column-types.ts`) and what the OLD
// `glyphNaturalWidth` switch checked. R-side `col_stars()` delegates
// to `col_pictogram()` so R-authored stars columns wire as
// "pictogram" and resolve via PICTOGRAM_SCHEMA instead — same visual
// outcome since both produce a pictogram with `glyph: "star"`.

import type { ColumnSchema } from "../types";

export const STARS_SCHEMA: ColumnSchema = {
  key: "stars",
  flexWeight: 0.3,
  label: "Stars",
  glyph: "type.stars",
  defaultOpen: true,
  inherits: "pictogram",
  type: "stars",
  bucket: "stars",
  category: "glyph",
  slots: [
    { key: "field", label: "Rating", accepts: ["numeric", "integer"], required: true },
  ],
  optionOverrides: {
    glyph: "star",
    maxGlyphs: 5,
  },
  options: [],
};
