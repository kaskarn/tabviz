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
      consumedBy: ["renderCell", "editor"],
    },
    {
      key: "showHeader",
      label: "Show header",
      control: "toggle",
      default: null,
      hint: "Auto: show iff header non-empty",
      at: "fixed",
      consumedBy: ["renderCell", "editor"],
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
      consumedBy: ["renderCell", "editor"],
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
      consumedBy: ["renderCell", "editor"],
    },
    {
      key: "width",
      label: "Width",
      control: "number",
      default: "auto",
      hint: 'Pixels; blank or "auto" for content-driven',
      at: "fixed",
      consumedBy: ["renderCell", "estimateWidth", "editor"],
    },
    {
      key: "sortable",
      label: "Sortable",
      control: "toggle",
      default: true,
      hint: "Click header to sort. Multi-effect viz sorts by the first series.",
      at: "fixed",
      consumedBy: ["editor"],
    },
    {
      key: "naText",
      label: "Missing value",
      control: "text",
      default: null,
      hint: "Shown when the cell is NA / null",
      // Legacy wire path: `column.options.naText` (top-level, not in
      // any bucket). 13+ reader sites in the renderer + SVG exporter.
      at: "top",
      consumedBy: ["renderCell", "formatValue"],
    },

    // ── Styling overrides ─────────────────────────────────────────────
    // Phase 2.5 proof of concept: `token` as the first schema-driven
    // styling option. Token is the primary styling primitive in
    // tabviz — semantic roles ("emphasis", "muted", "accent",
    // "fill", "bold") that the theme cascade resolves to actual
    // colors/weights. Promoting it in the editor (over raw color /
    // weight / italic overrides) keeps users inside the cascade by
    // default; raw overrides remain available as escape hatches.
    //
    // Wire-shape flattening for styling options is decided in Phase 3
    // when we lift the full styleMapping surface. The schema
    // declares the option; runtime wiring waits.
    {
      key: "token",
      label: "Token",
      control: "value-or-field",
      valueControl: "segmented",
      segments: [
        { value: "emphasis", label: "Emphasis" },
        { value: "muted", label: "Muted" },
        { value: "accent", label: "Accent" },
        { value: "fill", label: "Fill" },
        { value: "bold", label: "Bold" },
      ],
      kind: "styling",
      default: null,
      hint: "Semantic role — theme decides colors/weights",
      accepts: ["string"],
      consumedBy: ["renderCell", "editor"],
    },
    {
      key: "paddingClass",
      label: "Density",
      control: "value-or-field",
      valueControl: "segmented",
      segments: [
        { value: "compact",     label: "Compact" },
        { value: "comfortable", label: "Comfortable" },
        { value: "spacious",    label: "Spacious" },
      ],
      kind: "styling",
      default: null,
      hint: "Cell padding — theme decides exact values",
      accepts: ["string"],
      consumedBy: ["renderCell", "editor"],
    },
  ],
};
