// `base` layer — truly column-agnostic. Every column type, including
// viz columns, has these. Header label + visibility + width are
// universal; align positions cell content within the column (text,
// sparkline placement, bar start); headerAlign is here because the
// header itself is always text. All options live on top-level
// ColumnSpec, so `at: "fixed"`.

import type { LayerSpec } from "../types";

export const BASE_LAYER: LayerSpec = {
  key: "base",
  label: "Base",
  defaultOpen: false,
  options: [
    {
      key: "header",
      label: "Header text",
      control: "text",
      default: null,
      hint: "Defaults to the field name",
      at: "fixed",
    },
    {
      key: "showHeader",
      label: "Show header",
      control: "toggle",
      default: null,
      hint: "Auto: show iff header non-empty",
      at: "fixed",
    },
    {
      key: "align",
      label: "Content align",
      control: "segmented",
      default: "left",
      hint: "Where cell content sits horizontally — text, sparklines, bars",
      segments: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ],
      at: "fixed",
    },
    {
      key: "headerAlign",
      label: "Header align",
      control: "segmented",
      default: null,
      hint: "Inherit from content align if unset",
      segments: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ],
      at: "fixed",
    },
    {
      key: "width",
      label: "Width",
      control: "number",
      default: "auto",
      hint: 'Pixels; blank or "auto" for content-driven',
      at: "fixed",
    },
  ],
};
