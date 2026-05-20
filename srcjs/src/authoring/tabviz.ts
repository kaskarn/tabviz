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
} from "../types";
import { CURRENT_VERSION } from "../spec";
import { resolveThemeRef, type ThemeRef } from "../lib/theme-api";
import { colText } from "./columns";

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
}

/**
 * Build a WebSpec from authoring-side arguments. Defaults match R's
 * `tabviz()`: bmj theme (default), all interactions enabled, no labels, no
 * initial state.
 */
export function tabviz(args: TabvizArgs): WebSpec {
  const rows: Row[] = args.data.map((row, i) => {
    const id = String(row[args.label ?? "id"] ?? `row_${i}`);
    const labelVal = args.label != null ? String(row[args.label] ?? "") : id;
    return {
      id,
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
  if (inlineLabelIdx >= 0) {
    labelColumn = args.columns[inlineLabelIdx];
    columns = args.columns.filter((_, i) => i !== inlineLabelIdx);
  } else if (args.label != null) {
    labelColumn = colText({
      field: args.label,
      header: args.labelHeader ?? args.label,
      id: "label",
    });
  }

  const spec: WebSpec = {
    version: CURRENT_VERSION,
    data,
    columns,
    labelColumn,
    extraColumns: args.extraColumns,
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

  return spec;
}
