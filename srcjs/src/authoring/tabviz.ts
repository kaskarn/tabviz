/**
 * Top-level `tabviz()` constructor — TS mirror of `R::tabviz()`.
 *
 * Returns a fully-formed `WebSpec` that the runtime (`createTabviz`) can
 * mount. Accepts:
 *  - `data`: array of row objects (each row's fields are read by column builders)
 *  - `columns`: array of `ColumnDef` from `colText` / `vizForest` / `colGroup` etc.
 *  - `theme`: a name string (`"lancet"`), a `{ extend, overrides }` object, or
 *    a pre-resolved `WebThemeV2`. Defaults to `"bmj"` — the package's
 *    current default theme (modern editorial register).
 *  - Other top-level args mirror the R `tabviz()` signature.
 */

import type {
  WebSpec, WebData, Row, ColumnDef, InteractionSpec, LayoutSpec, PlotLabels,
  AvailableField, FieldCategory,
} from "../types";
import type {
  WidgetBanks, FootnoteEntry, AxisEntry, LegendEntry, ConditionEntry, BankEntry,
} from "../schema/banks";
import {
  evaluateConditions, type ConditionAuthoring,
} from "../schema/conditions";
import { CURRENT_VERSION } from "../spec";
import { resolveThemeRef, type ThemeRef } from "../lib/theme-api";
import { colText } from "./columns";

/**
 * Mirror of `R::tabviz()`'s label-header default — when `labelHeader` is
 * not supplied, the label field is prettified the same way: replace
 * underscores with spaces, split camelCase, and Title-Case the result.
 * So `label: "study_name"` produces header `"Study Name"`, matching R.
 */
function prettifyLabelHeader(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface TabvizArgs {
  /** Row data — array of plain objects keyed by field name. */
  data: Record<string, unknown>[];
  /** Column id used as the row label (sticky-left first column). */
  label?: string;
  /** Column header for the label column. */
  labelHeader?: string;
  /** Field used to group rows. */
  group?: string;
  /** Column definitions. */
  columns: ColumnDef[];
  /** Extra columns (appended after `columns`). */
  extraColumns?: ColumnDef[];
  /** Theme — name string, `{ extend, overrides }`, or a pre-resolved WebTheme. */
  theme?: ThemeRef;
  // Labels
  title?: string;
  subtitle?: string;
  caption?: string;
  footnote?: string;
  watermark?: string;
  watermarkColor?: string;
  watermarkOpacity?: number;
  // Interaction toggles — defaults all enabled, matching R's `web_interaction()`.
  showFilters?: boolean;
  showLegend?: boolean;
  enableSort?: boolean;
  enableCollapse?: boolean;
  enableSelect?: boolean;
  enableHover?: boolean;
  enableResize?: boolean;
  enableExport?: boolean;
  enableFilters?: boolean;
  enableReorderRows?: boolean;
  enableReorderColumns?: boolean;
  enableEdit?: boolean;
  showGroupCounts?: boolean;
  tooltipFields?: string[];
  // Layout
  plotWidth?: number | "auto";
  /** Target aspect ratio for export. `null` means natural. */
  targetAspect?: number | null;
  // Initial state
  initialSort?: { column: string; direction: "asc" | "desc" | "none" };
  initialFilters?: { field: string; operator: string; value: unknown }[];
  initialHiddenColumns?: string[];
  /** Original-call deparse, for the "View source" baseline line. Optional. */
  originalCall?: string;
  // Widget banks (footnotes, axes, legends, conditions, custom).
  // User-authored entries flow through the wire; schema behaviors
  // contribute additional entries at runtime via
  // computeEffectiveBanks(spec).
  footnotes?: FootnoteEntry[];
  axes?: AxisEntry[];
  legends?: LegendEntry[];
  /**
   * Authored conditions — provided as rule descriptors; tabviz()
   * evaluates the rules against the data and materializes
   * ConditionEntry values for the wire.
   *
   *   tabviz({ data,
   *     conditions: [
   *       { name: 'significant',
   *         rule: (r, rows) => r.p < 0.05 / rows.length },
   *     ],
   *     columns: [...]
   *   })
   *
   * The evaluated boolean vectors are then referenceable via
   * `cond("significant")` inside any styleMapping field.
   */
  conditions?: ConditionAuthoring[];
  customBanks?: Record<string, BankEntry[]>;
}

/**
 * Build a WebSpec from authoring-side arguments. Defaults match R's
 * `tabviz()`: bmj theme (default), all interactions enabled, no labels, no
 * initial state.
 */
export function tabviz(args: TabvizArgs): WebSpec {
  // Mirror of R's row-id convention: positional `row_<1-based-index>`. The
  // earlier TS path preferred `row[label]` / `row.id`, but that made R↔TS
  // wire shapes diverge for callers who happened to have an `id` field in
  // their data. R always uses positional ids; TS now does too.
  const rows: Row[] = args.data.map((row, i) => {
    const labelVal = args.label != null ? String(row[args.label] ?? "") : String(i + 1);
    return {
      id: `row_${i + 1}`,
      label: labelVal,
      groupId: args.group != null ? String(row[args.group] ?? "") : null,
      metadata: { ...row },
    };
  });

  // Distinct groups from row data, in order of appearance.
  const seenGroups = new Set<string>();
  const groups: WebData["groups"] = [];
  if (args.group != null) {
    for (const row of rows) {
      const g = row.groupId;
      if (g != null && !seenGroups.has(g)) {
        seenGroups.add(g);
        groups.push({ id: g, label: g, collapsed: false, depth: 0 });
      }
    }
  }

  const data: WebData = {
    rows,
    groups,
    summaries: [],
    overall: null,
    groupCol: args.group ?? null,
    weightCol: null,
  };

  const interaction: InteractionSpec = {
    showFilters: args.showFilters ?? true,
    showLegend: args.showLegend ?? true,
    enableSort: args.enableSort ?? true,
    enableCollapse: args.enableCollapse ?? true,
    enableSelect: args.enableSelect ?? true,
    enableHover: args.enableHover ?? true,
    enableResize: args.enableResize ?? true,
    enableExport: args.enableExport ?? true,
    enableReorderRows: args.enableReorderRows ?? true,
    enableReorderColumns: args.enableReorderColumns ?? true,
    enableEdit: args.enableEdit ?? true,
    enableFilters: args.enableFilters ?? true,
    showGroupCounts: args.showGroupCounts ?? false,
    tooltipFields: args.tooltipFields ?? null,
  };

  const layout: LayoutSpec = {
    plotWidth: args.plotWidth ?? "auto",
  };

  const labels: PlotLabels = {
    title: args.title ?? null,
    subtitle: args.subtitle ?? null,
    caption: args.caption ?? null,
    footnote: args.footnote ?? null,
  };

  const theme = resolveThemeRef(args.theme ?? "bmj");

  // Build the row-label column as a top-level `labelColumn` slot when
  // `label` is set, rather than prepending to `columns`. Gives the
  // renderer's "primary column" hook a named wire field instead of
  // relying on positional + id="label" sentinel detection. Caller-
  // supplied `args.columns` with an `id === "label"` column is treated
  // as an explicit author choice; we honor it as the labelColumn
  // (extracted out of `columns`) so the wire is canonical either way.
  const inlineLabelIdx = args.columns.findIndex((c) => c.id === "label");
  let labelColumn: ColumnDef | null = null;
  let columns = args.columns;
  let synthesizedRowNumberField: string | null = null;
  if (inlineLabelIdx >= 0) {
    labelColumn = args.columns[inlineLabelIdx];
    columns = args.columns.filter((_, i) => i !== inlineLabelIdx);
  } else if (args.label != null) {
    labelColumn = colText({
      field: args.label,
      header: args.labelHeader ?? prettifyLabelHeader(args.label),
      id: "label",
    });
  } else {
    // Mirror of R::tabviz: when no `label` is supplied, synthesize a
    // row-number column ("#") so the widget always has a row-identifier
    // surface. The field is added to each row's metadata below.
    synthesizedRowNumberField = "__row_number__";
    labelColumn = colText({
      field: synthesizedRowNumberField,
      header: "#",
      id: "label",
    });
  }
  if (synthesizedRowNumberField) {
    rows.forEach((r, i) => {
      r.metadata[synthesizedRowNumberField!] = String(i + 1);
      // The row's `label` was set to "" above (no `args.label`); replace
      // it with the synthetic row number so `row.label` matches what the
      // label column will render.
      r.label = String(i + 1);
    });
  }

  // Available-fields manifest — drives the in-widget column editor's
  // "field" dropdown and the slot/category compatibility checks for
  // insert/configure. Mirrors `R::serialize_available_fields()`: one
  // entry per data column (no `available_exclude` analogue here yet —
  // TS callers can post-filter the manifest if they need to hide a
  // helper field). Without this, the pure-TS render's column editor
  // shows an empty dropdown and refuses to recognize any data columns.
  const sampleRow = args.data[0] ?? {};
  const availableFields: AvailableField[] = Object.keys(sampleRow).map((field) => ({
    field,
    label: field,
    category: inferFieldCategory(args.data, field),
  }));

  const spec: WebSpec = {
    version: CURRENT_VERSION,
    data,
    columns,
    labelColumn,
    extraColumns: args.extraColumns,
    availableFields,
    theme: theme as unknown as WebSpec["theme"],
    interaction,
    layout,
    labels,
    watermark: args.watermark,
    watermarkColor: args.watermarkColor,
    watermarkOpacity: args.watermarkOpacity,
  };

  if (args.targetAspect !== undefined) spec.targetAspect = args.targetAspect;
  if (args.originalCall !== undefined) spec.originalCall = args.originalCall;
  if (args.initialSort || args.initialFilters || args.initialHiddenColumns) {
    spec.initialState = {
      sort: args.initialSort,
      filters: args.initialFilters,
      hiddenColumns: args.initialHiddenColumns,
    };
  }

  // Widget banks — user-authored entries flow through; schema
  // behaviors contribute additional entries at runtime.
  const banks: WidgetBanks = {};
  if (args.footnotes?.length)   banks.footnotes = args.footnotes;
  if (args.axes?.length)        banks.axes      = args.axes;
  if (args.legends?.length)     banks.legends   = args.legends;
  if (args.conditions?.length) {
    // Materialize ConditionEntry values by evaluating rules against
    // the data. The renderer never re-evaluates; this is the only
    // computation moment for condition values.
    banks.conditions = evaluateConditions(args.conditions, { rows });
  }
  if (args.customBanks && Object.keys(args.customBanks).length > 0) {
    banks.custom = args.customBanks;
  }
  if (Object.keys(banks).length > 0) spec.banks = banks;

  return spec;
}

// Mirror of `R::infer_field_category()` — scans the data column to pick
// the most specific category that fits, falling back to "other". Used by
// the column editor's slot-compatibility checks; keep in sync with the
// R-side categorizer.
function inferFieldCategory(rows: Record<string, unknown>[], field: string): FieldCategory {
  let sawNumber = false;
  let sawString = false;
  let sawBoolean = false;
  let sawDate = false;
  let sawArrayOfNumbers = false;
  let sawAny = false;
  for (const row of rows) {
    const v = row[field];
    if (v == null) continue;
    sawAny = true;
    if (typeof v === "boolean") sawBoolean = true;
    else if (typeof v === "number") sawNumber = true;
    else if (v instanceof Date) sawDate = true;
    else if (Array.isArray(v)) {
      if (v.every((x) => typeof x === "number")) sawArrayOfNumbers = true;
    } else if (typeof v === "string") sawString = true;
  }
  if (!sawAny) return "other";
  if (sawArrayOfNumbers) return "array-numeric";
  if (sawDate) return "date";
  if (sawNumber && !sawString) return "numeric";
  if (sawBoolean && !sawString && !sawNumber) return "logical";
  if (sawString) return "string";
  return "other";
}
