// `range` — concrete column schema for min–max range display.
// Two data slots (low/high). Inherits NUMERIC for format options.
// Own bucket "range"; synthetic field is `_range_<low>_<high>`.

import type { ColumnSchema } from "../types";

export const RANGE_SCHEMA: ColumnSchema = {
  key: "range",
  label: "Range",
  glyph: "type.range",
  defaultOpen: true,
  inherits: "numeric",
  type: "range",
  bucket: "range",
  category: "numeric",
  slots: [
    { key: "low",  label: "Min", accepts: ["numeric", "integer"], required: true,
      autoPair: { suffixes: ["_min", "_lo", "_low"] } },
    { key: "high", label: "Max", accepts: ["numeric", "integer"], required: true,
      autoPair: { suffixes: ["_max", "_hi", "_high"] } },
  ],
  optionOverrides: {
    header: "Range",
    decimals: null,
  },
  options: [
    {
      key: "separator",
      label: "Separator",
      control: "text",
      default: " - ",
      kind: "core",
      consumedBy: ["formatValue", "emitSource", "editor"],
    },
  ],
};
