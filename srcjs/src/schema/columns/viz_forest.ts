// `viz_forest` — concrete column schema for forest plots. Either
// single-effect (point/lower/upper slots) or multi-effect (effects
// array). Inherits VIZ → BASE for the full axis + layout surface.
//
// Wire bucket: "forest". Wire type: "forest".

import type { ColumnSchema } from "../types";

export const VIZ_FOREST_SCHEMA: ColumnSchema = {
  key: "viz_forest",
  flexWeight: 8,
  naturalWidthPx: 240,
  label: "Forest",
  glyph: "type.forest",
  defaultOpen: true,
  inherits: "viz",
  type: "forest",
  bucket: "forest",
  category: "viz",
  slots: [
    // Single-effect slots — used when `effects` is empty/null.
    { key: "point", label: "Estimate", accepts: ["numeric"], required: false },
    {
      key: "lower",
      label: "Lower CI",
      accepts: ["numeric"],
      required: false,
      autoPair: {
        suffixes: ["_lo", "_low", "_lower", "_ci_lo", "_ci_lower", "_l"],
      },
    },
    {
      key: "upper",
      label: "Upper CI",
      accepts: ["numeric"],
      required: false,
      autoPair: {
        suffixes: ["_hi", "_high", "_upper", "_ci_hi", "_ci_upper", "_u"],
      },
    },
  ],
  options: [
    {
      // Multi-effect: array of EffectForest objects.
      key: "effects",
      label: "Effects",
      control: "custom",
      default: null,
      kind: "core",
      customComponent: "EffectForestList",
      hint: "Multiple overlaid effects; use slots above for a single effect",
      consumedBy: ["contributeBanks", "renderCell", "emitSource", "editor"],
    },
  ],
};
