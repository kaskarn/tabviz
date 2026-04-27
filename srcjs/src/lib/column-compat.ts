// Registry of visual column types + slot compatibility helpers used by the
// interactive column editor (see ColumnEditorPopover.svelte).

import type {
  AvailableField,
  FieldCategory,
  SlotSpec,
  VisualTypeDef,
} from "../types";

const NUMERIC_LIKE: FieldCategory[] = ["numeric", "integer"];
const STRING_LIKE: FieldCategory[] = ["string"];
const ARRAY_NUMERIC: FieldCategory[] = ["array-numeric"];

const valueSlot = (accepts: FieldCategory[]): SlotSpec => ({
  key: "value",
  label: "Field",
  accepts,
  required: true,
});

// Ordered so the editor can group by category in its Step 1 picker.
export const VISUAL_TYPES: VisualTypeDef[] = [
  // --- Text / numeric formatters ----------------------------------------
  {
    type: "text",
    label: "Text",
    description: "Plain text value",
    category: "text",
    slots: [
      {
        key: "value",
        label: "Field",
        accepts: ["string", "numeric", "integer", "logical", "date", "other"],
        required: true,
      },
    ],
  },
  {
    type: "numeric",
    label: "Number",
    description: "Formatted numeric value",
    category: "numeric",
    slots: [valueSlot(NUMERIC_LIKE)],
  },
  {
    type: "pvalue",
    label: "P-value",
    description: "Smart p-value formatter with optional significance stars",
    category: "numeric",
    slots: [valueSlot(["numeric"])],
  },
  // --- Inline viz -------------------------------------------------------
  {
    type: "bar",
    label: "Bar",
    description: "Horizontal bar chart — length encodes value",
    category: "viz",
    slots: [valueSlot(NUMERIC_LIKE)],
  },
  {
    type: "heatmap",
    label: "Heatmap cell",
    description: "Color-intensity cell encoding a numeric value",
    category: "viz",
    slots: [valueSlot(NUMERIC_LIKE)],
  },
  {
    type: "progress",
    label: "Progress",
    description: "Filled progress bar (0-max)",
    category: "viz",
    slots: [valueSlot(NUMERIC_LIKE)],
  },
  {
    type: "sparkline",
    label: "Sparkline",
    description: "Mini line / bar / area chart from an array column",
    category: "viz",
    slots: [valueSlot(ARRAY_NUMERIC)],
  },
  // --- Icons / badges / images ------------------------------------------
  {
    type: "badge",
    label: "Badge",
    description: "Pill-shaped label",
    category: "icon",
    slots: [valueSlot(STRING_LIKE)],
  },
  {
    type: "icon",
    label: "Icon",
    description: "Emoji / unicode icon, optionally mapped from values",
    category: "icon",
    slots: [valueSlot(["string", "logical", "numeric", "integer"])],
  },
  {
    type: "stars",
    label: "Stars",
    description: "Rating display (0-N stars)",
    category: "icon",
    slots: [valueSlot(NUMERIC_LIKE)],
  },
  {
    type: "pictogram",
    label: "Pictogram",
    description: "Repeated glyph proportional to a count or rating",
    category: "icon",
    slots: [valueSlot(NUMERIC_LIKE)],
  },
  {
    type: "ring",
    label: "Ring",
    description: "Donut gauge with centered label and threshold-based color",
    category: "viz",
    slots: [valueSlot(NUMERIC_LIKE)],
  },
  {
    type: "img",
    label: "Image",
    description: "Inline image from a URL field",
    category: "icon",
    slots: [valueSlot(STRING_LIKE)],
  },
  {
    type: "reference",
    label: "Reference",
    description: "Truncated text, optionally a link",
    category: "text",
    slots: [
      { key: "value", label: "Text", accepts: STRING_LIKE, required: true },
      {
        key: "hrefField",
        label: "Link URL (optional)",
        accepts: STRING_LIKE,
        required: false,
      },
    ],
  },
  // --- Intervals / ranges ----------------------------------------------
  {
    type: "range",
    label: "Range",
    description: "Two values displayed as a range (e.g. 18 – 65)",
    category: "interval",
    slots: [
      {
        key: "min",
        label: "Min",
        accepts: NUMERIC_LIKE,
        required: true,
        autoPair: { suffixes: ["_min", "_lo", "_low"] },
      },
      {
        key: "max",
        label: "Max",
        accepts: NUMERIC_LIKE,
        required: true,
        autoPair: { suffixes: ["_max", "_hi", "_high"] },
      },
    ],
  },
  {
    type: "interval",
    label: "Interval",
    description: "Point estimate with confidence interval (e.g. 1.2 [0.9, 1.5])",
    category: "interval",
    slots: [
      { key: "point", label: "Estimate", accepts: NUMERIC_LIKE, required: true },
      {
        key: "lower",
        label: "Lower CI",
        accepts: NUMERIC_LIKE,
        required: true,
        autoPair: {
          suffixes: ["_lo", "_low", "_lower", "_ci_lo", "_ci_lower", "_l"],
        },
      },
      {
        key: "upper",
        label: "Upper CI",
        accepts: NUMERIC_LIKE,
        required: true,
        autoPair: {
          suffixes: ["_hi", "_high", "_upper", "_ci_hi", "_ci_upper", "_u"],
        },
      },
    ],
  },
  {
    type: "forest",
    label: "Forest plot",
    description: "Graphical point + CI interval in a shared axis",
    category: "interval",
    slots: [
      { key: "point", label: "Estimate", accepts: NUMERIC_LIKE, required: true },
      {
        key: "lower",
        label: "Lower CI",
        accepts: NUMERIC_LIKE,
        required: true,
        autoPair: {
          suffixes: ["_lo", "_low", "_lower", "_ci_lo", "_ci_lower", "_l"],
        },
      },
      {
        key: "upper",
        label: "Upper CI",
        accepts: NUMERIC_LIKE,
        required: true,
        autoPair: {
          suffixes: ["_hi", "_high", "_upper", "_ci_hi", "_ci_upper", "_u"],
        },
      },
    ],
  },
  {
    type: "custom",
    label: "Events",
    description: "Events / total display, e.g. 45 / 120",
    category: "numeric",
    slots: [
      {
        key: "eventsField",
        label: "Events",
        accepts: NUMERIC_LIKE,
        required: true,
        autoPair: { suffixes: ["_events", "_e", "_x"] },
      },
      {
        key: "nField",
        label: "Total",
        accepts: NUMERIC_LIKE,
        required: true,
        autoPair: { suffixes: ["_n", "_total"] },
      },
    ],
  },
  // --- Dynamic-cardinality viz (author-only) ----------------------------
  {
    type: "viz_bar",
    label: "Viz: bars",
    description: "Multi-series bar chart — configure via R extra_columns",
    category: "viz",
    slots: [],
    authorOnly: true,
  },
  {
    type: "viz_boxplot",
    label: "Viz: boxplot",
    description: "Boxplot from array or quantile columns — configure via R",
    category: "viz",
    slots: [],
    authorOnly: true,
  },
  {
    type: "viz_violin",
    label: "Viz: violin",
    description: "Violin density plot — configure via R extra_columns",
    category: "viz",
    slots: [],
    authorOnly: true,
  },
];

export function getVisualTypeDef(type: string): VisualTypeDef | undefined {
  return VISUAL_TYPES.find((t) => t.type === type);
}

// Viz column types: render as inline SVG charts rather than formatted text.
// Headers above these default to centered alignment.
const VIZ_TYPES = new Set<string>([
  "bar", "progress", "sparkline", "heatmap", "stars", "pictogram", "ring",
  "forest", "viz_bar", "viz_boxplot", "viz_violin",
]);

export function isVizType(type: string | undefined | null): boolean {
  if (!type) return false;
  return VIZ_TYPES.has(type);
}

// Resolve the effective show-header flag given explicit `showHeader` (from
// spec) and the column's header text. Returns true/false.
export function resolveShowHeader(
  showHeader: boolean | undefined,
  header: string | undefined | null,
): boolean {
  if (showHeader === true) return true;
  if (showHeader === false) return false;
  return typeof header === "string" && header.length > 0;
}

export function slotCompatibleFields(
  slot: SlotSpec,
  available: AvailableField[],
): AvailableField[] {
  return available.filter((f) => slot.accepts.includes(f.category));
}

// A type is "satisfiable" when every required slot has at least one
// compatible field in the available list. The editor greys out types that
// can't be satisfied by the current data.
export function isTypeSatisfiable(
  def: VisualTypeDef,
  available: AvailableField[],
): boolean {
  if (def.authorOnly) return false;
  for (const slot of def.slots) {
    if (!slot.required) continue;
    if (slotCompatibleFields(slot, available).length === 0) return false;
  }
  return true;
}

// Strip a numeric-prefix suffix like "_2" off an auto-paired field stem,
// so that "hr_2" still matches "hr_lo".
function stemOf(field: string): string {
  return field.replace(/_\d+$/, "");
}

// Given a user-picked primary field, walk each OTHER slot's autoPair
// suffixes and pick the first available field whose name looks like
// `<stem><suffix>`. Returns a partial slot -> field map.
export function autoPairSlots(
  def: VisualTypeDef,
  primarySlotKey: string,
  primaryField: string,
  available: AvailableField[],
): Record<string, string> {
  const out: Record<string, string> = { [primarySlotKey]: primaryField };
  const stem = stemOf(primaryField);
  const byName = new Map(available.map((f) => [f.field, f]));

  for (const slot of def.slots) {
    if (slot.key === primarySlotKey) continue;
    if (!slot.autoPair) continue;
    const compatible = new Set(
      slotCompatibleFields(slot, available).map((f) => f.field),
    );
    for (const suffix of slot.autoPair.suffixes) {
      const candidate = stem + suffix;
      if (byName.has(candidate) && compatible.has(candidate)) {
        out[slot.key] = candidate;
        break;
      }
    }
  }

  return out;
}
