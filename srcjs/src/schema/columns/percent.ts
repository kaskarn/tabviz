// `percent` column — percentage display.
// Wire `type` is "numeric" (the renderer dispatches percent/numeric
// through the same formatNumber path); options live in the `percent`
// bucket which is what triggers the percent code path.

import type { ColumnTypeSpec } from "../types";
import { BASE_LAYER } from "../layers/base";
import { NUMERIC_LAYER } from "../layers/numeric";
import { PERCENT_LAYER } from "../layers/percent";
import { LAYOUT_LAYER } from "../layers/layout-header";

export const PERCENT_COLUMN: ColumnTypeSpec = {
  // Note: column.type on the wire is "numeric"; the wire bucket is
  // "percent". Both R `col_percent()` and the renderer agree on this.
  type: "numeric",
  label: "Percent",
  category: "numeric",
  bucket: "percent",
  layers: [BASE_LAYER, NUMERIC_LAYER, PERCENT_LAYER, LAYOUT_LAYER],
  layerOverrides: {
    // Percent defaults to 1 decimal place (where numeric defaults to 2).
    numeric: { decimals: 1, thousandsSep: false, abbreviate: false },
  },
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
};
