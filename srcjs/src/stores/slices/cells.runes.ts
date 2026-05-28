// Unit tests for the cells slice (Phase 0c-C1 PR1).
//
// `.runes.ts` extension routes through vitest (see vitest.config.ts);
// `bun:test` does not execute Svelte 5 runes outside the compiler.
//
// Tests exercise the slice in isolation by passing stub deps. The
// fixtures here are intentionally minimal — full-store reactivity
// tests live in `tabvizStore.reorder.runes.ts`.

import { describe, expect, test } from "vitest";
import { createCellsSlice } from "./cells.svelte";
import type { Row, ColumnSpec, WebSpec } from "$types";
import type { OpRecord } from "$lib/op-recorder";

function buildDeps(opts: {
  columns?: ColumnSpec[];
  spec?: WebSpec | null;
} = {}) {
  const cols = opts.columns ?? [
    { id: "label", header: "Label", field: "name", type: "text", align: "left",
      sortable: false, isGroup: false } as ColumnSpec,
  ];
  const opLog: OpRecord[] = [];
  const sourceMarks: string[] = [];
  return {
    deps: {
      getAllColumns: () => cols,
      getSpec: () => opts.spec ?? null,
      appendOp: (r: OpRecord) => { opLog.push(r); },
      markSource: (f: string) => { sourceMarks.push(f); },
    },
    opLog,
    sourceMarks,
  };
}

function row(id: string, label: string, metadata: Record<string, unknown> = {}): Row {
  return { id, label, metadata };
}

describe("cells slice — cell edits", () => {
  test("setCellValue records and tags", () => {
    const { deps, opLog, sourceMarks } = buildDeps();
    const cells = createCellsSlice(deps);
    cells.setCellValue("r1", "hr", 0.8);
    expect(cells.cellEdits.cells["r1"]?.hr).toBe(0.8);
    expect(opLog).toHaveLength(1);
    expect(opLog[0].kind).toBe("set_cell");
    expect(sourceMarks).toEqual(["cell_edits"]);
  });

  test("clearCellEdit removes only the named field", () => {
    const { deps } = buildDeps();
    const cells = createCellsSlice(deps);
    cells.setCellValue("r1", "a", 1);
    cells.setCellValue("r1", "b", 2);
    cells.clearCellEdit("r1", "a");
    expect(cells.cellEdits.cells["r1"]).toEqual({ b: 2 });
  });

  test("clearCellEdit drops the row entry when last field cleared", () => {
    const { deps } = buildDeps();
    const cells = createCellsSlice(deps);
    cells.setCellValue("r1", "a", 1);
    cells.clearCellEdit("r1", "a");
    expect(cells.cellEdits.cells["r1"]).toBeUndefined();
  });

  test("setRowLabel writes to the primary column's field", () => {
    const { deps, opLog } = buildDeps();
    const cells = createCellsSlice(deps);
    cells.setRowLabel("r1", "renamed");
    // primary column field is "name" per the buildDeps default
    expect(cells.cellEdits.cells["r1"]?.name).toBe("renamed");
    expect(opLog[0].kind).toBe("set_row_label");
  });

  test("setGroupHeader writes to groups map", () => {
    const { deps } = buildDeps();
    const cells = createCellsSlice(deps);
    cells.setGroupHeader("g1", "Group One");
    expect(cells.cellEdits.groups["g1"]).toBe("Group One");
  });

  test("setForestCellValues writes point/lower/upper via forest options", () => {
    const cols: ColumnSpec[] = [
      { id: "f", header: "Forest", field: "hr", type: "forest", align: "center",
        sortable: false, isGroup: false,
        options: { forest: { point: "hr", lower: "lo", upper: "hi",
          scale: "linear", nullValue: 1, axisLabel: "HR", showAxis: true } } } as ColumnSpec,
    ];
    const stubSpec = { version: "1.0" } as unknown as WebSpec;
    const { deps } = buildDeps({ columns: cols, spec: stubSpec });
    const cells = createCellsSlice(deps);
    cells.setForestCellValues("r1", "f", 0.8, 0.6, 1.0);
    const edits = cells.cellEdits.cells["r1"];
    expect(edits?.hr).toBe(0.8);
    expect(edits?.lo).toBe(0.6);
    expect(edits?.hi).toBe(1.0);
  });

  test("setForestCellValues no-ops when spec is null", () => {
    const { deps } = buildDeps({ spec: null });
    const cells = createCellsSlice(deps);
    cells.setForestCellValues("r1", "f", 0.8, 0.6, 1.0);
    expect(cells.cellEdits.cells["r1"]).toBeUndefined();
  });
});

describe("cells slice — read helpers", () => {
  test("getDisplayValue prefers edit over metadata", () => {
    const { deps } = buildDeps();
    const cells = createCellsSlice(deps);
    const r = row("r1", "A", { hr: 0.5 });
    expect(cells.getDisplayValue(r, "hr")).toBe(0.5);
    cells.setCellValue("r1", "hr", 0.8);
    expect(cells.getDisplayValue(r, "hr")).toBe(0.8);
  });

  test("getLabel returns edited primary-field value or original label", () => {
    const { deps } = buildDeps();
    const cells = createCellsSlice(deps);
    const r = row("r1", "Original", { name: "Original" });
    expect(cells.getLabel(r)).toBe("Original");
    cells.setRowLabel("r1", "Renamed");
    expect(cells.getLabel(r)).toBe("Renamed");
  });
});

describe("cells slice — label edits", () => {
  test("setLabel records and source-tags", () => {
    const { deps, opLog, sourceMarks } = buildDeps();
    const cells = createCellsSlice(deps);
    cells.setLabel("title", "New Title");
    expect(cells.labelEdits.title).toBe("New Title");
    expect(opLog[0].kind).toBe("set_title");
    expect(sourceMarks).toEqual(["label_edits"]);
  });

  test("setLabel with empty string collapses to null", () => {
    const { deps } = buildDeps();
    const cells = createCellsSlice(deps);
    cells.setLabel("subtitle", "");
    expect(cells.labelEdits.subtitle).toBeNull();
  });

  test("previewLabel mutates without recording", () => {
    const { deps, opLog } = buildDeps();
    const cells = createCellsSlice(deps);
    cells.previewLabel("title", "Preview");
    expect(cells.labelEdits.title).toBe("Preview");
    expect(opLog).toHaveLength(0);
  });

  test("getPlotLabel prefers edit over spec.labels", () => {
    const stubSpec = { labels: { title: "From spec" } } as unknown as WebSpec;
    const { deps } = buildDeps({ spec: stubSpec });
    const cells = createCellsSlice(deps);
    expect(cells.getPlotLabel("title")).toBe("From spec");
    cells.setLabel("title", "Override");
    expect(cells.getPlotLabel("title")).toBe("Override");
  });

  test("getPlotLabel returns null when cleared", () => {
    const stubSpec = { labels: { title: "Original" } } as unknown as WebSpec;
    const { deps } = buildDeps({ spec: stubSpec });
    const cells = createCellsSlice(deps);
    cells.setLabel("title", null);
    expect(cells.getPlotLabel("title")).toBeNull();
  });
});

describe("cells slice — wrapLineCounts + editingTarget", () => {
  test("setWrapLineCounts writes and getter reads", () => {
    const { deps } = buildDeps();
    const cells = createCellsSlice(deps);
    expect(cells.wrapLineCounts).toEqual({});
    cells.setWrapLineCounts({ r1: 2, r2: 3 });
    expect(cells.wrapLineCounts).toEqual({ r1: 2, r2: 3 });
  });

  test("startEdit / endEdit toggle editingTarget", () => {
    const { deps } = buildDeps();
    const cells = createCellsSlice(deps);
    expect(cells.editingTarget).toBeNull();
    cells.startEdit({ rowId: "r1", field: "name" });
    expect(cells.editingTarget).toEqual({ rowId: "r1", field: "name" });
    cells.endEdit();
    expect(cells.editingTarget).toBeNull();
  });
});

describe("cells slice — reset", () => {
  test("reset clears every owned field", () => {
    const stubSpec = { labels: { title: "x" } } as unknown as WebSpec;
    const { deps } = buildDeps({ spec: stubSpec });
    const cells = createCellsSlice(deps);
    cells.setCellValue("r1", "hr", 0.8);
    cells.setLabel("title", "T");
    cells.setWrapLineCounts({ r1: 2 });
    cells.startEdit({ rowId: "r1", field: "hr" });

    cells.reset();

    expect(cells.cellEdits).toEqual({ cells: {}, groups: {} });
    expect(cells.labelEdits).toEqual({});
    expect(cells.wrapLineCounts).toEqual({});
    expect(cells.editingTarget).toBeNull();
  });
});
