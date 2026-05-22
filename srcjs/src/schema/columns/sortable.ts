// `sortable` — abstract column schema. Capability mixin for column
// types whose underlying data has a meaningful total order: text
// (lexicographic), numeric / percent / currency / pvalue / interval
// (numeric), date (chronological). Column types inherit SORTABLE
// multiply alongside their main parent.
//
// Omitted by column types whose data is non-orderable: sparkline
// (array per cell), viz_bar / viz_boxplot / viz_violin (effects
// arrays), forest (multi-effect), a hypothetical complex-number
// column. Such types don't need to opt out — they simply don't
// inherit from sortable.

import type { ColumnSchema } from "../types";

export const SORTABLE_SCHEMA: ColumnSchema = {
  key: "sortable",
  label: "Sortable",
  abstract: true,
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
