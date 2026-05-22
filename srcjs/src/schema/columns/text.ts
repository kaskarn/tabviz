// `text` — concrete column schema for cell-text rendering.
// Inherits BASE (which already carries sortable=true; lexicographic
// sort on text values is meaningful). Adds wrap/naText/maxChars —
// knobs only relevant when a column actually paints text in cells.
//
// Pure-visual columns (sparkline, viz_*) inherit only BASE and skip
// TEXT — they get the universal layout knobs but not the
// text-rendering surface.

import type { ColumnSchema } from "../types";

export const TEXT_SCHEMA: ColumnSchema = {
  key: "text",
  label: "Text",
  defaultOpen: false,
  inherits: "base",
  type: "text",
  bucket: "text",
  category: "text",
  slots: [
    { key: "field", label: "Value", accepts: ["string", "numeric", "integer", "logical", "date"], required: true },
  ],
  options: [
    {
      key: "wrap",
      label: "Wrap",
      control: "toggle",
      default: false,
      hint: "Allow multi-line cells",
      at: "fixed",
    },
    {
      key: "naText",
      label: "Missing value",
      control: "text",
      default: null,
      hint: "Shown when the cell is NA / null",
      // Legacy wire path: `column.options.naText` (top-level, not
      // in any bucket). 13+ reader sites in the renderer + SVG
      // exporter.
      at: "top",
    },
    {
      key: "maxChars",
      label: "Max chars",
      control: "integer",
      default: null,
      hint: "Truncate with trailing ellipsis when over",
      min: 1,
    },

    // ── Styling overrides ─────────────────────────────────────────────
    // Font class — same "stay inside the cascade" pattern as BASE.token.
    // The theme defines what each class resolves to (font family, weight,
    // numeric variants); the column just picks which class to use. Raw
    // font-family override would be the escape hatch — added later if
    // there's demand, but the cascade-first surface is the primary one.
    //
    // Numeric columns inherit this from TEXT — a numeric column might
    // want "mono" or "number" defaults via optionOverrides without
    // touching the cascade.
    {
      key: "fontClass",
      label: "Font class",
      control: "value-or-field",
      valueControl: "segmented",
      segments: [
        { value: "base",    label: "Base" },
        { value: "display", label: "Display" },
        { value: "number",  label: "Number" },
        { value: "mono",    label: "Mono" },
      ],
      kind: "styling",
      default: null,
      hint: "Theme decides which family / weight / numeric variant",
      accepts: ["string"],
    },

    // Reserved for future text-styling escape hatches (raw color /
    // weight / italic) — lifted from styleMapping in Phase 3, with the
    // same value-or-field control. Token + font-class above stay the
    // primary surface; these come below in the editor.
  ],
};
