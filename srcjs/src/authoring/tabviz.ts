/**
 * Top-level `tabviz()` constructor — TS mirror of `R::tabviz()`.
 *
 * Returns a fully-formed `WebSpec` that the runtime (`createTabviz`) can
 * mount. Accepts:
 *  - `data`: array of row objects (each row's fields are read by column builders)
 *  - `columns`: array of `ColumnDef` from `colText` / `vizForest` / `colGroup` etc.
 *  - `theme`: a name string (`"nejm"`), a `{ extend, overrides }` object, or
 *    a pre-resolved `WebTheme`. Defaults to `"nejm"` — the package's default
 *    theme (the Clinical archetype, post 27→9 cull).
 *  - Other top-level args mirror the R `tabviz()` signature.
 */

import type {
  WebSpec, WebData, Row, ColumnDef, InteractionSpec, LayoutSpec, PlotLabels, NoteSpec,
  AvailableField, FieldCategory,
} from "../types";
import type {
  WidgetBanks, FootnoteEntry, AxisEntry, LegendEntry, BankEntry,
} from "../schema/banks";
import {
  evaluateConditions, type ConditionAuthoring,
} from "../schema/conditions";
import { CURRENT_VERSION } from "../spec";
import { computePageBreaks } from "./paginate";
import { resolveThemeRef, type ThemeRef } from "../lib/theme/theme-api";
import { applyThemeColumnDefaults } from "../lib/theme/column-defaults";
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

/** Pagination options for `tabviz({ paginate })`. A bare number is shorthand
 *  for `{ rows: n }`. Mirrors R `paginate_spec()`; breakpoints are precomputed
 *  here (computePageBreaks) so the wire carries `paginate.pages`. */
export interface PaginateOptions {
  /** Rows per page (default 30). */
  rows?: number;
  /** Never split a group across pages (default true). */
  keepGroups?: boolean;
  /** Minimum rows on the trailing page (default 3). */
  orphanMin?: number;
  breakOn?: "split" | "group" | "none";
  repeatHeader?: boolean;
  repeatLegend?: boolean;
  repeatTitle?: boolean;
  footnotesOn?: "last" | "every";
  pageLabel?: "x_of_y" | "x" | false;
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
  /** Field whose per-row value is markdown shown in a details/disclosure panel
   *  (mirrors R `details = "col"`). Empty values get no panel. */
  details?: string;
  /** Annotation/note rows (full-width prose after a target row). `after` is a
   *  wire row id (`row_<i>`). For label/index resolution use the `addNote`
   *  modifier or the R `add_note()` verb. */
  notes?: NoteSpec[];
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
  /** Short stamp label for the caption chip ("TABLE 2"). Renders only
   *  when the theme pins effects.caption_style = "chip". */
  tag?: string;
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
  /** Author freeze: FALSE removes the settings cog so viewers of a
   *  published dashboard can't restyle the figure live. Default TRUE. */
  enableThemeEdit?: boolean;
  /** Forest/viz x-axis domain zoom (Ctrl/Cmd+wheel, drag pan, dblclick
   *  reset). Default FALSE — domain zoom changes what the figure shows,
   *  so it is opt-in (matches R `web_interaction()`). */
  enableAxisZoom?: boolean;
  /** Arrange tool: toolbar mode revealing every resize seam. Default
   *  FALSE (conservative-everywhere). */
  enableArrange?: boolean;
  showGroupCounts?: boolean;
  tooltipFields?: string[];
  /** Paginate the table — a number (rows per page) or a `PaginateOptions`.
   *  Breakpoints (grouped breaks + orphan rules) are precomputed; the wire
   *  carries `paginate.pages`. Matches R `tabviz(paginate=)`. */
  paginate?: number | PaginateOptions;
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
    const detailsVal = args.details != null ? String(row[args.details] ?? "").trim() : "";
    return {
      id: `row_${i + 1}`,
      label: labelVal,
      groupId: args.group != null ? String(row[args.group] ?? "") : null,
      metadata: { ...row },
      ...(detailsVal !== "" ? { details: detailsVal } : {}),
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

  // SPARSE interaction tier (interactivity-UX arc P1): emit only the flags
  // the author explicitly passed. Unset flags resolve through theme opinion
  // → global tier → baked defaults in lib/interaction-resolve.ts — eagerly
  // filling defaults here would shadow every other tier.
  const interaction: InteractionSpec = {};
  const setFlag = <K extends keyof InteractionSpec>(key: K, value: InteractionSpec[K]) => {
    if (value !== undefined) interaction[key] = value;
  };
  setFlag("showFilters", args.showFilters);
  setFlag("showLegend", args.showLegend);
  setFlag("enableSort", args.enableSort);
  setFlag("enableCollapse", args.enableCollapse);
  setFlag("enableSelect", args.enableSelect);
  setFlag("enableHover", args.enableHover);
  setFlag("enableResize", args.enableResize);
  setFlag("enableExport", args.enableExport);
  setFlag("enableReorderRows", args.enableReorderRows);
  setFlag("enableReorderColumns", args.enableReorderColumns);
  setFlag("enableEdit", args.enableEdit);
  setFlag("enableThemeEdit", args.enableThemeEdit);
  setFlag("enableAxisZoom", args.enableAxisZoom);
  setFlag("enableArrange", args.enableArrange);
  setFlag("enableFilters", args.enableFilters);
  setFlag("showGroupCounts", args.showGroupCounts);
  setFlag("tooltipFields", args.tooltipFields ?? undefined);

  const layout: LayoutSpec = {
    plotWidth: args.plotWidth ?? "auto",
  };

  const labels: PlotLabels = {
    title: args.title ?? null,
    subtitle: args.subtitle ?? null,
    caption: args.caption ?? null,
    tag: args.tag ?? null,
    footnote: args.footnote ?? null,
  };

  const theme = resolveThemeRef(args.theme ?? "nejm");

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

  // Theme-as-house-style: a theme's `column_defaults` fill unset styling/
  // editor options per column TYPE (kind-gated; the author always wins).
  // Applied at construction so the wire stays a normal spec. (Interactive
  // theme-switch re-application is a follow-up — this is the authoring path.)
  const themeColumnDefaults =
    (theme as { authoringInputs?: { column_defaults?: Parameters<typeof applyThemeColumnDefaults>[1] } })
      .authoringInputs?.column_defaults;
  if (themeColumnDefaults) {
    columns = applyThemeColumnDefaults(columns, themeColumnDefaults);
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
    ...(args.notes?.length ? { notes: args.notes } : {}),
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

  // Pagination — precompute breakpoints (computePageBreaks, the TS port of R's
  // compute_page_breaks) over the rendered group ids so the wire carries the
  // same `pages` shape an R author produces.
  if (args.paginate != null) {
    const p: PaginateOptions = typeof args.paginate === "number" ? { rows: args.paginate } : args.paginate;
    const cfg = {
      rows: p.rows ?? 30,
      breakOn: p.breakOn ?? "split" as const,
      keepGroups: p.keepGroups ?? true,
      orphanMin: p.orphanMin ?? 3,
      repeatHeader: p.repeatHeader ?? true,
      repeatLegend: p.repeatLegend ?? true,
      repeatTitle: p.repeatTitle ?? true,
      footnotesOn: p.footnotesOn ?? "last" as const,
      pageLabel: p.pageLabel ?? "x_of_y" as const,
    };
    const { pages, nPages } = computePageBreaks(
      rows.map((r) => r.groupId ?? null),
      { rows: cfg.rows, keepGroups: cfg.keepGroups, orphanMin: cfg.orphanMin },
    );
    spec.paginate = { ...cfg, pages, nPages };
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
