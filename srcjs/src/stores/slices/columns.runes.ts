// Unit tests for the columns slice (Phase 0c-C1 PR9).
//
// Covers state + derived + column-edit methods (insert, hide, configure,
// reorder, resize) + lifecycle. `measureAutoColumns` needs a real
// `HTMLCanvasElement.getContext('2d')` which jsdom doesn't supply; the
// measurement path is exercised by the visual battery instead.

import { describe, expect, test } from "vitest";
import {
  buildColumnsHarness, buildHarnessSpec, colGroup, textCol,
} from "./columns.test-harness.svelte";
import { mintUniqueId, RESERVED_COLUMN_IDS } from "./columns.svelte";

describe("mintUniqueId (pure)", () => {
  test("returns the base when free", () => {
    expect(mintUniqueId("drug", new Set())).toBe("drug");
  });

  test("appends _2 when the base is taken", () => {
    expect(mintUniqueId("drug", new Set(["drug"]))).toBe("drug_2");
  });

  test("skips taken suffixes to land at the next free slot", () => {
    expect(mintUniqueId("drug", new Set(["drug", "drug_2", "drug_3"]))).toBe("drug_4");
  });

  test("RESERVED_COLUMN_IDS covers the framework-reserved keys", () => {
    expect(RESERVED_COLUMN_IDS.has("__root__")).toBe(true);
    expect(RESERVED_COLUMN_IDS.has("__start__")).toBe(true);
  });
});

describe("columns slice — derived blocks", () => {
  test("allColumns flattens the effective tree", () => {
    const h = buildColumnsHarness({
      columns: [textCol("a"), textCol("b"), textCol("c")],
    });
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  test("allColumns flattens nested column groups", () => {
    const h = buildColumnsHarness({
      columns: [textCol("a"), colGroup("g", "Group", [textCol("g1"), textCol("g2")])],
    });
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["a", "g1", "g2"]);
  });

  test("primaryColumnId is the leftmost id; null when empty", () => {
    const h1 = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    expect(h1.slice.primaryColumnId).toBe("a");
    const h2 = buildColumnsHarness({});
    expect(h2.slice.primaryColumnId).toBeNull();
  });

  test("forestColumns + vizColumns surface only viz types", () => {
    const h = buildColumnsHarness({
      columns: [
        textCol("a"),
        { id: "f", header: "F", field: "f", type: "forest", isGroup: false } as never,
        { id: "v", header: "V", field: "v", type: "viz_bar", isGroup: false } as never,
      ],
    });
    expect(h.slice.forestColumns.map((fc) => fc.column.id)).toEqual(["f"]);
    expect(h.slice.vizColumns.map((vc) => vc.column.id)).toEqual(["f", "v"]);
    expect(h.slice.hasExplicitForestColumns).toBe(true);
    expect(h.slice.hasVizColumns).toBe(true);
  });

  test("hasColumnEdits flips when state mutates", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    expect(h.slice.hasColumnEdits).toBe(false);
    h.slice.hideColumn("a");
    expect(h.slice.hasColumnEdits).toBe(true);
    h.slice.clearColumnEdits();
    expect(h.slice.hasColumnEdits).toBe(false);
  });
});

describe("columns slice — edits", () => {
  test("hideColumn drops the column from allColumns + records op", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.hideColumn("a");
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["b"]);
    expect(h.opLog[0].kind).toBe("remove_column");
    expect(h.sourceMarks).toContain("hidden_columns");
  });

  test("hideColumn is idempotent — second call is a no-op", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.hideColumn("a");
    h.opLog.length = 0;
    h.slice.hideColumn("a");
    expect(h.opLog).toHaveLength(0);
  });

  test("insertColumn splices after the anchor + mints a unique id", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.insertColumn(textCol("a", "a"), "a");
    const ids = h.slice.allColumns.map((c) => c.id);
    expect(ids[0]).toBe("a");
    expect(ids[1]).toBe("a_2");
    expect(ids[2]).toBe("b");
    expect(h.opLog[0].kind).toBe("add_column");
  });

  test("insertColumn(__start__) splices at position 0", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.insertColumn(textCol("zz"), "__start__");
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["zz", "a", "b"]);
  });

  // Regression for GH #7 — applyColumnEdits used to filter the original
  // spec.columns by hiddenColumnIds but ignored userInsertedColumns; hiding
  // a runtime-inserted column was a no-op in the rendered output.
  test("hideColumn drops a user-inserted column (GH #7)", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.insertColumn(textCol("inserted"), "a");
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["a", "inserted", "b"]);
    h.slice.hideColumn("inserted");
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["a", "b"]);
  });

  test("hideColumn drops a user-inserted column at __start__ (GH #7)", () => {
    const h = buildColumnsHarness({ columns: [textCol("a")] });
    h.slice.insertColumn(textCol("zz"), "__start__");
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["zz", "a"]);
    h.slice.hideColumn("zz");
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["a"]);
  });

  test("updateColumn replaces in place + records a thin patch", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.updateColumn("a", { ...textCol("a"), header: "AA" });
    expect(h.slice.allColumns.find((c) => c.id === "a")?.header).toBe("AA");
    expect(h.opLog[0].kind).toBe("update_column");
  });

  test("updateColumnPatch merges + leaves untouched fields intact", () => {
    const h = buildColumnsHarness({ columns: [textCol("a", "a", { header: "old", wrap: false })] });
    h.slice.updateColumnPatch("a", { header: "new" });
    const col = h.slice.allColumns.find((c) => c.id === "a");
    expect(col?.header).toBe("new");
    expect(col?.wrap).toBe(false);
  });
});

describe("columns slice — widths", () => {
  test("setColumnWidth clamps at the 40px floor + records + tags", () => {
    const h = buildColumnsHarness({ columns: [textCol("a")] });
    h.slice.setColumnWidth("a", 10);
    expect(h.slice.columnWidths["a"]).toBe(40);
    expect(h.slice.userResizedIds.has("a")).toBe(true);
    expect(h.opLog[0].kind).toBe("resize_column");
    expect(h.sourceMarks).toContain("column_widths");
  });

  test("previewColumnWidth mutates width but emits no op", () => {
    const h = buildColumnsHarness({ columns: [textCol("a")] });
    h.slice.previewColumnWidth("a", 250);
    expect(h.slice.columnWidths["a"]).toBe(250);
    expect(h.opLog).toHaveLength(0);
    expect(h.slice.userResizedIds.has("a")).toBe(true);
  });

  test("clearAutoWidthsKeepingUserResizes wipes everything when no user resizes", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.previewColumnWidth("a", 100); // marks a user-resized
    // Simulate an auto-measured "b" without the user-resize gate
    h.slice.setColumnWidth("a", 100); // a is user-resized
    h.opLog.length = 0;
    h.slice.clearAutoWidthsKeepingUserResizes();
    // user-resized "a" survives; nothing else stored
    expect(h.slice.columnWidths["a"]).toBe(100);
  });
});

describe("columns slice — reorder", () => {
  test("moveColumnItem swaps top-level order + records op", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b"), textCol("c")] });
    h.slice.moveColumnItem("c", 0);
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["c", "a", "b"]);
    expect(h.opLog[0].kind).toBe("move_column");
    expect(h.sourceMarks).toContain("column_order");
  });

  test("clearColumnReorder reverts to the spec order", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b"), textCol("c")] });
    h.slice.moveColumnItem("c", 0);
    h.slice.clearColumnReorder();
    expect(h.slice.allColumns.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  test("findColumnScope returns the parent-group id for nested cols", () => {
    const h = buildColumnsHarness({
      columns: [textCol("a"), colGroup("g", "G", [textCol("g1"), textCol("g2")])],
    });
    expect(h.slice.findColumnScope("g1")).toBe("g");
    expect(h.slice.findColumnScope("a")).toBeNull();
  });
});

describe("columns slice — lifecycle", () => {
  // Interactivity-UX arc P0: hydrateForSpec reconciles figure-layout state
  // (widths/resize pins/hides/reorder) by column id instead of wiping —
  // a Shiny update_data must not destroy the user's layout. Column EDITS
  // (inserts, configure overrides) still reset with the spec.
  test("hydrateForSpec keeps layout state for columns that still exist", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.setColumnWidth("a", 120);
    h.slice.hideColumn("b");
    h.slice.hydrateForSpec();
    expect(h.slice.columnWidths).toEqual({ a: 120 });
    expect(h.slice.userResizedIds.has("a")).toBe(true);
    expect(h.slice.hiddenColumnIds.has("b")).toBe(true);
  });

  test("hydrateForSpec drops layout state anchored to disappeared ids", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.setColumnWidth("a", 120);
    h.slice.setColumnWidth("b", 90);
    h.slice.hideColumn("b");
    // New spec keeps only "b" → "a"'s width pin drops, "b"'s survive.
    h.setSpec(buildHarnessSpec([textCol("b"), textCol("c")]));
    h.slice.hydrateForSpec();
    expect(h.slice.columnWidths).toEqual({ b: 90 });
    expect(h.slice.userResizedIds.has("a")).toBe(false);
    expect(h.slice.hiddenColumnIds.has("b")).toBe(true);
  });

  test("hydrateForSpec seeds spec.figureLayout widths under session state", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b")] });
    h.slice.setColumnWidth("a", 150); // live session pin — must win
    h.setSpec({
      ...buildHarnessSpec([textCol("a"), textCol("b")]),
      figureLayout: {
        columnWidths: { a: 99, b: 120, ghost: 80 }, // ghost id → dropped
      },
    });
    h.slice.hydrateForSpec();
    expect(h.slice.columnWidths).toEqual({ a: 150, b: 120 });
    expect(h.slice.userResizedIds.has("b")).toBe(true); // block widths pin
    expect("ghost" in h.slice.columnWidths).toBe(false);
  });

  test("hydrateForSpec applies figureLayout column order only when session has none", () => {
    const h = buildColumnsHarness({ columns: [textCol("a"), textCol("b"), textCol("c")] });
    h.setSpec({
      ...buildHarnessSpec([textCol("a"), textCol("b"), textCol("c")]),
      figureLayout: { columnOrder: { topLevel: ["c", "a", "b"] } },
    });
    h.slice.hydrateForSpec();
    expect(h.slice.allColumns.map((col) => col.id)).toEqual(["c", "a", "b"]);

    // Session reorder survives a second hydrate even when the block differs.
    h.slice.moveColumnItem("b", 0);
    h.setSpec({
      ...buildHarnessSpec([textCol("a"), textCol("b"), textCol("c")]),
      figureLayout: { columnOrder: { topLevel: ["a", "b", "c"] } },
    });
    h.slice.hydrateForSpec();
    expect(h.slice.allColumns.map((col) => col.id)[0]).toBe("b");
  });

  test("hydrateForSpec still resets column edits (inserts + overrides)", () => {
    const h = buildColumnsHarness({ columns: [textCol("a")] });
    h.slice.insertColumn(textCol("z"), "a");
    h.slice.updateColumn("a", { ...textCol("a"), header: "AA" });
    h.slice.hydrateForSpec();
    expect(h.slice.userInsertedColumns).toHaveLength(0);
    expect(h.slice.allColumns.find((c) => c.id === "a")?.header).not.toBe("AA");
  });

  test("reset wipes everything (used by resetState)", () => {
    const h = buildColumnsHarness({ columns: [textCol("a")] });
    h.slice.insertColumn(textCol("z"), "a");
    h.slice.setColumnWidth("a", 80);
    h.slice.reset();
    expect(h.slice.userInsertedColumns).toHaveLength(0);
    expect(h.slice.columnWidths).toEqual({});
  });
});

describe("columns slice — mintUniqueColumnId integration", () => {
  test("collides with hidden/inserted/width/axisZoom entries too", () => {
    const h = buildColumnsHarness({
      columns: [textCol("a")],
      axisZooms: { "occupied_by_axis": { domain: [0, 1] } },
    });
    h.slice.hideColumn("a");
    h.slice.insertColumn(textCol("seed"), "__start__");
    const id = h.slice.mintUniqueColumnId("seed");
    // "seed" is taken by the just-inserted column; mint should return seed_2.
    expect(id).toBe("seed_2");
    expect(h.slice.mintUniqueColumnId("occupied_by_axis")).toBe("occupied_by_axis_2");
  });
});
