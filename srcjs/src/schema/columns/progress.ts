// `progress` — concrete column schema for progress bars. Same shape
// as BAR with a different visual conceptual model (filled track
// expressing completion / score / utilization) and a max-value
// default of 100. Own bucket "progress".

import type { ColumnSchema } from "../types";

export const PROGRESS_SCHEMA: ColumnSchema = {
  key: "progress",
  label: "Progress",
  glyph: "type.progress",
  defaultOpen: true,
  inherits: "base",
  type: "progress",
  bucket: "progress",
  category: "visual",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
  options: [
    {
      key: "maxValue",
      label: "Max value",
      control: "number",
      default: 100,
      hint: "Track 100% reference",
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
    },
    {
      key: "color",
      label: "Fill color",
      control: "color",
      default: null,
      hint: "Theme primary by default",
    },
  ],
};
