// Test harness for sort-filter slice. `$state` only legal in `.svelte.ts`
// modules — the plain `.runes.ts` spec imports from here.

import { createSortFilterSlice, type SortFilterSlice, type StyleEditsMap } from "./sort-filter.svelte";
import type { ColumnSpec, WebSpec, Row } from "$types";
import type { OpRecord } from "$lib/op-recorder";

function buildSpec(rows: Row[], columns: ColumnSpec[] = []): WebSpec {
  return {
    version: "1.0",
    data: { rows, groups: [], summaries: [] },
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

export interface SortFilterHarness {
  slice: SortFilterSlice;
  opLog: OpRecord[];
  sourceMarks: string[];
  setStyleEdits: (next: StyleEditsMap) => void;
  setRows: (rows: Row[]) => void;
}

export function buildSortFilterHarness(
  initial?: { rows?: Row[]; columns?: ColumnSpec[]; styleEdits?: StyleEditsMap },
): SortFilterHarness {
  let spec = $state<WebSpec>(
    buildSpec(initial?.rows ?? [], initial?.columns ?? []),
  );
  let styleEdits = $state<StyleEditsMap>(
    initial?.styleEdits ?? { rows: {}, cells: {} },
  );
  const allColumns = $derived(spec.columns as ColumnSpec[]);
  const opLog: OpRecord[] = [];
  const sourceMarks: string[] = [];

  const slice = createSortFilterSlice({
    getSpec: () => spec,
    getAllColumns: () => allColumns,
    getStyleEdits: () => styleEdits,
    appendOp: (r) => { opLog.push(r); },
    markSource: (f) => { sourceMarks.push(f); },
  });

  return {
    slice,
    opLog,
    sourceMarks,
    setStyleEdits(next) { styleEdits = next; },
    setRows(rows) { spec = { ...spec, data: { ...spec.data, rows } }; },
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

export function textCol(field: string, id = field): ColumnSpec {
  return {
    id, header: field, field, type: "text", align: "left",
    sortable: true, isGroup: false,
  } as ColumnSpec;
}
