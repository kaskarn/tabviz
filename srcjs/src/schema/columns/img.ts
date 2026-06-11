// `img` — concrete column schema for image-URL display. The data
// column holds a URL; the renderer fetches and displays. Own bucket
// "img".

import type { ColumnSchema } from "../types";

export const IMG_SCHEMA: ColumnSchema = {
  key: "img",
  label: "Image",
  glyph: "type.img",
  defaultOpen: true,
  inherits: "base",
  type: "img",
  bucket: "img",
  category: "glyph",
  slots: [
    { key: "field", label: "URL", accepts: ["string"], required: true },
  ],
  optionOverrides: {
    sortable: false,  // image URLs aren't meaningfully orderable
  },
  options: [
    {
      key: "height",
      label: "Height",
      control: "integer",
      default: null,
      kind: "editor",
      min: 8,
      max: 200,
      hint: "Pixels; auto from row height when null",
      consumedBy: ["renderCell", "naturalHeight", "emitSource", "editor"],
    },
    {
      key: "maxWidth",
      label: "Max width",
      control: "integer",
      default: null,
      kind: "editor",
      min: 8,
      max: 400,
      hint: "Pixels; auto when null",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "fallback",
      label: "Fallback text",
      control: "text",
      default: "[img]",
      kind: "core",
      hint: "Shown when the URL fails to load",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "shape",
      label: "Shape",
      control: "segmented",
      default: "square",
      kind: "editor",
      segments: [
        { value: "square",  label: "Square" },
        { value: "rounded", label: "Rounded" },
        { value: "circle",  label: "Circle" },
      ],
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
  ],
};
