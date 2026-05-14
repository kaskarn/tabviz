// Unit tests for the rows-groups slice (Phase 0c-C1 PR5).
//
// First slice where a $derived (fullDisplayRows) reads from another slice's
// $derived (sort-filter's visibleRows) — the harness wraps a $state-backed
// reactive ref to simulate that edge.

import { describe, expect, test } from "vitest";
import { buildRowsGroupsHarness, makeRow, makeGroup } from "./rows-groups.test-harness.svelte";
import type { DisplayRow } from "$types";

describe("rows-groups slice — groupMap / groupDepthMap", () => {
  test("groupMap is keyed by group id", () => {
    const groups = [makeGroup("g1", { label: "G1" }), makeGroup("g2", { label: "G2", depth: 1 })];
    const h = buildRowsGroupsHarness({ groups });
    expect(h.slice.groupMap.get("g1")?.label).toBe("G1");
    expect(h.slice.groupMap.get("g2")?.depth).toBe(1);
  });

  test("groupDepthMap returns each group's depth", () => {
    const groups = [makeGroup("a", { depth: 0 }), makeGroup("b", { depth: 1 })];
    const h = buildRowsGroupsHarness({ groups });
    expect(h.slice.groupDepthMap.get("a")).toBe(0);
    expect(h.slice.groupDepthMap.get("b")).toBe(1);
  });

  test("maxGroupDepth returns the deepest level", () => {
    const groups = [
      makeGroup("a", { depth: 0 }),
      makeGroup("b", { depth: 1, parentId: "a" }),
      makeGroup("c", { depth: 2, parentId: "b" }),
    ];
    const h = buildRowsGroupsHarness({ groups });
    // computeMaxGroupDepth returns depth+1 (1-based count, 0 when none).
    expect(h.slice.maxGroupDepth).toBeGreaterThanOrEqual(3);
  });
});

describe("rows-groups slice — collapse", () => {
  test("toggleGroup flips collapse + source-tags", () => {
    const h = buildRowsGroupsHarness({ groups: [makeGroup("g")] });
    expect(h.slice.collapsedGroups.has("g")).toBe(false);
    h.slice.toggleGroup("g");
    expect(h.slice.collapsedGroups.has("g")).toBe(true);
    expect(h.sourceMarks).toEqual(["collapsed_groups"]);
    h.slice.toggleGroup("g");
    expect(h.slice.collapsedGroups.has("g")).toBe(false);
  });

  test("toggleGroup(id, true) collapses explicitly", () => {
    const h = buildRowsGroupsHarness({ groups: [makeGroup("g")] });
    h.slice.toggleGroup("g", true);
    h.slice.toggleGroup("g", true); // idempotent
    expect(h.slice.collapsedGroups.has("g")).toBe(true);
  });
});

describe("rows-groups slice — fullDisplayRows (cross-slice $derived)", () => {
  test("empty fullDisplayRows when spec has no rows", () => {
    const h = buildRowsGroupsHarness();
    expect(h.slice.fullDisplayRows).toEqual([]);
  });

  test("flat rows (no groups) flow through 1-for-1", () => {
    const rows = [makeRow("a"), makeRow("b"), makeRow("c")];
    const h = buildRowsGroupsHarness({ rows, visibleRows: rows });
    const dr = h.slice.fullDisplayRows;
    expect(dr).toHaveLength(3);
    expect(dr.every((r) => r.type === "data")).toBe(true);
  });

  test("group_header rows interleave with data rows in hierarchy order", () => {
    const groups = [makeGroup("g1", { label: "G1" })];
    const rows = [
      makeRow("a", {}, { groupId: "g1" }),
      makeRow("b", {}, { groupId: "g1" }),
    ];
    const h = buildRowsGroupsHarness({ rows, groups, visibleRows: rows });
    const dr = h.slice.fullDisplayRows;
    expect(dr).toHaveLength(3);
    expect(dr[0].type).toBe("group_header");
    expect(dr[0].type === "group_header" && dr[0].group.id).toBe("g1");
    expect(dr[0].type === "group_header" && dr[0].rowCount).toBe(2);
  });

  test("collapsed group hides its children but keeps the header", () => {
    const groups = [makeGroup("g1")];
    const rows = [makeRow("a", {}, { groupId: "g1" }), makeRow("b", {}, { groupId: "g1" })];
    const h = buildRowsGroupsHarness({ rows, groups, visibleRows: rows });
    h.slice.toggleGroup("g1", true);
    const dr = h.slice.fullDisplayRows;
    expect(dr).toHaveLength(1); // just the header
    expect(dr[0].type).toBe("group_header");
    expect(dr[0].type === "group_header" && dr[0].group.collapsed).toBe(true);
  });

  test("mutating visibleRows (cross-slice dep) re-runs fullDisplayRows", () => {
    const rows = [makeRow("a"), makeRow("b")];
    const h = buildRowsGroupsHarness({ rows, visibleRows: rows });
    expect(h.slice.fullDisplayRows).toHaveLength(2);
    // Simulate sort-filter slice narrowing visibleRows to one row.
    h.setVisibleRows([makeRow("a")]);
    expect(h.slice.fullDisplayRows).toHaveLength(1);
    // Reactivity check: ids reflect new content.
    expect(
      h.slice.fullDisplayRows.map((r) => r.type === "data" ? r.row.id : "h"),
    ).toEqual(["a"]);
  });

  test("rowOrderOverrides reorder visibleRows within their group", () => {
    const groups = [makeGroup("g1")];
    const rows = [
      makeRow("a", {}, { groupId: "g1" }),
      makeRow("b", {}, { groupId: "g1" }),
      makeRow("c", {}, { groupId: "g1" }),
    ];
    const h = buildRowsGroupsHarness({ rows, groups, visibleRows: rows });
    h.slice.moveRowItem("c", 0);
    const ids = h.slice.fullDisplayRows
      .filter((r): r is Extract<DisplayRow, { type: "data" }> => r.type === "data")
      .map((r) => r.row.id);
    expect(ids).toEqual(["c", "a", "b"]);
  });
});

describe("rows-groups slice — row reorder methods", () => {
  test("moveRowItem records move_row op", () => {
    const rows = [makeRow("a"), makeRow("b"), makeRow("c")];
    const h = buildRowsGroupsHarness({ rows, visibleRows: rows });
    h.slice.moveRowItem("c", 0);
    expect(h.opLog[0].kind).toBe("move_row");
  });

  test("moveRowGroupItem reorders groups under same parent", () => {
    const groups = [
      makeGroup("ga"), makeGroup("gb"),
    ];
    const rows = [makeRow("a", {}, { groupId: "ga" }), makeRow("b", {}, { groupId: "gb" })];
    const h = buildRowsGroupsHarness({ rows, groups, visibleRows: rows });
    // Pre-seed siblings-for-group by setting displayRows (the slice's
    // siblingsForRowGroupScope reads from there).
    h.setDisplayRows([
      { type: "group_header", group: groups[0], rowCount: 1, depth: 0 },
      { type: "group_header", group: groups[1], rowCount: 1, depth: 0 },
    ]);
    h.slice.moveRowGroupItem("gb", 0);
    expect(h.slice.rowOrderOverrides.groupOrderByParent["__root__"])
      .toEqual(["gb", "ga"]);
  });

  test("clearRowReorder() clears every override", () => {
    const rows = [makeRow("a"), makeRow("b")];
    const h = buildRowsGroupsHarness({ rows, visibleRows: rows });
    h.slice.moveRowItem("b", 0);
    expect(Object.keys(h.slice.rowOrderOverrides.byGroup).length).toBeGreaterThan(0);
    h.slice.clearRowReorder();
    expect(h.slice.rowOrderOverrides.byGroup).toEqual({});
    expect(h.slice.rowOrderOverrides.groupOrderByParent).toEqual({});
  });

  test("clearRowReorder(scope) clears only that scope", () => {
    const groups = [makeGroup("g1"), makeGroup("g2")];
    const rows = [
      makeRow("a", {}, { groupId: "g1" }), makeRow("b", {}, { groupId: "g1" }),
      makeRow("c", {}, { groupId: "g2" }), makeRow("d", {}, { groupId: "g2" }),
    ];
    const h = buildRowsGroupsHarness({ rows, groups, visibleRows: rows });
    h.slice.moveRowItem("b", 0);
    h.slice.moveRowItem("d", 0);
    h.slice.clearRowReorder("g1");
    expect(h.slice.rowOrderOverrides.byGroup["g1"]).toBeUndefined();
    expect(h.slice.rowOrderOverrides.byGroup["g2"]).toBeDefined();
  });
});

describe("rows-groups slice — hover + tooltip", () => {
  test("setHovered + setTooltip mutate + source-tag", () => {
    const h = buildRowsGroupsHarness();
    h.slice.setHovered("r1");
    expect(h.slice.hoveredRowId).toBe("r1");
    expect(h.sourceMarks).toEqual(["hover"]);
    h.slice.setTooltip("r1", { x: 10, y: 20 });
    expect(h.slice.tooltipRowId).toBe("r1");
    expect(h.slice.tooltipPosition).toEqual({ x: 10, y: 20 });
  });

  test("tooltipRow merges cellEdits ($cross-slice dep on cells slice)", () => {
    const rows = [makeRow("r1", { name: "Original", hr: 0.5 })];
    const cols = [{ id: "name", header: "Name", field: "name", type: "text", align: "left", sortable: true, isGroup: false } as never];
    const h = buildRowsGroupsHarness({ rows, columns: cols });
    h.slice.setTooltip("r1", { x: 0, y: 0 });
    // Without any cellEdits: tooltipRow returns the base row.
    expect(h.slice.tooltipRow?.label).toBe("r1");
    // Now simulate the cells slice having an edit.
    h.setCellEdits({ cells: { r1: { name: "Renamed" } }, groups: {} });
    expect(h.slice.tooltipRow?.label).toBe("Renamed");
  });

  test("tooltipRow returns null when no tooltipRowId set", () => {
    const h = buildRowsGroupsHarness({ rows: [makeRow("r1")] });
    expect(h.slice.tooltipRow).toBeNull();
  });
});

describe("rows-groups slice — reset", () => {
  test("reset clears collapse + overrides + tooltip", () => {
    const groups = [makeGroup("g")];
    const rows = [makeRow("a", {}, { groupId: "g" })];
    const h = buildRowsGroupsHarness({ rows, groups, visibleRows: rows });
    h.slice.toggleGroup("g", true);
    h.slice.moveRowItem("a", 0);
    h.slice.setTooltip("a", { x: 0, y: 0 });
    h.slice.reset();
    expect(h.slice.collapsedGroups.size).toBe(0);
    expect(h.slice.rowOrderOverrides.byGroup).toEqual({});
    expect(h.slice.tooltipRowId).toBeNull();
    expect(h.slice.tooltipPosition).toBeNull();
  });
});
