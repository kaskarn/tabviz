// `layout-header` layer — universal, appended to every column type.
// All options here use `at: "fixed"` because they live on the top-level
// ColumnSpec (not in `options`).

import type { LayerSpec } from "../types";

export const LAYOUT_LAYER: LayerSpec = {
  key: "layout-header",
  label: "Layout & header",
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
      key: "width",
      label: "Width",
      control: "number",
      default: "auto",
      hint: 'Pixels; blank or "auto" for content-driven',
      at: "fixed",
    },
    {
      key: "align",
      label: "Cell align",
      control: "segmented",
      default: "left",
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
      hint: "Inherit from cell align if unset",
      segments: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ],
      at: "fixed",
    },
    {
      key: "wrap",
      label: "Wrap",
      control: "toggle",
      default: false,
      hint: "Allow multi-line cells",
      at: "fixed",
    },
    {
      key: "sortable",
      label: "Sortable",
      control: "toggle",
      default: true,
      at: "fixed",
    },
  ],
};
