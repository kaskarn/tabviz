// `percent` layer — percentage-specific options stacked on top of numeric.

import type { LayerSpec } from "../types";

export const PERCENT_LAYER: LayerSpec = {
  key: "percent",
  label: "Percent",
  defaultOpen: true,
  inherits: "numeric",
  options: [
    {
      key: "multiply",
      label: "Multiply ×100",
      control: "toggle",
      default: true,
      hint: "Off if the source field is already a percentage",
    },
    {
      key: "symbol",
      label: 'Show "%"',
      control: "toggle",
      default: true,
    },
  ],
};
