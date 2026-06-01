// `ring` — concrete column schema for donut/gauge display. Numeric
// value mapped to a fraction of a circular arc, with an optional
// label. In the future will multi-inherit [PICTOGRAM (glyph
// rendering primitives), PERCENT (label formatting)] — for now
// inherits BASE and declares its own options surface.

import type { ColumnSchema } from "../types";

export const RING_SCHEMA: ColumnSchema = {
  key: "ring",
  label: "Ring",
  glyph: "type.ring",
  defaultOpen: true,
  inherits: "base",
  type: "ring",
  bucket: "ring",
  category: "glyph",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
  options: [
    {
      key: "minValue",
      label: "Min value",
      control: "number",
      default: 0,
      kind: "core",
    },
    {
      key: "maxValue",
      label: "Max value",
      control: "number",
      default: 1,
      kind: "core",
    },
    {
      key: "color",
      label: "Filled color",
      control: "color",
      default: null,
      kind: "styling",
      hint: "Theme accent by default; thresholds switch color",
    },
    {
      key: "thresholds",
      label: "Color thresholds",
      control: "custom",
      default: null,
      kind: "core",
      customComponent: "ThresholdList",
      hint: "Breakpoints where the arc color shifts",
    },
    {
      key: "trackColor",
      label: "Track color",
      control: "color",
      default: null,
      kind: "styling",
      hint: "Theme muted by default",
    },
    {
      key: "size",
      label: "Ring size",
      control: "segmented",
      default: "base",
      kind: "editor",
      segments: [
        { value: "sm",   label: "Small" },
        { value: "base", label: "Base" },
        { value: "lg",   label: "Large" },
      ],
    },
    {
      key: "showLabel",
      label: "Show label",
      control: "toggle",
      default: true,
      kind: "editor",
    },
    {
      key: "labelFormat",
      label: "Label format",
      control: "segmented",
      default: "percent",
      kind: "core",
      segments: [
        { value: "percent", label: "Percent" },
        { value: "decimal", label: "Decimal" },
        { value: "integer", label: "Integer" },
      ],
      visibleWhen: (s) => s.showLabel !== false,
    },
    {
      key: "labelDecimals",
      label: "Label decimals",
      control: "integer",
      default: 0,
      kind: "core",
      min: 0,
      max: 10,
      visibleWhen: (s) => s.showLabel !== false,
    },
  ],
};
