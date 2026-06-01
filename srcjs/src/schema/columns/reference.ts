// `reference` — concrete column schema for citation / link cells.
// Text (typically a citation or title) with an optional URL from a
// separate field. Own bucket "reference". Inherits TEXT for naText +
// maxChars (truncation matters here — citations can be long).

import type { ColumnSchema } from "../types";

export const REFERENCE_SCHEMA: ColumnSchema = {
  key: "reference",
  label: "Reference",
  glyph: "type.reference",
  defaultOpen: true,
  inherits: "text",
  type: "reference",
  bucket: "reference",
  category: "text",
  slots: [
    { key: "field", label: "Text", accepts: ["string"], required: true },
  ],
  optionOverrides: {
    header: "Reference",
    maxChars: 30,
  },
  options: [
    {
      key: "hrefField",
      label: "URL field",
      control: "field",
      default: null,
      kind: "core",
      accepts: ["string"],
      hint: "Optional column with URLs to link",
    },
    {
      key: "showIcon",
      label: "Link icon",
      control: "toggle",
      default: true,
      kind: "editor",
      hint: "External-link indicator when URL is present",
      visibleWhen: (s) => s.hrefField != null && s.hrefField !== "",
    },
  ],
};
