// `progress` — concrete column schema for progress bars. Same shape
// as BAR with a different visual conceptual model (filled track
// expressing completion / score / utilization) and a max-value
// default of 100. Own bucket "progress".

import type { ColumnSchema } from "../types";

export const PROGRESS_SCHEMA: ColumnSchema = {
  key: "progress",
  flexWeight: 3,
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
      kind: "core",
      hint: "Track 100% reference",
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
    {
      key: "showLabel",
      label: "Show value",
      control: "toggle",
      default: true,
      kind: "editor",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "color",
      label: "Fill color",
      control: "color",
      default: null,
      kind: "styling",
      hint: "Theme primary by default",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
  ],
};
