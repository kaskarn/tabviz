// `text` column — base text rendering, no formatting.

import type { ColumnTypeSpec } from "../types";
import { BASE_LAYER } from "../layers/base";
import { TEXT_LAYER } from "../layers/text";
import { SORTABLE_LAYER } from "../layers/sortable";

export const TEXT_COLUMN: ColumnTypeSpec = {
  type: "text",
  label: "Text",
  category: "text",
  bucket: "text",
  layers: [BASE_LAYER, TEXT_LAYER, SORTABLE_LAYER],
  slots: [
    { key: "field", label: "Value", accepts: ["string", "numeric", "integer", "logical", "date"], required: true },
  ],
};
