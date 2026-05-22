// `viz_bar` — concrete column schema for multi-series inline bar
// charts. Effects array (one per series). Inherits VIZ.

import type { ColumnSchema } from "../types";

export const VIZ_BAR_SCHEMA: ColumnSchema = {
  key: "viz_bar",
  label: "Viz: bars",
  defaultOpen: true,
  inherits: "viz",
  type: "viz_bar",
  bucket: "vizBar",
  category: "viz",
  // Slots are implicit per-effect — picked inside the EffectBarList
  // custom control rather than at the column level.
  slots: [],
  options: [
    {
      key: "effects",
      label: "Effects",
      control: "custom",
      default: [],
      customComponent: "EffectBarList",
      hint: "One or more value series",
    },
    {
      key: "barWidth",
      label: "Bar width",
      control: "integer",
      default: null,
      min: 1,
    },
    {
      key: "barGap",
      label: "Bar gap",
      control: "integer",
      default: null,
      min: 0,
    },
    {
      key: "orientation",
      label: "Orientation",
      control: "segmented",
      default: "horizontal",
      segments: [
        { value: "horizontal", label: "Horizontal" },
        { value: "vertical",   label: "Vertical" },
      ],
    },
  ],
};
