// `icon` — concrete column schema for icon/emoji display per cell.
// Value either IS the icon (when the data column holds unicode/emoji
// already), OR gets mapped through `mapping`. Own bucket "icon".

import type { ColumnSchema } from "../types";

export const ICON_SCHEMA: ColumnSchema = {
  key: "icon",
  flexWeight: 0.3,
  label: "Icon",
  glyph: "type.icon",
  defaultOpen: true,
  inherits: "base",
  type: "icon",
  bucket: "icon",
  category: "glyph",
  slots: [
    { key: "field", label: "Value", accepts: ["string", "numeric", "integer", "logical"], required: true },
  ],
  options: [
    {
      key: "mapping",
      label: "Value → icon",
      control: "custom",
      default: null,
      kind: "core",
      customComponent: "IconMap",
      hint: 'e.g. {pass: "✓", fail: "✗"}',
    },
    {
      key: "size",
      label: "Size",
      control: "segmented",
      default: "base",
      kind: "editor",
      segments: [
        { value: "sm",   label: "Small" },
        { value: "base", label: "Base" },
        { value: "lg",   label: "Large" },
        { value: "xl",   label: "XL" },
      ],
    },
    {
      key: "color",
      label: "Color",
      control: "color",
      default: null,
      kind: "styling",
      hint: "Theme content by default",
    },
  ],
};
