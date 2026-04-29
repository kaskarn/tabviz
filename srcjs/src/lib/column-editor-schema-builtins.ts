// Built-in column-type schemas + the universal COMMON_FIELDS bundle.
//
// Each entry mirrors the args of the corresponding R `col_*` helper in
// R/classes-components.R. Adding a new R-side arg = one entry here. Slots
// (data bindings) are imported from VISUAL_TYPES in column-compat.ts so the
// editor and the type-menu stay aligned on what fields each type accepts.
//
// Importing this module triggers schema registration (side-effect at module
// load). The host imports it once.

import { VISUAL_TYPES } from "./column-compat";
import {
  type ColumnTypeSchema,
  type FieldDescriptor,
  registerColumnSchema,
} from "./column-editor-schema";

function slotsFor(type: ColumnTypeSchema["type"]) {
  return VISUAL_TYPES.find((v) => v.type === type)?.slots ?? [];
}

// ────────────────────────────────────────────────────────────────────────────
// COMMON_FIELDS — universal web_col() args composed into every type
// ────────────────────────────────────────────────────────────────────────────
//
// `header`, `align`, `headerAlign`, `showHeader` are surfaced as Format-section
// fields so users see them on every type. `wrap`, `naText`, `sortable` go to
// Advanced (collapsed by default) — rarely tweaked, but reachable.
//
// NOTE: width is intentionally omitted — adjusted via column drag handle.

export const COMMON_FIELDS_LIST: FieldDescriptor[] = [
  {
    key: "header",
    label: "Header",
    control: "text",
    section: "format",
    path: ["spec", "header"],
    placeholder: "Column header",
  },
  {
    key: "showHeader",
    label: "Show header",
    control: "checkbox",
    section: "format",
    path: ["spec", "showHeader"],
    defaultOnInsert: true,
  },
  {
    key: "align",
    label: "Cell align",
    control: "segmented",
    section: "format",
    path: ["spec", "align"],
    options: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ],
  },
  {
    key: "headerAlign",
    label: "Header align",
    control: "segmented",
    section: "format",
    path: ["spec", "headerAlign"],
    options: [
      { label: "Inherit", value: "" },
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ],
  },
  {
    key: "wrap",
    label: "Wrap text",
    control: "checkbox",
    section: "advanced",
    path: ["spec", "wrap"],
  },
  {
    key: "naText",
    label: "NA text",
    control: "text",
    section: "advanced",
    path: ["options", "naText"],
    placeholder: "blank",
  },
  {
    key: "sortable",
    label: "Sortable",
    control: "checkbox",
    section: "advanced",
    path: ["spec", "sortable"],
    defaultOnInsert: true,
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Per-type schemas
// ────────────────────────────────────────────────────────────────────────────

const textSchema: ColumnTypeSchema = {
  type: "text",
  slots: slotsFor("text"),
  fields: [
    {
      key: "maxChars",
      label: "Max characters",
      control: "number",
      section: "format",
      path: ["options", "text", "maxChars"],
      min: 1,
      step: 1,
      placeholder: "no limit",
      hint: "Truncate with ellipsis past this character count.",
    },
  ],
};

const numericSchema: ColumnTypeSchema = {
  type: "numeric",
  slots: slotsFor("numeric"),
  fields: [
    {
      key: "decimals",
      label: "Decimals",
      control: "number",
      section: "format",
      path: ["options", "numeric", "decimals"],
      min: 0,
      max: 10,
      step: 1,
      placeholder: "auto",
    },
    {
      key: "digits",
      label: "Sig. figures",
      control: "number",
      section: "format",
      path: ["options", "numeric", "digits"],
      min: 1,
      max: 10,
      step: 1,
      placeholder: "—",
      hint: "Number of significant figures. Mutually exclusive with decimals.",
    },
    {
      key: "prefix",
      label: "Prefix",
      control: "text",
      section: "format",
      path: ["options", "numeric", "prefix"],
      placeholder: "e.g. $",
    },
    {
      key: "suffix",
      label: "Suffix",
      control: "text",
      section: "format",
      path: ["options", "numeric", "suffix"],
      placeholder: "e.g. %",
    },
    {
      key: "thousandsSep",
      label: "Group thousands",
      control: "checkbox",
      section: "format",
      path: ["options", "numeric", "thousandsSep"],
      hint: "Insert a comma every three digits (1,000).",
    },
    {
      key: "abbreviate",
      label: "Abbreviate large numbers",
      control: "checkbox",
      section: "advanced",
      path: ["options", "numeric", "abbreviate"],
      hint: "1,100 → 1.1K, 2,500,000 → 2.5M.",
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Side-effect: register all built-in schemas at module load
// ────────────────────────────────────────────────────────────────────────────

const pvalueSchema: ColumnTypeSchema = {
  type: "pvalue",
  slots: slotsFor("pvalue"),
  fields: [
    {
      key: "format",
      label: "Format",
      control: "segmented",
      section: "format",
      path: ["options", "pvalue", "format"],
      options: [
        { label: "Auto", value: "auto" },
        { label: "Decimal", value: "decimal" },
        { label: "Scientific", value: "scientific" },
      ],
    },
    {
      key: "digits",
      label: "Sig. figures",
      control: "number",
      section: "format",
      path: ["options", "pvalue", "digits"],
      min: 1,
      max: 6,
      step: 1,
      placeholder: "2",
    },
    {
      key: "stars",
      label: "Show significance stars",
      control: "checkbox",
      section: "format",
      path: ["options", "pvalue", "stars"],
    },
    {
      key: "expThreshold",
      label: "Sci. threshold",
      control: "number",
      section: "advanced",
      path: ["options", "pvalue", "expThreshold"],
      step: 0.0001,
      placeholder: "0.001",
      hint: "Values below this use exponential notation.",
    },
    {
      key: "abbrevThreshold",
      label: "Abbrev. threshold",
      control: "number",
      section: "advanced",
      path: ["options", "pvalue", "abbrevThreshold"],
      step: 0.0001,
      placeholder: "off",
      hint: "Values below this render as '<threshold'.",
    },
  ],
};

const SCALE_OPTIONS = [
  { label: "Linear", value: "linear" },
  { label: "Log", value: "log" },
  { label: "Sqrt", value: "sqrt" },
];

const barSchema: ColumnTypeSchema = {
  type: "bar",
  slots: slotsFor("bar"),
  fields: [
    {
      key: "maxValue",
      label: "Max value",
      control: "number",
      section: "format",
      path: ["options", "bar", "maxValue"],
      step: 0.0001,
      placeholder: "auto",
    },
    {
      key: "scale",
      label: "Scale",
      control: "segmented",
      section: "format",
      path: ["options", "bar", "scale"],
      options: SCALE_OPTIONS,
      defaultOnInsert: "linear",
    },
    {
      key: "showLabel",
      label: "Show label",
      control: "checkbox",
      section: "format",
      path: ["options", "bar", "showLabel"],
      defaultOnInsert: true,
    },
    {
      key: "color",
      label: "Bar color",
      control: "color",
      section: "format",
      path: ["options", "bar", "color"],
      placeholder: "theme",
    },
  ],
};

const progressSchema: ColumnTypeSchema = {
  type: "progress",
  slots: slotsFor("progress"),
  fields: [
    {
      key: "maxValue",
      label: "Max value",
      control: "number",
      section: "format",
      path: ["options", "progress", "maxValue"],
      step: 0.0001,
      placeholder: "100",
    },
    {
      key: "scale",
      label: "Scale",
      control: "segmented",
      section: "format",
      path: ["options", "progress", "scale"],
      options: SCALE_OPTIONS,
      defaultOnInsert: "linear",
    },
    {
      key: "showLabel",
      label: "Show label",
      control: "checkbox",
      section: "format",
      path: ["options", "progress", "showLabel"],
      defaultOnInsert: true,
    },
    {
      key: "color",
      label: "Fill color",
      control: "color",
      section: "format",
      path: ["options", "progress", "color"],
      placeholder: "theme",
    },
  ],
};

const heatmapSchema: ColumnTypeSchema = {
  type: "heatmap",
  slots: slotsFor("heatmap"),
  fields: [
    {
      key: "decimals",
      label: "Decimals",
      control: "number",
      section: "format",
      path: ["options", "heatmap", "decimals"],
      min: 0,
      max: 10,
      step: 1,
      placeholder: "auto",
    },
    {
      key: "showValue",
      label: "Show value",
      control: "checkbox",
      section: "format",
      path: ["options", "heatmap", "showValue"],
    },
    {
      key: "scale",
      label: "Scale",
      control: "segmented",
      section: "format",
      path: ["options", "heatmap", "scale"],
      options: SCALE_OPTIONS,
      defaultOnInsert: "linear",
    },
    {
      key: "minValue",
      label: "Min value",
      control: "number",
      section: "advanced",
      path: ["options", "heatmap", "minValue"],
      step: 0.0001,
      placeholder: "auto",
    },
    {
      key: "maxValue",
      label: "Max value",
      control: "number",
      section: "advanced",
      path: ["options", "heatmap", "maxValue"],
      step: 0.0001,
      placeholder: "auto",
    },
  ],
};

const sparklineSchema: ColumnTypeSchema = {
  type: "sparkline",
  slots: slotsFor("sparkline"),
  fields: [
    {
      key: "type",
      label: "Chart type",
      control: "segmented",
      section: "format",
      path: ["options", "sparkline", "type"],
      options: [
        { label: "Line", value: "line" },
        { label: "Bar", value: "bar" },
        { label: "Area", value: "area" },
      ],
      defaultOnInsert: "line",
    },
    {
      key: "color",
      label: "Color",
      control: "color",
      section: "format",
      path: ["options", "sparkline", "color"],
      placeholder: "theme",
    },
    {
      key: "height",
      label: "Height (px)",
      control: "number",
      section: "advanced",
      path: ["options", "sparkline", "height"],
      min: 8,
      max: 80,
      step: 1,
      placeholder: "20",
    },
  ],
};

const starsSchema: ColumnTypeSchema = {
  type: "stars",
  slots: slotsFor("stars"),
  fields: [
    {
      key: "maxStars",
      label: "Max stars",
      control: "number",
      section: "format",
      path: ["options", "stars", "maxStars"],
      min: 1,
      max: 20,
      step: 1,
      placeholder: "5",
    },
    {
      key: "color",
      label: "Color",
      control: "color",
      section: "format",
      path: ["options", "stars", "color"],
      placeholder: "theme",
    },
    {
      key: "halfStars",
      label: "Allow half stars",
      control: "checkbox",
      section: "format",
      path: ["options", "stars", "halfStars"],
    },
    {
      key: "size",
      label: "Size",
      control: "segmented",
      section: "advanced",
      path: ["options", "stars", "size"],
      options: [
        { label: "S", value: "sm" },
        { label: "M", value: "base" },
        { label: "L", value: "lg" },
      ],
    },
    {
      key: "emptyColor",
      label: "Empty color",
      control: "color",
      section: "advanced",
      path: ["options", "stars", "emptyColor"],
      placeholder: "theme",
    },
    // Domain ([lo, hi]) remap is rarely needed and pairs two values into a
    // single tuple — out of scope for the schema's flat-field model in v1.
    // Users wanting a custom domain set it via R: col_stars(domain = c(lo, hi)).
  ],
};

const intervalSchema: ColumnTypeSchema = {
  type: "interval",
  slots: slotsFor("interval"),
  fields: [
    {
      key: "decimals",
      label: "Decimals",
      control: "number",
      section: "format",
      path: ["options", "interval", "decimals"],
      min: 0,
      max: 10,
      step: 1,
      placeholder: "auto",
    },
    {
      key: "digits",
      label: "Sig. figures",
      control: "number",
      section: "format",
      path: ["options", "interval", "digits"],
      min: 1,
      max: 10,
      step: 1,
      placeholder: "—",
      hint: "Mutually exclusive with decimals.",
    },
    {
      key: "separator",
      label: "Separator",
      control: "text",
      section: "format",
      path: ["options", "interval", "separator"],
      placeholder: "space",
    },
    {
      key: "thousandsSep",
      label: "Group thousands",
      control: "checkbox",
      section: "format",
      path: ["options", "interval", "thousandsSep"],
    },
    {
      key: "abbreviate",
      label: "Abbreviate large numbers",
      control: "checkbox",
      section: "advanced",
      path: ["options", "interval", "abbreviate"],
    },
  ],
};

const rangeSchema: ColumnTypeSchema = {
  type: "range",
  slots: slotsFor("range"),
  slotPaths: {
    min: ["options", "range", "minField"],
    max: ["options", "range", "maxField"],
  },
  fields: [
    {
      key: "separator",
      label: "Separator",
      control: "text",
      section: "format",
      path: ["options", "range", "separator"],
      placeholder: "–",
    },
    {
      key: "decimals",
      label: "Decimals",
      control: "number",
      section: "format",
      path: ["options", "range", "decimals"],
      min: 0,
      max: 10,
      step: 1,
      placeholder: "auto",
    },
    {
      key: "digits",
      label: "Sig. figures",
      control: "number",
      section: "format",
      path: ["options", "range", "digits"],
      min: 1,
      max: 10,
      step: 1,
      placeholder: "—",
    },
    {
      key: "thousandsSep",
      label: "Group thousands",
      control: "checkbox",
      section: "format",
      path: ["options", "range", "thousandsSep"],
    },
    {
      key: "abbreviate",
      label: "Abbreviate large numbers",
      control: "checkbox",
      section: "advanced",
      path: ["options", "range", "abbreviate"],
    },
    {
      key: "showBar",
      label: "Show range bar",
      control: "checkbox",
      section: "format",
      path: ["options", "range", "showBar"],
    },
  ],
};

// `custom` is the events / x-of-N type. Its options bucket is "events"
// (not "custom") and slot keys map directly: eventsField, nField.
const customSchema: ColumnTypeSchema = {
  type: "custom",
  slots: slotsFor("custom"),
  slotPaths: {
    eventsField: ["options", "events", "eventsField"],
    nField: ["options", "events", "nField"],
  },
  fields: [
    {
      key: "showPct",
      label: "Show percentage",
      control: "checkbox",
      section: "format",
      path: ["options", "events", "showPct"],
    },
    {
      key: "separator",
      label: "Separator",
      control: "text",
      section: "format",
      path: ["options", "events", "separator"],
      placeholder: "/",
    },
    {
      key: "thousandsSep",
      label: "Group thousands",
      control: "checkbox",
      section: "advanced",
      path: ["options", "events", "thousandsSep"],
    },
    {
      key: "abbreviate",
      label: "Abbreviate large numbers",
      control: "checkbox",
      section: "advanced",
      path: ["options", "events", "abbreviate"],
    },
  ],
};

const forestSchema: ColumnTypeSchema = {
  type: "forest",
  slots: slotsFor("forest"),
  fields: [
    {
      key: "scale",
      label: "Scale",
      control: "segmented",
      section: "format",
      path: ["options", "forest", "scale"],
      options: [
        { label: "Linear", value: "linear" },
        { label: "Log", value: "log" },
      ],
      defaultOnInsert: "linear",
    },
    {
      key: "axisLabel",
      label: "Axis label",
      control: "text",
      section: "format",
      path: ["options", "forest", "axisLabel"],
      placeholder: "Effect",
    },
    {
      key: "showAxis",
      label: "Show axis",
      control: "checkbox",
      section: "format",
      path: ["options", "forest", "showAxis"],
      defaultOnInsert: true,
    },
    {
      key: "axisGridlines",
      label: "Gridlines",
      control: "checkbox",
      section: "format",
      path: ["options", "forest", "axisGridlines"],
    },
    {
      key: "nullValue",
      label: "Null value",
      control: "number",
      section: "advanced",
      path: ["options", "forest", "nullValue"],
      step: 0.0001,
      placeholder: "0 / 1",
      hint: "Reference line. Defaults to 0 (linear) or 1 (log).",
    },
    // axisRange ([min, max]) pairs two values into a tuple — out of scope
    // for the schema's flat-field model in v1. Set via R: viz_forest(axis_range = c(lo, hi)).
    {
      key: "axisTicks",
      label: "Axis ticks",
      control: "ticks-list",
      section: "advanced",
      path: ["options", "forest", "axisTicks"],
      placeholder: "auto, or e.g. 0.5, 1, 2",
    },
  ],
};

const SIZE_OPTIONS_SML = [
  { label: "S", value: "sm" },
  { label: "M", value: "base" },
  { label: "L", value: "lg" },
];

const pictogramSchema: ColumnTypeSchema = {
  type: "pictogram",
  slots: slotsFor("pictogram"),
  fields: [
    {
      key: "glyph",
      label: "Glyph",
      control: "text",
      section: "format",
      path: ["options", "pictogram", "glyph"],
      placeholder: "e.g. ★ or 👤",
      hint: "Single character / emoji repeated for the value count.",
    },
    {
      key: "maxGlyphs",
      label: "Max glyphs",
      control: "number",
      section: "format",
      path: ["options", "pictogram", "maxGlyphs"],
      min: 1,
      max: 50,
      step: 1,
      placeholder: "auto",
    },
    {
      key: "halfGlyphs",
      label: "Allow half glyphs",
      control: "checkbox",
      section: "format",
      path: ["options", "pictogram", "halfGlyphs"],
    },
    {
      key: "color",
      label: "Color",
      control: "color",
      section: "format",
      path: ["options", "pictogram", "color"],
      placeholder: "theme",
    },
    {
      key: "emptyColor",
      label: "Empty color",
      control: "color",
      section: "advanced",
      path: ["options", "pictogram", "emptyColor"],
      placeholder: "theme",
    },
    {
      key: "size",
      label: "Size",
      control: "segmented",
      section: "format",
      path: ["options", "pictogram", "size"],
      options: SIZE_OPTIONS_SML,
    },
    {
      key: "layout",
      label: "Layout",
      control: "segmented",
      section: "format",
      path: ["options", "pictogram", "layout"],
      options: [
        { label: "Row", value: "row" },
        { label: "Stack", value: "stack" },
      ],
    },
    {
      key: "valueLabel",
      label: "Value label",
      control: "select",
      section: "advanced",
      path: ["options", "pictogram", "valueLabel"],
      options: [
        { label: "None", value: false },
        { label: "Leading", value: "leading" },
        { label: "Trailing", value: "trailing" },
        { label: "Default", value: true },
      ],
    },
    {
      key: "labelFormat",
      label: "Label format",
      control: "segmented",
      section: "advanced",
      path: ["options", "pictogram", "labelFormat"],
      options: [
        { label: "Integer", value: "integer" },
        { label: "Decimal", value: "decimal" },
      ],
    },
    {
      key: "labelDecimals",
      label: "Label decimals",
      control: "number",
      section: "advanced",
      path: ["options", "pictogram", "labelDecimals"],
      min: 0,
      max: 6,
      step: 1,
      placeholder: "auto",
    },
  ],
};

const ringSchema: ColumnTypeSchema = {
  type: "ring",
  slots: slotsFor("ring"),
  fields: [
    {
      key: "minValue",
      label: "Min value",
      control: "number",
      section: "format",
      path: ["options", "ring", "minValue"],
      step: 0.0001,
      placeholder: "0",
    },
    {
      key: "maxValue",
      label: "Max value",
      control: "number",
      section: "format",
      path: ["options", "ring", "maxValue"],
      step: 0.0001,
      placeholder: "1",
    },
    {
      key: "color",
      label: "Fill color",
      control: "color",
      section: "format",
      path: ["options", "ring", "color"],
      placeholder: "theme",
      hint: "Single color. For threshold-paired colors, set via R.",
    },
    {
      key: "trackColor",
      label: "Track color",
      control: "color",
      section: "advanced",
      path: ["options", "ring", "trackColor"],
      placeholder: "theme",
    },
    {
      key: "size",
      label: "Size",
      control: "segmented",
      section: "format",
      path: ["options", "ring", "size"],
      options: SIZE_OPTIONS_SML,
    },
    {
      key: "showLabel",
      label: "Show label",
      control: "checkbox",
      section: "format",
      path: ["options", "ring", "showLabel"],
      defaultOnInsert: true,
    },
    {
      key: "labelFormat",
      label: "Label format",
      control: "segmented",
      section: "advanced",
      path: ["options", "ring", "labelFormat"],
      options: [
        { label: "Percent", value: "percent" },
        { label: "Decimal", value: "decimal" },
        { label: "Integer", value: "integer" },
      ],
    },
    {
      key: "labelDecimals",
      label: "Label decimals",
      control: "number",
      section: "advanced",
      path: ["options", "ring", "labelDecimals"],
      min: 0,
      max: 6,
      step: 1,
      placeholder: "auto",
    },
  ],
};

const badgeSchema: ColumnTypeSchema = {
  type: "badge",
  slots: slotsFor("badge"),
  fields: [
    {
      key: "size",
      label: "Size",
      control: "segmented",
      section: "format",
      path: ["options", "badge", "size"],
      options: [
        { label: "S", value: "sm" },
        { label: "M", value: "base" },
      ],
    },
    {
      key: "shape",
      label: "Shape",
      control: "segmented",
      section: "format",
      path: ["options", "badge", "shape"],
      options: [
        { label: "Pill", value: "pill" },
        { label: "Circle", value: "circle" },
        { label: "Square", value: "square" },
      ],
    },
    {
      key: "outline",
      label: "Outline only",
      control: "checkbox",
      section: "format",
      path: ["options", "badge", "outline"],
    },
    // `variants`, `colors`, `thresholds` are richer mappings (object / array)
    // — out of scope for v1 schema fields; set via R: col_badge(variants = ...).
  ],
};

const iconSchema: ColumnTypeSchema = {
  type: "icon",
  slots: slotsFor("icon"),
  fields: [
    {
      key: "color",
      label: "Color",
      control: "color",
      section: "format",
      path: ["options", "icon", "color"],
      placeholder: "theme",
    },
    {
      key: "size",
      label: "Size",
      control: "segmented",
      section: "format",
      path: ["options", "icon", "size"],
      options: [
        { label: "S", value: "sm" },
        { label: "M", value: "base" },
        { label: "L", value: "lg" },
        { label: "XL", value: "xl" },
      ],
    },
    // `mapping` (value → glyph) is a multi-row dict — out of scope for v1.
  ],
};

const imgSchema: ColumnTypeSchema = {
  type: "img",
  slots: slotsFor("img"),
  fields: [
    {
      key: "height",
      label: "Height (px)",
      control: "number",
      section: "format",
      path: ["options", "img", "height"],
      min: 8,
      max: 400,
      step: 1,
      placeholder: "auto",
    },
    {
      key: "maxWidth",
      label: "Max width (px)",
      control: "number",
      section: "format",
      path: ["options", "img", "maxWidth"],
      min: 8,
      max: 800,
      step: 1,
      placeholder: "auto",
    },
    {
      key: "shape",
      label: "Shape",
      control: "segmented",
      section: "format",
      path: ["options", "img", "shape"],
      options: [
        { label: "Square", value: "square" },
        { label: "Circle", value: "circle" },
        { label: "Rounded", value: "rounded" },
      ],
    },
    {
      key: "fallback",
      label: "Fallback URL",
      control: "text",
      section: "advanced",
      path: ["options", "img", "fallback"],
      placeholder: "https://…",
    },
  ],
};

// viz_* types use the multi-effect custom renderer. The schema declares
// no fields beyond what COMMON_FIELDS provides; the effects UI lives in
// VizEffectsEditor.svelte and writes through editor-state.effects.
const vizBarSchema: ColumnTypeSchema = {
  type: "viz_bar",
  slots: slotsFor("viz_bar"),
  fields: [],
  customRenderer: "viz-effects",
};

const vizBoxplotSchema: ColumnTypeSchema = {
  type: "viz_boxplot",
  slots: slotsFor("viz_boxplot"),
  fields: [],
  customRenderer: "viz-effects",
};

const vizViolinSchema: ColumnTypeSchema = {
  type: "viz_violin",
  slots: slotsFor("viz_violin"),
  fields: [],
  customRenderer: "viz-effects",
};

const referenceSchema: ColumnTypeSchema = {
  type: "reference",
  slots: slotsFor("reference"),
  fields: [
    {
      key: "showIcon",
      label: "Show external icon",
      control: "checkbox",
      section: "format",
      path: ["options", "reference", "showIcon"],
    },
    {
      key: "maxChars",
      label: "Max characters",
      control: "number",
      section: "format",
      path: ["options", "reference", "maxChars"],
      min: 1,
      step: 1,
      placeholder: "no limit",
    },
  ],
};

const BUILTIN_SCHEMAS: ColumnTypeSchema[] = [
  textSchema,
  numericSchema,
  pvalueSchema,
  barSchema,
  progressSchema,
  heatmapSchema,
  sparklineSchema,
  starsSchema,
  intervalSchema,
  rangeSchema,
  customSchema,
  forestSchema,
  pictogramSchema,
  ringSchema,
  badgeSchema,
  iconSchema,
  imgSchema,
  referenceSchema,
  vizBarSchema,
  vizBoxplotSchema,
  vizViolinSchema,
];

for (const s of BUILTIN_SCHEMAS) {
  registerColumnSchema(s);
}

// Re-export the populated common fields for the host to consume directly
// (rather than mutating the COMMON_FIELDS placeholder in the schema module).
export { COMMON_FIELDS_LIST as COMMON_FIELDS };
