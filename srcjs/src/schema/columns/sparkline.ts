// `sparkline` — concrete column schema for inline micro-chart over
// an array of values per row. Own bucket "sparkline". Inherits BASE
// only — NOT TEXT (cells render a chart, no text) and NOT through a
// path that includes the sortable capability (array-per-row data has
// no scalar ordering; sortable is force-disabled below).

import type { ColumnSchema } from "../types";

export const SPARKLINE_SCHEMA: ColumnSchema = {
  key: "sparkline",
  label: "Sparkline",
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
      segments: [
        { value: "line", label: "Line" },
        { value: "bar",  label: "Bar" },
        { value: "area", label: "Area" },
      ],
    },
    {
      key: "height",
      label: "Height",
      control: "integer",
      default: 20,
      min: 8,
      max: 80,
      step: 1,
    },
    {
      key: "color",
      label: "Color",
      control: "color",
      default: null,
      hint: "Theme primary by default",
    },
  ],
};
