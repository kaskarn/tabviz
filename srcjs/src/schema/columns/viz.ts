// `viz` — abstract column schema. Cross-cuts all viz_* column types
// (forest, viz_bar, viz_boxplot, viz_violin) that share the axis
// machinery — scale, range, label, ticks, gridlines, etc. Concrete
// viz schemas inherit BASE through VIZ to pick up the axis surface
// in addition to the universal layout knobs.
//
// VIZ never appears in the column picker; users pick a concrete viz_
// schema. The renderer (Phase 7) treats VIZ inheritance as the signal
// to allocate axis space and call the axis contribution behavior.

import type { ColumnSchema } from "../types";

export const VIZ_SCHEMA: ColumnSchema = {
  key: "viz",
  label: "Viz",
  glyph: "type.viz",
  abstract: true,
  defaultOpen: true,
  inherits: "base",
  options: [
    {
      key: "scale",
      label: "Scale",
      control: "segmented",
      default: "linear",
      kind: "core",
      segments: [
        { value: "linear", label: "Linear" },
        { value: "log",    label: "Log" },
      ],
      consumedBy: ["contributeBanks", "renderCell", "emitSource", "editor"],
    },
    {
      key: "nullValue",
      label: "Null value",
      control: "number",
      default: null,
      kind: "core",
      hint: "Reference line; 0 for linear, 1 for log default",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "axisLabel",
      label: "Axis label",
      control: "text",
      default: null,
      kind: "editor",
      hint: "Shown below the axis",
      consumedBy: ["contributeBanks", "renderCell", "emitSource", "editor"],
    },
    {
      key: "axisRange",
      // [min, max] numeric pair; custom control later.
      label: "Axis range",
      control: "custom",
      default: null,
      kind: "core",
      customComponent: "MinMaxPair",
      hint: "Auto from data when null",
      consumedBy: ["contributeBanks", "renderCell", "emitSource", "editor"],
    },
    {
      key: "axisTicks",
      // Numeric[]; custom control later.
      label: "Axis ticks",
      control: "custom",
      default: null,
      kind: "editor",
      customComponent: "TickList",
      hint: "Auto-computed when null",
      consumedBy: ["contributeBanks", "renderCell", "emitSource", "editor"],
    },
    {
      key: "axisGridlines",
      label: "Gridlines",
      control: "toggle",
      default: false,
      kind: "editor",
      consumedBy: ["contributeBanks", "renderCell", "emitSource", "editor"],
    },
    {
      key: "showAxis",
      label: "Show axis",
      control: "toggle",
      default: true,
      kind: "editor",
      consumedBy: ["contributeBanks", "renderCell", "emitSource", "editor"],
    },
    {
      key: "annotations",
      label: "Annotations",
      control: "custom",
      default: null,
      kind: "core",
      customComponent: "AnnotationList",
      hint: "Reference lines, callouts",
      consumedBy: ["renderCell", "emitSource", "editor"],
    },
    {
      key: "sharedAxis",
      label: "Shared axis",
      control: "toggle",
      default: false,
      kind: "core",
      hint: "Across split-view columns",
      // Cross-runtime consumer: R split_table() reads the column-level override (test-parity-split-shared.R)
      consumedBy: ["emitSource", "editor"],
    },
  ],
};
