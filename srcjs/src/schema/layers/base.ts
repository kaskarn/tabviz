// `base` layer — universal options inherited by every column type.
// Today: just `naText` (legacy wire path is top-level
// `column.options.naText`, preserved).

import type { LayerSpec } from "../types";

export const BASE_LAYER: LayerSpec = {
  key: "base",
  label: "Base",
  defaultOpen: false,
  options: [
    {
      key: "naText",
      label: "Missing value",
      control: "text",
      default: null,
      hint: "Shown when the cell is NA / null",
      at: "top",
    },
  ],
};
