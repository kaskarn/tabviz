// `date` — concrete column schema for date / time display.
// Wire `type` is "text"; the bucket is "date" (renderer dispatches
// on the presence of `options.date` to apply strftime formatting).
// Doesn't inherit TEXT — col_date doesn't expose maxChars/wrap (date
// strings are typically short and fixed-width). Inherits BASE only.

import type { ColumnSchema } from "../types";

export const DATE_SCHEMA: ColumnSchema = {
  key: "date",
  label: "Date",
  defaultOpen: true,
  inherits: "base",
  type: "text",
  bucket: "date",
  category: "text",
  slots: [
    { key: "field", label: "Value", accepts: ["date", "string"], required: true },
  ],
  options: [
    {
      key: "format",
      label: "Format",
      control: "text",
      default: "%Y-%m-%d",
      hint: "strftime-style format string",
    },
  ],
};
