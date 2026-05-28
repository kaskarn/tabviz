// `icon` — concrete column schema for icon/emoji display per cell.
// Value either IS the icon (when the data column holds unicode/emoji
// already), OR gets mapped through `mapping`. Own bucket "icon".

import type { ColumnSchema } from "../types";

export const ICON_SCHEMA: ColumnSchema = {
  key: "icon",
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
      customComponent: "IconMap",
      hint: 'e.g. {pass: "✓", fail: "✗"}',
    },
    {
      key: "size",
      label: "Size",
      control: "segmented",
      default: "base",
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
      hint: "Theme content by default",
    },
  ],
};
