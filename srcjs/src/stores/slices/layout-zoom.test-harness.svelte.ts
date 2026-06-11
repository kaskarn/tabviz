// Test harness for the layout-zoom slice (Phase 0c-C1 PR11).
//
// `$state` only legal in `.svelte.ts` — harness lives here and the plain
// `.runes.ts` spec imports it. The `layout` derived itself is exercised
// by the visual battery (jsdom + canvas don't agree well enough to give
// reliable layout numbers in unit tests); the harness exposes everything
// the action surface + the fit/scale derived chain needs.

import { createLayoutZoomSlice, type LayoutZoomSlice } from "./layout-zoom.svelte";
import type { ColumnSpec, DisplayRow, WebSpec } from "$types";

function buildSpec(opts: { plotWidthTheme?: number } = {}): WebSpec {
  return {
    version: "1.0",
    data: { rows: [], groups: [], summaries: [] },
    columns: [],
    theme: {
      spacing: {
        rowHeight: 28,
        headerHeight: 36,
        padding: 8,
        rowGroupPadding: 0,
        cellPaddingX: 10,
        axisGap: 4,
      },
      text: {
        body: { family: "system-ui", size: "14px" },
        label: { family: "system-ui", size: "12px" },
      },
      plot: { tickMarkLength: 4 },
      layout: opts.plotWidthTheme !== undefined
        ? { plotWidth: opts.plotWidthTheme }
        : {},
    } as unknown as WebSpec["theme"],
    interaction: {
      showFilters: false, showLegend: true, enableSort: true,
      enableCollapse: true, enableSelect: true, enableHover: true,
      enableResize: true, enableExport: true,
      enableFilters: false, enableReorderRows: true,
      enableReorderColumns: false, enableEdit: false,
    },
  } as unknown as WebSpec;
}

export interface LayoutZoomHarness {
  slice: LayoutZoomSlice;
  sourceMarks: string[];
  setSpec: (s: WebSpec | null) => void;
  setColumnWidths: (w: Record<string, number>) => void;
  setUserResizedIds: (s: Set<string>) => void;
  setAllColumns: (cs: ColumnSpec[]) => void;
  setTargetAspect: (a: number | null) => void;
  setDisplayRows: (rows: DisplayRow[]) => void;
}

export function buildLayoutZoomHarness(initial?: {
  spec?: WebSpec | null;
  allColumns?: ColumnSpec[];
  columnWidths?: Record<string, number>;
  userResizedIds?: Set<string>;
  displayRows?: DisplayRow[];
  targetAspect?: number | null;
  wrapLineCounts?: Record<string, number>;
}): LayoutZoomHarness {
  // `in`-check, not `??`: an EXPLICIT `spec: null` must reach the slice
  // (the null-spec fallback test exercises that branch; `??` swallowed the
  // null and computed a real layout instead — the long-standing "jsdom
  // canvas" failure was actually this harness bug).
  let spec = $state<WebSpec | null>(
    initial && "spec" in initial ? initial.spec ?? null : buildSpec(),
  );
  let allColumns = $state<ColumnSpec[]>(initial?.allColumns ?? []);
  let columnWidths = $state<Record<string, number>>(initial?.columnWidths ?? {});
  let userResizedIds = $state<Set<string>>(initial?.userResizedIds ?? new Set());
  let displayRows = $state<DisplayRow[]>(initial?.displayRows ?? []);
  let targetAspect = $state<number | null>(initial?.targetAspect ?? null);
  const wrapLineCounts = initial?.wrapLineCounts ?? {};
  const sourceMarks: string[] = [];

  const slice = createLayoutZoomSlice({
    getSpec:           () => spec,
    getAllColumns:     () => allColumns,
    getForestColumns:  () => allColumns
      .map((c, i) => ({ index: i, column: c }))
      .filter((x) => x.column.type === "forest"),
    getColumnWidths:   () => columnWidths,
    getUserResizedIds: () => userResizedIds,
    getDisplayRows:    () => displayRows,
    getTargetAspect:   () => targetAspect,
    getWrapLineCounts: () => wrapLineCounts,
    markSource:        (f) => { sourceMarks.push(f); },
  });

  return {
    slice,
    sourceMarks,
    setSpec(s)            { spec = s; },
    setColumnWidths(w)    { columnWidths = w; },
    setUserResizedIds(s)  { userResizedIds = s; },
    setAllColumns(cs)     { allColumns = cs; },
    setTargetAspect(a)    { targetAspect = a; },
    setDisplayRows(rows)  { displayRows = rows; },
  };
}

export { buildSpec };
