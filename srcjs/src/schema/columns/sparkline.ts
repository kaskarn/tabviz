// `sparkline` — concrete column schema for inline micro-chart over
// an array of values per row. Own bucket "sparkline". Inherits BASE
// only — NOT TEXT (cells render a chart, no text) and NOT through a
// path that includes the sortable capability (array-per-row data has
// no scalar ordering; sortable is force-disabled below).

import type { ColumnSchema } from "../types";

export const SPARKLINE_SCHEMA: ColumnSchema = {
  key: "sparkline",
  flexWeight: 3,
  naturalWidthPx: 80,
  label: "Sparkline",
  glyph: "type.sparkline",
  defaultOpen: true,
  inherits: "base",
  type: "sparkline",
  bucket: "sparkline",
  category: "visual",
  slots: [
    { key: "field", label: "Series", accepts: ["array-numeric"], required: true },
  ],
  optionOverrides: {
    sortable: false,
  },
  fixed: {
    // Sparkline cells are array-valued; the renderer + UI lock sort off.
    // The optionOverride above sets the default; fixed signals the
    // editor to hide the toggle entirely.
    sortable: false,
  },
  options: [
    {
      key: "type",
      label: "Type",
      control: "segmented",
      default: "line",
      kind: "core",
      segments: [
        { value: "line", label: "Line" },
        { value: "bar",  label: "Bar" },
        { value: "area", label: "Area" },
      ],
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "height",
      label: "Height",
      control: "integer",
      default: 20,
      kind: "presentation",
      min: 8,
      max: 80,
      step: 1,
      consumedBy: ["renderCell", "naturalHeight", "emitSource", "editor"],
    },
    {
      key: "color",
      label: "Color",
      control: "color",
      default: null,
      kind: "styling",
      hint: "Theme primary by default",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
  ],
};
