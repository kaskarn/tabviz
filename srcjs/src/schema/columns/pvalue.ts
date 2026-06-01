// `pvalue` — concrete column schema for p-value display with smart
// formatting (scientific for very small values, optional significance
// stars). Own bucket "pvalue".

import type { ColumnSchema } from "../types";

export const PVALUE_SCHEMA: ColumnSchema = {
  key: "pvalue",
  label: "P-value",
  glyph: "type.pvalue",
  defaultOpen: true,
  // NOTE (2026-05-26): P-value semantically IS a numeric type, so
  // inheriting from `numeric` to surface decimals/thousandsSep/
  // abbreviate would be the principled move. Holding off until the
  // p-value renderer is taught to honor those options — without that
  // the inherited options would appear in the editor but be visually
  // dead. See task #151 for the audit follow-up.
  inherits: "base",
  type: "pvalue",
  bucket: "pvalue",
  category: "numeric",
  slots: [
    { key: "field", label: "Value", accepts: ["numeric"], required: true },
  ],
  optionOverrides: {
    header: "P-value",
  },
  options: [
    {
      key: "stars",
      label: "Stars",
      control: "toggle",
      default: false,
      hint: "Show significance stars",
      kind: "core",
      consumedBy: ["formatValue", "emitSource", "editor"],
    },
    {
      key: "format",
      label: "Format",
      control: "segmented",
      default: "auto",
      segments: [
        { value: "auto",        label: "Auto" },
        { value: "decimal",     label: "Decimal" },
        { value: "scientific",  label: "Scientific" },
      ],
      kind: "core",
      consumedBy: ["formatValue", "emitSource", "editor"],
    },
    {
      key: "digits",
      label: "Sig. digits",
      control: "integer",
      default: 2,
      min: 1,
      max: 10,
      kind: "core",
      consumedBy: ["formatValue", "emitSource", "editor"],
    },
    {
      key: "expThreshold",
      label: "Exp. threshold",
      control: "number",
      default: 0.001,
      hint: "Values below use scientific notation",
      kind: "core",
      consumedBy: ["formatValue", "emitSource", "editor"],
    },
    {
      key: "abbrevThreshold",
      label: "Abbrev. threshold",
      control: "number",
      default: null,
      hint: 'Values below show as "<threshold"',
      kind: "core",
      consumedBy: ["formatValue", "emitSource", "editor"],
    },
    {
      key: "thresholds",
      // Length-3 numeric vector for star tiers. Treated as opaque here;
      // the editor surface for this is deferred (custom control) — for
      // now schema declares the option exists with the default tier.
      label: "Star thresholds",
      control: "custom",
      default: [0.05, 0.01, 0.001],
      customComponent: "PValueThresholds",
      visibleWhen: (s) => s.stars === true,
      kind: "core",
      consumedBy: ["formatValue", "emitSource", "editor"],
    },
  ],
};
