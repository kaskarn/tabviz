// `interval` — concrete column schema for point + CI display.
// Three data slots (point/lower/upper) plus numeric-format options
// reused via NUMERIC inheritance. Own bucket "interval"; the wire
// synthetic field is `_interval_<point>` (built by the existing
// colInterval builder).

import type { ColumnSchema } from "../types";

export const INTERVAL_SCHEMA: ColumnSchema = {
  key: "interval",
  label: "Interval",
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
