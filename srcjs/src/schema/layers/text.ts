// `text` layer — cell-text rendering options. Inherited by every
// column type that renders text in any form: text, label, numeric,
// percent, currency, n, pvalue, interval, range, events, date,
// reference, and value labels on bar/ring/heatmap/pictogram.
//
// Pure-visual columns that never paint cell text (sparkline,
// viz_bar, viz_boxplot, viz_violin, img) opt out by omitting this
// layer from their `layers` list — they still get BASE_LAYER for
// the header text, just not these cell-text knobs.

import type { LayerSpec } from "../types";

export const TEXT_LAYER: LayerSpec = {
  key: "text",
  label: "Text",
  defaultOpen: false,
  options: [
    {
      key: "wrap",
      label: "Wrap",
      control: "toggle",
      default: false,
      hint: "Allow multi-line cells",
      at: "fixed",
    },
    {
      key: "naText",
      label: "Missing value",
      control: "text",
      default: null,
      hint: "Shown when the cell is NA / null",
      // Legacy wire path: `column.options.naText` (top-level, not in
      // any bucket). 13+ reader sites in the renderer + SVG exporter.
      at: "top",
    },
    {
      key: "maxChars",
      label: "Max chars",
      control: "integer",
      default: null,
      hint: "Truncate with trailing ellipsis when over",
      min: 1,
    },
    // Reserved for future text-styling additions (bold/italic/color).
    // Today those live as per-cell style mappings (`row_color_col`,
    // styleMapping); when we lift them to per-column toggles they go
    // here so every text-rendering column inherits the surface.
  ],
};
