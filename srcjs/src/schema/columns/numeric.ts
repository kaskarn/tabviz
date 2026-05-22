// `numeric` column — number formatting on a numeric field.

import type { ColumnTypeSpec } from "../types";
import { NUMERIC_LAYER } from "../layers/numeric";
import { SORTABLE_LAYER } from "../layers/sortable";

export const NUMERIC_COLUMN: ColumnTypeSpec = {
  type: "numeric",
  label: "Numeric",
  category: "numeric",
  bucket: "numeric",
  // NUMERIC inherits TEXT inherits BASE — naText, maxChars, header,
  // align, width all come along for free.
  layers: [NUMERIC_LAYER, SORTABLE_LAYER],
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
};
