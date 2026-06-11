// `currency` — concrete column schema for monetary values.
// Numeric variant; identity = decimals 2 + thousands sep defaults.
// The symbol knobs live on the AUTHORING surface only (`col_currency(
// symbol=, position=)` resolves them into `numeric.prefix`/`.suffix`
// before serializing — the wire sees numeric.*). The schema used to
// re-advertise symbol/position here, but the editor writes schema
// options to `options[bucket][key]` generically, so editing them wrote
// `numeric.symbol`/`numeric.position` — keys NOTHING reads: dead menus
// (the area-F symptom; ontology review F7, 2026-06-11). The editor now
// surfaces numeric's live prefix/suffix instead.

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
  ],
};
