// `badge` — concrete column schema for colored status pills.
// Value → variant/color via a mapping; shape and outline are pure
// presentation toggles. Own bucket "badge".

import type { ColumnSchema } from "../types";

export const BADGE_SCHEMA: ColumnSchema = {
  key: "badge",
  label: "Badge",
  defaultOpen: true,
  inherits: "base",
  type: "badge",
  bucket: "badge",
  category: "glyph",
  slots: [
    { key: "field", label: "Value", accepts: ["string", "numeric", "integer"], required: true },
  ],
  options: [
    {
      key: "variants",
      // Named map: value → semantic variant ("success", "warning", "error",
      // "info", "muted", "default"). Custom UI later.
      label: "Variants",
      control: "custom",
      default: null,
      customComponent: "BadgeVariantMap",
      hint: 'e.g. {published: "success", draft: "warning"}',
    },
    {
      key: "colors",
      // Named map: value → hex color. Overrides `variants` per key.
      label: "Custom colors",
      control: "custom",
      default: null,
      customComponent: "BadgeColorMap",
    },
    {
      key: "thresholds",
      label: "Numeric thresholds",
      control: "custom",
      default: null,
      customComponent: "ThresholdList",
      hint: "Bin numeric values into colored badges",
    },
    {
      key: "size",
      label: "Size",
      control: "segmented",
      default: "base",
      segments: [
        { value: "sm",   label: "Small" },
        { value: "base", label: "Base" },
      ],
    },
    {
      key: "shape",
      label: "Shape",
      control: "segmented",
      default: "pill",
      segments: [
        { value: "pill",   label: "Pill" },
        { value: "circle", label: "Circle" },
        { value: "square", label: "Square" },
      ],
    },
    {
      key: "outline",
      label: "Outline",
      control: "toggle",
      default: false,
      hint: "Transparent fill, colored border",
    },
  ],
};
