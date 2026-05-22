// Sort + filter slice — column-level filters, sort config, the
// `visibleRows` $derived that flows filters + sort + paint-tool merges
// into a row[] for downstream `displayRows` / `exportSpec`.
//
// Owns:
//   - sortConfig            { column, direction } | null
//   - filters               Record<field, ColumnFilter>
//   - filterPopoverTarget   anchor for the per-header filter popover
//   - visibleRows           $derived Row[] (post merge + filter + sort)
//
// Dependencies (forward closures):
//   - getSpec               for spec.data.rows + spec.columns
//   - getAllColumns         for detectColumnKind lookups + sort key resolution
//   - getStyleEdits         for paint-tool overrides merged INTO each row
//                           BEFORE filter/sort (so painted-row state survives
//                           the filter pipeline). semantics slice owns this
//                           today, pre-extraction; ships from the main store
//                           closure until then.
//   - appendOp + markSource
//
// Cross-slice $derived check (PR3 axis spike validated the pattern):
// `visibleRows` reads `styleEdits` via `deps.getStyleEdits()`. When the
// paint tool flips a row's flag in the main store's `styleEdits` $state,
// the call inside this slice's $derived re-tracks correctly.

import type {
  Row, ColumnSpec, ColumnFilter, FiltersState, ColumnKind, SortConfig,
} from "$types";
import { ops, type OpRecord } from "$lib/op-recorder";
import {
  applyFilters, readField, findColumnByKey, applySortWithinGroups,
} from "$lib/filter-sort-utils";
import type { WebSpec } from "$types";

// Mirror the cells-slice / semantics-slice SemanticFlags shape inline so
// this slice doesn't import from semantics (which doesn't exist yet).
// When semantics ships, the dep-injected shape will harmonize.
type SemanticFlags = Partial<Record<
  "emphasis" | "muted" | "accent" | "bold" | "fill",
  boolean
>>;
export type StyleEditsMap = {
  rows: Record<string, SemanticFlags>;
  cells: Record<string, Record<string, SemanticFlags>>;
};

export interface SortFilterSliceDeps {
  getSpec: () => WebSpec | null;
  getAllColumns: () => readonly ColumnSpec[];
  getStyleEdits: () => StyleEditsMap;
  appendOp: (record: OpRecord) => void;
  markSource: (field: string) => void;
}

export interface SortFilterSlice {
  readonly sortConfig: SortConfig | null;
  readonly filters: FiltersState;
  readonly filterPopoverTarget:
    | { field: string; header: string; anchorX: number; anchorY: number }
    | null;
  readonly visibleRows: Row[];

  sortBy: (column: string, direction: "asc" | "desc" | "none") => void;
  toggleSort: (column: string) => void;
  setColumnFilter: (field: string, filter: ColumnFilter | null) => void;
  clearAllFilters: () => void;
  getColumnFilter: (field: string) => ColumnFilter | null;
  detectColumnKind: (field: string) => ColumnKind;
  getColumnValues: (field: string) => unknown[];
  getColumnNumericRange: (field: string) => [number, number] | null;
  openFilterPopover: (
    field: string,
    header: string,
    triggerEl: HTMLElement | null,
  ) => void;
  closeFilterPopover: () => void;

  /** Clear all sort + filter state (and dismiss any open popover). Called
   *  from `setSpec` / `resetState`. */
  reset: () => void;
}

export function createSortFilterSlice(deps: SortFilterSliceDeps): SortFilterSlice {
  // REPLACE-only state (per audit): use `$state.raw` to skip proxy wrap.
  let sortConfig = $state.raw<SortConfig | null>(null);
  let filters = $state.raw<FiltersState>({});
  let filterPopoverTarget = $state<
    { field: string; header: string; anchorX: number; anchorY: number } | null
  >(null);

  // visibleRows applies paint-tool semantic overrides BEFORE filter/sort so
  // merged style/cellStyles follow the row through the pipeline. Cross-slice
  // reads: spec.data.rows (data), styleEdits (semantics — via closure),
  // spec.columns (data/columns) for sort key resolution.
  const visibleRows = $derived.by(() => {
    const spec = deps.getSpec();
    if (!spec) return [];

    const styleEdits = deps.getStyleEdits();
    let rows: Row[] = spec.data.rows.map((r) => {
      const rowOv = styleEdits.rows[r.id];
      const cellOv = styleEdits.cells[r.id];
      if (!rowOv && !cellOv) return r;
      const mergedStyle = rowOv ? { ...(r.style ?? {}), ...rowOv } : r.style;
      let mergedCells = r.cellStyles;
      if (cellOv) {
        mergedCells = { ...(r.cellStyles ?? {}) };
        for (const [field, flags] of Object.entries(cellOv)) {
          mergedCells[field] = { ...(mergedCells[field] ?? {}), ...flags };
        }
      }
      return { ...r, style: mergedStyle, cellStyles: mergedCells };
    });

    // Multi-column filter state (per-header popovers).
    if (Object.keys(filters).length > 0) {
      rows = applyFilters(rows, filters);
    }

    // Sort within group boundaries so grouped tables retain structure.
    if (sortConfig) {
      const sortCol = spec.columns
        ? findColumnByKey(spec.columns, sortConfig.column)
        : undefined;
      rows = applySortWithinGroups(rows, sortConfig, sortCol);
    }

    return rows;
  });

  function sortBy(column: string, direction: "asc" | "desc" | "none"): void {
    sortConfig = direction === "none" ? null : { column, direction };
    if (direction !== "none") {
      deps.appendOp(ops.sortRows(column, direction));
    }
    deps.markSource("sort");
  }

  function toggleSort(column: string): void {
    if (!sortConfig || sortConfig.column !== column) {
      sortConfig = { column, direction: "asc" };
      deps.appendOp(ops.sortRows(column, "asc"));
    } else if (sortConfig.direction === "asc") {
      sortConfig = { column, direction: "desc" };
      deps.appendOp(ops.sortRows(column, "desc"));
    } else {
      sortConfig = null;
      // Cycling back to "no sort" emits nothing — append-only model already
      // contains the prior sort op; there's no `sort_rows(direction="none")`
      // form in the R API yet.
    }
    deps.markSource("sort");
  }

  function setColumnFilter(field: string, filter: ColumnFilter | null): void {
    if (filter === null) {
      const { [field]: _removed, ...rest } = filters;
      filters = rest;
    } else {
      filters = { ...filters, [field]: filter };
      deps.appendOp(ops.setFilter(field, filter.operator, filter.value));
    }
    deps.markSource("filters");
  }

  function clearAllFilters(): void {
    const hadFilters = Object.keys(filters).length > 0;
    filters = {};
    if (hadFilters) deps.appendOp(ops.clearFilters());
    deps.markSource("filters");
  }

  function getColumnFilter(field: string): ColumnFilter | null {
    return filters[field] ?? null;
  }

  function detectColumnKind(field: string): ColumnKind {
    const spec = deps.getSpec();
    if (!spec) return "text";
    const col = deps.getAllColumns().find((c) => c.field === field);
    const numericTypes: ColumnSpec["type"][] = [
      "numeric", "bar", "pvalue", "heatmap", "progress", "range",
    ];
    if (col && numericTypes.includes(col.type)) return "numeric";

    const sample: unknown[] = [];
    for (const row of spec.data.rows) {
      const v = readField(row, field);
      if (v !== undefined && v !== null) sample.push(v);
      if (sample.length >= 200) break;
    }
    if (sample.length === 0) return "text";
    const allNum = sample.every((v) => typeof v === "number");
    if (allNum) return "numeric";

    const distinct = new Set(sample.map((v) => String(v)));
    const rowsN = spec.data.rows.length || sample.length;
    const maxCat = Math.max(20, Math.floor(rowsN / 5));
    if (distinct.size <= maxCat) return "categorical";
    return "text";
  }

  function getColumnValues(field: string): unknown[] {
    const spec = deps.getSpec();
    if (!spec) return [];
    const seen = new Set<string>();
    const out: unknown[] = [];
    for (const row of spec.data.rows) {
      const v = readField(row, field);
      if (v === undefined || v === null || v === "") continue;
      const key = String(v);
      if (!seen.has(key)) { seen.add(key); out.push(v); }
    }
    out.sort((a, b) => {
      if (typeof a === "number" && typeof b === "number") return a - b;
      return String(a).localeCompare(String(b));
    });
    return out;
  }

  function getColumnNumericRange(field: string): [number, number] | null {
    const spec = deps.getSpec();
    if (!spec) return null;
    let lo = Infinity;
    let hi = -Infinity;
    let any = false;
    for (const row of spec.data.rows) {
      const v = readField(row, field);
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        any = true;
      }
    }
    return any ? [lo, hi] : null;
  }

  function openFilterPopover(
    field: string,
    header: string,
    triggerEl: HTMLElement | null,
  ): void {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    filterPopoverTarget = {
      field,
      header,
      anchorX: r.left,
      anchorY: r.bottom,
    };
  }

  function closeFilterPopover(): void {
    filterPopoverTarget = null;
  }

  function reset(): void {
    sortConfig = null;
    filters = {};
    filterPopoverTarget = null;
  }

  return {
    get sortConfig() { return sortConfig; },
    get filters() { return filters; },
    get filterPopoverTarget() { return filterPopoverTarget; },
    get visibleRows() { return visibleRows; },

    sortBy, toggleSort, setColumnFilter, clearAllFilters, getColumnFilter,
    detectColumnKind, getColumnValues, getColumnNumericRange,
    openFilterPopover, closeFilterPopover,
    reset,
  };
}
