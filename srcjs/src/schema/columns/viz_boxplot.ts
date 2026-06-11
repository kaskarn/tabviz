// `viz_boxplot` — concrete column schema for inline boxplots.
// Effects array (one per series). Either raw `data` arrays or
// pre-computed quantile fields (min/q1/median/q3/max). Inherits VIZ.

import type { ColumnSchema } from "../types";

export const VIZ_BOXPLOT_SCHEMA: ColumnSchema = {
  key: "viz_boxplot",
  flexWeight: 6,
  naturalWidthPx: 200,
  label: "Viz: boxplot",
  glyph: "type.boxplot",
  defaultOpen: true,
  inherits: "viz",
  type: "viz_boxplot",
  bucket: "vizBoxplot",
  category: "viz",
  slots: [],
  options: [
    {
      key: "effects",
      label: "Effects",
      control: "custom",
      default: [],
      kind: "core",
      customComponent: "EffectBoxplotList",
      hint: "Raw arrays or quantile fields",
      consumedBy: ["contributeBanks", "renderCell", "emitSource", "editor"],
    },
    {
      key: "showOutliers",
      label: "Show outliers",
      control: "toggle",
      default: true,
      kind: "presentation",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
  ],
};
