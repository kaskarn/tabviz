// `n` — concrete column schema for integer counts (sample sizes,
// event counts). Numeric variant with sensible defaults for whole-
// number counts: decimals=0, thousandsSep=",", header="N".
// Adds no own options — pure preset of NUMERIC.

import type { ColumnSchema } from "../types";

export const N_SCHEMA: ColumnSchema = {
  key: "n",
  label: "N (count)",
  glyph: "type.n",
  defaultOpen: true,
  inherits: "numeric",
  type: "numeric",
  bucket: "numeric",
  category: "numeric",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
  optionOverrides: {
    decimals: 0,
    thousandsSep: ",",
    header: "N",
  },
  options: [],
};
