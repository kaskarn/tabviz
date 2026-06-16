// Test harness for the rows-groups slice. `$state`-only `.svelte.ts`
// module — the plain `.runes.ts` spec imports from here.

import { createRowsGroupsSlice, type RowsGroupsSlice } from "./rows-groups.svelte";
import type { Row, Group, WebSpec, ColumnSpec, DisplayRow } from "$types";
import type { OpRecord } from "$lib/op-recorder";

function buildSpec(rows: Row[], groups: Group[] = [], columns: ColumnSpec[] = []): WebSpec {
  return {
    version: "1.0",
    data: { rows, groups, summaries: [] },
    columns,
    theme: { name: "default" } as unknown as WebSpec["theme"],
    interaction: {
      showFilters: false, showLegend: true, enableSort: true,
      enableCollapse: true, enableHover: true,
      enableResize: true, enableExport: true,
      enableFilters: false, enableReorderRows: true,
      enableReorderColumns: false, enableEdit: false,
    },
    layout: { plotWidth: "auto" },
  };
}

type CellEdits = { cells: Record<string, Record<string, unknown>>; groups: Record<string, string> };

export interface RowsGroupsHarness {
  slice: RowsGroupsSlice;
  opLog: OpRecord[];
  sourceMarks: string[];
  /** Set the visible row set by passing the desired Row[]; the harness
   *  derives indices into the spec's canonical rows. Rows not present
   *  in the spec are pushed onto it so the index lookup stays valid. */
  setVisibleRows: (next: Row[]) => void;
  setDisplayRows: (next: DisplayRow[]) => void;
  setCellEdits: (next: CellEdits) => void;
  setSpec: (next: WebSpec) => void;
}

export function buildRowsGroupsHarness(initial?: {
  rows?: Row[]; groups?: Group[]; columns?: ColumnSpec[];
  visibleRows?: Row[]; displayRows?: DisplayRow[]; cellEdits?: CellEdits;
}): RowsGroupsHarness {
  let spec = $state<WebSpec>(
    buildSpec(initial?.rows ?? [], initial?.groups ?? [], initial?.columns ?? []),
  );

  // Visible set is expressed via indices into spec.data.rows. The harness
  // accepts a `visibleRows` array for ergonomics, derives indices, and
  // appends any missing rows onto the spec so lookups stay valid.
  function indicesFor(rows: Row[]): number[] {
    const out: number[] = [];
    for (const r of rows) {
      let idx = spec.data.rows.findIndex((sr) => sr.id === r.id);
      if (idx === -1) {
        const nextRows = [...spec.data.rows, r];
        spec = { ...spec, data: { ...spec.data, rows: nextRows } };
        idx = nextRows.length - 1;
      }
      out.push(idx);
    }
    return out;
  }
  let visibleIndicesRef = $state<number[]>(
    indicesFor(initial?.visibleRows ?? initial?.rows ?? []),
  );

  // Default displayRows: wrap the rows as flat data entries. Real store
  // computes this via pagination + grouping; for slice-level reorder
  // tests the flat default is fine (moveRowItem reads it to look up
  // current sibling order before applying the move).
  const defaultDisplayRows: DisplayRow[] = (initial?.rows ?? []).map((r) => ({
    type: "data" as const,
    row: r,
    depth: 0,
  }));
  let displayRowsRef = $state<DisplayRow[]>(initial?.displayRows ?? defaultDisplayRows);
  let cellEditsRef = $state<CellEdits>(initial?.cellEdits ?? { cells: {}, groups: {} });
  const allColumns = $derived(spec.columns as ColumnSpec[]);
  const opLog: OpRecord[] = [];
  const sourceMarks: string[] = [];

  const slice = createRowsGroupsSlice({
    getSpec: () => spec,
    getAllColumns: () => allColumns,
    getVisibleIndices: () => visibleIndicesRef,
    getRowAt: (i: number) => spec.data.rows[i],
    getDisplayRows: () => displayRowsRef,
    getCellEdits: () => cellEditsRef,
    appendOp: (r) => { opLog.push(r); },
    markSource: (f) => { sourceMarks.push(f); },
  });

  return {
    slice,
    opLog,
    sourceMarks,
    setVisibleRows(next) { visibleIndicesRef = indicesFor(next); },
    setDisplayRows(next) { displayRowsRef = next; },
    setCellEdits(next) { cellEditsRef = next; },
    setSpec(next) { spec = next; },
  };
}

export function makeRow(
  id: string,
  metadata: Record<string, unknown> = {},
  opts: { groupId?: string; label?: string } = {},
): Row {
  return {
    id,
    label: opts.label ?? id,
    metadata,
    groupId: opts.groupId,
  };
}

export function makeGroup(
  id: string,
  opts: { label?: string; parentId?: string; depth?: number; collapsed?: boolean } = {},
): Group {
  return {
    id,
    label: opts.label ?? id,
    parentId: opts.parentId,
    depth: opts.depth ?? 0,
    collapsed: opts.collapsed ?? false,
  };
}
