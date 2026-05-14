// Unit tests for the sort-filter slice (Phase 0c-C1 PR4).
//
// The slice's `visibleRows` $derived reads styleEdits via deps.getStyleEdits()
// — the same cross-slice $derived pattern axis validated in PR3. Tests here
// exercise that edge plus the slice's own methods + helper-backed derivations.

import { describe, expect, test } from "vitest";
import {
  buildSortFilterHarness, makeRow, textCol,
} from "./sort-filter.test-harness.svelte";

describe("sort-filter slice — sort actions", () => {
  test("sortBy('asc') sets config, records op, source-tags", () => {
    const h = buildSortFilterHarness();
    h.slice.sortBy("hr", "asc");
    expect(h.slice.sortConfig).toEqual({ column: "hr", direction: "asc" });
    expect(h.opLog[0].kind).toBe("sort_rows");
    expect(h.sourceMarks).toEqual(["sort"]);
  });

  test("sortBy('none') clears config without recording", () => {
    const h = buildSortFilterHarness();
    h.slice.sortBy("hr", "asc");
    h.opLog.length = 0;
    h.slice.sortBy("hr", "none");
    expect(h.slice.sortConfig).toBeNull();
    expect(h.opLog).toHaveLength(0);
  });

  test("toggleSort cycles none -> asc -> desc -> none", () => {
    const h = buildSortFilterHarness();
    h.slice.toggleSort("hr");
    expect(h.slice.sortConfig?.direction).toBe("asc");
    h.slice.toggleSort("hr");
    expect(h.slice.sortConfig?.direction).toBe("desc");
    h.slice.toggleSort("hr");
    expect(h.slice.sortConfig).toBeNull();
  });

  test("toggleSort on a different column starts fresh at asc", () => {
    const h = buildSortFilterHarness();
    h.slice.toggleSort("a");
    h.slice.toggleSort("a"); // desc
    h.slice.toggleSort("b"); // switches to b at asc
    expect(h.slice.sortConfig).toEqual({ column: "b", direction: "asc" });
  });
});

describe("sort-filter slice — filter actions", () => {
  test("setColumnFilter sets filter, records, source-tags", () => {
    const h = buildSortFilterHarness();
    h.slice.setColumnFilter("hr", { field: "hr", kind: "numeric", operator: "gt", value: 1 });
    expect(h.slice.filters["hr"]).toEqual({ field: "hr", kind: "numeric", operator: "gt", value: 1 });
    expect(h.opLog[0].kind).toBe("filter_rows");
    expect(h.sourceMarks).toContain("filters");
  });

  test("setColumnFilter(null) removes the field's filter", () => {
    const h = buildSortFilterHarness();
    h.slice.setColumnFilter("a", { field: "a", kind: "numeric", operator: "eq", value: 1 });
    h.slice.setColumnFilter("b", { field: "b", kind: "numeric", operator: "eq", value: 2 });
    h.slice.setColumnFilter("a", null);
    expect(h.slice.filters["a"]).toBeUndefined();
    expect(h.slice.filters["b"]).toBeDefined();
  });

  test("clearAllFilters wipes all + records clear_filters when had filters", () => {
    const h = buildSortFilterHarness();
    h.slice.setColumnFilter("hr", { field: "hr", kind: "numeric", operator: "eq", value: 1 });
    h.opLog.length = 0;
    h.slice.clearAllFilters();
    expect(h.slice.filters).toEqual({});
    expect(h.opLog[0].kind).toBe("clear_filters");
  });

  test("clearAllFilters records nothing when no filters present", () => {
    const h = buildSortFilterHarness();
    h.slice.clearAllFilters();
    expect(h.opLog).toHaveLength(0);
  });

  test("getColumnFilter returns set filter or null", () => {
    const h = buildSortFilterHarness();
    expect(h.slice.getColumnFilter("hr")).toBeNull();
    h.slice.setColumnFilter("hr", { field: "hr", kind: "numeric", operator: "eq", value: 1 });
    expect(h.slice.getColumnFilter("hr")).toEqual({ field: "hr", kind: "numeric", operator: "eq", value: 1 });
  });
});

describe("sort-filter slice — column kind detection", () => {
  test("detectColumnKind = numeric when column type is numeric", () => {
    const h = buildSortFilterHarness({
      rows: [makeRow("a", { hr: 0.8 })],
      columns: [{ id: "c1", header: "HR", field: "hr", type: "numeric", align: "right", sortable: true, isGroup: false } as never],
    });
    expect(h.slice.detectColumnKind("hr")).toBe("numeric");
  });

  test("detectColumnKind samples values when no column hint", () => {
    const h = buildSortFilterHarness({
      rows: [
        makeRow("a", { x: 1 }),
        makeRow("b", { x: 2 }),
        makeRow("c", { x: 3 }),
      ],
    });
    expect(h.slice.detectColumnKind("x")).toBe("numeric");
  });

  test("detectColumnKind = categorical for low-cardinality strings", () => {
    const h = buildSortFilterHarness({
      rows: Array.from({ length: 30 }, (_, i) =>
        makeRow(`r${i}`, { cat: i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C" }),
      ),
    });
    expect(h.slice.detectColumnKind("cat")).toBe("categorical");
  });

  test("getColumnNumericRange returns [min, max] of numeric values", () => {
    const h = buildSortFilterHarness({
      rows: [
        makeRow("a", { x: 1.5 }),
        makeRow("b", { x: 0.5 }),
        makeRow("c", { x: 2.5 }),
        makeRow("d", { x: "skip" }),
      ],
    });
    expect(h.slice.getColumnNumericRange("x")).toEqual([0.5, 2.5]);
  });

  test("getColumnValues returns sorted unique non-null values", () => {
    const h = buildSortFilterHarness({
      rows: [
        makeRow("a", { tag: "z" }),
        makeRow("b", { tag: "a" }),
        makeRow("c", { tag: "z" }),
        makeRow("d", { tag: null }),
      ],
    });
    expect(h.slice.getColumnValues("tag")).toEqual(["a", "z"]);
  });
});

describe("sort-filter slice — visibleRows $derived (cross-slice spike)", () => {
  test("visibleRows pass-through when no filters or sort", () => {
    const h = buildSortFilterHarness({
      rows: [makeRow("a"), makeRow("b"), makeRow("c")],
    });
    expect(h.slice.visibleRows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  test("filters narrow visibleRows", () => {
    const h = buildSortFilterHarness({
      rows: [
        makeRow("a", { x: 1 }),
        makeRow("b", { x: 2 }),
        makeRow("c", { x: 3 }),
      ],
    });
    h.slice.setColumnFilter("x", { field: "x", kind: "numeric", operator: "gt", value: 1 });
    expect(h.slice.visibleRows.map((r) => r.id)).toEqual(["b", "c"]);
  });

  test("sort + filter compose", () => {
    const h = buildSortFilterHarness({
      rows: [
        makeRow("a", { x: 3 }),
        makeRow("b", { x: 1 }),
        makeRow("c", { x: 2 }),
      ],
      columns: [textCol("x")],
    });
    h.slice.setColumnFilter("x", { field: "x", kind: "numeric", operator: "gte", value: 2 });
    h.slice.sortBy("x", "asc");
    expect(h.slice.visibleRows.map((r) => r.id)).toEqual(["c", "a"]);
  });

  test("styleEdits.rows merge into row.style BEFORE filter/sort (cross-slice dep)", () => {
    const h = buildSortFilterHarness({
      rows: [
        makeRow("a", {}, { label: "A" }),
      ],
    });
    expect(h.slice.visibleRows[0].style).toBeUndefined();
    // Cross-slice mutation — same edge as axis.test-harness's setForestWidth.
    h.setStyleEdits({ rows: { a: { emphasis: true } }, cells: {} });
    expect(h.slice.visibleRows[0].style?.emphasis).toBe(true);
  });

  test("styleEdits.cells merge per-field (cross-slice dep, deep path)", () => {
    const h = buildSortFilterHarness({
      rows: [makeRow("a", { x: 1, y: 2 })],
    });
    h.setStyleEdits({
      rows: {},
      cells: { a: { x: { muted: true } } },
    });
    const row = h.slice.visibleRows[0];
    expect(row.cellStyles?.x?.muted).toBe(true);
    expect(row.cellStyles?.y).toBeUndefined();
  });

  test("data-source mutation propagates through visibleRows (cross-slice spec dep)", () => {
    const h = buildSortFilterHarness({
      rows: [makeRow("a"), makeRow("b")],
    });
    expect(h.slice.visibleRows).toHaveLength(2);
    h.setRows([makeRow("c"), makeRow("d"), makeRow("e")]);
    expect(h.slice.visibleRows).toHaveLength(3);
    expect(h.slice.visibleRows.map((r) => r.id)).toEqual(["c", "d", "e"]);
  });
});

describe("sort-filter slice — reset", () => {
  test("reset wipes sort, filters, and popover", () => {
    const h = buildSortFilterHarness();
    h.slice.setColumnFilter("hr", { field: "hr", kind: "numeric", operator: "eq", value: 1 });
    h.slice.sortBy("hr", "asc");
    h.slice.reset();
    expect(h.slice.filters).toEqual({});
    expect(h.slice.sortConfig).toBeNull();
    expect(h.slice.filterPopoverTarget).toBeNull();
  });
});
