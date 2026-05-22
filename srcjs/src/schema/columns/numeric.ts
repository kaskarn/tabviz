// `numeric` column — number formatting on a numeric field.

import type { ColumnTypeSpec } from "../types";
import { BASE_LAYER } from "../layers/base";
import { TEXT_LAYER } from "../layers/text";
import { NUMERIC_LAYER } from "../layers/numeric";
import { SORTABLE_LAYER } from "../layers/sortable";

export const NUMERIC_COLUMN: ColumnTypeSpec = {
  type: "numeric",
  label: "Numeric",
  category: "numeric",
  bucket: "numeric",
  // Inherits TEXT — numeric is, after all, rendering text. So `naText`
  // and `maxChars` (truncate "1,234,567" -> "1,234…") apply.
  layers: [BASE_LAYER, TEXT_LAYER, NUMERIC_LAYER, SORTABLE_LAYER],
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
};
