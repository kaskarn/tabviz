import { describe, test, expect, mock } from "bun:test";
import { proxyMethods } from "./index.svelte";

// A minimal fake store that records which methods were invoked with what args.
// The proxyMethods table only needs the methods it routes to, plus a small
// number of getters used by updateColumn/moveColumn.
function makeFakeStore(overrides: Record<string, unknown> = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const record = (method: string) =>
    mock((...args: unknown[]) => { calls.push({ method, args }); });

  const store: Record<string, unknown> = {
    calls,
    setSpec: record("setSpec"),
    toggleGroup: record("toggleGroup"),
    setFilter: record("setFilter"),
    setColumnFilter: record("setColumnFilter"),
    clearAllFilters: record("clearAllFilters"),
    sortBy: record("sortBy"),
    insertColumn: record("insertColumn"),
    hideColumn: record("hideColumn"),
    moveColumnItem: record("moveColumnItem"),
    setColumnWidth: record("setColumnWidth"),
    updateColumn: record("updateColumn"),
    setSelectedRows: record("setSelectedRows"),
    moveRowItem: record("moveRowItem"),
    setCellValue: record("setCellValue"),
    setRowLabel: record("setRowLabel"),
    clearAllEdits: record("clearAllEdits"),
    setTheme: record("setTheme"),
    setZoom: record("setZoom"),
    setAutoFit: record("setAutoFit"),
    setMaxWidth: record("setMaxWidth"),
    setMaxHeight: record("setMaxHeight"),
    setShowZoomControls: record("setShowZoomControls"),
    allColumns: [{ id: "hr", field: "hr", type: "numeric", options: { numeric: { decimals: 2 } } }],
    findColumnScope: () => "__root__",
    siblingsForColumnScope: () => [{ id: "hr" }, { id: "lower" }],
    ...overrides,
  };
  return store;
}

function dispatch(method: string, args: Record<string, unknown>, store: ReturnType<typeof makeFakeStore>) {
  const handler = proxyMethods[method];
  if (!handler) throw new Error(`no handler for ${method}`);
  // The handler type expects a ForestStore; our fake satisfies the subset it calls.
  handler(store as unknown as Parameters<typeof handler>[0], args);
}

describe("proxyMethods dispatch", () => {
  test("updateData -> setSpec", () => {
    const s = makeFakeStore();
    dispatch("updateData", { spec: { data: { rows: [] } } }, s);
    expect((s.calls as { method: string }[]).map((c) => c.method)).toContain("setSpec");
  });

  test("toggleGroup -> toggleGroup", () => {
    const s = makeFakeStore();
    dispatch("toggleGroup", { groupId: "g1", collapsed: true }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "toggleGroup",
      args: ["g1", true],
    });
  });

  test("applyFilter legacy routes to setFilter", () => {
    const s = makeFakeStore();
    dispatch("applyFilter", { filter: { field: "hr", operator: "gt", value: 1 } }, s);
    expect((s.calls as { method: string }[])[0].method).toBe("setFilter");
  });

  test("applyFilter multi-column routes to setColumnFilter", () => {
    const s = makeFakeStore();
    dispatch("applyFilter", { filter: { field: "hr", kind: "numeric", operator: "gt", value: 1 } }, s);
    expect((s.calls as { method: string }[])[0].method).toBe("setColumnFilter");
  });

  test("clearFilter -> clearAllFilters", () => {
    const s = makeFakeStore();
    dispatch("clearFilter", {}, s);
    expect((s.calls as { method: string }[])[0].method).toBe("clearAllFilters");
  });

  test("sortBy -> sortBy", () => {
    const s = makeFakeStore();
    dispatch("sortBy", { column: "hr", direction: "desc" }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "sortBy",
      args: ["hr", "desc"],
    });
  });

  test("addColumn -> insertColumn", () => {
    const s = makeFakeStore();
    dispatch("addColumn", { column: { id: "x", field: "x", type: "text" }, afterId: "hr" }, s);
    const entry = (s.calls as { method: string; args: unknown[] }[])[0];
    expect(entry.method).toBe("insertColumn");
    expect((entry.args[0] as { field: string }).field).toBe("x");
    expect(entry.args[1]).toBe("hr");
  });

  test("hideColumn -> hideColumn", () => {
    const s = makeFakeStore();
    dispatch("hideColumn", { id: "notes" }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "hideColumn",
      args: ["notes"],
    });
  });

  test("moveColumn numeric newIndex -> moveColumnItem", () => {
    const s = makeFakeStore();
    dispatch("moveColumn", { itemId: "hr", newIndex: 2 }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "moveColumnItem",
      args: ["hr", 2],
    });
  });

  test("moveColumn with before=field resolves newIndex via siblings", () => {
    const s = makeFakeStore();
    dispatch("moveColumn", { itemId: "hr", before: "lower" }, s);
    const entry = (s.calls as { method: string; args: unknown[] }[])[0];
    expect(entry.method).toBe("moveColumnItem");
    expect(entry.args).toEqual(["hr", 1]); // "lower" is at index 1 in siblings
  });

  test("setColumnWidth -> setColumnWidth", () => {
    const s = makeFakeStore();
    dispatch("setColumnWidth", { columnId: "hr", width: 120 }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "setColumnWidth",
      args: ["hr", 120],
    });
  });

  test("updateColumn merges changes into current column", () => {
    const s = makeFakeStore();
    dispatch("updateColumn", { id: "hr", changes: { header: "Hazard", align: "right" } }, s);
    const entry = (s.calls as { method: string; args: unknown[] }[])[0];
    expect(entry.method).toBe("updateColumn");
    const [id, next] = entry.args as [string, Record<string, unknown>];
    expect(id).toBe("hr");
    expect(next.header).toBe("Hazard");
    expect(next.align).toBe("right");
  });

  test("updateColumn unknown key merges into options", () => {
    const s = makeFakeStore();
    dispatch("updateColumn", { id: "hr", changes: { minValue: 0 } }, s);
    const entry = (s.calls as { method: string; args: unknown[] }[])[0];
    const [, next] = entry.args as [string, Record<string, unknown>];
    expect((next.options as Record<string, unknown>).minValue).toBe(0);
  });

  test("selectRows -> setSelectedRows", () => {
    const s = makeFakeStore();
    dispatch("selectRows", { rowIds: ["a", "b"] }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "setSelectedRows",
      args: [["a", "b"]],
    });
  });

  test("moveRow numeric newIndex -> moveRowItem", () => {
    const s = makeFakeStore();
    dispatch("moveRow", { rowId: "r1", newIndex: 0 }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "moveRowItem",
      args: ["r1", 0],
    });
  });

  test("setCell -> setCellValue", () => {
    const s = makeFakeStore();
    dispatch("setCell", { rowId: "r1", field: "hr", value: 1.23 }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "setCellValue",
      args: ["r1", "hr", 1.23],
    });
  });

  test("setRowLabel -> setRowLabel", () => {
    const s = makeFakeStore();
    dispatch("setRowLabel", { rowId: "r1", label: "Renamed" }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "setRowLabel",
      args: ["r1", "Renamed"],
    });
  });

  test("clearEdits -> clearAllEdits", () => {
    const s = makeFakeStore();
    dispatch("clearEdits", {}, s);
    expect((s.calls as { method: string }[])[0].method).toBe("clearAllEdits");
  });

  test("setTheme with name -> setTheme", () => {
    const s = makeFakeStore();
    dispatch("setTheme", { name: "jama" }, s);
    expect((s.calls as { method: string; args: unknown[] }[])[0]).toEqual({
      method: "setTheme",
      args: ["jama"],
    });
  });

  test("setZoom routes to zoom knobs", () => {
    const s = makeFakeStore();
    dispatch("setZoom", { zoom: 0.8, autoFit: false, maxWidth: 500 }, s);
    const methods = (s.calls as { method: string }[]).map((c) => c.method);
    expect(methods).toContain("setZoom");
    expect(methods).toContain("setAutoFit");
    expect(methods).toContain("setMaxWidth");
  });
});
