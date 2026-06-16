// Test harness for the columns slice (Phase 0c-C1 PR9).
//
// `$state` is only legal inside `.svelte.ts` modules, so the harness lives
// here and the plain `.runes.ts` spec imports it.

import { createColumnsSlice, type ColumnsSlice } from "./columns.svelte";
import type { ColumnDef, ColumnSpec, Row, WebSpec } from "$types";
import type { OpRecord } from "$lib/op-recorder";

export function buildHarnessSpec(
  columns: ColumnDef[] = [],
  rows: Row[] = [],
): WebSpec {
  return {
    version: "1.0",
    data: { rows, groups: [], summaries: [] },
    columns,
    theme: { name: "default" } as unknown as WebSpec["theme"],
    interaction: {
      showFilters: false, showLegend: true, enableSort: true,
      enableCollapse: true, enableHover: true,
      enableResize: true, enableExport: true,
      enableFilters: false, enableReorderRows: true,
      enableReorderColumns: true, enableEdit: false,
    },
    layout: { plotWidth: "auto" },
  } as unknown as WebSpec;
}

export interface ColumnsHarness {
  slice: ColumnsSlice;
  opLog: OpRecord[];
  sourceMarks: string[];
  wrapLineCounts: Record<string, number>;
  axisZooms: Record<string, { domain: [number, number] }>;
  setSpec: (spec: WebSpec | null) => void;
  setWrapLineCounts: (counts: Record<string, number>) => void;
}

export function buildColumnsHarness(
  initial?: { columns?: ColumnDef[]; rows?: Row[]; axisZooms?: Record<string, { domain: [number, number] }> },
): ColumnsHarness {
  let spec = $state<WebSpec | null>(
    buildHarnessSpec(initial?.columns ?? [], initial?.rows ?? []),
  );
  let wrapLineCounts = $state<Record<string, number>>({});
  const axisZooms = initial?.axisZooms ?? {};
  const opLog: OpRecord[] = [];
  const sourceMarks: string[] = [];

  const slice = createColumnsSlice({
    getSpec: () => spec,
    getAxisZooms: () => axisZooms,
    getWrapLineCounts: () => wrapLineCounts,
    setWrapLineCounts: (counts) => { wrapLineCounts = counts; },
    appendOp: (r) => { opLog.push(r); },
    markSource: (f) => { sourceMarks.push(f); },
  });

  return {
    slice,
    opLog,
    sourceMarks,
    get wrapLineCounts() { return wrapLineCounts; },
    axisZooms,
    setSpec(next) { spec = next; },
    setWrapLineCounts(counts) { wrapLineCounts = counts; },
  };
}

export function textCol(field: string, id = field, opts: Partial<ColumnSpec> = {}): ColumnSpec {
  return {
    id, header: field, field, type: "text", align: "left",
    sortable: true, isGroup: false, ...opts,
  } as ColumnSpec;
}

export function colGroup(id: string, header: string, columns: ColumnSpec[]): ColumnDef {
  return { id, header, isGroup: true, columns } as unknown as ColumnDef;
}
