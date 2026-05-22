// `numeric` column — number formatting on a numeric field.

import type { ColumnTypeSpec } from "../types";
import { BASE_LAYER } from "../layers/base";
import { NUMERIC_LAYER } from "../layers/numeric";
import { LAYOUT_LAYER } from "../layers/layout-header";

export const NUMERIC_COLUMN: ColumnTypeSpec = {
  type: "numeric",
  label: "Numeric",
  category: "numeric",
  bucket: "numeric",
  layers: [BASE_LAYER, NUMERIC_LAYER, LAYOUT_LAYER],
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
};
