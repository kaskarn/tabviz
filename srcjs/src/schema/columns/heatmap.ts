// `heatmap` — concrete column schema for value-driven background
// color (heatmap cells). Own bucket "heatmap". Inherits BASE +
// formatted-number display via NUMERIC for the numeric label
// shown when `showValue` is true.

import type { ColumnSchema } from "../types";

export const HEATMAP_SCHEMA: ColumnSchema = {
  key: "heatmap",
  flexWeight: 3,
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
      control: "custom",
      default: ["#f7fbff", "#08306b"],
      kind: "styling",
      customComponent: "PalettePicker",
      hint: "2+ hex stops; interpolated by value",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "minValue",
      label: "Min value",
      control: "number",
      default: null,
      kind: "core",
      hint: "Color-scale floor; auto from data when null",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "maxValue",
      label: "Max value",
      control: "number",
      default: null,
      kind: "core",
      hint: "Color-scale ceiling; auto from data when null",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "showValue",
      label: "Show value",
      control: "toggle",
      default: true,
      kind: "editor",
      hint: "Numeric label over the color cell",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "scale",
      label: "Scale",
      control: "segmented",
      default: "linear",
      kind: "core",
      segments: [
        { value: "linear", label: "Linear" },
        { value: "log",    label: "Log" },
        { value: "sqrt",   label: "Sqrt" },
      ],
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
  ],
};
