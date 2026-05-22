// `text` layer — free-form-text rendering options.
// Used by `text`, `label`, `reference`, `date` columns. NOT by numeric
// (truncation doesn't apply to formatted numbers).

import type { LayerSpec } from "../types";

export const TEXT_LAYER: LayerSpec = {
  key: "text",
  label: "Text",
  defaultOpen: false,
  options: [
    {
      key: "maxChars",
      label: "Max chars",
      control: "integer",
      default: null,
      hint: "Truncate with trailing ellipsis when over",
      min: 1,
    },
  ],
};
