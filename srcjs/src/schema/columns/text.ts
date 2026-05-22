// `text` column — base text rendering, no formatting.

import type { ColumnTypeSpec } from "../types";
import { TEXT_LAYER } from "../layers/text";
import { SORTABLE_LAYER } from "../layers/sortable";

export const TEXT_COLUMN: ColumnTypeSpec = {
  type: "text",
  label: "Text",
  category: "text",
  bucket: "text",
  // TEXT inherits BASE; SORTABLE is orthogonal.
  layers: [TEXT_LAYER, SORTABLE_LAYER],
  slots: [
    { key: "field", label: "Value", accepts: ["string", "numeric", "integer", "logical", "date"], required: true },
  ],
};
