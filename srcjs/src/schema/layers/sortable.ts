// `sortable` layer — adds the sortable toggle to column types whose
// underlying data is orderable (every scalar column). Omitted by
// column types where ordering doesn't make sense: sparkline (array
// per cell), viz_bar / viz_boxplot / viz_violin (effects arrays),
// forest (multi-effect or pooled), and viz_* in general.
//
// Single-option layer is intentional — sortable is the only
// universally-conditional knob. Splitting it out keeps BASE honest
// (every column gets a header, but not every column is orderable).

import type { LayerSpec } from "../types";

export const SORTABLE_LAYER: LayerSpec = {
  key: "sortable",
  label: "Sortable",
  defaultOpen: false,
  options: [
    {
      key: "sortable",
      label: "Sortable",
      control: "toggle",
      default: true,
      hint: "Click column header to sort by this column",
      at: "fixed",
    },
  ],
};
