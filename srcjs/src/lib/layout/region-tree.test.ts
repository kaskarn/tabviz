import { describe, test, expect } from "bun:test";
import { buildRegionTree, flatten, type RegionTreeInput } from "./region-tree";
import type { Row, Group } from "$types";

const row = (id: string, groupId: string | null = null): Row =>
  ({ id, label: id.toUpperCase(), groupId, metadata: {} }) as Row;

const rowWithDetails = (id: string, details: string, groupId: string | null = null): Row =>
  ({ id, label: id.toUpperCase(), groupId, metadata: {}, details }) as Row;

const group = (id: string, depth: number, parentId: string | null = null): Group =>
  ({ id, label: id.toUpperCase(), depth, parentId }) as Group;

const NO_ORDER: RegionTreeInput["rowOrder"] = { byGroup: {}, groupOrderByParent: {} };
const NO_COLLAPSE = new Set<string>();

/** Convenience: build + flatten in one call. */
const dr = (input: RegionTreeInput, collapsed = NO_COLLAPSE) =>
  flatten(buildRegionTree(input), collapsed);

describe("region-tree — flat (no groups)", () => {
  test("emits data rows at depth 0 in order", () => {
    const out = dr({ groups: [], visibleRows: [row("a"), row("b")], rowOrder: NO_ORDER });
    expect(out).toEqual([
      { type: "data", row: row("a"), depth: 0 },
      { type: "data", row: row("b"), depth: 0 },
    ]);
  });
});

describe("region-tree — grouping + order", () => {
  test("group header precedes its rows; depth = group.depth, row depth = group.depth + 1", () => {
    const out = dr({
      groups: [group("g1", 0)],
      visibleRows: [row("a", "g1"), row("b", "g1")],
      rowOrder: NO_ORDER,
    });
    expect(out.map((d) => (d.type === "group_header" ? `H:${d.group.id}@${d.depth}/${d.rowCount}` : d.type === "data" ? `D:${d.row.id}@${d.depth}` : `P:${d.rowId}`)))
      .toEqual(["H:g1@0/2", "D:a@1", "D:b@1"]);
  });

  test("order is: child-group subtrees, then the level's direct rows", () => {
    // root has group g1 (with rows) AND a direct row z → g1 subtree first, then z
    const out = dr({
      groups: [group("g1", 0)],
      visibleRows: [row("z"), row("a", "g1")],
      rowOrder: NO_ORDER,
    });
    expect(out.map((d) => (d.type === "group_header" ? d.group.id : d.type === "data" ? d.row.id : d.rowId)))
      .toEqual(["g1", "a", "z"]);
  });

  test("nested groups: header → child header → child rows → parent direct rows", () => {
    const out = dr({
      groups: [group("p", 0), group("c", 1, "p")],
      visibleRows: [row("cr", "c"), row("pr", "p")],
      rowOrder: NO_ORDER,
    });
    expect(out.map((d) => (d.type === "group_header" ? `H:${d.group.id}@${d.depth}` : d.type === "data" ? `D:${d.row.id}@${d.depth}` : `P:${d.rowId}`)))
      .toEqual(["H:p@0", "H:c@1", "D:cr@2", "D:pr@1"]);
  });

  test("ancestor groups with no direct data still get headers (parent of a data group)", () => {
    const out = dr({
      groups: [group("p", 0), group("c", 1, "p")],
      visibleRows: [row("cr", "c")],
      rowOrder: NO_ORDER,
    });
    expect(out.filter((d) => d.type === "group_header").map((d) => (d as { group: Group }).group.id))
      .toEqual(["p", "c"]);
    // p's rowCount counts the descendant in c
    const ph = out.find((d) => d.type === "group_header" && d.group.id === "p");
    expect(ph && ph.type === "group_header" ? ph.rowCount : -1).toBe(1);
  });

  test("groups with no data anywhere produce no headers", () => {
    const out = dr({
      groups: [group("empty", 0)],
      visibleRows: [row("a")],
      rowOrder: NO_ORDER,
    });
    expect(out).toEqual([{ type: "data", row: row("a"), depth: 0 }]);
  });
});

describe("region-tree — reorder overrides", () => {
  test("byGroup reorders rows within a group", () => {
    const out = dr({
      groups: [group("g1", 0)],
      visibleRows: [row("a", "g1"), row("b", "g1"), row("c", "g1")],
      rowOrder: { byGroup: { g1: ["c", "a", "b"] }, groupOrderByParent: {} },
    });
    expect(out.filter((d) => d.type === "data").map((d) => (d as { row: Row }).row.id))
      .toEqual(["c", "a", "b"]);
  });

  test("root rows reorder via the __root__ scope key", () => {
    const out = dr({
      groups: [],
      visibleRows: [row("a"), row("b"), row("c")],
      rowOrder: { byGroup: { __root__: ["b", "c", "a"] }, groupOrderByParent: {} },
    });
    expect(out.map((d) => (d as { row: Row }).row.id)).toEqual(["b", "c", "a"]);
  });

  test("groupOrderByParent reorders sibling groups", () => {
    const out = dr({
      groups: [group("g1", 0), group("g2", 0)],
      visibleRows: [row("a", "g1"), row("b", "g2")],
      rowOrder: { byGroup: {}, groupOrderByParent: { __root__: ["g2", "g1"] } },
    });
    expect(out.filter((d) => d.type === "group_header").map((d) => (d as { group: Group }).group.id))
      .toEqual(["g2", "g1"]);
  });
});

describe("region-tree — details panels (flatten-time, expandedRows)", () => {
  test("a row with details emits its panel only when expanded", () => {
    const input: RegionTreeInput = {
      groups: [],
      visibleRows: [row("a"), rowWithDetails("b", "**note**"), row("c")],
      rowOrder: NO_ORDER,
    };
    const tree = buildRegionTree(input);

    const closed = flatten(tree, NO_COLLAPSE); // expandedRows defaults to empty
    expect(closed.map((d) => d.type)).toEqual(["data", "data", "data"]);

    const open = flatten(tree, NO_COLLAPSE, new Set(["b"]));
    expect(open.map((d) => (d.type === "panel" ? `P:${d.rowId}` : d.type)))
      .toEqual(["data", "data", "P:b", "data"]); // panel right after its owner row
    const panel = open.find((d) => d.type === "panel");
    expect(panel && panel.type === "panel" ? panel.content : "").toBe("**note**");
  });

  test("rows without details never emit a panel, even if id is in expandedRows", () => {
    const input: RegionTreeInput = {
      groups: [],
      visibleRows: [row("a")],
      rowOrder: NO_ORDER,
    };
    const out = flatten(buildRegionTree(input), NO_COLLAPSE, new Set(["a"]));
    expect(out.every((d) => d.type !== "panel")).toBe(true);
  });

  test("empty/whitespace details does not create a panel", () => {
    const input: RegionTreeInput = {
      groups: [],
      visibleRows: [rowWithDetails("a", "   ")],
      rowOrder: NO_ORDER,
    };
    const out = flatten(buildRegionTree(input), NO_COLLAPSE, new Set(["a"]));
    expect(out.every((d) => d.type !== "panel")).toBe(true);
  });

  test("a collapsed group hides its rows' panels too (subtree skipped)", () => {
    const input: RegionTreeInput = {
      groups: [group("g1", 0)],
      visibleRows: [rowWithDetails("a", "x", "g1")],
      rowOrder: NO_ORDER,
    };
    const out = flatten(buildRegionTree(input), new Set(["g1"]), new Set(["a"]));
    expect(out.map((d) => d.type)).toEqual(["group_header"]); // header only
  });
});

describe("region-tree — collapse (flatten-time)", () => {
  test("a collapsed group emits its header (collapsed=true) but not its subtree", () => {
    const input: RegionTreeInput = {
      groups: [group("g1", 0)],
      visibleRows: [row("a", "g1"), row("b", "g1")],
      rowOrder: NO_ORDER,
    };
    const tree = buildRegionTree(input);
    const open = flatten(tree, NO_COLLAPSE);
    const shut = flatten(tree, new Set(["g1"]));

    expect(open.length).toBe(3); // header + 2 rows
    expect(shut.length).toBe(1); // header only
    const h = shut[0];
    expect(h.type === "group_header" && h.group.collapsed).toBe(true);
    // rowCount is collapse-independent (still 2)
    expect(h.type === "group_header" ? h.rowCount : -1).toBe(2);
  });

  test("buildRegionTree is collapse-independent (same tree feeds both states)", () => {
    const input: RegionTreeInput = {
      groups: [group("g1", 0)],
      visibleRows: [row("a", "g1")],
      rowOrder: NO_ORDER,
    };
    const tree = buildRegionTree(input);
    // Re-flattening the SAME tree with different collapse sets is the structural/
    // state split — building does not depend on collapse.
    expect(flatten(tree, NO_COLLAPSE).length).toBe(2);
    expect(flatten(tree, new Set(["g1"])).length).toBe(1);
  });
});
