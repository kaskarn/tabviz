// `percent` — concrete column schema for percentage display.
// Inherits NUMERIC (NUMERIC → TEXT → BASE + SORTABLE all transit).
//
// Wire note: `column.type` is "numeric" (the renderer dispatches
// percent and numeric through the same formatNumber path); options
// live in the `percent` bucket, which triggers the percent code path.

import type { ColumnSchema } from "../types";

export const PERCENT_SCHEMA: ColumnSchema = {
  key: "percent",
  label: "Percent",
  defaultOpen: true,
  inherits: "numeric",
  type: "numeric",
  bucket: "percent",
  category: "numeric",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
  optionOverrides: {
    // Percent defaults to 1 decimal place (numeric defaults to 2).
    decimals: 1,
  },
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
