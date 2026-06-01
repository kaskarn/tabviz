// `currency` — concrete column schema for monetary values.
// Numeric variant with currency-specific knobs: a symbol + its
// position (prefix or suffix). Today's R/TS `col_currency()` resolves
// these into `numeric.prefix` or `numeric.suffix` before serializing,
// so the wire-shape sees only numeric.* — but the editor surfaces
// the higher-level intent here.

import type { ColumnSchema } from "../types";

export const CURRENCY_SCHEMA: ColumnSchema = {
  key: "currency",
  label: "Currency",
  glyph: "type.currency",
  defaultOpen: true,
  inherits: "numeric",
  type: "numeric",
  bucket: "numeric",
  category: "numeric",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
  optionOverrides: {
    decimals: 2,
    thousandsSep: ",",
  },
  options: [
    {
      // Schema key matches R's `col_currency(symbol = …)` arg name; no
      // wire-shape conflict with PERCENT.symbol because the two live
      // in different buckets (numeric vs percent).
      key: "symbol",
      label: "Symbol",
      control: "text",
      default: "$",
      kind: "core",
      hint: "Currency symbol",
    },
    {
      key: "position",
      label: "Position",
      control: "segmented",
      default: "prefix",
      kind: "core",
      segments: [
        { value: "prefix", label: "Before" },
        { value: "suffix", label: "After" },
      ],
    },
  ],
};
