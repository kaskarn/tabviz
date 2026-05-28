// `bar` — concrete column schema for inline bar charts.
// Inherits BASE (sortable, layout). Own bucket "bar". Doesn't inherit
// TEXT — the cell renders a bar SVG, with an optional value label
// driven by showLabel.

import type { ColumnSchema } from "../types";

export const BAR_SCHEMA: ColumnSchema = {
  key: "bar",
  label: "Bar",
  glyph: "type.bar",
  defaultOpen: true,
  inherits: "base",
  type: "bar",
  bucket: "bar",
  category: "visual",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
  options: [
    {
      key: "maxValue",
      label: "Max value",
      control: "number",
      default: null,
      hint: "Bar 100% reference; auto from data when null",
    },
    {
      key: "scale",
      label: "Scale",
      control: "segmented",
      default: "linear",
      segments: [
        { value: "linear", label: "Linear" },
        { value: "log",    label: "Log" },
        { value: "sqrt",   label: "Sqrt" },
      ],
    },
    {
      key: "showLabel",
      label: "Show value",
      control: "toggle",
      default: true,
      hint: "Numeric label alongside the bar",
    },
    {
      key: "color",
      label: "Bar color",
      control: "color",
      default: null,
      hint: "Theme primary by default",
    },
  ],
};
