// `interval` — concrete column schema for point + CI display.
// Three data slots (point/lower/upper) plus numeric-format options
// reused via NUMERIC inheritance. Own bucket "interval"; the wire
// synthetic field is `_interval_<point>` (built by the existing
// colInterval builder).

import type { ColumnSchema } from "../types";

export const INTERVAL_SCHEMA: ColumnSchema = {
  key: "interval",
  label: "Interval",
  glyph: "type.interval",
  defaultOpen: true,
  inherits: "numeric",
  type: "interval",
  bucket: "interval",
  category: "numeric",
  slots: [
    { key: "point", label: "Point",    accepts: ["numeric"], required: true },
    { key: "lower", label: "Lower CI", accepts: ["numeric"], required: true,
      autoPair: { suffixes: ["_lo", "_low", "_lower", "_ci_lo", "_ci_lower", "_l"] } },
    { key: "upper", label: "Upper CI", accepts: ["numeric"], required: true,
      autoPair: { suffixes: ["_hi", "_high", "_upper", "_ci_hi", "_ci_upper", "_u"] } },
  ],
  optionOverrides: {
    header: "95% CI",
  },
  variants: [
    {
      id: "traditional",
      label: "Traditional",
      description: "Bounds in parens after the point",
      preview: "0.85 (0.72, 0.99)",
      resolved: {
        boundsLayout: "row",
        boundsContent: "range",
        boundsDelimiter: ["(", ")"],
        boundsSeparator: ", ",
        boundsPrefix: "",
      },
    },
    {
      id: "bracket_muted",
      label: "Bracket, muted",
      description: "Bounds in brackets, secondary text",
      preview: "0.85 [0.72–0.99]",
      resolved: {
        boundsLayout: "row",
        boundsContent: "range",
        boundsDelimiter: ["[", "]"],
        boundsSeparator: "–",
        boundsPrefix: "",
      },
    },
    {
      id: "plus_minus",
      label: "Plus–minus",
      description: "Half-width as ± (symmetric bounds)",
      preview: "0.85 ± 0.14",
      resolved: {
        boundsLayout: "row",
        boundsContent: "half_width",
        boundsDelimiter: ["", ""],
        boundsSeparator: "",
        boundsPrefix: "± ",
      },
    },
    {
      id: "stacked",
      label: "Stacked",
      description: "Point on first line, bounds below",
      preview: "0.85\n(0.72, 0.99)",
      resolved: {
        boundsLayout: "column",
        boundsContent: "range",
        boundsDelimiter: ["(", ")"],
        boundsSeparator: ", ",
        boundsPrefix: "",
      },
    },
  ],
  options: [
    {
      key: "separator",
      label: "Separator",
      control: "text",
      default: " ",
      hint: "Between point and bracket",
    },
    {
      key: "impreciseThreshold",
      label: "Imprecise cutoff",
      control: "number",
      default: null,
      hint: 'Show "—" when upper/lower > threshold',
    },
  ],
};
