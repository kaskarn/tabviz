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
      enableCollapse: true, enableSelect: true, enableHover: true,
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
  let visibleRowsRef = $state<Row[]>(initial?.visibleRows ?? initial?.rows ?? []);
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
    getVisibleRows: () => visibleRowsRef,
    getDisplayRows: () => displayRowsRef,
    getCellEdits: () => cellEditsRef,
    appendOp: (r) => { opLog.push(r); },
    markSource: (f) => { sourceMarks.push(f); },
  });

  return {
    slice,
    opLog,
    sourceMarks,
    setVisibleRows(next) { visibleRowsRef = next; },
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
