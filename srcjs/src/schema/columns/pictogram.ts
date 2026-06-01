// `pictogram` — concrete column schema for value-driven glyph counts
// (rating bars, completion counts, person-icon stacks, …). Glyphs come
// from the glyph registry; the count maps from the numeric value via
// optional domain remapping. Own bucket "pictogram".

import type { ColumnSchema } from "../types";

export const PICTOGRAM_SCHEMA: ColumnSchema = {
  key: "pictogram",
  label: "Pictogram",
  glyph: "type.pictogram",
  defaultOpen: true,
  inherits: "base",
  type: "pictogram",
  bucket: "pictogram",
  category: "glyph",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
  variants: [
    {
      id: "row",
      label: "Row",
      description: "Glyphs laid out left-to-right",
      preview: "★★★☆☆",
    },
    {
      id: "stack",
      label: "Stack",
      description: "Glyphs stacked top-to-bottom",
      preview: "★\n★\n★",
    },
    {
      id: "row_value_trail",
      label: "Row + value",
      description: "Glyphs with numeric value trailing",
      preview: "★★★ 3",
    },
  ],
  options: [
    {
      key: "glyph",
      label: "Glyph",
      control: "text",
      default: "person",
      kind: "core",
      hint: "Registry key (person, leaf, star, …)",
    },
    {
      key: "glyphField",
      label: "Glyph field",
      control: "field",
      default: null,
      kind: "core",
      accepts: ["string"],
      hint: "Per-row glyph selection",
    },
    {
      key: "maxGlyphs",
      label: "Max glyphs",
      control: "integer",
      default: null,
      kind: "core",
      min: 1,
      max: 50,
      hint: "Rating-mode cap; null = use raw value as count",
    },
    {
      key: "halfGlyphs",
      label: "Half-step glyphs",
      control: "toggle",
      default: false,
      kind: "core",
    },
    {
      key: "domain",
      label: "Input range",
      control: "custom",
      default: null,
      kind: "core",
      customComponent: "MinMaxPair",
      hint: "Remap [min, max] → [0, maxGlyphs]",
    },
    {
      key: "color",
      label: "Filled color",
      control: "color",
      default: null,
      kind: "styling",
      hint: "Theme accent by default",
    },
    {
      key: "emptyColor",
      label: "Empty color",
      control: "color",
      default: null,
      kind: "styling",
      hint: "Theme muted by default",
    },
    {
      key: "size",
      label: "Glyph size",
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
      key: "layout",
      label: "Layout",
      control: "segmented",
      default: "row",
      kind: "editor",
      segments: [
        { value: "row",   label: "Row" },
        { value: "stack", label: "Stack" },
      ],
    },
    {
      key: "valueLabel",
      label: "Value label",
      control: "segmented",
      default: false,
      kind: "editor",
      segments: [
        { value: false,       label: "Off" },
        { value: true,        label: "Inline" },
        { value: "leading",   label: "Leading" },
        { value: "trailing",  label: "Trailing" },
      ],
    },
    {
      key: "labelFormat",
      label: "Label format",
      control: "segmented",
      default: null,
      kind: "core",
      segments: [
        { value: "integer", label: "Integer" },
        { value: "decimal", label: "Decimal" },
      ],
      visibleWhen: (s) => s.valueLabel !== false,
    },
    {
      key: "labelDecimals",
      label: "Label decimals",
      control: "integer",
      default: 1,
      kind: "core",
      min: 0,
      max: 10,
      visibleWhen: (s) => s.valueLabel !== false,
    },
  ],
};
