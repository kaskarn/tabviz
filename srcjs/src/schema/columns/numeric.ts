// `numeric` — concrete column schema for number formatting.
// Inherits TEXT (numbers render as text, so naText/maxChars/wrap
// apply; BASE + SORTABLE come transitively).

import type { ColumnSchema } from "../types";

export const NUMERIC_SCHEMA: ColumnSchema = {
  key: "numeric",
  label: "Numeric formatting",
  defaultOpen: true,
  inherits: "text",
  type: "numeric",
  bucket: "numeric",
  category: "numeric",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric", "integer"], required: true },
  ],
  options: [
    {
      key: "decimals",
      label: "Decimals",
      control: "integer",
      default: 2,
      hint: "Decimal places. Leave blank for auto.",
      min: 0,
      max: 10,
    },
    {
      key: "digits",
      label: "Sig. digits",
      control: "integer",
      default: null,
      hint: "Significant figures (overrides decimals)",
      min: 1,
      max: 10,
    },
    {
      key: "thousandsSep",
      label: "Thousands sep",
      control: "toggle",
      default: false,
      // Wire encoding: false | "," (string). Editor exposes a boolean
      // toggle; when on, codegen sets the wire value to "," — matching
      // today's handwritten builders.
    },
    {
      key: "abbreviate",
      label: "Abbreviate",
      control: "toggle",
      default: false,
      hint: '"12.3K", "1.2M"',
    },
    {
      key: "prefix",
      label: "Prefix",
      control: "text",
      default: null,
      hint: 'Prepended literal (e.g. "$")',
    },
    {
      key: "suffix",
      label: "Suffix",
      control: "text",
      default: null,
      hint: 'Appended literal (e.g. "%")',
    },
  ],
};
