// `viz_boxplot` — concrete column schema for inline boxplots.
// Effects array (one per series). Either raw `data` arrays or
// pre-computed quantile fields (min/q1/median/q3/max). Inherits VIZ.

import type { ColumnSchema } from "../types";

export const VIZ_BOXPLOT_SCHEMA: ColumnSchema = {
  key: "viz_boxplot",
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
      customComponent: "EffectBoxplotList",
      hint: "Raw arrays or quantile fields",
    },
    {
      key: "showOutliers",
      label: "Show outliers",
      control: "toggle",
      default: true,
    },
    {
      key: "whiskerType",
      label: "Whiskers",
      control: "segmented",
      default: "iqr",
      segments: [
        { value: "iqr",    label: "IQR" },
        { value: "minmax", label: "Min-max" },
      ],
    },
    {
      key: "boxWidth",
      label: "Box width",
      control: "integer",
      default: null,
      min: 1,
    },
  ],
};
