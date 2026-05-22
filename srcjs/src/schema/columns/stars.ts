// `stars` — concrete column schema for star ratings. Thin alias over
// PICTOGRAM with the glyph pinned to "star" and a rating-friendly
// `maxGlyphs` default. Wire bucket is "pictogram" (same as parent —
// no separate wire shape).

import type { ColumnSchema } from "../types";

export const STARS_SCHEMA: ColumnSchema = {
  key: "stars",
  label: "Stars",
  defaultOpen: true,
  inherits: "pictogram",
  type: "pictogram",
  bucket: "pictogram",
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
