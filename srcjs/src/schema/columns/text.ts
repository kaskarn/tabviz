// `text` — concrete column schema for cell-text rendering.
// Inherits BASE (layout/header knobs) and SORTABLE (lexicographic
// sort on text values). Adds wrap/naText/maxChars — knobs only
// relevant when a column actually paints text in cells.
//
// Pure-visual columns (sparkline, viz_*) inherit only BASE and skip
// TEXT — they get the universal layout knobs but not the
// text-rendering surface.

import type { ColumnSchema } from "../types";

export const TEXT_SCHEMA: ColumnSchema = {
  key: "text",
  label: "Text",
  defaultOpen: false,
  inherits: ["base", "sortable"],
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
    // Reserved for future text-styling additions (bold/italic/color).
    // Today those live as per-cell style mappings (`row_color_col`,
    // styleMapping); when we lift them to per-column toggles they go
    // here so every text-rendering column inherits the surface.
  ],
};
