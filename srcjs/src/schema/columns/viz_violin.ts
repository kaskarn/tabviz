// `viz_violin` — concrete column schema for inline violin plots.
// Effects array (one per series). Each effect carries raw array
// data; the renderer computes KDE. Inherits VIZ.

import type { ColumnSchema } from "../types";

export const VIZ_VIOLIN_SCHEMA: ColumnSchema = {
  key: "viz_violin",
  label: "Viz: violin",
  glyph: "type.violin",
  defaultOpen: true,
  inherits: "viz",
  type: "viz_violin",
  bucket: "vizViolin",
  category: "viz",
  slots: [],
  options: [
    {
      key: "effects",
      label: "Effects",
      control: "custom",
      default: [],
      kind: "core",
      customComponent: "EffectViolinList",
      hint: "One or more array-valued series",
    },
    {
      key: "bandwidth",
      label: "Bandwidth",
      control: "number",
      default: null,
      kind: "core",
      hint: "KDE bandwidth; Silverman default when null",
    },
    {
      key: "showMedian",
      label: "Show median",
      control: "toggle",
      default: true,
      kind: "editor",
    },
    {
      key: "showQuartiles",
      label: "Show quartiles",
      control: "toggle",
      default: false,
      kind: "editor",
    },
    {
      key: "maxWidth",
      label: "Max width",
      control: "integer",
      default: null,
      kind: "editor",
      min: 1,
    },
  ],
};
