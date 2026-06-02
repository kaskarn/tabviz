// Test harness for the axis-slice cross-slice $derived spike. Lives in a
// `.svelte.ts` module so the Svelte compiler runs and `$state` is legal.
// Imported by `axis.runes.ts` (the vitest spec) which can't itself host
// runes because plain `.ts` test files bypass the compiler.

import { createAxisSlice, type AxisSlice } from "./axis.svelte";
import { THEME_PRESETS } from "$lib/theme/theme-presets";
import type { WebSpec, ColumnSpec } from "$types";

function buildSpec(): WebSpec {
  return {
    version: "1.0",
    data: {
      rows: [
        { id: "r1", label: "R1", metadata: { hr: 0.8, lo: 0.6, hi: 1.0 } },
        { id: "r2", label: "R2", metadata: { hr: 1.2, lo: 0.9, hi: 1.6 } },
      ],
      groups: [],
      summaries: [],
    },
    columns: [],
    theme: THEME_PRESETS.cochrane,
    interaction: {
      showFilters: false, showLegend: true, enableSort: true,
      enableCollapse: true, enableSelect: true, enableHover: true,
      enableResize: true, enableExport: true,
      enableFilters: false, enableReorderRows: true,
      enableReorderColumns: false, enableEdit: false,
    },
    layout: { plotWidth: "auto" },
  };
}

export function forestCol(id = "fc"): ColumnSpec {
  return {
    id, header: "HR", field: "hr", type: "forest", align: "center",
    sortable: false, isGroup: false,
    options: {
      forest: {
        point: "hr", lower: "lo", upper: "hi",
        scale: "linear", nullValue: 1, axisLabel: "HR", showAxis: true,
      },
    },
  } as ColumnSpec;
}

export interface AxisHarness {
  slice: AxisSlice;
  sourceMarks: string[];
  setForestWidth: (w: number) => void;
  setForestColumns: (next: { index: number; column: ColumnSpec }[]) => void;
}

/** Build the axis slice with reactive test deps. forestColumns and
 *  forestWidth live in `$state` so changing them from a test
 *  propagates through the slice's `$derived` blocks via
 *  `deps.getForestColumns()` / `deps.getFlexWidths()` — the
 *  same edge we need across real slice boundaries in production. */
export function buildAxisHarness(initialForestWidth = 400): AxisHarness {
  const spec: WebSpec = buildSpec();
  let forestColumns = $state<{ index: number; column: ColumnSpec }[]>([
    { index: 0, column: forestCol() },
  ]);
  let forestWidth = $state<number>(initialForestWidth);
  const sourceMarks: string[] = [];
  const slice = createAxisSlice({
    getSpec: () => spec,
    getForestColumns: () => forestColumns,
    // Per-column widths keyed by id; the harness uses one width for all.
    getFlexWidths: () => Object.fromEntries(forestColumns.map((fc) => [fc.column.id, forestWidth])),
    markSource: (f) => { sourceMarks.push(f); },
  });
  return {
    slice,
    sourceMarks,
    setForestWidth(w) { forestWidth = w; },
    setForestColumns(next) { forestColumns = next; },
  };
}
