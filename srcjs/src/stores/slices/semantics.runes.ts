// Unit tests for the semantics slice (Phase 0c-C1 PR6).
//
// Smaller slice with bounded state. The interesting bits: paint-as-selection
// (selectedRowIds is the active token's painted-row set), the baseline-
// collapse logic in setRowSemantic / setCellSemantic (writing back the
// spec-default value clears the override instead of recording it), and the
// fan-out semantics of clearSemantic / clearCellSemantic.

import { describe, expect, test } from "vitest";
import { createSemanticsSlice } from "./semantics.svelte";
import type { Row } from "$types";
import type { OpRecord } from "$lib/op-recorder";

function buildDeps(rows: Row[] = []) {
  const opLog: OpRecord[] = [];
  const sourceMarks: string[] = [];
  return {
    deps: {
      getSpec: () => ({ data: { rows } }),
      appendOp: (r: OpRecord) => { opLog.push(r); },
      markSource: (f: string) => { sourceMarks.push(f); },
    },
    opLog,
    sourceMarks,
  };
}

function row(id: string, style?: Row["style"], cellStyles?: Row["cellStyles"]): Row {
  return { id, label: id, metadata: {}, style, cellStyles };
}

describe("semantics slice — paintTool", () => {
  test("setPaintTool mutates + clears paintHoverCellField + marks source", () => {
    const { deps, sourceMarks } = buildDeps();
    const s = createSemanticsSlice(deps);
    s.setPaintHoverCellField("r1:x");
    s.setPaintTool({ token: "muted", scope: "cell" });
    expect(s.paintTool).toEqual({ token: "muted", scope: "cell" });
    expect(s.paintHoverCellField).toBeNull();
    expect(sourceMarks).toEqual(["paint_tool"]);
  });

  test("setPaintHoverCellField writes without source-mark", () => {
    const { deps, sourceMarks } = buildDeps();
    const s = createSemanticsSlice(deps);
    s.setPaintHoverCellField("r1:hr");
    expect(s.paintHoverCellField).toBe("r1:hr");
    expect(sourceMarks).toEqual([]);
  });
});

describe("semantics slice — row paint", () => {
  test("setRowSemantic on records op + source-tags + 'selected' when active token", () => {
    const { deps, opLog, sourceMarks } = buildDeps([row("r1")]);
    const s = createSemanticsSlice(deps);
    s.setRowSemantic("r1", "accent", true); // active token is accent by default
    expect(s.styleEdits.rows["r1"]?.accent).toBe(true);
    expect(opLog[0].kind).toBe("paint_row");
    expect(sourceMarks).toEqual(["row_styles", "selected"]);
  });

  test("setRowSemantic that matches spec baseline collapses to no override", () => {
    const { deps } = buildDeps([row("r1", { emphasis: true })]);
    const s = createSemanticsSlice(deps);
    s.setRowSemantic("r1", "emphasis", true);
    // baseline already true → no override stored
    expect(s.styleEdits.rows["r1"]).toBeUndefined();
  });

  test("setRowSemantic with non-active token does NOT mark 'selected'", () => {
    const { deps, sourceMarks } = buildDeps([row("r1")]);
    const s = createSemanticsSlice(deps);
    s.setRowSemantic("r1", "muted", true); // active is accent
    expect(sourceMarks).toEqual(["row_styles"]);
  });

  test("paintRowWithActiveToken toggles off when active token already set", () => {
    const { deps } = buildDeps([row("r1")]);
    const s = createSemanticsSlice(deps);
    s.setRowSemantic("r1", "accent", true);
    s.paintRowWithActiveToken("r1");
    expect(s.styleEdits.rows["r1"]?.accent).toBeFalsy();
  });

  test("paintRowWithActiveToken clears OTHER token before applying active", () => {
    const { deps } = buildDeps([row("r1")]);
    const s = createSemanticsSlice(deps);
    s.setRowSemantic("r1", "muted", true);
    s.paintRowWithActiveToken("r1"); // applies accent, clears muted
    expect(s.styleEdits.rows["r1"]?.accent).toBe(true);
    expect(s.styleEdits.rows["r1"]?.muted).toBeFalsy();
  });
});

describe("semantics slice — cell paint", () => {
  test("setCellSemantic records and stores nested override", () => {
    const { deps, opLog } = buildDeps([row("r1")]);
    const s = createSemanticsSlice(deps);
    s.setCellSemantic("r1", "hr", "muted", true);
    expect(s.styleEdits.cells["r1"]?.hr?.muted).toBe(true);
    expect(opLog[0].kind).toBe("paint_cell");
  });

  test("setCellSemantic on baseline-true collapses to no override", () => {
    const { deps } = buildDeps([row("r1", undefined, { hr: { muted: true } })]);
    const s = createSemanticsSlice(deps);
    s.setCellSemantic("r1", "hr", "muted", true);
    expect(s.styleEdits.cells["r1"]).toBeUndefined();
  });

  test("paintCellWithActiveToken toggles + clears other tokens", () => {
    const { deps } = buildDeps([row("r1")]);
    const s = createSemanticsSlice(deps);
    s.setCellSemantic("r1", "hr", "muted", true);
    s.paintCellWithActiveToken("r1", "hr");
    expect(s.styleEdits.cells["r1"]?.hr?.accent).toBe(true);
    expect(s.styleEdits.cells["r1"]?.hr?.muted).toBeFalsy();
  });
});

describe("semantics slice — selectedRowIds (paint-as-selection)", () => {
  test("selectedRowIds tracks rows painted with the active token", () => {
    const { deps } = buildDeps([row("r1"), row("r2"), row("r3")]);
    const s = createSemanticsSlice(deps);
    expect(s.selectedRowIds.size).toBe(0);
    s.setRowSemantic("r1", "accent", true);
    s.setRowSemantic("r2", "muted", true); // non-active
    s.setRowSemantic("r3", "accent", true);
    expect([...s.selectedRowIds].sort()).toEqual(["r1", "r3"]);
  });

  test("setSelectedRows replaces the active-token set", () => {
    const { deps } = buildDeps([row("r1"), row("r2"), row("r3")]);
    const s = createSemanticsSlice(deps);
    s.setRowSemantic("r1", "accent", true);
    s.setSelectedRows(["r2", "r3"]);
    expect([...s.selectedRowIds].sort()).toEqual(["r2", "r3"]);
    // r1's accent was cleared.
    expect(s.styleEdits.rows["r1"]?.accent).toBeFalsy();
  });

  test("changing the active token re-derives selectedRowIds", () => {
    const { deps } = buildDeps([row("r1"), row("r2")]);
    const s = createSemanticsSlice(deps);
    s.setRowSemantic("r1", "accent", true);
    s.setRowSemantic("r2", "muted", true);
    expect([...s.selectedRowIds]).toEqual(["r1"]);
    s.setPaintTool({ token: "muted", scope: "row" });
    expect([...s.selectedRowIds]).toEqual(["r2"]);
  });
});

describe("semantics slice — clear / get / hasPaintEdits", () => {
  test("clearSemantic fans out across every token", () => {
    const { deps, opLog } = buildDeps([row("r1")]);
    const s = createSemanticsSlice(deps);
    s.setRowSemantic("r1", "accent", true);
    s.setRowSemantic("r1", "bold", true);
    opLog.length = 0;
    s.clearSemantic("r1");
    // 5 paint_row ops, one per token, even if some were already off.
    expect(opLog.filter((o) => o.kind === "paint_row")).toHaveLength(5);
    expect(s.styleEdits.rows["r1"]).toBeUndefined();
  });

  test("getRowSemantic prefers override over spec baseline", () => {
    const { deps } = buildDeps([row("r1", { emphasis: false })]);
    const s = createSemanticsSlice(deps);
    expect(s.getRowSemantic(row("r1"), "emphasis")).toBe(false);
    s.setRowSemantic("r1", "emphasis", true);
    // After override, the slice's getter sees true.
    expect(s.getRowSemantic(row("r1"), "emphasis")).toBe(true);
  });

  test("getCellSemantic prefers override + baseline fallback", () => {
    const r = row("r1", undefined, { hr: { muted: true } });
    const { deps } = buildDeps([r]);
    const s = createSemanticsSlice(deps);
    expect(s.getCellSemantic(r, "hr", "muted")).toBe(true);
    s.setCellSemantic("r1", "hr", "muted", false);
    expect(s.getCellSemantic(r, "hr", "muted")).toBe(false);
  });

  test("hasPaintEdits flips true once any paint applied", () => {
    const { deps } = buildDeps([row("r1")]);
    const s = createSemanticsSlice(deps);
    expect(s.hasPaintEdits()).toBe(false);
    s.setRowSemantic("r1", "accent", true);
    expect(s.hasPaintEdits()).toBe(true);
  });

  test("clearAllPaint resets styleEdits + paintTool default", () => {
    const { deps } = buildDeps([row("r1")]);
    const s = createSemanticsSlice(deps);
    s.setPaintTool({ token: "muted", scope: "cell" });
    s.setRowSemantic("r1", "muted", true);
    s.clearAllPaint();
    expect(s.styleEdits.rows).toEqual({});
    expect(s.styleEdits.cells).toEqual({});
    expect(s.paintTool).toEqual({ token: "accent", scope: "row" });
  });

  test("reset = clearAllPaint + clears paintHoverCellField", () => {
    const { deps } = buildDeps();
    const s = createSemanticsSlice(deps);
    s.setPaintHoverCellField("r1:x");
    s.reset();
    expect(s.paintHoverCellField).toBeNull();
  });
});
