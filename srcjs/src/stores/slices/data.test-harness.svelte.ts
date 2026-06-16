// Test harness for the data slice (Phase 0c-C1 PR10).
//
// `$state` is only legal inside `.svelte.ts` modules, so the harness lives
// here and the plain `.runes.ts` spec imports it.

import { createDataSlice, type DataSlice } from "./data.svelte";
import type { BandingSpec, DisplayRow, WebSpec } from "$types";
import type { OpRecord } from "$lib/op-recorder";

interface PaginatePage { startIdx: number; endIdx: number }

function buildSpec(opts: {
  rows?: { id: string; metadata?: Record<string, unknown> }[];
  pages?: PaginatePage[];
  themeBanding?: BandingSpec | null;
  targetAspect?: number | null;
  targetAspectAnchor?: "width" | "height" | "auto";
  watermark?: string | null;
} = {}): WebSpec {
  const rows = (opts.rows ?? []).map((r) => ({
    id: r.id,
    label: r.id,
    metadata: r.metadata ?? {},
  })) as unknown as WebSpec["data"]["rows"];
  return {
    version: "1.0",
    data: { rows, groups: [], summaries: [] },
    columns: [],
    theme: {
      layout: opts.themeBanding !== undefined
        ? { banding: opts.themeBanding ?? undefined }
        : {},
    } as unknown as WebSpec["theme"],
    interaction: {
      showFilters: false, showLegend: true, enableSort: true,
      enableCollapse: true, enableHover: true,
      enableResize: true, enableExport: true,
      enableFilters: false, enableReorderRows: true,
      enableReorderColumns: false, enableEdit: false,
    },
    paginate: opts.pages
      ? { nPages: opts.pages.length, pages: opts.pages }
      : undefined,
    targetAspect: opts.targetAspect ?? undefined,
    targetAspectAnchor: opts.targetAspectAnchor,
    watermark: opts.watermark ?? undefined,
  } as unknown as WebSpec;
}

export interface DataHarness {
  slice: DataSlice;
  opLog: OpRecord[];
  sourceMarks: string[];
  readonly spec: WebSpec | null;
  readonly fullDisplayRows: DisplayRow[];
  setSpec: (spec: WebSpec | null) => void;
  setFullDisplayRows: (rows: DisplayRow[]) => void;
}

export function buildDataHarness(initial?: {
  spec?: WebSpec;
  fullDisplayRows?: DisplayRow[];
}): DataHarness {
  let spec = $state<WebSpec | null>(initial?.spec ?? buildSpec());
  let fullDisplayRows = $state<DisplayRow[]>(initial?.fullDisplayRows ?? []);
  const opLog: OpRecord[] = [];
  const sourceMarks: string[] = [];

  const slice = createDataSlice({
    getSpec: () => spec,
    setSpec: (next) => { spec = next; },
    getFullDisplayRows: () => fullDisplayRows,
    appendOp: (r) => { opLog.push(r); },
    markSource: (f) => { sourceMarks.push(f); },
  });

  return {
    slice,
    opLog,
    sourceMarks,
    get spec() { return spec; },
    get fullDisplayRows() { return fullDisplayRows; },
    setSpec(next)            { spec = next; },
    setFullDisplayRows(rows) { fullDisplayRows = rows; },
  };
}

export { buildSpec };

export function dataRow(id: string): DisplayRow {
  return {
    type: "data",
    row: { id, label: id, metadata: {} },
  } as unknown as DisplayRow;
}

export function groupHeader(id: string, depth: number, label = id): DisplayRow {
  return {
    type: "group_header",
    depth,
    group: { id, label, depth },
  } as unknown as DisplayRow;
}
