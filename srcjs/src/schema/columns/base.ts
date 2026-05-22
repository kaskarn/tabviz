// `base` — abstract column schema. Every column type, including viz,
// inherits these structural knobs. Header label + visibility + width +
// content position + sortability are universal — sortability defaults
// true and can be overridden via `optionOverrides` anywhere in the
// inheritance chain. Multi-effect viz columns sort by the first
// effect series, so they don't need a special-case opt-out either.
// All options live on the top-level ColumnSpec (not in
// `column.options`), so `at: "fixed"`.

import type { ColumnSchema } from "../types";

export const BASE_SCHEMA: ColumnSchema = {
  key: "base",
  label: "Base",
  abstract: true,
  defaultOpen: false,
  options: [
    {
      key: "header",
      label: "Header text",
      control: "text",
      default: null,
      hint: "Defaults to the field name",
      at: "fixed",
    },
    {
      key: "showHeader",
      label: "Show header",
      control: "toggle",
      default: null,
      hint: "Auto: show iff header non-empty",
      at: "fixed",
    },
    {
      key: "align",
      label: "Content align",
      control: "segmented",
      default: "left",
      hint: "Where cell content sits horizontally — text, sparklines, bars",
      segments: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ],
      at: "fixed",
    },
    {
      key: "headerAlign",
      label: "Header align",
      control: "segmented",
      default: null,
      hint: "Inherit from content align if unset",
      segments: [
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
        { value: "right", label: "Right" },
      ],
      at: "fixed",
    },
    {
      key: "width",
      label: "Width",
      control: "number",
      default: "auto",
      hint: 'Pixels; blank or "auto" for content-driven',
      at: "fixed",
    },
    {
      key: "sortable",
      label: "Sortable",
      control: "toggle",
      default: true,
      hint: "Click header to sort. Multi-effect viz sorts by the first series.",
      at: "fixed",
    },

    // ── Styling overrides ─────────────────────────────────────────────
    // Phase 2.5 proof of concept: `italic` as the first schema-driven
    // styling option with the new "value-or-field" control. Italic is
    // genuinely binary — a cleaner demo of the toggle sub-control than
    // bold-which-should-really-be-`weight` (multi-value: normal /
    // medium / semibold / bold) and will be lifted with a segmented
    // sub-control in Phase 3.
    //
    // Wire-shape flattening (where exactly italic / weight / color /
    // etc. land on the wire) is decided in Phase 3 when we lift the
    // full styleMapping surface into schemas. Today `italic` lives at
    // `column.styleMapping.italic` (field-reference only); the
    // unified schema lets the user pick "static true", "mapped to a
    // data column", or "default (theme decides)".
    {
      key: "italic",
      label: "Italic",
      control: "value-or-field",
      valueControl: "toggle",
      kind: "styling",
      default: null,
      hint: "Static / mapped to a data column / default",
      accepts: ["logical", "string", "numeric", "integer"],
    },
  ],
};
