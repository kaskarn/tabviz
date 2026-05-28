// `heatmap` — concrete column schema for value-driven background
// color (heatmap cells). Own bucket "heatmap". Inherits BASE +
// formatted-number display via NUMERIC for the numeric label
// shown when `showValue` is true.

import type { ColumnSchema } from "../types";

export const HEATMAP_SCHEMA: ColumnSchema = {
  key: "heatmap",
  label: "Heatmap",
  glyph: "type.heatmap",
  defaultOpen: true,
  inherits: "numeric",
  type: "heatmap",
  bucket: "heatmap",
  category: "visual",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
  options: [
    {
      key: "palette",
      label: "Palette",
      // Palette is a list of hex colors. The editor surfaces this as a
      // custom control later (Phase 3+ adds PalettePicker); for now
      // declare the wire shape with a default 2-stop blue gradient.
      control: "custom",
      default: ["#f7fbff", "#08306b"],
      customComponent: "PalettePicker",
      hint: "2+ hex stops; interpolated by value",
    },
    {
      key: "minValue",
      label: "Min value",
      control: "number",
      default: null,
      hint: "Color-scale floor; auto from data when null",
    },
    {
      key: "maxValue",
      label: "Max value",
      control: "number",
      default: null,
      hint: "Color-scale ceiling; auto from data when null",
    },
    {
      key: "showValue",
      label: "Show value",
      control: "toggle",
      default: true,
      hint: "Numeric label over the color cell",
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
  ],
};
